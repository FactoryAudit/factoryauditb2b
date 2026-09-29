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

// 全站统一禁止抓取的路径（无论哪个 UA）：
//  - /api               后端接口（/api/lead、/api/me 等），绝不可收录
//  - /admin             管理后台（未授权返回 404，显式禁止更稳妥）
//  - /staging           预发布 / 测试环境（若启用）
//  - /*?                任何带查询字符串的 URL（搜索 / 筛选 / 表单态）—— 避免重复薄页被收录
const DISALLOW_PATHS = ["/api", "/admin", "/staging", "/*?"];

// 例外放行（阶段 1 任务 8）：`/*?` 会把「搜索框结构化数据」指向的 URL 一并屏蔽 ——
// WebSite 的 SearchAction target 正是 /suppliers?q={search_term_string}
// （见 app/[locale]/layout.tsx），于是出现"声明了站内搜索、却禁止抓取结果页"的自相矛盾。
// robots 规范：同一 UA 同时命中 Allow 与 Disallow 时按**最长匹配**胜出，
// 因此 /suppliers?q=（更长）会盖过 /*?。
// 安全性：过滤态页自身已由 generateMetadata 输出 robots: index:false, follow:true
// （见 app/[locale]/suppliers/page.tsx）——「允许抓取」不等于「允许收录」，
// 反而是让爬虫读到 noindex 并把该 URL 从索引里摘掉的前提。
// 注意：/suppliers 只支持 country / industry / q 三个参数（无 page 参数），
// 故此处不放行 ?page=，避免为不存在的参数组合制造可抓取路径。
const ALLOW_EXCEPTIONS = ["/suppliers?q="];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...ALLOWED_BOTS.map((userAgent) => ({
        userAgent,
        allow: ["/", ...ALLOW_EXCEPTIONS],
        disallow: DISALLOW_PATHS,
      })),
      ...DISALLOWED_BOTS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
      { userAgent: "*", allow: ["/", ...ALLOW_EXCEPTIONS], disallow: DISALLOW_PATHS },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
