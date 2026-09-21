/** @type {import('next').NextConfig} */

// CS-01 P0-1 —— 元数据必须进入 <head>
// ---------------------------------------------------------------------------
// Next 15 的「流式元数据」机制：title / description / canonical / hreflang / robots
// 会被渲染到 <body> 末尾，再由客户端脚本搬进 <head>。只有 UA 命中 `htmlLimitedBots`
// 正则时，Next 才改为**直接输出在 <head>**（代价是等元数据 resolve 完再发首字节）。
//
// Next 内置默认名单是：
//   [\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|
//   yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|
//   Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|
//   LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight
//
// 实测（2026-09-13，/membership · /about · /tools/compare 三页各两次，结论完全一致）：
//   Bingbot  → 命中名单 → </head>@4173、title@1105  → 元数据在 head ✅
//   Googlebot→ **不在名单**（名单里只有 `*-Google` / `Google-*` 形式）→ title@18534 → 在 body ❌
//   OAI-SearchBot / GPTBot / ClaudeBot / PerplexityBot → 全部在 body ❌
//
// ⇒ 结论：Google 会执行 JS 所以实际不受影响；但**不执行 JS 的 AI 检索/引用爬虫完全读不到
//   canonical、9 语 hreflang 与 robots 指令**。这正是 AI Citation 的硬伤。
//
// 修法：在内置名单之后**追加**，不替换。只影响「元数据放哪」，不影响能否抓取
//（抓取许可始终由 robots.txt 决定）。
const HTML_LIMITED_BOTS = new RegExp(
  [
    // ---------- Next 内置默认名单，逐条保留 ----------
    "[\\w-]+-Google",
    "Google-[\\w-]+",
    "Chrome-Lighthouse",
    "Slurp",
    "DuckDuckBot",
    "baiduspider",
    "yandex",
    "sogou",
    "bitlybot",
    "tumblr",
    "vkShare",
    "quora link preview",
    "redditbot",
    "ia_archiver",
    "Bingbot",
    "BingPreview",
    "applebot",
    "facebookexternalhit",
    "facebookcatalog",
    "Twitterbot",
    "LinkedInBot",
    "Slackbot",
    "Discordbot",
    "WhatsApp",
    "SkypeUriPreview",
    "Yeti",
    "googleweblight",
    // ---------- 追加：传统搜索 ----------
    "Googlebot",
    "Google-Extended",
    "Google-InspectionTool",
    "Google-Read-Aloud",
    "Mediapartners-Google",
    "AdsBot-Google",
    "YandexBot",
    "Mail.RU_Bot",
    "SeznamBot",
    "Qwantify",
    "Applebot-Extended",
    // ---------- 追加：AI 检索 / 引用（robots.txt 中明确放行的一类）----------
    "OAI-SearchBot",
    "ChatGPT-User",
    "GPTBot",
    "Claude-SearchBot",
    "Claude-User",
    "ClaudeBot",
    "anthropic-ai",
    "PerplexityBot",
    "Perplexity-User",
    "PerplexityBot-User",
    "YouBot",
    "Meltwater",
    "Seekr",
    "AI2Bot",
    "Diffbot",
    "omgili",
    "omgilibot",
    "ImagesiftBot",
    "Timpibot",
    // ---------- 追加：其他已知 AI / 聚合抓取器 ----------
    "Meta-ExternalAgent",
    "meta-externalagent",
    "FacebookBot",
    "Amazonbot",
    "Bytespider",
    "CCBot",
    "cohere-ai",
    "cohere-training-data-crawler",
  ].join("|")
);

const nextConfig = {
  reactStrictMode: true,
  htmlLimitedBots: HTML_LIMITED_BOTS,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" }
        ]
      }
    ];
  },
  // Cloudflare Workers 部署（OpenNext）
  // 已去除数据库（V2.0 轻量化）：不再需要外部化 Prisma / pg / postgres。
  serverExternalPackages: [],
  experimental: {
    // 防 OpenNext 二次 build 偶发 60s 静态页超时（1906 页机器负载触顶）。
    // 失败页面是既有 supplier 页，与 hub 改动无关；提到 300s 覆盖偶发慢页。
    staticPageGenerationTimeout: 300,
  },
  // V2.2 §13/§41：/membership 合并进 /pricing（Founding Buyer 选项）。
  // permanent: true ⇒ Next 发出 308（永久重定向）；Google 视作永久合并，SEO 效果等同 301。
  async redirects() {
    return [
      { source: "/membership", destination: "/pricing", permanent: true },
      { source: "/:locale/membership", destination: "/:locale/pricing", permanent: true },
      // ★ CS-19（工单 SEO-20260918-FAB 任务 1.3）—— 收口 /en 家族的重定向链。
      //
      // 实测（2026-09-18）：/en/ → 308 → /en → 301 → /（2 跳，爬虫记为 Redirect Chain）。
      // 那个 308 来自 Next 核心的**尾斜杠归一化**，它发生在 middleware **之前**，
      // 因此 middleware.ts 里已有的 `/en/*` → `/*` 301 无法把这个链条缩短。
      //
      // 修法：把同一套语义提前到 next.config 的 redirects 阶段（与尾斜杠归一化同级）。
      // 两条规则都写：`:path*` 在 path-to-regexp 下是否匹配零段在不同版本间有差异，
      // 显式补一条 `/en` 精确规则可消除该不确定性。
      // 注意：`/en/membership` 会先到这里变成 `/membership`，再由上面那条规则送到 /pricing，
      // 与改动前的跳转数一致，无回退。
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
    ];
  },
};
export default nextConfig;
