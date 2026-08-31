import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";

const PATH = "/services/supplier-verification";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const title = `${t.serviceVerification.metaTitle} | FactoryAuditB2B`;
  return {
    title,
    description: t.serviceVerification.metaDesc,
    alternates: { canonical: canonicalFor(locale, PATH), languages: hreflangFor(PATH) },
    openGraph: {
      title,
      description: t.serviceVerification.metaDesc,
      type: "website",
      url: canonicalFor(locale, PATH),
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.serviceVerification;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: s.h1,
      serviceType: "Supplier and factory verification",
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
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: s.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  const checks = [s.checks.legal, s.checks.site, s.checks.type, s.checks.capability, s.checks.quality, s.checks.track];

  return (
    <main className="container py-10">
      <JsonLd data={jsonLd} />

      <section className="max-w-3xl mx-auto text-center mb-12">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">{s.badge}</span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{s.h1}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{s.lead}</p>
        <div className="mt-6 flex gap-3 flex-wrap justify-center">
          <Link href={p("/factory-audit/request")} className="btn btn-primary">
            {s.ctaPrimary}
          </Link>
          <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-outline">
            {s.ctaSecondary}
          </Link>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-1">{s.checksTitle}</h2>
        <p className="text-[#64748b] mb-6">{s.checksLead}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {checks.map((c) => (
            <div key={c.title} className="card p-5">
              <div className="font-semibold text-[#0f4c81] mb-2">{c.title}</div>
              <p className="text-sm text-[#475569]">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-1">{s.stepsTitle}</h2>
        <p className="text-[#64748b] mb-6">{s.stepsLead}</p>
        <div className="grid md:grid-cols-4 gap-5">
          {s.steps.map((step, i) => (
            <div key={step.title} className="card p-5">
              <div className="w-8 h-8 rounded-full bg-[#0f4c81] text-white grid place-items-center font-bold mb-3">
                {i + 1}
              </div>
              <div className="font-semibold text-[#0f172a] mb-1">{step.title}</div>
              <p className="text-sm text-[#64748b]">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-1">{s.deliverablesTitle}</h2>
        <div className="card p-6 mt-4">
          <ul className="grid md:grid-cols-2 gap-3 text-sm text-[#475569]">
            {s.deliverables.map((x) => (
              <li key={x} className="flex gap-2">
                <span className="text-[#0f4c81] font-bold">✓</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-3xl mx-auto mb-14">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-4">{s.faqTitle}</h2>
        <div className="space-y-4">
          {s.faq.map((f) => (
            <div key={f.q} className="card p-5">
              <div className="font-semibold text-[#0f172a]">{f.q}</div>
              <p className="text-sm text-[#475569] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-8 text-center bg-[#f7f9fc]">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.bottomTitle}</h2>
        <p className="text-[#64748b] mt-2 max-w-2xl mx-auto">{s.bottomLead}</p>
        <div className="mt-6 flex gap-3 flex-wrap justify-center">
          <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-primary">
            {s.bottomPrimary}
          </Link>
          <Link href={p("/factory-audit/request")} className="btn btn-accent">
            {s.bottomSecondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
