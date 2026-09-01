/**
 * 审核范围推荐规则引擎（P1-13）
 *
 * 设计原则：
 * 1. **规则优先，AI 只做叙述**：本文件是唯一决策来源，纯函数、无 IO、可单测。
 *    DeepSeek 只负责把结果复述成人话（lib/ai.ts 的 aiScopeNarrative），
 *    没有 key 时页面照样可用 —— 推荐结果完全一致，只是少一段文字。
 * 2. **可解释**：每个模块都带 reason code，页面上逐条说明「为什么加这一项」。
 *    禁止出现无法归因的模块。
 * 3. **不越界**：低风险档 = 证据充分，不是「保证没问题」；范围建议只是起点，
 *    最终范围由审核员与买家在进场前确认。不得声称供应商安全/不安全。
 * 4. **本文件不存放任何展示文案**：只输出 key / 下标，文案一律由字典提供。
 *
 * V1.1 评分语义：**分数越高 = 风险越低**。
 */

import { overallLevel, type RiskLevel } from "./riskEngine";

/**
 * 审核类型取值列表 —— 顺序即下标。
 * 与字典 auditRequest.form.auditTypes 一一对应：改顺序必须同步改那 9 份数组。
 * 值是提交给人工的英文原值，展示文案用同下标的字典项。
 */
export const AUDIT_TYPES = [
  "Factory Verification",
  "Factory Audit",
  "Supplier Quality Audit",
  "Production Capacity Audit",
  "Social Compliance Audit",
  "Environmental Audit",
  "Technical Audit",
  "Custom Buyer Audit",
] as const;

export type AuditTypeKey =
  | "verification"
  | "factoryAudit"
  | "qualityAudit"
  | "capacityAudit"
  | "socialAudit"
  | "environmentalAudit"
  | "technicalAudit"
  | "customAudit";

/** 按 key 定位下标，页面上不比对文案字符串（9 语言文案不同） */
export const AUDIT_TYPE_INDEX: Record<AuditTypeKey, number> = {
  verification: 0,
  factoryAudit: 1,
  qualityAudit: 2,
  capacityAudit: 3,
  socialAudit: 4,
  environmentalAudit: 5,
  technicalAudit: 6,
  customAudit: 7,
};

export type ScopeModuleKey =
  | "legalEntity"
  | "siteExistence"
  | "documentConsistency"
  | "capacity"
  | "qualitySystem"
  | "processControl"
  | "incomingInspection"
  | "subcontracting"
  | "packingLoading"
  | "productCompliance"
  | "certificateCheck"
  | "changeReview";

export type ScopeReasonCode =
  | "band"
  | "firstOrder"
  | "repeatOrder"
  | "orderValue"
  | "productRisk"
  | "weakDimension";

export type OrderValueBand = "lt10k" | "10to50k" | "50to200k" | "gt200k";
export type ProductRisk = "low" | "medium" | "high";

export interface ScopeInput {
  /** 0–100，V1.1 语义：越高越安全 */
  riskScore: number;
  /** 是否首次合作 */
  firstOrder: boolean;
  orderValue: OrderValueBand;
  productRisk: ProductRisk;
  /** 八维里证据最少的维度（riskEngine 的 dimension key） */
  weakDimensions: string[];
}

export interface ScopeModule {
  key: ScopeModuleKey;
  reasons: ScopeReasonCode[];
}

export interface ScopeRecommendation {
  band: RiskLevel;
  auditTypeKey: AuditTypeKey;
  auditTypeIndex: number;
  manDays: number;
  modules: ScopeModule[];
  reasons: ScopeReasonCode[];
}

/** 分数档 → 基线模块。档位越低（越危险）覆盖越广，逐档叠加。 */
const BASELINE: Record<RiskLevel, ScopeModuleKey[]> = {
  LOW: ["legalEntity", "siteExistence", "documentConsistency"],
  MODERATE: ["capacity", "qualitySystem", "processControl"],
  ELEVATED: ["incomingInspection", "subcontracting", "packingLoading"],
  HIGH: ["certificateCheck"],
  CRITICAL: ["productCompliance"],
};

/** 叠加顺序：从最安全档往下累加 */
const BAND_ORDER: RiskLevel[] = ["LOW", "MODERATE", "ELEVATED", "HIGH", "CRITICAL"];

/** 八维 → 对应核查模块。维度拿不到证据时，把核查重心放到该模块。 */
const DIMENSION_TO_MODULES: Record<string, ScopeModuleKey[]> = {
  company: ["legalEntity"],
  quality: ["qualitySystem", "processControl"],
  compliance: ["productCompliance"],
  production: ["capacity"],
  supplychain: ["subcontracting"],
  documentation: ["documentConsistency"],
  certification: ["certificateCheck"],
  digitalFootprint: ["siteExistence"],
};

/** 理由展示顺序（页面按此顺序排，保证同一输入输出稳定） */
const REASON_ORDER: ScopeReasonCode[] = [
  "band",
  "firstOrder",
  "repeatOrder",
  "orderValue",
  "productRisk",
  "weakDimension",
];

const MAN_DAYS: Record<RiskLevel, number> = {
  LOW: 1,
  MODERATE: 1,
  ELEVATED: 2,
  HIGH: 2,
  CRITICAL: 3,
};

function pushReason(list: ScopeReasonCode[], code: ScopeReasonCode) {
  if (!list.includes(code)) list.push(code);
}

/**
 * 生成审核范围建议。
 * 纯函数：同样输入永远得到同样输出，方便写快照测试和排查线上争议。
 */
export function recommendAuditScope(input: ScopeInput): ScopeRecommendation {
  const band = overallLevel(input.riskScore);
  const order = new Map<ScopeModuleKey, ScopeReasonCode[]>();

  const add = (key: ScopeModuleKey, reason: ScopeReasonCode) => {
    const list = order.get(key) ?? [];
    pushReason(list, reason);
    order.set(key, list);
  };

  // 1) 基线：按分数档逐档叠加
  const bandIdx = BAND_ORDER.indexOf(band);
  for (let i = 0; i <= bandIdx; i++) {
    for (const key of BASELINE[BAND_ORDER[i]]) add(key, "band");
  }

  // 2) 首次合作：先把「这家工厂是否真实存在、是不是贸易商」钉死
  if (input.firstOrder) {
    add("legalEntity", "firstOrder");
    add("siteExistence", "firstOrder");
    add("subcontracting", "firstOrder");
  } else {
    // 重复合作：重点看上次之后变了什么（产能、分包、关键岗位）
    add("changeReview", "repeatOrder");
  }

  // 3) 订单金额：5 万美元以上值得盯装柜，避免数量/混装问题
  if (input.orderValue === "50to200k" || input.orderValue === "gt200k") {
    add("packingLoading", "orderValue");
  }

  // 4) 产品风险：中风险加来料检验，高风险再加合规文件与测试报告
  if (input.productRisk === "medium" || input.productRisk === "high") {
    add("incomingInspection", "productRisk");
  }
  if (input.productRisk === "high") {
    add("productCompliance", "productRisk");
  }

  // 5) 用户自报的证据薄弱维度
  for (const dim of input.weakDimensions) {
    for (const key of DIMENSION_TO_MODULES[dim] ?? []) add(key, "weakDimension");
  }

  // 6) 审核类型：先看风险档，再看两个明确的升级条件
  let auditTypeKey: AuditTypeKey;
  if (band === "LOW" || band === "MODERATE") auditTypeKey = "verification";
  else if (band === "ELEVATED") auditTypeKey = "qualityAudit";
  else auditTypeKey = "factoryAudit";

  // 大额订单即使分数好看，也值得上一次质量审核
  if (auditTypeKey === "verification" && input.orderValue === "gt200k") {
    auditTypeKey = "qualityAudit";
  }
  // 高风险产品 + 高风险档 = 需要技术审核（产品/工艺层面，不只是体系层面）
  if (
    input.productRisk === "high" &&
    (band === "HIGH" || band === "CRITICAL") &&
    auditTypeKey !== "factoryAudit"
  ) {
    auditTypeKey = "technicalAudit";
  }

  // 7) 人天：按档起步，20 万美元以上 +1 天，封顶 3 天
  let manDays = MAN_DAYS[band];
  if (input.orderValue === "gt200k" && manDays < 3) manDays += 1;

  const modules: ScopeModule[] = [...order.entries()].map(([key, reasons]) => ({
    key,
    reasons: REASON_ORDER.filter((c) => reasons.includes(c)),
  }));

  const reasonSet = new Set<ScopeReasonCode>();
  for (const m of modules) for (const r of m.reasons) reasonSet.add(r);

  return {
    band,
    auditTypeKey,
    auditTypeIndex: AUDIT_TYPE_INDEX[auditTypeKey],
    manDays,
    modules,
    reasons: REASON_ORDER.filter((c) => reasonSet.has(c)),
  };
}
