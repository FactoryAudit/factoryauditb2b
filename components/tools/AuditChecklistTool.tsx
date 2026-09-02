"use client";
import { useState } from "react";
import { generateChecklist, AUDIT_TYPES } from "@/lib/checklist";
import { INDUSTRIES } from "@/lib/data";
import type { AuditChecklistUi } from "@/lib/toolUiTypes";

const riskColor: Record<string, string> = { Low: "#2f9e44", Medium: "#e8a33d", High: "#d4232a" };

export default function AuditChecklistTool({ ui }: { ui: AuditChecklistUi }) {
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [auditType, setAuditType] = useState(AUDIT_TYPES[0]);
  const [items, setItems] = useState<any[] | null>(null);

  const RISK_LABEL: Record<string, string> = {
    Low: ui.riskLow, Medium: ui.riskMedium, High: ui.riskHigh,
  };

  function gen() { setItems(generateChecklist(industry, auditType)); }

  return (
    <div className="card p-6 max-w-3xl space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-sm font-medium">{ui.industryLabel}</label>
          {/* value 必须是英文常量（generateChecklist 按英文匹配），只有显示文本走字典 */}
          <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {INDUSTRIES.map((i, idx) => <option key={i} value={i}>{ui.industryNames?.[idx] ?? i}</option>)}
          </select>
        </div>
        <div><label className="text-sm font-medium">{ui.auditTypeLabel}</label>
          <select className="select" value={auditType} onChange={(e) => setAuditType(e.target.value)}>
            {AUDIT_TYPES.map((t, idx) => <option key={t} value={t}>{ui.auditTypeNames?.[idx] ?? t}</option>)}
          </select>
        </div>
      </div>
      <button className="btn btn-primary" onClick={gen}>{ui.cta}</button>

      {items && (
        <div className="mt-4">
          <div className="text-sm font-semibold mb-2">
            {ui.summary.replace("{n}", String(items.length))} · {ui.industryNames?.[INDUSTRIES.indexOf(industry)] ?? industry} · {ui.auditTypeNames?.[AUDIT_TYPES.indexOf(auditType)] ?? auditType}
          </div>
          <div className="space-y-2">
            {items.map((q, i) => (
              <div key={i} className="border border-[#e2e8f0] rounded-lg p-3">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-sm">{ui.questions?.[q.key]?.q ?? q.question}</span>
                  <span className="text-xs font-semibold whitespace-nowrap" style={{ color: riskColor[q.riskLevel] }}>
                    {RISK_LABEL[q.riskLevel] ?? q.riskLevel} {ui.riskSuffix}
                  </span>
                </div>
                <div className="text-xs text-[#64748b]">
                  {ui.categoryLabel}: {ui.questions?.[q.key]?.cat ?? q.category} · {ui.evidenceLabel}: {ui.questions?.[q.key]?.ev ?? q.evidenceRequired}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
