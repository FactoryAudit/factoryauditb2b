import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import {
  createVerification,
  getTrustSnapshot,
  getVerificationRecords,
  revokeVerification,
  DEFAULT_VALIDITY_DAYS,
  type VerificationType,
} from "@/lib/trustProfile";
import { createAdminClient } from "@/lib/supabaseAdmin";

// 管理端验证接口（CS-22 CHANGE SET C）
//
// 🔴 语义红线：Verified 状态**只能**由 Admin 显式批准产生。
//    供应商上传材料 / 提交自评 都绝不自动产生任何 Verified 状态。
//    getTrustSnapshot 的推导逻辑保证：无 ACTIVE 记录 ⇒ 最多是 SELF_ASSESSED。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status, headers: NO_STORE });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return bad("unauthorized", 401);

  const { supplierId } = await params;
  if (!UUID_RE.test(supplierId)) return bad("invalid_supplier_id");

  const [records, snapshot] = await Promise.all([
    getVerificationRecords(supplierId),
    getTrustSnapshot(supplierId),
  ]);

  // 带出逐项审核明细
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
      trustStatus: snapshot.status,
      hasSubmittedAssessment: snapshot.hasSubmittedAssessment,
      active: snapshot.active,
      records,
      items,
    },
    { headers: NO_STORE }
  );
}

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

  // action=revoke 走撤销；缺省为创建验证
  const action = String(body.action ?? "create");

  if (action === "revoke") {
    const recordId = String(body.recordId ?? "");
    if (!UUID_RE.test(recordId)) return bad("invalid_record_id");
    const res = await revokeVerification({
      recordId,
      actorEmail: admin.email ?? "admin",
      actorId: admin.userId,
      reason: typeof body.reason === "string" ? body.reason : null,
    });
    if (!res.ok) return bad(res.error ?? "revoke_failed", 500);
    return NextResponse.json({ ok: true, revoked: true }, { headers: NO_STORE });
  }

  const type = String(body.type ?? "").toUpperCase();
  if (type !== "ONLINE" && type !== "ON_SITE") return bad("invalid_verification_type");

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems
    .map((it) => {
      if (typeof it !== "object" || it === null) return null;
      const o = it as Record<string, unknown>;
      const key = typeof o.item_key === "string" ? o.item_key.trim() : "";
      if (!key) return null;
      return {
        item_key: key.slice(0, 120),
        item_label: typeof o.item_label === "string" ? o.item_label.slice(0, 200) : null,
        supplier_answer:
          typeof o.supplier_answer === "string" ? o.supplier_answer.slice(0, 2000) : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 200);

  const scopeRaw = Array.isArray(body.scope) ? body.scope : [];
  const scope = scopeRaw
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim().slice(0, 120))
    .slice(0, 50);

  const validityRaw = Number(body.validityDays);
  const validityDays =
    Number.isFinite(validityRaw) && validityRaw > 0 && validityRaw <= 3650
      ? Math.floor(validityRaw)
      : DEFAULT_VALIDITY_DAYS;

  const res = await createVerification({
    supplierId,
    type: type as VerificationType,
    verifiedBy: admin.email ?? "admin",
    actorId: admin.userId,
    scope,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
    validityDays,
    items,
  });

  if (!res.ok) return bad(res.error, 500);
  return NextResponse.json(
    { ok: true, verificationId: res.verificationId, type },
    { headers: NO_STORE }
  );
}
