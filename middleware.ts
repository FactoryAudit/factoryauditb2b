import { NextRequest, NextResponse } from "next/server";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { LEGACY_CLUSTER_REDIRECTS } from "@/lib/clusterRoutes";

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

  // ── SEO 规范化：HTTPS / www / 尾斜杠（在 locale 逻辑之前，单一 308）──
  // Cloudflare 边缘通常已做 HTTPS 跳转，这里兜底；本地 dev 跳过以免死循环。
  const host = req.headers.get("host") || "";
  const proto = (req.headers.get("x-forwarded-proto") || "https").replace(/:$/, "");
  if (process.env.NODE_ENV !== "development" && proto !== "https") {
    const u = req.nextUrl.clone();
    u.protocol = "https:";
    return NextResponse.redirect(u, 308);
  }
  // www → 非 www（规范域名统一为 factoryauditb2b.com）
  if (host.startsWith("www.")) {
    const u = req.nextUrl.clone();
    u.host = host.replace(/^www\./, "");
    return NextResponse.redirect(u, 308);
  }
  // 去尾斜杠（根路径 / 除外），保证 clean URL 一致
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const u = req.nextUrl.clone();
    u.pathname = pathname.replace(/\/+$/, "");
    return NextResponse.redirect(u, 308);
  }

  // ── STEP 09 ROUTE-04：旧扁平产业带 URL → 新层级 canonical URL（永久 301）──
  // 例：/industrial-clusters/dongguan-electronics
  //     → /industrial-clusters/china/guangdong/dongguan-electronics
  // 兼容 /<locale>/industrial-clusters/<slug>（locale 前缀原样保留）。
  // 仅覆盖 P0（8 条）；新集群上线后由 Admin 写入 LEGACY_CLUSTER_REDIRECTS 或改 DB 驱动。
  // 必须在 locale 改写之前拦截，确保 301 由边缘直接返回（非页面内 308）。
  const icM = pathname.match(
    /^\/((?:en|zh-TW|zh|es|de|fr|pt|ja|ar)\/)?industrial-clusters\/([^/]+)$/
  );
  if (icM) {
    const localePart = icM[1] ? `/${icM[1].replace(/\/$/, "")}` : "";
    const slug = icM[2];
    const canonical = LEGACY_CLUSTER_REDIRECTS[slug];
    if (canonical && canonical !== `/industrial-clusters/${slug}`) {
      return NextResponse.redirect(
        new URL(`${localePart}${canonical}${req.nextUrl.search}`, req.url),
        301
      );
    }
  }

  if (isLocale(first) && first !== DEFAULT_LOCALE) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (first === DEFAULT_LOCALE) {
    const rest = pathname.slice(DEFAULT_LOCALE.length + 1);
    // ⚠️ 与下方 rewrite 分支同一个坑：`new URL(target, req.url)` 只继承 origin，
    //    base 上的 query string **不会**被带过去。不补 search 的话
    //    /en/suppliers?country=china → 301 /suppliers（筛选态被静默丢弃）。
    //    CS-05b 只解开了 rewrite 分支的 query 保留；这里补上 301 分支的剩余部分。
    return NextResponse.redirect(
      new URL((rest === "" ? "/" : rest) + req.nextUrl.search, req.url),
      301
    );
  }

  // ⚠️ 必须显式拼上 search —— `new URL(target, req.url)` 只继承 origin，
  //    base 上的 query string **不会**被带过去。
  //   后果：浏览器地址栏明明是 /register?next=/suppliers/xxx，
  //   服务端渲染拿到的 searchParams 却是空的（已实测确认）。
  //   这正是已知 Bug A 的根因（英文主站筛选 100% 失效）。
  //
  // CS-05b：注册回流 ?next= 依赖 query，故这里先解开 Bug A 的 **query 保留**这一最小子集。
  // CS-06a：剩余的 301 分支（上方 /en/* → /*）已补齐 search，Bug A 至此收口。
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
