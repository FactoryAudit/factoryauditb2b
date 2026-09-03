import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import { getStripeCustomerId } from "@/lib/membership";
import { createBillingPortalSession, isStripeConfigured } from "@/lib/stripe";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/config";

// POST /api/stripe/portal —— 客户自助改/取消订阅
//
// Stripe Billing Portal 是托管页面，我们不自己实现改卡/取消/下载发票，
// 这样既省掉一整套 UI，也避免碰触任何卡号数据（PCI 负担为零）。
//
// 前提：用户必须已有 stripe_customer_id（即付过一次款）。
//       免费用户没有 customer，点了应该引导去结账而不是报错"找不到订阅"。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`stripe-portal:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "payment_not_configured" },
      { status: 503, headers: NO_STORE }
    );
  }

  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401, headers: NO_STORE }
    );
  }

  let localeRaw = DEFAULT_LOCALE;
  try {
    const body = (await req.json()) as { locale?: unknown };
    if (typeof body?.locale === "string" && isLocale(body.locale)) {
      localeRaw = body.locale;
    }
  } catch {
    // 无 body 是合法情况
  }

  const customerId = await getStripeCustomerId(user.id);
  if (!customerId) {
    // 免费用户：不是错误，前端应引导去 /membership 结账
    return NextResponse.json(
      { ok: false, error: "no_subscription" },
      { status: 404, headers: NO_STORE }
    );
  }

  const res = await createBillingPortalSession({
    customerId,
    locale: localeRaw,
  });

  if (!res.ok || !res.data?.url) {
    console.error("[api/stripe/portal] failed", res.ok ? "no url" : res.error);
    return NextResponse.json(
      { ok: false, error: res.ok ? "no_portal_url" : res.error },
      { status: 502, headers: NO_STORE }
    );
  }

  return NextResponse.json({ ok: true, url: res.data.url }, { headers: NO_STORE });
}
