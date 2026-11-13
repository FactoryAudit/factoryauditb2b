import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhCopy } from "@/lib/tw";
import { ABOUT, OPERATOR, operatorEmail } from "@/lib/aboutContent";
import { TP, CONTENT_REVIEWED, REGISTRY_URL } from "@/lib/trustPage";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
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
    id,
    title,
    lead,
    children,
  }: {
    /** 可选锚点：首页信任条深链到 #in-person 时，落地就是这张照片 */
    id?: string;
    title: string;
    lead?: string;
    children: React.ReactNode;
  }) => (
    // scroll-mt-24：页头 sticky 74px，没有滚动外边距时锚点会把标题压在页头下面
    <section id={id} className="mt-14 scroll-mt-24">
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
        {/* 最近复核月份：常量写在 lib/trustPage.ts，不取 new Date()（自动取会让它永远是当月） */}
        <p className="mt-4 flex flex-wrap items-center gap-x-2 text-sm text-[#6d6b66]">
          <span className="font-semibold text-[#2b2b2b]">
            {pickZhCopy(locale, TP.reviewedLabel)}:
          </span>
          <span>{pickZhCopy(locale, CONTENT_REVIEWED)}</span>
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

      {/* ══ 工作单 P0-2：How to verify us ══════════════════════════════════════
          平台替别人做核验，自己必须也能被独立核验。
          只写「能被第三方查到的四件事」：工商登记（gsxt.gov.cn 按中文全称检索）、
          域名、TLS 证书、公开 WHOIS。不写任何未取得的认证。
          SOC 2 / ISO 27001 只出现在「将来若取得」的条件句里（见 lib/trustPage.ts 铁律 2）。 */}
      <Section title={pickZhCopy(locale, TP.verifyUs.title)}>
        <p className="max-w-3xl leading-relaxed text-[#3f4650]">
          {pickZhCopy(locale, TP.verifyUs.body)}
        </p>
        <a
          href={REGISTRY_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-track={ANALYTICS_EVENTS.trustRegistryClick}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#ddd9d0] bg-white px-4 py-2 text-sm font-semibold text-[#171717] hover:border-[#e07a49]"
        >
          {pickZhCopy(locale, TP.verifyUs.registryCta)}
          <span aria-hidden="true">↗</span>
        </a>
        <p className="mt-5 max-w-3xl rounded-md border border-[#ebe8e1] bg-[#fbfaf7] p-4 text-sm leading-relaxed text-[#6d6b66]">
          {pickZhCopy(locale, TP.verifyUs.future)}
        </p>
      </Section>

      {/* ══ 工作单 P0-5：Who reviews your file ════════════════════════════════
          🔴 平台目前没有在册审核员（auditor_application 5 条全为探针），实际由运营者本人核验。
             所以这里写「运营者本人 / 不匿名池 / 开工前告知是谁 / 可要求视频通话」，
             绝不写「lead auditor + QC engineer」这类组织架构 —— 那是虚构。 */}
      <Section title={pickZhCopy(locale, TP.who.title)}>
        <p className="max-w-3xl leading-relaxed text-[#3f4650]">
          {pickZhCopy(locale, TP.who.body)}
        </p>
      </Section>

      {/* ── 以下三节自 /about 合并而来（阶段 1 任务 6：/about 308 → /trust）─────
          文案沿用 t.about.*（9 语齐备，无需新增字典键），可见内容不重写。 */}

      {/* 我们是谁 —— 原 /about 的 story 段 */}
      <Section title={t.about.storyTitle}>
        <p className="text-[#3f4650] leading-relaxed max-w-3xl">{t.about.storyBody}</p>
      </Section>

      {/* 线下见面 —— 真实活动签到现场照片。
          只用于证明「团队是真的人、线下可见、核验不外包」；
          照片无法证明活动规模、场次、成交或客户数量，文案不涉及这些，也不暗示覆盖多个产业带。
          id="in-person"：首页信任条深链的落点（全站唯一实拍素材，故只做两处曝光）。 */}
      <Section id="in-person" title={t.about.inPersonTitle}>
        <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
          <figure className="overflow-hidden rounded-lg border border-[#ebe8e1] bg-white">
            {/* 原生 img：与站点其它静态图一致，不引入 next/image 运行时 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/trust/team-at-sourcing-event.jpg"
              alt={t.about.inPersonCaption}
              width={1200}
              height={900}
              loading="lazy"
              decoding="async"
              className="h-auto w-full"
            />
            <figcaption className="px-3 py-2 text-xs leading-relaxed text-[#6d6b66]">
              {t.about.inPersonCaption}
            </figcaption>
          </figure>
          <p className="max-w-3xl leading-relaxed text-[#3f4650]">{t.about.inPersonBody}</p>
        </div>
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

      {/* ══ 工作单 P0-1：Verification Levels（核验等级）════════════════════════
          `t.trust.levelsTitle / levelsLead / levelDescs[5]` 是 9 语齐备的原文，
          自 `eb35246` 重建 /trust 起就没再被渲染过（全仓零引用）。
          这里只做「接线」：不新增文案、不改写、不加层级名称（名称一旦自造就会与
          `suppliers.verification_level` 枚举对不上），用 01–05 序号呈现升序阶梯。 */}
      <Section title={tc.levelsTitle} lead={tc.levelsLead}>
        <ol className="grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
          {tc.levelDescs.map((desc, i) => (
            <li
              key={desc}
              className="flex gap-3 rounded-md border border-[#ebe8e1] bg-white px-4 py-3"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[11px] font-extrabold tracking-[.12em] text-[#e07a49]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm leading-relaxed text-[#3f4650]">{desc}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* ══ 工作单 P1-1：方法论入口 ════════════════════════════════════════════
          🔴 不新建 /trust/methodology —— /methodology 已存在（8 维加权评分模型，
             与「核验步骤」是两件事）。新建只会多一份互相稀释的薄页。 */}
      <Section title={tc.methodTitle}>
        <p className="max-w-3xl leading-relaxed text-[#3f4650]">{tc.methodLead}</p>
        <Link
          href={p("/methodology")}
          className="muted-link mt-3 inline-block text-sm"
        >
          {tc.methodLink} <span aria-hidden="true">→</span>
        </Link>
      </Section>

      {/* ══ 工作单 P0-6：Sample report ════════════════════════════════════════
          🔴 不另做 sample-verification-report.pdf：站内已有 /standard-report
             （13 章 / 8 维 / 证据分级，免费读、注册后下载样张），/sample-report 已 308 过去。
             再做一份 PDF 会出现两套样张口径，反而更难维护。 */}
      <Section title={pickZhCopy(locale, TP.sample.title)}>
        <p className="max-w-3xl leading-relaxed text-[#3f4650]">
          {pickZhCopy(locale, TP.sample.body)}
        </p>
        <Link
          href={p("/standard-report")}
          data-track={ANALYTICS_EVENTS.trustSampleClick}
          className="btn btn-outline mt-4 inline-flex items-center gap-2"
        >
          {pickZhCopy(locale, TP.sample.cta)}
          <span aria-hidden="true">→</span>
        </Link>
      </Section>

      {/* ══ 工作单 P0-4：Mini-FAQ ═════════════════════════════════════════════
          用原生 <details>/<summary>：无 JS 依赖，移动端可展开，也不引入新组件。
          三个答案全部改写成站内既有口径（报告交付物 / 文件共享边界 / 负面发现），
          没有新增任何事实性承诺。 */}
      <Section title={pickZhCopy(locale, TP.faq.title)}>
        <div className="space-y-3">
          {pickZhCopy(locale, TP.faq.items).map((item) => (
            <details
              key={item.q}
              className="rounded-lg border border-[#ebe8e1] bg-white p-4 open:border-[#d9a18a]"
            >
              <summary className="cursor-pointer list-none font-semibold text-[#171717] [&::-webkit-details-marker]:hidden">
                {item.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-[#3f4650]">{item.a}</p>
            </details>
          ))}
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
        {/* 工作单 P0-3：把「发什么、多久回、写不写清价格」讲明白。
            按钮沿用 ABOUT.cta.buttons（/rfq 与 /custom-services），不新建表单 ——
            /rfq 已有五类分流 + 蜜罐 + 外链降权，再建一套只会多一个灌水入口。 */}
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#c8d6e5]">
          {pickZhCopy(locale, TP.ctaLine)}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {/* 主按钮 = 工作单要的 scoped quote 入口，落到 /rfq（已有五类分流 + 反灌水）。
              原有 /suppliers 与 /factory-audit/request 保留为次要按钮，/rfq 不重复出现。 */}
          <Link
            href={p("/rfq")}
            data-track={ANALYTICS_EVENTS.trustRfqClick}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-[#171717] hover:bg-[#f5f3ee]"
          >
            {pickZhCopy(locale, TP.ctaButton)}
            <span aria-hidden="true">→</span>
          </Link>
          {ABOUT.cta.buttons
            .filter((btn) => btn.href !== "/rfq")
            .map((btn) => (
              <Link
                key={btn.href}
                href={p(btn.href)}
                className="inline-flex items-center justify-center rounded-md border border-white/60 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                {pickZhCopy(locale, btn.label)}
              </Link>
            ))}
        </div>
      </section>

      {/* 页尾元信息（工作单 P1-3 的可核验版本）：复核月份 + 方法论 + 联系入口。
          刻意不放「版本号 vX.Y」——版本号没有业务方确认就是自造。 */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#ebe8e1] pt-5 text-xs text-[#6d6b66]">
        <span>
          {pickZhCopy(locale, TP.reviewedLabel)}: {pickZhCopy(locale, CONTENT_REVIEWED)}
        </span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href={p("/methodology")}
            className="text-[#171717] underline decoration-[#e07a49] hover:decoration-2"
          >
            {tc.methodLink}
          </Link>
          <Link
            href={p("/contact")}
            className="text-[#171717] underline decoration-[#e07a49] hover:decoration-2"
          >
            {t.footer.contact}
          </Link>
        </span>
      </div>
    </main>
  );
}
