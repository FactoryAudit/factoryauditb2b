# Bing 抓取故障专项审计（PHASE 01–04）

审计对象：`https://factoryauditb2b.com`（Next.js 15 App Router · Cloudflare Workers/OpenNext · Supabase）
审计时间：2026-09-18
审计方式：**只读**。Cloudflare API（只读调用）+ 线上 HTTP 实测 + 全仓文本扫描。
**本轮未修改任何代码 / 配置 / WAF / robots。**

---

## 0. 先结论（P0，请先看这一段）

**站点当前处于间歇性降级状态**：约 **40–75% 的动态请求返回 HTTP 503 + Cloudflare Error 1102「Worker exceeded resource limits」**；`/sitemap.xml` 间歇返回 **HTTP 500 `Internal Server Error`**。

> **这不是 SEO 问题。这是 Worker 资源超限导致的持续 5xx。**

因此「Bingbot 被阻止」是**误判**：

```
Bingbot 没有被 robots.txt 阻止
Bingbot 没有被 middleware 阻止
Bingbot 没有被 UA 规则阻止

Bingbot 是被「喂了 5xx」—— 它按时来抓，站点给它 503 / 500，
Bing 侧登记为抓取失败，并把站点判为「抓取受阻 / 高错误率」。
```

**实测证据（同一时刻、同一批 URL、四种 UA 对比）**：Bingbot / Googlebot / Bing Site Scan 三种 UA 与普通浏览器 UA **返回完全相同的状态码** → **边缘不存在基于 UA 的差异化拦截**。

---

## 1. PHASE 01｜逐层诊断结果

| 层 | 结论 | 证据 |
|---|---|---|
| **robots.txt** | **不阻止 Bingbot** | 线上 `/robots.txt` → 200；明文含 `User-Agent: Bingbot` / `Allow: /` / `Disallow: /api` |
| **robots.txt 是否含 Cloudflare 托管段** | **没有** | 线上全文 1224 字节，与 `app/robots.ts` 输出**逐行一致**，未见任何 CF 注入段/注释头 |
| **Next.js middleware** | **零 bot 逻辑** | `middleware.ts` 全文仅 56 行：i18n rewrite + `/en/*` 301 + 注入 `x-pathname`。**无** UA / IP / country / rate-limit / block / deny / challenge 任何分支 |
| **Cloudflare UA 拦截** | **未发现** | 四 UA 同页面同刻对比，状态码一致（见 §1.1） |
| **Cloudflare WAF / Bot Fight Mode / Super Bot Fight Mode / Security Events** | **无法核验（BLOCKED）** | 见 §1.2 |
| **Worker 运行时日志** | **无法核验（BLOCKED）** | `wrangler tail` → `Error: Unexpected server response: 502`（经代理） |
| **源站 Worker** | **← 真正的故障点** | HTTP 503 + `cf-error-code 1102` |
| **Supabase** | **健康** | REST `/suppliers?limit=1` → 200，1065 ms，返回真实数据 |

### 1.1 UA 对比实测（PHASE 02 相关）

同一时刻、同一 URL，四种 User-Agent：

| URL | bingbot | googlebot | 浏览器 | Bing Site Scan UA |
|---|---|---|---|---|
| `/` | 200 | 200 | 200 | 200 |
| `/suppliers` | 200 | 200 | 200 | 200 |
| `/rfq` | 200 | 200 | 200 | 200 |
| `/industry` | 200 | 200 | 200 | 200 |
| `/pricing` | 200 | 200 | 200 | 200 |
| `/robots.txt` | 200 | 200 | 200 | 200 |
| `/sitemap.xml` | 200 | 200 | 200 | 200 |

**结论：无 UA 差异化拦截。** 「Fake Bing or MSN Bot」类规则**未在本轮实测中触发**（注意：该规则属 Managed Ruleset，需 Pro+ 且需有权限的 token 才能确认是否启用 —— 见 §1.2）。

### 1.2 BLOCKED：无法核验 Cloudflare 控制面

`CLOUDFLARE_API_TOKEN`（53 字符）权限探测结果：

| 端点 | 结果 |
|---|---|
| `/user/tokens/verify` | **OK** |
| `/zones/{zone_id}` | **OK**（zone = `factoryauditb2b.com`，status=active，**plan = Free Website**，paused=false） |
| `/zones/{zone_id}/settings` | **403** `9109 Unauthorized to access requested resource` |
| `/zones/{zone_id}/bot_management` | **403** `10000 Authentication error` |
| `/zones/{zone_id}/rulesets` | **403** `10000` |
| `/zones/{zone_id}/firewall/rules` | **403** `10000` |
| `/zones/{zone_id}/firewall/access_rules/rules` | **403** `10000` |
| `/zones/{zone_id}/firewall/ua_rules` | **403** `10000` |
| `/zones/{zone_id}/firewall/lockdowns` | **403** `10000` |
| `/zones/{zone_id}/page_shield` | **403** `10000` |
| GraphQL（安全事件） | 端点可达但 token 无 Zone Analytics 权限 |

⇒ **无法读取** Custom Rules / Managed Rules / Bot Fight Mode / Super Bot Fight Mode / Rate Limiting / IP Access Rules / Country Blocking / Zone Lockdown / **Security Events**。
⇒ 规格要求的「CF 哪条规则拦的」这一问，**当前凭证无法回答**。需要提权 token 或后台截图。

**已确认的 zone 事实**：**plan = Free Website**。这一条对 §6 根因分析很关键 —— Free 套餐的 Workers **CPU 时间上限为 10 ms/请求**（Paid 为 30 s）。

---

## 2. PHASE 04｜实测到的 5xx（这是真实故障，不是推测）

### 2.1 故障样本（2026-09-18 22:25–22:30 GMT+8 连续观测）

| 时刻 | URL | Status | CF Error | Body | 备注 |
|---|---|---|---|---|---|
| 22:25:36 | `/` | **503** | **1102** | 4648 B | `<title>Worker exceeded resource limits` |
| 22:26 | `/sitemap.xml` ×3 | **503** | **1102** | 4648 B | 随后 ×2 变 **500** |
| 22:26 | `/sitemap.xml` ×2 | **500** | — | 21 B | body = `Internal Server Error` |
| 22:27 | `/robots.txt` | **503** | **1102** | 4648 B | ⚠️ 连 1.2 KB 的 robots 也失败 |
| 22:27 | `/llms.txt` | **503** | **1102** | 4648 B | |
| 22:27 | `/` `/pricing` `/suppliers` | **503** | **1102** | 4648 B | |
| 22:27 | `/favicon.svg` | **200** | — | 1098 B | **静态资源始终正常** |
| 22:28 | `/` `/pricing` `/sitemap.xml` | **200** | — | 82 KB / 69 KB / 434 KB | **又恢复** |

### 2.2 成功率实测（同一分钟内）

| 模式 | 200 | 503/1102 | 成功率 |
|---|---|---|---|
| 单发 ×5（间隔 1 s） | 0 | 5 | **0%** |
| 并发 3（12 请求） | 3 | 9 | 25% |
| 并发 6（24 请求） | 11 | 13 | 46% |
| 并发 10（40 请求） | 17 | 23 | 42% |

**关键推论**：

1. **不是「某个重页面」的问题** —— `/robots.txt`（1.2 KB，纯字符串）同样 1102。⇒ 是 **Worker 全局资源状态**问题。
2. **静态资源不受影响** —— `/favicon.svg` 始终 200 ⇒ Cloudflare 边缘与 zone 本身正常，**故障被隔离在 Worker 执行层**。
3. **故障是间歇性的**（分钟级在 200 ↔ 503 之间翻转）⇒ 典型的**资源上限贴边**特征（CPU 或内存恰好卡在限额附近，成功与否取决于 GC / 冷热启动时序）， 而非「配额耗尽式」的硬拒绝（硬拒绝会让单发请求也 100% 失败且不恢复）。
4. **连单发请求都会失败（0/5）** ⇒ 不能解释为「Bing 抓太快被限速」；**正常单线程爬虫同样会吃到 5xx**。

> ⚠️ **诚实声明**：本轮审计早期我执行过一次 10 并发、1233 URL 的普查（跑了约 6 分钟，最后 33 条挂起），随后即观测到 1102 爆发。**我无法排除我的普查加剧了当时的降级**。但两点使其不构成「审计自伤」的解释：(a) 故障特征为资源上限贴边（单发也会中招），非限速惩罚；(b) Bing 侧独立报告了 3 个 5xx，说明该故障类别**在本次审计之前就已存在**。该普查已中止，后续改为低并发/单发。

### 2.3 根因定位

```
HTTP 503 + cf-error-code 1102 "Worker exceeded resource limits"
  = Cloudflare 判定该 Worker 请求超出资源上限（CPU 时间 / 内存）
  ⇒ 与 robots / middleware / WAF / UA 规则 / Supabase 均无关
  ⇒ 唯一责任层 = Worker 执行层（.open-next/worker.js）
```

`/sitemap.xml` 另有一类 **500 `Internal Server Error`**（21 字节，非 CF 错误页）⇒ 属 **Worker 内 JS 抛异常**，与 1102 是**两种不同的失败**，需分开修。

**已知的、与资源消耗直接相关的代码事实（供 §6 用，本轮未改）**：

| 事实 | 数值 | 出处 |
|---|---|---|
| Workers 套餐 | **Free Website** | CF API `/zones/{id}` |
| Worker Startup Time | **20 ms** | `_deploy.log` |
| 9 语字典总体积 | **1.82 MB**（ar 242 KB / ja 220 KB / fr 211 KB / es 208 KB / de 204 KB / pt 203 KB / en 186 KB / zh 172 KB / zh-TW 172 KB） | `i18n/dictionaries/` |
| 字典加载方式 | 每语**动态 `import()`**（设计正确，但打包后 9 份都在 Worker bundle 里） | `i18n/getDictionary.ts` |
| `/sitemap.xml` | **动态生成**，434 KB（1233 URL × 9 hreflang） | 实测 |
| 首页 HTML | 82 KB | 实测 |
| Edge 缓存 | **无**（`cf-cache-status: -`） | 实测 |

---

## 3. PHASE 03｜实测到的 4xx（部分，非 Bing 官方清单）

| URL | Status | Location | 是否应存在 | 判定 |
|---|---|---|---|---|
| `/this-page-does-not-exist` | 404 | — | 否 | **正确** |
| `/suppliers/no-such-supplier-xyz` | 404 | — | 否 | **正确** |
| `/industry/no-such-industry` | 404 | — | 否 | **正确** |
| `/guides/no-such-guide` | 404 | — | 否 | **正确** |
| `/chemicals/no-such-chem` | 404 | — | 否 | **正确** |
| `/countries/no-such-country` | 404 | — | 否 | **正确** |
| `/services/no-such-service` | 404 | — | 否 | **正确** |
| `/nonexistent.html` | 404 | — | 否 | **正确** |
| `/api/lead`（GET） | 405 | — | 否 | **正确**（仅 POST） |
| **`/verify/report/NOTEXIST`** | **200** | — | 否 | ⚠️ **软 404**：不存在的验真 ID 返回 200 + 44 KB 页面。搜索引擎会记为 soft 404 |
| **`/en/`** | **308** | `/en` | 否 | ⚠️ **重定向链**：`/en/` →308→ `/en` →301→ `/`（2 跳） |
| `/en/pricing` | 301 | `/pricing` | 否 | 正确（语言去重） |
| `/zh/pricing` | 200 | — | 是 | 正确 |

**结论**：本仓库的 404 处理是**正确**的（真 404 返回真 404 状态码，未出现「404 当 200」）。发现的真实问题只有 **2 处**（软 404 + 重定向链）。

> ⚠️ 这**不是** Bing 报告的那 10 个 4xx。见 §5。

---

## 4. PHASE 02｜Bingbot vs Bing Site Scan

- 两者在**本仓库的代码层没有任何区分**（middleware 无 bot 逻辑）。
- 实测 **Bing Site Scan 使用的常规扫描 UA**（`Mozilla/5.0 (compatible; MSIE 9.0; ...)`）与 Bingbot 一样返回 200 ⇒ **未被专门拦截**。
- 因 §1.2 无权限，**无法确认**是否启用了「Fake Bing or MSN Bot」Managed Rule。**规格要求的「仅针对 Site Scan 的最小范围 exception」在能读到 WAF 之前无法落地**。
- **未发现**任何需要「把 Bing IP 写死进白名单」的证据；按规格要求，**本轮也没有这么做**。

---

## 5. BLOCKED：未能取得 Bing 官方三份清单

规格要求逐条列出 Bing 报告中的 **10 个 4xx / 3 个 5xx / 49 个 Title Too Long**。

`.env` 中仅有 `BING_SITE_VERIFICATION`（站点验证 token），**没有 Bing Webmaster API key** ⇒ 无法通过 API 拉取 Crawl Errors / Site Scan 报告。

因此：

| 项 | 状态 |
|---|---|
| 10 个 400–499 官方清单 | **BLOCKED** —— 需你在 Bing Webmaster 后台导出，或提供 API key |
| 3 个 500–599 官方清单 | **BLOCKED** —— 同上。但**失败类别已定位**（§2），无需等清单即可修 |
| 49 个 Title Too Long 官方清单 | **BLOCKED** —— 同上，需清单才能精确到 URL 级 |

---

## 6. 根因与建议修复（**尚未实施**，等你确认）

按规格第一原则，先给根因 + 风险 + 建议。

### 6.1 主因（5xx）

**Free 套餐 Workers 的 10 ms CPU 上限，对 OpenNext 渲染 Next.js 15 全站而言过低。**

- 证据：plan = Free Website（§1.2）；且 1102 连 1.2 KB 的 `/robots.txt` 也会中招 ⇒ 单请求 CPU 贴边。
- 风险：不动。
- 候选修复（按性价比排序）：
  1. **给 Worker 提 CPU 上限**（升级 Workers Paid，或若已是 Paid/或新套餐已放宽则确认当前 `limits.cpu_ms`）。**这是最可能一击解决的问题。**
  2. **加 Cloudflare Cache Rule 缓存 HTML**（当前完全无边缘缓存，每次请求都实打实 SSR）。对 SEO 页（`/`、`/pricing`、`/industry`、`/suppliers`）设短 TTL，可把绝大多数爬虫请求挡在 SSR 之外。
  3. **把 `/sitemap.xml` 由动态改为构建期生成 / ISR**（现在每次请求现算 434 KB × 1233 URL × 9 hreflang，是全站最重的路由之一）。
  4. **拆分字典加载**：9 语字典共 1.82 MB。已用动态 `import()`，但需确认打包后是否 9 份都进 Worker bundle；若可以，改为按需从 assets/外部取。

### 6.2 次因（`/sitemap.xml` 的 500）

- 症状：21 字节 `Internal Server Error`，属 Worker 内 JS 抛异常（**与 1102 不同**）。
- 现状：**无法定位具体堆栈**（`wrangler tail` BLOCKED）。
- 需要：提权 token 以便 tail，或 Cloudflare 后台 Workers Logs。
- **禁止**按规格要求（也按我的判断）把 500 改成 200 掩盖。

### 6.3 已确认的真实 SEO 缺陷（可独立修，低风险）

| # | 问题 | 位置 | 建议 |
|---|---|---|---|
| 1 | `/verify/report/{不存在的ID}` 返回 **200**（软 404） | `app/[locale]/verify/report/[verificationId]/page.tsx` | 未命中 ⇒ 返回真 404（或 `notFound()`） |
| 2 | `/en/` → 308 → `/en` → 301 → `/` 重定向链 | `middleware.ts` 的 matcher / Next trailingSlash | 让 `/en/` 直接 301 到 `/` |

### 6.4 未发现需要修改的项（**不需动**）

- `robots.txt` —— Bingbot 已放行，**不应为「修 Bing」而改动**（规格明确禁止「为了修 Bing 直接放开所有后台/API」）。
- `middleware.ts` —— 无 bot 逻辑，**无需改**。
- WAF —— 无证据表明它在拦 Bingbot，**不应关闭**（规格明确禁止）。
- Supabase —— 健康。

---

## 7. 本轮实际动作

**零修改。** 未改代码、未改 robots、未改 middleware、未改 WAF、未删除任何页面、未提交任何 commit。

新增文件仅为本审计与其只读探测脚本：

- `docs/BING-CRAWL-AUDIT.md`（本文件）
- `scripts/_bing_audit_01.mjs`（CF 控制面 + 线上 robots/sitemap）
- `scripts/_bing_audit_02.mjs`（token 权限探测 + UA 对比 + 全量普查）
- `scripts/_bing_audit_04.mjs`（限速普查）
- 日志：`_bing01.log` `_bing02.log` `_bing04.log` `_tail.log` `_bing_crawl.json` `_bing_nonok.json`

---

## 8. 需要你提供（解除 BLOCKED）

1. **Cloudflare 提权 token**（需含 `Zone:Read` + `Zone Settings:Read` + `Zone WAF:Read` + `Zone Analytics:Read`），或直接给后台截图：**Security → WAF → Custom rules / Managed rules、Security → Bots、Security → Events（筛选 bingbot）**。→ 用于确认「是否真有规则拦 Bingbot」并给出 Rule ID。
2. **Bing Webmaster 三份清单**（Crawl Errors 的 4xx/5xx 明细 + 49 个 Title Too Long 的 URL 列表），或 API key。
3. **Workers 套餐确认**（Free 还是 Paid）—— 因为 Free 的 10 ms CPU 上限基本可以单独解释全部 5xx。

---

## 9. 建议的下一步顺序（待你确认后执行）

```
1. 先止住 5xx（§6.1 — 这是 Bing 抓取失败的真因，SEO 标题是次要的）
2. 修 /sitemap.xml 的 500（§6.2，需日志权限）
3. 修软 404 + 重定向链（§6.3，低风险、可立即做）
4. 拿到 Bing 三份清单后，再做 4xx 逐条归因 + 49 个标题修复（PHASE 06）
5. 最后才是 PHASE 05 的 Bing Live URL 验证
```

> 规格要求「PHASE 07 跑 lint / typecheck / build」：`eslint` 未安装且沙箱内 `npm install` 被拦 ⇒ **lint BLOCKED**；`npm run typecheck` / `test` / `e2e` 脚本**不存在**；`build` 上一轮已 PASS 并可复跑。build 与提交待「止住 5xx」之后一并做，避免在故障期产出无意义的绿灯。
