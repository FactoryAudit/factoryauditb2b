import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { CHEMICALS } from "@/lib/chemicals";
import { industryDisplayName, listIndustries } from "@/lib/taxonomy";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhPair } from "@/lib/tw";

const PATH = "/chemicals";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.chemicals.metaTitle,
    description: t.chemicals.metaDesc,
  });
}

export default async function ChemicalsIndexPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const c = t.chemicals;
  const lp = (href: string) => localePath(locale, href);

  const industries = await listIndustries();
  const industryName = (code: string) => {
    const i = industries.find((x) => x.code === code);
    return i ? industryDisplayName(locale, i.name) : code;
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.metaTitle,
    url: `${BASE}${lp(PATH)}`,
    numberOfItems: CHEMICALS.length,
    itemListElement: CHEMICALS.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: pickZhPair(locale, x.nameEn, x.nameZh),
      url: `${BASE}${lp(`/chemicals/${x.slug}`)}`,
    })),
  };

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-[#64748b]">
        <Link href={lp("/")} className="hover:underline">
          {t.common.ui.home}
        </Link>{" "}
        / {c.metaTitle}
      </nav>

      <section className="max-w-3xl mb-10">
        <h1 className="text-4xl font-extrabold text-[#0f172a]">{c.metaTitle}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{c.lead}</p>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CHEMICALS.map((x) => (
          <div key={x.slug} className="card p-6 flex flex-col">
            <h2 className="text-xl font-bold text-[#0f172a]">
              <Link href={lp(`/chemicals/${x.slug}`)} className="hover:underline">
                {pickZhPair(locale, x.nameEn, x.nameZh)}
              </Link>
            </h2>
            <div className="mt-1 text-sm text-[#64748b]">
              {c.casLabel} {x.cas}
            </div>
            <p className="mt-3 text-sm text-[#475569] flex-1">
              {pickZhPair(locale, x.application.en, x.application.zh)}
            </p>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase text-[#64748b]">
                {c.downstreamLabel}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {x.downstream.map((code) => (
                  <Link
                    key={code}
                    href={lp(`/industry/${code}`)}
                    className="rounded bg-[#eef2f7] px-2 py-0.5 text-xs text-[#0f4c81] hover:underline"
                  >
                    {industryName(code)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
