// lib/supplierAssessments.ts —— CS-21 三标签审核体系：服务端数据层（server-only）
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

import { createAdminClient } from "@/lib/supabaseAdmin";

export type AssessmentType = "self_assessment" | "platform_assessment" | "on_site_audit";
export type AssessmentStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "published"
  | "rejected";

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, { en: string; zh: string }> = {
  self_assessment: { en: "Factory Self-Assessment", zh: "工厂自评估" },
  platform_assessment: { en: "Platform Online Assessment", zh: "平台在线评估" },
  on_site_audit: { en: "Platform On-site Audit", zh: "平台现场审核" },
};

export type AssessmentQuestion = {
  code: string;
  title: string;
  titleZh: string;
  requirement: string | null;
  requirementZh: string | null;
  responseType: string;
  options: string[] | null;
  sortOrder: number;
};

export type AssessmentSection = {
  code: string;
  title: string;
  titleZh: string;
  sortOrder: number;
  questions: AssessmentQuestion[];
};

export type AssessmentTemplate = {
  code: string;
  name: string;
  nameZh: string;
  description: string | null;
  sections: AssessmentSection[];
};

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
      "id, section_id, question_code, title, title_zh, requirement, requirement_zh, response_type, options, sort_order"
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

// -----------------------------------------------------------------------------
// 标签①：读取 / 提交工厂自评估
// -----------------------------------------------------------------------------
export type SelfAssessmentDraft = {
  status: AssessmentStatus | null;
  responses: Record<string, string> | null;
  summary: string | null;
};

export async function getSupplierSelfAssessment(supplierId: string): Promise<SelfAssessmentDraft | null> {
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db
    .from("supplier_assessments")
    .select("status, responses_json, self_summary")
    .eq("supplier_id", supplierId)
    .eq("assessment_type", "self_assessment")
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status as AssessmentStatus,
    responses:
      data.responses_json && typeof data.responses_json === "object"
        ? (data.responses_json as Record<string, string>)
        : null,
    summary: data.self_summary ?? null,
  };
}

/**
 * 提交工厂自评估。轻量归属校验：supplier 存在且 contact_email 匹配（V2.1 不建整套登录）。
 * 写入 supplier_assessments(self_assessment)，状态 draft→submitted，submitted_at=now()。
 * 不触碰 suppliers.verification_level（三标签权威源是 supplier_assessments 的 published 行，由 admin 发布时处理）。
 */
export async function submitSelfAssessment(input: {
  supplierId: string;
  email: string;
  responses: Record<string, string>;
  summary: string | null;
}): Promise<{ ok: boolean; error?: string; status?: number }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "service_unavailable", status: 503 };

  const { data: supplier, error: sErr } = await db
    .from("suppliers")
    .select("id, contact_email, legal_name")
    .eq("id", input.supplierId)
    .maybeSingle();
  if (sErr || !supplier) return { ok: false, error: "supplier_not_found", status: 404 };

  const supEmail = (supplier.contact_email || "").toLowerCase();
  const givenEmail = (input.email || "").toLowerCase();
  if (!givenEmail || supEmail !== givenEmail) {
    return { ok: false, error: "ownership_mismatch", status: 403 };
  }

  // 只保留非空答案（缺失值不写入，绝不填 0/默认值）
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.responses ?? {})) {
    if (typeof v === "string" && v.trim()) clean[k] = v.trim().slice(0, 4);
  }

  const { error: upsertErr } = await db.from("supplier_assessments").upsert(
    {
      supplier_id: input.supplierId,
      assessment_type: "self_assessment",
      status: "submitted",
      responses_json: clean,
      self_summary: input.summary ? input.summary.slice(0, 4000) : null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id, assessment_type" }
  );
  if (upsertErr) {
    console.error("[supplierAssessments] submit self-assessment failed", upsertErr.message);
    return { ok: false, error: "save_failed", status: 500 };
  }
  return { ok: true, status: 200 };
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
//   若已 published 则不允许重复发起（已完成）；under_review/submitted 则刷新 SLA 与提交时间。
// -----------------------------------------------------------------------------
export async function applyOnSiteAudit(input: {
  supplierId: string;
  email: string;
}): Promise<{ ok: boolean; error?: string; status?: number; slaDueAt?: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "service_unavailable", status: 503 };

  const { data: supplier, error: sErr } = await db
    .from("suppliers")
    .select("id, contact_email")
    .eq("id", input.supplierId)
    .maybeSingle();
  if (sErr || !supplier) return { ok: false, error: "supplier_not_found", status: 404 };

  const supEmail = (supplier.contact_email || "").toLowerCase();
  const givenEmail = (input.email || "").toLowerCase();
  if (!givenEmail || supEmail !== givenEmail) {
    return { ok: false, error: "ownership_mismatch", status: 403 };
  }

  // 已发布（平台已完成并发布报告）不允许重复发起
  const { data: existing } = await db
    .from("supplier_assessments")
    .select("status")
    .eq("supplier_id", input.supplierId)
    .eq("assessment_type", "on_site_audit")
    .maybeSingle();
  if (existing && existing.status === "published") {
    return { ok: false, error: "already_published", status: 409 };
  }

  const now = new Date();
  const slaDueAt = addWorkingDays(now, 7).toISOString();
  const { error: upsertErr } = await db.from("supplier_assessments").upsert(
    {
      supplier_id: input.supplierId,
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
