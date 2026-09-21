import Link from "next/link";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { getAdminStats, listAdminLeads, listAdminRfqs, requireAdmin } from "@/lib/adminData";
import { getBusinessFunnel } from "@/lib/adminBusiness";
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

  const [stats, rfqs, leads, funnel] = await Promise.all([
    getAdminStats(),
    listAdminRfqs(10),
    listAdminLeads(10),
    getBusinessFunnel(),
  ]);

  // STEP 13 CHANGE SET E —— 业务激活漏斗（很轻的一张表，不做 BI）
  //
  // 🔴 测试探针一律剔除：rfq.real / matching.real* 只算真实数据。
  //    截至本轮实测，库内 8 条 RFQ **全部**是验收探针（real=0），
  //    所以这里如实显示 0，而不是把探针算成"商机"。
  //    后台是内部 noindex 工具，沿用 admin 既有约定用双语常量，不补 9 语字典键
  //    （避免再动 en 叶子数冻结常量 2940）。
  const zhAdmin = locale === "zh" || locale === "zh-TW";
  const F = zhAdmin
    ? {
        bizTitle: "业务激活漏斗",
        bizHint: "仅统计真实数据；测试探针已排除。",
        rReal: "真实询价 RFQ",
        rTest: "测试探针 RFQ（已排除）",
        rPublic: "前台公开中",
        rMatched: "已确认匹配的真实 RFQ",
        rMatchRows: "匹配记录",
        rSuggested: "待跟进",
        rAdvanced: "已推进（联系/成交/未成）",
        rContacted: "已联系",
        rWon: "成交",
        rLost: "未成 / 不跟进",
        rQuotes: "报价",
        rQuotesNa: "未实现（尚无报价工作流）",
        supTitle: "供应商激活",
        sTotal: "真实供应商",
        sPublished: "已发布",
        sDraft: "草稿",
        sNeedsReview: "资料齐、待发布",
        sRejected: "已标记不完整",
        sPublishable: "可发布",
        leadTitle: "供应商入驻线索",
        lReal: "真实线索",
        lNew: "未处理",
        lReviewed: "已流转",
        lRejected: "已拒绝",
      }
    : {
        bizTitle: "Business activation funnel",
        bizHint: "Real data only; test probes excluded.",
        rReal: "Real RFQs",
        rTest: "Test-probe RFQs (excluded)",
        rPublic: "Publicly listed",
        rMatched: "Real RFQs with confirmed match",
        rMatchRows: "Match rows",
        rSuggested: "suggested",
        rAdvanced: "Advanced (contacted/won/lost)",
        rContacted: "contacted",
        rWon: "won",
        rLost: "lost",
        rQuotes: "Quotes",
        rQuotesNa: "not implemented (no quote workflow yet)",
        supTitle: "Supplier activation",
        sTotal: "Real suppliers",
        sPublished: "Published",
        sDraft: "Draft",
        sNeedsReview: "Complete, awaiting publish",
        sRejected: "Marked incomplete",
        sPublishable: "Publishable",
        leadTitle: "Supplier application leads",
        lReal: "Real leads",
        lNew: "Unhandled",
        lReviewed: "In progress",
        lRejected: "Rejected",
      };

  const bizRows: Array<[string, string | number, boolean?]> = [
    [F.rReal, funnel.rfq.real],
    [F.rMatched, funnel.matching.realRfqsMatched],
    [F.rSuggested, funnel.matching.realSuggested],
    [F.rContacted, funnel.matching.realContacted],
    [F.rWon, funnel.matching.realWon],
    [F.rLost, funnel.matching.realLost],
    [F.rQuotes, F.rQuotesNa, true],
    [F.rTest, funnel.rfq.test],
    [F.rPublic, funnel.rfq.publicCount],
  ];

  const supRows: Array<[string, number]> = [
    [F.sTotal, funnel.supplier.total],
    [F.sPublished, funnel.supplier.published],
    [F.sDraft, funnel.supplier.draft],
    [F.sNeedsReview, funnel.supplier.needsReview],
    [F.sPublishable, funnel.supplier.publishable],
    [F.sRejected, funnel.supplier.rejected],
  ];

  const leadRows: Array<[string, number]> = [
    [F.lReal, funnel.leads.real],
    [F.lNew, funnel.leads.newCount],
    [F.lReviewed, funnel.leads.reviewed],
    [F.lRejected, funnel.leads.rejected],
  ];

  const funnelCard = (title: string, rows: Array<[string, string | number, boolean?]>) => (
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-4">
      <h3 className="text-sm font-bold text-[#0f172a]">{title}</h3>
      <dl className="mt-2 space-y-1">
        {rows.map(([label, value, muted]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-[#475569]">{label}</dt>
            <dd className={muted ? "text-xs text-[#94a3b8]" : "font-semibold text-[#0f4c81]"}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  // 数据库里的 status 是 string，字典对象是字面量联合键。
  // 这里放宽成 Record<string,string>，避免 TS7053；取不到时回落到原始值。
  const statusLabel: Record<string, string> = a.status;

  const cards = [
    { label: a.statPaid, value: stats.paidMembers, href: "/admin/members" },
    { label: a.statUsers, value: stats.totalUsers, href: "/admin/members" },
    { label: a.statNewRfqs, value: stats.newRfqs, href: "/admin/rfqs" },
    { label: a.statTotalRfqs, value: stats.totalRfqs, href: "/admin/rfqs" },
    { label: a.statNewLeads, value: stats.newLeads, href: "/admin/leads" },
    { label: a.statTotalLeads, value: stats.totalLeads, href: "/admin/leads" },
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-[#0f172a]">{F.bizTitle}</h2>
          <span className="text-xs text-[#94a3b8]">{F.bizHint}</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funnelCard(F.bizTitle + " · RFQ → Match", bizRows)}
          {funnelCard(F.supTitle, supRows)}
          {funnelCard(F.leadTitle, leadRows)}
        </div>
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
      {/* CS-02D：线索入库后，概览页必须能看到最近线索 —— 否则"落库"对运营等于不存在 */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0f172a]">{a.recentLeads}</h2>
          <Link href={p("/admin/leads")} className="text-sm text-[#0f4c81] hover:underline">
            {a.viewAll}
          </Link>
        </div>

        {leads.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748b]">{a.leadsEmpty}</p>
        ) : (
          <div className="mt-4 divide-y divide-[#e2e8f0] overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
            {leads.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="font-mono text-xs text-[#64748b]">{l.reference_id}</span>
                <span className="text-[#64748b]">{l.tool}</span>
                <span className="text-[#64748b]">{l.email}</span>
                <span className="ml-auto rounded-full bg-[#e6eef6] px-2 py-0.5 text-xs text-[#0f4c81]">
                  {l.kind}
                </span>
                <span className="text-xs text-[#94a3b8]">
                  {new Date(l.created_at).toISOString().slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
