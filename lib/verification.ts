// lib/verification.ts — 核验等级与证据状态的单一事实来源（PRD §16/§17/§20）
//
// 规则（不可绕过）：
// 1. 没有记录在案的核验事件与证据，就不得显示 Verified。
// 2. 等级只能由实际核验范围决定，不能由营销需要决定。
// 3. 「工厂提供了文件」与「我们审阅并确认了文件」必须分开表述。

export type VerificationLevel = 0 | 1 | 2 | 3 | 4;

/** 供应商表 verificationStatus → 核验等级 */
const STATUS_TO_LEVEL: Record<string, VerificationLevel> = {
  UNVERIFIED: 0,
  IDENTITY_VERIFIED: 1,
  DOCUMENT_VERIFIED: 2,
  FACTORY_VERIFIED: 3,
  AUDITED: 4,
  FACTORY_AUDITED: 4,
};

export function levelFromStatus(status?: string | null): VerificationLevel {
  return STATUS_TO_LEVEL[(status ?? "").toUpperCase()] ?? 0;
}

/** 该等级实际覆盖的核验范围（页面显示「核验范围」用） */
export const LEVEL_SCOPE: Record<VerificationLevel, string[]> = {
  0: [],
  1: ["Business identity", "Registration records"],
  2: ["Business identity", "Registration records", "Certification documents", "Audit documentation"],
  3: [
    "Business identity",
    "Registration records",
    "Certification documents",
    "Audit documentation",
    "Factory address",
    "Production capability",
  ],
  4: [
    "Business identity",
    "Registration records",
    "Certification documents",
    "Audit documentation",
    "Factory address",
    "Production capability",
    "On-site audit findings",
    "Quality system",
  ],
};

/** 任何等级都不覆盖的检查项（页面显示「未覆盖范围」用，避免买家误解） */
export const NOT_COVERED = [
  "Financial statements",
  "Product performance in use",
  "Current production utilisation",
  "Subcontractors that were not disclosed to us",
];

export type EvidenceStatus =
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "UNVERIFIED"
  | "EXPIRED"
  | "MISSING";

/** SupplierEvidence.status → 展示口径 */
export function normalizeEvidenceStatus(status?: string | null): EvidenceStatus {
  const s = (status ?? "").toUpperCase();
  if (s === "VERIFIED") return "VERIFIED";
  if (s === "PARTIALLY_VERIFIED" || s === "PENDING") return "PARTIALLY_VERIFIED";
  if (s === "EXPIRED") return "EXPIRED";
  if (s === "MISSING") return "MISSING";
  return "UNVERIFIED";
}

/**
 * 证据类型：数据库里存 code，展示时按 locale 取名。
 *
 * 历史数据把类型写成了中文（「营业执照」「SMETA 审核报告」），导致英文页面出现中文。
 * 这里保留别名映射，让旧数据也能正确显示；新数据一律存 code。
 */
export const EVIDENCE_TYPE_LABELS: Record<string, { en: string; zh: string }> = {
  BUSINESS_LICENSE: { en: "Business licence", zh: "营业执照" },
  FACTORY_ADDRESS: { en: "Factory address", zh: "工厂地址" },
  AUDIT_REPORT: { en: "Audit report", zh: "审核报告" },
  CERTIFICATE: { en: "Certificate", zh: "证书" },
  TEST_REPORT: { en: "Test report", zh: "检测报告" },
  FACTORY_PHOTOS: { en: "Factory photos", zh: "工厂照片" },
  PRODUCTION_EVIDENCE: { en: "Production evidence", zh: "生产证据" },
  QUALITY_DOCUMENTS: { en: "Quality documents", zh: "质量文件" },
};

/** 旧中文数据 → code */
const EVIDENCE_TYPE_ALIASES: Record<string, string> = {
  营业执照: "BUSINESS_LICENSE",
  工厂地址: "FACTORY_ADDRESS",
  审核报告: "AUDIT_REPORT",
  验厂报告: "AUDIT_REPORT",
  产品认证: "CERTIFICATE",
  证书: "CERTIFICATE",
  检测报告: "TEST_REPORT",
  工厂照片: "FACTORY_PHOTOS",
  生产证据: "PRODUCTION_EVIDENCE",
  质量文件: "QUALITY_DOCUMENTS",
};

export function normalizeEvidenceType(type: string): string {
  if (EVIDENCE_TYPE_LABELS[type]) return type;
  for (const [alias, code] of Object.entries(EVIDENCE_TYPE_ALIASES)) {
    if (type.includes(alias)) return code;
  }
  return type;
}

export function evidenceLabel(type: string, locale: "en" | "zh" | "zh-TW" = "en"): string {
  const code = normalizeEvidenceType(type);
  const entry = EVIDENCE_TYPE_LABELS[code];
  if (entry) return locale === "en" ? entry.en : entry.zh;
  // 未登记的类型：保留原始文本，但不要污染英文页
  return type;
}

/**
 * 证据来源口径（用户要求：供应商自述 / 文件已审阅 / 已独立核验 / 现场已核验
 * 必须分开表述，不能混为一谈）。
 */
export type EvidenceProvenance = "provided" | "reviewed" | "independent" | "onsite";

export function evidenceProvenance(
  status: string,
  source?: string | null
): EvidenceProvenance {
  const st = normalizeEvidenceStatus(status);
  if (st === "VERIFIED") {
    // 现场产生的证据（走访、定位、照片）才允许标 onsite
    const s = (source ?? "").toUpperCase();
    return s.includes("SITE") || s.includes("ONSITE") || s.includes("VISIT")
      ? "onsite"
      : "independent";
  }
  if (st === "PARTIALLY_VERIFIED") return "reviewed";
  return "provided";
}

/**
 * 「认证」模块的状态口径：
 * 证书在供应商 certifications 字段里存在，不等于我们核过。
 * 只有当同一条目的 capability.verified 为真时才允许显示 Evidence Reviewed。
 */
export function certificateStatus(verified: boolean): "reviewed" | "provided" {
  return verified ? "reviewed" : "provided";
}
