import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import {
  COVERAGE_COUNTRIES,
  COVERAGE_SERVICE_SLUGS,
  findCoverageService,
} from "@/lib/coverage";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const BASE = "https://factoryauditb2b.com";
type Params = { locale: string; slug: string };

export async function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    COVERAGE_SERVICE_SLUGS.map((x) => ({ locale, slug: x.slug }))
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const entry = findCoverageService(slug);
  if (!entry) {
    return buildPageMetadata({
      locale,
      path: `/services/${slug}`,
      title: "Service",
      description: "Service page.",
      robots: { index: false },
    });
  }
  const t = await getDictionary(locale);
  const countryName = locale === "zh" ? entry.country.nameZh : entry.country.name;
  const serviceName = locale === "zh" ? entry.service.nameZh : entry.service.nameEn;
  return buildPageMetadata({
    locale,
    path: `/services/${slug}`,
    title: `${countryName} ${serviceName}`,
    description: t.serviceCountry.metaDesc
      .replaceAll("{service}", serviceName)
      .replaceAll("{country}", countryName),
  });
}

export default async function CountryServicePage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const entry = findCoverageService(slug);
  if (!entry) notFound();

  const t = await getDictionary(locale);
  const sc = t.serviceCountry;
  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh";

  const countryName = zh ? entry.country.nameZh : entry.country.name;
  const serviceName = zh ? entry.service.nameZh : entry.service.nameEn;
  const svc = zh ? entry.service.zh : entry.service;
  const countryCopy = zh ? entry.country.zh : entry.country.en;

  // 国家层面与该服务直接相关的要点：核查页用 verificationNotes，验厂页用 auditNotes。
  // 这是各国页面之间真正的内容差异，不是把 China 替换成 Vietnam。
  const countrySpecific =
    entry.service.code === "verification"
      ? countryCopy.verificationNotes
      : countryCopy.auditNotes;

  const faq = [
    ...svc.faq,
    {
      q:
        entry.service.code === "verification"
          ? sc.scopedQ.replaceAll("{country}", countryName)
          : sc.contextTitle
              .replaceAll("{service}", serviceName)
              .replaceAll("{country}", countryName),
      a: countrySpecific.join(" "),
    },
    {
      q: sc.timelineQ.replaceAll("{country}", countryName),
      a: sc.timelineA.replaceAll("{country}", countryName),
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${countryName} ${serviceName}`,
      serviceType: serviceName,
      areaServed: countryName,
      description: svc.quickAnswer,
      provider: { "@type": "Organization", name: "FactoryAuditB2B", url: BASE },
      url: `${BASE}${p(`/services/${slug}`)}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
        {
          "@type": "ListItem",
          position: 2,
          name: sc.breadcrumb,
          item: `${BASE}${p("/services")}`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: `${countryName} ${serviceName}`,
          item: `${BASE}${p(`/services/${slug}`)}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  const related = COVERAGE_COUNTRIES.filter((c) => c.slug !== entry.country.slug).flatMap((c) => [
    { href: `/services/${c.slug}-${entry.service.slugSuffix}`, label: `${zh ? c.nameZh : c.name} ${serviceName}` },
  ]);

  return (
    <main className="container py-12 max-w-4xl">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-[#64748b]">
        <Link href={p("/")} className="hover:underline">Home</Link>
        {" / "}
        <Link href={p("/services")} className="hover:underline">{sc.breadcrumb}</Link>
        {" / "}{countryName} {serviceName}
      </nav>

      <h1 className="text-4xl font-extrabold text-[#0f172a]">
        {countryName} {serviceName}
      </h1>
      <p className="mt-3 text-lg text-[#475569]">{svc.intro}</p>

      <section className="mt-8 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-bold text-[#0f172a]">{sc.quickAnswerTitle}</h2>
        <p className="text-[#475569] mt-2">{svc.quickAnswer}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">
          {sc.contextTitle
            .replace("{service}", serviceName)
            .replace("{country}", countryName)}
        </h2>
        <p className="text-[#475569] mt-2">{countryCopy.profile}</p>
        <ul className="mt-4 space-y-2 text-[#475569]">
          {countrySpecific.map((x) => (
            <li key={x}>· {x}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl font-bold text-[#0f172a]">{sc.scopeTitle}</h2>
          <ul className="mt-3 space-y-2 text-[#475569]">
            {svc.includes.map((x) => (
              <li key={x}>✓ {x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#0f172a]">{sc.deliverablesTitle}</h2>
          <ul className="mt-3 space-y-2 text-[#475569]">
            {svc.deliverables.map((x) => (
              <li key={x}>· {x}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{sc.processTitle}</h2>
        <ol className="mt-3 space-y-3">
          {svc.process.map((s, i) => (
            <li key={s.title} className="card p-4">
              <div className="font-semibold text-[#0f172a]">
                {i + 1}. {s.title}
              </div>
              <p className="text-sm text-[#475569] mt-1">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{sc.pricingTitle}</h2>
        <p className="text-[#475569] mt-2">{svc.pricingBasis}</p>
        <p className="text-sm text-[#64748b] mt-2">{t.pricing.reportsNote}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{t.countryHub.faqTitle}</h2>
        <div className="mt-3 space-y-4">
          {faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-[#0f172a]">{f.q}</h3>
              <p className="text-[#475569] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{t.countryHub.toolsTitle}</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-outline">
            {t.toolCards.riskCalculator.title}
          </Link>
          <Link href={p("/tools/supplier-verification-checklist")} className="btn btn-outline">
            {t.toolCards.verificationChecklist.title}
          </Link>
          <Link href={p("/methodology")} className="btn btn-outline">
            {t.reportPreview.methodologyTitle}
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{sc.relatedTitle}</h2>
        <ul className="mt-3 space-y-2">
          {related.map((r) => (
            <li key={r.href}>
              <Link href={p(r.href)} className="text-[#0f4c81] hover:underline">
                {r.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href={p(`/countries/${entry.country.slug}`)} className="text-[#0f4c81] hover:underline">
              {countryName} {t.home.coverageCta}
            </Link>
          </li>
          <li>
            <Link
              href={p(
                entry.service.code === "verification"
                  ? `/services/${entry.country.slug}-factory-audit`
                  : `/services/${entry.country.slug}-supplier-verification`
              )}
              className="text-[#0f4c81] hover:underline"
            >
              {countryName}{" "}
              {entry.service.code === "verification"
                ? zh
                  ? COVERAGE_SERVICE_SLUGS.find((x) => x.slug === `${entry.country.slug}-factory-audit`)!.service.nameZh
                  : "Factory Audit"
                : zh
                  ? "供应商核查"
                  : "Supplier Verification"}
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-10 card p-8 bg-[#0f4c81]">
        <h2 className="text-2xl font-bold text-white">
          {sc.ctaTitle.replace("{service}", serviceName).replace("{country}", countryName)}
        </h2>
        <p className="mt-2 text-white/80">{sc.ctaLead}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={p("/custom-services")} className="btn btn-accent">
            {sc.ctaPrimary}
          </Link>
          <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-outline border-white text-white">
            {sc.ctaSecondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
