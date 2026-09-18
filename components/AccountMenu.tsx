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
import { whatsappUrl } from "./WhatsAppLink";

export type AccountMenuDict = {
  /** 未登录时的入口文案 */
  signIn: string;
  signOut: string;
  myAccount: string;
  /** free 档位看到的升级入口 */
  upgrade: string;
  planFree: string;
  planFounding: string;
  /** 菜单按钮的 aria-label */
  menuLabel: string;
  /** /account/saved 入口文案。复用 account.navSaved，不另存一份 */
  saved: string;
  /** /account/rfqs 入口文案。复用 account.navRfqs，不另存一份 */
  rfqs: string;
  /** 管理后台入口文案。复用 admin.title，不另存一份；仅 isAdmin 渲染 */
  adminConsole: string;
};

export default function AccountMenu({
  locale,
  dict,
  whatsappLabel,
}: {
  locale: Locale;
  dict: AccountMenuDict;
  /** WhatsApp 入口文案（t.common.whatsappChat），用作图标按钮的 aria-label。 */
  whatsappLabel?: string;
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

  // SSR 首帧与游客：不再渲染 /login 入口。
  // 询盘主渠道是 WhatsApp，导航栏不再把访客引向登录页。
  // /login 页面与 /api/auth/* 后端都还在，需要时可直接输入 URL 访问，
  // 只是不再作为公开入口摆在导航栏里（避免摩擦，也避免「点了不知道是什么」）。
  // 未配置 WhatsApp 号码时返回 null —— 绝不渲染点不动的死链。
  if (loading || !me.authenticated) {
    const url = whatsappUrl(
      "Hi FactoryAuditB2B, I would like to ask about supplier verification."
    );
    if (!url) return null;
    return (
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={whatsappLabel ?? "WhatsApp"}
        title={whatsappLabel ?? "WhatsApp"}
        className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-[#25D366] hover:opacity-90 transition-opacity"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="#ffffff"
          focusable="false"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </Link>
    );
  }

  // 只显示 @ 前一段，避免在公共场合/截图里暴露完整邮箱
  const shortName = me.email ? me.email.split("@")[0] : dict.myAccount;
  const isPaid = me.tier === "founding_buyer" || me.isAdmin;

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
            {/*
              收藏夹与询价单入口。
              这两个页面此前一直没建，所以按「不放假链接」的原则没放入口 ——
              结果是用户收藏了供应商却找不到入口查看，功能等于不存在。
              页面建好后这里就补上（若哪天页面被删，这两个入口也必须一起删）。
            */}
            <Link
              href={p("/account/saved")}
              role="menuitem"
              className="block rounded-md px-3 py-2 text-sm hover:bg-[#f1f5f9]"
              onClick={() => setOpen(false)}
            >
              {dict.saved}
            </Link>
            <Link
              href={p("/account/rfqs")}
              role="menuitem"
              className="block rounded-md px-3 py-2 text-sm hover:bg-[#f1f5f9]"
              onClick={() => setOpen(false)}
            >
              {dict.rfqs}
            </Link>
            {/*
              管理后台入口（2026-09-18 补）。
              此前**前台零入口**：全站所有 /admin 链接都是后台页面之间的互链，
              管理员每次进后台都得手敲 URL，而登录只跳到 /account。
              仅 isAdmin 渲染 —— 普通用户看不到这个链接，菜单里没有任何可探测的差异。
              安全：闸门是服务端 requireAdmin()（非 admin 一律渲染 404），
              这里只是显示开关，前端改标记也只是得到一个点进去就 404 的链接。
            */}
            {me.isAdmin && (
              <Link
                href={p("/admin")}
                role="menuitem"
                className="block rounded-md px-3 py-2 text-sm hover:bg-[#f1f5f9]"
                onClick={() => setOpen(false)}
              >
                {dict.adminConsole}
              </Link>
            )}
            {!isPaid && (
              <Link
                href={p("/pricing#founding-buyer")}
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
