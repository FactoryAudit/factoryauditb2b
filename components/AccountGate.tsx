"use client";

// components/AccountGate.tsx —— /account/* 子页面的登录门控
//
// 与 AccountPanel 的分工：
//   AccountPanel 是 /account 首页那整块内容（邮箱、额度、升级引导）；
//   AccountGate 是给子页面用的薄封装 —— 只管"门"，
//   没登录就渲染引导，登录了把 children 原样放出来。
//
// 为什么必须是客户端组件：
//   /account/* 要保持 ● SSG，服务端不能读 cookie（读了就退化 ƒ Dynamic，
//   而且 Cloudflare CDN 会把已登录用户的 HTML 发给游客）。
//   所以登录态只能在客户端判断 —— 未登录时 SSR 输出的就是"请登录"引导，
//   对游客来说这就是最终页面；已登录用户在 /api/me 返回后切换成真实内容。
//
// 首帧为什么渲染骨架而不是"请登录"：
//   已登录用户如果先看到"请登录"再跳变，会闪一下。骨架是中性状态，不误导。

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";

export type AccountGateDict = {
  signInTitle: string;
  signInLead: string;
  signInCta: string;
  registerCta: string;
  noAccount: string;
};

export default function AccountGate({
  t,
  signInHref,
  registerHref,
  children,
}: {
  t: AccountGateDict;
  signInHref: string;
  registerHref: string;
  children: ReactNode;
}) {
  const { me, loading } = useAuth();

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
        <h2 className="font-semibold text-[#0f172a]">{t.signInTitle}</h2>
        <p className="text-sm text-[#475569] mt-1">{t.signInLead}</p>
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

  return <>{children}</>;
}
