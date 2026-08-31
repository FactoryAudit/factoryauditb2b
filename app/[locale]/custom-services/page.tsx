import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import CustomServiceForm from "@/components/CustomServiceForm";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";

const PATH = "/custom-services";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const title = `${t.customServices.metaTitle} | FactoryAuditB2B`;
  return {
    title,
    description: t.customServices.metaDesc,
    alternates: { canonical: canonicalFor(locale, PATH), languages: hreflangFor(PATH) },
    openGraph: { title, description: t.customServices.metaDesc, type: "website", url: canonicalFor(locale, PATH) },
  };
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.customServices;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: s.h1,
      serviceType: "Custom factory audit and supplier verification",
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

      <section className="max-w-3xl mx-auto mb-14">
        <CustomServiceForm t={s.form} />
      </section>

      <section className="grid md:grid-cols-3 gap-5 mb-14">
        {s.features.map((f) => (
          <div key={f.title} className="card p-5">
            <div className="font-semibold text-[#0f4c81] mb-2">{f.title}</div>
            <p className="text-sm text-[#475569]">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="card p-8 text-center bg-[#f7f9fc]">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.bottomTitle}</h2>
        <p className="text-[#64748b] mt-2 max-w-2xl mx-auto">{s.bottomLead}</p>
      </section>
    </main>
  );
}
