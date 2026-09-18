"use client";

// components/admin/OrderStatusActions.tsx —— 后台订单状态操作（CS-17）
//
// 为什么状态流转要经 API 而不是直接改库：
//   "paid → pending_payment" 反向操作会把已收款订单退回未付。
//   状态机只写在 lib/commerce.ts canTransition() 一处，服务端是唯一裁决点。
//
// 失败处理：把服务端返回的 error 原样显示 —— 后台是单人工具，
//   "点了没反应"比"看到一个英文错误码"更难排查。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  referenceId: string;
  current: string;
  labels: { paid: string; cancel: string; refund: string; updated: string };
};

export default function OrderStatusActions({ referenceId, current, labels }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function setStatus(next: string) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(referenceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) {
        setDone(true);
        startTransition(() => router.refresh());
        return;
      }
      setError(data.error ?? "unknown_error");
    } catch {
      setError("network_error");
    } finally {
      setBusy(false);
    }
  }

  if (done && !error) {
    return <span className="text-xs text-[#166534]">{labels.updated}</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      {current === "pending_payment" && (
        <>
          <button
            type="button"
            disabled={busy || pending}
            onClick={() => setStatus("paid")}
            className="rounded-md bg-[#166534] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {labels.paid}
          </button>
          <button
            type="button"
            disabled={busy || pending}
            onClick={() => setStatus("cancelled")}
            className="rounded-md border border-[#e2e8f0] px-2.5 py-1 text-xs text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-60"
          >
            {labels.cancel}
          </button>
        </>
      )}
      {current === "paid" && (
        <button
          type="button"
          disabled={busy || pending}
          onClick={() => setStatus("refunded")}
          className="rounded-md border border-[#e2e8f0] px-2.5 py-1 text-xs text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-60"
        >
          {labels.refund}
        </button>
      )}
      {error && <span className="text-xs text-[#d4232a]">{error}</span>}
    </span>
  );
}
