import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import {
  GUIDES,
  GUIDE_CATEGORY_META,
  guideCategoriesWithGuides,
  guidesByCategory,
} from "@/lib/guides";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhPair } from "@/lib/tw";

const PATH = "/guides";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: "Supplier Intelligence Guides",
    description:
      "Practical guides on verifying suppliers, running factory audits and assessing supplier risk in China and Southeast Asia.",
  });
}

export default async function GuidesIndex({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);
  const cats = guideCategoriesWithGuides();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Supplier Intelligence Guides",
    url: `${BASE}${p(PATH)}`,
    numberOfItems: GUIDES.length,
    itemListElement: GUIDES.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: pickZhPair(locale, g.titleEn, g.titleZh),
      url: `${BASE}${p(`/guides/${g.slug}`)}`,
    })),
  };

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />
      <h1 className="text-4xl font-extrabold text-[#0f172a]">{t.common.ui.guidesPageTitle}</h1>
      <p className="text-[#64748b] mt-3 text-lg max-w-3xl">
        {t.resourcesIndex.lead}
      </p>

      {/* 内容簇入口：每个分类一个 hub 着陆页，互为内链强化主题权重 */}
      <div className="flex flex-wrap gap-2 mt-6">
        {cats.map((c) => {
          const cm = GUIDE_CATEGORY_META[c];
          return (
            <Link
              key={c}
              href={p(`/guides/category/${c}`)}
              className="px-3 py-1 rounded-full text-sm bg-[#f1f5f9] text-[#0f4c81] hover:bg-[#e2e8f0]"
            >
              {pickZhPair(locale, cm.nameEn, cm.nameZh)}
              <span className="ml-1 text-[#94a3b8]">{guidesByCategory(c).length}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-10">
        {GUIDES.map((g) => (
          <Link key={g.slug} href={p(`/guides/${g.slug}`)} className="card p-6 hover:border-[#0f4c81]">
            <h2 className="text-xl font-bold text-[#0f4c81]">{pickZhPair(locale, g.titleEn, g.titleZh)}</h2>
            <p className="text-sm text-[#475569] mt-2">
              {pickZhPair(locale, g.metaDescEn, g.metaDescZh)}
            </p>
            <div className="text-xs text-[#94a3b8] mt-3">{g.updated}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
