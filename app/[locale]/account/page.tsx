import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import AccountPanel from "@/components/AccountPanel";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/account";
const BASE = "https://factoryauditb2b.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.account.metaTitle,
    description: t.account.metaDesc,
    // 账号页是登录后才能看到内容的页面，不参与搜索索引
    robots: { index: false, follow: false },
  });
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const a = t.account;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: a.h1,
    url: `${BASE}${p(PATH)}`,
    description: a.metaDesc,
  };

  return (
    <main className="container py-12 max-w-2xl">
      <JsonLd data={jsonLd} />

      <h1 className="text-3xl font-bold text-[#0f172a]">{a.h1}</h1>
      <p className="text-[#64748b] mt-2">{a.lead}</p>

      <div className="mt-8">
        <AccountPanel
          t={a.panel}
          locale={locale}
          signInHref={p("/login")}
          registerHref={p("/register")}
          membershipHref={p("/pricing#founding-buyer")}
        />
      </div>
    </main>
  );
}
