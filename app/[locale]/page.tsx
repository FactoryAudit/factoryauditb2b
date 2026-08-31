import type { Metadata } from "next";
import Link from "next/link";
import HeroSearch from "@/components/HeroSearch";
import JsonLd from "@/components/JsonLd";
import { listSuppliers } from "@/lib/queries";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import { TOOL_ORDER } from "@/lib/nav";
import { featuredGuides } from "@/lib/guides";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";
import { OG_IMAGE } from "@/lib/pageMeta";

const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const title = `${t.home.h1} | FactoryAuditB2B`;
  return {
    title,
    description: t.home.lead,
    alternates: {
      canonical: canonicalFor(locale, "/"),
      languages: hreflangFor("/"),
    },
    openGraph: {
      title,
      description: t.home.lead,
      type: "website",
      url: canonicalFor(locale, "/"),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t.home.lead,
      images: [OG_IMAGE],
    },
  };
}

export default async function Home({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh";

  const suppliers = await listSuppliers();
  const searchData = suppliers.map((s) => ({
    slug: s.slug,
    legalName: s.legalName,
    city: s.city,
    country: s.country,
    mainProducts: s.mainProducts,
  }));

  const eva = [
    { title: t.home.evaluateTitle, body: t.home.evaluateBody, cta: t.home.evaluateCta, href: "/tools/supplier-risk-calculator" },
    { title: t.home.verifyTitle, body: t.home.verifyBody, cta: t.home.verifyCta, href: "/services/supplier-verification" },
    { title: t.home.auditTitle, body: t.home.auditBody, cta: t.home.auditCta, href: "/factory-audit/request" },
  ];

  const featuredTools = TOOL_ORDER.slice(0, 4).map((x) => ({
    ...t.toolCards[x.cardKey],
    href: x.href,
  }));

  const guides = featuredGuides().map((g) => ({
    title: zh ? g.titleZh : g.titleEn,
    desc: (zh ? g.metaDescZh : g.metaDescEn).slice(0, 120),
    href: `/guides/${g.slug}`,
  }));

  const values = [
    [t.home.why1Title, t.home.why1Body],
    [t.home.why2Title, t.home.why2Body],
    [t.home.why3Title, t.home.why3Body],
    [t.home.why4Title, t.home.why4Body],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.home.toolsTitle,
    url: canonicalFor(locale, "/"),
    itemListElement: featuredTools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.title,
      url: canonicalFor(locale, tool.href),
    })),
  };

  return (
    <>
      {/* HERO */}
      <section className="bg-gradient-to-b from-[#e6eef6] to-[#f7f9fc]">
        <div className="container py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-[#fff4e0] text-[#a86a13] text-sm font-semibold mb-4">
              {t.home.badge}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[#0f172a] leading-tight">
              {t.home.h1}
            </h1>
            <p className="mt-4 text-lg text-[#0f172a] font-medium max-w-xl">{t.home.lead}</p>
            <p className="mt-2 text-[#475569] max-w-xl">{t.home.sub}</p>
            <div className="mt-6 flex gap-3 flex-wrap">
              <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-primary">
                {t.home.ctaPrimary}
              </Link>
              <Link href={p("/services/supplier-verification")} className="btn btn-accent">
                {t.home.ctaSecondary}
              </Link>
              <Link href={p("/factory-audit/request")} className="btn btn-outline">
                {t.home.ctaHighIntent}
              </Link>
            </div>
          </div>
          <HeroSearch suppliers={searchData} t={t.common.heroSearch} />
        </div>
      </section>

      {/* EVALUATE / VERIFY / AUDIT */}
      <section className="container section-pad">
        <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.evaTitle}</h2>
        <p className="text-[#64748b] mt-2 mb-8">{t.home.evaLead}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {eva.map((x) => (
            <div key={x.title} className="card p-6 flex flex-col">
              <h3 className="text-xl font-bold text-[#0f4c81]">{x.title}</h3>
              <p className="text-sm text-[#475569] mt-2 flex-1">{x.body}</p>
              <Link href={p(x.href)} className="btn btn-outline mt-5 self-start">
                {x.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED TOOLS */}
      <section className="container pb-16">
        <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.toolsTitle}</h2>
        <p className="text-[#64748b] mt-2 mb-8">{t.home.toolsLead}</p>
        <JsonLd data={jsonLd} />
        <div className="grid md:grid-cols-4 gap-5">
          {featuredTools.map((tool) => (
            <Link key={tool.href} href={p(tool.href)} className="card p-5 hover:border-[#0f4c81] transition">
              <div className="font-semibold text-[#0f4c81] mb-2">{tool.title}</div>
              <p className="text-sm text-[#475569]">{tool.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-[#f7f9fc]">
        <div className="container section-pad">
          <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.howTitle}</h2>
          <p className="text-[#64748b] mt-2 mb-8">{t.home.howLead}</p>
          <ol className="grid md:grid-cols-4 gap-5">
            {t.home.howSteps.map((step, i) => (
              <li key={step.title} className="card p-6">
                <div className="w-9 h-9 rounded-full bg-[#0f4c81] text-white grid place-items-center font-bold text-sm">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-[#0f172a] mt-3">{step.title}</h3>
                <p className="text-sm text-[#475569] mt-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* WHERE WE VERIFY */}
      <section className="container section-pad">
        <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.coverageTitle}</h2>
        <p className="text-[#64748b] mt-2 mb-8">{t.home.coverageLead}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {COVERAGE_COUNTRIES.map((c) => (
            <div key={c.code} className="card p-6">
              <h3 className="text-xl font-bold text-[#0f172a]">{zh ? c.nameZh : c.name}</h3>
              <p className="text-sm text-[#475569] mt-2">{zh ? c.zh.hook : c.en.hook}</p>
              {/* 三项服务做成可点链接：验货直达 /services/inspection（V4.0 定位不变，入口打通） */}
              <ul className="mt-4 space-y-1 text-sm">
                <li>
                  <Link
                    href={p(`/services/${c.slug}-supplier-verification`)}
                    className="text-[#0f4c81] hover:underline"
                  >
                    · {t.home.coverageService1}
                  </Link>
                </li>
                <li>
                  <Link
                    href={p(`/services/${c.slug}-factory-audit`)}
                    className="text-[#0f4c81] hover:underline"
                  >
                    · {t.home.coverageService2}
                  </Link>
                </li>
                <li>
                  <Link
                    href={p("/services/inspection")}
                    className="text-[#0f4c81] hover:underline"
                  >
                    · {t.home.coverageService3}
                  </Link>
                </li>
              </ul>
              <Link href={p(`/countries/${c.slug}`)} className="btn btn-outline mt-5 inline-block">
                {t.home.coverageCta}
              </Link>
            </div>
          ))}
          {/* 客户指定的其他地区：把 5 国卡片之后的第 6 格填上，明确「不列出的国家也可接单」 */}
          <div
            data-other-region
            className="card p-6 border-dashed border-[#cbd5e1] flex flex-col"
          >
            <h3 className="text-xl font-bold text-[#0f172a]">{t.home.otherRegionTitle}</h3>
            <p className="text-sm text-[#475569] mt-2 flex-1">
              {t.home.otherRegionBody}
            </p>
            <Link
              href={p("/custom-services")}
              className="btn btn-outline mt-5 self-start"
            >
              {t.home.otherRegionCta}
            </Link>
          </div>
        </div>
        <div className="mt-8 rounded-lg border border-dashed border-[#cbd5e1] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="font-semibold text-[#0f172a]">{t.coverage.anotherCountryTitle}</div>
            <p className="text-sm text-[#475569] mt-1">{t.coverage.anotherCountryLead}</p>
          </div>
          <Link href={p("/custom-services")} className="btn btn-primary whitespace-nowrap">
            {t.coverage.anotherCountryCta}
          </Link>
        </div>
      </section>

      {/* WHY */}
      <section className="bg-[#f7f9fc]">
        <div className="container section-pad">
          <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.whyTitle}</h2>
          <p className="text-[#64748b] mt-2 mb-8">{t.home.whyLead}</p>
          <div className="grid md:grid-cols-4 gap-5">
            {values.map(([title, body]) => (
              <div key={title} className="card p-6">
                <h3 className="font-bold text-[#0f4c81]">{title}</h3>
                <p className="text-sm text-[#475569] mt-2">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED GUIDES */}
      <section className="container section-pad">
        <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.guidesTitle}</h2>
        <p className="text-[#64748b] mt-2 mb-8">{t.home.guidesLead}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {guides.map((g) => (
            <Link key={g.href} href={p(g.href)} className="card p-6 hover:border-[#0f4c81] transition">
              <h3 className="font-semibold text-[#0f4c81]">{g.title}</h3>
              <p className="text-sm text-[#475569] mt-2">{g.desc}…</p>
            </Link>
          ))}
        </div>
      </section>

      {/* HAVE A SUPPLIER ALREADY */}
      <section className="bg-[#0f4c81]">
        <div className="container py-14 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">{t.home.bottomTitle}</h2>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto">{t.home.bottomLead}</p>
          <Link href={p("/services/supplier-verification")} className="btn btn-accent mt-6 inline-block">
            {t.home.bottomCta}
          </Link>
          <div className="mt-4">
            <Link href={p("/rfq")} className="text-white/80 hover:text-white text-sm underline">
              {t.suppliers.notListedTitle}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export const revalidate = 3600;
