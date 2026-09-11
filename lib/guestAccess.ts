// lib/guestAccess.ts —— Guest「5 家不同 Supplier」访问额度（CS-05b）
//
// 商业模型（用户 2026-09-10 锁定）：
//   Guest         → 最多浏览 GUEST_PROFILE_LIMIT(5) 个**不同** supplier 的 basic 档案
//   Free Buyer    → basic 档案无限（不获得 paid intelligence）
//   Founder Buyer → basic + paid intelligence
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ 性质界定（最重要的一段，改代码前先读完）：
//
//   1. 计数单位 = **supplier ID**（DB 路径是 suppliers.id，静态兜底是 StaticSupplier.id）。
//      不是 slug、不是 URL、不是 pageview、不是标签页、不是刷新次数。
//      同一家在 /en 与 /zh 下、刷新十次、开十个标签页，都只算 1 家。
//
//   2. 记账位置 = **客户端 localStorage**。服务端不掌握、也不承担这个闸门（D1）。
//      因此 localStorage **不是安全边界** —— 用户清空它就能再看 5 家，这是**预期行为**。
//
//   3. 唯一的安全边界在服务端：paid intelligence（evidence / inspectionHistory /
//      riskBreakdown / certifications）永远由 lib/access.ts 的 tier 裁剪决定，
//      与本文件里的任何计数、任何 localStorage 内容**完全无关**。
//      篡改 localStorage 最多影响「还能免费看几家 basic 字段」，绝不可能拿到付费情报。
//
//   4. 判定顺序（用户硬性要求，绝不可颠倒）：
//        ① 该 supplier 是否已访问过 → 是：直接放行，**不扣额度**
//        ② 未访问过 且 已访问数 < 5  → 记录并放行
//        ③ 未访问过 且 已访问数 >= 5 → Registration Gate（blocked）
//      **绝对禁止「先扣额度、再判断是否已访问」** —— 那会让重复访问一家就耗光 5 次。
//
//   5. 本文件为纯逻辑 + 可注入 storage，可在 node 里被回归脚本直接测试（无 window 依赖）。
// ─────────────────────────────────────────────────────────────────────────────

import { GUEST_PROFILE_LIMIT } from "./suppliers";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";

/** localStorage 键名。带版本号 —— 将来改结构时换 key 即可，不需要写迁移代码。 */
export const GUEST_ACCESS_STORAGE_KEY = "guest_supplier_access_v1";

/** 存储结构版本。解析时版本不符一律当作「空」，绝不猜测旧格式。 */
export const GUEST_ACCESS_STATE_VERSION = 1;

/** 单个 supplier id 的长度上限（防御性：防止有人塞进 1MB 字符串撑爆配额） */
const MAX_ID_LENGTH = 200;

/** 最多记录的 id 条数（防御性：防止无界增长） */
const MAX_STORED_IDS = 200;

/** sessionStorage 键：记录本次会话已经发过 guest_limit_reached 的 supplier id */
const LIMIT_EVENT_GUARD_KEY = "guest_limit_reached_v1";

/** 最小可用的 Storage 接口 —— 便于测试注入假 storage */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// ---------------------------------------------------------------------------
// 序列化
// ---------------------------------------------------------------------------

/**
 * 稳定序列化：去重 + 排序 + 固定键顺序。
 *
 * 为什么必须排序：不排序的话 `["b","a"]` 与 `["a","b"]` 会写出不同的字符串，
 * 同一份语义有两个字节表示 —— 排查问题时无法比对，也无法用哈希做校验。
 */
export function serializeGuestVisits(ids: readonly string[]): string {
  const normalized = normalizeIds(ids);
  return JSON.stringify({ v: GUEST_ACCESS_STATE_VERSION, ids: normalized });
}

/** 过滤 + 去重 + 排序，得到规范化的 id 列表 */
export function normalizeIds(ids: readonly unknown[]): string[] {
  const seen = new Set<string>();
  for (const raw of ids) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!id || id.length > MAX_ID_LENGTH) continue;
    seen.add(id);
  }
  return [...seen].sort();
}

/**
 * 宽容解析：任何异常（空值 / 坏 JSON / 版本不符 / 类型不对 / 被手改）都返回 []。
 *
 * 返回 [] 意味着「还没看过任何供应商」= 重新获得完整 5 次额度。
 * 这是**故意**的：localStorage 不是安全边界，篡改它不该让页面崩溃，
 * 也不该把用户永久锁死在门外（那才是真正的线上事故）。
 */
export function parseGuestVisits(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const obj = parsed as { v?: unknown; ids?: unknown };
  if (obj.v !== GUEST_ACCESS_STATE_VERSION) return [];
  if (!Array.isArray(obj.ids)) return [];
  return normalizeIds(obj.ids).slice(0, MAX_STORED_IDS);
}

// ---------------------------------------------------------------------------
// 读写
// ---------------------------------------------------------------------------

/** 浏览器环境取 localStorage；SSR / 隐私模式 / 被禁用时返回 null（全部 fail-open）。 */
export function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    // Safari 隐私模式下访问 localStorage 会直接抛错
    return null;
  }
}

function defaultSessionStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * 读取已访问过的 supplier id 列表。
 * @param store 不传则用浏览器 localStorage；测试可注入假 storage。
 */
export function readGuestVisits(store?: StorageLike | null): string[] {
  const s = store === undefined ? defaultStorage() : store;
  if (!s) return [];
  try {
    return parseGuestVisits(s.getItem(GUEST_ACCESS_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** 写回 id 列表（内部已完成去重排序）。写入失败静默忽略 —— 额度机制不值得让页面报错。 */
export function writeGuestVisits(ids: readonly string[], store?: StorageLike | null): void {
  const s = store === undefined ? defaultStorage() : store;
  if (!s) return;
  try {
    s.setItem(GUEST_ACCESS_STORAGE_KEY, serializeGuestVisits(ids));
  } catch {
    // 配额写不进去（无痕模式 / 存储已满）→ 这次访问不会被记住，但页面照常可用
  }
}

// ---------------------------------------------------------------------------
// 判定（check-then-consume，顺序绝不可颠倒）
// ---------------------------------------------------------------------------

export type GuestVisitStatus = "allowed" | "blocked";

export type GuestVisitReason =
  /** 之前已经看过这家 → 直接放行，不扣额度 */
  | "already_visited"
  /** 新的一家，且额度还没用完 → 已记录并放行 */
  | "recorded"
  /** 新的一家，且 5 家已经用完 → Registration Gate */
  | "limit_reached"
  /** 拿不到 supplier id（数据异常）→ 不计数、不拦截（安全边界在服务端，不该把正常页面变成注册门） */
  | "unidentified";

export type GuestVisitDecision = {
  status: GuestVisitStatus;
  reason: GuestVisitReason;
  supplierId: string;
  /** 决策**之后**已访问的不同 supplier 数量 */
  uniqueSeen: number;
  /** 本次额度上限 */
  limit: number;
  /** 本次是否消耗了额度（只有 reason === "recorded" 时为 true） */
  consumed: boolean;
};

/**
 * 记录一次 Guest 对某 supplier 的访问，并给出访问决策。
 *
 * 顺序（硬性要求）：
 *   ① 已访问过 → allowed / already_visited（**不扣额度**）
 *   ② 未访问过 且 count < limit → 写入 + allowed / recorded
 *   ③ 未访问过 且 count >= limit → blocked / limit_reached（**不写入**）
 */
export function commitGuestVisit(
  supplierId: string,
  opts: { limit?: number; store?: StorageLike | null } = {}
): GuestVisitDecision {
  const limit = opts.limit ?? GUEST_PROFILE_LIMIT;
  const id = typeof supplierId === "string" ? supplierId.trim() : "";
  const store = opts.store === undefined ? defaultStorage() : opts.store;

  if (!id || id.length > MAX_ID_LENGTH) {
    // 无法确定是哪家供应商：不计数、不拦截。
    // 安全边界在服务端（paid 字段），这里若强行拦截会把数据异常的页面变成注册门。
    return { status: "allowed", reason: "unidentified", supplierId: id, uniqueSeen: 0, limit, consumed: false };
  }

  const seen = readGuestVisits(store);

  // ① 已访问过 —— 必须在扣额度之前判断
  if (seen.includes(id)) {
    return {
      status: "allowed",
      reason: "already_visited",
      supplierId: id,
      uniqueSeen: seen.length,
      limit,
      consumed: false,
    };
  }

  // ③ 额度已用完 —— 不写入（否则会把"被拒的第六家"记进来）
  if (seen.length >= limit) {
    return {
      status: "blocked",
      reason: "limit_reached",
      supplierId: id,
      uniqueSeen: seen.length,
      limit,
      consumed: false,
    };
  }

  // ② 新的一家，还有额度 —— 记录并放行
  const next = normalizeIds([...seen, id]).slice(0, MAX_STORED_IDS);
  writeGuestVisits(next, store);
  return {
    status: "allowed",
    reason: "recorded",
    supplierId: id,
    uniqueSeen: next.length,
    limit,
    consumed: true,
  };
}

/**
 * 只看不写：用于「不做任何副作用」的预判断（调试 / 测试 / SSR）。
 */
export function peekGuestVisit(
  supplierId: string,
  opts: { limit?: number; store?: StorageLike | null } = {}
): GuestVisitDecision {
  const limit = opts.limit ?? GUEST_PROFILE_LIMIT;
  const id = typeof supplierId === "string" ? supplierId.trim() : "";
  const store = opts.store === undefined ? defaultStorage() : opts.store;
  if (!id) {
    return { status: "allowed", reason: "unidentified", supplierId: id, uniqueSeen: 0, limit, consumed: false };
  }
  const seen = readGuestVisits(store);
  if (seen.includes(id)) {
    return { status: "allowed", reason: "already_visited", supplierId: id, uniqueSeen: seen.length, limit, consumed: false };
  }
  return {
    status: seen.length >= limit ? "blocked" : "allowed",
    reason: seen.length >= limit ? "limit_reached" : "recorded",
    supplierId: id,
    uniqueSeen: seen.length,
    limit,
    consumed: false,
  };
}

// ---------------------------------------------------------------------------
// 注册回流：?next=/en/suppliers/xxx
// ---------------------------------------------------------------------------

/**
 * 只放行站内绝对路径，杜绝开放重定向（open redirect）。
 *
 * 拦截规则：
 *   - 必须以单个 "/" 开头
 *   - 拒绝 "//evil.com"（协议相对 URL）
 *   - 拒绝任何含 "://" 的绝对 URL
 *   - 拒绝含控制字符的串（响应头注入 / 日志注入）
 * 不合法一律返回 null（回落到「不跳转」），绝不做"尽力修正"。
 */
export function sanitizeReturnPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//")) return null;
  if (v.includes("://")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  if (v.length > 512) return null;
  return v;
}

// ---------------------------------------------------------------------------
// guest_limit_reached：同一次逻辑只允许发一次
// ---------------------------------------------------------------------------

/** 进程内守卫（同一 JS 会话内，React 重复渲染 / StrictMode 双跑都靠它挡住） */
const emittedThisSession = new Set<string>();

/**
 * 发送 guest_limit_reached。**同一个 supplier 只发一次**，不因 hydration /
 * 重渲染 / 刷新 / StrictMode 双跑而重复。
 *
 * 去重两层：
 *   ① 内存 Set —— 挡住同一次页面生命周期内的重复调用
 *   ② sessionStorage —— 挡住刷新（刷新会重建内存，但 sessionStorage 还在）
 *
 * @returns 本次是否真的发送了（false = 之前已经发过）
 */
export function emitGuestLimitReachedOnce(
  supplierId: string,
  opts: { store?: StorageLike | null; uniqueSeen?: number } = {}
): boolean {
  const id = typeof supplierId === "string" ? supplierId.trim() : "";
  if (!id) return false;
  if (emittedThisSession.has(id)) return false;

  const store = opts.store === undefined ? defaultSessionStorage() : opts.store;
  if (store) {
    try {
      const raw = store.getItem(LIMIT_EVENT_GUARD_KEY);
      const list: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.includes(id)) return false;
    } catch {
      // 读不到就当作没发过（宁可多发一次，也不要漏掉一次关键转化信号）
    }
  }

  emittedThisSession.add(id);
  if (store) {
    try {
      const raw = store.getItem(LIMIT_EVENT_GUARD_KEY);
      const list: unknown = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
      if (!next.includes(id)) next.push(id);
      store.setItem(LIMIT_EVENT_GUARD_KEY, JSON.stringify(next.slice(-50)));
    } catch {
      // 写不进去就只靠内存守卫
    }
  }

  trackEvent(ANALYTICS_EVENTS.guestLimitReached, {
    source: "guest_gate",
    ...(typeof opts.uniqueSeen === "number" ? { count: opts.uniqueSeen } : {}),
  });
  return true;
}

/** 仅供测试：清空进程内守卫 */
export function __resetGuestLimitEmitterForTests(): void {
  emittedThisSession.clear();
}
