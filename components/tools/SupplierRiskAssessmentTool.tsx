"use client";
import { useState } from "react";
import { INDUSTRIES } from "@/lib/data";
import type { RiskResult } from "@/lib/scoring";
import type { RiskAssessmentUi } from "@/lib/toolUiTypes";

const EMP_RANGES = ["1-50", "51-100", "101-200", "201-500", "501-1000", "1000+"];
const COUNTRIES = ["china", "vietnam", "thailand", "india", "indonesia", "bangladesh", "malaysia", "turkey", "mexico"];

const BADGE_BY_STATUS: Record<string, string> = {
  "Verified": "badge-verified",
  "Self-Reported": "badge-self",
  "Estimated": "badge-estimated",
  "Not Verified": "badge-notverified",
};

export default function SupplierRiskAssessmentTool({ ui }: { ui: RiskAssessmentUi }) {
  const [form, setForm] = useState({
    supplierName: "", website: "", country: "china", city: "", productCategory: "",
    businessType: "Factory", yearsInBusiness: "", employeeRange: "", exportMarkets: "",
    hasBusinessLicense: false, hasIso: false, hasAuditReport: false, hasCatalog: false, hasProductCert: false
  });
  const [result, setResult] = useState<RiskResult | null>(null);
  const [source, setSource] = useState<"ai" | "local" | null>(null);
  const [loading, setLoading] = useState(false);

  function update(k: string, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  async function run() {
    setLoading(true);
    const body = { ...form, yearsInBusiness: Number(form.yearsInBusiness) || 0 };
    try {
      const res = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      setResult(data.result);
      setSource(data.source);
    } finally {
      setLoading(false);
    }
  }

  const docFields: [string, string][] = [
    ["hasBusinessLicense", ui.businessLicense],
    ["hasIso", ui.isoCertificate],
    ["hasAuditReport", ui.auditReport],
    ["hasCatalog", ui.catalog],
    ["hasProductCert", ui.productCertificates],
  ];

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm font-medium">{ui.supplierName}</label><input className="input" value={form.supplierName} onChange={(e) => update("supplierName", e.target.value)} /></div>
          <div><label className="text-sm font-medium">{ui.website}</label><input className="input" value={form.website} onChange={(e) => update("website", e.target.value)} /></div>
          <div><label className="text-sm font-medium">{ui.country}</label>
            <select className="select" value={form.country} onChange={(e) => update("country", e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{ui.countryNames[c] ?? c}</option>)}
            </select>
          </div>
          <div><label className="text-sm font-medium">{ui.city}</label><input className="input" value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
          <div><label className="text-sm font-medium">{ui.productCategory}</label>
            <select className="select" value={form.productCategory} onChange={(e) => update("productCategory", e.target.value)}>
              <option value="">{ui.selectOption}</option>
              {/* value 必须是英文常量（评分引擎按英文匹配），只有显示文本走字典 */}
              {INDUSTRIES.map((i, idx) => <option key={i} value={i}>{ui.industryNames?.[idx] ?? i}</option>)}
            </select>
          </div>
          <div><label className="text-sm font-medium">{ui.businessType}</label>
            <select className="select" value={form.businessType} onChange={(e) => update("businessType", e.target.value)}>
              <option value="Factory">{ui.businessTypeFactory}</option>
              <option value="Trading Company">{ui.businessTypeTrading}</option>
            </select>
          </div>
          <div><label className="text-sm font-medium">{ui.yearsInBusiness}</label><input className="input" type="number" value={form.yearsInBusiness} onChange={(e) => update("yearsInBusiness", e.target.value)} /></div>
          <div><label className="text-sm font-medium">{ui.employeeRange}</label>
            <select className="select" value={form.employeeRange} onChange={(e) => update("employeeRange", e.target.value)}>
              <option value="">{ui.selectOption}</option>{EMP_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div><label className="text-sm font-medium">{ui.exportMarkets}</label><input className="input" value={form.exportMarkets} onChange={(e) => update("exportMarkets", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {docFields.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={(form as any)[k]} onChange={(e) => update(k, e.target.checked)} /> {label}
            </label>
          ))}
        </div>
        <button className="btn btn-primary w-full" onClick={run} disabled={loading}>{loading ? ui.ctaLoading : ui.cta}</button>
      </div>

      <div className="card p-6">
        {!result ? (
          <div className="text-[#94a3b8] text-sm">{ui.empty}</div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl font-extrabold text-[#0f4c81]">{result.overall}<span className="text-xl text-[#64748b]">/100</span></div>
              <div>
                <div className="text-lg font-bold">
                  {ui.levels[result.level as keyof RiskAssessmentUi["levels"]] ?? result.level} {ui.levelSuffix}
                </div>
                <div className="text-xs text-[#64748b]">
                  {source === "ai" ? ui.sourceAi : ui.sourceLocal}
                </div>
              </div>
              {source && (
                <span className={`badge ${source === "ai" ? "badge-verified" : "badge-estimated"} ml-auto`}>
                  {source === "ai" ? "AI" : "LOCAL"}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {result.dimensions.map((d) => (
                <div key={d.key}>
                  <div className="flex justify-between text-sm mb-1 gap-2">
                    <span className="font-medium">{ui.dimensions[d.key as keyof RiskAssessmentUi["dimensions"]] ?? d.label}</span>
                    <span className={`badge ${BADGE_BY_STATUS[d.status] ?? "badge-estimated"}`}>
                      {ui.status[d.status as keyof RiskAssessmentUi["status"]] ?? d.status}
                    </span>
                  </div>
                  <div className="h-2 bg-[#eef2f7] rounded-full"><div className="h-2 rounded-full bg-[#0f4c81]" style={{ width: `${d.score}%` }} /></div>
                  <div className="text-right text-xs text-[#64748b]">{d.score}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
