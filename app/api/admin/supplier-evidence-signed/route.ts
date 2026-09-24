import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminData";

// CS-22 CHANGE SET C —— 后台预览供应商证据（私有文件，仅签 300s 短链）。
// 仅 Admin 可调用（requireAdmin）；可预览任意供应商的证据，用于「证据评审」。

const BUCKET = "supplier-docs";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const id = (sp.get("id") || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });

  const { data, error } = await db
    .from("supplier_evidence")
    .select("id, supplier_id, file_path, mime_type")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!data.file_path) return NextResponse.json({ ok: false, error: "no_path" }, { status: 404 });

  const { data: signed, error: signErr } = await db.storage
    .from(BUCKET)
    .createSignedUrl(data.file_path, 300);
  if (signErr || !signed) {
    return NextResponse.json({ ok: false, error: "sign_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: signed.signedUrl, mime: data.mime_type });
}
