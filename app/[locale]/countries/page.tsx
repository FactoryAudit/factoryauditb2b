import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/countries";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.coverage.metaTitle,
    description: t.coverage.metaDesc,
  });
}

export default async function CountriesPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const c = t.coverage;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.h1,
    url: `${BASE}${p(PATH)}`,
    numberOfItems: COVERAGE_COUNTRIES.length,
    itemListElement: COVERAGE_COUNTRIES.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.name,
      url: `${BASE}${p(`/countries/${x.slug}`)}`,
    })),
  };

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />

      <section className="max-w-3xl mb-10">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {c.badge}
        </span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{c.h1}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{c.lead}</p>
      </section>

      <section className="grid md:grid-cols-3 gap-5 mb-12">
        {COVERAGE_COUNTRIES.map((x) => {
          const copy = locale === "zh" ? x.zh : x.en;
          return (
            <div key={x.code} className="card p-6 flex flex-col">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#a86a13]">
                {c.phase1}
              </div>
              <h2 className="text-2xl font-bold text-[#0f172a] mt-1">
                {locale === "zh" ? x.nameZh : x.name}
              </h2>
              <p className="text-sm text-[#475569] mt-2 flex-1">{copy.hook}</p>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase text-[#64748b]">
                  {t.countryHub.industriesTitle}
                </div>
                <div className="text-sm text-[#475569] mt-1">
                  {copy.industries.slice(0, 4).join(" · ")}
                </div>
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <Link
                  href={p(`/services/${x.slug}-supplier-verification`)}
                  className="block text-[#0f4c81] hover:underline"
                >
                  {t.servicesIndex.items.verification.title} →
                </Link>
                <Link
                  href={p(`/services/${x.slug}-factory-audit`)}
                  className="block text-[#0f4c81] hover:underline"
                >
                  {t.servicesIndex.items.factoryAudit.title} →
                </Link>
              </div>

              <Link href={p(`/countries/${x.slug}`)} className="btn btn-outline mt-5 self-start">
                {c.countryCta.replace("{country}", locale === "zh" ? x.nameZh : x.name)}
              </Link>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-dashed border-[#cbd5e1] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="font-semibold text-[#0f172a]">{c.anotherCountryTitle}</div>
          <p className="text-sm text-[#475569] mt-1">{c.anotherCountryLead}</p>
        </div>
        <Link href={p("/custom-services")} className="btn btn-primary whitespace-nowrap">
          {c.anotherCountryCta}
        </Link>
      </section>
    </main>
  );
}
