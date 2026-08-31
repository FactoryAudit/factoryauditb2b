"use client";
import { useState } from "react";
import { INDUSTRIES } from "@/lib/data";
import type { RiskInput, RiskResult } from "@/lib/scoring";

const EMP_RANGES = ["1-50", "51-100", "101-200", "201-500", "501-1000", "1000+"];
const COUNTRIES = ["china", "vietnam", "thailand", "india", "indonesia", "bangladesh", "malaysia", "turkey", "mexico"];

export default function SupplierRiskPage() {
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
    const body: RiskInput = { ...form, yearsInBusiness: Number(form.yearsInBusiness) || 0 } as RiskInput;
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

  const badgeClass: Record<string, string> = {
    "Verified": "badge-verified", "Self-Reported": "badge-self",
    "Estimated": "badge-estimated", "Not Verified": "badge-notverified"
  };

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold text-[#0f172a]">Supplier Risk Assessment</h1>
      <p className="text-[#64748b] mt-2 mb-6">Enter supplier details to generate an initial risk score. Evidence status is shown per dimension — we never present estimates as facts.</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Supplier Name</label><input className="input" value={form.supplierName} onChange={(e) => update("supplierName", e.target.value)} /></div>
            <div><label className="text-sm font-medium">Website</label><input className="input" value={form.website} onChange={(e) => update("website", e.target.value)} /></div>
            <div><label className="text-sm font-medium">Country</label>
              <select className="select" value={form.country} onChange={(e) => update("country", e.target.value)}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="text-sm font-medium">City</label><input className="input" value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
            <div><label className="text-sm font-medium">Product Category</label>
              <select className="select" value={form.productCategory} onChange={(e) => update("productCategory", e.target.value)}>
                <option value="">Select</option>{INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div><label className="text-sm font-medium">Business Type</label>
              <select className="select" value={form.businessType} onChange={(e) => update("businessType", e.target.value)}>
                <option value="Factory">Factory</option><option value="Trading Company">Trading Company</option>
              </select>
            </div>
            <div><label className="text-sm font-medium">Years in Business</label><input className="input" type="number" value={form.yearsInBusiness} onChange={(e) => update("yearsInBusiness", e.target.value)} /></div>
            <div><label className="text-sm font-medium">Employee Range</label>
              <select className="select" value={form.employeeRange} onChange={(e) => update("employeeRange", e.target.value)}>
                <option value="">Select</option>{EMP_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-sm font-medium">Export Markets (comma separated)</label><input className="input" value={form.exportMarkets} onChange={(e) => update("exportMarkets", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {[["hasBusinessLicense", "Business License"], ["hasIso", "ISO Certificate"], ["hasAuditReport", "Audit Report"], ["hasCatalog", "Catalog"], ["hasProductCert", "Product Certificates"]].map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={(form as any)[k]} onChange={(e) => update(k, e.target.checked)} /> {label}
              </label>
            ))}
          </div>
          <button className="btn btn-primary w-full" onClick={run} disabled={loading}>{loading ? "Analyzing…" : "Generate Risk Score"}</button>
        </div>

        <div className="card p-6">
          {!result ? (
            <div className="text-[#94a3b8] text-sm">Fill the form and click generate to see the risk breakdown.</div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl font-extrabold text-[#0f4c81]">{result.overall}<span className="text-xl text-[#64748b]">/100</span></div>
                <div>
                  <div className="text-lg font-bold">{result.level} RISK</div>
                  <div className="text-xs text-[#64748b]">
                    {source === "ai" ? "AI-generated (DeepSeek) · decision-support" : "Rule-based estimate — not official verification"}
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
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{d.label}</span>
                      <span className={`badge ${badgeClass[d.status]}`}>{d.status}</span>
                    </div>
                    <div className="h-2 bg-[#eef2f7] rounded-full"><div className="h-2 rounded-full bg-[#0f4c81]" style={{ width: `${d.score}%` }} /></div>
                    <div className="text-right text-xs text-[#64748b]">{d.score}</div>
                  </div>
                ))}
              </div>
              {/* 调试用原始 JSON 已移除：此前把整个 result 对象直接打印给用户，
                  既没有信息价值也显得未完成。如需排查，用浏览器 devtools 看 /api/risk 响应。 */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
