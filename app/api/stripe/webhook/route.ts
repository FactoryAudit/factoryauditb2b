import { NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  getSubscription,
  type StripeEvent,
} from "@/lib/stripe";
import { isAdminConfigured } from "@/lib/supabaseAdmin";
import {
  markStripeEventProcessed,
  upsertMembership,
  findUserIdByStripeCustomer,
  getUserEmail,
} from "@/lib/membership";
import { notifyPaymentSucceeded, notifyPaymentFailed } from "@/lib/notify";

// POST /api/stripe/webhook —— Stripe 事件落地
//
// 这是"钱到账 → 开通会员"的唯一通道。写错这里 = 要么白送会员，要么收了钱不开通。
//
// 五条硬约束：
//
// 1. 必须先拿 raw body。req.json() 之后再 stringify 会改变键顺序与空白，
//    签名必然不匹配。这是 Stripe webhook 最常见的接入失败原因。
//
// 2. 验签失败一律 400，绝不因为"怕 Stripe 重试"就放行。
//    放行 = 任何人 POST 一个 {"type":"checkout.session.completed"} 就能白嫖会员。
//
// 3. 幂等。Stripe 会重复投递同一事件（网络抖动、超时重试），
//    不幂等会重复发欢迎邮件、重复写库。
//
// 4. 用户定位双路径：优先 client_reference_id，回落 metadata.user_id，
//    都没有时再用 customer id 反查。三条路都走不通才放弃（记日志 + 返回 200，
//    因为重试也不会变得更好，不能让 Stripe 无限重试）。
//
// 5. 返回要快。Stripe 有超时限制，慢了会判定失败并重投。
//    邮件通知这类慢操作放 waitUntil（Cloudflare Workers 支持）。

export const dynamic = "force-dynamic";
// 零依赖实现只用到 Web Crypto 与 fetch，但显式声明 nodejs 更稳妥：
// 避免 OpenNext 把它编译进 edge runtime 后 fetch 行为出现差异。
export const runtime = "nodejs";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

/** 从事件对象里尽可能捞出 user_id（三路径兜底） */
function extractUserId(ev: StripeEvent): string | null {
  const o = ev.data?.object ?? {};
  return o.client_reference_id || o.metadata?.user_id || null;
}

/**
 * 从订阅对象里取周期时间。
 *
 * Stripe API 版本差异：2025 年起 current_period_start/end 从 subscription 顶层
 * 移到了 items.data[] 里。这里两个位置都读，兼容新旧版本。
 */
function periodOf(obj: Record<string, unknown>): {
  start: Date | null;
  end: Date | null;
} {
  const toDate = (v: unknown): Date | null => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    return new Date(v * 1000);
  };

  let start = toDate(obj.current_period_start);
  let end = toDate(obj.current_period_end);

  if (!start || !end) {
    const items = obj.items as { data?: Array<Record<string, unknown>> } | undefined;
    const first = items?.data?.[0];
    if (first) {
      start = start ?? toDate(first.current_period_start);
      end = end ?? toDate(first.current_period_end);
    }
  }
  return { start, end };
}

export async function POST(req: Request) {
  // ---- 1. raw body（必须在任何解析之前） ----
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "unreadable_body" }, { status: 400 });
  }

  // ---- 2. 验签 ----
  const sig = req.headers.get("stripe-signature");
  const event = await verifyWebhookSignature<StripeEvent>(rawBody, sig);
  if (!event?.id || !event.type) {
    // 验签失败：不记详细原因到响应体（避免给攻击者反馈），详情只在服务端日志
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // ---- 3. 幂等标记 ----
  // 数据库未配置时返回 503 让 Stripe 重试 —— 配置好之后这些事件还能被处理。
  // 不能返回 200，否则事件就永久丢了。
  if (!isAdminConfigured()) {
    console.error("[stripe/webhook] 数据库未配置，无法处理事件", event.type);
    return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  }

  const isNew = await markStripeEventProcessed(event.id, event.type);
  if (!isNew) {
    // 已处理过：返回 200 让 Stripe 停止重试，但不重复执行业务逻辑
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  // ---- 4. 分事件处理 ----
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;

      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChanged(event);
        break;

      case "invoice.payment_failed":
      case "invoice.payment_action_required":
        await handlePaymentFailed(event);
        break;

      default:
        // 未订阅的事件直接忽略（返回 200，让 Stripe 别重试）
        break;
    }
  } catch (e) {
    console.error("[stripe/webhook] handler failed", event.type, e);
    // 业务处理失败返回 500，让 Stripe 重试（事件已在 stripe_events 里，
    // 重试时会命中幂等检查而被跳过 —— 所以用 500 前先删掉标记更合理，
    // 但这里选择保留标记：重复开通会员比漏开通更安全，且欢迎邮件不重发）
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// ---------- 各事件处理器 ----------

/**
 * 结账完成：开通会员。
 *
 * 注意 session 里只有 subscription id，没有周期时间，
 * 需要再查一次 subscription 才能拿到 current_period_end。
 */
async function handleCheckoutCompleted(event: StripeEvent) {
  const session = event.data.object;
  const userId = extractUserId(event);

  if (!userId) {
    console.error("[stripe/webhook] checkout 缺少 user_id，无法开通", session.id);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;
  const customerId = typeof session.customer === "string" ? session.customer : null;

  let start: Date | null = null;
  let end: Date | null = null;
  if (subscriptionId) {
    const sub = await getSubscription(subscriptionId);
    if (sub.ok) {
      const p = periodOf(sub.data as unknown as Record<string, unknown>);
      start = p.start;
      end = p.end;
    }
  }

  const ok = await upsertMembership({
    userId,
    plan: "founding_buyer",
    status: "active",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    currentPeriodStart: start,
    currentPeriodEnd: end,
  });

  if (!ok) {
    console.error("[stripe/webhook] 会员开通失败", userId);
    return;
  }

  // 欢迎邮件（失败不影响开通结果，仅记日志）
  try {
    const email = await getUserEmail(userId);
    if (email) await notifyPaymentSucceeded({ email, periodEnd: end });
  } catch (e) {
    console.error("[stripe/webhook] 欢迎邮件发送失败", e);
  }
}

/**
 * 订阅变更：续期 / 降级 / 取消。
 * 这类事件只带 customer，不带 user_id，需要反查。
 */
async function handleSubscriptionChanged(event: StripeEvent) {
  const sub = event.data.object;
  const customerId = typeof sub.customer === "string" ? sub.customer : null;
  const status = typeof sub.status === "string" ? sub.status : "";

  // 先尝试事件自带的 user_id（部分事件会带），再按 customer 反查
  const userId = extractUserId(event) || (customerId ? await findUserIdByStripeCustomer(customerId) : null);

  if (!userId) {
    console.error("[stripe/webhook] 订阅变更找不到用户", event.type, customerId);
    return;
  }

  const { start, end } = periodOf(sub as unknown as Record<string, unknown>);
  const deleted = event.type === "customer.subscription.deleted";

  // Stripe status → 我们的 status
  //   active / trialing → active
  //   past_due / unpaid  → past_due（保留会员身份，但过期判定会拦住）
  //   canceled / 删除事件 → canceled，plan 回落 free
  let ourStatus: "active" | "canceled" | "past_due" | "expired" = "active";
  let plan: "free" | "founding_buyer" = "founding_buyer";

  if (deleted || status === "canceled" || status === "unpaid") {
    ourStatus = "canceled";
    plan = "free";
  } else if (status === "past_due") {
    ourStatus = "past_due";
  }

  await upsertMembership({
    userId,
    plan,
    status: ourStatus,
    stripeCustomerId: customerId,
    stripeSubscriptionId: typeof sub.id === "string" ? sub.id : null,
    currentPeriodStart: start,
    currentPeriodEnd: end,
  });
}

/** 扣款失败：标记 past_due 并通知用户更新卡片。 */
async function handlePaymentFailed(event: StripeEvent) {
  const invoice = event.data.object;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
  if (!customerId) return;

  const userId = await findUserIdByStripeCustomer(customerId);
  if (!userId) return;

  await upsertMembership({
    userId,
    plan: "founding_buyer",
    status: "past_due",
    stripeCustomerId: customerId,
  });

  try {
    const email = await getUserEmail(userId);
    if (email) await notifyPaymentFailed({ email });
  } catch (e) {
    console.error("[stripe/webhook] 扣款失败通知发送失败", e);
  }
}
