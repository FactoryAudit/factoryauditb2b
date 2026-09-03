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

/**
 * 本月是否已经看过这家供应商。
 *
 * 额度判定的前提：同一家供应商在一个月内重复查看不重复扣额度
 * （profile_views 的唯一索引保证了这一点），所以判定"是否超额"时
 * 必须先排除"这家已经看过了"的情况。
 *
 * ⚠️ 出错时返回 true（当作"已看过"）。
 *    这是**放行**方向：数据库抖动不应该让一个正常用户被额度挡在门外。
 *    配合 getProfileUsage 出错返回 0，两个失败方向一致 —— 都倾向于放行。
 */
export async function hasProfileView(
  userId: string,
  supplierId: string,
  month: string = currentPeriodMonth()
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return true;
  try {
    const { data, error } = await db
      .from("profile_views")
      .select("id")
      .eq("user_id", userId)
      .eq("supplier_id", supplierId)
      .eq("period_month", month)
      .maybeSingle();
    if (error) return true;
    return Boolean(data);
  } catch {
    return true;
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

/**
 * 读该用户已绑定的 Stripe customer id。
 *
 * 用途：创建 Checkout Session 时若已有 customer，必须复用（传 customer 而不是
 * customer_email）。否则同一邮箱会在 Stripe 后台产生多个 customer 对象，
 * 导致 Billing Portal 找不到订阅、续费邮件重复发送。
 */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const db = createAdminClient();
  if (!db) return null;
  try {
    const { data } = await db
      .from("memberships")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.stripe_customer_id ?? null;
  } catch {
    return null;
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
 * 按 user id 取邮箱（供邮件通知用）。
 *
 * 为什么需要：Stripe webhook 只有 user_id，发邮件必须有地址。
 * 用 service_role 的 auth.admin 接口查；失败返回 null（邮件发不出去不阻塞开通）。
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  const db = createAdminClient();
  if (!db) return null;
  try {
    const { data } = await db.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

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

// ---------- 买家侧：我的询价单 ----------

export type MyRfqRow = {
  id: string;
  reference_id: string;
  product: string;
  quantity: string | null;
  country: string | null;
  status: string;
  created_at: string;
};

/**
 * 当前用户提交的询价单（/account/rfqs 用）。
 *
 * 只取买家该看到的 6 个字段 —— 不返回 email、user_id、内部 message，
 * 因为这是"我的订单"视图，不是 Admin 视图。
 *
 * 降级：数据库未配置 → 返回空数组，页面显示空态而不是崩。
 */
export async function listMyRfqs(userId: string, limit = 100): Promise<MyRfqRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("rfqs")
      .select("id, reference_id, product, quantity, country, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[membership] list my rfqs failed", error.message);
      return [];
    }
    return (data ?? []) as MyRfqRow[];
  } catch (e) {
    console.error("[membership] list my rfqs exception", e);
    return [];
  }
}
