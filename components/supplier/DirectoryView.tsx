import Link from "next/link";
import VerificationBadge, {
  type BadgeState,
  type TrustProfileDict,
} from "./VerificationBadge";

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
 * ── 阶段 1（2026-09-30）：供应商登录墙 ──────────────────────────────────────
 *   本组件现在同时承担**两种访问视图**，由 `items[].locked` 区分：
 *     · locked = true  —— 未登录。真实公司名不渲染（只画骨架条），
 *                         卡片 href 指向登录页，CTA 文案为登录。
 *     · locked = false —— 已登录。渲染真实名称，href 指向档案页。
 *   🔴 但注意：预渲染的公开 HTML **恒为 locked 视图**（服务端不读 cookie，
 *      否则页面退化成 ƒ Dynamic ⇒ CF Workers Free CPU 超限 5xx）。
 *      已登录视图由客户端在 hydration 后从 /api/suppliers/directory 取得。
 *      脱敏/解锁规则唯一实现在 `lib/directoryWall.ts`，本组件不复制该逻辑。
 */

/** 单张目录卡片所需的**已收口**数据（派生值全部由服务端算好）。 */
export type DirectoryItem = {
  slug: string;
  legalName: string;
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
   * 锁定态（未登录）→ 登录页 `?next=<目录页>`，**刻意不带档案地址**：
   *   档案地址含 slug，slug 含公司名，写进 href 等于公开 HTML 里泄漏真实名称。
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
export type DirectoryActive = { country: string; industry: string; q: string };

export default function DirectoryView({
  items,
  countries,
  industries,
  active,
  directoryPath,
  dict,
  events,
  trustProfileDict,
}: {
  /** 已按当前过滤条件筛过的集合（无过滤时即全量） */
  items: DirectoryEntry[];
  countries: string[];
  industries: string[];
  active: DirectoryActive;
  /** 已带语言前缀的目录页路径，如 /suppliers、/es/suppliers */
  directoryPath: string;
  // 阶段 1：`supplierPathPrefix` 已移除 —— 卡片的 href 由服务端算好放进
  //   `items[].href`（锁定态指登录页、解锁态指档案页）。组件不再自己拼 URL，
  //   这样「哪些链接能出现在公开 HTML 里」只有一处决策点（见 lib/directoryWall.ts）。
  dict: DirectoryDict;
  events: DirectoryEvents;
  trustProfileDict: TrustProfileDict;
}) {
  const { country, industry, q } = active;

  // 筛选做成链接而不是表单：可被抓取，也让「国家 + 行业 + 关键词」组合形成真实索引路径。
  // stage1.8：`directoryPath` 已含语言前缀，拼接 query 的结果与改造前
  //   `localePath(locale, "/suppliers?…")` 逐字一致。
  const linkWith = (next: {
    country?: string | null;
    industry?: string | null;
    q?: string | null;
  }) => {
    const params = new URLSearchParams();
    const c = next.country !== undefined ? next.country : country;
    const i = next.industry !== undefined ? next.industry : industry;
    const query = next.q !== undefined ? next.q : q;
    if (c) params.set("country", c);
    if (i) params.set("industry", i);
    if (query) params.set("q", query);
    const qs = params.toString();
    return qs ? `${directoryPath}?${qs}` : directoryPath;
  };

  return (
    <>
      {/* 搜索 + 筛选 */}
      <section className="mb-6">
        <form
          action={directoryPath}
          method="get"
          className="flex flex-wrap items-center gap-2 mb-4"
          // 提交时上报（而非点击）：带搜索词，用于分析「哪些产品关键词带来流量」。
          // 原 data-track 会在点击表单任意空白处误触发，故改用 data-track-submit。
          data-track-submit={events.directorySearch}
          data-track-field="q"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={dict.searchPlaceholder}
            aria-label={dict.searchPlaceholder}
            className="flex-1 min-w-[240px] rounded-lg border border-[#ddd9d0] px-3 py-2 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
          />
          <button type="submit" className="btn btn-primary">
            {dict.searchButton}
          </button>
          {q && (
            <Link
              href={linkWith({ q: null })}
              className="text-sm text-[#171717] hover:underline"
            >
              {dict.searchClear}
            </Link>
          )}
        </form>

        <div className="flex flex-wrap gap-6 items-start">
          <div>
            <div className="text-xs font-semibold text-[#6d6b66] uppercase mb-2">
              {dict.filterCountry}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={linkWith({ country: null })}
                className={`rounded-full px-3 py-1 text-sm border ${!country ? "bg-[#171717] text-white border-[#171717]" : "border-[#ddd9d0] text-[#3f4650] hover:border-[#171717]"}`}
                data-track={events.directoryFilter}
                data-track-value="all-countries"
              >
                {dict.filterAll}
              </Link>
              {countries.map((c) => (
                <Link
                  key={c}
                  href={linkWith({ country: c })}
                  className={`rounded-full px-3 py-1 text-sm border ${country === c ? "bg-[#171717] text-white border-[#171717]" : "border-[#ddd9d0] text-[#3f4650] hover:border-[#171717]"}`}
                  data-track={events.directoryFilter}
                  data-track-value={c}
                >
                  {c.toUpperCase()}
                </Link>
              ))}
            </div>
          </div>
          {industries.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#6d6b66] uppercase mb-2">
                {dict.filterIndustry}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={linkWith({ industry: null })}
                  className={`rounded-full px-3 py-1 text-sm border ${!industry ? "bg-[#171717] text-white border-[#171717]" : "border-[#ddd9d0] text-[#3f4650] hover:border-[#171717]"}`}
                  data-track={events.directoryFilter}
                  data-track-value="all-industries"
                >
                  {dict.filterAll}
                </Link>
                {industries.map((i) => (
                  <Link
                    key={i}
                    href={linkWith({ industry: i })}
                    className={`rounded-full px-3 py-1 text-sm border ${industry === i ? "bg-[#171717] text-white border-[#171717]" : "border-[#ddd9d0] text-[#3f4650] hover:border-[#171717]"}`}
                    data-track={events.directoryFilter}
                    data-track-value={i}
                  >
                    {i}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 供应商目录（Hero 的 Find Suppliers 锚点落在这里） */}
      <section id="supplier-directory" className="mb-8 scroll-mt-6">
        {/* justify-between 的右侧计数标签。原先写死 shrink-0 ⇒ 德语长计数文案
            （de 实测 55px）在 390px 顶出视口。改为可换行 + 允许收缩。 */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#171717]">{dict.featuredTitle}</h2>
            <p className="text-sm text-[#6d6b66] mt-1">{dict.featuredLead}</p>
          </div>
          <p className="text-sm text-[#6d6b66] min-w-0 text-right">
            {dict.countLabel.replace("{n}", String(items.length))}
          </p>
        </div>

        {/* 信任说明（§29）：自述信息 / 证据等级 / 独立核验必须分开表达，
            不能让 Buyer 把「能看到档案」误解成「已被 FactoryAuditB2B 核验」 */}
        <p className="mb-4 text-sm text-[#3f4650] bg-[#f5f3ee] rounded-md px-3 py-2">
          {dict.trustNote}
        </p>

        {items.length === 0 ? (
          <p className="text-[#3f4650] mb-10">{dict.empty}</p>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
            {items.map((x) => (
              // ★ 等级只由「真实证据」决定，绝不采信 legacy verification_status。
              //   详情与原始理由见 page.tsx 的 `items` 构造处（服务端唯一权威）。
              // PHASE 03（P0）：核验状态必须来自**真实**数据 —— 已由 page.tsx 算好，
              //   本组件只渲染 verificationText / badgeState。
              // ⚠️ 等级不因「有 N 条证据」升档（有证据 ≠ 已核验，§8 / §9）。
              <Link
                key={x.slug}
                href={x.href}
                className="card p-5 hover:border-[#171717] transition"
                data-track={events.profileView}
                data-track-value={x.locked ? "locked" : x.slug}
              >
                {x.locked ? (
                  // 阶段 1 登录墙：真实公司名**不进公开 HTML**（legalName 此时已置空串，
                  // 渲染层只画骨架条）。骨架条用行内样式 —— 不引入新的 Tailwind 实用类，
                  // 避开「改了 className 但生成的 CSS 仍是旧的」那一类扫描缓存陷阱。
                  <span
                    aria-hidden="true"
                    className="inline-block rounded"
                    style={{
                      width: "10.5rem",
                      maxWidth: "100%",
                      height: "1rem",
                      background: "#e4dfd6",
                      verticalAlign: "-2px",
                    }}
                  />
                ) : (
                  <div className="font-semibold text-[#171717]">{x.legalName}</div>
                )}
                {/* CS-D：三态验证徽章（状态服务端推导，组件不自判） */}
                <div className="mt-2">
                  <VerificationBadge state={x.badgeState} dict={trustProfileDict} />
                </div>
                <div className="text-sm text-[#6d6b66] mt-1">
                  {x.city}, {x.countryLabel}
                </div>
                <div className="text-sm mt-3">{x.mainProducts.join(" · ")}</div>

                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#6d6b66]">{dict.businessTypeLabel}</dt>
                    <dd className="font-medium text-[#171717] text-right">
                      {x.businessType}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#6d6b66]">{dict.evidenceLevel}</dt>
                    <dd className="font-medium text-[#171717] text-right">
                      {x.evidenceText}
                    </dd>
                  </div>
                  {/* 核验状态独立一行（P0 修复，2026-09-13）。
                      修复前：无条件输出 verificationNotYet（"Not yet verified"），
                      于是 guangzhou-sunny-food —— 它已有 1 条 VERIFIED 现场审核记录、
                      verification_level='on_site_audit'、公开等级 Level 3 ——
                      在目录卡上仍显示「未核验」，与它自己的档案页直接矛盾。
                      现在按真实等级显示（level ≥ 1 → levelsShort[level]，与档案页同一字典）；
                      level = 0 → 继续用 verificationNotYet，措辞与修复前逐字一致。 */}
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#6d6b66]">{dict.verificationLabel}</dt>
                    <dd className="font-medium text-[#171717] text-right">
                      {x.verificationText}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#6d6b66]" title={dict.riskNote}>
                      {dict.riskLabel}
                      <span aria-hidden="true" className="ml-1 text-[#8c8982]">
                        (?)
                      </span>
                    </dt>
                    {/* 无分数 ⇒ 中性灰（riskText 本身会渲染「—」）。
                        绝不用 `overallLevel(x.riskScore ?? 0)` —— 那是 CRITICAL 的红，
                        等于给一家「尚未评分」的企业涂上最高风险色。
                        颜色由服务端算好放进 riskColor。 */}
                    <dd
                      className="font-medium text-right"
                      title={dict.riskNote}
                      style={{ color: x.riskColor }}
                    >
                      {x.riskText}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#6d6b66]">{dict.lastEvidence}</dt>
                    <dd className="font-medium text-[#171717] text-right">
                      {x.lastCheckedText}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-[#6d6b66]">{dict.riskNote}</p>

                <span className="inline-block mt-4 text-sm text-[#171717] font-medium">
                  {x.cta} →
                </span>
              </Link>
            ))}
          </section>
        )}
      </section>
    </>
  );
}
