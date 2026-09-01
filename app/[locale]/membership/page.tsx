import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import {
  MEMBERSHIP_PRICE_USD,
  MEMBERSHIP_PERIOD,
  FREE_PROFILE_LIMIT,
  ANALYTICS_EVENTS,
} from "@/lib/suppliers";

const PATH = "/membership";
const BASE = "https://factoryauditb2b.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.membership.metaTitle,
    description: t.membership.metaDesc,
  });
}

export default async function MembershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const m = t.membership;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: m.h1,
    url: `${BASE}${p(PATH)}`,
    description: m.metaDesc,
    provider: { "@type": "Organization", name: "FactoryAuditB2B", url: BASE },
    offers: {
      "@type": "Offer",
      price: String(MEMBERSHIP_PRICE_USD),
      priceCurrency: "USD",
    },
  };

  return (
    <main
      className="container py-12 max-w-4xl"
      data-track-page={ANALYTICS_EVENTS.membershipView}
    >
      <JsonLd data={jsonLd} />

      <section className="mb-8 text-center">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {m.badge}
        </span>
        <h1 className="text-3xl font-bold text-[#0f172a] mt-2">{m.h1}</h1>
        <p className="text-[#64748b] mt-2 max-w-2xl mx-auto">{m.lead}</p>
      </section>

      {/* 价格卡 */}
      <section className="max-w-lg mx-auto mb-10">
        <div className="card p-8 text-center bg-gradient-to-br from-[#0f4c81] to-[#163a5f] text-white">
          <div className="text-sm uppercase tracking-wide text-[#b9cfe6]">{m.planName}</div>
          <div className="mt-3 flex items-baseline justify-center gap-1">
            <span className="text-5xl font-extrabold">${MEMBERSHIP_PRICE_USD}</span>
            <span className="text-[#b9cfe6]">/{m.pricePeriod}</span>
          </div>
          <p className="mt-2 text-sm text-[#b9cfe6]">{m.priceNote}</p>
          <Link
            href={p("/custom-services")}
            className="mt-6 block w-full bg-white text-[#0f4c81] font-semibold rounded-lg py-3 hover:bg-[#e6eef6] transition"
            data-track={ANALYTICS_EVENTS.membershipCta}
          >
            {m.cta}
          </Link>
          <p className="mt-3 text-xs text-[#b9cfe6]">{m.paymentNote}</p>
        </div>
      </section>

      {/* 权益 */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-3">{m.benefitsTitle}</h2>
        <p className="text-sm text-[#64748b] mb-4">{m.benefitsLead}</p>
        <div className="grid md:grid-cols-2 gap-4">
          {m.benefits.map((b: string) => (
            <div key={b} className="card p-4 flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#e6eef6] text-[#0f4c81] text-xs flex items-center justify-center font-bold">
                ✓
              </span>
              <span className="text-sm text-[#475569]">{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 免费路径提示 */}
      <section className="card p-6 mb-10 bg-[#f7f9fc]">
        <h2 className="font-semibold text-[#0f172a]">{m.freeTitle}</h2>
        <p className="text-sm text-[#475569] mt-1">
          {m.freeLead.replace("{n}", String(FREE_PROFILE_LIMIT))}
        </p>
        <Link href={p("/register")} className="btn btn-outline mt-4 inline-block">
          {m.freeCta}
        </Link>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold text-[#0f172a] mb-3">{m.faqTitle}</h2>
        <div className="space-y-3">
          {m.faq.map((f: { q: string; a: string }) => (
            <details key={f.q} className="card p-4">
              <summary className="font-semibold text-[#0f172a] cursor-pointer">{f.q}</summary>
              <p className="text-sm text-[#475569] mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
