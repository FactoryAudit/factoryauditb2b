import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { SERVICE_MENU } from "@/lib/nav";
import { COVERAGE_COUNTRIES, COVERAGE_SERVICES } from "@/lib/coverage";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/services";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.servicesIndex.metaTitle,
    description: t.servicesIndex.metaDesc,
  });
}

export default async function ServicesPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.servicesIndex;
  const p = (href: string) => localePath(locale, href);

  const services = SERVICE_MENU.map((item) => ({
    key: item.key,
    title: s.items[item.key].title,
    desc: s.items[item.key].desc,
    href: item.href,
  }));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: s.metaTitle,
      url: `${BASE}${p(PATH)}`,
      itemListElement: services.map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: x.title,
        url: `${BASE}${p(x.href)}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
        { "@type": "ListItem", position: 2, name: s.metaTitle, item: `${BASE}${p(PATH)}` },
      ],
    },
  ];

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />

      <section className="max-w-3xl mb-10">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {s.badge}
        </span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{s.h1}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{s.lead}</p>
      </section>

      <section className="mb-14">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.servicesTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{s.servicesLead}</p>
        <div className="grid md:grid-cols-2 gap-5">
          {services.map((x) => (
            <div key={x.key} className="card p-6 flex flex-col">
              <h3 className="text-xl font-bold text-[#0f4c81]">{x.title}</h3>
              <p className="text-sm text-[#475569] mt-2 flex-1">{x.desc}</p>
              <Link href={p(x.href)} className="btn btn-outline mt-5 self-start">
                {x.title}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.coverageTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{s.coverageLead}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {COVERAGE_COUNTRIES.map((c) => (
            <div key={c.code} className="card p-6">
              <h3 className="text-lg font-bold text-[#0f172a]">
                {locale === "zh" ? c.nameZh : c.name}
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {COVERAGE_SERVICES.map((svc) => (
                  <li key={svc.code}>
                    <Link
                      href={p(`/services/${c.slug}-${svc.slugSuffix}`)}
                      className="text-[#0f4c81] hover:underline"
                    >
                      {locale === "zh" ? svc.nameZh : svc.nameEn}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={p(`/countries/${c.slug}`)}
                className="inline-block mt-4 text-sm text-[#475569] hover:text-[#0f4c81]"
              >
                {t.home.coverageCta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-8 bg-[#f7f9fc]">
        <h2 className="text-xl font-bold text-[#0f172a]">{s.notSureTitle}</h2>
        <p className="text-[#475569] mt-2">{s.notSureLead}</p>
        <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-primary mt-5 inline-block">
          {s.notSureCta}
        </Link>
      </section>
    </main>
  );
}
