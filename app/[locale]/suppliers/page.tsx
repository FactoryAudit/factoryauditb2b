import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { listSupplierDirectory, listPublicRfqs } from "@/lib/queries";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import DirectoryView, {
  type DirectoryDict,
  type DirectoryEntry,
} from "@/components/supplier/DirectoryView";
import DirectoryGrid from "@/components/supplier/DirectoryGrid";
import DirectoryWallBanner from "@/components/supplier/DirectoryWallBanner";
// 阶段 1：卡片数据的**唯一构造点**。页面与 /api/suppliers/directory 共用它，
// 免得两处各写一份派生逻辑、日后静默漂移（详见 lib/directoryItems.ts 顶部注释）。
import { buildDirectoryItems } from "@/lib/directoryItems";
// 阶段 1：登录墙脱敏层。锁定/解锁规则只实现一次（lib/directoryWall.ts）。
import { lockDirectoryItems, lockedHref } from "@/lib/directoryWall";
import { buildPageMetadata } from "@/lib/pageMeta";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";

const PATH = "/suppliers";
const BASE = "https://factoryauditb2b.com";

type Props = {
  params: Promise<{ locale: string }>;
};

// ── stage1.8：本页由「动态渲染」改为「预渲染」─────────────────────────────────
// 改造前：`page.tsx` 与 `generateMetadata` **都 await searchParams** ⇒ Next 强制
//   动态渲染 ⇒ 每次请求 4 次 Supabase 往返（listSupplierDirectory + verifiedAuditSupplierIds
//   + 徽章查询），实测线上 TTFB 2.66–4.23s，响应头为 `private, no-cache, no-store`。
//   在 Cloudflare Workers Free（CPU 10ms/req）下这是 5xx 的主要来源。
//
// 改造后：不再读 searchParams ⇒ 页面在构建期预渲染，过滤改由客户端完成
//   （`components/supplier/DirectoryGrid.tsx`），命中静态产物时不进 Worker。
//
// 🔴 `revalidate = 3600` 在当前部署形态下**等价于构建期冻结**：
//   open-next.config.ts 用 `staticAssetsIncrementalCache` + `enableCacheInterception`，
//   其 `set()` / `delete()` 均为 no-op ⇒ 缓存只读、页面数据在构建时冻结。
//   因此**改库（发布/下架供应商）后必须重新 build + deploy** 才会生效
//   —— 与 `/suppliers/[slug]` 早已确立的发布流程一致（见该页顶部注释与发布检查单）。
//
// 🔑 上限（D1 决策，2026-09-29）：全量供应商数据内联进 HTML，约 2.5 KB/家。
//   已发布供应商 **≤ 50 家** 是内联方案的成立前提（约 125 KB 增量，gzip 后约 1/4）。
//   超过 50 家 ⇒ 必须改回分页或动态渲染；该闸门由回归脚本
//   `scripts/s18-directory-static-regression.ts` 断言，不是口头约定。
//   ⚠️ 50 家（内联体积）与 60 家（卡片渲染量 → 需分页/Load More，见下方原注释）
//      是两条**独立**的阈值，互不替代。
// 🔴 不得声明 revalidate（2026-10-07 实测钉死）：OpenNext 的 cache interception 会**绕开**声明了 revalidate 的路由，改交给 Worker 运行时 SSR ⇒ prerender-manifest 里 initialRevalidateSeconds=3600 ⇒ 每请求现场渲染 ⇒ 撞 Workers 128MB 内存上限 ⇒ `error code: 1102` / HTTP 503 ⇒ Google 抓取失败、crawl budget 崩。只读 staticAssetsIncrementalCache 下 revalidate 本就永不生效（set() 是 no-op），删掉零功能损失；要真 ISR 请改 r2IncrementalCache（见 open-next.config.ts 注释）。

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  // 🔴 过滤态不再由本函数负责：页面预渲染后 generateMetadata **拿不到 searchParams**，
  //    再按旧逻辑判断 `isFiltered` 只会恒为 false（静默失效、不报错）。
  //    过滤态的 noindex 已改由 middleware 注入 `X-Robots-Tag: noindex, follow`
  //    （命中条件：/suppliers 且带 country / industry / q —— 与旧口径逐字一致）。
  //    canonical 仍恒指向目录首页，构成第二重收敛信号。
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.suppliers.metaTitle,
    description: t.suppliers.metaDesc,
    robots: { index: true, follow: true },
  });
}

export default async function SuppliersPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.suppliers;
  // 服务名复用既有 taxonomy（含 9 语译文），不重复造词
  const si = t.servicesIndex.items;
  const p = (href: string) => localePath(locale, href);

  // 全量已发布供应商（构建期冻结 —— 见文件顶部 revalidate 说明）。
  const all = await listSupplierDirectory();

  // Live Buyer Requests（公开 RFQ，构建期冻结，与目录同源）—— 从首页移到此页顶部，
  // 作为「决策辅助」（社交证明），不再占用首页 section。
  const buyerRequests = await listPublicRfqs(3);

  // ── 阶段 1（2026-09-30）：登录墙 ──────────────────────────────────────────
  // 派生值仍在服务端算好（唯一构造点 = lib/directoryItems.ts，与授权接口共用），
  // 但**公开 HTML 里下发的恒为「锁定视图」**：真实公司名被置为空串、
  // 卡片 href 指向登录页而非档案页。已登录用户由客户端从
  // /api/suppliers/directory 取完整档后替换（见 components/supplier/DirectoryGrid.tsx）。
  //
  // 🔴 这里**绝不读 cookie 判定登录** —— 一读页面就退化成 ƒ Dynamic，
  //    而 CF Workers Free（CPU 10ms/req）下的 5xx 主因正是这种动态渲染。
  const directoryPath = p(PATH);
  const supplierPathPrefix = p("/suppliers/");
  const loginPath = p("/login");

  const baseItems = await buildDirectoryItems(locale, all);
  const items: DirectoryEntry[] = lockDirectoryItems(baseItems, {
    loginPath,
    directoryPath,
    supplierPathPrefix,
    // CTA 文案复用既有键（阶段 1 零新增叶）：
    //   locked   → login.form.submit   （"Sign in"）
    //   unlocked → suppliers.cardCta   （"View Supplier"）
    lockedCta: t.login.form.submit,
    unlockedCta: s.cardCta,
  });

  // 筛选 chip 的数据源是**全量**（否则筛掉一个国家后该 chip 会自我消失）。
  // stage1.8：全量在这里派生好，随 props 交给客户端 —— 客户端不做任何派生。
  const countries = Array.from(new Set(items.map((x) => x.country))).sort();
  const industries = Array.from(
    new Set(items.map((x) => x.industryCode).filter(Boolean))
  ).sort();

  // CS-06a（Bug B 修复）：展示集合必须是**筛选结果**，不是全量前 N 条。
  //   此前这里是 `all.slice(0, FEATURED_MAX)`，导致 country / industry / q 三个筛选
  //   只改了计数标签与 JSON-LD，卡片永远渲染全量 —— 线上表现为
  //   「1 suppliers listed」旁边并排躺着 4 张卡（其中 3 家是中国工厂）。
  //   产品定位是 Explore Global Suppliers（不是 Featured Suppliers），
  //   不应该人为隐藏筛选结果，故**不再截断**：
  //     count 标签 = 展示集合长度 = 实际卡片数 —— 恒等成立。
  //   🔑 stage1.8 之后这条不变式的落点变成：
  //     `components/supplier/DirectoryView.tsx` 的**计数标签与卡片网格消费同一个
  //     集合 `items`**（客户端传的是过滤结果，服务端预渲染的是全量）。
  //   ⚠️ 已发布供应商超过 ~60 家后，需要以**新的 Change Set**引入
  //      分页 / Load More / 结果排序；本轮明确不做分页。

  // 目录区块的字典片段（只取需要的键 —— 不把整本字典推进客户端 bundle）。
  const directoryDict: DirectoryDict = {
    searchPlaceholder: s.searchPlaceholder,
    searchButton: s.searchButton,
    searchClear: s.searchClear,
    filterCountry: s.filterCountry,
    filterIndustry: s.filterIndustry,
    filterAll: s.filterAll,
    featuredTitle: s.featuredTitle,
    featuredLead: s.featuredLead,
    countLabel: s.countLabel,
    trustNote: s.trustNote,
    empty: s.empty,
    businessTypeLabel: s.businessTypeLabel,
    evidenceLevel: s.evidenceLevel,
    verificationLabel: s.verificationLabel,
    riskLabel: s.riskLabel,
    riskNote: s.riskNote,
    lastEvidence: s.lastEvidence,
  };

  // 埋点事件名从 lib/analytics.ts 取，不在客户端组件里硬编码字符串（CS-04 口径铁律）。
  const directoryEvents = {
    directorySearch: ANALYTICS_EVENTS.directorySearch,
    directoryFilter: ANALYTICS_EVENTS.directoryFilter,
    profileView: ANALYTICS_EVENTS.profileView,
  };

  // 路径（directoryPath / supplierPathPrefix / loginPath）已在上方定义 ——
  // 它们要在构造锁定视图时就用到，所以不能再留在这里。
  const tp = t.trustProfile;

  const faqs = [
    { q: s.faq1q, a: s.faq1a },
    { q: s.faq2q, a: s.faq2a },
    { q: s.faq3q, a: s.faq3a },
    { q: s.faq4q, a: s.faq4a },
  ];

  // FAQPage 与 ItemList 并列输出（JsonLd 组件支持数组）。
  // stage1.8：结构化数据描述的是**预渲染的那份 HTML** ⇒ 恒为全量（无过滤）。
  //   过滤态已由 middleware 注入 `X-Robots-Tag: noindex, follow`，
  //   不应再由结构化数据描述 —— 否则等于给 noindex 页面发索引信号。
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: s.h1,
      url: `${BASE}${p(PATH)}`,
      numberOfItems: all.length,
      // 🔴 阶段 1：ItemList 的 `name` **已移除**。
      //   结构化数据必须描述页面**实际呈现**的内容 —— 而锁定视图里真实公司名
      //   已不在页面上（卡片只画骨架条）。继续输出 name 就构成
      //   「结构化数据与可见内容不符」，那是 Google 明确会惩罚的一类问题。
      //   `url` 保留：档案页（/suppliers/<slug>）本轮未上墙、仍在 sitemap 中公开，
      //   其地址不属于本页新增的泄漏面。
      itemListElement: all.map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE}${p(`/suppliers/${x.slug}`)}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <main className="container py-12" data-track-page={ANALYTICS_EVENTS.directoryView}>
      <JsonLd data={jsonLd} />

      {/* Hero
          定位从「付费供应商目录」改为「免费发现 + 付费情报 + 服务」。
          第一 CTA 是 Find Suppliers（发现），Membership 降级为文字链（指令 §8）。 */}
      <section className="mb-6">
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">
          {s.heroBadge}
        </span>
        <h1 className="text-3xl font-bold text-[#171717] mt-2">{s.h1}</h1>
        <p className="text-[#6d6b66] mt-2 max-w-3xl">{s.lead}</p>
        {/* 阶段 1（2026-09-30）：原 `s.freeNote`（"Basic supplier information is
            free to browse."）已**撤下渲染** —— 目录上墙后，"免费浏览"就不再是完整
            的表述（现在是"登录后免费"，且未登录看不到公司名）。留着它等于暗示
            "没有门槛"，与页面实际行为不符。下方 DirectoryWallBanner 明确交代门槛。
            键本身保留在 9 语字典里（未删除），只是不再有渲染出口。 */}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* 页内锚点：落到下方供应商目录，不产生新页面也不伪造转化事件 */}
          <a href="#supplier-directory" className="btn btn-primary font-semibold">
            {t.home.ctaPrimary}
          </a>
          <Link
            href={p("/services/supplier-verification")}
            className="btn btn-outline font-semibold"
            data-track={ANALYTICS_EVENTS.verificationCtaClick}
            data-track-value="directory_hero"
          >
            {t.home.verifyCta}
          </Link>
          <Link
            href={p("/pricing#founding-buyer")}
            className="text-sm text-[#171717] hover:underline"
            data-track={ANALYTICS_EVENTS.profilePaidCta}
            data-track-value="directory_hero"
          >
            {s.memberCta}
          </Link>
        </div>

        {/* 阶段 1（2026-09-30）：原 `s.exampleNote`（"Browse available suppliers
            for free. …"）已由**登录墙提示条**取代 —— 同一位置、同一浅橙底调，
            但明确交代"完整记录需登录后查看"。文案全部复用 login.* 既有键
            （阶段 1 零新增翻译叶）。 */}
        <div className="mt-4">
          <DirectoryWallBanner
            loginHref={lockedHref({ loginPath, directoryPath })}
            registerHref={p("/register")}
            title={t.login.h1}
            note={t.login.metaDesc}
            cta={t.login.form.submit}
            noAccount={t.login.noAccount}
            registerCta={t.login.registerLink}
          />
        </div>
      </section>

      {/* Live Buyer Requests —— 决策辅助（社交证明），只展示公开白名单字段。 */}
      {buyerRequests.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-[#171717]">{t.home.liveTitle}</h2>
            <Link
              href={p("/rfq")}
              className="text-sm text-[#e07a49] font-medium hover:underline whitespace-nowrap"
            >
              {t.home.liveViewAll} →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {buyerRequests.map((r) => (
              <div key={r.referenceId} className="card p-4 flex flex-col">
                <div className="font-semibold text-[#171717] text-sm">{r.product}</div>
                <div className="text-xs text-[#6d6b66] mt-1">
                  {r.quantity ? `${t.home.liveQuantity}: ${r.quantity}` : ""}
                  {r.targetMarket ? ` · ${t.home.liveMarket}: ${r.targetMarket}` : ""}
                </div>
                <Link
                  href={p(`/rfq?request=${encodeURIComponent(r.referenceId)}`)}
                  className="text-xs text-[#e07a49] font-medium hover:underline mt-2"
                >
                  {t.home.liveRespondCta}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 搜索 + 筛选 + 供应商目录（stage1.8：预渲染首屏 + 客户端过滤）──────────────
          数据与派生态在构建期算好并内联进 HTML（无 JS 也完整可读，SEO 等价于改造前）；
          过滤条件改由客户端读 URL 后本地应用（< 10ms，不再触发 Worker 中的 Supabase 往返）。
          Suspense 的 fallback 刻意渲染**同一份** DirectoryView（无过滤）：
          这样无论 Next 是否对 useSearchParams 做 CSR bailout，首屏 HTML 都带完整列表。
          🔑 上限（D1 决策）：内联体积约 2.5 KB/家 ⇒ 已发布供应商不得超过 50 家
             （回归脚本 s18-directory-static-regression 断言，非口头约定）。 */}
      <Suspense
        fallback={
          <DirectoryView
            items={items}
            countries={countries}
            industries={industries}
            active={{ country: "", industry: "", q: "" }}
            directoryPath={directoryPath}
            locale={locale}
            dict={directoryDict}
            events={directoryEvents}
            trustProfileDict={tp}
          />
        }
      >
        <DirectoryGrid
          items={items}
          countries={countries}
          industries={industries}
          directoryPath={directoryPath}
          locale={locale}
          dict={directoryDict}
          events={directoryEvents}
          trustProfileDict={tp}
        />
      </Suspense>

      {/* 服务转化：Supplier Discovery 免费，核验 / 验厂 / 验货 / 寻源为付费服务（§16 / §23） */}
      <section className="card p-8 mb-10">
        <h2 className="text-2xl font-bold text-[#171717]">{s.svcTitle}</h2>
        <p className="text-[#3f4650] mt-2 max-w-2xl">{s.svcLead}</p>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-[#171717]">
          {[si.verification, si.factoryAudit, si.inspection, si.sourcing].map((item) => (
            <li key={item.title} className="flex items-start gap-2">
              <span aria-hidden="true" className="text-[#171717]">
                •
              </span>
              <span>{item.title}</span>
            </li>
          ))}
        </ul>
        {/* 免费发现 ≠ 免费核验，必须显式写清（§23） */}
        <p className="mt-4 text-sm text-[#3f4650]">{s.svcNote}</p>
        <Link
          href={p("/custom-services")}
          className="btn btn-primary mt-5 inline-block"
          data-track={ANALYTICS_EVENTS.verificationCtaClick}
          data-track-value="directory_service_block"
        >
          {s.svcCta}
        </Link>
      </section>

      {/* Founder Buyer —— 排在服务之后（§38 视觉层级：Discovery 优先于 Membership） */}
      <section className="card p-8 bg-gradient-to-br from-[#171717] to-[#163a5f] text-white mb-10">
        <h2 className="text-2xl font-bold text-white">{s.unlockTitle}</h2>
        <p className="mt-2 max-w-2xl text-white/90">{s.unlockLead}</p>
        <p className="mt-2 text-sm text-white/75">{s.unlockNote}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={p("/register")}
            className="btn bg-white text-[#171717] hover:bg-[#f5f3ee] font-semibold"
            data-track={ANALYTICS_EVENTS.profileFreeCta}
            data-track-value="directory_founder_block"
          >
            {s.freeCta}
          </Link>
          <Link
            href={p("/pricing#founding-buyer")}
            className="btn border border-white text-white hover:bg-[#163a5f] font-semibold"
            data-track={ANALYTICS_EVENTS.profilePaidCta}
            data-track-value="directory_founder_block"
          >
            {s.founderCta}
          </Link>
        </div>
      </section>

      {/* 找不到 → RFQ */}
      <section className="card p-8 bg-gradient-to-br from-[#f5f3ee] to-[#fbfaf7] mb-10">
        <h2 className="text-2xl font-bold text-[#171717]">{s.notListedTitle}</h2>
        <p className="text-[#3f4650] mt-2 max-w-2xl">{s.notListedLead}</p>
        <Link
          href={p("/rfq")}
          className="btn btn-primary mt-5 inline-block"
          data-track={ANALYTICS_EVENTS.rfqCtaClick}
          data-track-value="directory_rfq_block"
        >
          {s.notListedCta}
        </Link>
      </section>

      {/* 供应商侧入口（Claim 入口在各 profile 页） */}
      <section className="card p-8">
        <h2 className="text-2xl font-bold text-[#171717]">{s.claimTitle}</h2>
        <p className="text-[#3f4650] mt-2 max-w-2xl">{s.claimLead}</p>
        <Link
          href={p("/join-supplier-network")}
          className="btn btn-outline mt-5 inline-block"
        >
          {s.claimPrimary}
        </Link>
      </section>

      {/* FAQ（指令 §21：只写真实、对 Buyer 有帮助的问题） */}
      <section className="mb-4">
        <h2 className="text-2xl font-bold text-[#171717]">{t.common.faq}</h2>
        <div className="mt-4 space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="card p-5">
              <h3 className="font-semibold text-[#171717]">{f.q}</h3>
              <p className="text-[#3f4650] mt-2 text-sm">{f.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm">
          <Link
            href={p("/custom-services")}
            className="text-[#171717] font-medium hover:underline"
            data-track={ANALYTICS_EVENTS.verificationCtaClick}
            data-track-value="directory_faq"
          >
            {s.svcCta} →
          </Link>
        </p>
      </section>
    </main>
  );
}
