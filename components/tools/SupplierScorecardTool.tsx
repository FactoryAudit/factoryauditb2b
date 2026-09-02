"use client";
import { useState } from "react";
import type { ScorecardUi } from "@/lib/toolUiTypes";

const KEYS = ["quality", "price", "capacity", "delivery", "compliance", "financial", "certification", "communication", "risk"] as const;
const DEFAULTS: Record<(typeof KEYS)[number], number> = {
  quality: 20, price: 15, capacity: 15, delivery: 15, compliance: 10,
  financial: 10, certification: 5, communication: 5, risk: 5,
};

export default function SupplierScorecardTool({ ui }: { ui: ScorecardUi }) {
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(KEYS.map((k) => [k, DEFAULTS[k]]))
  );
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(KEYS.map((k) => [k, 70]))
  );

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const overall = totalWeight === 0 ? 0 : Math.round(
    KEYS.reduce((a, k) => a + (scores[k] * weights[k]), 0) / totalWeight
  );

  return (
    <div className="card p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-3xl font-extrabold text-[#0f4c81]">{ui.overallLabel}: {overall}</span>
        <span className="text-xs text-[#64748b]">{ui.totalWeightLabel}: {totalWeight}%</span>
      </div>
      <div className="space-y-3">
        {KEYS.map((k) => (
          <div key={k} className="grid grid-cols-3 gap-3 items-center">
            <label className="text-sm font-medium">{ui.criteria[k]}</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748b] w-12">{ui.weightLabel}</span>
              <input className="input" type="number" value={weights[k]} onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) || 0 }))} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748b] w-10">{ui.scoreLabel}</span>
              <input className="input" type="number" value={scores[k]} onChange={(e) => setScores((s) => ({ ...s, [k]: Number(e.target.value) || 0 }))} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
