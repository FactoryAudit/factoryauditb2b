import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { createCorrectiveAction } from "@/lib/auditWorkflow";

// POST /api/admin/audits/[auditId]/cap —— 整改行动（§30）
//
// findingId 必填（FK 引用 audit_findings）；description 必填。

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

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const findingId = typeof b.findingId === "string" ? b.findingId : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (!findingId) {
    return NextResponse.json({ ok: false, error: "finding_id_required" }, { status: 400, headers: NO_STORE });
  }
  if (!description) {
    return NextResponse.json({ ok: false, error: "description_required" }, { status: 400, headers: NO_STORE });
  }

  const r = await createCorrectiveAction({
    findingId,
    description,
    dueDate: typeof b.dueDate === "string" ? b.dueDate : null,
  });
  if (!r.ok) {
    const status = r.reason === "not_configured" ? 503 : 500;
    return NextResponse.json({ ok: false, error: r.reason, message: r.message ?? null }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, id: r.id }, { headers: NO_STORE });
}
