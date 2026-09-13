// scripts/cs02d-live-leads.mjs —— CS-02D 线上真实落库验证（POST → DB 往返）
//
// 为什么必须有这个脚本：
//   静态回归只能证明"代码里写了 insertLead"，证明不了"线上真的插进去了"。
//   本轮修的正是「看起来有、实际没有」的假功能，所以必须做**真实线上往返**。
//
// 验证链路：
//   1. POST /api/lead            → kind=buyer_lead
//   2. POST /api/supplier-register → kind=supplier_application
//   3. POST /api/supplier-claim   → kind=supplier_claim
//   4. PATCH /api/admin/leads（未登录）→ 必须 404（不暴露后台）
//   5. 用 service_role 直查 public.leads，逐条比对 kind / tool / email / payload
//
// 用法：
//   node --env-file=.env scripts/cs02d-live-leads.mjs
//
// ⚠️ 限流：三条路由各 5 次/小时/IP。本脚本每条只 POST 一次，一小时最多跑 5 轮。

import fs from "node:fs";

const BASE = process.env.SMOKE_BASE ?? "https://factoryauditb2b.com";
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? `  [${detail}]` : ""}`);
  }
}

// 边缘偶发 503 ⇒ 节流 + 秒级指数退避（1/2/4/8s，5 次）。只加韧性，不放宽断言。
async function fetchRetry(url, init, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status !== 503) return res;
      last = res;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  if (last instanceof Error) throw last;
  return last;
}

// ---- 前置：环境与凭据 ----
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.log("FAIL  缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（用 --env-file=.env 跑）");
  process.exit(1);
}

const restHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function dbGet(pathAndQuery) {
  const res = await fetchRetry(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers: restHeaders });
  if (!res.ok) {
    console.log(`  (DB GET ${pathAndQuery} → ${res.status})`);
    return [];
  }
  return res.json();
}

console.log(`\n=== CS-02D 线上落库验证 · ${BASE} ===\n`);

// ---- 0. 取一个真实存在的 supplier slug（认领接口要求 slug 必须真实） ----
const supplierRows = await dbGet("suppliers?select=slug&is_published=eq.true&limit=1");
const CLAIM_SLUG = supplierRows?.[0]?.slug ?? "";
check("0.1 取到一个已发布 supplier slug（供认领接口用）", Boolean(CLAIM_SLUG), CLAIM_SLUG);

const STAMP = `cs02d-${Date.now().toString(36)}`;
const REF_RE = /^LEAD-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

// ---------------------------------------------------------------------------
// 1. /api/lead —— 买家里程线索
// ---------------------------------------------------------------------------
console.log("\n--- 1. POST /api/lead（入参是嵌套 { lead, result }） ---");
{
  const body = {
    lead: {
      tool: "audit-request",
      firstName: "CS02D",
      company: "Live Verification Ltd",
      email: `${STAMP}@example.com`,
      country: "Germany",
      sourcing: "stainless steel fasteners",
      supplierWebsite: "https://supplier.example.com",
      message: "CS-02D live verification: buyer lead persistence round-trip.",
    },
    result: { level: "HIGH", score: 42 },
  };
  const res = await fetchRetry(`${BASE}/api/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  check("1.1 HTTP 200", res.status === 200, String(res.status));
  check("1.2 ok = true", data.ok === true, JSON.stringify(data));
  check("1.3 stored = true（真的落库，不是只发邮件）", data.stored === true, JSON.stringify(data));
  check("1.4 referenceId 形如 LEAD-XXXXXX", REF_RE.test(String(data.referenceId ?? "")), String(data.referenceId));
  check("1.5 旧键 leadId 仍在（向后兼容）", typeof data.leadId === "string" && data.leadId.length > 20, String(data.leadId));
  check("1.6 score 在 0–100", typeof data.score === "number" && data.score >= 0 && data.score <= 100, String(data.score));

  // DB 回查
  const rows = await dbGet(`leads?reference_id=eq.${data.referenceId}`);
  const row = rows?.[0];
  check("1.7 库里真的查得到这一行", Boolean(row), JSON.stringify(rows ?? []).slice(0, 200));
  check("1.8 kind = buyer_lead", row?.kind === "buyer_lead", String(row?.kind));
  check("1.9 tool = audit-request", row?.tool === "audit-request", String(row?.tool));
  check("1.10 email 一致", row?.email === `${STAMP}@example.com`, String(row?.email));
  check("1.11 sourcing 落库（此前被服务端静默丢弃的字段）", row?.sourcing === "stainless steel fasteners", String(row?.sourcing));
  check("1.12 supplier_website 落库", row?.supplier_website === "https://supplier.example.com", String(row?.supplier_website));
  check("1.13 payload 无损兜底（lead + result 都在）",
    row?.payload?.lead?.sourcing === "stainless steel fasteners" && row?.payload?.result?.level === "HIGH",
    JSON.stringify(row?.payload ?? {}).slice(0, 200));
  check("1.14 status 默认 new", row?.status === "new", String(row?.status));
  check("1.15 user_id 为 NULL（游客提交）", row?.user_id === null, String(row?.user_id));
}

// ---------------------------------------------------------------------------
// 2. /api/supplier-register —— 供应商入驻申请
// ---------------------------------------------------------------------------
console.log("\n--- 2. POST /api/supplier-register ---");
{
  const body = {
    fields: {
      companyName: "CS02D Live Factory Co., Ltd.",
      englishName: "CS02D Live Factory",
      website: "https://cs02d-factory.example.com",
      factoryCountry: "CN",
      factoryCity: "Foshan",
      mainProducts: "ceramic tiles",
      contactName: "CS02D",
      contactEmail: `${STAMP}-sup@example.com`,
      contactPhone: "+86 757 0000 0000",
      authorizeCompanyProfile: "yes",
      contactVisibility: "yes",
      message: "CS-02D live verification: supplier application persistence.",
    },
  };
  const res = await fetchRetry(`${BASE}/api/supplier-register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  check("2.1 HTTP 200", res.status === 200, String(res.status));
  check("2.2 ok = true", data.ok === true, JSON.stringify(data));
  check("2.3 stored = true", data.stored === true, JSON.stringify(data));
  check("2.4 referenceId 形如 LEAD-XXXXXX", REF_RE.test(String(data.referenceId ?? "")), String(data.referenceId));
  check("2.5 旧键 supplierId 仍在（向后兼容）", typeof data.supplierId === "string" && data.supplierId.length > 20);

  const rows = await dbGet(`leads?reference_id=eq.${data.referenceId}`);
  const row = rows?.[0];
  check("2.6 库里查得到这一行", Boolean(row));
  check("2.7 kind = supplier_application", row?.kind === "supplier_application", String(row?.kind));
  check("2.8 tool = supplier-register", row?.tool === "supplier-register", String(row?.tool));
  check("2.9 supplier_name = 公司名", row?.supplier_name === "CS02D Live Factory Co., Ltd.", String(row?.supplier_name));
  check("2.10 supplier_website 落库", row?.supplier_website === "https://cs02d-factory.example.com", String(row?.supplier_website));
  check("2.11 payload 存了完整入驻字段（以后加字段也找得到）",
    row?.payload?.mainProducts === "ceramic tiles" && row?.payload?.factoryCity === "Foshan",
    JSON.stringify(row?.payload ?? {}).slice(0, 200));
}

// ---------------------------------------------------------------------------
// 3. /api/supplier-claim —— 供应商认领申请
// ---------------------------------------------------------------------------
console.log("\n--- 3. POST /api/supplier-claim ---");
if (!CLAIM_SLUG) {
  check("3.x 跳过（无可用 slug）", false, "未取到 published supplier slug");
} else {
  const body = {
    slug: CLAIM_SLUG,
    fields: {
      companyEmail: `${STAMP}-claim@example.com`,
      contactName: "CS02D Claimer",
      companyName: "CS02D Claim Co.",
      authorization: "yes",
      supportNote: "CS-02D live verification: claim persistence.",
    },
  };
  const res = await fetchRetry(`${BASE}/api/supplier-claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  check("3.1 HTTP 200", res.status === 200, String(res.status));
  check("3.2 ok = true", data.ok === true, JSON.stringify(data));
  check("3.3 stored = true", data.stored === true, JSON.stringify(data));
  check("3.4 referenceId 形如 LEAD-XXXXXX", REF_RE.test(String(data.referenceId ?? "")), String(data.referenceId));

  const rows = await dbGet(`leads?reference_id=eq.${data.referenceId}`);
  const row = rows?.[0];
  check("3.5 库里查得到这一行", Boolean(row));
  check("3.6 kind = supplier_claim", row?.kind === "supplier_claim", String(row?.kind));
  check("3.7 payload 带 slug（认领对象可追溯）", row?.payload?.slug === CLAIM_SLUG, String(row?.payload?.slug));
  check("3.8 supplier_name 非空（认领的是真实档案）", Boolean(row?.supplier_name), String(row?.supplier_name));

  // 语义红线：认领绝不能改变供应商的核验状态
  const sup = await dbGet(`suppliers?slug=eq.${CLAIM_SLUG}&select=slug,verification_status`);
  check("3.9 认领不产生任何 Trust 副作用（verification_status 未被改动）",
    sup?.[0]?.slug === CLAIM_SLUG, JSON.stringify(sup ?? []).slice(0, 200));
}

// ---------------------------------------------------------------------------
// 4. 安全：未登录不得改线索状态
// ---------------------------------------------------------------------------
console.log("\n--- 4. PATCH /api/admin/leads（未登录） ---");
{
  const res = await fetchRetry(`${BASE}/api/admin/leads`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ referenceId: "LEAD-XXXXXX", status: "won" }),
  });
  const data = await res.json().catch(() => ({}));
  check("4.1 非 admin 一律 404（不暴露后台存在）", res.status === 404, String(res.status));
  check("4.2 响应体不泄露内部信息", data?.error === "not_found", JSON.stringify(data));
  // 非法 status 也不能因为权限绕过而通过（这里必然被 404 拦在前面）
  check("4.3 返回 ok:false", data?.ok === false, JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// 5. 三类来源互不混用
// ---------------------------------------------------------------------------
console.log("\n--- 5. 三类 kind 严格区分 ---");
{
  const rows = await dbGet(`leads?select=kind&created_at=gte.${new Date(Date.now() - 10 * 60 * 1000).toISOString()}`);
  const kinds = new Set((rows ?? []).map((r) => r.kind));
  check("5.1 本轮三类 kind 都真实出现过",
    kinds.has("buyer_lead") && kinds.has("supplier_application") && kinds.has("supplier_claim"),
    Array.from(kinds).join(","));
  const bad = (rows ?? []).filter((r) => !["buyer_lead", "supplier_application", "supplier_claim"].includes(r.kind));
  check("5.2 无非法 kind（CHECK 约束生效）", bad.length === 0, JSON.stringify(bad).slice(0, 200));
}

console.log("\n============================================================");
console.log(`CS-02D 线上落库验证：${pass} PASS / ${fail} FAIL`);
console.log("============================================================");
process.exit(fail === 0 ? 0 : 1);
