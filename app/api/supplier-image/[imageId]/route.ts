import { NextRequest, NextResponse } from "next/server";
import { createSignedUrl } from "@/lib/storage";
import { resolvePublicImageForVisibleSupplier } from "@/lib/supplierImages";

// CS-A / P0-D：公开工厂图读取代理。
//
// 为什么必须代理而不是直接给 <img src="supabase.../object/public/...">：
//   bucket `supplier-docs` 是**私有**的。若把对象路径直出到 HTML，等于把私有存储布局
//   公开出去；而 original（原件，含 EXIF 与可能的敏感信息）绝不能对外可读。
//
// 因此这里只做一件事：按 imageId + variant 解析出 display / thumbnail 的路径，
// 校验通过后把图片字节转发给浏览器。
//   · variant 只有两个取值，没有 "original" 分支 —— 原件在结构上就没有出口；
//   · 档案被撤下公开（is_published / public_profile_enabled / profile_status）
//     时解析立即返回 null ⇒ 缓存过期后链接触即失效（见下方 TTL 说明）。
//
// ── 2026-10-28 从「302 跳转」改为「字节转发」的原因 ───────────────────────────
// 修复前：302 到一个 5 分钟有效的签名 URL。
//   实测（10-28 18:20）单张图片 3–40 秒，10 次里 2 次直接 40 秒超时；供应商
//   档案页有 14 张图 ⇒ 图片区永远转圈。两个原因叠加：
//     ① 每次请求都要跑 Worker → 查 supplier_images（跨境）→ 签 URL（再跨境一次）；
//     ② 302 响应不带 Cache-Control，且 **CF 默认不缓存 302** ⇒ 连边缘缓存都没有，
//        同一个访客刷新一次就重跑一遍。
// 曾尝试给 302 补 `Cache-Control: s-maxage` 并部署验证：头生效了，但
// `cf-cache-status` 依然缺省（多次请求的签名 iat 每次都在变）⇒ 证实 CF 不缓存 302。
// 本账号的 API Token 也没有 `Zone.Cache Rules:Edit` 权限，改不了缓存规则。
// 于是改为**直接转发字节**：响应变成 200，CF 按 `s-maxage` 的边缘缓存规则处理，
// 实测可被缓存；浏览器与 CF 之间只走本站域名，不再让访客各自跨境跟一次 Supabase。
//
// 代价与取舍：
//   · 图片流量走 Worker 子请求。使用流式转发（不 buffer 整个 body），内存占用与
//     图片大小无关，不触碰 128 MB isolate 上限（历史 1102 都是 SSR 内存问题）。
//   · 撤下即时性由「当场失效」放宽为「最多 1 小时后失效」：缓存窗口内的撤档
//     请求仍可能命中旧图。1 小时被视为可接受，因为这里的图都是供应商主动提交、
//     用于公开展示的工厂照片；若未来出现「必须秒级下线」的合规要求，
//     应改为按 imageId 主动清理 CF 缓存（需要 Cache Rules/Purge 权限）。
const SIGNED_TTL_SECONDS = 300;
const BROWSER_TTL_SECONDS = 3600;
const EDGE_TTL_SECONDS = 3600;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VARIANTS = new Set(["display", "thumbnail"]);

type Ctx = { params: Promise<{ imageId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { imageId } = await params;
  if (!UUID_RE.test(imageId)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const raw = req.nextUrl.searchParams.get("v") ?? "display";
  const variant = VARIANTS.has(raw) ? (raw as "display" | "thumbnail") : "display";

  const path = await resolvePublicImageForVisibleSupplier(imageId, variant);
  // 不存在 / 未批准 / 未公开 / 档案已撤下 ⇒ 一律 404（不区分原因，防枚举）
  if (!path) {
    // 刻意不设 Cache-Control：404 必须每次都回源判定，否则撤档后的 404
    // 会被边缘缓存，重新上架时反而看不到图。
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }

  const signed = await createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (!signed) {
    return NextResponse.json({ ok: false, error: "sign_failed" }, { status: 500 });
  }

  // 上游取图失败一律 502（不带 Cache-Control ⇒ 不缓存），让浏览器下次重试，
  // 避免把一次瞬时抖动固化成边缘上的坏缓存。
  let upstream: Response;
  try {
    upstream = await fetch(signed);
  } catch (e) {
    console.error("[supplier-image] upstream fetch failed", e);
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { ok: false, error: "upstream_failed", status: upstream.status },
      { status: 502 }
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
