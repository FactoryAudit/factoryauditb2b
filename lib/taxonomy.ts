// lib/taxonomy.ts — 中央 Taxonomy Engine 访问层（§91 单一事实来源）
//
// V2.0 轻量化：第一阶段数据源改为静态常量 lib/staticData.ts（替代 Prisma/Neon）。
// 所有业务模块仍通过本文件消费分类/标准/审核类型，函数签名保持不变，
// 消费方（页面/API/sitemap）零改动。未来切回数据库时只改本文件实现即可。
//
// 本文件为 server-only，仅在 Server Component / API Route / 脚本中调用。

import 'server-only';
import {
  STATIC_COUNTRIES,
  STATIC_INDUSTRIES,
  STATIC_PROGRAMS,
  STATIC_TOP_CATEGORIES,
  STATIC_RISK_WEIGHTS,
  STATIC_SUPPLIERS,
} from './staticData';
import type {
  ServiceType,
  VerificationStatus,
  RiskLevel,
  TaxonomyCategory,
  CapabilityRefType,
} from './types';

export type { ServiceType, VerificationStatus, RiskLevel, TaxonomyCategory, CapabilityRefType };
export { TAXONOMY_CATEGORIES, SERVICE_TYPES } from './types';

// ---------- 1. 视图类型 ----------

export interface TaxonomyTreeNode {
  code: string;
  parentCode: string | null;
  category: string;
  level: number;
  labelEn: string;
  labelZh: string | null;
  isLeaf: boolean;
  sortOrder: number;
  children?: TaxonomyTreeNode[];
}

export interface TaxonomyNodeInput {
  code: string;
  parentCode?: string | null;
  category: string;
  labelEn: string;
  labelZh?: string | null;
  isLeaf?: boolean;
  description?: string | null;
}

export interface AuditTypeView {
  code: string;
  nameEn: string;
  nameZh: string | null;
  serviceType: ServiceType;
  isAudit: boolean;
  isAssessment: boolean;
  isCertification: boolean;
  isInspection: boolean;
  owner: string | null;
  taxonomyCode: string | null;
}

export interface StandardView {
  code: string;
  nameEn: string;
  nameZh: string | null;
  owner: string | null;
  isCertification: boolean;
  category: string | null;
  note: string | null;
}

export interface RiskRule {
  dimension: string;
  weight: number;
  enabled: boolean;
  description: string | null;
}

// ---------- 2. 中央读取函数（所有模块统一入口） ----------

export async function getTaxonomyTree(): Promise<TaxonomyTreeNode[]> {
  const top = STATIC_TOP_CATEGORIES.map((cat, i) => ({
    code: cat.code,
    parentCode: null as string | null,
    category: cat.code,
    level: 0,
    labelEn: cat.labelEn,
    labelZh: cat.labelZh,
    isLeaf: false,
    sortOrder: i,
    children: cat.children.map((childCode, j) => {
      const p = STATIC_PROGRAMS.find((x) => x.code === childCode);
      return {
        code: `NODE_${childCode}`,
        parentCode: cat.code,
        category: cat.code,
        level: 1,
        labelEn: p ? p.nameEn : childCode,
        labelZh: p ? p.nameZh : null,
        isLeaf: true,
        sortOrder: j,
      };
    }),
  }));
  return top;
}

export async function listAuditTypes(serviceType?: ServiceType): Promise<AuditTypeView[]> {
  const rows = serviceType
    ? STATIC_PROGRAMS.filter((p) => p.serviceType === serviceType)
    : STATIC_PROGRAMS;
  return rows
    .map((p) => ({
      code: p.code,
      nameEn: p.nameEn,
      nameZh: p.nameZh,
      serviceType: p.serviceType as ServiceType,
      isAudit: p.isAudit ?? false,
      isAssessment: false,
      isCertification: p.isCertification ?? false,
      isInspection: p.isInspection ?? false,
      owner: p.owner ?? null,
      taxonomyCode: p.category,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function listStandards(): Promise<StandardView[]> {
  return getStandards();
}

export async function getStandards(): Promise<StandardView[]> {
  return STATIC_PROGRAMS.filter((p) => p.isCertification)
    .map((p) => ({
      code: p.code,
      nameEn: p.nameEn,
      nameZh: p.nameZh,
      owner: p.owner ?? null,
      isCertification: true,
      category: p.category,
      note: p.note ?? null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

// 字典：国家 / 行业（供 SEO 路由、筛选器统一消费）
export async function listCountries() {
  return STATIC_COUNTRIES;
}

export async function listIndustries() {
  return STATIC_INDUSTRIES;
}

// 风险权重模型（§58 可配置）
export async function getRiskModel(): Promise<RiskRule[]> {
  return STATIC_RISK_WEIGHTS.map((r) => ({
    dimension: r.dimension,
    weight: r.weight,
    enabled: r.enabled,
    description: r.description,
  }));
}

// 风险权重（供 AI 风险引擎以 map 形态消费）
export async function getRiskWeights(): Promise<Record<string, number>> {
  const map: Record<string, number> = { overall: 1 };
  for (const r of STATIC_RISK_WEIGHTS) if (r.enabled) map[r.dimension] = r.weight;
  return map;
}

// ---------- 3. 写入函数（Admin taxonomy manager，第一阶段停用，保留签名返回 stub） ----------

export async function upsertTaxonomyNode(_input: TaxonomyNodeInput) {
  // 第一阶段静态数据，写入功能停用。保留签名以避免消费方类型报错。
  return null;
}

export async function deleteTaxonomyNode(_code: string) {
  return null;
}

export async function upsertRiskWeight(_dimension: string, _weight: number, _description?: string | null) {
  return null;
}

// ---------- 4. 业务消费函数（供应商 / 审核员 / RFQ / 风险） ----------

export interface SupplierCapabilityView {
  refType: string;
  refCode: string;
  label: string;
  verified: boolean;
  source: string;
}

// 供应商能力标签（解析为可读名称）—— lib/queries.ts 消费此函数。
// V2.0：供应商以 slug 标识（静态数据无 DB id）。
export async function getSupplierCapabilitiesResolved(
  slug: string,
  locale: 'en' | 'zh' | 'zh-TW' = 'en',
): Promise<SupplierCapabilityView[]> {
  const supplier = STATIC_SUPPLIERS.find((s) => s.slug === slug);
  if (!supplier) return [];
  const useZh = locale === 'zh' || locale === 'zh-TW';
  return supplier.capabilities.map((c) => {
    const prog = STATIC_PROGRAMS.find((p) => p.code === c.refCode);
    const label = c.refType === 'TAXONOMY'
      ? null
      : prog
        ? (useZh ? prog.nameZh : prog.nameEn)
        : c.refCode;
    return {
      refType: c.refType,
      refCode: c.refCode,
      label: label || c.refCode,
      verified: c.verified,
      source: c.source,
    };
  });
}

// 审核员匹配（§49）—— 第一阶段审核员网络用 Google Sheets 维护，此函数返回空列表。
export async function matchAuditors(_opts: { auditTypeCode?: string; standardCode?: string; countryCode?: string }) {
  return [];
}

// 供应商风险画像
export async function getSupplierRiskProfile(slug: string) {
  const supplier = STATIC_SUPPLIERS.find((s) => s.slug === slug);
  if (!supplier) return { supplier: null, capabilities: [], events: [] };
  return {
    supplier,
    capabilities: supplier.capabilities.filter((c) => c.verified),
    events: [],
  };
}

// SEO 矩阵预览（Country × Industry × AuditType）
// auditTypes 字段对齐 AuditTypeView（含 owner / taxonomyCode / description），
// 供 /audit-guide/[country]/[auditType] 页面与 sitemap 消费（description 第一阶段为空）。
export async function getSeoMatrix() {
  const auditTypes = STATIC_PROGRAMS.filter((p) => p.isAudit).map((p) => ({
    code: p.code,
    nameEn: p.nameEn,
    nameZh: p.nameZh,
    owner: p.owner ?? null,
    taxonomyCode: p.category,
    description: null as string | null,
  }));
  return { countries: STATIC_COUNTRIES, industries: STATIC_INDUSTRIES, auditTypes };
}
