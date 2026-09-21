// STEP 13-B READ-ONLY AUDIT —— 产业带目录页 IA/UI 重构前取证
// 严禁 DML。用法：node scripts/step13b-cluster-audit.mjs
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "D:/腾讯ai临时文件/2026-09-14-22-18-10/s13b-clusters.json";

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
  published: `select name, slug, country, country_code, region, province, city, industry,
     industry_tags, sort_order, featured, is_published,
     (description is not null and description <> '') as has_desc,
     char_length(coalesce(description,'')) as desc_len
   from industrial_clusters
   where is_published = true
   order by sort_order asc, name asc`,

  allRows: `select name, slug, country, country_code, region, province, city, industry,
     sort_order, is_published, featured
   from industrial_clusters order by sort_order asc, name asc`,

  counts: `select count(*) as total,
     count(*) filter (where is_published) as published,
     count(*) filter (where region is null or region = '') as region_missing,
     count(*) filter (where industry is null or industry = '') as industry_missing,
     count(*) filter (where country is null or country = '') as country_missing
   from industrial_clusters`,

  countryDist: `select country, country_code, count(*) as n
   from industrial_clusters where is_published = true
   group by country, country_code order by n desc`,

  regionDist: `select country, region, count(*) as n
   from industrial_clusters where is_published = true
   group by country, region order by country, region`,

  industryDist: `select industry, count(*) as n
   from industrial_clusters where is_published = true
   group by industry order by industry`,

  supplierLinks: `select cluster_slug, count(*) as n
   from suppliers where cluster_slug is not null and cluster_slug <> ''
   group by cluster_slug order by cluster_slug`,

  constraints: `select c.conname, pg_get_constraintdef(c.oid) as def
   from pg_constraint c where c.conrelid = 'industrial_clusters'::regclass`,

  cols: `select column_name, data_type, is_nullable, column_default
   from information_schema.columns
   where table_name = 'industrial_clusters' order by ordinal_position`,
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
