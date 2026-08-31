"use client";
import { useState } from "react";

export default function AuditAnalyzerPage() {
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
    <div className="container py-12">
      <h1 className="text-3xl font-bold text-[#0f172a]">Audit Report Analyzer</h1>
      <p className="text-[#64748b] mt-2 mb-6">Paste an audit report to check structure, missing items and risk. This is an assessment / decision-support tool — it does NOT confirm official certification.</p>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="card p-6 space-y-3">
          <label className="text-sm font-medium">Paste audit report text</label>
          <textarea className="textarea h-64" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the audit report content here…" />
          <button className="btn btn-primary w-full" onClick={analyze} disabled={loading}>{loading ? "Analyzing…" : "Analyze Report"}</button>
        </div>
        <div className="card p-6">
          {!report ? (
            <div className="text-[#94a3b8] text-sm">Paste a report and run the analyzer.</div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-4xl font-extrabold text-[#0f4c81]">Report Quality {report.score}/100</div>
                <span className={`badge ${report.source === "ai" ? "badge-verified" : "badge-estimated"}`}>{report.source === "ai" ? "AI" : "LOCAL"}</span>
              </div>
              <div className="text-xs text-[#64748b] mb-4">{report.source === "ai" ? "AI-generated assessment (DeepSeek) · decision-support" : "Local heuristic · decision-support"}</div>
              <div className="text-sm font-semibold mb-2">Missing / Inconsistent Items</div>
              {report.issues.length === 0 ? (
                <div className="text-[#1f7a36] text-sm">No obvious missing items detected.</div>
              ) : (
                <ul className="list-disc pl-5 text-sm text-[#c0392b]">{report.issues.map((m, i) => <li key={i}>{m}</li>)}</ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
