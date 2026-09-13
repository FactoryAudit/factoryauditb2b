import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhCopy } from "@/lib/tw";
import { ABOUT, OPERATOR, operatorEmail } from "@/lib/aboutContent";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";

const PATH = "/trust";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.trust.metaTitle,
    description: t.trust.metaDesc,
  });
}

export default async function TrustPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);

  // 品牌与法律主体始终展示，不隐藏在「未配置」之后
  const operatorName = pickZhCopy(locale, {
    en: OPERATOR.nameEn,
    zh: OPERATOR.nameZh,
  });

  const Section = ({
    title,
    lead,
    children,
  }: {
    title: string;
    lead?: string;
    children: React.ReactNode;
  }) => (
    <section className="mt-14">
      <h2 className="text-2xl font-bold text-[#0f172a]">{title}</h2>
      {lead && <p className="text-[#64748b] mt-2 max-w-3xl">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );

  // AI Search 最需要的一段：明确「品牌 / 法律主体 / 做什么 / 服务哪些国家」
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE}/#organization`,
    name: "FactoryAuditB2B",
    legalName: OPERATOR.nameEn,
    alternateName: OPERATOR.nameZh,
    url: BASE,
    email: operatorEmail(),
    description: pickZhCopy(locale, ABOUT.hero.lead),
    areaServed: COVERAGE_COUNTRIES.map((c) => c.name),
  };

  return (
    <main className="container py-12 max-w-4xl">
      <JsonLd
        data={[
          organizationJsonLd,
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: t.common.ui.home,
                item: `${BASE}${p("/")}`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: pickZhCopy(locale, ABOUT.hero.title),
                item: `${BASE}${p(PATH)}`,
              },
            ],
          },
        ]}
      />

      {/* 第一屏 —— 我们是谁 */}
      <header>
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {pickZhCopy(locale, { en: "About", zh: "关于我们" })}
        </span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2 leading-tight">
          {pickZhCopy(locale, ABOUT.hero.title)}
        </h1>
        <p className="text-[#64748b] mt-4 text-lg max-w-3xl">
          {pickZhCopy(locale, ABOUT.hero.lead)}
        </p>
      </header>

      {/* 为什么做这件事 */}
      <section className="mt-10 rounded-lg bg-[#f1f5f9] p-6">
        <p className="text-[#334155] leading-relaxed">
          {pickZhCopy(locale, ABOUT.hero.whyBuilt)}
        </p>
      </section>

      {/* 采购商真正要回答的问题 */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-[#0f172a]">
          {pickZhCopy(locale, ABOUT.hero.questionsLead)}
        </h2>
        <ul className="mt-4 space-y-2">
          {pickZhCopy(locale, ABOUT.hero.questions).map((q) => (
            <li key={q} className="card p-4 text-[#475569]">
              {q}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[#475569] leading-relaxed">
          {pickZhCopy(locale, ABOUT.hero.funnel)}
        </p>
      </section>

      {/* 为什么我们懂供应商 */}
      <Section title={pickZhCopy(locale, ABOUT.why.title)} lead={pickZhCopy(locale, ABOUT.why.subtitle)}>
        <div className="grid gap-4 md:grid-cols-3">
          {ABOUT.why.cards.map((card) => {
            const tag = pickZhCopy(locale, card.tag);
            const title = pickZhCopy(locale, card.title);
            const body = pickZhCopy(locale, card.body);
            const closing = pickZhCopy(locale, card.closing);
            return (
              <div key={card.num} className="card p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#0f4c81]">
                  {tag}
                </div>
                <h3 className="mt-1 font-bold text-[#0f172a]">{title}</h3>
                <p className="mt-2 text-sm text-[#475569] leading-relaxed">{body}</p>
                {"bullets" in card && (
                  <>
                    <p className="mt-3 text-sm font-medium text-[#334155]">
                      {pickZhCopy(locale, card.bulletsLead!)}
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-[#475569]">
                      {pickZhCopy(locale, card.bullets!).map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-3 text-sm text-[#475569] leading-relaxed">{closing}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 从数据，到真实工厂 */}
      <Section title={pickZhCopy(locale, ABOUT.reality.title)}>
        <p className="text-[#475569] leading-relaxed">
          {pickZhCopy(locale, ABOUT.reality.body)}
        </p>
        <p className="mt-3 text-[#64748b]">{pickZhCopy(locale, ABOUT.reality.tiersLead)}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ABOUT.reality.tiers.map((tier) => (
            <div
              key={pickZhCopy(locale, tier)}
              className="rounded-md border border-[#e2e8f0] px-4 py-3 text-sm font-medium text-[#0f172a]"
            >
              {pickZhCopy(locale, tier)}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-[#64748b]">
          {pickZhCopy(locale, ABOUT.reality.closing)}
        </p>
      </Section>

      {/* 我们帮采购商回答什么 */}
      <Section title={pickZhCopy(locale, ABOUT.answers.title)} lead={pickZhCopy(locale, ABOUT.answers.lead)}>
        <div className="space-y-3">
          {ABOUT.answers.items.map((item) => (
            <div key={pickZhCopy(locale, item.q)} className="card p-5">
              <h3 className="font-semibold text-[#0f172a]">
                {pickZhCopy(locale, item.q)}
              </h3>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                {pickZhCopy(locale, item.a)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-md bg-[#e6eef6] p-4 text-[#1e3a5f] leading-relaxed">
          {pickZhCopy(locale, ABOUT.answers.valueQuote)}
        </p>
      </Section>

      {/* 我们怎么做 */}
      <Section title={pickZhCopy(locale, ABOUT.how.title)} lead={pickZhCopy(locale, ABOUT.how.lead)}>
        <ol className="grid gap-4 md:grid-cols-2">
          {ABOUT.how.steps.map((step) => (
            <li key={step.num} className="card p-5">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-[#0f4c81]">{step.num}</span>
                <h3 className="font-bold text-[#0f172a]">{pickZhCopy(locale, step.name)}</h3>
              </div>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                {pickZhCopy(locale, step.body)}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-[#7c4a03] leading-relaxed">
          {pickZhCopy(locale, ABOUT.how.caveat)}
        </p>
      </Section>

      {/* 信息透明 */}
      <Section title={pickZhCopy(locale, ABOUT.transparency.title)}>
        <p className="text-[#475569] leading-relaxed">
          {pickZhCopy(locale, ABOUT.transparency.body)}
        </p>
        <p className="mt-3 text-[#64748b]">{pickZhCopy(locale, ABOUT.transparency.labelsLead)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pickZhCopy(locale, ABOUT.transparency.labels).map((label) => (
            <span
              key={label}
              className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-medium text-[#334155]"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="mt-5 rounded-lg border border-[#e2e8f0] p-5">
          <h3 className="font-semibold text-[#0f172a]">
            {pickZhCopy(locale, ABOUT.transparency.notVerifiedTitle)}
          </h3>
          <p className="mt-2 text-sm text-[#475569] leading-relaxed">
            {pickZhCopy(locale, ABOUT.transparency.notVerifiedBody)}
          </p>
        </div>
      </Section>

      {/* 运营主体 */}
      <Section title={pickZhCopy(locale, ABOUT.operated.title)}>
        <p className="text-[#475569] leading-relaxed">
          {pickZhCopy(locale, ABOUT.operated.statement)}
        </p>
        <dl className="mt-4 card p-6 divide-y divide-[#e2e8f0]">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-[#64748b]">{pickZhCopy(locale, ABOUT.operated.fieldRegistered)}</dt>
            <dd className="text-right font-medium text-[#0f172a]">{operatorName}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-[#64748b]">{pickZhCopy(locale, ABOUT.operated.fieldCountry)}</dt>
            <dd className="text-right font-medium text-[#0f172a]">
              {pickZhCopy(locale, ABOUT.operated.countryValue)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-[#64748b]">{pickZhCopy(locale, ABOUT.operated.fieldEmail)}</dt>
            <dd className="text-right font-medium text-[#0f172a]">
              <a href={`mailto:${operatorEmail()}`} className="text-[#0f4c81] underline">
                {operatorEmail()}
              </a>
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-[#64748b]">{pickZhCopy(locale, ABOUT.operated.fieldWebsite)}</dt>
            <dd className="text-right font-medium text-[#0f172a]">
              <a href={`https://${ABOUT.operated.websiteValue}`} className="text-[#0f4c81] underline">
                {ABOUT.operated.websiteValue}
              </a>
            </dd>
          </div>
        </dl>
      </Section>

      {/* 结尾 CTA */}
      <section className="mt-14 rounded-xl bg-[#0f4c81] p-8 text-white">
        <h2 className="text-2xl font-bold">{pickZhCopy(locale, ABOUT.cta.title)}</h2>
        <p className="mt-3 max-w-2xl text-[#dbeafe] leading-relaxed">
          {pickZhCopy(locale, ABOUT.cta.body)}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {ABOUT.cta.buttons.map((btn, i) => (
            <Link
              key={btn.href}
              href={p(btn.href)}
              className={
                i === 0
                  ? "inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-[#0f4c81] hover:bg-[#e6eef6]"
                  : "inline-flex items-center justify-center rounded-md border border-white/60 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              }
            >
              {pickZhCopy(locale, btn.label)}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
