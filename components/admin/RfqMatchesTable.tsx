"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MATCH_TRANSITIONS, type MatchStatus, type RfqMatchRow } from "@/lib/matchStatus";

// STEP 13 CHANGE SET D —— 已确认匹配的跟进面板
//
// 职责：把 suggested 推进到 contacted，再到 won / lost —— **真实写库**（PATCH），
//       不是只改前端状态；刷新后仍保持（spec §12）。
//
// 🔴 只显示**合法**的下一步按钮（流转表来自 lib/rfqMatching.ts，与 API 同源）。
//    won / lost 是终态 ⇒ 不显示任何按钮。取消推荐用 lost 表达，**从不 DELETE**。

export type MatchesTableDict = {
  title: string;
  empty: string;
  supplier: string;
  status: string;
  note: string;
  createdAt: string;
  saving: string;
  failed: string;
  statusLabel: Record<string, string>;
  actionLabel: Record<string, string>;
};

const ACTION_ORDER: MatchStatus[] = ["contacted", "won", "lost"];

export default function RfqMatchesTable({
  referenceId,
  matches,
  dict,
}: {
  referenceId: string;
  matches: RfqMatchRow[];
  dict: MatchesTableDict;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState<string>("");

  async function advance(supplierId: string, status: MatchStatus) {
    setBusy(supplierId + ":" + status);
    setErr("");
    try {
      const res = await fetch(`/api/admin/rfqs/${referenceId}/match`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, status }),
      });
      const data = await res.json();
      if (data.ok) {
        router.refresh();
      } else {
        setErr(`${dict.failed}: ${data.error ?? "unknown"}`);
      }
    } catch {
      setErr(dict.failed);
    } finally {
      setBusy("");
    }
  }

  const chip = (s: string) =>
    s === "won"
      ? "bg-[#e7f6ec] text-[#1f7a36]"
      : s === "lost"
        ? "bg-[#fdeaea] text-[#d4232a]"
        : s === "contacted"
          ? "bg-[#e6eef6] text-[#0f4c81]"
          : "bg-[#fdf3d8] text-[#8a5a00]";

  return (
    <div className="card mt-4 p-4">
      <h2 className="font-semibold text-[#0f172a]">{dict.title}</h2>
      {matches.length === 0 ? (
        <p className="mt-2 text-sm text-[#64748b]">{dict.empty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {matches.map((m) => {
            const allowed = (MATCH_TRANSITIONS[m.status as MatchStatus] ?? []).filter((s) =>
              ACTION_ORDER.includes(s)
            );
            return (
              <div key={m.matchId} className="flex flex-wrap items-start gap-3 rounded border border-[#e2e8f0] p-3">
                <div className="min-w-[220px] flex-1 text-sm">
                  <div className="font-medium text-[#0f172a]">{m.legalName}</div>
                  <div className="text-xs text-[#64748b]">
                    {[m.city, m.province, m.countryCode, m.industryCode].filter(Boolean).join(" · ") || "—"}
                  </div>
                  {m.mainProducts.length > 0 && (
                    <div className="text-xs text-[#94a3b8]">{m.mainProducts.slice(0, 4).join(", ")}</div>
                  )}
                  <div className="mt-0.5 text-[11px] text-[#94a3b8]">
                    {dict.createdAt}: {m.createdAt ? m.createdAt.slice(0, 10) : "—"}
                    {m.note ? ` · ${dict.note}: ${m.note}` : ""}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chip(m.status)}`}>
                    {dict.statusLabel[m.status] ?? m.status}
                  </span>
                  {allowed.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => advance(m.supplierId, s)}
                      disabled={busy !== ""}
                      className="rounded border border-[#cbd5e1] px-2.5 py-1 text-xs text-[#0f4c81] hover:bg-[#f0f5fb] disabled:opacity-50"
                    >
                      {busy === m.supplierId + ":" + s ? dict.saving : dict.actionLabel[s]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {err && <p className="mt-2 text-sm text-[#d4232a]">{err}</p>}
    </div>
  );
}
