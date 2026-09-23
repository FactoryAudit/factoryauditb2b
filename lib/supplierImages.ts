// lib/supplierImages.ts —— 工厂展示图规则与服务端强校验
//
// ⚠️ 仅服务端调用（service_role，绕过 RLS）。
//
// 产品红线（§21）：工厂展示图 与 审核证据 是两个业务对象，绝不混用：
//   · 工厂展示图 → supplier_images（可公开，需 APPROVED 才对外可见）
//   · 审核证据   → supplier_evidence（默认私有，仅 signed URL）
//
// 服务端必须**独立复检**全部限制：即便前端被绕过也不能写入违规文件。

import { createAdminClient } from "./supabaseAdmin";

/** 12 个工厂图片分类（§16） */
export const IMAGE_CATEGORIES = [
  "factory_exterior",
  "workshop",
  "production_line",
  "equipment",
  "qc_area",
  "warehouse",
  "office",
  "finished_goods",
  "packaging",
  "materials",
  "laboratory",
  "other",
] as const;
export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export function isImageCategory(v: string): v is ImageCategory {
  return (IMAGE_CATEGORIES as readonly string[]).includes(v);
}

// ---- 限制（§15 / §16 / §17 / §28） ----
export const MAX_FACTORY_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;           // 工厂展示图 5MB
export const MAX_EVIDENCE_IMAGE_BYTES = 10 * 1024 * 1024; // 审核证据图 10MB
export const MAX_PDF_BYTES = 20 * 1024 * 1024;            // PDF 20MB
export const MAX_EVIDENCE_PER_ITEM = 5;
export const MAX_TOTAL_IMAGES = 50;
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024;         // 单供应商 200MB
export const MIN_PHOTO_WIDTH = 800;
export const MIN_PHOTO_HEIGHT = 600;
export const MAX_UPLOAD_CONCURRENCY = 3;

/** 允许的展示图 MIME（SVG / GIF / TIFF / BMP 一律禁止） */
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
/** 审核证据允许的 MIME（含 PDF） */
export const ALLOWED_EVIDENCE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export function isAllowedImageMime(v: string): boolean {
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(v);
}
export function isAllowedEvidenceMime(v: string): boolean {
  return (ALLOWED_EVIDENCE_MIME as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// magic bytes 嗅探：不信任扩展名与客户端声明的 MIME
// ---------------------------------------------------------------------------

export type SniffResult =
  | { ok: true; mime: (typeof ALLOWED_EVIDENCE_MIME)[number] }
  | { ok: false; reason: string };

function startsWith(b: Uint8Array, sig: number[], offset = 0): boolean {
  for (let i = 0; i < sig.length; i += 1) {
    if (b[offset + i] !== sig[i]) return false;
  }
  return true;
}

/** 读取文件头判断真实类型。PDF / JPEG / PNG / WEBP 之外的全部拒绝。 */
export function sniffFileType(bytes: Uint8Array): SniffResult {
  if (bytes.length < 12) return { ok: false, reason: "file_too_small" };
  // PDF: %PDF
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return { ok: true, mime: "application/pdf" };
  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ok: true, mime: "image/jpeg" };
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { ok: true, mime: "image/png" };
  // WEBP: RIFF....WEBP
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return { ok: true, mime: "image/webp" };

  // 明确拒绝的常见危险/不支持类型
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return { ok: false, reason: "gif_not_allowed" };
  if (startsWith(bytes, [0x4d, 0x5a])) return { ok: false, reason: "executable_not_allowed" };
  if (startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) return { ok: false, reason: "executable_not_allowed" };
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a]))
    return { ok: false, reason: "tiff_not_allowed" };
  if (startsWith(bytes, [0x42, 0x4d])) return { ok: false, reason: "bmp_not_allowed" };
  return { ok: false, reason: "unknown_type" };
}

export type ImageValidationInput = {
  bytes: Uint8Array;
  declaredMime: string;
  category?: string;
  /** 已上传数量（服务端查库，不信任客户端传值） */
  currentCount: number;
  currentTotalBytes: number;
  width?: number | null;
  height?: number | null;
  isEvidence?: boolean;
};

export type ImageValidationResult =
  | { ok: true; mime: string }
  | { ok: false; code: string };

/** 服务端强制校验（客户端校验只是体验，绝不作为安全边界） */
export function validateImageUpload(input: ImageValidationInput): ImageValidationResult {
  const size = input.bytes.byteLength;
  if (size <= 0) return { ok: false, code: "empty_file" };

  const sniff = sniffFileType(input.bytes);
  if (!sniff.ok) return { ok: false, code: sniff.reason };

  // 真实类型与声明类型必须一致（防伪造 Content-Type）
  if (sniff.mime !== input.declaredMime) return { ok: false, code: "mime_mismatch" };

  if (input.isEvidence) {
    if (!isAllowedEvidenceMime(sniff.mime)) return { ok: false, code: "mime_not_allowed" };
    const limit =
      sniff.mime === "application/pdf" ? MAX_PDF_BYTES : MAX_EVIDENCE_IMAGE_BYTES;
    if (size > limit) return { ok: false, code: "file_too_large" };
  } else {
    if (!isAllowedImageMime(sniff.mime)) return { ok: false, code: "mime_not_allowed" };
    if (size > MAX_PHOTO_BYTES) return { ok: false, code: "file_too_large" };
    if (input.category && !isImageCategory(input.category))
      return { ok: false, code: "invalid_category" };
    if (input.currentCount >= MAX_FACTORY_PHOTOS)
      return { ok: false, code: "photo_limit_reached" };
    // 最低分辨率提醒（仅展示图；证据允许更高分辨率）
    if (
      input.width != null &&
      input.height != null &&
      (input.width < MIN_PHOTO_WIDTH || input.height < MIN_PHOTO_HEIGHT)
    )
      return { ok: false, code: "resolution_too_low" };
  }

  if (input.currentCount >= MAX_TOTAL_IMAGES)
    return { ok: false, code: "total_image_limit_reached" };
  if (input.currentTotalBytes + size > MAX_TOTAL_BYTES)
    return { ok: false, code: "storage_quota_exceeded" };

  return { ok: true, mime: sniff.mime };
}

// ---------------------------------------------------------------------------
// 配额（服务端统计，绝不信任客户端）
// ---------------------------------------------------------------------------

export type ImageQuota = { count: number; totalBytes: number };

export async function getImageQuota(supplierId: string): Promise<ImageQuota> {
  const db = createAdminClient();
  if (!db) return { count: 0, totalBytes: 0 };
  const { data, error } = await db
    .from("supplier_images")
    .select("original_size, display_size, thumbnail_size")
    .eq("supplier_id", supplierId);
  if (error) {
    console.error("[supplierImages] 配额统计失败", error.message);
    return { count: 0, totalBytes: 0 };
  }
  let totalBytes = 0;
  for (const r of data ?? []) {
    totalBytes +=
      (r.display_size ?? 0) + (r.thumbnail_size ?? 0) + (r.original_size ?? 0);
  }
  return { count: (data ?? []).length, totalBytes };
}

/** 同一供应商是否已存在相同文件（SHA-256 去重） */
export async function findDuplicateByHash(
  supplierId: string,
  hash: string
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { data, error } = await db
    .from("supplier_images")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("file_hash", hash)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

// ---------------------------------------------------------------------------
// 存储：工厂图片走独立路径段，与 supplier-docs / assessment_report 隔离
// 现有 bucket 为私有，故公开图一律经服务端代理读取（不暴露原始路径）
// ---------------------------------------------------------------------------

export const IMAGE_BUCKET = "supplier-docs";
export const IMAGE_PATH_SEGMENT = "factory_images";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 对象名不使用用户原始文件名（防中文名/路径注入/信息泄露/覆盖）。
 * 格式：{supplier_id}/factory_images/{yyyy-mm}/{uuid}.{ext}
 */
export function buildImagePath(supplierId: string, ext: string, suffix = ""): string {
  if (!UUID_RE.test(supplierId)) throw new Error("buildImagePath: supplierId 非法");
  const month = new Date().toISOString().slice(0, 7);
  const uid = crypto.randomUUID();
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5) || "bin";
  return `${supplierId}/${IMAGE_PATH_SEGMENT}/${month}/${uid}${suffix}.${safeExt}`;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 上传到私有 bucket（业务校验通过后才能调用） */
export async function uploadImageObject(params: {
  supplierId: string;
  ext: string;
  mime: string;
  bytes: ArrayBuffer;
  suffix?: string;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "storage_not_configured" };
  let path: string;
  try {
    path = buildImagePath(params.supplierId, params.ext, params.suffix ?? "");
  } catch {
    return { ok: false, error: "invalid_path" };
  }
  const { error } = await db.storage
    .from(IMAGE_BUCKET)
    .upload(path, params.bytes, { contentType: params.mime, upsert: false });
  if (error) {
    console.error("[supplierImages] 上传失败", error.message);
    return { ok: false, error: "upload_failed" };
  }
  return { ok: true, path };
}

export async function removeImageObject(path: string): Promise<boolean> {
  const db = createAdminClient();
  if (!db || !path) return false;
  try {
    const { error } = await db.storage.from(IMAGE_BUCKET).remove([path]);
    return !error;
  } catch {
    return false;
  }
}

/** 短时签名 URL：仅供后台审核预览，公开侧禁止调用 */
export async function signImageUrl(path: string, ttl = 300): Promise<string | null> {
  const db = createAdminClient();
  if (!db || !path) return null;
  try {
    const { data, error } = await db.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(path, ttl);
    return error || !data ? null : data.signedUrl;
  } catch {
    return null;
  }
}
