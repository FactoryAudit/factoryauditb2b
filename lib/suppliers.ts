// lib/suppliers.ts —— Supplier Directory V2 访问分层单一事实来源
//
// 三层权限模型（需求 V2 §9/§10/§11）：
//   public —— 游客可见，SEO 直出（禁止隐藏 Risk Score，禁止做成空墙）
//   free   —— 注册 Free Account 后可见（每月 FREE_PROFILE_LIMIT 个 profile）
//   paid   —— Founding Buyer Membership（$49/year）可见
//
// 页面/组件只消费本文件的字段清单与常量；分层逻辑不散落在页面代码里。
// 数据本身仍在 lib/staticData.ts 的 STATIC_SUPPLIERS（单一事实来源，本文件不复制数据）。

export type AccessLayer = "public" | "free" | "paid";

/** Public 层字段：目录卡片 + Profile 页 SEO 直出，任何情况下不得隐藏 */
export const PUBLIC_FIELDS = [
  "legalName",
  "country",
  "city",
  "industry",
  "mainProducts",
  "capabilities",
  "verificationStatus",
  "riskScore",
  "evidenceCount",
  "lastChecked",
  "businessType",
] as const;

/** Free 层字段：注册后可见 */
export const FREE_FIELDS = [
  "established",
  "employees",
  "exportMarkets",
  "certifications",
  "auditStatus",
] as const;

/** Paid 层字段：Buyer Membership 可见（证据明细 / 风险明细 / 验货历史） */
export const PAID_FIELDS = [
  "evidence",
  "inspectionHistory",
  "riskBreakdown",
] as const;

/** Free Account 每月可查看的 supplier profile 数量 */
export const FREE_PROFILE_LIMIT = 5;

/** Featured 数量区间（需求：4–10 家；当前真实收录 4 家，全部 Featured） */
export const FEATURED_MIN = 4;
export const FEATURED_MAX = 10;

/** Buyer Membership 定价（USD） */
export const MEMBERSHIP_PRICE_USD = 49;
export const MEMBERSHIP_PERIOD = "year";

/** 目录页过滤态（country/industry/q）→ noindex + canonical 回目录首页（需求 §20） */
export const DIRECTORY_PATH = "/suppliers";

/** Analytics 事件名（页面/组件统一从这里取，不散落字符串） */
export const ANALYTICS_EVENTS = {
  directoryView: "supplier_directory_view",
  directorySearch: "directory_search",
  directoryFilter: "directory_filter",
  profileView: "supplier_profile_view",
  profileFreeCta: "supplier_profile_free_cta",
  profilePaidCta: "supplier_profile_paid_cta",
  claimView: "supplier_claim_view",
  claimSubmit: "supplier_claim_submit",
  registerView: "register_view",
  registerSubmit: "register_submit",
  membershipView: "membership_view",
  membershipCta: "membership_cta",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
