# SEO-AUDIT — FactoryAuditB2B 全站审计

审计日期：2026-08-29
审计对象：https://factoryauditb2b.com（Next.js 15.3.3 App Router，静态导出 365 页）
审计方式：生产构建实机巡检，非代码静态推断

---

## 〇、一句话结论

**技术骨架是优等生，页面层是事故现场。** 多语言架构、hreflang、程序化矩阵设计都做对了，但 16 个页面的 canonical 全部指向首页，sitemap 里 72% 的 URL 是 404。这两条不修，后面所有内容和外链投入都收不到回报。

---

## 一、全站数据快照

| 指标 | 实测值 |
|---|---|
| 页面路由文件 | 22 个（含 2 个动态路由）|
| 构建静态页 | 365 |
| sitemap URL 总数 | 1218（203 条英文路径 × 6 语言）|
| 语言 | 6（en 无前缀 + zh / es / de / fr / pt 带前缀）|
| hreflang 变体 | 9（en / en-US / zh-CN / zh-Hans / es / de / fr / pt-BR / x-default）|
| H1 覆盖率 | 22 / 22（100%）|
| 独立 metadata 覆盖率 | **6 / 22（27%）** |
| JSON-LD 覆盖率 | **6 / 22（27%）** |
| sitemap 死链率 | **147 / 203（72.4%）** |
| taxonomy 数据量 | 国家 9 / 行业 12 / 标准 21 / 审核类型 22 |
| 真实业务数据 | 供应商 3、审核员 1、RFQ 1、验厂申请 1、线索 1 |

---

## 二、P0 致命问题（不修则全站不收录）

### P0-1　16 个页面的 canonical 全部指向首页

**实测证据**

| 页面 | canonical 实际值 |
|---|---|
| `/pricing` | `https://factoryauditb2b.com` |
| `/knowledge` | `https://factoryauditb2b.com` |
| `/suppliers` | `https://factoryauditb2b.com` |
| `/inspectors` | `https://factoryauditb2b.com` |

**根因**：`app/[locale]/layout.tsx` 的 `generateMetadata` 里写死了 `canonical: canonicalFor(locale, "/")`。16 个页面没有自己的 `generateMetadata`，于是全部继承这个指向首页的 canonical。

**后果**：Google 把这 16 个页面判定为首页的重复版本，权重全部合并到首页，这些页面**永远不会被单独索引**。相当于这 16 个页面白做。

**受影响页面（16 个）**

```
/admin                          /admin/taxonomy
/factory-audit/request          /inspectors
/knowledge                      /login
/pricing                        /rfq
/suppliers                      /supplier/[country]/[slug]
/tools/audit-checklist          /tools/audit-report-analyzer
/tools/supplier-document-checker
/tools/supplier-risk-assessment
/tools/supplier-scorecard
（首页自身不计）
```

**修复**：给每个页面补 `generateMetadata`，canonical 用 `canonicalFor(locale, "/pricing")` 这样的真实路径。中期方案是抽一个 `buildPageMetadata()` 工具函数，强制传 path，杜绝写死。

---

### P0-2　16 个页面共用同一个 title 和 description

**实测**：`/pricing`、`/knowledge`、`/suppliers` 的 title 全部是

```
Factory Audit & Supplier Verification | FactoryAuditB2B
```

description 全部是

```
We check factories in China and across Asia, then show you the paperwork.
```

**后果**：搜索结果里 16 个页面长得一模一样，点击率归零；Google 判为低质量重复内容。

**修复**：同 P0-1，补 metadata 时一并写差异化 title（含核心关键词 + 品牌）和 description（40–160 字符，含行动指向）。

---

### P0-3　sitemap 提交 147 条 404（×6 语言 = 882 条）

**实测分类**

| 路由模式 | 404 数量 | 成因 |
|---|---|---|
| `/factory-audit/{country}` | 9 | 页面文件不存在 |
| `/factory-audit/{country}/{industry}` | 108 | 页面文件不存在 |
| `/supplier-verification/{country}` | 9 | 页面文件不存在 |
| `/supplier-audit/{standard}` | 21 | 页面文件不存在 |
| **合计** | **147** | |

**根因**：`app/sitemap.ts` 第 56–65 行按 taxonomy 数据生成 URL，但 `app/[locale]/` 下**没有对应的 page.tsx**。sitemap 是"先画靶子"，页面没建。

**后果**：Google Search Console 报"提交的网址未找到"，大量 404 会快速消耗抓取预算并拉低站点质量分。这是最容易招致惩罚的一类错误。

**修复（二选一）**

| 方案 | 做法 | 适用 |
|---|---|---|
| A. 建页面 | 补 4 个动态路由的 page.tsx，把 147 条 URL 全部变成 200 | 推荐，长期价值高 |
| B. 删 URL | 从 sitemap.ts 移除这 4 段生成逻辑，只留真实存在的路径 | 应急，先止损 |

建议**先执行 B 止损（10 分钟），再按 CONTENT-STRATEGY 的排期执行 A**。

---

## 三、P1 重要问题

### P1-1　结构化数据覆盖率仅 27%

| 有 JSON-LD（6 个） | 缺失（16 个） |
|---|---|
| `/logistics`（WebApplication + FAQPage + BreadcrumbList）| `/suppliers` |
| `/tools/supplier-risk-calculator`（WebApplication + FAQPage + Offer）| `/supplier/[country]/[slug]` |
| `/tools/supplier-verification-checklist`（同上）| `/pricing` |
| `/services/supplier-verification`（Service + FAQPage + BreadcrumbList）| `/knowledge` |
| `/audit-guide/[country]/[auditType]`（Service + BreadcrumbList）| `/inspectors` |
| `/tools`（ItemList）| `/rfq`、`/factory-audit/request`、其余 5 个 tools 子页 |

**最该补的三个**：
1. `/suppliers` → `ItemList`（目录页，直接影响长尾收录）
2. `/supplier/[country]/[slug]` → `Organization` + `Product`（详情页，实体的核心载体）
3. `/pricing` → `Product` + `Offer`（价格是 AI 回答的高频引用点）

---

### P1-2　业务数据为空，程序化页面是空壳

supplier 仅 3 条、auditor 仅 1 条、auditLog 为 0。`/supplier/{country}/{slug}` 动态路由只有 3 个真实页面，而 sitemap 已为它们生成 18 条 URL。

**后果**：Google 抓取到的目录页只有 3 条结果，会被判为"薄内容"（thin content）。198 条 audit-guide 页面也因缺乏真实案例支撑而显得雷同。

**修复**：上线前至少补齐 30 家供应商 + 10 名审核员，或先对空目录页加 `noindex` 直到数据到位。

---

### P1-3　`robots.ts` 未声明 AI 爬虫

当前 robots.txt 只有一条通配规则，没有针对 GPTBot / PerplexityBot / ClaudeBot 等 AI 爬虫的显式声明。默认允许，但无法做差异化管理（详见 CRAWLER-ACCESS.md）。

---

### P1-4　页面缺 `og:image` 与 Twitter Card

根目录无 `opengraph-image` 文件，社交与 AI 摘要分享时无缩略图。

---

## 四、P2 优化项

| 项 | 现状 | 建议 |
|---|---|---|
| 页脚覆盖国家为纯文本 | 9 个国家名无链接 | 改为链向 `/factory-audit/{country}`，同时解决 P0-3 的入口 |
| `/knowledge` 7 张卡片无链接 | 点击无反应 | 补内容页或先移除 |
| 首页无 FAQPage 结构化数据 | 缺失 | 补 `FAQPage`，抢 AI 摘要位 |
| 无 `Article` / `Content` 数据模型 | schema 中不存在 | 做 30 篇内容前必须先建模型 |
| security header 缺 `Referrer-Policy` | 只有 nosniff / X-Frame-Options | 补全安全头 |
| 缺 `manifest.webmanifest` | 无 | 补 PWA 清单，利于移动端 |

---

## 五、做对的部分（不要动）

1. **多语言 URL 结构**：英文无前缀、其他带前缀，配合 middleware rewrite，现有 URL 零变更，SEO 零损失。
2. **hreflang 实现**：9 变体齐全，含 `x-default`，且每个页面都已输出，不是只在首页。
3. **taxonomy 单一事实来源**：国家 / 行业 / 标准 / 审核类型全部走 `lib/taxonomy.ts` + 数据库，无硬编码死数据。
4. **`llms.txt`**：已按 AI 抓取友好格式输出，且由 taxonomy 驱动，随数据自动更新。
5. **静态化**：365 页全部预渲染，首屏 HTML 完整，AI 爬虫无需执行 JS 即可读到全部内容。
6. **装柜计算器页面结构**：Quick Answer + 工具 + 方法论 + FAQ + WebApplication JSON-LD，是本站目前最标准的 AI 搜索友好范式，其余页面照此改造。

---

## 六、修复优先级与工作量

| 优先级 | 任务 | 预估 | 影响面 |
|---|---|---|---|
| P0 | sitemap 移除 4 段 404 URL 生成（止损）| 10 分钟 | 消除 882 条死链 |
| P0 | 抽 `buildPageMetadata()` 工具，给 16 个页面补 metadata + 正确 canonical | 半天 | 16 个页面可独立收录 |
| P1 | 补 3 个高价值页结构化数据（suppliers / supplier 详情 / pricing）| 半天 | 实体与价格可被引用 |
| P1 | 补齐供应商 / 审核员种子数据到 30 / 10 | 1 天 | 消除薄内容 |
| P1 | robots.ts 声明 AI 爬虫白名单 | 30 分钟 | AI 搜索收录 |
| P2 | 建 4 个缺失路由，恢复 147 条 URL | 2 天 | 程序化矩阵成型 |
| P2 | 补 og:image、manifest、安全头 | 2 小时 | 分享与安全评分 |

**建议执行顺序**：先做两个 P0（共约半天），这是所有后续投入的前提。
