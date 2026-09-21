// STEP 13 READ-ONLY DB AUDIT —— 严禁 DML
// 用法：node scripts/step13-db-audit.mjs
// 输出：D:\腾讯ai临时文件\2026-09-14-22-18-10\s13-db.json
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "D:/腾讯ai临时文件/2026-09-14-22-18-10/s13-db.json";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const SITE = env.NEXT_PUBLIC_SUPABASE_URL || "";
const REF = (SITE.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
if (!TOKEN || !REF) {
  console.error("缺少 SUPABASE_ACCESS_TOKEN 或无法解析 REF");
  process.exit(1);
}

const Q = {
  supplierCounts: `select count(*) as total,
   count(*) filter (where is_published) as published,
   count(*) filter (where not coalesce(is_published,false)) as not_published,
   count(*) filter (where province is not null and province <> '') as province_ok,
   count(*) filter (where industry_code is not null and industry_code <> '') as industry_ok,
   count(*) filter (where country_code is not null and country_code <> '') as country_ok,
   count(*) filter (where city is not null and city <> '') as city_ok
 from suppliers`,

  supplierRows: `select slug, company_name, country_code, province, city, industry_code,
   is_published, profile_authorized, verification_status, cluster_slug, main_products
 from suppliers order by slug`,

  supplierVerificationDist: `select verification_status, count(*) from suppliers group by verification_status order by 1`,

  leadsDist: `select kind, status, count(*) from leads group by kind, status order by kind, status`,

  leadsReal: `select id, kind, status, company_name, country, city, email, created_at
 from leads where kind='supplier_application' order by created_at`,

  rfqCounts: `select count(*) as total,
   count(*) filter (where is_public) as public_cnt,
   count(*) filter (where source_type is not null) as has_source_type,
   count(*) filter (where source_path is not null) as has_source_path
 from rfqs`,

  rfqRows: `select reference_id, product, quantity, industry_code, country, target_market,
   is_public, status, source_type, source_path, industrial_cluster_slug, created_at
 from rfqs order by created_at`,

  matchCounts: `select count(*) as total from rfq_matches`,

  matchDist: `select status, count(*) from rfq_matches group by status order by 1`,

  matchRows: `select * from rfq_matches order by created_at desc limit 20`,

  cols: `select table_name, column_name, data_type, is_nullable, column_default
 from information_schema.columns
 where table_name in ('rfq_matches','rfqs','leads','suppliers','supplier_consents')
 order by table_name, ordinal_position`,

  constraints: `select c.conrelid::regclass::text as tbl, c.conname,
   pg_get_constraintdef(c.oid) as def, c.contype
 from pg_constraint c
 where c.conrelid in ('rfq_matches'::regclass,'rfqs'::regclass,'leads'::regclass)`,

  indexes: `select tablename, indexname from pg_indexes
 where tablename in ('rfq_matches','rfqs','leads') order by tablename, indexname`,

  consentCounts: `select count(distinct supplier_id) as suppliers_with_consent from supplier_consents`,
};

const run = async (sql) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: true }),
  });
  const text = await res.text();
  if (!res.ok) return { error: res.status, body: text.slice(0, 800) };
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 2000) };
  }
};

const out = {};
for (const [k, sql] of Object.entries(Q)) {
  out[k] = await run(sql);
  const v = out[k];
  const n = Array.isArray(v) ? v.length : v.error ? "ERR" : 1;
  console.log(`${k}: ${n}`);
}
writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log("WROTE " + OUT);
