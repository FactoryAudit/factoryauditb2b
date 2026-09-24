import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import {
  validateAndStoreFactoryPhoto,
  listFactoryPhotosForSupplier,
  deleteFactoryPhoto,
  isImageCategory,
} from "@/lib/supplierImages";

// CS-B 工厂展示图上传 / 列表 / 删除。
// 硬约束：≤12 张、≤5MB/张、≥800×600、magic bytes 校验、默认 PENDING/PRIVATE（Admin CS-C 才 APPROVED）。
// 与审核证据（supplier_evidence）是完全分离的业务对象，仅共用底层上传安全模块。

const LIMIT = 40;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_BUFFER = 6 * 1024 * 1024; // 略大于 5MB 照片上限

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const supplierId = (sp.get("supplierId") || "").trim();
  if (!supplierId) return NextResponse.json({ ok: false, error: "supplierId required" }, { status: 400 });
  const access = await resolveSupplierAccess({ claimedSupplierId: supplierId });
  if (!access.ok) return NextResponse.json({ ok: false, error: access.code }, { status: access.status ?? 403 });
  const list = await listFactoryPhotosForSupplier(access.identity.supplierId);
  return NextResponse.json({ ok: true, photos: list });
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-factory-photo:${ip}`, LIMIT, WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const form = await req.formData();
    const supplierId = String(form.get("supplierId") || "").trim();
    const category = String(form.get("category") || "").trim();
    const file = form.get("file");
    const width = Number(form.get("width") || "0") || null;
    const height = Number(form.get("height") || "0") || null;

    if (!supplierId) return NextResponse.json({ ok: false, error: "supplierId required" }, { status: 400 });
    if (!isImageCategory(category)) {
      return NextResponse.json({ ok: false, error: "invalid_category" }, { status: 400 });
    }
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });
    }

    const access = await resolveSupplierAccess({ claimedSupplierId: supplierId });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.code }, { status: access.status ?? 403 });
    }
    const realSupplierId = access.identity.supplierId;

    if (file.size > MAX_BUFFER) {
      return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();

    const result = await validateAndStoreFactoryPhoto({
      supplierId: realSupplierId,
      category,
      fileName: file.name || "photo",
      declaredMime: file.type || "application/octet-stream",
      bytes,
      width,
      height,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.code }, { status: result.status ?? 400 });
    }
    return NextResponse.json({ ok: true, photo: result.meta });
  } catch (e) {
    console.error("factory photo upload failed", e);
    return NextResponse.json({ ok: false, error: "upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = (sp.get("id") || "").trim();
  const supplierId = (sp.get("supplierId") || "").trim();
  if (!id || !supplierId) {
    return NextResponse.json({ ok: false, error: "id and supplierId required" }, { status: 400 });
  }
  const access = await resolveSupplierAccess({ claimedSupplierId: supplierId });
  if (!access.ok) return NextResponse.json({ ok: false, error: access.code }, { status: access.status ?? 403 });
  const res = await deleteFactoryPhoto(id, access.identity.supplierId);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status ?? 400 });
  return NextResponse.json({ ok: true });
}
