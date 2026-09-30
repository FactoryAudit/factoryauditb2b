"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AccountMenu, { type AccountMenuDict } from "@/components/AccountMenu";
import { localePath, type Locale } from "@/i18n/config";
import { SERVICE_MENU, type ServiceMenuDict } from "@/lib/nav";

export type NavDict = {
  tools: string;
  suppliers: string;
  services: string;
  solutions: string;
  resources: string;
  pricing: string;
  rfq: string;
  audits: string;
  inspections: string;
  auditsInspections: string;
  logistics: string;
  language: string;
  trainingPlans: string;
  about: string;
  more: string;
  postRfq: string;
  requestAudit: string;
  /** aria-label：LOGO 链接（品牌名 + 首页） */
  homeLabel: string;
  /** aria-label：主导航 landmark */
  mainNav: string;
  menu: ServiceMenuDict;
};

export default function SiteHeader({
  locale,
  dict,
  accountDict,
  whatsappLabel,
}: {
  locale: Locale;
  dict: NavDict;
  /** 账号入口文案（t.auth.accountMenu）。单独传是为了不和 nav 混在一起。 */
  accountDict: AccountMenuDict;
  /** WhatsApp 入口文案（t.common.whatsappChat）。与页脚 / AI 客服复用同一份，避免各存一份。 */
  whatsappLabel?: string;
}) {
  const p = (href: string) => localePath(locale, href);

  // 移动端导航：hamburger 开关 + 外部点击/Esc 关闭。
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  // 「Audits & Inspections」下拉：验厂 + 验货两个高意图入口。
  const auditInspectMenu = [
    { key: "factoryAudit", href: "/factory-audit/request" },
    { key: "inspection", href: "/services/inspection" },
  ] as const;

  // 「More」下拉：收进 Tools / Pricing（原主导航项，按参考收进二级，不删除）。
  const moreMenu = [
    { key: "tools", href: "/tools" },
    { key: "pricing", href: "/pricing" },
  ] as const;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#e8e8e8]">
      <div className="container flex items-center justify-between h-16 gap-4" ref={mobileRef}>
        <Link
          href={p("/")}
          className="flex items-center shrink-0"
          aria-label={dict.homeLabel}
        >
          {/* 品牌 LOGO：盾牌 + 工厂 + 放大镜（核验方） */}
          {/* 用原生 img 而不是 next/image，避免 SVG 需要 dangerouslyAllowSVG 配置 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-header.svg"
            alt="FactoryAuditB2B"
            width={160}
            height={32}
            className="h-8 w-auto"
          />
        </Link>

        {/* 主导航：Solutions / Suppliers / Audits & Inspections / Resources / About + More。
            深蓝退回品牌层（logo），导航文字用 ink，hover/强调用珊瑚红。 */}
        <nav aria-label={dict.mainNav} className="hidden lg:flex items-center gap-6 text-sm text-[#111111]">
          {/* Solutions：服务解决方案，下拉 6 项服务（复用 SERVICE_MENU 单一事实源） */}
          <div className="relative group">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              className="flex items-center gap-1 hover:text-[#e94560] font-medium py-2"
            >
              {dict.solutions}
              <span aria-hidden="true" className="text-[10px] leading-none">▼</span>
            </button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 top-full w-[340px] pt-2">
              <ul className="rounded-lg border border-[#e8e8e8] bg-white p-2 shadow-lg">
                {SERVICE_MENU.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      className="block rounded-md px-3 py-2 hover:bg-[#f7f7f8]"
                    >
                      <span className="block font-medium text-[#111111]">{dict.menu[item.key]}</span>
                      <span className="block text-xs text-[#6b7280] mt-0.5">{dict.menu[item.descKey]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link href={p("/suppliers")} className="hover:text-[#e94560] font-medium">
            {dict.suppliers}
          </Link>

          {/* Audits & Inspections：验厂 + 验货 */}
          <div className="relative group">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              className="flex items-center gap-1 hover:text-[#e94560] font-medium py-2"
            >
              {dict.auditsInspections}
              <span aria-hidden="true" className="text-[10px] leading-none">▼</span>
            </button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 top-full w-[260px] pt-2">
              <ul className="rounded-lg border border-[#e8e8e8] bg-white p-2 shadow-lg">
                {auditInspectMenu.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      className="block rounded-md px-3 py-2 font-medium text-[#111111] hover:bg-[#f7f7f8]"
                    >
                      {dict.menu[item.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link href={p("/resources")} className="hover:text-[#e94560] font-medium">
            {dict.resources}
          </Link>

          {/* About 已 308 合并进 /trust，导航指向 /trust（文案沿用 about） */}
          <Link href={p("/trust")} className="hover:text-[#e94560] font-medium">
            {dict.about}
          </Link>

          {/* More：收进 Tools / Pricing（原一级项，不删除） */}
          <div className="relative group">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              className="flex items-center gap-1 hover:text-[#e94560] font-medium py-2"
            >
              {dict.more}
              <span aria-hidden="true" className="text-[10px] leading-none">▼</span>
            </button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 top-full w-[220px] pt-2">
              <ul className="rounded-lg border border-[#e8e8e8] bg-white p-2 shadow-lg">
                {moreMenu.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      className="block rounded-md px-3 py-2 font-medium text-[#111111] hover:bg-[#f7f7f8]"
                    >
                      {dict[item.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-3">
          {/* 账号入口：客户端组件，首帧渲染「未登录态」（与 SSR 一致）。 */}
          <AccountMenu locale={locale} dict={accountDict} whatsappLabel={whatsappLabel} />
          <LocaleSwitcher current={locale} languageLabel={dict.language} />
          <Link href={p("/rfq")} className="btn btn-primary whitespace-nowrap">
            {dict.postRfq}
          </Link>

          {/* 移动端 hamburger：桌面端隐藏。 */}
          <button
            type="button"
            className="lg:hidden flex items-center justify-center p-2 -mr-1 text-[#111111]"
            aria-label={dict.mainNav}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {mobileOpen ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="M6 6l12 12" />
                </>
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* 移动端导航面板：lg 以下可用。 */}
      {mobileOpen && (
        <nav id="mobile-nav" aria-label={dict.mainNav} className="lg:hidden border-t border-[#e8e8e8] bg-white">
          <div className="container py-2">
            <Link
              href={p("/suppliers")}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm font-medium text-[#111111] border-b border-[#f7f7f8] hover:text-[#e94560]"
            >
              {dict.suppliers}
            </Link>

            <div className="py-2 border-b border-[#f7f7f8]">
              <div className="py-2 text-sm font-medium text-[#111111]">{dict.solutions}</div>
              <ul className="space-y-1 pb-1">
                {SERVICE_MENU.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      onClick={() => setMobileOpen(false)}
                      className="block pl-3 py-1.5 text-sm text-[#6b7280] hover:text-[#e94560]"
                    >
                      {dict.menu[item.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="py-2 border-b border-[#f7f7f8]">
              <div className="py-2 text-sm font-medium text-[#111111]">{dict.auditsInspections}</div>
              <ul className="space-y-1 pb-1">
                {auditInspectMenu.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      onClick={() => setMobileOpen(false)}
                      className="block pl-3 py-1.5 text-sm text-[#6b7280] hover:text-[#e94560]"
                    >
                      {dict.menu[item.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href={p("/resources")}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm font-medium text-[#111111] border-b border-[#f7f7f8] hover:text-[#e94560]"
            >
              {dict.resources}
            </Link>

            {moreMenu.map((item) => (
              <Link
                key={item.key}
                href={p(item.href)}
                onClick={() => setMobileOpen(false)}
                className="block py-3 text-sm font-medium text-[#111111] border-b border-[#f7f7f8] hover:text-[#e94560]"
              >
                {dict[item.key]}
              </Link>
            ))}

            <Link
              href={p("/trust")}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm font-medium text-[#111111] hover:text-[#e94560]"
            >
              {dict.about}
            </Link>

            <div className="flex gap-2 pt-3 pb-2">
              <Link
                href={p("/rfq")}
                onClick={() => setMobileOpen(false)}
                className="btn btn-primary flex-1"
              >
                {dict.postRfq}
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
