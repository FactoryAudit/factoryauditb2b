# 阶段 0 只读审计报告 — factoryauditb2b.com

审计时间：2026-09-29 11:15 GMT+8  
线上版本：`943cae8c-cd08-4df2-8257-7332edd1af64`  
审计方式：**全程只读**（HTTP 取证 + 源码静态分析）。**未改动任何代码。**

---

## 0. 审计限制（必须先说明，影响结论可信度）

| 项                                    | 状态                                | 替代验证方式                          |
| ------------------------------------ | --------------------------------- | ------------------------------- |
| Google Search Console 覆盖报告           | ❌ 无法直连（需你导出）                      | 我用 `site:` 语义替代 + sitemap 逐条探测  |
| Cloudflare 服务器日志（AI 爬虫抓取状态码）         | ❌ Workers 无日志导出权限                 | 用 robots.txt 策略 + 实际 HTTP 探测替代  |
| PageSpeed Insights / Lighthouse      | ❌ 本机无 API key / 无 headless Chrome | 用 TTFB 中位数 + 预渲染缓存头替代           |
| Rich Results Test / Schema Validator | ❌ 无法调用 Google 接口                  | 用 JSON-LD 逐块解析 + `@type` 递归审计替代 |
| Bing Webmaster Tools                 | ❌ 无凭据                             | —                               |

**关键提示**：你指令中的"已知页面清单"与本项目**真实 URL 结构不符**。见 §2。

---

## 1. 技术栈识别（§3.1）

| 项    | 结论                                                                                        | 证据                                                        |
| ---- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 前端框架 | **Next.js 15.5.24（App Router）** + React 19 + TypeScript strict                            | `package.json` / `next build` 输出                          |
| 渲染方式 | **全站预渲染（SSG/ISR）为主，纯动态仅 3 页**                                                             | 所有页面响应头 `x-nextjs-prerender: 1` + `x-opennext-cache: HIT` |
| 路由方案 | 文件路由 + 动态段                                                                                | `app/[locale]/**/page.tsx`，共 **88 个 page 路由**             |
| 部署   | **Cloudflare Workers（OpenNext）** + Cloudflare CDN 前置                                      | 响应头 `Server: cloudflare`、`x-opennext: 1`                  |
| CMS  | 无（内容 = TS 常量 + Supabase）                                                                  | `lib/guides.ts` 等                                         |
| 多语言  | **子目录**（en 无前缀，其余 8 语带前缀）                                                                 | `/zh`、`/ar`、`/zh-TW`                                      |
| 构建工具 | **Webpack**（非 Turbopack）                                                                  | `next build` 编译阶段无输出、耗时 15-20min                          |
| 主要依赖 | Next 15.5.24 / React 19 / Tailwind v4 / `@supabase/ssr` 0.12.5 / `@opennextjs/cloudflare` | `package.json`                                            |
| 样式   | Tailwind CSS v4                                                                           | —                                                         |
| 后端数据 | Supabase（ref `tcyhstswppoqwlmchsmc`），构建期 REST 查询 + 预渲染冻结                                  | `lib/queries.ts`                                          |

> **⚠️ 推翻指令假设**：指令 §1.3 称"核心内容可能依赖客户端渲染，爬虫拿不到完整 HTML"。**实测为假**——首页 HTML 正文 **7368 字符**、`/guides` **13943 字符**、`/standard-report` **9339 字符**，全部在初始 HTML 中，且 `x-nextjs-prerender: 1`。爬虫拿得到完整内容。

---

## 2. URL 结构校正（指令假设 vs 真实）— **最高优先级**

指令 §1.4 列出的"已知页面清单"里，**9 个 URL 在线上是 404**：

| 指令假设 URL                                     | 实测         | 真实对应 URL                                                     |
| -------------------------------------------- | ---------- | ------------------------------------------------------------ |
| `/supplier-verification/china`               | **404**    | `/countries/china` + `/services/china-supplier-verification` |
| `/supplier-verification/vietnam…philippines` | **404** ×4 | `/countries/{vietnam,thailand,malaysia,philippines}`         |
| `/factory-audit`                             | **404**    | `/services/{country}-factory-audit`、`/factory-audit/request` |
| `/third-party-inspection`                    | **404**    | `/services/inspection`                                       |
| `/sourcing`                                  | **404**    | `/services/supplier-improvement`、`/custom-services`          |
| `/tools/audit-scope-recommender`             | **404**    | 不存在（工具集不同，见下）                                                |
| `/tools/supplier-risk-calculator`            | 200 ✅      | 一致                                                           |

**真实的工具页共 9 个**（不是指令说的 2 个）：`/tools/supplier-risk-calculator`、`/tools/compare`、`/tools/supplier-verification-checklist`、`/tools/audit-checklist`、`/tools/audit-report-analyzer`、`/tools/supplier-document-checker`、`/tools/supplier-risk-assessment`、`/tools/supplier-scorecard` + `/tools` 索引页。

> **结论**：指令 §4.x/§5.x 里所有以 `/supplier-verification/china`、`/factory-audit`、`/third-party-inspection`、`/sourcing` 为目标的改造项，**必须先映射到真实路由**，否则会造出 404 页面或重复内容。这是进入阶段 1 前**必须先确认的第一个决策点**。

---

## 3. 页面模板清单（§3.2）— 真实模板 × 渲染 × 缓存

| 模板          | 真实 URL 示例                                                                                 | 模板文件                                | 渲染           | 在 sitemap | canonical | hreflang | JSON-LD                       |
| ----------- | ----------------------------------------------------------------------------------------- | ----------------------------------- | ------------ | --------- | --------- | -------- | ----------------------------- |
| 首页          | `/`                                                                                       | `app/[locale]/page.tsx`             | SSG          | ✅         | ✅         | 10+x-def | Org/WebSite/SearchAction      |
| 国家索引        | `/countries`                                                                              | `countries/page.tsx`                | SSG          | ✅         | ✅         | ✅        | ItemList                      |
| 国家详情        | `/countries/china`                                                                        | `countries/[slug]`                  | SSG          | ✅         | ✅         | ✅        | Service+FAQ+ItemList          |
| 服务索引        | `/services`                                                                               | `services/page.tsx`                 | SSG          | ✅         | ✅         | ✅        | ItemList                      |
| 服务详情        | `/services/{country}-{service}`、`/services/inspection`、`/services/supplier-improvement`   | `services/[slug]`                   | SSG          | ✅         | ✅         | ✅        | Service+FAQ+Offer             |
| 供应商列表       | `/suppliers`                                                                              | `suppliers/page.tsx`                | **动态（非预渲染）** | ✅         | ✅         | ✅        | Organization+ItemList         |
| 供应商详情       | `/suppliers/{slug}`                                                                       | `suppliers/[slug]`                  | SSG          | ✅         | ✅         | ✅        | Org+WebPage+FAQ+PostalAddress |
| 工具索引        | `/tools`                                                                                  | `tools/page.tsx`                    | SSG          | ✅         | ✅         | ✅        | ItemList                      |
| 工具详情 ×8     | `/tools/supplier-risk-calculator` 等                                                       | `tools/*/page.tsx`                  | SSG          | ✅         | ✅         | ✅        | FAQ+Offer+WebApp（部分）          |
| RFQ         | `/rfq`                                                                                    | `rfq/page.tsx`                      | SSG          | ✅         | ✅         | ✅        | Service                       |
| 定价          | `/pricing`                                                                                | `pricing/page.tsx`                  | SSG          | ✅         | ✅         | ✅        | FAQ+Offer                     |
| 资源          | `/resources`                                                                              | `resources/page.tsx`                | SSG          | ✅         | ✅         | ✅        | ItemList                      |
| 指南索引        | `/guides`                                                                                 | `guides/page.tsx`                   | SSG          | ✅         | ✅         | ✅        | ItemList                      |
| 指南详情        | `/guides/{slug}`（47 篇）                                                                    | `guides/[slug]`                     | SSG          | ✅         | ✅         | ✅        | Article+FAQ                   |
| 指南分类        | `/guides/category/{c}`（6 类）                                                               | `guides/category/[c]`               | SSG          | ✅         | ✅         | ✅        | —                             |
| 审计指南        | `/audit-guide/{country}/{TYPE}`（35 × 9）                                                   | `audit-guide/[country]/[auditType]` | SSG          | ✅         | ✅         | ✅        | Service+Breadcrumb            |
| 行业索引/详情     | `/industry`、`/industry/{slug}`、`/industry/{slug}/{topic}`                                 | `industry/**`                       | SSG          | ✅         | ✅         | ✅        | ItemList                      |
| 化工          | `/chemicals`、`/chemicals/{slug}`                                                          | `chemicals/**`                      | SSG          | ✅         | ✅         | ✅        | ItemList                      |
| 产业集群        | `/industrial-clusters/...`                                                                | `industrial-clusters/[...segments]` | **动态（非预渲染）** | ✅         | ✅         | ✅        | —                             |
| 案例研究        | `/case-studies`、`/case-studies/{slug}`                                                    | `case-studies/**`                   | SSG          | ✅         | ✅         | ✅        | Article                       |
| 实地报告        | `/field-reports`、`/field-reports/{slug}`                                                  | `field-reports/**`                  | SSG          | ✅         | ✅         | ✅        | Article                       |
| 验证供应商       | `/verify-supplier`                                                                        | `verify-supplier/page.tsx`          | SSG          | ✅         | ✅         | ✅        | WebPage                       |
| 关于（A）       | `/about`                                                                                  | `about/page.tsx`                    | SSG          | ✅         | ✅         | ✅        | —                             |
| 关于（B）       | `/trust`                                                                                  | `trust/page.tsx`                    | SSG          | ✅         | ✅         | ✅        | —                             |
| 联系          | `/contact`                                                                                | `contact/page.tsx`                  | SSG          | ✅         | ✅         | ✅        | —                             |
| 标准报告        | `/standard-report`                                                                        | `standard-report/page.tsx`          | SSG          | ✅         | ✅         | ✅        | Article                       |
| 方法论         | `/methodology`                                                                            | `methodology/page.tsx`              | SSG          | ✅         | ✅         | ✅        | Article                       |
| 物流计算器       | `/logistics`                                                                              | `logistics/page.tsx`                | SSG          | ✅         | ✅         | ✅        | FAQ+Offer+WebApp              |
| 监控服务        | `/monitoring`                                                                             | `monitoring/page.tsx`               | SSG          | ✅         | ✅         | ✅        | Service+FAQ                   |
| 自定义服务       | `/custom-services`                                                                        | `custom-services/page.tsx`          | SSG          | ✅         | ✅         | ✅        | Service                       |
| 招聘          | `/careers`                                                                                | `careers/page.tsx`                  | SSG          | ✅         | ✅         | ✅        | —                             |
| 供应商入驻       | `/join-supplier-network`                                                                  | 同名                                  | SSG          | ✅         | ✅         | ✅        | —                             |
| 培训方案        | `/training-plans`                                                                         | 同名                                  | SSG          | ✅         | ✅         | ✅        | —                             |
| 法律          | `/privacy`、`/terms`                                                                       | 同名                                  | SSG          | ✅         | ✅         | ✅        | —                             |
| 供应商自评       | `/supplier-assessment`                                                                    | 同名                                  | **动态**       | ❌         | ✅         | 无        | —                             |
| 404 页       | 任意不存在路径                                                                                   | 框架默认                                | —            | —         | —         | —        | —                             |
| 私有（noindex） | `/account`、`/login`、`/register`、`/order`、`/checkout/{ref}`、`/supplier-dashboard`、`/admin` | —                                   | 动态           | ❌         | —         | —        | —                             |

---

## 4. 服务端 HTML 检查结果（§3.3）

**35 个模板抽样，全部 `200` + `x-nextjs-prerender: 1`。** 检查项全绿的结论如下（行 = 模板，列 = 是否在初始 HTML）：

| 模板           | title | desc | h1     | 正文 | canonical | hreflang    | JSON-LD | OG/Twitter |
| ------------ | ----- | ---- | ------ | -- | --------- | ----------- | ------- | ---------- |
| 首页           | 是     | 是    | 是（1 个） | 是  | 是         | 是（10+x-def） | 是       | 是（4/4）     |
| 国家详情         | 是     | 是    | 是      | 是  | 是         | 是           | 是       | 是          |
| 服务详情         | 是     | 是    | 是      | 是  | 是         | 是           | 是       | 是          |
| 供应商列表        | 是     | 是    | 是      | 是  | 是         | 是           | 是       | 是          |
| 供应商详情        | 是     | 是    | 是      | 是  | 是         | 是           | 是       | 是          |
| 工具详情         | 是     | 是    | 是      | 是  | 是         | 是           | 是       | 是          |
| RFQ          | 是     | 是    | 是      | 是  | 是         | 是           | 是       | 是          |
| 定价           | 是     | 是    | 是      | 是  | 是         | 是           | 是       | 是          |
| 指南详情         | 是     | 是    | 是      | 是  | 是         | 是           | 是       | 是          |
| 多语言（/zh /ar） | 是     | 是    | 是      | 是  | 是         | 是           | 是       | 是          |

**唯一 `h1` 数量异常：无**（每页恰好 1 个 `<h1>`，全站 35/35 正确）。

**canonical 自指：34/35 正确。** 唯一"BAD"是首页——我的断言要求 `…/`（带尾斜杠），实际 canonical 输出 `https://factoryauditb2b.com`（无尾斜杠），**这是更规范的写法，不是问题**。

**openGraph / twitter：** `og:title`/`og:description`/`og:image`/`twitter:card` 四项齐全。唯一例外是 `/logistics` 缺 `twitter:image`（`td-tw` vs `tditw`），极轻微。

---

## 5. robots.txt 审计（§3.4）

**已存在。** 原文关键段：

```
User-Agent: Googlebot / Bingbot / Applebot / YandexBot / SeznamBot / DuckDuckBot
            OAI-SearchBot / ChatGPT-User / PerplexityBot / PerplexityBot-User
            Claude-SearchBot / Claude-User
Allow: /
Disallow: /api
Disallow: /admin
Disallow: /staging
Disallow: /*?

User-Agent: GPTBot / ClaudeBot / anthropic-ai / Applebot-Extended / CCBot
            Bytespider / Meta-ExternalAgent / Amazonbot / cohere-ai
            FacebookBot / Google-Extended / CloudflareBrowserRenderingCrawler
Disallow: /

Host: https://factoryauditb2b.com
Sitemap: https://factoryauditb2b.com/sitemap.xml
```

| 检查项                                | 结论                                                                    |
| ---------------------------------- | --------------------------------------------------------------------- |
| 存在                                 | ✅                                                                     |
| 屏蔽重要目录                             | ✅ 仅 `/api`、`/admin`、`/staging`，**未屏蔽** `/suppliers/`、`/tools/`、`/rfq` |
| 屏蔽 CSS/JS                          | ❌ 未屏蔽 ✅                                                               |
| Googlebot / Bingbot                | ✅ Allow                                                               |
| GPTBot                             | ❌ **Disallow**（屏蔽）                                                    |
| ChatGPT-User                       | ✅ Allow                                                               |
| PerplexityBot / PerplexityBot-User | ✅ Allow                                                               |
| ClaudeBot                          | ❌ **Disallow**                                                        |
| Claude-SearchBot / Claude-User     | ✅ Allow                                                               |
| Google-Extended                    | ❌ **Disallow**                                                        |
| CCBot                              | ❌ **Disallow**                                                        |
| Sitemap 指令                         | ✅ 有                                                                   |
| Crawl-delay                        | ✅ 无                                                                   |

**解读（关键）**：这不是配置失误，是**有意的分层策略**——**检索型爬虫全放行**（ChatGPT-User / OAI-SearchBot / PerplexityBot / Claude-SearchBot / Claude-User），**训练型爬虫全屏蔽**（GPTBot / CCBot / Google-Extended / ClaudeBot）。

- 对 **AEO/GEO（被 AI 答案引用）**：**当前配置已足够**，因为答案引擎走的是检索型爬虫。
- 对 **LLM 训练可见性**：被主动放弃（通常出于版权/内容保护考虑）。

> ⚠️ **这与指令 §4.1「允许 GPTBot、ClaudeBot、Google-Extended、CCBot」直接冲突。** 需你决策：是要维持现有"保护内容、只允许引用"策略，还是改为全面开放。**这是第二个决策点。**

**轻微问题**：`Disallow: /*?` 屏蔽全部带参 URL，而 WebSite SearchAction 的 target 是 `/suppliers?q={search_term_string}` → **搜索框结构化数据指向的 URL 本身被 robots 屏蔽**，Google 不会为它建索引。功能无碍（SearchAction 只是 sitelinks searchbox 提示），但属自相矛盾，建议清理。

---

## 6. XML sitemap 审计（§3.5）

| 项                      | 结论                                          |
| ---------------------- | ------------------------------------------- |
| 存在                     | ✅ `/sitemap.xml`                            |
| 条目数                    | **1755**（单文件，远低于 50000 上限）                  |
| 类型                     | 单一 `<urlset>`，**非 sitemap index**           |
| `<lastmod>`            | ✅ 1755/1755 全有                              |
| `<changefreq>`         | ✅ 1755/1755 全有                              |
| `<priority>`           | ✅ 1755/1755 全有                              |
| hreflang（`xhtml:link`） | ✅ **17550 条**（每 URL 10 条 = 9 语 + x-default） |
| 分类                     | 未物理拆分，但逻辑完整覆盖                               |

**分类计数（真实）**：

| 类别                           | 数量      | 唯一页面 × 语言     |
| ---------------------------- | ------- | ------------- |
| guides                       | 486     | 54 × 9        |
| audit-guide                  | 315     | 35 × 9        |
| industry                     | 198     | 22 × 9        |
| services                     | 126     | 14 × 9        |
| suppliers                    | **90**  | **10 × 9** ⚠️ |
| tools                        | 81      | 9 × 9         |
| industrial-clusters          | 81      | 9 × 9         |
| chemicals                    | 63      | 7 × 9         |
| countries                    | 54      | 6 × 9         |
| case-studies / field-reports | 45 / 45 | 5 × 9         |
| 其余单页（about/rfq/pricing/…）    | 各 9     | 各 1 × 9       |
| 首页                           | 9       | 1 × 9         |

**结论与建议**：

- 当前 sitemap **完全合规**，`lastmod/changefreq/priority` 齐全，hreflang 完整。
- **不需要 sitemap index**（单文件 1755 条远未触限）。指令 §4.2 要求的"sitemap index"属**过度设计**，除非未来 URL 数 > 50000 或需按类型分别提交。
- **真正的 sitemap 缺口已在上轮修复**：`/verify-supplier` 已补入（9 条）。
- **`/supplier-assessment` 不在 sitemap（正确）**，但它是 `index, follow`——**矛盾点**，见 §7。

---

## 7. 索引状态检查（§3.6）

无法直连 GSC，以下为**从代码与线上行为反推**的可确证项：

| 检查项                | 结论                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 意外 noindex         | ✅ **无**。私有页（`/account`、`/login`、`/register`、`/order`、`/checkout/*`、`/supplier-dashboard`）均为 `noindex` ✅                                                                                                          |
| canonical 指向错误 URL | ✅ **无**。35 模板全部自指正确                                                                                                                                                                                              |
| 重定向链 > 1 跳         | ✅ **无**。全部 308 单跳：`/membership→/pricing`、`/sample-report→/standard-report`、`/inspectors→/resources`、`/knowledge→/services/supplier-improvement`、`/country/{c}→/countries/{c}`、`/supplier/{c}/{s}→/suppliers/{s}` |
| 404                | ✅ 正常返回 404 + `noindex`，无软 404                                                                                                                                                                                    |
| 真实 404（指令假设的 URL）  | ⚠️ 9 个，见 §2。**但它们不在 sitemap，也不会被内链指向** → 对索引无实际伤害                                                                                                                                                                |


**🔴 发现一个真实矛盾**：`/supplier-assessment` 是 `robots: index, follow`，但：
- 不在 sitemap
- 依赖登录态、读 `?supplier=` / `?email=` 参数
- 渲染方式为**动态（`private, no-cache`）**

→ 这是"**可索引但无提交 + 动态不可缓存 + 参数页**"，属于典型的 **"已发现-尚未编入索引"** 与 **Worker CPU 风险**双重来源。**建议 noindex**（决策点三）。

---

## 8. 结构化数据审计（§3.7）

| Schema | 指令要求位置 | 实测 | 结论 |
|---|---|---|---|
| Organization | 首页 | ✅ 首页，字段：name/url/logo/image/serviceType/slogan/description/areaServed(5国)/knowsAbout(9项)/contactPoint(email+语言) | ✅ 完整度**高**；**缺 `sameAs`**（无社交/外部档案链接） |
| WebSite + SearchAction | 首页 | ✅ | ⚠️ target `/suppliers?q=` 被 `Disallow: /*?` 屏蔽 |
| Service | 服务页 | ✅ 全部服务页（supplier-verification / inspection / china-factory-audit / monitoring / custom-services / rfq）+ 国家页 | ✅ |
| FAQPage | 服务页/工具页/国家页 | ✅ 服务页全有；国家页有；工具页**部分**（risk-calculator 有，`/tools/compare` **无**） | ⚠️ 有缺口 |
| BreadcrumbList | 所有内页 | ✅ 指南/案例/审计指南/服务页有；**枢纽页（/guides、/industry、/countries、/tools）无** | ⚠️ 部分 |
| Article | 资源页 | ✅ 指南详情、案例研究、实地报告、标准报告、方法论 | ✅ |
| LocalBusiness | 供应商详情 | ❌ 未使用（用的是 Organization + WebPage + PostalAddress） | 见下决策 |
| Product / Offer | 定价页 | ✅ `/pricing`、服务页、工具页有 **Offer**；**无 Product** | ⚠️ 可选 |
| HowTo | 工具页 | ❌ **全站 0 处** | ❌ 缺口 |
| Review / AggregateRating | 如有 | ❌ 无 | ✅ 正确（无真实评价就该没有） |

**JSON-LD 解析：全站 35/35 无 `PARSE_ERROR`**，说明结构化数据**语法有效**。

> **关于 LocalBusiness**：指令 §5.2 要求供应商详情页用 LocalBusiness。**我建议不要加**——该页展示的是**第三方供应商**的信息，而 LocalBusiness 语义是"**本页的经营者**的实体场所"。给别人的工厂挂 LocalBusiness 会造成实体混淆（可能触发 Google 结构化数据政策问题）。现有 `Organization + PostalAddress` 是更保守正确的选择。**决策点四。**

---

## 9. 多语言检查（§3.8）

| 检查项 | 结论 | 证据 |
|---|---|---|
| URL 结构 | ✅ 子目录，en 无前缀 | `/` vs `/zh` |
| hreflang 完整 | ✅ **10 条**（9 语 + x-default） | 35 模板 100% 覆盖 |
| hreflang 双向互指 | ✅ 由 `i18n/hreflang.ts` 单一函数生成，结构上必然互指 | 源码 |
| x-default | ✅ **存在**（35/35） | 指向 en |
| 与 canonical 一致 | ✅ 已验证语言页：`/zh/guides/…` canonical 带 `/zh/` 前缀 | 实测 |
| 每语言独立 title/meta | ✅ | `/zh` title `找到可靠供应商…`、`/ar` title 阿拉伯文 |
| 语言切换可爬取 | ✅ 为 `<a href>` | 源码 |
| 多语言 sitemap | ✅ 单 sitemap 内 per-URL hreflang | 17550 条 |

**⚠️ 发现的多语言问题**（内容层，非技术层）：

| 页面 | 问题 | 数值 |
|---|---|---|
| `/zh` | 首页中文版正文**显著薄于英文** | 2543 vs 7368 字符 |
| `/zh/services/supplier-verification` | 正文**极薄** | **1536 字符**（全站最低区） |
| `/zh/guides/china-factory-audit-cost` | desc 仅 62 字符 | 偏短 |

→ 中文版（你的主要目标市场之一）**内容密度不足**，是"曝光少"的可能因素。

---

## 10. 性能与移动端（§3.9）

**无法运行 PSI/Lighthouse**（本机无 key）。用 TTFB 中位数（3 次）作代理：

| 页面 | TTFB 中位数 | 缓存状态 | 判定 |
|---|---|---|---|
| `/` | 317 ms | HIT（预渲染） | ✅ |
| `/countries/china` | 306 ms | HIT | ✅ |
| `/tools/supplier-risk-calculator` | 303 ms | HIT | ✅ |
| `/rfq` | 277 ms | HIT | ✅ |
| **`/suppliers`** | **967 ms** | **MISS + `private, no-cache, no-store`** | 🔴 **3.2× 慢** |

**🔴 P0 性能发现**：全站 26 个受测页面中，**23 个是预渲染 `HIT`（TTFB ~300ms，静态资源不计入 Worker CPU）**，但**3 个是动态渲染（`private, no-cache, no-store`）**：

1. **`/suppliers`** — 供应商列表，967ms，**最慢页面**
2. **`/industrial-clusters`** — 产业集群
3. **`/supplier-assessment`** — 供应商自评（登录后）

**风险**：生产环境为 **Cloudflare Workers Free（CPU 限 10ms/请求）**。动态渲染页面每次请求都要执行 RSC 渲染 + Supabase 查询 → **极易触发 CPU 超限返回 5xx**。这与项目记忆记载的"线上 5xx 主因"完全吻合。`/suppliers` 是**流量入口页之一**，风险最高。

**移动端**：`viewport` = `width=device-width, initial-scale=1, maximum-scale=5` ✅（允许缩放，合规）。`theme-color` = `#0f4c81` ✅。移动端深度可用性（CTA 固定、表单可用性）**需真机/headless 验证**，本机无法执行 → 列入限制。

---

## 11. AI 可抓取性（§3.10）

| 检查项 | 结论 |
|---|---|
| GPTBot 抓取 | ❌ robots 屏蔽（有意策略） |
| ChatGPT-User / OAI-SearchBot | ✅ 允许 |
| PerplexityBot / PerplexityBot-User | ✅ 允许 |
| Claude-SearchBot / Claude-User | ✅ 允许 |
| ClaudeBot / anthropic-ai | ❌ robots 屏蔽（有意策略） |
| Google-Extended | ❌ robots 屏蔽（有意策略） |
| CCBot | ❌ robots 屏蔽（有意策略） |
| 服务器日志抓取状态码 | ❌ **无法获取**（限制） |
| `/llms.txt` | ✅ **存在且质量极高**（见下） |
| 核心内容以 HTML 呈现 | ✅ **全部预渲染，正文在初始 HTML** |
| Q&A 结构 | ✅ FAQPage 普遍存在；指南含 quickAnswer/definition/FAQ |
| 可验证事实 | ✅ 指南含具体日期（中秋 9/25-27）、CAS 号、标准名 |
| 清晰实体定义 | ✅ Organization + knowsAbout + areaServed + `verification status levels` |

**`/llms.txt` 实测内容**（加分项，质量超出一般站点）：
- 站点定位、核心服务、9 语清单、审计/认证项目清单（22 个）、覆盖 5 国
- **逐条列出关键 URL 与一句话说明**（含工具、指南、案例、行业、化工）
- **为 AI 明确标注**：`verification status levels: UNVERIFIED < IDENTITY_VERIFIED < DOCUMENT_VERIFIED < FACTORY_VERIFIED`
- 明确声明："SMETA、BSCI 等是第三方审核机构的审核，本平台不签发证书"
- 明确声明："风险评分仅供参考，不能替代官方第三方核验"

→ **这是全站对 AI 搜索最有力的资产之一**，已按 AEO/GEO 最佳实践撰写。

---

## 12. 信息架构与 UI（§3.11）

| 检查项 | 结论 |
|---|---|
| 首屏是否 5 秒说清 | ⚠️ 需人工判断；H1 为 `Find suppliers you can trust. Verify real capability.`（实体清晰） |
| 主导航 | 需人工核对（HTML 存在，结构未逐项验） |
| 页脚 | 存在（含语言/法律链接） |
| 面包屑 | ⚠️ **枢纽页（/guides、/industry、/countries、/tools）无 BreadcrumbList** |
| 内部链接网络 | ✅ 有 related 模块；但 **`/suppliers` 仅 10 个详情页** → 网络稀疏 |
| **空状态（Live Buyer Requests）** | 🔴 **确认存在**：首页渲染 `"No active buyer requests yet. New sourcing requests will appear here as buyers publish their requirements."` |
| 信任信号 | 有 `/case-studies`(5)、`/field-reports`(5)、`/standard-report`、`/methodology`、`/trust`；**但案例与实地报告均明确标注"illustrative / anonymised，非客户评价"** |
| 定价透明度 | ✅ `/pricing` 有 Offer schema + 具体 USD 价 |
| RFQ 路径 | ✅ `/rfq` + `/factory-audit/request` + `/custom-services` |
| 供应商详情页模板一致性 | ✅ 统一模板（Org+WebPage+FAQ+PostalAddress） |
| 国家页模板一致性 | ✅ 5 国统一 |
| 服务页模板一致性 | ✅ 统一 |
| 工具页模板一致性 | ⚠️ 9 个工具页 schema 不完全一致（部分缺 FAQ/Offer） |
| 多语言切换体验 | 需人工验 |
| **`/about` vs `/trust` 重复** | 🔴 **两个"关于"页面**，均 index：`/about`("About Us — Supplier Verification, Training & Trust")、`/trust`("About FactoryAuditB2B")。语义重叠，**主题自相蚕食（cannibalization）** |

---

## 13. 商业化差距（§3.12）

| 项 | 现状 | 差距 |
|---|---|---|
| 需求侧真实采购需求 | 首页"Live Buyer Requests"**空** | 🔴 冷启动暴露给所有访客 |
| 供应商侧变现 | `/pricing` 有 Founding Buyer $99/年；`/join-supplier-network` 免费入驻 | 无订阅自动化闭环（已知） |
| 定价透明 | ✅ USD 报价区间 + Offer schema | 基本达标 |
| 社会证明 | ⚠️ 案例/报告**均为 illustrative，明确非客户评价** | 🔴 **无真实客户背书**（诚实但显得单薄） |
| 团队资质 | `/trust` 提及运营主体 Jiangmen Zhiyu Technology | ⚠️ 无资质/团队详情 |
| 信任信号 | 隐私政策、方法论、标准报告样本 | ⚠️ 缺响应时间承诺、退款/保障说明 |
| **供应商库规模** | 🔴 **仅 10 家**（`/suppliers` 90 条 ÷ 9 语） | 🔴 **最根本的冷启动瓶颈** |

---

## 14. 优先级清单

### P0（阻断索引/流量的根因）
1. **`/suppliers` 动态渲染 + 967ms + `no-cache`** → CF Workers Free CPU 10ms 下极易 5xx。**必须改为预渲染或加边缘缓存**。
2. **`/industrial-clusters` 同样动态** → 同上。
3. **首页 "Live Buyer Requests" 空状态** → 冷启动暴露，替换为有效内容。
4. **供应商库仅 10 家** → 索引规模上限被卡死（内容层，非代码）。

### P1（影响索引质量与点击率）
5. **title 过长**（实测 >60 字符）：`/guides/what-is-quality-management-system`(99)、`/field-reports`(87)、`/monitoring`(82)、`/pricing`(80)、`/chemicals`(79)、`/services`(78)、`/suppliers`(77)、`/`(76)、`/services/inspection`(76)、`/logistics`(73)、`/case-studies`(72)、`/standard-report`(72)
6. **desc 过长**：`/tools/supplier-risk-calculator`(218)、`/services/supplier-verification`(211)、`/logistics`(166) — **这 3 页绕过了 `buildPageMetadata` 的 `trimMetaDescription` 收口**
7. **desc 过短**：`/terms`(51)、`/suppliers`(51)、`/zh`(40)、`/zh/services/supplier-verification`(56)
8. **`/supplier-assessment` 应 noindex**（index,follow + 动态 + 参数页 + 未提交 sitemap）
9. **中文版内容过薄**（`/zh` 2543、`/zh/services/supplier-verification` 1536 字符）
10. **`/about` 与 `/trust` 合并**（主题蚕食）
11. **薄内容页**：`/rfq`(1878)、`/industry`(2369)、`/tools`(2791)、`/zh`(2543)

### P2（优化项）
12. `/audit-guide/*/{SMETA,BSCI,ICTI,BRC,HACCP,FSSC22000,RBA}` **大写 URL slug**（315 页，大小写敏感、分享/输入不便）
13. `/tools/compare` 缺 FAQPage；全站缺 HowTo；枢纽页缺 BreadcrumbList
14. Organization 缺 `sameAs`
15. robots.txt `Disallow: /*?` 与 SearchAction `/suppliers?q=` 冲突
16. `/logistics` 缺 `twitter:image`

---

## 15. 风险清单与回滚方案

| 风险 | 影响 | 回滚 |
|---|---|---|
| 改 `lib/pageMeta.ts` 影响全站 metadata | 高（全站） | `git checkout -- lib/pageMeta.ts` |
| 改 `/suppliers` 渲染策略可能触发构建/数据固化 | 高 | 保留旧产物目录隔离（本机已验证可行） |
| 改 robots.txt 开放训练爬虫 | 中（内容被抓取） | 回滚 robots.txt 单文件，秒级生效 |
| 改 title/desc 影响已索引页面点击率 | 中 | 单文件回滚 + 重新构建部署 |
| 本机 `spawnSync` 恒 EBUSY + 构建需 `FAB2B_DISABLE_BUILD_TRACE=1` | 高（发布链路） | 已掌握绕法（shell 循环 + 七步手动），见项目记忆 |

**每次改动必须走**：`next build`（带 `FAB2B_DISABLE_BUILD_TRACE=1` + `NODE_OPTIONS=""`）→ `opennext build` → shell 循环 populate → scrub → verify → `wrangler deploy`。

---

## 16. 待确认决策点（进入阶段 1 前必须回答）

| # | 决策点 | 选项 |
|---|---|---|
| **1** | **URL 映射**：指令里的 `/supplier-verification/china`、`/factory-audit`、`/third-party-inspection`、`/sourcing`、`/tools/audit-scope-recommender` **在线上不存在**。后续所有改造是否以**真实路由**为准？ | (a) 以真实路由为准（推荐）(b) 你另有意图，要新建这些 URL（需 301/新建页面） |
| **2** | **AI 爬虫策略**：robots.txt 现**屏蔽 GPTBot/ClaudeBot/Google-Extended/CCBot**，只放行检索型。是否按指令改为**全部开放**？ | (a) 维持现状（保护内容，仍可被引用；推荐）(b) 全部开放 (c) 逐个讨论 |
| **3** | **`/supplier-assessment` 是否 noindex**？ | (a) noindex（推荐）(b) 保持 index 并补入 sitemap |
| **4** | **供应商详情页是否加 LocalBusiness**？ | (a) 不加，维持 Organization（推荐，语义正确）(b) 按要求加 |
| **5** | **`/about` 与 `/trust` 是否合并**？（不改 URL 的前提下只能二选一保留并 301） | (a) 合并并 301 (b) 保持两个，差异化定位 |
| **6** | **P0 的 `/suppliers` 动态渲染**：是否批准改为预渲染/边缘缓存？（这是唯一需要动业务代码的 P0） | (a) 批准 (b) 先只做 P1 元数据类修复 |
| **7** | **GSC 数据**：能否导出"已发现-尚未编入索引""元描述过长 610/482""title 过长 553"的**具体 URL 列表**？有列表我做精确对账，没有我只能按代码侧扫描 | — |

---

## 17. 阶段 1 建议范围（待你确认后执行）

若你确认上面的决策点，我建议阶段 1 **只做"零风险、纯元数据"的 P1 修复**（不动渲染架构）：

1. 修 3 个 desc 过长页（绕过收口的问题）→ 让它们也走 `trimMetaDescription`
2. 修 4 个 desc 过短页
3. 收口 title 过长（按像素预算裁剪，**保留 `| FactoryAuditB2B` 品牌后缀优先**）
4. `/supplier-assessment` noindex（如决策点 3 选 a）
5. 补 `/tools/compare` FAQPage

**P0 的 `/suppliers` 渲染改造单独作为阶段 1.5**，因为它需要动渲染架构 + 完整构建部署链路，风险等级不同。

---

**阶段 0 结束。未改动任何代码。等待你的确认与决策点回答后，再进入阶段 1。**
