"use client";

// 后台：把供应商自评问卷的「基础档案」答案一键采纳进 suppliers 表。
//
// 为什么需要它：问卷答案落在 supplier_assessments.responses_json，档案页读的是
// suppliers 表 —— 两者之间原本没有任何通道，后台只能逐字手抄 11 个字段。
//
// 🔴 三条约束：
//   1. 只提交**管理员勾选**的行；问卷空值压根不在 rows 里（lib/assessmentAdopt 已过滤）。
//   2. 「问卷值 == 档案现值」的行默认不勾（无意义覆盖）。
//   3. 证书 / 厂房权属 / 产线数不在此面板写入，只在下方「需人工判断」区展示。

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdoptRow, ManualItem } from "@/lib/assessmentAdopt";

type Props = {
  slug: string;
  rows: AdoptRow[];
  manual: ManualItem[];
};

export default function AssessmentAdoptPanel({ slug, rows, manual }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const r of rows) init[r.field] = !r.identical;
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const selectedCount = useMemo(
    () => rows.filter((r) => checked[r.field]).length,
    [rows, checked]
  );

  async function apply() {
    const chosen = rows.filter((r) => checked[r.field]);
    if (chosen.length === 0) {
      setMsg({ kind: "err", text: "未选中任何字段。" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { slug };
      for (const r of chosen) body[r.field] = r.payload;
      const res = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok !== false) {
        setMsg({ kind: "ok", text: `已写入 ${chosen.length} 个字段。` });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: `写入失败：${data?.error ?? res.status}` });
      }
    } catch {
      setMsg({ kind: "err", text: "网络错误，未写入。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-[#171717]">自评问卷 → 档案字段</h3>
          <p className="text-xs text-[#6d6b66] mt-1">
            供应商在自评问卷里填的基础档案。勾选后直接写入 suppliers 表；问卷未填的字段不会覆盖现有档案。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy || selectedCount === 0}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
        >
          {busy ? "写入中…" : `采纳选中（${selectedCount}）`}
        </button>
      </div>

      {msg && (
        <div
          className={`mt-3 p-2 rounded text-sm ${
            msg.kind === "ok" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[#8c8982]">该供应商还没有填写基础档案问卷。</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6d6b66] border-b">
                <th className="py-2 w-8"></th>
                <th className="py-2">字段</th>
                <th className="py-2">档案现值</th>
                <th className="py-2">问卷填写</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.field} className="border-b last:border-0 align-top">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={!!checked[r.field]}
                      onChange={(e) =>
                        setChecked((prev) => ({ ...prev, [r.field]: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="py-2">
                    <span className="text-[#8c8982] mr-1">{r.code}</span>
                    {r.labelZh}
                    {r.identical && (
                      <span className="ml-2 text-xs text-[#15803d]">已一致</span>
                    )}
                  </td>
                  <td className="py-2 text-[#6d6b66]">{r.current || <span className="text-[#b45309]">（空）</span>}</td>
                  <td className="py-2 text-[#171717] font-medium">{r.incoming}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {manual.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <h4 className="text-sm font-semibold text-[#b45309]">需人工判断（不自动写入）</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {manual.map((m) => (
              <li key={m.code} className="text-[#3f4650]">
                <span className="text-[#8c8982] mr-1">{m.code}</span>
                <strong>{m.labelZh}</strong>：{m.incoming}
                <span className="block text-xs text-[#8c8982] mt-0.5">{m.reasonZh}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
