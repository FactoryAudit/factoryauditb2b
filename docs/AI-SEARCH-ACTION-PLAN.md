# AI SEARCH ACTION PLAN — AI 搜索与 GEO 执行计划

日期：2026-08-29
依据：docs/AI-SEARCH.md + docs/CRAWLER-ACCESS.md + 任务书 §36–42

---

## 核心原则（任务书 §38）

不做"For ChatGPT"垃圾页。做：Clear / Structured / Accurate / Original / Crawlable / Citable / Useful。

---

## 执行顺序

### 第 1 步：爬虫可达性（本周，P0）
- [ ] robots.ts 显式声明 AI 检索爬虫（OAI-SearchBot / PerplexityBot / Claude-SearchBot / Google-Extended / Bingbot）—— 代码在 CRAWLER-ACCESS §2.1 已就绪
- [ ] 部署后 curl -A 实测 4 个爬虫 200
- [ ] CDN / WAF 检查是否默认屏蔽 AI 爬虫（Cloudflare 2024 起默认拦）

### 第 2 步：页面范式（本周起持续）
每个核心页面（工具页 / 服务页 / 内容页）按 /logistics 样板：
```
H1 → Quick Answer（40–80 词，第一句给结论）
   → 主体（表格 + 编号列表 + 具体数字）
   → FAQ（5–8 组真实问答 + FAQPage schema）
```

### 第 3 步：AI 爬虫监控（两周内）
- [ ] 服务器日志按月统计各 AI 爬虫抓取量
- [ ] 每月手动抽查 5 个监测问题（AI-SEARCH.md §六）看是否被引用
- [ ] Bing Webmaster Tools 提交 sitemap（影响 ChatGPT / Copilot）

### 第 4 步：AI 可访问性（一个月内）
- [ ] 语义 HTML 自查：按钮用 `<button>`、链接用 `<a>`、表单有 label/name/autocomplete/aria（任务书 §40）
- [ ] AI Readiness Score 工具：内部生成 0–100（Crawlable / Indexable / Structured / Direct Answer / Original / Sources / Internal Links / Entity Clarity / Updated 9 项），用于质量门槛，**不得对外称为 Google/OpenAI 分数**

---

## AI Readiness Score 内部标准

| 项 | 权重 | 满分条件 |
|---|---|---|
| Crawlable | 15 | 静态/SSG，无 JS 依赖内容 |
| Indexable | 10 | 无 noindex，canonical 正确 |
| Structured | 15 | H1/H2 层级 + 表格/列表 |
| Direct Answer | 15 | Quick Answer 40–80 词 |
| Original | 10 | 非模板拼接，有实例/数字 |
| Sources | 10 | 引用标准/数据来源 |
| Internal Links | 10 | ≥2 条相关内链 |
| Entity Clarity | 10 | Organization/Service schema 正确 |
| Updated | 5 | 有明确更新日期 |
| **合计** | **100** | ≥75 才允许上线 |

---

## 里程碑

| 时间 | 目标 |
|---|---|
| 本周 | robots.txt + 爬虫实测 |
| 2 周 | 7 个工具页全部达 Quick Answer 标准 |
| 1 月 | 30 篇内容全部通过 AI Readiness ≥75 |
| 持续 | 月度 AI 引用监测表 |
