import type { Metadata } from "next";
import Link from "next/link";
import HomeSearch from "@/components/home/HomeSearch";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import { GUIDES } from "@/lib/guides";
import { SERVICE_MENU, TOOL_ORDER } from "@/lib/nav";
import { listIndustries } from "@/lib/taxonomy";
import { ALL_QUESTIONS, DIMENSION_STRUCTURE, TOTAL_WEIGHT } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhCopy, pickZhPair } from "@/lib/tw";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
// 阶段 1：登录墙链接规则（?next=<目录页>）—— 与 /suppliers 目录卡片共用同一实现
import { lockedHref } from "@/lib/directoryWall";

const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: "/",
    title: t.home.metaTitle,
    description: t.home.metaDesc,
  });
}

/** 工具卡图标：设计稿原用 Unicode 字形（本机字体回退会渲染成色块），
 *  改为等价语义的 18px 细线内联 SVG（1.6 描边），保持视觉语言、只换载体。 */
const TOOL_ICONS: Record<string, string> = {
  riskCalculator: "M12 3v18M3 12h18",
  supplierComparison: "M4 7h7M4 17h7M14 7l6 10H8z",
  verificationChecklist: "M4 6l2 2 3-3M4 13l2 2 3-3M4 20l2 2 3-3",
  riskAssessment: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  supplierScorecard: "M5 4h14v16H5zM8 9h8M8 13h8M8 17h5",
  auditChecklist: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6",
  documentChecker: "M6 3h8l4 4v14H6zM14 3v4h4M9 13l2 2 4-4",
  auditReportAnalyzer: "M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l5 5",
};

export default async function Home({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);

  const industries = await listIndustries();

  /** Hero 统计条：**数值一律取自可自证的数据源**，标签取自既有 9 语字典。
   *  刻意不用 `about.stats[1].value`（其数字为 12，与 STATIC_INDUSTRIES 现有 13 项不一致）。 */
  const stats = [
    { value: String(COVERAGE_COUNTRIES.length), label: t.about.stats[0].label },
    { value: String(industries.length), label: t.about.stats[1].label },
    { value: t.about.stats[2].value, label: t.about.stats[2].label },
    { value: t.about.stats[3].value, label: t.about.stats[3].label },
  ];

  /** 4 条入口路径（01–04）——直接用 home.entryFind/Cluster/Verify/Rfq 这批既有键。 */
  const paths = [
    { no: "01", title: t.home.entryFindTitle, desc: t.home.entryFindDesc, cta: t.home.entryFindCta, href: "/suppliers" },
    { no: "02", title: t.home.entryClusterTitle, desc: t.home.entryClusterDesc, cta: t.home.entryClusterCta, href: "/industrial-clusters" },
    { no: "03", title: t.home.entryVerifyTitle, desc: t.home.entryVerifyDesc, cta: t.home.entryVerifyCta, href: "/services/supplier-verification" },
    { no: "04", title: t.home.entryRfqTitle, desc: t.home.entryRfqDesc, cta: t.home.entryRfqCta, href: "/rfq" },
  ];

  /** 8 个免费工具 = lib/nav.ts TOOL_ORDER（单一事实源），文案来自 toolCards。 */
  const tools = TOOL_ORDER.map((e) => ({ href: e.href, card: t.toolCards[e.cardKey], icon: TOOL_ICONS[e.cardKey] ?? "" }));

  /** 6 项服务 = SERVICE_MENU（href 的唯一真源），文案来自 servicesIndex.items。 */
  const services = SERVICE_MENU.map((m) => ({
    href: m.href,
    title: t.servicesIndex.items[m.key].title,
    desc: t.servicesIndex.items[m.key].desc,
  }));

  const values = [
    [t.home.why1Title, t.home.why1Body],
    [t.home.why2Title, t.home.why2Body],
    [t.home.why3Title, t.home.why3Body],
    [t.home.why4Title, t.home.why4Body],
  ];

  const guides = GUIDES.slice(0, 3).map((g) => ({
    slug: g.slug,
    title: pickZhPair(locale, g.titleEn, g.titleZh),
    desc: pickZhPair(locale, g.metaDescEn, g.metaDescZh),
    cat: g.category,
  }));

  const plans = t.pricing.plans.slice(0, 3);
  const recommendedIndex = 1; // 与 /pricing 页的推荐套餐一致（第 2 张）

  const sampleFields = [
    { label: t.home.sample.fieldLocation, value: t.home.sample.valLocation },
    { label: t.home.sample.fieldIndustry, value: t.home.sample.valIndustry },
    { label: t.home.sample.fieldCert, value: t.home.sample.valCert },
    { label: t.home.sample.fieldCapacity, value: t.home.sample.valCapacity },
    // fieldAuditType / fieldAuditDate 此前零接线（9 语白付），样例卡补上
    { label: t.home.sample.fieldAuditType, value: t.home.sample.valAuditType },
    { label: t.home.sample.fieldAuditDate, value: t.home.sample.valAuditDate },
  ];

  /** 设计稿 hero-panel 的 `.score-row`（.score-ring + .score-text）。
   *  🔴 设计稿环里写的是「82」——本站**不编造分数**：分数只能由 lib/riskEngine 依证据产出，
   *  写死一个 82 等于对一份不存在的记录做评分陈述。改为渲染该引擎的**真实元数据**
   *  （八维加权、权重合计 100、全部计分项数），三个数字全部从 riskEngine 现算，
   *  文案用既有的 methodology.scoredTableNote（"{n} scored inputs · {d} dimensions · total weight {w}."）。
   *  ⇒ 视觉形态与设计稿一致（86px 环 + 右侧标题/说明），语义说实话。 */
  const riskMeta = {
    inputs: ALL_QUESTIONS.length,
    dimensions: DIMENSION_STRUCTURE.length,
    weight: TOTAL_WEIGHT,
  };
  const scoreNote = t.methodology.scoredTableNote
    .replaceAll("{n}", String(riskMeta.inputs))
    .replaceAll("{d}", String(riskMeta.dimensions))
    .replaceAll("{w}", String(riskMeta.weight));

  /** 设计稿 `.evidence-grid` 的 3 张卡（Company Reviewed / Site Evidence / Docs Partial）。
   *  标签取 trust.verify 的真实核验对象，状态取 evidence.* 真实三态词表
   *  （reviewed / provided / partiallyVerified），与设计稿「2 绿 + 1 中性」的分布一致。 */
  const evidenceCards = [
    { label: t.trust.verify[0], value: t.evidence.reviewed, ok: true },
    { label: t.trust.verify[2], value: t.evidence.provided, ok: true },
    { label: t.trust.verify[3], value: t.evidence.partiallyVerified, ok: false },
  ].filter((c) => Boolean(c.label && c.value));

  return (
    <>
      {/* ── 1. HERO ─────────────────────────────────────────────── */}
      <section className="border-b border-[#ddd9d0] bg-[#f5f3ee]">
        <div className="container grid grid-cols-1 items-center gap-14 py-16 lg:grid-cols-[1.02fr_.98fr] lg:py-20">
          <div>
            <span className="kicker">{t.home.badge}</span>
            <h1 className="mt-0 max-w-[720px] text-[clamp(34px,4.9vw,64px)] font-extrabold leading-[1.02] tracking-[-2.2px] text-[#171717]">
              {t.home.h1}
            </h1>
            <p className="mt-5 max-w-[620px] text-lg leading-relaxed text-[#55524d]">{t.home.lead}</p>
            <p className="mt-2 max-w-[620px] text-[#6d6b66]">{t.home.sub}</p>

            <HomeSearch
              t={{
                tabSupplier: t.common.heroSearch.tabSupplier,
                tabProduct: t.common.heroSearch.tabProduct,
                tabAudit: t.common.heroSearch.tabAudit,
                tabInspector: t.common.heroSearch.tabInspector,
                placeholderSupplier: t.common.heroSearch.placeholderSupplier,
                placeholderProduct: t.common.heroSearch.placeholderProduct,
                placeholderAudit: t.common.heroSearch.placeholderAudit,
                placeholderInspector: t.common.heroSearch.placeholderInspector,
                search: t.common.heroSearch.search,
                combinedHint: t.common.heroSearch.combinedHint,
              }}
            />

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={p("/suppliers")}
                data-track={ANALYTICS_EVENTS.homeFindSuppliersClick}
                className="btn btn-primary"
              >
                {t.home.ctaPrimary}
              </Link>
              <Link href={p("/rfq")} className="btn btn-outline">
                {t.home.ctaSecondary}
              </Link>
            </div>

            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[#ddd9d0] pt-6 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-[11.5px] text-[#817c73]">
                    <span className="mb-1 block text-lg font-extrabold leading-none tracking-[-.3px] text-[#171717]">
                      {s.value}
                    </span>
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>

          {/* 右侧：站点真实 sample 档案卡（Demo，明确标注）——不造 dashboard 假分数 */}
          <div>
            <div className="rounded-[20px] bg-[#1d1d1b] p-4 shadow-[0_18px_50px_rgba(28,26,23,.08)]">
              <div className="flex items-center justify-between px-1 pb-3 text-[#e9e7e1]">
                <span className="text-xs font-bold">{t.home.sample.eyebrow}</span>
                <span className="flex items-center gap-2 text-[10px] uppercase tracking-[.12em] text-[#9fe0bf]">
                  <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-[#73cf9c]" />
                  {t.home.sample.status}
                </span>
              </div>

              <div className="rounded-[14px] bg-[#f7f5f1] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <small className="mb-1 block text-[10px] font-extrabold uppercase tracking-[.12em] text-[#7f7a71]">
                      {t.home.sample.title}
                    </small>
                    <h2 className="text-xl font-bold tracking-[-.6px] text-[#171717]">{t.home.sample.company}</h2>
                  </div>
                  {/* 行业标签。原设计写法带 whitespace-nowrap，德语
                      「Elektronik · PCB-Montage」在 390px 顶出 17px ⇒ 允许换行。 */}
                  <span className="badge badge-verified text-right">{t.home.sample.valIndustry}</span>
                </div>

                {/* 设计稿 .score-row：左 120px 环 / 右侧标题+说明。环内数字 = 真实维度数。 */}
                <div className="mt-[19px] grid grid-cols-1 items-center gap-[18px] rounded-[11px] border border-[#ebe8e1] bg-white p-[15px] sm:grid-cols-[120px_1fr]">
                  <div
                    className="relative mx-auto grid h-[86px] w-[86px] place-items-center rounded-full"
                    style={{ background: "conic-gradient(#e07a49 0 100%)" }}
                    role="img"
                    aria-label={`${riskMeta.dimensions} ${t.methodology.dimensionTitle}`}
                  >
                    <span aria-hidden="true" className="absolute inset-[8px] rounded-full bg-white" />
                    <strong className="relative z-[2] text-[20px] font-extrabold tracking-[-.7px] text-[#171717]">
                      {riskMeta.dimensions}
                    </strong>
                  </div>
                  <div>
                    <strong className="mb-[5px] block text-sm font-semibold text-[#171717]">
                      {t.methodology.weightsTitle}
                    </strong>
                    <span className="text-[11.5px] leading-[1.5] text-[#777269]">{scoreNote}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 rounded-[11px] border border-[#ebe8e1] bg-white p-3">
                  {sampleFields.map((f) => (
                    <div key={f.label}>
                      <small className="block text-[9.5px] font-extrabold uppercase tracking-[.08em] text-[#8b857b]">
                        {f.label}
                      </small>
                      <strong className="text-xs font-semibold text-[#171717]">{f.value}</strong>
                    </div>
                  ))}
                </div>

                {/* 4 个流程节点（Requested → Scheduled → On-site → Report）此前零接线。
                    设计稿这里是一个 82% 的分数环 —— 本站不编造分数（分数只由 riskEngine 依证据产出），
                    故改用真实的记录完整度节点表达同一件事：这条记录走到了哪一步。 */}
                <ol className="mt-3.5 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-[9.5px] font-extrabold uppercase tracking-[.06em] text-[#8b857b]">
                  {[t.home.sample.stepRequested, t.home.sample.stepScheduled, t.home.sample.stepOnsite, t.home.sample.stepReport].map(
                    (s, i, arr) => (
                      <li key={s} className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#1f7a5a]" />
                          {s}
                        </span>
                        {i < arr.length - 1 && <span aria-hidden="true" className="h-px w-3 bg-[#d8d3c9]" />}
                      </li>
                    ),
                  )}
                </ol>

                {/* 设计稿 .evidence-grid：3 张卡（对象 + 证据状态）。 */}
                <div className="mt-3 grid grid-cols-1 gap-[9px] sm:grid-cols-3">
                  {evidenceCards.map((c) => (
                    <div key={c.label} className="rounded-[10px] border border-[#ebe8e1] bg-white p-[11px]">
                      <small className="mb-1 block text-[9.5px] font-extrabold uppercase tracking-[.08em] text-[#8b857b]">
                        {c.label}
                      </small>
                      <strong className={`text-xs font-semibold ${c.ok ? "text-[#1f7a5a]" : "text-[#6d6b66]"}`}>
                        {c.value}
                      </strong>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[11px] leading-snug text-[#7f7a71]">{t.home.sample.demoNote}</p>
              </div>

              <div className="flex items-center justify-between gap-2 px-1 pt-3 text-[10.5px] text-[#aaa69f]">
                <span>{t.home.sample.evidence}</span>
                {/* 阶段 1（2026-09-30）：目录已上登录墙 ⇒ "View sample record" 不再
                    直达 /suppliers，而是落到登录页并带 `?next=<目录页>`，登录后回到完整档。
                    链接由 lockedHref() 生成 —— 与目录卡片锁定态**同一处规则**，
                    避免两处各写一遍 ?next= 拼接而慢慢漂移。 */}
                <Link
                  href={lockedHref({ loginPath: p("/login"), directoryPath: p("/suppliers") })}
                  className="font-semibold text-[#f0ede6] hover:text-[#e07a49]"
                >
                  {t.home.sample.viewSample} →
                </Link>
              </div>
            </div>

            {/* 设计稿 .hero-note：面板下的一行小字（此处用 home.sample.tag 的真实告示文案）。 */}
            <p className="mt-3 flex items-center gap-2 text-[11.5px] text-[#7d786f]">
              <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-[#b8b3a9]" />
              {t.home.sample.tag}
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. 入口路径 01–04 ───────────────────────────────────── */}
      <section className="bg-white py-[68px]">
        <div className="container">
          <div className="mb-11 flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-[720px]">
              <span className="kicker">{t.home.needTitle}</span>
              <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
                {t.home.needLead}
              </h2>
            </div>
            <Link href={p("/services")} className="btn btn-outline btn-sm">
              {t.servicesIndex.servicesTitle} →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-4">
            {paths.map((x) => (
              <Link key={x.no} href={p(x.href)} className="lift card flex min-h-[205px] flex-col p-6">
                <div className="mb-5 text-[10px] font-extrabold tracking-[.15em] text-[#e07a49]">{x.no}</div>
                <h3 className="text-lg font-bold tracking-[-.4px] text-[#171717]">{x.title}</h3>
                <p className="mb-5 mt-2 text-[13px] leading-snug text-[#6e6a63]">{x.desc}</p>
                {/* CTA 文案（home.entryFind/Cluster/Verify/RfqCta）字典值自带尾部「→」，
                    此处不再追加箭头，否则渲染成「Browse Suppliers → →」。 */}
                <span className="muted-link mt-auto">{x.cta}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Live 采购需求（空态，如实） ──────────────────────── */}
      <section className="bg-[#f5f3ee] py-[68px]">
        <div className="container">
          <div className="mb-11 max-w-[720px]">
            <span className="kicker">{t.home.liveTitle}</span>
            <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
              {t.home.liveLead}
            </h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#ddd9d0] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ddd9d0] px-5 py-4">
              <span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#1f7a5a]">
                <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-[#1f7a5a]" />
                {t.home.liveTitle}
              </span>
              <Link href={p("/rfq")} className="btn btn-outline btn-sm">
                {t.home.liveEmptyCta} →
              </Link>
            </div>

            <div className="bg-gradient-to-b from-white to-[#fbfaf7] px-7 py-12 text-center">
              <div
                aria-hidden="true"
                className="mx-auto mb-4 grid grid-cols-1 h-12 w-12 place-items-center rounded-[13px] bg-[#f7e7de] text-lg font-extrabold text-[#e07a49]"
              >
                +
              </div>
              <h3 className="text-xl font-bold tracking-[-.5px] text-[#171717]">{t.home.liveEmptyTitle}</h3>
              <p className="mx-auto mt-2 max-w-[520px] text-[13px] text-[#77726a]">{t.home.liveEmptyLead}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href={p("/rfq")} data-track={ANALYTICS_EVENTS.homeRfqClick} className="btn btn-primary btn-sm">
                  {t.nav.postRfq}
                </Link>
                <Link href={p("/suppliers")} className="btn btn-outline btn-sm">
                  {t.home.ctaPrimary}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. 工业集群（数据源 = lib/coverage.ts 的 5 国） ──────── */}
      <section className="bg-white py-[92px]">
        <div className="container">
          <div className="mb-11 flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-[720px]">
              <span className="kicker">{t.home.clustersTitle}</span>
              <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
                {t.home.clustersLead}
              </h2>
            </div>
            <Link href={p("/industrial-clusters")} className="btn btn-outline btn-sm">
              {t.home.clustersCta}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.1fr_.9fr]">
            <Link
              href={p("/industrial-clusters")}
              className="relative flex min-h-[335px] flex-col overflow-hidden rounded-[17px] bg-[#1d1d1b] p-8 text-white"
            >
              {/* 设计稿 .cluster-feature::after 的装饰圆环。左卡高度被右侧 2×2 卡片带撑高，
                  而真实文案（coverageTitle 27 字符）比设计稿的示例句短 ⇒ 不补内容时中段会留一块
                  无意图空白。下面两块标签用的都是**已存在但全站零接线**的真实键/数据。 */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-[125px] -right-[105px] h-[310px] w-[310px] rounded-full border border-white/[.08] shadow-[0_0_0_36px_rgba(255,255,255,.02),0_0_0_72px_rgba(255,255,255,.015)]"
              />
              <div className="relative z-10">
                <span className="kicker kicker-light">{t.home.coveragePhase}</span>
                <h3 className="mt-2.5 max-w-[490px] text-[31px] font-extrabold leading-[1.06] tracking-[-1.1px]">
                  {t.home.coverageTitle}
                </h3>
                <p className="mt-4 max-w-[515px] text-sm text-[#c8c5be]">{t.home.coverageLead}</p>
              </div>
              <div className="relative z-10 mt-6">
                {/* coverageService1-3 是 9 语已有的真实键，此前**没有任何组件引用**
                    （等于三份翻译白付），这里接线。版式取自设计稿的 .coverage-tags span。 */}
                <div className="flex flex-wrap gap-[7px]">
                  {[t.home.coverageService1, t.home.coverageService2, t.home.coverageService3].map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-white/10 px-[7px] py-[5px] text-[10px] text-[#d4d0c7]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                {/* 覆盖国家直接取自 lib/coverage.ts，不另存一份名单 */}
                <div className="mt-2.5 flex flex-wrap gap-[7px]">
                  {COVERAGE_COUNTRIES.map((c) => (
                    <span
                      key={c.code}
                      className="rounded-full border border-white/10 px-[7px] py-[5px] text-[10px] text-[#9b978f]"
                    >
                      {pickZhPair(locale, c.name, c.nameZh)}
                    </span>
                  ))}
                </div>
              </div>
              {/* clustersCta =「Explore Industrial Clusters →」自带箭头，不再追加 */}
              <span className="muted-link relative z-10 mt-auto pt-6 text-white">{t.home.clustersCta}</span>
            </Link>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {COVERAGE_COUNTRIES.slice(0, 4).map((c) => (
                <Link
                  key={c.code}
                  href={p(`/countries/${c.slug}`)}
                  className="lift card flex min-h-[145px] flex-col justify-between p-5"
                >
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#8c8982]">
                      {pickZhPair(locale, c.name, c.nameZh)}
                    </span>
                    <h4 className="mb-1 mt-2 text-base font-bold tracking-[-.3px] text-[#171717]">
                      {t.home.capVerification}
                    </h4>
                    <p className="text-[12.5px] text-[#78736b]">{pickZhCopy(locale, c).hook}</p>
                  </div>
                  <span className="muted-link mt-3">
                    {t.home.coverageCta} <span aria-hidden="true">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. 四步流程（home.howSteps） ────────────────────────── */}
      <section className="bg-[#f5f3ee] py-[92px]">
        <div className="container">
          <div className="mb-11 max-w-[720px]">
            <span className="kicker">{t.home.howTitle}</span>
            <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
              {t.home.howLead}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {t.home.howSteps.map((step, i) => (
              <div
                key={step.title}
                className="lg:border-r lg:border-[#ddd9d0] lg:px-7 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
              >
                <div className="text-[28px] font-extrabold leading-none tracking-[-1.3px] text-[#d8d3c9]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mb-2 mt-4 text-[17px] font-bold text-[#171717]">{step.title}</h3>
                <p className="text-[13px] leading-relaxed text-[#777169]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. 8 个免费工具 ─────────────────────────────────────── */}
      <section className="bg-white py-[92px]">
        <div className="container">
          <div className="mb-11 flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-[720px]">
              <span className="kicker">{t.home.toolsTitle}</span>
              <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
                {t.home.toolsLead}
              </h2>
            </div>
            <Link href={p("/tools")} className="btn btn-outline btn-sm">
              {t.nav.tools} →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tools.map((x) => (
              <Link key={x.href} href={p(x.href)} className="lift card flex min-h-[178px] flex-col p-5">
                <span className="mb-3.5 grid grid-cols-1 h-[34px] w-[34px] place-items-center rounded-[9px] border border-[#ebe8e1] bg-[#f4f1eb]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#171717"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={x.icon} />
                  </svg>
                </span>
                <h3 className="text-[15px] font-bold tracking-[-.2px] text-[#171717]">{x.card.title}</h3>
                <p className="mb-3 mt-2 text-[12.5px] leading-snug text-[#78736b]">{x.card.desc}</p>
                <span className="mt-auto text-[10px] font-extrabold uppercase tracking-[.1em] text-[#1f7a5a]">
                  {t.pricing.plans[0].price}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. 6 项服务（SERVICE_MENU） ────────────────────────── */}
      <section className="bg-[#f5f3ee] py-[92px]">
        <div className="container">
          <div className="mb-11 flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-[720px]">
              <span className="kicker">{t.servicesIndex.servicesTitle}</span>
              <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
                {t.servicesIndex.servicesLead}
              </h2>
            </div>
            <Link href={p("/services")} className="btn btn-outline btn-sm">
              {t.servicesIndex.servicesTitle} →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <Link key={s.href} href={p(s.href)} className="lift card flex min-h-[210px] flex-col p-6">
                <div className="mb-3.5 text-[10px] font-extrabold uppercase tracking-[.11em] text-[#e07a49]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-[19px] font-bold tracking-[-.45px] text-[#171717]">{s.title}</h3>
                <p className="mb-4 mt-2 text-[13px] leading-relaxed text-[#747068]">{s.desc}</p>
                <span className="muted-link mt-auto">
                  {t.servicesIndex.servicesTitle} <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. 为什么选择（home.why1–4） ────────────────────────── */}
      <section className="bg-white py-[92px]">
        <div className="container">
          <div className="mb-11 text-center">
            <span className="kicker">{t.home.whyTitle}</span>
            <h2 className="mx-auto max-w-[820px] text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
              {t.home.whyLead}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(([title, body]) => (
              <div key={title} className="border-t-2 border-[#171717] bg-white p-6">
                <h3 className="mb-2 text-base font-bold text-[#171717]">{title}</h3>
                <p className="text-[13px] leading-relaxed text-[#726e67]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. 覆盖范围（深色带） ───────────────────────────────── */}
      <section className="bg-[#1d1d1b] py-[92px] text-white">
        <div className="container">
          <div className="mb-11 flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-[720px]">
              <span className="kicker kicker-light">{t.home.coveragePhase}</span>
              <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px]">
                {t.home.coverageTitle}
              </h2>
              <p className="mt-3 text-[#bcb8af]">{t.home.coverageLead}</p>
            </div>
            <Link href={p("/countries")} className="btn btn-light btn-sm">
              {t.home.coverageCta}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {COVERAGE_COUNTRIES.map((c) => (
              <Link
                key={c.code}
                href={p(`/countries/${c.slug}`)}
                className="rounded-[14px] border border-white/[.11] bg-white/[.04] p-6 transition hover:bg-white/[.065]"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[17px] font-bold">{pickZhPair(locale, c.name, c.nameZh)}</h3>
                  <span className="text-[10px] uppercase tracking-[.1em] text-[#9b978f]">{c.code}</span>
                </div>
                <p className="my-3 text-[12.5px] leading-relaxed text-[#bbb7af]">{pickZhCopy(locale, c).hook}</p>
                <div className="flex flex-wrap gap-2">
                  {[t.home.capVerification, t.home.capAudit].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-[#d4d0c7]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}

            <div className="rounded-[14px] border border-white/[.11] bg-white/[.04] p-6">
              <h3 className="text-[17px] font-bold">{t.home.otherRegionTitle}</h3>
              <p className="my-3 text-[12.5px] leading-relaxed text-[#bbb7af]">{t.home.otherRegionBody}</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-[#d4d0c7]">
                  {t.home.coverageCta}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-5 rounded-[14px] border border-dashed border-white/20 px-5 py-5 text-[12.5px] text-[#c7c2b9]">
            <span>{t.home.otherRegionBody}</span>
            <Link href={p("/rfq")} className="muted-link text-white">
              {t.home.otherRegionCta} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 10. 价格预览（pricing.plans） ───────────────────────── */}
      <section className="bg-[#f5f3ee] py-[92px]">
        <div className="container">
          <div className="mb-11 flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-[720px]">
              <span className="kicker">{t.pricing.plansTitle}</span>
              <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
                {t.pricing.plansLead}
              </h2>
            </div>
            <Link href={p("/pricing")} className="btn btn-outline btn-sm">
              {t.pricing.h1} →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-[13px] lg:grid-cols-3">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
                className={`card relative flex min-h-[360px] flex-col p-6 ${
                  i === recommendedIndex ? "border-[#d9a18a] shadow-[0_18px_44px_rgba(224,122,73,.1)]" : ""
                }`}
              >
                {i === recommendedIndex && (
                  <span className="absolute -top-3 left-5 rounded-full bg-[#e07a49] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-white">
                    {t.pricing.recommendedTag}
                  </span>
                )}
                <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[.11em] text-[#e07a49]">
                  {plan.name}
                </div>
                <div className="mb-2 text-[29px] font-extrabold tracking-[-1px] text-[#171717]">
                  {plan.price}{" "}
                  <span className="text-xs font-semibold tracking-normal text-[#7f7a72]">{plan.note}</span>
                </div>
                <ul className="mb-5 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12.5px] text-[#5e5a54]">
                      <span aria-hidden="true" className="mt-px text-[11px] font-extrabold text-[#1f7a5a]">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p(plan.href)}
                  className={`btn w-full ${i === recommendedIndex ? "btn-primary" : "btn-outline"}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-5 text-xs leading-relaxed text-[#7c776f]">
            <strong className="text-[#171717]">{t.pricing.alsoTitle}:</strong> {t.pricing.comingSoonNote}
          </p>
        </div>
      </section>

      {/* ── 11. 资源（GUIDES） ─────────────────────────────────── */}
      <section className="bg-white py-[92px]">
        <div className="container">
          <div className="mb-11 flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-[720px]">
              <span className="kicker">{t.home.guidesTitle}</span>
              <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
                {t.home.guidesLead}
              </h2>
            </div>
            <Link href={p("/resources")} className="btn btn-outline btn-sm">
              {t.resourcesIndex.badge} →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-[13px] md:grid-cols-3">
            {guides.map((g) => (
              <Link
                key={g.slug}
                href={p(`/guides/${g.slug}`)}
                className="lift card flex min-h-[205px] flex-col p-6"
              >
                <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[#e07a49]">
                  {t.resourcesIndex.cat[g.cat as keyof typeof t.resourcesIndex.cat]?.title ?? g.cat}
                </div>
                <h3 className="mb-2 mt-3 text-lg font-bold leading-snug tracking-[-.35px] text-[#171717]">
                  {g.title}
                </h3>
                <p className="mb-4 text-[12.5px] leading-snug text-[#777169]">{g.desc}</p>
                <span className="muted-link mt-auto">
                  {t.nav.resources} <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 12. 收尾 CTA ───────────────────────────────────────── */}
      <section className="border-y border-[#efd4c6] bg-[#f7e7de] py-[74px]">
        <div className="container flex flex-col items-start justify-between gap-9 lg:flex-row lg:items-center">
          <div>
            <span className="kicker">{t.home.bottomTitle}</span>
            <h2 className="mt-3 max-w-[630px] text-[clamp(26px,3vw,42px)] font-extrabold leading-[1.05] tracking-[-1.4px] text-[#171717]">
              {t.home.bottomLead}
            </h2>
          </div>
          <div className="flex flex-none flex-wrap gap-3">
            <Link href={p("/rfq")} data-track={ANALYTICS_EVENTS.homeRfqClick} className="btn btn-primary">
              {t.home.bottomCta}
            </Link>
            <Link href={p("/custom-services")} className="btn btn-outline">
              {t.home.ctaHighIntent}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

// 🔴 不得声明 revalidate（2026-10-07 实测钉死）：OpenNext 的 cache interception 会**绕开**声明了 revalidate 的路由，改交给 Worker 运行时 SSR ⇒ prerender-manifest 里 initialRevalidateSeconds=3600 ⇒ 每请求现场渲染 ⇒ 撞 Workers 128MB 内存上限 ⇒ `error code: 1102` / HTTP 503 ⇒ Google 抓取失败、crawl budget 崩。只读 staticAssetsIncrementalCache 下 revalidate 本就永不生效（set() 是 no-op），删掉零功能损失；要真 ISR 请改 r2IncrementalCache（见 open-next.config.ts 注释）。
