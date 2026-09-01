import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import {
  FIELD_REPORTS,
  findFieldReport,
  FIELD_REPORT_DISCLOSURE,
  FIELD_REPORT_SECTIONS,
} from "@/lib/fieldReports";
import { findGuide } from "@/lib/guides";
import { toolCardKeyByHref, serviceKeyByHref } from "@/lib/nav";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const BASE = "https://factoryauditb2b.com";
type Params = { locale: string; slug: string };

export async function generateStaticParams() {
  return LOCALES.flatMap((locale) => FIELD_REPORTS.map((r) => ({ locale, slug: r.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const r = findFieldReport(slug);
  if (!r) {
    return buildPageMetadata({
      locale,
      path: `/field-reports/${slug}`,
      title: "Field report",
      description: "Field report.",
      robots: { index: false },
    });
  }
  return buildPageMetadata({
    locale,
    path: `/field-reports/${slug}`,
    title: locale === "zh" ? r.titleZh : r.titleEn,
    description: locale === "zh" ? r.metaDescZh : r.metaDescEn,
  });
}

export default async function FieldReportPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const r = findFieldReport(slug);
  if (!r) notFound();

  const t = await getDictionary(locale);
  const f = t.fieldReports;
  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh";
  const x = zh ? r.zh : r.en;
  const title = zh ? r.titleZh : r.titleEn;
  const disclosure = zh ? FIELD_REPORT_DISCLOSURE.zh : FIELD_REPORT_DISCLOSURE.en;
  const sec = zh ? FIELD_REPORT_SECTIONS.zh : FIELD_REPORT_SECTIONS.en;

  const relatedGuides = r.related
    .map((s) => findGuide(s))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  // 链接标题从导航的单一事实来源反查，页面里不硬编码任何卡片名称
  const toolLinks = r.tools.map((x) => {
    const key = toolCardKeyByHref(x.href);
    return { href: x.href, label: key ? t.toolCards[key].title : x.href };
  });
  const serviceLinks = r.services.map((x) => {
    const key = serviceKeyByHref(x.href);
    return { href: x.href, label: key ? t.nav.menu[key] : x.href };
  });

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description: zh ? r.metaDescZh : r.metaDescEn,
      dateModified: r.updated,
      author: { "@type": "Organization", name: "FactoryAuditB2B", url: BASE },
      publisher: { "@id": `${BASE}/#organization` },
      mainEntityOfPage: `${BASE}${p(`/field-reports/${slug}`)}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
        {
          "@type": "ListItem",
          position: 2,
          name: t.resourcesPage.h1,
          item: `${BASE}${p("/resources")}`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: f.h1,
          item: `${BASE}${p("/field-reports")}`,
        },
        { "@type": "ListItem", position: 4, name: title, item: `${BASE}${p(`/field-reports/${slug}`)}` },
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-gray-500">
        <Link href={p("/")} className="hover:underline">
          Home
        </Link>
        {" / "}
        <Link href={p("/resources")} className="hover:underline">
          {t.resourcesPage.h1}
        </Link>
        {" / "}
        <Link href={p("/field-reports")} className="hover:underline">
          {f.h1}
        </Link>
        {" / "}
        {title}
      </nav>

      <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
        {f.serviceLabels[r.service]}
      </span>
      <h1 className="text-3xl font-bold mt-1">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">
        {f.updatedLabel} {r.updated}
      </p>

      {/* 诚实披露：脱敏方法示例，不是对具体工厂的报告 */}
      <div className="mt-4 rounded-lg border border-[#d4232a]/30 bg-[#d4232a]/5 p-4 text-sm text-[#7f1d1d]">
        {disclosure}
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{sec.context}</h2>
        <p className="mt-2 text-gray-700">{x.context}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{sec.assignment}</h2>
        <p className="mt-2 text-gray-700">{x.assignment}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{sec.observations}</h2>
        <ul className="mt-3 space-y-3">
          {x.observations.map((o) => (
            <li key={o} className="card p-4 text-gray-700">
              · {o}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{sec.outcome}</h2>
        <p className="mt-2 text-gray-700">{x.outcome}</p>
      </section>

      <section className="mt-8 rounded-lg bg-[#f1f5f9] p-5">
        <h2 className="text-lg font-semibold">{sec.takeaway}</h2>
        <p className="mt-2 text-gray-700">{x.takeaway}</p>
      </section>

      {relatedGuides.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">{sec.relatedGuides}</h2>
          <ul className="mt-2 space-y-1">
            {relatedGuides.map((g) => (
              <li key={g.slug}>
                <Link href={p(`/guides/${g.slug}`)} className="text-[#0f4c81] hover:underline">
                  {zh ? g.titleZh : g.titleEn}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.tools.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{sec.relatedTools}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {toolLinks.map((tool) => (
              <li key={tool.href}>
                <Link href={p(tool.href)} className="btn btn-outline">
                  {tool.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 card p-6 bg-[#0f4c81]">
        <h2 className="text-lg font-semibold text-white">{f.ctaTitle}</h2>
        <p className="mt-1 text-sm text-white/80">{f.ctaLead}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={p("/rfq")} className="btn btn-accent">
            {f.ctaPrimary}
          </Link>
          {serviceLinks.map((s) => (
            <Link
              key={s.href}
              href={p(s.href)}
              className="btn btn-outline border-white text-white"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
