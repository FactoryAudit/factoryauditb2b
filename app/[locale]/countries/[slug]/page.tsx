import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { COVERAGE_COUNTRIES, COVERAGE_SERVICES, findCoverageCountry } from "@/lib/coverage";
import { listSuppliersByCountry } from "@/lib/queries";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const BASE = "https://factoryauditb2b.com";
type Params = { locale: string; slug: string };

export async function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    COVERAGE_COUNTRIES.map((c) => ({ locale, slug: c.slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const country = findCoverageCountry(slug);
  if (!country) {
    return buildPageMetadata({
      locale,
      path: `/countries/${slug}`,
      title: "Coverage",
      description: "Supplier verification coverage.",
      robots: { index: false },
    });
  }
  const t = await getDictionary(locale);
  const name = locale === "zh" ? country.nameZh : country.name;
  return buildPageMetadata({
    locale,
    path: `/countries/${slug}`,
    title: `${name} Supplier Verification & Factory Audit`,
    description: t.countryHub.metaDesc.replaceAll("{country}", name),
  });
}

export default async function CountryPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const country = findCoverageCountry(slug);
  if (!country) notFound();

  const t = await getDictionary(locale);
  const h = t.countryHub;
  const p = (href: string) => localePath(locale, href);
  const name = locale === "zh" ? country.nameZh : country.name;
  const copy = locale === "zh" ? country.zh : country.en;

  const suppliers = (await listSuppliersByCountry(country.code)).slice(0, 12);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${name} Supplier Verification`,
      serviceType: "Supplier verification",
      areaServed: name,
      description: country.metaDesc,
      provider: { "@type": "Organization", name: "FactoryAuditB2B", url: BASE },
      url: `${BASE}${p(`/countries/${slug}`)}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
        {
          "@type": "ListItem",
          position: 2,
          name: t.coverage.h1,
          item: `${BASE}${p("/countries")}`,
        },
        { "@type": "ListItem", position: 3, name, item: `${BASE}${p(`/countries/${slug}`)}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: copy.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  const services = COVERAGE_SERVICES.map((svc) => ({
    title: locale === "zh" ? svc.nameZh : svc.nameEn,
    href: `/services/${country.slug}-${svc.slugSuffix}`,
  }));

  return (
    <main className="container py-12 max-w-4xl">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-[#64748b]">
        <Link href={p("/")} className="hover:underline">Home</Link>
        {" / "}
        <Link href={p("/countries")} className="hover:underline">{h.breadcrumb}</Link>
        {" / "}{name}
      </nav>

      <h1 className="text-4xl font-extrabold text-[#0f172a]">
        {name} Supplier Verification &amp; Factory Audit
      </h1>
      <p className="mt-3 text-lg text-[#475569]">{copy.hook}</p>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{h.profileTitle}</h2>
        <p className="text-[#475569] mt-2">{copy.profile}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{h.risksTitle}</h2>
        <ul className="mt-3 space-y-2 text-[#475569]">
          {copy.risks.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl font-bold text-[#0f172a]">{h.verificationTitle}</h2>
          <ul className="mt-3 space-y-2 text-[#475569]">
            {copy.verificationNotes.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#0f172a]">{h.auditTitle}</h2>
          <ul className="mt-3 space-y-2 text-[#475569]">
            {copy.auditNotes.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{h.hubsTitle}</h2>
        <ul className="mt-3 space-y-1 text-[#475569]">
          {copy.hubs.map((x) => (
            <li key={x}>· {x}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl font-bold text-[#0f172a]">{h.industriesTitle}</h2>
          <ul className="mt-3 space-y-1 text-[#475569]">
            {copy.industries.map((x) => (
              <li key={x}>· {x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#0f172a]">{h.standardsTitle}</h2>
          <ul className="mt-3 space-y-1 text-[#475569]">
            {copy.standards.map((x) => (
              <li key={x}>· {x}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{h.logisticsTitle}</h2>
        <p className="text-[#475569] mt-2">{copy.logistics}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{h.registryTitle}</h2>
        <p className="text-[#475569] mt-2">{copy.registry}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{h.servicesTitle}</h2>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          {services.map((s) => (
            <Link key={s.href} href={p(s.href)} className="card p-4 hover:border-[#0f4c81]">
              {s.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{h.toolsTitle}</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-outline">
            {t.toolCards.riskCalculator.title}
          </Link>
          <Link href={p("/tools/supplier-verification-checklist")} className="btn btn-outline">
            {t.toolCards.verificationChecklist.title}
          </Link>
          <Link href={p("/tools/audit-checklist")} className="btn btn-outline">
            {t.toolCards.auditChecklist.title}
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">
          {h.suppliersTitle.replace("{country}", name)}
        </h2>
        {suppliers.length === 0 ? (
          <p className="mt-2 text-[#475569]">
            {h.suppliersEmpty.replace("{country}", name)}
          </p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border border-[#e2e8f0]">
            {suppliers.map((s) => (
              <li key={s.slug} className="flex items-center justify-between p-3">
                <Link
                  href={p(`/supplier/${s.countryCode}/${s.slug}`)}
                  className="font-medium text-[#0f4c81] hover:underline"
                >
                  {s.legalName}
                </Link>
                <span className="text-sm text-[#64748b]">
                  {s.city} · {t.supplierProfile.riskScore}{" "}
                  {typeof s.riskScore === "number" ? `${s.riskScore} / 100` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* 注意：此处不再出现中文「风险」硬编码，口径统一走字典（P0 语言一致性） */}

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{h.faqTitle}</h2>
        <div className="mt-3 space-y-4">
          {copy.faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-[#0f172a]">{f.q}</h3>
              <p className="text-[#475569] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 card p-8 bg-[#f7f9fc]">
        <h2 className="text-xl font-bold text-[#0f172a]">
          {h.ctaTitle.replace("{country}", name)}
        </h2>
        <p className="text-[#475569] mt-2">{h.ctaLead.replace("{country}", name)}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={p(`/services/${country.slug}-supplier-verification`)} className="btn btn-primary">
            {h.ctaPrimary.replace("{country}", name)}
          </Link>
          <Link href={p(`/services/${country.slug}-factory-audit`)} className="btn btn-outline">
            {h.ctaSecondary.replace("{country}", name)}
          </Link>
        </div>
      </section>
    </main>
  );
}
