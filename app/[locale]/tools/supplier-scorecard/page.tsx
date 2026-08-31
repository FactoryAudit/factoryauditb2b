"use client";
import { useState } from "react";

const CRITERIA = [
  { key: "quality", label: "Quality", def: 20 },
  { key: "price", label: "Price", def: 15 },
  { key: "capacity", label: "Capacity", def: 15 },
  { key: "delivery", label: "Delivery", def: 15 },
  { key: "compliance", label: "Compliance", def: 10 },
  { key: "financial", label: "Financial Stability", def: 10 },
  { key: "certification", label: "Certification", def: 5 },
  { key: "communication", label: "Communication", def: 5 },
  { key: "risk", label: "Risk", def: 5 }
];

export default function ScorecardPage() {
  const [weights, setWeights] = useState<Record<string, number>>(Object.fromEntries(CRITERIA.map((c) => [c.key, c.def])));
  const [scores, setScores] = useState<Record<string, number>>(Object.fromEntries(CRITERIA.map((c) => [c.key, 70])));

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const overall = totalWeight === 0 ? 0 : Math.round(
    CRITERIA.reduce((a, c) => a + (scores[c.key] * weights[c.key]), 0) / totalWeight
  );

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold text-[#0f172a]">Supplier Evaluation Scorecard</h1>
      <p className="text-[#64748b] mt-2 mb-6">Set weights and scores to compute an overall supplier score. Weights are fully customizable.</p>
      <div className="card p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-3xl font-extrabold text-[#0f4c81]">Overall: {overall}</span>
          <span className="text-xs text-[#64748b]">Total weight: {totalWeight}%</span>
        </div>
        <div className="space-y-3">
          {CRITERIA.map((c) => (
            <div key={c.key} className="grid grid-cols-3 gap-3 items-center">
              <label className="text-sm font-medium">{c.label}</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748b] w-12">Weight</span>
                <input className="input" type="number" value={weights[c.key]} onChange={(e) => setWeights((w) => ({ ...w, [c.key]: Number(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748b] w-10">Score</span>
                <input className="input" type="number" value={scores[c.key]} onChange={(e) => setScores((s) => ({ ...s, [c.key]: Number(e.target.value) || 0 }))} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
