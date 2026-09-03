import Link from "next/link";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { getAdminStats, listAdminRfqs, requireAdmin } from "@/lib/adminData";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

export default async function AdminOverviewPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  // 页面级二次校验（layout 已校验过，这里再确认一次，防止未来改动 layout 时漏掉）
  const admin = await requireAdmin();
  if (!admin) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);

  const [stats, rfqs] = await Promise.all([getAdminStats(), listAdminRfqs(10)]);

  // 数据库里的 status 是 string，字典对象是字面量联合键。
  // 这里放宽成 Record<string,string>，避免 TS7053；取不到时回落到原始值。
  const statusLabel: Record<string, string> = a.status;

  const cards = [
    { label: a.statPaid, value: stats.paidMembers, href: "/admin/members" },
    { label: a.statUsers, value: stats.totalUsers, href: "/admin/members" },
    { label: a.statNewRfqs, value: stats.newRfqs, href: "/admin/rfqs" },
    { label: a.statTotalRfqs, value: stats.totalRfqs, href: "/admin/rfqs" },
    { label: a.statSuppliers, value: stats.publishedSuppliers, href: "/admin/suppliers" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0f172a]">{a.overviewTitle}</h1>
      <p className="mt-1 text-sm text-[#64748b]">{a.overviewLead}</p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={p(c.href)} className="card p-5 hover:shadow-md">
            <div className="text-3xl font-bold text-[#0f4c81]">{c.value}</div>
            <div className="mt-1 text-sm text-[#475569]">{c.label}</div>
          </Link>
        ))}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0f172a]">{a.recentRfqs}</h2>
          <Link href={p("/admin/rfqs")} className="text-sm text-[#0f4c81] hover:underline">
            {a.viewAll}
          </Link>
        </div>

        {rfqs.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748b]">{a.empty}</p>
        ) : (
          <div className="mt-4 divide-y divide-[#e2e8f0] overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
            {rfqs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="font-mono text-xs text-[#64748b]">{r.reference_id}</span>
                <span className="font-medium text-[#0f172a]">{r.product}</span>
                <span className="text-[#64748b]">{r.email}</span>
                <span className="ml-auto rounded-full bg-[#e6eef6] px-2 py-0.5 text-xs text-[#0f4c81]">
                  {statusLabel[r.status] ?? r.status}
                </span>
                <span className="text-xs text-[#94a3b8]">
                  {new Date(r.created_at).toISOString().slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
