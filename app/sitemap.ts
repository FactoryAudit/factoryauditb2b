import type { MetadataRoute } from "next";
import {
  getSeoMatrix,
  listCountries,
  listIndustries,
  listStandards,
} from "@/lib/taxonomy";
import { listSupplierSlugs } from "@/lib/queries";
import { LOCALES, localePath } from "@/i18n/config";
import { hreflangFor } from "@/i18n/hreflang";
import { COVERAGE_COUNTRIES, COVERAGE_SERVICE_SLUGS } from "@/lib/coverage";
import { GUIDES } from "@/lib/guides";
import { CASE_STUDIES } from "@/lib/caseStudies";
import { FIELD_REPORTS } from "@/lib/fieldReports";

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
    "/register",
    "/membership",
    "/pricing",
    "/sample-report",
    "/standard-report",
    "/services",
    "/services/inspection",
    "/services/supplier-improvement",
    "/monitoring",
    "/countries",
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

  // 一个基础路径 → 六条语言 URL，每条都带 hreflang 全集
  const emit = (path: string, lastModified?: Date): MetadataRoute.Sitemap =>
    LOCALES.map((l) => ({
      url: `${BASE}${localePath(l, path)}`,
      lastModified: lastModified ?? new Date(),
      alternates: { languages: hreflangFor(path) },
    }));

  const pages: MetadataRoute.Sitemap = [...core, ...coverage].flatMap((p) => emit(p));

  const [countries, industries, standards, supplierSlugs, seo] = await Promise.all([
    listCountries(),
    listIndustries(),
    listStandards(),
    listSupplierSlugs(),
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
  supplierSlugs.forEach(({ slug }) => pages.push(...emit(`/suppliers/${slug}`)));

  // 行业 SEO 落地页
  industries.forEach((i) => pages.push(...emit(`/industry/${i.code}`)));
  // 注意：/country/{code} 已 308 到 /countries/{code}，不再作为独立条目提交。
  // 只有 Phase 1 三个国家有差异化内容页，已在上面的 coverage 中提交（PRD §8）。

  return pages;
}
