import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
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
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";
import { OG_IMAGE } from "@/lib/pageMeta";
import { organizationSchema } from "@/lib/organizationSchema";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

const BASE = "https://factoryauditb2b.com";

// 没有独立 generateMetadata 的客户端工具页，用 toolCards 兜底差异化 title/canonical
// （修复 SEO-AUDIT P0-1：此前这些页面 canonical 全部指向首页）
const TOOL_TITLE_KEY: Record<string, "auditChecklist" | "auditReportAnalyzer" | "documentChecker" | "riskAssessment" | "supplierScorecard"> = {
  "/tools/audit-checklist": "auditChecklist",
  "/tools/audit-report-analyzer": "auditReportAnalyzer",
  "/tools/supplier-document-checker": "documentChecker",
  "/tools/supplier-risk-assessment": "riskAssessment",
  "/tools/supplier-scorecard": "supplierScorecard",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);

  // 从 middleware 注入的 x-pathname 取当前路径（可能带语言前缀）
  const h = await headers();
  const rawPath = h.get("x-pathname") || "/";
  let basePath = rawPath;
  for (const l of LOCALES) {
    if (rawPath.startsWith(`/${l}`)) {
      basePath = rawPath.slice(l.length + 1) || "/";
      break;
    }
  }
  if (!basePath.startsWith("/")) basePath = `/${basePath}`;

  const toolKey = TOOL_TITLE_KEY[basePath];
  const title = toolKey
    ? `${t.toolCards[toolKey].title} | FactoryAuditB2B`
    : "Factory Audit & Supplier Verification | FactoryAuditB2B";
  const description = toolKey ? t.toolCards[toolKey].desc : t.footer.tagline;

  return {
    title,
    description,
    metadataBase: new URL(BASE),
    // 浏览器标签 / 收藏夹 / PWA 图标。此前未配置，浏览器会回退到默认的空白 favicon
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/logo-icon.svg", sizes: "any", type: "image/svg+xml" },
      ],
      apple: "/logo-icon.svg",
    },
    alternates: {
      canonical: canonicalFor(locale, basePath),
      languages: hreflangFor(basePath),
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalFor(locale, basePath),
      images: [OG_IMAGE],
      locale: undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
    other: { "llms.txt": `${BASE}/llms.txt` },
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
      <head>
        <link rel="llms.txt" href={`${BASE}/llms.txt`} />
      </head>
      <body>
        <JsonLd data={siteGraph} />
        <AnalyticsScripts />
        {/* AuthProvider 包裹全站：会员状态在 hydration 后由客户端拉 /api/me 获得。
            放在这里而不是页面内部，是为了让 UnlockGate 在任何页面都能取到状态。
            它不读 cookie、不阻断渲染，因此不影响各页面的 ● SSG 预渲染。 */}
        <AuthProvider>
          <AnalyticsTracker />
          {/* 账号菜单的「收藏夹 / 询价单」入口文案复用 account 命名空间，
              不在 auth.accountMenu 里再存一份 —— 两处文案永远是同一份，
              改一个地方就够。 */}
          <SiteHeader
            locale={locale}
            dict={t.nav}
            accountDict={{
              ...t.auth.accountMenu,
              saved: t.account.navSaved,
              rfqs: t.account.navRfqs,
            }}
          />
          <main>{children}</main>
          <SiteFooter locale={locale} dict={t.footer} menu={t.nav.menu} whatsappLabel={t.common.whatsappChat} />
          <AiChatWidget locale={locale} dict={t.aiChat} whatsappLabel={t.common.whatsappChat} />
        </AuthProvider>
      </body>
    </html>
  );
}
