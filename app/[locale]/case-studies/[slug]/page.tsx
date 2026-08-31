import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { CASE_STUDIES, findCaseStudy, CASE_DISCLOSURE } from "@/lib/caseStudies";
import { findGuide } from "@/lib/guides";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/pageMeta";

const BASE = "https://factoryauditb2b.com";
type Params = { locale: string; slug: string };

export async function generateStaticParams() {
  return LOCALES.flatMap((locale) => CASE_STUDIES.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const c = findCaseStudy(slug);
  if (!c) {
    return buildPageMetadata({
      locale,
      path: `/case-studies/${slug}`,
      title: "Case study",
      description: "Case study.",
      robots: { index: false },
    });
  }
  return buildPageMetadata({
    locale,
    path: `/case-studies/${slug}`,
    title: locale === "zh" ? c.titleZh : c.titleEn,
    description: locale === "zh" ? c.metaDescZh : c.metaDescEn,
  });
}

export default async function CaseStudyPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const c = findCaseStudy(slug);
  if (!c) notFound();

  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh";
  const x = zh ? c.zh : c.en;
  const title = zh ? c.titleZh : c.titleEn;
  const disclosure = zh ? CASE_DISCLOSURE.zh : CASE_DISCLOSURE.en;
  const serviceLabel =
    c.service === "verification"
      ? "Supplier verification"
      : c.service === "audit"
        ? "Factory audit"
        : c.service === "inspection"
          ? "Inspection"
          : "Sourcing";

  const relatedGuides = c.related
    .map((s) => findGuide(s))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description: zh ? c.metaDescZh : c.metaDescEn,
      dateModified: c.updated,
      inLanguage: locale,
      url: `${BASE}${p(`/case-studies/${c.slug}`)}`,
      publisher: { "@id": `${BASE}/#organization` },
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
        { "@type": "ListItem", position: 3, name: title, item: `${BASE}${p(`/case-studies/${c.slug}`)}` },
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-gray-500">
        <Link href={p("/")} className="hover:underline">Home</Link> /{" "}
        <Link href={p("/case-studies")} className="hover:underline">Case studies</Link> / {title}
      </nav>

      <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
        {serviceLabel}
      </span>
      <h1 className="mt-3 text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{zh ? "更新日期" : "Updated"}: {c.updated}</p>

      <div className="mt-4 rounded-lg border border-[#d4232a]/30 bg-[#d4232a]/5 p-4 text-sm text-[#7f1d1d]">
        {disclosure}
      </div>

      <p className="mt-6 text-lg text-gray-700">{x.summary}</p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Scenario</h2>
        <p className="mt-2 text-gray-700">{x.scenario}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">What we did</h2>
        <ol className="mt-3 space-y-3">
          {x.approach.map((step, i) => (
            <li key={i} className="card p-4">
              <span className="font-semibold text-[#0f4c81]">{i + 1}.</span>{" "}
              <span className="text-gray-700">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-semibold text-[#0f172a]">Result</h2>
        <p className="mt-2 text-gray-700">{x.result}</p>
      </section>

      {/* 内链：工具 / 服务 / 相关指南（与指南页同模式，禁止死链） */}
      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-bold text-[#0f172a]">Tools</h2>
          <ul className="mt-3 space-y-2">
            {c.tools.map((t) => {
              const key =
                t.href === "/tools/supplier-risk-calculator"
                  ? "riskCalculator"
                  : t.href === "/tools/supplier-verification-checklist"
                    ? "verificationChecklist"
                    : t.href === "/tools/audit-checklist"
                      ? "auditChecklist"
                      : t.href === "/tools/supplier-scorecard"
                        ? "supplierScorecard"
                        : t.href === "/tools/supplier-document-checker"
                          ? "documentChecker"
                          : "auditReportAnalyzer";
              // 工具名取英文常量，避免引入字典依赖；与 guides 页行为一致
              const toolNames: Record<string, string> = {
                riskCalculator: "Supplier Risk Calculator",
                verificationChecklist: "Supplier Verification Checklist",
                auditChecklist: "Factory Audit Checklist",
                supplierScorecard: "Supplier Scorecard",
                documentChecker: "Supplier Document Checker",
                auditReportAnalyzer: "Audit Report Analyzer",
              };
              return (
                <li key={t.href}>
                  <Link href={p(t.href)} className="text-[#0f4c81] hover:underline">
                    {toolNames[key]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="font-bold text-[#0f172a]">Services</h2>
          <ul className="mt-3 space-y-2">
            {c.services.map((s) => (
              <li key={s.href}>
                <Link href={p(s.href)} className="text-[#0f4c81] hover:underline">
                  {s.href.includes("inspection")
                    ? "Product Inspection"
                    : s.href.includes("rfq")
                      ? "RFQ"
                      : s.href.includes("supplier-verification")
                        ? "Supplier Verification"
                        : "Factory Audit"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {relatedGuides.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Related guides</h2>
          <ul className="mt-3 space-y-2">
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

      <section className="mt-10 card p-8 bg-[#0f4c81]">
        <h2 className="text-xl font-bold text-white">Need this done for your supplier?</h2>
        <p className="mt-2 text-white/80">
          Send your requirement and we will scope the verification, audit or inspection for your
          product and market.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
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
