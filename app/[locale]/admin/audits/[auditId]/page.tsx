import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { requireAdmin } from "@/lib/adminData";
import { getAuditWorkflow } from "@/lib/auditWorkflow";
import { AUDIT_STATUS_TRANSITIONS } from "@/lib/audits";
import AuditConsole from "@/components/admin/AuditConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Audit detail | FactoryAuditB2B Admin",
};

type Props = { params: Promise<{ locale: string; auditId: string }> };

export default async function AdminAuditDetailPage({ params }: Props) {
  const { locale: raw, auditId } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const admin = await requireAdmin();
  if (!admin) notFound();

  const view = await getAuditWorkflow(auditId);
  if (!view) notFound();

  const current = view.audit.status;
  const allowedNext = AUDIT_STATUS_TRANSITIONS[current as keyof typeof AUDIT_STATUS_TRANSITIONS] ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#171717]">{view.audit.auditCode}</h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#3f4650]">
          <span>
            <span className="text-[#6d6b66]">Supplier:</span> {view.audit.supplierName ?? "—"}
          </span>
          {/* R85：外部供应商必须显式标明「客户指定、未核验」，并给出联系方式 ——
              没有这段，运营看到一行工厂名会以为是我们目录里的记录。 */}
          {view.audit.supplierSource === "external" && (
            <span className="rounded bg-[#fef3c7] px-2 py-0.5 text-xs font-medium text-[#92400e]">
              buyer-specified · not verified
            </span>
          )}
          <span>
            <span className="text-[#6d6b66]">Type:</span> {view.audit.auditType}
          </span>
          <span>
            <span className="text-[#6d6b66]">Product:</span> {view.audit.product ?? "—"}
          </span>
          {view.audit.standardProtocol && (
            <span>
              <span className="text-[#6d6b66]">Standard:</span> {view.audit.standardProtocol}
            </span>
          )}
        </div>
        <span
          className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${
            current === "closed"
              ? "bg-[#ebe8e1] text-[#3f4650]"
              : current === "report_issued" || current === "report_draft"
                ? "bg-[#dcfce7] text-[#166534]"
                : "bg-[#dbeafe] text-[#1e40af]"
          }`}
        >
          {current}
        </span>
      </div>

      {/* R85：外部供应商的联系方式。这是运营联系工厂的唯一凭据，单独成块，
          与上面那行摘要分开 —— 摘要用于扫一眼，这块用于照着拨号/发信。 */}
      {view.audit.supplierSource === "external" && view.audit.externalContact && (
        <div className="rounded-lg border border-[#f3d9a4] bg-[#fffdf6] p-4">
          <h2 className="text-sm font-semibold text-[#92400e]">
            Buyer-specified supplier — contact details provided by the buyer
          </h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-[#3f4650] sm:grid-cols-2">
            <div>
              <dt className="text-[#6d6b66]">Contact person</dt>
              <dd>{view.audit.externalContact.contact ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#6d6b66]">Email</dt>
              <dd>{view.audit.externalContact.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#6d6b66]">Phone / WhatsApp</dt>
              <dd>{view.audit.externalContact.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#6d6b66]">Factory address</dt>
              <dd>{view.audit.externalContact.address ?? "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      <AuditConsole
        auditId={auditId}
        supplierId={view.audit.supplierId}
        currentStatus={current}
        allowedNext={allowedNext}
        initialView={view}
      />
    </div>
  );
}
