import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import { getMembershipRecord, isAdminUser } from "@/lib/membership";
import { resolveTier, canAccess, type MembershipTier } from "@/lib/access";
import { getSupplierDetail } from "@/lib/queries";
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
};

const EMPTY: Omit<UnlockedResponse, "slug" | "tier"> = {
  fields: {},
  evidenceStatus: {},
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
  try {
    const user = await getCurrentUser();
    if (user) {
      const [record, isAdmin] = await Promise.all([
        getMembershipRecord(user.id),
        isAdminUser(user.id),
      ]);
      tier = isAdmin ? "founding_buyer" : resolveTier(record);
    }
  } catch (e) {
    console.error("[api/suppliers/unlocked] auth lookup failed", e);
    tier = "visitor";
  }

  // 游客连 free 层都没有，不必查数据（省一次查询，也少一个出错点）
  if (!canAccess(tier, "free")) {
    return NextResponse.json(
      { slug, tier, ...EMPTY },
      { headers: NO_STORE }
    );
  }

  // ---- 2. 取已裁剪的数据 ----
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

  // ---- 3. 只返回该档位看得见的字段（裁剪已在 lib/queries.ts 做过，这里是二次确认） ----
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

  return NextResponse.json(
    { slug, tier, fields, evidenceStatus } satisfies UnlockedResponse,
    { headers: NO_STORE }
  );
}
