import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { listSupplierDirectory, type SupplierView } from "@/lib/queries";
import { levelFromStatus } from "@/lib/verification";
import { overallLevel, LEVEL_COLOR, type RiskLevel } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import {
  FEATURED_MAX,
  FREE_PROFILE_LIMIT,
  ANALYTICS_EVENTS,
} from "@/lib/suppliers";

const PATH = "/suppliers";
const BASE = "https://factoryauditb2b.com";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string; industry?: string; q?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const { country, industry, q } = await searchParams;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  // 过滤态不索引：避免 country/industry/q 组合无限生成重复页面（需求 §20），
  // canonical 仍指向目录首页。
  const isFiltered = Boolean(country || industry || q);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.suppliers.metaTitle,
    description: t.suppliers.metaDesc,
    robots: isFiltered ? { index: false, follow: true } : undefined,
  });
}

/** 分数 + 等级：等级由 overallLevel 推导，文案取字典，不出现 LOW/MODERATE 原始 token */
function riskLabel(score?: number, labels?: Record<RiskLevel, string>) {
  if (typeof score !== "number" || !labels) return "—";
  return `${score} / 100 · ${labels[overallLevel(score)]}`;
}

export default async function SuppliersPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const { country, industry, q: rawQ } = await searchParams;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.suppliers;
  const v = t.verification;
  const sp = t.supplierProfile;
  const p = (href: string) => localePath(locale, href);

  const all = await listSupplierDirectory();

  // 搜索词：公司名 / 产品 / 城市（不区分大小写）
  const q = rawQ?.trim().slice(0, 80).toLowerCase() ?? "";
  const matchQ = (x: SupplierView) =>
    !q ||
    x.legalName.toLowerCase().includes(q) ||
    x.mainProducts.some((m) => m.toLowerCase().includes(q)) ||
    x.city.toLowerCase().includes(q);

  // 筛选做成链接而不是表单：可被抓取，也让「国家 + 行业 + 关键词」组合形成真实索引路径
  const countries = Array.from(new Set(all.map((x) => x.country))).sort();
  const industries = Array.from(
    new Set(all.map((x) => x.industryCode).filter(Boolean) as string[])
  ).sort();
  const filtered = all.filter(
    (x) =>
      (!country || x.country === country) &&
      (!industry || x.industryCode === industry) &&
      matchQ(x)
  );
  // Featured = 全部真实收录供应商（当前 4 家，满足 4–10 区间；绝不虚构补齐）
  const featured = all.slice(0, FEATURED_MAX);

  const linkWith = (next: { country?: string | null; industry?: string | null; q?: string | null }) => {
    const params = new URLSearchParams();
    const c = next.country !== undefined ? next.country : country;
    const i = next.industry !== undefined ? next.industry : industry;
    const query = next.q !== undefined ? next.q : q;
    if (c) params.set("country", c);
    if (i) params.set("industry", i);
    if (query) params.set("q", query);
    const qs = params.toString();
    return p(qs ? `${PATH}?${qs}` : PATH);
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: s.h1,
    url: `${BASE}${p(PATH)}`,
    numberOfItems: filtered.length,
    itemListElement: filtered.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.legalName,
      url: `${BASE}${p(`/suppliers/${x.slug}`)}`,
    })),
  };

  return (
    <main className="container py-12" data-track-page={ANALYTICS_EVENTS.directoryView}>
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <section className="mb-6">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {s.heroBadge}
        </span>
        <h1 className="text-3xl font-bold text-[#0f172a] mt-2">{s.h1}</h1>
        <p className="text-[#64748b] mt-2 max-w-3xl">{s.lead}</p>
        <p className="mt-3 text-sm text-[#8a5410] bg-[#fff4e0] rounded-md px-3 py-2 max-w-3xl">
          {s.exampleNote}
        </p>
      </section>

      {/* 搜索 + 筛选 */}
      <section className="mb-6">
        <form
          action={p(PATH)}
          method="get"
          className="flex flex-wrap items-center gap-2 mb-4"
          // 提交时上报（而非点击）：带搜索词，用于分析「哪些产品关键词带来流量」。
          // 原 data-track 会在点击表单任意空白处误触发，故改用 data-track-submit。
          data-track-submit={ANALYTICS_EVENTS.directorySearch}
          data-track-field="q"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={s.searchPlaceholder}
            aria-label={s.searchPlaceholder}
            className="flex-1 min-w-[240px] rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f4c81] focus:outline-none"
          />
          <button type="submit" className="btn btn-primary">
            {s.searchButton}
          </button>
          {q && (
            <Link
              href={linkWith({ q: null })}
              className="text-sm text-[#0f4c81] hover:underline"
            >
              {s.searchClear}
            </Link>
          )}
        </form>

        <div className="flex flex-wrap gap-6 items-start">
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase mb-2">
              {s.filterCountry}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={linkWith({ country: null })}
                className={`rounded-full px-3 py-1 text-sm border ${!country ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
                data-track={ANALYTICS_EVENTS.directoryFilter}
                data-track-value="all-countries"
              >
                {s.filterAll}
              </Link>
              {countries.map((c) => (
                <Link
                  key={c}
                  href={linkWith({ country: c })}
                  className={`rounded-full px-3 py-1 text-sm border ${country === c ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
                  data-track={ANALYTICS_EVENTS.directoryFilter}
                  data-track-value={c}
                >
                  {c.toUpperCase()}
                </Link>
              ))}
            </div>
          </div>
          {industries.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#64748b] uppercase mb-2">
                {s.filterIndustry}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={linkWith({ industry: null })}
                  className={`rounded-full px-3 py-1 text-sm border ${!industry ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
                  data-track={ANALYTICS_EVENTS.directoryFilter}
                  data-track-value="all-industries"
                >
                  {s.filterAll}
                </Link>
                {industries.map((i) => (
                  <Link
                    key={i}
                    href={linkWith({ industry: i })}
                    className={`rounded-full px-3 py-1 text-sm border ${industry === i ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
                    data-track={ANALYTICS_EVENTS.directoryFilter}
                    data-track-value={i}
                  >
                    {i}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Featured 供应商 */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0f172a]">{s.featuredTitle}</h2>
            <p className="text-sm text-[#64748b] mt-1">{s.featuredLead}</p>
          </div>
          <p className="text-sm text-[#64748b] shrink-0">
            {s.countLabel.replace("{n}", String(filtered.length))}
          </p>
        </div>

        {featured.length === 0 ? (
          <p className="text-[#475569] mb-10">{s.empty}</p>
        ) : (
          <section className="grid md:grid-cols-3 gap-5 mb-14">
            {featured.map((x) => {
              const level = levelFromStatus(x.verificationStatus);
              return (
                <Link
                  key={x.slug}
                  href={p(`/suppliers/${x.slug}`)}
                  className="card p-5 hover:border-[#0f4c81] transition"
                  data-track={ANALYTICS_EVENTS.profileView}
                  data-track-value={x.slug}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-semibold text-[#0f172a]">{x.legalName}</div>
                    <span className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-[#fff4e0] text-[#8a5410]">
                      {s.featuredTag}
                    </span>
                  </div>
                  <div className="text-sm text-[#64748b] mt-1">
                    {x.city}, {x.countryName ?? x.country.toUpperCase()}
                  </div>
                  <div className="text-sm mt-3">{x.mainProducts.join(" · ")}</div>

                  <dl className="mt-4 space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748b]">{v.levelLabel}</dt>
                      <dd className="font-medium text-[#0f172a] text-right">
                        {v.levelsShort[level]}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748b]">{s.riskLabel}</dt>
                      <dd
                        className="font-medium text-right"
                        style={{ color: LEVEL_COLOR[overallLevel(x.riskScore ?? 0)] }}
                      >
                        {riskLabel(x.riskScore, t.risk.ui.level)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748b]">{v.lastVerified}</dt>
                      <dd className="font-medium text-[#0f172a] text-right">
                        {x.lastChecked ?? sp.noCheckRecord}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748b]">{v.evidence}</dt>
                      <dd className="font-medium text-[#0f172a] text-right">
                        {x.evidenceCount ?? 0}
                      </dd>
                    </div>
                  </dl>

                  <span className="inline-block mt-4 text-sm text-[#0f4c81] font-medium">
                    {sp.viewProfile} →
                  </span>
                </Link>
              );
            })}
          </section>
        )}
      </section>

      {/* 会员解锁 CTA（价值引导：先给免费路径，再给付费） */}
      <section className="card p-8 bg-gradient-to-br from-[#0f4c81] to-[#163a5f] text-white mb-10">
        <h2 className="text-2xl font-bold text-white">{s.unlockTitle}</h2>
        <p className="mt-2 max-w-2xl text-white/90">{s.unlockLead}</p>
        <p className="mt-2 text-sm text-white/75">
          {s.unlockNote.replace("{n}", String(FREE_PROFILE_LIMIT))}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={p("/register")}
            className="btn bg-white text-[#0f4c81] hover:bg-[#e6eef6] font-semibold"
            data-track={ANALYTICS_EVENTS.profileFreeCta}
          >
            {s.freeCta}
          </Link>
          <Link
            href={p("/membership")}
            className="btn border border-white text-white hover:bg-[#163a5f] font-semibold"
            data-track={ANALYTICS_EVENTS.profilePaidCta}
          >
            {s.memberCta}
          </Link>
        </div>
      </section>

      {/* 找不到 → RFQ */}
      <section className="card p-8 bg-gradient-to-br from-[#e6eef6] to-[#f7f9fc] mb-10">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.notListedTitle}</h2>
        <p className="text-[#475569] mt-2 max-w-2xl">{s.notListedLead}</p>
        <Link href={p("/rfq")} className="btn btn-primary mt-5 inline-block">
          {s.notListedCta}
        </Link>
      </section>

      {/* 供应商侧入口（Claim 入口在各 profile 页） */}
      <section className="card p-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.claimTitle}</h2>
        <p className="text-[#475569] mt-2 max-w-2xl">{s.claimLead}</p>
        <Link
          href={p("/join-supplier-network")}
          className="btn btn-outline mt-5 inline-block"
        >
          {s.claimPrimary}
        </Link>
      </section>
    </main>
  );
}
