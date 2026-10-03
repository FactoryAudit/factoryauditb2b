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

// migration 031 新增 withdrawn（申请人主动撤回 / 下架）——必须与 lib/adminData.ts 的
// LEAD_STATUSES 及 DB 的 leads_status_check 三者同源，否则库的 CHECK 会拒绝写入。
const OPTIONS = ["new", "contacted", "quoted", "won", "lost", "rejected", "withdrawn"];

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
        className="rounded-md border border-[#ebe8e1] bg-white px-2 py-1 text-xs text-[#171717] disabled:opacity-60"
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {saving && <span className="text-xs text-[#6d6b66]">{dict.saving}</span>}
      {failed && !saving && <span className="text-xs text-[#d4232a]">{dict.error}</span>}
    </span>
  );
}
