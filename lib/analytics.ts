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

  // ---- CTA 点击（CS-04 口径铁律：点击 ≠ 请求 ≠ 成交 ≠ 收入确认）----
  // 点击是漏斗上层，**绝不可**计入 CONVERSION_EVENTS，否则转化率虚高。
  // 服务卡片 / 入口点击一律发 *_cta_click；只有真实表单提交才发 *_request / *_submit。
  supplierCardClick: "supplier_card_click",
  verificationCtaClick: "verification_cta_click",
  auditCtaClick: "audit_cta_click",
  inspectionCtaClick: "inspection_cta_click",
  rfqCtaClick: "rfq_cta_click",
  /** /services Sourcing 卡片点击（sourcing 的落地页是 /rfq） */
  sourcingCtaClick: "sourcing_cta_click",

  // ---- 游客限额 / 免费注册（Guest Limit）----
  /** CS-05b 已接线：Guest 看完 5 家不同 supplier 后，第 6 家被注册门拦下时发出 */
  guestLimitReached: "guest_limit_reached",
  freeAccountSignupStart: "free_account_signup_start",
  freeAccountSignupComplete: "free_account_signup_complete",

  // ---- 免费工具（Free Tools）----
  riskCalculatorStart: "risk_calculator_start",
  riskCalculatorComplete: "risk_calculator_complete",
  verificationChecklistStart: "verification_checklist_start",

  // ---- 留资 / 供应商入驻（Lead Capture）----
  // Sample Report 留资表单（提交邮箱换样例报告）
  sampleReportCta: "sample_report_cta",
  sampleReportSubmit: "sample_report_submit",
  // 公开标准报告样板页 /standard-report（CS-11）：全文免注册可读，下载需留资
  // 口径与 sample-report 一致：按钮点击 = 意向层，提交成功 = 转化。
  standardReportCtaClick: "standard_report_cta_click",
  standardReportSubmit: "standard_report_submit",
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
  /** /login 页面曝光（V2.1） */
  loginView: "login_view",
  /** 退出登录（V2.1） */
  logout: "logout",
  /** 登录失败（V2.1）：用于观察登录漏斗的卡点，不记录邮箱/密码 */
  loginFailed: "login_failed",
  /** V2.2 §48/§52：/membership 页面已 308 合并进 /pricing（Founding Buyer），原 membership_* 事件退役；
   *  Founding Buyer 漏斗由 foundingBuyerView / foundingBuyerCheckoutStart / foundingBuyerPurchase 覆盖。 */
  /** 会员软锁 UnlockGate 里的「注册 / 升级」CTA 点击（V2.1） */
  unlockGateCta: "unlock_gate_cta",
  /**
   * 免费额度用尽（V2.1 旧口径：本月已看满 5 家）。
   *
   * ⚠️ CS-05a 起该额度已废止（Free Buyer = basic 无限浏览），本事件**永不接线**，
   *    留在 UNWIRED_EVENTS 里是刻意的 —— 防止有人把它当"新事件"重新接上，
   *    那会让 GA4 里出现一个口径错误的转化信号。
   *    任何 Free Buyer 的正常浏览都不得触发它。
   *    CS-05c 又移除了它唯一可能的发射点（QuotaBanner）与对应常量，
   *    现在源码里连"能重新接上"的钩子都不存在了。
   */
  quotaReached: "free_quota_reached",

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
 *
 * CS-04 口径铁律（不可违反）：
 *   点击（*_cta_click） ≠ 请求（*_request） ≠ 成交（Paid Order） ≠ 收入确认
 * 只有「真实表单提交」与「真实付款」才配进入本清单。
 * 把 CTA 点击塞进来会让转化率虚高 —— 这正是本次修复要消灭的问题。
 *
 * 在 GA4 后台把这些标记为「关键事件 / Key events」即可构成转化漏斗：
 *   Google Search → Landing → Profile/Free Tool → Free Account
 *   → Founding Buyer → Verification → Factory Audit → Inspection
 */
export const CONVERSION_EVENTS = [
  // ---- 真实账号（服务端确认）----
  ANALYTICS_EVENTS.registerSubmit, // 注册表单通过校验并真实发起提交
  ANALYTICS_EVENTS.signupComplete, // 建号 / 线索落库成功
  // ---- Form Submit：真实表单提交（Request）----
  ANALYTICS_EVENTS.auditRequest, // /factory-audit/request 表单提交
  ANALYTICS_EVENTS.inspectionRequest, // /services/inspection 表单提交
  ANALYTICS_EVENTS.rfqSubmit, // /rfq 正式询价提交
  ANALYTICS_EVENTS.customServiceSubmit, // /custom-services 咨询提交
  // CS-01：sampleReportSubmit 已移出 —— /sample-report 308 到 /standard-report 之后
  // 该页不再渲染，这个留资事件事实上没有 emitter。继续留在转化桶会在 GA4 里出现
  // 恒为 0 的假转化。已移入 UNWIRED_EVENTS，与同类的 quotaReached 一致。
  ANALYTICS_EVENTS.standardReportSubmit, // 标准报告样张下载留资提交（/standard-report）
  ANALYTICS_EVENTS.supplierNetworkSubmit, // 供应商入驻提交
  // ---- Qualified Lead：服务端确认已受理 ----
  ANALYTICS_EVENTS.auditRequestSubmit,
  ANALYTICS_EVENTS.inspectionRequestSubmit,
  // ---- Paid Order（付费成交）----
  // 注意：Stripe 尚未支持大陆主体（CS-05 前的已知 P0），这两个事件
  // 目前没有任何 emitter，GA4 中会恒为 0，这是**预期**而非故障。
  // 保留在这里是因为它们语义上确属「成交」，Stripe 激活后即自动生效。
  ANALYTICS_EVENTS.foundingBuyerPurchase,
  ANALYTICS_EVENTS.verificationPurchase,
] as const;

/**
 * 点击层事件（Click-level）—— **绝不可**进入 CONVERSION_EVENTS。
 * 它们是漏斗上层的「意向」，一旦计入转化就会让转化率虚高。
 *
 * 注：founding_buyer_checkout_start / verification_checkout_start 这两个旧名同样是
 * 点击驱动（分别见 components/CheckoutButton.tsx 与 app/[locale]/pricing/page.tsx），
 * 已从 CONVERSION_EVENTS 中移除。为不改动既有页面事件名，这里原样保留并归档在点击层；
 * 未来若统一命名，应改名为 *_cta_click。
 */
export const CLICK_LEVEL_EVENTS = [
  ANALYTICS_EVENTS.verificationCtaClick,
  ANALYTICS_EVENTS.auditCtaClick,
  ANALYTICS_EVENTS.inspectionCtaClick,
  ANALYTICS_EVENTS.sourcingCtaClick,
  ANALYTICS_EVENTS.rfqCtaClick,
  ANALYTICS_EVENTS.supplierCardClick,
  ANALYTICS_EVENTS.profileFreeCta,
  ANALYTICS_EVENTS.profilePaidCta,
  ANALYTICS_EVENTS.registerCta,
  // V2.2：原会员页 CTA 事件退役（/membership 已合并进 /pricing），改用 founding_buyer_* 漏斗
  ANALYTICS_EVENTS.unlockGateCta,
  // CS-01：sampleReportCta 已移入 UNWIRED_EVENTS（/sample-report 已 308，无 emitter）
  ANALYTICS_EVENTS.standardReportCtaClick,
  ANALYTICS_EVENTS.foundingBuyerCheckoutStart,
  ANALYTICS_EVENTS.verificationCheckoutStart,
] as const;

/**
 * 已声明但**当前没有任何 emitter**、且不属于点击层的事件（Reserved / Unwired）。
 *
 * 保留常量是为了将来接线时命名统一；在真实接线之前它们既不进
 * CONVERSION_EVENTS（否则 GA4 里出现恒为 0 的假转化），也不进
 * CLICK_LEVEL_EVENTS。跨 CHANGESET 接线时请同步把事件移入正确的桶。
 *
 *   - verification_request  ：等 Verification Request 真实表单上线（CS-05+）；
 *                            现阶段核查 CTA 只发 verification_cta_click
 *   - sourcing_request      ：sourcing 落地页是 /rfq，真实提交事件是 rfq_submit；
 *                            本事件与之重复，等独立 sourcing 表单上线再启用
 *   - free_account_signup_* ：等 Free Account 专属注册漏斗上线
 *   - profile_save          ：功能未接线
 *   - free_quota_reached    ：旧的「Free 每月 5 家」额度事件。该额度已由 CS-05a 废止
 *                            （Free Buyer 改为 basic 无限浏览），**永不接线**；
 *                            保留常量只为避免误把它当新事件重建。
 *                            游客侧的等价信号是 guest_limit_reached（CS-05b 已接线）。
 *
 * ✅ 已于 CS-05b 移出本清单：guest_limit_reached —— 现由
 *    lib/guestAccess.ts 的 emitGuestLimitReachedOnce 在 Guest 第 6 家注册门发出
 *    （同一 supplier 只发一次，刷新/重渲不重复）。
 */
export const UNWIRED_EVENTS = [
  ANALYTICS_EVENTS.verificationRequest,
  ANALYTICS_EVENTS.sourcingRequest,
  ANALYTICS_EVENTS.freeAccountSignupStart,
  ANALYTICS_EVENTS.freeAccountSignupComplete,
  ANALYTICS_EVENTS.profileSave,
  ANALYTICS_EVENTS.quotaReached,
  // CS-01：/sample-report 已 308 到 /standard-report，该页不再渲染 ⇒
  // sample-report 相关的两个事件都没有 emitter 了。等后续专项清理确认不再需要后
  // 可一并删除常量；在那之前按「已声明但未接线」归档在此。
  ANALYTICS_EVENTS.sampleReportCta,
  ANALYTICS_EVENTS.sampleReportSubmit,
] as const;

/**
 * 漏斗各阶段的代表事件（按用户旅程顺序）
 *
 * ⚠️ 口径铁律（CS-04）：点击 ≠ 请求 ≠ 成交 ≠ 收入确认
 *   - 前 7 步是「行为漏斗」：page_view → … → qualified_lead
 *   - paid_order 起进入「商业漏斗」，两者不可混算同一个转化率
 *   - 收入确认（Revenue Recognition）是**财务口径**，不存在于前端事件流中，
 *     因此刻意不放进本数组 —— 绝不允许用某个前端事件冒充它。
 */
export const FUNNEL_STEPS = [
  { step: "page_view", event: "page_view", note: "自然搜索落地（GA4 自动上报，前端勿重复发 page_view）" },
  { step: "supplier_search", event: ANALYTICS_EVENTS.directorySearch, note: "供应商搜索 / 筛选" },
  { step: "supplier_profile_view", event: ANALYTICS_EVENTS.profileView, note: "查看供应商档案" },
  // CTA Click 属于意向层：进漏斗是为了算点击率，但绝不进 CONVERSION_EVENTS
  { step: "cta_click", event: ANALYTICS_EVENTS.verificationCtaClick, note: "CTA 点击（意向层，非转化）" },
  { step: "form_start", event: ANALYTICS_EVENTS.rfqStart, note: "开始填写表单（Form Start）" },
  { step: "form_submit", event: ANALYTICS_EVENTS.auditRequest, note: "表单提交（Form Submit / Request）" },
  { step: "qualified_lead", event: ANALYTICS_EVENTS.auditRequestSubmit, note: "服务端确认受理（Qualified Lead）" },
  { step: "paid_order", event: ANALYTICS_EVENTS.foundingBuyerPurchase, note: "付费成交（Paid Order，待 Stripe 接线）" },
] as const;

/**
 * 服务菜单 key → 服务卡片**点击**事件名。
 *
 * ⚠️ CS-04 修复：这里以前映射到 *_request（verification_request / audit_request /
 * inspection_request / sourcing_request），而这些是 Conversion Event —— 于是
 * 「/services 上点一下卡片」就被记成了一次「服务请求」，转化率严重虚高。
 * 现在一律映射到 *_cta_click（意向层，**不在** CONVERSION_EVENTS）。
 * 真实请求只在用户真正提交表单时由对应表单组件发送 *_request / *_submit。
 *
 * 映射以 lib/nav.ts 的 SERVICE_MENU 为准（注意 sourcing 指向 /rfq，不是 /custom-services）。
 * 未列出的 key（monitoring / improvement）没有对应事件，因此不加埋点。
 */
export const SERVICE_EVENT_BY_KEY: Record<string, string> = {
  verification: ANALYTICS_EVENTS.verificationCtaClick,
  factoryAudit: ANALYTICS_EVENTS.auditCtaClick,
  inspection: ANALYTICS_EVENTS.inspectionCtaClick,
  sourcing: ANALYTICS_EVENTS.sourcingCtaClick,
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
