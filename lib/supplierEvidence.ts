// lib/supplierEvidence.ts —— CS-B 审核证据：服务端数据 + 上传安全（server-only）
//
// ⚠️ 仅服务端调用。所有写入走 createAdminClient()（service_role, BYPASSRLS）。
//
// 铁律（CS-B / P0-D）：
//   · 唯一表 = supplier_evidence（**不建** assessment_files / verification_uploads / answers）。
//   · 证据必须绑定：supplier_id + assessment_id + item_key（question_code）。
//     【supplier_evidence 已自带这三个字段，本文件不新增任何重复关联字段。】
//   · 证据默认 private（仅签名 URL 可读），绝不暴露原始路径给公开侧。
//   · 上传安全复用 supplierImages：sniffFileType(magic bytes) + validateImageUpload(MIME/size/数量)
//     + sha256Hex(去重)。不在本文件另写一套安全逻辑。
//   · 供应商**绝不可**通过证据上传获得 Verified（Verified 仅 Admin CS-C 显式批准）。

import { createAdminClient } from "./supabaseAdmin";
import {
  validateImageUpload,
  sniffFileType,
  sha256Hex,
  countEvidenceForItem,
  getImageQuota,
  MAX_EVIDENCE_PER_ITEM,
  type ImageValidationInput,
} from "./supplierImages";
import { resolveSupplierAccess } from "./supplierAccess";

/** 证据状态（CS-B §17）：上传后由 Admin 审核推进。与 supplier_evidence.status 文本一致。 */
export type EvidenceStatus =
  | "UPLOADED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "NEEDS_MORE_INFO"
  | "REJECTED";

/** 可删除状态：已批准的证据视为审核材料，默认锁定不删（CS-B §19）。 */
const DELETABLE_EVIDENCE_STATUS: EvidenceStatus[] = [
  "UPLOADED",
  "PENDING_REVIEW",
  "NEEDS_MORE_INFO",
  "REJECTED",
];

export const EVIDENCE_BUCKET = "supplier-docs";
export const EVIDENCE_PATH_SEGMENT = "evidence";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extFromMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

/** 对象名不使用用户原始文件名（防注入/信息泄露/覆盖）。
 *  路径：{supplier_id}/evidence/{yyyy-mm}/{uuid}.{ext} */
export function buildEvidencePath(supplierId: string, itemKey: string, mime: string): string {
  if (!UUID_RE.test(supplierId)) throw new Error("buildEvidencePath: supplierId 非法");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(itemKey)) throw new Error("buildEvidencePath: itemKey 非法");
  const month = new Date().toISOString().slice(0, 7);
  const uid = crypto.randomUUID();
  return `${supplierId}/${EVIDENCE_PATH_SEGMENT}/${month}/${uid}.${extFromMime(mime)}`;
}

export type EvidenceMeta = {
  id: string;
  itemKey: string;
  type: "image" | "document";
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: EvidenceStatus;
  visibility: "public" | "paid" | "private";
  createdAt: string;
  fileHash: string | null;
};

function rowToMeta(r: Record<string, any>): EvidenceMeta {
  return {
    id: r.id,
    itemKey: r.item_key ?? "",
    type: r.type === "document" ? "document" : "image",
    fileName: r.file_name ?? "",
    mimeType: r.mime_type ?? "",
    fileSize: typeof r.file_size === "number" ? r.file_size : 0,
    status: (r.status as EvidenceStatus) ?? "UPLOADED",
    visibility: (r.visibility as "public" | "paid" | "private") ?? "private",
    createdAt: r.created_at ?? "",
    fileHash: r.file_hash ?? null,
  };
}

/** 某供应商全部证据（页面初始化一次取完，避免逐项 N+1）。仅服务端、仅本人。 */
export async function listEvidenceForSupplier(supplierId: string): Promise<EvidenceMeta[]> {
  const db = createAdminClient();
  if (!db) return [];
  const { data, error } = await db
    .from("supplier_evidence")
    .select("id, item_key, type, file_name, mime_type, file_size, status, visibility, created_at, file_hash")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[supplierEvidence] list failed", error.message);
    return [];
  }
  return (data ?? []).map(rowToMeta);
}

/** 单项证据（按 item_key）。 */
export async function listEvidenceForItem(
  supplierId: string,
  itemKey: string
): Promise<EvidenceMeta[]> {
  const db = createAdminClient();
  if (!db) return [];
  const { data, error } = await db
    .from("supplier_evidence")
    .select("id, item_key, type, file_name, mime_type, file_size, status, visibility, created_at, file_hash")
    .eq("supplier_id", supplierId)
    .eq("item_key", itemKey)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map(rowToMeta);
}

/** 同一供应商是否已存在相同文件（SHA-256 去重，复用 file_hash 列）。 */
export async function findDuplicateEvidenceByHash(
  supplierId: string,
  hash: string
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { data, error } = await db
    .from("supplier_evidence")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("file_hash", hash)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

/** 写 supplier_evidence 元数据行（证据默认 private，状态 UPLOADED）。 */
export async function recordEvidence(input: {
  supplierId: string;
  assessmentId: string | null;
  itemKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  storagePath: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "service_unavailable" };
  const { data, error } = await db
    .from("supplier_evidence")
    .insert({
      supplier_id: input.supplierId,
      assessment_id: input.assessmentId ?? null,
      item_key: input.itemKey,
      type: input.mimeType === "application/pdf" ? "document" : "image",
      status: "UPLOADED",
      visibility: "private",
      source: "supplier_self_assessment",
      file_name: input.fileName.slice(0, 200),
      mime_type: input.mimeType,
      file_size: input.fileSize,
      file_hash: input.fileHash,
      file_path: input.storagePath,
      uploaded_by: input.supplierId,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[supplierEvidence] record failed", error.message);
    return { ok: false, error: "record_failed" };
  }
  return { ok: true, id: data?.id };
}

/**
 * 删除证据（ownership + 状态校验）。
 * 仅删本人证据；已 APPROVED 的证据默认锁定（避免破坏审核材料）。
 * 同时删除存储对象（失败仅告警，不阻断记录删除）。
 */
export async function deleteEvidence(
  evidenceId: string,
  supplierId: string
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "service_unavailable", status: 503 };

  const { data: row, error: selErr } = await db
    .from("supplier_evidence")
    .select("id, supplier_id, status, file_path")
    .eq("id", evidenceId)
    .maybeSingle();
  if (selErr || !row) return { ok: false, error: "not_found", status: 404 };
  if (row.supplier_id !== supplierId) return { ok: false, error: "not_owner", status: 403 };
  if (!DELETABLE_EVIDENCE_STATUS.includes(row.status as EvidenceStatus)) {
    return { ok: false, error: "locked", status: 409 };
  }

  const { error: delErr } = await db.from("supplier_evidence").delete().eq("id", evidenceId);
  if (delErr) {
    console.error("[supplierEvidence] delete failed", delErr.message);
    return { ok: false, error: "delete_failed", status: 500 };
  }

  // 清理存储对象（best-effort）
  if (row.file_path) {
    try {
      await db.storage.from(EVIDENCE_BUCKET).remove([row.file_path]);
    } catch (e) {
      console.warn("[supplierEvidence] storage cleanup skipped", e);
    }
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// 服务端全链路：校验 → 去重 → 上传 → 落库（供 API 调用，确保任何一步失败都不留孤儿）
// -----------------------------------------------------------------------------
export type StoreEvidenceInput = {
  supplierId: string;
  assessmentId: string | null;
  itemKey: string;
  fileName: string;
  declaredMime: string;
  bytes: ArrayBuffer;
};

export type StoreEvidenceResult =
  | { ok: true; meta: EvidenceMeta }
  | { ok: false; code: string; status?: number };

export async function validateAndStoreEvidence(
  input: StoreEvidenceInput
): Promise<StoreEvidenceResult> {
  const db = createAdminClient();
  if (!db) return { ok: false, code: "service_unavailable", status: 503 };

  const bytes = new Uint8Array(input.bytes);

  // 1) magic bytes 嗅探 + 声明 MIME 一致性 + 总量/单项上限（复用 supplierImages）
  const quota = await getImageQuota(input.supplierId);
  const itemCount = await countEvidenceForItem({
    supplierId: input.supplierId,
    assessmentId: input.assessmentId,
    itemKey: input.itemKey,
  });
  const vInput: ImageValidationInput = {
    bytes,
    declaredMime: input.declaredMime,
    currentCount: quota.count,
    currentTotalBytes: quota.totalBytes,
    evidenceItemCount: itemCount,
    isEvidence: true,
  };
  const v = validateImageUpload(vInput);
  if (!v.ok) return { ok: false, code: v.code, status: 400 };

  // 2) SHA-256 去重
  const hash = await sha256Hex(input.bytes);
  const dup = await findDuplicateEvidenceByHash(input.supplierId, hash);
  if (dup) return { ok: false, code: "duplicate_file", status: 409 };

  // 3) 上传到私有 bucket（独立路径段 evidence）
  let path: string;
  try {
    path = buildEvidencePath(input.supplierId, input.itemKey, v.mime);
  } catch {
    return { ok: false, code: "invalid_path", status: 400 };
  }
  const { error: upErr } = await db.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, input.bytes, { contentType: v.mime, upsert: false });
  if (upErr) {
    console.error("[supplierEvidence] upload failed", upErr.message);
    return { ok: false, code: "upload_failed", status: 500 };
  }

  // 4) 落库
  const rec = await recordEvidence({
    supplierId: input.supplierId,
    assessmentId: input.assessmentId,
    itemKey: input.itemKey,
    fileName: input.fileName,
    mimeType: v.mime,
    fileSize: bytes.byteLength,
    fileHash: hash,
    storagePath: path,
  });
  if (!rec.ok || !rec.id) {
    // 落库失败：清理已上传对象，避免孤儿文件
    try {
      await db.storage.from(EVIDENCE_BUCKET).remove([path]);
    } catch {
      /* best-effort */
    }
    return { ok: false, code: rec.error ?? "record_failed", status: 500 };
  }

  return {
    ok: true,
    meta: {
      id: rec.id,
      itemKey: input.itemKey,
      type: v.mime === "application/pdf" ? "document" : "image",
      fileName: input.fileName.slice(0, 200),
      mimeType: v.mime,
      fileSize: bytes.byteLength,
      status: "UPLOADED",
      visibility: "private",
      createdAt: new Date().toISOString(),
      fileHash: hash,
    },
  };
}
