import { createAdminClient } from "@/lib/supabaseAdmin";

async function main() {
  const db = createAdminClient();
  if (!db) {
    console.error("ERR: createAdminClient null");
    process.exit(1);
  }

  // 1) 当前 suppliers 总数 + 概要
  const { data: all, error: eA } = await db
    .from("suppliers")
    .select("id, slug, legal_name, website, registration_number, is_published, verification_level, created_at")
    .order("created_at", { ascending: true });
  if (eA) { console.error("ERR suppliers list:", eA.message); process.exit(1); }

  // 2) 按公司名/网站反查
  const { data: byName, error: eN } = await db
    .from("suppliers")
    .select("id, slug, legal_name, website")
    .or("legal_name.ilike.%麦克森%,display_name.ilike.%麦克森%,website.ilike.%mxcomm%");
  if (eN) { console.error("ERR byName:", eN.message); process.exit(1); }

  // 3) 最近的 supplier.create 审计日志
  const { data: logs, error: eL } = await db
    .from("admin_audit_log")
    .select("actor_id, actor_email, action, target_type, target_id, created_at")
    .eq("target_type", "supplier")
    .order("created_at", { ascending: false })
    .limit(10);
  if (eL) { console.error("ERR logs:", eL.message); process.exit(1); }

  console.log(JSON.stringify({
    suppliers_total: all?.length ?? -1,
    suppliers: all,
    name_or_site_match: byName,
    recent_supplier_logs: logs,
  }, null, 2));
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
