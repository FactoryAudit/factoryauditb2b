// lib/audits.ts —— V2.1 审核子系统的**唯一读写层**（CS-18）
//
// ─────────────────────────────────────────────────────────────────────────────
// 纪律（与 lib/orders.ts / lib/leads.ts 一致）
// ─────────────────────────────────────────────────────────────────────────────
//   · 只走 service_role（createAdminClient）。13 张审核表对 anon/authenticated 是
//     零权限（连 SELECT 都没有），任何读取都必须经本文件 + 应用层可见性判定。
//   · 不把内部状态/PII 直接返回给前端：公共验真只暴露白名单字段（见 PublicReportView）。
//   · 缺失 = 缺失：quote_*/score 等 NULL 表示未填，绝不当 0。
//   · 撞号靠重试，不靠取消 UNIQUE。
//   · 金额/费用单位为「分」（bigint），与 orders 一致。
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabaseAdmin";
import { createHash } from "node:crypto";

// ── 状态机（指令 §47）────────────────────────────────────────────────────────
export type AuditStatus =
  | "requested"
  | "quotation_sent"
  | "pending_approval"
  | "scheduled"
  | "auditor_assigned"
  | "in_progress"
  | "findings_review"
  | "cap_required"
  | "report_draft"
  | "report_issued"
  | "closed"
  | "cancelled";

export const AUDIT_STATUS_TRANSITIONS: Record<AuditStatus, AuditStatus[]> = {
  requested: ["quotation_sent", "cancelled"],
  quotation_sent: ["pending_approval", "cancelled"],
  pending_approval: ["scheduled", "cancelled"],
  scheduled: ["auditor_assigned", "cancelled"],
  auditor_assigned: ["in_progress", "cancelled"],
  in_progress: ["findings_review", "cancelled"],
  findings_review: ["cap_required", "report_draft"],
  cap_required: ["report_draft", "findings_review"],
  report_draft: ["report_issued", "findings_review"],
  report_issued: ["closed"],
  closed: [],
  cancelled: [],
};

export function canTransitionAudit(current: string, next: string): boolean {
  if (current === next) return true;
  return (AUDIT_STATUS_TRANSITIONS as Record<string, string[]>)[current]?.includes(next) ?? false;
}

export function isAuditStatus(v: string): v is AuditStatus {
  return v in AUDIT_STATUS_TRANSITIONS;
}

// ── 可见性（指令 §41）─────────────────────────────────────────────────────────
export type ReportVisibility = "public_verification" | "buyer_only" | "supplier_only" | "admin_only";
export type ReportStatus = "draft" | "issued" | "superseded" | "revoked";
export type VerificationPublicStatus = "valid" | "invalid" | "superseded" | "revoked";

// 公共验真页只接受这一类
export function isPubliclyVerifiable(visibility: string, status: string): boolean {
  return visibility === "public_verification" && status === "issued";
}

// ── 短号生成 ──────────────────────────────────────────────────────────────────
// 字符集去掉易混淆的 0/O/1/I（与 leads / orders 一致）
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REF_LEN = 8;

function randomRef(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  return out;
}

/** 审核主记录短号：AUD-XXXXXXXX（与 report_number FAB-AUD-YYYY-XXXXXX 区分） */
export function makeAuditCode(): string {
  return `AUD-${randomRef(REF_LEN)}`;
}

/** 报告验真 ID：VFY-XXXXXXXX（对外展示用，绝不暴露 UUID） */
export function makeVerificationId(): string {
  return `VFY-${randomRef(REF_LEN)}`;
}

/** 报告号：FAB-AUD-YYYY-XXXXXX（指令 §31） */
export function makeReportNumber(year = new Date().getFullYear()): string {
  return `FAB-AUD-${year}-${randomRef(6)}`;
}

const MAX_REF_ATTEMPTS = 6;

// ── 公共验真视图（白名单字段，绝不含 PII / 内部状态）─────────────────────────────
export type PublicReportView = {
  viewable: true;
  verificationId: string;
  reportNumber: string;
  supplierName: string;
  auditType: string;
  product: string | null;
  productCategory: string | null;
  standardProtocol: string | null;
  status: ReportStatus;
  version: number;
  issuedAt: string | null;
  sha256: string | null;
  publicStatus: VerificationPublicStatus;
  siteUrl: string;
};

export type ReportLookupResult =
  | { viewable: true; view: PublicReportView }
  | { viewable: false; reason: "not_found" | "not_issued" | "visibility_restricted" | "revoked" };

/**
 * 按验真 ID 读取报告，并施加可见性闸门 + 撤销判定。
 *
 * 这是公共验真页与 /api/verify/report 的唯一数据入口。任何不可公开的内容
 * （买家/供应商内部字段、发现项、证据、费用）一律不返回。
 */
export async function getReportByVerificationId(rawId: string): Promise<ReportLookupResult> {
  const id = String(rawId || "").trim();
  if (!id) return { viewable: false, reason: "not_found" };

  const db = createAdminClient();
  if (!db) return { viewable: false, reason: "not_found" };

  const { data: report, error } = await db
    .from("audit_reports")
    .select("*")
    .eq("verification_id", id)
    .maybeSingle();
  if (error || !report) return { viewable: false, reason: "not_found" };

  const r = report as Record<string, unknown>;
  const visibility = String(r.visibility ?? "");
  const status = String(r.status ?? "");

  // 撤销 / 作废的报告，无论可见性如何都不公开
  if (status === "revoked" || status === "superseded") {
    return { viewable: false, reason: status === "revoked" ? "revoked" : "not_issued" };
  }
  if (!isPubliclyVerifiable(visibility, status)) {
    return { viewable: false, reason: status !== "issued" ? "not_issued" : "visibility_restricted" };
  }

  // 验真记录（决定 valid / superseded / revoked 展示）
  const { data: vrec } = await db
    .from("report_verification_records")
    .select("*")
    .eq("verification_id", id)
    .maybeSingle();
  const publicStatus: VerificationPublicStatus = (vrec as Record<string, unknown> | null)
    ? (String((vrec as Record<string, unknown>).public_status) as VerificationPublicStatus)
    : "valid";

  // 供应商名（公开信息，供应商档案本身可索引）
  const { data: supplier } = await db
    .from("suppliers")
    .select("legal_name")
    .eq("id", String(r.supplier_id))
    .maybeSingle();
  const supplierName = supplier ? String((supplier as Record<string, unknown>).legal_name) : "";

  // 审核元信息（非 PII：审核方式 / 品类 / 标准，不含买家/费用）
  const { data: audit } = await db
    .from("audits")
    .select("audit_type, product, product_category, standard_protocol")
    .eq("id", String(r.audit_id))
    .maybeSingle();
  const a = (audit as Record<string, unknown> | null) ?? null;

  // 当前终版 SHA-256（指令 §34/§35）
  const { data: ver } = await db
    .from("audit_report_versions")
    .select("version, sha256, issued_at")
    .eq("report_id", String(r.id))
    .eq("status", "issued")
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const v = (ver as Record<string, unknown> | null) ?? null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://factoryauditb2b.com";

  return {
    viewable: true,
    view: {
      viewable: true,
      verificationId: id,
      reportNumber: String(r.report_number),
      supplierName,
      auditType: a ? String(a.audit_type ?? "") : "",
      product: a && a.product ? String(a.product) : null,
      productCategory: a && a.product_category ? String(a.product_category) : null,
      standardProtocol: a && a.standard_protocol ? String(a.standard_protocol) : null,
      status: status as ReportStatus,
      version: Number(r.current_version ?? 0),
      issuedAt: v && v.issued_at ? String(v.issued_at) : r.updated_at ? String(r.updated_at) : null,
      sha256: v && v.sha256 ? String(v.sha256) : null,
      publicStatus,
      siteUrl,
    },
  };
}

// ── SHA-256 工具（报告终版防篡改，指令 §34/§35）────────────────────────────────
/** 对规范化报告文本计算 SHA-256（十六进制）。 */
export function computeReportSha256(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** 生成规范化报告文本（用于签名/比对；顺序稳定，NULL 显式写为空串）。 */
export function canonicalReportText(input: {
  reportNumber: string;
  verificationId: string;
  supplierName: string;
  auditType: string;
  version: string | number;
  issuedAt: string;
  sections: Array<{ title: string; body: string }>;
}): string {
  const lines = [
    `report:${input.reportNumber}`,
    `verify:${input.verificationId}`,
    `supplier:${input.supplierName}`,
    `audit_type:${input.auditType}`,
    `version:${input.version}`,
    `issued_at:${input.issuedAt}`,
    ...input.sections.map((s) => `§${s.title}\n${s.body}`),
  ];
  return lines.join("\n");
}

// ── 审核请求创建（指令 §18-§21；P0 #3 入口）───────────────────────────────────
export type CreateAuditRequestInput = {
  supplierId: string;
  buyerEmail?: string | null;
  buyerCompany?: string | null;
  buyerCountry?: string | null;
  auditType?: "announced" | "semi-announced" | "unannounced";
  product?: string | null;
  productCategory?: string | null;
  standardProtocol?: string | null;
  preferredDate?: string | null;
  preferredWindow?: string | null;
  specialRequirements?: string | null;
  previousAuditAvailable?: boolean;
  documentsAvailable?: boolean;
  additionalComments?: string | null;
  locale?: string;
  sourcePath?: string | null;
  userId?: string | null;
};

export type CreateAuditRequestResult =
  | { stored: true; auditCode: string; attempts: number }
  | { stored: false; reason: "not_configured" | "invalid_supplier" | "insert_failed"; message?: string };

function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const code = (e as { code?: unknown }).code;
  if (code === "23505") return true;
  return /duplicate key value violates unique constraint/i.test(String((e as { message?: unknown }).message ?? ""));
}

/** 创建一条审核请求（status=requested）。撞号重试，绝不取消 UNIQUE。 */
export async function createAuditRequest(input: CreateAuditRequestInput): Promise<CreateAuditRequestResult> {
  const db = createAdminClient();
  if (!db) return { stored: false, reason: "not_configured" };

  // 供应商必须存在（FK 引用；不存在直接报错，不静默）
  const { data: sup } = await db.from("suppliers").select("id").eq("id", input.supplierId).maybeSingle();
  if (!sup) return { stored: false, reason: "invalid_supplier" };

  const base = {
    supplier_id: input.supplierId,
    buyer_id: input.userId ?? null,
    audit_type: input.auditType ?? "announced",
    product: input.product ?? null,
    product_category: input.productCategory ?? null,
    standard_protocol: input.standardProtocol ?? null,
    preferred_date: input.preferredDate ?? null,
    preferred_window: input.preferredWindow ?? null,
    special_requirements: input.specialRequirements ?? null,
    previous_audit_available: Boolean(input.previousAuditAvailable),
    documents_available: Boolean(input.documentsAvailable),
    additional_comments: input.additionalComments ?? null,
    created_by: input.userId ?? input.buyerEmail ?? "web",
    status: "requested" as AuditStatus,
  };

  for (let attempt = 1; attempt <= MAX_REF_ATTEMPTS; attempt++) {
    const auditCode = makeAuditCode();
    try {
      const { error } = await db.from("audits").insert({ ...base, audit_code: auditCode });
      if (!error) return { stored: true, auditCode, attempts: attempt };
      if (isUniqueViolation(error)) continue;
      console.error("[audits] insert failed", error.message);
      return { stored: false, reason: "insert_failed", message: error.message };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isUniqueViolation(e)) continue;
      console.error("[audits] insert exception", msg);
      return { stored: false, reason: "insert_failed", message: msg };
    }
  }
  return { stored: false, reason: "insert_failed", message: "audit_code collision retry exhausted" };
}
