"use client";
import { useEffect, useMemo, useState } from "react";
import {
  buildDimensions,
  computeRisk,
  LEVEL_COLOR,
  type RiskContent,
  type RiskEngineResult,
} from "@/lib/riskEngine";
import { localePath, type Locale } from "@/i18n/config";

const STORAGE_KEY = "fab_src_answers_v1";

export type RiskUiDict = {
  stepOf: string;
  // 底部计数器标签。此前直接渲染 "1/4"，与顶部 "Step 1 of 6" 看着像两个矛盾的进度数字，
  // 实际含义不同（顶部=第几个维度，底部=当前维度已答几题）。加标签消除歧义。
  answeredInStep: string;
  back: string;
  next: string;
  calculate: string;
  answerAll: string;
  scoreSuffix: string;
  breakdownTitle: string;
  weightNote: string;
  factorsTitle: string;
  actionsTitle: string;
  editAnswers: string;
  startOver: string;
  downloadReport: string;
  print: string;
  notAnswered: string;
  reportTitle: string;
  level: Record<string, string>;
  form: {
    title: string;
    firstName: string;
    company: string;
    email: string;
    country: string;
    sourcing: string;
    supplierName: string;
    supplierWebsite: string;
    submit: string;
    sending: string;
    done: string;
    error: string;
  };
  disclaimer: string;
};

type Props = { content: RiskContent; ui: RiskUiDict; locale: Locale };

export default function SupplierRiskCalculator({ content, ui, locale }: Props) {
  const dims = useMemo(() => buildDimensions(content), [content]);
  const [step, setStep] = useState(0); // 0..5 = dimensions, 6 = result
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RiskEngineResult | null>(null);
  const [showLead, setShowLead] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // 自动保存 / 恢复输入（§31）
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setAnswers(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {}
  }, [answers]);

  const totalSteps = dims.length;
  const dim = dims[step];
  const answeredInStep = dim ? dim.questions.filter((q) => answers[q.id]).length : 0;
  const allAnswered = useMemo(
    () => dims.every((d) => d.questions.every((q) => answers[q.id])),
    [answers, dims]
  );

  function choose(qid: string, val: string) {
    setAnswers((a) => ({ ...a, [qid]: val }));
  }

  function calculate() {
    setResult(computeRisk(answers, content));
    setStep(totalSteps);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setAnswers({});
    setResult(null);
    setShowLead(false);
    setSubmitted(false);
    setStep(0);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  async function submitLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!result) return;
    const form = new FormData(e.currentTarget);
    const lead = {
      firstName: String(form.get("firstName") || ""),
      company: String(form.get("company") || ""),
      email: String(form.get("email") || ""),
      country: String(form.get("country") || ""),
      sourcing: String(form.get("sourcing") || ""),
      supplierName: String(form.get("supplierName") || ""),
      supplierWebsite: String(form.get("supplierWebsite") || ""),
    };
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead,
          answers,
          result: { overall: result.overall, level: result.level },
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setSubmitted(true);
      setShowLead(false);
    } catch {
      setSaveMsg(ui.form.error);
    } finally {
      setSaving(false);
    }
  }

  const p = (href: string) => localePath(locale, href);
  const levelLabel = (lvl: string) => ui.level[lvl] ?? lvl;

  // ===== 结果视图 =====
  if (step >= totalSteps && result) {
    const color = LEVEL_COLOR[result.level];
    // 低/中风险主按钮给报告（留邮箱），偏高/高/极高主按钮给验证服务
    const primaryIsReport = result.level === "LOW" || result.level === "MODERATE";
    const secondaryIsChecklist = result.level === "MODERATE";

    return (
      <div className="space-y-6">
        <div className="card p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div
              className="w-32 h-32 rounded-full flex flex-col items-center justify-center text-white shrink-0"
              style={{ background: color }}
            >
              <span className="text-4xl font-extrabold leading-none">{result.overall}</span>
              <span className="text-xs opacity-90">/ 100</span>
            </div>
            <div className="flex-1">
              <div className="text-sm uppercase tracking-wide text-[#64748b]">
                {ui.scoreSuffix}
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color }}>
                {result.levelLabel}
              </div>
              <p className="text-sm text-[#64748b] mt-2">{ui.disclaimer}</p>
            </div>
          </div>

          <h3 className="font-semibold text-[#0f172a] mt-8 mb-3">{ui.breakdownTitle}</h3>
          <div className="space-y-3">
            {result.dimensions.map((d) => (
              <div key={d.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-[#0f172a]">
                    {d.label}{" "}
                    <span className="text-[#94a3b8] font-normal">
                      {ui.weightNote.replace("{weight}", String(d.weight))}
                    </span>
                  </span>
                  <span className="font-semibold" style={{ color: LEVEL_COLOR[d.level] }}>
                    {d.score} · {d.levelLabel}
                  </span>
                </div>
                <div className="h-2.5 bg-[#eef2f7] rounded-full">
                  <div
                    className="h-2.5 rounded-full"
                    style={{ width: `${d.score}%`, background: LEVEL_COLOR[d.level] }}
                  />
                </div>
              </div>
            ))}
          </div>

          {result.keyRiskFactors.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-[#0f172a] mb-2">{ui.factorsTitle}</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-[#475569]">
                {result.keyRiskFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-semibold text-[#0f172a] mb-2">{ui.actionsTitle}</h3>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-[#475569]">
              {result.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          </div>

          {/* 动态 CTA（§20）：按风险等级切换主次按钮 */}
          <div
            className="mt-6 rounded-xl p-5 border"
            style={{ background: "#f7f9fc", borderColor: color }}
          >
            <p className="font-semibold text-[#0f172a] mb-3">{result.cta.headline}</p>
            <div className="flex flex-wrap gap-3">
              {primaryIsReport ? (
                <button className="btn btn-primary" onClick={() => setShowLead(true)}>
                  {result.cta.primary}
                </button>
              ) : (
                <a className="btn btn-primary" href={p("/services/supplier-verification")}>
                  {result.cta.primary}
                </a>
              )}
              {result.cta.secondary &&
                (secondaryIsChecklist ? (
                  <a className="btn btn-outline" href={p("/tools/supplier-verification-checklist")}>
                    {result.cta.secondary}
                  </a>
                ) : (
                  <button className="btn btn-outline" onClick={() => setShowLead(true)}>
                    {result.cta.secondary}
                  </button>
                ))}
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button className="btn btn-outline" onClick={() => setStep(totalSteps - 1)}>
              {ui.editAnswers}
            </button>
            <button className="btn btn-outline" onClick={reset}>
              {ui.startOver}
            </button>
          </div>
        </div>

        {showLead && !submitted && (
          <div className="card p-6" id="lead-form">
            <h3 className="font-semibold text-[#0f172a] mb-1">{ui.form.title}</h3>
            {saveMsg && <p className="text-[#c0392b] text-sm mb-3">{saveMsg}</p>}
            <form onSubmit={submitLead} className="grid md:grid-cols-2 gap-3">
              <input className="input" name="firstName" placeholder={ui.form.firstName} required />
              <input className="input" name="company" placeholder={ui.form.company} required />
              <input
                className="input"
                name="email"
                type="email"
                placeholder={ui.form.email}
                required
              />
              <input className="input" name="country" placeholder={ui.form.country} />
              <input
                className="input md:col-span-2"
                name="sourcing"
                placeholder={ui.form.sourcing}
              />
              <input className="input" name="supplierName" placeholder={ui.form.supplierName} />
              <input
                className="input"
                name="supplierWebsite"
                placeholder={ui.form.supplierWebsite}
              />
              <button className="btn btn-primary md:col-span-2" type="submit" disabled={saving}>
                {saving ? ui.form.sending : ui.form.submit}
              </button>
            </form>
          </div>
        )}

        {submitted && (
          <div className="card p-6" id="full-report">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#0f172a]">{ui.reportTitle}</h3>
              <button className="btn btn-outline" onClick={() => window.print()}>
                {ui.print}
              </button>
            </div>
            <p className="text-sm text-[#64748b]">
              {ui.form.done}
            </p>
            <p className="text-sm text-[#64748b] mt-3">
              {ui.scoreSuffix}: <strong>{result.overall}/100</strong> — {result.levelLabel}
            </p>
            <div className="mt-4 space-y-4">
              {result.dimensions.map((d) => (
                <div key={d.key} className="border-b border-[#e2e8f0] pb-3">
                  <div className="font-medium text-[#0f172a]">
                    {d.label} — {d.score}/100 ({d.levelLabel})
                  </div>
                  <ul className="text-sm text-[#475569] mt-1 pl-4">
                    {d.answers.map((a) => (
                      <li key={a.questionId}>
                        {a.text}: <span className="font-medium">{a.optionLabel}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="font-medium text-[#0f172a]">{ui.actionsTitle}</div>
              <ol className="list-decimal pl-5 text-sm text-[#475569] mt-1">
                {result.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </div>
            <p className="text-xs text-[#94a3b8] mt-6">{ui.disclaimer}</p>
          </div>
        )}
      </div>
    );
  }

  // ===== 输入视图（分步） =====
  return (
    <div className="card p-6 md:p-8">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-[#64748b] mb-2">
          <span>{ui.stepOf.replace("{n}", String(step + 1))}</span>
          <span>{dim.label}</span>
        </div>
        <div className="h-2 bg-[#eef2f7] rounded-full">
          <div
            className="h-2 rounded-full bg-[#0f4c81] transition-all"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="text-xl font-bold text-[#0f172a]">{dim.label}</h2>
      <p className="text-sm text-[#64748b] mb-5">{dim.description}</p>

      <div className="space-y-5">
        {dim.questions.map((q) => (
          <div key={q.id}>
            <div className="font-medium text-[#0f172a] mb-2">{q.text}</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {q.options.map((o) => {
                const active = answers[q.id] === o.value;
                return (
                  <label
                    key={o.value}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm transition ${
                      active
                        ? "border-[#0f4c81] bg-brand-100 text-[#0f4c81] font-medium"
                        : "border-[#e2e8f0] hover:border-[#0f4c81]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      className="accent-[#0f4c81]"
                      checked={active}
                      onChange={() => choose(q.id, o.value)}
                    />
                    {o.label}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-8">
        <button
          className="btn btn-outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          {ui.back}
        </button>
        <span className="text-xs text-[#94a3b8]">
          {ui.answeredInStep
            .replace("{done}", String(answeredInStep))
            .replace("{total}", String(dim.questions.length))}
        </span>
        {step < totalSteps - 1 ? (
          <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
            {ui.next}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={calculate} disabled={!allAnswered}>
            {ui.calculate}
          </button>
        )}
      </div>
      {step === totalSteps - 1 && !allAnswered && (
        <p className="text-xs text-[#c0392b] mt-3 text-right">{ui.answerAll}</p>
      )}
    </div>
  );
}
