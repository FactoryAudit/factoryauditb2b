import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { SERVICE_MENU } from "@/lib/nav";
import { SERVICE_EVENT_BY_KEY } from "@/lib/analytics";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/services";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.servicesIndex.metaTitle,
    description: t.servicesIndex.metaDesc,
  });
}

export default async function ServicesPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.servicesIndex;
  const p = (href: string) => localePath(locale, href);

  // 核心 4 服务（Verification / Audit / Inspection / Sourcing）。
  // Monitoring / Improvement 仍在 Header 下拉与 Footer 保留入口，不在主卡区展示。
  const services = SERVICE_MENU.slice(0, 4).map((item) => ({
    key: item.key,
    title: s.items[item.key].title,
    desc: s.items[item.key].desc,
    href: item.href,
  }));

  const processSteps = [
    { title: s.stepRequestTitle, body: s.stepRequestBody },
    { title: s.stepScopingTitle, body: s.stepScopingBody },
    { title: s.stepOnsiteTitle, body: s.stepOnsiteBody },
    { title: s.stepReportTitle, body: s.stepReportBody },
    { title: s.stepDecisionTitle, body: s.stepDecisionBody },
  ];

  const faqs = [
    { q: s.faq1q, a: s.faq1a },
    { q: s.faq2q, a: s.faq2a },
    { q: s.faq3q, a: s.faq3a },
    { q: s.faq4q, a: s.faq4a },
    { q: s.faq5q, a: s.faq5a },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: s.metaTitle,
      url: `${BASE}${p(PATH)}`,
      itemListElement: services.map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: x.title,
        url: `${BASE}${p(x.href)}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <main className="pb-20">
      <JsonLd data={jsonLd} />

      {/* Services Hero */}
      <section className="container py-16 max-w-3xl">
        <span className="inline-block text-xs font-semibold tracking-wide uppercase text-[#e94560] mb-5">
          {s.badge}
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold text-[#111111] leading-tight">{s.h1}</h1>
        <p className="text-[#6b7280] mt-4 text-lg leading-relaxed">{s.lead}</p>
        <div className="mt-7 flex gap-3 flex-wrap">
          <Link href={p("/rfq")} className="btn btn-primary">
            {t.nav.postRfq}
          </Link>
          <Link href={p("/custom-services")} className="btn btn-accent">
            {s.notSureCta}
          </Link>
        </div>
      </section>

      {/* 4 服务卡 */}
      <section className="container pb-16">
        <div className="grid md:grid-cols-2 gap-5">
          {services.map((x, i) => (
            <div key={x.key} className="card p-8 flex flex-col">
              <div className="text-xs font-bold tracking-wide text-[#e94560] mb-4">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="text-xl font-bold text-[#111111]">{x.title}</h3>
              <p className="text-sm text-[#6b7280] mt-3 flex-1 leading-relaxed">{x.desc}</p>
              <Link
                href={p(x.href)}
                className="mt-6 text-[#e94560] font-semibold text-sm hover:underline self-start"
                data-track={SERVICE_EVENT_BY_KEY[x.key]}
              >
                {x.title} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 5 步流程 */}
      <section className="bg-[#f7f7f8] border-y border-[#e8e8e8]">
        <div className="container py-16">
          <div className="max-w-2xl mb-10">
            <span className="inline-block text-xs font-semibold tracking-wide uppercase text-[#e94560] mb-5">
              {s.processLead}
            </span>
            <h2 className="text-3xl font-bold text-[#111111]">{s.processTitle}</h2>
          </div>
          <div className="grid md:grid-cols-5 gap-0">
            {processSteps.map((step, i) => (
              <div key={step.title} className="px-6 py-2 md:border-l border-[#e8e8e8] first:border-l-0 first:pl-0">
                <div className="text-xs font-bold tracking-wide text-[#e94560] mb-3">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h4 className="font-bold text-[#111111] mb-2">{step.title}</h4>
                <p className="text-sm text-[#6b7280] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container py-16 max-w-3xl">
        <div className="mb-8">
          <span className="inline-block text-xs font-semibold tracking-wide uppercase text-[#e94560] mb-5">
            {s.faqLead}
          </span>
          <h2 className="text-3xl font-bold text-[#111111]">{s.faqTitle}</h2>
        </div>
        <div>
          {faqs.map((f, i) => (
            <details key={f.q} className="border-b border-[#e8e8e8] py-5" open={i === 0}>
              <summary className="font-semibold text-[#111111] text-base cursor-pointer list-none flex justify-between items-center gap-6">
                {f.q}
                <span aria-hidden="true" className="text-[#6b7280] text-xl">+</span>
              </summary>
              <p className="text-[#6b7280] text-sm mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t border-[#e8e8e8] bg-[#f7f7f8]">
        <div className="container py-20 text-center">
          <h2 className="text-3xl font-extrabold text-[#111111]">{t.home.bottomTitle}</h2>
          <p className="text-[#6b7280] text-lg mt-4 max-w-xl mx-auto">{t.home.bottomLead}</p>
          <div className="mt-8 flex gap-3 justify-center flex-wrap">
            <Link href={p("/rfq")} className="btn btn-primary">
              {t.nav.postRfq}
            </Link>
            <Link href={p("/custom-services")} className="btn btn-accent">
              {s.notSureCta}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
