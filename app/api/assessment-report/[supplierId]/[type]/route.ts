import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createSignedUrl } from "@/lib/storage";

// CS-21 采购商下载审核报告（受控）。
//   校验：assessment 必须 published 且 report_file_path 非空 → 否则 404（防枚举/越权）。
//   返回 302 到 Supabase 私有 bucket 的短时签名 URL（1 小时有效）。不接真支付（占位阶段即可下载预览）。
//   公开侧：无任何 auth cookie，仅靠「已发布」状态放行，符合付费墙占位定位。

export const dynamic = "force-dynamic";
const TYPES = new Set(["self_assessment", "platform_assessment", "on_site_audit"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ supplierId: string; type: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { supplierId, type } = await params;
  if (!UUID_RE.test(supplierId) || !TYPES.has(type)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  const { data, error } = await db
    .from("supplier_assessments")
    .select("status, report_file_path")
    .eq("supplier_id", supplierId)
    .eq("assessment_type", type)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
  }
  // 防枚举/越权：未发布或没有文件 → 404
  if (!data || data.status !== "published" || !data.report_file_path) {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }

  const signed = await createSignedUrl(data.report_file_path, 3600);
  if (!signed) {
    return NextResponse.json({ ok: false, error: "sign_failed" }, { status: 500 });
  }
  return NextResponse.redirect(signed, 302);
}
