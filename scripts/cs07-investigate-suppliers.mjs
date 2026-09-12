// 只读探测：供应商表 schema（OpenAPI）+ 模板行 + 现有 slug 列表
// 用法: node --env-file=.env scripts/cs07-investigate-suppliers.mjs
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SVC) {
  console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const hdrs = { apikey: SVC, Authorization: `Bearer ${SVC}` };

// 1) OpenAPI schema (用 service_role 才能拿到完整 definitions)
const oaRes = await fetch(`${URL}/rest/v1/`, { headers: hdrs });
const oa = await oaRes.json();
const paths = oa.paths?.["/suppliers"]?.["get"]?.parameters || [];
// PostgREST 把每个表放在 definitions.<table>
const def = oa.definitions?.suppliers;
console.log("=== suppliers OpenAPI (svc) ===");
console.log("required:", JSON.stringify(def?.required));
const props = def?.properties || {};
console.log("columns (" + Object.keys(props).length + "):");
for (const [k, v] of Object.entries(props)) {
  console.log(`  ${k}: ${v.type ?? v.format ?? "?"}${v.format && v.format!==v.type ? "("+v.format+")" : ""}${v.default !== undefined ? " default=" + JSON.stringify(v.default) : ""}${v.enum ? " enum=" + JSON.stringify(v.enum) : ""}`);
}

// 2) 模板行（任意一行，全字段）
const tRes = await fetch(`${URL}/rest/v1/suppliers?select=*&limit=1`, { headers: hdrs });
const tRows = await tRes.json();
console.log("\n=== template row (count=" + tRows.length + ") ===");
if (tRows[0]) console.log(JSON.stringify(tRows[0], null, 2));

// 3) 现有 slug 列表
const sRes = await fetch(`${URL}/rest/v1/suppliers?select=slug,legal_name,is_published,verification_level&limit=100`, { headers: hdrs });
const sRows = await sRes.json();
console.log("\n=== existing rows (" + sRows.length + ") ===");
for (const r of sRows) console.log(`  slug=${r.slug} | ${r.legal_name} | published=${r.is_published} | vlevel=${r.verification_level}`);
