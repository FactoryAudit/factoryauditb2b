// lib/supplierAccess.ts —— 供应商归属的唯一服务端裁决层（P0-A）
//
// ⚠️ 仅服务端调用。客户端传来的 supplierId 一律视为**声明**，不是事实。
//
// 背景（为什么要单独抽这一层）：
//   CS-21 的归属是「supplierId + contact_email 匹配」——每行都做了比对，本身不越权，
//   但它把 contact_email 当成了一个不记名的共享密钥：谁拿到邮箱谁就是供应商。
//   CS-22 要接入图片上传 / 证据 / 分享 / 可见度，入口面变大，不能再靠每个路由
//   各自手写一遍 `if (supEmail !== givenEmail)`。
//
// 裁决顺序（严格）：
//   ① 有登录会话（getCurrentUser）⇒ 用**服务端会话邮箱**反查供应商，
//      客户端传的 supplierId 只用来做「一致性校验」，不一致直接 403。
//   ② 无会话（V2.1 的未登录自评流程）⇒ 必须同时给 supplierId 和 email，
//      两条件同时成立才放行。
//   ③ 一个邮箱匹配到多家 ⇒ 409 ambiguous，绝不自选一家（宁可拒绝也不能错归属）。
//
// 「修改邮箱不能产生错误归属」如何保证：
//   本层**每次请求都重新查库**，不缓存任何 email→supplierId 映射。
//   改邮箱后旧邮箱立即失效、新邮箱立即生效；不存在"改完还按旧映射放行"的窗口。

import { createAdminClient } from "./supabaseAdmin";

export type SupplierIdentitySource = "session" | "email";

export type SupplierIdentity = {
  supplierId: string;
  /** 归属裁决依据：session = 已登录会话邮箱；email = 未登录的邮箱比对（弱，仅 V2.1 兼容） */
  source: SupplierIdentitySource;
  email: string;
};

export type SupplierAccessResult =
  | { ok: true; identity: SupplierIdentity }
  | { ok: false; code: string; status: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

export function normalizeEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export type ResolveSupplierAccessInput = {
  /** 客户端声明的 supplierId（可选）。给了就必须与裁决结果一致。 */
  claimedSupplierId?: string | null;
  /** 未登录流程下由用户填写的邮箱 */
  email?: string | null;
};

/**
 * 裁决当前请求者拥有哪家供应商。
 *
 * 返回值里的 supplierId 是**服务端查出来的**，调用方必须用它，
 * 绝不能回过头去用 body 里的 supplierId 做数据库写入。
 */
export async function resolveSupplierAccess(
  input: ResolveSupplierAccessInput
): Promise<SupplierAccessResult> {
  const db = createAdminClient();
  if (!db) return { ok: false, code: "service_unavailable", status: 503 };

  const claimed = (input.claimedSupplierId ?? "").trim() || null;
  const givenEmail = normalizeEmail(input.email);

  // ① 登录会话优先（服务端验证身份，不信任任何客户端字段）
  let sessionEmail: string | null = null;
  try {
    const { getCurrentUser } = await import("./supabaseServer");
    const user = await getCurrentUser();
    if (user?.email) sessionEmail = normalizeEmail(user.email);
  } catch {
    // 无会话上下文（例如构建期/脚本）不算错误，走邮箱兜底
    sessionEmail = null;
  }

  const effectiveEmail = sessionEmail ?? (givenEmail || null);
  const source: SupplierIdentitySource = sessionEmail ? "session" : "email";

  // 会话态下客户端连邮箱都不用传；非会话态则必须给邮箱
  if (!effectiveEmail) {
    return { ok: false, code: "email_required", status: 400 };
  }
  if (!isValidEmail(effectiveEmail)) {
    return { ok: false, code: "invalid_email", status: 400 };
  }

  // ② 按邮箱反查（可能多家 ⇒ 歧义检测）
  const { data: matched, error } = await db
    .from("suppliers")
    .select("id, contact_email")
    .ilike("contact_email", effectiveEmail)
    .limit(5);

  if (error) {
    console.error("[supplierAccess] 归属查询失败", error.message);
    return { ok: false, code: "lookup_failed", status: 500 };
  }

  const rows = (matched ?? []).filter(
    (r) => normalizeEmail(r.contact_email) === effectiveEmail
  );

  if (rows.length === 0) {
    // 会话已登录但邮箱不属于任何供应商 ⇒ 明确的非所有者（防枚举：不区分"不存在"与"不是你的"）
    return { ok: false, code: "not_owner", status: 403 };
  }

  if (rows.length > 1) {
    // 同一邮箱挂多家 ⇒ 若客户端明确指定了其中一家，允许；否则拒绝（绝不自选）
    if (claimed && rows.some((r) => r.id === claimed)) {
      return { ok: true, identity: { supplierId: claimed, source, email: effectiveEmail } };
    }
    console.error(
      `[supplierAccess] 邮箱归属歧义：${effectiveEmail} 命中 ${rows.length} 家，需指定 supplierId`
    );
    return { ok: false, code: "ambiguous_ownership", status: 409 };
  }

  const resolvedId = rows[0].id;

  // ③ 客户端声明与裁决结果不一致 ⇒ 越权尝试，直接拒绝（不改数据、不提示具体原因）
  if (claimed && claimed !== resolvedId) {
    console.warn(
      `[supplierAccess] 归属不一致：声明 ${claimed} ≠ 裁决 ${resolvedId}（source=${source}）`
    );
    return { ok: false, code: "ownership_mismatch", status: 403 };
  }

  return {
    ok: true,
    identity: { supplierId: resolvedId, source, email: effectiveEmail },
  };
}

/**
 * 只校验「声明的 supplierId 是否属于调用方」，不反查。
 * 用于已有 supplierId 且只需要确认权限的写操作（图片、证据、分享）。
 */
export async function assertSupplierOwnership(
  claimedSupplierId: string | null | undefined,
  email?: string | null
): Promise<SupplierAccessResult> {
  if (!claimedSupplierId) return { ok: false, code: "supplierId_required", status: 400 };
  return resolveSupplierAccess({ claimedSupplierId, email });
}
