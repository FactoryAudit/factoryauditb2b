// lib/visibility.ts —— 分享、浏览与可见度积分
//
// ⚠️ 仅服务端调用（service_role，绕过 RLS）。
//
// 防刷（§41）：
//   · 不记录 share 点击次数作为排名依据
//   · UNIQUE_VISIT 由 DB 唯一索引按「供应商 + 访客 hash + 日期」去重
//   · 访客标识只存 hash，不存原始 IP
//   · share_token 是随机外部标识，绝不暴露内部 UUID / 数据库 ID

import { createAdminClient } from "./supabaseAdmin";

export const SHARE_EVENT_TYPES = [
  "SHARE_CREATED",
  "PROFILE_VIEW",
  "UNIQUE_VISIT",
  "BUYER_SIGNUP",
  "REPORT_DOWNLOAD",
  "RFQ",
  "CONTACT",
] as const;
export type ShareEventType = (typeof SHARE_EVENT_TYPES)[number];

export function isShareEventType(v: string): v is ShareEventType {
  return (SHARE_EVENT_TYPES as readonly string[]).includes(v);
}

const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** 对外分享标识 sup_xxxxx —— 非内部 ID，不可反推 */
export function makeShareToken(): string {
  let out = "";
  for (let i = 0; i < 10; i += 1) {
    out += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return `sup_${out}`;
}

/** 访客 hash：原始 IP + UA 单向摘要，不落库明文 */
export async function visitorHash(ip: string, userAgent: string): Promise<string> {
  const raw = `${ip}|${userAgent}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// share_token（§33）：对外分享标识，绝不暴露内部 supplier UUID
// ---------------------------------------------------------------------------

/**
 * 取（或建）该供应商的分享 token。
 *
 * 为什么存在 supplier_share_events 而不是给 suppliers 加一列：
 *   CS-22 的地基已经定稿，本轮不为单一标识改动 suppliers 结构；
 *   SHARE_CREATED 事件本身就是"这个 token 被签发过"的事实记录。
 * token 一旦生成就不再变（买家手里的旧链接不能失效）。
 */
export async function getOrCreateShareToken(
  supplierId: string
): Promise<string | null> {
  const db = createAdminClient();
  if (!db) return null;

  const { data: existing } = await db
    .from("supplier_share_events")
    .select("share_token")
    .eq("supplier_id", supplierId)
    .eq("event_type", "SHARE_CREATED")
    .order("created_at", { ascending: true })
    .limit(1);
  if (existing && existing.length > 0 && existing[0].share_token) {
    return existing[0].share_token;
  }

  const token = makeShareToken();
  const { error } = await db.from("supplier_share_events").insert({
    supplier_id: supplierId,
    share_token: token,
    event_type: "SHARE_CREATED",
  });
  if (error) {
    // 并发下可能已被别人建好：冲突时重读一次，绝不覆盖
    if (error.code === "23505") {
      const { data: retry } = await db
        .from("supplier_share_events")
        .select("share_token")
        .eq("supplier_id", supplierId)
        .eq("event_type", "SHARE_CREATED")
        .order("created_at", { ascending: true })
        .limit(1);
      return retry && retry.length > 0 ? retry[0].share_token : null;
    }
    console.error("[visibility] share_token 创建失败", error.message);
    return null;
  }
  return token;
}

/** 反查 token → supplierId。查不到返回 null（防枚举）。 */
export async function resolveShareToken(token: string): Promise<string | null> {
  const db = createAdminClient();
  if (!db || !token) return null;
  const { data, error } = await db
    .from("supplier_share_events")
    .select("supplier_id")
    .eq("share_token", token)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].supplier_id ?? null;
}

export type RecordEventInput = {
  supplierId: string;
  eventType: ShareEventType;
  shareToken?: string | null;
  visitorHash?: string | null;
  sessionId?: string | null;
};

/**
 * 记录事件。UNIQUE_VISIT 依赖 DB 唯一索引去重，冲突即视为重复访问（返回 duplicated）。
 * 失败不抛错（统计类写入绝不能拖垮主流程）。
 */
export async function recordShareEvent(
  input: RecordEventInput
): Promise<{ ok: boolean; duplicated?: boolean }> {
  const db = createAdminClient();
  if (!db) return { ok: false };
  try {
    const { error } = await db.from("supplier_share_events").insert({
      supplier_id: input.supplierId,
      share_token: input.shareToken ?? null,
      event_type: input.eventType,
      visitor_hash: input.visitorHash ?? null,
      session_id: input.sessionId ?? null,
    });
    if (error) {
      // 23505 = unique_violation（同访客同天已计过 UNIQUE_VISIT）
      if (error.code === "23505") return { ok: true, duplicated: true };
      console.error("[visibility] 事件写入失败", error.message);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[visibility] 事件写入异常", e);
    return { ok: false };
  }
}

export type SupplierStats = {
  profileViews: number;
  uniqueVisitors: number;
  reportDownloads: number;
  buyerActions: number;
  shares: number;
};

/** 聚合统计（供应商只看到聚合数，绝不看到其他买家的个人信息） */
export async function getSupplierStats(supplierId: string): Promise<SupplierStats> {
  const db = createAdminClient();
  if (!db)
    return {
      profileViews: 0,
      uniqueVisitors: 0,
      reportDownloads: 0,
      buyerActions: 0,
      shares: 0,
    };
  const { data, error } = await db
    .from("supplier_share_events")
    .select("event_type")
    .eq("supplier_id", supplierId);
  if (error) {
    console.error("[visibility] 统计失败", error.message);
    return {
      profileViews: 0,
      uniqueVisitors: 0,
      reportDownloads: 0,
      buyerActions: 0,
      shares: 0,
    };
  }
  const counts: SupplierStats = {
    profileViews: 0,
    uniqueVisitors: 0,
    reportDownloads: 0,
    buyerActions: 0,
    shares: 0,
  };
  for (const r of data ?? []) {
    switch (r.event_type) {
      case "PROFILE_VIEW":
        counts.profileViews += 1;
        break;
      case "UNIQUE_VISIT":
        counts.uniqueVisitors += 1;
        break;
      case "REPORT_DOWNLOAD":
        counts.reportDownloads += 1;
        break;
      case "BUYER_SIGNUP":
      case "RFQ":
      case "CONTACT":
        counts.buyerActions += 1;
        break;
      case "SHARE_CREATED":
        counts.shares += 1;
        break;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// 可见度积分（§40）
// ---------------------------------------------------------------------------

export const VISIBILITY_POINTS = {
  completeProfile: 20,
  submitAssessment: 20,
  onlineVerification: 50,
  onSiteVerification: 100,
  createShare: 2,
  uniqueVisitor: 2,
  buyerSignup: 10,
  reportDownload: 10,
  buyerAction: 30,
} as const;

export type VisibilityInput = {
  completenessPercent: number | null;
  hasSubmittedAssessment: boolean;
  trustStatus: "NONE" | "SELF_ASSESSED" | "ONLINE_VERIFIED" | "ON_SITE_VERIFIED";
  stats: SupplierStats;
};

/** 计算可见度积分。缺失数据按 0 计（不是用 0 顶替缺失值，而是"未达成故不计分"）。 */
export function computeVisibilityPoints(input: VisibilityInput): number {
  let points = 0;
  if ((input.completenessPercent ?? 0) >= 80) points += VISIBILITY_POINTS.completeProfile;
  if (input.hasSubmittedAssessment) points += VISIBILITY_POINTS.submitAssessment;
  if (input.trustStatus === "ONLINE_VERIFIED") points += VISIBILITY_POINTS.onlineVerification;
  if (input.trustStatus === "ON_SITE_VERIFIED") points += VISIBILITY_POINTS.onSiteVerification;
  points += input.stats.shares * VISIBILITY_POINTS.createShare;
  points += input.stats.uniqueVisitors * VISIBILITY_POINTS.uniqueVisitor;
  points += input.stats.buyerActions * VISIBILITY_POINTS.buyerAction;
  points += input.stats.reportDownloads * VISIBILITY_POINTS.reportDownload;
  return points;
}

/** 重算并写入 supplier_visibility_scores（幂等 upsert） */
export async function recomputeVisibilityScore(
  supplierId: string,
  input: VisibilityInput
): Promise<number | null> {
  const db = createAdminClient();
  if (!db) return null;
  const points = computeVisibilityPoints(input);
  const { error } = await db.from("supplier_visibility_scores").upsert(
    {
      supplier_id: supplierId,
      points,
      profile_views: input.stats.profileViews,
      unique_visitors: input.stats.uniqueVisitors,
      report_downloads: input.stats.reportDownloads,
      buyer_actions: input.stats.buyerActions,
      shares: input.stats.shares,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id" }
  );
  if (error) {
    console.error("[visibility] 积分写入失败", error.message);
    return null;
  }
  return points;
}

export async function getVisibilityScore(
  supplierId: string
): Promise<{ points: number | null } & SupplierStats> {
  const db = createAdminClient();
  const stats = await getSupplierStats(supplierId);
  if (!db) return { points: null, ...stats };
  const { data } = await db
    .from("supplier_visibility_scores")
    .select("points")
    .eq("supplier_id", supplierId)
    .limit(1);
  // 未计算过 → null，渲染 "—"，绝不用 0 顶替
  const points = data && data.length > 0 ? data[0].points : null;
  return { points, ...stats };
}
