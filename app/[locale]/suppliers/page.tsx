import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { listSupplierDirectory, type SupplierView } from "@/lib/queries";
import { levelFromStatus } from "@/lib/verification";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/suppliers";
const BASE = "https://factoryauditb2b.com";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string; industry?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.suppliers.metaTitle,
    description: t.suppliers.metaDesc,
  });
}

function riskLabel(score?: number, level?: string) {
  if (typeof score !== "number") return "—";
  return `${score} / 100 · ${(level ?? "").replaceAll("_", " ")}`;
}

export default async function SuppliersPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const { country, industry } = await searchParams;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.suppliers;
  const v = t.verification;
  const p = (href: string) => localePath(locale, href);

  const all = await listSupplierDirectory();

  // 筛选做成链接而不是表单：可被抓取，也让「国家 + 行业」组合形成真实索引路径
  const countries = Array.from(new Set(all.map((x) => x.country))).sort();
  const industries = Array.from(
    new Set(all.map((x) => x.industryCode).filter(Boolean) as string[])
  ).sort();
  const filtered = all.filter(
    (x) =>
      (!country || x.country === country) && (!industry || x.industryCode === industry)
  );

  const linkWith = (next: { country?: string | null; industry?: string | null }) => {
    const q = new URLSearchParams();
    const c = next.country !== undefined ? next.country : country;
    const i = next.industry !== undefined ? next.industry : industry;
    if (c) q.set("country", c);
    if (i) q.set("industry", i);
    const qs = q.toString();
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
      url: `${BASE}${p(`/supplier/${x.country}/${x.slug}`)}`,
    })),
  };

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />

      <section className="mb-6">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">{s.badge}</span>
        <h1 className="text-3xl font-bold text-[#0f172a] mt-2">{s.h1}</h1>
        <p className="text-[#64748b] mt-2 max-w-3xl">{s.lead}</p>
        <p className="mt-3 text-sm text-[#a86a13] bg-[#fff4e0] rounded-md px-3 py-2 max-w-3xl">
          {s.exampleNote}
        </p>
      </section>

      {/* 筛选 */}
      <section className="mb-6 flex flex-wrap gap-6 items-start">
        <div>
          <div className="text-xs font-semibold text-[#64748b] uppercase mb-2">{s.filterCountry}</div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={linkWith({ country: null })}
              className={`rounded-full px-3 py-1 text-sm border ${!country ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
            >
              {s.filterAll}
            </Link>
            {countries.map((c) => (
              <Link
                key={c}
                href={linkWith({ country: c })}
                className={`rounded-full px-3 py-1 text-sm border ${country === c ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
              >
                {c.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
        {industries.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase mb-2">{s.filterIndustry}</div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={linkWith({ industry: null })}
                className={`rounded-full px-3 py-1 text-sm border ${!industry ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
              >
                {s.filterAll}
              </Link>
              {industries.map((i) => (
                <Link
                  key={i}
                  href={linkWith({ industry: i })}
                  className={`rounded-full px-3 py-1 text-sm border ${industry === i ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
                >
                  {i}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="text-sm text-[#64748b] mb-4">
        {s.countLabel.replace("{n}", String(filtered.length))}
      </p>

      {filtered.length === 0 ? (
        <p className="text-[#475569] mb-10">{s.empty}</p>
      ) : (
        <section className="grid md:grid-cols-3 gap-5 mb-14">
          {filtered.map((x) => {
            const level = levelFromStatus(x.verificationStatus);
            return (
              <Link
                key={x.slug}
                href={p(`/supplier/${x.country}/${x.slug}`)}
                className="card p-5 hover:border-[#0f4c81] transition"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="font-semibold text-[#0f172a]">{x.legalName}</div>
                  <span className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-[#fff4e0] text-[#a86a13]">
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
                    <dd className="font-medium text-[#0f4c81] text-right">
                      {riskLabel(x.riskScore, x.riskLevel)}
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
                  {t.supplierProfile.viewProfile} →
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {/* 找不到 → RFQ */}
      <section className="card p-8 bg-gradient-to-br from-[#e6eef6] to-[#f7f9fc] mb-10">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.notListedTitle}</h2>
        <p className="text-[#475569] mt-2 max-w-2xl">{s.notListedLead}</p>
        <Link href={p("/rfq")} className="btn btn-primary mt-5 inline-block">
          {s.notListedCta}
        </Link>
      </section>

      {/* 供应商侧入口 */}
      <section className="card p-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.claimTitle}</h2>
        <p className="text-[#475569] mt-2 max-w-2xl">{s.claimLead}</p>
        <Link href={p("/services/supplier-improvement")} className="btn btn-outline mt-5 inline-block">
          {s.claimPrimary}
        </Link>
      </section>
    </main>
  );
}
