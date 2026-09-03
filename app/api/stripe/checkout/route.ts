import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import { getStripeCustomerId } from "@/lib/membership";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/config";

// POST /api/stripe/checkout —— 创建订阅结账会话，返回 Stripe 托管页 URL
//
// 流程：校验登录 → 取/复用 Stripe customer → 创建 Checkout Session → 返回 url
//
// 安全要点：
//   1. 用户 id 从 session 取，绝不信任请求体。前端传什么都不算数，
//      否则任何人都能伪造 user_id 给别人开通会员（或给自己免费开通）。
//   2. client_reference_id + metadata[user_id] 双写：webhook 靠这两个字段
//      把订阅回写到正确用户。只写一个的话，某条路径查不到就会漏单。
//   3. 限流放最前：这是唯一能触发真实扣款的入口，被脚本刷会污染 Stripe 后台。
//
// 降级：Stripe 未配置（缺 secret key 或 price id）时返回 503 + 明确 error，
//       前端据此隐藏/禁用结账按钮，而不是让用户点了才发现付不了款。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  // ---- 1. 限流（最前，超限就不再查库） ----
  const ip = clientIp(req);
  const rl = checkRateLimit(`stripe-checkout:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // ---- 2. 未配置直接降级（不暴露具体缺哪个变量，避免信息泄漏） ----
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "payment_not_configured" },
      { status: 503, headers: NO_STORE }
    );
  }

  // ---- 3. 必须登录 ----
  const user = await getCurrentUser();
  if (!user?.id || !user.email) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401, headers: NO_STORE }
    );
  }

  // ---- 4. 语言只影响回跳地址，不影响任何业务判定 ----
  let localeRaw = DEFAULT_LOCALE;
  try {
    const body = (await req.json()) as { locale?: unknown };
    if (typeof body?.locale === "string" && isLocale(body.locale)) {
      localeRaw = body.locale;
    }
  } catch {
    // body 为空/非 JSON 是合法情况（默认英文回跳），不报错
  }

  // ---- 5. 复用已有 customer ----
  const existingCustomerId = await getStripeCustomerId(user.id);

  const res = await createCheckoutSession({
    userId: user.id,
    customerEmail: user.email,
    existingCustomerId,
    locale: localeRaw,
  });

  if (!res.ok || !res.data?.url) {
    console.error("[api/stripe/checkout] failed", res.ok ? "no url" : res.error);
    return NextResponse.json(
      { ok: false, error: res.ok ? "no_checkout_url" : res.error },
      { status: 502, headers: NO_STORE }
    );
  }

  return NextResponse.json({ ok: true, url: res.data.url }, { headers: NO_STORE });
}
