"use client";

// components/PortalShell.tsx —— Portal 统一后台外壳（侧边栏 + 顶栏）
//
// 参照 Sedex 后台的信息架构：左侧持久导航 + 顶部身份区 + 右侧内容区。
// 本组件只负责「外壳」（布局与导航），具体工作台内容由页面/子组件传入 children。
//
// 为什么是客户端组件：登出按钮需要调 /api/auth/logout 并跳转，属于交互。
// 侧边栏的「高亮当前项」也依赖当前路径，用 usePathname 在客户端判断最干净。
//
// 导航数据由服务端页面按角色（supplier / buyer）组装好后传入，
// 本组件不自己判断身份 —— 身份是服务端裁决的结果，客户端只负责展示。

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export type PortalNavItem = {
  href: string;
  label: string;
};

export type PortalShellProps = {
  /** 用户邮箱（展示用） */
  email: string | null;
  /** 角色标签（如 Supplier / Buyer） */
  roleLabel: string;
  /** 侧边栏导航项 */
  nav: PortalNavItem[];
  /** 站点首页链接（返回前台） */
  homeHref: string;
  /** 登出后的落地页（登录页） */
  logoutHref: string;
  /** 当前 locale 的路径前缀函数（服务端拼好的链接直接传入，避免客户端再拼） */
  children: React.ReactNode;
};

export default function PortalShell({
  email,
  roleLabel,
  nav,
  homeHref,
  logoutHref,
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
      // 登出失败也跳回登录页（服务端 session 可能已失效，前端无需阻塞）
      router.push(logoutHref);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfaf7]">
      {/* 顶部身份条 */}
      <div className="border-b border-[#ebe8e1] bg-white">
        <div className="container flex items-center justify-between py-3 text-sm">
          <Link href={homeHref} className="font-semibold text-[#171717] hover:underline">
            FactoryAuditB2B
          </Link>
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-[#f5f3ee] px-3 py-1 text-xs font-medium text-[#2b2b2b]">
              {roleLabel}
            </span>
            {email ? (
              <span className="hidden text-[#6d6b66] sm:inline">{email}</span>
            ) : null}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-[#171717] underline decoration-[#e07a49] hover:decoration-2 disabled:opacity-50"
            >
              {loggingOut ? "…" : "Sign out"}
            </button>
          </div>
        </div>
      </div>

      {/* 主体：侧边栏 + 内容 */}
      <div className="container grid grid-cols-1 gap-8 py-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Portal" className="space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-[#171717] text-white"
                    : "text-[#171717] hover:bg-white")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div>{children}</div>
      </div>
    </div>
  );
}
