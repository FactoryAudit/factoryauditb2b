import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { requireAdmin } from "@/lib/adminData";
import { listAudits } from "@/lib/auditWorkflow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Audit workbench | FactoryAuditB2B Admin",
};

const STATUS_COLOR: Record<string, string> = {
  requested: "bg-[#e0f2fe] text-[#075985]",
  quotation_sent: "bg-[#e0f2fe] text-[#075985]",
  pending_approval: "bg-[#fef3c7] text-[#92400e]",
  scheduled: "bg-[#fef3c7] text-[#92400e]",
  auditor_assigned: "bg-[#fef3c7] text-[#92400e]",
  in_progress: "bg-[#dbeafe] text-[#1e40af]",
  findings_review: "bg-[#fae8ff] text-[#86198f]",
  cap_required: "bg-[#fae8ff] text-[#86198f]",
  report_draft: "bg-[#dcfce7] text-[#166534]",
  report_issued: "bg-[#dcfce7] text-[#166534]",
  closed: "bg-[#e2e8f0] text-[#475569]",
  cancelled: "bg-[#fee2e2] text-[#991b1b]",
};

type Props = { params: Promise<{ locale: string }> };

export default async function AdminAuditsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const admin = await requireAdmin();
  if (!admin) notFound();

  const rows = await listAudits({ limit: 200 });
  const p = (href: string) => localePath(locale, href);

  return (
    <div>
      <h1 className="text-xl font-bold text-[#0f172a]">Audit workbench ({rows.length})</h1>
      <p className="mt-1 text-sm text-[#64748b]">All audit requests and their workflow status.</p>

      <div className="mt-6 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] text-left text-xs uppercase text-[#64748b]">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Supplier</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-[#f8fafc]">
                <td className="px-4 py-2 font-mono">
                  <Link href={p(`/admin/audits/${a.id}`)} className="text-[#0f4c81] hover:underline">
                    {a.auditCode}
                  </Link>
                </td>
                <td className="px-4 py-2">{a.supplierName ?? "—"}</td>
                <td className="px-4 py-2">{a.auditType}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[a.status] ?? "bg-[#e2e8f0] text-[#475569]"}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-2">{a.product ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-[#64748b]">{a.createdAt ? String(a.createdAt).slice(0, 10) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[#64748b]">
                  No audits yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
