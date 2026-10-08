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
  industriesLabel,
}: {
  locale: Locale;
  dict: NavDict;
  /** 账号入口文案（t.auth.accountMenu）。单独传是为了不和 nav 混在一起。 */
  accountDict: AccountMenuDict;
  /** WhatsApp 入口文案（t.common.whatsappChat）。与页脚 / AI 客服复用同一份，避免各存一份。 */
  whatsappLabel?: string;
  /**
   * 「行业」入口文案 —— 复用 t.industryPage.breadcrumb（9 语已有该键）。
   * 复用而不新建 nav.industries，是为了不触碰 en 字典叶子数闸门（3192）。
   */
  industriesLabel: string;
}) {
  const p = (href: string) => localePath(locale, href);

  // 移动端导航：hamburger 开关 + 外部点击/Esc 关闭。
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);
  // 🔴 抽屉必须单独记一份 ref：抽屉是顶栏那一行的**兄弟节点**，不在 mobileRef 里。
  //   改前只判 mobileRef.contains ⇒ 点抽屉内任何元素都被当成「点击外部」⇒ 抽屉立刻关闭。
  //   后果（实测）：抽屉里的语言切换器一 mousedown 就把抽屉关掉，整个语言切换在移动端失效
  //   —— 用原生 select 时表现为系统选择器刚弹出就被卸载；改用自绘面板后更是完全点不开。
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (mobileRef.current?.contains(t)) return;
      if (drawerRef.current?.contains(t)) return;
      setMobileOpen(false);
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

  // 「More」下拉：收进 Tools / Pricing / About（原一级项，按参考收进二级，不删除）。
  // About 从一级移入这里，是因为新增 Industries 后 7 项在 1024px（lg 断点）
  // 排不下会折成两行（实测 nav 高度 36→55）。About 的一级位置最不关键，
  // 且 /about 本就 308 合并到 /trust；移动端抽屉与页脚仍保留其一级入口。
  const moreMenu = [
    { key: "tools", href: "/tools" },
    { key: "pricing", href: "/pricing" },
    { key: "about", href: "/trust" },
  ] as const;

  /**
   * 移动端抽屉的「Solutions」组要去掉 factoryAudit / inspection。
   * 桌面端这是两个**各自独立、不同时可见**的下拉（Solutions 列 6 项全量、Audits 列其中 2 项），
   * 所以重复不可见；抽屉里所有组同时展开，照抄就变成「Fabrikaudit / Inspektion 各出现两次」
   * （实测德语抽屉 16 条里有 2 组重复）。改为按 href 去重：Solutions 4 项 + Audits 2 项 = 6 条唯一。
   * 用 href 派生而不是手写两份清单，是为了以后改 SERVICE_MENU 时不会再次漂移。
   */
  const auditHrefs = new Set<string>(auditInspectMenu.map((x) => x.href));
  const drawerSolutions = SERVICE_MENU.filter((x) => !auditHrefs.has(x.href));

  return (
    <header className="sticky top-0 z-30 border-b border-[#ddd9d0]/90 bg-[#fbfaf7]/92 backdrop-blur-md">
      <div className="container flex items-center justify-between h-[74px] gap-4" ref={mobileRef}>
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
            /* 窄屏缩到 h-7（SVG 320×64 ⇒ 宽 140px）。德语 nav.postRfq =「RFQ veröffentlichen」
               比英文长 8 个字符，h-8 时 LOGO+按钮+汉堡在 390px 会溢出，故窄屏让位。 */
            className="h-7 w-auto sm:h-8"
          />
        </Link>

        {/* 主导航：Solutions / Suppliers / Audits & Inspections / Resources / About + More。
            深蓝退回品牌层（logo），导航文字用 ink，hover/强调用珊瑚红。 */}
        <nav aria-label={dict.mainNav} className="hidden xl:flex items-center gap-4 xl:gap-6 text-[13px] xl:text-[13.5px] font-semibold text-[#58554f]">
          {/* Solutions：服务解决方案，下拉 6 项服务（复用 SERVICE_MENU 单一事实源） */}
          <div className="relative group">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              className="flex items-center gap-1 hover:text-[#e07a49] font-medium py-2 whitespace-nowrap"
            >
              {dict.solutions}
              <span aria-hidden="true" className="text-[10px] leading-none">▼</span>
            </button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 top-full w-[340px] pt-2">
              <ul className="rounded-lg border border-[#ebe8e1] bg-white p-2 shadow-lg">
                {SERVICE_MENU.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      className="block rounded-md px-3 py-2 hover:bg-[#f5f3ee]"
                    >
                      <span className="block font-medium text-[#171717]">{dict.menu[item.key]}</span>
                      <span className="block text-xs text-[#6d6b66] mt-0.5">{dict.menu[item.descKey]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link href={p("/suppliers")} className="hover:text-[#e07a49] font-medium whitespace-nowrap">
            {dict.suppliers}
          </Link>

          {/* Industries：p2 设计稿把「行业」放进主导航。此前 /industry 全站零入链
              （组件层没有任何链接指向它），等于功能不存在；这一项修的就是这个。 */}
          <Link href={p("/industry")} className="hover:text-[#e07a49] font-medium whitespace-nowrap">
            {industriesLabel}
          </Link>

          {/* Audits & Inspections：验厂 + 验货 */}
          <div className="relative group">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              className="flex items-center gap-1 hover:text-[#e07a49] font-medium py-2 whitespace-nowrap"
            >
              {dict.auditsInspections}
              <span aria-hidden="true" className="text-[10px] leading-none">▼</span>
            </button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 top-full w-[260px] pt-2">
              <ul className="rounded-lg border border-[#ebe8e1] bg-white p-2 shadow-lg">
                {auditInspectMenu.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      className="block rounded-md px-3 py-2 font-medium text-[#171717] hover:bg-[#f5f3ee]"
                    >
                      {dict.menu[item.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link href={p("/resources")} className="hover:text-[#e07a49] font-medium whitespace-nowrap">
            {dict.resources}
          </Link>

          {/* More：收进 Tools / Pricing / About（原一级项，不删除） */}
          <div className="relative group">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              className="flex items-center gap-1 hover:text-[#e07a49] font-medium py-2 whitespace-nowrap"
            >
              {dict.more}
              <span aria-hidden="true" className="text-[10px] leading-none">▼</span>
            </button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 top-full w-[220px] pt-2">
              <ul className="rounded-lg border border-[#ebe8e1] bg-white p-2 shadow-lg">
                {moreMenu.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      className="block rounded-md px-3 py-2 font-medium text-[#171717] hover:bg-[#f5f3ee]"
                    >
                      {dict[item.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* 桌面端账号 + 语言切换。lg 以下整组收进抽屉 —— p1 设计稿移动端同样只留
              LOGO + RFQ + 汉堡。此前三者与 LOGO 同排，实测 390px 横向溢出 130px
              （最右元素即汉堡按钮）。账号态来自 AuthProvider 共享 context，
              抽屉里再渲染一份不会多发一次 /api/me。 */}
          <div className="hidden xl:flex xl:items-center xl:gap-3">
            <AccountMenu locale={locale} dict={accountDict} whatsappLabel={whatsappLabel} />
            <LocaleSwitcher current={locale} languageLabel={dict.language} />
          </div>

          {/* RFQ 主 CTA。sm 以下也收进抽屉：德语 nav.postRfq「RFQ veröffentlichen」
              19 字符（英文 11），LOGO + 该按钮 + 汉堡在 390px 仍会溢出。 */}
          <Link
            href={p("/rfq")}
            className="btn btn-primary hidden whitespace-nowrap min-h-[40px] px-3.5 text-[13px] sm:inline-flex xl:min-h-[48px] xl:px-5 xl:text-sm"
          >
            {dict.postRfq}
          </Link>

          {/* 移动端 hamburger：桌面端隐藏。 */}
          <button
            type="button"
            className="xl:hidden flex items-center justify-center p-2 -mr-1 text-[#171717]"
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

      {/* 移动端导航面板：xl 以下可用。
          抽屉必须自带滚动容器：14 条链接 + 语言/账号行 + RFQ 按钮在 390×844 上比视口还高，
          没有 max-height 时 RFQ 按钮会掉到视口外（实测德语抽屉底部按钮被截断）。
          dvh 而非 vh：移动端浏览器地址栏收起/展开时 vh 不更新。 */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          ref={drawerRef}
          aria-label={dict.mainNav}
          className="xl:hidden max-h-[calc(100dvh-74px)] overflow-y-auto overscroll-contain border-t border-[#ddd9d0] bg-[#fbfaf7]"
        >
          <div className="container py-2">
            <Link
              href={p("/suppliers")}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm font-medium text-[#171717] border-b border-[#f5f3ee] hover:text-[#e07a49]"
            >
              {dict.suppliers}
            </Link>

            <Link
              href={p("/industry")}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm font-medium text-[#171717] border-b border-[#f5f3ee] hover:text-[#e07a49]"
            >
              {industriesLabel}
            </Link>

            <div className="py-2 border-b border-[#f5f3ee]">
              <div className="py-2 text-sm font-medium text-[#171717]">{dict.solutions}</div>
              <ul className="space-y-1 pb-1">
                {drawerSolutions.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      onClick={() => setMobileOpen(false)}
                      className="block pl-3 py-1.5 text-sm text-[#6d6b66] hover:text-[#e07a49]"
                    >
                      {dict.menu[item.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="py-2 border-b border-[#f5f3ee]">
              <div className="py-2 text-sm font-medium text-[#171717]">{dict.auditsInspections}</div>
              <ul className="space-y-1 pb-1">
                {auditInspectMenu.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      onClick={() => setMobileOpen(false)}
                      className="block pl-3 py-1.5 text-sm text-[#6d6b66] hover:text-[#e07a49]"
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
              className="block py-3 text-sm font-medium text-[#171717] border-b border-[#f5f3ee] hover:text-[#e07a49]"
            >
              {dict.resources}
            </Link>

            {moreMenu.map((item) => (
              <Link
                key={item.key}
                href={p(item.href)}
                onClick={() => setMobileOpen(false)}
                className="block py-3 text-sm font-medium text-[#171717] border-b border-[#f5f3ee] hover:text-[#e07a49]"
              >
                {dict[item.key]}
              </Link>
            ))}

            {/* About 不再单独渲染：已并入上面的 moreMenu（桌面端同样收进 More 下拉），
                否则抽屉里会出现两条指向 /trust 的重复项。 */}

            {/* 窄屏专属：语言切换 + 账号入口。桌面端它们在顶栏，1280 以下顶栏放不下，
                收进抽屉（p1 设计稿把 Sign in 放进移动菜单，同一个思路）。
                2026-10-08（顶栏控件统一）：改为纵向 —— 语言切换器在抽屉里用 inline 就地展开
                语言列表，该列表要占满抽屉整宽；横排会被挤成一条窄列。
                items-start 是必需的：flex-col 默认 stretch，会把 WhatsApp 胶囊拉成整行。 */}
            <div className="flex flex-col items-start gap-2 border-t border-[#f5f3ee] pt-3 pb-1">
              <LocaleSwitcher current={locale} languageLabel={dict.language} variant="inline" />
              <AccountMenu locale={locale} dict={accountDict} whatsappLabel={whatsappLabel} />
            </div>

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
