// lib/suppliers.ts —— Supplier Directory V2 访问分层单一事实来源
//
// 三层权限模型（需求 V2 §9/§10/§11）：
//   public —— 游客可见，SEO 直出（禁止隐藏 Risk Score，禁止做成空墙）
//   free   —— 注册 Free Account 后可见（每月 FREE_PROFILE_LIMIT 个 profile）
//   paid   —— Founding Buyer Membership（价格见下方 MEMBERSHIP_PRICE_USD）可见
//
// 页面/组件只消费本文件的字段清单与常量；分层逻辑不散落在页面代码里。
// 数据本身仍在 lib/staticData.ts 的 STATIC_SUPPLIERS（单一事实来源，本文件不复制数据）。

export type AccessLayer = "public" | "free" | "paid";

/** Public 层字段：目录卡片 + Profile 页 SEO 直出，任何情况下不得隐藏
 *
 * ⚠️ 字段名必须与 lib/queries.ts 的 SupplierView 完全一致。
 *    曾把 industryCode 写成 "industry"，导致 Supabase 路径下行业字段被误裁（页面显示 "—"）。 */
export const PUBLIC_FIELDS = [
  "legalName",
  "country",
  "countryName",
  "city",
  "industryCode",
  "mainProducts",
  "capabilities",
  "verificationStatus",
  // CS-02 起：**公开 Verification Level 的唯一权威字段**。
  // 来源 suppliers.verification_level（DB），绝不由 legacy verification_status 推导。
  "verificationLevel",
  "riskScore",
  "riskLevel",
  "evidenceCount",
  "evidenceVerified",
  "lastChecked",
  "businessType",
] as const;

/** Free 层字段：注册后可见（基础工商信息） */
export const FREE_FIELDS = [
  "established",
  "employees",
  "exportMarkets",
  "auditStatus",
] as const;

/** Paid 层字段：Buyer Membership 可见（证据明细 / 认证明细 / 验货历史 / 风险明细）
 *
 * 分层依据 V2.1 PRD：「付费层锁区：证据明细 / 认证明细 / 验货历史」。
 * certifications 原先写在 FREE_FIELDS，与 PRD 和详情页实现（layer="paid"）冲突，
 * 已移到 paid 层 —— 免费注册能看到基础工商信息，核验明细才是付费理由。 */
export const PAID_FIELDS = [
  "evidence",
  "inspectionHistory",
  "riskBreakdown",
  "certifications",
] as const;

/**
 * Guest（未登录访客）可浏览的**不同** Supplier 数量上限（CS-05a）。
 *
 * 计数单位 = unique supplier ID（不是 URL、不是 slug 数量、不是刷新次数、不是标签页数）。
 * 记账位置 = 客户端 localStorage（CS-05b 实现），服务端不掌握游客用量。
 *
 * ⚠️ 性质界定：这是**营销/转化机制**，不是安全边界。
 *    真正的安全边界只有一处 —— paid intelligence（evidence / inspectionHistory /
 *    riskBreakdown / certifications）始终由服务端的 tier 裁剪控制，与这个值无关。
 */
export const GUEST_PROFILE_LIMIT = 5;

/**
 * @deprecated CS-05a：Free Buyer 已改为「basic Supplier Profile 无限浏览」，
 * 这个 5 **不再是 Free Buyer 的额度**。保留导出仅为兼容旧引用（注册页 / membership 页 /
 * 欢迎邮件文案），CS-05c 会连同文案一起清理。
 *
 * 🚫 **禁止在任何访问判定 / 额度计算里使用本常量** —— 新代码一律用 `GUEST_PROFILE_LIMIT`。
 *    （历史坑：它曾被当成「Free 每月 5 家」，与本名极易混淆，故显式废弃。）
 */
export const FREE_PROFILE_LIMIT = 5;

/** Featured 数量区间（需求：4–10 家；当前真实收录 4 家，全部 Featured） */
export const FEATURED_MIN = 4;
export const FEATURED_MAX = 10;

/** Buyer Membership 定价（USD）
 *  单一事实来源：页面大号价格、membership 页 JSON-LD、llms.txt、注册欢迎邮件
 *  都必须读这个常量，不允许各自硬编码数字。改价只改这里。 */
export const MEMBERSHIP_PRICE_USD = 99;
export const MEMBERSHIP_PERIOD = "year";

/** 目录页过滤态（country/industry/q）→ noindex + canonical 回目录首页（需求 §20） */
export const DIRECTORY_PATH = "/suppliers";

/** Analytics 事件名：已统一到 lib/analytics.ts（单一事实来源）。
 *  这里 re-export，让历史代码 `import { ANALYTICS_EVENTS } from "@/lib/suppliers"` 继续可用。
 *  新代码请直接从 "@/lib/analytics" 取（那边还多了 save/compare/工具/转化等事件）。 */
export { ANALYTICS_EVENTS, CONVERSION_EVENTS, FUNNEL_STEPS } from "./analytics";
export type { AnalyticsEventName, AnalyticsEventName as AnalyticsEvent } from "./analytics";
