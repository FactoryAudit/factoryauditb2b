const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function main() {
  const r = await fetch(`${URL}/rest/v1/suppliers?select=slug&limit=1`, { headers: H });
  console.log("SELECT suppliers -> HTTP", r.status);
  console.log("  body:", await r.text().catch(() => ""));

  const o = await fetch(`${URL}/rest/v1/`, { headers: { ...H, Accept: "application/openapi+json" } });
  const txt = await o.text();
  console.log("OpenAPI -> HTTP", o.status, "| contains 'suppliers':", txt.includes("suppliers"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
