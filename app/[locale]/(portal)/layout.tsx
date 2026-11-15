import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PortalShell, { type PortalNavItem } from "@/components/PortalShell";
import { getCurrentUser } from "@/lib/supabaseServer";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";

// (portal)/layout.tsx —— 统一后台外壳（侧边栏 + 顶栏）
//
// 把供应商工作台相关的 4 个页面（/portal、/supplier-assessment、
// /supplier-dashboard、/supplier-certificates）包进同一个侧边栏外壳，
// 形成「像 Sedex 那样」的统一后台观感。URL 完全不变（route group 不影响路径）。
//
// 分工：
//   本 layout 只负责「外壳 + 导航」；各子页面保留自己的归属裁决与内容渲染
//   （它们读 ?supplier= / ?email= 做 resolveSupplierAccess，逻辑不动）。
//
// 未登录时：不套侧边栏，直接渲染 children —— 让子页面自己显示「请登录」引导，
//           避免游客看到一个空壳后台。

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function PortalLayout({ children, params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh" || locale === "zh-TW";

  const user = await getCurrentUser();
  if (!user) {
    // 未登录：不套侧边栏，子页面自己显示登录引导
    return <>{children}</>;
  }

  // 供应商归属裁决（复用唯一裁决层）。买家不是这些页面的受众，但即便买家
  // 误入（如直接手敲 /supplier-assessment），也由子页面自身的 not_owner 逻辑兜底。
  const access = await resolveSupplierAccess({
    claimedSupplierId: null,
    email: null,
  });
  const isSupplier = access.ok;

  // 导航按角色动态：供应商看到「供应商工作台」菜单（4 页均在 group 内，统一侧边栏）；
  // 买家看到「买家工作台」菜单（收藏/询价等指向 /account 下既有页面，跳转后由
  // 各页面自带的面包屑导航承接 —— 买家功能少，不强求侧边栏贯穿）。
  const nav: PortalNavItem[] = isSupplier
    ? [
        { href: p("/portal"), label: zh ? "工作台总览" : "Overview" },
        { href: p("/supplier-assessment"), label: zh ? "自评问卷" : "Self-assessment" },
        { href: p("/supplier-dashboard"), label: zh ? "表现看板" : "Performance" },
        { href: p("/supplier-certificates"), label: zh ? "证书申报" : "Certificates" },
        { href: p("/assessment-faq"), label: zh ? "自评 FAQ" : "Assessment FAQ" },
      ]
    : [
        { href: p("/portal"), label: zh ? "工作台总览" : "Overview" },
        { href: p("/account/saved"), label: zh ? "收藏的供应商" : "Saved suppliers" },
        { href: p("/account/rfqs"), label: zh ? "我的询价" : "My RFQs" },
        { href: p("/suppliers"), label: zh ? "浏览供应商" : "Browse suppliers" },
        { href: p("/assessment-faq/buyer"), label: zh ? "读懂自评" : "Understanding SAQ" },
      ];

  return (
    <PortalShell
      email={user.email ?? null}
      roleLabel={isSupplier ? (zh ? "供应商" : "Supplier") : zh ? "买家" : "Buyer"}
      nav={nav}
      homeHref={p("/")}
      logoutHref={p("/login")}
    >
      {children}
    </PortalShell>
  );
}
