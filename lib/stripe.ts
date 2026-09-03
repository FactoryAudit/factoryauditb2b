// lib/stripe.ts —— Stripe 集成（零依赖实现）
//
// 为什么不用官方 stripe npm 包：
//   1. 我们只需要 3 个操作：创建 Checkout Session、创建 Billing Portal Session、验证 Webhook 签名。
//      官方 SDK 体积大且会引入 http/https、Node stream 等依赖，增加 OpenNext/Cloudflare 打包的不确定性。
//   2. 这个项目的构建链已经足够脆弱（4 个 @opennextjs 补丁、Windows EPERM、静默卡死），
//      能少一个重量级依赖就少一类故障。
//   3. Stripe REST API 是稳定的 form-encoded 接口，Web Crypto 的 HMAC-SHA256 是验签的唯一必需品，
//      两者在 Node 18+ 与 Cloudflare Workers（nodejs_compat）下都是原生可用的。
//
// 实现依据：Stripe 官方签名规范
//   https://docs.stripe.com/webhooks#verify-manually
//   signed_payload = "{timestamp}.{raw_body}"
//   expected_sig   = HMAC_SHA256(webhook_secret, signed_payload)
//   签名头格式     = "t=1699999999,v1=abc123...,v0=..."（v1 可出现多次，任一匹配即通过）
//   时间容差       = 300 秒（防重放）

const STRIPE_API_BASE = "https://api.stripe.com/v1";

/** 签名时间容差（秒）。超过这个时间差的事件一律拒绝，防止重放攻击。 */
const WEBHOOK_TOLERANCE_SEC = 300;

// ---------- 环境读取（未配置时 fail-open，绝不抛异常打断构建） ----------

function secretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

function webhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

/** Stripe 未配置时返回 true。调用方据此降级（例如隐藏结账按钮），而不是崩溃。 */
export function isStripeConfigured(): boolean {
  return Boolean(secretKey());
}

/** 站点地址，用于 success_url / cancel_url。缺省回落到生产域名。 */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://factoryauditb2b.com"
  ).replace(/\/+$/, "");
}

// ---------- 底层：调用 Stripe REST API ----------

/**
 * Stripe 的 REST API 用 form-encoded 而不是 JSON。
 * 嵌套参数用方括号表示：metadata[user_id]=xxx
 */
function toFormBody(params: Record<string, string | number | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  return usp.toString();
}

type StripeResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function stripePost<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>
): Promise<StripeResult<T>> {
  const key = secretKey();
  if (!key) {
    return { ok: false, error: "stripe_not_configured" };
  }
  try {
    const res = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
      },
      body: toFormBody(params),
    });
    const json = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) {
      return { ok: false, error: json?.error?.message || `stripe_http_${res.status}` };
    }
    return { ok: true, data: json };
  } catch (e) {
    // 网络异常不能让结账流程白屏，返回可展示的错误
    return { ok: false, error: e instanceof Error ? e.message : "stripe_network_error" };
  }
}

async function stripeGet<T>(path: string): Promise<StripeResult<T>> {
  const key = secretKey();
  if (!key) return { ok: false, error: "stripe_not_configured" };
  try {
    const res = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2024-06-20" },
    });
    const json = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json?.error?.message || `stripe_http_${res.status}` };
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "stripe_network_error" };
  }
}

// ---------- 业务：Checkout Session ----------

export type CheckoutSession = { id: string; url: string };

/**
 * 创建订阅结账会话。
 *
 * @param opts.userId         Supabase user id，写进 client_reference_id 与 metadata，
 *                            webhook 靠它把订阅回写到正确用户（这是唯一可靠的关联方式）
 * @param opts.customerEmail  预填邮箱，减少用户操作步骤
 * @param opts.existingCustomerId 已有 Stripe 客户则复用，避免同一邮箱产生多个 customer
 */
export async function createCheckoutSession(opts: {
  userId: string;
  customerEmail: string;
  existingCustomerId?: string | null;
  locale?: string;
}): Promise<StripeResult<CheckoutSession>> {
  const priceId = process.env.STRIPE_PRICE_ID_FOUNDING_BUYER?.trim();
  if (!priceId) return { ok: false, error: "stripe_price_not_configured" };

  const base = siteUrl();
  // locale 用于结账成功页回跳到用户当前语言
  const lang = opts.locale && opts.locale !== "en" ? `/${opts.locale}` : "";

  const params: Record<string, string | number | boolean | undefined> = {
    mode: "subscription",
    // Stripe 托管结账页，我们不自己收卡号（PCI 负担为零）
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": 1,
    success_url: `${base}${lang}/account?checkout=success`,
    cancel_url: `${base}${lang}/membership?checkout=cancelled`,
    // ★ 关键：webhook 用这两个字段定位用户，缺一不可
    client_reference_id: opts.userId,
    "metadata[user_id]": opts.userId,
    customer_email: opts.existingCustomerId ? undefined : opts.customerEmail,
    customer: opts.existingCustomerId || undefined,
    // 让 Stripe 收集账单地址（B2B 发票需要）
    "billing_address_collection": "auto",
  };

  return stripePost<CheckoutSession>("/checkout/sessions", params);
}

// ---------- 业务：Billing Portal（自助改/取消订阅） ----------

export async function createBillingPortalSession(opts: {
  customerId: string;
  locale?: string;
}): Promise<StripeResult<{ url: string }>> {
  const base = siteUrl();
  const lang = opts.locale && opts.locale !== "en" ? `/${opts.locale}` : "";
  return stripePost<{ url: string }>("/billing_portal/sessions", {
    customer: opts.customerId,
    return_url: `${base}${lang}/account`,
  });
}

// ---------- 业务：查询订阅（用于双重校验过期时间） ----------

export type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
};

export async function getSubscription(
  subscriptionId: string
): Promise<StripeResult<StripeSubscription>> {
  return stripeGet<StripeSubscription>(`/subscriptions/${subscriptionId}`);
}

// ---------- Webhook 验签 ----------

/**
 * 常量时间比较，防时序攻击。
 * 注意：先比长度再逐字节 XOR，长度不同立即返回 false。
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** 把 ArrayBuffer 转成小写 hex 字符串 */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 验证 Stripe webhook 签名。
 *
 * @param rawBody  ★ 必须是未经解析的原始请求体字符串。
 *                 req.json() 之后再 JSON.stringify 会导致签名不匹配（键顺序/空白会变）。
 * @param signatureHeader "Stripe-Signature" 请求头的完整值
 * @returns 校验通过返回事件对象，失败返回 null（调用方应回 400）
 */
export async function verifyWebhookSignature<T = StripeEvent>(
  rawBody: string,
  signatureHeader: string | null
): Promise<T | null> {
  const secret = webhookSecret();
  if (!secret) {
    console.warn("[stripe] STRIPE_WEBHOOK_SECRET 未配置，拒绝所有 webhook");
    return null;
  }
  if (!signatureHeader) return null;

  // 1. 解析签名头
  const parts = signatureHeader.split(",").map((s) => s.trim());
  let timestamp: string | null = null;
  const v1Signatures: string[] = [];
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx);
    const value = part.slice(idx + 1);
    if (key === "t") timestamp = value;
    else if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) return null;

  // 2. 时间容差检查（防重放）
  const tsSec = Number(timestamp);
  if (!Number.isFinite(tsSec)) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsSec) > WEBHOOK_TOLERANCE_SEC) {
    console.warn("[stripe] webhook 时间戳超出容差，疑似重放攻击");
    return null;
  }

  // 3. 计算 HMAC-SHA256
  let expected: string;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${rawBody}`)
    );
    expected = toHex(sig);
  } catch (e) {
    console.error("[stripe] HMAC 计算失败", e);
    return null;
  }

  // 4. 常量时间比较（v1 可能有多个，任一匹配即通过）
  const matched = v1Signatures.some((s) => timingSafeEqual(expected, s));
  if (!matched) {
    console.warn("[stripe] webhook 签名不匹配");
    return null;
  }

  // 5. 签名通过后才解析 JSON
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return null;
  }
}

// ---------- Webhook 事件类型（只声明我们真正用到的字段） ----------

export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: {
    object: Record<string, unknown> & {
      id?: string;
      customer?: string;
      status?: string;
      client_reference_id?: string;
      metadata?: Record<string, string>;
      current_period_start?: number;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
    };
  };
};
