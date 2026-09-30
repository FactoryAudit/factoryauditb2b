"use client";

import { useState } from "react";

// 会员档位下拉（后台手动开通 / 撤销 —— 线下成交路径）
//
// 与 LeadStatusSelect / RfqStatusSelect 同构：改完立刻 PATCH，成功后
// window.location.reload() 拿最新数据。**不做乐观 UI** ——
// 会员权限是唯一的协作真相，界面显示的必须是库里真实的状态，不是"点完看起来对了"。
//
// 为什么选项是「动作」而不是自由的状态枚举：
//   「开通一年」需要一个"从现在起算"的锚点。让运营手填日期只会制造错误
//   （填成过去时间 = 立刻过期；填错年份 = 白送一年）。所以日期由**服务端**算，
//   前端只表达"要做什么"，永远不传 plan / status / period_end。
//
// 为什么标签可以含内部枚举原文（不新增 9 语字典键）：
//   与 LeadStatusSelect 同一约定 —— 后台是单人内部工具，**不补 9 语翻译**。
//   新增字典键会触发 i18n 叶子数闸门（22 文件白名单），代价远大于收益。
//   用户可见的措辞（如 Free / Founding Buyer）由服务端从既有 admin 键解析后传入。

export type MemberAction = "revoke" | "grant_yearly" | "grant_lifetime";

export type MemberPlanSelectDict = {
  /** 服务端预解析好的选项标签（已含既有 admin 字典键的本地化结果） */
  labels: Record<MemberAction, string>;
  saving: string;
  error: string;
};

const OPTIONS: MemberAction[] = ["revoke", "grant_yearly", "grant_lifetime"];

export default function MemberPlanSelect({
  userId,
  action,
  email,
  dict,
}: {
  /** profiles.id —— 用 id 而不是 email 定位（email 可重名） */
  userId: string;
  /** 由 plan + status + current_period_end 反推出来的当前档位 */
  action: MemberAction;
  /** 仅用于 aria-label，提升后台可访问性 */
  email: string;
  dict: MemberPlanSelectDict;
}) {
  const [value, setValue] = useState<MemberAction>(action);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as MemberAction;
    const prev = value;
    setValue(next);
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: next }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean };
      if (!data.ok) {
        // 回滚显示值 —— 失败时界面绝不能停留在"看起来已生效"的状态
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
        aria-label={email}
        className="rounded-md border border-[#ebe8e1] bg-white px-2 py-1 text-xs text-[#171717] disabled:opacity-60"
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {dict.labels[o]}
          </option>
        ))}
      </select>
      {saving && <span className="text-xs text-[#6d6b66]">{dict.saving}</span>}
      {failed && !saving && <span className="text-xs text-[#d4232a]">{dict.error}</span>}
    </span>
  );
}
