"use client";

import { useState } from "react";

export function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
