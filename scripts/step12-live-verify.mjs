// STEP 12 —— 线上验收（CODE → TEST → BUILD → DEPLOY → LIVE VERIFY 的最后一环）
//
// 注意：生产库是真数据，测试 RFQ 一律保持 is_public=false（CHANGE SET E）。
// 「授权公开」路径测完后立即撤销公开，不把测试探针留在 Live Buyer Requests 里。
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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL?.trim(), env.SUPABASE_SERVICE_ROLE_KEY?.trim(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  PASS — ${name}${detail ? " (" + detail + ")" : ""}`); }
  else { fail++; console.log(`  FAIL — ${name}${detail ? " (" + detail + ")" : ""}`); }
}

async function submitRfq(payload) {
  const res = await fetch(`${BASE}/api/rfq`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, j };
}

async function getRfq(ref) {
  const { data } = await db
    .from("rfqs")
    .select("reference_id, product, is_public, source_type, source_path, email")
    .eq("reference_id", ref)
    .maybeSingle();
  return data;
}

console.log("=== STEP 12 线上验收 ===\n");

// ---- 1. 未授权 ⇒ 绝不公开（CHANGE SET C2 硬约束）----
console.log("[1] RFQ 未勾选公开授权");
const noConsent = await submitRfq({
  email: "step12-noconsent@example.com",
  product: "STEP12 auto test - no consent",
  quantity: "1",
  country: "china",
  message: "automated verification, please ignore",
  source_path: "/industry/chemicals",
});
check("提交成功(200)", noConsent.status === 200, `status=${noConsent.status}`);
check("已落库(stored=true)", noConsent.j?.stored === true, JSON.stringify(noConsent.j));
if (noConsent.j?.referenceId) {
  const row = await getRfq(noConsent.j.referenceId);
  check("is_public=false（未授权绝不公开）", row?.is_public === false, `is_public=${row?.is_public}`);
  check("来源归因 source_path 已记录", row?.source_path === "/industry/chemicals", `sp=${row?.source_path}`);
  check("来源归因 source_type 由路径推导=industry", row?.source_type === "industry", `st=${row?.source_type}`);
}

// ---- 2. 明确授权 ⇒ 公开（测完立即撤销，不污染公开列表）----
console.log("\n[2] RFQ 明确勾选公开授权");
const withConsent = await submitRfq({
  email: "step12-consent@example.com",
  product: "STEP12 auto test - with consent",
  quantity: "1",
  country: "china",
  message: "automated verification, please ignore",
  is_public: true,
  source_path: "/rfq",
});
check("提交成功(200)", withConsent.status === 200, `status=${withConsent.status}`);
if (withConsent.j?.referenceId) {
  const row = await getRfq(withConsent.j.referenceId);
  check("is_public=true（明确授权才公开）", row?.is_public === true, `is_public=${row?.is_public}`);
  check("source_type=direct（/rfq 直投）", row?.source_type === "direct", `st=${row?.source_type}`);
  // 清理：撤销公开（CHANGE SET E：测试探针绝不留公开位）
  await db.from("rfqs").update({ is_public: false }).eq("reference_id", withConsent.j.referenceId);
  const after = await getRfq(withConsent.j.referenceId);
  check("已撤销公开（测试探针不进公开列表）", after?.is_public === false, `is_public=${after?.is_public}`);
}

// ---- 3. 隐私：公开页绝不暴露买家邮箱 ----
console.log("\n[3] 隐私暴露检查");
const home = await fetch(`${BASE}/`);
const homeHtml = await home.text();
check("首页 200", home.status === 200, `status=${home.status}`);
const { data: publicRfqs } = await db
  .from("rfqs")
  .select("email")
  .eq("is_public", true)
  .limit(20);
const leaked = (publicRfqs || []).filter((r) => r.email && homeHtml.includes(r.email));
check("公开 RFQ 的买家邮箱未出现在首页 HTML", leaked.length === 0, `leak=${leaked.length}`);

// ---- 4. 表单真的带上了公开授权勾选项 ----
console.log("\n[4] /rfq 表单含公开授权项");
const rfqPage = await fetch(`${BASE}/rfq`);
const rfqHtml = await rfqPage.text();
check("/rfq 200", rfqPage.status === 200, `status=${rfqPage.status}`);
check(
  "渲染了公开授权文案（dict key）",
  rfqHtml.includes("Allow my request to be shown publicly"),
  ""
);
check("渲染了 allowPublic 勾选框", rfqHtml.includes('name="allowPublic"'), "");

// ---- 5. Admin 授权门禁（未登录不得访问匹配接口）----
console.log("\n[5] Admin 授权门禁");
const m = await fetch(`${BASE}/api/admin/rfqs/RFQ-CXJCRL/match`);
check("未登录访问 admin 匹配接口 = 404（不暴露后台）", m.status === 404, `status=${m.status}`);

// ---- 6. 供应商注册通道连通 ----
console.log("\n[6] 供应商入驻通道");
const reg = await fetch(`${BASE}/api/supplier-register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fields: {
      companyName: "STEP12 Automated Verify Co",
      contactEmail: "step12-register@example.com",
      factoryCountry: "China",
      factoryCity: "Shenzhen",
      mainProducts: "verification only",
      authorizeCompanyProfile: "yes",
    },
  }),
});
const regJ = await reg.json().catch(() => ({}));
check("supplier-register 返回 ok", reg.status === 200 && regJ?.ok === true, `status=${reg.status} ${JSON.stringify(regJ).slice(0, 120)}`);

console.log(`\n=== 结果：PASS ${pass} / FAIL ${fail} ===`);
process.exit(fail === 0 ? 0 : 1);
