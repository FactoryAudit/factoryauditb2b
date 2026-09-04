// lib/payments/types.ts —— 多渠道支付抽象层
//
// 为什么要有这一层：
//   V2.1 原本只有 Stripe（lib/stripe.ts）。现在要同时支持 PayPal（订阅+一次性）
//   与支付宝（国内人民币 + 跨境），如果每个渠道各写各的路由和 webhook，
//   会员开通逻辑就会被复制三份，改一处漏两处 —— 这是最容易出钱的事故的地方。
//
//   所以这里定义统一契约：
//     - 上层（API 路由 / UI）只认接口，不认具体渠道
//     - 每个渠道实现同一组能力，各自处理自己的签名/验签/字段映射
//     - webhook 统一归一化成 NormalizedEvent，会员开通逻辑只有一份
//
// 设计原则：
//   1. 零依赖：一律用 fetch + Web Crypto，不引官方 SDK。
//      理由同 lib/stripe.ts —— 本项目跑在 Cloudflare Workers，
//      官方 SDK 会引入 node:http/stream 等依赖，增加打包与运行期的不确定性。
//   2. fail-open：未配置时返回可识别的错误码，绝不抛异常打断构建或页面渲染。
//      调用方据此降级到 /custom-services（人工对接），而不是白屏。
//   3. 金额一律用最小单位整数（USD 美分 / CNY 分）。浮点存金额是对账事故之源。

/** 支付渠道 */
export type PaymentProvider = "stripe" | "paypal" | "alipay";

/** 计费形态：订阅（自动续费）| 一次性（买一年，到期手动续） */
export type BillingMode = "subscription" | "one_time";

/** 币种。仅支持我们真正会收的两种，避免误配。 */
export type CurrencyCode = "USD" | "CNY";

/** 发起结账的请求（与渠道无关） */
export type CheckoutRequest = {
  /** Supabase user id。必须回传到 webhook，是把付款关联到用户的唯一可靠方式。 */
  userId: string;
  email: string;
  locale: string;
  mode: BillingMode;
  provider: PaymentProvider;
  currency: CurrencyCode;
};

/** 发起结账的结果：ok 时拿 url 跳转托管收银台 */
export type CheckoutResult =
  | { ok: true; url: string; providerRef: string | null }
  | { ok: false; error: PaymentErrorCode };

/**
 * 统一的错误码。
 * 注意：对外只暴露这些粗粒度码，不回显渠道原始错误信息 ——
 * 渠道错误里可能含商户号、密钥前缀等敏感信息。
 */
export type PaymentErrorCode =
  | "payment_not_configured" // 该渠道未配置密钥
  | "provider_api_error" // 渠道接口返回非 2xx
  | "provider_network_error" // 网络异常
  | "invalid_signature" // webhook 验签失败
  | "missing_user_reference" // webhook 里找不到 user_id，无法关联
  | "unsupported_mode"; // 该渠道不支持这种计费形态

/** 各渠道实现的统一接口 */
export interface PaymentChannel {
  readonly provider: PaymentProvider;

  /** 该渠道是否已配置（密钥齐全）。未配置一律 fail-open 降级。 */
  isConfigured(): boolean;

  /** 该渠道支持哪些计费形态。支付宝普通跨境收款只支持 one_time。 */
  supports(mode: BillingMode): boolean;

  /** 创建结账，返回托管收银台 URL */
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;

  /**
   * 校验 webhook 签名并归一化事件。
   *
   * @param rawBody 必须是未经解析的原始请求体字符串。
   *   req.json() 后再 stringify 会改变键顺序/空白，签名必然对不上。
   * @returns 验签失败或解析失败一律返回 null，调用方应回 400（且不做任何业务动作）
   */
  parseWebhook(
    rawBody: string,
    headers: Headers
  ): Promise<NormalizedEvent | null>;
}

/**
 * 归一化后的支付事件。
 *
 * 会员开通逻辑（lib/membership.ts）只认这个结构，
 * 不关心它来自 Stripe 的 customer.subscription.updated
 * 还是 PayPal 的 BILLING.SUBSCRIPTION.ACTIVATED。
 */
export type NormalizedEvent = {
  provider: PaymentProvider;
  /** 渠道自己的事件 id，用于幂等去重 */
  eventId: string;
  /** 渠道原始事件类型，留档排查用 */
  rawType: string;

  /**
   * 归一化后的语义类型。只保留会员开通真正关心的三种：
   *   - activated ：付款成功 / 订阅生效 → 开通会员
   *   - canceled  ：用户取消订阅       → 标记为 canceled
   *   - payment_failed：扣款失败       → 标记为 past_due
   * 其余类型（如订阅创建中、订单已创建未支付）一律返回 null，不触发任何动作。
   */
  kind: "activated" | "canceled" | "payment_failed";

  /** Supabase user id。拿不到就返回 null —— 宁可不开通，也绝不开错人。 */
  userId: string | null;

  /** 渠道侧的订阅 id（订阅模式）或订单 id（一次性模式） */
  providerRef: string | null;
  /** 渠道侧的客户 id（PayPal 为 payer_id） */
  providerCustomerId: string | null;

  billingMode: BillingMode;
  currency: CurrencyCode;
  /** 本次成交金额（最小单位） */
  amountMinor: number | null;
  /** 当前计费周期结束时间（一次性付款 = 一年后） */
  periodEnd: Date | null;
};

// ---------- 工具：金额与周期 ----------

/** 美元金额（元）转美分。用于落库与对账。 */
export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

/** 人民币（元）转分 */
export function cnyToFen(cny: number): number {
  return Math.round(cny * 100);
}

/** 一次性付款的到期时间：现在 + 1 年 */
export function oneYearFromNow(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** 安全取 env：去空白，空串视为未配置 */
export function env(name: string): string | null {
  return process.env[name]?.trim() || null;
}
