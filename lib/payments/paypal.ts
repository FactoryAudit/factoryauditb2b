// lib/payments/paypal.ts —— PayPal 渠道（零依赖实现）
//
// 为什么 PayPal 是当前主线：
//   1. 大陆公司可直接申请，且 PayPal 中国 2025-09 已上线「订阅收费」能力，
//      支持周期性扣费（$99/年自动续费），填补了 Stripe 不支持大陆主体的缺口。
//   2. 属于跨境收款场景，**不要求 ICP 备案** —— 域名备案期间也能正常收款。
//   3. 订阅（自动续费）与一次性付款（买一年）两种形态都能做。
//
// 实现依据（PayPal REST API）：
//   OAuth      POST /v1/oauth2/token（Basic 认证，grant_type=client_credentials）
//   订阅       POST /v1/billing/subscriptions（需先在 PayPal 后台建好 Plan）
//   一次性     POST /v2/checkout/orders（intent=CAPTURE）
//   Webhook验签 POST /v1/notifications/verify-webhook-signature
//
// 与 Stripe 的关键差异（容易踩的坑）：
//   - Stripe 的 webhook 签名可本地用 HMAC 算（见 lib/stripe.ts）；
//     **PayPal 不能本地算**，必须把签名头回传给 PayPal 的接口去验。
//     这意味着验签多一次网络请求，失败时一律按"未通过"处理（宁可漏，不可错放）。
//   - PayPal 金额是字符串（"99.00"），不是整数。
//   - 订阅的到期时间不直接在事件里给，需要回查订阅详情（/v1/billing/subscriptions/{id}）。
//
// 环境变量：
//   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET  （必填）
//   PAYPAL_PLAN_ID                            （订阅模式必填，PayPal 后台建好的年费计划）
//   PAYPAL_WEBHOOK_ID                         （webhook 验签必填）
//   PAYPAL_MODE                               （"sandbox" | "live"，默认 live）

import {
  env,
  oneYearFromNow,
  usdToCents,
  type BillingMode,
  type CheckoutRequest,
  type CheckoutResult,
  type CurrencyCode,
  type NormalizedEvent,
  type PaymentChannel,
  type PaymentErrorCode,
} from "./types";

const LIVE = "https://api-m.paypal.com";
const SANDBOX = "https://api-m.sandbox.paypal.com";

function base(): string {
  return env("PAYPAL_MODE") === "sandbox" ? SANDBOX : LIVE;
}

function clientId(): string | null {
  return env("PAYPAL_CLIENT_ID");
}
function clientSecret(): string | null {
  return env("PAYPAL_CLIENT_SECRET");
}

/** 站点地址，用于 return_url / cancel_url */
function siteUrl(): string {
  return (env("NEXT_PUBLIC_SITE_URL") || "https://factoryauditb2b.com").replace(/\/+$/, "");
}

// ---------- OAuth：access_token ----------

/**
 * token 缓存。
 *
 * 说明：Cloudflare Workers 是无状态的，模块级变量只在**同一实例**内有效，
 * 冷启动后会重新获取。这不会造成正确性问题（只是多一次 token 请求），
 * 但能显著减少稳态下的网络往返。PayPal token 有效期约 9 小时，这里保守取 8 小时。
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  try {
    const basic = btoa(`${id}:${secret}`);
    const res = await fetch(`${base()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      console.error("[paypal] 获取 token 失败", res.status);
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;

    const ttlMs = (json.expires_in ?? 32400 - 3600) * 1000;
    cachedToken = { value: json.access_token, expiresAt: now + Math.min(ttlMs, 8 * 3600 * 1000) };
    return cachedToken.value;
  } catch (e) {
    console.error("[paypal] 获取 token 异常", e);
    return null;
  }
}

// ---------- 底层：带鉴权的 fetch ----------

type PayPalResult<T> = { ok: true; data: T } | { ok: false; error: PaymentErrorCode };

async function paypalFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<PayPalResult<T>> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "payment_not_configured" };

  try {
    const res = await fetch(`${base()}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    // 204 No Content（如某些 POST 无返回体）
    if (res.status === 204) return { ok: true, data: {} as T };

    const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
    if (!res.ok) {
      // 只记日志，不把渠道原文回显给前端（可能含商户号等敏感信息）
      console.error("[paypal] API 错误", res.status, json?.message);
      return { ok: false, error: "provider_api_error" };
    }
    return { ok: true, data: json as T };
  } catch (e) {
    console.error("[paypal] 网络异常", e);
    return { ok: false, error: "provider_network_error" };
  }
}

/** 从 PayPal 返回的 links 数组里取 rel=approve 的跳转地址 */
function approveUrl(links: { rel?: string; href?: string }[] | undefined): string | null {
  return links?.find((l) => l.rel === "approve")?.href ?? null;
}

// ---------- 订阅详情（用于拿准确的到期时间） ----------

type SubscriptionDetail = {
  id: string;
  status: string;
  subscriber?: { email_address?: string; payer_id?: string };
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { amount?: { value?: string; currency_code?: string } };
  };
  custom_id?: string;
};

export async function getSubscriptionDetail(
  subscriptionId: string
): Promise<SubscriptionDetail | null> {
  const r = await paypalFetch<SubscriptionDetail>(`/v1/billing/subscriptions/${subscriptionId}`);
  return r.ok ? r.data : null;
}

// ---------- 渠道实现 ----------

export const paypalChannel: PaymentChannel = {
  provider: "paypal",

  isConfigured(): boolean {
    return Boolean(clientId() && clientSecret());
  },

  supports(mode: BillingMode): boolean {
    // PayPal 订阅与一次性都支持（这是它优于支付宝普通跨境收款的地方）
    return mode === "subscription" || mode === "one_time";
  },

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    if (!paypalChannel.isConfigured()) {
      return { ok: false, error: "payment_not_configured" };
    }
    if (!paypalChannel.supports(req.mode)) {
      return { ok: false, error: "unsupported_mode" };
    }

    const lang = req.locale && req.locale !== "en" ? `/${req.locale}` : "";
    const base = siteUrl();
    const appContext = {
      brand_name: "FactoryAuditB2B",
      locale: req.locale || "en",
      // 用户付款完成后回到账户页；取消则回到会员页
      return_url: `${base}${lang}/account?checkout=success`,
      cancel_url: `${base}${lang}/membership?checkout=cancelled`,
      user_action: "SUBSCRIBE_NOW",
      shipping_preference: "NO_SHIPPING", // 纯数字会员，不需要收货地址
    };

    if (req.mode === "subscription") {
      const planId = env("PAYPAL_PLAN_ID");
      if (!planId) {
        // Plan 没配 = 订阅不可用，但不能让按钮变成死路，交给上层降级到人工
        return { ok: false, error: "payment_not_configured" };
      }

      const r = await paypalFetch<{
        id: string;
        links?: { rel?: string; href?: string }[];
      }>("/v1/billing/subscriptions", {
        method: "POST",
        body: {
          plan_id: planId,
          // ★ custom_id 是 webhook 里唯一能稳定拿回 userId 的地方
          custom_id: req.userId,
          subscriber: { email_address: req.email },
          application_context: appContext,
        },
      });
      if (!r.ok) return { ok: false, error: r.error };

      const url = approveUrl(r.data.links);
      if (!url) return { ok: false, error: "provider_api_error" };
      return { ok: true, url, providerRef: r.data.id };
    }

    // ---- 一次性付款：创建 Order ----
    const amount =
      req.currency === "CNY" ? { currency_code: "CNY", value: "699.00" } : { currency_code: "USD", value: "99.00" };

    const r = await paypalFetch<{
      id: string;
      links?: { rel?: string; href?: string }[];
    }>("/v2/checkout/orders", {
      method: "POST",
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            // 一次性年费的展示名。custom_id 承载 userId。
            description: "FactoryAuditB2B Founding Buyer — 1 Year",
            custom_id: req.userId,
            amount,
          },
        ],
        application_context: { ...appContext, user_action: "PAY_NOW" },
      },
    });
    if (!r.ok) return { ok: false, error: r.error };

    const url = approveUrl(r.data.links);
    if (!url) return { ok: false, error: "provider_api_error" };
    return { ok: true, url, providerRef: r.data.id };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<NormalizedEvent | null> {
    const webhookId = env("PAYPAL_WEBHOOK_ID");
    if (!webhookId) {
      console.warn("[paypal] PAYPAL_WEBHOOK_ID 未配置，拒绝所有 webhook");
      return null;
    }

    const transmissionId = headers.get("paypal-transmission-id");
    const transmissionTime = headers.get("paypal-transmission-time");
    const transmissionSig = headers.get("paypal-transmission-sig");
    const certUrl = headers.get("paypal-cert-url");
    const authAlgo = headers.get("paypal-auth-algo");

    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
      console.warn("[paypal] webhook 缺少签名头");
      return null;
    }

    // 1) 先验签。PayPal 不支持本地 HMAC 校验，必须回传给它自己的接口验。
    let event: PayPalWebhookEvent;
    try {
      event = JSON.parse(rawBody) as PayPalWebhookEvent;
    } catch {
      return null;
    }

    const verify = await paypalFetch<{ verification_status?: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: {
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: event,
        },
      }
    );

    // 验签接口本身失败 / 状态不是 SUCCESS → 一律当作未通过。
    // 宁可漏掉一次开通（可人工补），也绝不能放过一个伪造请求（等于白送会员）。
    if (!verify.ok || verify.data.verification_status !== "SUCCESS") {
      console.warn("[paypal] webhook 验签未通过", verify.ok ? verify.data.verification_status : verify.error);
      return null;
    }

    // 2) 验签通过后才做业务归一化
    return normalizePayPalEvent(event);
  },
};

// ---------- 服务订单一次性收款（CS-17） ----------

/**
 * 为 **服务订单** 创建 PayPal 一次性收款（与会员订阅分开）。
 *
 * 为什么不复用 createCheckout：
 *   会员是固定 $99 / 订阅，金额可以写死；服务订单金额来自 lib/commerce.ts 的价目表
 *   （$99 / $129 / $399×man-day …），必须按订单传入。硬编码金额 = 收错钱。
 *
 * 关联回订单的唯一可靠方式：
 *   custom_id + invoice_id 都写订单号 ORD-XXXXXX。
 *   webhook 验签通过后由 lib/orders.ts markOrderPaidByProvider() 核销。
 */
export async function createOrderCheckout(input: {
  referenceId: string;
  itemName: string;
  /** 金额（USD 元），来自价目表，不是客户端输入 */
  amountUsd: number;
  locale?: string;
}): Promise<CheckoutResult> {
  if (!paypalChannel.isConfigured()) {
    return { ok: false, error: "payment_not_configured" };
  }
  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    return { ok: false, error: "provider_api_error" };
  }

  const locale = input.locale || "en";
  const lang = locale !== "en" ? `/${locale}` : "";
  const base = siteUrl();

  const r = await paypalFetch<{ id: string; links?: { rel?: string; href?: string }[] }>(
    "/v2/checkout/orders",
    {
      method: "POST",
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            description: input.itemName,
            custom_id: input.referenceId,
            invoice_id: input.referenceId,
            amount: { currency_code: "USD", value: input.amountUsd.toFixed(2) },
          },
        ],
        application_context: {
          brand_name: "FactoryAuditB2B",
          locale,
          return_url: `${base}${lang}/checkout/${input.referenceId}?checkout=success`,
          cancel_url: `${base}${lang}/checkout/${input.referenceId}?checkout=cancelled`,
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
        },
      },
    }
  );
  if (!r.ok) return { ok: false, error: r.error };

  const url = approveUrl(r.data.links);
  if (!url) return { ok: false, error: "provider_api_error" };
  return { ok: true, url, providerRef: r.data.id };
}

// ---------- 事件归一化 ----------

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    status?: string;
    subscriber?: { payer_id?: string; email_address?: string };
    billing_info?: { next_billing_time?: string };
    amount?: { value?: string; currency_code?: string };
    purchase_units?: { custom_id?: string; amount?: { value?: string; currency_code?: string } }[];
    payer?: { payer_id?: string; email_address?: string };
  };
};

/**
 * 把 PayPal 的原生事件映射成统一的 NormalizedEvent。
 *
 * 只处理真正会影响会员状态的事件；其余（如订单已创建但未支付）
 * 一律返回 null，不触发任何写入。
 */
async function normalizePayPalEvent(event: PayPalWebhookEvent): Promise<NormalizedEvent | null> {
  const type = event.event_type ?? "";
  const eventId = event.id ?? "";
  if (!eventId || !type) return null;

  const res = event.resource ?? {};

  // 一次性付款：userId 藏在 purchase_units[0].custom_id
  const orderCustomId = res.purchase_units?.[0]?.custom_id ?? null;
  const userId = res.custom_id ?? orderCustomId;

  const currency: CurrencyCode =
    (res.amount?.currency_code as CurrencyCode) ||
    (res.purchase_units?.[0]?.amount?.currency_code as CurrencyCode) ||
    "USD";

  const amountValue = res.amount?.value ?? res.purchase_units?.[0]?.amount?.value ?? null;
  const amountMinor = amountValue ? Math.round(Number(amountValue) * 100) : null;

  // ---- 语义类型映射 ----
  let kind: NormalizedEvent["kind"] | null = null;
  let billingMode: BillingMode = "subscription";

  switch (type) {
    // 订阅生效（首次开通）
    case "BILLING.SUBSCRIPTION.ACTIVATED":
      kind = "activated";
      billingMode = "subscription";
      break;
    // 用户取消订阅
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
      kind = "canceled";
      billingMode = "subscription";
      break;
    // 续费扣款成功（每年一次）→ 视同再次激活，用于延长周期
    case "PAYMENT.SALE.COMPLETED":
      kind = "activated";
      billingMode = "subscription";
      break;
    // 扣款失败
    case "PAYMENT.SALE.FAILED":
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      kind = "payment_failed";
      billingMode = "subscription";
      break;
    // 一次性付款已完成扣款
    case "PAYMENT.CAPTURE.COMPLETED":
      kind = "activated";
      billingMode = "one_time";
      break;
    case "PAYMENT.CAPTURE.DENIED":
      kind = "payment_failed";
      billingMode = "one_time";
      break;
    default:
      // 其余事件与会员状态无关，直接忽略
      return null;
  }

  // ---- 到期时间 ----
  // 一次性付款：没有续费周期，直接算一年后。
  // 订阅：优先用事件里的 next_billing_time；拿不到就回查订阅详情。
  let periodEnd: Date | null = null;
  if (billingMode === "one_time") {
    periodEnd = oneYearFromNow();
  } else {
    const next = res.billing_info?.next_billing_time;
    if (next) {
      const d = new Date(next);
      if (!Number.isNaN(d.getTime())) periodEnd = d;
    }
    if (!periodEnd && res.id) {
      const detail = await getSubscriptionDetail(res.id);
      const t = detail?.billing_info?.next_billing_time;
      if (t) {
        const d = new Date(t);
        if (!Number.isNaN(d.getTime())) periodEnd = d;
      }
    }
    // 兜底：真拿不到就给一年，宁可多给不可少给（用户已付款）
    if (!periodEnd) periodEnd = oneYearFromNow();
  }

  const providerCustomerId =
    res.subscriber?.payer_id ?? res.payer?.payer_id ?? null;

  return {
    provider: "paypal",
    eventId,
    rawType: type,
    kind,
    userId,
    providerRef: res.id ?? null,
    providerCustomerId,
    billingMode,
    currency,
    amountMinor,
    periodEnd,
  };
}

/** 供 API 路由复用：USD 金额转美分（保持与 types 一致，避免各处重复实现） */
export { usdToCents };
