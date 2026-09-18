import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/adminData";
import { REPORT_HEADER } from "@/lib/standardReport";

// Admin 布局 —— 权限闸门 + 侧边导航
//
// 三条安全设计：
//   1. 非 admin 一律 notFound()（渲染 404），不返回 401/403 ——
//      不向外界暴露"这里有个后台"，也不给攻击者可探测的响应差异。
//   2. force-dynamic：后台数据必须实时，且绝不能被 Cloudflare 缓存。
//   3. 这里只做**页面级**校验。每个 /api/admin/* 仍要各自调一次 requireAdmin()，
//      因为 API 可以被直接调用，不经过任何 layout。
//
// 注意：本 layout 是整站唯一允许在页面层级读 cookie 的地方之一。
//       /suppliers 与 /suppliers/[slug] 严禁这么做（会破坏 ● SSG）。

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminLayout({ children, params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  // 权限闸门：未登录 / 非管理员 → 404
  const admin = await requireAdmin();
  if (!admin) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);

  // 侧边导航。前四项来自 admin 命名空间；「待审核」标签复用 evidenceCenter，
  // 避免为 1 个标签在 admin 命名空间再补 9 语翻译（后台是单人工具，noindex）。
  const NAV = [
    { href: "/admin", label: a.navOverview },
    { href: "/admin/suppliers", label: a.navSuppliers },
    { href: "/admin/rfqs", label: a.navRfqs },
    { href: "/admin/leads", label: a.navLeads },
    // CS-17：订单。标签复用 admin.orders.ordersTitle，不为内部导航再补 9 语键
    { href: "/admin/orders", label: a.orders.ordersTitle },
    // CS-18：审核工作流后台。标签用双语常量，不为内部导航补 9 语键（后台单人、noindex）
    { href: "/admin/audits", label: locale === "zh" || locale === "zh-TW" ? "验厂工单" : "Audits" },
    { href: "/admin/members", label: a.navMembers },
    { href: "/admin/pending-review", label: t.evidenceCenter.adminNavPending },
    // 「标准报告样张」标签取双语常量，不为 1 个内部标签补 9 语翻译
    { href: "/admin/report-standard", label: REPORT_HEADER.title[locale === "zh" || locale === "zh-TW" ? "zh" : "en"] },
  ];

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      {/* 顶部：返回前台 + 当前管理员 */}
      <div className="border-b border-[#e2e8f0] bg-white">
        <div className="container flex items-center justify-between py-3 text-sm">
          <span className="font-semibold text-[#0f172a]">{a.title}</span>
          <div className="flex items-center gap-4">
            <span className="text-[#64748b]">{admin.email ?? ""}</span>
            <Link href={p("/")} className="text-[#0f4c81] hover:underline">
              {a.backToSite}
            </Link>
          </div>
        </div>
      </div>

      <div className="container grid gap-8 py-8 lg:grid-cols-[200px_1fr]">
        <nav aria-label={a.navLabel} className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={p(item.href)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-[#0f172a] hover:bg-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div>{children}</div>
      </div>
    </div>
  );
}
