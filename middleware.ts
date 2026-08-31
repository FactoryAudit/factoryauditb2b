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

  const target =
    pathname === "/" ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
  return NextResponse.rewrite(new URL(target, req.url), {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
