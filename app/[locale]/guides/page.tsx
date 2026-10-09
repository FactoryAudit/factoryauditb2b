import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import {
  GUIDES,
  GUIDE_LIST_META,
  GUIDE_CATEGORY_META,
  guideCategoriesWithGuides,
  guidesByCategory,
} from "@/lib/guides";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhPair } from "@/lib/tw";
import { pickGuideDesc } from "@/lib/pickGuideDesc";

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
    title: pickZhPair(locale, GUIDE_LIST_META.titleEn, GUIDE_LIST_META.titleZh),
    description: pickZhPair(locale, GUIDE_LIST_META.descEn, GUIDE_LIST_META.descZh),
  });
}

export default async function GuidesIndex({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);
  const cats = guideCategoriesWithGuides();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: pickZhPair(locale, GUIDE_LIST_META.titleEn, GUIDE_LIST_META.titleZh),
      url: `${BASE}${p(PATH)}`,
      numberOfItems: GUIDES.length,
      itemListElement: GUIDES.map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: pickZhPair(locale, g.titleEn, g.titleZh),
        url: `${BASE}${p(`/guides/${g.slug}`)}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: t.common.ui.home,
          item: `${BASE}${p("/")}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: t.common.ui.guidesPageTitle,
          item: `${BASE}${p(PATH)}`,
        },
      ],
    },
  ];

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />
      <h1 className="text-4xl font-extrabold text-[#171717]">{t.common.ui.guidesPageTitle}</h1>
      <p className="text-[#6d6b66] mt-3 text-lg max-w-3xl">
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
              className="px-3 py-1 rounded-full text-sm bg-[#f5f3ee] text-[#171717] hover:bg-[#ebe8e1]"
            >
              {pickZhPair(locale, cm.nameEn, cm.nameZh)}
              <span className="ml-1 text-[#8c8982]">{guidesByCategory(c).length}</span>
            </Link>
          );
        })}
      </div>

      {/* 按分类分组：分类为 H2、卡片标题为 H3。
          此前 47 张卡片全是平铺 <h2>（实测 47×H2 / 0×H3），层级过平，
          既不利于搜索引擎理解内容结构，也让「内容簇 → 单篇」的从属关系丢失。 */}
      {cats.map((c) => {
        const cm = GUIDE_CATEGORY_META[c];
        return (
          <section key={c} className="mt-10">
            <h2 className="text-2xl font-bold text-[#171717]">
              {pickZhPair(locale, cm.nameEn, cm.nameZh)}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
              {guidesByCategory(c).map((g) => (
                <Link key={g.slug} href={p(`/guides/${g.slug}`)} className="card p-6 hover:border-[#171717]">
                  <h3 className="text-xl font-bold text-[#171717]">{pickZhPair(locale, g.titleEn, g.titleZh)}</h3>
                  <p className="text-sm text-[#3f4650] mt-2">
                    {pickGuideDesc(locale, g)}
                  </p>
                  <div className="text-xs text-[#8c8982] mt-3">{g.updated}</div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
