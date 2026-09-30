import { NextResponse } from "next/server";
import {
  requireAdmin,
  updateAdminMembership,
  logAdminAction,
  type AdminMembershipAction,
} from "@/lib/adminData";
import { checkRateLimit, clamp } from "@/lib/rateLimit";

// PATCH /api/admin/members —— 后台手动开通 / 撤销会员（线下成交路径）
//
// 背景：
//   本项目实际成交不走在线支付（先跑询盘 + 线下成交）。在它之前
//   memberships.plan 只有支付 webhook 一条写入路径 ⇒
//   「没有支付密钥 = 没有任何办法产生一个付费会员」。
//
// 三层安全（与 /api/admin/leads 同构）：
//   1. requireAdmin() 自己拦（API 可被直接调用，不经过 admin layout）
//   2. 字段白名单：只认 userId + action，其余一律忽略
//   3. 枚举校验：action 必须落在三个动作之一 ⇒ plan / status / 到期日
//      全部由**服务端**推导。**绝不接受客户端传 plan / status / period_end**，
//      否则等于把权限判定交给前端 = 任何人都能把自己改成付费会员。
//
// 非 admin 一律 404（不暴露后台存在）。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

// ⚠️ 必须显式标注泛型，否则推断成字面量联合导致 .has(string) 报 TS2345
const ACTIONS = new Set<string>(["revoke", "grant_yearly", "grant_lifetime"]);

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // 与其它 admin 写接口同档限流（单人运营，300/h 足够；防脚本误刷）
  const rl = checkRateLimit(`admin-member:${admin.userId}`, 300, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  // 按 profiles.id 定位（内部 uuid；不用 email —— email 可重名、可变更）
  const userId = clamp(body.userId, 64);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "invalid_user" },
      { status: 400, headers: NO_STORE }
    );
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      { ok: false, error: "invalid_action" },
      { status: 400, headers: NO_STORE }
    );
  }

  const ok = await updateAdminMembership(userId, action as AdminMembershipAction);

  // 审计留痕：钱与权限的事必须可追溯。
  // 只在成功时写 —— 失败没有真实变更，写进去反而污染审计记录。
  if (ok) {
    await logAdminAction(admin, "member.update", "member", userId, { action });
  }

  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: NO_STORE });
}
