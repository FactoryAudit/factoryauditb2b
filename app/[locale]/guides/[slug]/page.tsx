import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { GUIDES, findGuide } from "@/lib/guides";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

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
    title: locale === "zh" ? g.titleZh : g.titleEn,
    description: locale === "zh" ? g.metaDescZh : g.metaDescEn,
  });
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const g = findGuide(slug);
  if (!g) notFound();

  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh";
  const c = zh ? g.zh : g.en;
  const title = zh ? g.titleZh : g.titleEn;

  const relatedGuides = g.related
    .map((s) => findGuide(s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description: zh ? g.metaDescZh : g.metaDescEn,
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
    <main className="container py-12 max-w-3xl">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-[#64748b]">
        <Link href={p("/")} className="hover:underline">Home</Link>
        {" / "}
        <Link href={p("/resources")} className="hover:underline">{t.resourcesIndex.h1}</Link>
        {" / "}{title}
      </nav>

      <h1 className="text-4xl font-extrabold text-[#0f172a]">{title}</h1>
      <p className="text-sm text-[#64748b] mt-2">{t.supplierProfile.lastUpdated}: {g.updated}</p>

      {/* Quick Answer：AI Search 与 Google 摘要优先抓取这一段 */}
      <section className="mt-6 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-bold text-[#0f172a]">Quick answer</h2>
        <p className="text-[#475569] mt-2">{c.quickAnswer}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">Definition</h2>
        <p className="text-[#475569] mt-2">{c.definition}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">Key points</h2>
        <ul className="mt-3 space-y-2 text-[#475569]">
          {c.keyPoints.map((x) => (
            <li key={x}>· {x}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">Step by step</h2>
        <ol className="mt-3 space-y-3">
          {c.steps.map((s, i) => (
            <li key={s.title} className="card p-4">
              <div className="font-semibold text-[#0f172a]">
                {i + 1}. {s.title}
              </div>
              <p className="text-sm text-[#475569] mt-1">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">Examples</h2>
        <div className="mt-3 space-y-3">
          {c.examples.map((x) => (
            <div key={x.title} className="card p-4">
              <div className="font-semibold text-[#0f172a]">{x.title}</div>
              <p className="text-sm text-[#475569] mt-1">{x.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">Checklist</h2>
        <ul className="mt-3 space-y-1 text-[#475569]">
          {c.checklist.map((x) => (
            <li key={x}>☐ {x}</li>
          ))}
        </ul>
      </section>

      {/* Tool / Service：每篇指南至少链 1 个工具 + 1 个服务（PRD §46） */}
      <section className="mt-8 grid md:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="font-bold text-[#0f172a]">{t.toolsIndex.badge}</h2>
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
                  <Link href={p(x.href)} className="text-[#0f4c81] hover:underline">
                    {t.toolCards[key].title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="font-bold text-[#0f172a]">{t.servicesIndex.badge}</h2>
          <ul className="mt-3 space-y-2">
            {g.services.map((x) => (
              <li key={x.href}>
                <Link href={p(x.href)} className="text-[#0f4c81] hover:underline">
                  {x.href.includes("factory-audit")
                    ? t.servicesIndex.items.factoryAudit.title
                    : t.servicesIndex.items.verification.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href={p("/factory-audit/request")} className="text-[#0f4c81] hover:underline">
                {t.servicesIndex.items.factoryAudit.title}
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{t.countryHub.faqTitle}</h2>
        <div className="mt-3 space-y-4">
          {c.faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-[#0f172a]">{f.q}</h3>
              <p className="text-[#475569] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">Sources</h2>
        <ul className="mt-3 space-y-2 text-sm text-[#475569]">
          {c.sources.map((s) => (
            <li key={s.name}>
              <span className="font-medium text-[#0f172a]">{s.name}</span>
              <span className="block text-[#64748b]">{s.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <Link href={p("/methodology")} className="text-[#0f4c81] underline">
            {t.reportPreview.methodologyTitle}
          </Link>
        </p>
      </section>

      {relatedGuides.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-bold text-[#0f172a]">Related guides</h2>
          <ul className="mt-3 space-y-2">
            {relatedGuides.map((x) => (
              <li key={x.slug}>
                <Link href={p(`/guides/${x.slug}`)} className="text-[#0f4c81] hover:underline">
                  {zh ? x.titleZh : x.titleEn}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 card p-8 bg-[#0f4c81]">
        <h2 className="text-2xl font-bold text-white">{t.home.bottomTitle}</h2>
        <p className="mt-2 text-white/80">{t.home.bottomLead}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={p("/services/supplier-verification")} className="btn btn-accent">
            {t.home.bottomCta}
          </Link>
          <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-outline border-white text-white">
            {t.methodology.ctaSecondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
