import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import {
  FIELD_REPORTS,
  FIELD_REPORT_DISCLOSURE,
  FIELD_REPORT_LIST_META,
  type FieldReportService,
} from "@/lib/fieldReports";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhCopy, pickZhPair } from "@/lib/tw";

const PATH = "/field-reports";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

// 分组顺序：验货 → 验厂 → 核验
const SERVICE_ORDER: FieldReportService[] = ["inspection", "audit", "verification"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.fieldReports.metaTitle,
    description: pickZhCopy(locale, FIELD_REPORT_LIST_META),
  });
}

export default async function FieldReportsPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const f = t.fieldReports;
  const p = (href: string) => localePath(locale, href);
  const disclosure = pickZhCopy(locale, FIELD_REPORT_DISCLOSURE);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: f.h1,
      itemListElement: FIELD_REPORTS.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE}${p(`/field-reports/${r.slug}`)}`,
        name: pickZhPair(locale, r.titleEn, r.titleZh),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.common.ui.home, item: `${BASE}${p("/")}` },
        {
          "@type": "ListItem",
          position: 2,
          name: t.resourcesPage.h1,
          item: `${BASE}${p("/resources")}`,
        },
        { "@type": "ListItem", position: 3, name: f.h1, item: `${BASE}${p(PATH)}` },
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-gray-500">
        <Link href={p("/")} className="hover:underline">
          {t.common.ui.home}
        </Link>
        {" / "}
        <Link href={p("/resources")} className="hover:underline">
          {t.resourcesPage.h1}
        </Link>
        {" / "}
        {f.h1}
      </nav>

      <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
        {f.badge}
      </span>
      <h1 className="text-3xl font-bold mt-1">{f.h1}</h1>
      <p className="mt-2 max-w-3xl text-gray-600">{f.lead}</p>

      {/* 诚实披露：当前无可公开的真实现场报告，全部为脱敏方法示例 */}
      <div className="mt-4 rounded-lg border border-[#d4232a]/30 bg-[#d4232a]/5 p-4 text-sm text-[#7f1d1d]">
        {disclosure}
      </div>

      <div className="mt-8 space-y-8">
        {SERVICE_ORDER.map((svc) => {
          const items = FIELD_REPORTS.filter((r) => r.service === svc);
          if (items.length === 0) return null;
          return (
            <section key={svc}>
              <h2 className="text-xl font-semibold">{f.serviceLabels[svc]}</h2>
              <ul className="mt-3 grid gap-4 md:grid-cols-2">
                {items.map((r) => (
                  <li key={r.slug} className="card p-5">
                    <Link
                      href={p(`/field-reports/${r.slug}`)}
                      className="font-semibold text-[#0f4c81] hover:underline"
                    >
                      {pickZhPair(locale, r.titleEn, r.titleZh)}
                    </Link>
                    <p className="mt-2 text-sm text-gray-600">
                      {pickZhCopy(locale, r).takeaway}
                    </p>
                    <p className="mt-3 text-xs text-gray-500">
                      {f.updatedLabel} {r.updated} ·{" "}
                      <span className="text-[#0f4c81]">{f.readMore} →</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-10 card p-6 bg-[#0f4c81]">
        <h2 className="text-lg font-semibold text-white">{f.ctaTitle}</h2>
        <p className="mt-1 text-sm text-white/80">{f.ctaLead}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={p("/rfq")} className="btn btn-accent">
            {f.ctaPrimary}
          </Link>
          <Link
            href={p("/custom-services")}
            className="btn btn-outline border-white text-white"
          >
            {f.ctaSecondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
