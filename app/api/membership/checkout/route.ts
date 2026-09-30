import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import { getStripeCustomerId } from "@/lib/membership";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { paypalChannel } from "@/lib/payments/paypal";
import { env } from "@/lib/payments/types";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/config";

// POST /api/membership/checkout —— 渠道无关的会员结账入口
//
// 为什么必须有这个路由（而不是让前端直接调 /api/stripe/checkout）：
//   Stripe 不支持中国大陆主体，本项目的主渠道是 **PayPal**（代码注释与
//   lib/payments/paypal.ts 头部均如此说明）。但前端 CheckoutButton 原先
//   只调 /api/stripe/checkout ⇒ **整条 PayPal 渠道从 UI 上不可达**，
//   "Become a Founding Buyer" 按钮在线上恒为死路（永远降级到人工页）。
//   这里把"选渠道"这件事收到服务端：前端只说"我要开通会员"，
//   由服务端按**实际已配置的密钥**决定走哪条线。
//
// 渠道优先级：PayPal → Stripe。
//   理由：PayPal 支持大陆主体且跨境收款不需 ICP 备案；Stripe 作为备选保留。
//
// 计费形态：默认 one_time（买一年，到期手动续）。
//   仅当 PAYPAL_PLAN_ID 已配置（PayPal 后台已建好年费计划）时才用 subscription。
//   为什么把 one_time 作为默认：它只需 Client ID + Secret 两个密钥即可工作，
//   而订阅模式额外要求运营先在 PayPal 后台建 Plan —— 否则按钮在密钥配好后
//   依然是死的（这正是"配了密钥却仍然付不了款"的典型成因）。
//   一次性年费同时避免了自动续费带来的取消义务（见 /terms 与 CS-23 口径）。
//
// 安全（与 /api/stripe/checkout 完全一致）：
//   1. 限流放最前
//   2. 必须登录 —— user id 一律取自 session，**绝不信任请求体**，
//      否则任何人都能伪造 user_id 给别人开通会员或给自己免费开通
//   3. 未配置一律 503 + payment_not_configured，前端据此降级到人工对接
//   4. 渠道原始错误不回显（可能含商户号等敏感信息）

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  // ---- 1. 限流（最前，超限不再查库）----
  const rl = checkRateLimit(`membership-checkout:${clientIp(req)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // ---- 2. 必须登录（先于渠道判断：不泄漏"哪些渠道已配置"）----
  const user = await getCurrentUser();
  if (!user?.id || !user.email) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401, headers: NO_STORE }
    );
  }

  // ---- 3. 语言只影响回跳地址，不影响任何业务判定 ----
  let locale = DEFAULT_LOCALE;
  try {
    const body = (await req.json()) as { locale?: unknown };
    if (typeof body?.locale === "string" && isLocale(body.locale)) {
      locale = body.locale;
    }
  } catch {
    // body 为空/非 JSON 是合法情况（默认英文回跳），不报错
  }

  // ---- 4. PayPal 优先 ----
  if (paypalChannel.isConfigured()) {
    // 有 Plan 才走订阅；否则一次性年费（见文件头说明）
    const mode = env("PAYPAL_PLAN_ID") ? "subscription" : "one_time";
    const res = await paypalChannel.createCheckout({
      userId: user.id,
      email: user.email,
      locale,
      mode,
      provider: "paypal",
      currency: "USD",
    });
    if (res.ok && res.url) {
      return NextResponse.json(
        { ok: true, url: res.url, provider: "paypal", mode },
        { headers: NO_STORE }
      );
    }
    if (res.ok) {
      console.error("[api/membership/checkout] paypal 返回 ok 但没有 url");
      return NextResponse.json(
        { ok: false, error: "no_checkout_url" },
        { status: 502, headers: NO_STORE }
      );
    }
    // 渠道临时故障 → 502；渠道未就绪（如 Plan 缺失）→ 503（前端降级人工）
    const status = res.error === "payment_not_configured" ? 503 : 502;
    return NextResponse.json({ ok: false, error: res.error }, { status, headers: NO_STORE });
  }

  // ---- 5. 回落 Stripe ----
  if (isStripeConfigured()) {
    const existingCustomerId = await getStripeCustomerId(user.id);
    const res = await createCheckoutSession({
      userId: user.id,
      customerEmail: user.email,
      existingCustomerId,
      locale,
    });
    if (res.ok && res.data?.url) {
      return NextResponse.json(
        { ok: true, url: res.data.url, provider: "stripe", mode: "subscription" },
        { headers: NO_STORE }
      );
    }
    console.error("[api/membership/checkout] stripe failed", res.ok ? "no url" : res.error);
    return NextResponse.json(
      { ok: false, error: res.ok ? "no_checkout_url" : res.error },
      { status: 502, headers: NO_STORE }
    );
  }

  // ---- 6. 两条线都没配 → 明确降级信号（前端据此走人工对接）----
  return NextResponse.json(
    { ok: false, error: "payment_not_configured" },
    { status: 503, headers: NO_STORE }
  );
}
