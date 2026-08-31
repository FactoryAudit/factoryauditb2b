import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import RfqForm from "@/components/RfqForm";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";

const PATH = "/rfq";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const title = `${t.rfq.metaTitle} | FactoryAuditB2B`;
  return {
    title,
    description: t.rfq.metaDesc,
    alternates: { canonical: canonicalFor(locale, PATH), languages: hreflangFor(PATH) },
    openGraph: { title, description: t.rfq.metaDesc, type: "website", url: canonicalFor(locale, PATH) },
  };
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
        { "@type": "ListItem", position: 1, name: "Home", item: `https://factoryauditb2b.com${p("/")}` },
        { "@type": "ListItem", position: 2, name: s.h1, item: canonicalFor(locale, PATH) },
      ],
    },
  ];

  return (
    <main className="container py-10">
      <JsonLd data={jsonLd} />
      <section className="max-w-3xl mx-auto text-center mb-10">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">{s.badge}</span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{s.h1}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{s.lead}</p>
      </section>
      <section className="max-w-3xl mx-auto">
        <RfqForm t={s.form} />
      </section>
    </main>
  );
}
