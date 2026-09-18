import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { attachEvidence, type EvidenceSource } from "@/lib/auditWorkflow";

// POST /api/admin/audits/[auditId]/evidence —— 证据（§25-§28）
//
// supplierId 必填（FK 引用 suppliers）。source 若提供必须是合法枚举（DB 也有 CHECK 兜底）。
// storage_path 在 V2.1 为「路径/外链」占位：真实私有存储上传列入 Backlog（MOCK），
// 与 admin 文件中心（supplier_documents）一致——先写元数据，blob 上传后补。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const SOURCES = new Set([
  "supplier_provided",
  "public_website",
  "gov_registry",
  "cert_body",
  "audit_report",
  "factory_visit",
  "third_party",
  "other",
]);
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
  const supplierId = typeof b.supplierId === "string" ? b.supplierId : "";
  if (!supplierId) {
    return NextResponse.json({ ok: false, error: "supplier_id_required" }, { status: 400, headers: NO_STORE });
  }
  const source = typeof b.source === "string" ? b.source : "";
  if (source && !SOURCES.has(source)) {
    return NextResponse.json({ ok: false, error: "invalid_source" }, { status: 400, headers: NO_STORE });
  }

  const r = await attachEvidence({
    auditId,
    supplierId,
    findingId: typeof b.findingId === "string" ? b.findingId : null,
    questionId: typeof b.questionId === "string" ? b.questionId : null,
    filename: typeof b.filename === "string" ? b.filename : null,
    fileType: typeof b.fileType === "string" ? b.fileType : null,
    fileSize: typeof b.fileSize === "number" ? b.fileSize : null,
    storagePath: typeof b.storagePath === "string" ? b.storagePath : null,
    source: (source || null) as EvidenceSource | null,
    description: typeof b.description === "string" ? b.description : null,
    issueDate: typeof b.issueDate === "string" ? b.issueDate : null,
    expiryDate: typeof b.expiryDate === "string" ? b.expiryDate : null,
    documentNumber: typeof b.documentNumber === "string" ? b.documentNumber : null,
    issuingBody: typeof b.issuingBody === "string" ? b.issuingBody : null,
  });
  if (!r.ok) {
    const status = r.reason === "not_configured" ? 503 : 500;
    return NextResponse.json({ ok: false, error: r.reason, message: r.message ?? null }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, id: r.id }, { headers: NO_STORE });
}
