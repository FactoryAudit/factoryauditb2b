"use client";

// components/portal/CompanyProfileWizard.tsx —— 公司信息分步向导（照 Sedex /supplier/company/site）
//
// 视觉与交互对齐 Sedex：
//   · 左侧表单（两列栅格），必填项标红 *，未填时输入框变红并给出提示
//   · 右侧竖向步骤条（已完成=实心勾、当前=高亮、未到=灰色空心）
//   · 底部「上一页 / 下一页」，最后一步显示完成摘要 + 提交
//
// 数据：读写**同一份** AssessmentResponses（SP01–SP14），与现有
//   /supplier-assessment 自评表共享 —— 两边只是 UI 不同，不存在两份数据。
// 提交：复用既有 /api/supplier-self-assessment（action=draft|submit）。

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssessmentQuestion, AssessmentResponses } from "@/lib/assessmentShared";

type StepKey = "company" | "site" | "workers" | "done";

type StepDef = {
  key: StepKey;
  zh: string;
  en: string;
  codes: string[];
};

// 步骤与题号映射。顺序对齐 Sedex：公司信息 → 工作场所信息 → 员工 → 完成。
const STEPS: StepDef[] = [
  { key: "company", zh: "公司信息", en: "Company details", codes: ["SP01", "SP02", "SP03", "SP05", "SP04"] },
  { key: "site", zh: "工作场所信息", en: "Site details", codes: ["SP06", "SP07", "SP09", "SP10"] },
  { key: "workers", zh: "员工和其他员工", en: "Workers & capability", codes: ["SP08", "SP11", "SP12", "SP13", "SP14"] },
  { key: "done", zh: "完成", en: "Complete", codes: [] },
];

/** 单选项的中文标签（题库 options 是英文枚举值，给中文用户补一份显示名） */
const OPTION_LABELS_ZH: Record<string, string> = {
  factory: "自产制造",
  trading: "贸易",
  both: "自产 + 贸易",
  other: "其他",
  owned: "自有",
  leased: "租赁",
  mixed: "部分自有、部分租赁",
  outsourced: "以委外为主",
  iso9001: "ISO 9001",
  iso14001: "ISO 14001",
  bsci: "BSCI",
  smeta: "SMETA",
  sa8000: "SA8000",
  none: "无",
};

export default function CompanyProfileWizard({
  questions,
  initialResponses,
  supplierId,
  email,
  locale,
}: {
  questions: AssessmentQuestion[];
  initialResponses: AssessmentResponses;
  supplierId: string;
  email: string;
  locale: string;
}) {
  const zh = locale === "zh" || locale === "zh-TW";
  const router = useRouter();

  const [stepIdx, setStepIdx] = useState(0);
  const [responses, setResponses] = useState<AssessmentResponses>(initialResponses);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const byCode = useMemo(() => {
    const m: Record<string, AssessmentQuestion> = {};
    questions.forEach((q) => (m[q.code] = q));
    return m;
  }, [questions]);

  const step = STEPS[stepIdx];
  const stepQuestions = step.codes.map((c) => byCode[c]).filter(Boolean);

  const hasValue = (v: AssessmentResponses[string]) =>
    Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== "";

  /** 某一步的必填项是否已全部填写（用于步骤条打勾） */
  function stepComplete(idx: number): boolean {
    const codes = STEPS[idx].codes;
    if (codes.length === 0) return false;
    return codes.every((c) => {
      const q = byCode[c];
      if (!q || !q.mandatory) return true;
      return hasValue(responses[c]);
    });
  }

  function setResponse(code: string, value: AssessmentResponses[string]) {
    setResponses((prev) => ({ ...prev, [code]: value }));
    setErrors((prev) => ({ ...prev, [code]: false }));
  }

  async function persist(action: "draft" | "submit"): Promise<boolean> {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/supplier-self-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, email, action, responses, summary: null }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setMsg((zh ? "保存失败：" : "Save failed: ") + (j?.error ?? res.status));
        return false;
      }
      return true;
    } catch {
      setMsg(zh ? "网络错误，请重试" : "Network error, please retry");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleNext() {
    // 校验当前步必填
    const missing: Record<string, boolean> = {};
    stepQuestions.forEach((q) => {
      if (q.mandatory && !hasValue(responses[q.code])) missing[q.code] = true;
    });
    if (Object.keys(missing).length > 0) {
      setErrors(missing);
      setMsg(zh ? "请先填写所有必填项（标 * 的字段）" : "Please complete all required fields (marked *)");
      return;
    }
    const ok = await persist("draft");
    if (!ok) return;
    setMsg(null);
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setMsg(null);
    setStepIdx((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    const ok = await persist("submit");
    if (!ok) return;
    setMsg(zh ? "已提交审核" : "Submitted for review");
    router.refresh();
  }

  /** 渲染一个字段（按 responseType） */
  function field(q: AssessmentQuestion) {
    const label = zh ? q.titleZh || q.title : q.title;
    const hint = zh ? q.requirementZh : q.requirement;
    const val = responses[q.code];
    const bad = errors[q.code];
    const inputCls =
      "w-full rounded-md border px-3 py-2.5 text-sm outline-none transition " +
      (bad
        ? "border-[#d4232a] bg-[#fdf3f3] focus:border-[#d4232a]"
        : "border-[#d9d5cc] bg-white focus:border-[#e07a49]");

    return (
      <div key={q.code}>
        <label className="mb-1.5 block text-[13px] font-semibold text-[#2b2b2b]">
          {label}
          {q.mandatory ? <span className="text-[#d4232a]"> *</span> : null}
        </label>
        {q.responseType === "single_select" && q.options ? (
          <select
            className={inputCls}
            value={typeof val === "string" ? val : ""}
            onChange={(e) => setResponse(q.code, e.target.value || null)}
          >
            <option value="">{zh ? "请选择" : "Select…"}</option>
            {q.options.map((o) => (
              <option key={o} value={o}>
                {zh ? OPTION_LABELS_ZH[o] ?? o : o}
              </option>
            ))}
          </select>
        ) : q.responseType === "number" ? (
          <input
            type="number"
            className={inputCls}
            value={val === null || val === undefined ? "" : String(val)}
            onChange={(e) =>
              setResponse(q.code, e.target.value === "" ? null : Number(e.target.value))
            }
          />
        ) : (
          <input
            type="text"
            className={inputCls}
            value={typeof val === "string" ? val : ""}
            onChange={(e) => setResponse(q.code, e.target.value)}
          />
        )}
        {bad ? (
          <p className="mt-1 text-xs text-[#d4232a]">{zh ? "此项为必填项" : "This field is required"}</p>
        ) : hint ? (
          <p className="mt-1 text-xs text-[#8c8982]">{hint}</p>
        ) : null}
      </div>
    );
  }

  const isDone = step.key === "done";

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_220px]">
      {/* ── 左侧：表单 ── */}
      <div>
        <header className="mb-6">
          <h1 className="text-[22px] font-extrabold text-[#171717]">
            {zh ? step.zh : step.en}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[#6d6b66]">
            {isDone
              ? zh
                ? "信息已保存。你可以提交审核，或继续完善专项模块。"
                : "Your details are saved. Submit for review, or continue with the specialist modules."
              : zh
              ? "检查并确认详细信息。确认后，你可以进入下一步。"
              : "Check and confirm your details, then continue to the next step."}
          </p>
        </header>

        {!isDone ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {stepQuestions.map(field)}
          </div>
        ) : (
          <div className="rounded-xl border border-[#ecebe7] bg-white p-6">
            <h2 className="text-[15px] font-bold text-[#171717]">
              {zh ? "基础档案已完成" : "Profile complete"}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#3f4650]">
              {STEPS.slice(0, 3).map((s, i) => {
                const okStep = stepComplete(i);
                return (
                  <li key={s.key} className="flex items-center gap-2">
                    <span
                      className={
                        "grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold text-white " +
                        (okStep ? "bg-[#2e7d4f]" : "bg-[#c9c5bc]")
                      }
                    >
                      {okStep ? "✓" : ""}
                    </span>
                    {zh ? s.zh : s.en}
                    <span className="text-xs text-[#8c8982]">
                      {okStep ? (zh ? "已完成" : "Done") : zh ? "待完善" : "Incomplete"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy}
                className="btn btn-primary text-sm disabled:opacity-60"
              >
                {busy ? (zh ? "提交中…" : "Submitting…") : zh ? "提交审核" : "Submit for review"}
              </button>
              <a href={`/${locale === "zh" ? "zh" : locale}/supplier-assessment`} className="btn btn-outline text-sm">
                {zh ? "去填专项模块" : "Fill specialist modules"}
              </a>
            </div>
          </div>
        )}

        {msg ? (
          <p className="mt-4 rounded-md bg-[#fdf3f3] px-3 py-2 text-sm text-[#b42318]">{msg}</p>
        ) : null}

        {/* 底部按钮 */}
        <div className="mt-8 flex items-center gap-3">
          {stepIdx > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={busy}
              className="rounded-md border border-[#d9d5cc] bg-white px-5 py-2.5 text-sm font-semibold text-[#171717] hover:bg-[#f7f6f3] disabled:opacity-60"
            >
              ← {zh ? "上一页" : "Back"}
            </button>
          ) : null}
          {!isDone ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-[#e07a49] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d06c3c] disabled:opacity-60"
            >
              {busy ? (zh ? "保存中…" : "Saving…") : zh ? "下一页" : "Next"}
              <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 右侧：步骤条 ── */}
      <aside className="order-first lg:order-last">
        <ol className="space-y-0">
          {STEPS.map((s, i) => {
            const done = stepComplete(i);
            const current = i === stepIdx;
            return (
              <li key={s.key} className="relative flex gap-3 pb-8 last:pb-0">
                {/* 竖线 */}
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-[11px] top-6 h-full w-px bg-[#e4e0d8]"
                  />
                ) : null}
                {/* 圆点 */}
                <span
                  className={
                    "relative z-10 grid h-[23px] w-[23px] shrink-0 place-items-center rounded-full border text-[11px] font-bold " +
                    (done
                      ? "border-[#2e7d4f] bg-[#2e7d4f] text-white"
                      : current
                      ? "border-[#3d2bb5] bg-[#3d2bb5] text-white"
                      : "border-[#cfcbc2] bg-white text-[#9a968d]")
                  }
                >
                  {done ? "✓" : ""}
                </span>
                <span
                  className={
                    "text-[13px] leading-6 " +
                    (current ? "font-bold text-[#171717]" : done ? "font-medium text-[#3f4650]" : "text-[#8c8982]")
                  }
                >
                  {zh ? s.zh : s.en}
                </span>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
