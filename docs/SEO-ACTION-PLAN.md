# SEO ACTION PLAN — 执行计划

日期：2026-08-29
依据：docs/SEO-AUDIT.md + docs/INTERNAL-LINKING.md + docs/SCHEMA.md + docs/CRAWLER-ACCESS.md + docs/SEO-KEYWORD-MAP.md + 竞品研究

---

## 优先级总览

| 优先级 | 任务 | 状态 | 负责 |
|---|---|---|---|
| P0-1 | 修复 16 个页面 canonical 指向首页 | 🔴 待做 | 抽 buildPageMetadata() |
| P0-2 | sitemap 移除 882 条 404 URL | 🔴 待做 | sitemap.ts 注释 4 段 |
| P0-3 | 供应商详情软 404 修复（notFound()）| 🔴 待做 | supplier/[country]/[slug] |
| P0-4 | robots.ts 声明 AI 爬虫白名单 | 🔴 待做 | 见 CRAWLER-ACCESS §2 |
| P1-1 | 7 个工具页补独立 metadata（差异化 title）| 🟡 待做 | 各 tool 页面 |
| P1-2 | /suppliers 补 ItemList + BreadcrumbList | 🟡 待做 | SCHEMA §3.1 |
| P1-3 | /knowledge 建 9×22 audit-guide 矩阵入口 | 🟡 待做 | 内链 P0-1 |
| P1-4 | 工具页底部互链（上一步/下一步）| 🟡 待做 | 内链 §3.2 |
| P1-5 | 模板下载页（7 份）吃 template 长尾词 | 🟡 待做 | 竞品借鉴 |
| P2-1 | 建 4 个缺失路由恢复 147 条 URL | 🟢 计划 | factory-audit / supplier-audit 等 |
| P2-2 | audit-guide 页内同国家/同类型互链 | 🟢 计划 | 198 页模板化 |
| P2-3 | og:image / manifest / 安全头 | 🟢 计划 | next.config |

---

## 执行顺序（本周）

| 天 | 任务 | 验收标准 |
|---|---|---|
| D1 | P0-1 canonical 修复 | 抽查 5 个页面 canonical = 自身 URL |
| D1 | P0-2 sitemap 死链清理 | sitemap 全量巡检 0 条非 200 |
| D1 | P0-3 软 404 修复 | 不存在 slug 返回 404 |
| D2 | P0-4 robots.ts 更新 | curl -A 模拟 4 个 AI 爬虫 200 |
| D2 | P1-1 工具页 metadata | 7 个页面 title 互不相同 |
| D3 | P1-2 suppliers schema | Rich Results 测试通过 |
| D3 | P1-3 knowledge 矩阵 | 198 条 URL 各有 ≥1 条内链 |
| D4 | P1-4 工具互链 + P1-5 模板页 | 每工具页 2 条相关链 |
| D5 | 回归：42 路由巡检 | 0 失败 |

---

## 度量

| 指标 | 基线 | 目标（30 天）|
|---|---|---|
| sitemap 死链 | 882 | 0 |
| canonical 错误 | 16 页 | 0 |
| 独立 title 页面 | 6/22 | 22/22 |
| JSON-LD 覆盖率 | 6/22 | 12/22 |
| 程序化页入链 | 0/198 | 198/198 |
| 索引页数（GSC）| 待查 | 比基线 +50% |
