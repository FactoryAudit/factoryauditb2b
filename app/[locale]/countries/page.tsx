import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import { SERVICE_MENU } from "@/lib/nav";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhCopy, pickZhPair } from "@/lib/tw";

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

  // Inspection 是全局服务页（不做国家分页），href 复用主导航的单一事实来源 SERVICE_MENU。
  const inspectionHref = SERVICE_MENU.find((m) => m.key === "inspection")?.href ?? "/services/inspection";

  const jsonLd = [
    {
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
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: t.common.ui.home,
          item: `${BASE}${p("/")}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: c.h1,
          item: `${BASE}${p(PATH)}`,
        },
      ],
    },
  ];

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />

      <section className="max-w-3xl mb-10">
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">
          {c.badge}
        </span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2">{c.h1}</h1>
        <p className="text-[#6d6b66] mt-3 text-lg">{c.lead}</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
        {COVERAGE_COUNTRIES.map((x) => {
          const copy = pickZhCopy(locale, x);
          return (
            <div key={x.code} className="card p-6 flex flex-col">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#8a5410]">
                {c.phase1}
              </div>
              <h2 className="text-2xl font-bold text-[#171717] mt-1">
                {pickZhPair(locale, x.name, x.nameZh)}
              </h2>
              <p className="text-sm text-[#3f4650] mt-2 flex-1">{copy.hook}</p>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase text-[#6d6b66]">
                  {t.countryHub.industriesTitle}
                </div>
                <div className="text-sm text-[#3f4650] mt-1">
                  {copy.industries.slice(0, 4).join(" · ")}
                </div>
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <Link
                  href={p(`/services/${x.slug}-supplier-verification`)}
                  className="block text-[#171717] hover:underline"
                >
                  {t.servicesIndex.items.verification.title} →
                </Link>
                <Link
                  href={p(`/services/${x.slug}-factory-audit`)}
                  className="block text-[#171717] hover:underline"
                >
                  {t.servicesIndex.items.factoryAudit.title} →
                </Link>
                <Link
                  href={p(inspectionHref)}
                  className="block text-[#171717] hover:underline"
                >
                  {t.servicesIndex.items.inspection.title} →
                </Link>
              </div>

              <Link href={p(`/countries/${x.slug}`)} className="btn btn-outline mt-5 self-start">
                {c.countryCta.replace("{country}", pickZhPair(locale, x.name, x.nameZh))}
              </Link>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-dashed border-[#ddd9d0] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="font-semibold text-[#171717]">{c.anotherCountryTitle}</div>
          <p className="text-sm text-[#3f4650] mt-1">{c.anotherCountryLead}</p>
        </div>
        <Link href={p("/custom-services")} className="btn btn-primary whitespace-nowrap">
          {c.anotherCountryCta}
        </Link>
      </section>
    </main>
  );
}
