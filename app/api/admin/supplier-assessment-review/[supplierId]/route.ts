import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  createVerification,
  getTrustSnapshot,
  getVerificationRecords,
  writeAuditLog,
  type VerificationType,
} from "@/lib/trustProfile";
import { getChecklistTemplates, getSupplierSelfAssessment } from "@/lib/supplierAssessments";

// CS-22 CHANGE SET C —— 后台「供应商核验工作台」数据接口
//
// 🔴 语义红线（与 supplier-verification 同源）：
//    Verified 只能由 Admin 显式批准产生。本接口所有写操作均经 requireAdmin()。
//    供应商上传材料 / 提交自评 绝不自动产生 Verified。
//
// GET  → 拉齐工作台所需全部数据（72 题 + 答案 + 证据 + 验证历史 + 快照）
// POST → action:
//        save_review        保存逐项审核结论到 item_review_json（不批准）
//        request_more_info  保存结论并把自评状态置 action_required（供应商回补）
//        approve_online      Admin 显式批准「线上核验」→ 生成 ONLINE 验证记录
//        approve_onsite      Admin 显式批准「现场核验」→ 生成 ON_SITE 验证记录
//        （两轴独立记录，绝不混为一态；不自动创建；不删除既有历史）

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ITEM_STATUSES = new Set(["APPROVED", "REJECTED", "NEED_MORE_INFO", "PENDING"]);

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status, headers: NO_STORE });
}

// ---------------------------------------------------------------------------
// GET：工作台只读数据
// ---------------------------------------------------------------------------
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return bad("unauthorized", 401);

  const { supplierId } = await params;
  if (!UUID_RE.test(supplierId)) return bad("invalid_supplier_id");

  const [templates, draft, evidence, records, snapshot] = await Promise.all([
    getChecklistTemplates(),
    getSupplierSelfAssessment(supplierId),
    readEvidence(supplierId),
    getVerificationRecords(supplierId),
    getTrustSnapshot(supplierId),
  ]);

  // 带出逐项审核明细（已有验证记录则一并展示）
  const db = createAdminClient();
  let items: unknown[] = [];
  if (db && records.length > 0) {
    const { data } = await db
      .from("verification_items")
      .select(
        "id, verification_record_id, item_key, item_label, supplier_answer, evidence_count, status, reviewer_note, reviewed_by, reviewed_at"
      )
      .in(
        "verification_record_id",
        records.map((r) => r.id)
      )
      .order("item_key", { ascending: true });
    items = data ?? [];
  }

  return NextResponse.json(
    {
      ok: true,
      supplierId,
      assessmentStatus: draft?.status ?? null,
      responses: draft?.responses ?? null,
      itemReview: draft?.itemReview ?? null,
      summary: draft?.summary ?? null,
      templates,
      evidence,
      trustStatus: snapshot.status,
      active: snapshot.active,
      records,
      items,
    },
    { headers: NO_STORE }
  );
}

async function readEvidence(supplierId: string): Promise<Record<string, unknown[]>> {
  const db = createAdminClient();
  if (!db) return {};
  const { data, error } = await db
    .from("supplier_evidence")
    .select(
      "id, assessment_id, item_key, file_name, mime_type, status, file_size, reviewed_by, reviewed_at, created_at"
    )
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: true });
  if (error || !data) return {};
  const grouped: Record<string, unknown[]> = {};
  for (const r of data as Record<string, unknown>[]) {
    const key = (r.item_key as string | null) ?? "__uncategorized__";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// POST：审核动作
// ---------------------------------------------------------------------------
export async function POST(
  req: Request,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return bad("unauthorized", 401);

  const { supplierId } = await params;
  if (!UUID_RE.test(supplierId)) return bad("invalid_supplier_id");

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("invalid_body");
  }

  const action = String(body.action ?? "");
  const review = parseReview(body.review);

  if (action === "save_review" || action === "request_more_info") {
    const res = await persistReview(supplierId, review, action, admin);
    if (!res.ok) return bad(res.error ?? "save_failed", res.statusCode ?? 500);
    return NextResponse.json({ ok: true, status: res.status }, { headers: NO_STORE });
  }

  if (action === "approve_online" || action === "approve_onsite") {
    const type: VerificationType = action === "approve_onsite" ? "ON_SITE" : "ONLINE";
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : null;
    const onsiteMeta =
      action === "approve_onsite"
        ? {
            visitDate: typeof body.visitDate === "string" ? body.visitDate.slice(0, 40) : null,
            verifier: typeof body.verifier === "string" ? body.verifier.slice(0, 200) : null,
            location: typeof body.location === "string" ? body.location.slice(0, 200) : null,
          }
        : null;
    const res = await approveVerification(supplierId, type, review, admin, notes, onsiteMeta);
    if (!res.ok) return bad(res.error ?? "approve_failed", 500);
    return NextResponse.json(
      { ok: true, verificationId: res.verificationId, type },
      { headers: NO_STORE }
    );
  }

  return bad("invalid_action");
}

// 把客户端 review 净化为受控结构（只接受已知题号由服务端二次校验，但这里仅做形状清洗）
function parseReview(raw: unknown): Record<string, { status: string; note: string }> {
  const out: Record<string, { status: string; note: string }> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const status = String(o.status ?? "").toUpperCase();
    if (!ITEM_STATUSES.has(status)) continue;
    const note = typeof o.note === "string" ? o.note.slice(0, 2000) : "";
    out[k] = { status, note };
  }
  return out;
}

async function persistReview(
  supplierId: string,
  review: Record<string, { status: string; note: string }>,
  action: "save_review" | "request_more_info",
  admin: { userId: string; email: string | null }
): Promise<{ ok: boolean; status?: string; error?: string; statusCode?: number }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "db_not_configured", statusCode: 500 };

  // 当前自评行
  const { data: cur, error: readErr } = await db
    .from("supplier_assessments")
    .select("id, status")
    .eq("supplier_id", supplierId)
    .eq("assessment_type", "self_assessment")
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message, statusCode: 500 };
  if (!cur) {
    // 供应商尚未提交自评：先建一行草稿状态，便于承载 item_review_json
    const { error: insErr } = await db.from("supplier_assessments").insert({
      supplier_id: supplierId,
      assessment_type: "self_assessment",
      status: "draft",
      item_review_json: review,
      updated_at: new Date().toISOString(),
    });
    if (insErr) return { ok: false, error: insErr.message, statusCode: 500 };
    return { ok: true, status: "draft" };
  }

  const nextStatus = action === "request_more_info" ? "action_required" : "under_review";
  const { error: updErr } = await db
    .from("supplier_assessments")
    .update({
      item_review_json: review,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", (cur as { id: string }).id);
  if (updErr) return { ok: false, error: updErr.message, statusCode: 500 };

  await writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: action === "request_more_info" ? "ASSESSMENT_NEEDS_MORE_INFO" : "ASSESSMENT_REVIEW_SAVED",
    targetType: "supplier",
    targetId: supplierId,
    metadata: {
      reviewed_items: Object.keys(review).length,
      next_status: nextStatus,
      flagged: Object.values(review).filter((r) => r.status !== "APPROVED").length,
    },
  });

  return { ok: true, status: nextStatus };
}

async function approveVerification(
  supplierId: string,
  type: VerificationType,
  review: Record<string, { status: string; note: string }>,
  admin: { userId: string; email: string | null },
  notes?: string | null,
  onsiteMeta?: { visitDate?: string | null; verifier?: string | null; location?: string | null } | null
): Promise<{ ok: boolean; verificationId?: string; error?: string }> {
  const [templates, draft] = await Promise.all([
    getChecklistTemplates(),
    getSupplierSelfAssessment(supplierId),
  ]);

  // 展开全部题号（含题面 + 供应商答案），构建验证项
  const questions: { code: string; title: string; answer: string | null }[] = [];
  for (const tpl of templates) {
    for (const sec of tpl.sections) {
      for (const q of sec.questions) {
        const ans =
          draft?.responses && draft.responses[q.code] != null
            ? String(draft.responses[q.code])
            : null;
        questions.push({ code: q.code, title: q.title || q.titleZh || q.code, answer: ans });
      }
    }
  }

  // 若没有任何逐项审核结论，默认全部 APPROVED（Admin 直接批准整份自评）
  const items = questions.map((q) => {
    const r = review[q.code];
    const status = r?.status ?? "APPROVED";
    return {
      item_key: q.code,
      item_label: q.title,
      supplier_answer: q.answer,
      status: status as "APPROVED" | "REJECTED" | "NEED_MORE_INFO" | "PENDING",
      reviewerNote: r?.note ?? null,
    };
  });

  // 验证范围 = 被标记为非通过的项（供后台与买家追溯）
  const scope = items
    .filter((i) => i.status !== "APPROVED")
    .map((i) => i.item_key);

  const res = await createVerification({
    supplierId,
    type,
    verifiedBy: admin.email ?? "admin",
    actorId: admin.userId,
    scope,
    notes: notes ?? null,
    visitDate: onsiteMeta?.visitDate ?? null,
    verifier: onsiteMeta?.verifier ?? null,
    location: onsiteMeta?.location ?? null,
    items,
    // 有效期沿用默认（365 天）
  });
  if (!res.ok) return { ok: false, error: res.error };

  // 自评状态置 published（平台已审结；不在白名单中的 approved 不可用，故用 published）
  const db = createAdminClient();
  if (db) {
    await db
      .from("supplier_assessments")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("supplier_id", supplierId)
      .eq("assessment_type", "self_assessment");
  }

  return { ok: true, verificationId: res.verificationId };
}
