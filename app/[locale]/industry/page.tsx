import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { industryDisplayName, listIndustries, getSeoMatrix } from "@/lib/taxonomy";
import { topicsForIndustry } from "@/lib/industryContent";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhPair } from "@/lib/tw";
import IndustryPreview, { type PreviewIndustry } from "@/components/industry/IndustryPreview";

const PATH = "/industry";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

/**
 * 行业枢纽页（版式 = 用户定稿 preview (2).html，五个区块逐一对齐）。
 *
 * 区块映射：① hero + .heroCard 搜索卡 → ② .industryGrid 13 张编号卡
 *          → ③ section#detail 的 .detailWrap（.tabs + 深色 .detail 卡）
 *          → ④ .serviceGrid 5 项 → ⑤ .finalBox 收尾
 *
 * 与设计稿的**有意偏离**（全是硬约束，不是偷懒）：
 *   1) 行业数量：设计稿写死 8 个。本站真实行业见 lib/staticData.ts:STATIC_INDUSTRIES
 *      共 13 个（用户已确认「用站点真实 13 个行业」）。卡片由 listIndustries() 驱动，
 *      加一行即自动接住，页面代码零改动。
 *   2) 深色详情卡的第二列：设计稿是「核验重点」样板文案，本站 13 个行业里只有
 *      food-beverage / chemicals 在 lib/industryContent.ts 配了真实子主题。按 §44 质量门
 *      「没有配置就不填模板套话」，该列仅在确有其内容时出现（其余行业只渲染真实审核项列）。
 *   3) 文案：h1「Source smarter across China's manufacturing industries.」含营销措辞，
 *      与全站「禁营销词 / 禁无据声称」冲突，且新增字典键会触发 en 叶子数闸门（3192）。
 *      此处全部复用既有 9 语键（home.* / industryPage.* / servicesIndex.* / common.*），
 *      零新增翻译、零闸门改动。
 */

/** 工作流带 5 步：Discover / Verify / Audit / Inspect / Source。
 *  文案全部复用既有键（home.evaluate|verify|audit* + servicesIndex.items.*），
 *  不新增字典键；href 走服务单一事实源同款真实路由。 */
const FLOW_KEYS = ["evaluate", "verify", "audit", "inspect", "source"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.industryPage.breadcrumb,
    description: t.industryPage.hubMetaDesc,
  });
}

export default async function IndustryHubPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = t.industryPage;
  const lp = (href: string) => localePath(locale, href);

  const industries = await listIndustries();
  const cards = industries.map((i, idx) => ({
    code: i.code,
    no: String(idx + 1).padStart(2, "0"),
    name: industryDisplayName(locale, i.name),
    topics: topicsForIndustry(i.code),
  }));

  /** 工作流带：3 步复用 home.*，后 2 步复用 servicesIndex.items.*（都已 9 语就位） */
  const flow = [
    { key: FLOW_KEYS[0], title: t.home.evaluateTitle, body: t.home.evaluateBody, href: "/tools/supplier-risk-assessment" },
    { key: FLOW_KEYS[1], title: t.home.verifyTitle, body: t.home.verifyBody, href: "/services/supplier-verification" },
    { key: FLOW_KEYS[2], title: t.home.auditTitle, body: t.home.auditBody, href: "/factory-audit/request" },
    { key: FLOW_KEYS[3], title: t.servicesIndex.items.inspection.title, body: t.servicesIndex.items.inspection.desc, href: "/services/inspection" },
    { key: FLOW_KEYS[4], title: t.servicesIndex.items.sourcing.title, body: t.servicesIndex.items.sourcing.desc, href: "/rfq" },
  ];

  /** Hero 快捷片：取前 4 个真实行业，点击即进该行业详情（非装饰标签） */
  const chips = cards.slice(0, 4);

  /**
   * 行业详情预览区（版式 = p2 section#detail）。
   * 审核项来自 getSeoMatrix() 的真实 auditTypes；排序规则与 /industry/[slug] 完全一致：
   * 该行业子主题挂着的 programCode 顶到前面，其余保持字母序 —— 没有子主题的行业排序不变。
   */
  const { auditTypes } = await getSeoMatrix();
  const previewItems: PreviewIndustry[] = cards.map((x) => {
    const topics = topicsForIndustry(x.code);
    const industryPrograms = new Set(
      topics.flatMap((tp) => tp.programCodes ?? (tp.programCode ? [tp.programCode] : []))
    );
    const ordered =
      industryPrograms.size === 0
        ? auditTypes
        : [...auditTypes].sort((a, b) => {
            const av = industryPrograms.has(a.code) ? 0 : 1;
            const bv = industryPrograms.has(b.code) ? 0 : 1;
            return av - bv || a.code.localeCompare(b.code);
          });
    const auditNames = ordered.slice(0, 6).map((a) => a.nameEn);
    const topicTitles = topics.map((tp) => pickZhPair(locale, tp.title.en, tp.title.zh));

    return {
      code: x.code,
      no: x.no,
      name: x.name,
      href: lp(`/industry/${x.code}`),
      intro: p.whyLead,
      // 设计稿的 chips 与第一列列表同源（都是 x.p）——照做，取同一份真实审核项的前 5 项。
      chips: auditNames.slice(0, 5),
      auditHeading: p.relatedAudit,
      auditNames,
      topicsHeading: topicTitles.length > 0 ? p.topicsTitle.replaceAll("{industry}", x.name) : null,
      topicTitles,
      ctaPrimaryLabel: p.ctaButton,
      ctaPrimaryHref: lp("/rfq"),
      ctaGhostLabel: t.home.entryVerifyCta,
      ctaGhostHref: lp("/services/supplier-verification"),
    };
  });

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: p.breadcrumb,
      url: `${BASE}${lp(PATH)}`,
      numberOfItems: cards.length,
      itemListElement: cards.map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: x.name,
        url: `${BASE}${lp(`/industry/${x.code}`)}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: t.common.ui.home,
          item: `${BASE}${lp("/")}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: p.breadcrumb,
          item: `${BASE}${lp(PATH)}`,
        },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* ── 1. HERO（左文案 + 右搜索卡，同设计稿 heroGrid） ─────────── */}
      <section className="border-b border-[#ddd9d0] bg-[#f5f3ee]">
        <div className="container pb-16 pt-14 lg:pb-20 lg:pt-16">
          <nav className="mb-[18px] text-[12.5px] text-[#6d6b66]">
            <Link href={lp("/")} className="hover:text-[#e07a49] hover:underline">
              {t.common.ui.home}
            </Link>
            <span className="mx-1.5 text-[#b6b1a8]">/</span>
            <span>{p.breadcrumb}</span>
          </nav>

          <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-[1.15fr_.85fr]">
            <div>
              <span className="kicker">{t.home.badge}</span>
              <h1 className="mt-1 text-[clamp(36px,4.9vw,60px)] font-extrabold leading-[1.04] tracking-[-2px] text-[#171717]">
                {p.breadcrumb}
              </h1>
              <p className="mt-5 max-w-[670px] text-[17px] leading-relaxed text-[#55524d]">
                {p.hubLead}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={lp("/suppliers")} className="btn btn-primary">
                  {t.home.ctaPrimary}
                </Link>
                <Link href={lp("/services/supplier-verification")} className="btn btn-outline">
                  {t.home.ctaSecondary}
                </Link>
              </div>
            </div>

            {/* 搜索卡：版式对齐 p2 的 .heroCard（r18 / 1px 描边 / #fafafa / padding 25）
                与 .search（白底 + 描边 + padding 8 的**一体式**输入行，按钮为 ink 深色 r7）。
                注意：p2 这里刻意用深色按钮，而 p1 首页的 .search-btn 用 accent 橙 —— 两个设计稿
                自己就不一致，本页按 p2 走，颜色差异是有意保留的，不是漏改。
                表单是纯 GET 提交到 /suppliers?q=，不依赖 JS；/suppliers 现有实现按 ?q= 做客户端过滤。 */}
            <div className="rounded-[18px] border border-[#ddd9d0] bg-[#fafafa] p-[25px]">
              <h2 className="m-0 text-[18px] font-bold tracking-[-.4px] text-[#171717]">
                {t.home.entryFindTitle}
              </h2>
              <p className="mt-[7px] text-[14px] text-[#6d6b66]">{t.home.entryFindDesc}</p>

              <form
                action={lp("/suppliers")}
                method="get"
                className="mt-[18px] flex gap-2 rounded-[10px] border border-[#ddd9d0] bg-white p-2"
              >
                <label className="sr-only" htmlFor="hub-q">
                  {t.common.heroSearch.tabProduct}
                </label>
                <input
                  id="hub-q"
                  name="q"
                  type="text"
                  className="min-w-0 flex-1 border-0 bg-transparent px-[7px] py-[5px] text-[14px] text-[#171717] outline-none placeholder:text-[#9b978f]"
                  placeholder={t.common.heroSearch.placeholderProduct}
                />
                <button
                  type="submit"
                  className="flex-none whitespace-nowrap rounded-[7px] bg-[#171717] px-[13px] py-[10px] text-[13.5px] font-bold text-white transition hover:bg-[#2b2b2b]"
                >
                  {t.common.heroSearch.search}
                </button>
              </form>

              <div className="mt-3.5 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <Link
                    key={c.code}
                    href={lp(`/industry/${c.code}`)}
                    className="rounded-full border border-[#ddd9d0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#55524d] transition hover:border-[#e07a49] hover:text-[#c96235]"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. 行业网格（13 个真实行业，编号卡片） ────────────────── */}
      <section className="bg-[#fbfaf7] py-[92px]">
        <div className="container">
          <div className="mb-11 max-w-[760px]">
            <span className="kicker">{t.about.stats[1].label}</span>
            <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
              {p.breadcrumb}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((x) => (
              <Link
                key={x.code}
                href={lp(`/industry/${x.code}`)}
                className="lift card flex min-h-[205px] flex-col p-[22px]"
              >
                {/* 版式对齐 p2：.num 11px/800/ls .12em/mb 20、.industry padding 22 / min-height 205、
                    .industry h3 19px/1.24、.arrow accent 13px/800、.industryGrid 4 列 gap 16。
                    .industry 本身是 flex + justify-between（设计稿自带的高度分配机制），
                    故内容少时余量落在标题与箭头之间，读作留白，不是缺失。
                    ⚠️ 本站没有逐行业的「一句话行业说明」（设计稿 x.s 是它对 8 个行业的样板填充），
                    只有 food-beverage / chemicals 在 lib/industryContent.ts 有真实内容 ⇒
                    不在中间塞编造的行业描述，那一段由③详情预览区的真实审核项承接。 */}
                <div className="mb-5 text-[11px] font-extrabold tracking-[.12em] text-[#e07a49]">
                  {x.no}
                </div>
                <h3 className="text-[19px] font-bold leading-[1.24] tracking-[-.45px] text-[#171717]">{x.name}</h3>

                {/* 子主题只在 lib/industryContent.ts 配了内容的行业才渲染。
                    未配置就只留行业名 —— 绝不用模板套话填充（§44 质量门）。 */}
                {x.topics.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[12.5px]">
                    {x.topics.map((tp) => (
                      <li key={tp.slug} className="text-[#6d6b66]">
                        {pickZhPair(locale, tp.title.en, tp.title.zh)}
                      </li>
                    ))}
                  </ul>
                )}

                {/* p2 的 .arrow 文案是「Explore industry →」；9 语里没有对应键，而新增键会动
                    en 叶子数 3192 这道闸门（常量散在 20 个脚本里）⇒ 复用已有的
                    home.entryFindCta（「Browse Suppliers →」，自带箭头）。
                    语义准确：点击进入该行业页，页上正是该行业的供应商名录与审核项。 */}
                <span aria-hidden="true" className="mt-auto pt-5 text-[13px] font-extrabold text-[#e07a49]">
                  {t.home.entryFindCta}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. 行业详情预览（版式 = p2 section#detail 的 .detailWrap） ──────────
          左侧 .tabs = 13 个真实行业，右侧深色 .detail 卡展示该行业页的真实结构：
          行业名 / 该页的 whyLead / 真实审核项（getSeoMatrix）/ 真实子主题（industryContent）。
          切换用客户端状态，不进 searchParams（本页是预渲染页，读 searchParams 恒为空）。
          区块标题复用三枚零接线键（home.workflowEyebrow/Title/Lead，9 语早已就位但全站未用）。 */}
      <section className="border-y border-[#ddd9d0] bg-[#f5f3ee] py-[92px]">
        <div className="container">
          <div className="mb-11 max-w-[760px]">
            <span className="kicker">{t.home.workflowEyebrow}</span>
            <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
              {t.home.workflowTitle}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6d6b66]">{t.home.workflowLead}</p>
          </div>

          <IndustryPreview kickerLabel={p.breadcrumb} items={previewItems} />
        </div>
      </section>

      {/* ── 4. 工作流带：Discover → Verify → Audit → Inspect → Source ──
          背景：p2 的 #services 是普通 .section（落在 body 白底上），故这里用 bg-white；
          相邻区块才是 .soft（纸感底），几段因此有明暗节奏。 */}
      <section className="border-y border-[#ddd9d0] bg-white py-[92px]">
        <div className="container">
          <div className="mb-11 max-w-[760px]">
            <span className="kicker">{t.home.howTitle}</span>
            <h2 className="text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.06] tracking-[-1.4px] text-[#171717]">
              {t.home.howLead}
            </h2>
          </div>

          {/* 版式对齐 p2 的 .serviceGrid / .service：5 列、gap 14px、白底 1px 描边 r12 p20，
              标题 15px ink（.service strong）+ 说明 13px muted（.service span）。
              **不加序号** —— 设计稿这里是纯标题+说明，序号是 p1 的 .flow-no，属于另一套版式，混用会失真。 */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {flow.map((s) => (
              <Link key={s.key} href={lp(s.href)} className="lift rounded-[12px] border border-[#ddd9d0] bg-white p-5">
                <strong className="mb-1.5 block text-[15px] font-bold tracking-[-.2px] text-[#171717]">
                  {s.title}
                </strong>
                <span className="text-[13px] leading-snug text-[#6d6b66]">{s.body}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. 收尾 CTA（版式对齐 p2 的 .finalBox：白底 + 1px 描边 + r18 + padding 32/34，
             横向 justify-between、垂直居中；h2 32px + 下方 p）。
             文案键映射同时校正：设计稿是「标题 + 说明」两行，不是「kicker + 标题」，
             故 h2 用 entryRfqTitle、p 用 entryRfqDesc（此前误把 Title 当 kicker、Desc 当标题）。 */}
      <section className="border-t border-[#ddd9d0] bg-[#f5f3ee] py-[76px]">
        <div className="container">
          <div className="flex flex-col items-start justify-between gap-6 rounded-[18px] border border-[#ddd9d0] bg-white px-[34px] py-[32px] lg:flex-row lg:items-center">
            <div>
              <h2 className="m-0 max-w-[630px] text-[32px] font-extrabold leading-[1.08] tracking-[-.7px] text-[#171717]">
                {t.home.entryRfqTitle}
              </h2>
              <p className="mt-[7px] max-w-[620px] text-[14px] text-[#6d6b66]">{t.home.entryRfqDesc}</p>
            </div>
            <div className="flex flex-none flex-wrap gap-3">
              <Link href={lp("/rfq")} className="btn btn-primary">
                {t.home.entryRfqCta}
              </Link>
              <Link href={lp("/suppliers")} className="btn btn-outline">
                {t.home.ctaPrimary}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
