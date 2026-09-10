import { NextResponse } from "next/server";
import {
  requireAdmin,
  listAdminCertifications,
  upsertAdminCertification,
  deleteAdminCertification,
  setReviewStatus,
  logAdminAction,
} from "@/lib/adminData";
import { checkRateLimit, clamp } from "@/lib/rateLimit";

// /api/admin/suppliers/[slug]/certifications —— 供应商证书实体
//
// 与「文件」分开：证书是结构化数据（证书号/机构/有效期），文件是扫描件本体。
// 审核状态只代表平台是否审核过该资料，不代表背书证书真实性。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const REVIEW_STATES = new Set(["PENDING", "VERIFIED", "REJECTED", "EXPIRED"]);

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const { slug } = await params;
  const certifications = await listAdminCertifications(slug);
  return NextResponse.json({ ok: true, certifications }, { headers: NO_STORE });
}

/** 新建（无 id）或更新（有 id）。日期字段接受 YYYY-MM-DD 或空串。 */
function dateOrNull(v: unknown): string | null {
  const s = clamp(v, 32);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function POST(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const rl = checkRateLimit(`admin-cert:${admin.userId}`, 300, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE }
    );
  }

  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const programCode = clamp(body.programCode, 64);
  if (!programCode) {
    return NextResponse.json(
      { ok: false, error: "missing_program_code" },
      { status: 400, headers: NO_STORE }
    );
  }

  const statusRaw = clamp(body.verificationStatus, 16) ?? "PENDING";
  const verificationStatus = REVIEW_STATES.has(statusRaw) ? statusRaw : "PENDING";

  const res = await upsertAdminCertification({
    slug,
    id: clamp(body.id, 64),
    programCode,
    certificateNo: clamp(body.certificateNo, 120),
    issuingBody: clamp(body.issuingBody, 160),
    issueDate: dateOrNull(body.issueDate),
    expiryDate: dateOrNull(body.expiryDate),
    scope: clamp(body.scope, 500),
    verificationStatus,
    evidenceDocId: clamp(body.evidenceDocId, 64),
    notes: clamp(body.notes, 1000),
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error },
      { status: res.error === "supplier_not_found" ? 404 : 500, headers: NO_STORE }
    );
  }

  await logAdminAction(
    admin,
    clamp(body.id, 64) ? "cert.update" : "cert.create",
    "certification",
    res.id,
    { supplier: slug, program_code: programCode, verification_status: verificationStatus }
  );

  return NextResponse.json({ ok: true, id: res.id }, { headers: NO_STORE });
}

/** 审核动作：Approve / Reject（spec §6）。 */
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const id = clamp(body.id, 64);
  const statusRaw = clamp(body.verification_status, 16);
  if (!id || !statusRaw || !REVIEW_STATES.has(statusRaw)) {
    return NextResponse.json(
      { ok: false, error: "invalid_args" },
      { status: 400, headers: NO_STORE }
    );
  }

  const ok = await setReviewStatus(
    "supplier_certifications",
    id,
    statusRaw as "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED",
    admin
  );
  if (ok) {
    await logAdminAction(
      admin,
      statusRaw === "VERIFIED"
        ? "cert.approve"
        : statusRaw === "REJECTED"
          ? "cert.reject"
          : "cert.status_change",
      "certification",
      id,
      { verification_status: statusRaw }
    );
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: NO_STORE });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  await params;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "missing_id" },
      { status: 400, headers: NO_STORE }
    );
  }
  const ok = await deleteAdminCertification(id);
  if (ok) await logAdminAction(admin, "cert.delete", "certification", id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: NO_STORE });
}
