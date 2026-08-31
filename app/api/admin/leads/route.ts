import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * 线索审核（后台）。
 * PATCH /api/admin/leads  body: { id, status }
 *
 * Lead.status 在 SQLite 下是 String + @default("NEW")（无 enum），
 * 所以这里必须做白名单校验，否则可以写入任意值。
 */

const ALLOWED_STATUS = ["NEW", "CONTACTED", "QUALIFIED", "QUOTE_SENT", "WON", "LOST"] as const;
type LeadStatus = (typeof ALLOWED_STATUS)[number];

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    return false;
  }
  return true;
}

// 注意：Next.js 路由文件只允许导出 HTTP handler，不能导出常量，
// 所以 STATUS_OPTIONS 不能 export（会导致 build 期类型检查失败）。

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const id = String(body.id ?? "");
  const status = String(body.status ?? "") as LeadStatus;

  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }
  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json(
      { error: "invalid_status", allowed: ALLOWED_STATUS },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.lead.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const updated = await prisma.lead.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, email: true },
    });
    return NextResponse.json({ ok: true, lead: updated });
  } catch (e) {
    console.error("admin lead patch failed", e);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
