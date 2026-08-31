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
  // 4 个 tab 走 dict；Freight 已按 V4.0 定位（物流是占位）移除
  const [tab, setTab] = useState<keyof HeroSearchDict>("tabSupplier");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<string[] | null>(null);

  const placeholderMap: Record<string, string> = {
    tabSupplier: t.placeholderSupplier,
    tabProduct: t.placeholderProduct,
    tabAudit: t.placeholderAudit,
    tabInspector: t.placeholderInspector,
  };

  function run() {
    const term = q.toLowerCase();
    if (!term) {
      setResults(null);
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
    setResults(
      hits.length
        ? hits
        : [t.noMatch.replace("{q}", q)]
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] p-5 max-w-2xl">
      <div className="flex gap-2 mb-3 flex-wrap">
        {(["tabSupplier", "tabProduct", "tabAudit", "tabInspector"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              tab === k ? "bg-[#0f4c81] text-white" : "bg-[#f1f5f9] text-[#64748b]"
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
          <div className="text-xs font-semibold text-[#64748b] uppercase">
            {t.combinedHint}
          </div>
          {results.map((r, i) => (
            <div key={i} className="card p-3 text-[#0f172a]">
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
