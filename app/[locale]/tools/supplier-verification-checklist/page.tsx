import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import SupplierVerificationChecklist, {
  type ChecklistStage,
} from "@/components/tools/SupplierVerificationChecklist";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";

const PATH = "/tools/supplier-verification-checklist";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const title = `${t.checklist.page.metaTitle} | FactoryAuditB2B`;
  return {
    title,
    description: t.checklist.page.metaDesc,
    alternates: { canonical: canonicalFor(locale, PATH), languages: hreflangFor(PATH) },
    openGraph: { title, description: t.checklist.page.metaDesc, type: "website", url: canonicalFor(locale, PATH) },
  };
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: t.checklist.page.metaTitle,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      url: canonicalFor(locale, PATH),
      inLanguage: locale,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: t.checklist.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  const cards = [
    [t.checklist.page.card1Title, t.checklist.page.card1Body],
    [t.checklist.page.card2Title, t.checklist.page.card2Body],
    [t.checklist.page.card3Title, t.checklist.page.card3Body],
  ];

  const related = [
    [t.toolCards.riskCalculator.title, "/tools/supplier-risk-calculator", t.toolCards.riskCalculator.desc],
    [t.toolCards.documentChecker.title, "/tools/supplier-document-checker", t.toolCards.documentChecker.desc],
    [t.toolCards.auditChecklist.title, "/tools/audit-checklist", t.toolCards.auditChecklist.desc],
  ];

  return (
    <main className="container py-10">
      <JsonLd data={jsonLd} />

      <section className="text-center max-w-3xl mx-auto mb-10">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {t.common.freeTool}
        </span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{t.checklist.page.h1}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{t.checklist.page.lead}</p>
      </section>

      <section className="grid md:grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
        {cards.map(([title, body]) => (
          <div key={title} className="card p-4">
            <div className="font-semibold text-[#0f172a]">{title}</div>
            <p className="text-sm text-[#64748b] mt-1">{body}</p>
          </div>
        ))}
      </section>

      <SupplierVerificationChecklist
        stages={t.checklist.stages as unknown as ChecklistStage[]}
        criticalItems={t.checklist.criticalItems}
        ui={t.checklist.ui}
        locale={locale}
      />

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-4">{t.common.relatedTools}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {related.map(([title, href, desc]) => (
            <a key={href} href={p(href)} className="card p-5 hover:border-[#0f4c81] transition">
              <div className="font-semibold text-[#0f172a]">{title}</div>
              <p className="text-sm text-[#64748b] mt-1">{desc}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-14 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-4">{t.common.faq}</h2>
        <div className="space-y-4">
          {t.checklist.faq.map((f) => (
            <div key={f.q} className="card p-5">
              <div className="font-semibold text-[#0f172a]">{f.q}</div>
              <p className="text-sm text-[#475569] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-[#94a3b8] mt-12 max-w-3xl mx-auto text-center">
        {t.common.disclaimer}
      </p>
    </main>
  );
}
