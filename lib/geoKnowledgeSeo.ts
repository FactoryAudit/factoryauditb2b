// lib/geoKnowledgeSeo.ts —— GEO 问答页的 metadata 与 JSON-LD **单一构造器**
//
// 三个路由族（/guides、/standards、/industry）共用同一个页面壳，因此
// metadata 与结构化数据也必须只有一个来源 —— 否则必然漂移
// （lib/seo/articleSchema.ts 头部注释记录过同一类事故：7 个页面各写一份 Article 节点，
//  字段集互不一致，E-E-A-T 信号一半时间不存在）。
//
// 🔴 两条约束，与 articleSchema 同口径：
//   1. hreflang 走 buildPageMetadata 的默认 9 语展开 —— 这些 URL **确实都存在**
//      （正文是 en，其余语种按 lib/geoKnowledge.ts 的 locale 回退渲染）。
//      若日后改成只发 en，必须同时收窄这里和 sitemap，否则会声明指向 404 的 hreflang。
//   2. dateModified 只透传库里的 updated_at；取不到就不输出，绝不填 new Date()。

import type { Metadata } from "next";
import { LOCALE_META, type Locale } from "@/i18n/config";
// 🔴 绝对 URL 一律走 canonicalFor：它负责「英文无前缀」「/ 与 "" 等价」两条规则。
//    自己拼 `/zh` + path 会产出带尾斜杠的 308 源地址（i18n/hreflang.ts 头部注释）。
import { canonicalFor } from "@/i18n/hreflang";
import { buildPageMetadata } from "./pageMeta";
import { buildArticleSchema } from "./seo/articleSchema";
import { geoPath, type GeoKnowledgePage } from "./geoKnowledge";

/** 这三类页面的面包屑父级都是资源库（/resources 已存在，不像 /standards 只有子页）。 */
export const GEO_HUB_PATH = "/resources";

export function buildGeoMetadata(page: GeoKnowledgePage, locale: Locale): Metadata {
  return buildPageMetadata({
    locale,
    path: geoPath(page),
    // H1 即主查询意图（"How much does a factory audit in China cost"）。
    // 过长时由 buildPageMetadata 内的 trimMetaTitle 收窄，不改动页面 H1。
    title: page.h1Question,
    // BLUF 摘要即元描述：它本来就是按"第一句给结论"写的。
    // 超预算时 trimMetaDescription 在句末/词边界裁剪，不做摘要改写。
    description: page.blufSummary,
  });
}

export type GeoJsonLdLabels = {
  /** 字典里的"首页" */
  home: string;
  /** 字典里的资源库标题（面包屑第 2 级） */
  hub: string;
};

/**
 * 一次产出 Article + BreadcrumbList + FAQPage 三个节点。
 * FAQPage **只在页面上真的渲染了 FAQ** 时注入 —— 结构化数据必须与可见内容一致。
 */
export function buildGeoJsonLd(
  page: GeoKnowledgePage,
  locale: Locale,
  labels: GeoJsonLdLabels
): object[] {
  const path = geoPath(page);
  const url = canonicalFor(locale, path);

  const nodes: object[] = [
    buildArticleSchema({
      locale: LOCALE_META[locale].htmlLang,
      url,
      headline: page.h1Question,
      description: page.blufSummary,
      // 库里的真实更新时间；缺失则 articleSchema 不输出该字段
      dateModified: page.updatedAt ?? undefined,
    }),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: labels.home,
          item: canonicalFor(locale, "/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: labels.hub,
          item: canonicalFor(locale, GEO_HUB_PATH),
        },
        { "@type": "ListItem", position: 3, name: page.h1Question, item: url },
      ],
    },
  ];

  if (page.faqs.length > 0) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  return nodes;
}
