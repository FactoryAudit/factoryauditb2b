import Link from "next/link";
import VerificationBadge, {
  type BadgeState,
  type TrustProfileDict,
} from "./VerificationBadge";
import { supplierDisplayName } from "@/lib/supplierDisplayName";
import { countryDisplayName } from "@/lib/countryNames";
import DirectorySortSelect from "./DirectorySortSelect";
import type { Locale } from "@/i18n/config";

/**
 * stage1.8：/suppliers 目录的**展示层**（纯组件 —— 无 state、无 hooks、无副作用）。
 *
 * 为什么要把这段标记从 `app/[locale]/suppliers/page.tsx` 抽出来：
 *   目录页已从「动态渲染」改为「预渲染（构建期冻结）」，过滤改由客户端完成。
 *   但预渲染有一条硬要求 —— **首屏 HTML 必须始终带完整列表**（SEO + 无 JS 可读），
 *   而 `useSearchParams()` 的客户端组件在静态路由下只能客户端渲染。
 *   于是同一套标记需要被渲染两次：
 *     ① 服务端 —— 首屏 HTML（同时也是 Suspense 的 fallback，见 page.tsx）
 *     ② 客户端 —— DirectoryGrid 按 URL 过滤后的结果
 *   抽成单一组件是为了保证两处**逐字一致**，任何人改文案都不可能只改一边。
 *
 * 🔴 本组件不计算任何业务值（这是「服务端唯一权威」铁律的落点）：
 *    等级文案、风险文案与颜色、证据文案、最后核验日期、徽章状态
 *    全部由服务端算好放进 `items`（见 page.tsx 的 `items` 构造处）。
 *    客户端只做「按 URL 过滤 + 渲染」，不做任何判断。
 *
 * ── 2026-10-28：目录墙拆除（公司名公开） ────────────────────────────────────
 *   原「阶段 1 登录墙」（2026-09-30）让未登录视图连公司名都不渲染，只画骨架条。
 *   实测后果：预渲染 HTML 的目录页**一个公司名都没有** ⇒ 对 Google 是「无实质内容页」，
 *   且 32 家档案失去站内锚文本（线上 1286 条「已发现·尚未编入索引」的成因之一）。
 *   现在：公司名 / 城市 / 产品 / 业务类型 / 证据计数 / 核验等级 / 风险 全部公开。
 *   联系方式（邮箱 / 电话 / WhatsApp / 详细地址）本就不在本页字段内，
 *   仍由档案页的登录门控负责 —— 拆墙不新增任何联系方式泄露面。
 *
 *   `items[].locked` 语义已收窄为「联系方式未解锁」，**只影响 CTA 文案与埋点**，
 *   不再影响公司名渲染。脱敏/解锁规则唯一实现在 `lib/directoryWall.ts`。
 *   🔴 预渲染的公开 HTML 恒为 locked 视图（服务端不读 cookie，
 *      否则退化成 ƒ Dynamic ⇒ CF Workers Free CPU 超限 5xx）；
 *      已登录视图由客户端 hydration 后从 /api/suppliers/directory 取得。
 */

/** 单张目录卡片所需的**已收口**数据（派生值全部由服务端算好）。 */
export type DirectoryItem = {
  slug: string;
  legalName: string;
  /**
   * CS-12 / P1-16：企业对外自称的英文名（DB suppliers.english_name）。
   * 与 `legalName`（工商登记名）并列；展示请用 `supplierDisplayName(locale, x)`，
   * **不要**直读本字段 —— 语种回退规则只有一处（lib/supplierDisplayName.ts）。
   */
  englishName: string;
  /** 原始国家值（筛选口径；展示请用 countryLabel） */
  country: string;
  /** 展示用国家名：countryName ?? country.toUpperCase() */
  countryLabel: string;
  city: string;
  /** 行业代码（筛选口径；不渲染） */
  industryCode: string;
  mainProducts: string[];
  /** 已收口：「—」兜底在服务端完成 */
  businessType: string;
  /** 已收口：有证据 → evidenceDocs.replace("{n}", n)，否则 evidenceNone */
  evidenceText: string;
  /** 已收口：level === 0 → verificationNotYet，否则 levelsShort[level] */
  verificationText: string;
  /** 已收口：riskLabel(score, levelLabels) */
  riskText: string;
  /** 已收口：有分数 → LEVEL_COLOR[overallLevel]，无分数 → 中性灰 #6d6b66 */
  riskColor: string;
  /** 已收口：lastChecked ?? noCheckRecord */
  lastCheckedText: string;
  /** 服务端推导的徽章状态（客户端绝不自判） */
  badgeState: BadgeState;
  /** 自述公司简介（公开层，已滤掉广交会拼接假简介）；无则空串，渲染层不显示 */
  companyDescription: string;
  /** 员工规模（公开层）；无则空串 */
  employees: string;
  /** 成立年份（公开层）；无则 0，渲染层不显示 */
  established: number;
};

/**
 * 渲染用的目录条目 = **已收口数据**（DirectoryItem）+ 服务端决定的可见性。
 *
 * 为什么把这两层拆开（阶段 1）：
 *   `DirectoryItem` 是"卡片表达什么内容"（与访问者无关，可缓存、可复用）；
 *   `DirectoryEntry` 是"这个访问者能看什么、点了去哪"（随登录态变化）。
 *   构造逻辑只写一次（lib/directoryItems.ts），可见性只由 lib/directoryWall.ts 决定。
 *   两处若混在一起，就很容易出现「页面按 A 规则渲染、接口按 B 规则下发」的静默漂移。
 */
export type DirectoryEntry = DirectoryItem & {
  /**
   * 卡片跳转目标（**服务端算好**，客户端不做任何拼接）。
   *
   * 锁定态（未登录）→ 🔴 2026-10-12 起同样指向真实档案页 `/suppliers/<slug>`。
   *   原为登录页（`?next=<目录页>`）—— 那会让 32 家公开档案页在站内 0 入口，
   *   Google 判「无人引用」⇒「已发现·尚未编入索引」。档案页公开且已进 sitemap，
   *   slug 早已在本页 JSON-LD 出现，故改指档案页不新增泄露面。
   * 解锁态（已登录）→ 真实档案地址 `/suppliers/<slug>`。
   */
  href: string;
  /**
   * 名称是否被登录墙遮蔽（阶段 1）。
   * true ⇒ 渲染层**只画骨架条**，绝不渲染 legalName（此时它已被置为空串）。
   */
  locked: boolean;
  /** 卡片 CTA 文案（服务端算好：锁定 → 登录；解锁 → View Supplier） */
  cta: string;
};

/** 目录区块用到的字典片段（只取需要的键，避免把整本字典推进客户端）。 */
export type DirectoryDict = {
  searchPlaceholder: string;
  searchButton: string;
  searchClear: string;
  filterCountry: string;
  filterIndustry: string;
  filterProduct: string;
  filterSubmit: string;
  filterReset: string;
  filterAll: string;
  featuredTitle: string;
  featuredLead: string;
  countLabel: string;
  trustNote: string;
  empty: string;
  businessTypeLabel: string;
  evidenceLevel: string;
  verificationLabel: string;
  riskLabel: string;
  riskNote: string;
  lastEvidence: string;
  // 2026-11-25 按 aguato 目录样式补齐：全部复用既有键，零新增翻译叶子。
  seeMore: string;
  sortByScore: string;
  sortByName: string;
  employeesLabel: string;
  establishedTemplate: string;
  selfReported: string;
  scoredOnlyLabel: string;
  // 阶段 1 移除 `cardCta`：卡片 CTA 现有两种可见性（锁定 → 登录 / 解锁 → View Supplier），
  // 由服务端算好放进 `items[].cta`。这里再留一个"看起来能改卡片文案"的字段只会误导。
};

/** 埋点事件名（值直接取自 lib/analytics.ts，不在本组件里硬编码字符串）。 */
export type DirectoryEvents = {
  directorySearch: string;
  directoryFilter: string;
  profileView: string;
};

/** 当前过滤条件：空串 = 该维度不筛选（与改造前 searchParams 缺省语义一致）。 */
export type DirectoryActive = {
  country: string;
  industry: string;
  q: string;
  /** 页码（1 起）。仅用于判断分页高亮，不参与数据派生。 */
  page?: number;
  /** 排序：score=最佳匹配（默认），name=公司名。 */
  sort?: "score" | "name";
  /** 只看有真实评分的供应商（筛选态，middleware 注入 noindex）。 */
  scored?: boolean;
};

/**
 * 分页信息。
 *
 * 🔴 为什么「全量卡片仍写进 HTML，只在前端切片」：
 *   R25 产物门已确立「目录页是档案页的**唯一**内链来源」。
 *   若服务端只渲染第 1 页 24 张，第 25 家以后的档案页在爬虫眼里就是**孤岛**，
 *   直接重演 2026-10 那批「已发现·尚未编入索引」。
 *   因此：服务端恒渲染全量（无 JS / 爬虫 / 首屏 HTML 都是完整列表），
 *   前端只在 hydration 后按 `?page=` 切片 —— 页面变轻，内链一条不少。
 */
export type DirectoryPager = { page: number; pageCount: number };

/** 无 logo 时的文字占位：取公司显示名首字，与 /categories 品类页一致。 */
function initialOf(name: string): string {
  const s = name.trim();
  if (!s) return "—";
  return Array.from(s)[0]?.toUpperCase() ?? "—";
}

export default function DirectoryView({
  items,
  countries,
  industries,
  active,
  directoryPath,
  locale,
  dict,
  events,
  trustProfileDict,
  total,
  pager,
  facetItems,
}: {
  /** 当前页要渲染的集合（无分页时即全量 / 过滤结果全量） */
  items: DirectoryEntry[];
  countries: string[];
  industries: string[];
  active: DirectoryActive;
  /**
   * 结果总数。分页后 `items` 只是某一页，计数标签必须用总数，
   * 否则会写成「24 suppliers」而实际有 100 家。
   * 缺省回落到 `items.length`（服务端无分页渲染时两者恒等）。
   */
  total?: number;
  /** 分页信息；缺省或 pageCount ≤ 1 时不渲染分页条 */
  pager?: DirectoryPager;
  /** 左侧筛选栏计数用的全量集合（过滤/分页后数字不跳动）；缺省回落 items。 */
  facetItems?: DirectoryEntry[];
  /** 已带语言前缀的目录页路径，如 /suppliers、/es/suppliers */
  directoryPath: string;
  /** 当前语言 —— 只用于 `supplierDisplayName` 决定卡片展示用登记名还是企业自述英文名 */
  locale: string;
  // 阶段 1：`supplierPathPrefix` 已移除 —— 卡片的 href 由服务端算好放进
  //   `items[].href`（🔴 2026-10-12 起锁定/解锁态**都**指档案页）。组件不再自己拼 URL，
  //   这样「哪些链接能出现在公开 HTML 里」只有一处决策点（见 lib/directoryWall.ts）。
  dict: DirectoryDict;
  events: DirectoryEvents;
  trustProfileDict: TrustProfileDict;
}) {
  const { country, industry, q } = active;
  const shown = total ?? items.length;
  const sort = active.sort ?? "score";
  const scored = active.scored === true;

  // 左侧筛选栏计数：从**未过滤全量**派生（客户端分页后数字不跳动）。
  const facetSource = facetItems ?? items;
  const facetCounts = (pick: (x: DirectoryEntry) => string[]) => {
    const m = new Map<string, number>();
    for (const x of facetSource) {
      for (const v of pick(x)) {
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const countryFacets = facetCounts((x) => [x.country]);
  const industryFacets = facetCounts((x) => [x.industryCode]);
  const productFacets = facetCounts((x) => x.mainProducts);
  const scoredCount = facetSource.filter((x) => x.riskText !== "—").length;

  // 单个筛选项：checkbox 外观 + 真实计数；用链接切换（可抓取、无 JS 可用）。
  const facetLink = (dim: "country" | "industry" | "q", value: string, label: string, count: number) => {
    const selected = dim === "country" ? country === value : dim === "industry" ? industry === value : q === value;
    const next = dim === "country"
      ? { country: selected ? null : value, page: null as number | null }
      : dim === "industry"
      ? { industry: selected ? null : value, page: null as number | null }
      : { q: selected ? null : value, page: null as number | null };
    return (
      <label key={`${dim}-${value}`} className="flex items-center justify-between gap-2 cursor-pointer text-sm text-[#3f4650] hover:text-[#171717]">
        <span className="flex items-center gap-2 min-w-0">
          <Link
            href={linkWith(next)}
            role="checkbox"
            aria-checked={selected}
            className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${selected ? "bg-[#171717] border-[#171717] text-white" : "border-[#ddd9d0]"}`}
            data-track={events.directoryFilter}
            data-track-value={value}
          >
            {selected ? "✓" : ""}
          </Link>
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 text-xs text-[#8c8982] tabular-nums">{count}</span>
      </label>
    );
  };

  const facetGroup = (title: string, dim: "country" | "industry" | "q", facets: [string, number][], labelOf?: (v: string) => string) => {
    if (facets.length === 0) return null;
    const row = (v: string, n: number) => facetLink(dim, v, labelOf ? labelOf(v) : v, n);
    return (
      <div className="pt-4 mt-4 border-t border-[#e8e6de]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#171717] mb-2">{title}</h3>
        <div className="space-y-1.5">{facets.slice(0, 5).map(([v, n]) => row(v, n))}</div>
        {facets.length > 5 && (
          <details className="mt-1">
            <summary className="text-sm text-[#e07a49] hover:underline cursor-pointer list-none">{dict.seeMore}</summary>
            <div className="space-y-1.5 mt-1.5">{facets.slice(5).map(([v, n]) => row(v, n))}</div>
          </details>
        )}
      </div>
    );
  };

  // 筛选做成链接而不是表单：可被抓取，也让「国家 + 行业 + 关键词」组合形成真实索引路径。
  // stage1.8：`directoryPath` 已含语言前缀，拼接 query 的结果与改造前
  //   `localePath(locale, "/suppliers?…")` 逐字一致。
  // 2026-10-31 分页：任何筛选变更都**丢弃页码**（回到第 1 页），
  //   否则「在第 5 页筛选一个国家只剩 3 家」会出现空页。
  const linkWith = (next: {
    country?: string | null;
    industry?: string | null;
    q?: string | null;
    page?: number | null;
    scored?: number | null;
  }) => {
    const params = new URLSearchParams();
    const c = next.country !== undefined ? next.country : country;
    const i = next.industry !== undefined ? next.industry : industry;
    const query = next.q !== undefined ? next.q : q;
    // page === undefined ⇒ 保持当前页；传 null ⇒ 回第 1 页；传数字 ⇒ 指定页
    const pg =
      next.page === undefined ? (active.page && active.page > 1 ? active.page : null) : next.page;
    if (c) params.set("country", c);
    if (i) params.set("industry", i);
    if (query) params.set("q", query);
    if (pg && pg > 1) params.set("page", String(pg));
    if (next.scored === 1) params.set("scored", "1");
    const qs = params.toString();
    return qs ? `${directoryPath}?${qs}` : directoryPath;
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-8">
        {/* 左侧筛选栏 —— 按 aguato 目录样式：搜索 / 开关 / 分组 checkbox + 真实计数 + See more */}
        <aside className="md:sticky md:top-6 self-start">
          <div className="border border-[#e8e6de] rounded-lg p-4 bg-white">
            <form action={directoryPath} method="get" className="space-y-2"
              data-track-submit={events.directorySearch} data-track-field="q">
              <input type="search" name="q" defaultValue={q} placeholder={dict.searchPlaceholder}
                aria-label={dict.searchPlaceholder}
                className="w-full rounded-lg border border-[#ddd9d0] px-3 py-2 text-sm text-[#171717] focus:border-[#171717] focus:outline-none" />
              <button type="submit" className="w-full rounded-lg border border-[#171717] px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#f5f3ee]">
                {dict.filterSubmit}
              </button>
            </form>
            {q && (<Link href={directoryPath} className="block text-xs text-[#6d6b66] hover:underline mt-2">{dict.filterReset}</Link>)}
            {/* 只看有真实评分 —— 由 riskText 是否「—」派生，不做死控件 */}
            <div className="pt-4 mt-4 border-t border-[#e8e6de]">
              <Link href={linkWith({ scored: scored ? null : 1, page: null })}
                className={`flex items-center justify-between gap-2 text-sm font-medium cursor-pointer ${scored ? "text-white bg-[#171717] rounded-md px-3 py-2" : "text-[#171717]"}`}
                data-track={events.directoryFilter} data-track-value="scored">
                <span className="flex items-center gap-2 truncate">{dict.scoredOnlyLabel}</span>
                <span className="shrink-0 text-xs tabular-nums">{scoredCount}</span>
              </Link>
            </div>
            {facetGroup(dict.filterCountry, "country", countryFacets, (v) => countryDisplayName(locale as Locale, v, v))}
            {facetGroup(dict.filterIndustry, "industry", industryFacets)}
            {facetGroup(dict.filterProduct, "q", productFacets)}
          </div>
        </aside>

        {/* 右侧结果区 */}
        <div className="min-w-0">
          {/* 已选条件 chip + 计数 + 排序 */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap items-center gap-2">
              {country && <span className="rounded-full border border-[#171717] px-3 py-1 text-xs">{countryDisplayName(locale as Locale, country, country)} ×</span>}
              {industry && <span className="rounded-full border border-[#171717] px-3 py-1 text-xs">{industry} ×</span>}
              {q && <span className="rounded-full border border-[#171717] px-3 py-1 text-xs">{q} ×</span>}
              <span className="text-sm text-[#6d6b66]">{dict.countLabel.replace("{n}", String(shown))}</span>
            </div>
            <DirectorySortSelect value={sort} scoreLabel={dict.sortByScore} nameLabel={dict.sortByName} />
          </div>

          <h2 className="text-2xl font-bold text-[#171717] mt-5">{dict.featuredTitle}</h2>
          <p className="text-sm text-[#6d6b66] mt-1">{dict.featuredLead}</p>
          <p className="mt-3 text-xs text-[#3f4650] bg-[#f5f3ee] rounded-md px-3 py-2">{dict.trustNote}</p>

          {items.length === 0 ? (
            <p className="text-[#3f4650] py-10">{dict.empty}</p>
          ) : (
            <ul className="mt-4 border-t border-[#e8e6de]">
              {items.map((x) => (
                <li key={x.slug} className="border-b border-[#e8e6de] last:border-b-0">
                  {/* class 前缀 card p-5 hover:border 保留（s18 产物门判据），视觉覆盖为 flat 分隔行 */}
                  <Link href={x.href}
                    className="card p-5 hover:border-[#171717] transition flex gap-4 items-start border-0 bg-transparent rounded-none px-0 py-6"
                    data-track={events.profileView} data-track-value={x.locked ? "locked" : x.slug}>
                    <div aria-hidden="true" className="shrink-0 w-12 h-12 rounded-lg border border-[#e8e6de] bg-[#faf9f6] flex items-center justify-center text-lg font-semibold text-[#9a978f] select-none">
                      {initialOf(supplierDisplayName(locale, x))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-base font-semibold text-[#171717] hover:underline">{supplierDisplayName(locale, x)}</span>
                        <VerificationBadge state={x.badgeState} dict={trustProfileDict} />
                      </div>
                      {/* 元信息行：只放真实公开字段，缺失项不出现（NULL ≠ 0） */}
                      <div className="text-xs text-[#6d6b66] mt-1">
                        {[x.countryLabel, x.employees ? `${dict.employeesLabel}: ${x.employees}` : "", x.established > 0 ? dict.establishedTemplate.replaceAll("{year}", String(x.established)) : ""].filter(Boolean).join(" · ")}
                      </div>
                      {x.companyDescription && (
                        <div className="mt-2">
                          <p className="text-sm leading-relaxed text-[#3f4650] whitespace-pre-line line-clamp-2">{x.companyDescription}</p>
                          <p className="text-[11px] text-[#8c8982] mt-1">{dict.selfReported}</p>
                        </div>
                      )}
                      {x.mainProducts.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {x.mainProducts.slice(0, 6).map((prod) => (
                            <span key={prod} className="rounded-full border border-[#d3d1c7] px-3 py-0.5 text-xs text-[#3f4650]">{prod}</span>
                          ))}
                        </div>
                      )}
                      {/* 核验/风险：字段与文案一字未删，收成一行紧凑胶囊 */}
                      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6d6b66]">
                        <div className="flex gap-1"><dt>{dict.evidenceLevel}</dt><dd className="font-medium text-[#171717]">{x.evidenceText}</dd></div>
                        <div className="flex gap-1"><dt>{dict.verificationLabel}</dt><dd className="font-medium text-[#171717]">{x.verificationText}</dd></div>
                        <div className="flex gap-1" title={dict.riskNote}><dt>{dict.riskLabel}<span aria-hidden="true" className="ml-0.5 text-[#8c8982]">(?) </span></dt><dd className="font-medium" style={{ color: x.riskColor }}>{x.riskText}</dd></div>
                        <div className="flex gap-1"><dt>{dict.lastEvidence}</dt><dd className="font-medium text-[#171717]">{x.lastCheckedText}</dd></div>
                      </dl>
                      <span className="inline-block mt-3 text-sm text-[#171717] font-medium">{x.cta} →</span>
                    </div>
                  </Link>
                </li>
              ))}
              <li className="px-0 py-3 text-xs text-[#6d6b66]">{dict.riskNote}</li>
            </ul>
          )}

        {/* 分页条（2026-10-31）────────────────────────────────────────────────
            🔴 只用页码与箭头，**不用任何文字** —— 本页 9 种语言共用一套组件，
            引入 "Previous/Next/Page X of Y" 会新增 3 个翻译叶 × 9 语，
            而数字与箭头是语言无关的。可访问性靠 aria-current / aria-label（纯数字）。
            🔴 `?page=` 已在 middleware 归入「筛选态 noindex, follow」，
            不会产出重复索引页；canonical 仍恒指目录首页。 */}
        {pager && pager.pageCount > 1 && (() => {
          const cur = pager.page;
          const last = pager.pageCount;
          const nums: Array<number | "gap"> = [];
          if (last <= 7) {
            for (let i = 1; i <= last; i += 1) nums.push(i);
          } else {
            nums.push(1);
            if (cur > 3) nums.push("gap");
            for (let i = Math.max(2, cur - 1); i <= Math.min(last - 1, cur + 1); i += 1) nums.push(i);
            if (cur < last - 2) nums.push("gap");
            nums.push(last);
          }
          const base = "inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2 rounded-md border text-sm";
          return (
            <nav className="flex flex-wrap items-center gap-2 mb-14" aria-label={String(cur)}>
              <Link
                href={linkWith({ page: Math.max(1, cur - 1) })}
                aria-label={String(Math.max(1, cur - 1))}
                aria-disabled={cur === 1}
                className={`${base} border-[#ddd9d0] text-[#3f4650] hover:border-[#171717] ${cur === 1 ? "pointer-events-none opacity-40" : ""}`}
              >
                ←
              </Link>
              {nums.map((n, i) =>
                n === "gap" ? (
                  <span key={`gap-${i}`} className="px-1 text-[#8c8982]" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <Link
                    key={n}
                    href={linkWith({ page: n })}
                    aria-label={String(n)}
                    aria-current={n === cur ? "page" : undefined}
                    className={`${base} ${n === cur ? "bg-[#171717] text-white border-[#171717]" : "border-[#ddd9d0] text-[#3f4650] hover:border-[#171717]"}`}
                  >
                    {n}
                  </Link>
                )
              )}
              <Link
                href={linkWith({ page: Math.min(last, cur + 1) })}
                aria-label={String(Math.min(last, cur + 1))}
                aria-disabled={cur === last}
                className={`${base} border-[#ddd9d0] text-[#3f4650] hover:border-[#171717] ${cur === last ? "pointer-events-none opacity-40" : ""}`}
              >
                →
              </Link>
            </nav>
          );
        })()}
        </div>
      </div>
    </>
  );
}

