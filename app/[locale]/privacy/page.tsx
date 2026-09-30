import type { Metadata } from "next";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { RelatedPolicies, type PolicyLink } from "@/components/legal/ComplianceSections";

const PATH = "/privacy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.legal.privacyTitle,
    description: t.legal.privacyIntro,
  });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const l = t.legal;
  const p = (href: string) => localePath(locale, href);

  // CS-23：与 /confidentiality、/integrity、/trust、/terms 互链。
  // 这是**纯追加**（正文与既有段落一字未改）—— 用户要求「三页与 /privacy、/terms 互链」，
  // 单向链接不叫互链，故隐私政策侧也要有出口。
  const links: PolicyLink[] = [
    { href: p("/privacy"), label: t.footer.privacy, current: true },
    { href: p("/terms"), label: t.footer.terms },
    { href: p("/confidentiality"), label: t.footer.confidentiality },
    { href: p("/integrity"), label: t.footer.integrity },
    { href: p("/trust"), label: t.trust.badge },
  ];

  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-extrabold text-[#171717]">{l.privacyTitle}</h1>
      <p className="text-sm text-[#8c8982] mt-1 mb-6">{l.privacyUpdated}</p>
      <p className="text-[#3f4650] leading-relaxed mb-8">{l.privacyIntro}</p>
      <div className="space-y-6">
        {l.privacySections.map((s, i) => (
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
