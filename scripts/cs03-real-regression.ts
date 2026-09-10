import { createAdminClient } from "@/lib/supabaseAdmin";

// 纯只读回归：只 SELECT，绝不 INSERT/UPDATE/DELETE。
const ID = "3c5b757b-dba6-4e70-9f8e-566f1befe3a0";

async function main() {
  const db = createAdminClient();
  if (!db) {
    console.error("ERR: createAdminClient returned null (env missing)");
    process.exit(1);
  }

  // A. 主表
  const { data: s, error: eS } = await db
    .from("suppliers")
    .select("*")
    .eq("id", ID)
    .maybeSingle();
  if (eS) {
    console.error("ERR suppliers:", eS.message);
    process.exit(1);
  }
  if (!s) {
    console.log(JSON.stringify({ found: false }, null, 2));
    return;
  }

  // 关联表
  const { data: certs, error: eC } = await db
    .from("supplier_certifications")
    .select("*")
    .eq("supplier_id", ID);
  const { data: docs, error: eD } = await db
    .from("supplier_documents")
    .select("*")
    .eq("supplier_id", ID);
  const { data: audits, error: eA } = await db
    .from("supplier_audits")
    .select("*")
    .eq("supplier_id", ID);
  const { data: logs, error: eL } = await db
    .from("admin_audit_log")
    .select("*")
    .eq("target_id", ID)
    .eq("target_type", "supplier");

  if (eC || eD || eA || eL) {
    console.error("ERR related:", { eC: eC?.message, eD: eD?.message, eA: eA?.message, eL: eL?.message });
    process.exit(1);
  }

  // 输出结构化 JSON（供人工核对）
  const out = {
    found: true,
    supplier: {
      id: s.id,
      slug: s.slug,
      legal_name: s.legal_name,
      display_name: s.display_name,
      country_code: s.country_code,
      city: s.city,
      business_type: s.business_type,
      industry_code: s.industry_code,
      established: s.established,
      employees: s.employees,
      website: s.website,
      address: s.address,
      phone: s.phone,
      registration_number: s.registration_number,
      main_products: s.main_products,
      export_markets: s.export_markets,
      source_url: s.source_url,
      source_type: s.source_type,
      source_name: s.source_name,
      discovered_at: s.discovered_at,
      is_published: s.is_published,
      verification_level: s.verification_level,
      verification_status: s.verification_status,
      audit_status: s.audit_status,
      risk_score: s.risk_score,
      risk_breakdown: s.risk_breakdown,
      inspection_history: s.inspection_history,
      access_tier: s.access_tier,
      created_at: s.created_at,
      updated_at: s.updated_at,
    },
    counts: {
      certifications: certs?.length ?? -1,
      documents: docs?.length ?? -1,
      audits: audits?.length ?? -1,
      admin_audit_log: logs?.length ?? -1,
    },
    certifications: certs,
    documents: docs,
    audits: audits,
    admin_audit_log: logs?.map((l: Record<string, unknown>) => ({
      actor_id: l.actor_id,
      actor_email: l.actor_email,
      action: l.action,
      target_type: l.target_type,
      target_id: l.target_id,
      diff: l.diff,
      created_at: l.created_at,
    })),
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
