// lib/relatedGuides.ts —— Topic Cluster 内链映射（单一真源）
//
// 背景（2026-10-09 全站内链实测，脚本 scripts/_r69_internal_link_audit.cjs）：
//   全站 0 孤儿页，但指南库是「链接孤岛」：
//     /services  平均入链 50.1 → 指向 /guides 的链接数 = 0
//     /tools     平均入链 48.9 → 指向 /guides 的链接数 = 0
//     /countries 平均入链 39.2 → 指向 /guides 的链接数 = 0
//     /industry  平均入链 13.1 → 指向 /guides 的链接数 = 0
//     /audit-guide 平均入链 11.0 → 指向 /guides 的链接数 = 0
//   而 /guides 自身平均入链只有 7.9 —— 全站权重最高的商业页**一次都没有**
//   把权重传给内容最深的指南库，「支柱页 ↔ 长文」的双向内链只做了一半。
//
// 本文件提供按「枢纽（hub）」挑选相关指南的映射，供 <RelatedGuides /> 消费。
//
// 🔴 约束：
//   1. 所有 slug 必须是 lib/guides.ts 里真实存在的 slug —— 否则产出死链。
//      `validateRelatedGuides()` 用于构建前/验收时的死链体检（见 scripts/_r69_*）。
//   2. 相关性靠**人工策展**，不做「国名替换式」的机械映射 ——
//      同一批指南可以服务多个相近枢纽（这是内链，不是正文）。
//   3. 空数组 ⇒ 组件整块不渲染，绝不输出空标题。

import { GUIDES } from "@/lib/guides";
import { COVERAGE_SERVICE_SLUGS } from "@/lib/coverage";

const MAX = 6;

/** 国家 → 该国采购语境下最相关的指南 */
const COUNTRY_GUIDES: Record<string, string[]> = {
  china: [
    "how-to-verify-a-chinese-supplier",
    "china-factory-or-trading-company",
    "how-to-check-china-company-registration",
    "buyer-ready-china-supplier",
    "china-factory-audit-cost",
    "when-to-order-china-factory-audit",
  ],
  vietnam: [
    "how-to-audit-a-factory-in-vietnam",
    "china-plus-one-supplier-qualification",
    "supplier-evaluation-checklist",
    "on-site-vs-desk-audit",
    "factory-audit-checklist",
  ],
  thailand: [
    "china-plus-one-supplier-qualification",
    "how-to-audit-a-factory-in-vietnam",
    "supplier-evaluation-checklist",
    "on-site-vs-desk-audit",
    "factory-audit-checklist",
  ],
  malaysia: [
    "china-plus-one-supplier-qualification",
    "supplier-evaluation-checklist",
    "how-to-audit-a-factory-in-vietnam",
    "factory-audit-checklist",
    "on-site-vs-desk-audit",
  ],
  philippines: [
    "china-plus-one-supplier-qualification",
    "supplier-evaluation-checklist",
    "on-site-vs-desk-audit",
    "how-to-audit-a-factory-in-vietnam",
    "factory-audit-checklist",
  ],
};

/** 服务类别 code → 该服务决策阶段最相关的指南 */
const SERVICE_GUIDES: Record<string, string[]> = {
  verification: [
    "how-to-verify-a-chinese-supplier",
    "supplier-evaluation-checklist",
    "supplier-verification-vs-factory-audit-vs-inspection",
    "verify-supplier-before-deposit",
    "china-factory-or-trading-company",
  ],
  audit: [
    "what-is-a-factory-audit",
    "factory-audit-checklist",
    "on-site-vs-desk-audit",
    "how-to-read-a-factory-audit-report",
    "when-to-order-china-factory-audit",
  ],
  inspection: [
    "pre-shipment-inspection-checklist",
    "aql-sampling-standard-fri",
    "ppi-vs-dupro-inspection",
    "full-inspection-100-percent",
    "failed-inspection-dispute",
  ],
  improvement: [
    "what-is-quality-management-system",
    "supplier-quality-audit-checklist",
    "manufacturing-quality-control-process",
    "iso-9001-vs-iso-13485",
    "capacity-audit-guide",
  ],
};

/** 审核/标准 code → 该标准语境下最相关的指南 */
const AUDIT_TYPE_GUIDES: Record<string, string[]> = {
  SMETA: [
    "smeta-vs-bsci-social-audit-comparison",
    "smeta-7-supplier-audit-buyer-guide",
    "rba-vap-vs-smeta-vs-bsci",
    "ethical-audit-mandatory-requirements",
    "sa8000-certification-guide",
  ],
  BSCI: [
    "smeta-vs-bsci-social-audit-comparison",
    "rba-vap-vs-smeta-vs-bsci",
    "ethical-audit-mandatory-requirements",
    "sa8000-certification-guide",
    "supplier-quality-audit-checklist",
  ],
  ICTI: [
    "smeta-vs-bsci-social-audit-comparison",
    "ethical-audit-mandatory-requirements",
    "supplier-quality-audit-checklist",
    "factory-audit-checklist",
    "on-site-vs-desk-audit",
  ],
  BRC: [
    "what-is-quality-management-system",
    "manufacturing-quality-control-process",
    "supplier-quality-audit-checklist",
    "factory-audit-checklist",
    "how-to-read-a-factory-audit-report",
  ],
  HACCP: [
    "what-is-quality-management-system",
    "manufacturing-quality-control-process",
    "supplier-quality-audit-checklist",
    "factory-audit-checklist",
    "esg-supplier-audit-guide",
  ],
  FSSC22000: [
    "what-is-quality-management-system",
    "manufacturing-quality-control-process",
    "supplier-quality-audit-checklist",
    "factory-audit-checklist",
    "how-to-read-a-factory-audit-report",
  ],
  RBA: [
    "rba-vap-vs-smeta-vs-bsci",
    "smeta-vs-bsci-social-audit-comparison",
    "ethical-audit-mandatory-requirements",
    "esg-supplier-audit-guide",
    "eu-forced-labour-regulation-china-suppliers",
  ],
};

/** 行业 code → 该行业采购语境下最相关的指南 */
const INDUSTRY_GUIDES: Record<string, string[]> = {
  electronics: [
    "supplier-quality-audit-checklist",
    "what-is-quality-management-system",
    "iso-9001-vs-iso-13485",
    "manufacturing-quality-control-process",
    "capacity-audit-guide",
  ],
  textiles: [
    "smeta-vs-bsci-social-audit-comparison",
    "ethical-audit-mandatory-requirements",
    "rba-vap-vs-smeta-vs-bsci",
    "supplier-quality-audit-checklist",
    "factory-audit-checklist",
  ],
  toys: [
    "smeta-vs-bsci-social-audit-comparison",
    "ethical-audit-mandatory-requirements",
    "supplier-quality-audit-checklist",
    "factory-audit-checklist",
    "on-site-vs-desk-audit",
  ],
  footwear: [
    "smeta-vs-bsci-social-audit-comparison",
    "ethical-audit-mandatory-requirements",
    "supplier-quality-audit-checklist",
    "factory-audit-checklist",
    "on-site-vs-desk-audit",
  ],
  machinery: [
    "ppap-production-part-approval",
    "iso-9001-vs-iso-13485",
    "supplier-quality-audit-checklist",
    "capacity-audit-guide",
    "manufacturing-quality-control-process",
  ],
  plastics: [
    "manufacturing-quality-control-process",
    "supplier-quality-audit-checklist",
    "what-is-quality-management-system",
    "capacity-audit-guide",
    "iso-9001-vs-iso-13485",
  ],
  "home-appliances": [
    "supplier-quality-audit-checklist",
    "iso-9001-vs-iso-13485",
    "manufacturing-quality-control-process",
    "capacity-audit-guide",
    "fba-rejection-inspection",
  ],
  "food-beverage": [
    "what-is-quality-management-system",
    "manufacturing-quality-control-process",
    "supplier-quality-audit-checklist",
    "esg-supplier-audit-guide",
    "factory-audit-checklist",
  ],
  chemicals: [
    "manufacturing-quality-control-process",
    "supplier-quality-audit-checklist",
    "esg-supplier-audit-guide",
    "eu-forced-labour-regulation-china-suppliers",
    "factory-audit-checklist",
  ],
  automotive: [
    "ppap-production-part-approval",
    "iso-9001-vs-iso-13485",
    "supplier-quality-audit-checklist",
    "manufacturing-quality-control-process",
    "capacity-audit-guide",
  ],
  furniture: [
    "supplier-quality-audit-checklist",
    "capacity-audit-guide",
    "fba-rejection-inspection",
    "factory-audit-checklist",
    "manufacturing-quality-control-process",
  ],
  packaging: [
    "supplier-quality-audit-checklist",
    "manufacturing-quality-control-process",
    "capacity-audit-guide",
    "factory-audit-checklist",
    "fba-rejection-inspection",
  ],
  cosmetics: [
    "what-is-quality-management-system",
    "manufacturing-quality-control-process",
    "supplier-quality-audit-checklist",
    "esg-supplier-audit-guide",
    "factory-audit-checklist",
  ],
};

/** 免费工具 slug → 该工具使用场景下最相关的指南 */
const TOOL_GUIDES: Record<string, string[]> = {
  "supplier-risk-calculator": [
    "supplier-risk-assessment-guide",
    "china-supplier-risk-assessment-framework",
    "third-party-audit-pain-points",
    "brand-reputation-pr-crisis",
  ],
  "supplier-verification-checklist": [
    "how-to-verify-a-chinese-supplier",
    "supplier-evaluation-checklist",
    "verify-supplier-before-deposit",
    "china-factory-or-trading-company",
  ],
  compare: [
    "supplier-evaluation-checklist",
    "supplier-verification-vs-factory-audit-vs-inspection",
    "smeta-vs-bsci-social-audit-comparison",
    "china-supplier-risk-assessment-framework",
  ],
  "audit-checklist": [
    "factory-audit-checklist",
    "supplier-quality-audit-checklist",
    "what-is-a-factory-audit",
    "how-to-read-a-factory-audit-report",
  ],
  "supplier-risk-assessment": [
    "supplier-risk-assessment-guide",
    "china-supplier-risk-assessment-framework",
    "chinese-supplier-scam-red-flags",
    "common-b2b-procurement-fraud",
  ],
  "supplier-scorecard": [
    "supplier-evaluation-checklist",
    "supplier-quality-audit-checklist",
    "capacity-audit-guide",
    "on-site-vs-desk-audit",
  ],
  "audit-report-analyzer": [
    "how-to-read-a-factory-audit-report",
    "third-party-audit-pain-points",
    "supplier-quality-audit-checklist",
    "failed-inspection-dispute",
  ],
  "supplier-document-checker": [
    "how-to-check-china-company-registration",
    "how-to-verify-a-chinese-supplier",
    "china-factory-or-trading-company",
    "verify-alibaba-supplier-before-paying",
  ],
};

/**
 * `/services` 索引页（全站最高权重页之一，平均入链 187）用的通用组合：
 * 三个服务类别各取前 2 篇，覆盖「核查 / 验厂 / 验货」三条决策线。
 */
const SERVICES_HUB = [
  ...(SERVICE_GUIDES.verification ?? []).slice(0, 2),
  ...(SERVICE_GUIDES.audit ?? []).slice(0, 2),
  ...(SERVICE_GUIDES.inspection ?? []).slice(0, 2),
];

/**
 * 统一入口：`kind:key` → 指南 slug 列表。
 * 供 <RelatedGuides hub="…" /> 使用（页面侧只需一个字符串字面量，挂载零变量依赖）。
 *
 * 支持的 hub：
 *   `services-hub`             → /services 索引
 *   `country:<code>`           → /countries/<slug>
 *   `service:<code>`           → /services/{supplier-verification,inspection,supplier-improvement}
 *   `service-country:<slug>`   → /services/<country>-<service>（如 china-factory-audit）
 *   `audit-type:<CODE>`        → /audit-guide/<country>/<CODE>
 *   `industry:<code>`          → /industry/<code>
 *   `tool:<slug>`              → /tools/<slug>
 */
export function guidesForHub(hub: string): string[] {
  const i = hub.indexOf(":");
  const kind = (i === -1 ? hub : hub.slice(0, i)).trim();
  const key = i === -1 ? "" : hub.slice(i + 1).trim();
  switch (kind) {
    case "services-hub":
      return pick(SERVICES_HUB);
    case "country":
      return guidesForCountry(key);
    case "service":
      return guidesForService(key);
    case "service-country":
      return guidesForCountryService(key);
    case "audit-type":
      return guidesForAuditType(key);
    case "industry":
      return guidesForIndustry(key);
    case "tool":
      return guidesForTool(key);
    default:
      return [];
  }
}

/** 已知指南 slug 集合（用于剔除失效引用，避免死链） */
const KNOWN = new Set(GUIDES.map((g) => g.slug));

function pick(slugs: string[] | undefined): string[] {
  if (!slugs) return [];
  const out: string[] = [];
  for (const s of slugs) {
    if (KNOWN.has(s) && !out.includes(s)) out.push(s);
    if (out.length >= MAX) break;
  }
  return out;
}

export function guidesForCountry(code: string): string[] {
  return pick(COUNTRY_GUIDES[code]);
}

export function guidesForService(code: string): string[] {
  return pick(SERVICE_GUIDES[code]);
}

export function guidesForAuditType(code: string): string[] {
  return pick(AUDIT_TYPE_GUIDES[code]);
}

export function guidesForIndustry(code: string): string[] {
  return pick(INDUSTRY_GUIDES[code]);
}

export function guidesForTool(slug: string): string[] {
  return pick(TOOL_GUIDES[slug]);
}

/**
 * 国家 × 服务的合并内链（`/services/<country>-<service>` 这类页面用）。
 * 先解出该 slug 对应的国家与服别，再合并两边并去重。
 */
export function guidesForCountryService(slug: string): string[] {
  const cs = COVERAGE_SERVICE_SLUGS.find((x) => x.slug === slug);
  if (!cs) return [];
  return pick([...(COUNTRY_GUIDES[cs.country.code] ?? []), ...(SERVICE_GUIDES[cs.service.code] ?? [])]);
}

/**
 * 死链体检：返回映射里所有**不存在于 GUIDES** 的 slug。
 * 构建前 / 发布前跑一次，非空即说明映射表有笔误。
 */
export function validateRelatedGuides(): { hub: string; slug: string }[] {
  const tables: [string, Record<string, string[]>][] = [
    ["country", COUNTRY_GUIDES],
    ["service", SERVICE_GUIDES],
    ["auditType", AUDIT_TYPE_GUIDES],
    ["industry", INDUSTRY_GUIDES],
    ["tool", TOOL_GUIDES],
  ];
  const bad: { hub: string; slug: string }[] = [];
  for (const [kind, table] of tables) {
    for (const [key, slugs] of Object.entries(table)) {
      for (const s of slugs) if (!KNOWN.has(s)) bad.push({ hub: `${kind}:${key}`, slug: s });
    }
  }
  return bad;
}
