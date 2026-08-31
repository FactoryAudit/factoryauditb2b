# CRAWLER-ACCESS — 爬虫访问与索引控制

日期：2026-08-29
现状：robots.txt 仅一条通配规则；sitemap 1218 条 URL 中约 882 条为 404

---

## 〇、一句话结论

**robots.txt 现在是"裸奔"状态**，没有任何 AI 爬虫声明，也没有屏蔽规则之外的精细控制。sitemap 更严重：1218 条 URL 里约 72% 是 404，等于主动向搜索引擎提交垃圾。

这两件事加起来，正在持续消耗本就不多的抓取预算。

---

## 一、robots.txt 现状

**当前输出**（`app/robots.ts`）：

```
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /dashboard

Sitemap: https://factoryauditb2b.com/sitemap.xml
```

**问题清单**

| 问题 | 影响 |
|---|---|
| 无 AI 爬虫声明 | 依赖各厂商自觉遵守通配规则，无法做差异化管理 |
| `Disallow: /admin` 但 `/admin` 有 19 条全站内链 | 已屏蔽抓取，但权重仍在流失，应改 nofollow |
| `/dashboard` 不存在 | 规则指向不存在的路径，无害但属于冗余 |
| 未屏蔽 `/api` | API 路由应显式屏蔽 |
| 未声明 `/login` | 登录页无索引价值，应 noindex |

---

## 二、目标 robots.txt

### 2.1 完整配置（`app/robots.ts`）

```ts
import type { MetadataRoute } from "next";

const BASE = "https://factoryauditb2b.com";

// AI 检索爬虫：决定能否被引擎引用，必须放行
const AI_SEARCH_BOTS = [
  "OAI-SearchBot",      // ChatGPT Search 引用
  "ChatGPT-User",       // ChatGPT 用户触发抓取
  "PerplexityBot",      // Perplexity 索引与引用
  "PerplexityBot-User",
  "Claude-SearchBot",   // Claude 搜索索引
  "Claude-User",
  "Google-Extended",    // Gemini 与 AI Overviews
  "Applebot",           // Siri / Spotlight 搜索
];

// AI 训练爬虫：新站策略为放行，12 个月后重新评估
const AI_TRAINING_BOTS = [
  "GPTBot",             // OpenAI 训练
  "ClaudeBot",
  "anthropic-ai",
  "Applebot-Extended",
  "CCBot",              // Common Crawl
  "Bytespider",         // 字节跳动
  "Meta-ExternalAgent",
  "Amazonbot",
  "cohere-ai",
  "FacebookBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // 1) AI 检索爬虫：显式放行
      ...AI_SEARCH_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/admin", "/api"],
      })),

      // 2) AI 训练爬虫：新站放行（见 AI-SEARCH.md 2.2）
      ...AI_TRAINING_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/admin", "/api"],
      })),

      // 3) 传统搜索引擎
      { userAgent: "Googlebot", allow: "/", disallow: ["/admin", "/api"] },
      { userAgent: "Bingbot", allow: "/", disallow: ["/admin", "/api"] },

      // 4) 其他
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/login"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
```

### 2.2 上线后验证（必做）

```bash
# 逐个模拟 AI 爬虫，确认返回 200 而非 403/429
curl -A "OAI-SearchBot"   https://factoryauditb2b.com/
curl -A "PerplexityBot"   https://factoryauditb2b.com/
curl -A "Claude-SearchBot" https://factoryauditb2b.com/
curl -A "GPTBot"          https://factoryauditb2b.com/
```

若返回 403 / 429，说明 CDN 或 WAF 层面拦截，与 robots.txt 无关（详见 AI-SEARCH.md 2.2 的部署陷阱）。

---

## 三、sitemap 策略

### 3.1 现状：1218 条 URL，约 882 条 404

| 路由模式 | 404 数（英文）| ×6 语言 |
|---|---|---|
| `/factory-audit/{country}` | 9 | 54 |
| `/factory-audit/{country}/{industry}` | 108 | 648 |
| `/supplier-verification/{country}` | 9 | 54 |
| `/supplier-audit/{standard}` | 21 | 126 |
| **合计** | **147** | **882** |

根因：`app/sitemap.ts` 第 56–65 行按 taxonomy 生成 URL，但 `app/[locale]/` 下没有对应页面文件。

### 3.2 应急止损（10 分钟）

在 `app/sitemap.ts` 中注释掉这四段生成逻辑：

```ts
// 暂时下线：页面尚未建成，提交 404 会损害站点质量分
// countries.forEach((c) => {
//   pages.push(...emit(`/factory-audit/${c.code}`));
//   pages.push(...emit(`/supplier-verification/${c.code}`));
//   industries.forEach((i) =>
//     pages.push(...emit(`/factory-audit/${c.code}/${i.code.toLowerCase()}`))
//   );
// });
// standards.forEach((s) => pages.push(...emit(`/supplier-audit/${s.code}`)));
```

止损后：1218 − 882 = **336 条有效 URL**（56 条英文路径 × 6 语言）。

### 3.3 恢复条件

四个路由的 page.tsx 建成、且全量巡检通过后，再逐段放开。建议按 CONTENT-STRATEGY 的排期推进。

### 3.4 只提交 200 的 URL 原则

**规则**：sitemap 里出现的每一条 URL，上线前必须通过全量巡检。

**巡检脚本**（放在 CI 或上线前手动跑）：

```bash
# 抓 sitemap，逐条验状态码，非 200 全部列出
curl -s https://factoryauditb2b.com/sitemap.xml \
  | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g' \
  | while read url; do
      code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
      [ "$code" != "200" ] && echo "$code  $url"
    done
```

**上线前必须 0 条非 200。**

### 3.5 lastModified 处理

当前 `emit()` 默认 `new Date()`，每次构建都刷新全部 1218 条的时间戳。这会让搜索引擎误以为全站内容每天都在变，浪费抓取预算。

**修复**：按内容真实更新时间填。静态页面用固定日期，供应商详情页用 `supplier.updatedAt`。

---

## 四、索引控制（noindex 规则）

### 4.1 应加 noindex 的页面

| 页面 | 理由 | 做法 |
|---|---|---|
| `/admin`、`/admin/taxonomy` | 后台 | robots.txt 已屏蔽 + 页面加 noindex |
| `/login` | 无内容价值 | 页面 metadata 加 noindex |
| 空目录页（数据补齐前）| 薄内容 | 数据少于 5 条时临时 noindex |

**实现方式**（页面级）：

```ts
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};
```

### 4.2 页脚 admin 链接改 nofollow

`components/SiteFooter.tsx` 第 85 行：

```tsx
<Link href={p("/admin")} rel="nofollow" className="hover:text-white">
  {dict.admin}
</Link>
```

### 4.3 软 404 修复（优先于 noindex）

`/supplier/china/任意不存在的slug` 目前返回 200。必须改为 `notFound()`，否则会产生无限个可被索引的空页面。

---

## 五、渲染与性能

### 5.1 当前状态（良好）

| 指标 | 实测 |
|---|---|
| 渲染方式 | 365 页全部静态预渲染（SSG）|
| HTML 首屏完整性 | 完整，答案在 HTML 中，无需执行 JS |
| TTFB（本地）| 约 5.5 ms |
| `/logistics` 页面体积 | 74 KB |

**这是本站最大的技术优势，不要破坏。** 后续新增页面务必保持服务端渲染，任何需要点击或滚动才出现的内容，AI 爬虫都读不到。

### 5.2 禁止事项

- 不要把核心内容改成客户端 `useEffect` 异步加载
- 不要把答案放进需要交互才展开的折叠面板（FAQ 可用 `<details>`，内容仍在 HTML 里）
- 不要对 AI 爬虫返回不同内容（cloaking，会招致惩罚）

### 5.3 建议补充

| 项 | 现状 | 建议 |
|---|---|---|
| `Cache-Control` | 未设置 | 静态资源 `max-age=31536000, immutable` |
| `Referrer-Policy` | 缺失 | `strict-origin-when-cross-origin` |
| 压缩 | 依赖平台 | 确认 gzip / brotli 已开启 |
| `manifest.webmanifest` | 无 | 补一个，利于移动端抓取 |

---

## 六、HTTP 头配置（`next.config.mjs`）

```js
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
    {
      source: "/_next/static/(.*)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ];
}
```

---

## 七、上线前检查清单

- [ ] robots.ts 已显式声明全部 AI 爬虫
- [ ] 部署后 `curl -A` 实测 4 个爬虫返回 200
- [ ] CDN / WAF 未启用 AI 爬虫拦截
- [ ] sitemap 全量巡检 0 条非 200
- [ ] sitemap 已移除或修复 882 条 404 URL
- [ ] `lastModified` 用真实更新日期，不用构建时间
- [ ] `/admin`、`/login` 已 noindex
- [ ] 页脚 admin 链接已 nofollow
- [ ] `/supplier/[country]/[slug]` 软 404 已修复
- [ ] Bing Webmaster Tools 已提交 sitemap
- [ ] Google Search Console 已验证域名并提交 sitemap
