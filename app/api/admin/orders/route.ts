import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { listOrders } from "@/lib/orders";

// GET /api/admin/orders —— 后台订单列表
//
// 权限：requireAdmin() 在自己这里再拦一次（API 可被直接调用，不能指望 layout 拦过）。
// 数据：走 service_role（public.orders 对 authenticated 是零权限，RLS 层也拒绝）。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    // 与 admin/suppliers 一致：不暴露"这里有个后台"，直接 404
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  const search = (url.searchParams.get("search") ?? "").slice(0, 120);

  const rows = await listOrders({ status, search });
  return NextResponse.json({ ok: true, rows }, { headers: NO_STORE });
}
