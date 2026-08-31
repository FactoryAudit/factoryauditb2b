import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { GUIDE_CATEGORY_ORDER, guidesByCategory } from "@/lib/guides";
import { TOOL_ORDER } from "@/lib/nav";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

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
  const zh = locale === "zh";

  const categories = GUIDE_CATEGORY_ORDER.map((key) => ({
    key,
    title: r.cat[key].title,
    desc: r.cat[key].desc,
    guides: guidesByCategory(key).map((g) => ({
      href: `/guides/${g.slug}`,
      title: zh ? g.titleZh : g.titleEn,
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
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {r.badge}
        </span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{r.h1}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{r.lead}</p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{r.categoriesTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{r.categoriesLead}</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((c) => (
            <div key={c.key} className="card p-6">
              <h3 className="font-bold text-[#0f4c81]">{c.title}</h3>
              <p className="text-sm text-[#475569] mt-1">{c.desc}</p>
              <ul className="mt-4 space-y-2">
                {c.guides.map((g) => (
                  <li key={g.href}>
                    <Link href={p(g.href)} className="text-sm text-[#0f172a] hover:text-[#0f4c81]">
                      {g.title}
                    </Link>
                    <span className="block text-xs text-[#94a3b8]">{g.updated}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{r.toolsTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{r.toolsLead}</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tools.map((tool) => (
            <Link key={tool.href} href={p(tool.href)} className="card p-5 hover:border-[#0f4c81]">
              <div className="font-semibold text-[#0f4c81]">{tool.title}</div>
              <p className="text-sm text-[#475569] mt-1">{tool.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-5">
        <Link href={p("/methodology")} className="card p-6 hover:border-[#0f4c81]">
          <div className="font-semibold text-[#0f4c81]">{t.methodology.h1}</div>
          <p className="text-sm text-[#475569] mt-1">{t.methodology.lead}</p>
        </Link>
        <Link href={p("/services")} className="card p-6 hover:border-[#0f4c81]">
          <div className="font-semibold text-[#0f4c81]">{t.servicesIndex.metaTitle}</div>
          <p className="text-sm text-[#475569] mt-1">{t.servicesIndex.lead}</p>
        </Link>
      </section>
    </main>
  );
}
