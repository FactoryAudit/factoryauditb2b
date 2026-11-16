// app/[locale]/standards/[slug]/page.tsx
//
// 合规标准类 GEO 问答页（category = 'standard'）。正文来自表 geo_knowledge_pages，
// 渲染壳与 /guides、/industry 共用 components/geo/GeoKnowledgeArticle.tsx。
//
// ── 为什么本路由没有 /standards 索引页 ────────────────────────────────────
// 三类 GEO 页的面包屑父级统一指向 /resources（已存在且是资源入口），
// 因此不需要为「只有一篇 standard」造一个目录页 —— 造了反而是空壳页
// （站内 R25 的教训：目录页要承担内链职责，而不是占位）。
// 页面之间靠 GeoKnowledgeArticle 页尾的 Related 互链，不会成为孤岛。
//
// ── 与既有 /supplier-audit/{code} 的关系 ─────────────────────────────────
// lib/taxonomy 里的 standards（SMETA / BSCI 等**审核代码**）走的是另一套路由，
// 且 lib/sitemapSource.ts 明确记录「/supplier-audit/{code} 尚未建成」。
// 本路由的 slug 是**文章级**内容（如 eu-csddd-china-supplier-due-diligence），
// 不是审核代码，两者不冲突。日后若建审核代码页，务必用 /supplier-audit，
// 不要和本路由抢 /standards 前缀。

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GeoKnowledgeArticle from "@/components/geo/GeoKnowledgeArticle";
import { isLocale, DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { getGeoPage, listGeoPages } from "@/lib/geoKnowledge";
import { buildGeoMetadata } from "@/lib/geoKnowledgeSeo";

type Params = { locale: string; slug: string };

/** 本路由承接的 GEO category（单值，但保留数组口径以便与其它路由保持同形）。 */
const GEO_CATEGORIES_HERE = ["standard"] as const;

export async function generateStaticParams() {
  const pages = await listGeoPages();
  const slugs = pages
    .filter((p) => (GEO_CATEGORIES_HERE as readonly string[]).includes(p.category))
    .map((p) => p.slug);
  // 正文目前只有 en，其余语种由 lib/geoKnowledge 回退渲染 ⇒ 9 个语种都要出参数。
  return LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const geo = await getGeoPage(slug, locale, GEO_CATEGORIES_HERE);
  if (!geo) {
    return {
      title: "Standard",
      robots: { index: false, follow: false },
    };
  }
  return buildGeoMetadata(geo, locale);
}

export default async function StandardPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const geo = await getGeoPage(slug, locale, GEO_CATEGORIES_HERE);
  if (!geo) notFound();

  const t = await getDictionary(locale);
  return <GeoKnowledgeArticle page={geo} locale={locale} t={t} />;
}
