import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AiChatWidget from "@/components/AiChatWidget";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import { AuthProvider } from "@/components/AuthProvider";
import JsonLd from "@/components/JsonLd";
import { LOCALES, isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { OG_IMAGE } from "@/lib/pageMeta";
import { organizationSchema } from "@/lib/organizationSchema";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

const BASE = "https://factoryauditb2b.com";

// ★ CS-19（工单 SEO-20260918-FAB 任务 1.1）—— 本文件不再读取 x-pathname。
// ─────────────────────────────────────────────────────────────────────────────
// 历史：此前这里用 `await headers()` 取 middleware 注入的 x-pathname 推 basePath，
// 再由 basePath 生成 canonical / hreflang，并为 5 个客户端工具页兜底 title。
//
// 问题：Next 15 中 generateMetadata 只要调用 `headers()` 这类 Dynamic API，
// **整棵 [locale] 子树就永久退出静态生成**。实测后果（2026-09-18）：
//   · .next/prerender-manifest.json 仅 319 条路由 = 315 条 audit-guide
//     + sitemap.xml / robots.txt / llms.txt / _not-found；
//     **站点没有任何一个内容页被预渲染**，sitemap 里 1,233 个 URL 全部是
//     每次请求现场 SSR（含 Supabase 往返）。一次 1,233 URL 的爬虫扫描据此
//     把 Free 套餐 Worker 打成 535 个 5xx（Cloudflare 1102）。
//
// 为什么可以安全摘除（均已实测核对，非推断）：
//   · 62 个非 admin 页面中 **54 个自带 generateMetadata**，经 lib/pageMeta.ts 的
//     buildPageMetadata() 显式声明 canonical + languages；Next 元数据合并中
//     同名字段由**子级覆盖父级** ⇒ 本文件的 alternates 对它们一直是死值。
//   · 其余 8 个（checkout/[ref]、country/[slug]、inspectors、knowledge、
//     membership、order、sample-report、supplier/[country]/[slug]）全部是
//     308 重定向页或**已带 noindex 的事务页**，不依赖 canonical。
//   · 9 个 /tools/* 页面**全部自带 generateMetadata** ⇒ 原 TOOL_TITLE_KEY
//     兜底分支已是死代码，一并移除。
//
// 保留项：icons / metadataBase / verification / robots / OG / Twitter 默认值
// —— 均不依赖请求上下文，摘除 headers() 后行为完全不变。
//
// ⚠️ 因此本文件**不得**再出现 canonical / alternates：它算不出真实路径，
//    只能给出 "/"，那正是 SEO-AUDIT P0-1（canonical 全指首页）的复现方式。
//    canonical 的唯一责任方是各页面自己的 buildPageMetadata()。
const DEFAULT_TITLE = "Factory Audit & Supplier Verification | FactoryAuditB2B";

// 响应式视口（工单 SEO-20260918-FAB 任务 4）：显式声明，保证移动端正确缩放。
// 此前的 viewport 依赖 Next 默认注入，未显式声明；这里固定为设备宽度 + 主题色。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f4c81",
};


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);

  return {
    title: DEFAULT_TITLE,
    description: t.footer.tagline,
    metadataBase: new URL(BASE),
    // 浏览器标签 / 收藏夹 / PWA 图标。此前未配置，浏览器会回退到默认的空白 favicon
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/logo-icon.svg", sizes: "any", type: "image/svg+xml" },
      ],
      apple: "/logo-icon.svg",
    },
    openGraph: {
      title: DEFAULT_TITLE,
      description: t.footer.tagline,
      type: "website",
      url: BASE,
      siteName: "FactoryAuditB2B",
      images: [OG_IMAGE],
      locale: undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: t.footer.tagline,
      images: [OG_IMAGE],
    },
    robots: { index: true, follow: true },
    // GSC / Bing Webmaster 验证：仅在环境变量提供时注入，缺省不影响构建
    ...(process.env.GOOGLE_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION
      ? {
          verification: {
            google: process.env.GOOGLE_SITE_VERIFICATION,
            other: process.env.BING_SITE_VERIFICATION
              ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
              : undefined,
          },
        }
      : {}),
    // CS-01：此处原本还有 `other: { "llms.txt": ... }`，会渲染成
    // <meta name="llms.txt" content="...">。`name="llms.txt"` 不是任何标准/注册过的
    // meta 名，属于无效标签；llms.txt 的声明位置应该是文件本身，不是 meta。已移除。
  };
}

// 全局结构化数据：让搜索引擎与 AI 抓取工具理解站点身份。
// Organization 用 lib/organizationSchema 作为全站唯一事实源（含 areaServed / knowsAbout /
// contactPoint / sameAs），避免每页重复或字段不一致。@id 统一用无斜杠形式
// （https://factoryauditb2b.com#organization），与 organizationSchema() 内部保持一致。
const siteGraph = [
  {
    "@context": "https://schema.org",
    ...organizationSchema(),
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE}#website`,
    url: BASE,
    name: "FactoryAuditB2B",
    publisher: { "@id": `${BASE}#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: `${BASE}/suppliers?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
];

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = await getDictionary(locale);

  return (
    <html
      lang={
        locale === "zh"
          ? "zh-CN"
          : locale === "zh-TW"
          ? "zh-Hant"
          : locale === "pt"
          ? "pt-BR"
          : locale
      }
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      {/* CS-01：这里原本有一个手写的 <head>，里面只有 <link rel="llms.txt">。
          `rel="llms.txt"` 不是合法 link relation（既不在 IANA link-relation 注册表，
          也不是任何爬虫约定）⇒ 无效标签，已随 <head> 一起移除。
          Next 会自行渲染 <head> 并注入 generateMetadata 的产出，无需手写。 */}
      <body>
        <JsonLd data={siteGraph} />
        <AnalyticsScripts />
        {/* AuthProvider 包裹全站：会员状态在 hydration 后由客户端拉 /api/me 获得。
            放在这里而不是页面内部，是为了让 UnlockGate 在任何页面都能取到状态。
            它不读 cookie、不阻断渲染，因此不影响各页面的 ● SSG 预渲染。 */}
        <AuthProvider>
          <AnalyticsTracker />
          {/* 账号菜单的「收藏夹 / 询价单 / 管理后台」入口文案一律复用既有命名空间，
              不在 auth.accountMenu 里再存一份 —— 两处文案永远是同一份，
              改一个地方就够。adminConsole 取 admin.title（后台自己的标题）。 */}
          <SiteHeader
            locale={locale}
            dict={t.nav}
            accountDict={{
              ...t.auth.accountMenu,
              saved: t.account.navSaved,
              rfqs: t.account.navRfqs,
              adminConsole: t.admin.title,
            }}
            whatsappLabel={t.common.whatsappChat}
          />
          <main>{children}</main>
          <SiteFooter locale={locale} dict={t.footer} menu={t.nav.menu} whatsappLabel={t.common.whatsappChat} />
          <AiChatWidget locale={locale} dict={t.aiChat} whatsappLabel={t.common.whatsappChat} />
        </AuthProvider>
      </body>
    </html>
  );
}
