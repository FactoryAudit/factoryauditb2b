import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { listAdminLeads, requireAdmin } from "@/lib/adminData";
import LeadStatusSelect from "@/components/admin/LeadStatusSelect";

// Admin · 线索列表（CS-02D）
//
// public.leads 收三类：买家留资 / 供应商入驻申请 / 供应商认领申请。
// 此前这三个入口**只发邮件、一行不落库**，后台查不到任何东西 —— 一等「假功能」。
// 现在 /api/lead · /api/supplier-register · /api/supplier-claim 全部经 lib/leads.ts 落库，
// 这一页就是它们的落地视图。
//
// 状态流转：new → contacted → quoted → won / lost。
// 下拉直接显示数据库原始值（单人后台，不补 9 语翻译）。
//
// 数据库未配置时 listAdminLeads() 返回空数组，页面不会崩 —— 与既有 fail-open 哲学一致。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

export default async function AdminLeadsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);
  const rows = await listAdminLeads(200);

  // kind 与 status 都是内部运营口径：单人后台，不补 9 语翻译，直接显示库值
  const KIND_LABEL: Record<string, string> = {
    buyer_lead: "buyer",
    supplier_application: "supplier",
    supplier_claim: "claim",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0f172a]">{a.leadsTitle}</h1>
      <p className="mt-1 text-sm text-[#64748b]">{a.leadsLead}</p>

      {rows.length === 0 ? (
        <div className="card mt-6 p-6">
          <p className="text-sm text-[#475569]">{a.leadsEmpty}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2e8f0] bg-[#f7f9fc] text-xs uppercase text-[#64748b]">
              <tr>
                <th className="px-4 py-3">{a.colReference}</th>
                <th className="px-4 py-3">{a.colKind}</th>
                <th className="px-4 py-3">{a.colEmail}</th>
                <th className="px-4 py-3">{a.colTool}</th>
                <th className="px-4 py-3">{a.colCreated}</th>
                <th className="px-4 py-3">{a.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-[#f7f9fc]">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-[#64748b]">{r.reference_id}</span>
                    {r.company && (
                      <div className="mt-0.5 text-xs text-[#94a3b8]">{r.company}</div>
                    )}
                    {r.score !== null && (
                      <div className="mt-0.5 text-xs text-[#94a3b8]">score {r.score}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#e6eef6] px-2 py-0.5 text-xs text-[#0f4c81]">
                      {KIND_LABEL[r.kind] ?? r.kind}
                    </span>
                    {r.sourcing && (
                      <div className="mt-1 max-w-xs text-xs text-[#64748b]">{r.sourcing}</div>
                    )}
                    {r.supplier_name && (
                      <div className="mt-0.5 max-w-xs text-xs text-[#64748b]">
                        → {r.supplier_name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${r.email}`} className="text-[#0f4c81] hover:underline">
                      {r.email}
                    </a>
                    {r.phone && <div className="mt-0.5 text-xs text-[#94a3b8]">{r.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#475569]">
                    <span className="font-mono">{r.tool}</span>
                    {r.message && (
                      <p className="mt-1 max-w-sm whitespace-pre-wrap text-xs text-[#64748b]">
                        {r.message}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94a3b8]">
                    {new Date(r.created_at).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusSelect
                      referenceId={r.reference_id}
                      status={r.status}
                      dict={{ saving: a.saving, error: a.error }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-[#64748b]">
        <a href={p("/admin")} className="text-[#0f4c81] hover:underline">
          ← {a.navOverview}
        </a>
      </p>
    </div>
  );
}
