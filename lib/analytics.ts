// lib/analytics.ts —— 全站分析通道（单一事实来源，fail-open）
//
// 设计原则：
// 1) 事件名集中在这里，页面只引用常量，不写裸字符串；
// 2) 未接入第三方分析时（无 gtag / dataLayer）全部静默 no-op，绝不抛错、绝不阻塞业务；
// 3) 所有事件参数先过 PII 清洗（白名单键 + 值过滤），邮箱/电话/密码等敏感数据不可能被发出；
// 4) 本模块可被服务端组件 import（顶层无 window 访问），trackEvent 只在客户端真正执行。
//
// 数据流：页面 data-track / 代码调用 trackEvent()
//        → 本模块清洗 → window.gtag（GA4）
//        → Cloudflare Web Analytics 由 beacon 自动采集，无需手动事件。

// ---------------------------------------------------------------------------
// 事件名常量
// ---------------------------------------------------------------------------
// 说明：保留旧键名（如 directorySearch）以免改动现有页面；
//      值统一为用户要求的命名（如 supplier_search），GA4 里看到的就是标准名。
export const ANALYTICS_EVENTS = {
  // ---- 供应商目录（Supplier Directory）----
  directoryView: "supplier_directory_view",
  directorySearch: "supplier_search",
  directoryFilter: "supplier_filter",
  profileView: "supplier_profile_view",
  profileFreeCta: "supplier_profile_free_cta",
  profilePaidCta: "supplier_profile_paid_cta",
  profileSave: "supplier_save",
  profileCompare: "supplier_compare",
  claimView: "supplier_claim_view",
  claimSubmit: "supplier_claim_submit",

  // ---- 免费工具（Free Tools）----
  riskCalculatorStart: "risk_calculator_start",
  riskCalculatorComplete: "risk_calculator_complete",
  verificationChecklistStart: "verification_checklist_start",

  // ---- 留资 / 供应商入驻（Lead Capture）----
  // Sample Report 留资表单（提交邮箱换样例报告）
  sampleReportCta: "sample_report_cta",
  sampleReportSubmit: "sample_report_submit",
  // Supplier Network 入驻表单（/join-supplier-network，31 字段人工工作流）
  supplierNetworkStart: "supplier_network_start",
  supplierNetworkSubmit: "supplier_network_submit",

  // ---- 服务请求（Service Requests）----
  verificationRequest: "verification_request",
  auditRequest: "audit_request",
  inspectionRequest: "inspection_request",
  sourcingRequest: "sourcing_request",
  rfqStart: "rfq_start",
  rfqSubmit: "rfq_submit",
  // /custom-services 通用咨询表单：全站付费档 CTA 的落地页（V1.1 定价无在线支付，
  // 付费意向统一导流到这里），是商业转化分析的终点事件
  customServiceStart: "custom_service_start",
  customServiceSubmit: "custom_service_submit",

  // ---- 用户账户（Account）----
  registerView: "register_view",
  registerCta: "register_cta",
  registerSubmit: "register_submit",
  signupStart: "signup_start",
  signupComplete: "signup_complete",
  login: "login",
  membershipView: "membership_page_view",
  membershipCta: "membership_cta",

  // ---- 商业转化（Commercial Conversion）----
  foundingBuyerView: "founding_buyer_view",
  foundingBuyerCheckoutStart: "founding_buyer_checkout_start",
  foundingBuyerPurchase: "founding_buyer_purchase",
  verificationCheckoutStart: "verification_checkout_start",
  verificationPurchase: "verification_purchase",
  auditRequestSubmit: "audit_request_submit",
  inspectionRequestSubmit: "inspection_request_submit",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * 核心转化事件（Core Conversions）
 * 在 GA4 后台把这些标记为「关键事件 / Key events」即可构成转化漏斗：
 *   Google Search → Landing → Profile/Free Tool → Free Account
 *   → Founding Buyer → Verification → Factory Audit → Inspection
 */
export const CONVERSION_EVENTS = [
  ANALYTICS_EVENTS.signupComplete,
  ANALYTICS_EVENTS.registerSubmit,
  ANALYTICS_EVENTS.foundingBuyerPurchase,
  ANALYTICS_EVENTS.verificationPurchase,
  ANALYTICS_EVENTS.foundingBuyerCheckoutStart,
  ANALYTICS_EVENTS.verificationCheckoutStart,
  ANALYTICS_EVENTS.auditRequestSubmit,
  ANALYTICS_EVENTS.inspectionRequestSubmit,
  ANALYTICS_EVENTS.rfqSubmit,
  ANALYTICS_EVENTS.customServiceSubmit,
  ANALYTICS_EVENTS.sampleReportSubmit,
  ANALYTICS_EVENTS.supplierNetworkSubmit,
  ANALYTICS_EVENTS.verificationRequest,
  ANALYTICS_EVENTS.auditRequest,
  ANALYTICS_EVENTS.inspectionRequest,
  ANALYTICS_EVENTS.sourcingRequest,
] as const;

/** 漏斗各阶段的代表事件（按用户旅程顺序） */
export const FUNNEL_STEPS = [
  { step: "landing", event: "page_view", note: "自然搜索落地页" },
  { step: "profile_or_tool", event: ANALYTICS_EVENTS.profileView, note: "供应商档案 / 免费工具" },
  { step: "free_account", event: ANALYTICS_EVENTS.signupComplete, note: "免费账号" },
  { step: "founding_buyer", event: ANALYTICS_EVENTS.foundingBuyerPurchase, note: "Founding Buyer 付费" },
  { step: "verification", event: ANALYTICS_EVENTS.verificationPurchase, note: "供应商核查付费" },
  { step: "audit", event: ANALYTICS_EVENTS.auditRequestSubmit, note: "验厂请求" },
  { step: "inspection", event: ANALYTICS_EVENTS.inspectionRequestSubmit, note: "验货 / sourcing 请求" },
] as const;

/**
 * 服务菜单 key → 服务咨询事件名。
 * 用于 /services 索引页与页脚服务入口：点击某个服务卡片 = 表达对该服务的意向。
 * 映射以 lib/nav.ts 的 SERVICE_MENU 为准（注意 sourcing 指向 /rfq，不是 /custom-services）。
 * 未列出的 key（monitoring / improvement）没有对应事件，因此不加埋点。
 */
export const SERVICE_EVENT_BY_KEY: Record<string, string> = {
  verification: ANALYTICS_EVENTS.verificationRequest,
  factoryAudit: ANALYTICS_EVENTS.auditRequest,
  inspection: ANALYTICS_EVENTS.inspectionRequest,
  sourcing: ANALYTICS_EVENTS.sourcingRequest,
};

// ---------------------------------------------------------------------------
// PII 防护
// ---------------------------------------------------------------------------
/**
 * 事件参数白名单：只有这些键会被发往分析服务。
 * 任何未列出的键（包括误传的 email / phone / password）都会被丢弃。
 */
const ALLOWED_PARAM_KEYS = new Set([
  "value",
  "page",
  "page_path",
  "path",
  "slug",
  "country",
  "industry",
  "locale",
  "tool",
  "plan",
  "count",
  "source",
  "query",
  "step",
  "score",
  "level",
  "method",
]);

/** 键名里含这些词一律丢弃（纵深防御） */
const FORBIDDEN_KEY_PARTS = [
  "email",
  "mail",
  "phone",
  "tel",
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "key",
  "card",
  "iban",
  "address",
  "name",
  "wechat",
  "whatsapp",
  "qq",
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
/** 9 位以上连续数字（手机号 / 卡号等） */
const LONG_DIGITS_RE = /\d{9,}/;

const MAX_STR_LEN = 100;

/**
 * 清洗事件参数：
 * - 键：必须在白名单内，且不含敏感词
 * - 值：字符串截断；命中邮箱或长数字串则整键丢弃
 * - 数字 / 布尔原样保留（在合理范围内）
 */
export function sanitizeParams(
  payload?: Record<string, unknown>
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!payload) return out;

  for (const [rawKey, rawVal] of Object.entries(payload)) {
    const key = rawKey.toLowerCase();
    if (!ALLOWED_PARAM_KEYS.has(key)) continue;
    if (FORBIDDEN_KEY_PARTS.some((p) => key.includes(p))) continue;
    if (rawVal === null || rawVal === undefined) continue;

    if (typeof rawVal === "number") {
      if (Number.isFinite(rawVal)) out[key] = rawVal;
      continue;
    }
    if (typeof rawVal === "boolean") {
      out[key] = rawVal;
      continue;
    }
    if (typeof rawVal !== "string") continue;

    const v = rawVal.trim();
    if (!v) continue;
    if (EMAIL_RE.test(v)) continue; // 疑似邮箱 → 丢弃
    if (LONG_DIGITS_RE.test(v)) continue; // 疑似电话/卡号 → 丢弃
    out[key] = v.slice(0, MAX_STR_LEN);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 发送
// ---------------------------------------------------------------------------
type GtagFn = (...args: unknown[]) => void;

type AnalyticsWindow = Window & {
  gtag?: GtagFn;
  dataLayer?: unknown[];
};

/** 调试开关：NEXT_PUBLIC_ANALYTICS_DEBUG=1 时在 console 打印事件（不发真实请求） */
const DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1";

/**
 * 发送自定义事件。无 gtag / dataLayer 时静默返回。
 * 调用方无需 try/catch —— 本函数自身 fail-open。
 */
export function trackEvent(name: string, payload?: Record<string, unknown>) {
  try {
    if (typeof window === "undefined") return;
    const params = sanitizeParams(payload);

    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log("[analytics]", name, params);
    }

    const w = window as unknown as AnalyticsWindow;
    if (typeof w.gtag === "function") {
      w.gtag("event", name, params);
      return;
    }
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event: name, ...params });
    }
  } catch {
    // fail-open：埋点出错绝不影响用户操作
  }
}

/**
 * 页面浏览（按「页面类型」聚合）。
 *
 * ⚠️ 为什么事件名不是 page_view：
 * GA4 的 gtag.js 会**自动**上报标准 page_view（含 URL、标题，用于 Visitors /
 * Page Views / Top Pages / URL 等报表，并正确处理 App Router 的客户端路由跳转）。
 * 如果这里再发一次 page_view，PV 会翻倍。
 * 因此本函数改发自定义事件 page_view_group，只用于按页面类型聚合
 * （如把 180 个 audit-guide 页归为一类），不与标准 PV 冲突。
 */
export function trackPageView(page: string) {
  trackEvent("page_view_group", { page });
}
