import { NextResponse } from "next/server";
import {
  requireAdmin,
  listPendingReview,
  listExpiringCertifications,
} from "@/lib/adminData";

// /api/admin/pending-review —— 待审核队列 + 到期提醒（spec §6 / §11）
//
// 只读聚合接口：把三张表（文件/证书/审核）的 PENDING 记录与即将到期证书
// 汇到一处，供后台首页与 /admin/pending-review 页面消费。
// 不做任何状态变更（变更走各自资源的 PATCH）。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const withinDaysRaw = Number(new URL(req.url).searchParams.get("withinDays"));
  const withinDays =
    Number.isFinite(withinDaysRaw) && withinDaysRaw > 0 && withinDaysRaw <= 365
      ? Math.trunc(withinDaysRaw)
      : 60;

  const [pending, expiring] = await Promise.all([
    listPendingReview(),
    listExpiringCertifications(withinDays),
  ]);

  return NextResponse.json(
    {
      ok: true,
      pending,
      expiring,
      counts: {
        pending: pending.length,
        expiring: expiring.filter((e) => (e.daysLeft ?? 0) >= 0).length,
        expired: expiring.filter((e) => (e.daysLeft ?? 0) < 0).length,
      },
    },
    { headers: NO_STORE }
  );
}
