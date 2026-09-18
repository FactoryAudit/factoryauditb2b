import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import CheckoutButton from "@/components/CheckoutButton";
import { MEMBERSHIP_PRICE_USD } from "@/lib/suppliers";

const PATH = "/pricing";

// 推荐套餐在 plans 数组中的位置（0=Free Tools, 1=Supplier Verification, 2=Factory Audit, 3=Supplier Monitoring）。
// 用索引而不是套餐名做判断：套餐名在 9 种语言下不同，字符串比较会失效。
const RECOMMENDED_PLAN_INDEX = 1;

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
    title: t.pricing.metaTitle,
    description: t.pricing.metaDesc,
  });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = t.pricing;
  const m = t.membership;
  const lp = (href: string) => localePath(locale, href);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Offer",
      name: p.plans[0].name,
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "FactoryAuditB2B" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <div className="container py-12">
      <JsonLd data={jsonLd} />

      <h1 className="text-3xl font-bold text-[#0f172a] text-center">{p.h1}</h1>
      <p className="text-[#64748b] text-center mt-2 mb-2">{p.lead}</p>
      <p className="text-[#64748b] text-center text-sm mb-10">{p.currencyNote}</p>

      <h2 className="text-xl font-semibold text-[#0f172a] mb-1">{p.plansTitle}</h2>
      <p className="text-[#64748b] mb-5">{p.plansLead}</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {p.plans.map((plan, i) => {
          // 推荐档按「索引」判定，不按 plan.name 字符串比较：
          // 后者在中文/日文等语言下永远匹配不上（字典里叫「供应商核查」），
          // 会导致推荐套餐在非英语站点失去高亮、按钮降级成 outline。
          const recommended = i === RECOMMENDED_PLAN_INDEX;
          return (
            <div
              key={plan.name}
              className={`card p-5 flex flex-col ${
                recommended ? "border-[#0f4c81] ring-2 ring-[#0f4c81]" : ""
              }`}
            >
              {recommended && (
                <span className="text-[11px] font-semibold text-[#0f4c81] mb-2 uppercase tracking-wide">
                  {p.recommendedTag ?? "Recommended"}
                </span>
              )}
              <div className="font-bold text-lg text-[#0f172a]">{plan.name}</div>
              <div className="text-2xl font-extrabold text-[#0f4c81] my-2">{plan.price}</div>
              <div className="text-xs text-[#64748b] -mt-1 mb-3">{plan.note}</div>
              <ul className="space-y-1 text-sm text-[#475569] mb-4 flex-1">
                {plan.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <Link
                href={lp(plan.href)}
                className={`btn ${recommended ? "btn-primary" : "btn-outline"} w-full`}
                // 推荐档（索引 1）= 付费核查套餐，点击即视为核查转化流程的起点
                {...(i === RECOMMENDED_PLAN_INDEX
                  ? { "data-track": ANALYTICS_EVENTS.verificationCheckoutStart }
                  : {})}
              >
                {plan.cta}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-[#64748b] mt-4 max-w-3xl">{p.comingSoonNote}</p>

      <section className="mt-14">
        <h2 className="text-xl font-semibold text-[#0f172a] mb-1">{p.reportsTitle}</h2>
        <p className="text-[#64748b] mb-5">{p.reportsLead}</p>
        <div className="grid md:grid-cols-3 gap-4">
          {p.reports.map((r) => (
            <div key={r.name} className="card p-5">
              <div className="font-bold text-[#0f172a]">{r.name}</div>
              <div className="text-xl font-extrabold text-[#0f4c81] my-2">{r.range}</div>
              <p className="text-sm text-[#475569]">{r.note}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-[#64748b] mt-4">{p.reportsNote}</p>
      </section>

      <section className="mt-14 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-semibold text-[#0f172a]">{p.alsoTitle}</h2>
        <ul className="mt-2 text-sm text-[#475569] space-y-1">
          {p.alsoItems.map((c) => (
            <li key={c}>• {c}</li>
          ))}
        </ul>
        <Link href={lp("/custom-services")} className="btn btn-primary mt-4 inline-block">
          {p.alsoCta}
        </Link>
        {/* CS-17：商业化入口。与「人工对接」并列，让已有购买意向的用户能直接下单，
            而不是只能留线索等回电。文案复用 order 命名空间，不新增字典键。 */}
        <Link
          href={lp("/order")}
          className="btn btn-primary mt-4 ml-3 inline-block bg-[#0f4c81] text-white"
        >
          {t.order.title}
        </Link>
      </section>

      {/* V2.2 §13：Founding Buyer 作为 Pricing 下的选项，带 #founding-buyer 锚点。
          Membership 不再独立成页；内部导航统一指向 /pricing#founding-buyer（spec §48/§52）。 */}
      <section id="founding-buyer" className="mt-14 rounded-lg border border-[#0f4c81] p-6">
        <h2 className="font-semibold text-[#0f172a]">{m.h1}</h2>
        <p className="text-sm text-[#64748b] mt-2">{m.lead}</p>
        <p className="text-2xl font-extrabold text-[#0f4c81] my-3">
          ${MEMBERSHIP_PRICE_USD}
          <span className="text-base font-normal text-[#64748b]">/ {m.pricePeriod}</span>
        </p>
        <ul className="text-sm text-[#475569] space-y-1 mb-4">
          {m.benefits.slice(0, 4).map((b: string) => (
            <li key={b}>✓ {b}</li>
          ))}
        </ul>
        <CheckoutButton
          locale={locale}
          returnTo="/pricing"
          dict={{
            cta: m.cta,
            submitting: m.checkoutSubmitting ?? m.cta,
            errorGeneric: m.checkoutError ?? "",
          }}
          className="btn btn-primary w-full"
        />
        <p className="mt-3 text-xs text-[#64748b]">{m.paymentNote}</p>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold text-[#0f172a] mb-4">{p.faqTitle}</h2>
        <div className="space-y-4 max-w-3xl">
          {p.faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-[#0f172a]">{f.q}</h3>
              <p className="text-[#475569] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
