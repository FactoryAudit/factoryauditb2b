import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { assignAuditor } from "@/lib/auditWorkflow";
import { notifyAuditorAssigned } from "@/lib/notify";
import { checkRateLimit, clamp } from "@/lib/rateLimit";

// POST /api/admin/audits/[auditId]/assign —— 派单（Phase 1）
//
// 写库与发信分开：
//   ① 先把指派落库（audits.auditor_* + audit_assignments），这一步失败就整个失败；
//   ② 再发派单邮件。邮件失败**不回滚**指派 —— 记录「派给谁」是事实，
//      信没发出去是通道问题，修通道后可以重发，不该把事实抹掉。
//   返回值带 mailSent，前端据此提示「已指派但邮件未发出」，
//   避免出现「页面显示派单成功、审核员根本没收到」的静默失败。
//
// 没有平台账号也能派单：只填姓名 + 邮箱即可（auditor_id 留 NULL）。
// 将来审核员有了账号，再传 auditorId 覆盖，历史记录不动。

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

  const rl = checkRateLimit(`admin-audit-assign:${admin.userId}`, 60, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const auditorName = clamp(body.auditorName, 120);
  const auditorEmail = clamp(body.auditorEmail, 254);
  const role = body.role === "reviewer" ? "reviewer" : "auditor";

  // 发信要用的上下文：以库里为准，不信任前端传来的工厂/日期（避免邮件与记录不一致）
  const db = createAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503, headers: NO_STORE });
  }

  const { data: row, error: readErr } = await db
    .from("audits")
    .select(
      "audit_code, supplier_source, external_supplier_name, external_supplier_address, external_supplier_contact, audit_type, standard_protocol, preferred_date, preferred_window, product, suppliers(legal_name)"
    )
    .eq("id", auditId)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500, headers: NO_STORE });
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  const r = await assignAuditor({
    auditId,
    auditorName,
    auditorEmail,
    role,
    actorId: admin.userId,
    actorEmail: admin.email,
  });

  if (!r.ok) {
    const status =
      r.reason === "not_found"
        ? 404
        : r.reason === "auditor_contact_required" || r.reason === "invalid_auditor_email"
          ? 400
          : r.reason === "not_configured"
            ? 503
            : 500;
    return NextResponse.json(
      { ok: false, error: r.reason, message: r.message ?? null },
      { status, headers: NO_STORE }
    );
  }

  const a = row as Record<string, unknown>;
  const sup = a.suppliers as { legal_name?: string | null } | null;
  const supplierName =
    a.supplier_source === "external"
      ? a.external_supplier_name
        ? String(a.external_supplier_name)
        : null
      : sup?.legal_name
        ? String(sup.legal_name)
        : null;

  let mailSent = false;
  if (auditorEmail) {
    mailSent = await notifyAuditorAssigned({
      auditorEmail,
      auditorName,
      auditCode: String(a.audit_code ?? ""),
      supplierName,
      supplierAddress:
        a.supplier_source === "external" && a.external_supplier_address
          ? String(a.external_supplier_address)
          : null,
      auditType: String(a.audit_type ?? "announced"),
      standardProtocol: a.standard_protocol ? String(a.standard_protocol) : null,
      preferredDate: a.preferred_date ? String(a.preferred_date) : null,
      preferredWindow: a.preferred_window ? String(a.preferred_window) : null,
      product: a.product ? String(a.product) : null,
      specialRequirements: null,
    });

    if (!mailSent) {
      // 指派已落库，只有信没出去。必须留痕，否则运营会以为对方已收到。
      console.error(
        `[admin/audits/assign] mail delivery failed audit=${String(a.audit_code ?? "")} auditor=${auditorEmail}`
      );
    }
  }

  return NextResponse.json(
    { ok: true, auditor: { name: auditorName, email: auditorEmail }, mailSent },
    { headers: NO_STORE }
  );
}
