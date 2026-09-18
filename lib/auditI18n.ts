// lib/auditI18n.ts —— 审核/验真 UI 的本地化短语（CS-18 专用，自包含）
//
// 为什么不直接进 i18n/dictionaries/*.json：
//   全局字典要求「九语键集与 en 一致」且由脚本校验（CS-14/CS-17 铁律）。
//   验真页是新模块，先以自包含 map 落地，避免破坏全局字典契约；
//   完整并入九语字典是 Task #10 的工作。其余 6 语回落到英文（与既有口径一致）。
//
// 注意：这仍是「结构化文案」，不是散落在 JSX 里的硬编码字符串。

export type AuditLocale = "en" | "zh" | "zh-TW" | "ja" | "es" | "de" | "fr" | "pt" | "ar";

type Phrases = {
  title: string;
  verified: string;
  notVerifiable: string;
  notVerifiableHint: string;
  reportNumber: string;
  supplier: string;
  auditType: string;
  version: string;
  issued: string;
  sha256: string;
  verificationId: string;
  verifyUrl: string;
  copy: string;
  copied: string;
  note: string;
  issuedBy: string;
  revoked: string;
  superseded: string;
  valid: string;
  auditAnnounced: string;
  auditSemi: string;
  auditUnannounced: string;
};

const EN: Phrases = {
  title: "Report Verification",
  verified: "Report Verified",
  notVerifiable: "Report Not Publicly Verifiable",
  notVerifiableHint:
    "This verification ID is not publicly verifiable. The report may be private, not yet issued, or revoked. Contact the issuer for details.",
  reportNumber: "Report Number",
  supplier: "Supplier",
  auditType: "Audit Type",
  version: "Version",
  issued: "Issued",
  sha256: "SHA-256 (tamper-proof)",
  verificationId: "Verification ID",
  verifyUrl: "Verification URL",
  copy: "Copy",
  copied: "Copied",
  note: "This page proves the authenticity of a FactoryAuditB2B audit report. The SHA-256 fingerprint is computed from the report content and cannot be altered without detection.",
  issuedBy: "Issued by FactoryAuditB2B",
  revoked: "Revoked",
  superseded: "Superseded",
  valid: "Valid",
  auditAnnounced: "Announced",
  auditSemi: "Semi-announced",
  auditUnannounced: "Unannounced",
};

const ZH: Phrases = {
  title: "报告验真",
  verified: "报告已验证",
  notVerifiable: "报告不可公开验真",
  notVerifiableHint: "该验真编号不可公开验真。报告可能为私密、尚未签发或已撤销。请联系签发方了解详情。",
  reportNumber: "报告编号",
  supplier: "供应商",
  auditType: "审核方式",
  version: "版本",
  issued: "签发日期",
  sha256: "SHA-256（防篡改）",
  verificationId: "验真编号",
  verifyUrl: "验真网址",
  copy: "复制",
  copied: "已复制",
  note: "本页用于证明 FactoryAuditB2B 验厂报告的真实性。SHA-256 指纹由报告内容计算得出，任何篡改都将被发现。",
  issuedBy: "由 FactoryAuditB2B 签发",
  revoked: "已撤销",
  superseded: "已被新版替代",
  valid: "有效",
  auditAnnounced: "通知式",
  auditSemi: "半通知式",
  auditUnannounced: "不通知式",
};

const ZHTW: Phrases = {
  title: "報告驗真",
  verified: "報告已驗證",
  notVerifiable: "報告不可公開驗真",
  notVerifiableHint: "該驗真編號不可公開驗真。報告可能為私密、尚未簽發或已撤銷。請聯絡簽發方了解詳情。",
  reportNumber: "報告編號",
  supplier: "供應商",
  auditType: "審核方式",
  version: "版本",
  issued: "簽發日期",
  sha256: "SHA-256（防篡改）",
  verificationId: "驗真編號",
  verifyUrl: "驗真網址",
  copy: "複製",
  copied: "已複製",
  note: "本頁用於證明 FactoryAuditB2B 驗廠報告的真實性。SHA-256 指紋由報告內容計算得出，任何篡改都會被發現。",
  issuedBy: "由 FactoryAuditB2B 簽發",
  revoked: "已撤銷",
  superseded: "已被新版替代",
  valid: "有效",
  auditAnnounced: "通知式",
  auditSemi: "半通知式",
  auditUnannounced: "不通知式",
};

const MAP: Record<string, Phrases> = { en: EN, zh: ZH, "zh-TW": ZHTW };

export function auditVerifyPhrases(locale: string): Phrases {
  return MAP[locale] ?? EN;
}

export function auditTypeLabel(type: string, p: Phrases): string {
  if (type === "semi-announced") return p.auditSemi;
  if (type === "unannounced") return p.auditUnannounced;
  return p.auditAnnounced;
}

// ── 审核请求表单（§18-§21）─────────────────────────────────────────────────────
export type AuditRequestFormPhrases = {
  supplier: string;
  supplierPlaceholder: string;
  executionMethod: string;
  announced: string;
  semiAnnounced: string;
  unannounced: string;
  product: string;
  productCategory: string;
  preferredDate: string;
  preferredWindow: string;
  previousAudit: string;
  documentsAvailable: string;
  additionalComments: string;
  requestReceived: string;
  yourCode: string;
  copyCode: string;
};

const RQ_EN: AuditRequestFormPhrases = {
  supplier: "Supplier",
  supplierPlaceholder: "Select the supplier you want audited",
  executionMethod: "Execution Method",
  announced: "Announced",
  semiAnnounced: "Semi-announced",
  unannounced: "Unannounced",
  product: "Product / Scope",
  productCategory: "Product Category",
  preferredDate: "Preferred Date",
  preferredWindow: "Preferred Window",
  previousAudit: "Previous audit available",
  documentsAvailable: "Audit documents available",
  additionalComments: "Additional comments",
  requestReceived: "Audit request received. Our team will respond within one business day.",
  yourCode: "Your audit code",
  copyCode: "Copy code",
};

const RQ_ZH: AuditRequestFormPhrases = {
  supplier: "供应商",
  supplierPlaceholder: "选择需要验厂的供应商",
  executionMethod: "执行方式",
  announced: "通知式",
  semiAnnounced: "半通知式",
  unannounced: "不通知式",
  product: "产品 / 范围",
  productCategory: "产品类别",
  preferredDate: "期望日期",
  preferredWindow: "期望时段",
  previousAudit: "曾有验厂记录",
  documentsAvailable: "可提供验厂文件",
  additionalComments: "补充说明",
  requestReceived: "已收到验厂申请，我们的团队将在一个工作日内与您联系。",
  yourCode: "您的验厂编号",
  copyCode: "复制编号",
};

const RQ_ZHTW: AuditRequestFormPhrases = {
  supplier: "供應商",
  supplierPlaceholder: "選擇需要驗廠的供應商",
  executionMethod: "執行方式",
  announced: "通知式",
  semiAnnounced: "半通知式",
  unannounced: "不通知式",
  product: "產品 / 範圍",
  productCategory: "產品類別",
  preferredDate: "期望日期",
  preferredWindow: "期望時段",
  previousAudit: "曾有驗廠紀錄",
  documentsAvailable: "可提供驗廠文件",
  additionalComments: "補充說明",
  requestReceived: "已收到驗廠申請，我們的團隊將在一個工作日內與您聯繫。",
  yourCode: "您的驗廠編號",
  copyCode: "複製編號",
};

const RQ_MAP: Record<string, AuditRequestFormPhrases> = { en: RQ_EN, zh: RQ_ZH, "zh-TW": RQ_ZHTW };

export function auditRequestFormPhrases(locale: string): AuditRequestFormPhrases {
  return RQ_MAP[locale] ?? RQ_EN;
}
