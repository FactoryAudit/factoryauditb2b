"use client";

import { useState } from "react";

// RFQ 对外公开闸门（STEP-02B · migration 024 的 rfqs.is_public）
//
// 与 status（内部处理进度）严格分离：
//   status    = new / reviewing / matched / closed —— 我们内部跟到哪一步
//   is_public = 是否对外展示（首页 Live Buyer Requests / 公开采购需求）
// 后台点「公开」→ 前台立即出现；点「下架」→ 前台立即消失。
//
// 交互约定同 RfqStatusSelect：成功后 window.location.reload()，不用乐观 UI。

export type RfqPublicToggleDict = {
  publicOn: string;
  publicOff: string;
  shown: string;
  hidden: string;
  saving: string;
  error: string;
};

export default function RfqPublicToggle({
  referenceId,
  isPublic,
  dict,
}: {
  referenceId: string;
  isPublic: boolean;
  dict: RfqPublicToggleDict;
}) {
  const [value, setValue] = useState(isPublic);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    const prev = value;
    const next = !value;
    setValue(next);
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch("/api/admin/rfqs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId, isPublic: next }),
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
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-label={referenceId}
        className={`rounded-full px-2 py-0.5 text-xs disabled:opacity-60 ${
          value ? "bg-[#e6f4ec] text-[#14804a]" : "bg-[#f1f5f9] text-[#64748b]"
        }`}
      >
        {value ? dict.shown : dict.hidden}
      </button>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className="text-xs text-[#0f4c81] hover:underline disabled:opacity-60"
      >
        {value ? dict.publicOff : dict.publicOn}
      </button>
      {saving && <span className="text-xs text-[#64748b]">{dict.saving}</span>}
      {failed && !saving && <span className="text-xs text-[#d4232a]">{dict.error}</span>}
    </span>
  );
}
