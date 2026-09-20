// STEP 12 — read-only data dump for evidence-based backfill decisions.
// No DML. Uses service_role for SELECT + Management API for schema.
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

const URL = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const KEY = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = (URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!URL || !KEY) {
  console.error("缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const out = {};

// ---- suppliers ----
{
  const { data, error } = await db
    .from("suppliers")
    .select(
      "slug, legal_name, country_code, city, province, region, industry_code, business_type, is_published, verification_level, verification_status, audit_status, profile_authorized, consent_version, main_products, company_description, self_reported_certificates"
    )
    .order("slug");
  if (error) { console.error("suppliers err", error.message); process.exit(1); }
  out.suppliers = (data || []).map((r) => ({
    slug: r.slug,
    legal_name: r.legal_name,
    country_code: r.country_code,
    city: r.city,
    province: r.province,
    industry_code: r.industry_code,
    business_type: r.business_type,
    is_published: r.is_published,
    verification_level: r.verification_level,
    verification_status: r.verification_status,
    audit_status: r.audit_status,
    profile_authorized: r.profile_authorized,
    consent_version: r.consent_version,
    main_products: Array.isArray(r.main_products) ? r.main_products : [],
    company_description: r.company_description ? String(r.company_description).slice(0, 200) : null,
  }));
}

// ---- supplier consents (presence per supplier) ----
{
  const { data, error } = await db.from("supplier_consents").select("supplier_id, consent_type, consent_given, consent_version");
  if (!error) {
    const map = {};
    for (const c of data || []) {
      (map[c.supplier_id] ||= []).push({ type: c.consent_type, given: c.consent_given, v: c.consent_version });
    }
    out.consentsBySupplier = map;
  }
}

// ---- leads: supplier_application ----
{
  const { data, error } = await db
    .from("leads")
    .select("id, reference_id, kind, tool, company, country, email, status, created_at, payload")
    .eq("kind", "supplier_application")
    .order("created_at");
  if (error) { console.error("leads err", error.message); }
  else out.supplierApplicationLeads = (data || []).map((l) => ({
    id: l.id,
    reference_id: l.reference_id,
    tool: l.tool,
    company: l.company,
    country: l.country,
    email: l.email,
    status: l.status,
    created_at: l.created_at,
    payload_keys: l.payload ? Object.keys(l.payload) : [],
  }));
}

// ---- rfqs ----
{
  const { data, error } = await db
    .from("rfqs")
    .select("reference_id, product, quantity, country, industry_code, is_public, status, source_type, source_path, created_at, email")
    .order("created_at");
  if (error) { console.error("rfqs err", error.message); }
  else out.rfqs = data || [];
}

// ---- rfq_matches schema + count ----
if (TOKEN && REF) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify({
      query: `select column_name, data_type from information_schema.columns where table_name='rfq_matches' order by ordinal_position;`,
      read_only: true,
    }),
  });
  const j = await res.json().catch(() => null);
  out.rfqMatchesSchema = j;
  const res2 = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ query: `select count(*) as n from rfq_matches;`, read_only: true }),
  });
  out.rfqMatchesCount = await res2.json().catch(() => null);
}

console.log(JSON.stringify(out, null, 2));
