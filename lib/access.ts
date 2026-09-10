// lib/access.ts —— V2.1 权限判定单一事实源
//
// 这个文件是会员体系的"宪法"。所有权限判断都必须走这里，
// 不允许在页面/组件里散落 `if (user)` 或 `if (plan === 'founding_buyer')`。
//
// 设计要点：
//   1. 纯函数 + 常量，不 import 任何服务端专有模块 —— 服务端与客户端都可用。
//   2. 过期判定做双重校验：status 字段 + current_period_end 时间戳。
//      原因：Stripe webhook 可能延迟或失败，status 会滞后于真实状态；
//      只看 status 会让已过期用户继续白嫖，只看时间戳又会在续费瞬间误伤。
//   3. 字段裁剪是权限主力。RLS 做不到列级，所以"哪些字段能出去"由本文件决定。
//
// 安全铁律：用 service_role 查出的数据，**必须先经本文件裁剪**再返回前端，
//           否则 paid 层字段会直接泄漏到 HTML 里。

import {
  PUBLIC_FIELDS,
  FREE_FIELDS,
  PAID_FIELDS,
  GUEST_PROFILE_LIMIT,
  MEMBERSHIP_PRICE_USD,
} from "./suppliers";

// ---------- 类型 ----------

/** 用户身份档位 */
export type MembershipTier = "visitor" | "free" | "founding_buyer";

/** 内容层级（与 lib/suppliers.ts 的 AccessLayer 同义，这里复用其语义） */
export type AccessLayer = "public" | "free" | "paid";

/** 从数据库读出的会员原始状态 */
export type MembershipRecord = {
  plan: string;
  status: string;
  current_period_end: string | null;
} | null;

// ---------- 层级排序 ----------

/** 身份档位的"高度"，数值越大权限越大 */
const TIER_RANK: Record<MembershipTier, number> = {
  visitor: 0,
  free: 1,
  founding_buyer: 2,
};

/** 内容层级的"门槛高度" */
const LAYER_RANK: Record<AccessLayer, number> = {
  public: 0,
  free: 1,
  paid: 2,
};

// ---------- 核心判定 ----------

/**
 * 由数据库记录推导真实档位。
 *
 * 双重校验逻辑（本文件最重要的函数）：
 *   - plan 必须是 founding_buyer
 *   - status 必须是 active
 *   - current_period_end 为空（终身/手动开通）或晚于当前时间
 * 任一不满足 → 回落为 free，绝不抛异常。
 */
export function resolveTier(record: MembershipRecord): MembershipTier {
  if (!record) return "visitor";

  if (record.plan !== "founding_buyer") return "free";
  if (record.status !== "active") return "free";

  // 到期时间校验：webhook 延迟时 status 仍为 active，这里兜住
  if (record.current_period_end) {
    const end = Date.parse(record.current_period_end);
    if (Number.isFinite(end) && end <= Date.now()) {
      return "free"; // 已过期
    }
  }

  return "founding_buyer";
}

/** 该身份能否看到该层级的内容 */
export function canAccess(tier: MembershipTier, layer: AccessLayer): boolean {
  return TIER_RANK[tier] >= LAYER_RANK[layer];
}

/** 便捷判定（语义化，页面里读起来更清楚） */
export function isAuthenticated(tier: MembershipTier): boolean {
  return tier !== "visitor";
}

export function isFreeBuyer(tier: MembershipTier): boolean {
  return tier === "free";
}

export function isFoundingBuyer(tier: MembershipTier): boolean {
  return tier === "founding_buyer";
}

// ---------- 字段裁剪 ----------

/**
 * 各层级可见字段清单。
 * 直接复用 lib/suppliers.ts 的常量（单一事实来源，不复制一份）。
 */
export const FIELDS_BY_LAYER: Record<AccessLayer, readonly string[]> = {
  public: PUBLIC_FIELDS,
  free: FREE_FIELDS,
  paid: PAID_FIELDS,
};

/**
 * 累积可见字段：某档位能看到的所有字段（public + free + ...）。
 * 例如 founding_buyer → public + free + paid 全部。
 */
export function visibleFieldsFor(tier: MembershipTier): string[] {
  const fields: string[] = [...PUBLIC_FIELDS];
  if (canAccess(tier, "free")) fields.push(...FREE_FIELDS);
  if (canAccess(tier, "paid")) fields.push(...PAID_FIELDS);
  return Array.from(new Set(fields));
}

/**
 * 按档位裁剪供应商对象，返回新对象（不修改入参）。
 *
 * 用法：
 *   const safe = redactSupplier(row, tier);   // row 是 service_role 查出的完整行
 *
 * ★ 这是防止付费内容泄漏的最后一道闸门。
 *   任何要发给前端的供应商数据都必须过这个函数。
 */
export function redactSupplier<T extends Record<string, unknown>>(
  row: T,
  tier: MembershipTier
): Partial<T> {
  const allowed = new Set<string>(visibleFieldsFor(tier));
  // slug 与 id 永远放行：它们是路由/关联用的标识符，不是"内容"
  allowed.add("slug");
  allowed.add("id");

  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(row)) {
    if (allowed.has(k)) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

/**
 * evidence 数组按 visibility 裁剪。
 * public 档位只保留 visibility === 'public' 的证据。
 */
export function redactEvidence<E extends { visibility?: string }>(
  rows: E[],
  tier: MembershipTier
): E[] {
  if (canAccess(tier, "paid")) return rows;
  return rows.filter((e) => (e.visibility ?? "public") === "public");
}

// ---------- 迁移保险丝 ----------

/**
 * 真实建号是否可用（V2.0 → V2.1 迁移开关）。
 *
 * 判定与 lib/supabaseClient.ts 的 isSupabaseConfigured() 完全一致（都只读
 * NEXT_PUBLIC_ 的两个变量）。放在这里而不是直接 import 那边，是为了让客户端
 * 组件不必把 @supabase/ssr 打进 bundle —— 判断"能不能建号"不需要那些代码。
 *
 * 未配置 → 注册走旧的 /api/register（发邮件 + 写 Sheets，不建号），站点行为与 V2.0 一致；
 * 已配置 → 注册走 /api/auth/signup（Supabase Auth 真实建号 + 自动 free membership）。
 * 这样 M0（Supabase 三件套）没做完时，注册漏斗不会归零。
 */
export function isSignupEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

// ---------- 访问模型（CS-05a） ----------
//
// 商业模型：Supplier Discovery 免费 → 第 6 家触发注册 → Free Buyer 无限基础浏览
//          →  deeper intelligence / verification / audit / service 收费
//
//   Guest          → guest_limited：最多 GUEST_PROFILE_LIMIT 个**不同** supplier 的 basic 字段
//   Free Buyer     → unlimited：basic 字段无限（**不获得** paid intelligence）
//   Founder Buyer  → unlimited：basic + paid intelligence（本档位不由 CS-05 修改）
//
// ⚠️ Guest 的 5 家是**转化机制**而非安全边界：计数在客户端（localStorage，CS-05b 实现），
//    可被清除。真正的安全边界只有 paid 层，且永远在服务端。

/**
 * basic Supplier Profile 的访问模型。
 *   - "guest_limited"：受 GUEST_PROFILE_LIMIT 约束（游客）
 *   - "unlimited"    ：basic 字段无限（Free Buyer / Founder Buyer / admin）
 */
export type BasicAccess = "guest_limited" | "unlimited";

/** 额度归属，避免客户端把 guest 额度误读成 Free Buyer 额度 */
export type QuotaScope = "guest" | "none";

/** Guest 可浏览的不同 supplier 上限（单一事实来源在 lib/suppliers.ts） */
export function guestProfileLimit(): number {
  return GUEST_PROFILE_LIMIT;
}

/**
 * 该档位是否拥有「basic Supplier Profile 无限浏览」。
 *
 * Free Buyer 自 CS-05a 起为 unlimited（旧的「每月 5 家」已废止）。
 * 注意：unlimited 仅指 **basic** 层，绝不包含 paid intelligence。
 */
export function hasUnlimitedBasicAccess(tier: MembershipTier): boolean {
  return tier === "free" || tier === "founding_buyer";
}

/**
 * 由档位推导 basic 访问模型。admin 视同 Founder Buyer。
 */
export function basicAccessFor(tier: MembershipTier, isAdmin = false): BasicAccess {
  return isAdmin || hasUnlimitedBasicAccess(tier) ? "unlimited" : "guest_limited";
}

/**
 * Guest 是否还能再看一家**新的** supplier。
 * @param uniqueSeen 已浏览过的不同 supplier 数量（客户端按 supplier ID 去重）
 */
export function withinGuestLimit(uniqueSeen: number): boolean {
  return uniqueSeen < GUEST_PROFILE_LIMIT;
}

/** 会员价（USD，单一事实来源在 lib/suppliers.ts） */
export function membershipPriceUsd(): number {
  return MEMBERSHIP_PRICE_USD;
}

/** 生成当月额度周期的 key（当月 1 号，YYYY-MM-DD） */
export function currentPeriodMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// ---------- /api/me 的统一返回形状 ----------

export type MeResponse = {
  authenticated: boolean;
  tier: MembershipTier;

  // ---- CS-05a：访问模型（客户端判断"该显示什么"的唯一依据）----
  /** basic Supplier Profile 访问模型 */
  basicAccess: BasicAccess;
  /** 额度归属："guest" = GUEST_PROFILE_LIMIT 约束；"none" = 无额度概念 */
  quotaScope: QuotaScope;
  /** guest 才可浏览的不同 supplier 上限；非 guest 为 null */
  guestProfileLimit: number | null;

  // ---- 以下三个为兼容旧字段，语义已按 CS-05a 重定义 ----
  /**
   * 已用额度。**仅服务端记账的档位有意义**；
   * Guest 用量由客户端 localStorage 记账（CS-05b），服务端恒为 0。
   */
  profilesUsed: number;
  /** 额度上限。guest → GUEST_PROFILE_LIMIT；unlimited → null */
  profilesLimit: number | null;
  /**
   * 剩余额度。unlimited → null；
   * **guest 也返回 null** —— 服务端不掌握游客已看几家，
   * 绝不再谎报一个 `5` 让客户端误读成「Free Buyer 还剩 5 家」。
   */
  profilesRemaining: number | null;

  /** 订阅到期时间（ISO 字符串），仅付费用户有 */
  currentPeriodEnd: string | null;
  email: string | null;
  isAdmin: boolean;
};

/**
 * 构造 /api/me 的响应体。
 * 客户端 UnlockGate 完全依赖这个结构，改结构必须同步改 components/AuthProvider.tsx。
 *
 * CS-05a 语义：
 *   - Guest        → guest_limited，guestProfileLimit = 5，remaining = null（服务端不掌握）
 *   - Free Buyer   → unlimited，不再有「每月 5 家」
 *   - Founder/Admin→ unlimited（paid intelligence 由既有逻辑控制，本函数不涉及）
 *
 * ⚠️ 本函数**不参与** paid 字段授权 —— 那是 redactSupplier / canAccess 的职责，CS-05 未改。
 */
export function buildMeResponse(opts: {
  tier: MembershipTier;
  profilesUsed: number;
  currentPeriodEnd: string | null;
  email: string | null;
  isAdmin: boolean;
}): MeResponse {
  const basicAccess = basicAccessFor(opts.tier, opts.isAdmin);
  const isGuestLimited = basicAccess === "guest_limited";

  return {
    authenticated: isAuthenticated(opts.tier),
    tier: opts.tier,
    basicAccess,
    quotaScope: isGuestLimited ? "guest" : "none",
    guestProfileLimit: isGuestLimited ? GUEST_PROFILE_LIMIT : null,
    profilesUsed: isGuestLimited ? 0 : opts.profilesUsed,
    profilesLimit: isGuestLimited ? GUEST_PROFILE_LIMIT : null,
    // 恒为 null：unlimited 档位没有上限；Guest 由客户端记账、服务端不掌握。
    // **不再返回误导性的 5**（旧实现会让客户端把游客额度误读成 Free Buyer 额度）。
    profilesRemaining: null,
    currentPeriodEnd: opts.currentPeriodEnd,
    email: opts.email,
    isAdmin: opts.isAdmin,
  };
}
