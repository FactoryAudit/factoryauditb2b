"use client";

import { useState } from "react";
import type { RfqRecommendation } from "@/lib/rfqMatching";

export type MatchPanelDict = {
  title: string;
  empty: string;
  confirm: string;
  confirming: string;
  done: string;
  failed: string;
  score: string;
  reasons: string;
};

export default function RfqMatchPanel({
  referenceId,
  recommendations,
  dict,
}: {
  referenceId: string;
  recommendations: RfqRecommendation[];
  dict: MatchPanelDict;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function confirm() {
    setState("loading");
    try {
      const res = await fetch(`/api/admin/rfqs/${referenceId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierIds: selected }),
      });
      const data = await res.json();
      if (data.ok) {
        setState("ok");
        setMsg(`${dict.done} (+${data.inserted ?? 0}${data.skipped ? `, skip ${data.skipped}` : ""})`);
      } else {
        setState("error");
        setMsg(data.error ?? dict.failed);
      }
    } catch {
      setState("error");
      setMsg(dict.failed);
    }
  }

  if (recommendations.length === 0) {
    return (
      <div className="card p-4 mt-4">
        <h2 className="font-semibold text-[#0f172a]">{dict.title}</h2>
        <p className="mt-2 text-sm text-[#64748b]">{dict.empty}</p>
      </div>
    );
  }

  return (
    <div className="card p-4 mt-4">
      <h2 className="font-semibold text-[#0f172a]">{dict.title}</h2>
      <div className="mt-3 space-y-2">
        {recommendations.map((r) => (
          <label
            key={r.supplierId}
            className="flex items-start gap-3 rounded border border-[#e2e8f0] p-3 hover:bg-[#f7f9fc]"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={selected.includes(r.supplierId)}
              onChange={() => toggle(r.supplierId)}
            />
            <div className="text-sm">
              <div className="font-medium text-[#0f172a]">{r.legalName}</div>
              <div className="text-xs text-[#64748b]">
                {[r.city, r.province, r.countryCode, r.industryCode].filter(Boolean).join(" · ")}
              </div>
              {r.mainProducts.length > 0 && (
                <div className="text-xs text-[#94a3b8]">{r.mainProducts.slice(0, 4).join(", ")}</div>
              )}
              <div className="text-xs text-[#0f4c81]">
                {dict.score}: {r.score} · {dict.reasons}: {r.reasons.join("; ")}
              </div>
            </div>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={confirm}
        disabled={selected.length === 0 || state === "loading"}
        className="btn btn-accent mt-3"
      >
        {state === "loading" ? dict.confirming : dict.confirm}
      </button>
      {msg && (
        <p className={`mt-2 text-sm ${state === "error" ? "text-[#d4232a]" : "text-[#1f7a36]"}`}>{msg}</p>
      )}
    </div>
  );
}
