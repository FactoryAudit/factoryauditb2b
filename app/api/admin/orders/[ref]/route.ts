import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { setOrderStatus } from "@/lib/orders";

// PATCH /api/admin/orders/[ref] —— 订单状态流转（人工核销收款的主入口）
//
// 为什么必须走状态机而不是直接 UPDATE：
//   "paid → pending_payment" 这种反向操作会把一笔已收款的订单退回未付，
//   轻则重复催款，重则重复交付。canTransition() 在 lib/commerce.ts 里只定义一次。
//
// 待报价订单（amount_minor 为 NULL）也可以置 paid ——
//   金额是后来商定的，置为已付时代表"双方确认的金额已到账"，
//   这与"NULL ≠ 0"不冲突：NULL 是"下单时还没定价"，不是"这笔钱是 0"。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

type Params = { params: Promise<{ ref: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  const { ref } = await params;
  if (!ref || !ref.startsWith("ORD-")) {
    return NextResponse.json(
      { ok: false, error: "invalid_reference" },
      { status: 400, headers: NO_STORE }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  const next = typeof body.status === "string" ? body.status : "";

  const r = await setOrderStatus(ref, next);
  if (!r.ok) {
    const status =
      r.reason === "not_found" ? 404 : r.reason === "invalid_status" ? 400 : 409;
    return NextResponse.json(
      { ok: false, error: r.reason, message: r.message ?? null },
      { status, headers: NO_STORE }
    );
  }

  return NextResponse.json({ ok: true, status: r.status }, { headers: NO_STORE });
}
