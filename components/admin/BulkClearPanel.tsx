"use client";

import { useState } from "react";

// 批量「公开来源放行」面板（029）。
//
// 背景：名录类数据（广交会参展商名录等）供应商本人从未申请、从未授权，
//   profile_authorized 恒为 null。详情页那一个勾选框逐条点不现实
//   （本批 200，放量后 11,433），所以列表页需要批量入口。
//
// 设计取舍：
//   1. **两步确认**（点一次只取条数 → 显示将被影响的数字 → 再点确认才写库）。
//      批量写库不可逆 —— 先让管理员看到「将要影响多少条」是最后的刹车。
//   2. 内联确认而不是 window.confirm()：原生对话框在部分环境被拦截，
//      且无法被自动化验收脚本稳定点击。
//   3. 文案由服务端预解析成字符串传入（dict），**不新增字典键** ——
//      9 语字典的叶子数有闸门守着，后台内部工具不值当为它扩键。

export type BulkClearDict = {
  title: string;
  lead: string;
  clear: string;
  unclear: string;
  confirmClear: string;
  confirmUnclear: string;
  confirm: string;
  cancel: string;
  working: string;
  error: string;
  limit: string;
  empty: string;
};

export type BulkClearPanelProps = {
  filter: { search: string; published: string };
  /** 当前筛选下「未授权 且 未放行」的条数 —— 即放行按钮的作用范围。 */
  clearable: number;
  /** 当前筛选下「已放行」的条数 —— 即撤销按钮的作用范围。 */
  unclearable: number;
  /** 服务端常量，避免前端硬编码一个会漂移的数字。 */
  limit: number;
  dict: BulkClearDict;
};

const ENDPOINT = "/api/admin/suppliers/bulk-clear";

function fill(tpl: string, vars: Record<string, string>): string {
  let s = tpl;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(v);
  }
  return s;
}

export default function BulkClearPanel({
  filter,
  clearable,
  unclearable,
  limit,
  dict,
}: BulkClearPanelProps) {
  // step != null 表示「已取到条数，等管理员确认」
  const [step, setStep] = useState<{ cleared: boolean; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function run(cleared: boolean, confirm: boolean) {
    setBusy(true);
    setFailed(false);
    setMsg(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 只带服务端认得的筛选键（authorized 刻意不传：候选定义由服务端固定）
          search: filter.search,
          published: filter.published,
          cleared,
          confirm,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        count?: number;
        limit?: number;
        requires_confirmation?: boolean;
        error?: string;
      };

      if (!data.ok) {
        setFailed(true);
        setStep(null);
        if (data.error === "bulk_limit_exceeded") {
          setMsg(
            fill(dict.limit, {
              count: String(data.count ?? 0),
              limit: String(data.limit ?? limit),
            })
          );
        } else {
          setMsg(dict.error);
        }
        return;
      }

      // 第一步的返回：还没写库，等确认
      if (data.requires_confirmation) {
        setStep({ cleared, count: data.count ?? 0 });
        return;
      }

      // 确认后执行完成，或本来就没有可处理的
      setStep(null);
      if ((data.count ?? 0) === 0) {
        setMsg(dict.empty);
        return;
      }
      // 写库成功 → 刷新拿最新状态（不做乐观 UI：库里才是唯一真相）
      window.location.reload();
    } catch {
      setFailed(true);
      setStep(null);
      setMsg(dict.error);
    } finally {
      setBusy(false);
    }
  }

  const btnCls =
    "rounded-md border border-[#ebe8e1] bg-white px-3 py-1.5 text-xs text-[#171717] hover:border-[#171717] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mt-4 rounded-lg border border-[#ebe8e1] bg-[#fbfaf7] p-4">
      <div className="text-sm font-medium text-[#171717]">{dict.title}</div>
      <p className="mt-1 max-w-4xl text-xs leading-relaxed text-[#6d6b66]">{dict.lead}</p>

      {step ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={
              step.cleared
                ? "rounded-md bg-[#fff8e6] px-2 py-1 text-xs text-[#8a5a00]"
                : "rounded-md bg-[#fdeaea] px-2 py-1 text-xs text-[#d4232a]"
            }
          >
            {fill(step.cleared ? dict.confirmClear : dict.confirmUnclear, {
              n: String(step.count),
            })}
          </span>
          <button
            type="button"
            onClick={() => run(step.cleared, true)}
            disabled={busy}
            className={btnCls}
          >
            {dict.confirm}
          </button>
          <button type="button" onClick={() => setStep(null)} disabled={busy} className={btnCls}>
            {dict.cancel}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => run(true, false)}
            disabled={busy || clearable === 0}
            className={btnCls}
          >
            {dict.clear.replace("{n}", String(clearable))}
          </button>
          <button
            type="button"
            onClick={() => run(false, false)}
            disabled={busy || unclearable === 0}
            className={btnCls}
          >
            {dict.unclear.replace("{n}", String(unclearable))}
          </button>
        </div>
      )}

      {busy && <span className="mt-2 inline-block text-xs text-[#6d6b66]">{dict.working}</span>}
      {msg && !busy && (
        <span
          className={"mt-2 inline-block text-xs " + (failed ? "text-[#d4232a]" : "text-[#6d6b66]")}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
