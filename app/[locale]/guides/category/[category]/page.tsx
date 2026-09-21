import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import {
  GUIDE_CATEGORY_META,
  guideCategoriesWithGuides,
  guidesByCategory,
  type GuideCategory,
} from "@/lib/guides";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhPair } from "@/lib/tw";

const BASE = "https://factoryauditb2b.com";
type Params = { locale: string; category: string };

// 仅对「实际有指南」的分类做静态生成；其余（含 china）不生成，运行时走 notFound。
export async function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    guideCategoriesWithGuides().map((c) => ({ locale, category: c }))
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, category } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const cat = category as GuideCategory;
  const meta = GUIDE_CATEGORY_META[cat];
  const guides = guidesByCategory(cat);
  if (!meta || guides.length === 0) {
    return buildPageMetadata({
      locale,
      path: `/guides/category/${category}`,
      title: "Guides",
      description: "Guides.",
      robots: { index: false },
    });
  }
  return buildPageMetadata({
    locale,
    path: `/guides/category/${category}`,
    title: pickZhPair(locale, meta.titleEn, meta.titleZh),
    description: pickZhPair(locale, meta.descEn, meta.descZh),
  });
}

export default async function GuideCategoryHub({ params }: { params: Promise<Params> }) {
  const { locale: raw, category } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const cat = category as GuideCategory;
  const meta = GUIDE_CATEGORY_META[cat];
  const guides = guidesByCategory(cat);
  // 无效分类或该分类无指南 → 404 + noindex（与 sitemap 收录集合同源）
  if (!meta || guides.length === 0) notFound();

  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);
  const title = pickZhPair(locale, meta.nameEn, meta.nameZh);
  const cats = guideCategoriesWithGuides();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: title,
      url: `${BASE}${p(`/guides/category/${category}`)}`,
      numberOfItems: guides.length,
      itemListElement: guides.map((g, i) => ({
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
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
        { "@type": "ListItem", position: 2, name: t.resourcesIndex.h1, item: `${BASE}${p("/resources")}` },
        {
          "@type": "ListItem",
          position: 3,
          name: t.common.ui.guidesPageTitle,
          item: `${BASE}${p("/guides")}`,
        },
        {
          "@type": "ListItem",
          position: 4,
          name: title,
          item: `${BASE}${p(`/guides/category/${category}`)}`,
        },
      ],
    },
  ];

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-[#64748b]">
        <Link href={p("/")} className="hover:underline">
          {t.common.ui.home}
        </Link>
        {" / "}
        <Link href={p("/resources")} className="hover:underline">
          {t.resourcesIndex.h1}
        </Link>
        {" / "}
        <Link href={p("/guides")} className="hover:underline">
          {t.common.ui.guidesPageTitle}
        </Link>
        {" / "}
        {title}
      </nav>

      <h1 className="text-4xl font-extrabold text-[#0f172a]">{title}</h1>
      <p className="text-[#64748b] mt-3 text-lg max-w-3xl">
        {pickZhPair(locale, meta.descEn, meta.descZh)}
      </p>

      {/* 分类簇导航：强化主题内链，每个 hub 互为入口 */}
      <div className="flex flex-wrap gap-2 mt-6">
        {cats.map((c) => {
          const cm = GUIDE_CATEGORY_META[c];
          const active = c === cat;
          const label = pickZhPair(locale, cm.nameEn, cm.nameZh);
          return (
            <Link
              key={c}
              href={p(`/guides/category/${c}`)}
              className={
                active
                  ? "px-3 py-1 rounded-full text-sm bg-[#0f4c81] text-white"
                  : "px-3 py-1 rounded-full text-sm bg-[#f1f5f9] text-[#0f4c81] hover:bg-[#e2e8f0]"
              }
            >
              {label}
              <span className="ml-1 text-[#94a3b8]">{guidesByCategory(c).length}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-10">
        {guides.map((g) => (
          <Link
            key={g.slug}
            href={p(`/guides/${g.slug}`)}
            className="card p-6 hover:border-[#0f4c81]"
          >
            <h2 className="text-xl font-bold text-[#0f4c81]">
              {pickZhPair(locale, g.titleEn, g.titleZh)}
            </h2>
            <p className="text-sm text-[#475569] mt-2">
              {pickZhPair(locale, g.metaDescEn, g.metaDescZh)}
            </p>
            <div className="text-xs text-[#94a3b8] mt-3">{g.updated}</div>
          </Link>
        ))}
      </div>

      <section className="mt-10 card p-8 bg-[#0f4c81]">
        <h2 className="text-2xl font-bold text-white">{t.home.bottomTitle}</h2>
        <p className="mt-2 text-white/80">{t.home.bottomLead}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={p("/services/supplier-verification")} className="btn btn-accent">
            {t.home.bottomCta}
          </Link>
          <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-outline-dark">
            {t.methodology.ctaSecondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
