// 共享类型与枚举常量——《Audit & Compliance Taxonomy 规范》
// 所有业务模块从这里消费 taxonomy 相关的联合类型与类目元数据。

// §44 serviceType 联合类型：严格区分 Audit ≠ Assessment ≠ Inspection ≠ Certification ...
export type ServiceType =
  | "AUDIT"
  | "ASSESSMENT"
  | "INSPECTION"
  | "CERTIFICATION_SUPPORT"
  | "DOCUMENT_REVIEW"
  | "VERIFICATION"
  | "TESTING"
  | "CONSULTING"
  | "TRAINING";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  AUDIT: "Audit / 审核",
  ASSESSMENT: "Assessment / 评估",
  INSPECTION: "Inspection / 验货",
  CERTIFICATION_SUPPORT: "Certification / 认证",
  DOCUMENT_REVIEW: "Document Review / 文件审查",
  VERIFICATION: "Verification / 验证",
  TESTING: "Testing / 检测",
  CONSULTING: "Consulting / 咨询",
  TRAINING: "Training / 培训",
};

export const SERVICE_TYPES: ServiceType[] = [
  "AUDIT",
  "ASSESSMENT",
  "INSPECTION",
  "CERTIFICATION_SUPPORT",
  "DOCUMENT_REVIEW",
  "VERIFICATION",
  "TESTING",
  "CONSULTING",
  "TRAINING",
];

// §59 供应商验证状态枚举
export type VerificationStatus =
  | "UNVERIFIED"
  | "IDENTITY_VERIFIED"
  | "DOCUMENT_VERIFIED"
  | "FACTORY_VERIFIED";

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: "Unverified / 未验证",
  IDENTITY_VERIFIED: "Identity Verified / 主体已验证",
  DOCUMENT_VERIFIED: "Document Verified / 文件已验证",
  FACTORY_VERIFIED: "Factory Verified / 工厂已验厂",
};

// §60 证据 / 认证状态枚举
export type EvidenceStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  UNVERIFIED: "Unverified / 未验证",
  PENDING: "Pending / 审核中",
  VERIFIED: "Verified / 已验证",
  REJECTED: "Rejected / 已驳回",
  EXPIRED: "Expired / 已过期",
};

// 风险等级
export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  CRITICAL: "Critical / 极高",
  HIGH: "High / 高",
  MEDIUM: "Medium / 中",
  LOW: "Low / 低",
  VERY_LOW: "Very Low / 极低",
};

// 15 个一级类目（§81）——与 prisma/seed.js 保持同步
export type TaxonomyCategory =
  | "SOCIAL_AUDIT"
  | "QUALITY_AUDIT"
  | "ENVIRONMENTAL"
  | "SAFETY"
  | "FOOD_SAFETY"
  | "PRODUCT_CERT"
  | "ANTI_BRIBERY"
  | "INFO_SECURITY"
  | "SUPPLY_CHAIN"
  | "INDUSTRY_SPECIFIC"
  | "INSPECTION"
  | "CONSULTING"
  | "TRAINING"
  | "TESTING"
  | "DOCUMENT_REVIEW";

export const TAXONOMY_CATEGORIES: { code: TaxonomyCategory; labelEn: string; labelZh: string }[] = [
  { code: "SOCIAL_AUDIT", labelEn: "Social Audit", labelZh: "社会责任验厂" },
  { code: "QUALITY_AUDIT", labelEn: "Quality Audit", labelZh: "质量体系审核" },
  { code: "ENVIRONMENTAL", labelEn: "Environmental", labelZh: "环境管理" },
  { code: "SAFETY", labelEn: "Health & Safety", labelZh: "职业健康安全" },
  { code: "FOOD_SAFETY", labelEn: "Food Safety", labelZh: "食品安全" },
  { code: "PRODUCT_CERT", labelEn: "Product Certification", labelZh: "产品认证" },
  { code: "ANTI_BRIBERY", labelEn: "Anti-Bribery & Compliance", labelZh: "反贿赂合规" },
  { code: "INFO_SECURITY", labelEn: "Information Security", labelZh: "信息安全" },
  { code: "SUPPLY_CHAIN", labelEn: "Supply Chain Security", labelZh: "供应链安全" },
  { code: "INDUSTRY_SPECIFIC", labelEn: "Industry-Specific", labelZh: "行业专项" },
  { code: "INSPECTION", labelEn: "Inspection", labelZh: "验货出货检验" },
  { code: "CONSULTING", labelEn: "Consulting", labelZh: "咨询辅导" },
  { code: "TRAINING", labelEn: "Training", labelZh: "培训" },
  { code: "TESTING", labelEn: "Testing", labelZh: "第三方检测" },
  { code: "DOCUMENT_REVIEW", labelEn: "Document & Compliance Review", labelZh: "文件合规审查" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  TAXONOMY_CATEGORIES.map((c) => [c.code, c.labelZh])
);

// 能力标签 refType
export type CapabilityRefType = "TAXONOMY" | "AUDIT_TYPE" | "STANDARD";
