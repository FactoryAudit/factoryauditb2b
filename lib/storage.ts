// lib/storage.ts —— Supabase Storage（私有 bucket）读写封装
//
// ⚠️⚠️ 危险区：仅在服务端调用 ⚠️⚠️
//   本模块内部使用 service_role 客户端，绕过 Storage 的 RLS。
//   绝不可被客户端组件 import —— 否则 key 会进入浏览器 bundle。
//   为防误用，admin 客户端一律用动态 import 引入（静态 import 会被打包器
//   带进同目录的客户端 chunk）。
//
// 设计约束（spec §18 数据安全）：
//   1. bucket 私有，永不生成公开 URL。对外只给元数据，文件本体走服务端代理或短时签名。
//   2. 对象路径由服务端拼装，客户端无法指定任意路径（防路径穿越）。
//   3. MIME 白名单 + 大小上限双校验，且与 supplier_documents 的 CHECK 约束一致。
//   4. 文件名经过 sanitize：去掉路径分隔符/控制字符/前导点。
//
// 对象命名：{supplier_id}/{document_type}/{yyyy-mm}/{uuid}-{safeName}

import { DOCUMENT_TYPES, type DocumentType } from "./types";

export const DOC_BUCKET = "supplier-docs";
export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10MB，与 bucket file_size_limit 一致

/** 允许上传的 MIME（与 supplier_documents.mime 的 CHECK 一致） */
export const ALLOWED_DOC_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export type AllowedDocMime = (typeof ALLOWED_DOC_MIME)[number];

export function isAllowedDocMime(mime: string): mime is AllowedDocMime {
  return (ALLOWED_DOC_MIME as readonly string[]).includes(mime);
}

export function isDocumentType(v: string): v is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(v);
}

/**
 * 文件名净化：防路径穿越与不可见字符。
 * 保留扩展名，其余非法字符替换为 '-'。
 */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "") // 控制字符
    .replace(/[^A-Za-z0-9._-]/g, "-")      // 只留安全字符
    .replace(/^\.+/, "")                    // 去掉前导点（防 ../ 与隐藏文件）
    .replace(/-+/g, "-")
    .slice(-120);                           // 截断（保留尾部以留住扩展名）
  return cleaned || "file";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 拼装对象路径。supplierId 必须是 uuid，documentType 必须在白名单内。 */
export function buildObjectPath(
  supplierId: string,
  documentType: DocumentType,
  fileName: string
): string {
  if (!UUID_RE.test(supplierId)) {
    throw new Error("buildObjectPath: supplierId 不是合法 uuid");
  }
  if (!isDocumentType(documentType)) {
    throw new Error("buildObjectPath: documentType 不在白名单内");
  }
  const month = new Date().toISOString().slice(0, 7); // yyyy-mm
  const uid = crypto.randomUUID();
  return `${supplierId}/${documentType}/${month}/${uid}-${sanitizeFileName(fileName)}`;
}

/** 计算 sha256（十六进制）。Workers 与 Node 均可用 Web Crypto。 */
export async function computeSha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * 上传到私有 bucket。
 * 注意：不做业务校验（业务校验在 route 里，先校验再调用本函数）。
 */
export async function uploadDoc(params: {
  supplierId: string;
  documentType: DocumentType;
  fileName: string;
  mime: string;
  bytes: ArrayBuffer;
}): Promise<UploadResult> {
  const { createAdminClient } = await import("./supabaseAdmin");
  const db = createAdminClient();
  if (!db) return { ok: false, error: "storage_not_configured" };

  if (!isAllowedDocMime(params.mime)) {
    return { ok: false, error: "mime_not_allowed" };
  }
  if (params.bytes.byteLength <= 0 || params.bytes.byteLength > MAX_DOC_BYTES) {
    return { ok: false, error: "size_out_of_range" };
  }

  let path: string;
  try {
    path = buildObjectPath(params.supplierId, params.documentType, params.fileName);
  } catch {
    return { ok: false, error: "invalid_path" };
  }

  const { error } = await db.storage
    .from(DOC_BUCKET)
    .upload(path, params.bytes, {
      contentType: params.mime,
      upsert: false,
    });

  if (error) {
    console.error("[storage] upload failed", error.message);
    return { ok: false, error: "upload_failed" };
  }
  return { ok: true, path };
}

/** 下载对象内容（服务端代理用）。不存在或出错返回 null。 */
export async function downloadDoc(
  path: string
): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  const { createAdminClient } = await import("./supabaseAdmin");
  const db = createAdminClient();
  if (!db) return null;
  try {
    const { data, error } = await db.storage.from(DOC_BUCKET).download(path);
    if (error || !data) return null;
    const bytes = await data.arrayBuffer();
    return { bytes, mime: data.type || "application/octet-stream" };
  } catch (e) {
    console.error("[storage] download exception", e);
    return null;
  }
}

/** 删除对象。返回是否成功（对象本就不存在也视为成功，便于清理孤儿记录）。 */
export async function deleteDoc(path: string): Promise<boolean> {
  const { createAdminClient } = await import("./supabaseAdmin");
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { error } = await db.storage.from(DOC_BUCKET).remove([path]);
    return !error;
  } catch (e) {
    console.error("[storage] delete exception", e);
    return false;
  }
}

/**
 * 生成短时签名 URL。
 * 用途：后台预览文件（服务端把签名 URL 传给前端 <img>/<a>，有效期内可用）。
 * 公开侧禁止调用 —— 公开侧只展示元数据。
 */
export async function createSignedUrl(
  path: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const { createAdminClient } = await import("./supabaseAdmin");
  const db = createAdminClient();
  if (!db) return null;
  try {
    const { data, error } = await db.storage
      .from(DOC_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data) return null;
    return data.signedUrl;
  } catch (e) {
    console.error("[storage] sign exception", e);
    return null;
  }
}

// -----------------------------------------------------------------------------
// CS-21 审核报告文件（标签②③ 平台出具的报告）
// 与供应商文档(supplier_documents)共用私有 bucket，但走独立路径段 assessment_report，
// 不污染 DOCUMENT_TYPES 白名单（避免与 supplier_documents 表 CHECK 约束语义混淆）。
// -----------------------------------------------------------------------------

/** 审核报告对象路径段（非 DOCUMENT_TYPES 白名单，独立常量） */
export const ASSESSMENT_REPORT_TYPE = "assessment_report";

/**
 * 拼装审核报告对象路径。supplierId 必须合法 uuid。
 * 路径：{supplier_id}/assessment_report/{yyyy-mm}/{uuid}-{safeName}
 */
export function buildAssessmentReportPath(supplierId: string, fileName: string): string {
  if (!UUID_RE.test(supplierId)) {
    throw new Error("buildAssessmentReportPath: supplierId 不是合法 uuid");
  }
  const month = new Date().toISOString().slice(0, 7); // yyyy-mm
  const uid = crypto.randomUUID();
  return `${supplierId}/${ASSESSMENT_REPORT_TYPE}/${month}/${uid}-${sanitizeFileName(fileName)}`;
}

/**
 * 上传审核报告到私有 bucket（中转：服务端读字节后转发 Supabase）。
 * 与 uploadDoc 同源约束：MIME 白名单 + 大小上限双校验。
 */
export async function uploadAssessmentReport(params: {
  supplierId: string;
  fileName: string;
  mime: string;
  bytes: ArrayBuffer;
}): Promise<UploadResult> {
  const { createAdminClient } = await import("./supabaseAdmin");
  const db = createAdminClient();
  if (!db) return { ok: false, error: "storage_not_configured" };

  if (!isAllowedDocMime(params.mime)) {
    return { ok: false, error: "mime_not_allowed" };
  }
  if (params.bytes.byteLength <= 0 || params.bytes.byteLength > MAX_DOC_BYTES) {
    return { ok: false, error: "size_out_of_range" };
  }

  let path: string;
  try {
    path = buildAssessmentReportPath(params.supplierId, params.fileName);
  } catch {
    return { ok: false, error: "invalid_path" };
  }

  const { error } = await db.storage
    .from(DOC_BUCKET)
    .upload(path, params.bytes, {
      contentType: params.mime,
      upsert: false,
    });

  if (error) {
    console.error("[storage] assessment report upload failed", error.message);
    return { ok: false, error: "upload_failed" };
  }
  return { ok: true, path };
}
