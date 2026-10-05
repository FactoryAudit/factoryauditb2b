import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { canonicalFor } from "@/i18n/hreflang";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/services/supplier-verification";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  // 走统一收口：desc 由 trimMetaDescription 裁剪（此前直出 211 字符），
  // 并补齐 OG / Twitter / robots 默认值。品牌后缀由收口统一追加。
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.serviceVerification.metaTitle,
    description: t.serviceVerification.metaDesc,
  });
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
      provider: { "@id": "https://factoryauditb2b.com#organization" },
      areaServed: "Worldwide",
      description: s.metaDesc,
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        url: "https://factoryauditb2b.com/rfq",
      },
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
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">{s.badge}</span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2">{s.h1}</h1>
        <p className="text-[#6d6b66] mt-3 text-lg">{s.lead}</p>
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
        <h2 className="text-2xl font-bold text-[#171717] mb-1">{s.checksTitle}</h2>
        <p className="text-[#6d6b66] mb-6">{s.checksLead}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {checks.map((c) => (
            <div key={c.title} className="card p-5">
              <div className="font-semibold text-[#171717] mb-2">{c.title}</div>
              <p className="text-sm text-[#3f4650]">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="text-2xl font-bold text-[#171717] mb-1">{s.stepsTitle}</h2>
        <p className="text-[#6d6b66] mb-6">{s.stepsLead}</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {s.steps.map((step, i) => (
            <div key={step.title} className="card p-5">
              <div className="w-8 h-8 rounded-full bg-[#171717] text-white grid grid-cols-1 place-items-center font-bold mb-3">
                {i + 1}
              </div>
              <div className="font-semibold text-[#171717] mb-1">{step.title}</div>
              <p className="text-sm text-[#6d6b66]">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="text-2xl font-bold text-[#171717] mb-1">{s.deliverablesTitle}</h2>
        <div className="card p-6 mt-4">
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-[#3f4650]">
            {s.deliverables.map((x) => (
              <li key={x} className="flex gap-2">
                <span className="text-[#171717] font-bold">✓</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-3xl mx-auto mb-14">
        <h2 className="text-2xl font-bold text-[#171717] mb-4">{s.faqTitle}</h2>
        <div className="space-y-4">
          {s.faq.map((f) => (
            <div key={f.q} className="card p-5">
              <div className="font-semibold text-[#171717]">{f.q}</div>
              <p className="text-sm text-[#3f4650] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-8 text-center bg-[#fbfaf7]">
        <h2 className="text-2xl font-bold text-[#171717]">{s.bottomTitle}</h2>
        <p className="text-[#6d6b66] mt-2 max-w-2xl mx-auto">{s.bottomLead}</p>
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
