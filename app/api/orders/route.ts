import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  findService,
  formatUsdMinor,
  priceOrder,
  type ServiceItem,
} from "@/lib/commerce";
import { createOrder, attachProvider, looksLikeEmail } from "@/lib/orders";
import { createOrderCheckout } from "@/lib/payments/paypal";
import {
  notifyAdminNewOrder,
  notifyCustomerOrderReceived,
} from "@/lib/notify";
import { isLocale } from "@/i18n/config";

// POST /api/orders —— 创建服务订单
//
// 商业化核心：**这是全站第一个"我要买"的落点**。
//
// 三条不可妥协的安全设计：
//   1. **客户端永远不能传金额**。只收 serviceCode + quantity，金额由 lib/commerce.ts
//      的价目表在服务端算出。能传金额 = 任何人都能把 $399 的审核改成 $1。
//   2. 限流放最前且 fail-open（与全站 API 一致）。
//   3. 渠道原始错误不回显（可能含商户号等敏感信息），只回统一错误码。
//
// 收款方式（降级链）：
//   PayPal 已配置 且 金额已知 → 生成托管收银台 URL，客户一键付款
//   否则                      → 订单照常落库，标注 manual，由团队邮件发付款指令
//   —— 不管哪条路，客户都能立刻拿到订单号。这是"未配置支付也要能接住买单意图"。

const ORDER_LIMIT = 8;
const ORDER_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`orders:${clientIp(req)}`, ORDER_LIMIT, ORDER_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // ---- 1. 校验服务 ----
  const serviceCode = typeof body.serviceCode === "string" ? body.serviceCode : "";
  const item: ServiceItem | null = findService(serviceCode);
  if (!item) {
    return NextResponse.json({ ok: false, error: "unknown_service" }, { status: 400 });
  }

  // ---- 2. 校验邮箱 ----
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const locale = typeof body.locale === "string" && isLocale(body.locale) ? body.locale : "en";
  const company = typeof body.company === "string" ? body.company.trim().slice(0, 200) : null;
  const country = typeof body.country === "string" ? body.country.trim().slice(0, 100) : null;
  const supplierSlug =
    typeof body.supplierSlug === "string" ? body.supplierSlug.trim().slice(0, 120) : null;
  const sourcePath =
    typeof body.sourcePath === "string" ? body.sourcePath.trim().slice(0, 200) : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;

  // ---- 3. 服务端定价（前端传什么都不影响金额）----
  const priced = priceOrder(item, body.quantity);

  // ---- 4. 落库（订单号在这里才产生）----
  const result = await createOrder({
    serviceCode: item.code,
    serviceName: item.nameEn,
    quantity: priced.quantity,
    amountMinor: priced.amountMinor,
    email,
    company,
    country,
    supplierSlug,
    locale,
    sourcePath,
    notes,
    payload: { quantityRaw: body.quantity ?? null, userAgent: req.headers.get("user-agent") },
  });

  if (!result.stored) {
    // 数据库不可用时**不**编造订单号 —— 客户会拿它去付款，假号比报错更糟。
    console.error("[orders] 订单未落库", result.reason, result.message);
    return NextResponse.json(
      { ok: false, error: "order_not_stored" },
      { status: 503 }
    );
  }

  const referenceId = result.referenceId;
  const amountText = formatUsdMinor(priced.amountMinor);

  // ---- 5. 收款方式：先建单拿到号，再让渠道带上号（custom_id = 订单号）----
  let provider: string | null = null;
  let payUrl: string | null = null;

  if (priced.amountMinor !== null) {
    const checkout = await createOrderCheckout({
      referenceId,
      itemName: `${item.nameEn} (${referenceId})`,
      amountUsd: priced.amountMinor / 100,
      locale,
    });
    if (checkout.ok) {
      provider = "paypal";
      payUrl = checkout.url;
      await attachProvider(referenceId, "paypal", checkout.providerRef, checkout.url);
    } else {
      // 渠道故障/未配置都按"人工收款"处理：订单已经成立，不能因为收不了款就作废。
      console.warn("[orders] PayPal 结账不可用，降级人工收款", checkout.error);
    }
  }

  // ---- 6. 邮件（失败不影响下单结果）----
  try {
    await notifyAdminNewOrder({
      referenceId: result.referenceId,
      serviceName: item.nameEn,
      amountText,
      quantity: priced.quantity,
      email,
      company,
      country,
      supplierSlug,
      locale,
      provider,
    });
    await notifyCustomerOrderReceived({
      referenceId: result.referenceId,
      serviceName: item.nameEn,
      amountText,
      quantity: priced.quantity,
      email,
      locale,
    });
  } catch (e) {
    console.error("[orders] 通知邮件异常", e);
  }

  return NextResponse.json({
    ok: true,
    referenceId: result.referenceId,
    status: "pending_payment",
    serviceName: item.nameEn,
    quantity: priced.quantity,
    amountText,
    requiresQuote: priced.requiresQuote,
    paymentMethod: payUrl ? "paypal" : "manual",
    payUrl,
  });
}
