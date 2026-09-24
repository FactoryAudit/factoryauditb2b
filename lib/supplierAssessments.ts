// lib/supplierAssessments.ts —— CS-21/22 三标签审核体系：服务端数据层（server-only）
//
// ⚠️ 危险区：本文件只可在服务端 import（Route Handler / Server Component / Server Action）。
//    所有读写走 createAdminClient()（service_role, BYPASSRLS）。
//    返回前端前由调用方裁剪；本文件不直接暴露给客户端组件。
//
// 三标签相互独立（每供应商每种类型一行）：
//   self_assessment   工厂自评估（供应商自填两份清单 72 项）
//   platform_assessment 平台在线评估（平台线上背调/验证后出报告）
//   on_site_audit     平台现场审核（供应商申请 → 平台线下 → 7 工作日 SLA → 上传报告）
//
// 风险口径纪律：risk_level 用平台五档(low/moderate/elevated/high/critical)，
// 与清单 LOW/MED/HIGH 不同，调用方不可混用。
//
// CS-B 铁律：
//   · 答案唯一来源 = supplier_assessments.responses_json（**绝不建 answers 表**）。
//   · 模板 = audit_templates/sections/questions（72 项，前端不硬编码问题）。
//   · 所有读写经 resolveSupplierAccess() 裁决归属（会话优先 / 邮箱兜底 / 歧义拒）。
//   · 供应商**绝不可**写 verification_* / verified_at / expires_at（那些由 Admin CS-C 处理）。

import { createAdminClient } from "@/lib/supabaseAdmin";
// P0-A：归属裁决统一走 lib/supplierAccess.ts，本文件不再各自手写 email 比对
import { resolveSupplierAccess } from "@/lib/supplierAccess";

// 纯类型 / 常量 / 纯函数（无服务端依赖）下沉到 assessmentShared，供客户端组件安全引用。
import type {
  AssessmentType,
  AssessmentStatus,
  AssessmentAnswerValue,
  AssessmentResponses,
  AssessmentQuestion,
  AssessmentSection,
  AssessmentTemplate,
  AssessmentProgress,
  SelfAssessmentDraft,
} from "./assessmentShared";
export type {
  AssessmentType,
  AssessmentStatus,
  AssessmentAnswerValue,
  AssessmentResponses,
  AssessmentQuestion,
  AssessmentSection,
  AssessmentTemplate,
  AssessmentProgress,
  SelfAssessmentDraft,
} from "./assessmentShared";
export { FILE_RESPONSE_TYPES, ASSESSMENT_TYPE_LABELS } from "./assessmentShared";

// -----------------------------------------------------------------------------
// 清单读取（标签①表单渲染用）：audit_templates/sections/questions 三表组装
// -----------------------------------------------------------------------------
export async function getChecklistTemplates(): Promise<AssessmentTemplate[]> {
  const db = createAdminClient();
  if (!db) return [];
  const { data: templates } = await db
    .from("audit_templates")
    .select("id, code, name, name_zh, description")
    .eq("is_active", true)
    .order("code");
  if (!templates || templates.length === 0) return [];

  const { data: sections } = await db
    .from("audit_sections")
    .select("id, template_id, section_code, title, title_zh, sort_order")
    .order("sort_order");
  const { data: questions } = await db
    .from("audit_questions")
    .select(
      "id, section_id, question_code, title, title_zh, requirement, requirement_zh, response_type, options, sort_order, mandatory, severity_if_failed"
    )
    .order("sort_order");

  const secByTpl = new Map<string, AssessmentSection[]>();
  for (const t of templates) secByTpl.set(t.id, []);
  const qBySec = new Map<string, AssessmentQuestion[]>();

  for (const s of sections ?? []) {
    const list = secByTpl.get(s.template_id) ?? [];
    list.push({
      code: s.section_code,
      title: s.title,
      titleZh: s.title_zh ?? "",
      sortOrder: s.sort_order,
      questions: [],
    });
    secByTpl.set(s.template_id, list);
    qBySec.set(s.id, []);
  }
  for (const q of questions ?? []) {
    const list = qBySec.get(q.section_id) ?? [];
    list.push({
      code: q.question_code,
      title: q.title,
      titleZh: q.title_zh ?? "",
      requirement: q.requirement ?? null,
      requirementZh: q.requirement_zh ?? null,
      responseType: q.response_type,
      options:
        Array.isArray(q.options) && q.options.every((x: unknown) => typeof x === "string")
          ? (q.options as string[])
          : null,
      sortOrder: q.sort_order,
      mandatory: q.mandatory === true,
      severityIfFailed:
        typeof q.severity_if_failed === "string" ? q.severity_if_failed : null,
    });
    qBySec.set(q.section_id, list);
  }

  return templates.map((t) => ({
    code: t.code,
    name: t.name,
    nameZh: t.name_zh ?? "",
    description: t.description ?? null,
    sections: (secByTpl.get(t.id) ?? []).map((s) => ({
      ...s,
      questions: qBySec.get(
        (sections ?? []).find((x) => x.template_id === t.id && x.section_code === s.code)?.id ?? ""
      ) ?? [],
    })),
  }));
}

// 进度统计（CS-B §09）纯函数已下沉到 assessmentShared（无服务端依赖，客户端可引用）。
export { computeAssessmentProgress } from "./assessmentShared";

// -----------------------------------------------------------------------------
// 标签①：读取 / 保存草稿 / 提交工厂自评估
// -----------------------------------------------------------------------------
// SelfAssessmentDraft 类型已下沉到 assessmentShared（见文件顶部 re-export）。


export async function getSupplierSelfAssessment(supplierId: string): Promise<SelfAssessmentDraft | null> {
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db
    .from("supplier_assessments")
    .select("id, status, responses_json, self_summary, item_review_json, updated_at, submitted_at")
    .eq("supplier_id", supplierId)
    .eq("assessment_type", "self_assessment")
    .maybeSingle();
  if (!data) return null;
  const rj = data.responses_json;
  return {
    id: data.id ?? null,
    status: (data.status as AssessmentStatus) ?? null,
    responses:
      rj && typeof rj === "object" && !Array.isArray(rj) ? (rj as AssessmentResponses) : null,
    summary: data.self_summary ?? null,
    itemReview:
      data.item_review_json && typeof data.item_review_json === "object"
        ? (data.item_review_json as SelfAssessmentDraft["itemReview"])
        : null,
    lastSavedAt: data.updated_at ?? null,
    submittedAt: data.submitted_at ?? null,
  };
}

/** 把客户端原始 responses 清洗为可落库的 AssessmentResponses（缺失值不写入）。 */
function sanitizeResponses(
  raw: Record<string, unknown> | null | undefined,
  templates: AssessmentTemplate[]
): AssessmentResponses {
  const out: AssessmentResponses = {};
  if (!raw || typeof raw !== "object") return out;

  // 仅保留模板里真实存在的 question_code，防客户端塞入任意键
  const validCodes = new Set<string>();
  const typeByCode = new Map<string, string>();
  for (const t of templates) {
    for (const s of t.sections) {
      for (const q of s.questions) {
        validCodes.add(q.code);
        typeByCode.set(q.code, q.responseType);
      }
    }
  }

  for (const [code, val] of Object.entries(raw)) {
    if (!validCodes.has(code)) continue; // 丢弃模板外的键
    const rt = typeByCode.get(code) ?? "";
    if (val == null) continue;
    if (Array.isArray(val)) {
      const arr = val.filter((x) => typeof x === "string" && x.trim()).map((x) => String(x).trim());
      if (arr.length > 0) out[code] = arr;
      continue;
    }
    if (typeof val === "number") {
      if (!Number.isNaN(val)) out[code] = val;
      continue;
    }
    if (typeof val === "string") {
      const s = val.trim();
      if (!s) continue;
      // number 题型尝试转数字；其余原样存（**绝不截断**）
      if (rt === "number") {
        const n = Number(s);
        out[code] = Number.isNaN(n) ? s : n;
      } else {
        out[code] = s.slice(0, 20000); // 仅做合理上限，不破坏内容
      }
    }
  }
  return out;
}

/**
 * 保存草稿：status = draft（无行时）；已有行则保留现有 status，只更新答案与说明。
 * 绝不把已 submitted/under_review 的行降级回 draft。
 */
export async function saveSelfAssessmentDraft(input: {
  supplierId: string;
  email: string;
  responses: Record<string, unknown>;
  summary: string | null;
  templates: AssessmentTemplate[];
}): Promise<{ ok: boolean; error?: string; status?: number }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "service_unavailable", status: 503 };

  const access = await resolveSupplierAccess({
    claimedSupplierId: input.supplierId,
    email: input.email,
  });
  if (!access.ok) return { ok: false, error: access.code, status: access.status };
  const supplierId = access.identity.supplierId;

  const clean = sanitizeResponses(input.responses, input.templates);
  const summary = input.summary ? String(input.summary).slice(0, 4000) : null;

  // 读取现有行判断 status 是否已被提交
  const { data: existing } = await db
    .from("supplier_assessments")
    .select("id, status")
    .eq("supplier_id", supplierId)
    .eq("assessment_type", "self_assessment")
    .maybeSingle();

  const now = new Date().toISOString();
  const targetStatus: AssessmentStatus =
    existing && existing.status && existing.status !== "draft" ? existing.status : "draft";

  const { error: upsertErr } = await db.from("supplier_assessments").upsert(
    {
      supplier_id: supplierId,
      assessment_type: "self_assessment",
      status: targetStatus,
      responses_json: clean,
      self_summary: summary,
      updated_at: now,
    },
    { onConflict: "supplier_id, assessment_type" }
  );
  if (upsertErr) {
    console.error("[supplierAssessments] save draft failed", upsertErr.message);
    return { ok: false, error: "save_failed", status: 500 };
  }
  return { ok: true, status: 200 };
}

/**
 * 提交工厂自评估（幂等 + 状态机）。
 * 幂等：onConflict(supplier_id, assessment_type) 保证只更新同一行，重复点击不生成第二条。
 * 状态机：
 *   draft/action_required → submitted（首次）/ resubmitted（退回后重交）
 *   under_review/published → 拒绝（409），避免重复提交干扰审核
 * 严禁写任何 verification_* / verified_at / expires_at。
 */
export async function submitSelfAssessment(input: {
  supplierId: string;
  email: string;
  responses: Record<string, unknown>;
  summary: string | null;
  templates: AssessmentTemplate[];
}): Promise<{ ok: boolean; error?: string; status?: number; state?: AssessmentStatus }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "service_unavailable", status: 503 };

  const access = await resolveSupplierAccess({
    claimedSupplierId: input.supplierId,
    email: input.email,
  });
  if (!access.ok) return { ok: false, error: access.code, status: access.status };
  const supplierId = access.identity.supplierId;

  const clean = sanitizeResponses(input.responses, input.templates);
  const summary = input.summary ? String(input.summary).slice(0, 4000) : null;

  const { data: existing } = await db
    .from("supplier_assessments")
    .select("id, status")
    .eq("supplier_id", supplierId)
    .eq("assessment_type", "self_assessment")
    .maybeSingle();

  const cur = (existing?.status as AssessmentStatus | undefined) ?? "draft";
  // 已进审核/已发布的，禁止再次提交（防重复提交）
  if (cur === "under_review" || cur === "published") {
    return { ok: false, error: "already_in_review", status: 409, state: cur };
  }
  // 退回补件后重交 → resubmitted；其余 → submitted
  const newStatus: AssessmentStatus = cur === "action_required" ? "resubmitted" : "submitted";

  const now = new Date().toISOString();
  const { error: upsertErr } = await db.from("supplier_assessments").upsert(
    {
      supplier_id: supplierId,
      assessment_type: "self_assessment",
      status: newStatus,
      responses_json: clean,
      self_summary: summary,
      submitted_at: now,
      updated_at: now,
    },
    { onConflict: "supplier_id, assessment_type" }
  );
  if (upsertErr) {
    console.error("[supplierAssessments] submit self-assessment failed", upsertErr.message);
    return { ok: false, error: "save_failed", status: 500 };
  }
  return { ok: true, status: 200, state: newStatus };
}

// -----------------------------------------------------------------------------
// 标签查询：返回某供应商已发布(published)的审核类型集合（供应商详情页三标签徽章用）
// -----------------------------------------------------------------------------
export async function getSupplierTags(supplierId: string): Promise<AssessmentType[]> {
  const db = createAdminClient();
  if (!db) return [];
  const { data } = await db
    .from("supplier_assessments")
    .select("assessment_type")
    .eq("supplier_id", supplierId)
    .eq("status", "published");
  if (!data) return [];
  return data
    .map((r) => r.assessment_type as AssessmentType)
    .filter((t): t is AssessmentType => typeof t === "string");
}

// -----------------------------------------------------------------------------
// 标签③读取：供应商侧查看自己的现场审核申请状态（含 SLA 到期日）
// -----------------------------------------------------------------------------
export type OnSiteAuditState = {
  status: AssessmentStatus;
  slaDueAt: string | null;
  submittedAt: string | null;
};

export async function getSupplierOnSiteAudit(supplierId: string): Promise<OnSiteAuditState | null> {
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db
    .from("supplier_assessments")
    .select("status, sla_due_at, submitted_at")
    .eq("supplier_id", supplierId)
    .eq("assessment_type", "on_site_audit")
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status as AssessmentStatus,
    slaDueAt: data.sla_due_at ?? null,
    submittedAt: data.submitted_at ?? null,
  };
}

// -----------------------------------------------------------------------------
// 标签③提交：供应商发起「平台现场审核」申请（轻量归属校验同标签①）
//   写 on_site_audit 行：status=submitted，sla_due_at=申请+7 工作日（跳过周末）。
// -----------------------------------------------------------------------------
export async function applyOnSiteAudit(input: {
  supplierId: string;
  email: string;
}): Promise<{ ok: boolean; error?: string; status?: number; slaDueAt?: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "service_unavailable", status: 503 };

  const access = await resolveSupplierAccess({
    claimedSupplierId: input.supplierId,
    email: input.email,
  });
  if (!access.ok) return { ok: false, error: access.code, status: access.status };
  const supplierId = access.identity.supplierId;

  const { data: existing } = await db
    .from("supplier_assessments")
    .select("status")
    .eq("supplier_id", supplierId)
    .eq("assessment_type", "on_site_audit")
    .maybeSingle();
  if (existing && existing.status === "published") {
    return { ok: false, error: "already_published", status: 409 };
  }

  const now = new Date();
  const slaDueAt = addWorkingDays(now, 7).toISOString();
  const { error: upsertErr } = await db.from("supplier_assessments").upsert(
    {
      supplier_id: supplierId,
      assessment_type: "on_site_audit",
      status: "submitted",
      sla_due_at: slaDueAt,
      submitted_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "supplier_id, assessment_type" }
  );
  if (upsertErr) {
    console.error("[supplierAssessments] apply on-site audit failed", upsertErr.message);
    return { ok: false, error: "save_failed", status: 500 };
  }
  return { ok: true, status: 200, slaDueAt };
}

// -----------------------------------------------------------------------------
// 通用工具：工作日加法（标签③ SLA = 申请 + 7 工作日，跳过周末）
// -----------------------------------------------------------------------------
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}
