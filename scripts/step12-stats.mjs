// STEP 12 —— 验收用统计：Supplier / RFQ / Matching 的 before→after
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

const { data: s } = await db
  .from("suppliers")
  .select("slug, province, industry_code, is_published, profile_authorized, consent_version, country_code");
const { data: consents } = await db.from("supplier_consents").select("supplier_id, consent_given");
const { data: sIds } = await db.from("suppliers").select("id, slug");
const idBySlug = Object.fromEntries((sIds || []).map((r) => [r.slug, r.id]));
const consentIds = new Set((consents || []).filter((c) => c.consent_given).map((c) => c.supplier_id));

const total = (s || []).length;
const prov = (s || []).filter((r) => r.province && String(r.province).trim()).length;
const ind = (s || []).filter((r) => r.industry_code && String(r.industry_code).trim()).length;
const pub = (s || []).filter((r) => r.is_published).length;
// consent 完整 = 行内 consent_version 有值 OR 有 supplier_consents 记录（绝不伪造：只统计真实存在）
const consented = (s || []).filter(
  (r) => (r.consent_version && String(r.consent_version).trim()) || consentIds.has(idBySlug[r.slug])
).length;
const reject = (s || []).filter((r) => !r.is_published && (r.slug === "supplier")).length;

const { data: rfqs } = await db
  .from("rfqs")
  .select("reference_id, is_public, source_type, source_path, product");
const rTotal = (rfqs || []).length;
const rPub = (rfqs || []).filter((r) => r.is_public).length;
const rSrc = (rfqs || []).filter((r) => r.source_type || r.source_path).length;
const rTest = (rfqs || []).filter((r) => /probe|test|测试|请忽略/i.test(String(r.product ?? ""))).length;

const { data: matches } = await db.from("rfq_matches").select("id, rfq_id, supplier_id, status");

const out = [];
out.push("=== Supplier ===");
out.push(`  总数=${total}  province非空=${prov} (${Math.round((prov / total) * 100)}%)  industry非空=${ind} (${Math.round((ind / total) * 100)}%)`);
out.push(`  consent完整=${consented} (${Math.round((consented / total) * 100)}%)  已发布=${pub}  草稿=${total - pub}`);
out.push(`  脏数据标记(rejected,未删除)=${reject}`);
out.push("=== RFQ ===");
out.push(`  总=${rTotal}  公开=${rPub}  私有=${rTotal - rPub}  测试探针=${rTest}  有来源归因=${rSrc}`);
out.push("=== Matching ===");
out.push(`  rfq_matches 行数=${(matches || []).length}`);
out.push("=== 明细（province / industry）===");
for (const r of s || []) {
  out.push(
    `  ${r.slug}: province=${r.province ?? "NULL"} industry=${r.industry_code ?? "NULL"} published=${r.is_published}`
  );
}
console.log(out.join("\n"));
