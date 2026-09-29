import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { listSupplierDirectory } from "@/lib/queries";
import { overallLevel, LEVEL_COLOR, type RiskLevel } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
// CS-D：目录卡片统一展示三态验证徽章（状态由 trustProfile 服务端推导，绝不前端算）
import {
  getVerificationBadgesForSuppliers,
} from "@/lib/trustProfile";
import type { BadgeState } from "@/components/supplier/VerificationBadge";
import DirectoryView, {
  type DirectoryDict,
  type DirectoryItem,
} from "@/components/supplier/DirectoryView";
import DirectoryGrid from "@/components/supplier/DirectoryGrid";
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
export const revalidate = 3600;

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

/** 分数 + 等级：等级由 overallLevel 推导，文案取字典，不出现 LOW/MODERATE 原始 token */
function riskLabel(score?: number, labels?: Record<RiskLevel, string>) {
  if (typeof score !== "number" || !labels) return "—";
  return `${score} / 100 · ${labels[overallLevel(score)]}`;
}

export default async function SuppliersPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.suppliers;
  const sp = t.supplierProfile;
  // PHASE 03（P0）：卡片核验状态与档案页共用同一套等级文案（verification.levelsShort），
  // 不再在目录里另造一份「等级 → 文案」映射。
  const v = t.verification;
  // 服务名复用既有 taxonomy（含 9 语译文），不重复造词
  const si = t.servicesIndex.items;
  const p = (href: string) => localePath(locale, href);

  // 全量已发布供应商（构建期冻结 —— 见文件顶部 revalidate 说明）。
  const all = await listSupplierDirectory();

  // CS-D：目录卡片徽章 —— 单次批量查询推导状态（服务端唯一权威，见 trustProfile.ts）。
  // stage1.8：范围由「筛选结果」改为**全量** —— 过滤已移到客户端，
  //   服务端必须把全量徽章一次性交给客户端，否则客户端过滤会漏掉状态。
  const badgeMap = await getVerificationBadgesForSuppliers(all.map((x) => x.id));

  // ── stage1.8：派生值全部在服务端算好，客户端只做「按 URL 过滤 + 渲染」──────────
  //   铁律不变：公开核验等级只由 publicVerificationLevel 决定（?? 0 兜底），
  //   绝不采信 legacy verification_status，也绝不因「有 N 条证据」而升档；
  //   风险色只由真实分数决定 —— 无分数 ⇒ 中性灰，绝不用 `?? 0` 涂成 CRITICAL 红
  //   （那等于给一家「尚未评分」的企业涂上最高风险色）。
  const items: DirectoryItem[] = all.map((x) => {
    const hasEvidence = (x.evidenceVerified ?? 0) > 0;
    const level = x.publicVerificationLevel ?? 0;
    return {
      slug: x.slug,
      legalName: x.legalName,
      country: x.country,
      countryLabel: x.countryName ?? x.country.toUpperCase(),
      city: x.city,
      industryCode: x.industryCode ?? "",
      mainProducts: x.mainProducts,
      businessType: x.businessType || "—",
      evidenceText: hasEvidence
        ? s.evidenceDocs.replace("{n}", String(x.evidenceVerified))
        : s.evidenceNone,
      // PHASE 03（P0 修复，2026-09-13）：核验状态必须来自真实数据。
      //   修复前 guangzhou-sunny-food 已有 1 条 VERIFIED 现场审核记录
      //   （verification_level='on_site_audit'、公开等级 Level 3），
      //   在目录卡上却仍显示「未核验」，与它自己的档案页直接矛盾。
      //   level ≥ 1 → levelsShort[level]（与档案页同一字典）；level = 0 → verificationNotYet。
      verificationText: level === 0 ? s.verificationNotYet : v.levelsShort[level],
      riskText: riskLabel(x.riskScore, t.risk.ui.level),
      riskColor:
        typeof x.riskScore === "number"
          ? LEVEL_COLOR[overallLevel(x.riskScore)]
          : "#64748b",
      lastCheckedText: x.lastChecked ?? sp.noCheckRecord,
      badgeState: (badgeMap.get(x.id) ?? "NONE") as BadgeState,
    };
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
    cardCta: s.cardCta,
  };

  // 埋点事件名从 lib/analytics.ts 取，不在客户端组件里硬编码字符串（CS-04 口径铁律）。
  const directoryEvents = {
    directorySearch: ANALYTICS_EVENTS.directorySearch,
    directoryFilter: ANALYTICS_EVENTS.directoryFilter,
    profileView: ANALYTICS_EVENTS.profileView,
  };

  // 已带语言前缀的路径，避免把 locale 逻辑复制到客户端
  const directoryPath = p(PATH);
  const supplierPathPrefix = p("/suppliers/");
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
      itemListElement: all.map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: x.legalName,
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
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {s.heroBadge}
        </span>
        <h1 className="text-3xl font-bold text-[#0f172a] mt-2">{s.h1}</h1>
        <p className="text-[#64748b] mt-2 max-w-3xl">{s.lead}</p>
        <p className="mt-2 text-sm font-medium text-[#475569]">{s.freeNote}</p>

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
            className="text-sm text-[#0f4c81] hover:underline"
            data-track={ANALYTICS_EVENTS.profilePaidCta}
            data-track-value="directory_hero"
          >
            {s.memberCta}
          </Link>
        </div>

        <p className="mt-3 text-sm text-[#8a5410] bg-[#fff4e0] rounded-md px-3 py-2 max-w-3xl">
          {s.exampleNote}
        </p>
      </section>

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
            supplierPathPrefix={supplierPathPrefix}
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
          supplierPathPrefix={supplierPathPrefix}
          dict={directoryDict}
          events={directoryEvents}
          trustProfileDict={tp}
        />
      </Suspense>

      {/* 服务转化：Supplier Discovery 免费，核验 / 验厂 / 验货 / 寻源为付费服务（§16 / §23） */}
      <section className="card p-8 mb-10">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.svcTitle}</h2>
        <p className="text-[#475569] mt-2 max-w-2xl">{s.svcLead}</p>
        <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-[#0f172a]">
          {[si.verification, si.factoryAudit, si.inspection, si.sourcing].map((item) => (
            <li key={item.title} className="flex items-start gap-2">
              <span aria-hidden="true" className="text-[#0f4c81]">
                •
              </span>
              <span>{item.title}</span>
            </li>
          ))}
        </ul>
        {/* 免费发现 ≠ 免费核验，必须显式写清（§23） */}
        <p className="mt-4 text-sm text-[#475569]">{s.svcNote}</p>
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
      <section className="card p-8 bg-gradient-to-br from-[#0f4c81] to-[#163a5f] text-white mb-10">
        <h2 className="text-2xl font-bold text-white">{s.unlockTitle}</h2>
        <p className="mt-2 max-w-2xl text-white/90">{s.unlockLead}</p>
        <p className="mt-2 text-sm text-white/75">{s.unlockNote}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={p("/register")}
            className="btn bg-white text-[#0f4c81] hover:bg-[#e6eef6] font-semibold"
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
      <section className="card p-8 bg-gradient-to-br from-[#e6eef6] to-[#f7f9fc] mb-10">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.notListedTitle}</h2>
        <p className="text-[#475569] mt-2 max-w-2xl">{s.notListedLead}</p>
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
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.claimTitle}</h2>
        <p className="text-[#475569] mt-2 max-w-2xl">{s.claimLead}</p>
        <Link
          href={p("/join-supplier-network")}
          className="btn btn-outline mt-5 inline-block"
        >
          {s.claimPrimary}
        </Link>
      </section>

      {/* FAQ（指令 §21：只写真实、对 Buyer 有帮助的问题） */}
      <section className="mb-4">
        <h2 className="text-2xl font-bold text-[#0f172a]">{t.common.faq}</h2>
        <div className="mt-4 space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="card p-5">
              <h3 className="font-semibold text-[#0f172a]">{f.q}</h3>
              <p className="text-[#475569] mt-2 text-sm">{f.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm">
          <Link
            href={p("/custom-services")}
            className="text-[#0f4c81] font-medium hover:underline"
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
