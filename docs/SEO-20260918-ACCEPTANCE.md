# FactoryAuditB2B｜SEO-20260918-FAB 整改验收报告

- 工单：SEO-20260918-FAB（P0）
- 目标站：factoryauditb2b.com
- 执行日期：2026-09-18
- 代码分支：`fix/seo-worker-issues`
- 基线 commit：`69a52b0`（V2.1/V2.2 变更集）
- 修复 commit：`5b74d89`（`fix(seo): remove headers() to enable SSG, fix soft 404 and ISR for suppliers`）

---

## 0. 一句话结论

**179 项里约 140 项不是独立缺陷，是同一个根因（Cloudflare Free 套餐 Worker CPU 10ms 上限被
全站零预渲染打爆 → Error 1102）的下游产物。** 根因中的**代码侧部分已修复并通过构建/回归/本地
实测**；根因中的**配额与缓存侧部分只能由账号持有人在 Cloudflare 后台操作**（见 §4），
且**本次修复尚未部署上线**。

| 维度 | 修复前 | 修复后（构建实测） |
|---|---|---|
| prerender-manifest `routes` | 319 | **1,453** |
| `dynamicRoutes` | 0 | 54 |
| 合计 | 319 | **1,507（×4.72）** |
| `Generating static pages` | — | 1597/1597 |
| 化工详情页标题（最长） | 124 字符 / 1,121px | **≤60 字符 / ≤600px** |
| 化工详情页描述 | 169–200 字符，截在句中 | **≤128 字符，句末收尾** |
| 不存在的验真 ID | 200（软 404） | **404** |
| `/en`、`/en/about` | 2 跳 | **1 跳** |

`tsc --noEmit` EXIT=0；`next build` BUILD_EXIT=0；回归 **655 PASS / 0 FAIL**。

> ⚠️ **但上表「修复后」全是构建期数字，不等于生产行为。** 本轮追加实测发现：
> `open-next.config.ts` = `defineCloudflareConfig({})` ⇒ `incrementalCache` 解析为 `"dummy"`
> ⇒ `populateCache` 不会把 `.open-next/cache/` 复制进 assets ⇒ **1,505 个预渲染产物
> （151.5 MB）在部署时被整体丢弃**，线上仍是每请求现场 SSR。
> **不改这一处配置，本报告的 SSG 收益一项也落不了地。** 详见 §4-0。

---

## 1. 根因（已实测钉死，非推断）

站点跑在 **Cloudflare Workers 免费版（CPU 上限 10ms/请求）**，而 `app/[locale]/layout.tsx` 的
`generateMetadata` 调用了 `await headers()`（取 middleware 注入的 `x-pathname` 去推 canonical）。
Next 15 下，`generateMetadata` 一旦触碰 Dynamic API，**整棵 `[locale]` 子树永久退出静态生成**。

实测后果（2026-09-18，修复前）：

```
prerender-manifest routes = 319
  = 315 条 audit-guide + sitemap.xml + robots.txt + llms.txt + _not-found
  ⇒ 站点没有任何一个内容页被预渲染；sitemap 里 1,233 个 URL 全部逐请求现场 SSR（含 Supabase 往返）

单线程顺序抓取 46 URL → 43/46 = 200（失败仅 3 个正确的 301/308/404）
并发 4  → 5/20、10/20、11/20
并发 10 → 10/20、10/20        失败全部 503 + error code: 1102
```

因此工单中的 hreflang 631 / canonical 48 / sitemap 261 / 失效内链 83 / 慢加载 307
**都是「爬虫当时抓不到页面」的连带判定结果**，不是各自独立的缺陷。

---

## 2. 已修项与实测证据

### 任务 1.1　摘除 `headers()` 死代码

改动：`app/[locale]/layout.tsx`

- 删除 `await headers()`，同时清掉已成死代码的 `TOOL_TITLE_KEY` 与
  `hreflangFor` / `canonicalFor` 引入。
- 安全性依据（逐页核对）：62 个非 admin 页面中 **54 个自带 `buildPageMetadata()`** 显式声明
  canonical + languages；Next 元数据合并中同名字段**由子级覆盖父级**，故 layout 里的
  `alternates` 对它们一直是死值。其余 8 个（`checkout/[ref]`、`country/[slug]`、`inspectors`、
  `knowledge`、`membership`、`order`、`sample-report`、`supplier/[country]/[slug]`）
  **全部是 308 重定向页或已 `noindex` 的事务页**。

实测（构建后）：

```
routes 319 → 1,453    dynamicRoutes 0 → 54    合计 1,507（×4.72）
/en  /en/about  /en/trust  /en/pricing  /en/chemicals   → 全部 SSG（构建期预渲染）
```

### 任务 1.2　软 404 → 真 404

改动：`app/[locale]/verify/report/[verificationId]/page.tsx`

只在 `result.reason === "not_found"` 时 `notFound()`。**`not_issued` / `visibility_restricted` /
`revoked` 仍返回 200** —— 三者对应**真实存在**的报告（revoked 还必须展示「已撤销」状态），
页面本身已 `robots: { index: false, follow: false }`，无索引风险。

本地 `next start` 实测：

| URL | 修复前 | 修复后 |
|---|---|---|
| `/verify/report/VFY-ZZZZZZZZ` | 200（44KB 页面） | **404** |
| `/verify/report/NOTEXIST` | 200 | **404** |
| `/verify/report/VFY-2Z7G924S`（有效） | 200 | **200** |

> 副作用（可接受）：用户手打错 ID 时看到的是通用 404 页而非「不可验真」提示页。
> 这是工单「必须返回真 404」的直接结果。

### 任务 1.3　`/en` 重定向链收口

改动：`next.config.mjs`（`redirects()` 内新增 `/en` 与 `/en/:path*` 两条 308 规则）

本地 `next start` 实测：

| URL | 修复前 | 修复后 |
|---|---|---|
| `/en` | 2 跳 | **1 跳 → `/`** |
| `/en/about` | 2 跳 | **1 跳 → `/about`** |
| `/en/chemicals/citric-acid` | 2 跳 | **1 跳** |
| `/membership` | 1 跳 → `/pricing` | 1 跳（无回退） |
| `/en/membership` | 2 跳 | 2 跳（无回退） |

**未能改善**：带尾斜杠的 `/en/`、`/en/about/` 仍是 2 跳。原因是那条 308 来自
**Next 核心的尾斜杠归一化，它发生在 `next.config` redirects 求值之前**，从 `next.config`
无法覆盖（把 `/en/` 写成 source 也不会被查到）。影响有限：站内链接与 sitemap
均无尾斜杠形式；`/zh/` 这类「归一化后即 200」的路径本就是 1 跳。

### 任务 1.3　供应商详情页改 ISR

改动：`app/[locale]/suppliers/[slug]/page.tsx`：`force-dynamic` → `export const revalidate = 3600`

实测（构建产物）：

```
routes 中 /<locale>/suppliers/<slug> = 81 条
样本 /ar/suppliers/dongguan-plastic-molding
     initialRevalidateSeconds = 3600
```

#### 🔴 必须如实说明：这条改动**当前是惰性的**

`open-next.config.ts` 现为 `defineCloudflareConfig({})`，OpenNext Cloudflare 1.20.4 会把
`incrementalCache` / `tagCache` / `queue` 全部解析为 `"dummy"`（见
`@opennextjs/cloudflare/dist/api/config.js` 的 `resolveIncrementalCache(value = "dummy")`），
而 dummy 的 `get()` **直接抛 `IgnorableError`**
（`@opennextjs/aws/dist/overrides/incrementalCache/dummy.js`）。

结论：**当前没有任何缓存层**，每个请求仍然现场渲染 —— 这**等价于改动前的 `force-dynamic`**，
所以本次改动**不引入回归、数据依然实时**；但「静态分发 + 按时更新」**要等增量缓存配好才成立**。
两种激活方式见 §4-3。

> 取舍提醒：一旦缓存生效，`revalidate = 3600` 意味着档案更新后**最多滞后 1 小时**可见。
> 若「发布即实时」重新成为硬要求，把该文件里那行 `revalidate` 换成
> `export const dynamic = "force-dynamic";` 即可。

### 任务 2.1　化工模板 Meta 收口

改动：`app/[locale]/chemicals/[slug]/page.tsx` + `lib/pageMeta.ts` +
9 个字典各新增 1 键（`chemicals.detailTitleTail`）

**标题**：原为 `${name} (CAS ${cas}) — ${t.chemicals.metaTitle}` + 18 字符品牌后缀，其中
`chemicals.metaTitle` 是**列表页的关键词堆叠串**（fr 70 / es 64 / pt 63 / de 59 字符），
三段叠加产出全站最长的标题族。改为短标签 `detailTitleTail`（9 语齐备、≤25 字符）并
`withBrand: false`（Google 现已单独展示站点名，18 字符品牌位是 60 字符预算里最贵的一段）。

**描述**：原为 `pickZhPair(...).slice(0, 200)` —— 直接按字符截断，实测 fr 版以
「…whiteness, 」结尾（半个清单）。改为 `lib/pageMeta.ts` 新增的 `trimMetaDescription()`：
按**实际书写系统**给预算（CJK 90 字 / 拉丁 158 字），**优先在句末标点收尾**，其次词边界，
并剥掉悬空标点。

实测（54 个化工详情页 = 6 品种 × 9 语，HTML 实体已解码）：

| 语言 | 标题最长 | 标题像素最长 | 描述最长 |
|---|---|---|---|
| en | 60 | 585px | 128 |
| zh | 29 | 388px | 81 |
| zh-TW | 29 | 388px | 81 |
| ja | 41 | 455px | 128 |
| de | 59 | 600px | 128 |
| fr | 60 | 585px | 128 |
| es | 53 | 532px | 128 |
| pt | 59 | 584px | 128 |
| ar | 56 | 556px | 128 |

标题超 600px：**0**；描述超预算：**0**；以悬空标点结尾：**0**。

> 残余边界：de 的最长一条（`Titanium dioxide (CAS 13463-67-7) — Anwendungen & Dokumente`）
> 为 59 字符 / 估算 600px，正好压在 Google 桌面端标题区上限。可按需再压 2–3 字符。

#### ⚠️ 未做，且**必须由人工内容完成**

化学品正文（`application` / `compliance`）在 `lib/chemicals.ts` 里**只有 en / zh 两版**，
`pickZhPair` 对 ja/de/fr/es/pt/ar 一律回落英文 ⇒ **这 6 个语言的详情页正文与描述目前都是英文**。
要真正本地化这些描述，需要 **6 语言 × 6 品种的译文（36 条）**。
按项目「不编造」铁律，本次**未代为翻译**，也未用通用模板句顶替（那会牺牲逐品种相关性）。

### 任务 2.2　Canonical 闸门

扫描全部 1,450 个构建产物页面：**1,341 页有 canonical，109 页无 canonical**。
109 页的构成已逐一归因：

```
_not-found.html                      × 1
inspectors / knowledge / sample-report  × 9 语 = 27
supplier/[country]/[slug]           × 9 国 × 9 语 = 81
```

读源码核对：这 4 个路径族的页面**全部使用 `permanentRedirect`**（不渲染内容）⇒
无 canonical 属预期，**不是回归**。

自指 canonical 抽查（含多语言）：

```
/en/about          -> https://factoryauditb2b.com/about
/en/pricing        -> https://factoryauditb2b.com/pricing
/en/chemicals/titanium-dioxide -> https://factoryauditb2b.com/chemicals/titanium-dioxide
/zh/chemicals/citric-acid      -> https://factoryauditb2b.com/zh/chemicals/citric-acid
/fr/chemicals/calcium-carbonate-> https://factoryauditb2b.com/fr/chemicals/calcium-carbonate
```

---

## 3. 回归常量同步（7 处「同源」）

新增 1 个字典键（×9 语）使 en 字典叶子数 2822 → 2823，触发 7 个文件里的冻结层断言。
按项目既有约定（`// 2822 → 2823：…` 历史注释）同步：

`cs06a` C8（含历史注释行）· `cs08` G4,G5 · `cs12` E4,E5 · `cs13` F1b,F1i,F1j ·
`cs16` A1–A6 · `cs17` A1–A6 · `verify-opennext-bundle`；
另 `cs02b` 的 `KEYS` 补入 `detailTitleTail`、F5 由 9 改为 10。

回归结果（全部 EXIT=0）：

```
cs01  46 PASS / 0 FAIL     cs02a 50 PASS / 0 FAIL     cs02b 65 PASS / 0 FAIL
cs06a 55 PASS / 0 FAIL     cs08  71 PASS / 0 FAIL     cs12  33 PASS / 0 FAIL
cs13 146 PASS / 0 FAIL     cs16  62 PASS / 0 FAIL     cs17  66 PASS / 0 FAIL
v22   61 PASS / 0 FAIL
──────────────────────────────────────────────────────
合计 655 PASS / 0 FAIL
```

---

## 4. 剩余需要人工操作的清单

### 4-0　🔴🔴 部署前必读：不改一处配置，本次 SSG 收益全部作废

**实测（非推断）**：本轮追加跑了一次完整打包 + `wrangler deploy --dry-run` 交叉验证。

| 产物 | 数量 / 体积 | 去向 |
|---|---|---|
| `.open-next/cache/`（**CS-19 的全部成果**） | **1,505 个 `.cache` / 151.5 MB** | ❌ **不上传，部署时丢弃** |
| `.open-next/assets/`（静态资源层，绕过 Worker） | 150 文件 / 1.32 MB，**无 `cdn-cgi/_next_cache`** | ✅ 上传 |
| Worker bundle（`server-functions` 经 esbuild 打包后） | **15,531 KiB 未压缩** | ✅ 上传（免费版上限 64 MiB） |

**为什么被丢弃**：`open-next.config.ts` = `defineCloudflareConfig({})`，
`resolveIncrementalCache(value = "dummy")` ⇒ `incrementalCache` = `"dummy"`
⇒ `cli/commands/populate-cache.js` 的 switch 走 `default` 分支 ⇒ 不执行
`populateStaticAssetsIncrementalCache()`（该函数只做一件事：把 `.open-next/cache/`
复制进 `assets/cdn-cgi/_next_cache/`）。

**后果**：生产上那 1,450 条预渲染页根本不存在，每个请求仍现场 SSR。官方文档给出量化佐证：

> "The average Worker uses approximately 2.2 ms per request. Heavier workloads that handle
> authentication, **server-side rendering**, or parse large payloads typically use **10–20 ms**."

10–20 ms > 免费版 10 ms ⇒ **1102 必然复发**。

#### 免费解法（$0，官方支持）

`open-next.config.ts` 改为：

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
```

官方原话：*"If your site is static, you do not need a Queue nor a Tag Cache. You can use a
read-only Workers Static Assets-based incremental cache for the prerendered routes."*

**免费版承载力核算（逐项核对官方 Limits 文档）**：

| 项 | 需求 | 免费版上限 | 结论 |
|---|---|---|---|
| 静态资源文件数 | 150 + 1,505 = **1,655** | **20,000** | ✅ |
| 单文件最大 | 1.58 MB（`sitemap.xml.cache`） | **25 MiB** | ✅ |
| 资源总量 | 152.8 MB | **无限制** | ✅ |
| 静态资源请求 | — | **免费且不限量** | ✅ |
| 资源存储费 | — | **无** | ✅ |
| Worker bundle 未压缩 | 15.2 MB | **64 MiB**（Free 与 Paid 相同，**无压缩后限制**） | ✅ |

#### 🔴 代价（知情后再决定）

官方明确：*"A read-only store for the incremental cache... **Revalidation is not supported
with this cache**."* ⇒ `revalidate = 3600` **不生效**，全部预渲染页（含 81 个供应商页）
的数据**冻结在构建时**；发布新供应商 / 改数据后**必须重新部署**才更新。

#### 三方案对比

| | 现状（dummy） | 配 staticAssets（**免费**） | 升 Paid + R2 |
|---|---|---|---|
| 预渲染产物 | **丢弃** | 上传 | 上传 |
| 页面响应 | 每次完整 SSR | Worker 读缓存文件即返回 | 读 R2 缓存 |
| 免费版 10 ms | ❌ 必然超 | ✅ 大概率够 | ✅（上限 30 s） |
| 数据更新 | 实时 | **需重新部署**（热构建约 6 min） | `revalidate` 自动 |
| 费用 | $0 | **$0** | $5/月 |

> ⚠️ 若采纳 staticAssets 方案，须复查 `/suppliers` 的 `revalidate = 3600` 已无意义。
> 若要求供应商数据实时，须把该页移出 `generateStaticParams` 预渲染集合，使其保持动态
> —— 但这会把它放回「进 Worker」的集合，需与 §4-2 的 Cache Rule 配合。

#### 另两项免费顺手优化

1. 补 `public/_headers`：`/_next/static/*` → `Cache-Control: public,max-age=31536000,immutable`
   （官方推荐；当前**缺失**，浏览器与爬虫每次都回源验证）。注意 `_headers` 限 100 条规则、每行 ≤ 2000 字符。
2. 免费版另有 **100,000 请求/天**上限（超出报 **Error 1027**）。静态资源请求**不计入**此配额，
   故静态化可同时规避该风险。

### 4-1　🔴 部署本次修复（必做，否则线上无变化）

我**只做了构建验证，未部署**。部署须按项目既有四步走，并**关闭沙箱**：

```
清 .next/cache → next build → opennext build → node scripts/scrub-next-env.mjs → wrangler deploy
```

禁用：`npm run cf:build`、`.bin/*`、`rm -rf .next`。
（`next.config.mjs` 有改动 ⇒ 本次 `next build` 是**冷编译**，实测约 17 分钟，日志会长时间不落盘，
判断存活要看 node 进程 CPU 是否持续增长，不要看日志或 mtime。）

### 4-2　Cloudflare 后台（根因的配额侧，只有账号持有人能做）

| # | 操作 | 收益 | 备注 |
|---|---|---|---|
| 1 | **升级 Workers Paid（约 $5/月）** | CPU 10ms → 30s，**单点解决 1102** | 不升级，爬虫高峰期 5xx 会复发，其余整改收益被覆盖 |
| 2 | **加 Cache Rule**：`Cache Everything` / Edge TTL 2h | 不付费即可显著缓解 | **排除清单**：`/api` `/admin` `/account` `/checkout` `/order` `/verify` **以及 `/suppliers`** |

> ⚠️ 新增的排除项 `/suppliers`：供应商详情页现在是 `revalidate = 3600` 的 ISR，
> 若被边缘缓存，会按**边缘 TTL** 提供过期档案（比 1 小时的 ISR 窗口更久）。

### 4-3　让缓存真正生效（三选一，详见 §4-0）

| 方案 | 做法 | 代价 |
|---|---|---|
| **a) staticAssets 增量缓存（免费，推荐）** | `incrementalCache: staticAssetsIncrementalCache` + `enableCacheInterception: true` | 只读，`revalidate` 不生效，改数据要重新部署 |
| **b) R2 增量缓存（真 ISR，需 Paid）** | 建 R2 bucket → `wrangler.jsonc` 加 `r2_buckets` 绑定 → `incrementalCache: r2IncrementalCache`（可叠 `withRegionalCache`） | $5/月 |
| **c) Cache Rule 边缘缓存（免费）** | 见 §4-2 第 2 项 | 注意排除 `/api` `/admin` `/account` `/checkout` `/order` `/verify` `/suppliers` |

> 🔴 **a) 与 b) 二选一必做**，否则 §4-0 所述「预渲染产物被丢弃」的问题依旧存在。

### 4-4　搜索平台侧

- 重新提交 `sitemap.xml`；用 Bing Webmaster 的「Fetch as Bingbot」复验 5xx 是否消失。
- 工单 §四 要求的 4 份明细清单（4xx / 5xx / 标题过长 / hreflang 异常）**我拿不到** ——
  `.env` 只有 `BING_SITE_VERIFICATION`，没有 Webmaster API key。拿到清单才能把
  「待清单」项逐条收口。

### 4-5　AI 策略对齐（需决策）

`Google-Extended` 是否从 robots.txt 的 B 组（训练爬虫，禁止）移出 —— 决定站点能否被
Gemini 引用。**当前 AI 检索类爬虫（OAI-SearchBot / Claude-SearchBot / PerplexityBot 等）
已全部放行**，工单里「967 个 AI 屏蔽」等于 B 组 × 可索引页数，是**主动策略而非缺陷**。

---

## 5. 明确**不做**的工单项与理由

| 工单条目 | 结论 |
|---|---|
| 「967 个页面被 AI 引擎屏蔽」（4.1） | **主动策略**：robots 分 A 组放行 12 个搜索 + AI 检索爬虫、B 组禁 13 个训练爬虫。AI 检索类全部放行 |
| 「Meta Description 补全到 120–160 字符」（3.1） | **按语言定预算**：实测过短集中在 zh 76 / zh-TW 74 / ja 60，过长集中在 fr 51 / es 47 / de 34 / pt 32。CJK 汉字 70–90 字即达实用上限，补到 120–160 反而会被截断 |
| 「1,233 页存在于多个 sitemap」（2.3） | **误读**：只有一个 sitemap，去重后仍是 1,233 |
| 「119 个 HTTP→HTTPS 规范化」（1.4） | **已由 Cloudflare 处理**（强制 HTTPS），无可改项 |
| 平均修改 212 个分散页面（3.1） | 改为**只修模板**：最长标题族全部来自 `/chemicals/[slug]`（fr/es/pt/de），改模板 1 处 > 改页面 212 处 |

---

## 6. 复现命令

```bash
# 类型检查 / 构建
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build

# 回归（统一运行器，自动注入 ROOT 环境变量）
node scripts/run-regression.mjs cs02b-chemical-regression CS02B_ROOT
# … cs01 / cs02a / cs06a / cs08 / cs12 / cs13 / cs16 / cs17
node scripts/v22-commercial-regression.mjs

# 构建后验收（预渲染计数 / 化工 meta 闸门 / canonical 闸门）
node scripts/_seo_triage_06.mjs

# 本地实测重定向链与软 404
node node_modules/next/dist/bin/next start -p 3999
curl -s -o /dev/null -w "%{http_code} %{num_redirects} %{redirect_url}\n" http://127.0.0.1:3999/en
```

---

## 7. Git 结构与回退方式

```
main                    b841ac5 → 69a52b0  （V2.1/V2.2 变更集，100 文件，+9288/−571）
                                        └── 5b74d89  （CS-19 修复，26 文件，+961/−81）
fix/seo-worker-issues   = 69a52b0 + 5b74d89      ← 当前分支
```

**关于隔离**：工单要求「严禁把 V2.1/V2.2 的 100 个暂存文件与本次修复混在一起提交」。
实际做成了**两个独立 commit**：

- `69a52b0` 是 V2.1/V2.2 变更集（已在 git index 中暂存数日、上一轮 commit 因上下文超限中断，
  且**就是当前线上运行的生产代码**）；
- `5b74d89` **只含 CS-19 的 26 个文件**，不含任何 V2.1/V2.2 内容。

之所以必须先落 V2.1/V2.2，是因为 CS-19 的 24 个被改文件中，**20 个（含 9 个字典的 +1 行、
`next.config.mjs`、供应商页、验真页）的改动上下文落在 V2.1/V2.2 基线上**，其中
`app/[locale]/verify/report/[verificationId]/page.tsx` 更是 **V2.1 才新建的文件** ——
在 HEAD 上不存在，物理上无法单独提交。若只按 HEAD 提交，**任务 1.2（软 404）会整条丢失**。

回退（如需）：

```bash
git checkout main && git reset --soft HEAD~1   # 撤销 69a52b0，改动回到暂存区
git branch -D fix/seo-worker-issues            # 删除修复分支（会一并丢掉 5b74d89）
```
