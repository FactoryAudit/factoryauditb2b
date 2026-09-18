import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { advanceAuditStatus } from "@/lib/auditWorkflow";
import { isAuditStatus, type AuditStatus } from "@/lib/audits";

// POST /api/admin/audits/[auditId]/advance —— 审核状态机推进（§47）
//
// 必须经状态机校验：非法跃迁（不在 AUDIT_STATUS_TRANSITIONS）一律 409 拒绝。
// 应用层是唯一裁决点（与 lib/orders 状态流一致）。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
type Params = { params: Promise<{ auditId: string }> };

export async function POST(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  const { auditId } = await params;
  if (!auditId) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => ({}))) as { next?: unknown };
  const next = typeof body.next === "string" ? body.next : "";
  if (!isAuditStatus(next)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400, headers: NO_STORE });
  }

  const r = await advanceAuditStatus({
    auditId,
    next: next as AuditStatus,
    actorId: admin.userId,
    actorEmail: admin.email,
    ip: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });
  if (!r.ok) {
    const status =
      r.reason === "not_found" ? 404 : r.reason === "invalid_transition" ? 409 : r.reason === "not_configured" ? 503 : 500;
    return NextResponse.json({ ok: false, error: r.reason, message: r.message ?? null }, { status, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, status: next }, { headers: NO_STORE });
}
