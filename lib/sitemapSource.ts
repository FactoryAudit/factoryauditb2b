// lib/sitemapSource.ts
//
// sitemap 的「路径集合」唯一来源 —— 只回答一个问题：**有哪些路径该进站点地图**。
// 至于每条路径要展开成几种语言、XML 怎么序列化，那是 app/sitemap.xml/route.ts
// 和 app/sitemaps/[locale]/route.ts 的事。
//
// ── 为什么要拆（2026-11-08 事故）──────────────────────────────────────────
// 旧实现 app/sitemap.ts 一次性返回全部 2,268 条 URL，每条各挂 10 个 hreflang
// `<xhtml:link>` ⇒ 单文件 2,915,029 字节 / 22,680 个 alternate 标签。
// 线上实测：连续 3 次抓取全部在 **30.00 秒**被边缘切断，每次只吐出
// 108,078 / 143,752 / 164,897 字节（三次都不一样），XML 停在标签中间、
// 没有 `</urlset>`。Google 解析失败 ⇒ 2,268 条 URL 一条都没被收录。
//
// 修法：拆成 sitemapindex + 9 个语言分片（每片约 252 条 ≈ 320 KB），
// 单次响应体缩小到 1/9，且每片只跑一个语言的展开。
//
// 🔴 拆分**不改变**任何一条 URL 的提交策略：
//    · lastModified 仍只透传数据模型里真实存在的编辑日期，缺失就不传，
//      绝不回落 new Date()（R60：否则每次构建刷全站 lastmod，Google 直接忽略该字段）；
//    · 供应商 / 产业带仍只提交通过可索引性闸门的行，与页面侧同源；
//    · audit-guide 仍只提交「确实挂有供应商档案」的组合。
//    换句话说：这里搬的是代码位置，不是 SEO 策略。任何策略改动都必须另开一轮验证。
//
// 🔴 失败方向：本模块**不吞异常**。取数失败就让构建失败。
//    「静默回落到更少的条目」正是本次事故的同型问题 —— 少提交 2,000 条 URL 而无人察觉。

import {
  getSeoMatrix,
  listCountries,
  listIndustries,
  listStandards,
} from "@/lib/taxonomy";
import { listSupplierSitemapRows, type SupplierSitemapRow } from "@/lib/queries";
import { determineSupplierIndexability } from "@/lib/seo/supplierSeo";
import { LOCALES, localePath, type Locale } from "@/i18n/config";
import { hreflangFor } from "@/i18n/hreflang";
import { COVERAGE_COUNTRIES, COVERAGE_SERVICE_SLUGS } from "@/lib/coverage";
import { GUIDES, guideCategoriesWithGuides } from "@/lib/guides";
import { CASE_STUDIES } from "@/lib/caseStudies";
import { FIELD_REPORTS } from "@/lib/fieldReports";
import { topicsForIndustry } from "@/lib/industryContent";
import { CHEMICALS } from "@/lib/chemicals";
import { listPublishedClusters } from "@/lib/industrialClusters";
import { listIndexableAuditGuideCombos } from "@/lib/auditGuideIndexability";
import { buildClusterCanonicalPath } from "@/lib/clusterRoutes";

/** 分片 key = 语言。顺序即 sitemapindex 里的顺序。 */
export const SITEMAP_LOCALES: readonly Locale[] = LOCALES;

/** 站点根，sitemap 里所有绝对 URL 的前缀。 */
export const SITEMAP_BASE = "https://factoryauditb2b.com";
const BASE = SITEMAP_BASE;

export type SitemapPathEntry = {
  /** 不含语言前缀的基础路径；"" 表示语言根 */
  path: string;
  lastModified?: Date;
};

export type SitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

/** 一条最终的 sitemap URL（已带语言前缀 + hreflang 全集） */
export type SitemapUrlEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency: SitemapChangeFrequency;
  priority: number;
  languages: Record<string, string>;
};

// 一个基础路径 → 该语言的 URL，并带上 hreflang 全集。
// 同时给出 changefreq / priority（工单 SEO-20260918-FAB 任务 3）：Google 仅作相对提示，
// 真实抓取节奏仍由内容更新频率决定；这里按页面类型分层，避免全站一刀切。
function seoFor(path: string): { changeFrequency: SitemapChangeFrequency; priority: number } {
  if (path === "") return { changeFrequency: "daily", priority: 1.0 };
  if (path.startsWith("/privacy") || path.startsWith("/terms"))
    return { changeFrequency: "yearly", priority: 0.3 };
  if (path.startsWith("/contact")) return { changeFrequency: "yearly", priority: 0.4 };
  if (path.startsWith("/standard-report") || path.startsWith("/sample"))
    return { changeFrequency: "monthly", priority: 0.8 }; // 样例报告（核心转化）
  if (path.startsWith("/tools")) return { changeFrequency: "weekly", priority: 0.8 };
  if (path.startsWith("/services")) return { changeFrequency: "monthly", priority: 0.8 };
  if (path.startsWith("/suppliers")) return { changeFrequency: "weekly", priority: 0.8 };
  // 产业带目录与详情：目录型着陆页，但内容由运营按需新增 ⇒ 提交节奏用 monthly。
  if (path.startsWith("/industrial-clusters"))
    return { changeFrequency: "monthly", priority: 0.7 };
  if (
    [
      "/trust",
      "/training-plans",
      "/methodology",
      "/logistics",
      "/custom-services",
      "/monitoring",
      "/countries",
      "/industry",
      "/chemicals",
    ].includes(path)
  )
    return { changeFrequency: "monthly", priority: 0.7 };
  if (
    path.startsWith("/guides") ||
    path.startsWith("/case-studies") ||
    path.startsWith("/field-reports") ||
    path.startsWith("/resources") ||
    path.startsWith("/audit-guide")
  )
    return { changeFrequency: "monthly", priority: 0.6 }; // 博客 / 指南 / 案例
  if (path.startsWith("/industry/")) return { changeFrequency: "monthly", priority: 0.6 };
  if (path.startsWith("/chemicals/")) return { changeFrequency: "monthly", priority: 0.5 };
  if (path.startsWith("/countries/")) return { changeFrequency: "monthly", priority: 0.6 };
  return { changeFrequency: "monthly", priority: 0.5 };
}

// lastModified 只透传**数据模型里真实存在的编辑日期**（guides / case-studies /
// field-reports 的 updated —— 也就是页面 Article.dateModified 用的同一个值）。
// 拿不到真实值就**不传**，绝不回落构建时间。
function contentDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function collectPathEntries(): Promise<SitemapPathEntry[]> {
  const core = [
    "",
    "/tools",
    "/tools/supplier-risk-calculator",
    "/tools/supplier-verification-checklist",
    "/services/supplier-verification",
    "/tools/supplier-risk-assessment",
    "/tools/audit-checklist",
    "/tools/supplier-scorecard",
    "/tools/audit-report-analyzer",
    "/tools/supplier-document-checker",
    "/tools/compare",
    "/rfq",
    "/factory-audit/request",
    // STEP-05：/verify-supplier 是「买家已拿到一家工厂、付款前判断真假」的公开
    // SEO 落地页（承接 "how to verify a supplier" / "is this factory real"）。
    // 页面自身 robots = index,follow，此前却漏提交进 sitemap —— 属
    // 「可索引页未含在站点地图」。此处补上，与页面可索引性同源。
    "/verify-supplier",
    "/join-supplier-network",
    "/suppliers",
    // CS-01：/register、/login、/account 属账户体系页面，不得进 sitemap。
    // V2.2 §75：/membership 已 301/308 合并进 /pricing，不得继续出现。
    "/pricing",
    // CS-01：/sample-report 已 308 到 /standard-report。重定向目标不得留在 sitemap。
    "/standard-report",
    "/services",
    "/services/inspection",
    "/services/supplier-improvement",
    "/monitoring",
    "/countries",
    "/industry",
    "/chemicals",
    // CHANGE SET B：产业带目录（按国家/地区/行业聚合的制造集聚区）
    "/industrial-clusters",
    ...CHEMICALS.map((c) => `/chemicals/${c.slug}`),
    "/resources",
    "/guides",
    "/case-studies",
    "/field-reports",
    "/methodology",
    "/trust",
    "/training-plans",
    "/logistics",
    "/custom-services",
    "/privacy",
    "/terms",
    // CS-23：合规三页（保密声明 / 廉洁准则）。`/trust` 已在上方列表里，不重复提交。
    "/confidentiality",
    "/integrity",
    // 人才网络入口：页脚「Work With Us」直达，承接「auditor jobs / 审核员网络」类搜索
    "/careers",
    // 联系页：给询盘一个明确落点，并承接「品牌词 + contact」这类高意图搜索。
    "/contact",
  ];

  // Phase 1 国家覆盖页与国家 × 服务商业页（内容差异化后才提交，PRD §8）
  const coverage: SitemapPathEntry[] = [
    ...COVERAGE_COUNTRIES.map((c) => ({ path: `/countries/${c.slug}` })),
    ...COVERAGE_SERVICE_SLUGS.map((x) => ({ path: `/services/${x.slug}` })),
    ...GUIDES.map((g) => ({
      path: `/guides/${g.slug}`,
      lastModified: contentDate(g.updated),
    })),
    // 内容簇 hub 着陆页：只提交「实际有指南」的分类，与页面可索引性同源
    ...guideCategoriesWithGuides().map((c) => ({ path: `/guides/category/${c}` })),
    ...CASE_STUDIES.map((c) => ({
      path: `/case-studies/${c.slug}`,
      lastModified: contentDate(c.updated),
    })),
    ...FIELD_REPORTS.map((r) => ({
      path: `/field-reports/${r.slug}`,
      lastModified: contentDate(r.updated),
    })),
  ];

  const [countries, industries, standards, supplierRows, seo, clusterRows, indexableCombos] =
    await Promise.all([
      listCountries(),
      listIndustries(),
      listStandards(),
      listSupplierSitemapRows(),
      getSeoMatrix(),
      listPublishedClusters(),
      listIndexableAuditGuideCombos(),
    ]);

  // 用 Map 去重：同一 path 若被多处产出，后写的 lastModified 生效（与原 flatMap 行为一致）。
  const byPath = new Map<string, SitemapPathEntry>();
  const add = (path: string, lastModified?: Date) => {
    byPath.set(path, lastModified ? { path, lastModified } : { path });
  };

  core.forEach((p) => add(p));
  coverage.forEach((e) => add(e.path, e.lastModified));

  // Country × AuditType 指南页。国家清单来自 listCountries()（已派生自 COVERAGE_COUNTRIES），
  // 这里的 coverageCodes 只作为第二道保险：确保 roadmap 国家永远不会漏进站点地图（PRD §8）。
  const coverageCodes = new Set(COVERAGE_COUNTRIES.map((c) => c.code));
  // 只提交「确实挂有供应商档案」的组合 —— 页面侧对零供应商组合同步 noindex，
  // 两边必须同源，否则 Search Console 报 "Submitted URL marked noindex"。
  seo.auditTypes.forEach((a) => {
    countries
      .filter((c) => coverageCodes.has(c.code))
      .forEach((c) => {
        if (!indexableCombos.has(`${c.code}/${a.code}`)) return;
        add(`/audit-guide/${c.code}/${a.code}`);
      });
  });

  // 供应商详情页（Supplier Directory V2 独立 SEO URL；旧 /supplier/{country}/{slug}
  // 已 308 到此处，不再单独提交）
  //
  // PHASE 03（§八 / §十）：提交集合必须与**可索引性闸门同源**。
  //   ① 只有 determineSupplierIndexability() 判为可索引的档案才进站内地图。
  //   ② lastModified 用真实 suppliers.updated_at（由 suppliers_set_updated_at 触发器刷新）。
  //      取值缺失时不传，绝不用当前时间顶替。
  supplierRows.forEach((row: SupplierSitemapRow) => {
    const verdict = determineSupplierIndexability({
      legalName: row.legalName,
      city: row.city,
      countryName: row.countryName,
      mainProducts: row.mainProducts,
      verificationLevel: row.verificationLevel,
      hasRealVerificationEvent: row.hasRealVerificationEvent,
      website: row.website,
      registrationNumber: row.registrationNumber,
      address: row.address,
      profileScore: row.profileScore,
      evidenceOnFile: row.evidenceOnFile,
    });
    if (!verdict.indexable) return;
    const lm = row.updatedAt ? new Date(row.updatedAt) : undefined;
    add(`/suppliers/${row.slug}`, lm && !Number.isNaN(lm.getTime()) ? lm : undefined);
  });

  // 产业带详情页（CHANGE SET B）。提交集合 = **已发布** cluster，与页面侧同源。
  clusterRows.forEach((c) => {
    const lm = c.updated_at ? new Date(c.updated_at) : undefined;
    // 正式层级 canonical URL（如 /china/guangdong/dongguan-electronics）；
    // 扁平 /industrial-clusters/<slug> 仅作 301，不进 sitemap。
    const canonical = buildClusterCanonicalPath({
      slug: c.slug,
      country_code: c.country_code,
      province: c.province,
      city: c.city,
    });
    add(canonical, lm && !Number.isNaN(lm.getTime()) ? lm : undefined);
  });

  // 行业 SEO 落地页 + 行业子主题页（CS-02A P2–P5）。
  // 子主题只提交 lib/industryContent.ts 里真正配了内容的组合，与页面 generateStaticParams 同源。
  industries.forEach((i) => {
    add(`/industry/${i.code}`);
    topicsForIndustry(i.code).forEach((tp) => add(`/industry/${i.code}/${tp.slug}`));
  });

  // standards 目前不参与 sitemap：对应的 /supplier-audit/{code} 路由尚未建成，
  // 提交会制造 404（SEO-AUDIT P0-3）。路由建成后再在这里恢复。
  void standards;

  return [...byPath.values()];
}

// 构建期缓存：9 个语言分片各自渲染时，库只查一次。
// 构建失败即抛出，不缓存 rejected promise（否则失败会被后续分片"继承"）。
let cache: Promise<SitemapPathEntry[]> | null = null;
export function getSitemapPaths(): Promise<SitemapPathEntry[]> {
  if (!cache) {
    cache = collectPathEntries().catch((e) => {
      cache = null;
      throw e;
    });
  }
  return cache;
}

/** 把一条基础路径展开成**指定语言**的一条 sitemap URL。 */
export function entryForLocale(
  path: string,
  locale: Locale,
  lastModified?: Date
): SitemapUrlEntry {
  const { changeFrequency, priority } = seoFor(path);
  // localePath 负责「英文无前缀」与「"" 与 "/" 等价」两条规则，
  // 这里不自己拼字符串 —— 拼错会产出 /zh/ 这种带尾斜杠的 308 源地址。
  return {
    url: encodeURI(`${BASE}${localePath(locale, path)}`),
    // 缺失即不输出，绝不回落到 new Date()（R60）。
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
    languages: hreflangFor(path),
  };
}
