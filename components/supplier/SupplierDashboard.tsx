"use client";

import { useState } from "react";

export type DashboardStats = {
  profileViews: number;
  uniqueVisitors: number;
  shares: number;
  buyerActions: number;
  reportDownloads: number;
};

/**
 * CS-E：供应商看板（客户端部分）。
 *
 * 服务端已用 resolveSupplierAccess 裁决归属，本组件只渲染聚合统计 + 分享链接复制。
 * 统计数字由服务端经 lib/visibility.ts（service_role）聚合后传入，绝不含买家个人信息。
 * 分享链接走既有 /api/supplier-share（只返回 share_token，绝不暴露内部 supplier UUID）。
 */
export default function SupplierDashboard({
  slug,
  sd,
  stats,
  visibilityPoints,
}: {
  slug: string;
  sd: Record<string, string>;
  stats: DashboardStats;
  visibilityPoints: number | null;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  async function copyLink() {
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch("/api/supplier-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(true);
        return;
      }
      const sharePath = j.sharePath as string;
      setLink(sharePath);
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}${sharePath}`
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // 剪贴板不可用时仅展示链接，由用户手动复制
      }
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  const cards: Array<{ label: string; value: number }> = [
    { label: sd.profileViews ?? "Profile views", value: stats.profileViews },
    { label: sd.uniqueVisitors ?? "Unique visitors", value: stats.uniqueVisitors },
    { label: sd.shares ?? "Times shared", value: stats.shares },
    { label: sd.buyerActions ?? "Buyer actions", value: stats.buyerActions },
    { label: sd.reportDownloads ?? "Report downloads", value: stats.reportDownloads },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <section className="card p-6">
        <h2 className="text-lg font-bold text-[#171717]">{sd.statsTitle}</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-lg border border-[#ebe8e1] bg-white p-4 text-center"
            >
              <div className="text-2xl font-extrabold text-[#171717]">
                {c.value}
              </div>
              <div className="mt-1 text-xs text-[#6d6b66]">{c.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold text-[#171717]">{sd.visibilityTitle}</h2>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-3xl font-extrabold text-[#16a34a]">
            {visibilityPoints === null ? "—" : visibilityPoints}
          </span>
          <span className="text-sm text-[#6d6b66]">/ 100+</span>
        </div>
        <p className="mt-2 text-sm text-[#6d6b66]">{sd.visibilityDesc}</p>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold text-[#171717]">{sd.shareTitle}</h2>
        <p className="mt-2 text-sm text-[#6d6b66]">{sd.shareLead}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copyLink}
            disabled={busy}
            data-track="supplier_dashboard_share_copy"
            className="btn-primary px-5 py-2.5 disabled:opacity-60"
          >
            {busy
              ? "…"
              : copied
              ? (sd.copied ?? "Link copied")
              : (sd.copyLink ?? "Copy link")}
          </button>
          {link && (
            <code className="block max-w-full truncate rounded bg-[#f5f3ee] px-3 py-2 text-xs text-[#2b2b2b]">
              {link}
            </code>
          )}
        </div>
        {err && (
          <p className="mt-3 text-sm text-[#b45309]">
            {sd.shareFailed ?? "Could not create the link. Please try again."}
          </p>
        )}
      </section>
    </div>
  );
}
