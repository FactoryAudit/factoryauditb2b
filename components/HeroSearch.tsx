"use client";
import { useState } from "react";

export type HeroSearchDict = {
  tabSupplier: string;
  tabProduct: string;
  tabAudit: string;
  tabInspector: string;
  placeholderSupplier: string;
  placeholderProduct: string;
  placeholderAudit: string;
  placeholderInspector: string;
  search: string;
  combinedHint: string;
  noMatch: string;
  urlDetected: string;
  submitAssess: string;
  assessHint: string;
  formName: string;
  formEmail: string;
  formCompany: string;
  assessSubmit: string;
  assessSubmitting: string;
  assessSuccess: string;
  assessError: string;
};

export type SupplierHit = {
  slug: string;
  legalName: string;
  city: string;
  country: string;
  mainProducts: string[];
};

export default function HeroSearch({
  suppliers,
  t,
}: {
  suppliers: SupplierHit[];
  t: HeroSearchDict;
}) {
  const [tab, setTab] = useState<keyof HeroSearchDict>("tabSupplier");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<string[] | null>(null);
  const [noHit, setNoHit] = useState(false);
  const [assessStatus, setAssessStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const placeholderMap: Record<string, string> = {
    tabSupplier: t.placeholderSupplier,
    tabProduct: t.placeholderProduct,
    tabAudit: t.placeholderAudit,
    tabInspector: t.placeholderInspector,
  };

  function run() {
    const term = q.trim().toLowerCase();
    if (!term) {
      setResults(null);
      setNoHit(false);
      return;
    }
    const hits = suppliers
      .filter(
        (s) =>
          s.legalName.toLowerCase().includes(term) ||
          s.mainProducts.join(" ").toLowerCase().includes(term) ||
          s.city.toLowerCase().includes(term) ||
          s.country.includes(term)
      )
      .map((s) => `${s.legalName} — ${s.city}, ${s.country.toUpperCase()}`);
    setResults(hits.length ? hits : [t.noMatch.replace("{q}", q)]);
    // 未命中已收录供应商（或输入像网址/公司名）→ 引导提交初步评估，把 Hero 变成线索入口
    setNoHit(!hits.length);
    setAssessStatus("idle");
  }

  async function submitAssess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAssessStatus("loading");
    // await 前捕获表单元素，避免 currentTarget 被置空
    const formEl = e.currentTarget;
    const form = new FormData(e.currentTarget);
    const lead = {
      firstName: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      company: String(form.get("company") || ""),
      supplierName: q,
      supplierWebsite: q,
      sourcing: "Preliminary supplier assessment requested from homepage",
      tool: "hero-search",
    };
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead }),
      });
      const data = await res.json();
      if (data.ok) {
        setAssessStatus("ok");
        formEl.reset();
        return;
      }
      setAssessStatus("error");
    } catch {
      setAssessStatus("error");
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-[#ebe8e1] p-5 max-w-2xl">
      <div className="flex gap-2 mb-3 flex-wrap">
        {(["tabSupplier", "tabProduct", "tabAudit", "tabInspector"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              tab === k ? "bg-[#171717] text-white" : "bg-[#f5f3ee] text-[#3f4650]"
            }`}
          >
            {t[k]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder={placeholderMap[tab]}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
        />
        <button className="btn btn-primary" onClick={run}>
          {t.search}
        </button>
      </div>
      {results && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="text-xs font-semibold text-[#6d6b66] uppercase">
            {t.combinedHint}
          </div>
          {results.map((r, i) => (
            <div key={i} className="card p-3 text-[#171717]">
              {r}
            </div>
          ))}
        </div>
      )}
      {noHit && assessStatus !== "ok" && (
        <div className="mt-4 rounded-lg border border-[#171717]/20 bg-[#fbfaf7] p-4">
          <p className="text-sm font-semibold text-[#171717]">{t.urlDetected}</p>
          <p className="text-xs text-[#6d6b66] mt-1">{t.assessHint}</p>
          {assessStatus === "error" && (
            <p className="text-sm text-[#d4232a] mt-2">{t.assessError}</p>
          )}
          <form onSubmit={submitAssess} className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <div>
              <label className="text-xs font-medium text-[#3f4650]">{t.formName}</label>
              <input className="input" name="name" placeholder={t.formName} />
            </div>
            <div>
              <label className="text-xs font-medium text-[#3f4650]">{t.formEmail}</label>
              <input className="input" name="email" type="email" required placeholder={t.formEmail} />
            </div>
            <div>
              <label className="text-xs font-medium text-[#3f4650]">{t.formCompany}</label>
              <input className="input" name="company" placeholder={t.formCompany} />
            </div>
            <button
              type="submit"
              disabled={assessStatus === "loading"}
              className="btn btn-primary col-span-full md:col-span-3 mt-2"
            >
              {assessStatus === "loading" ? t.assessSubmitting : t.submitAssess}
            </button>
          </form>
        </div>
      )}
      {noHit && assessStatus === "ok" && (
        <div className="mt-4 card p-4 text-center bg-[#f0fdf4]">
          <div className="text-xl mb-1">✓</div>
          <p className="text-sm font-semibold text-[#1f7a36]">{t.assessSuccess}</p>
        </div>
      )}
    </div>
  );
}
