import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { listAdminSuppliers, requireAdmin } from "@/lib/adminData";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

export default async function AdminSuppliersPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);
  const rows = await listAdminSuppliers();

  // 数据库里的 access_tier 是 string，字典对象是字面量联合键，
  // 放宽成 Record<string,string> 避免 TS7053；取不到时回落到原始值。
  const tierLabel: Record<string, string> = a.tier;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0f172a]">{a.suppliersTitle}</h1>
      <p className="mt-1 text-sm text-[#64748b]">{a.suppliersLead}</p>

      {rows.length === 0 ? (
        <div className="card mt-6 p-6">
          <p className="text-sm text-[#475569]">{a.suppliersEmpty}</p>
          <p className="mt-2 text-xs text-[#64748b]">{a.suppliersEmptyHint}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2e8f0] bg-[#f7f9fc] text-xs uppercase text-[#64748b]">
              <tr>
                <th className="px-4 py-3">{a.colName}</th>
                <th className="px-4 py-3">{a.colCountry}</th>
                <th className="px-4 py-3">{a.colRisk}</th>
                <th className="px-4 py-3">{a.colTier}</th>
                <th className="px-4 py-3">{a.colPublished}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#f7f9fc]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0f172a]">{r.legal_name}</div>
                    <div className="font-mono text-xs text-[#94a3b8]">{r.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-[#475569]">
                    {r.country_code} · {r.city}
                  </td>
                  <td className="px-4 py-3 text-[#475569]">{r.risk_score ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#e6eef6] px-2 py-0.5 text-xs text-[#0f4c81]">
                      {tierLabel[r.access_tier] ?? r.access_tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#475569]">
                    {r.is_published ? a.yes : a.no}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={p(`/admin/suppliers/${r.slug}`)}
                      className="text-[#0f4c81] hover:underline"
                    >
                      {a.edit}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
