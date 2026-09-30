import type { Metadata } from "next";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { RelatedPolicies, type PolicyLink } from "@/components/legal/ComplianceSections";

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
  const p = (href: string) => localePath(locale, href);

  // CS-23：与 /confidentiality、/integrity、/trust、/privacy 互链（纯追加，正文未改）。
  const links: PolicyLink[] = [
    { href: p("/terms"), label: t.footer.terms, current: true },
    { href: p("/privacy"), label: t.footer.privacy },
    { href: p("/confidentiality"), label: t.footer.confidentiality },
    { href: p("/integrity"), label: t.footer.integrity },
    { href: p("/trust"), label: t.trust.badge },
  ];

  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-extrabold text-[#171717]">{l.termsTitle}</h1>
      <p className="text-sm text-[#8c8982] mt-1 mb-6">{l.termsUpdated}</p>
      <p className="text-[#3f4650] leading-relaxed mb-8">{l.termsIntro}</p>
      <div className="space-y-6">
        {l.termsSections.map((s, i) => (
          <section key={i}>
            <h2 className="text-lg font-bold text-[#171717] mb-1">{s.h}</h2>
            <p className="text-[#3f4650] leading-relaxed">{s.b}</p>
          </section>
        ))}
      </div>
      <RelatedPolicies title={t.compliance.relatedTitle} links={links} />
    </div>
  );
}
