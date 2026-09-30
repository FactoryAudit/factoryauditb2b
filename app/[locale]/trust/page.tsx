import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhCopy } from "@/lib/tw";
import { ABOUT, OPERATOR, operatorEmail } from "@/lib/aboutContent";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import { STATIC_INDUSTRIES } from "@/lib/staticData";
// CS-23：Trust Center 区块的互链件与合规邮箱（邮箱是标识符，不进 i18n 字典）
import { RelatedPolicies } from "@/components/legal/ComplianceSections";
import { COMPLIANCE_EMAIL } from "@/lib/compliance";

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
  /** CS-23：`trust.tc*` 是追加区块的键，与既有 94 个 trust 键同命名空间、不同前缀 */
  const tc = t.trust;

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
      <h2 className="text-2xl font-bold text-[#171717]">{title}</h2>
      {lead && <p className="text-[#6d6b66] mt-2 max-w-3xl">{lead}</p>}
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
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">
          {pickZhCopy(locale, { en: "About", zh: "关于我们" })}
        </span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2 leading-tight">
          {pickZhCopy(locale, ABOUT.hero.title)}
        </h1>
        <p className="text-[#6d6b66] mt-4 text-lg max-w-3xl">
          {pickZhCopy(locale, ABOUT.hero.lead)}
        </p>
      </header>

      {/* 为什么做这件事 */}
      <section className="mt-10 rounded-lg bg-[#f5f3ee] p-6">
        <p className="text-[#2b2b2b] leading-relaxed">
          {pickZhCopy(locale, ABOUT.hero.whyBuilt)}
        </p>
      </section>

      {/* ══ CS-23：Trust Center 区块（**追加**，既有内容一字未改）══════════════════
          插入位置：紧跟在「为什么做这件事」之后、自 /about 合并而来的三节之前。
          理由：
            ① 合规入口必须在首屏可见范围内 —— 沉到页尾等于没有入口；
            ② 不打断 hero（标题 + 导语）与 whyBuilt 的成对关系；
            ③ 放在所有「自 /about 合并而来」的内容**之上**，不切割那三节的连贯性。
          ⚠️ 本区块只做加法：不删除、不改写、不重排页面上任何既有元素。
             （/about 的 308 目标仍是本页，About 语义必须完整保留。）

          安全措施只列仓库里**真实落地**的四项，各自实现位置：
            · HTTPS —— `middleware.ts` 强制 http→https 308 + Cloudflare 边缘
            · 服务端字段裁剪 —— `lib/access.ts`（按 visitor/free/founding_buyer 逐字段裁剪后才出网）
            · 数据库权限 —— Supabase RLS：anon 零权限、authenticated 仅 admin-select
            · 审计日志 —— `lib/adminData.ts` 写 audit log
          禁写：ISO 认证、渗透测试报告、加密算法细节、具体数据处理方名称。 */}
      <section
        id="trust-center"
        className="mt-10 scroll-mt-24 rounded-xl border border-[#ebe8e1] bg-[#fbfaf7] p-6"
      >
        <span className="text-[11px] font-bold uppercase tracking-[.12em] text-[#e07a49]">
          {tc.badge}
        </span>
        <h2 className="mt-1 text-2xl font-bold text-[#171717]">{tc.tcTitle}</h2>
        <p className="mt-2 max-w-3xl text-[#6d6b66]">{tc.tcLead}</p>

        {/* 四份政策摘要（卡片本身即链接；隐私 / 条款的标题复用 legal.* 同一字符串） */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            { href: "/confidentiality", title: tc.tcCardConfTitle, body: tc.tcCardConfBody },
            { href: "/integrity", title: tc.tcCardIntegrityTitle, body: tc.tcCardIntegrityBody },
            { href: "/privacy", title: t.legal.privacyTitle, body: tc.tcCardPrivacyBody },
            { href: "/terms", title: t.legal.termsTitle, body: tc.tcCardTermsBody },
          ].map((card) => (
            <Link
              key={card.href}
              href={p(card.href)}
              className="card p-5 transition hover:border-[#e07a49]"
            >
              <h3 className="font-bold text-[#171717]">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3f4650]">{card.body}</p>
            </Link>
          ))}
        </div>

        {/* 安全措施：只列已上线 */}
        <div className="mt-5 rounded-lg border border-[#ebe8e1] bg-white p-5">
          <h3 className="font-bold text-[#171717]">{tc.tcSecurityTitle}</h3>
          <p className="mt-1 text-sm text-[#6d6b66]">{tc.tcSecurityBody}</p>
          <ul className="mt-3 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
            {tc.tcSecurityItems.map((item) => (
              <li
                key={item}
                className="rounded-md bg-[#f5f3ee] px-3 py-2 text-sm leading-relaxed text-[#3f4650]"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 数据流转 + 举报渠道 */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="card p-5">
            <h3 className="font-bold text-[#171717]">{tc.tcDataTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#3f4650]">{tc.tcDataBody}</p>
          </div>
          <div className="card p-5">
            <h3 className="font-bold text-[#171717]">{tc.tcReportTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#3f4650]">{tc.tcReportBody}</p>
            <a
              href={`mailto:${COMPLIANCE_EMAIL}`}
              className="mt-2 inline-block font-semibold text-[#1b1b19] underline decoration-[#e07a49] hover:decoration-2"
            >
              {COMPLIANCE_EMAIL}
            </a>
          </div>
        </div>

        <RelatedPolicies
          title={t.compliance.relatedTitle}
          links={[
            { href: p("/confidentiality"), label: t.footer.confidentiality },
            { href: p("/integrity"), label: t.footer.integrity },
            { href: p("/trust"), label: tc.badge, current: true },
            { href: p("/privacy"), label: t.footer.privacy },
            { href: p("/terms"), label: t.footer.terms },
          ]}
        />
      </section>

      {/* ── 以下三节自 /about 合并而来（阶段 1 任务 6：/about 308 → /trust）─────
          文案沿用 t.about.*（9 语齐备，无需新增字典键），可见内容不重写。 */}

      {/* 我们是谁 —— 原 /about 的 story 段 */}
      <Section title={t.about.storyTitle}>
        <p className="text-[#3f4650] leading-relaxed max-w-3xl">{t.about.storyBody}</p>
      </Section>

      {/* 数字 —— 原 /about 的 4 个数字里只有 2 项在仓库中找得到事实来源：
            "5 Countries" ✓（lib/coverage.ts）与 "Industry sectors" ✓（lib/staticData.ts）。
            另 2 项（"20+ Audit & compliance programs" 与 "< 1 day Typical response time"）
            全仓无数据源，按「禁无据声称」铁律**不搬运**；且保留下来的 2 项
            不写死数字，直接由代码实时推导，避免再次与实现漂移（此前的 12 与实现不符，实为 13）。 */}
      <Section title={t.about.statsTitle}>
        <div className="grid grid-cols-2 gap-4">
          {[
            { value: String(COVERAGE_COUNTRIES.length), label: t.about.stats[0].label },
            { value: String(STATIC_INDUSTRIES.length), label: t.about.stats[1].label },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-2xl font-extrabold text-[#171717]">{s.value}</div>
              <div className="mt-1 text-xs text-[#6d6b66]">{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 我们怎么工作 —— 原 /about 的 values 卡 */}
      <Section title={t.about.valuesTitle}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {t.about.values.map((v) => (
            <div key={v.title} className="card p-5">
              <div className="font-semibold text-[#171717]">{v.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-[#3f4650]">{v.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 采购商真正要回答的问题 */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-[#171717]">
          {pickZhCopy(locale, ABOUT.hero.questionsLead)}
        </h2>
        <ul className="mt-4 space-y-2">
          {pickZhCopy(locale, ABOUT.hero.questions).map((q) => (
            <li key={q} className="card p-4 text-[#3f4650]">
              {q}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[#3f4650] leading-relaxed">
          {pickZhCopy(locale, ABOUT.hero.funnel)}
        </p>
      </section>

      {/* 为什么我们懂供应商 */}
      <Section title={pickZhCopy(locale, ABOUT.why.title)} lead={pickZhCopy(locale, ABOUT.why.subtitle)}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ABOUT.why.cards.map((card) => {
            const tag = pickZhCopy(locale, card.tag);
            const title = pickZhCopy(locale, card.title);
            const body = pickZhCopy(locale, card.body);
            const closing = pickZhCopy(locale, card.closing);
            return (
              <div key={card.num} className="card p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#171717]">
                  {tag}
                </div>
                <h3 className="mt-1 font-bold text-[#171717]">{title}</h3>
                <p className="mt-2 text-sm text-[#3f4650] leading-relaxed">{body}</p>
                {"bullets" in card && (
                  <>
                    <p className="mt-3 text-sm font-medium text-[#2b2b2b]">
                      {pickZhCopy(locale, card.bulletsLead!)}
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-[#3f4650]">
                      {pickZhCopy(locale, card.bullets!).map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-3 text-sm text-[#3f4650] leading-relaxed">{closing}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 从数据，到真实工厂 */}
      <Section title={pickZhCopy(locale, ABOUT.reality.title)}>
        <p className="text-[#3f4650] leading-relaxed">
          {pickZhCopy(locale, ABOUT.reality.body)}
        </p>
        <p className="mt-3 text-[#6d6b66]">{pickZhCopy(locale, ABOUT.reality.tiersLead)}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ABOUT.reality.tiers.map((tier) => (
            <div
              key={pickZhCopy(locale, tier)}
              className="rounded-md border border-[#ebe8e1] px-4 py-3 text-sm font-medium text-[#171717]"
            >
              {pickZhCopy(locale, tier)}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-[#6d6b66]">
          {pickZhCopy(locale, ABOUT.reality.closing)}
        </p>
      </Section>

      {/* 我们帮采购商回答什么 */}
      <Section title={pickZhCopy(locale, ABOUT.answers.title)} lead={pickZhCopy(locale, ABOUT.answers.lead)}>
        <div className="space-y-3">
          {ABOUT.answers.items.map((item) => (
            <div key={pickZhCopy(locale, item.q)} className="card p-5">
              <h3 className="font-semibold text-[#171717]">
                {pickZhCopy(locale, item.q)}
              </h3>
              <p className="mt-2 text-sm text-[#3f4650] leading-relaxed">
                {pickZhCopy(locale, item.a)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-md bg-[#f5f3ee] p-4 text-[#1e3a5f] leading-relaxed">
          {pickZhCopy(locale, ABOUT.answers.valueQuote)}
        </p>
      </Section>

      {/* 我们怎么做 */}
      <Section title={pickZhCopy(locale, ABOUT.how.title)} lead={pickZhCopy(locale, ABOUT.how.lead)}>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ABOUT.how.steps.map((step) => (
            <li key={step.num} className="card p-5">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-[#171717]">{step.num}</span>
                <h3 className="font-bold text-[#171717]">{pickZhCopy(locale, step.name)}</h3>
              </div>
              <p className="mt-2 text-sm text-[#3f4650] leading-relaxed">
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
        <p className="text-[#3f4650] leading-relaxed">
          {pickZhCopy(locale, ABOUT.transparency.body)}
        </p>
        <p className="mt-3 text-[#6d6b66]">{pickZhCopy(locale, ABOUT.transparency.labelsLead)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pickZhCopy(locale, ABOUT.transparency.labels).map((label) => (
            <span
              key={label}
              className="rounded-full bg-[#f5f3ee] px-3 py-1 text-xs font-medium text-[#2b2b2b]"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="mt-5 rounded-lg border border-[#ebe8e1] p-5">
          <h3 className="font-semibold text-[#171717]">
            {pickZhCopy(locale, ABOUT.transparency.notVerifiedTitle)}
          </h3>
          <p className="mt-2 text-sm text-[#3f4650] leading-relaxed">
            {pickZhCopy(locale, ABOUT.transparency.notVerifiedBody)}
          </p>
        </div>
      </Section>

      {/* 运营主体 */}
      <Section title={pickZhCopy(locale, ABOUT.operated.title)}>
        <p className="text-[#3f4650] leading-relaxed">
          {pickZhCopy(locale, ABOUT.operated.statement)}
        </p>
        <dl className="mt-4 card p-6 divide-y divide-[#ebe8e1]">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-[#6d6b66]">{pickZhCopy(locale, ABOUT.operated.fieldRegistered)}</dt>
            <dd className="text-right font-medium text-[#171717]">{operatorName}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-[#6d6b66]">{pickZhCopy(locale, ABOUT.operated.fieldCountry)}</dt>
            <dd className="text-right font-medium text-[#171717]">
              {pickZhCopy(locale, ABOUT.operated.countryValue)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-[#6d6b66]">{pickZhCopy(locale, ABOUT.operated.fieldEmail)}</dt>
            <dd className="text-right font-medium text-[#171717]">
              <a href={`mailto:${operatorEmail()}`} className="text-[#171717] underline">
                {operatorEmail()}
              </a>
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-[#6d6b66]">{pickZhCopy(locale, ABOUT.operated.fieldWebsite)}</dt>
            <dd className="text-right font-medium text-[#171717]">
              <a href={`https://${ABOUT.operated.websiteValue}`} className="text-[#171717] underline">
                {ABOUT.operated.websiteValue}
              </a>
            </dd>
          </div>
        </dl>
      </Section>

      {/* 结尾 CTA */}
      <section className="mt-14 rounded-xl bg-[#171717] p-8 text-white">
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
                  ? "inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f3ee]"
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
