"use client";
import { useState } from "react";
import { generateChecklist, AUDIT_TYPES } from "@/lib/checklist";
import { INDUSTRIES } from "@/lib/data";

const riskColor: Record<string, string> = { Low: "#2f9e44", Medium: "#e8a33d", High: "#d4232a" };

export default function AuditChecklistPage() {
  const [industry, setIndustry] = useState("Electronics");
  const [auditType, setAuditType] = useState("Factory Audit");
  const [items, setItems] = useState<any[] | null>(null);

  function gen() { setItems(generateChecklist(industry, auditType)); }

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold text-[#0f172a]">Factory Audit Checklist Generator</h1>
      <p className="text-[#64748b] mt-2 mb-6">Generate a structured checklist by industry and audit type. This is a preparation / assessment tool — not an official certification.</p>
      <div className="card p-6 max-w-3xl space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm font-medium">Industry</label>
            <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)}>{INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}</select>
          </div>
          <div><label className="text-sm font-medium">Audit Type</label>
            <select className="select" value={auditType} onChange={(  e) => setAuditType(e.target.value)}>{AUDIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={gen}>Generate Checklist</button>

        {items && (
          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">{items.length} items · {industry} · {auditType}</div>
            <div className="space-y-2">
              {items.map((q, i) => (
                <div key={i} className="border border-[#e2e8f0] rounded-lg p-3">
                  <div className="flex justify-between"><span className="font-medium text-sm">{q.question}</span><span className="text-xs font-semibold" style={{ color: riskColor[q.riskLevel] }}>{q.riskLevel} Risk</span></div>
                  <div className="text-xs text-[#64748b]">Category: {q.category} · Evidence: {q.evidenceRequired}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
