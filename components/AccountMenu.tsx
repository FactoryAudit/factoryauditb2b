"use client";

// components/AccountMenu.tsx —— 站点导航里的账号入口
//
// 与 UnlockGate / UnlockedValue 同一套约束：
//   它挂在 SiteHeader 上，而 SiteHeader 出现在每一个 ● SSG 页面里。
//   所以首帧必须与服务端 HTML 完全一致 —— 一律先渲染「Sign in」，
//   hydration 后 /api/me 回来才切换成账号菜单。
//   代价是已登录用户会看到 <300ms 的 "Sign in"，收益是零 hydration 报错、
//   且不会因为读 cookie 让整站退化成 ƒ Dynamic。
//
// 安全：菜单里显示的是邮箱的「@ 前一段」，不显示完整邮箱；
//       埋点只发 logout 事件本身，绝不带 email。

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics";
import { localePath, type Locale } from "@/i18n/config";

export type AccountMenuDict = {
  /** 未登录时的入口文案 */
  signIn: string;
  signOut: string;
  myAccount: string;
  /** free 档位看到的升级入口 */
  upgrade: string;
  planFree: string;
  planFounding: string;
  /** 免费额度提示："{used} / {limit} profiles this month" */
  quota: string;
  /** 菜单按钮的 aria-label */
  menuLabel: string;
};

export default function AccountMenu({
  locale,
  dict,
}: {
  locale: Locale;
  dict: AccountMenuDict;
}) {
  const { me, loading, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const p = (href: string) => localePath(locale, href);

  // 点击外部 / Esc 关闭下拉
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 登出接口失败也要把本地状态刷掉，不能把用户卡在"已登录"里
    }
    await refresh();
    trackEvent(ANALYTICS_EVENTS.logout);
  }

  // SSR 首帧与游客：Sign in 链接
  if (loading || !me.authenticated) {
    return (
      <Link
        href={p("/login")}
        className="text-sm font-medium text-[#0f172a] hover:text-[#0f4c81] whitespace-nowrap"
      >
        {dict.signIn}
      </Link>
    );
  }

  // 只显示 @ 前一段，避免在公共场合/截图里暴露完整邮箱
  const shortName = me.email ? me.email.split("@")[0] : dict.myAccount;
  const isPaid = me.tier === "founding_buyer" || me.isAdmin;
  const quotaText =
    me.profilesRemaining === null
      ? null
      : dict.quota
          .replace("{used}", String(me.profilesUsed))
          .replace("{limit}", String(me.profilesLimit));

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={dict.menuLabel}
        className="flex items-center gap-1.5 text-sm font-medium text-[#0f172a] hover:text-[#0f4c81] whitespace-nowrap"
      >
        <span
          aria-hidden="true"
          className="w-6 h-6 rounded-full bg-[#e6eef6] text-[#0f4c81] text-xs flex items-center justify-center font-bold"
        >
          {shortName.slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-[120px] truncate">{shortName}</span>
        <span aria-hidden="true" className="text-[10px] leading-none">
          ▼
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full w-60 pt-2 z-40"
        >
          <div className="rounded-lg border border-[#e2e8f0] bg-white p-2 shadow-lg">
            <div className="px-3 py-2 border-b border-[#e2e8f0] mb-1">
              <div className="text-xs text-[#64748b] truncate">{me.email}</div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isPaid
                      ? "bg-[#0f4c81] text-white"
                      : "bg-[#e6eef6] text-[#0f4c81]"
                  }`}
                >
                  {isPaid ? dict.planFounding : dict.planFree}
                </span>
                {quotaText && (
                  <span className="text-xs text-[#64748b]">{quotaText}</span>
                )}
              </div>
            </div>

            <Link
              href={p("/account")}
              role="menuitem"
              className="block rounded-md px-3 py-2 text-sm hover:bg-[#f1f5f9]"
              onClick={() => setOpen(false)}
            >
              {dict.myAccount}
            </Link>
            {/* /account/saved 与 /account/rfqs 尚未建页，菜单里先不放入口 —— 不放假链接 */}
            {!isPaid && (
              <Link
                href={p("/membership")}
                role="menuitem"
                className="block rounded-md px-3 py-2 text-sm font-medium text-[#0f4c81] hover:bg-[#e6eef6]"
                onClick={() => setOpen(false)}
              >
                {dict.upgrade}
              </Link>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full text-left rounded-md px-3 py-2 text-sm text-[#475569] hover:bg-[#f1f5f9]"
            >
              {dict.signOut}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
