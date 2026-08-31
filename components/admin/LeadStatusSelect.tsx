"use client";

import { useState, useTransition } from "react";

const STATUS = ["NEW", "CONTACTED", "QUALIFIED", "QUOTE_SENT", "WON", "LOST"] as const;

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-[#e6eef6] text-[#0f4c81] border-[#b9cfe4]",
  CONTACTED: "bg-[#fff7e6] text-[#8a5a00] border-[#f0d9a8]",
  QUALIFIED: "bg-[#e6f4ea] text-[#1f7a36] border-[#b7dfc4]",
  QUOTE_SENT: "bg-[#eef2ff] text-[#3b3fa0] border-[#c3cbf5]",
  WON: "bg-[#e6f4ea] text-[#12592a] border-[#8fcf9f]",
  LOST: "bg-[#fdeaea] text-[#9b1c1c] border-[#f2b8b8]",
};

export default function LeadStatusSelect({
  leadId,
  initialStatus,
}: {
  leadId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [saved, setSaved] = useState(initialStatus);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function onChange(next: string) {
    setStatus(next);
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/leads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: leadId, status: next }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "update_failed");
          setStatus(saved); // 回滚
          return;
        }
        setSaved(next);
      } catch {
        setError("network");
        setStatus(saved);
      }
    });
  }

  const dirty = status !== saved;

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="inline-flex items-center gap-2">
        <select
          value={status}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Lead status for ${leadId}`}
          className={`text-xs font-semibold px-2 py-1 rounded border cursor-pointer disabled:opacity-60 ${
            STATUS_STYLE[status] ?? STATUS_STYLE.NEW
          }`}
        >
          {STATUS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {pending && <span className="text-xs text-[#64748b]">…</span>}
        {!pending && dirty && <span className="text-xs text-[#a86a13]">unsaved</span>}
        {!pending && !dirty && saved !== initialStatus && (
          <span className="text-xs text-[#1f7a36]">saved</span>
        )}
      </div>
      {error && <span className="text-xs text-[#d4232a]">{error}</span>}
    </div>
  );
}
