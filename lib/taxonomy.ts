// lib/taxonomy.ts — 中央 Taxonomy Engine 访问层（§91 单一事实来源）
//
// 所有业务模块（SEO / Suppliers / RFQ / Audit / Auditor / AI 风险 / Checklist / Report）
// 必须通过本文件消费 taxonomy，不允许在模块内硬编码分类/标准/审核类型。
// 本文件为 server-only，仅在 Server Component / API Route / 脚本中调用。
//
// 共享类型与类目常量统一来自 lib/types（避免重复定义，保持 Single Source of Truth）。

import 'server-only';
import { prisma } from './db';
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

// 完整分类树（一级 + 二级叶子）
export async function getTaxonomyTree(): Promise<TaxonomyTreeNode[]> {
  const nodes = await prisma.taxonomyNode.findMany({ orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }] });
  const top = nodes.filter((n) => n.level === 0);
  const childMap = new Map<string, TaxonomyTreeNode[]>();
  for (const n of nodes.filter((x) => x.level === 1)) {
    const arr = childMap.get(n.parentCode ?? '') ?? [];
    arr.push(mapNode(n));
    childMap.set(n.parentCode ?? '', arr);
  }
  return top.map((t) => ({ ...mapNode(t), children: childMap.get(t.code) ?? [] }));
}

function mapNode(n: {
  code: string; parentCode: string | null; category: string; level: number;
  labelEn: string; labelZh: string | null; isLeaf: boolean; sortOrder: number;
}): TaxonomyTreeNode {
  return {
    code: n.code, parentCode: n.parentCode, category: n.category, level: n.level,
    labelEn: n.labelEn, labelZh: n.labelZh, isLeaf: n.isLeaf, sortOrder: n.sortOrder,
  };
}

export async function listAuditTypes(serviceType?: ServiceType): Promise<AuditTypeView[]> {
  const where = serviceType ? { serviceType } : {};
  const rows = await prisma.auditType.findMany({ where, orderBy: { code: 'asc' } });
  return rows.map((r) => ({
    code: r.code, nameEn: r.nameEn, nameZh: r.nameZh, serviceType: r.serviceType as ServiceType,
    isAudit: r.isAudit, isAssessment: r.isAssessment, isCertification: r.isCertification,
    isInspection: r.isInspection, owner: r.owner, taxonomyCode: r.taxonomyCode,
  }));
}

export async function listStandards(): Promise<StandardView[]> {
  return getStandards();
}

export async function getStandards(): Promise<StandardView[]> {
  const rows = await prisma.standard.findMany({ orderBy: { code: 'asc' } });
  return rows.map((r) => ({
    code: r.code, nameEn: r.nameEn, nameZh: r.nameZh, owner: r.owner,
    isCertification: r.isCertification, category: r.category, note: r.note,
  }));
}

// 字典：国家 / 行业（供 SEO 路由、筛选器统一消费，§91 单一事实来源）
export async function listCountries() {
  return prisma.country.findMany({ orderBy: { name: 'asc' } });
}

export async function listIndustries() {
  return prisma.industry.findMany({ orderBy: { code: 'asc' } });
}

// 风险权重模型（§58 可配置）—— 返回 UI/AI 引擎消费的数组形态
export async function getRiskModel(): Promise<RiskRule[]> {
  const rows = await prisma.riskWeightRule.findMany({ orderBy: { dimension: 'asc' } });
  return rows.map((r) => ({ dimension: r.dimension, weight: r.weight, enabled: r.enabled, description: r.description }));
}

// 风险权重（供 AI 风险引擎以 map 形态消费）
export async function getRiskWeights(): Promise<Record<string, number>> {
  const rows = await prisma.riskWeightRule.findMany({ where: { enabled: true } });
  const map: Record<string, number> = { overall: 1 };
  for (const r of rows) map[r.dimension] = r.weight;
  return map;
}

// ---------- 3. 写入函数（Admin taxonomy manager） ----------

export async function upsertTaxonomyNode(input: TaxonomyNodeInput) {
  const level = input.parentCode ? 1 : 0;
  const data = {
    code: input.code,
    parentCode: input.parentCode ?? null,
    category: input.category,
    labelEn: input.labelEn,
    labelZh: input.labelZh ?? null,
    isLeaf: input.isLeaf ?? false,
    level,
    description: input.description ?? null,
  };
  return prisma.taxonomyNode.upsert({
    where: { code: input.code },
    update: data,
    create: data,
  });
}

export async function deleteTaxonomyNode(code: string) {
  // 先删子节点（自引用无级联，需手动递归），再删自身
  const children = await prisma.taxonomyNode.findMany({ where: { parentCode: code } });
  for (const c of children) await deleteTaxonomyNode(c.code);
  await prisma.taxonomyRelation.deleteMany({ where: { OR: [{ sourceCode: code }, { targetCode: code }] } });
  return prisma.taxonomyNode.delete({ where: { code } });
}

export async function upsertRiskWeight(dimension: string, weight: number, description?: string | null) {
  return prisma.riskWeightRule.upsert({
    where: { dimension },
    update: { weight, description: description ?? undefined, updatedAt: new Date() },
    create: { dimension, weight, description: description ?? null },
  });
}

// ---------- 4. 业务消费函数（供应商 / 审核员 / RFQ / 风险） ----------

// 供应商能力标签（原始）
export async function getSupplierCapabilities(supplierId: string) {
  return prisma.supplierCapability.findMany({ where: { supplierId } });
}

// 供应商能力标签（解析为可读名称）—— lib/queries.ts 消费此函数
export interface SupplierCapabilityView {
  refType: string;
  refCode: string;
  label: string;
  verified: boolean;
  source: string;
}

export async function getSupplierCapabilitiesResolved(
  supplierId: string,
  locale: 'en' | 'zh' | 'zh-TW' = 'en',
): Promise<SupplierCapabilityView[]> {
  const caps = await prisma.supplierCapability.findMany({ where: { supplierId } });
  const useZh = locale === 'zh' || locale === 'zh-TW';
  const auditCodes = caps.filter((c) => c.refType === 'AUDIT_TYPE').map((c) => c.refCode);
  const stdCodes = caps.filter((c) => c.refType === 'STANDARD').map((c) => c.refCode);
  const taxoCodes = caps.filter((c) => c.refType === 'TAXONOMY').map((c) => c.refCode);
  const [auditTypes, standards, nodes] = await Promise.all([
    auditCodes.length ? prisma.auditType.findMany({ where: { code: { in: auditCodes } } }) : Promise.resolve([]),
    stdCodes.length ? prisma.standard.findMany({ where: { code: { in: stdCodes } } }) : Promise.resolve([]),
    taxoCodes.length ? prisma.taxonomyNode.findMany({ where: { code: { in: taxoCodes } } }) : Promise.resolve([]),
  ]);
  // 按 locale 取字段名：此前固定 nameZh || nameEn，导致英文页出现中文能力标签
  const auditMap = new Map(auditTypes.map((a) => [a.code, useZh ? a.nameZh || a.nameEn : a.nameEn]));
  const stdMap = new Map(standards.map((s) => [s.code, s.nameEn]));
  const nodeMap = new Map(nodes.map((n) => [n.code, useZh ? n.labelZh || n.labelEn : n.labelEn]));
  return caps.map((c) => ({
    refType: c.refType,
    refCode: c.refCode,
    label:
      c.refType === 'AUDIT_TYPE'
        ? auditMap.get(c.refCode) || c.refCode
        : c.refType === 'STANDARD'
          ? stdMap.get(c.refCode) || c.refCode
          : nodeMap.get(c.refCode) || c.refCode,
    verified: c.verified,
    source: c.source,
  }));
}

// 审核员能力标签 + 匹配（§49 审核员匹配）
export async function matchAuditors(opts: { auditTypeCode?: string; standardCode?: string; countryCode?: string }) {
  const caps = await prisma.auditorCapability.findMany({
    where: opts.auditTypeCode
      ? { refType: 'AUDIT_TYPE', refCode: opts.auditTypeCode }
      : opts.standardCode
        ? { refType: 'STANDARD', refCode: opts.standardCode }
        : {},
    include: { auditor: { include: { capabilities: true } } },
  });
  let auditors = caps.map((c) => c.auditor);
  if (opts.countryCode) auditors = auditors.filter((a) => a.countryCode === opts.countryCode || !a.countryCode);
  const seen = new Set<string>();
  return auditors.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

// 供应商风险画像（综合 taxonomy 维度 + 风险事件）
export async function getSupplierRiskProfile(supplierId: string) {
  const [caps, events, supplier] = await Promise.all([
    prisma.supplierCapability.findMany({ where: { supplierId, verified: true } }),
    prisma.riskEvent.findMany({ where: { supplierId } }),
    prisma.supplier.findUnique({ where: { id: supplierId } }),
  ]);
  return { supplier, capabilities: caps, events };
}

// SEO 矩阵预览（STEP 10：Country × Industry × AuditType × Standard）
export async function getSeoMatrix() {
  const [countries, industries, auditTypes] = await Promise.all([
    prisma.country.findMany(),
    prisma.industry.findMany(),
    prisma.auditType.findMany({ where: { isAudit: true } }),
  ]);
  return { countries, industries, auditTypes };
}
