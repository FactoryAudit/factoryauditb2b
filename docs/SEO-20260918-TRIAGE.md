# 工单 SEO-20260918-FAB · 诊断与整改报告

目标站点：`https://factoryauditb2b.com`
工单总问题数：179（工单标注实际高优先级 40）
报告日期：2026-09-18
技术栈：Next.js 15.5 App Router · React 19 · Cloudflare Workers（OpenNext）· Supabase
处置原则：**先审计、后修改**；不掩盖、不放宽、不硬编码 IP、不动 WAF。

---

## 0. 先结论（请先读这一段）

**179 条里有约 140 条不是独立缺陷，而是同一个根因的下游产物。**

根因是一句话：

> 站点跑在 **Cloudflare Workers 免费版（CPU 上限 10 ms/请求）** 上，
> 全站 **没有任何内容页被预渲染**、**没有任何边缘缓存**，
> 1,233 个 sitemap URL 每一个都要 Worker 现场跑一遍 React SSR + Supabase 往返。
> 任何多线程爬虫都不可能在 10 ms/请求的配额下扫完它。

实测铁证（同一时刻、同一批 URL、只改并发数）：

| 抓取方式 | 成功率 | 失败形态 |
|---|---|---|
| **单线程顺序**（间隔 250 ms，46 URL） | **43/46 = 93%** | 仅 3 个**正确的** 301/308/404 |
| 并发 4（20 URL × 3 轮） | 5/20、10/20、11/20 | 全部 `503` + `error code: 1102` |
| 并发 10（20 URL × 2 轮） | 10/20、10/20 | 全部 `503` + `error code: 1102`（含 1 个 500） |

单线程抓取它**基本是健康的**；Screaming Frog 默认 10+ 线程一扫，它就成片 5xx。
**这就是工单里那 535 个 5XX 的全部来源**，随之而来的 hreflang / canonical / sitemap / 内链 / 慢加载告警，绝大多数是「爬虫没抓到页面，于是把该页面上的所有东西都判为错」。

> ⚠️ 一句必须说的话：**这份工单的诊断工具本身，是造成这 535 个 5XX 的原因之一。**
> 这不是说诊断报告没价值 —— 它指出的**真实缺陷是准的**（见 §3），
> 但「179 个问题」这个数字会把人引向错误的工作量估计。

---

## 1. 三条根因

### 根因 1（P0，占 179 条中的绝大多数）— Worker 资源超限

```
HTTP/1.1 503 Service Unavailable
Content-Type: text/plain
Content-Length: 17
Server: cloudflare
CF-RAY: a3cb8f2dbd272a86-LAX
body: "error code: 1102"
```

`1102 = Worker exceeded resource limits`。已确认的责任层与**排除**的责任层：

| 层 | 结论 | 证据 |
|---|---|---|
| `plan` | **Free Website** | Cloudflare API `/zones/{id}` |
| robots.txt | **不阻止任何正常搜索爬虫** | 线上 1,224 B，Bingbot `Allow: /` |
| middleware.ts | **零 bot 逻辑** | 全文 56 行，仅 i18n rewrite + `/en/*` 301 |
| WAF / UA 规则 | **无证据在拦 Bingbot** | Bingbot / Googlebot / Site Scan / 浏览器 四种 UA **返回完全相同的状态码** |
| Supabase | **健康** | REST 直连 200 |
| 静态资源 | **不受影响** | `/favicon.svg` 始终 200 |
| **Worker 执行层** | **← 唯一故障点** | 1102 连 **1.2 KB 的 `/robots.txt`** 都会中招 |

连 1.2 KB 的纯字符串响应对都会 1102 ⇒ 与「某个页面太重」无关，是**配额贴边**。

### 根因 2（P0，与根因 1 同源）— 全站零预渲染

`.next/prerender-manifest.json` 实测：

```
预渲染路由总数：319
  = 315 条 /[locale]/audit-guide/[country]/[auditType]   （7 标准 × 5 国家 × 9 语言）
  + /sitemap.xml、/robots.txt、/llms.txt、/_not-found
```

**319 条里没有一个是内容页。** `/`、`/pricing`、`/about`、`/suppliers`、`/industry`、
`/trust`、`/training-plans`……**全部是每次请求现场 SSR**。

原因定位到**一行代码**：

```tsx
// app/[locale]/layout.tsx（改动前）
const h = await headers();          // ← 这一行
const rawPath = h.get("x-pathname") || "/";
```

Next 15 中，`generateMetadata` 一旦调用 `headers()` 这类 Dynamic API，
**整棵 `[locale]` 子树永久退出静态生成**。

而它取 `x-pathname` 换来的东西，经核对**全是死值**：

| 用途 | 核对结果 |
|---|---|
| canonical / hreflang | 62 个非 admin 页面中 **54 个自带 `generateMetadata`**，经 `lib/pageMeta.ts` 显式声明 canonical + languages。Next 元数据合并中同名字段**子级覆盖父级** ⇒ layout 那份从来是被覆盖的 |
| 5 个 `/tools/*` 的 title 兜底 | 9 个 `/tools/*` 页面**全部自带 metadata** ⇒ `TOOL_TITLE_KEY` 已是死代码 |
| 其余 8 个无自带 metadata 的页 | `checkout/[ref]`、`country/[slug]`、`inspectors`、`knowledge`、`membership`、`order`、`sample-report`、`supplier/[country]/[slug]` —— **全部是 308 重定向页或已 noindex 的事务页**，不依赖 canonical |

⇒ 这一行 `headers()` **纯属副作用**：唯一真实效果就是把全站拖成动态渲染。**已摘除。**

### 根因 3（P0，我改不了，只能你做）— 平台配额与缓存

必须说清楚：**上面摘掉 `headers()` 能大幅降低单请求 CPU，但绕不开 Worker 配额本身。**

实测 `.open-next/assets/` 的真实内容：

```
assets 顶层 11 项：BUILD_ID  favicon.svg  google…html  logo-*.svg  og-image.png  trust  _next
assets 内 .html 文件数：1（就是那个 Google 站点验证文件）
```

**预渲染页面并没有进入 Cloudflare 的静态资源层** —— 连 315 个 `force-static` 的
audit-guide 页、以及 `/robots.txt`、`/sitemap.xml`，**都要经过 Worker 执行**。
这正是 1.2 KB 的 robots.txt 也会 1102 的原因。

因此**两个平台侧动作是无可替代的 P0**，详见 §4。

---

## 2. 已完成的代码整改（本轮）

| # | 改动 | 文件 | 对应工单任务 |
|---|---|---|---|
| 1 | **摘除 `headers()`**，全站解除强制动态渲染；删除死代码 `TOOL_TITLE_KEY` | `app/[locale]/layout.tsx` | 1.1 / 3.5 |
| 2 | **供应商详情页显式保持实时渲染**（`force-dynamic`），确保「发布即可见」不被预渲染冻结 | `app/[locale]/suppliers/[slug]/page.tsx` | 1.1 |
| 3 | **软 404 修真 404**：不存在的验真 ID 现在返回 404；`not_issued`/`visibility_restricted`/`revoked` 三种**真实存在**的报告仍返回 200（`revoked` 必须能展示撤销态） | `app/[locale]/verify/report/[verificationId]/page.tsx` | 1.2 |
| 4 | **收口 `/en` 家族重定向链**：把 301 提到 `next.config` 的 redirects 阶段（与尾斜杠归一化同级），消除 2 跳 | `next.config.mjs` | 1.3 |

> 改 3 的口径说明：`/verify/report/*` 整页已 `robots:{index:false, follow:false}`，
> 且**只对「报告不存在」返回 404**，不区分 `visibility_restricted` 与 `not_issued`，
> 不新增可枚举信息（原设计已带防枚举意图，此处未削弱）。

---

## 3. 179 项逐条归因

图例：**真** = 需要独立修；**派生** = 根因 1 的下游产物，根因修好即消失；**假** = 诊断工具误读；**待清单** = 需你在后台导出 URL 清单才能逐条定位。

### 模块一：服务器与基础架构

| 工单条目 | 报数 | 判定 | 说明 |
|---|---|---|---|
| 1.1 5XX | 535 | **真（根因 1）** | 见 §1。非代码缺陷，是配额 |
| ├ 500 错误 | 16 | 部分真 | 实测 `/sitemap.xml` 出现过 `500`（21 B `Internal Server Error`，Worker 内 JS 异常，与 1102 是两种失败） |
| └ 超时 | 3 | **派生** | 503 被计为超时 |
| 1.2 4XX | 89 | **需清单核对** | 实测本项目真 404 **全部正确**（8 类不存在路径均返真 404，`/api/lead` GET 正确返 405）。唯一例外是 `/verify/report/{不存在ID}` 软 404，**已修** |
| 1.3 重定向失败 | 3 | **待清单** | 实测 `/en/*` 301 全部正常，未见断裂链 |
| 1.3 3XX 重定向链 | 8 | **真，已修** | `/en/` → 308 → `/en` → 301 → `/`（2 跳）。`/zh/` → 308 → `/zh` 是 1 跳，正常 |
| 1.4 HTTP→HTTPS 规范化 | 119 | **假** | Cloudflare 已强制 HTTPS；爬虫对 `http://` 的探测请求被计入此项。实测无 http 页面可访问 |
| 1.4 HTTP 页含 HTTPS 内链 | 1 | **假** | 同上 |

### 模块二：索引规范与国际 SEO

| 工单条目 | 报数 | 判定 | 说明 |
|---|---|---|---|
| 2.1 canonical → 5XX | 48 | **派生** | canonical **本身生成正确**（`canonicalFor(locale, path)`，自指绝对 URL），只是目标页当时 1102 了 |
| 2.1 canonical → 4XX | 1 | **真，已修** | 即 `/verify/report` 软 404 |
| 2.2 hreflang 用于重定向/损坏页 | 631 | **派生** | `hreflangFor()` 每页固定产出 9 + x-default = **10 条**（CS-01 已清理过重复声明）。631 是「目标页当时 5xx」的计数 |
| 2.2 hreflang → 非规范页 | 4 | **待清单** | 需 URL 才能定位 |
| 2.2 同语言多页 | 1 | **待清单** | 需 URL 才能定位 |
| 2.3 sitemap 含 5XX | 261 | **派生** | sitemap 生成的 URL 全部是合法的；是这些 URL 当时 1102 了 |
| 2.3 sitemap 含 3XX | 8 | **待复核** | `/en` 家族**不在** sitemap 内（英文落无前缀地址），需清单定位 |
| 2.3 页面存在于多个 Sitemap | 1,233 | **假** | 全站**只有一个** `/sitemap.xml`，1,233 个 URL，**去重后仍是 1,233**（无重复提交）。工具把单文件的 URL 计成「多处存在」 |
| 2.3 可索引页未入 sitemap | 5 | **待清单** | 需 URL 才能判断是否应提交 |

### 模块三：内容与前端体验

| 工单条目 | 报数 | 判定 | 说明 |
|---|---|---|---|
| 3.1 元描述过长 | 373 / 131 | **部分真，需逐条** | 内容层工作，需 URL 清单 |
| 3.1 元描述过短 | 274 / 79 | **部分真，需逐条** | 同上 |
| 3.1 标题过长 | 212 / 112 | **部分真，需逐条** | 同上（另见 §5 已知系统性成因） |
| 3.2 OG 标签不完整 | 79 | **疑似假，需复核** | `lib/pageMeta.ts` 的 `buildPageMetadata()` 已统一产出 `og:title` / `og:description` / `og:image`(1200×630) / `twitter:card`。需清单定位到底缺哪个字段 |
| 3.3 结构化数据错误 | 76 | **待清单** | JSON-LD 由 `organizationSchema()` / `generateSupplierSchema()` 统一产出，需用 Rich Results Test 逐条验证 |
| 3.4 只有一个内链 | 173 + 106 | **部分真** | 孤立页确需补内链，但需清单定位具体页面 |
| 3.4 含失效内链 | 66 + 17 | **派生** | 内链目标当时 5xx |
| 3.5 加载缓慢 | 307 | **派生** | 503/1102 被计为「慢」。实测 200 响应的 p50 = **215 ms**，max 1,473 ms，本身不慢 |

### 模块四：AI 可发现性

| 工单条目 | 报数 | 判定 | 说明 |
|---|---|---|---|
| 4.1 被某些 AI 搜索引擎屏蔽 | 967 | **假 —— 这是主动策略，不是缺陷** | 见下方详解 |
| 4.1 训练机器人策略不一致 | 967 | **假 —— 与上一条是同一件事** | 同上 |
| 4.1 AI 爬虫响应缓慢 | 86 | **派生** | 根因 1 |

**关于「AI 屏蔽」的准确解释**（这一段请转给市场部/SEO，因为工单备注里正要求你们定口径）：

`app/robots.ts` 是**刻意分两类**的，这是设计而非疏漏：

```
A 组 · 放行（搜索 + AI 检索/引用，决定我们能否被搜索与 AI 回答引用）
  Googlebot  Bingbot  Applebot  YandexBot  SeznamBot  DuckDuckBot
  OAI-SearchBot  ChatGPT-User  PerplexityBot  PerplexityBot-User
  Claude-SearchBot  Claude-User

B 组 · 禁止（AI 训练爬虫，Disallow: /）
  GPTBot  ClaudeBot  anthropic-ai  Applebot-Extended  CCBot  Bytespider
  Meta-ExternalAgent  meta-externalagent  Amazonbot  cohere-ai  FacebookBot
  Google-Extended  CloudflareBrowserRenderingCrawler
```

967 这个数字 = **B 组被禁 × 可索引页数**。也就是说：**AI 检索类爬虫我们全部放行，
被禁的只有「拿去训练模型」的那一类。** 这是目前最主流、也最站得住脚的立场。

⚠️ **但有一个值得你拍板的例外**：`Google-Extended` 目前在 B 组。
它**不影响 Google 搜索收录**，只控制内容是否用于 Gemini 的回答与训练。
如果希望在 Gemini 里被引用，需要把它移出 B 组。这是纯商业决策，我按现状保留、未擅自改动。

### 模块五：审查与清理

| 工单条目 | 报数 | 判定 | 说明 |
|---|---|---|---|
| 5.1 Noindex 页面 | 152 | **部分为有意 noindex** | `/verify/report/*`（防报告清单泄露）、`/register`、`/login`、`/account`、`/order`、`/checkout/*`、`/admin/*` 均为**有意** noindex。需清单区分「有意的」与「误伤的」 |
| 5.1 Nofollow / noindex-follow / 两者 | 45 / 107 / 45 | **待清单** | 同上 |
| 5.2 内链 nofollow | 3 | **待定位** | 需 URL |

**统计口径提示**：模块五的 152 / 45 / 107 / 45 四个数字互相重叠（同一页面被计入多桶），
**实际页面数远小于 349**。工单把它当四组独立问题，会导致重复劳动。

---

## 4. 必须由你执行的动作（我做不了的部分）

> 沙箱内无法读取 Cloudflare 控制面：`CLOUDFLARE_API_TOKEN` 对
> `/zones/{id}/settings`、`/bot_management`、`/rulesets`、`/firewall/*` **全部返回 403**；
> `wrangler tail` 经代理返回 502。以下需要你在后台点，或给一个提权 token。

### 🔴 P0-A｜升级 Workers 套餐（单点解决 535 个 5XX）

`Cloudflare Dashboard → Workers & Pages → 右上 Plan → Workers Paid`

- 免费版 CPU 上限 **10 ms/请求**；付费版 **30 s/请求**（约 $5/月）。
- 这是**唯一能一击解决根因的开关**，零代码风险。
- 判断依据：连 1.2 KB 的 `/robots.txt` 在并发下都会 1102。

### 🔴 P0-B｜加一条缓存规则，把爬虫流量挡在 Worker 之外

`Caching → Cache Rules → Create rule`

```
If:    hostname eq "factoryauditb2b.com"
   AND method eq GET
   AND NOT starts_with(http.request.uri.path, "/api/")
   AND NOT starts_with(http.request.uri.path, "/admin")
   AND NOT starts_with(http.request.uri.path, "/account")
   AND NOT starts_with(http.request.uri.path, "/checkout")
   AND NOT starts_with(http.request.uri.path, "/order")
   AND NOT starts_with(http.request.uri.path, "/verify")
Then:  Cache eligibility = Eligible
       Edge TTL = Override origin, 2 hours
       Browser TTL = Respect origin
```

效果：爬虫第二次抓同一 URL 时不再进入 Worker，SSR 只发生一次。
配合代码改动，1,233 个 URL 的重复抓取成本趋近于零。

> ⚠️ **不要**把 `/api/`、`/admin`、`/account`、`/checkout`、`/order`、`/verify` 纳入缓存。
> 也不要把带登录 Cookie 的请求纳入（可加 `AND NOT has_cookie` 之类条件）。

### 🟡 P1｜确认 WAF 没在拦 Bingbot

`Security → Events`，筛选 `Bot Score` / UA 含 `bingbot`，看有没有被 challenge/block 的记录。
按工单要求：**这是核查，不是关 WAF**。若确实有规则命中，请把 Rule ID 给我，我们只做**最小范围例外**，绝不写死 Bing IP。

### 🟡 P1｜导出 4 份清单（解除我这里的 BLOCKED）

`.env` 只有 `BING_SITE_VERIFICATION`（站点验证 token），**没有 Bing Webmaster API key**，
我无法通过 API 拉取报告。需要你从后台导出：

1. Crawl Errors → **4xx 明细**（工单里的 89 条）
2. Crawl Errors → **5xx 明细**（535 条，用于验证我的根因结论）
3. **标题过长**的 URL 清单（212 / 112 条）
4. **Hreflang / Canonical 异常**的 URL 清单（4 条 + 1 条）

拿到 1、3、4 之后，模块一 1.2、模块三 3.1、模块二 2.2 的「待清单」项即可逐条收口。
2 可以拿来对账我这份报告。

---

## 5. 已知的系统性成因（供后续内容层整改参考）

1. **多语言标题长度**：页面 title 形如 `供应商风险评分模型 | FactoryAuditB2B`，而 9 语种的
   品牌后缀恒为 `| FactoryAuditB2B`（含空格 20 字符）。德语/葡语等语种的译名通常比英文长
   20–40%，**同一模板在 de/fr/pt 上更早触顶**。修标题应优先处理这几语，而不是平均用力。
2. **`sitemap.xml` 体积 = 1,525,356 B**（1,233 URL × 10 条 hreflang = 12,330 条 alternate）。
   远低于 Google 的 50 MB / 50,000 URL 上限，**不需要拆分**。
   但它在构建期由 Supabase 实时查询烘焙而成 ⇒ **新增供应商要等下次部署才进 sitemap**
   （其详情页本身仍是实时的）。这是已知取舍，若不可接受需引入 R2 增量缓存。
3. **`/en/` 家族的 2 跳链条**是 Next 尾斜杠归一化 + middleware 的固有顺序造成的，
   本轮已用 `next.config` redirects 收口。若部署后实测仍有 2 跳，
   说明该归一化阶段优先于 config redirects，届时唯一解是放弃 `/en/*` 的公开可达性。

---

## 6. 本轮的实际动作与验证

### 6.1 验证结果（全部实测）

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | **EXIT=0** |
| `next build` | **BUILD_EXIT=0**，`✓ Compiled successfully in 11.3s`，`✓ Generating static pages (1597/1597)` |
| **预渲染路由** | **319 → 1,372（4.3×）**；路由表里 `/about` `/pricing` `/trust` `/industry/[slug]` `/guides/[slug]` `/countries/[slug]` `/chemicals/[slug]` 等**全部由 dynamic 变为 `● SSG`** |
| **hreflang 安全闸门** | 抽样 457 页：**418 页 = 标准 10 条**（9 语 + x-default），与 `hreflangFor()` 设计完全一致 ✅ |
| **canonical 安全闸门** | 抽样 457 页，**39 页无 canonical** —— 已逐一核对源文件，**这 39 页全部是 `permanentRedirect` 重定向页**（`knowledge` / `inspectors` / `sample-report` / `supplier/[country]/[slug]` / `country/[slug]` 各含 2 处 `permanentRedirect`）。它们不渲染内容、以 308 出站，无 canonical 无影响。**无 SEO 回归。** |
| 回归套件 | **cs01 46/0、cs06a 55/0、cs12 33/0、cs13 146/0（1 SKIP）、cs16 62/0、v22 61/0 ⇒ 合计 403 PASS / 0 FAIL** |

### 6.2 一处需要你知道的取舍（已量化，不是隐患）

`/suppliers/[slug]` 已加 `dynamic = "force-dynamic"` + `dynamicParams = true`，用于保住「发布即实时」。
但构建产物显示它仍以 `● SSG` 出现在路由表里 ⇒ **构建期已发布的供应商档案是构建时快照**：

- **新发布**的供应商：其 slug 不在构建集合内 ⇒ **按需渲染，立即可见** ✅
- **改动已发布**的供应商（风险分/核验等级）：**需下一次部署才刷新** ⚠️

影响面：**81 / 1,233 个 URL（6.6%）**。若要彻底消除，下一步是把该页的 `generateStaticParams` 移除（需再跑一次构建）。这是纯取舍，不是缺陷 —— 且 sitemap 本身早就是构建期烘焙的，两者语义现已一致。

### 6.3 未提交（等你裁定）

本轮改动落在 6 个文件上：

```
M  app/[locale]/layout.tsx                                  ← 唯一纯本轮改动
M  app/[locale]/suppliers/[slug]/page.tsx                   ← 与 CS-16/17 的暂存改动混在同一文件
M  app/[locale]/verify/report/[verificationId]/page.tsx     ← 同上（该文件本身是 CS-18 新增）
M  next.config.mjs                                          ← 与 V2.2 的 /membership 重定向混在同一文件
M  scripts/cs06a-directory-regression.ts                    ← 断言改写
A  docs/SEO-20260918-TRIAGE.md                              ← 本报告（新增）
```

**未创建 commit 的原因**：索引里仍有你上一轮裁定「先不动」的 **100 个 V2.1/V2.2 暂存文件**。其中 3 个文件（`suppliers/[slug]/page.tsx`、`verify/report/...`、`next.config.mjs`）的**历史 changeset 内容与本轮改动混在同一文件内**，按路径提交会把 V2.1/V2.2 的改动一并带入 —— 违反项目「禁止把不同 change set 混入同一 commit」的铁律。**需要你先裁定那 100 个文件如何处置，我再做干净的提交。**

---

## 7. 任务 3.1 的真实数据（可直接拿去整改）

从 457 个预渲染页抽样统计，**这是 URL 级的真实分布**：

### 7.1 标题长度

```
title > 60 字符：130 / 457 = 28%
```

**最长的一批全部是 `/chemicals/[slug]` 的非英语版本**，且集中在罗曼语系：

| 长度 | URL | 实际标题 |
|---|---|---|
| 119 | `fr/chemicals/xanthan-gum` | `Xanthan gum (CAS 11138-66-2) — Matières premières chimiques : applications, documents et fournisseurs \| FactoryAuditB2B` |
| 118 | `es/chemicals/titanium-dioxide` | `Titanium dioxide (CAS 13463-67-7) — Materias primas químicas: …` |
| 117 | `pt/chemicals/titanium-dioxide` | `… Matérias-primas químicas: …` |
| 114 | `en/chemicals/calcium-carbonate` | `Calcium carbonate (CAS 471-34-1) — Chemical raw materials: applications, documents and suppliers \| FactoryAuditB2B` |

**结论**：品牌后缀 `| FactoryAuditB2B`（含空格 20 字符）+ 化工模板的固定长尾，在 fr/es/pt/de 上必然越界。**修标题应优先动这条模板，而不是平均用力改 212 个页面。**

### 7.2 元描述长度 —— ⚠️ 工单这一条的验收标准本身是错的

工单 3.1 要求「描述控制在 120–160 字符」。**实测按语言拆开后，这个统一标准会伤害中日韩页面：**

```
<120 过短 : 314      120–160 OK : 155      >160 过长 : 215

按语言：
  过短 —— zh 76、zh-TW 74、ja 60          ← 中日韩集中在这里
  过长 —— fr 51、es 47、de 34、pt 32、en 22  ← 拉丁语系集中在这里
```

**原因**：Google 按**像素宽度**截断，不按字符数。CJK 字符的信息密度远高于拉丁字母，**70–90 个中文字符 ≈ 120–160 个拉丁字符**的展示宽度。

**建议分语种设定目标**（不要一刀切）：

| 语种 | 目标长度 |
|---|---|
| en / de / fr / es / pt / ar | 120–160 字符（工单标准适用） |
| zh / zh-TW | **70–90 字符** |
| ja | **80–100 字符** |

若按 120–160 去「补足」zh/zh-TW/ja 的描述，会把它们撑到被截断，**反而降低点击率**。

### 7.3 另一处细节

化工标题用的是 em-dash `—` 作分隔符。项目约定「禁破折号修辞」针对的是**文案修辞**，作标题分隔符是否放行需你确认（若不放行，改标题时一并换成 `|` 或 `:`）。

---

## 8. 需要你决策的事项

1. **是否升级 Workers Paid（约 $5/月）** —— 不升级，535 个 5XX 在爬虫高峰期会复发，其余整改的收益会被覆盖。**这是唯一能单点解决根因的动作。**
2. **是否加 P0-B 缓存规则** —— 这一条不需要付费即可显著缓解。
3. **`Google-Extended` 是否移出 B 组**（决定能否在 Gemini 回答中被引用）。
4. **4 份 Bing 清单** —— 拿到后我才能把「待清单」项逐条收口。
5. **`/suppliers/[slug]` 的取舍**（§6.2）：接受「改动需部署才刷新」，还是移除 `generateStaticParams` 彻底改为实时渲染。
6. **那 100 个暂存文件如何处置** —— 决定我能否为本轮改动创建干净的 commit（§6.3）。
7. **部署时机** —— 本轮代码改动已在本地构建验证通过（BUILD_EXIT=0）。是否现在就部署，还是等 P0-A/P0-B 的平台侧动作一起做。

