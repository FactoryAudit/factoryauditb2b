import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import {
  getMembershipRecord,
  isAdminUser,
  getProfileUsage,
  hasProfileView,
  recordProfileView,
} from "@/lib/membership";
import { resolveTier, canAccess, type MembershipTier } from "@/lib/access";
import { getSupplierDetail } from "@/lib/queries";
import { FREE_PROFILE_LIMIT } from "@/lib/suppliers";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";

// GET /api/suppliers/[slug]/unlocked —— 按访问者档位返回"已解锁字段"
//
// 为什么需要这个接口（V2.1 会员软锁的关键一环）：
//   /suppliers/[slug] 是 ● SSG 静态页，服务端不能读 cookie，付费内容只能由客户端按需取。
//   最初的实现把真值作为 children 传给客户端组件 UnlockGate —— 结果 React 会把真值
//   序列化进 RSC flight payload（self.__next_f.push），游客打开源码就能拿到付费内容。
//   改为：页面只下发"字段名"，真值由本接口在服务端校验档位后返回。
//
// 三条硬约束：
//   1. no-store。被 CDN 缓存 = A 用户的会员内容发给 B 用户（P0 事故）。
//   2. 档位在服务端判定，客户端传什么都不信（本接口不接收任何 tier 参数）。
//   3. 失败一律降级为空 fields，绝不抛 500，绝不给"半解锁"状态。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

export type UnlockedResponse = {
  slug: string;
  tier: MembershipTier;
  /** 可直接展示的字段值（已格式化）。缺失 = 当前档位看不到 */
  fields: Record<string, string>;
  /** evidence id → 核验状态标签（已本地化）。paid 层才有内容 */
  evidenceStatus: Record<string, string>;
  /** 免费额度已用尽（仅 free 档位可能出现） */
  quotaExceeded?: boolean;
  /** 本月已用额度。free 档位才有意义，其余为 0 */
  profilesUsed?: number;
  /** 额度用尽时的提示（已本地化）。由服务端产出，前端无需再备一份文案 */
  quotaMessage?: string;
};

const EMPTY: Omit<UnlockedResponse, "slug" | "tier"> = {
  fields: {},
  evidenceStatus: {},
  quotaExceeded: false,
  profilesUsed: 0,
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // 语言只影响状态标签的措辞，不影响权限判定
  const raw = new URL(req.url).searchParams.get("locale") ?? DEFAULT_LOCALE;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const contentLocale: "en" | "zh" | "zh-TW" =
    locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh" : "en";

  // ---- 1. 服务端判定档位 ----
  let tier: MembershipTier = "visitor";
  /** 保留 userId：免费额度计数需要它 */
  let userId: string | null = null;
  try {
    const user = await getCurrentUser();
    if (user) {
      userId = user.id;
      const [record, isAdmin] = await Promise.all([
        getMembershipRecord(user.id),
        isAdminUser(user.id),
      ]);
      tier = isAdmin ? "founding_buyer" : resolveTier(record);
    }
  } catch (e) {
    console.error("[api/suppliers/unlocked] auth lookup failed", e);
    tier = "visitor";
    userId = null;
  }

  // 游客连 free 层都没有，不必查数据（省一次查询，也少一个出错点）
  if (!canAccess(tier, "free")) {
    return NextResponse.json(
      { slug, tier, ...EMPTY },
      { headers: NO_STORE }
    );
  }

  // ---- 2. 免费额度判定（只对 free 档生效；paid / admin 不限量） ----
  //
  // 为什么放在这里：这是会员真正"看到付费/免费字段"的唯一入口，
  // 计数必须发生在**授予之前**，否则就成了"先给内容再记账"，超额拦不住。
  //
  // 失败方向：getProfileUsage 出错返回 0、hasProfileView 出错返回 true，
  // 两个都倾向于**放行** —— 数据库抖动不该把正常用户挡在门外。
  let profilesUsed = 0;
  let quotaExceeded = false;

  if (userId && tier === "free") {
    profilesUsed = await getProfileUsage(userId);
    // 只有"已到上限"时才多查一次"这家看过没"，常见路径仍是 1 次查询
    if (profilesUsed >= FREE_PROFILE_LIMIT) {
      const already = await hasProfileView(userId, slug);
      // 同一家供应商本月重复查看不重复扣额度，所以看过的可以继续看
      quotaExceeded = !already;
    }
  }

  if (quotaExceeded) {
    return NextResponse.json(
      {
        slug,
        tier,
        ...EMPTY,
        quotaExceeded: true,
        profilesUsed,
        quotaMessage: await buildQuotaMessage(locale, FREE_PROFILE_LIMIT),
      },
      { headers: NO_STORE }
    );
  }

  // ---- 3. 取已裁剪的数据 ----
  let detail: Awaited<ReturnType<typeof getSupplierDetail>> = null;
  try {
    detail = await getSupplierDetail(slug, contentLocale, tier);
  } catch (e) {
    console.error("[api/suppliers/unlocked] detail lookup failed", e);
  }
  if (!detail) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE }
    );
  }

  // ---- 4. 只返回该档位看得见的字段（裁剪已在 lib/queries.ts 做过，这里是二次确认） ----
  const fields: Record<string, string> = {};
  const evidenceStatus: Record<string, string> = {};

  if (canAccess(tier, "free")) {
    if (detail.established) fields.established = String(detail.established);
    if (detail.employees) fields.employees = detail.employees;
    if (detail.auditStatus) fields.auditStatus = detail.auditStatus;
    if (detail.exportMarkets && detail.exportMarkets.length > 0) {
      fields.exportMarkets = detail.exportMarkets.join(", ");
    }
  }

  if (canAccess(tier, "paid")) {
    if (detail.certifications && detail.certifications.length > 0) {
      fields.certifications = detail.certifications.join(", ");
    }
    if (typeof detail.inspectionHistory === "number") {
      fields.inspectionHistory = String(detail.inspectionHistory);
    }

    // 证据状态标签本地化（只有 paid 档位才拿得到 status，前面已按档位剪掉）
    try {
      const dict = await getDictionary(locale);
      const ev = dict.evidence;
      const statusLabel: Record<string, string> = {
        VERIFIED: ev.verified,
        PARTIALLY_VERIFIED: ev.partiallyVerified,
        UNVERIFIED: ev.unverified,
        EXPIRED: ev.expired,
        MISSING: ev.missing,
      };
      for (const e of detail.evidence ?? []) {
        if (e.status) evidenceStatus[e.id] = statusLabel[e.status] ?? e.status;
      }
    } catch (e) {
      console.error("[api/suppliers/unlocked] dictionary failed", e);
      // 拿不到字典就不返回状态，宁可少显示也不报错
    }
  }

  // ---- 5. 记一次额度（仅 free 档；recordProfileView 内部对 founding_buyer 直接跳过）----
  // 放在授予之后：先确保这一档确实能拿到内容，再计入用量。
  // 唯一索引保证重复查看同一家不会重复计数。
  if (userId && tier === "free") {
    const rec = await recordProfileView(userId, slug, tier);
    if (rec.used > 0) profilesUsed = rec.used;
  }

  return NextResponse.json(
    {
      slug,
      tier,
      fields,
      evidenceStatus,
      quotaExceeded: false,
      profilesUsed,
    } satisfies UnlockedResponse,
    { headers: NO_STORE }
  );
}

/**
 * 额度用尽的提示文案（服务端本地化）。
 *
 * 放在服务端而不是让前端自己备一份：本接口已经加载了字典，
 * 前端组件就不用再多收一个 props，9 语文案也只有这一处来源。
 * 拿不到字典时返回 undefined —— 宁可不提示，也不要给用户看英文占位符。
 */
async function buildQuotaMessage(
  locale: Locale,
  limit: number
): Promise<string | undefined> {
  try {
    const dict = await getDictionary(locale);
    const tpl = dict.auth?.quotaReached;
    if (!tpl) return undefined;
    return tpl.replace("{limit}", String(limit));
  } catch {
    return undefined;
  }
}
