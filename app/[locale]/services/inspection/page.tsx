import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import InspectionRequestForm from "@/components/InspectionRequestForm";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/services/inspection";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.inspection.metaTitle,
    description: t.inspection.metaDesc,
  });
}

export default async function InspectionPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const i = t.inspection;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: i.h1,
      serviceType: "Product inspection",
      areaServed: ["China", "Vietnam", "Thailand", "Malaysia", "Philippines"],
      description: i.metaDesc,
      provider: { "@type": "Organization", name: "FactoryAuditB2B", url: BASE },
      url: `${BASE}${p(PATH)}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
        {
          "@type": "ListItem",
          position: 2,
          name: t.servicesIndex.badge,
          item: `${BASE}${p("/services")}`,
        },
        { "@type": "ListItem", position: 3, name: i.h1, item: `${BASE}${p(PATH)}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: i.faq.map((f) => ({
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
        <Link href={p("/")} className="hover:underline">Home</Link>
        {" / "}
        <Link href={p("/services")} className="hover:underline">{t.servicesIndex.badge}</Link>
        {" / "}{i.h1}
      </nav>

      <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
        {i.badge}
      </span>
      <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{i.h1}</h1>
      <p className="text-[#64748b] mt-3 text-lg">{i.lead}</p>

      {/* Quick answer */}
      <section className="mt-8 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-bold text-[#0f172a]">{i.quickAnswerTitle}</h2>
        <p className="text-[#475569] mt-2">{i.quickAnswer}</p>
        <p className="text-xs text-[#64748b] mt-3">{i.honestNote}</p>
      </section>

      {/* 4 nodes */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{i.nodesTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{i.nodesLead}</p>
        <div className="grid md:grid-cols-2 gap-5">
          {i.nodes.map((n) => (
            <div key={n.key} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="rounded bg-[#0f4c81] px-2 py-1 text-xs font-bold text-white">
                  {n.key}
                </span>
                <h3 className="font-bold text-[#0f172a]">{n.name}</h3>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="font-semibold text-[#0f4c81]">{i.when}</dt>
                  <dd className="text-[#475569] mt-0.5">{n.when}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#0f4c81]">{i.what}</dt>
                  <dd className="text-[#475569] mt-0.5">{n.what}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#0f4c81]">{i.why}</dt>
                  <dd className="text-[#475569] mt-0.5">{n.why}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{i.howTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{i.howLead}</p>
        <ol className="grid md:grid-cols-4 gap-4">
          {i.how.map((s, idx) => (
            <li key={s.title} className="card p-5">
              <div className="w-8 h-8 rounded-full bg-[#0f4c81] text-white grid place-items-center font-bold text-sm">
                {idx + 1}
              </div>
              <h3 className="font-semibold text-[#0f172a] mt-3">{s.title}</h3>
              <p className="text-sm text-[#475569] mt-1">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Report */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{i.reportTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-4">{i.reportLead}</p>
        <ul className="grid md:grid-cols-2 gap-2">
          {i.report.map((r) => (
            <li key={r} className="card p-3 text-[#475569]">
              ✓ {r}
            </li>
          ))}
        </ul>
      </section>

      {/* Pricing */}
      <section className="mt-12 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-bold text-[#0f172a]">{i.pricingTitle}</h2>
        <p className="text-[#475569] mt-2">{i.pricingLead}</p>
        <p className="text-sm text-[#64748b] mt-2">{i.pricingNote}</p>
      </section>

      {/* Request form */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{i.ctaTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{i.ctaLead}</p>
        <InspectionRequestForm t={i.form} />
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{i.faqTitle}</h2>
        <div className="mt-3 space-y-4">
          {i.faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-[#0f172a]">{f.q}</h3>
              <p className="text-[#475569] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cross-links */}
      <section className="mt-12 flex flex-wrap gap-3">
        <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-outline">
          {i.ctaSecondary}
        </Link>
        <Link href={p("/factory-audit/request")} className="btn btn-outline">
          {t.auditRequest.h1}
        </Link>
        <Link href={p("/services/supplier-verification")} className="btn btn-outline">
          {t.servicesIndex.items.verification.title}
        </Link>
      </section>
    </main>
  );
}
