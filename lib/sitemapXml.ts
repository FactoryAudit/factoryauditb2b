// lib/sitemapXml.ts
//
// sitemap 的 XML 序列化 —— 手写，不用 Next 的 MetadataRoute 自动输出。
//
// 为什么手写：MetadataRoute 只能产出单个 `<urlset>`，产不出 `<sitemapindex>`。
// 而本次修复的**全部意义**就在于把 2.9 MB 的单文件拆成 index + 小分片
// （见 lib/sitemapSource.ts 顶部的事故记录）。
//
// 两条硬约束：
//   1. 必须输出**紧凑** XML（不缩进、不换行）。缩进会让体积再涨约 8%，
//      而体积正是这次事故的起因。
//   2. 必须转义 `& < > " '`。站点 URL 目前不含查询参数，但 hreflang 的 href
//      来自 localePath，任何一天加了带参数的路径就会产出非法 XML，
//      而 Google 对 XML 语法错误是**整份丢弃**，不是跳过单条。

import type { SitemapUrlEntry } from "@/lib/sitemapSource";

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>';

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 单个语言分片：`<urlset>` */
export function toUrlset(entries: SitemapUrlEntry[]): string {
  const out: string[] = [
    XML_DECL,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const e of entries) {
    out.push("<url><loc>", esc(e.url), "</loc>");
    if (e.lastModified) out.push("<lastmod>", e.lastModified.toISOString(), "</lastmod>");
    out.push("<changefreq>", e.changeFrequency, "</changefreq>");
    // priority 必须带一位小数：sitemaps.org 规定 0.0–1.0，"1" 虽可解析但不规范。
    out.push("<priority>", e.priority.toFixed(1), "</priority>");
    for (const [lang, href] of Object.entries(e.languages)) {
      out.push(
        '<xhtml:link rel="alternate" hreflang="',
        esc(lang),
        '" href="',
        esc(href),
        '"/>'
      );
    }
    out.push("</url>");
  }
  out.push("</urlset>");
  return out.join("");
}

/** 索引文件：`<sitemapindex>`。只有几条 loc，体积可忽略。 */
export function toSitemapIndex(locs: string[], lastModified?: Date): string {
  const out: string[] = [XML_DECL, '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  const lm = lastModified ? `<lastmod>${lastModified.toISOString()}</lastmod>` : "";
  for (const loc of locs) {
    out.push("<sitemap><loc>", esc(loc), "</loc>", lm, "</sitemap>");
  }
  out.push("</sitemapindex>");
  return out.join("");
}

/** sitemap 响应的统一头。charset 必带，否则部分抓取端按 latin-1 解析。 */
export const SITEMAP_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
} as const;
