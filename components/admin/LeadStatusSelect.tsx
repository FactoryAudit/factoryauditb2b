"use client";

import { useState } from "react";

// Lead 状态下拉：改完立刻 PATCH，成功后刷新页面拿最新数据。
//
// 与 RfqStatusSelect 同构（不做乐观 UI：状态是唯一的协作真相）。
// 差异：leads 的五档状态是内部运营口径，后台是单人工具，**不补 9 语翻译**，
//       下拉直接显示数据库里的原始值。
//       STEP 13 CS-B 新增 rejected（migration 027）——本列表必须与
//       lib/adminData.ts 的 LEAD_STATUSES 同源，否则会被库的 CHECK 拒绝。

export type LeadStatusSelectDict = {
  saving: string;
  error: string;
};

const OPTIONS = ["new", "contacted", "quoted", "won", "lost", "rejected"];

export default function LeadStatusSelect({
  referenceId,
  status,
  dict,
}: {
  referenceId: string;
  status: string;
  dict: LeadStatusSelectDict;
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
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId, status: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        setValue(prev);
        setFailed(true);
        return;
      }
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
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {saving && <span className="text-xs text-[#64748b]">{dict.saving}</span>}
      {failed && !saving && <span className="text-xs text-[#d4232a]">{dict.error}</span>}
    </span>
  );
}
