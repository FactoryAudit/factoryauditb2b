"use client";

import { useState } from "react";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";

type Props = {
  emailPlaceholder: string;
  cta: string;
  privacyNote: string;
  success: string;
  error: string;
};

/**
 * 「获取完整样例报告」留资表单。
 * 提交邮箱 → POST /api/lead（tool=sample-report），管理员邮件收到线索。
 * 状态文案全部来自字典，API 的英文 message 不直接展示给用户。
 */
export default function SampleReportForm({
  emailPlaceholder,
  cta,
  privacyNote,
  success,
  error,
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead: { tool: "sample-report", email: value } }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="rounded-md bg-[#e8f5ea] px-4 py-3 text-sm font-medium text-[#1f7a36]">
        {success}
      </p>
    );
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={emailPlaceholder}
          aria-label={emailPlaceholder}
          maxLength={254}
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="btn btn-primary shrink-0 disabled:opacity-60"
          data-track={ANALYTICS_EVENTS.registerCta}
        >
          {status === "loading" ? "…" : cta}
        </button>
      </form>
      <p className="mt-2 text-xs text-[#64748b]">{privacyNote}</p>
      {status === "error" && (
        <p className="mt-2 rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#c0392b]">
          {error}
        </p>
      )}
    </div>
  );
}
