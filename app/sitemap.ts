import type { MetadataRoute } from "next";
import {
  getSeoMatrix,
  listCountries,
  listIndustries,
  listStandards,
} from "@/lib/taxonomy";
import { listSupplierSitemapRows, type SupplierSitemapRow } from "@/lib/queries";
import { determineSupplierIndexability } from "@/lib/seo/supplierSeo";
import { LOCALES, localePath } from "@/i18n/config";
import { hreflangFor } from "@/i18n/hreflang";
import { COVERAGE_COUNTRIES, COVERAGE_SERVICE_SLUGS } from "@/lib/coverage";
import { GUIDES } from "@/lib/guides";
import { CASE_STUDIES } from "@/lib/caseStudies";
import { FIELD_REPORTS } from "@/lib/fieldReports";
import { topicsForIndustry } from "@/lib/industryContent";
import { CHEMICALS } from "@/lib/chemicals";

const BASE = "https://factoryauditb2b.com";

// 程序化 SEO 站点地图（§STEP 10）—— 全部维度由中央 taxonomy 引擎驱动。
// 每种语言一条 URL，并带完整 hreflang 变体（英文落在无前缀地址，并被标为 x-default）。
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const core = [
    "",
    "/about",
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
    "/join-supplier-network",
    "/suppliers",
    // CS-01：/register 是账户体系页面，与 /login、/account 同类，不应进 sitemap
    //（SEO 规范 §二十五：account / login 类页面不得提交）。此前只有它在 core 列表里
    // 而 /login、/account 不在 ⇒ 三处策略不一致。已移除，并对该页补 noindex。
    // V2.2 §75：/membership 已 301/308 合并进 /pricing，不得继续出现在 sitemap。
    "/pricing",
    // CS-01：/sample-report 已 308 到 /standard-report（两者此前争夺同一批
    //「supplier audit report sample」词）。重定向目标**不能**继续留在 sitemap 里。
    "/standard-report",
    "/services",
    "/services/inspection",
    "/services/supplier-improvement",
    "/monitoring",
    "/countries",
    "/industry",
    "/chemicals",
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
    // 联系页：此前全站无 /contact，访客只能靠页脚邮箱找人。补上以承接
    //「品牌词 + contact」这类高意图搜索，并给询盘一个明确落点。
    "/contact",
  ];

  // Phase 1 国家覆盖页与国家 × 服务商业页（内容差异化后才提交，PRD §8）
  const coverage = [
    ...COVERAGE_COUNTRIES.map((c) => `/countries/${c.slug}`),
    ...COVERAGE_SERVICE_SLUGS.map((x) => `/services/${x.slug}`),
    ...GUIDES.map((g) => `/guides/${g.slug}`),
    ...CASE_STUDIES.map((c) => `/case-studies/${c.slug}`),
    ...FIELD_REPORTS.map((r) => `/field-reports/${r.slug}`),
  ];

  // 已 308 到新地址的旧路径，不进站点地图
  // （/knowledge → /services/supplier-improvement，/inspectors → /resources）

  // 一个基础路径 → 六条语言 URL，每条都带 hreflang 全集。
  // 同时给出 changefreq / priority（工单 SEO-20260918-FAB 任务 3）：Google 仅作相对提示，
  // 真实抓取节奏仍由内容更新频率决定；这里按页面类型分层，避免全站一刀切。
  function seoFor(path: string): {
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
    priority: number;
  } {
    if (path === "") return { changeFrequency: "daily", priority: 1.0 };
    if (path.startsWith("/privacy") || path.startsWith("/terms"))
      return { changeFrequency: "yearly", priority: 0.3 };
    if (path.startsWith("/contact")) return { changeFrequency: "yearly", priority: 0.4 };
    if (path.startsWith("/standard-report") || path.startsWith("/sample"))
      return { changeFrequency: "monthly", priority: 0.8 }; // 样例报告（核心转化）
    if (path.startsWith("/tools")) return { changeFrequency: "weekly", priority: 0.8 };
    if (path.startsWith("/services")) return { changeFrequency: "monthly", priority: 0.8 };
    if (path.startsWith("/suppliers")) return { changeFrequency: "weekly", priority: 0.8 };
    if (
      [
        "/about",
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

  const emit = (path: string, lastModified?: Date): MetadataRoute.Sitemap => {
    const { changeFrequency, priority } = seoFor(path);
    return LOCALES.map((l) => ({
      url: `${BASE}${localePath(l, path)}`,
      lastModified: lastModified ?? new Date(),
      changeFrequency,
      priority,
      alternates: { languages: hreflangFor(path) },
    }));
  };

  const pages: MetadataRoute.Sitemap = [...core, ...coverage].flatMap((p) => emit(p));

  const [countries, industries, standards, supplierRows, seo] = await Promise.all([
    listCountries(),
    listIndustries(),
    listStandards(),
    listSupplierSitemapRows(),
    getSeoMatrix(),
  ]);

  // 注意：以下程序化矩阵 URL 对应的页面尚未建成，提交会导致大量 404（SEO-AUDIT P0-3）。
  // 建成对应路由后再逐段恢复。
  // countries.forEach((c) => {
  //   pages.push(...emit(`/factory-audit/${c.code}`));
  //   pages.push(...emit(`/supplier-verification/${c.code}`));
  //   industries.forEach((i) =>
  //     pages.push(...emit(`/factory-audit/${c.code}/${i.code.toLowerCase()}`))
  //   );
  // });
  // standards.forEach((s) => pages.push(...emit(`/supplier-audit/${s.code}`)));

  // Country × AuditType 指南页。国家清单来自 listCountries()（已派生自 COVERAGE_COUNTRIES），
  // 这里的 coverageCodes 只作为第二道保险：确保 roadmap 国家永远不会漏进站点地图（PRD §8）。
  const coverageCodes = new Set(COVERAGE_COUNTRIES.map((c) => c.code));
  seo.auditTypes.forEach((a) => {
    countries
      .filter((c) => coverageCodes.has(c.code))
      .forEach((c) => pages.push(...emit(`/audit-guide/${c.code}/${a.code}`)));
  });

  // 供应商详情页（Supplier Directory V2 独立 SEO URL；旧 /supplier/{country}/{slug} 已 308 到此处，不再单独提交）
  //
  // PHASE 03（§八 / §十）：提交集合必须与**可索引性闸门同源**。
  //   ① 只有 determineSupplierIndexability() 判为可索引的档案才进站内地图。
  //      否则会出现「sitemap 里有、页面却 noindex」——Search Console 直接报
  //      "Submitted URL marked noindex"，是明确的抓取预算浪费。
  //   ② lastModified 改用**真实** updated_at（DB suppliers.updated_at，
  //      由 suppliers_set_updated_at 触发器在每次 UPDATE 时刷新；「发布」本身也是 UPDATE）。
  //      此前一律 new Date()，等于每次都告诉 Google「所有页面刚刚全部变过」——
  //      既无意义，也会让真实更新淹没在噪声里。
  //      取值缺失时**不传** lastModified，绝不用当前时间顶替。
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
    pages.push(
      ...emit(
        `/suppliers/${row.slug}`,
        lm && !Number.isNaN(lm.getTime()) ? lm : undefined
      )
    );
  });

  // 行业 SEO 落地页 + 行业子主题页（CS-02A P2–P5）。
  // 子主题只提交 lib/industryContent.ts 里真正配了内容的组合，
  // 与页面 generateStaticParams 同源 —— 未配置的组合不存在页面，绝不进站点地图。
  industries.forEach((i) => {
    pages.push(...emit(`/industry/${i.code}`));
    topicsForIndustry(i.code).forEach((tp) =>
      pages.push(...emit(`/industry/${i.code}/${tp.slug}`))
    );
  });
  // 注意：/country/{code} 已 308 到 /countries/{code}，不再作为独立条目提交。
  // 只有 Phase 1 三个国家有差异化内容页，已在上面的 coverage 中提交（PRD §8）。

  return pages;
}
