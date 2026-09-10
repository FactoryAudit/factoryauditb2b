import { NextResponse } from "next/server";
import {
  requireAdmin,
  listAdminAudits,
  upsertAdminAudit,
  setReviewStatus,
  logAdminAction,
} from "@/lib/adminData";
import { checkRateLimit, clamp } from "@/lib/rateLimit";

// /api/admin/suppliers/[slug]/audits —— 审核事件（自评 / 平台评估 / 现场审核 / 三方）
//
// 铁律（spec §26）：不得虚构审核结果。本接口只落库管理员真实录入的内容，
// 且 verification_status 默认 PENDING，必须人工 Approve 才对前台可见。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const AUDIT_TYPES = new Set([
  "self_assessment",
  "platform_assessment",
  "on_site_audit",
  "third_party_audit",
]);
const RESULTS = new Set(["pass", "pass_with_findings", "fail", "pending"]);
const REVIEW_STATES = new Set(["PENDING", "VERIFIED", "REJECTED", "EXPIRED"]);

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const { slug } = await params;
  const audits = await listAdminAudits(slug);
  return NextResponse.json({ ok: true, audits }, { headers: NO_STORE });
}

function dateOrNull(v: unknown): string | null {
  const s = clamp(v, 32);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function toCount(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export async function POST(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const rl = checkRateLimit(`admin-audit:${admin.userId}`, 200, 60 * 60 * 1000);
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

  const auditType = clamp(body.auditType, 32) ?? "";
  if (!AUDIT_TYPES.has(auditType)) {
    return NextResponse.json(
      { ok: false, error: "invalid_audit_type" },
      { status: 400, headers: NO_STORE }
    );
  }

  const auditDate = dateOrNull(body.auditDate);
  if (!auditDate) {
    return NextResponse.json(
      { ok: false, error: "invalid_audit_date" },
      { status: 400, headers: NO_STORE }
    );
  }

  const resultRaw = clamp(body.result, 32);
  const statusRaw = clamp(body.verificationStatus, 16) ?? "PENDING";

  const res = await upsertAdminAudit({
    slug,
    id: clamp(body.id, 64),
    auditType,
    standardCode: clamp(body.standardCode, 64),
    auditorName: clamp(body.auditorName, 120),
    auditorOrg: clamp(body.auditorOrg, 160),
    auditDate,
    reportDocId: clamp(body.reportDocId, 64),
    result: resultRaw && RESULTS.has(resultRaw) ? resultRaw : null,
    findingsCritical: toCount(body.findingsCritical),
    findingsMajor: toCount(body.findingsMajor),
    findingsMinor: toCount(body.findingsMinor),
    capDeadline: dateOrNull(body.capDeadline),
    verificationStatus: REVIEW_STATES.has(statusRaw) ? statusRaw : "PENDING",
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
    clamp(body.id, 64) ? "audit.update" : "audit.create",
    "audit",
    res.id,
    { supplier: slug, audit_type: auditType, audit_date: auditDate }
  );

  return NextResponse.json({ ok: true, id: res.id }, { headers: NO_STORE });
}

/** 审核动作：Approve / Reject。 */
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
    "supplier_audits",
    id,
    statusRaw as "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED",
    admin
  );
  if (ok) {
    await logAdminAction(
      admin,
      statusRaw === "VERIFIED" ? "audit.approve" : "audit.reject",
      "audit",
      id,
      { verification_status: statusRaw }
    );
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: NO_STORE });
}
