// app/sitemaps/[lang]/sitemap.xml/route.ts
//
// 单个语言分片：`/sitemaps/en/sitemap.xml`、`/sitemaps/zh/sitemap.xml` … 共 9 个，
// 由 /sitemap.xml 的 sitemapindex 串起。
//
// ── 为什么 URL 里要带 `sitemap.xml` 这一层（2026-11-08 实测）───────────────
// 第一版把分片放在 `/sitemaps/[locale]`（无点号路径），部署后线上**全部 404**，
// 而同一批构建里的 `/sitemap.xml` 正常。原因是 middleware 的 matcher：
//     /((?!api|_next|.*\..*).*)
// 它排除「含点号的路径」⇒ `/sitemap.xml` 直接命中路由；
// 而 `/sitemaps/en` 不含点号 ⇒ 进入 middleware 的语言前缀处理，被改写成
// `/en/sitemaps/en` 之类，实际路由匹配不到。
// 所以分片路径必须**自带点号**。顺带的好处是每个分片都以 `.xml` 结尾，
// 与 Search Console 里填写 sitemap 地址的习惯一致。
//
// ── 为什么段名用 [lang] 而不是 [locale]（同上）─────────────────────────
// OpenNext 打出来的路由正则里，`[locale]` 会被 Next 当作 i18n locale 段
// 单独处理（`(?<nxtPlocale>[^/]+?)`），与本站 `app/[locale]/` 的前缀约定相互干扰。
// 换成一个普通动态段名即可避开这层特殊含义。
//
// 🔴 dynamicParams = false：只生成 SITEMAP_LOCALES 里列出的 9 个。
//    否则任意 `/sitemaps/xxx/sitemap.xml` 都会进入渲染，白白消耗 Workers 调用。

import { NextResponse } from "next/server";
import { LOCALES, type Locale } from "@/i18n/config";
import { SITEMAP_LOCALES, entryForLocale, getSitemapPaths } from "@/lib/sitemapSource";
import { SITEMAP_HEADERS, toUrlset } from "@/lib/sitemapXml";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SITEMAP_LOCALES.map((lang) => ({ lang }));
}

function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string }> }
) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    // dynamicParams=false 已把未列出的 lang 挡在渲染之外，这里是第二道保险：
    // 返回 404 而不是「空 urlset」——空 sitemap 会让 Search Console 报「已抓取但无内容」。
    return new NextResponse("Not found", { status: 404 });
  }

  // 取数失败直接抛出（500），不降级为空列表。
  // 「静默产出更少的条目」正是本次事故的同型问题：少提交 2,268 条而无人察觉。
  const paths = await getSitemapPaths();
  const entries = paths.map((p) => entryForLocale(p.path, lang, p.lastModified));

  return new NextResponse(toUrlset(entries), { headers: SITEMAP_HEADERS });
}
