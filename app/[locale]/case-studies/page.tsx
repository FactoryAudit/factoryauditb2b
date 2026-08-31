import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { CASE_STUDIES, CASE_SERVICE_ORDER, CASE_DISCLOSURE, CASE_LIST_META } from "@/lib/caseStudies";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/pageMeta";

const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return buildPageMetadata({
    locale,
    path: "/case-studies",
    title: "Supplier Verification, Audit & Inspection Case Studies",
    description: locale === "zh" ? CASE_LIST_META.zh : CASE_LIST_META.en,
  });
}

export default async function CaseStudiesPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh";
  const disclosure = zh ? CASE_DISCLOSURE.zh : CASE_DISCLOSURE.en;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Supplier verification, audit and inspection case studies",
      itemListElement: CASE_STUDIES.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE}${p(`/case-studies/${c.slug}`)}`,
        name: zh ? c.titleZh : c.titleEn,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
        {
          "@type": "ListItem",
          position: 2,
          name: "Case studies",
          item: `${BASE}${p("/case-studies")}`,
        },
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-gray-500">
        <Link href={p("/")} className="hover:underline">Home</Link> / Case studies
      </nav>

      <h1 className="text-3xl font-bold">Case studies</h1>
      <p className="mt-2 max-w-3xl text-gray-600">
        Supplier verification, factory audit, inspection and sourcing walk-throughs.
      </p>

      {/* 诚实披露：当前无真实客户案例，全部为匿名方法示例 */}
      <div className="mt-4 rounded-lg border border-[#d4232a]/30 bg-[#d4232a]/5 p-4 text-sm text-[#7f1d1d]">
        {disclosure}
      </div>

      <div className="mt-8 space-y-8">
        {CASE_SERVICE_ORDER.map((svc) => {
          const items = CASE_STUDIES.filter((c) => c.service === svc);
          if (items.length === 0) return null;
          const label =
            svc === "verification"
              ? "Supplier verification"
              : svc === "audit"
                ? "Factory audit"
                : svc === "inspection"
                  ? "Inspection"
                  : "Sourcing";
          return (
            <section key={svc}>
              <h2 className="text-xl font-semibold">{label}</h2>
              <ul className="mt-3 grid gap-4 md:grid-cols-2">
                {items.map((c) => (
                  <li key={c.slug} className="card p-5">
                    <Link
                      href={p(`/case-studies/${c.slug}`)}
                      className="font-semibold text-[#0f4c81] hover:underline"
                    >
                      {zh ? c.titleZh : c.titleEn}
                    </Link>
                    <p className="mt-1 text-sm text-gray-600">{zh ? c.zh.summary : c.en.summary}</p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-10 card p-6 bg-[#0f4c81]">
        <h2 className="text-lg font-semibold text-white">Have a similar situation?</h2>
        <p className="mt-1 text-sm text-white/80">
          Send us your requirement and we will scope the verification, audit or inspection for your
          product and market.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={p("/rfq")} className="btn btn-accent">
            Post an RFQ
          </Link>
          <Link href={p("/custom-services")} className="btn btn-outline border-white text-white">
            Custom services
          </Link>
        </div>
      </section>
    </main>
  );
}
