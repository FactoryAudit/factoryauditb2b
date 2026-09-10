import { NextResponse } from "next/server";
import {
  requireAdmin,
  listAdminDocuments,
  insertAdminDocument,
  updateAdminDocument,
  deleteAdminDocument,
  logAdminAction,
  getAdminSupplierIdBySlug,
} from "@/lib/adminData";
import { checkRateLimit, clamp } from "@/lib/rateLimit";
import {
  MAX_DOC_BYTES,
  ALLOWED_DOC_MIME,
  isAllowedDocMime,
  isDocumentType,
  uploadDoc,
  deleteDoc,
  createSignedUrl,
  computeSha256,
} from "@/lib/storage";

// /api/admin/suppliers/[slug]/documents —— 供应商文件（验证与证据中心）
//
// 安全三层（与 /api/admin/suppliers 一致）：
//   1. requireAdmin()：API 可被直接调用，必须自己拦
//   2. 白名单 + 类型/大小/MIME 校验：不信任客户端声明
//   3. 路径由服务端拼装（lib/storage.buildObjectPath），客户端无法指定任意路径
//
// 文件本体进 Supabase 私有 bucket；本接口只回元数据 + 短时签名 URL（后台预览用）。
// 公开侧永不经过本接口。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const VISIBILITIES = new Set(["admin", "paid", "public"]);

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const { slug } = await params;
  const rows = await listAdminDocuments(slug);

  // 为后台预览附带短时签名 URL（5 分钟）。签名失败不影响列表返回。
  const withUrls = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      previewUrl: await createSignedUrl(r.file_path, 300),
    }))
  );

  return NextResponse.json({ ok: true, documents: withUrls }, { headers: NO_STORE });
}

export async function POST(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rl = checkRateLimit(`admin-doc:${admin.userId}`, 120, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE }
    );
  }

  const { slug } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const documentType = clamp(form.get("documentType"), 64) ?? "";
  if (!isDocumentType(documentType)) {
    return NextResponse.json(
      { ok: false, error: "invalid_document_type" },
      { status: 400, headers: NO_STORE }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "missing_file" },
      { status: 400, headers: NO_STORE }
    );
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

  const documentName =
    clamp(form.get("documentName"), 200) ?? clamp(file.name, 200) ?? "document";
  const programCode = clamp(form.get("programCode"), 64);
  const expiryRaw = clamp(form.get("expiryDate"), 32);
  const visibilityRaw = clamp(form.get("visibility"), 16) ?? "admin";
  const visibility = VISIBILITIES.has(visibilityRaw)
    ? (visibilityRaw as "admin" | "paid" | "public")
    : "admin";
  const notes = clamp(form.get("notes"), 1000);

  const bytes = await file.arrayBuffer();
  const sha256 = await computeSha256(bytes);

  const supplierId = await getAdminSupplierIdBySlug(slug);
  if (!supplierId) {
    return NextResponse.json(
      { ok: false, error: "supplier_not_found" },
      { status: 404, headers: NO_STORE }
    );
  }

  // uploadDoc 内部按 MIME 白名单与大小再校验一次（纵深防御）
  const up = await uploadDoc({
    supplierId,
    documentType,
    fileName: file.name || documentName,
    mime,
    bytes,
  });
  if (!up.ok) {
    return NextResponse.json(
      { ok: false, error: up.error },
      { status: up.error === "storage_not_configured" ? 503 : 500, headers: NO_STORE }
    );
  }

  const ins = await insertAdminDocument({
    slug,
    documentType,
    documentName,
    programCode,
    filePath: up.path,
    mime,
    sizeBytes: file.size,
    sha256,
    expiryDate: expiryRaw,
    visibility,
    uploadedBy: admin.userId,
    notes,
  });

  if (!ins.ok) {
    // 元数据写失败则回滚已上传的对象，避免产生孤儿文件
    await deleteDoc(up.path);
    return NextResponse.json(
      { ok: false, error: ins.error },
      { status: ins.error === "supplier_not_found" ? 404 : 500, headers: NO_STORE }
    );
  }

  await logAdminAction(admin, "doc.upload", "document", ins.id, {
    supplier: slug,
    document_type: documentType,
    document_name: documentName,
    size_bytes: file.size,
    mime,
  });

  return NextResponse.json(
    { ok: true, id: ins.id, sha256 },
    { status: 201, headers: NO_STORE }
  );
}

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  await params; // slug 仅用于路由匹配；更新按 docId 定位

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const id = clamp(body.id, 64);
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "missing_id" },
      { status: 400, headers: NO_STORE }
    );
  }

  const patch: Parameters<typeof updateAdminDocument>[1] = {};
  const statusRaw = clamp(body.verification_status, 16);
  if (statusRaw && ["PENDING", "VERIFIED", "REJECTED", "EXPIRED"].includes(statusRaw)) {
    patch.verification_status = statusRaw;
  }
  const extractionRaw = clamp(body.extraction_status, 16);
  if (
    extractionRaw &&
    ["NONE", "PROCESSING", "PENDING_REVIEW", "REVIEWED", "FAILED"].includes(extractionRaw)
  ) {
    patch.extraction_status = extractionRaw;
  }
  const visRaw = clamp(body.visibility, 16);
  if (visRaw && VISIBILITIES.has(visRaw)) {
    patch.visibility = visRaw as "admin" | "paid" | "public";
  }
  if (typeof body.expiry_date === "string") {
    patch.expiry_date = clamp(body.expiry_date, 32);
  }
  if (typeof body.document_name === "string") {
    patch.document_name = clamp(body.document_name, 200) ?? "";
  }
  if (typeof body.notes === "string") {
    patch.notes = clamp(body.notes, 1000);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: "empty_patch" },
      { status: 400, headers: NO_STORE }
    );
  }

  const ok = await updateAdminDocument(id, patch, admin.userId);
  if (ok) {
    await logAdminAction(admin, "doc.update", "document", id, {
      ...(patch as Record<string, unknown>),
    });
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: NO_STORE });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const { slug } = await params;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "missing_id" },
      { status: 400, headers: NO_STORE }
    );
  }

  const res = await deleteAdminDocument(id);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error },
      { status: res.error === "not_found" ? 404 : 500, headers: NO_STORE }
    );
  }
  await deleteDoc(res.filePath);
  await logAdminAction(admin, "doc.delete", "document", id, { supplier: slug });

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
