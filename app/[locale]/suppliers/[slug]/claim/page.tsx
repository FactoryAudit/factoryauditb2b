import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import ClaimForm from "@/components/ClaimForm";
import { getSupplierDetail, listSupplierSlugs } from "@/lib/queries";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";

const DIRECTORY_PATH = "/suppliers";
const BASE = "https://factoryauditb2b.com";

export async function generateStaticParams() {
  const slugs = await listSupplierSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const path = `${DIRECTORY_PATH}/${slug}/claim`;
  const t = await getDictionary(locale);
  const s = await getSupplierDetail(slug);
  if (!s) {
    return buildPageMetadata({
      locale,
      path,
      title: t.claim.metaTitle,
      description: t.claim.metaDesc,
      robots: { index: false },
    });
  }
  // Claim 页是表单页（thin content），一律 noindex，避免与主 profile 竞争
  return buildPageMetadata({
    locale,
    path,
    title: `${t.claim.metaTitle} — ${s.legalName}`,
    description: t.claim.metaDesc,
    robots: { index: false, follow: true },
  });
}

export default async function SupplierClaimPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const cl = t.claim;
  const sp = t.supplierProfile;
  const p = (href: string) => localePath(locale, href);

  const s = await getSupplierDetail(slug);
  if (!s) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${cl.metaTitle} — ${s.legalName}`,
    url: `${BASE}${p(`${DIRECTORY_PATH}/${slug}/claim`)}`,
  };

  return (
    <main
      className="container py-12 max-w-4xl"
      data-track-page={ANALYTICS_EVENTS.claimView}
    >
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="text-sm text-[#64748b]">
        <Link href={p("/")} className="hover:text-[#0f4c81]">
          {t.countryHub.breadcrumbHome}
        </Link>
        <span className="mx-2">/</span>
        <Link href={p(DIRECTORY_PATH)} className="hover:text-[#0f4c81]">
          {sp.directoryBreadcrumb}
        </Link>
        <span className="mx-2">/</span>
        <Link href={p(`${DIRECTORY_PATH}/${slug}`)} className="hover:text-[#0f4c81]">
          {s.legalName}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#0f172a]">{cl.h1}</span>
      </nav>

      <section className="mt-6 mb-8">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {cl.badge}
        </span>
        <h1 className="text-3xl font-bold text-[#0f172a] mt-2">
          {cl.h1} — {s.legalName}
        </h1>
        <p className="text-[#64748b] mt-2 max-w-3xl">{cl.lead}</p>
      </section>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <section>
          {/* 正在认领的公开信息 */}
          <div className="card p-5 mb-6">
            <h2 className="font-semibold text-[#0f172a]">{cl.publicDataTitle}</h2>
            <p className="text-sm text-[#64748b] mt-1 mb-3">{cl.publicDataLead}</p>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#64748b]">{cl.companyNameLabel}</dt>
                <dd className="font-medium text-[#0f172a] text-right">{s.legalName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#64748b]">{sp.riskScore}</dt>
                <dd className="font-medium text-[#0f172a] text-right">
                  {typeof s.riskScore === "number" ? `${s.riskScore} / 100` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#64748b]">{sp.lastChecked}</dt>
                <dd className="font-medium text-[#0f172a] text-right">
                  {s.lastChecked ?? sp.noCheckRecord}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#64748b]">{t.verification.evidence}</dt>
                <dd className="font-medium text-[#0f172a] text-right">{s.evidenceCount ?? 0}</dd>
              </div>
            </dl>
            <Link
              href={p(`${DIRECTORY_PATH}/${slug}`)}
              className="text-sm text-[#0f4c81] underline mt-3 inline-block"
            >
              {cl.backToProfile}
            </Link>
          </div>

          {/* 规则：不保证结果、不出售核验结论 */}
          <div className="card p-5 bg-[#fff8f0] border-[#f0d9b8]">
            <h2 className="font-semibold text-[#0f172a]">{cl.rulesTitle}</h2>
            <ul className="mt-2 space-y-2 text-sm text-[#475569]">
              {cl.rules.map((r: string) => (
                <li key={r} className="flex gap-2">
                  <span className="text-[#a86a13]">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[#0f172a] mb-3">{cl.formTitle}</h2>
          <ClaimForm t={cl.form} slug={slug} legalName={s.legalName} />
        </section>
      </div>
    </main>
  );
}
