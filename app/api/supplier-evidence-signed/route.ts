import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { resolveSupplierAccess } from "@/lib/supplierAccess";

// CS-B：供应商查看**自己**已上传证据的缩略图（私有文件，仅签 300s 短链）。
// 仅本人可获取；公开侧绝不可调用此路由（证据默认 private）。

const BUCKET = "supplier-docs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const supplierId = (sp.get("supplierId") || "").trim();
  const id = (sp.get("id") || "").trim();
  if (!supplierId || !id) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }
  const access = await resolveSupplierAccess({ claimedSupplierId: supplierId });
  if (!access.ok) return NextResponse.json({ ok: false, error: access.code }, { status: access.status ?? 403 });

  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  const { data, error } = await db
    .from("supplier_evidence")
    .select("id, supplier_id, file_path, mime_type")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (data.supplier_id !== access.identity.supplierId) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }
  if (!data.file_path) return NextResponse.json({ ok: false, error: "no_path" }, { status: 404 });

  const { data: signed, error: signErr } = await db.storage
    .from(BUCKET)
    .createSignedUrl(data.file_path, 300);
  if (signErr || !signed) {
    return NextResponse.json({ ok: false, error: "sign_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: signed.signedUrl, mime: data.mime_type });
}
