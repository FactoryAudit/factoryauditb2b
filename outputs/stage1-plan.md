# 阶段 1 改造计划（元数据修复）— 待确认

> 项目：factoryauditb2b.com ｜ 工作区 `F:\AI-验厂SEO网站`  
> 状态：**计划稿，未改任何代码**。执行前请逐条确认文末的 7 个决策点。  
> 证据口径：本地工作树源码 + 线上实测（2026-09-29）。本机可正常出网（`/suppliers` HTTP 200，TTFB 3.58s）。

---

## 0. 执行前必须知道的 8 条事实（会改变修法）

### F1 线上站落后于工作树

`git status` 显示以下文件是 `M`（已改、**未构建未部署**）：

```
M CS22C-ACCEPTANCE.md            M app/[locale]/verify-supplier/page.tsx
M app/[locale]/factory-audit/request/page.tsx   M app/sitemap.ts
M app/[locale]/services/[slug]/page.tsx         M i18n/config.ts
M app/[locale]/supplier-assessment/page.tsx     M lib/guides.ts
M lib/organizationSchema.ts      M lib/pageMeta.ts
M scripts/.sitemap-cache.txt
```

⇒ 阶段 0 报告里那些"线上数字"，**不代表当前源码**。本计划的全部改动都基于工作树，并且**回滚不能用 `git checkout --`**（会毁掉这批未提交改动，见 D6）。

### F2 「desc 过短」的根因是收口函数的收尾规则，不是源头文案短

`lib/pageMeta.ts: trimMetaDescription()` 超预算时，取**预算内最后一个句末标点**（规则①）。实测对照：

| 页面                                   | 源头 desc 长度 | 收口后输出   | 结论                                 |
| ------------------------------------ | ---------- | ------- | ---------------------------------- |
| `/terms`                             | 168        | **51**  | 与审计一致 —— 第一句本身只有 51 字，整段被砍成第一句     |
| `/suppliers`                         | 219        | **51**  | 同上                                 |
| `/logistics`                         | 166        | **82**  | 第一句 82 字                           |
| `/services/supplier-verification`    | 211        | 139     | 达标                                 |
| `/tools/supplier-risk-calculator`    | 218        | **155** | **只要改走 `buildPageMetadata` 就自动达标** |
| `/about`（审计未列）                       | 268        | 91      | 第一句 91 字                           |
| `/zh`（CJK 预算 90，未截断）                 | 40         | 40      | 源头就短                               |
| `/zh/services/supplier-verification` | 56         | 56      | 源头就短                               |

⇒ **任务 2 的正确修法是重写源头文案，让第一句自己就落在 120–155（中文 60–75 汉字），而不是去改 `trimMetaDescription`。** 改收尾策略会同时改变全站所有超长 desc 的输出（`/guides` 一族、`/industry` 一族全部受影响），回归面远超本阶段预算。

### F3 「补全站 title 闸门」的冲击面是 12 页的 34 倍

实测 `lib/guides.ts` 的 53 篇指南：**46 篇（87%）** 的 `titleEn + " | FactoryAuditB2B"` 超过 60 字符，最长 102 字符。

```
102 Supplier Quality Audit Checklist: The Quality Dimension Beyond a Basic Factory Audit
 99 What Is a Quality Management System (QMS): The Operating System of a Manufacturer
 98 How to Compare Chinese Suppliers: A Practical Supplier Risk Assessment Framework
 98 China Plus One Supplier Qualification: How to Vet Vietnam and Thailand Factories
 95 Factory Audit Timing Around China's 2026 Mid-Autumn and National Day Holidays
 ...
```

一个"裁剪到 60"的全站硬闸门，会**自动改写 46 × 9 语 = 414 条 URL 的 SERP 标题**，且在词边界截断后不少会读起来像半句话。⇒ 见 **D1**。

### F4 CJK 不适用「50–60 字符」预算

zh 标题现为 31–42 字符（≈60–70 半角宽），按汉字宽约 2 倍算**本身合规**。若对中文套用 50–60，会把 `/zh` 标题撑到被截断。⇒ 闸门必须按书写系统分预算，与 `trimMetaDescription` 同思路（CJK 约 34 字符总长）。

### F5 任务 5（compare FAQ）会击穿构建闸门，且同步面是 20 个文件不是 13 个

`t.compare` 当前**没有** `faq` 键。新增 5 条 FAQ ⇒ en 字典叶子数 `3114 → 3124`  
（`verify-opennext-bundle.mjs` 的计数器把数组元素也递归计入，`{q,a}` 各计 1 叶 ⇒ +10）。

`3114` 常量实际出现在 **20 个文件**：

```
scripts/cs06a-directory-regression.ts      scripts/cs13b-cluster-directory-regression.ts
scripts/cs08-form-regression.ts            scripts/cs16-supplier-mgmt-regression.ts
scripts/cs12-profile-regression.ts         scripts/cs17-commerce-regression.ts
scripts/cs13-supplier-seo-regression.ts    scripts/cs20-supplier-report.ts
scripts/cs22a-public-profile-regression.ts scripts/cs22b-self-assessment-regression.ts
scripts/step13b-i18n-gates.cjs             scripts/verify-opennext-bundle.mjs
scripts/apply-cs22b-i18n.cjs
+ 7 个 .bundle.cjs（cs06a/cs12/cs13/cs13b/cs16/cs22a/cs22b）
```

好消息：`scripts/apply-cs22b-i18n.cjs:597` 已有现成的"批量同步叶子数常量"逻辑可复用。⇒ 见 **D2**。

### F6 任务 7 已经实现了 —— 无需改代码

`lib/organizationSchema.ts:92-94`：

```ts
...(activeSocialLinks().length > 0
  ? { sameAs: activeSocialLinks().map((s) => s.url) }
  : {}),
```

`lib/social.ts:15-17` 里 facebook / youtube / linkedin **三个 URL 都是空串**，所以 `sameAs` 被整段剔除。这就是审计看到"缺 sameAs"的原因 —— **不是代码缺失，是没有真实账号**。按您"没有真实账号就跳过、不要造假"的要求：**任务 7 不做，零代码改动**。若您给真实主页 URL，只需填 `lib/social.ts` 三行即可自动生效。⇒ 见 **D4**。

### F7 无机器翻译

`.env`：`DEEPSEEK_API_KEY=""`。所有新增/改写文案的 9 语版本必须**手工撰写**。

### F8 任务 6 会打断 4 个运维巡检脚本

`/about` 出现在这些脚本的巡检清单里，301 之后它们会报非 200：

```
scripts/seo-live-probe.mjs:49     scripts/smoke-routes.sh:50
scripts/monitor-site.cjs:22       scripts/_seo_links.mjs:13
```

⇒ 必须同步改成 `/trust`，否则阶段 5 的监控基线一开始就是红的。

---

## 1. 逐任务计划

### 任务 1 ｜desc 过长 3 页改走统一收口

**目标**：3 页 desc 从 218/211/166 → 落在 120–160。

**改动文件**

| 文件                                                     | 行     | 改动点                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/[locale]/tools/supplier-risk-calculator/page.tsx` | 14–25 | `generateMetadata` 改为 `buildPageMetadata({ locale, path: "/tools/supplier-risk-calculator", title: t.risk.page.metaTitle + " \| FactoryAuditB2B RiskScore™", description: t.risk.page.metaDesc })`；删手写 `openGraph`（收口已含 OG/Twitter） |
| `app/[locale]/services/supplier-verification/page.tsx` | 12–26 | 同上，`path: "/services/supplier-verification"`                                                                                                                                                                                        |
| `app/[locale]/logistics/page.tsx`                      | 13–27 | 同上，`path: "/logistics"`；标题串改为 `buildPageMetadata` 传 `t.container.page.metaTitle`（品牌自动追加）                                                                                                                                            |

**预期结果**

- `/tools/supplier-risk-calculator`：218 → **155** ✓（无需改文案）
- `/services/supplier-verification`：211 → **139** ✓
- `/logistics`：166 → **82** ✗ ⇒ **必须同时重写 `t.container.page.metaDesc` 的 9 语版本**（第一句 ≥120 拉丁 / ≥60 汉字），并把 `metaTitle` 从 55 压到 ≤42（否则品牌后 73 > 60）

**验证**：本地 `next build` 后读 `.next/server/app/logistics.html`（或起 dev 抓 HTML）提取 `<meta name="description">` 实测长度。

**回滚**：`cp <file>.bak <file>`（三个文件都有未提交改动，不用 `git checkout`）。

**风险**：

- 走 `buildPageMetadata` 会**新增 twitter card 与 robots 默认值**（原本这 3 页没有）—— 属于增强，不是回退。
- `logistics` 若不同步改 dict，验收标准 1 会**直接不过**。

---

### 任务 2 ｜desc 过短 4 页（改源头文案）

**目标**：第一句本身就落在 120–155 拉丁 / 60–75 汉字。

**根因**：见 F2。**不改 `trimMetaDescription`**。

**改动文件**：`i18n/dictionaries/{en,zh,zh-TW,ja,es,de,fr,pt,ar}.json` —— **只改值，不加删键**（⇒ 不影响 3114 闸门）。

| 字典键                            | 当前问题                     | 目标                              |
| ------------------------------ | ------------------------ | ------------------------------- |
| `legal.termsIntro`             | en 168 → 收口成 51          | 重写成第一句 130–150                  |
| `suppliers.metaDesc`           | en 219 → 收口成 51          | 重写成第一句 130–150                  |
| `home.lead`                    | zh 40 / zh-TW 47 / ja 62 | 补到 60–75 汉字（zh、zh-TW）、ja ≥60 全角 |
| `serviceVerification.metaDesc` | zh 56 / zh-TW 56         | 补到 60–75 汉字                     |
| `container.page.metaDesc`      | 见任务 1                    | 第一句 ≥120                        |
| `container.page.metaTitle`     | en 55 → 含品牌 73           | ≤42                             |

**顺带发现（超出您给的 4 页，见 D7）**：`/about` 源头 268 → 91；`/es` 首页 176 → 106。

**验证**：改后跑 `node _stage1_meta_measure.cjs`（本阶段新建的只读探针，保留复用）核对每语种长度，再构建后抓 HTML 复测收口结果。

**回滚**：`cp i18n/dictionaries/*.json.bak i18n/dictionaries/`（字典无未提交改动，也可以用 `git checkout -- i18n/dictionaries/`）。

**风险**：

- 改值是内容改动，**会改变 SERP 摘要**。9 语手工写，无机器翻译兜底（F7）。
- 需逐语种核对：拉丁语种若写超 158，仍会被收口，务必写"第一句就在预算内"的句式。

---

### 任务 3 ｜title 过长（**本任务拆成 3A/3B/3C，需先定范围**）

**3A 统一闸门**：在 `lib/pageMeta.ts` 新增 `trimMetaTitle()`，并在 `buildPageMetadata` 内对 `finalTitle` 收口。

设计要点（与 `trimMetaDescription` 同构）：

- **品牌后缀优先保留**：`" | FactoryAuditB2B"` = 18 字符。先算描述段预算 = 总预算 − 18，再裁描述段。
- **按书写系统分预算**（F4）：拉丁总长 **60**（描述段 42）；CJK 总长 **34**（描述段 16）。
- 裁剪顺序：① 破折号/冒号/竖线等**分隔符**处断句（比词边界更自然）→ ② 词边界 → ③ 剥悬空标点（复用 `DANGLING_TAIL_RE`）。
- 已经含 `FactoryAuditB2B` 的 title（如 `Supplier Risk Calculator | FactoryAuditB2B RiskScore™`）沿用现有去重逻辑，不重复追加。
- **幂等**：合规 title 原样返回。

**3B 12 页源头手写短标题**（不改闸门也能达标）

| 页面                                          | 源头值                           | 含品牌 | 描述段预算 42 |
| ------------------------------------------- | ----------------------------- | --- | -------- |
| `/`                                         | `home.h1` 64                  | 76  | → 42     |
| `/suppliers`                                | `suppliers.metaTitle` 65      | 77  | → 42     |
| `/services`                                 | `servicesIndex.metaTitle` 66  | 78  | → 42     |
| `/services/inspection`                      | `inspection.metaTitle` 64     | 76  | → 42     |
| `/case-studies`                             | `caseStudies.metaTitle` 60    | 72  | → 42     |
| `/standard-report`                          | `standardReport.metaTitle` 60 | 72  | → 42     |
| `/pricing`                                  | `pricing.metaTitle` 68        | 80  | → 42     |
| `/monitoring`                               | `monitoring.metaTitle` 70     | 82  | → 42     |
| `/chemicals`                                | `chemicals.metaTitle` 67      | 79  | → 42     |
| `/field-reports`                            | `fieldReports.metaTitle` 75   | 87  | → 42     |
| `/logistics`                                | 硬编码 55                        | 73  | → 42     |
| `/guides/what-is-quality-management-system` | `titleEn` 81                  | 99  | → 42     |

**3C 其余 45 篇 guides**：是否一并重写，**取决于 D1**。

**改动文件**：`lib/pageMeta.ts`、`i18n/dictionaries/*.json`（10 个 metaTitle 键值 × 9 语）、`app/[locale]/logistics/page.tsx`、`lib/guides.ts`。

**验证**：新建只读探针扫描全部页面源码/构建产物，断言 `title` 长度分布与闸门一致；抽查 10 页线上 HTML。

**回滚**：`lib/pageMeta.ts` 用 `.bak`（该文件已是 `M`）；字典用 `git checkout --`。

**风险**：

- **这是本阶段唯一"会改 SERP 主标题"的任务**，影响面是全站所有页面。务必先定 D1。
- 缩短英文标题会丢长尾修饰词，可能影响既有排名 —— 建议保留一个完整语义主干 + 一个差异化词，而不是机械截断。

---

### 任务 4 ｜`/supplier-assessment` 加 noindex

**改动文件**：`app/[locale]/supplier-assessment/page.tsx:23-33`

**改动点**：把 `generateMetadata` 改为走 `buildPageMetadata` 并传 `robots: { index: false, follow: false }`  
（title `"Factory Self-Assessment | FactoryAuditB2B"` 已含品牌 ⇒ 去重逻辑生效，不会双后缀；desc 118 ✓）。

**验证**：构建后抓 HTML 断言 `<meta name="robots" content="noindex, nofollow">`。

**回滚**：`cp` `.bak` 恢复（该文件已是 `M`，且是 CS-22 在制品，**绝不能用 `git checkout`**）。

**风险**：`scripts/cs22b-self-assessment-regression.ts` 会遍历该页源码，但**没有 robots 断言**（已 grep 确认），不会假 FAIL。若加了新断言需先确认在旧代码上会 FAIL（铁律）。

---

### 任务 5 ｜`/tools/compare` 补 FAQPage（**有构建闸门成本**）

**改动文件**

| 文件                                    | 改动点                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `i18n/dictionaries/*.json` × 9        | `compare` 下**新增** `faq: [{ q, a } × 5]`                                                     |
| `app/[locale]/tools/compare/page.tsx` | `jsonLd` 由单对象改数组：`[WebApplication, BreadcrumbList, FAQPage]`；正文加 FAQ 区块（复用 `t.compare.faq`） |
| 20 个脚本（见 F5）                          | `3114 → 3124`                                                                               |

**FAQ 内容方向**（按您指定，9 语手工）：如何对比供应商 / 对比维度有哪些 / 对比结果怎么用 / 数据从哪来 / 是否免费。

**验证**：`next build` → `verify-opennext-bundle.mjs` 叶子数 PASS → Rich Results Test 用提取出的 JSON-LD 片段离线校验（`FAQPage` 必填 `mainEntity[].name` + `acceptedAnswer.text`）。

**回滚**：删 `compare.faq` + `git checkout -- app/[locale]/tools/compare/page.tsx` + 常量回退 3114。

**风险**：

- en 叶子数闸门（F5）—— 20 个文件必须同步，漏一个就 `verify` FAIL。
- `compare` 的 h1/lead 已在用，再塞 FAQ 正文会改变页面结构 ⇒ 属于"结构性"改动，请确认是否仍在"纯元数据"范围内（见 D2）。

---

### 任务 6 ｜`/about` 合并进 `/trust`（**改动最大，含 301**）

**6.1 内容合并**

- `/about` 独有内容 = `dict.about` 的 3 段：`stats`（4 个数字卡）、`story`（Who we are）、`values`（4 张价值卡）。
- `/trust` 目前读 `lib/aboutContent.ts` 的 `ABOUT`，**没有这 3 段**。
- 方案：在 `lib/aboutContent.ts` 增 `stats / story / values` 三块（en/zh 双语，沿用 `pickZhCopy` 口径），`/trust` 渲染；`dict.about` 保留不删。

> 🔴 **事实性声称必须先核实**：4 个数字为 `5 Countries covered / 12 Industry sectors / 20+ Audit & compliance programs / < 1 day Typical response time`。  
> 5 国 ✓（`lib/coverage.ts`）。另 3 项我要在执行时逐条对着代码/数据核验；核不实的**不搬运**（铁律：禁无据声称）。

**6.2 301 重定向** — `next.config.mjs` 的 `redirects()`（现 118–142 行）新增两条：

```js
{ source: "/about", destination: "/trust", permanent: true },
{ source: "/:locale/about", destination: "/:locale/trust", permanent: true },
```

**6.3 站内链接**：`components/SiteFooter.tsx:213` 的 `p("/about")` → `p("/trust")`，文案由 `dict.about` 换 `dict.trustCenter`（`t.footer.trustCenter`，键已存在）。

**6.4 sitemap**：`app/sitemap.ts:31`（`core` 数组）与 `:122`（priority 白名单）移除 `/about`。

**6.5 运维脚本**：4 个文件的 `/about` → `/trust`（见 F8）。


**6.6 是否删除 `app/[locale]/about/page.tsx`** —— 见 **D3**。默认**保留文件不删**（可回滚、符合"不删内容"约束）；`redirects()` 优先级高于 page，308 会先生效。

**验证**：
- 本地 `curl -I http://localhost:3000/about` → `308` 且 `location: /trust`；
- 全站内链扫描无 `/about` 残留（grep + 抓首页 HTML）；
- `/about` 出现在 sitemap 中的次数 = 0。

**回滚**：`.bak` 恢复 `next.config.mjs` / `SiteFooter.tsx` / `sitemap.ts`，并删掉 `lib/aboutContent.ts` 新增块。

**风险**：
- **`/about` 是已有排名的页面**，301 到 `/trust` 会把权重转过去（这是目的），但 `/trust` 当前 metaTitle 只有 21 字符（含品牌 33），**偏薄**，合并后需同步重写 `/trust` 的 title/desc。
- Next `redirects()` 改动会**触发 webpack 持久缓存失效 + 冷编译 >16min**（项目铁律）。本阶段构建时间要按 20min+ 计。

---

### 任务 7 ｜Organization `sameAs` —— **已实现，不做**

见 F5。零代码改动。若您提供真实主页 URL，改 `lib/social.ts:15-17` 三行即可（`sameAs` 自动出现）。

---

### 任务 8 ｜robots.txt 自相矛盾

**改动文件**：`app/robots.ts:60`

**修法 A（推荐，最小侵入）**：保留目录级屏蔽，改为"参数级屏蔽 + 例外放行"：

```ts
const DISALLOW_PATHS = ["/api", "/admin", "/staging", "/*?"];
const ALLOW_EXCEPTIONS = ["/suppliers?q=", "/suppliers?page=", "/?q="];
// ALLOWED_BOTS / "*" 两组规则改为 { allow: ["/", ...ALLOW_EXCEPTIONS], disallow: DISALLOW_PATHS }
```

robots 规范下，同一 UA 同时命中 Allow 与 Disallow 时按**最长匹配胜出**，所以 `Allow: /suppliers?q=`（更长）会盖过 `Disallow: /*?`。

**为什么这样改是安全的**：`/suppliers` 的 `generateMetadata` 已对过滤态输出 `robots: index:false, follow:true`（`app/[locale]/suppliers/page.tsx:36-40`）。
⇒ 允许抓取 ≠ 允许索引：爬虫能抓到 `noindex` 才能把该 URL 从索引里摘掉。这正是本任务的语义目标。

**修法 B**：移除 `/*?`，改为按具体参数名屏蔽（`/*?utm_`、`/*?ref=` 等）。缺点：本项目带参 URL 只有 `/suppliers?country|industry|q`，覆盖面小但更啰嗦。

**🔴 关键不确定性**：`app/robots.ts:5-10` 的注释明确写着 —— **线上 robots.txt = Cloudflare 托管段（在前）+ 本文件产出（在后）**。托管段我改不了。因此本改动**必须上线后实测** `/robots.txt` 的实际合并文本，确认 `Allow` 例外未被托管段的 `Disallow` 抵消。

**验证**：线上 `curl https://factoryauditb2b.com/robots.txt`，断言 `/suppliers?q=` 的 Allow 存在，并用 GSC robots 测试工具验证 `/suppliers?q=abc` 可抓取。

**回滚**：`.bak` 恢复 `app/robots.ts`。

---

### 任务 9 ｜4 个枢纽页补 BreadcrumbList

**改动文件**

| 文件 | 行 | 改动点 |
|---|---|---|
| `app/[locale]/guides/page.tsx` | 39–50 | `jsonLd` 单对象 → 数组 `[ItemList, BreadcrumbList]`，层级 `Home > Supplier Intelligence Guides` |
| `app/[locale]/industry/page.tsx` | 40–51 | 同上，`Home > Industries` |
| `app/[locale]/countries/page.tsx` | 35–46 | 同上，`Home > Where We Verify Suppliers` |
| `app/[locale]/tools/page.tsx` | 39–48 | 同上，`Home > Free Supplier & Factory Audit Tools` |

**名称全部取自已有字典键**（`t.common.ui.home` / `t.common.ui.guidesPageTitle` / `t.industryPage.breadcrumb` / `t.coverage.h1` / `t.toolsIndex.h1`）⇒ **不新增键，不触发 3114 闸门** ✓。

**参考实现**：`app/[locale]/trust/page.tsx:74-92`、`app/[locale]/about/page.tsx:48-56`（`JsonLd` 组件已支持数组）。

**URL 口径**：`item` 用 `${BASE}${localePath(locale, path)}`，与 `canonicalFor` 同源。

**验证**：构建后从 4 页 HTML 提取 JSON-LD 数组，断言存在 `BreadcrumbList`、`itemListElement` 长度 = 2、`position` 连续、`item` 均 200。

**回滚**：`git checkout -- app/[locale]/guides/page.tsx app/[locale]/industry/page.tsx app/[locale]/countries/page.tsx app/[locale]/tools/page.tsx`（这 4 个文件**没有**未提交改动，可以安全 checkout）。

**风险**：低。纯加法，不改渲染。

---

## 2. 推荐执行顺序与构建验收

```
① 任务 9（纯加法，零风险）           → 本地断言
② 任务 4（单页 noindex）             → 本地断言
③ 任务 1 + 任务 2（desc 双向修复）   → 探针实测每语种长度
④ 任务 3A + 3B（title 闸门 + 12 页） → 全站 title 长度分布断言
⑤ 任务 8（robots）                   → 本地 robots.txt 文本断言
⑥ 任务 6（/about 合并 + 301）        → 308 断言 + 内链扫描
⑦ 任务 5（compare FAQ + 叶子数同步） → 20 文件常量同步 + 叶子数 PASS
```

**构建链路**（本机 `spawnSync` 恒 EBUSY，`cf-release.cjs` 必挂 ⇒ 必须七步手动）：

```bash
export NODE_OPTIONS="" NEXT_TELEMETRY_DISABLED=1 FAB2B_DISABLE_BUILD_TRACE=1
node -e "require('fs').renameSync('.next','.next_prev_'+Date.now())"   # 先隔离，避开 safe-delete 护栏
node node_modules/next/dist/bin/next build
node node_modules/@opennextjs/cloudflare/dist/cli/index.js build
for i in $(seq 1 14); do node scripts/populate-static-assets-cache.cjs --worker --batch 250; done   # 见 DONE 止
node scripts/scrub-next-env.mjs
node scripts/verify-opennext-bundle.mjs      # 含 en 叶子数闸门
```

**回归**：`node scripts/run-regression.mjs <脚本> <ROOT_ENV>`（须先注入 `.env`，否则 cs03 假报 1 FAIL）。
本阶段涉及：`cs01-seo-foundation-regression`、`cs13-supplier-seo-regression`、`cs22b-self-assessment-regression`、`cs06a C8`（叶子数）。

**部署**：`node node_modules/wrangler/bin/wrangler.js deploy`（`OPEN_NEXT_DEPLOY=true` + 注 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`）——**需您放行**。

---

## 3. 待确认决策点（请逐条答复）

| # | 决策点 | 我的建议 |
|---|---|---|
| **D1** | **任务 3 的闸门范围**：<br>A. 全站硬闸门（60 总长）⇒ 46 篇 guides 被自动截断（414 条 URL 换标题）<br>B. 闸门设为宽松安全网（拉丁 65 / CJK 36），只把任务列出的 12 页手写改到 50–60<br>C. B + 额外重写全部 53 篇 guides 英文标题（内容工程，9 语手工） | **B**。A 的机械截断会把指南标题切成半句话，掉排名风险 > 收益；C 是内容工程，建议另开阶段 |
| **D2** | **任务 5 是否接受**：en 叶子数 3114→3124 + 同步 20 个脚本文件 + 在 `/tools/compare` 正文新增 FAQ 区块（超出"纯元数据"） | **接受**，但要您知道这会让本阶段从"纯元数据"越界到"结构性改动" |
| **D3** | **任务 6 细节**：① `app/[locale]/about/page.tsx` 保留还是删除？② `/about` 的 4 个统计数字如何核实（核不实就不搬）？ | ① 保留（可回滚）；② 我逐条核验，核不实的删掉不搬 |
| **D4** | **任务 7**：是否提供真实的 LinkedIn / YouTube / Facebook 主页 URL？ | 不提供 ⇒ 跳过（当前已是跳过状态） |
| **D5** | **任务 8 修法**：A（`Allow` 例外，靠最长匹配胜出）还是 B（按参数名逐个屏蔽）？是否要我在部署后实测线上 robots.txt 合并文本？ | **A + 部署后实测**（CF 托管段可能抵消，必须验） |
| **D6** | **回滚策略**：`lib/pageMeta.ts`、`app/sitemap.ts`、`lib/guides.ts`、`lib/organizationSchema.ts`、`app/[locale]/supplier-assessment/page.tsx` 等 **10 个文件已是未提交改动**。用 `git checkout --` 回滚会**一并毁掉这批在制品**。 | 本阶段改为**逐文件 `.bak` 备份 + 精确恢复**，先 `git add -A` 把在制品存成一次提交？还是保持现状用 `.bak`？ |
| **D7** | **超出清单的同类问题**是否一并修：`/about` desc 91、`/es` 首页 desc 106、`/trust` metaTitle 仅 21 字符 | 建议**只补 `/trust`**（任务 6 必然要动它），`/about` 随 301 消失，`/es` 留到后续 |

---

## 4. 本阶段已建的只读工具（复用，不删）

- `_stage1_meta_measure.cjs` —— 9 语 title/desc 长度实测表
- `_stage1_guides_titles.cjs` —— guides 标题长度分布统计

两者均为只读探针，构不成构建产物；执行完成后可删。
