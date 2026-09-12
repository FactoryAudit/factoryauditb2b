import type { MetadataRoute } from "next";

const BASE = "https://factoryauditb2b.com";

// CS-01：线上 robots.txt = Cloudflare 托管段（在前）+ 本文件产出（在后）。
// 此前本文件对**同一批 UA** 先被托管段 Disallow、又被这里 Allow，指令直接相反，
// 各爬虫的合并策略不一致 ⇒ 实际处于不确定状态。
//
// 现在的规则：本文件**不再与边缘对抗**，而是把同一套策略在源站侧显式写一遍 ——
// 这样即使 Cloudflare 托管段将来被关掉，策略依然成立；两者同时存在时语义也一致。

// ---- A. 放行：传统搜索 + AI 检索 / 引用（决定我们能否被搜索与 AI 引用）----
const ALLOWED_BOTS = [
  // 传统搜索
  "Googlebot",
  "Bingbot",
  "Applebot", // Siri / Spotlight 搜索
  "YandexBot",
  "SeznamBot",
  "DuckDuckBot",
  // AI 检索 / 引用：这些爬虫抓取是为了**回答用户问题并给出出处**，
  // 封掉等于主动放弃 AI 搜索曝光，因此一律放行。
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "PerplexityBot-User",
  "Claude-SearchBot",
  "Claude-User",
];

// ---- B. 禁止：AI 训练爬虫 ----
// 与 Cloudflare 托管段保持一致（托管段对以下 UA 一律 Disallow: /）。
// 注意：这里表达的是「不允许用于模型训练/微调」，**不影响搜索与 AI 检索引用** ——
// 检索类爬虫在上面 A 组，是不同 UA，不会被本组误伤。
const DISALLOWED_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Meta-ExternalAgent",
  "meta-externalagent",
  "Amazonbot",
  "cohere-ai",
  "FacebookBot",
  // Google-Extended 控制内容是否用于 Gemini / Vertex AI 生成式接口。
  // Cloudflare 托管段已将其 Disallow，这里保持一致，避免同 UA 指令冲突。
  // ⚠️ 若后续希望在 Gemini 回答中获得引用，需**先在 Cloudflare 的 AI Crawl Control
  //    里放行 Google-Extended**，再把本行移到 A 组 —— 只改这里不会生效。
  "Google-Extended",
  "CloudflareBrowserRenderingCrawler",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...ALLOWED_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/api"],
      })),
      ...DISALLOWED_BOTS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
      { userAgent: "*", allow: "/", disallow: ["/api"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
