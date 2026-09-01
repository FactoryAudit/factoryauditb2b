import type { MetadataRoute } from "next";

const BASE = "https://factoryauditb2b.com";

// AI 检索爬虫：决定能否被 AI 引擎引用，必须放行
const AI_SEARCH_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "PerplexityBot-User",
  "Claude-SearchBot",
  "Claude-User",
  "Google-Extended",
  "Applebot",
];

// AI 训练爬虫：新站策略为放行（上线 12 个月后重新评估）
const AI_TRAINING_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Meta-ExternalAgent",
  "Amazonbot",
  "cohere-ai",
  "FacebookBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_SEARCH_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/api"],
      })),
      ...AI_TRAINING_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/api"],
      })),
      { userAgent: "Googlebot", allow: "/", disallow: ["/api"] },
      { userAgent: "Bingbot", allow: "/", disallow: ["/api"] },
      { userAgent: "*", allow: "/", disallow: ["/api"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
