// lib/staticData.ts —— 第一阶段静态数据源（替代数据库）
//
// V2.0 轻量化：第一阶段"能不使用数据库就不使用"。
// 本文件集中维护国家 / 行业 / 审核与认证项目 / 标准 / 分类树 / 供应商 / 风险权重，
// 由 lib/taxonomy.ts 与 lib/queries.ts 统一消费，保持「单一事实来源」。
// 未来若内容量大到需要动态管理，再切回 Prisma + Neon（schema.prisma / seed.js 已保留）。

// ---------- 1. 国家（Phase 1 只覆盖中/越/泰；其余登记在 roadmap，不建页） ----------
export const STATIC_COUNTRIES = [
  { code: "china", name: "China", cn: "中国" },
  { code: "vietnam", name: "Vietnam", cn: "越南" },
  { code: "thailand", name: "Thailand", cn: "泰国" },
  { code: "india", name: "India", cn: "印度" },
  { code: "bangladesh", name: "Bangladesh", cn: "孟加拉" },
  { code: "turkey", name: "Turkey", cn: "土耳其" },
  { code: "indonesia", name: "Indonesia", cn: "印度尼西亚" },
  { code: "pakistan", name: "Pakistan", cn: "巴基斯坦" },
  { code: "mexico", name: "Mexico", cn: "墨西哥" },
];

// ---------- 2. 行业 ----------
export const STATIC_INDUSTRIES = [
  { code: "electronics", name: "Electronics / 电子" },
  { code: "textiles", name: "Textiles / 纺织" },
  { code: "toys", name: "Toys / 玩具" },
  { code: "footwear", name: "Footwear / 鞋类" },
  { code: "machinery", name: "Machinery / 机械" },
  { code: "plastics", name: "Plastics / 塑料" },
  { code: "home-appliances", name: "Home Appliances / 家电" },
  { code: "food-beverage", name: "Food & Beverage / 食品饮料" },
  { code: "automotive", name: "Automotive / 汽车" },
  { code: "furniture", name: "Furniture / 家具" },
  { code: "packaging", name: "Packaging / 包装" },
  { code: "cosmetics", name: "Cosmetics / 化妆品" },
];

// ---------- 3. 审核 / 认证项目（同时充当 audit_type 与 standard 两张表的数据源） ----------
export type StaticProgram = {
  code: string;
  nameEn: string;
  nameZh: string;
  serviceType: string;
  isAudit?: boolean;
  isInspection?: boolean;
  isCertification?: boolean;
  owner?: string;
  note?: string;
  category: string;
};

export const STATIC_PROGRAMS: StaticProgram[] = [
  { code: "SMETA", nameEn: "SMETA", nameZh: "SMETA 社会责任审核", serviceType: "AUDIT", isAudit: true, isCertification: true, owner: "Sedex", note: "SMETA 不是证书，而是由 Sedex 认可审核机构执行的社会责任审核方法，仅出具审核报告、不发证。", category: "SOCIAL_AUDIT" },
  { code: "BSCI", nameEn: "BSCI", nameZh: "BSCI 商业社会责任倡议", serviceType: "AUDIT", isAudit: true, isCertification: true, owner: "amfori", category: "SOCIAL_AUDIT" },
  { code: "SA8000", nameEn: "SA8000", nameZh: "SA8000", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "SAI", category: "SOCIAL_AUDIT" },
  { code: "WRAP", nameEn: "WRAP", nameZh: "WRAP 环球服装生产社会责任", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "WRAP", category: "SOCIAL_AUDIT" },
  { code: "ICTI", nameEn: "ICTI Ethical Toy Program", nameZh: "ICTI 玩具业责任规范", serviceType: "AUDIT", isAudit: true, isCertification: true, owner: "ICTI", category: "SOCIAL_AUDIT" },
  { code: "ISO9001", nameEn: "ISO 9001", nameZh: "ISO 9001 质量管理体系", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "ISO", category: "QUALITY_AUDIT" },
  { code: "ISO13485", nameEn: "ISO 13485", nameZh: "ISO 13485 医疗器械质量管理", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "ISO", category: "QUALITY_AUDIT" },
  { code: "IATF16949", nameEn: "IATF 16949", nameZh: "IATF 16949 汽车行业质量管理", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "IATF", category: "QUALITY_AUDIT" },
  { code: "GMP", nameEn: "GMP", nameZh: "GMP 良好生产规范", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "FDA/WHO", category: "QUALITY_AUDIT" },
  { code: "ISO14001", nameEn: "ISO 14001", nameZh: "ISO 14001 环境管理体系", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "ISO", category: "ENVIRONMENTAL" },
  { code: "ISO45001", nameEn: "ISO 45001", nameZh: "ISO 45001 职业健康安全", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "ISO", category: "SAFETY" },
  { code: "BRC", nameEn: "BRCGS", nameZh: "BRC 全球食品安全标准", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "BRCGS", category: "FOOD_SAFETY" },
  { code: "HACCP", nameEn: "HACCP", nameZh: "HACCP 危害分析与关键控制点", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "Codex", category: "FOOD_SAFETY" },
  { code: "FSSC22000", nameEn: "FSSC 22000", nameZh: "FSSC 22000 食品安全体系认证", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "FSSC", category: "FOOD_SAFETY" },
  { code: "CE", nameEn: "CE Marking", nameZh: "CE 认证", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "EU", category: "PRODUCT_CERT" },
  { code: "UL", nameEn: "UL Certification", nameZh: "UL 认证", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "UL", category: "PRODUCT_CERT" },
  { code: "CCC", nameEn: "CCC", nameZh: "CCC 中国强制性产品认证", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "CNCA", category: "PRODUCT_CERT" },
  { code: "ISO37001", nameEn: "ISO 37001", nameZh: "ISO 37001 反贿赂管理体系", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "ISO", category: "ANTI_BRIBERY" },
  { code: "ISO27001", nameEn: "ISO 27001", nameZh: "ISO 27001 信息安全管理", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "ISO", category: "INFO_SECURITY" },
  { code: "RBA", nameEn: "RBA Code of Conduct", nameZh: "RBA 责任商业联盟行为准则", serviceType: "AUDIT", isAudit: true, isCertification: true, owner: "RBA", category: "INDUSTRY_SPECIFIC" },
  { code: "CTPAT", nameEn: "C-TPAT", nameZh: "C-TPAT 海关商贸反恐", serviceType: "VERIFICATION", isInspection: true, owner: "U.S. CBP", category: "SUPPLY_CHAIN" },
  { code: "ISO28000", nameEn: "ISO 28000", nameZh: "ISO 28000 供应链安全管理", serviceType: "CERTIFICATION_SUPPORT", isCertification: true, owner: "ISO", category: "SUPPLY_CHAIN" },
];

// ---------- 4. 纯服务节点（无对应认证/审核项目，用于分类树叶子） ----------
const SERVICE_NODES: Record<string, { labelEn: string; labelZh: string }> = {
  PSI: { labelEn: "Pre-Shipment Inspection", labelZh: "出货前检验" },
  DUPRO: { labelEn: "During Production Inspection", labelZh: "生产中检验" },
  CL: { labelEn: "Container Loading Supervision", labelZh: "装柜监装" },
  CONSULT_SOCIAL: { labelEn: "Social Audit Consulting", labelZh: "社会责任验厂辅导" },
  CONSULT_QUALITY: { labelEn: "Quality System Consulting", labelZh: "质量体系辅导" },
  TRAIN_AUDITOR: { labelEn: "Auditor Training", labelZh: "审核员培训" },
  TRAIN_EHS: { labelEn: "EHS Training", labelZh: "环安卫培训" },
  TEST_CHEM: { labelEn: "Chemical Testing", labelZh: "化学检测" },
  TEST_PHYS: { labelEn: "Physical & Mechanical Testing", labelZh: "物理机械测试" },
  DOC_REVIEW_LABOR: { labelEn: "Labor Compliance Document Review", labelZh: "劳工合规文件审查" },
  DOC_REVIEW_PERMIT: { labelEn: "License & Permit Review", labelZh: "证照许可审查" },
};

// ---------- 5. 15 个一级类目（§81） ----------
export const STATIC_TOP_CATEGORIES: { code: string; labelEn: string; labelZh: string; children: string[] }[] = [
  { code: "SOCIAL_AUDIT", labelEn: "Social Audit", labelZh: "社会责任验厂", children: ["SMETA", "BSCI", "SA8000", "WRAP", "ICTI", "RBA"] },
  { code: "QUALITY_AUDIT", labelEn: "Quality Audit", labelZh: "质量体系审核", children: ["ISO9001", "ISO13485", "IATF16949", "GMP"] },
  { code: "ENVIRONMENTAL", labelEn: "Environmental", labelZh: "环境管理", children: ["ISO14001"] },
  { code: "SAFETY", labelEn: "Health & Safety", labelZh: "职业健康安全", children: ["ISO45001"] },
  { code: "FOOD_SAFETY", labelEn: "Food Safety", labelZh: "食品安全", children: ["BRC", "HACCP", "FSSC22000"] },
  { code: "PRODUCT_CERT", labelEn: "Product Certification", labelZh: "产品认证", children: ["CE", "UL", "CCC"] },
  { code: "ANTI_BRIBERY", labelEn: "Anti-Bribery & Compliance", labelZh: "反贿赂合规", children: ["ISO37001"] },
  { code: "INFO_SECURITY", labelEn: "Information Security", labelZh: "信息安全", children: ["ISO27001"] },
  { code: "SUPPLY_CHAIN", labelEn: "Supply Chain Security", labelZh: "供应链安全", children: ["CTPAT", "ISO28000"] },
  { code: "INDUSTRY_SPECIFIC", labelEn: "Industry-Specific", labelZh: "行业专项", children: ["RBA"] },
  { code: "INSPECTION", labelEn: "Inspection", labelZh: "验货出货检验", children: ["PSI", "DUPRO", "CL"] },
  { code: "CONSULTING", labelEn: "Consulting", labelZh: "咨询辅导", children: ["CONSULT_SOCIAL", "CONSULT_QUALITY"] },
  { code: "TRAINING", labelEn: "Training", labelZh: "培训", children: ["TRAIN_AUDITOR", "TRAIN_EHS"] },
  { code: "TESTING", labelEn: "Testing", labelZh: "第三方检测", children: ["TEST_CHEM", "TEST_PHYS"] },
  { code: "DOCUMENT_REVIEW", labelEn: "Document & Compliance Review", labelZh: "文件合规审查", children: ["DOC_REVIEW_LABOR", "DOC_REVIEW_PERMIT"] },
];

// ---------- 6. 风险权重（overall + 15 类目，第一阶段默认权重 1） ----------
export const STATIC_RISK_WEIGHTS: { dimension: string; weight: number; enabled: boolean; description: string }[] = [
  { dimension: "overall", weight: 1, enabled: true, description: "综合权重基准" },
  ...STATIC_TOP_CATEGORIES.map((c) => ({
    dimension: c.code,
    weight: 1,
    enabled: true,
    description: `${c.labelZh} 维度权重`,
  })),
];

// ---------- 7. 供应商（含能力标签 / 证据 / 风险事件） ----------
export type StaticCapability = {
  refType: "AUDIT_TYPE" | "STANDARD" | "TAXONOMY";
  refCode: string;
  verified: boolean;
  source: string;
};

export type StaticEvidence = {
  type: string;
  status: "VERIFIED" | "PENDING" | "UNVERIFIED" | "REJECTED";
  source: string;
  date: string;
  note?: string | null;
};

export type StaticSupplier = {
  slug: string;
  legalName: string;
  countryCode: string;
  city: string;
  industryCode: string;
  businessType: string;
  established: number;
  employees: string;
  mainProducts: string[];
  exportMarkets: string[];
  verificationStatus: string;
  riskScore: number;
  riskLevel: string;
  certifications: string[];
  auditStatus: string;
  inspectionHistory: number;
  capabilities: StaticCapability[];
  evidence: StaticEvidence[];
};

export const STATIC_SUPPLIERS: StaticSupplier[] = [
  {
    slug: "shenzhen-precision-electronics",
    legalName: "Shenzhen Precision Electronics Co., Ltd.",
    countryCode: "china",
    city: "Shenzhen",
    industryCode: "electronics",
    businessType: "Manufacturer",
    established: 2009,
    employees: "501-1000",
    mainProducts: ["Consumer Electronics", "PCB Assembly", "Smart Home Devices"],
    exportMarkets: ["USA", "Germany", "Japan"],
    verificationStatus: "Factory Verified",
    riskScore: 22,
    riskLevel: "Low",
    certifications: ["ISO 9001", "SMETA", "CE"],
    auditStatus: "Audited 2026-06",
    inspectionHistory: 42,
    capabilities: [
      { refType: "AUDIT_TYPE", refCode: "SMETA", verified: true, source: "Third Party" },
      { refType: "AUDIT_TYPE", refCode: "BSCI", verified: false, source: "Self-Reported" },
      { refType: "STANDARD", refCode: "ISO9001", verified: true, source: "Third Party" },
    ],
    evidence: [
      { type: "Business License", status: "VERIFIED", source: "gov.cn", date: "2024-03-01" },
      { type: "SMETA Audit Report", status: "VERIFIED", source: "sedex.com", date: "2025-01-15" },
    ],
  },
  {
    slug: "guangzhou-textile-factory",
    legalName: "Guangzhou Sunrise Textile Co., Ltd.",
    countryCode: "china",
    city: "Guangzhou",
    industryCode: "textiles",
    businessType: "Manufacturer",
    established: 2014,
    employees: "201-500",
    mainProducts: ["Garments", "Fabrics", "Apparel"],
    exportMarkets: ["USA", "UK", "Australia"],
    verificationStatus: "Document Verified",
    riskScore: 41,
    riskLevel: "Medium",
    certifications: ["BSCI", "WRAP", "OEKO-TEX"],
    auditStatus: "Audited 2026-03",
    inspectionHistory: 28,
    capabilities: [
      { refType: "AUDIT_TYPE", refCode: "BSCI", verified: true, source: "Third Party" },
      { refType: "AUDIT_TYPE", refCode: "WRAP", verified: false, source: "Self-Reported" },
    ],
    evidence: [
      { type: "BSCI Audit Report", status: "VERIFIED", source: "amfori.org", date: "2024-11-20" },
    ],
  },
  {
    slug: "dongguan-plastic-molding",
    legalName: "Dongguan Hengda Plastics Co., Ltd.",
    countryCode: "china",
    city: "Dongguan",
    industryCode: "plastics",
    businessType: "Manufacturer",
    established: 2017,
    employees: "101-200",
    mainProducts: ["Injection Molding", "Plastic Components"],
    exportMarkets: ["USA", "Vietnam"],
    verificationStatus: "Identity Verified",
    riskScore: 65,
    riskLevel: "Medium",
    certifications: ["ISO 9001"],
    auditStatus: "Not yet audited",
    inspectionHistory: 9,
    capabilities: [
      { refType: "STANDARD", refCode: "ISO9001", verified: false, source: "Self-Reported" },
    ],
    evidence: [],
  },
  {
    slug: "ho-chi-minh-garment",
    legalName: "Ho Chi Minh Garment JSC",
    countryCode: "vietnam",
    city: "Ho Chi Minh",
    industryCode: "textiles",
    businessType: "Manufacturer",
    established: 2015,
    employees: "1000+",
    mainProducts: ["Garments", "Uniforms"],
    exportMarkets: ["USA", "EU"],
    verificationStatus: "Identity Verified",
    riskScore: 35,
    riskLevel: "Medium",
    certifications: ["SMETA"],
    auditStatus: "Pending",
    inspectionHistory: 5,
    capabilities: [
      { refType: "AUDIT_TYPE", refCode: "SMETA", verified: false, source: "Self-Reported" },
    ],
    evidence: [],
  },
];
