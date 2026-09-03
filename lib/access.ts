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
  FREE_PROFILE_LIMIT,
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

// ---------- 免费额度 ----------

/** 每月免费可看的 profile 数（单一事实来源在 lib/suppliers.ts） */
export function freeProfileLimit(): number {
  return FREE_PROFILE_LIMIT;
}

/** 会员价（USD，单一事实来源在 lib/suppliers.ts） */
export function membershipPriceUsd(): number {
  return MEMBERSHIP_PRICE_USD;
}

/** 生成当月额度周期的 key（当月 1 号，YYYY-MM-DD） */
export function currentPeriodMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * 免费用户本月是否还能再看一家。
 * @param used 已用额度（去重后的 profile 数）
 */
export function hasFreeQuota(used: number, limit: number = FREE_PROFILE_LIMIT): boolean {
  return used < limit;
}

// ---------- /api/me 的统一返回形状 ----------

export type MeResponse = {
  authenticated: boolean;
  tier: MembershipTier;
  /** 免费用户本月已用额度（去重计数） */
  profilesUsed: number;
  /** 免费额度上限 */
  profilesLimit: number;
  /** 剩余额度；付费用户返回 null 表示不限 */
  profilesRemaining: number | null;
  /** 订阅到期时间（ISO 字符串），仅付费用户有 */
  currentPeriodEnd: string | null;
  email: string | null;
  isAdmin: boolean;
};

/**
 * 构造 /api/me 的响应体。
 * 客户端 UnlockGate 完全依赖这个结构，改结构必须同步改 components/AuthProvider.tsx。
 */
export function buildMeResponse(opts: {
  tier: MembershipTier;
  profilesUsed: number;
  currentPeriodEnd: string | null;
  email: string | null;
  isAdmin: boolean;
}): MeResponse {
  const unlimited = opts.tier === "founding_buyer" || opts.isAdmin;
  return {
    authenticated: isAuthenticated(opts.tier),
    tier: opts.tier,
    profilesUsed: opts.profilesUsed,
    profilesLimit: FREE_PROFILE_LIMIT,
    profilesRemaining: unlimited
      ? null
      : Math.max(0, FREE_PROFILE_LIMIT - opts.profilesUsed),
    currentPeriodEnd: opts.currentPeriodEnd,
    email: opts.email,
    isAdmin: opts.isAdmin,
  };
}
