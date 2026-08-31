import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import ContainerLoadCalculator, {
  type ContainerUiDict,
  type ContainerTypeLabels,
  type ContainerSpecLabels,
} from "@/components/tools/ContainerLoadCalculator";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";

const PATH = "/logistics";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const c = t.container.page;
  const title = `${c.metaTitle} | Free Container Loading Tool | FactoryAuditB2B`;
  return {
    title,
    description: c.metaDesc,
    alternates: { canonical: canonicalFor(locale, PATH), languages: hreflangFor(PATH) },
    openGraph: {
      title,
      description: c.metaDesc,
      type: "website",
      url: canonicalFor(locale, PATH),
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);
  const c = t.container;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: c.page.metaTitle,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: c.page.metaDesc,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      url: canonicalFor(locale, PATH),
      inLanguage: locale,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `https://factoryauditb2b.com${p("/")}` },
        { "@type": "ListItem", position: 2, name: c.page.h1, item: canonicalFor(locale, PATH) },
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

  const howSteps = [c.page.how1, c.page.how2, c.page.how3, c.page.how4];

  const related = [
    [t.toolCards.riskCalculator.title, "/tools/supplier-risk-calculator", t.toolCards.riskCalculator.desc],
    [t.toolCards.verificationChecklist.title, "/tools/supplier-verification-checklist", t.toolCards.verificationChecklist.desc],
    [t.toolCards.rfqGenerator.title, "/rfq", t.toolCards.rfqGenerator.desc],
  ];

  return (
    <main className="container py-10">
      <JsonLd data={jsonLd} />

      <section className="text-center max-w-3xl mx-auto mb-10">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {c.page.badge}
        </span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{c.page.h1}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{c.page.lead}</p>
      </section>

      {/* 直接答案：让搜索引擎与 AI 快速提取本页核心答案 */}
      <section className="max-w-3xl mx-auto mb-10">
        <div className="card p-6 bg-[#f7f9fc] border-l-4 border-[#0f4c81]">
          <h2 className="font-semibold text-[#0f172a] mb-2">{c.page.quickAnswerTitle}</h2>
          <p className="text-[#475569] leading-relaxed">{c.page.quickAnswer}</p>
        </div>
      </section>

      <section aria-labelledby="toolHeading">
        <h2 id="toolHeading" className="sr-only">
          {c.page.h1}
        </h2>
        <ContainerLoadCalculator
          t={c.ui as unknown as ContainerUiDict}
          types={c.types as unknown as ContainerTypeLabels}
          specs={c.specs as unknown as ContainerSpecLabels}
        />
      </section>

      <section className="mt-14 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-4">{c.page.howTitle}</h2>
        <ol className="space-y-3">
          {howSteps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[#0f4c81] text-white grid place-items-center text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-[#475569]">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-1">{c.page.specsTitle}</h2>
        <p className="text-[#64748b] mb-4">{c.page.specsLead}</p>
        <p className="text-sm text-[#475569]">
          {c.specs.internal} · {c.specs.capacity} · {c.specs.payload} · {c.specs.door}
        </p>
      </section>

      <section className="mt-14 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-4">{c.page.methodTitle}</h2>
        <p className="text-[#475569] leading-relaxed">{c.page.methodBody}</p>
      </section>

      <section className="mt-14 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-4">{c.page.faqTitle}</h2>
        <div className="space-y-4">
          {c.faq.map((f) => (
            <div key={f.q} className="card p-5">
              <h3 className="font-semibold text-[#0f172a]">{f.q}</h3>
              <p className="text-sm text-[#475569] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

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

      <p className="text-xs text-[#94a3b8] mt-12 max-w-3xl mx-auto text-center">
        {t.common.disclaimer}
      </p>
    </main>
  );
}
