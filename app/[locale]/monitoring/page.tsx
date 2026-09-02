import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/monitoring";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.monitoring.metaTitle,
    description: t.monitoring.metaDesc,
  });
}

export default async function MonitoringPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const m = t.monitoring;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: m.h1,
      serviceType: "Supplier monitoring",
      areaServed: ["China", "Vietnam", "Thailand", "Malaysia", "Philippines"],
      description: m.metaDesc,
      provider: { "@type": "Organization", name: "FactoryAuditB2B", url: BASE },
      url: `${BASE}${p(PATH)}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.common.ui.home, item: `${BASE}${p("/")}` },
        {
          "@type": "ListItem",
          position: 2,
          name: t.servicesIndex.badge,
          item: `${BASE}${p("/services")}`,
        },
        { "@type": "ListItem", position: 3, name: m.h1, item: `${BASE}${p(PATH)}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: m.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <main className="container py-12 max-w-4xl">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-[#64748b]">
        <Link href={p("/")} className="hover:underline">
          {t.common.ui.home}
        </Link>
        {" / "}
        <Link href={p("/services")} className="hover:underline">
          {t.servicesIndex.badge}
        </Link>
        {" / "}
        {m.h1}
      </nav>

      <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
        {m.badge}
      </span>
      <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{m.h1}</h1>
      <p className="text-[#64748b] mt-3 text-lg">{m.lead}</p>

      {/* Quick answer */}
      <section className="mt-8 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-bold text-[#0f172a]">{m.quickAnswerTitle}</h2>
        <p className="text-[#475569] mt-2">{m.quickAnswer}</p>
        <p className="text-xs text-[#64748b] mt-3">{m.honestNote}</p>
      </section>

      {/* What we re-check */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.recheckTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{m.recheckLead}</p>
        <ul className="grid md:grid-cols-2 gap-2">
          {m.recheckItems.map((x) => (
            <li key={x} className="card p-3 text-[#475569]">
              ✓ {x}
            </li>
          ))}
        </ul>
      </section>

      {/* Cadence */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.cadenceTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{m.cadenceLead}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {m.cadenceItems.map((c) => (
            <div key={c.name} className="card p-5">
              <h3 className="font-bold text-[#0f172a]">{c.name}</h3>
              <p className="text-sm font-medium text-[#0f4c81] mt-1">{c.when}</p>
              <p className="text-sm text-[#475569] mt-2">{c.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Alerts */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.alertTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{m.alertLead}</p>
        <ul className="space-y-2">
          {m.alertItems.map((x) => (
            <li key={x} className="card p-4 text-[#475569]">
              · {x}
            </li>
          ))}
        </ul>
      </section>

      {/* What you receive */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.deliverTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{m.deliverLead}</p>
        <ul className="grid md:grid-cols-2 gap-2">
          {m.deliverItems.map((x) => (
            <li key={x} className="card p-3 text-[#475569]">
              ✓ {x}
            </li>
          ))}
        </ul>
      </section>

      {/* Not covered —— 复用核验清单的同一份文案（字典 verification.notCovered），不另写一份 */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.notCoveredTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-4">{m.notCoveredLead}</p>
        <ul className="space-y-1 text-sm text-[#475569]">
          {t.verification.notCovered.map((x) => (
            <li key={x}>✕ {x}</li>
          ))}
        </ul>
      </section>

      {/* Pricing */}
      <section className="mt-12 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-bold text-[#0f172a]">{m.pricingTitle}</h2>
        <p className="text-[#475569] mt-2">{m.pricingLead}</p>
        <p className="text-sm text-[#64748b] mt-2">{m.pricingNote}</p>
        <Link href={p("/custom-services")} className="btn btn-primary mt-5 inline-block">
          {m.pricingCta}
        </Link>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.faqTitle}</h2>
        <div className="mt-3 space-y-4">
          {m.faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-[#0f172a]">{f.q}</h3>
              <p className="text-[#475569] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 card p-8 bg-[#0f4c81]">
        <h2 className="text-xl font-bold text-white">{m.ctaTitle}</h2>
        <p className="mt-2 text-white/80">{m.ctaLead}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={p("/custom-services")} className="btn btn-accent">
            {m.ctaPrimary}
          </Link>
          <Link href={p("/pricing")} className="btn btn-outline">
            {m.ctaSecondary}
          </Link>
        </div>
      </section>

      {/* Cross-links */}
      <section className="mt-10 flex flex-wrap gap-3">
        <Link href={p("/services/supplier-verification")} className="btn btn-outline">
          {t.servicesIndex.items.verification.title}
        </Link>
        <Link href={p("/factory-audit/request")} className="btn btn-outline">
          {t.auditRequest.h1}
        </Link>
        <Link href={p("/methodology")} className="btn btn-outline">
          {t.methodology.h1}
        </Link>
      </section>
    </main>
  );
}
