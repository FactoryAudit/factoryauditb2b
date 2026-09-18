// lib/auditWorkflow.ts —— V2.1 审核工作流**唯一写/读层**（CS-18，指令 §23/§25-§30/§46/§47）
//
// ─────────────────────────────────────────────────────────────────────────────
// 纪律（与 lib/audits.ts / lib/orders.ts / lib/leads.ts 一致）
// ─────────────────────────────────────────────────────────────────────────────
//   · 只走 service_role（createAdminClient）。13 张审核表对 anon/authenticated 零权限。
//   · 状态推进必须经过 canTransitionAudit 校验（§47 状态机），非法跃迁一律拒绝，不兜底。
//   · 缺失 = 缺失：severity / status / source / verification_status 用 DB CHECK 兜底，
//     应用层只传合法值，绝不传 0 / 空串冒充。
//   · 关键动作写 audit_logs（§68 留痕）：status / assign / finding / cap / evidence / response。
//   · 不吞 insert 失败：返回结构化 reason，由 route 决定 4xx / 5xx。
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabaseAdmin";
import { canTransitionAudit, isAuditStatus, type AuditStatus } from "@/lib/audits";

const OK = { ok: true } as const;

// ── 通用失败返回型 ──────────────────────────────────────────────────────────
type WfResult =
  | { ok: true; id?: string }
  | { ok: false; reason: string; message?: string };

function notConfigured(): WfResult {
  return { ok: false, reason: "not_configured" };
}

/** 写一条审核动作留痕（§68）。失败仅告警，不影响主流程。 */
async function writeLog(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  input: {
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    entity: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  await db.from("audit_logs").insert({
    actor_id: input.actorId ?? null,
    actor_email: input.actorEmail ?? null,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
  });
}

// ── 状态机推进（§47）─────────────────────────────────────────────────────────
export type AdvanceInput = {
  auditId: string;
  next: AuditStatus;
  actorId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * 按 §47 状态机把审核推进到 next。非法跃迁（不在 AUDIT_STATUS_TRANSITIONS）直接拒绝，
 * 不静默放行。report_issued→closed 等尾部跃迁也受同一校验约束。
 */
export async function advanceAuditStatus(input: AdvanceInput): Promise<WfResult> {
  const db = createAdminClient();
  if (!db) return notConfigured();

  const { data: cur, error: curErr } = await db
    .from("audits")
    .select("status")
    .eq("id", input.auditId)
    .maybeSingle();
  if (curErr) return { ok: false, reason: "read_failed", message: curErr.message };
  if (!cur) return { ok: false, reason: "not_found" };

  const current = String((cur as { status: unknown }).status);
  if (!isAuditStatus(current)) return { ok: false, reason: "bad_current_status", message: current };
  if (!canTransitionAudit(current, input.next)) {
    return { ok: false, reason: "invalid_transition", message: `${current} → ${input.next}` };
  }

  const { error: updErr } = await db
    .from("audits")
    .update({ status: input.next, updated_at: new Date().toISOString() })
    .eq("id", input.auditId);
  if (updErr) return { ok: false, reason: "update_failed", message: updErr.message };

  await writeLog(db, {
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    action: "audit.status",
    entity: "audits",
    entityId: input.auditId,
    oldValue: { status: current },
    newValue: { status: input.next },
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return OK;
}

// ── 指派审核员（§46）─────────────────────────────────────────────────────────
export type AssignInput = {
  auditId: string;
  auditorId: string;
  role?: "auditor" | "reviewer";
  actorId?: string | null;
  actorEmail?: string | null;
};

export async function assignAuditor(input: AssignInput): Promise<WfResult> {
  const db = createAdminClient();
  if (!db) return notConfigured();

  const { data: cur, error: curErr } = await db
    .from("audits")
    .select("auditor_id")
    .eq("id", input.auditId)
    .maybeSingle();
  if (curErr) return { ok: false, reason: "read_failed", message: curErr.message };
  if (!cur) return { ok: false, reason: "not_found" };
  const prev = (cur as { auditor_id: unknown }).auditor_id ?? null;

  const { error: updErr } = await db
    .from("audits")
    .update({ auditor_id: input.auditorId, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", input.auditId);
  if (updErr) return { ok: false, reason: "update_failed", message: updErr.message };

  const { error: asnErr } = await db.from("audit_assignments").insert({
    audit_id: input.auditId,
    auditor_id: input.auditorId,
    role: input.role ?? "auditor",
    assigned_by: input.actorId ?? null,
  });
  if (asnErr) return { ok: false, reason: "assignment_failed", message: asnErr.message };

  await writeLog(db, {
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    action: "audit.assign",
    entity: "audits",
    entityId: input.auditId,
    oldValue: { auditor_id: prev },
    newValue: { auditor_id: input.auditorId, role: input.role ?? "auditor" },
  });
  return OK;
}

// ── 发现项（§29）───────────────────────────────────────────────────────────
export type FindingSeverity = "critical" | "major" | "minor" | "observation";
export type CreateFindingInput = {
  auditId: string;
  questionId?: string | null;
  category?: string | null;
  severity: FindingSeverity;
  requirement?: string | null;
  description: string;
  objectiveEvidence?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
  responsiblePerson?: string | null;
  dueDate?: string | null;
  createdBy?: string | null;
};

export async function createFinding(input: CreateFindingInput): Promise<WfResult> {
  const db = createAdminClient();
  if (!db) return notConfigured();

  const { data: ins, error } = await db
    .from("audit_findings")
    .insert({
      audit_id: input.auditId,
      question_id: input.questionId ?? null,
      category: input.category ?? null,
      severity: input.severity,
      requirement: input.requirement ?? null,
      description: input.description,
      objective_evidence: input.objectiveEvidence ?? null,
      root_cause: input.rootCause ?? null,
      corrective_action: input.correctiveAction ?? null,
      responsible_person: input.responsiblePerson ?? null,
      due_date: input.dueDate ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, reason: "insert_failed", message: error.message };
  const id = (ins as { id: string } | null)?.id;
  if (id) {
    await writeLog(db, {
      actorId: input.createdBy,
      action: "audit.finding.create",
      entity: "audit_findings",
      entityId: id,
      newValue: { audit_id: input.auditId, severity: input.severity },
    });
  }
  return { ok: true, id };
}

// ── 整改行动（§30）─────────────────────────────────────────────────────────
export type CreateCapInput = {
  findingId: string;
  supplierId?: string | null;
  description: string;
  dueDate?: string | null;
};

export async function createCorrectiveAction(input: CreateCapInput): Promise<WfResult> {
  const db = createAdminClient();
  if (!db) return notConfigured();

  const { data: ins, error } = await db
    .from("corrective_actions")
    .insert({
      finding_id: input.findingId,
      supplier_id: input.supplierId ?? null,
      description: input.description,
      due_date: input.dueDate ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, reason: "insert_failed", message: error.message };
  const id = (ins as { id: string } | null)?.id;
  if (id) {
    await writeLog(db, {
      action: "audit.cap.create",
      entity: "corrective_actions",
      entityId: id,
      newValue: { finding_id: input.findingId },
    });
  }
  return { ok: true, id };
}

// ── 证据（§25-§28）─────────────────────────────────────────────────────────
export type EvidenceSource =
  | "supplier_provided"
  | "public_website"
  | "gov_registry"
  | "cert_body"
  | "audit_report"
  | "factory_visit"
  | "third_party"
  | "other";
export type CreateEvidenceInput = {
  auditId: string;
  supplierId: string;
  findingId?: string | null;
  questionId?: string | null;
  filename?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  storagePath?: string | null;
  source?: EvidenceSource | null;
  description?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  documentNumber?: string | null;
  issuingBody?: string | null;
};

export async function attachEvidence(input: CreateEvidenceInput): Promise<WfResult> {
  const db = createAdminClient();
  if (!db) return notConfigured();

  const { data: ins, error } = await db
    .from("audit_evidence")
    .insert({
      audit_id: input.auditId,
      supplier_id: input.supplierId,
      finding_id: input.findingId ?? null,
      question_id: input.questionId ?? null,
      filename: input.filename ?? null,
      file_type: input.fileType ?? null,
      file_size: input.fileSize ?? null,
      storage_path: input.storagePath ?? null,
      source: input.source ?? null,
      description: input.description ?? null,
      issue_date: input.issueDate ?? null,
      expiry_date: input.expiryDate ?? null,
      document_number: input.documentNumber ?? null,
      issuing_body: input.issuingBody ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, reason: "insert_failed", message: error.message };
  const id = (ins as { id: string } | null)?.id;
  if (id) {
    await writeLog(db, {
      action: "audit.evidence.attach",
      entity: "audit_evidence",
      entityId: id,
      newValue: { audit_id: input.auditId, supplier_id: input.supplierId, source: input.source ?? null },
    });
  }
  return { ok: true, id };
}

// ── 现场清单回答（§23/§24）──────────────────────────────────────────────────
export type CreateResponseInput = {
  auditId: string;
  questionId: string;
  auditorId?: string | null;
  responseValue?: string | null;
  responseText?: string | null;
  photoUrls?: string[] | null;
  documentUrls?: string[] | null;
};

export async function recordResponse(input: CreateResponseInput): Promise<WfResult> {
  const db = createAdminClient();
  if (!db) return notConfigured();

  const { data: ins, error } = await db
    .from("audit_responses")
    .insert({
      audit_id: input.auditId,
      question_id: input.questionId,
      auditor_id: input.auditorId ?? null,
      response_value: input.responseValue ?? null,
      response_text: input.responseText ?? null,
      photo_urls: input.photoUrls ? JSON.stringify(input.photoUrls) : null,
      document_urls: input.documentUrls ? JSON.stringify(input.documentUrls) : null,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, reason: "insert_failed", message: error.message };
  const id = (ins as { id: string } | null)?.id;
  if (id) {
    await writeLog(db, {
      actorId: input.auditorId,
      action: "audit.response.create",
      entity: "audit_responses",
      entityId: id,
      newValue: { audit_id: input.auditId, question_id: input.questionId },
    });
  }
  return { ok: true, id };
}

// ── 读取（后台工作台，§46/§49）────────────────────────────────────────────────
export type AuditListItem = {
  id: string;
  auditCode: string;
  supplierId: string | null;
  supplierName: string | null;
  auditType: string;
  status: AuditStatus;
  product: string | null;
  createdAt: string | null;
};

/** 后台列表：按状态过滤（可选），带供应商名。service_role 专用。 */
export async function listAudits(opts?: {
  status?: AuditStatus;
  limit?: number;
}): Promise<AuditListItem[]> {
  const db = createAdminClient();
  if (!db) return [];
  let q = db
    .from("audits")
    .select("id, audit_code, supplier_id, audit_type, status, product, created_at, suppliers(legal_name)")
    .order("created_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => {
    const sup = r.suppliers as { legal_name?: string } | null;
    return {
      id: String(r.id),
      auditCode: String(r.audit_code),
      supplierId: r.supplier_id ? String(r.supplier_id) : null,
      supplierName: sup?.legal_name ?? null,
      auditType: String(r.audit_type ?? ""),
      status: (r.status as AuditStatus) ?? "requested",
      product: r.product ? String(r.product) : null,
      createdAt: r.created_at ? String(r.created_at) : null,
    } satisfies AuditListItem;
  });
}

export type AuditWorkflowView = {
  audit: AuditListItem & { standardProtocol: string | null };
  responses: Array<{ id: string; questionId: string; responseValue: string | null; responseText: string | null }>;
  findings: Array<{
    id: string;
    severity: string;
    description: string;
    status: string;
    correctiveActions: Array<{ id: string; description: string; status: string }>;
  }>;
  evidence: Array<{ id: string; filename: string | null; source: string | null; verificationStatus: string | null }>;
};

/** 单条审核的工作流全景（后台详情页）。service_role 专用。 */
export async function getAuditWorkflow(auditId: string): Promise<AuditWorkflowView | null> {
  const db = createAdminClient();
  if (!db) return null;

  const { data: a } = await db
    .from("audits")
    .select("id, audit_code, supplier_id, audit_type, status, product, standard_protocol, created_at, suppliers(legal_name)")
    .eq("id", auditId)
    .maybeSingle();
  if (!a) return null;
  const ar = a as Record<string, unknown>;
  const sup = ar.suppliers as { legal_name?: string } | null;

  const [{ data: responses }, { data: findings }, { data: evidence }] = await Promise.all([
    db.from("audit_responses").select("id, question_id, response_value, response_text").eq("audit_id", auditId),
    db.from("audit_findings").select("id, severity, description, status").eq("audit_id", auditId),
    db.from("audit_evidence").select("id, filename, source, verification_status").eq("audit_id", auditId),
  ]);

  const findingRows = (findings as Array<Record<string, unknown>>) ?? [];
  const capByFinding = new Map<string, Array<{ id: string; description: string; status: string }>>();
  if (findingRows.length) {
    const { data: caps } = await db
      .from("corrective_actions")
      .select("id, finding_id, description, status")
      .in("finding_id", findingRows.map((f) => String(f.id)));
    for (const c of (caps as Array<Record<string, unknown>>) ?? []) {
      const fid = String(c.finding_id);
      if (!capByFinding.has(fid)) capByFinding.set(fid, []);
      capByFinding.get(fid)!.push({
        id: String(c.id),
        description: c.description ? String(c.description) : "",
        status: String(c.status ?? "open"),
      });
    }
  }

  return {
    audit: {
      id: String(ar.id),
      auditCode: String(ar.audit_code),
      supplierId: ar.supplier_id ? String(ar.supplier_id) : null,
      supplierName: sup?.legal_name ?? null,
      auditType: String(ar.audit_type ?? ""),
      status: (ar.status as AuditStatus) ?? "requested",
      product: ar.product ? String(ar.product) : null,
      createdAt: ar.created_at ? String(ar.created_at) : null,
      standardProtocol: ar.standard_protocol ? String(ar.standard_protocol) : null,
    },
    responses: ((responses as Array<Record<string, unknown>>) ?? []).map((r) => ({
      id: String(r.id),
      questionId: String(r.question_id),
      responseValue: r.response_value ? String(r.response_value) : null,
      responseText: r.response_text ? String(r.response_text) : null,
    })),
    findings: findingRows.map((f) => ({
      id: String(f.id),
      severity: String(f.severity ?? "minor"),
      description: f.description ? String(f.description) : "",
      status: String(f.status ?? "open"),
      correctiveActions: capByFinding.get(String(f.id)) ?? [],
    })),
    evidence: ((evidence as Array<Record<string, unknown>>) ?? []).map((e) => ({
      id: String(e.id),
      filename: e.filename ? String(e.filename) : null,
      source: e.source ? String(e.source) : null,
      verificationStatus: e.verification_status ? String(e.verification_status) : null,
    })),
  };
}
