# 阶段 1 ｜ 第 ⑦ 步部署 + 部署后验收报告

> 项目：factoryauditb2b.com ｜ 工作区 `F:\AI-验厂SEO网站`  
> 执行时间：2026-09-29 13:40–13:52 (GMT+8)  
> 部署前锚点：`846c876`（用户指定）→ `717ce45`（阶段1验收报告）→ **`4098838`**（报告排版归一）  
> 构建产物：`.next` BUILD_ID `4e_WSrR_9PVAIrAUxMcmU`，`.open-next` 2199 个 assets

---

## 1. 部署结果：✅ 成功

| 项           | 值                                                     |
| ----------- | ----------------------------------------------------- |
| Worker      | `factoryauditb2b`                                     |
| **新版本 ID**  | **`6facaae8-a8f1-44fd-ba93-2caaa254a23d`**            |
| 版本创建时间      | 2026-09-29T05:44:00Z（= 13:44 CST）                     |
| 部署开始 / 结束   | 13:40:15 CST / 13:44:04 CST（**耗时 3m50s**）             |
| 资源上传        | 2015 个（184 个已存在）｜ 总计 19189.83 KiB，gzip 3107.09 KiB    |
| Worker 启动时间 | **32 ms**                                             |
| 绑定          | `IMAGES` / `ASSETS` / `SUPPLIER_DATA_SOURCE=supabase` |
| workers.dev | <https://factoryauditb2b.factoryauditb2b.workers.dev> |
| 生效状态        | `deployments status` = **100% 指向 `6facaae8`** ✓       |
| 部署前线上版本     | `943cae8c-cd08-4df2-8257-7332edd1af64`（= 回滚锚点）        |

**前置确认**：工作树最初**非空**——`outputs/stage1-final-report.md` 存在未提交改动。核查后确认是**纯 Markdown 表格格式化**（单元格补齐空格、`<br>`→`<br />`、表前后加空行），无语义变化，且在 `outputs/` 内不参与构建。已单独提交 `4098838` 使工作树干净后再部署（未触碰任何构建输入）。

**命令**（本机 `spawnSync` 恒 EBUSY，故绕过 `cf-release.cjs` 手动执行）：

```bash
set -a && . ./.env && set +a
export OPEN_NEXT_DEPLOY=true NODE_OPTIONS=""
node node_modules/wrangler/bin/wrangler.js deploy
```

---

## 2. 六项验证逐项结果

### ✅ 2.1 线上 `/robots.txt` 合并文本 —— PASS（CF 托管段未抵消例外）

全文 145 行 / 2147 字节。**26 个 User-Agent 组**，分两类：

- **13 组**（12 命名 UA：Googlebot / Bingbot / Applebot / YandexBot / SeznamBot / DuckDuckBot / OAI-SearchBot / ChatGPT-User / PerplexityBot / PerplexityBot-User / Claude-SearchBot / Claude-User，**加 `*`**）每组均含：
  ```
  Allow: /
  Allow: /suppliers?q=
  Disallow: /api
  Disallow: /admin
  Disallow: /staging
  Disallow: /*?
  ```
- **13 组** AI 训练爬虫（GPTBot / ClaudeBot / CCBot / Bytespider / Google-Extended …）为 `Disallow: /`

断言结果：`Allow: /suppliers?q=` **出现 13 次** ＝ 组数（全命中）✓；`Disallow: /*?` **仍出现 13 次**（未丢失）✓；`Host` + `Sitemap` 正常 ✓。

🔎 **关键结论：CF 托管段（Content-Signal / 平台级 robots 注入）并未出现在合并文本中**，首组即 `User-Agent: Googlebot`（本站 `app/robots.ts` 输出）。因此此前担心的「CF 托管段在前抵消 `Allow: /suppliers?q=`」**未发生**，无需暂停。

### ✅ 2.2 线上 10 页 HTML 复验 —— ALL PASS（全部 11 组断言 × 10 页）

| URL                               | title        | desc          | canonical 自指 | hreflang | JSON-LD | 本地⇄线上逐字一致 |
| --------------------------------- | ------------ | ------------- | ------------ | -------- | ------- | --------- |
| `/`                               | 55 ✓         | 143 ✓         | ✓            | 10 ✓     | 2 ✓     | ✓         |
| `/suppliers`                      | 58 ✓         | 148 ✓（新双句）    | ✓            | 10 ✓     | 2 ✓     | 动态页，跳过    |
| `/services/supplier-verification` | **47 ⚠**     | 145 ✓         | ✓            | 10 ✓     | 2 ✓     | ✓         |
| `/logistics`                      | 60 ✓         | 153 ✓         | ✓            | 10 ✓     | 2 ✓     | ✓         |
| `/trust`                          | 58 ✓         | 158 ✓         | ✓            | 10 ✓     | 2 ✓     | ✓         |
| `/tools/compare`                  | **82 ⚠**     | 132 ✓         | ✓            | 10 ✓     | 2 ✓     | ✓         |
| `/zh`                             | 28 ✓（CJK≤36） | 60 ✓（CJK≤90）  | ✓            | 10 ✓     | 2 ✓     | ✓         |
| `/ar`                             | 51 ✓         | 140 ✓         | ✓            | 10 ✓     | 2 ✓     | ✓         |
| `/pricing`                        | 52 ✓         | **154 ⚠ 半句话** | ✓            | 10 ✓     | 2 ✓     | ✓         |
| `/monitoring`                     | 51 ✓         | 151 ✓         | ✓            | 10 ✓     | 2 ✓     | ✓         |

- **canonical 全部自指**（站点统一不带尾斜杠，根路径即裸域名 `https://factoryauditb2b.com`）
- **hreflang 每页 10 条**：`en / zh-CN / zh-Hant / ja / es / de / fr / pt-BR / ar / x-default`（用 `hrefLang` 大写 L + **BCP-47 码**，非 URL 段的 `zh`/`zh-TW`/`pt`）
- **JSON-LD 每页 2 块，全部可 `JSON.parse`**
- **title/desc 与本地预渲染产物逐字一致** ⇒ 证明上线内容就是本次构建，且预渲染缓存生效

**缓存命中证据**：9 个预渲染页返回 `x-opennext-cache: HIT`（预渲染产物直出，不进 Worker）；`/suppliers` 为动态渲染，无该头（符合预期）。

⚠ 两处标注：`/tools/compare` title 82（超 60 上限）与 `/services/supplier-verification` title 47（低于 50 下限）——**清单外既有项，本轮未动**（详 §3.3）。`/pricing` desc 154 属 §3.2 的系统性缺陷。

### ✅ 2.3 `/about` 重定向 —— PASS

| 请求          | 结果                    |
| ----------- | --------------------- |
| `/about`    | **308** → `/trust`    |
| `/zh/about` | **308** → `/zh/trust` |
| `/en/about` | **308** → `/trust`    |

### ✅ 2.4 `/supplier-assessment` noindex —— PASS

`<meta name="robots" content="noindex, nofollow">` ✓

### ⚠️ 2.5 IndexNow 提交 —— 通过，但只提交了 44 条

```
sitemap: total=1746  new=44  removed=17
  ✓ IndexNow accepted by api.indexnow.org (200)
  ✓ IndexNow accepted by yandex.com (202)
  · Google Indexing API: GOOGLE_SERVICE_ACCOUNT_JSON 未设置 —— 跳过
  ✗ GSC sitemap ping -> fetch failed
```

- 44 条新 URL（3 篇新指南 × 9 语 + `verify-supplier` × 9 语 + 7 个语种根 + `/zh`…）
- `removed=17` 含 `/about` × 9（**有意移除**，已 308）与 8 个语种根尾斜杠写法（归一化）
- ⚠ **重要**：IndexNow 是**增量提交**（与 `scripts/.sitemap-cache.txt` 基线比对），本次只推了 44 条；**本次改动元数据的数百个既有页面并未重新提交**。若要促使搜索引擎重抓元数据，需另做一次**全量 1746 条**提交。
- Google 通道仍不可用（无 service account、GSC ping 不可达）——与既往结论一致，IndexNow 是唯一出口。

### ✅ 2.6 Bing 验证文件 —— PASS

```
https://factoryauditb2b.com/8e708d6e369101716343b41b203af094.txt
→ HTTP/1.1 200 OK  Content-Type: text/plain
→ body: 8e708d6e369101716343b41b203af094
```

（`wrangler.jsonc` 的 `html_handling: "none"` 保证 `.txt` 以原名直出 200）

---

## 3. 异常

### 3.1 部署后健康巡检 —— 无 5xx

抽 29 条路径：**全部 200**，除 `/suppliers`（动态）外均 `x-opennext-cache: HIT`。  
（`/tools/container-loading-calculator` 返回 404 是我猜的路径不存在 —— 装柜计算器实际是 `/logistics`，sitemap 中亦无该路径。）

覆盖：`/` `/suppliers` `/guides` `/guides/what-is-a-factory-audit` `/countries/china` `/industry/chemicals` `/case-studies` `/field-reports` `/tools` `/tools/compare` `/pricing` `/trust` `/monitoring` `/logistics` `/services/inspection` `/rfq` `/custom-services` `/zh` `/ar` `/ja` `/zh-TW` `/verify-supplier` `/resources` `/methodology` `/careers` `/training-plans` `/robots.txt` `/sitemap.xml`

### 3.2 🔴 系统性缺陷（**本次部署未引入，属既有**）：379/1885 预渲染页面 desc 被截断成「半句话」

新探针 `scripts/desc-truncation-sweep.cjs` 扫描已部署的 1886 个预渲染 HTML，断言「desc 结尾是否有句末标点」，命中 **379 项**：

| 板块            | 数量      | 板块                         | 数量    |
| ------------- | ------- | -------------------------- | ----- |
| **guides**    | **238** | careers                    | 5     |
| countries     | 30      | pricing                    | 5     |
| case-studies  | 28      | tools                      | 5     |
| field-reports | 28      | methodology                | 3     |
| industry      | 24      | verify-supplier            | 2     |
| services      | 8       | resources / training-plans | 2 / 1 |

语种分布：es 62 / fr 57 / pt 56 / de 55 / en 54 / ar 50 / ja 45 —— **zh、zh-TW 为 0**（CJK 预算 90 未触发收口，故 CJK 全部完整）。

典型样本：

- `en/pricing` 154 → `…inspection from USD 199 and supplier monitoring by`
- `en/countries/vietnam` 148 → `…verification and audit considerations, industries`
- `en/guides/how-to-verify-a-chinese-supplier` → 截断（47 篇指南 × 7 语 = 238 项中的主体）

**根因**：源头 desc 是**一整句且总长 > 158**，`trimMetaDescription` 在预算内找不到句末标点 ⇒ 退化为**词边界截断**。  
**证据**：`lib/guides.ts` 的 47 条 `metaDescEn` 长度 138–249，且 **47/47 都以句号结尾** —— 源头本身完整，是收口函数截掉的。

**两项衍生问题**：

1. 其中 **6 项属阶段 1 在册**（`serviceVerification.metaDesc` es、`risk.page.metaDesc` en/es/de/fr/pt），计划已明确接受收口；**其余 373 项为清单外**。
2. `lib/guides.ts` 只有 `metaDescEn` / `metaDescZh` 两个字段 ⇒ **es/de/fr/pt/ja/ar 的指南页（204 页）显示英文描述**（`pickZhPair` 对非 zh 语种回退 `metaDescEn`）；case-studies / field-reports / industry 同现象。

**修法（勿改收尾策略）**：把源头 desc 改为**双句结构、总长 ≤ 预算**（拉丁 158 / CJK 90），使收口零命中。  
**建议**：优先 `/guides`（238 项，占 63%，且仅需改 47 条源头即可一次性覆盖 7 语 × 34 篇）；其次 countries / case-studies / field-reports / industry。

### 3.3 清单外 title 越界（本轮未动）

| 页面                                | title 长度 | 问题                                     |
| --------------------------------- | -------- | -------------------------------------- |
| `/tools/compare`                  | **82**   | 超上限 60（被 `trimMetaTitle` 的「主体 65」闸门放行） |
| `/services/supplier-verification` | **47**   | 低于下限 50（en），另 de 36 / ar 42            |

其余既往记录项（`/terms` 28–42、`/guides` 46、`/industry` 28、`/countries` 43 等）未在本轮 10 页抽样中复现，仅在早前预渲染探针中出现。

---

## 4. 回滚

**A. 回滚 Worker 到上一版本（推荐，秒级、可逆）**

```bash
cd /f/AI-验厂SEO网站
set -a && . ./.env && set +a
node node_modules/wrangler/bin/wrangler.js rollback 943cae8c-cd08-4df2-8257-7332edd1af64 \
  --name factoryauditb2b -y -m "rollback stage1 metadata deploy"
```

或直接回滚到「上一个版本」：`node node_modules/wrangler/bin/wrangler.js rollback --name factoryauditb2b -y`

**B. 回滚源码（如只需撤销本轮文档提交，不影响线上）**

```bash
git revert --no-edit 4098838    # 仅撤销报告排版归一
git revert --no-edit 717ce45    # 撤销阶段1验收报告
```

> 注意：源码 revert **不会**改变线上内容——线上由 `wrangler deploy` 的版本决定；改源码后必须重建 + 重部署才生效（预渲染即数据冻结）。

**C. 完全回退到阶段 1 之前**  
线上锚点 `943cae8c` 即阶段 1 上线前的版本，用 A 即可。

---

## 5. 本轮新增的常驻工具（可复用）

| 脚本                                  | 用途                                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `scripts/desc-truncation-sweep.cjs` | 全站 desc「半句话」体检（离线，扫描 `.next/server/app`）。`--assert` 时有命中即 exit 1，可挂回归。这是**长度断言抓不到**的缺陷类。                    |
| `scripts/live-meta-verify.cjs`      | 部署后线上验收：抽页抓 live HTML，断言 canonical 自指 / hreflang 9 语 + x-default / JSON-LD 可解析 / **title·desc 与本地预渲染逐字一致**。 |

用法：

```bash
node scripts/desc-truncation-sweep.cjs            # 报告
node scripts/desc-truncation-sweep.cjs --assert   # 作为闸门
node scripts/live-meta-verify.cjs                 # 默认 10 页
node scripts/live-meta-verify.cjs / /trust /zh    # 自定义
```

---

## 6. 待您决策

1. **379 项 desc 半句话是否开工修**？建议**先只修 `/guides` 的 47 条源头**（一次覆盖 238 项、占 63%），改动面小、收益最大。
2. **是否用全量 1746 条重提一次 IndexNow**（否则本次元数据改动不会被主动重抓）。
3. **`/tools/compare`（82）与 `/services/supplier-verification`（47）两个 title 是否一并收口**。
4. 六项验证**全部通过，无阻塞项**；robots 合并文本正常，按您指示**未做任何修改**。
