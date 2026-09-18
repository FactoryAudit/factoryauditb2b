import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { createFinding, type FindingSeverity } from "@/lib/auditWorkflow";

// POST /api/admin/audits/[auditId]/finding —— 新建发现项（§29）
//
// severity 必须是合法枚举（DB 也有 CHECK 兜底）；description 必填。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const SEVERITIES = new Set(["critical", "major", "minor", "observation"]);
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
  const severity = typeof b.severity === "string" ? b.severity : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (!SEVERITIES.has(severity)) {
    return NextResponse.json({ ok: false, error: "invalid_severity" }, { status: 400, headers: NO_STORE });
  }
  if (!description) {
    return NextResponse.json({ ok: false, error: "description_required" }, { status: 400, headers: NO_STORE });
  }

  const r = await createFinding({
    auditId,
    severity: severity as FindingSeverity,
    description,
    category: typeof b.category === "string" ? b.category : null,
    requirement: typeof b.requirement === "string" ? b.requirement : null,
    objectiveEvidence: typeof b.objectiveEvidence === "string" ? b.objectiveEvidence : null,
    rootCause: typeof b.rootCause === "string" ? b.rootCause : null,
    correctiveAction: typeof b.correctiveAction === "string" ? b.correctiveAction : null,
    responsiblePerson: typeof b.responsiblePerson === "string" ? b.responsiblePerson : null,
    dueDate: typeof b.dueDate === "string" ? b.dueDate : null,
    createdBy: admin.userId,
  });
  if (!r.ok) {
    const status = r.reason === "not_configured" ? 503 : 500;
    return NextResponse.json({ ok: false, error: r.reason, message: r.message ?? null }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, id: r.id }, { headers: NO_STORE });
}
