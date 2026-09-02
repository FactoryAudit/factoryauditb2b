// lib/toolUiTypes.ts — 客户端工具组件的字典 props 类型
//
// 这些页面是 "use client"，拿不到服务端的 getDictionary，
// 由 page.tsx（Server Component）取字典后以 props 传入。
// 类型少写字面量联合，运行时用字典键索引 + 回退原值，避免新增维度就编译失败。

export type StrMap = Record<string, string>;

export interface AuditChecklistUi {
  h1: string;
  lead: string;
  industryLabel: string;
  auditTypeLabel: string;
  cta: string;
  summary: string;
  categoryLabel: string;
  evidenceLabel: string;
  riskSuffix: string;
  riskLow: string;
  riskMedium: string;
  riskHigh: string;
  /** 行业下拉显示文案，顺序与 lib/data.INDUSTRIES 一致（12 项）；缺失回退英文原值 */
  industryNames?: string[];
  /** 审核类型下拉显示文案，顺序与 lib/checklist.AUDIT_TYPES 一致（8 项）；缺失回退英文原值 */
  auditTypeNames?: string[];
  /** 题目文案，key 与 lib/checklist 的 AuditQuestion.key 对应（18 组）；缺失回退英文原值 */
  questions?: Record<string, { q: string; cat: string; ev: string }>;
}

export interface ReportAnalyzerUi {
  h1: string;
  lead: string;
  inputLabel: string;
  inputPlaceholder: string;
  cta: string;
  ctaLoading: string;
  empty: string;
  qualityLabel: string;
  scoreSuffix: string;
  sourceAi: string;
  sourceLocal: string;
  issuesTitle: string;
  issuesNone: string;
}

export interface DocumentCheckerUi {
  h1: string;
  lead: string;
  inputLabel: string;
  cta: string;
  empty: string;
  scoreRow: string;
  companyName: string;
  address: string;
  legalEntity: string;
  certificateNo: string;
  issueDate: string;
  expiryDate: string;
  scope: string;
  statusFound: string;
  statusMissing: string;
  statusReview: string;
}

export interface ScorecardUi {
  h1: string;
  lead: string;
  overallLabel: string;
  totalWeightLabel: string;
  weightLabel: string;
  scoreLabel: string;
  criteria: StrMap;
}

export interface RiskAssessmentUi {
  h1: string;
  lead: string;
  supplierName: string;
  website: string;
  country: string;
  city: string;
  productCategory: string;
  businessType: string;
  businessTypeFactory: string;
  businessTypeTrading: string;
  yearsInBusiness: string;
  employeeRange: string;
  exportMarkets: string;
  selectOption: string;
  businessLicense: string;
  isoCertificate: string;
  auditReport: string;
  catalog: string;
  productCertificates: string;
  cta: string;
  ctaLoading: string;
  empty: string;
  levelSuffix: string;
  sourceAi: string;
  sourceLocal: string;
  levels: StrMap;
  status: StrMap;
  dimensions: StrMap;
  countryNames: StrMap;
  /** 行业下拉显示文案，顺序与 lib/data.INDUSTRIES 一致（12 项）；缺失回退英文原值 */
  industryNames?: string[];
}
