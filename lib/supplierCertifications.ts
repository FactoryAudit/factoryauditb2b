// lib/supplierCertifications.ts —— 供应商自助证书申报（服务端，service_role）
//
// ─────────────────────────────────────────────────────────────────────────────
// 为什么要这一层（2026-10-28）
// ─────────────────────────────────────────────────────────────────────────────
//   `supplier_certifications` 表此前是**空的**：设计完整（7 种 claim_status、6 种
//   evidence_status、evidence_doc_id 挂证据），但只有后台能写，供应商自己无法申报，
//   于是报告里"证书"这一章永远只有一个问卷勾选。
//
// 🔴 四条红线（改动前必读）：
//   1. **供应商不得写 verification_status**。初值恒为 'PENDING'，
//      只有后台核验（核发证机构登记库）后才可升 'VERIFIED'。
//      —— 否则供应商能把自己标成已核验，等于平台背书一张没人查过的证书。
//   2. claim_status 只允许 'SELF_DECLARED'（仅填信息）或 'EVIDENCE_SUBMITTED'（附了扫描件）。
//      其余取值（VERIFIED / REJECTED / EXPIRED）只属于后台。
//   3. 归属一律由 resolveSupplierAccess 裁决，绝不信任请求体里的 supplierId。
//   4. 到期日当天之前算有效；expiry_date < 今天 ⇒ 后台列表与报告都应显示 expired，
//      但**不在这里自动改库**（库里的 status 是人工判断的结果，不是时间函数）。

import { createAdminClient } from "./supabaseAdmin";

export type SupplierCertRow = {
  id: string;
  programCode: string;
  displayName: string | null;
  certificateNo: string | null;
  issuingBody: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  scope: string | null;
  claimStatus: string;
  evidenceStatus: string;
  verificationStatus: string;
  evidenceDocId: string | null;
  lastCheckedAt: string | null;
};

const MAX = {
  programCode: 64,
  displayName: 160,
  certificateNo: 120,
  issuingBody: 160,
  scope: 500,
  date: 32,
} as const;

function clamp(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

/** YYYY-MM-DD 校验；非法返回 null（绝不把乱码写进 date 列） */
function clampDate(v: unknown): string | null {
  const s = clamp(v, MAX.date);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : s;
}

export async function listOwnCertifications(supplierId: string): Promise<SupplierCertRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  const { data, error } = await db
    .from("supplier_certifications")
    .select(
      "id, program_code, display_name, certificate_no, certificate_number, issuing_body, certification_body, issue_date, expiry_date, scope, claim_status, evidence_status, verification_status, evidence_doc_id, last_checked_at"
    )
    .eq("supplier_id", supplierId)
    .order("expiry_date", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return data.map((r) => ({
    id: String(r.id),
    programCode: String(r.program_code ?? ""),
    displayName: (r.display_name as string | null) ?? null,
    certificateNo: (r.certificate_no as string | null) ?? (r.certificate_number as string | null) ?? null,
    issuingBody: (r.issuing_body as string | null) ?? (r.certification_body as string | null) ?? null,
    issueDate: (r.issue_date as string | null) ?? null,
    expiryDate: (r.expiry_date as string | null) ?? null,
    scope: (r.scope as string | null) ?? null,
    claimStatus: String(r.claim_status ?? "SELF_DECLARED"),
    evidenceStatus: String(r.evidence_status ?? "NONE"),
    verificationStatus: String(r.verification_status ?? "PENDING"),
    evidenceDocId: (r.evidence_doc_id as string | null) ?? null,
    lastCheckedAt: (r.last_checked_at as string | null) ?? null,
  }));
}

export type UpsertCertInput = {
  supplierId: string;
  /** 传入则更新该条（必须属于本供应商），否则新建 */
  id?: string | null;
  programCode: unknown;
  displayName?: unknown;
  certificateNo?: unknown;
  issuingBody?: unknown;
  issueDate?: unknown;
  expiryDate?: unknown;
  scope?: unknown;
  /** 上传扫描件后回填的 evidence 行 id */
  evidenceDocId?: unknown;
};

export async function upsertOwnCertification(
  input: UpsertCertInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "service_unavailable" };

  const programCode = clamp(input.programCode, MAX.programCode).toUpperCase();
  if (!programCode) return { ok: false, error: "program_required" };

  const certificateNo = clamp(input.certificateNo, MAX.certificateNo) || null;
  const issuingBody = clamp(input.issuingBody, MAX.issuingBody) || null;
  const issueDate = clampDate(input.issueDate);
  const expiryDate = clampDate(input.expiryDate);
  const scope = clamp(input.scope, MAX.scope) || null;
  const displayName = clamp(input.displayName, MAX.displayName) || null;
  const evidenceDocId = clamp(input.evidenceDocId, 64) || null;

  if (issueDate && expiryDate && expiryDate < issueDate) {
    return { ok: false, error: "expiry_before_issue" };
  }

  // 🔴 供应商侧只能在这两档之间选择；verification_status 恒为 PENDING
  const claimStatus = evidenceDocId ? "EVIDENCE_SUBMITTED" : "SELF_DECLARED";
  const evidenceStatus = evidenceDocId ? "SUBMITTED" : "NONE";

  const payload = {
    supplier_id: input.supplierId,
    program_code: programCode,
    display_name: displayName,
    certificate_no: certificateNo,
    issuing_body: issuingBody,
    certification_body: issuingBody, // 历史重复列，一并写，避免两列不一致
    issue_date: issueDate,
    expiry_date: expiryDate,
    scope,
    claim_status: claimStatus,
    evidence_status: evidenceStatus,
    evidence_doc_id: evidenceDocId,
    // 新建时明确落 PENDING；更新时**不动** verification_status（由后台维护）
    ...(input.id ? {} : { verification_status: "PENDING" }),
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    // 归属校验：这条记录必须属于本供应商，否则拒绝（防越权改别人的证书）
    const { data: own } = await db
      .from("supplier_certifications")
      .select("id, verification_status")
      .eq("id", input.id)
      .eq("supplier_id", input.supplierId)
      .maybeSingle();
    if (!own) return { ok: false, error: "not_found" };

    // 已核验的证书不允许供应商单方面改内容 —— 改了就等于核验结论失效，
    // 必须先由后台退回 PENDING。这里直接拒绝，避免"核完再改"绕过。
    if (String(own.verification_status) === "VERIFIED") {
      return { ok: false, error: "verified_locked" };
    }

    const { error } = await db
      .from("supplier_certifications")
      .update(payload)
      .eq("id", input.id)
      .eq("supplier_id", input.supplierId);
    if (error) {
      console.error("[supplierCertifications] update failed", error.message);
      return { ok: false, error: "save_failed" };
    }
    return { ok: true, id: input.id };
  }

  const { data, error } = await db
    .from("supplier_certifications")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("[supplierCertifications] insert failed", error?.message);
    return { ok: false, error: "save_failed" };
  }
  return { ok: true, id: String(data.id) };
}

export async function deleteOwnCertification(
  id: string,
  supplierId: string
): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "service_unavailable" };
  const { data: own } = await db
    .from("supplier_certifications")
    .select("id, verification_status")
    .eq("id", id)
    .eq("supplier_id", supplierId)
    .maybeSingle();
  if (!own) return { ok: false, error: "not_found" };
  // 已核验的证书不允许供应商删除（有核验结论的事实，不能靠删记录消失）
  if (String(own.verification_status) === "VERIFIED") return { ok: false, error: "verified_locked" };

  const { error } = await db
    .from("supplier_certifications")
    .delete()
    .eq("id", id)
    .eq("supplier_id", supplierId);
  if (error) return { ok: false, error: "delete_failed" };
  return { ok: true };
}
