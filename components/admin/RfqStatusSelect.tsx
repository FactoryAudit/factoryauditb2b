"use client";

import { useState } from "react";

// RFQ 状态下拉：改完立刻 PATCH，成功后刷新页面拿最新数据。
//
// 为什么不用乐观 UI：状态是唯一的协作真相，两个人同时看后台时
// 本地乐观更新会给彼此错误信号。宁可等一次网络往返。

export type RfqStatusSelectDict = {
  statusNew: string;
  statusReviewing: string;
  statusMatched: string;
  statusClosed: string;
  saving: string;
  error: string;
};

const OPTIONS: { value: string; key: keyof Omit<RfqStatusSelectDict, "saving" | "error"> }[] = [
  { value: "new", key: "statusNew" },
  { value: "reviewing", key: "statusReviewing" },
  { value: "matched", key: "statusMatched" },
  { value: "closed", key: "statusClosed" },
];

export default function RfqStatusSelect({
  referenceId,
  status,
  dict,
}: {
  referenceId: string;
  status: string;
  dict: RfqStatusSelectDict;
}) {
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const prev = value;
    setValue(next);
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch("/api/admin/rfqs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId, status: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        // 回滚到改动前的值，避免界面与数据库不一致
        setValue(prev);
        setFailed(true);
        return;
      }
      // 服务端数据已更新，刷新以同步列表排序 / 概览统计
      window.location.reload();
    } catch {
      setValue(prev);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={value}
        onChange={handleChange}
        disabled={saving}
        aria-label={referenceId}
        className="rounded-md border border-[#e2e8f0] bg-white px-2 py-1 text-xs text-[#0f172a] disabled:opacity-60"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {dict[o.key]}
          </option>
        ))}
      </select>
      {saving && <span className="text-xs text-[#64748b]">{dict.saving}</span>}
      {failed && !saving && <span className="text-xs text-[#d4232a]">{dict.error}</span>}
    </span>
  );
}
