// lib/trustProfile.ts —— Supplier Trust Profile：三态验证 + 完整度
//
// ⚠️ 仅服务端调用：内部使用 service_role（绕过 RLS）。
//    绝不可被客户端组件 import。
//
// 三态语义（严禁混用）：
//   SELF_ASSESSED    供应商自评，未核验 —— 灰色，绝不能写成 Verified
//   ONLINE_VERIFIED  平台远程核验资料与证据 —— 绿色
//   ON_SITE_VERIFIED 平台现场实地核验 —— 蓝色
// 线上验证 ≠ 现场验厂，两者完全独立、各自独立记录。
//
// 复用：verification_records / verification_items / supplier_assessments(CS-21)
//       / admin_audit_log（审计日志，不新建）

import { createAdminClient } from "./supabaseAdmin";

export type TrustStatus =
  | "NONE"
  | "SELF_ASSESSED"
  | "ONLINE_VERIFIED"
  | "ON_SITE_VERIFIED";

export type VerificationType = "ONLINE" | "ON_SITE";

/** 默认有效期 365 天 */
export const DEFAULT_VALIDITY_DAYS = 365;

/** 去掉易混淆字符 0/O/1/I */
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 对外 Verification ID：FAB2B-OV-XXXXXX / FAB2B-OS-XXXXXX */
export function makeVerificationId(type: VerificationType): string {
  const prefix = type === "ON_SITE" ? "FAB2B-OS" : "FAB2B-OV";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return `${prefix}-${out}`;
}

export type VerificationRecord = {
  id: string;
  supplier_id: string;
  verification_id: string;
  verification_type: VerificationType;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  verified_at: string;
  expires_at: string | null;
  verified_by: string | null;
  scope: unknown;
  notes: string | null;
};

export type VerificationItem = {
  id: string;
  verification_record_id: string;
  item_key: string;
  item_label: string | null;
  supplier_answer: string | null;
  evidence_count: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "NEED_MORE_INFO";
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

/** 记录是否已过期（过期不删除，保留历史） */
export function isExpired(r: Pick<VerificationRecord, "expires_at">, now = Date.now()): boolean {
  if (!r.expires_at) return false;
  const t = new Date(r.expires_at).getTime();
  return Number.isFinite(t) && t <= now;
}

/** 取当前生效的验证：ON_SITE 优先于 ONLINE；过期的不算生效 */
export function pickActiveVerification(
  records: VerificationRecord[],
  now = Date.now()
): VerificationRecord | null {
  const active = records.filter(
    (r) => r.status === "ACTIVE" && !isExpired(r, now)
  );
  if (active.length === 0) return null;
  const onSite = active.find((r) => r.verification_type === "ON_SITE");
  return onSite ?? active[0];
}

export type TrustSnapshot = {
  status: TrustStatus;
  /** 生效中的验证记录（无则 null） */
  active: VerificationRecord | null;
  /** 全部历史记录（含过期/撤销，不覆盖） */
  history: VerificationRecord[];
  /** 是否存在已提交的自评（决定 SELF_ASSESSED） */
  hasSubmittedAssessment: boolean;
};

/** 读取某供应商的验证记录（只查 verification_records，不动 suppliers） */
export async function getVerificationRecords(
  supplierId: string
): Promise<VerificationRecord[]> {
  const db = createAdminClient();
  if (!db) return [];
  const { data, error } = await db
    .from("verification_records")
    .select(
      "id, supplier_id, verification_id, verification_type, status, verified_at, expires_at, verified_by, scope, notes"
    )
    .eq("supplier_id", supplierId)
    .order("verified_at", { ascending: false });
  if (error) {
    console.error("[trustProfile] verification_records 读取失败", error.message);
    return [];
  }
  return (data ?? []) as VerificationRecord[];
}

/** 是否存在已提交的自评（CS-21 supplier_assessments） */
export async function hasSubmittedSelfAssessment(
  supplierId: string
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { data, error } = await db
    .from("supplier_assessments")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("assessment_type", "self_assessment")
    .in("status", ["submitted", "under_review", "approved", "published"])
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

/**
 * 推导三态信任状态。
 * 严格优先级：生效的 ON_SITE > 生效的 ONLINE > 已提交自评 > NONE
 * 供应商上传材料本身**绝不**产生任何 Verified 状态。
 */
export async function getTrustSnapshot(
  supplierId: string
): Promise<TrustSnapshot> {
  const [records, hasAssessment] = await Promise.all([
    getVerificationRecords(supplierId),
    hasSubmittedSelfAssessment(supplierId),
  ]);
  const active = pickActiveVerification(records);
  let status: TrustStatus = "NONE";
  if (active) {
    status = active.verification_type === "ON_SITE" ? "ON_SITE_VERIFIED" : "ONLINE_VERIFIED";
  } else if (hasAssessment) {
    status = "SELF_ASSESSED";
  }
  return { status, active, history: records, hasSubmittedAssessment: hasAssessment };
}

// ---------------------------------------------------------------------------
// 档案完整度
// ---------------------------------------------------------------------------

/** 完整度权重表（合计 100）。只统计"有值"，绝不编值。 */
const COMPLETENESS_RULES: { key: string; weight: number }[] = [
  { key: "legal_name", weight: 8 },
  { key: "display_name", weight: 4 },
  { key: "country_code", weight: 6 },
  { key: "province", weight: 4 },
  { key: "city", weight: 4 },
  { key: "address", weight: 5 },
  { key: "established", weight: 4 },
  { key: "employees", weight: 5 },
  { key: "main_products", weight: 10 },
  { key: "export_markets", weight: 6 },
  { key: "production_capacity", weight: 6 },
  { key: "factory_size", weight: 4 },
  { key: "company_description", weight: 8 },
  { key: "website", weight: 4 },
  { key: "registration_number", weight: 5 },
  { key: "company_type", weight: 3 },
  { key: "export_since", weight: 3 },
  { key: "monthly_output", weight: 4 },
  { key: "contact_email", weight: 5 },
  { key: "certifications", weight: 6 },
];

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  return true;
}

/** 计算档案完整度百分比（0–100）。无数据即 0，如实反映。 */
export function computeCompleteness(row: Record<string, unknown>): number {
  let score = 0;
  for (const rule of COMPLETENESS_RULES) {
    if (hasValue(row[rule.key])) score += rule.weight;
  }
  return Math.min(100, Math.round(score));
}

/** 是否达到可公开/可索引的及格线（避免制造大量低质量页面） */
export const INDEXABLE_MIN_COMPLETENESS = 50;

// ---------------------------------------------------------------------------
// 管理端：创建 / 撤销验证（仅 Admin 可调用，调用方须已过 requireAdmin）
// ---------------------------------------------------------------------------

export type CreateVerificationInput = {
  supplierId: string;
  type: VerificationType;
  verifiedBy: string;
  actorId?: string | null;
  scope?: string[];
  notes?: string | null;
  validityDays?: number;
  items?: { item_key: string; item_label?: string | null; supplier_answer?: string | null }[];
};

export async function createVerification(
  input: CreateVerificationInput
): Promise<{ ok: true; verificationId: string } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "db_not_configured" };

  const days = input.validityDays ?? DEFAULT_VALIDITY_DAYS;
  const verificationId = makeVerificationId(input.type);
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + days * 24 * 60 * 60 * 1000);

  const { data: rec, error } = await db
    .from("verification_records")
    .insert({
      supplier_id: input.supplierId,
      verification_id: verificationId,
      verification_type: input.type,
      status: "ACTIVE",
      verified_at: verifiedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      verified_by: input.verifiedBy,
      scope: input.scope ?? [],
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !rec) {
    console.error("[trustProfile] 创建验证失败", error?.message);
    return { ok: false, error: "insert_failed" };
  }

  if (input.items && input.items.length > 0) {
    await db.from("verification_items").insert(
      input.items.map((it) => ({
        verification_record_id: rec.id,
        item_key: it.item_key,
        item_label: it.item_label ?? null,
        supplier_answer: it.supplier_answer ?? null,
        evidence_count: 0,
        status: "PENDING",
      }))
    );
  }

  await writeAuditLog({
    actorId: input.actorId ?? null,
    actorEmail: input.verifiedBy,
    action:
      input.type === "ON_SITE"
        ? "ON_SITE_VERIFICATION_APPROVED"
        : "ONLINE_VERIFICATION_APPROVED",
    targetType: "supplier",
    targetId: input.supplierId,
    metadata: {
      verification_id: verificationId,
      verification_type: input.type,
      expires_at: expiresAt.toISOString(),
      items: input.items?.length ?? 0,
    },
  });

  return { ok: true, verificationId };
}

/** 撤销验证（保留历史记录，不删除） */
export async function revokeVerification(params: {
  recordId: string;
  actorEmail: string;
  actorId?: string | null;
  reason?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "db_not_configured" };

  const { data: rec, error: readErr } = await db
    .from("verification_records")
    .select("id, supplier_id, verification_id")
    .eq("id", params.recordId)
    .single();
  if (readErr || !rec) return { ok: false, error: "not_found" };

  const { error } = await db
    .from("verification_records")
    .update({ status: "REVOKED", updated_at: new Date().toISOString() })
    .eq("id", params.recordId);
  if (error) return { ok: false, error: "update_failed" };

  await writeAuditLog({
    actorId: params.actorId ?? null,
    actorEmail: params.actorEmail,
    action: "VERIFICATION_REVOKED",
    targetType: "supplier",
    targetId: rec.supplier_id,
    metadata: { verification_id: rec.verification_id, reason: params.reason ?? null },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 审计日志（复用现有 admin_audit_log，不新建表）
// ---------------------------------------------------------------------------

export async function writeAuditLog(entry: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  try {
    await db.from("admin_audit_log").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // 审计日志失败不得阻断主流程，但必须留痕
    console.error("[trustProfile] 审计日志写入失败", e);
  }
}

// ---------------------------------------------------------------------------
// 展示用文案（服务端判定，前端只渲染，不可自行判定）
// ---------------------------------------------------------------------------

export const TRUST_STATUS_LABEL: Record<TrustStatus, string> = {
  NONE: "Not verified",
  SELF_ASSESSED: "Self-assessed",
  ONLINE_VERIFIED: "Online verified",
  ON_SITE_VERIFIED: "On-site verified",
};

/** 徽章视觉：不只依赖颜色，必须同时带 icon + text */
export const TRUST_STATUS_BADGE: Record<
  TrustStatus,
  { icon: string; tone: "neutral" | "green" | "blue"; label: string }
> = {
  NONE: { icon: "○", tone: "neutral", label: "Not verified" },
  SELF_ASSESSED: { icon: "◐", tone: "neutral", label: "Self-assessed" },
  ONLINE_VERIFIED: { icon: "✓", tone: "green", label: "Online verified" },
  ON_SITE_VERIFIED: { icon: "✓", tone: "blue", label: "On-site verified" },
};

/** 验证方式说明（买家防误解：线上核验 ≠ 现场验厂） */
export const VERIFICATION_METHOD_TEXT: Record<VerificationType, string> = {
  ONLINE:
    "FactoryAuditB2B reviewed supplier-submitted information and supporting evidence remotely.",
  ON_SITE: "FactoryAuditB2B conducted an on-site verification visit.",
};

export const VERIFICATION_DISCLAIMER =
  "Verification reflects the scope of information and evidence reviewed by FactoryAuditB2B and does not constitute statutory certification or a guarantee of supplier performance.";
