// app/sitemap.xml/route.ts
//
// `/sitemap.xml` = **索引**，不再是 2.9 MB 的巨型 urlset。
//
// 事故背景见 lib/sitemapSource.ts 顶部：单一 2,915,029 字节的 sitemap 在边缘
// 被 30.00 秒稳定切断，Google 解析失败，2,268 条 URL 全部未收录。
// 现在这里只输出 9 条 `<sitemap><loc>`，体积约 1 KB —— 秒回，不存在超时可能。
//
// ⚠️ 不要再把页面 URL 塞回这个文件。一旦超过约百 KB，同样的截断会重演，
//    而且这次是索引文件坏掉，全线分片一起失效。
//
// 分隔约定：每个语言一个分片（/sitemaps/<locale>），与 hreflang 的 9 语言一一对应。
// 这样单片只做一台语言的展开，生成量与响应体都降到 1/9。

import { NextResponse } from "next/server";
import { SITEMAP_BASE, SITEMAP_LOCALES } from "@/lib/sitemapSource";
import { SITEMAP_HEADERS, toSitemapIndex } from "@/lib/sitemapXml";

// 纯静态：不含任何请求相关输入，构建期预渲染成固定文件。
// 🔴 刻意不用 revalidate —— 本项目的 staticAssetsIncrementalCache 是只读的，
//    revalidate 本来就不生效（见 RELEASE-RULES.md R58），写了只会误导下一个人。
export const dynamic = "force-static";

export function GET() {
  const locs = SITEMAP_LOCALES.map((l) => `${SITEMAP_BASE}/sitemaps/${l}`);
  return new NextResponse(toSitemapIndex(locs), { headers: SITEMAP_HEADERS });
}
