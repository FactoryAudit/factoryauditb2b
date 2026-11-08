// app/sitemaps/[locale]/route.ts
//
// 单个语言分片。`/sitemaps/en`、`/sitemaps/zh` … 共 9 个，由 /sitemap.xml 索引串起。
//
// 为什么按语言切而不是按页面类型切：
//   ① hreflang 天然是「一语言一视图」—— 同一片内所有 URL 共享同一套 alternate 语义；
//   ② 每片条目数自动均衡（每个语言都是同一批路径），不会出现某个类型暴涨后再次超时；
//   ③ 排查简单：某片 404 就代表那一语言整体出问题，不会牵扯其他语言。
//
// 🔴 dynamicParams = false：只生成 SITEMAP_LOCALES 里列出的 9 个。
//   否则任意 `/sitemaps/xxx` 都会进入渲染，白白消耗一次 Workers 调用。

import { NextResponse } from "next/server";
import { LOCALES, type Locale } from "@/i18n/config";
import { SITEMAP_LOCALES, entryForLocale, getSitemapPaths } from "@/lib/sitemapSource";
import { SITEMAP_HEADERS, toUrlset } from "@/lib/sitemapXml";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SITEMAP_LOCALES.map((locale) => ({ locale }));
}

function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    // dynamicParams=false 已经把未列出的 locale 挡在渲染之外，这里是第二道保险：
    // 返回 404 而不是「空 urlset」——空 sitemap 会让 Search Console 报「已抓取但无内容」。
    return new NextResponse("Not found", { status: 404 });
  }

  // 取数失败直接抛出（500），不降级为空列表。
  // 「静默产出更少的条目」正是本次事故的同型问题：少提交 2,268 条而无人察觉。
  const paths = await getSitemapPaths();
  const entries = paths.map((p) => entryForLocale(p.path, locale, p.lastModified));

  return new NextResponse(toUrlset(entries), { headers: SITEMAP_HEADERS });
}
