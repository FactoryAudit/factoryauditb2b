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
import { localePath, type Locale } from "@/i18n/config";

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
  /** 基础档案访问的小标题（CS-05c：不再是「本月用量」） */
  quotaLabel: string;
  /** 基础层：不限量。CS-05c 起这是**唯一**的额度陈述 ——
   *  「{used} / {limit} profiles this month」已随按月额度口径一并删除 */
  quotaUnlimited: string;
  renewsLabel: string;
  upgradeTitle: string;
  /** "{price}" 占位符由 MEMBERSHIP_PRICE_USD 填充（定价单一事实源） */
  upgradeLead: string;
  upgradeCta: string;

  // ---- 功能导航区（2026-09-18 补）----
  // 卡片标题与说明**全部复用既有键**，不新造文案：
  //   savedLink* ← account.savedTitle / account.savedLead
  //   rfqsLink*  ← account.rfqsTitle  / account.rfqsLead
  //   adminLink* ← admin.title        / admin.overviewLead
  /** 「你的活动」小节标题（account.panel.linksTitle，九语各一份） */
  linksTitle: string;
  /** /account/saved 入口文案 */
  savedLinkTitle: string;
  savedLinkLead: string;
  /** /account/rfqs 入口文案 */
  rfqsLinkTitle: string;
  rfqsLinkLead: string;
  /** 管理后台入口文案。仅 me.isAdmin 时渲染 */
  adminLinkTitle: string;
  adminLinkLead: string;
};

export default function AccountPanel({
  t,
  locale,
  signInHref,
  registerHref,
  membershipHref,
}: {
  t: AccountPanelDict;
  /** 已登录页面的 locale（用于拼子页面链接的 /xx 前缀） */
  locale: Locale;
  signInHref: string;
  registerHref: string;
  membershipHref: string;
}) {
  const { me, loading } = useAuth();
  // 功能导航区的链接在组件内用 localePath 拼 —— 不把函数当 prop 传给客户端组件
  const p = (href: string) => localePath(locale, href);

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
  // CS-05c：额度口径已退役 —— Free Buyer 的基础档案浏览就是无限，
  // 面板只陈述这一个事实，不再显示 "{used} / {limit} profiles this month"。
  const quotaText = t.quotaUnlimited;

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

      {/*
        功能导航区。2026-09-18 补：/account/saved 与 /account/rfqs 两个页面早就建好了，
        但入口只藏在右上角那个**折叠状态**的下拉里 —— 账号主页一个链接都没有，
        于是「收藏了供应商却没地方看」「提交了询价看不到状态」，
        等于功能不存在。这里把入口摆到主页，与下拉菜单并存（同一份文案，不各存一份）。
        只对已登录用户渲染：未登录时整块面板本就是「去登录」卡片，
        摆出入口只会让游客点进另一个登录闸门。
      */}
      <section className="card p-6">
        <h2 className="text-xs uppercase tracking-wide text-[#64748b]">
          {t.linksTitle}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link
            href={p("/account/saved")}
            className="rounded-lg border border-[#e2e8f0] p-4 transition-colors hover:border-[#0f4c81] hover:bg-[#f8fafc]"
          >
            <div className="font-semibold text-[#0f172a]">{t.savedLinkTitle}</div>
            <p className="text-sm text-[#475569] mt-1">{t.savedLinkLead}</p>
          </Link>

          <Link
            href={p("/account/rfqs")}
            className="rounded-lg border border-[#e2e8f0] p-4 transition-colors hover:border-[#0f4c81] hover:bg-[#f8fafc]"
          >
            <div className="font-semibold text-[#0f172a]">{t.rfqsLinkTitle}</div>
            <p className="text-sm text-[#475569] mt-1">{t.rfqsLinkLead}</p>
          </Link>

          {/*
            管理后台入口 —— 此前**前台零入口**：/admin 的所有链接都是后台页面之间的互链，
            管理员每次进后台都要手敲 URL。这里只对 me.isAdmin 渲染。
            安全：这只是一个链接的显示开关，真正的闸门是服务端 requireAdmin()（非 admin 渲染 404）。
            即便有人在浏览器里把 isAdmin 改成 true，他也只是看到一个点进去就 404 的链接。
          */}
          {me.isAdmin && (
            <Link
              href={p("/admin")}
              className="rounded-lg border border-[#e2e8f0] p-4 transition-colors hover:border-[#0f4c81] hover:bg-[#f8fafc]"
            >
              <div className="font-semibold text-[#0f172a]">{t.adminLinkTitle}</div>
              <p className="text-sm text-[#475569] mt-1">{t.adminLinkLead}</p>
            </Link>
          )}
        </div>
      </section>

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
