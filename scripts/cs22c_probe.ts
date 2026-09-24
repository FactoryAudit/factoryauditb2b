// cs22c_probe.ts —— 诊断 verify_items=0 / scope=[] 真因
// 复制 approveVerification 的 items 展开逻辑，直接打生产库，报告实际计数。
import { createAdminClient } from "../lib/supabaseAdmin";
import { getChecklistTemplates, getSupplierSelfAssessment } from "../lib/supplierAssessments";
import { createVerification } from "../lib/trustProfile";

const db = createAdminClient()!;
if (!db) { console.error("no admin client"); process.exit(2); }

let supId: string | null = null;
async function main() {
  // 1) 临时供应商
  const ins = await db.from("suppliers").insert({
    slug: `cs22c-probe-${Math.random().toString(36).slice(2, 8)}`,
    legal_name: "CS22C-PROBE", country_code: "CN",
    is_published: false, public_profile_enabled: false, profile_status: "draft",
    verification_level: "unverified",
  }).select("id").single();
  supId = (ins.data as any)?.id;
  if (!supId) throw new Error("supplier insert failed: " + ins.error?.message);

  // 2) 自评行（让 getSupplierSelfAssessment 有数据）
  await db.from("supplier_assessments").insert({
    supplier_id: supId, assessment_type: "self_assessment", status: "submitted",
    responses_json: {}, submitted_at: new Date().toISOString(),
  });

  // 3) 复刻 approveVerification 的模板展开
  const templates = await getChecklistTemplates();
  let totalQ = 0;
  const codes: string[] = [];
  for (const t of templates) for (const s of t.sections) for (const q of s.questions) { totalQ++; codes.push(q.code); }
  const uniq = new Set(codes);
  console.log("[PROBE] templates=", templates.length, "totalQ=", totalQ, "uniqueCodes=", uniq.size);

  const draft = await getSupplierSelfAssessment(supId);
  const questions = [];
  for (const tpl of templates) for (const sec of tpl.sections) for (const q of sec.questions) {
    const ans = draft?.responses && (draft.responses as any)[q.code] != null ? String((draft.responses as any)[q.code]) : null;
    questions.push({ code: q.code, title: q.title || q.titleZh || q.code, answer: ans });
  }
  const items = questions.map((q) => ({ item_key: q.code, item_label: q.title, supplier_answer: q.answer, status: "APPROVED" as const, reviewerNote: null }));
  console.log("[PROBE] questions=", questions.length, "items=", items.length, "dupItemKeys=", items.length - new Set(items.map(i=>i.item_key)).size);

  // 4) 调真实 createVerification（ONLINE）
  const res = await createVerification({
    supplierId: supId, type: "ONLINE", verifiedBy: "probe@test", actorId: "probe",
    scope: items.filter(i=>i.status!=="APPROVED").map(i=>i.item_key), notes: "probe", items,
  });
  console.log("[PROBE] createVerification res=", JSON.stringify(res));

  // 5) 数 verification_items
  const vi = await db.from("verification_items").select("id", { count: "exact" }).eq("supplier_id", supId);
  const rec = await db.from("verification_records").select("id, scope").eq("supplier_id", supId).single();
  console.log("[PROBE] verification_items count=", vi.count, "record scope len=", (rec.data as any)?.scope?.length);
}
main().then(async () => {
  if (supId) {
    const { data: recs } = await db.from("verification_records").select("id").eq("supplier_id", supId);
    for (const r of (recs || [])) await db.from("verification_items").delete().eq("verification_record_id", r.id);
    await db.from("verification_records").delete().eq("supplier_id", supId);
    await db.from("supplier_assessments").delete().eq("supplier_id", supId);
    await db.from("suppliers").delete().eq("id", supId);
  }
  console.log("[PROBE] cleaned");
  process.exit(0);
}).catch(async (e) => {
  console.error("[PROBE] ERROR", e);
  if (supId) {
    await db.from("verification_records").delete().eq("supplier_id", supId);
    await db.from("supplier_assessments").delete().eq("supplier_id", supId);
    await db.from("suppliers").delete().eq("id", supId);
  }
  process.exit(1);
});
