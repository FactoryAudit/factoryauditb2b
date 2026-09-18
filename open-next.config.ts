import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// OpenNext Cloudflare 配置入口。
//
// ── 为什么不能留空配置（2026-09-18 实测钉死）──────────────────────────────
// 空配置时 `incrementalCache` 解析为 `"dummy"`，于是：
//   · `createStaticAssets()` 只把 `_next/static` + `public/*` + `favicon.ico`
//     放进 `.open-next/assets/`（本仓库约 150 文件 / 1.32 MB）；
//   · 页面 HTML 走 `createCacheAssets()` 落到 `.open-next/cache/`；
//   · `populateCache()` 在 dummy 分支被跳过，日志只打一行
//     「Incremental cache does not need populating」。
// ⇒ **CS-19 的全部预渲染成果（1,505 个 `.cache` / 151.5 MB）在部署时被整体丢弃**，
//    线上仍是每个请求现场 SSR。而免费版 Workers 的 CPU 上限只有 10 ms/请求，
//    官方给 SSR 的量级是 10–20 ms ⇒ Cloudflare Error 1102 必然复发。
//
// ── 现在的选择：Workers 静态资源增量缓存（官方 $0 方案）─────────────────────
// `staticAssetsIncrementalCache` 把 `.open-next/cache/` 复制进
// `assets/cdn-cgi/_next_cache/`，再由 Worker 用 `ASSETS` 绑定直接读取。
// 预渲染产物因此**绕过 Worker**、走静态资源路径返回（免费版：请求不计费、不限量）。
//
// ⚠️ 这是一份**只读**缓存（`set()` 是 no-op，`delete()` 是 no-op）：
//   · 数据在**构建时冻结**。改库内容后必须**重新构建 + 重新部署**才会生效，
//     不能指望 ISR/按需revalidate 在运行时刷新。
//   · 因此凡改动数据库内容后上线，**必须先清 `.next/cache`**
//     （Next 的 Data Cache 跨构建复用，否则会固化上一次构建的库内容，且零报错）。
//   · 代价可接受：本站内容改动频率低，且 5 国 × 行业页全部是构建期可确定的。
//   · 官方原话：*"If your site is static, you do not need a Queue nor a Tag Cache.
//     You can use a read-only Workers Static Assets-based incremental cache for the
//     prerendered routes."*
//
// `enableCacheInterception` 让 Worker 在路由前先查这份缓存（命中即直接返回，
// 不再进 React 渲染）。⚠️ 使用 PPR 时必须关掉 —— 本仓库未启用 PPR（见 next.config.mjs）。
//
// ── 何时该换成 R2 + Queue ────────────────────────────────────────────────
// 需要运行时 ISR / 按需 revalidate / Tag Cache 时，改用 `r2IncrementalCache`
// （需先创建 R2 bucket 与 Queue）。
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
