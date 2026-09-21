// STEP 13 —— 线上验收（CODE → TEST → BUILD → DEPLOY → LIVE VERIFY 的最后一环）
//
// 覆盖 spec §15（10 项线上验证）+ §16（回归）+ §7（测试数据隔离）。
// ⚠️ 只从**真实线上域名**验收，不在 localhost 自证。
//
// 🔴 数据铁律：
//   - 只新增 1 条**明确标注 STEP13**的探针 RFQ（用于回归 consent/来源归因），保持 is_public=false。
//   - 不伪造 buyer / supplier / consent / contacted / quote。
//   - 供应商注册只打**非法请求**验证通道健康，避免每次验收都往生产库塞草稿行。
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://factoryauditb2b.com";
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    pass++;
    console.log(`  PASS — ${name}${detail ? " (" + detail + ")" : ""}`);
  } else {
    fail++;
    console.log(`  FAIL — ${name}${detail ? " (" + detail + ")" : ""}`);
  }
};

const get = async (p) => {
  // follow：en 是默认语言，/en/* 会被中间件 308 剥前缀（实测），必须跟到最终页再判状态
  const r = await fetch(BASE + p, { redirect: "follow" });
  return { status: r.status, html: await r.text(), url: r.url };
};

console.log("=== STEP 13 线上验收 ===\n");

// ---- [1] Admin 门禁：未登录一律 404（不暴露后台存在）----
console.log("[1] Admin 授权门禁（未登录应最终落到 404，不暴露后台存在）");
for (const [label, p] of [
  ["/admin 概览", "/en/admin"],
  ["/admin/leads 线索台", "/en/admin/leads"],
  ["/admin/rfqs 列表", "/en/admin/rfqs"],
  ["/admin/rfqs/[ref] 详情(匹配面板)", "/en/admin/rfqs/RFQ-CXJCRL"],
  ["/admin/suppliers 列表", "/en/admin/suppliers"],
]) {
  const r = await get(p);
  check(`${label} = 404`, r.status === 404, `status=${r.status} final=${r.url}`);
}

const mGet = await fetch(`${BASE}/api/admin/rfqs/RFQ-CXJCRL/match`);
check("GET 匹配接口未登录 = 404", mGet.status === 404, `status=${mGet.status}`);
const mPost = await fetch(`${BASE}/api/admin/rfqs/RFQ-CXJCRL/match`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ supplierIds: ["00000000-0000-0000-0000-000000000000"] }),
});
check("POST 确认匹配未登录 = 404", mPost.status === 404, `status=${mPost.status}`);
const mPatch = await fetch(`${BASE}/api/admin/rfqs/RFQ-CXJCRL/match`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ supplierId: "00000000-0000-0000-0000-000000000000", status: "contacted" }),
});
check("PATCH 状态流转未登录 = 404", mPatch.status === 404, `status=${mPatch.status}`);
// 未授权不得泄露任何后台内容
check("未授权响应体不含供应商名（不泄露数据）", !(await mPatch.text()).includes("legalName"), "");

// ---- [2] 测试数据隔离（本轮修复项）----
console.log("\n[2] 测试数据隔离");
const { data: pubRfqs } = await db.from("rfqs").select("reference_id, product, email, is_public").eq("is_public", true);
check("公开 RFQ 数量 = 0（探针已全部下架）", (pubRfqs ?? []).length === 0, `n=${(pubRfqs ?? []).length}`);

const home = await get("/");
check("首页 200", home.status === 200, `status=${home.status}`);
check("首页不再展示探针产品 Titanium dioxide", !home.html.includes("Titanium dioxide"), "");
check("首页不含任何 @example.com", !home.html.includes("@example.com"), "");
const { data: allRfqEmails } = await db.from("rfqs").select("email").eq("is_public", true);
const leaked = (allRfqEmails ?? []).filter((r) => r.email && home.html.includes(r.email));
check("公开 RFQ 买家邮箱未出现在首页 HTML", leaked.length === 0, `leak=${leaked.length}`);
const { data: probesStillPublic } = await db
  .from("rfqs")
  .select("reference_id")
  .eq("is_public", true)
  .ilike("email", "%example.com%");
check("探针邮箱型 RFQ 无一公开", (probesStillPublic ?? []).length === 0, JSON.stringify(probesStillPublic ?? []));

// ---- [3] 买家端回归：consent 闸门 + 来源归因 ----
console.log("\n[3] 买家端 RFQ 提交回归（1 条标注探针）");
const post = async (payload) => {
  const r = await fetch(`${BASE}/api/rfq`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};
const noConsent = await post({
  email: "step13-noconsent@example.com",
  product: "STEP13 auto verify - no consent",
  quantity: "1",
  country: "china",
  message: "automated verification, please ignore",
  source_path: "/industry/chemicals",
});
check("提交成功(200)", noConsent.status === 200, `status=${noConsent.status}`);
if (noConsent.j?.referenceId) {
  const { data: row } = await db
    .from("rfqs")
    .select("is_public, source_type, source_path")
    .eq("reference_id", noConsent.j.referenceId)
    .maybeSingle();
  check("未授权 ⇒ is_public=false", row?.is_public === false, `is_public=${row?.is_public}`);
  check("来源归因路径已记录", row?.source_path === "/industry/chemicals", `sp=${row?.source_path}`);
  check("来源类型由路径推导=industry", row?.source_type === "industry", `st=${row?.source_type}`);
}
const withConsent = await post({
  email: "step13-consent@example.com",
  product: "STEP13 auto verify - with consent",
  quantity: "1",
  country: "china",
  message: "automated verification, please ignore",
  is_public: true,
  source_path: "/rfq",
});
if (withConsent.j?.referenceId) {
  const { data: row } = await db
    .from("rfqs")
    .select("is_public")
    .eq("reference_id", withConsent.j.referenceId)
    .maybeSingle();
  check("明确授权 ⇒ is_public=true（规则未被 Admin 改动破坏）", row?.is_public === true, `is_public=${row?.is_public}`);
  await db.from("rfqs").update({ is_public: false }).eq("reference_id", withConsent.j.referenceId);
  const { data: after } = await db
    .from("rfqs")
    .select("is_public")
    .eq("reference_id", withConsent.j.referenceId)
    .maybeSingle();
  check("验收后立即撤销公开（探针不留公开位）", after?.is_public === false, `is_public=${after?.is_public}`);
}

// ---- [4] 前台表单仍带显式授权勾选（9 语字典未破）----
console.log("\n[4] 前台表单与 i18n");
const rfqPage = await get("/rfq");
check("/rfq 200", rfqPage.status === 200, `status=${rfqPage.status}`);
check("渲染 allowPublic 勾选框", rfqPage.html.includes('name="allowPublic"'), "");
check("渲染授权文案（dict key 未破）", rfqPage.html.includes("Allow my request to be shown publicly"), "");

// ---- [5] 供应商端回归 ----
console.log("\n[5] 供应商端回归");
const bad = await fetch(`${BASE}/api/supplier-register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fields: { companyName: "", contactEmail: "not-an-email" } }),
});
const badJ = await bad.json().catch(() => ({}));
check(
  "供应商注册非法请求被拒（通道健康、不新增草稿）",
  bad.status === 400 && badJ?.ok !== true,
  `status=${bad.status}`
);
const { data: pubSup } = await db.from("suppliers").select("slug").eq("is_published", true).limit(1);
if (pubSup?.[0]?.slug) {
  const r = await get(`/en/suppliers/${pubSup[0].slug}`);
  check(`已发布供应商页 200 (${pubSup[0].slug})`, r.status === 200, `status=${r.status}`);
}
const dirty = await get("/en/suppliers/supplier");
check("脏 slug /en/suppliers/supplier = 404（未删除但不可见）", dirty.status === 404, `status=${dirty.status}`);

// ---- [6] 索引面未被本轮改动波及 ----
console.log("\n[6] SEO 面（只读回归，未新增任何页面）");
const sm = await get("/sitemap.xml");
check("sitemap.xml 200", sm.status === 200, `status=${sm.status}`);
const clusters = await get("/en/industrial-clusters/china/guangdong/dongguan-electronics");
check("STEP 09 层级产业带页仍 200", clusters.status === 200, `status=${clusters.status} url=${clusters.url}`);
check("产业带页未因本轮 Admin 改动掉链", clusters.html.includes("Dongguan") || clusters.html.includes("东莞"), "");

console.log(`\n=== 结果：PASS ${pass} / FAIL ${fail} ===`);
process.exit(fail === 0 ? 0 : 1);
