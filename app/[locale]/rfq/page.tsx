import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import RfqForm from "@/components/RfqForm";
import RfqEnterTracker from "@/components/RfqEnterTracker";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { canonicalFor } from "@/i18n/hreflang";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/rfq";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.rfq.metaTitle,
    description: t.rfq.metaDesc,
  });
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.rfq;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: s.h1,
      serviceType: "Request for quotation and supplier matching",
      provider: { "@type": "Organization", name: "FactoryAuditB2B", url: "https://factoryauditb2b.com" },
      areaServed: "Worldwide",
      description: s.metaDesc,
      url: canonicalFor(locale, PATH),
      inLanguage: locale,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.common.ui.home, item: `https://factoryauditb2b.com${p("/")}` },
        { "@type": "ListItem", position: 2, name: s.h1, item: canonicalFor(locale, PATH) },
      ],
    },
  ];

  return (
    <main className="container py-10" data-track-page="rfq">
      {/* P2（STEP 08）：进入 /rfq 时发一次独立业务事件 rfq_enter */}
      <RfqEnterTracker locale={locale} />
      <JsonLd data={jsonLd} />
      <section className="max-w-3xl mx-auto text-center mb-10">
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">{s.badge}</span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2">{s.h1}</h1>
        <p className="text-[#6d6b66] mt-3 text-lg">{s.lead}</p>
      </section>
      <section className="max-w-3xl mx-auto">
        {/* CS-02C G3：带上提交语言落 rfqs.locale；行业上下文由 CS-02A 的
            /industry/* CTA 通过 ?src= 与页面注入补齐 */}
        <RfqForm t={s.form} context={{ locale }} />
      </section>
    </main>
  );
}
