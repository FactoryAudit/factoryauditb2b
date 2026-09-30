import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { GUIDES, findGuide } from "@/lib/guides";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhCopy, pickZhPair } from "@/lib/tw";
import { pickGuideDesc } from "@/lib/pickGuideDesc";

const BASE = "https://factoryauditb2b.com";
type Params = { locale: string; slug: string };

export async function generateStaticParams() {
  return LOCALES.flatMap((locale) => GUIDES.map((g) => ({ locale, slug: g.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const g = findGuide(slug);
  if (!g) {
    return buildPageMetadata({
      locale,
      path: `/guides/${slug}`,
      title: "Guide",
      description: "Guide.",
      robots: { index: false },
    });
  }
  return buildPageMetadata({
    locale,
    path: `/guides/${slug}`,
    // metaTitle 存在时优先（仅收窄 <title>；H1 与 Article.headline 仍用完整 titleEn/titleZh）
    title: pickZhPair(locale, g.metaTitleEn ?? g.titleEn, g.metaTitleZh ?? g.titleZh),
    description: pickGuideDesc(locale, g),
  });
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const g = findGuide(slug);
  if (!g) notFound();

  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);
  const c = pickZhCopy(locale, g);
  const title = pickZhPair(locale, g.titleEn, g.titleZh);

  const relatedGuides = g.related
    .map((s) => findGuide(s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description: pickGuideDesc(locale, g),
      dateModified: g.updated,
      inLanguage: locale,
      url: `${BASE}${p(`/guides/${slug}`)}`,
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
          name: t.resourcesIndex.h1,
          item: `${BASE}${p("/resources")}`,
        },
        { "@type": "ListItem", position: 3, name: title, item: `${BASE}${p(`/guides/${slug}`)}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: c.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <article className="container py-12 max-w-3xl">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-[#6d6b66]">
        <Link href={p("/")} className="hover:underline">{t.common.ui.home}</Link>
        {" / "}
        <Link href={p("/resources")} className="hover:underline">{t.resourcesIndex.h1}</Link>
        {" / "}{title}
      </nav>

      <h1 className="text-4xl font-extrabold text-[#171717]">{title}</h1>
      <p className="text-sm text-[#6d6b66] mt-2">{t.supplierProfile.lastUpdated}: {g.updated}</p>

      {/* Quick Answer：AI Search 与 Google 摘要优先抓取这一段 */}
      <section className="mt-6 rounded-lg bg-[#f5f3ee] p-6">
        <h2 className="font-bold text-[#171717]">{t.common.ui.quickAnswer}</h2>
        <p className="text-[#3f4650] mt-2">{c.quickAnswer}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{t.common.ui.definition}</h2>
        <p className="text-[#3f4650] mt-2">{c.definition}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{t.common.ui.keyPoints}</h2>
        <ul className="mt-3 space-y-2 text-[#3f4650]">
          {c.keyPoints.map((x) => (
            <li key={x}>· {x}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{t.common.ui.stepByStep}</h2>
        <ol className="mt-3 space-y-3">
          {c.steps.map((s, i) => (
            <li key={s.title} className="card p-4">
              <div className="font-semibold text-[#171717]">
                {i + 1}. {s.title}
              </div>
              <p className="text-sm text-[#3f4650] mt-1">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{t.common.ui.examples}</h2>
        <div className="mt-3 space-y-3">
          {c.examples.map((x) => (
            <div key={x.title} className="card p-4">
              <div className="font-semibold text-[#171717]">{x.title}</div>
              <p className="text-sm text-[#3f4650] mt-1">{x.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 结构化表格：对比 / 清单 / 时间线 / 风险矩阵。
          服务端直出真实 <table>，不做图片、不藏进 JS tab —— AI Search 与精选摘要可直接抽取。 */}
      {Array.isArray(c.tables) && c.tables.length > 0 && (
        <>
          {c.tables.map((tb) => (
            <section key={tb.title} className="mt-8">
              <h2 className="text-2xl font-bold text-[#171717]">{tb.title}</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#f5f3ee]">
                      {tb.headers.map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="border border-[#ddd9d0] px-3 py-2 text-left font-semibold text-[#171717]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tb.rows.map((row, i) => (
                      <tr key={`${tb.title}-row-${i}`}>
                        {row.map((cell, j) => (
                          <td
                            key={`${tb.title}-cell-${i}-${j}`}
                            className="border border-[#ddd9d0] px-3 py-2 align-top text-[#3f4650]"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{t.common.ui.checklist}</h2>
        <ul className="mt-3 space-y-1 text-[#3f4650]">
          {c.checklist.map((x) => (
            <li key={x}>☐ {x}</li>
          ))}
        </ul>
      </section>

      {/* Tool / Service：每篇指南至少链 1 个工具 + 1 个服务（PRD §46） */}
      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="font-bold text-[#171717]">{t.toolsIndex.badge}</h2>
          <ul className="mt-3 space-y-2">
            {g.tools.map((x) => {
              const key =
                x.href === "/tools/supplier-risk-calculator"
                  ? "riskCalculator"
                  : x.href === "/tools/supplier-verification-checklist"
                    ? "verificationChecklist"
                    : x.href === "/tools/audit-checklist"
                      ? "auditChecklist"
                      : x.href === "/tools/supplier-scorecard"
                        ? "supplierScorecard"
                        : x.href === "/tools/supplier-document-checker"
                          ? "documentChecker"
                          : "auditReportAnalyzer";
              return (
                <li key={x.href}>
                  <Link href={p(x.href)} className="text-[#171717] hover:underline">
                    {t.toolCards[key].title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="font-bold text-[#171717]">{t.servicesIndex.badge}</h2>
          <ul className="mt-3 space-y-2">
            {g.services.map((x) => (
              <li key={x.href}>
                <Link href={p(x.href)} className="text-[#171717] hover:underline">
                  {x.href.includes("factory-audit")
                    ? t.servicesIndex.items.factoryAudit.title
                    : t.servicesIndex.items.verification.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href={p("/factory-audit/request")} className="text-[#171717] hover:underline">
                {t.servicesIndex.items.factoryAudit.title}
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{t.countryHub.faqTitle}</h2>
        <div className="mt-3 space-y-4">
          {c.faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-[#171717]">{f.q}</h3>
              <p className="text-[#3f4650] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{t.common.ui.sources}</h2>
        <ul className="mt-3 space-y-2 text-sm text-[#3f4650]">
          {c.sources.map((s) => (
            <li key={s.name}>
              <span className="font-medium text-[#171717]">{s.name}</span>
              <span className="block text-[#6d6b66]">{s.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <Link href={p("/methodology")} className="text-[#171717] underline">
            {t.reportPreview.methodologyTitle}
          </Link>
        </p>
      </section>

      {relatedGuides.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-bold text-[#171717]">{t.common.ui.relatedGuides}</h2>
          <ul className="mt-3 space-y-2">
            {relatedGuides.map((x) => (
              <li key={x.slug}>
                <Link href={p(`/guides/${x.slug}`)} className="text-[#171717] hover:underline">
                  {pickZhPair(locale, x.titleEn, x.titleZh)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 card p-8 bg-[#171717]">
        <h2 className="text-2xl font-bold text-white">{t.home.bottomTitle}</h2>
        <p className="mt-2 text-white/80">{t.home.bottomLead}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={p("/services/supplier-verification")} className="btn btn-accent">
            {t.home.bottomCta}
          </Link>
          <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-outline-dark">
            {t.methodology.ctaSecondary}
          </Link>
        </div>
      </section>
    </article>
  );
}
