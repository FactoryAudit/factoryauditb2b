import { NextResponse } from "next/server";
import {
  requireAdmin,
  getAdminSupplierReport,
  saveAdminSupplierReport,
} from "@/lib/adminData";
import { emptyReportTemplate } from "@/lib/supplierReportTemplate";
import { sanitizeReportDoc } from "@/lib/supplierReports";
import { checkRateLimit } from "@/lib/rateLimit";

// /api/admin/suppliers/[slug]/report —— CS-20 每工厂报告正文（读写）
//
// 与 /api/admin/suppliers/[slug]/{documents,certifications,audits} 同一套安全三层：
//   1. requireAdmin()：API 可被直接调用，必须自己拦（layout 拦不到 API）
//   2. 白名单净化（sanitizeReportDoc）：未知键丢弃、超长截断、分数越界直接 400
//   3. 落库唯一通道 lib/adminData.saveAdminSupplierReport（service_role）
//
// 🔴 语义铁律：
//   · `overallScore: null` = 未评分，**绝不补 0**（sanitizeReportDoc 负责守住）。
//   · 本接口不做任何自动生成：库里没有行 ⇒ 返回**空模板**（章节骨架，内容全空），
//     绝不把样张的虚构数据当作默认值下发。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

type Ctx = { params: Promise<{ slug: string }> };

/** 读报告。无行 ⇒ 下发空模板（并标记 isNew）。 */
export async function GET(_req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const { slug } = await params;

  const row = await getAdminSupplierReport(slug);
  if (row) {
    return NextResponse.json(
      {
        ok: true,
        isNew: false,
        doc: row.doc,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt,
      },
      { headers: NO_STORE }
    );
  }

  return NextResponse.json(
    { ok: true, isNew: true, doc: emptyReportTemplate(), updatedBy: null, updatedAt: null },
    { headers: NO_STORE }
  );
}

/** 保存报告（upsert by supplier_id）。 */
export async function PUT(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rl = checkRateLimit(`admin-report:${admin.userId}`, 200, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE }
    );
  }

  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const clean = sanitizeReportDoc(body);
  if (!clean.ok) {
    const status = clean.error === "too_large" ? 413 : 400;
    return NextResponse.json(
      { ok: false, error: clean.error },
      { status, headers: NO_STORE }
    );
  }

  const res = await saveAdminSupplierReport(slug, clean.doc, admin);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error },
      {
        status: res.error === "supplier_not_found" ? 404 : res.error === "not_configured" ? 503 : 500,
        headers: NO_STORE,
      }
    );
  }

  return NextResponse.json(
    { ok: true, sections: clean.doc.sections.length, status: clean.doc.status },
    { headers: NO_STORE }
  );
}
