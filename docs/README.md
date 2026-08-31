# FactoryAuditB2B SEO 文档集

生成日期：2026-08-29
数据来源：生产构建实机巡检（365 静态页 / 1218 条 sitemap URL / 22 个路由），非代码静态推断

---

## 文档索引

| 文档 | 内容 | 首要结论 |
|---|---|---|
| [SEO-AUDIT.md](./SEO-AUDIT.md) | 全站技术 + 语义审计 | 16 个页面 canonical 全指向首页，sitemap 72% 是 404 |
| [SCHEMA.md](./SCHEMA.md) | JSON-LD 规范与模板 | 覆盖率仅 27%，最该补的是 suppliers / 供应商详情 / pricing |
| [INTERNAL-LINKING.md](./INTERNAL-LINKING.md) | 内链架构规范 | 全站只有导航页脚在链接，198 条 audit-guide 零内链 |
| [AI-SEARCH.md](./AI-SEARCH.md) | AI 搜索与 GEO/AEO | 静态预渲染是优势；robots.txt 裸奔 + Cloudflare 默认拦截是风险 |
| [CRAWLER-ACCESS.md](./CRAWLER-ACCESS.md) | 爬虫访问与索引控制 | 含可直接用的 robots.ts 配置与 sitemap 止损方案 |
| [SEO-KEYWORD-MAP.md](./SEO-KEYWORD-MAP.md) | 关键词到 URL 映射 | 缺的不是词，是承接词的页面 |
| [CONTENT-STRATEGY.md](./CONTENT-STRATEGY.md) | 内容矩阵与 30 篇计划 | 先建 Article 模型，再写内容；先修 P0 再发文 |

---

## 三个必须马上做的（约半天）

| # | 任务 | 位置 | 耗时 |
|---|---|---|---|
| 1 | sitemap 移除 4 段 404 URL 生成 | `app/sitemap.ts` 第 56–65 行 | 10 分钟 |
| 2 | 抽 `buildPageMetadata()`，给 16 个页面补 metadata + 正确 canonical | 16 个 `page.tsx` | 半天 |
| 3 | `/supplier/[country]/[slug]` 查不到数据时 `notFound()` | 供应商详情路由 | 20 分钟 |

不做完这三项，后续所有内容与外链投入都收不到回报。

---

## 关键数据速查

| 指标 | 数值 |
|---|---|
| 页面路由 | 22 个 |
| 静态页 | 365 |
| sitemap URL | 1218（其中约 882 条 404）|
| 语言 | 6（en 无前缀 + zh/es/de/fr/pt）|
| 独立 metadata 覆盖率 | 6 / 22 |
| JSON-LD 覆盖率 | 6 / 22 |
| H1 覆盖率 | 22 / 22 |
| taxonomy | 国家 9 / 行业 12 / 标准 21 / 审核类型 22 |
| 业务数据 | 供应商 3、审核员 1 |
| 页面 TTFB | 约 5.5 ms |
