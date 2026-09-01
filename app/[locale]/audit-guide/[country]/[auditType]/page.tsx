import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getSeoMatrix, listStandards } from "@/lib/taxonomy";
import { listSuppliersByAuditType } from "@/lib/queries";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import JsonLd from "@/components/JsonLd";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

export const dynamic = "force-static";

const BASE = "https://factoryauditb2b.com";
// 仅 Phase 1 三国（中/越/泰）有差异化内容，其余国家不建页、不收录（PRD §8）
const COVERAGE_CODES = new Set(COVERAGE_COUNTRIES.map((c) => c.code));

type Params = { locale: string; country: string; auditType: string };

export async function generateStaticParams() {
  const { countries, auditTypes } = await getSeoMatrix();
  const covered = countries.filter((c) => COVERAGE_CODES.has(c.code));
  // 必须带上 locale，否则这批页面不会按语言生成（此前漏了 locale）
  return LOCALES.flatMap((locale) =>
    covered.flatMap((c) => auditTypes.map((a) => ({ locale, country: c.code, auditType: a.code })))
  );
}

async function resolve(params: Promise<Params>) {
  const { locale: raw, country, auditType } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const { countries, auditTypes } = await getSeoMatrix();
  const c = countries.find((x) => x.code === country);
  const a = auditTypes.find((x) => x.code === auditType);
  // 非 Phase 1 国家直接 404，避免薄内容被收录
  if (!c || !a || !COVERAGE_CODES.has(c.code)) notFound();
  return { locale, c, a };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, c, a } = await resolve(params);
  const t = await getDictionary(locale);
  const g = t.auditGuide;
  const title = g.metaTitle.replaceAll("{type}", a.nameEn).replaceAll("{country}", c.name);
  const description = g.metaDesc.replaceAll("{type}", a.nameEn).replaceAll("{country}", c.name);
  return buildPageMetadata({
    locale,
    path: `/audit-guide/${c.code}/${a.code}`,
    title,
    description,
  });
}

export default async function AuditGuidePage({ params }: { params: Promise<Params> }) {
  const { locale, c, a } = await resolve(params);
  const t = await getDictionary(locale);
  const lp = (href: string) => localePath(locale, href);
  const g = t.auditGuide;

  const suppliers = await listSuppliersByAuditType(c.code, a.code);

  const standards = await listStandards();
  const relatedStandards = standards
    .filter((s) => s.category === (a.taxonomyCode ?? undefined))
    .slice(0, 8);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: `${a.nameEn} Audit & Verification in ${c.name}`,
            description: g.metaDesc
              .replaceAll("{type}", a.nameEn)
              .replaceAll("{country}", c.name),
            serviceType: a.nameEn,
            areaServed: c.name,
            provider: { "@type": "Organization", name: "FactoryAuditB2B", url: BASE },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
              // /audit-guide 与 /audit-guide/{country} 都没有索引页，
              // 面包屑只保留真实存在的层级，避免结构化数据里出现死链
              {
                "@type": "ListItem",
                position: 2,
                name: c.name,
                item: `${BASE}/countries/${c.code}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: `${a.nameEn} — ${c.name}`,
                item: `${BASE}/audit-guide/${c.code}/${a.code}`,
              },
            ],
          },
        ]}
      />

      <nav className="mb-4 text-sm text-gray-500">
        <Link href={lp("/")} className="hover:underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href={lp(`/countries/${c.code}`)} className="hover:underline">
          {c.name}
        </Link>{" "}
        / {a.nameEn}
      </nav>

      <h1 className="text-3xl font-bold">
        {g.h1.replaceAll("{type}", a.nameEn).replaceAll("{country}", c.name)}
      </h1>
      <p className="mt-2 max-w-3xl text-gray-600">
        {a.nameZh && <span className="block">{a.nameZh}</span>}
        {a.owner && (
          <span className="block text-sm">
            {g.ownerLabel} {a.owner}
          </span>
        )}
        {a.description && <span className="block mt-1">{a.description}</span>}
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{g.standardsTitle}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {relatedStandards.length === 0 ? (
            <p className="text-gray-500 text-sm">{g.noStandards}</p>
          ) : (
            relatedStandards.map((s) => (
              <span key={s.code} className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                {s.nameZh || s.nameEn}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">
          {g.suppliersTitle
            .replaceAll("{type}", a.nameEn)
            .replaceAll("{country}", c.name)
            .replaceAll("{n}", String(suppliers.length))}
        </h2>
        {suppliers.length === 0 ? (
          <p className="mt-2 text-gray-500">{g.emptySuppliers}</p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border">
            {suppliers.map((s) => (
              <li key={s.slug} className="flex items-center justify-between p-3">
                <Link
                  href={lp(`/supplier/${s.countryCode}/${s.slug}`)}
                  className="font-medium hover:underline"
                >
                  {s.legalName}
                </Link>
                <span className="text-sm text-gray-500">
                  {s.city} · {g.riskLabel} {s.riskLevel || "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-lg bg-blue-50 p-4">
        <h2 className="font-semibold">{g.ctaTitle.replaceAll("{type}", a.nameEn)}</h2>
        <p className="mt-1 text-sm text-gray-600">{g.ctaDesc}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={lp("/rfq")} className="btn btn-primary inline-block">
            {g.ctaButton}
          </Link>
          <Link
            href={lp("/services/supplier-verification")}
            className="btn btn-outline inline-block"
          >
            {g.verificationCta}
          </Link>
        </div>
      </section>
    </main>
  );
}
