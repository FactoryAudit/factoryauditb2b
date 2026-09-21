import { readFileSync, writeFileSync } from "node:fs";
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
  rfqEmails: `select reference_id, product, email, contact_name, company, target_market, certifications_req from rfqs order by created_at`,
  leadAppFull: `select reference_id, status, company, supplier_name, email, country, payload->>'city' as city, payload->>'industry' as industry, created_at from leads where kind='supplier_application' order by created_at`,
};
const run = async (sql) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: true }),
  });
  const t = await res.text();
  if (!res.ok) return { error: res.status, body: t.slice(0, 500) };
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 1200) }; }
};
const out = {};
for (const [k, sql] of Object.entries(Q)) out[k] = await run(sql);
writeFileSync("D:/腾讯ai临时文件/2026-09-14-22-18-10/s13-db3.json", JSON.stringify(out, null, 2), "utf8");
console.log(JSON.stringify(out, null, 2));
