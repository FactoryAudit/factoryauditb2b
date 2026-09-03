import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import LoginForm from "@/components/LoginForm";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";

const PATH = "/login";
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
    title: t.login.metaTitle,
    description: t.login.metaDesc,
    // 登录页不参与搜索排名，但必须可访问（用户从导航点进来）
    robots: { index: false, follow: true },
  });
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const l = t.login;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: l.h1,
    url: `${BASE}${p(PATH)}`,
    description: l.metaDesc,
  };

  return (
    <main
      className="container py-12 max-w-md"
      data-track-page={ANALYTICS_EVENTS.loginView}
    >
      <JsonLd data={jsonLd} />

      <h1 className="text-3xl font-bold text-[#0f172a]">{l.h1}</h1>
      <p className="text-[#64748b] mt-2">{l.lead}</p>

      <div className="mt-8">
        <LoginForm t={l.form} redirectTo={p("/account")} />
      </div>

      <p className="text-sm text-[#64748b] mt-6">
        {l.noAccount}{" "}
        <Link href={p("/register")} className="text-[#0f4c81] underline">
          {l.registerLink}
        </Link>
      </p>
    </main>
  );
}
