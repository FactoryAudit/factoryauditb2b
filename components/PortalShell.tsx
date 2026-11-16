"use client";

// components/PortalShell.tsx —— Portal 统一后台外壳（侧边栏 + 内容区）
//
// 视觉参照 Sedex 后台：
//   · 左侧独立侧边栏（白底、固定宽、菜单带图标、选中项浅底）
//   · 右侧浅灰背景的内容区，大留白，内容限宽左对齐
//   · 移动端侧边栏折叠为顶部横条
//
// 只负责外壳与导航；身份判断（供应商/买家）由服务端 layout 裁决后传进来。

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export type PortalNavItem = {
  href: string;
  label: string;
};

export type PortalShellProps = {
  email: string | null;
  roleLabel: string;
  nav: PortalNavItem[];
  homeHref: string;
  logoutHref: string;
  /** 回前台的文案 */
  backLabel?: string;
  /** 管理后台入口（仅管理员传入；不传则不渲染） */
  adminHref?: string;
  adminLabel?: string;
  children: React.ReactNode;
};

// 按路径匹配一个简单的线性图标（不做 i18n，纯装饰）
function Icon({ href }: { href: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (href.includes("assessment-faq")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (href.includes("supplier-assessment")) {
    return (
      <svg {...common}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    );
  }
  if (href.includes("supplier-dashboard")) {
    return (
      <svg {...common}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    );
  }
  if (href.includes("supplier-certificates")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="9" r="5" />
        <path d="M9 13.5 8 21l4-2 4 2-1-7.5" />
      </svg>
    );
  }
  if (href.includes("saved")) {
    return (
      <svg {...common}>
        <path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.5 12 20 12 20z" />
      </svg>
    );
  }
  if (href.includes("rfqs") || href.includes("/rfq")) {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  }
  if (href.includes("suppliers")) {
    return (
      <svg {...common}>
        <path d="M3 21V9l6-5 6 5v3" />
        <path d="M15 21V13l6 3v5M3 21h18" />
      </svg>
    );
  }
  // 默认：工作台九宫格
  return (
    <svg {...common}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export default function PortalShell({
  email,
  roleLabel,
  nav,
  homeHref,
  logoutHref,
  backLabel = "Back to site",
  adminHref,
  adminLabel = "Admin",
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push(logoutHref);
      router.refresh();
    } catch {
      router.push(logoutHref);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3]" data-portal-shell>
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* ── 侧边栏 ── */}
        <aside className="flex w-full shrink-0 flex-col border-b border-[#ecebe7] bg-white lg:min-h-screen lg:w-[248px] lg:border-b-0 lg:border-r">
          {/* 品牌 + 角色 */}
          <div className="px-5 pt-5 pb-4">
            <Link href={homeHref} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="grid h-7 w-7 place-items-center rounded-md bg-[#171717] text-[13px] font-black text-white"
              >
                F
              </span>
              <span className="text-[15px] font-extrabold tracking-tight text-[#171717]">
                FactoryAuditB2B
              </span>
            </Link>
            <div className="mt-3 inline-flex rounded-full bg-[#f2efe9] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#6d6b66]">
              {roleLabel}
            </div>
          </div>

          {/* 菜单 */}
          <nav aria-label="Portal" className="flex-1 space-y-1 px-3 pb-4">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors " +
                    (active
                      ? "bg-[#f2efe9] font-semibold text-[#171717]"
                      : "font-medium text-[#4a4740] hover:bg-[#f7f6f3] hover:text-[#171717]")
                  }
                >
                  <span className={active ? "text-[#e07a49]" : "text-[#9a968d]"}>
                    <Icon href={item.href} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* 底部：账号 + 登出 + 回前台 */}
          <div className="border-t border-[#ecebe7] px-5 py-4">
            {email ? (
              <p className="truncate text-xs text-[#6d6b66]" title={email}>
                {email}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-4 text-xs">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="font-medium text-[#171717] underline decoration-[#e07a49] hover:decoration-2 disabled:opacity-50"
              >
                {loggingOut ? "…" : "Sign out"}
              </button>
              <Link
                href={homeHref}
                className="text-[#6d6b66] hover:text-[#171717] hover:underline"
              >
                {backLabel}
              </Link>
              {/* 管理后台入口：只在管理员登录时由 layout 传入 adminHref，
                  普通供应商/买家看不到（也就不存在"后台存在"的暴露面）。 */}
              {adminHref ? (
                <Link
                  href={adminHref}
                  className="font-medium text-[#e07a49] hover:underline"
                >
                  {adminLabel} →
                </Link>
              ) : null}
            </div>
          </div>
        </aside>

        {/* ── 内容区 ── */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[820px] px-6 py-8 sm:px-10 sm:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
