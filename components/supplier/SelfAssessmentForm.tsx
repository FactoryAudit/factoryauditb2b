"use client";

import { useState } from "react";
import type { AssessmentTemplate } from "@/lib/supplierAssessments";

type Props = {
  templates: AssessmentTemplate[];
  locale: string;
  supplierId: string;
  email: string;
  initialResponses: Record<string, string> | null;
  initialSummary: string | null;
};

// 复合键：template|section|question（question_code 跨模板重复，不可单独作键）
function keyOf(tpl: string, sec: string, q: string): string {
  return `${tpl}|${sec}|${q}`;
}

export default function SelfAssessmentForm({
  templates,
  locale,
  supplierId,
  email,
  initialResponses,
  initialSummary,
}: Props) {
  const [responses, setResponses] = useState<Record<string, string>>(initialResponses ?? {});
  const [summary, setSummary] = useState<string>(initialSummary ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const total = templates.reduce(
    (n, t) => n + t.sections.reduce((m, s) => m + s.questions.length, 0),
    0
  );
  const answered = Object.keys(responses).filter((k) => responses[k]).length;

  function setAnswer(k: string, v: string) {
    setResponses((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      setResult({ ok: false, message: "Missing supplier ID. Please open this page from your registration confirmation." });
      return;
    }
    if (!email) {
      setResult({ ok: false, message: "Missing email. Please provide the contact email used at registration." });
      return;
    }
    if (answered < total) {
      setResult({ ok: false, message: `Please answer all ${total} checkpoints (${answered}/${total} done) before submitting.` });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/supplier-self-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, email, responses, summary }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setResult({ ok: true, message: "Submitted. Our team will review and publish your Factory Self-Assessment." });
      } else {
        setResult({ ok: false, message: data?.error ? `Submission failed: ${data.error}` : "Submission failed." });
      }
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="card p-4 flex flex-wrap items-center gap-4 text-sm text-[#334155]">
        <span>
          Progress: <strong className="text-[#0f172a]">{answered}</strong> / {total} checkpoints answered
        </span>
        {supplierId ? (
          <span className="text-[#16a34a]">✓ Supplier linked</span>
        ) : (
          <span className="text-[#b45309]">⚠ No supplier ID — open from your registration confirmation link</span>
        )}
      </div>

      {templates.map((tpl) => (
        <section key={tpl.code} className="card p-6">
          <h2 className="text-2xl font-bold text-[#0f172a]">{tpl.nameZh || tpl.name}</h2>
          <p className="text-[#64748b] mt-1">{tpl.name}</p>
          {tpl.description && <p className="text-sm text-[#94a3b8] mt-1">{tpl.description}</p>}

          {tpl.sections.map((sec) => (
            <div key={sec.code} className="mt-6">
              <h3 className="text-lg font-semibold text-[#0f4c81] border-l-4 border-[#0f4c81] pl-3">
                {sec.code}. {sec.titleZh || sec.title}
              </h3>
              <div className="mt-3 space-y-4">
                {sec.questions.map((q) => {
                  const k = keyOf(tpl.code, sec.code, q.code);
                  const opts = q.options ?? ["C", "PC", "NC", "NA"];
                  return (
                    <div key={k} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-[#0f172a]">
                            <span className="text-[#64748b]">{q.code}</span> {q.titleZh || q.title}
                          </p>
                          {q.title && q.titleZh && <p className="text-xs text-[#94a3b8]">{q.title}</p>}
                          {q.requirementZh && (
                            <p className="text-xs text-[#64748b] mt-1">证据：{q.requirementZh}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {opts.map((o) => (
                          <label
                            key={o}
                            className={`px-3 py-1 rounded-full border text-sm cursor-pointer select-none ${
                              responses[k] === o
                                ? "bg-[#0f4c81] text-white border-[#0f4c81]"
                                : "bg-[#f8fafc] text-[#334155] border-[#e2e8f0]"
                            }`}
                          >
                            <input
                              type="radio"
                              name={k}
                              value={o}
                              checked={responses[k] === o}
                              onChange={() => setAnswer(k, o)}
                              className="sr-only"
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}

      <section className="card p-6">
        <h3 className="text-lg font-semibold text-[#0f172a]">自评说明 / Self-assessment summary</h3>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="补充整体自评说明（可选）"
          className="mt-2 w-full border rounded-lg p-3 text-sm"
        />
      </section>

      {result && (
        <div
          className={`p-4 rounded-lg text-sm ${
            result.ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary px-6 py-3 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "提交自评估 / Submit self-assessment"}
        </button>
        <span className="text-xs text-[#94a3b8]">
          {locale} · FactoryAuditB2B
        </span>
      </div>
    </form>
  );
}
