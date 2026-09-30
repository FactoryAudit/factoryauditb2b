import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import { getMembershipRecord, isAdminUser } from "@/lib/membership";
import { resolveTier, canAccess, type MembershipTier } from "@/lib/access";
import { listSupplierDirectory } from "@/lib/queries";
import { buildDirectoryItems } from "@/lib/directoryItems";
import { unlockDirectoryItems } from "@/lib/directoryWall";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import type { DirectoryEntry } from "@/components/supplier/DirectoryView";

// GET /api/suppliers/directory?locale=xx
//
// 阶段 1（2026-09-30，方案 A）：/suppliers 公开 HTML 恒为**锁定视图**
// （真实公司名已由 lib/directoryWall.ts 置空）。登录用户由本接口取回带真实名称
// 与真实档案地址的完整档，在客户端替换锁定视图。
//
// 为什么必须是"客户端来取"而不是"服务端直接渲染"：
//   /suppliers 是 ● SSG 预渲染（revalidate = 3600，构建期冻结）。服务端一旦读
//   cookie 判定登录，页面就退化成 ƒ Dynamic —— 这正是仓库记录过的
//   Cloudflare Workers Free（CPU 10ms/req）5xx 主因。
//   本模式与既有的 /api/suppliers/[slug]/unlocked 完全一致。
//
// 四条硬约束：
//   1. no-store。被 CDN 缓存 = A 用户的视图发给 B 用户（P0 事故）。
//   2. 档位在**服务端**判定，客户端传什么都不信（本接口不接收任何 tier 参数）。
//   3. 未登录一律 401 且**不下发任何数据**，绝不给"半解锁"。
//   4. 🔴 数据仍取 `listSupplierDirectory()`（= visitor 裁剪视图，只有 public 字段）。
//      "登录后可见"在这里只意味着**完整公司名 + 档案链接**，
//      **不**包含任何 paid 情报（证据明细 / 认证 / 验货历史）—— 那些永远只走
//      /api/suppliers/[slug]/unlocked，且只认真实 tier。权限边界没有移动。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

export type DirectoryApiResponse = {
  /** 已解锁的目录条目（带真实名称与档案地址） */
  items: DirectoryEntry[];
  tier: MembershipTier;
};

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("locale") ?? DEFAULT_LOCALE;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  // ---- 1. 服务端判定档位（客户端传什么都不信）----
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
    console.error("[api/suppliers/directory] auth lookup failed", e);
    tier = "visitor"; // 查询失败一律降级为最低权限
  }

  // ---- 2. 未登录 → 401，且不返回任何条目 ----
  if (!canAccess(tier, "free")) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }

  // ---- 3. 构造并解锁（失败一律 500 空响应，绝不回退到未裁剪数据）----
  try {
    const t = await getDictionary(locale);
    const all = await listSupplierDirectory(); // ⚠️ visitor 裁剪视图 —— 见文件头 §4
    const base = await buildDirectoryItems(locale, all);
    const items = unlockDirectoryItems(base, {
      loginPath: localePath(locale, "/login"),
      directoryPath: localePath(locale, "/suppliers"),
      supplierPathPrefix: localePath(locale, "/suppliers/"),
      lockedCta: t.login.form.submit,
      unlockedCta: t.suppliers.cardCta,
    });

    return NextResponse.json({ items, tier } satisfies DirectoryApiResponse, {
      headers: NO_STORE,
    });
  } catch (e) {
    console.error("[api/suppliers/directory] build failed", e);
    return NextResponse.json({ error: "unavailable" }, { status: 500, headers: NO_STORE });
  }
}
