import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkRateLimit, clamp } from "@/lib/rateLimit";
import {
  MAX_DOC_BYTES,
  ALLOWED_DOC_MIME,
  isAllowedDocMime,
  uploadAssessmentReport,
} from "@/lib/storage";

// CS-21 admin 上传审核报告文件（标签②③ 平台出具的报告）。
//   中转上传：服务端读字节 → Supabase 私有 bucket（supplier-docs）。
//   校验：requireAdmin + 限流 + assessmentType 白名单 + supplier 存在 + MIME/大小。
// 成功后把对象路径/文件名/大小写回 supplier_assessments 行（按 supplier_id + type）。

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" } as const;
const TYPES = new Set(["self_assessment", "platform_assessment", "on_site_audit"]);

type Ctx = { params: Promise<{ supplierId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const rl = checkRateLimit(`admin-assess-report:${admin.userId}`, 60, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  const { supplierId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplierId)) {
    return NextResponse.json({ ok: false, error: "bad_supplier_id" }, { status: 400, headers: NO_STORE });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: NO_STORE });
  }

  const type = clamp(form.get("assessmentType"), 24) ?? "";
  if (!TYPES.has(type)) {
    return NextResponse.json({ ok: false, error: "bad_type" }, { status: 400, headers: NO_STORE });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400, headers: NO_STORE });
  }
  const mime = (file.type || "").toLowerCase();
  if (!isAllowedDocMime(mime)) {
    return NextResponse.json(
      { ok: false, error: "mime_not_allowed", allowed: ALLOWED_DOC_MIME },
      { status: 415, headers: NO_STORE }
    );
  }
  if (file.size <= 0 || file.size > MAX_DOC_BYTES) {
    return NextResponse.json(
      { ok: false, error: "size_out_of_range", maxBytes: MAX_DOC_BYTES },
      { status: 413, headers: NO_STORE }
    );
  }

  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  // supplier 存在校验（防写到孤儿行）
  const { data: sup } = await db
    .from("suppliers")
    .select("id")
    .eq("id", supplierId)
    .maybeSingle();
  if (!sup) {
    return NextResponse.json({ ok: false, error: "supplier_not_found" }, { status: 404, headers: NO_STORE });
  }

  const bytes = await file.arrayBuffer();
  const up = await uploadAssessmentReport({
    supplierId,
    fileName: file.name || "report",
    mime,
    bytes,
  });
  if (!up.ok) {
    return NextResponse.json(
      { ok: false, error: up.error },
      { status: up.error === "storage_not_configured" ? 503 : 500, headers: NO_STORE }
    );
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from("supplier_assessments")
    .update({
      report_file_path: up.path,
      report_file_name: clamp(file.name, 200) ?? "report",
      report_file_size: file.size,
      updated_at: now,
    })
    .eq("supplier_id", supplierId)
    .eq("assessment_type", type);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json(
    { ok: true, path: up.path, fileName: file.name, size: file.size },
    { status: 201, headers: NO_STORE }
  );
}
