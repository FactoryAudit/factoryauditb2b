// lib/payments/index.ts —— 渠道路由 + webhook 幂等 + 会员开通（唯一一份）
//
// 这个文件是整个支付体系的"收银台后台"：
//   1. getChannel()   —— 按 provider 分发到具体实现
//   2. claimEvent()   —— webhook 幂等占位（重复投递只处理一次）
//   3. applyMembershipEvent() —— 把归一化事件落到 memberships 表
//
// 为什么这三件事必须集中在一处：
//   支付类代码最怕"逻辑复制"——开通会员的判定如果散落在
//   stripe/webhook、paypal/webhook、alipay/notify 三处，
//   改一处漏两处，结果就是"用户付了钱没开通"或"没付钱被开通"。
//   集中后，每个渠道的 webhook 只负责"验签 + 归一化"，剩下全走这里。

import { createAdminClient } from "../supabaseAdmin";
import { markOrderPaidByProvider } from "../orders";
import { paypalChannel } from "./paypal";
import type {
  CurrencyCode,
  NormalizedEvent,
  PaymentChannel,
  PaymentProvider,
} from "./types";

// ---------- 1. 渠道路由 ----------

/**
 * 取渠道实现。未支持的渠道返回 null，调用方应回 400。
 *
 * 新增渠道时：实现 PaymentChannel 接口，在这里加一个 case 即可，
 * webhook 与会员开通逻辑一行都不用改。
 */
export function getChannel(provider: PaymentProvider): PaymentChannel | null {
  switch (provider) {
    case "paypal":
      return paypalChannel;
    // case "alipay":
    //   return alipayChannel;   // 等 ICP 备案下来后再接
    default:
      return null;
  }
}

/** 当前哪些渠道已配置好密钥（用于 UI 决定要不要展示该渠道） */
export function availableProviders(): PaymentProvider[] {
  const list: PaymentProvider[] = [];
  if (paypalChannel.isConfigured()) list.push("paypal");
  return list;
}

// ---------- 2. webhook 幂等 ----------

/**
 * 占位一次事件。
 *
 * @returns true = 首次处理（调用方应继续走业务）
 *          false = 已处理过（调用方应直接返回 200，不要重复开通）
 *
 * fail-open 说明：
 *   若 payment_events 表还没建（002_payments.sql 未执行），
 *   这里会返回 true 并打印警告 —— 宁可暂时没有幂等保护，也不能让 webhook 整体挂掉。
 *   表建好后自动生效，无需改代码。
 */
export async function claimEvent(
  provider: PaymentProvider,
  eventId: string,
  eventType: string,
  payload: unknown
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) {
    console.warn("[payments] 无 service_role，跳过幂等占位");
    return true;
  }

  try {
    const { error } = await db.from("payment_events").insert({
      provider,
      event_id: eventId,
      event_type: eventType,
      payload: payload ?? null,
    });

    if (!error) return true;

    // 主键冲突 = 这条事件之前处理过了
    // Postgres / PostgREST 的唯一约束错误码是 23505
    const code = String((error as { code?: string }).code ?? "");
    if (code === "23505") {
      console.log(`[payments] 事件已处理过，跳过：${provider}/${eventId}`);
      return false;
    }

    // 表不存在（PGRST205）→ 迁移未执行，放行并提醒
    if (code === "PGRST205" || /payment_events/.test(error.message ?? "")) {
      console.warn("[payments] payment_events 表不存在，幂等暂未生效（请执行 002_payments.sql）");
      return true;
    }

    console.error("[payments] 幂等占位失败", error.message);
    return true;
  } catch (e) {
    console.error("[payments] 幂等占位异常", e);
    return true;
  }
}

// ---------- 3. 会员开通（唯一实现） ----------

export type ApplyResult =
  | { ok: true; action: "activated" | "canceled" | "past_due" | "skipped" }
  | { ok: false; error: "no_user_reference" | "db_error" };

/**
 * 把归一化事件落到 memberships。
 *
 * 安全前提：
 *   - 必须已有 userId。拿不到就拒绝开通 ——
 *     **宁可不开通（可人工补），也绝不能开错人（等于资损）**。
 *   - 会员生效判定由 lib/membership.ts 的 isFoundingBuyer() 双重校验
 *     （status=active 且 current_period_end > now），这里只负责写入。
 */
export async function applyMembershipEvent(ev: NormalizedEvent): Promise<ApplyResult> {
  if (!ev.userId) {
    console.error("[payments] 事件缺少 userId，拒绝开通", ev.provider, ev.rawType);
    return { ok: false, error: "no_user_reference" };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, error: "db_error" };

  const now = new Date().toISOString();

  // 会员状态映射
  let status: "active" | "canceled" | "past_due";
  let plan: "free" | "founding_buyer";
  let periodEnd: string | null = null;

  switch (ev.kind) {
    case "activated":
      status = "active";
      plan = "founding_buyer";
      periodEnd = ev.periodEnd ? ev.periodEnd.toISOString() : null;
      break;
    case "canceled":
      // 取消订阅只改状态，不清空到期时间 ——
      // 用户已付费的周期仍应可用到期末（这是订阅制的基本履约）
      status = "canceled";
      plan = "founding_buyer";
      break;
    case "payment_failed":
      status = "past_due";
      plan = "founding_buyer";
      break;
  }

  try {
    // memberships 有 user_id 唯一索引，用 upsert 保证一个用户一条记录
    const row: Record<string, unknown> = {
      user_id: ev.userId,
      plan,
      status,
      provider: ev.provider,
      billing_mode: ev.billingMode,
      updated_at: now,
    };

    // 只在有值时覆盖，避免用 null 冲掉已有数据
    if (periodEnd) row.current_period_end = periodEnd;
    if (ev.kind === "activated" && periodEnd) row.current_period_start = now;
    if (ev.providerCustomerId) row.provider_customer_id = ev.providerCustomerId;
    if (ev.providerRef) {
      if (ev.billingMode === "subscription") {
        // 订阅 id 已由 stripe_subscription_id 列承载历史数据；
        // 多渠道统一写入 provider_order_id 之外的字段见 002_payments.sql
        row.provider_order_id = ev.providerRef;
      } else {
        row.provider_order_id = ev.providerRef;
      }
    }
    if (ev.currency) row.currency = ev.currency as CurrencyCode;
    if (ev.amountMinor !== null) row.amount_minor = ev.amountMinor;

    const { error } = await db
      .from("memberships")
      .upsert(row, { onConflict: "user_id" });

    if (error) {
      console.error("[payments] 写 memberships 失败", error.message);
      return { ok: false, error: "db_error" };
    }

    const action =
      ev.kind === "activated" ? "activated" : ev.kind === "canceled" ? "canceled" : "past_due";

    console.log(`[payments] 会员${action}：user=${ev.userId} provider=${ev.provider} 到期=${periodEnd}`);
    return { ok: true, action };
  } catch (e) {
    console.error("[payments] 写 memberships 异常", e);
    return { ok: false, error: "db_error" };
  }
}

// ---------- 4. 统一的 webhook 处理入口 ----------

/**
 * 每个渠道的 webhook 路由都应该长这样：
 *
 *   const channel = getChannel("paypal");
 *   const ev = await channel.parseWebhook(rawBody, req.headers);
 *   if (!ev) return 400;                        // 验签失败
 *   const first = await claimEvent(...);
 *   if (!first) return 200;                     // 已处理过
 *   await applyMembershipEvent(ev);
 *   return 200;
 *
 * 封装成函数是为了保证三个渠道的 webhook 行为完全一致，
 * 不会出现"某个渠道忘了做幂等"这种事故。
 */
export async function handleWebhook(
  provider: PaymentProvider,
  rawBody: string,
  headers: Headers
): Promise<{ status: 200 | 400; reason: string }> {
  const channel = getChannel(provider);
  if (!channel) return { status: 400, reason: "unsupported_provider" };

  // 1) 验签 + 归一化
  const ev = await channel.parseWebhook(rawBody, headers);
  if (!ev) return { status: 400, reason: "invalid_signature" };

  // 2) 幂等
  const first = await claimEvent(provider, ev.eventId, ev.rawType, ev);
  if (!first) return { status: 200, reason: "duplicate" };

  // 3) 无关事件（normalize 阶段已过滤，这里兜底）
  if (!ev.kind) return { status: 200, reason: "ignored" };

  // 3.5) CS-17：服务订单核销。
  //   服务订单不需要登录，custom_id 里放的是订单号 ORD-XXXXXX 而不是 userId。
  //   靠前缀区分两条业务线，避免"给会员开通"和"给订单置已付"互相误伤。
  if (ev.kind === "activated" && ev.userId && ev.userId.startsWith("ORD-")) {
    const paid = await markOrderPaidByProvider(ev.userId, ev.provider, ev.providerRef);
    return { status: 200, reason: paid ? "order_paid" : "order_not_found" };
  }

  // 4) 落到 memberships
  await applyMembershipEvent(ev);
  return { status: 200, reason: "ok" };
}

export * from "./types";
