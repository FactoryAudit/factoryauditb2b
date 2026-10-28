"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AssessmentTemplate,
  AssessmentAnswerValue,
  AssessmentResponses,
  AssessmentStatus,
} from "@/lib/assessmentShared";
import {
  computeAssessmentProgress,
  FILE_RESPONSE_TYPES,
  isBasicTemplate,
  formatOptionLabel,
} from "@/lib/assessmentShared";
import type { EvidenceMeta } from "@/lib/supplierEvidence";
import type { FactoryPhotoMeta } from "@/lib/supplierImages";
import EvidenceUploader from "./EvidenceUploader";
import FactoryPhotoUploader from "./FactoryPhotoUploader";

type SA = Record<string, string>;

type Props = {
  templates: AssessmentTemplate[];
  /** 当前 locale：清单模板的 nameZh / titleZh / requirementZh 仅在 zh / zh-TW 下渲染，
   *  其余 7 语一律走英文源（避免英文页夹中文）。 */
  locale: string;
  dict: SA;
  supplierId: string;
  email: string;
  initialResponses: AssessmentResponses | null;
  initialSummary: string | null;
  initialStatus: AssessmentStatus | null;
  initialItemReview: Record<string, { status: string; note: string }> | null;
  initialEvidence: EvidenceMeta[];
  initialPhotos: FactoryPhotoMeta[];
};

const STATUS_BADGE: Record<string, { cls: string; key: string }> = {
  draft: { cls: "bg-[#f5f3ee] text-[#3f4650]", key: "status_draft" },
  submitted: { cls: "bg-[#dbeafe] text-[#1d4ed8]", key: "status_submitted" },
  under_review: { cls: "bg-[#fef9c3] text-[#a16207]", key: "status_under_review" },
  published: { cls: "bg-[#dcfce7] text-[#15803d]", key: "status_published" },
  rejected: { cls: "bg-[#fee2e2] text-[#b91c1c]", key: "status_rejected" },
  action_required: { cls: "bg-[#ffedd5] text-[#c2410c]", key: "status_action_required" },
  resubmitted: { cls: "bg-[#ede9fe] text-[#6d28d9]", key: "status_resubmitted" },
};

export default function SelfAssessmentForm({
  templates,
  locale,
  dict,
  supplierId,
  email,
  initialResponses,
  initialSummary,
  initialStatus,
  initialItemReview,
  initialEvidence,
  initialPhotos,
}: Props) {
  const t = (k: string) => dict[k] ?? k;
  /** 新增分层标签：dict 尚未收录 9 语翻译时回退英文，避免把 key 直接渲染到页面。
   *  ⚠️ 待补：stageBasicLabel / stageModuleLabel / stageBasicDone / stageBasicHint
   *     / stageModuleHint / submitBasicOnly（9 语字典同步后再删 fallback）。 */
  const tOr = (k: string, fallback: string) => {
    const v = dict[k];
    return typeof v === "string" && v.trim() ? v : fallback;
  };
  // 清单模板只有 en / zh 两套源文（lib/supplierAssessments 的 nameZh/titleZh/requirementZh）。
  // 非中文 locale 必须回退英文，否则英文页会夹中文（P0 修复）。
  const showZh = locale === "zh" || locale === "zh-TW";
  const [responses, setResponses] = useState<AssessmentResponses>(initialResponses ?? {});
  const [summary, setSummary] = useState<string>(initialSummary ?? "");
  const [status, setStatus] = useState<AssessmentStatus | null>(initialStatus);
  const [evidenceByItem, setEvidenceByItem] = useState<Record<string, EvidenceMeta[]>>(() => {
    const map: Record<string, EvidenceMeta[]> = {};
    for (const e of initialEvidence) {
      (map[e.itemKey] ??= []).push(e);
    }
    return map;
  });
  const [photos, setPhotos] = useState<FactoryPhotoMeta[]>(initialPhotos);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitBlocked, setSubmitBlocked] = useState<string | null>(null);

  // 🔴 R67（2026-10-09）：resubmitted 与 submitted 语义相同（都已交出去、都在后台待审队列
  //    QUEUE_STATUSES = [submitted, under_review, action_required, resubmitted] 里），
  //    但此前漏在名单外 ⇒ 供应商补件重交后表单仍可编辑、还能再次提交，
  //    后台可能在「还在改的答卷」上做审核。与 submitted 对齐（复用 submittedReadOnly 提示）。
  //
  // 🔴 2026-10-28：此变量改名为 statusLocked —— 它只表达「状态是否已交出去」，
  //    **不能单独决定表单是否只读**。真正的只读判据见下方 isLocked。
  const statusLocked =
    status === "submitted" ||
    status === "under_review" ||
    status === "resubmitted" ||
    status === "published";
  const isActionRequired = status === "action_required";

  const evidenceCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const [k, v] of Object.entries(evidenceByItem)) c[k] = v.length;
    return c;
  }, [evidenceByItem]);

  // 🔴 问卷分层（2026-10-28，迁移 036）：
  //   basic  = 基础档案，14 题，是**提交审核的前置门槛**
  //   module = 质量 / 社会责任 / 环保，按买家要求逐个补，不阻塞档案发布
  // 分层的唯一目的：把「一进页面就要填 72 题」降到「先填 14 题」。
  const basicTemplates = useMemo(() => templates.filter(isBasicTemplate), [templates]);
  const moduleTemplates = useMemo(() => templates.filter((t) => !isBasicTemplate(t)), [templates]);
  // 折叠状态：默认全部收起 —— 首屏只看见「基础档案 + 3 张模块卡片」，不刷出 80 多道题。
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const basicProgress = useMemo(
    () => computeAssessmentProgress(basicTemplates, responses, evidenceCounts),
    [basicTemplates, responses, evidenceCounts]
  );

  /**
   * 表单是否只读。
   *
   * 🔴 2026-10-28（供应商视角走查发现，必须加这一条）：
   *    只读**不能只看 status**。实测 guangzhou-sunny-food 等 10 家老供应商：
   *    status='submitted'（2026-09 那一批填的是 SC/QC 的 72 道评分题），
   *    但**新增的 14 道基础档案一道都没答** ⇒ 页面显示「已提交·审核中·不可编辑」，
   *    而进度是 0/14、题目全空 —— 供应商永远填不进去，第一步就死锁。
   *    判据补上「基础档案至少答过一题」：档案为空时一律可编辑，让老供应商能补填。
   *    已交过真实档案的供应商不受影响（answered > 0 ⇒ 照常只读）。
   */
  const isLocked = statusLocked && basicProgress.answered > 0;
  const moduleProgress = useMemo(
    () => computeAssessmentProgress(moduleTemplates, responses, evidenceCounts),
    [moduleTemplates, responses, evidenceCounts]
  );

  /** 单个模板的进度（模块卡片右上角的 x/y） */
  const progressOfOne = useCallback(
    (tpl: AssessmentTemplate) => computeAssessmentProgress([tpl], responses, evidenceCounts),
    [responses, evidenceCounts]
  );

  /** 基础档案必答项是否已齐 —— 决定「现在能不能提交」 */
  const basicsDone =
    basicProgress.mandatoryTotal === 0 ||
    basicProgress.mandatoryAnswered >= basicProgress.mandatoryTotal;

  const setResponse = useCallback((code: string, val: AssessmentAnswerValue) => {
    setResponses((prev) => {
      const next = { ...prev };
      if (val == null || (Array.isArray(val) && val.length === 0) || (typeof val === "string" && !val.trim())) {
        delete next[code];
      } else {
        next[code] = val;
      }
      return next;
    });
  }, []);

  // 自动保存（草稿态，停止输入 1000ms 后；避免高频写库）
  //
  // 🔴 去抖逻辑必须留在本 effect 内，**不要**再抽回 useCallback 形式的 scheduleAutoSave：
  //    只要它的依赖里没有 responses / summary（例如旧版只写 [isLocked]），React 会在首次
  //    渲染后永久复用同一个函数实例，它闭包里的 doSave 也就永久停在首屏那一刻的 responses
  //    ⇒ 自动保存每次都提交**首屏快照**（首次进入即空 {}）：既存不下任何答案，
  //    又会在手动保存之后把已存草稿覆盖回空（数据丢失）。
  //    2026-10-09 线上取证（拦截并 abort 写请求，只读抓包）：点选 QC01 后自动保存
  //    responses={}；同一渲染内的手动保存 responses={"QC01":"C"}。
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // 🔴 R67：闸门只认 isLocked —— 与下方「Save Draft」按钮同源（同一把闸门，不会漂移）。
    //    此前多了一层 `status !== "draft" && status !== null` ⇒ 退回补件态（action_required）
    //    自动保存完全不触发：那一档输入框全部可编辑、主按钮写着 Resubmit，供应商改完不点保存
    //    直接关页就是全部改动丢失。
    //    服务端本就支持：saveSelfAssessmentDraft 对非 draft 行「保留原状态、只更新答案」，
    //    action_required 行存完仍是 action_required（lib/supplierAssessments.ts:241-242）。
    if (isLocked) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void doSave(true);
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, summary, status, isLocked]);

  async function doSave(isAuto: boolean): Promise<boolean> {
    if (isLocked) return false;
    setSaving(true);
    try {
      const res = await fetch("/api/supplier-self-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, email, action: "draft", responses, summary }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSavedAt(new Date().toLocaleTimeString());
        if (!isAuto) setResult({ ok: true, message: t("saved") });
        return true;
      }
      if (!isAuto) setResult({ ok: false, message: t("saveFailed") });
      return false;
    } catch {
      if (!isAuto) setResult({ ok: false, message: t("networkError") });
      return false;
    } finally {
      setSaving(false);
    }
  }

  // 🔴 提交闸门只校验 **基础档案**（basic）的必答项。
  //    专项模块（质量/社会责任/环保）是加分项，不能因为它们没填完就卡住档案发布 ——
  //    否则又回到「72 题全填完才能提交」的老问题。
  function checkSubmitGate(): string | null {
    if (basicProgress.mandatoryAnswered < basicProgress.mandatoryTotal) {
      return t("mandatoryIncomplete").replace(
        "{count}",
        String(basicProgress.mandatoryTotal - basicProgress.mandatoryAnswered)
      );
    }
    return null;
  }

  async function handleSubmit() {
    setResult(null);
    const gate = checkSubmitGate();
    if (gate) {
      setSubmitBlocked(gate);
      return;
    }
    setSubmitBlocked(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/supplier-self-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, email, action: "submit", responses, summary }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus(data.status);
        setResult({ ok: true, message: t("submittedDesc") });
      } else if (data.error === "already_in_review") {
        setResult({ ok: false, message: t("alreadyInReview") });
      } else {
        setResult({ ok: false, message: data?.error ? `${t("submitFailed")}: ${data.error}` : t("submitFailed") });
      }
    } catch {
      setResult({ ok: false, message: t("networkError") });
    } finally {
      setSubmitting(false);
    }
  }

  function renderAnswer(q: AssessmentTemplate["sections"][number]["questions"][number]) {
    const val = responses[q.code];
    if (FILE_RESPONSE_TYPES.has(q.responseType)) {
      return (
        <EvidenceUploader
          itemKey={q.code}
          supplierId={supplierId}
          email={email}
          value={evidenceByItem[q.code] ?? []}
          onChange={(metas) => setEvidenceByItem((prev) => ({ ...prev, [q.code]: metas }))}
          dict={dict}
        />
      );
    }
    if (q.responseType === "text") {
      return (
        <textarea
          value={typeof val === "string" ? val : ""}
          onChange={(e) => {
            setResponse(q.code, e.target.value);
          }}
          rows={2}
          maxLength={20000}
          className="mt-2 w-full border rounded-lg p-2 text-sm"
          disabled={isLocked}
        />
      );
    }
    if (q.responseType === "number") {
      return (
        <input
          type="number"
          value={typeof val === "number" ? val : typeof val === "string" ? val : ""}
          onChange={(e) => setResponse(q.code, e.target.value === "" ? null : Number(e.target.value))}
          className="mt-2 w-40 border rounded-lg p-2 text-sm"
          disabled={isLocked}
        />
      );
    }
    if (q.responseType === "date") {
      return (
        <input
          type="date"
          value={typeof val === "string" ? val : ""}
          onChange={(e) => setResponse(q.code, e.target.value)}
          className="mt-2 border rounded-lg p-2 text-sm"
          disabled={isLocked}
        />
      );
    }
    if (q.responseType === "multi_select" && q.options) {
      const arr = Array.isArray(val) ? val : [];
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {q.options.map((o) => {
            const checked = arr.includes(o);
            return (
              <label
                key={o}
                className={`px-3 py-1 rounded-full border text-sm cursor-pointer select-none ${
                  checked ? "bg-[#171717] text-white border-[#171717]" : "bg-[#fbfaf7] text-[#2b2b2b] border-[#ebe8e1]"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  disabled={isLocked}
                  onChange={() => {
                    const next = checked ? arr.filter((x) => x !== o) : [...arr, o];
                    setResponse(q.code, next);
                  }}
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    }
    // yes_no_na / single_select
    const options =
      q.responseType === "yes_no_na" ? ["yes", "no", "na"] : q.options ?? [];
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const label = q.responseType === "yes_no_na" ? t(o) : formatOptionLabel(o);
          const checked = val === o;
          return (
            <label
              key={o}
              className={`px-3 py-1 rounded-full border text-sm cursor-pointer select-none ${
                checked ? "bg-[#171717] text-white border-[#171717]" : "bg-[#fbfaf7] text-[#2b2b2b] border-[#ebe8e1]"
              }`}
            >
              <input
                type="radio"
                name={q.code}
                className="sr-only"
                checked={checked}
                disabled={isLocked}
                onChange={() => setResponse(q.code, o)}
              />
              {label}
            </label>
          );
        })}
      </div>
    );
  }

  /** 渲染一个模板下的所有分组与题目（基础档案与专项模块共用同一套渲染） */
  function renderSections(tpl: AssessmentTemplate) {
    return tpl.sections.map((sec) => (
      <div key={sec.code} className="mt-6">
        <h3 className="text-lg font-semibold text-[#171717] border-l-4 border-[#171717] pl-3">
          {sec.code}. {showZh && sec.titleZh ? sec.titleZh : sec.title}
        </h3>
        <div className="mt-3 space-y-4">
          {sec.questions.map((q) => (
            <div key={q.code} className="border rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-[#171717]">
                  <span className="text-[#6d6b66]">{q.code}</span> {showZh && q.titleZh ? q.titleZh : q.title}
                  {q.mandatory && <span className="text-[#b45309] ml-1">*</span>}
                </p>
              </div>
              {showZh && q.requirementZh && (
                <p className="text-xs text-[#6d6b66] mt-1">{q.requirementZh}</p>
              )}
              {renderAnswer(q)}
            </div>
          ))}
        </div>
      </div>
    ));
  }

  /** 自评报告链接（GET 生成，浏览器直接打开即可看，也可另存为 HTML） */
  function reportHref(download: boolean): string {
    const qs = new URLSearchParams({
      supplier: supplierId,
      email,
      lang: showZh ? "zh" : "en",
    });
    if (download) qs.set("download", "1");
    return `/api/supplier-report?${qs.toString()}`;
  }

  const badge = status ? STATUS_BADGE[status] : null;

  return (
    <div className="space-y-6">
      {/* 状态 + 双层进度（基础档案 = 门槛 / 专项模块 = 加分） */}
      <div className="card p-4 text-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[#2b2b2b]">
            {tOr("stageBasicLabel", "Step 1 · Company profile")}:{" "}
            <strong className="text-[#171717]">{basicProgress.answered}</strong> / {basicProgress.total}
          </span>
          {badge && (
            <span className={`px-2 py-0.5 rounded-full text-xs ${badge.cls}`}>{t(badge.key)}</span>
          )}
          {saving && <span className="text-xs text-[#6d6b66]">{t("saving")}</span>}
          {savedAt && !saving && (
            <span className="text-xs text-[#6d6b66]">
              {t("savedAtPrefix")} {savedAt}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-[#6d6b66]">
          {tOr("stageModuleLabel", "Step 2 · Optional modules")} {moduleProgress.answered}/{moduleProgress.total}
        </div>
        <div className="mt-2 h-2 bg-[#ebe8e1] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#171717]"
            style={{ width: `${basicProgress.total ? (basicProgress.answered / basicProgress.total) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#6d6b66]">
          {basicsDone
            ? tOr("stageBasicDone", "Company profile complete — you can submit for review now.")
            : tOr("stageBasicHint", "Complete the company profile below to submit for review. Optional modules are not required.")}
        </p>
      </div>

      {/* Action Required 回填提示 */}
      {isActionRequired && initialItemReview && (
        <div className="card p-4 border border-[#fdba74] bg-[#fff7ed]">
          <h3 className="font-semibold text-[#c2410c]">{t("actionRequiredTitle")}</h3>
          <p className="text-sm text-[#9a3412] mt-1">{t("actionRequiredDesc")}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(initialItemReview).map(([code, info]) => (
              <li key={code} className="text-[#7c2d12]">
                <strong>{code}</strong>: {info.note || t("adminNotePrefix")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 已提交 / 审核中：只读提示 */}
      {isLocked && (
        <div className="card p-4 bg-[#fbfaf7] border border-[#ebe8e1]">
          <p className="text-sm text-[#2b2b2b]">{t("submittedReadOnly")}</p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="space-y-6"
      >
        {/* ---------------- Step 1 · 基础档案（提交门槛，恒展开） ---------------- */}
        {basicTemplates.map((tpl) => (
          <section key={tpl.code} className="card p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-[#171717]">
                {tOr("stageBasicLabel", "Step 1 · Company profile")}
              </h2>
              <span className="text-sm text-[#6d6b66]">
                {basicProgress.answered}/{basicProgress.total}
              </span>
            </div>
            <p className="text-sm text-[#8c8982] mt-1">
              {showZh && tpl.nameZh ? tpl.nameZh : tpl.name}
              {tpl.description ? ` — ${tpl.description}` : ""}
            </p>
            {renderSections(tpl)}
          </section>
        ))}

        {/* ---------------- Step 2 · 专项模块（默认折叠，不阻塞提交） ---------------- */}
        {moduleTemplates.length > 0 && (
          <section className="card p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-[#171717]">
                {tOr("stageModuleLabel", "Step 2 · Optional modules")}
              </h2>
              <span className="text-sm text-[#6d6b66]">
                {moduleProgress.answered}/{moduleProgress.total}
              </span>
            </div>
            <p className="text-sm text-[#8c8982] mt-1">
              {tOr(
                "stageModuleHint",
                "Fill these in when a buyer asks for them. They are not required to publish your company profile."
              )}
            </p>
            <div className="mt-4 space-y-3">
              {moduleTemplates.map((tpl) => {
                const p = progressOfOne(tpl);
                const open = !!openModules[tpl.code];
                return (
                  <div key={tpl.code} className="border rounded-lg bg-white">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenModules((prev) => ({ ...prev, [tpl.code]: !prev[tpl.code] }))
                      }
                      aria-expanded={open}
                      className="w-full flex items-start justify-between gap-3 p-4 text-left"
                    >
                      <span>
                        <span className="font-semibold text-[#171717]">
                          {open ? "▾" : "▸"} {showZh && tpl.nameZh ? tpl.nameZh : tpl.name}
                        </span>
                        {tpl.description && (
                          <span className="block text-xs text-[#8c8982] mt-1">{tpl.description}</span>
                        )}
                      </span>
                      <span className="text-sm text-[#6d6b66] shrink-0">
                        {p.answered}/{p.total}
                      </span>
                    </button>
                    {open && <div className="px-4 pb-4">{renderSections(tpl)}</div>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 工厂展示图（与证据分离的业务对象） */}
        <section className="card p-6">
          <FactoryPhotoUploader supplierId={supplierId} value={photos} onChange={setPhotos} dict={dict} />
        </section>

        {/* 自评说明 */}
        <section className="card p-6">
          <h3 className="text-lg font-semibold text-[#171717]">{t("selfSummaryLabel")}</h3>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={t("selfSummaryPlaceholder")}
            className="mt-2 w-full border rounded-lg p-3 text-sm"
            disabled={isLocked}
          />
        </section>

        {/* 自评报告（Self-Assessment Summary）——即时生成，不落库、不对外 */}
        <section className="card p-6">
          <h3 className="text-lg font-semibold text-[#171717]">
            {tOr("reportTitle", "Self-assessment report")}
          </h3>
          <p className="text-sm text-[#6d6b66] mt-1">
            {tOr(
              "reportHint",
              "Generate a summary of everything you have declared. It carries no score and no audit conclusion — chapter 06 lists what a buyer would still need to verify."
            )}
          </p>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {basicsDone ? (
              <>
                <a
                  className="btn-primary px-5 py-3"
                  href={reportHref(false)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-track="self_assessment_report_open"
                >
                  {tOr("reportOpen", "Open report")}
                </a>
                <a
                  className="px-5 py-3 rounded-lg border border-[#171717] text-[#171717]"
                  href={reportHref(true)}
                  data-track="self_assessment_report_download"
                >
                  {tOr("reportDownload", "Download HTML")}
                </a>
              </>
            ) : (
              <span className="text-sm text-[#b45309]">
                {tOr("reportBlocked", "Complete the company profile (Step 1) first — a mostly empty report would be misleading.")}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-[#8c8982]">
            {tOr(
              "reportFootnote",
              "Every item is marked Self-reported. This is not a certificate and not an audit result."
            )}
          </p>
        </section>

        {submitBlocked && (
          <div className="p-3 rounded-lg text-sm bg-amber-50 text-amber-800">{submitBlocked}</div>
        )}
        {result && (
          <div className={`p-4 rounded-lg text-sm ${result.ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
            {result.message}
          </div>
        )}

        <div className="flex items-center gap-3">
          {!isLocked && (
            <button
              type="button"
              onClick={() => void doSave(false)}
              disabled={saving}
              className="px-5 py-3 rounded-lg border border-[#171717] text-[#171717] disabled:opacity-60"
              data-track="self_assessment_save_draft_click"
            >
              {saving ? t("saving") : t("saveDraft")}
            </button>
          )}
          {!isLocked && (
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-6 py-3 disabled:opacity-60"
              data-track="self_assessment_submit_click"
            >
              {submitting ? t("submitting") : isActionRequired ? t("resubmit") : t("submitForVerification")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
