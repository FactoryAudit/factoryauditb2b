// app/api/verify/report/[verificationId]/route.ts —— 公共报告验真（指令 §36-§38）
//
// GET /api/verify/report/:verificationId
//   · 只读，不写任何表。
//   · 只返回白名单字段（lib/audits.getReportByVerificationId 已施加可见性闸门）。
//   · 不可公开的报告返回 404（不暴露"存在但受限"——避免枚举）。
//   · 失败不抛异常，始终返回 JSON（前端据此渲染验真卡 / 失败态）。

import { NextRequest, NextResponse } from "next/server";
import { getReportByVerificationId } from "@/lib/audits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ verificationId: string }> }
) {
  const { verificationId } = await params;
  const result = await getReportByVerificationId(verificationId);

  if (!result.viewable) {
    // 统一返回 404，避免通过差异响应枚举报告是否存在
    return NextResponse.json(
      { ok: false, viewable: false, reason: result.reason },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, viewable: true, report: result.view },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
