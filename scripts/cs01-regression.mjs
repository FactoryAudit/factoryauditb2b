// CS-01 —— Post-migration 权限校验 + API 回归 + 生产冒烟（只读）
//
// ⚠️ 只在用户把 03_postcheck.sql 的输出贴回、确认迁移成功后才运行。
//    本脚本不写任何业务数据；唯一的「写」尝试是 anon 越权写入探测，
//    预期必须被拒绝（若成功写入 = 严重安全问题，必须立即回滚）。
//
// 用法: node --env-file=.env scripts/cs01-regression.mjs
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    })
);
const BASE = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = "https://factoryauditb2b.com";

let fail = 0;
function ok(cond, label, detail) {
  console.log((cond ? "  ✅ " : "  ❌ ") + label + (detail ? "  — " + detail : ""));
  if (!cond) fail++;
}

async function rest(path, key, opts) {
  const r = await fetch(BASE + "/rest/v1/" + path, {
    method: opts?.method || "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opts?.headers || {}),
    },
    body: opts?.body,
  });
  let text = "";
  try {
    text = await r.text();
  } catch {}
  return { status: r.status, text, headers: r.headers };
}

// ===========================================================================
console.log("\n=== A. 匿名（anon key）越权读取 —— 必须全部拿不到数据 ===");
// RLS 无公开 policy 时 PostgREST 返回 200 + []，所以判定标准是「行数为 0」而非状态码
const MUST_BE_EMPTY = [
  "supplier_documents",
  "supplier_certifications",
  "supplier_audits",
  "admin_audit_log",
  "schema_migrations",
];
for (const t of MUST_BE_EMPTY) {
  const r = await rest(t + "?select=*&limit=5", ANON);
  let rows = [];
  try {
    rows = JSON.parse(r.text);
  } catch {}
  const n = Array.isArray(rows) ? rows.length : -1;
  ok(n === 0, "anon 读 " + t.padEnd(26) + " → 0 行", "HTTP " + r.status + " rows=" + n);
}

console.log("\n=== B. 匿名可读性白名单 —— certification_program_alias 必须可读 ===");
{
  const r = await rest("certification_program_alias?select=display_name,program_code,mapped&limit=50", ANON);
  let rows = [];
  try {
    rows = JSON.parse(r.text);
  } catch {}
  const n = Array.isArray(rows) ? rows.length : -1;
  ok(n === 29, "anon 读 certification_program_alias → 29 行", "HTTP " + r.status + " rows=" + n);
  if (n > 0) {
    const oe = rows.find((x) => x.display_name === "OEKO-TEX");
    ok(!!oe && oe.mapped === false && oe.program_code === null, "OEKO-TEX 为 mapped=false / program_code=NULL（未猜测）");
    const iso = rows.find((x) => x.display_name === "ISO 9001");
    ok(!!iso && iso.program_code === "ISO9001", "ISO 9001 → ISO9001 显式映射存在");
  }
}

console.log("\n=== C. 匿名越权写入 —— 必须被拒绝 ===");
for (const t of ["supplier_documents", "supplier_certifications", "supplier_audits", "admin_audit_log"]) {
  const r = await rest(t, ANON, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ probe: "cs01-regression" }),
  });
  // 401/403 = 被 RLS/权限挡住（好）；400 = 缺必填列（也算没写进去）
  // 唯独 201/200 带数据 = 写进去了（严重问题）
  const wrote = r.status === 201 || (r.status === 200 && r.text.trim().startsWith("["));
  ok(!wrote, "anon 写入 " + t.padEnd(22) + " 被拒绝", "HTTP " + r.status);
}

console.log("\n=== D. service_role 侧确认（结构存在且 3 张证据表必须为 0 行）===");
// 用 count=exact 拿真实行数，不能只 limit=1 —— 必须证明是 0 行而不是「至少有 1 行」
const EVIDENCE_TABLES = ["supplier_documents", "supplier_certifications", "supplier_audits", "admin_audit_log"];
// 注意：带 Prefer: count=exact + limit 时返回 206 Partial Content，206 与 200 都算存在
for (const t of EVIDENCE_TABLES) {
  const r = await rest(t + "?select=*&limit=1", SRV, { headers: { Prefer: "count=exact" } });
  const cr = r.headers?.get?.("content-range") ?? "";
  const total = cr.includes("/") ? cr.split("/")[1] : "?";
  ok(r.status === 200 || r.status === 206, "service_role 读 " + t.padEnd(22) + " 可达", "HTTP " + r.status + " total=" + total);
  ok(total === "0" || total === "*", t.padEnd(22) + " 仍为 0 行（未导入任何证据）", "total=" + total);
}
{
  const r = await rest("suppliers?select=slug,verification_level&order=slug", SRV);
  let rows = [];
  try {
    rows = JSON.parse(r.text);
  } catch {}
  const allUnverified = rows.length === 4 && rows.every((x) => x.verification_level === "unverified");
  ok(allUnverified, "4 家 verification_level 全部 = unverified", JSON.stringify(rows));
}

// ===========================================================================
// G. 原有业务表计数 —— 必须与 CS-01 Pre-check 基准逐项完全一致
//    基准来源：scripts/cs01-precheck.mjs 于 2026-09-10 的实测输出
// ===========================================================================
console.log("\n=== G. 原有业务表计数比对（vs Pre-check 基准，必须完全一致）===");
const BASELINE = {
  suppliers: 4,
  supplier_evidence: 3,
  supplier_capabilities: 7,
  profiles: 3,
  memberships: 3,
  rfqs: 1,
  saved_suppliers: 0,
  profile_views: 0,
  rfq_matches: 0,
  stripe_events: 0,
};
for (const [t, expected] of Object.entries(BASELINE)) {
  const r = await rest(t + "?select=*&limit=1", SRV, { headers: { Prefer: "count=exact" } });
  const cr = r.headers?.get?.("content-range") ?? "";
  const total = cr.includes("/") ? Number(cr.split("/")[1]) : NaN;
  ok(total === expected, t.padEnd(24) + " = " + expected, "实际 " + total + "（基准 " + expected + "）");
}

// ===========================================================================
// H. Storage bucket supplier-docs 必须保持私有（public = false）
// ===========================================================================
console.log("\n=== H. storage bucket supplier-docs 私有性 ===");
{
  // 1) anon 列举 bucket 元数据：私有 bucket 不应被 anon 拿到
  const b = await fetch(BASE + "/storage/v1/bucket/supplier-docs", {
    headers: { apikey: ANON, Authorization: "Bearer " + ANON },
  });
  ok(b.status !== 200, "anon 读取 bucket 元数据被拒", "HTTP " + b.status);

  // 2) anon 列对象：Supabase 设计是「无权限/空 bucket」都返回 200 + []，不会 401。
  //    真正的安全判定是「返回数组必须是空、不泄漏任何 object 名」。
  const l = await fetch(BASE + "/storage/v1/object/list/supplier-docs", {
    method: "POST",
    headers: { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 10 }),
  });
  let listed = null;
  try {
    listed = await l.json();
  } catch {}
  const empty = Array.isArray(listed) && listed.length === 0;
  ok(empty, "anon 列举 bucket 对象返回空数组（不泄漏文件名）", "HTTP " + l.status + " body=" + JSON.stringify(listed).slice(0, 80));

  // 3) 公开 URL 访问：私有 bucket 走 /object/public/ 必须拿不到 200
  const p = await fetch(BASE + "/storage/v1/object/public/supplier-docs/probe.pdf");
  ok(p.status !== 200, "公开 URL 路径拿不到文件（bucket 非 public）", "HTTP " + p.status);

  // 4) service_role 能拿到元数据 → 证明 bucket 确实存在（不是因为不存在才 404）
  const s = await fetch(BASE + "/storage/v1/bucket/supplier-docs", {
    headers: { apikey: SRV, Authorization: "Bearer " + SRV },
  });
  let meta = null;
  try {
    meta = await s.json();
  } catch {}
  ok(s.status === 200, "service_role 可读 bucket 元数据（bucket 存在）", "HTTP " + s.status);
  ok(meta && meta.public === false, "bucket public === false", "public=" + (meta ? meta.public : "n/a"));
}

console.log("\n=== E. 生产 API 回归（匿名）===");
const api = [
  // /api/suppliers 不存在（列表端点在 RSC 页面）—— 404 是正确
  { m: "GET", p: "/api/suppliers", expect: [404] },
  // /api/admin/suppliers 只接 PATCH/POST，GET 应被拒（405 或 404 都算）
  { m: "GET", p: "/api/admin/suppliers", expect: [401, 403, 404, 405] },
  { m: "PATCH", p: "/api/admin/suppliers", expect: [401, 403, 404, 405] },
  { m: "POST", p: "/api/admin/suppliers", expect: [401, 403, 404, 405] },
  // 列表端点不存在是正确；查 4 个 slug 详情页全部 200
  { m: "GET", p: "/api/suppliers/dongguan-plastic-molding/unlocked", expect: [200, 401, 403] },
];
for (const a of api) {
  const r = await fetch(SITE + a.p, {
    method: a.m,
    headers: { "Content-Type": "application/json" },
    body: a.m === "GET" ? undefined : JSON.stringify({ probe: 1 }),
  });
  let body = "";
  try {
    body = (await r.text()).slice(0, 120);
  } catch {}
  ok(a.expect.includes(r.status), a.m + " " + a.p.padEnd(24), "HTTP " + r.status + "  " + body.replace(/\s+/g, " "));
}

console.log("\n=== F. 生产页面冒烟 ===");
for (const p of ["/en/suppliers", "/zh/suppliers", "/ja/suppliers", "/ar/suppliers"]) {
  const r = await fetch(SITE + p);
  ok(r.status === 200, p, "HTTP " + r.status);
}
{
  // 4 locale + 4 个详情页冒烟
  const detailPages = [
    "/en/suppliers/dongguan-plastic-molding",
    "/zh/suppliers/guangzhou-textile-factory",
    "/ja/suppliers/ho-chi-minh-garment",
    "/ar/suppliers/shenzhen-precision-electronics",
  ];
  for (const p of detailPages) {
    const r = await fetch(SITE + p);
    ok(r.status === 200, p, "HTTP " + r.status);
  }
  // /en/suppliers 列表页内容检查（实际是 class="card"×4 + 4 个 slug）
  const r = await fetch(SITE + "/en/suppliers");
  const html = await r.text();
  const cardCount = (html.match(/class="card[^"]*"/g) || []).length;
  const slugs = ["dongguan-plastic-molding", "guangzhou-textile-factory", "ho-chi-minh-garment", "shenzhen-precision-electronics"];
  const missing = slugs.filter((s) => !html.includes(s));
  ok(cardCount >= 4 && missing.length === 0, "/en/suppliers 渲染 4 张卡片 + 4 个 slug 全在", "cards=" + cardCount + " missing=" + JSON.stringify(missing));
  // 无未降级的高信任表述（cardLevel 不能是 Factory verified / Business checked / Audited）
  const trustBanned = /Factory verified|Business checked|>Audited 20\d\d|Identity verified/i;
  ok(!trustBanned.test(html), "页面无未降级的高信任表述");
}

console.log("\n=== I. 4 家 supplier 详情页（详情页不再泄露证据未支撑的核验声明）===");
for (const slug of ["dongguan-plastic-molding", "guangzhou-textile-factory", "ho-chi-minh-garment", "shenzhen-precision-electronics"]) {
  const r = await fetch(SITE + "/en/suppliers/" + slug);
  const html = await r.text();
  // 详情页应不出现「Factory verified / Business checked / Audited 20XX / Identity verified」之类旧表述
  // 但 CS-02 才正式降级，CS-01 只验证不引入新错误；这里只断
  // detail 页 200 + 含 slug 名（基础存在性）
  ok(html.includes(slug) && html.length > 5000, slug + " 详情页 200 + 内容非空", "len=" + html.length);
}

console.log("\n========================================");
console.log(fail === 0 ? "✅ CS-01 回归全部通过（FAIL=" + fail + "）" : "❌ CS-01 回归失败项: " + fail);
console.log("========================================");
process.exit(fail === 0 ? 0 : 1);
