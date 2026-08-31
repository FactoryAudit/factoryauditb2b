import type { Metadata } from "next";
import Link from "next/link";
import RegisterForm from "@/components/RegisterForm";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/pageMeta";
import { getDictionary } from "@/i18n/getDictionary";

const PATH = "/register";
type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.auth.register.title,
    description: t.auth.register.lead,
    robots: { index: false, follow: false },
  });
}

export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const { next } = await searchParams;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);

  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  // 只接受站内相对路径，防止 open redirect
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const callbackUrl = `${prefix}${safeNext}`;

  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="container py-16 max-w-lg">
      <h1 className="text-2xl font-bold text-[#0f172a] mb-2 text-center">
        {t.auth.register.title}
      </h1>
      <p className="text-sm text-[#64748b] text-center mb-6">{t.auth.register.lead}</p>

      <div className="card p-6 sm:p-8">
        <RegisterForm
          dict={t.auth as never}
          localePrefix={prefix}
          callbackUrl={callbackUrl}
          googleEnabled={googleEnabled}
        />
      </div>

      <p className="text-sm text-[#64748b] text-center mt-6">
        {t.auth.register.hasAccount}{" "}
        <Link
          href={localePath(locale, "/login")}
          className="text-[#0f4c81] font-medium hover:underline"
        >
          {t.auth.register.loginLink}
        </Link>
      </p>
      <p className="text-center mt-3">
        <Link href={localePath(locale, "/")} className="text-sm text-[#0f4c81]">
          ← {t.auth.login.backHome}
        </Link>
      </p>
    </div>
  );
}
