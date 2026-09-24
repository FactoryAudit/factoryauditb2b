// lib/assessmentShared.ts —— 客户端安全的纯评估类型 / 标签 / 进度计算
//
// ⚠️ 本文件不得 import 任何服务端模块（createAdminClient / next/headers / supabase）。
//    仅供客户端组件（SelfAssessmentForm / AssessmentTags / AssessmentReportPaywall）
//    引用纯类型、纯常量与纯函数，避免把 next/headers 等服务端依赖打进客户端包。
//    服务端 lib/supplierAssessments.ts 从此文件再导出，保持对外 API 不变。

export type AssessmentType = "self_assessment" | "platform_assessment" | "on_site_audit";

// CS-B：状态机含 action_required（管理员退回补件）/ resubmitted（供应商补件重交）。
// 与 DB CHECK 约束（supplier_assessments_status_check）保持一致。
export type AssessmentStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "published"
  | "rejected"
  | "action_required"
  | "resubmitted";

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, { en: string; zh: string }> = {
  self_assessment: { en: "Factory Self-Assessment", zh: "工厂自评估" },
  platform_assessment: { en: "Platform Online Assessment", zh: "平台在线评估" },
  on_site_audit: { en: "Platform On-site Audit", zh: "平台现场审核" },
};

/** 答案值：标量存原值，多选存数组。NULL 不落库（缺失值绝不用 0 顶替）。 */
export type AssessmentAnswerValue = string | string[] | number | null;
export type AssessmentResponses = Record<string, AssessmentAnswerValue>;

export type AssessmentQuestion = {
  code: string;
  title: string;
  titleZh: string;
  requirement: string | null;
  requirementZh: string | null;
  responseType: string;
  options: string[] | null;
  sortOrder: number;
  /** audit_questions.mandatory —— 必答项。CS-B 提交前校验只信这一列，不自行假设全 72 项必填。 */
  mandatory: boolean;
  /** audit_questions.severity_if_failed —— critical/major/minor/observation/NULL。
   *  用于提示"为何需要证据"，不另建证据需求表。 */
  severityIfFailed: string | null;
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

/** 文件类题型（photo/document/signature）—— 这类题答案以"证据"承载，responses_json 不存文件。 */
export const FILE_RESPONSE_TYPES = new Set(["photo", "document", "signature"]);

export type AssessmentProgress = {
  total: number;
  answered: number;
  unanswered: number;
  mandatoryTotal: number;
  mandatoryAnswered: number;
  fileItemsTotal: number;
  fileItemsWithEvidence: number;
};

function isAnswerPresent(v: AssessmentAnswerValue | undefined): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true; // number 0 也算已答（但业务上不会是 0 这种无意义值）
}

/**
 * 计算自评进度（纯函数，无服务端依赖）。
 * @param templates 完整模板（含 72 项）
 * @param responses 已存答案（responses_json）
 * @param evidenceCountByItem 各 file 型题目已挂证据数 {itemKey: count}
 */
export function computeAssessmentProgress(
  templates: AssessmentTemplate[],
  responses: AssessmentResponses | null,
  evidenceCountByItem: Record<string, number>
): AssessmentProgress {
  const resp = responses ?? {};
  let total = 0;
  let answered = 0;
  let mandatoryTotal = 0;
  let mandatoryAnswered = 0;
  let fileItemsTotal = 0;
  let fileItemsWithEvidence = 0;

  for (const t of templates) {
    for (const s of t.sections) {
      for (const q of s.questions) {
        total += 1;
        if (q.mandatory) mandatoryTotal += 1;

        const hasAnswer = isAnswerPresent(resp[q.code]);
        const isFile = FILE_RESPONSE_TYPES.has(q.responseType);
        if (isFile) {
          fileItemsTotal += 1;
          const ev = evidenceCountByItem[q.code] ?? 0;
          if (ev > 0) fileItemsWithEvidence += 1;
          // 文件型题目：有证据即视为"已回答"
          if (ev > 0) answered += 1;
        } else if (hasAnswer) {
          answered += 1;
        }

        if (q.mandatory) {
          if (isFile) {
            if ((evidenceCountByItem[q.code] ?? 0) > 0) mandatoryAnswered += 1;
          } else if (hasAnswer) {
            mandatoryAnswered += 1;
          }
        }
      }
    }
  }

  return {
    total,
    answered,
    unanswered: total - answered,
    mandatoryTotal,
    mandatoryAnswered,
    fileItemsTotal,
    fileItemsWithEvidence,
  };
}

export type SelfAssessmentDraft = {
  id: string | null;
  status: AssessmentStatus | null;
  responses: AssessmentResponses | null;
  summary: string | null;
  itemReview: Record<string, { status: string; note: string }> | null;
  lastSavedAt: string | null;
  submittedAt: string | null;
};
