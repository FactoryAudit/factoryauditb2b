import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import SupplierRiskCalculator, {
  type RiskUiDict,
} from "@/components/tools/SupplierRiskCalculator";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { canonicalFor } from "@/i18n/hreflang";
import { buildPageMetadata } from "@/lib/pageMeta";
import { TOTAL_QUESTIONS, type RiskContent } from "@/lib/riskEngine";

const PATH = "/tools/supplier-risk-calculator";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  // 走统一收口：desc 由 trimMetaDescription 按书写系统裁剪（此前直出 218 字符）。
  // 标题已含品牌名，收口内的去重逻辑不会重复追加 " | FactoryAuditB2B"。
  return buildPageMetadata({
    locale,
    path: PATH,
    title: `${t.risk.page.metaTitle} | FactoryAuditB2B RiskScore™`,
    description: t.risk.page.metaDesc,
  });
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);

  const content = {
    dimensions: t.risk.dimensions,
    questions: t.risk.questions,
    options: t.risk.options,
    factors: t.risk.factors,
    recommendations: t.risk.recommendations,
    ctas: t.risk.ctas,
    levelLabels: t.risk.ui.level,
  } as unknown as RiskContent;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: t.risk.page.metaTitle,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      url: canonicalFor(locale, PATH),
      inLanguage: locale,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: t.risk.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  const cards = [
    [t.risk.page.card1Title, t.risk.page.card1Body],
    [t.risk.page.card2Title, t.risk.page.card2Body],
    [t.risk.page.card3Title, t.risk.page.card3Body],
  ];

  const related = [
    [t.toolCards.verificationChecklist.title, "/tools/supplier-verification-checklist", t.toolCards.verificationChecklist.desc],
    [t.toolCards.supplierScorecard.title, "/tools/supplier-scorecard", t.toolCards.supplierScorecard.desc],
    [t.toolCards.documentChecker.title, "/tools/supplier-document-checker", t.toolCards.documentChecker.desc],
  ];

  return (
    <main className="container py-10" data-track-page="tool_risk_calculator">
      <JsonLd data={jsonLd} />

      <section className="text-center max-w-3xl mx-auto mb-10">
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">
          {t.common.freeTool}
        </span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2">{t.risk.page.h1}</h1>
        <p className="text-[#6d6b66] mt-3 text-lg">
          {t.risk.page.lead.replace("22", String(TOTAL_QUESTIONS))}
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
        {cards.map(([title, body]) => (
          <div key={title} className="card p-4">
            <div className="font-semibold text-[#171717]">{title}</div>
            <p className="text-sm text-[#6d6b66] mt-1">{body}</p>
          </div>
        ))}
      </section>

      <SupplierRiskCalculator
        content={content}
        ui={t.risk.ui as unknown as RiskUiDict}
        locale={locale}
      />

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-[#171717] mb-4">{t.common.relatedTools}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {related.map(([title, href, desc]) => (
            <a key={href} href={p(href)} className="card p-5 hover:border-[#171717] transition">
              <div className="font-semibold text-[#171717]">{title}</div>
              <p className="text-sm text-[#6d6b66] mt-1">{desc}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-14 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-[#171717] mb-4">{t.common.faq}</h2>
        <div className="space-y-4">
          {t.risk.faq.map((f) => (
            <div key={f.q} className="card p-5">
              <div className="font-semibold text-[#171717]">{f.q}</div>
              <p className="text-sm text-[#3f4650] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-[#8c8982] mt-12 max-w-3xl mx-auto text-center">
        {t.common.disclaimer}
      </p>
    </main>
  );
}
