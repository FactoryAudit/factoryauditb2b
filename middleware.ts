import { NextRequest, NextResponse } from "next/server";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/config";

// 多语言路由中间件
// - /zh/tools、/es/tools 等带前缀：直接命中 app/[locale]/
// - /tools（无前缀）：内部 rewrite 到 /en/tools，浏览器地址栏保持 /tools
// - /en/tools（显式英文前缀）：301 到 /tools，避免同一内容两个地址
// - /api、/_next、带扩展名的文件（llms.txt、robots.txt、sitemap.xml、favicon 等）不处理
//
// 同时向请求注入 x-pathname，供 app/[locale]/layout.tsx 的 generateMetadata
// 生成正确的 canonical / hreflang / 差异化 title（修复 SEO-AUDIT P0-1：
// 此前 16 个页面 canonical 全部指向首页）。

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1] ?? "";

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  if (isLocale(first) && first !== DEFAULT_LOCALE) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (first === DEFAULT_LOCALE) {
    const rest = pathname.slice(DEFAULT_LOCALE.length + 1);
    return NextResponse.redirect(new URL(rest === "" ? "/" : rest, req.url), 301);
  }

  // ⚠️ 必须显式拼上 search —— `new URL(target, req.url)` 只继承 origin，
  //    base 上的 query string **不会**被带过去。
  //   后果：浏览器地址栏明明是 /register?next=/suppliers/xxx，
  //   服务端渲染拿到的 searchParams 却是空的（已实测确认）。
  //   这正是已知 Bug A 的根因（英文主站筛选 100% 失效）。
  //
  // CS-05b：注册回流 ?next= 依赖 query，故这里先解开 Bug A 的 **query 保留**这一最小子集；
  //         Bug A 的剩余部分（下方 /en/* → /* 的 301 同样丢 query）仍归 CS-06 处理，
  //         本 Change Set 不扩大改动面。
  const target =
    (pathname === "/" ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`) +
    req.nextUrl.search;
  return NextResponse.rewrite(new URL(target, req.url), {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
