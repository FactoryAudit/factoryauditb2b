// lib/queries.ts —— 供应商读取层（V2.0 轻量化：第一阶段数据源为静态常量）
//
// 替代 Prisma/Neon：所有供应商查询改读 lib/staticData.ts 的 STATIC_SUPPLIERS。
// 函数签名保持不变，页面 / sitemap / API 消费方零改动。
// 未来内容量大到需要动态管理时，再切回 Prisma（schema.prisma / seed.js 已保留），
// 只改本文件实现即可。

import { STATIC_SUPPLIERS, STATIC_COUNTRIES } from "./staticData";
import type { StaticSupplier } from "./staticData";
import { getSupplierCapabilitiesResolved } from "./taxonomy";

export type SupplierCapabilityView = {
  refType: string;
  refCode: string;
  label: string;
  verified: boolean;
  source: string;
};

// 与页面当前消费的供应商形状保持一致（mainProducts/exportMarkets/certifications 为数组）
export type SupplierView = {
  slug: string;
  legalName: string;
  country: string;
  countryName?: string;
  city: string;
  industryCode?: string;
  businessType: string;
  established?: number;
  employees?: string;
  mainProducts: string[];
  exportMarkets: string[];
  verificationStatus?: string;
  riskScore?: number;
  riskLevel?: string;
  certifications: string[];
  auditStatus?: string;
  inspectionHistory: number;
  /** 证据条数（SupplierEvidence），目录页显示「可用证据」 */
  evidenceCount: number;
  /** 其中已核验的条数 */
  evidenceVerified: number;
};

function countryNameOf(code: string): string {
  return STATIC_COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

function toView(s: (typeof STATIC_SUPPLIERS)[number]): SupplierView {
  return {
    slug: s.slug,
    legalName: s.legalName,
    country: s.countryCode,
    countryName: countryNameOf(s.countryCode),
    city: s.city,
    industryCode: s.industryCode,
    businessType: s.businessType,
    established: s.established,
    employees: s.employees,
    mainProducts: s.mainProducts,
    exportMarkets: s.exportMarkets,
    verificationStatus: s.verificationStatus,
    riskScore: s.riskScore,
    riskLevel: s.riskLevel,
    certifications: s.certifications,
    auditStatus: s.auditStatus,
    inspectionHistory: s.inspectionHistory,
    evidenceCount: s.evidence.length,
    evidenceVerified: s.evidence.filter((e) => e.status === "VERIFIED").length,
  };
}

/**
 * 供应商目录：带证据统计与国家名。
 * 注意：返回真实条数，不补 mock 数字，也不显示平台规模 —— 收录量小就把
 * 「找不到？发 RFQ」做成主入口（PRD §57/§58）。
 */
export async function listSupplierDirectory(): Promise<SupplierView[]> {
  return STATIC_SUPPLIERS.map(toView).sort((a, b) => {
    if (a.riskScore !== b.riskScore) return (a.riskScore ?? 0) - (b.riskScore ?? 0);
    return a.legalName.localeCompare(b.legalName);
  });
}

/** 供应商详情：基本信息 + 证据 + 能力标签（能力标签按 locale 取名，避免英文页出现中文） */
export async function getSupplierDetail(
  slug: string,
  locale: "en" | "zh" | "zh-TW" = "en"
) {
  const row = STATIC_SUPPLIERS.find((s) => s.slug === slug);
  if (!row) return null;
  const view = toView(row);
  const capabilities = await getSupplierCapabilitiesResolved(slug, locale);
  return {
    ...view,
    evidence: row.evidence.map((e, i) => ({
      id: `${slug}-ev-${i}`,
      type: e.type,
      status: e.status,
      source: e.source,
      date: e.date,
      note: e.note ?? null,
    })),
    capabilities,
  };
}

export async function listSuppliers(): Promise<SupplierView[]> {
  return STATIC_SUPPLIERS.map(toView);
}

export async function getSupplierBySlug(slug: string): Promise<SupplierView | null> {
  const row = STATIC_SUPPLIERS.find((s) => s.slug === slug);
  if (!row) return null;
  return toView(row);
}

export async function listSupplierSlugs(): Promise<{ country: string; slug: string }[]> {
  return STATIC_SUPPLIERS.map((s) => ({ country: s.countryCode, slug: s.slug }));
}

// STEP 4: 供应商能力标签（消费 taxonomy engine）—— 解析出可读名称
export async function getSupplierCapabilities(slug: string): Promise<SupplierCapabilityView[]> {
  return getSupplierCapabilitiesResolved(slug);
}

// ---------- 落地页 / SEO 矩阵消费用的原始静态行（保留 countryCode / capabilities / evidence） ----------
// 说明：这些函数返回静态原始形状（含 countryCode 与 capabilities），
// 供 /countries / /industry / /audit-guide 页面按维度过滤与渲染，避免二次解析。

function sortByRisk(rows: StaticSupplier[]): StaticSupplier[] {
  return [...rows].sort((a, b) => a.riskScore - b.riskScore);
}

export async function listSuppliersByCountry(countryCode: string): Promise<StaticSupplier[]> {
  return sortByRisk(STATIC_SUPPLIERS.filter((s) => s.countryCode === countryCode));
}

export async function listSuppliersByIndustry(industryCode: string): Promise<StaticSupplier[]> {
  return sortByRisk(STATIC_SUPPLIERS.filter((s) => s.industryCode === industryCode));
}

export async function listSuppliersByAuditType(
  countryCode: string,
  refCode: string
): Promise<StaticSupplier[]> {
  return sortByRisk(
    STATIC_SUPPLIERS.filter(
      (s) =>
        s.countryCode === countryCode &&
        s.capabilities.some((c) => c.refType === "AUDIT_TYPE" && c.refCode === refCode)
    )
  );
}
