// STEP 13 READ-ONLY DB AUDIT 第 2 轮（修正列名 + 识别测试数据）
import { readFileSync, writeFileSync } from "node:fs";
const OUT = "D:/腾讯ai临时文件/2026-09-14-22-18-10/s13-db2.json";
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = (env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];

const Q = {
  supplierRows: `select id, slug, legal_name, display_name, country_code, province, city, industry_code,
   is_published, profile_authorized, verification_status, verification_level, main_products, created_at
 from suppliers order by created_at`,

  leadsApp: `select id, reference_id, status, company, supplier_name, country, city, email, score, created_at
 from leads where kind='supplier_application' order by created_at`,

  leadsAll: `select reference_id, kind, status, company, supplier_name, email, created_at
 from leads order by created_at desc limit 30`,

  rfqRows2: `select id, reference_id, product, quantity, industry_code, country, target_market,
   is_public, status, source_type, source_path, created_at
 from rfqs order by created_at`,

  rfqMatchAll: `select m.id, m.status, m.note, m.created_at, r.reference_id, s.slug
 from rfq_matches m left join rfqs r on r.id=m.rfq_id left join suppliers s on s.id=m.supplier_id`,

  consentRows: `select supplier_id, consent_version, consent_ip is not null as has_ip, created_at
 from supplier_consents order by created_at`,

  auditLog: `select * from admin_audit_log order by created_at desc limit 15`,
};

const run = async (sql) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: true }),
  });
  const t = await res.text();
  if (!res.ok) return { error: res.status, body: t.slice(0, 600) };
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 1500) }; }
};
const out = {};
for (const [k, sql] of Object.entries(Q)) {
  out[k] = await run(sql);
  console.log(`${k}: ${Array.isArray(out[k]) ? out[k].length : out[k].error ? "ERR" : 1}`);
}
writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log("WROTE " + OUT);
