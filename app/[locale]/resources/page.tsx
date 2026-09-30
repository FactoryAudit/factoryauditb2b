import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { GUIDE_CATEGORY_ORDER, guidesByCategory } from "@/lib/guides";
import { TOOL_ORDER } from "@/lib/nav";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhPair } from "@/lib/tw";

const PATH = "/resources";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.resourcesIndex.metaTitle,
    description: t.resourcesIndex.metaDesc,
  });
}

export default async function ResourcesPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const r = t.resourcesIndex;
  const p = (href: string) => localePath(locale, href);

  const categories = GUIDE_CATEGORY_ORDER.map((key) => ({
    key,
    title: r.cat[key].title,
    desc: r.cat[key].desc,
    guides: guidesByCategory(key).map((g) => ({
      href: `/guides/${g.slug}`,
      title: pickZhPair(locale, g.titleEn, g.titleZh),
      updated: g.updated,
    })),
  })).filter((c) => c.guides.length > 0);

  const tools = TOOL_ORDER.map((x) => ({ ...t.toolCards[x.cardKey], href: x.href }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: r.h1,
    url: `${BASE}${p(PATH)}`,
    itemListElement: categories
      .flatMap((c) => c.guides)
      .map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: g.title,
        url: `${BASE}${p(g.href)}`,
      })),
  };

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />

      <section className="max-w-3xl mb-10">
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">
          {r.badge}
        </span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2">{r.h1}</h1>
        <p className="text-[#6d6b66] mt-3 text-lg">{r.lead}</p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#171717]">{r.categoriesTitle}</h2>
        <p className="text-[#6d6b66] mt-1 mb-5">{r.categoriesLead}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((c) => (
            <div key={c.key} className="card p-6">
              <h3 className="font-bold text-[#171717]">{c.title}</h3>
              <p className="text-sm text-[#3f4650] mt-1">{c.desc}</p>
              <ul className="mt-4 space-y-2">
                {c.guides.map((g) => (
                  <li key={g.href}>
                    <Link href={p(g.href)} className="text-sm text-[#171717] hover:text-[#171717]">
                      {g.title}
                    </Link>
                    <span className="block text-xs text-[#8c8982]">{g.updated}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#171717]">{r.toolsTitle}</h2>
        <p className="text-[#6d6b66] mt-1 mb-5">{r.toolsLead}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tools.map((tool) => (
            <Link key={tool.href} href={p(tool.href)} className="card p-5 hover:border-[#171717]">
              <div className="font-semibold text-[#171717]">{tool.title}</div>
              <p className="text-sm text-[#3f4650] mt-1">{tool.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#171717]">{r.storiesTitle}</h2>
        <p className="text-[#6d6b66] mt-1 mb-5">{r.storiesLead}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link href={p("/case-studies")} className="card p-6 hover:border-[#171717]">
            <div className="font-semibold text-[#171717]">{t.caseStudies.h1}</div>
            <p className="text-sm text-[#3f4650] mt-1">{t.caseStudies.lead}</p>
          </Link>
          <Link href={p("/field-reports")} className="card p-6 hover:border-[#171717]">
            <div className="font-semibold text-[#171717]">{t.fieldReports.h1}</div>
            <p className="text-sm text-[#3f4650] mt-1">{t.fieldReports.lead}</p>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link href={p("/methodology")} className="card p-6 hover:border-[#171717]">
          <div className="font-semibold text-[#171717]">{t.methodology.h1}</div>
          <p className="text-sm text-[#3f4650] mt-1">{t.methodology.lead}</p>
        </Link>
        <Link href={p("/services")} className="card p-6 hover:border-[#171717]">
          <div className="font-semibold text-[#171717]">{t.servicesIndex.metaTitle}</div>
          <p className="text-sm text-[#3f4650] mt-1">{t.servicesIndex.lead}</p>
        </Link>
      </section>
    </main>
  );
}
