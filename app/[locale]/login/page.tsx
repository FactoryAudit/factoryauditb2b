import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/pageMeta";
import { getDictionary } from "@/i18n/getDictionary";

const PATH = "/login";
type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; next?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.auth.login.title,
    description: t.auth.login.lead,
    robots: { index: false, follow: false },
  });
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const { error, next } = await searchParams;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);

  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  // 只接受站内相对路径，防止 open redirect
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
  const callbackUrl = safeNext ? `${prefix}${safeNext}` : localePath(locale, "/");

  // admin 未登录访问 /admin 时会带 ?error=admin_only，这里给出明确提示
  const initialError =
    error === "admin_only" ? t.auth.login.errorAdminOnly : error ? t.auth.login.errorInvalid : "";

  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="container py-16 max-w-md">
      <h1 className="text-2xl font-bold text-[#0f172a] mb-2 text-center">{t.auth.login.title}</h1>
      <p className="text-sm text-[#64748b] text-center mb-6">{t.auth.login.lead}</p>

      <div className="card p-6 sm:p-8 space-y-4">
        <LoginForm
          dict={t.auth as never}
          googleEnabled={googleEnabled}
          callbackUrl={callbackUrl}
          initialError={initialError}
        />
        <p className="text-sm text-[#64748b] text-center">
          {t.auth.login.noAccount}{" "}
          <Link
            href={localePath(locale, "/register")}
            className="text-[#0f4c81] font-medium hover:underline"
          >
            {t.auth.login.registerLink}
          </Link>
        </p>
        <Link href={localePath(locale, "/")} className="text-sm text-[#0f4c81] block text-center">
          ← {t.auth.login.backHome}
        </Link>
      </div>
    </div>
  );
}
