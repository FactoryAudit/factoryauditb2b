import { createAdminClient } from "@/lib/supabaseAdmin";

// 只读回归：核对刚摄入的真实 Supplier + 公开目录隔离
const ID = "282f2bbe-2cd1-450e-907a-90239852de4a";

async function main() {
  const db = createAdminClient();
  if (!db) { console.error("no db"); process.exit(1); }

  const { data: s } = await db.from("suppliers").select("*").eq("id", ID).maybeSingle();
  if (!s) { console.log(JSON.stringify({ found: false }, null, 2)); return; }

  const { data: certs } = await db.from("supplier_certifications").select("*").eq("supplier_id", ID);
  const { data: docs } = await db.from("supplier_documents").select("*").eq("supplier_id", ID);
  const { data: audits } = await db.from("supplier_audits").select("*").eq("supplier_id", ID);
  const { data: logs } = await db
    .from("admin_audit_log")
    .select("actor_id, actor_email, action, target_type, target_id, diff, created_at")
    .eq("target_id", ID)
    .order("created_at", { ascending: true });

  // 公开目录隔离：is_published=true 的集合里绝不能有这条
  const { data: pub } = await db.from("suppliers").select("id, slug").eq("is_published", true);
  const pubList = (pub ?? []) as Array<{ id: string; slug: string }>;
  const leaked = pubList.some((r) => r.id === ID);

  // 全局基线
  const { data: allRows } = await db.from("suppliers").select("id, slug, is_published");
  const all = (allRows ?? []) as Array<{ id: string; slug: string; is_published: boolean }>;

  const rec = s as Record<string, unknown>;
  console.log(JSON.stringify({
    found: true,
    supplier: {
      id: rec.id, slug: rec.slug, legal_name: rec.legal_name, display_name: rec.display_name,
      country_code: rec.country_code, city: rec.city, business_type: rec.business_type,
      industry_code: rec.industry_code, established: rec.established, employees: rec.employees,
      website: rec.website, address: rec.address, phone: rec.phone,
      registration_number: rec.registration_number, main_products: rec.main_products,
      export_markets: rec.export_markets,
      source_url: rec.source_url, source_type: rec.source_type, source_name: rec.source_name,
      discovered_at: rec.discovered_at,
      is_published: rec.is_published, verification_level: rec.verification_level,
      verification_status: rec.verification_status, audit_status: rec.audit_status,
      risk_score: rec.risk_score, risk_breakdown: rec.risk_breakdown,
      inspection_history: rec.inspection_history, access_tier: rec.access_tier,
      certifications: rec.certifications,
      created_at: rec.created_at, updated_at: rec.updated_at,
    },
    counts: {
      certifications: certs?.length ?? -1,
      documents: docs?.length ?? -1,
      audits: audits?.length ?? -1,
      admin_audit_log: logs?.length ?? -1,
    },
    admin_audit_log: logs,
    public_directory: {
      published_count: pubList.length,
      published_ids: pubList.map((r) => r.id),
      new_record_leaked_to_public: leaked,
    },
    baseline: {
      total_suppliers_now: all.length,
      all: all.map((r) => ({ slug: r.slug, is_published: r.is_published })),
    },
  }, null, 2));
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
