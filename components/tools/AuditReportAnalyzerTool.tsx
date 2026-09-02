"use client";
import { useState } from "react";
import type { ReportAnalyzerUi } from "@/lib/toolUiTypes";

export default function AuditReportAnalyzerTool({ ui }: { ui: ReportAnalyzerUi }) {
  const [text, setText] = useState("");
  const [report, setReport] = useState<{ score: number; issues: string[]; source: "ai" | "local" } | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    try {
      const res = await fetch("/api/report-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: text })
      });
      const data = await res.json();
      setReport({ score: data.score, issues: data.issues ?? [], source: data.source });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="card p-6 space-y-3">
        <label className="text-sm font-medium">{ui.inputLabel}</label>
        <textarea
          className="textarea h-64"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={ui.inputPlaceholder}
        />
        <button className="btn btn-primary w-full" onClick={analyze} disabled={loading}>
          {loading ? ui.ctaLoading : ui.cta}
        </button>
      </div>
      <div className="card p-6">
        {!report ? (
          <div className="text-[#94a3b8] text-sm">{ui.empty}</div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="text-4xl font-extrabold text-[#0f4c81]">
                {ui.qualityLabel} {report.score}{ui.scoreSuffix}
              </div>
              <span className={`badge ${report.source === "ai" ? "badge-verified" : "badge-estimated"}`}>
                {report.source === "ai" ? "AI" : "LOCAL"}
              </span>
            </div>
            <div className="text-xs text-[#64748b] mb-4">
              {report.source === "ai" ? ui.sourceAi : ui.sourceLocal}
            </div>
            <div className="text-sm font-semibold mb-2">{ui.issuesTitle}</div>
            {report.issues.length === 0 ? (
              <div className="text-[#1f7a36] text-sm">{ui.issuesNone}</div>
            ) : (
              <ul className="list-disc pl-5 text-sm text-[#c0392b]">{report.issues.map((m, i) => <li key={i}>{m}</li>)}</ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
