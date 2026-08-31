import type { Metadata } from "next";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/terms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.legal.termsTitle,
    description: t.legal.termsIntro,
  });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const l = t.legal;

  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-extrabold text-[#0f172a]">{l.termsTitle}</h1>
      <p className="text-sm text-[#94a3b8] mt-1 mb-6">{l.termsUpdated}</p>
      <p className="text-[#475569] leading-relaxed mb-8">{l.termsIntro}</p>
      <div className="space-y-6">
        {l.termsSections.map((s, i) => (
          <section key={i}>
            <h2 className="text-lg font-bold text-[#0f4c81] mb-1">{s.h}</h2>
            <p className="text-[#475569] leading-relaxed">{s.b}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
