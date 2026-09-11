import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import {
  getMembershipRecord,
  isAdminUser,
} from "@/lib/membership";
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
  /** 免费额度已用尽（仅 free 档位可能出现） */
  quotaExceeded?: boolean;
  /** 本月已用额度。free 档位才有意义，其余为 0 */
  profilesUsed?: number;
  /** 额度用尽时的提示（已本地化）。由服务端产出，前端无需再备一份文案 */
  quotaMessage?: string;
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

  // ---- 1b. CS-05b：basic（free）层对所有人开放，paid 层仍严格服务端把关 ----
  //
  // 为什么游客也能拿到 basic 字段：
  //   Guest 的「5 家不同 supplier」额度是**客户端 localStorage 记账**（D1），
  //   服务端既不掌握、也不承担这个闸门。若服务端仍按 visitor 返回空 fields，
  //   那么第 1–5 家也拿不到值，Guest 额度就成了"什么都看不到的 5 次"。
  //
  // ★ 安全边界没有移动半分：
  //     paid intelligence（evidence / inspectionHistory / riskBreakdown /
  //     certifications）依旧由下面的 `canAccess(tier, "paid")` 与
  //     lib/queries.ts 的 redactSupplier(tier) 双重裁剪决定。
  //     清空 / 伪造 localStorage 只能多拿 4 个 basic 字段，绝拿不到付费情报。
  const effectiveTier: MembershipTier = canAccess(tier, "free") ? tier : "free";

  // ---- 2. 取已裁剪的数据 ----
  //
  // CS-05a：删除了旧的「Free Buyer 每月 5 家」额度闸门与 profile_views 记账。
  // 原因：① Free Buyer 改为 unlimited，闸门语义已废止；
  //      ② 旧记账把 slug 写进 profile_views.supplier_id(uuid) 列，实际从未成功入库，
  //         额度一直是 0/5 —— 即旧的 5 家限制从未真正生效过，删除它不削弱任何现有控制。
  let detail: Awaited<ReturnType<typeof getSupplierDetail>> = null;
  try {
    // 注意传的是 effectiveTier：游客也要能取到 basic 字段（CS-05b，见 §1b）
    detail = await getSupplierDetail(slug, contentLocale, effectiveTier);
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

  if (canAccess(effectiveTier, "free")) {
    if (detail.established) fields.established = String(detail.established);
    if (detail.employees) fields.employees = detail.employees;
    if (detail.auditStatus) fields.auditStatus = detail.auditStatus;
    if (detail.exportMarkets && detail.exportMarkets.length > 0) {
      fields.exportMarkets = detail.exportMarkets.join(", ");
    }
  }

  // ⚠️ 付费层只认 **真实 tier**（不是 effectiveTier）—— 篡改 localStorage 换不来付费情报
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

  // ---- 4. 组装响应 ----
  // CS-05a：不再记账（Free Buyer 已是 unlimited，见上方 §2 注释）。
  const profilesUsed = 0;

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

// CS-05b 说明：这里原本留着一个 buildQuotaMessage()（渲染 dict.auth.quotaReached
// 「You have used all {limit} free profiles this month.」）。已删除，原因有二：
//   ① 那句话是旧的「Free 每月 5 家」口径，CS-05a 起该额度已废止 —— 继续渲染就是无据声称；
//   ② CS-05b 的 Guest 第 6 家注册门复用 UnlockGate 既有的 freeLock* 文案（9 语齐备），
//      不需要服务端再产一份提示。

