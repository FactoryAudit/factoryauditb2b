import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { paypalChannel } from "@/lib/payments/paypal";
import type { BillingMode, CurrencyCode } from "@/lib/payments/types";

// POST /api/paypal/checkout —— 创建 PayPal 结账
//
// 契约与 /api/stripe/checkout 保持一致：
//   成功 → { ok: true, url }           前端整页跳转到 PayPal 托管收银台
//   未配置 → { ok: false, error: "payment_not_configured" }  前端降级到 /custom-services
//
// 为什么不自己收卡/收钱：
//   跳转 PayPal 托管页 = PCI 负担为零，且用户信任度更高（B2B 场景尤其重要）。
//
// 安全设计：
//   1. 限流放最前且 fail-open（与全站 API 一致）
//   2. 必须登录 —— 会员要挂到具体用户，游客下单等于资损
//   3. 渠道原始错误信息不回显（可能含商户号等敏感信息），只回统一错误码

const CHECKOUT_LIMIT = 10;
const CHECKOUT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(
    `paypal-checkout:${clientIp(req)}`,
    CHECKOUT_LIMIT,
    CHECKOUT_WINDOW_MS
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    locale?: string;
    currency?: string;
  };

  // 只接受两种形态，其余一律按订阅处理（不信任客户端传值）
  const mode: BillingMode = body.mode === "one_time" ? "one_time" : "subscription";
  const locale = typeof body.locale === "string" ? body.locale : "en";
  const currency: CurrencyCode = body.currency === "CNY" ? "CNY" : "USD";

  if (!paypalChannel.isConfigured()) {
    return NextResponse.json(
      { ok: false, error: "payment_not_configured" },
      { status: 503 }
    );
  }

  const result = await paypalChannel.createCheckout({
    userId: user.id,
    email: user.email ?? "",
    locale,
    mode,
    provider: "paypal",
    currency,
  });

  if (!result.ok) {
    // payment_not_configured（如 Plan 未配）→ 让前端降级到人工服务；
    // 其余为渠道临时故障 → 502
    const status = result.error === "payment_not_configured" ? 503 : 502;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, url: result.url, providerRef: result.providerRef });
}
