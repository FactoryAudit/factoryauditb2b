import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import CheckoutButton from "@/components/CheckoutButton";
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
      data-track-view={ANALYTICS_EVENTS.foundingBuyerView}
    >
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <section className="relative mb-12 text-center overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 -top-16 -z-10 mx-auto h-72 w-[36rem] max-w-full rounded-full bg-[#e6eef6] opacity-70 blur-3xl"
        />
        <span className="inline-flex items-center rounded-full bg-[#e6eef6] px-4 py-1.5 text-sm font-semibold text-[#0f4c81]">
          {m.badge}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#0f172a] md:text-5xl">
          {m.h1}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-[#64748b] md:text-lg">
          {m.lead}
        </p>
      </section>

      {/* 价格对比：免费 vs 会员 */}
      <section className="mb-12 grid gap-6 md:grid-cols-2 md:items-stretch">
        {/* 会员卡（主推，移动端置顶） */}
        <div className="relative order-1 flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f4c81] to-[#163a5f] p-8 text-white shadow-lg md:order-2">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-white/5"
          />
          <span className="self-center rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
            {m.planName}
          </span>
          <div className="mt-5 flex items-baseline justify-center gap-1.5">
            <span className="text-5xl font-extrabold">${MEMBERSHIP_PRICE_USD}</span>
            <span className="text-lg text-[#b9cfe6]">/ {m.pricePeriod}</span>
          </div>
          <p className="mt-2 text-center text-sm text-[#b9cfe6]">{m.priceNote}</p>
          {/* V2.1：接真实结账。
              未登录 → 跳 /login?next=/membership；在线收款未开通 → 降级到人工服务。
              三种状态都接住用户的付费意图，绝不让他点了才发现付不了款。 */}
          <CheckoutButton
            locale={locale}
            returnTo="/membership"
            dict={{
              cta: m.cta,
              submitting: m.checkoutSubmitting ?? m.cta,
              errorGeneric: m.checkoutError ?? "",
            }}
            className="mt-6 block w-full rounded-lg bg-[#d4232a] py-3 text-center font-semibold text-white shadow-lg transition hover:brightness-95 disabled:opacity-70"
          />
          <p className="mt-3 text-center text-xs text-[#b9cfe6]">{m.paymentNote}</p>
        </div>

        {/* 免费卡 */}
        <div className="order-2 flex flex-col rounded-2xl border border-[#e2e8f0] bg-white p-8 md:order-1">
          <h2 className="text-xl font-bold text-[#0f172a]">{m.freeTitle}</h2>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-5xl font-extrabold text-[#0f172a]">$0</span>
            <span className="text-lg text-[#64748b]">/ {m.pricePeriod}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#475569]">
            {m.freeLead.replace("{n}", String(FREE_PROFILE_LIMIT))}
          </p>
          <div className="flex-1" />
          <Link
            href={p("/register")}
            className="btn btn-outline mt-6 w-full"
            data-track={ANALYTICS_EVENTS.registerCta}
          >
            {m.freeCta}
          </Link>
        </div>
      </section>

      {/* 权益 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.benefitsTitle}</h2>
        <p className="mt-1 text-sm text-[#64748b]">{m.benefitsLead}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {m.benefits.map((b: string, i: number) => (
            <div
              key={b}
              className="card flex gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0f4c81] to-[#163a5f] text-xs font-bold text-white">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="pt-1.5 text-sm leading-relaxed text-[#475569]">{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.faqTitle}</h2>
        <div className="mt-5 space-y-3">
          {m.faq.map((f: { q: string; a: string }) => (
            <details key={f.q} className="card group p-4">
              <summary className="flex list-none cursor-pointer items-center justify-between gap-3 font-semibold text-[#0f172a] [&::-webkit-details-marker]:hidden">
                <span>{f.q}</span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e6eef6] text-sm font-bold text-[#0f4c81] transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
