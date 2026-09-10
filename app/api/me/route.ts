import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import {
  getMembershipRecord,
  isAdminUser,
} from "@/lib/membership";
import { buildMeResponse, resolveTier } from "@/lib/access";

// GET /api/me —— 当前访问者的档位与剩余额度
//
// 这是客户端 UnlockGate 的唯一数据源。设计要点：
//
// 1. 必须 no-store。
//    如果这段响应被 Cloudflare CDN 缓存，A 用户的会员状态会被发给 B 用户，
//    造成付费内容泄漏（本方案 P0 风险之一）。
//
// 2. 失败一律降级为 visitor，绝不抛 500。
//    数据库抖动时最安全的行为是"谁都不解锁"，而不是"崩溃"。
//
// 3. 不返回任何 PII 之外的敏感数据。
//    email 只在本人登录后返回（用于账号菜单展示），不进 Analytics。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  // 双保险：明确告诉 CDN 不要缓存
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      // 未登录：返回 visitor 档位（不是 401 —— 游客是正常状态，不是错误）
      return NextResponse.json(buildMeResponse({
        tier: "visitor",
        profilesUsed: 0,
        currentPeriodEnd: null,
        email: null,
        isAdmin: false,
      }), { headers: NO_STORE });
    }

    // 并行取会员记录与用量，减少一次往返
    const [record, isAdmin] = await Promise.all([
      getMembershipRecord(user.id),
      isAdminUser(user.id),
    ]);

    const tier = isAdmin ? "founding_buyer" : resolveTier(record);

    // CS-05a：Free Buyer 起 basic profile 浏览为 unlimited，不再查用量（省一次查询）。
    // 只有 founding_buyer 之外、且仍按服务端记账的档位才需要 profilesUsed —— 当前没有。
    return NextResponse.json(buildMeResponse({
      tier,
      profilesUsed: 0,
      currentPeriodEnd: record?.current_period_end ?? null,
      email: user.email ?? null,
      isAdmin,
    }), { headers: NO_STORE });
  } catch (e) {
    console.error("[api/me] failed", e);
    // 任何异常都降级为 visitor，绝不让前端拿到"部分解锁"的脏状态
    return NextResponse.json(buildMeResponse({
      tier: "visitor",
      profilesUsed: 0,
      currentPeriodEnd: null,
      email: null,
      isAdmin: false,
    }), { headers: NO_STORE });
  }
}
