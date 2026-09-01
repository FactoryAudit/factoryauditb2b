// Supplier Network V1.0 — 单一事实来源（结构/状态/权重/字段）
// 展示文案一律由 i18n 字典提供（lib/supplierNetwork 只放结构与数值）。
// 与买家自助工具 riskEngine 相互独立：本文件是「审核员对供应商」的评估模型。

// ---------- Supplier Status（8 态） ----------
export const SUPPLIER_STATUSES = [
  "Pending",
  "Submitted",
  "Under Review",
  "Approved",
  "Approved with Conditions",
  "Verified Supplier",
  "Suspended",
  "Rejected",
] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

// ---------- Evidence Level（5 级，禁止与 Certification 混同） ----------
export const EVIDENCE_LEVELS = [
  "Self-Declared",
  "Document Submitted",
  "Document Reviewed",
  "Independently Verified",
  "Factory Audited",
] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

// ---------- 风险模型（100 分，10 维，审核员评估用） ----------
// 维度为固定权重，总分 = Σ(维度得分 × 权重)；Other Risk Indicators 为扣分项（最多 -10）。
export const SUPPLIER_RISK_DIMENSIONS = [
  { key: "companyIdentity", weight: 15 },
  { key: "businessInformation", weight: 10 },
  { key: "factoryInformation", weight: 10 },
  { key: "documentConsistency", weight: 10 },
  { key: "certificateEvidence", weight: 15 },
  { key: "productionCapability", weight: 10 },
  { key: "exportExperience", weight: 10 },
  { key: "contactVerification", weight: 10 },
  { key: "auditEvidence", weight: 10 },
] as const;

export const RISK_PENALTY_MAX = 10; // Other Risk Indicators 最大扣分

// 输出四档（与 Brief 一致）：分数越高风险越低
export type SupplierRiskBand = "Low" | "Moderate" | "NeedsFurther" | "High";
export function supplierRiskBand(score: number): SupplierRiskBand {
  if (score >= 80) return "Low";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "NeedsFurther";
  return "High";
}

// 强制免责声明（页面 + 邮件尾部统一引用）
export const RISK_DISCLAIMER =
  "Risk Score is an informational assessment and does not constitute certification, accreditation or a guarantee of supplier performance.";

// ---------- Supplier Master Sheet 字段（25+，人工录入用） ----------
export const SUPPLIER_SHEET_FIELDS = [
  "Supplier ID",
  "Company Name",
  "English Name",
  "Company Type",
  "Location",
  "Products",
  "Production Capacity",
  "Employees",
  "Established",
  "Website",
  "Export Markets",
  "Contact Person",
  "Email",
  "Phone",
  "WhatsApp",
  "Contact Visibility",
  "Certificates",
  "Certificate Status",
  "Verification Status",
  "Evidence Level",
  "Risk Score",
  "Risk Level",
  "Audit Status",
  "Inspection Availability",
  "Inspection Status",
  "Last Review Date",
  "Next Review Date",
  "Assigned Reviewer",
  "Source",
  "Submitted Date",
  "Notes",
] as const;

// ---------- 20 个 Google Docs 模板清单 ----------
export type DocTemplate = {
  slug: string;
  /** 标题（结构数据，字典提供翻译） */
  titleKey: string;
  /** 一句话说明（结构数据，字典提供翻译） */
  descKey: string;
};
export const DOC_TEMPLATES: DocTemplate[] = [
  { slug: "supplier-information-authorization", titleKey: "doc01", descKey: "doc01Desc" },
  { slug: "document-authenticity-declaration", titleKey: "doc02", descKey: "doc02Desc" },
  { slug: "supplier-code-of-conduct", titleKey: "doc03", descKey: "doc03Desc" },
  { slug: "anti-bribery-integrity-commitment", titleKey: "doc04", descKey: "doc04Desc" },
  { slug: "conflict-of-interest-declaration", titleKey: "doc05", descKey: "doc05Desc" },
  { slug: "auditor-integrity-confidentiality", titleKey: "doc06", descKey: "doc06Desc" },
  { slug: "supplier-verification-checklist", titleKey: "doc07", descKey: "doc07Desc" },
  { slug: "certificate-verification-checklist", titleKey: "doc08", descKey: "doc08Desc" },
  { slug: "supplier-risk-assessment", titleKey: "doc09", descKey: "doc09Desc" },
  { slug: "supplier-verification-record", titleKey: "doc10", descKey: "doc10Desc" },
  { slug: "factory-audit-preparation-checklist", titleKey: "doc11", descKey: "doc11Desc" },
  { slug: "corrective-action-plan", titleKey: "doc12", descKey: "doc12Desc" },
  { slug: "buyer-supplier-matching-record", titleKey: "doc13", descKey: "doc13Desc" },
  { slug: "supplier-quotation-form", titleKey: "doc14", descKey: "doc14Desc" },
  { slug: "factory-audit-service-agreement", titleKey: "doc15", descKey: "doc15Desc" },
  { slug: "factory-inspection-service-agreement", titleKey: "doc16", descKey: "doc16Desc" },
  { slug: "compliance-consulting-agreement", titleKey: "doc17", descKey: "doc17Desc" },
  { slug: "complaint-whistleblowing-form", titleKey: "doc18", descKey: "doc18Desc" },
  { slug: "non-circumvention-agreement", titleKey: "doc19", descKey: "doc19Desc" },
  { slug: "supplier-suspension-removal-notice", titleKey: "doc20", descKey: "doc20Desc" },
] as const;

// ---------- 供应商入驻表单字段清单（9 大块） ----------
// 供注册 API 校验与邮件正文结构化使用；label 文案在字典 supplierNetwork.form。
export const REGISTRATION_FIELDS = [
  // Company Information
  "companyName",
  "englishName",
  "companyType",
  "registrationNumber",
  "establishedYear",
  "website",
  // Factory Information
  "factoryCountry",
  "factoryCity",
  "factoryAddress",
  "employees",
  "factorySize",
  // Products
  "mainProducts",
  "productionCapacity",
  "monthlyOutput",
  // Export Markets
  "exportMarkets",
  "exportSince",
  // Certificates
  "certificates",
  // Contact Information
  "contactName",
  "contactEmail",
  "contactPhone",
  "contactWhatsapp",
  // Availability
  "auditAvailability",
  "inspectionAvailability",
  // Authorization（公司资料展示授权 / 个人信息独立授权）
  "authorizeCompanyProfile",
  "contactVisibility",
  // Message
  "message",
] as const;
export type RegistrationField = (typeof REGISTRATION_FIELDS)[number];
