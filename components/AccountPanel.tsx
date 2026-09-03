"use client";

// components/AccountPanel.tsx —— 账号主页内容（V2.1）
//
// /account 必须是 ● SSG：服务端不读 cookie，所以"是否登录"只能在客户端判断。
// 因此本组件是整页级的软门控 —— 与 UnlockGate 同构，只不过粒度是页面：
//   - 首帧 / 未登录 → 显示"请登录"引导（这也是 SSR 输出的 HTML）
//   - 已登录        → 显示真实账号信息
//
// 不放假功能：额度、档位、到期时间全部来自 /api/me 的真实返回值，
//             没有任何"敬请期待"占位。

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { MEMBERSHIP_PRICE_USD } from "@/lib/suppliers";

export type AccountPanelDict = {
  /** 未登录引导 */
  signedOutTitle: string;
  signedOutLead: string;
  signInCta: string;
  registerCta: string;
  noAccount: string;
  emailLabel: string;
  planLabel: string;
  planFree: string;
  planFounding: string;
  /** "{used} / {limit} profiles this month" */
  quota: string;
  /** 额度字段的小标题 */
  quotaLabel: string;
  /** 付费用户：不限量 */
  quotaUnlimited: string;
  renewsLabel: string;
  upgradeTitle: string;
  /** "{price}" 占位符由 MEMBERSHIP_PRICE_USD 填充（定价单一事实源） */
  upgradeLead: string;
  upgradeCta: string;
};

export default function AccountPanel({
  t,
  locale,
  signInHref,
  registerHref,
  membershipHref,
}: {
  t: AccountPanelDict;
  locale: string;
  signInHref: string;
  registerHref: string;
  membershipHref: string;
}) {
  const { me, loading } = useAuth();

  // 首帧与 SSR 一致：先出骨架，避免已登录用户看到"请登录"闪一下
  if (loading) {
    return (
      <div className="card p-6" aria-busy="true">
        <div className="h-4 w-32 bg-[#e2e8f0] rounded animate-pulse" />
        <div className="h-4 w-56 bg-[#e2e8f0] rounded animate-pulse mt-3" />
      </div>
    );
  }

  if (!me.authenticated) {
    return (
      <div className="card p-6">
        <h2 className="font-semibold text-[#0f172a]">{t.signedOutTitle}</h2>
        <p className="text-sm text-[#475569] mt-1">{t.signedOutLead}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={signInHref} className="btn btn-primary text-sm">
            {t.signInCta}
          </Link>
          <span className="text-sm text-[#64748b] self-center">
            {t.noAccount}{" "}
            <Link href={registerHref} className="text-[#0f4c81] underline">
              {t.registerCta}
            </Link>
          </span>
        </div>
      </div>
    );
  }

  const isPaid = me.tier === "founding_buyer" || me.isAdmin;
  const quotaText = me.profilesRemaining === null
    ? t.quotaUnlimited
    : t.quota
        .replace("{used}", String(me.profilesUsed))
        .replace("{limit}", String(me.profilesLimit));

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-semibold text-[#0f172a]">{t.emailLabel}</h2>
        <p className="text-sm text-[#475569] mt-1">{me.email ?? "—"}</p>

        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-[#64748b]">
              {t.planLabel}
            </div>
            <div className="font-semibold text-[#0f172a] mt-1">
              {isPaid ? t.planFounding : t.planFree}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-[#64748b]">
              {t.quotaLabel}
            </div>
            <div className="font-semibold text-[#0f172a] mt-1">{quotaText}</div>
          </div>
        </div>

        {isPaid && me.currentPeriodEnd && (
          <p className="text-sm text-[#475569] mt-4">
            {t.renewsLabel}{" "}
            <span className="font-medium text-[#0f172a]">
              {new Date(me.currentPeriodEnd).toLocaleDateString(locale)}
            </span>
          </p>
        )}
      </div>

      {!isPaid && (
        <div className="card p-6 border-l-4 border-[#0f4c81]">
          <h2 className="font-semibold text-[#0f172a]">{t.upgradeTitle}</h2>
          <p className="text-sm text-[#475569] mt-1">
            {/* 只替换数字：货币符号与位置由各语言文案自己决定
                （en/zh/ja "$99"、es/de/fr/ar "99 $"、pt "US$ 99"） */}
            {t.upgradeLead.replace("{price}", String(MEMBERSHIP_PRICE_USD))}
          </p>
          <Link href={membershipHref} className="btn btn-primary text-sm mt-4 inline-block">
            {t.upgradeCta}
          </Link>
        </div>
      )}
    </div>
  );
}
