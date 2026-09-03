// lib/membership.ts —— 会员状态读写（服务端专用）
//
// 全部用 service_role 客户端（绕过 RLS），因为：
//   - 订阅状态由 Stripe webhook 写入，webhook 请求不带用户 cookie
//   - 额度计数需要原子性 upsert，受 RLS 约束反而碍事
//
// 安全：本文件的函数**只返回状态和计数**，绝不返回供应商的 paid 字段。
//       供应商数据一律经 lib/queries.ts + lib/access.ts 裁剪后再出去。
//
// fail-safe 原则：Supabase 未配置或查询出错时，一律返回"最保守的无权限状态"
// （visitor / 0 次额度），绝不因为数据库抖动把付费内容泄漏给游客。

import { createAdminClient } from "./supabaseAdmin";
import {
  resolveTier,
  currentPeriodMonth,
  type MembershipTier,
  type MembershipRecord,
} from "./access";

// ---------- 读取 ----------

/** 读会员原始记录。未配置/出错返回 null。 */
export async function getMembershipRecord(
  userId: string
): Promise<MembershipRecord> {
  const db = createAdminClient();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("memberships")
      .select("plan, status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as MembershipRecord;
  } catch {
    return null;
  }
}

/** 读真实档位（含过期双重校验）。 */
export async function getTier(userId: string): Promise<MembershipTier> {
  const rec = await getMembershipRecord(userId);
  if (!rec) {
    // 没有 membership 记录但有 user → 视为已登录的免费用户
    return "free";
  }
  return resolveTier(rec);
}

/** 是否管理员（查 profiles.role）。 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { data } = await db
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    return data?.role === "admin";
  } catch {
    return false;
  }
}

/**
 * 免费用户本月已用额度（去重后的 profile 数）。
 * 付费用户不需要调用这个（不限量）。
 */
export async function getProfileUsage(
  userId: string,
  month: string = currentPeriodMonth()
): Promise<number> {
  const db = createAdminClient();
  if (!db) return 0;
  try {
    const { count, error } = await db
      .from("profile_views")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("period_month", month);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ---------- 写入 ----------

/**
 * 记录一次 profile 浏览（用于免费额度计数）。
 *
 * 去重：依赖 profile_views(user_id, supplier_id, period_month) 的唯一索引，
 * 重复调用不会重复扣额度。返回是否"新消耗了一次额度"。
 *
 * 付费用户不记录（不限量，记了也没意义还占空间）。
 */
export async function recordProfileView(
  userId: string,
  supplierId: string,
  tier: MembershipTier
): Promise<{ counted: boolean; used: number }> {
  if (tier === "founding_buyer") {
    return { counted: false, used: 0 };
  }
  const db = createAdminClient();
  if (!db) return { counted: false, used: 0 };

  const month = currentPeriodMonth();
  try {
    // upsert + ignoreDuplicates：命中唯一索引时不报错也不新增
    const { error } = await db
      .from("profile_views")
      .upsert(
        { user_id: userId, supplier_id: supplierId, period_month: month },
        { onConflict: "user_id,supplier_id,period_month", ignoreDuplicates: true }
      );
    if (error) return { counted: false, used: 0 };
    const used = await getProfileUsage(userId, month);
    return { counted: true, used };
  } catch {
    return { counted: false, used: 0 };
  }
}

/**
 * 由 Stripe 数据 upsert 会员记录。
 *
 * 幂等：同一 user_id 只会有一条记录（memberships_user_unique 唯一索引）。
 * 被 webhook 的 checkout.session.completed / customer.subscription.* 调用。
 */
export async function upsertMembership(opts: {
  userId: string;
  plan: "free" | "founding_buyer";
  status: "active" | "canceled" | "past_due" | "expired";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const row: Record<string, unknown> = {
      user_id: opts.userId,
      plan: opts.plan,
      status: opts.status,
      updated_at: new Date().toISOString(),
    };
    // 只在有值时覆盖，避免把已有 ID 清成 null
    if (opts.stripeCustomerId) row.stripe_customer_id = opts.stripeCustomerId;
    if (opts.stripeSubscriptionId) row.stripe_subscription_id = opts.stripeSubscriptionId;
    if (opts.currentPeriodStart) row.current_period_start = opts.currentPeriodStart.toISOString();
    if (opts.currentPeriodEnd) row.current_period_end = opts.currentPeriodEnd.toISOString();

    const { error } = await db
      .from("memberships")
      .upsert(row, { onConflict: "user_id" });
    if (error) {
      console.error("[membership] upsert failed", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[membership] upsert exception", e);
    return false;
  }
}

/** 按 Stripe customer id 反查 user_id（webhook 里 subscription 事件只带 customer）。 */
export async function findUserIdByStripeCustomer(
  customerId: string
): Promise<string | null> {
  const db = createAdminClient();
  if (!db) return null;
  try {
    const { data } = await db
      .from("memberships")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data?.user_id ?? null;
  } catch {
    return null;
  }
}

// ---------- Webhook 幂等 ----------

/**
 * 标记 Stripe 事件已处理。返回 false 表示**之前已处理过**，调用方应跳过业务逻辑。
 * 这是防止 Stripe 重复投递导致重复开通/重复发信的关键。
 */
export async function markStripeEventProcessed(
  eventId: string,
  eventType: string
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { error } = await db
      .from("stripe_events")
      .insert({ id: eventId, type: eventType });
    if (error) {
      // 主键冲突 = 已处理过
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
