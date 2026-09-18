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
        <h1 className="text-xl font-bold text-[#0f172a]">{view.audit.auditCode}</h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#475569]">
          <span>
            <span className="text-[#64748b]">Supplier:</span> {view.audit.supplierName ?? "—"}
          </span>
          <span>
            <span className="text-[#64748b]">Type:</span> {view.audit.auditType}
          </span>
          <span>
            <span className="text-[#64748b]">Product:</span> {view.audit.product ?? "—"}
          </span>
          {view.audit.standardProtocol && (
            <span>
              <span className="text-[#64748b]">Standard:</span> {view.audit.standardProtocol}
            </span>
          )}
        </div>
        <span
          className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${
            current === "closed"
              ? "bg-[#e2e8f0] text-[#475569]"
              : current === "report_issued" || current === "report_draft"
                ? "bg-[#dcfce7] text-[#166534]"
                : "bg-[#dbeafe] text-[#1e40af]"
          }`}
        >
          {current}
        </span>
      </div>

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
