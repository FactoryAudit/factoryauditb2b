// lib/verification.ts — 核验等级与证据状态的单一事实来源（PRD §16/§17/§20）
//
// 规则（不可绕过）：
// 1. 没有记录在案的核验事件与证据，就不得显示 Verified。
// 2. 等级只能由实际核验范围决定，不能由营销需要决定。
// 3. 「工厂提供了文件」与「我们审阅并确认了文件」必须分开表述。

import { twText } from "./tw";

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
  // 归一化：数据源里同时存在 "Factory Verified"（空格）和 "FACTORY_VERIFIED"（下划线）
  // 两种写法。此前只做 toUpperCase()，空格写法查不到映射，所有供应商都被判成 LEVEL 0，
  // 页面显示成「暂无核验记录」。这里把空白与连字符统一成下划线再查表。
  const key = (status ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return STATUS_TO_LEVEL[key] ?? 0;
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

// 「任何等级都不覆盖的检查项」的文案已于 2026-09-01 迁到字典：
// i18n/dictionaries/*.json 的 verification.notCovered。
// 原先这里的 NOT_COVERED 是硬编码英文，8 个非英文站点上会露出英文，已删除。
// 页面统一读 t.verification.notCovered，避免同一份清单在代码和字典里各存一份。

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
  // 数据层只有 en/zh 两版：zh-TW 复用 zh 文案并就地繁化
  if (entry) {
    if (locale === "en") return entry.en;
    return locale === "zh-TW" ? twText(entry.zh) : entry.zh;
  }
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

// =============================================================================
// 验证与证据中心：证书/报告有效期状态（spec §10/§11）
//
// 说明：
//   - 「Valid / Expiring Soon」不落库，一律由 expiry_date 现算，避免任务未跑
//     导致状态与日期长期不一致（例如证书已过期却一直显示 Valid）。
//   - 本函数与上方遗留的 certificateStatus(verified) 语义不同，故不复用其名：
//     后者是「平台是否审阅过」，本函数是「证书自身是否仍在有效期」。
// =============================================================================

/** 距到期 N 天内视为「即将到期」（spec 示例有 30/45/60 天，取 60 更保守） */
export const EXPIRING_SOON_DAYS = 60;

export type CertificateExpiryState =
  | "PENDING"        // 待审核
  | "REJECTED"       // 已驳回
  | "EXPIRED"        // 已过期
  | "EXPIRING_SOON"  // 即将到期
  | "VALID";         // 有效

/** 距指定日期还有多少天（按 UTC 日粒度；无效日期返回 null） */
export function daysUntilDate(
  dateStr?: string | null,
  now: Date = new Date()
): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target.getTime() - today) / 86400000);
}

/**
 * 计算证书显示状态。
 * 优先级：审核态（PENDING/REJECTED）> 到期态（EXPIRED/EXPIRING_SOON）> VALID。
 * 未填 expiry_date 且已审核通过 → VALID（无固定有效期的资质文件）。
 */
export function certificateExpiryState(params: {
  verificationStatus?: string | null;
  expiryDate?: string | null;
  now?: Date;
}): CertificateExpiryState {
  const st = (params.verificationStatus ?? "").trim().toUpperCase();
  if (st === "REJECTED") return "REJECTED";
  if (st === "PENDING") return "PENDING";
  if (st === "EXPIRED") return "EXPIRED";

  const days = daysUntilDate(params.expiryDate, params.now ?? new Date());
  if (days === null) return "VALID";
  if (days < 0) return "EXPIRED";
  if (days <= EXPIRING_SOON_DAYS) return "EXPIRING_SOON";
  return "VALID";
}
