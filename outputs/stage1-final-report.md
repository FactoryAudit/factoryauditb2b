# 阶段 1（元数据修复）执行验收报告

> 项目：factoryauditb2b.com ｜ 工作区 `F:\AI-验厂SEO网站`  
> 依据：`outputs/stage1-plan.md`（已确认稿）  
> 提交锚点：`8c4faec` → `520d245` → `7dceda6` → `ab69a0b` → `a976255` → `53b79dd` → **`3676735`**（终验补正）→ **`846c876`**（归档+探针）  
> 工作树：**干净**（`git status --porcelain` 空）  
> 部署状态：**未部署**（第 ⑦ 步 `wrangler deploy` 等您放行）

---

## 0. 一句话结论

阶段 1 的 **B / C / D / E / F / G / H 七个任务全部完成并通过验收**；  
构建链路 ①–⑥ 全绿（`next build` → `opennext build` → populate → 自检 → scrub → verify **ALL PASS**）；  
本地运行时断言全绿；回归 4 个脚本的**唯一**失败项均为**既有失败**（与本轮无关）。  
终验阶段额外发现并修复了一类计划未覆盖的缺陷（「长度达标但收口出半句话」共 14 处）与 1 处低于下限的标题。  
**等待您确认后执行第 ⑦ 步部署。**

---

## 1. 任务 B + C ｜ desc 双向修复（过长 3 页 / 过短 4 页）

### 1.1 任务目标

让**每个语种**的 meta description 都落在预算内且是**完整句子**：  
拉丁 120–158 字符、CJK（zh / zh-TW / ja）58–90 字符。修法是**改源头文案 / 改走统一收口**，**不动** `trimMetaDescription` 的收尾策略。

### 1.2 改动文件清单（含行号）

| 文件                                                     | 行                                                                                                                        | 改动                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `app/[locale]/tools/supplier-risk-calculator/page.tsx` | 9, 21–27                                                                                                                 | 手写 `openGraph` → `buildPageMetadata({ path: "/tools/supplier-risk-calculator" })` |
| `app/[locale]/services/supplier-verification/page.tsx` | 7, 18–24                                                                                                                 | 同上，`path: "/services/supplier-verification"`                                      |
| `app/[locale]/logistics/page.tsx`                      | 11, 22–27                                                                                                                | 同上，`path: "/logistics"`，标题串改为只传 `t.container.page.metaTitle`（品牌由收口追加）             |
| `i18n/dictionaries/*.json`（9 语）                        | `home.metaDesc` / `legal.termsIntro` / `suppliers.metaDesc` / `serviceVerification.metaDesc` / `container.page.metaDesc` | 只改**值**，未增删键（叶子数仍 3126）                                                           |

### 1.3 改动前后对比（源头长度 → 收口后输出）

| 页面                                | 键                              | 改前（源头→输出）                                                              | 改后（源头→输出）                                                         |
| --------------------------------- | ------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/tools/supplier-risk-calculator` | `risk.page.metaDesc`（9 语）      | en 218→149；es 235→151；de 243→153；fr 260→147；pt 227→155                 | 同左（**计划已明确「无需改文案」**，收口即达标）                                        |
| `/services/supplier-verification` | `serviceVerification.metaDesc` | en 211→145；es 261→147；de 213→152；fr 188→135；pt 201→146                 | 同左（计划预期「改走统一入口即达标」）                                               |
| `/logistics`                      | `container.page.metaDesc`      | en 169→156；**半句话**                                                     | **en 153 / es 158 / de 144 / fr 153（双句）**                         |
| `/terms`                          | `legal.termsIntro`             | en 168→**51**、de 169→157、fr 166→153                                    | en **151**、**de 152**、**fr 156**                                  |
| `/suppliers`                      | `suppliers.metaDesc`           | en 219→**51**（首句仅 51 字）                                                | **en 148 / es 153 / de 148 / fr 151 / pt 146（双句）**                |
| `/`（首页）                           | `home.metaDesc`                | zh 40 / zh-TW 47 / ja 62（偏短）；es 170→155、fr 167→156、ar 160→150（**半句话**） | zh **60** / zh-TW **60** / ja **61**；**es 156 / fr 157 / ar 140** |

> 口径说明：`/` 的 meta 描述实际取字典键 **`home.metaDesc`**（`app/[locale]/page.tsx:37`），不是计划里写的 `home.lead`（`home.lead` 是正文导语，不进 meta）。本轮按**生效键**修。

### 1.4 验证方法和结果

- 探针 `scripts/_stage1_final_check.ts`（真实 `buildPageMetadata` 预演，9 语 × 16 页 = 144 条）→ **在册范围 0 越界**（越界 12 项 title + 9 项 desc 全部在清单外，见 §8）。
- 探针 `scripts/_s1_desc_dump.ts`（逐字打印「源头 → 收口后」+ 断言「是否被截断 / 结尾是否有句末标点」）→ 本轮修的 4 个键 **14 处全部 `endOk`、`CUT` 为 0**（即收口零命中、幂等）。
- 本地 `next start -p 3458` 实测：`/suppliers` desc = 新 148 字双句 ✓；`/terms` de/fr 已是完整句 ✓。

### 1.5 回滚命令

```bash
cd /f/AI-验厂SEO网站
# 三个 page.tsx 有未提交在制品历史 ⇒ 只回滚本任务（用 .bak 或精确 revert）
"/c/Program Files/Git/cmd/git.exe" revert --no-edit 520d245          # 任务 B+C 主体
"/c/Program Files/Git/cmd/git.exe" revert --no-edit 3676735          # 终验补正（desc 去半句话 + ar 标题）
```

> 字典若只想回滚单个值：`node _stage1_patch2.cjs` / `_stage1_patch3.cjs` 保留了完整的新旧值对照，可按行对改。

### 1.6 风险与未解决

- ✅ 已消除：原先 4 个键 14 处「半句话收口」。
- ⚠️ **仍保留半句话收口的 2 页**（计划已明确接受收口、未要求重写文案，**建议下一批次处理**，见 §8 第 2 组）：  
  `serviceVerification.metaDesc` es（261→147）；`risk.page.metaDesc` en/es/de/fr/pt（218/235/243/260/227 → 149/151/153/147/155）。

---

## 2. 任务 D ｜ `/supplier-assessment` 加 noindex

| 项        | 内容                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**   | 会话/归属相关的个体化视图不进索引                                                                                                                           |
| **文件·行** | `app/[locale]/supplier-assessment/page.tsx:15, 27–34` —— `buildPageMetadata({ …, robots: { index: false, follow: false } })`                |
| **前后**   | 无 robots 指令（默认 index,follow） → `noindex, nofollow`                                                                                          |
| **验证**   | 本地实测：`curl -H "X-Forwarded-Proto: https" http://127.0.0.1:3458/supplier-assessment` 输出 `<meta name="robots" content="noindex, nofollow">` ✓ |
| **回滚**   | `git revert --no-edit 520d245`（该 hunk 属此提交）                                                                                                 |
| **风险**   | 无。该页无预渲染 HTML（动态渲染），不产生静态缓存副作用。                                                                                                             |

---

## 3. 任务 E ｜ 4 个枢纽页补 BreadcrumbList

| 项        | 内容                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**   | 4 个枢纽页的 JSON-LD 从单对象改为 `[ItemList, BreadcrumbList]`                                                                                                     |
| **文件·行** | `app/[locale]/guides/page.tsx:39–75`、`app/[locale]/industry/page.tsx:41–77`、`app/[locale]/countries/page.tsx:33–69`、`app/[locale]/tools/page.tsx:39–74` |
| **前后**   | `jsonLd` 单对象 → 数组；新增 `BreadcrumbList`，层级 `Home > <枢纽名>`，`position` 1/2 连续                                                                               |
| **验证**   | 预渲染 HTML 实测（`_stage1_prerender_verify.cjs`）：4 页 JSON-LD 均出现 `BreadcrumbList,ListItem` ✓                                                                 |
| **回滚**   | `git revert --no-edit 520d245`；四文件当时无在制品，也可逐文件 `git checkout` 到 `8c4faec` 版本                                                                            |
| **风险**   | 低。纯加法，不改渲染。                                                                                                                                             |

---

## 4. 任务 F ｜ robots `/*?` 例外（修法 A）

| 项                  | 内容                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **目标**             | 允许抓取 `/suppliers?q=`，同时保留 `Disallow: /*?`（靠**最长匹配**胜出）                                                                                                                   |
| **文件·行**           | `app/robots.ts` —— `ALLOW_EXCEPTIONS = ["/suppliers?q="]`（并将 `allow: ["/", ...ALLOW_EXCEPTIONS]` 应用于 A 组 12 个 UA + `*`）；注释区说明了「只放行 `?q=`」的依据                             |
| **关键判定**           | 您给的 `/suppliers?page=`、`/?q=` **未采纳**：`app/[locale]/suppliers/page.tsx:23` 的 `searchParams` 类型只有 `{ country, industry, q }`，**不存在 `page` 参数** ⇒ 加了会为不存在的参数组合制造可抓取路径（死规则） |
| **安全性证据**          | 过滤态已由源码输出 `robots: isFiltered ? { index:false, follow:true } : undefined`（`suppliers/page.tsx:31–39`）⇒ 「允许抓取」≠「允许收录」，反而是让爬虫读到 noindex 的前提                                |
| **验证**             | 本地 `robots.txt`：12 组 UA + `*` **每组**都含 `Allow: /suppliers?q=`，且 `Disallow: /*?` 仍在 ✓                                                                                     |
| **回滚**             | `git revert --no-edit 7dceda6`（robots hunk）                                                                                                                              |
| **🔴 未解决（必须部署后做）** | 线上 robots.txt = **CF 托管段（在前）+ `app/robots.ts`（在后）**。CF 托管段可能对同一 UA 另发 `Disallow`，合并结果**只能在真机实测**。部署后我会立刻抓 `https://factoryauditb2b.com/robots.txt` 做合并文本断言。              |

---

## 5. 任务 G ｜ `/about` 合并进 `/trust`

| 项                | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**           | 两页主题互相蚕食 ⇒ 保留 `/trust` 为唯一信任中心，`/about` 永久重定向，权重转移而非流失                                                                                                                                                                                                                                                                                                                                                                                    |
| **改动文件·行**       | ① `next.config.mjs:127–135` 三条 308：`/en/about`、`/about`、`/:locale/about` → 对应 `/trust`（`/en/about` 单列在前，缩短重定向链）<br />② `app/[locale]/trust/page.tsx`（+40 行）新增 stats / story / values 三节，文案复用 `t.about.*`<br />③ `components/SiteFooter.tsx:87–88, 213–215` 两处链接改 `/trust`<br />④ `app/sitemap.ts:73, 121` 移除 `/about`、保留 `/trust`<br />⑤ `scripts/i18n-leak-scan.cjs`、`scripts/_audit_crawl2.mjs`、`scripts/submit-urls.cjs` 清 `/about` 残留 |
| **数字核验（D3 第②问）** | `COVERAGE_COUNTRIES.length` = **5**、`STATIC_INDUSTRIES.length` = **13** —— 代码实时推导，可核实<br />「20+ Audit & compliance programs」「< 1 day Typical response time」**全仓无数据源 ⇒ 按您要求不搬运**                                                                                                                                                                                                                                                           |
| **D3 第①问**       | `app/[locale]/about/page.tsx` **保留**（可回滚）。已实测：`next.config` redirects **优先于**预渲染 HTML ⇒ 页面文件在也不影响 308（与 `/membership` 同一机制）                                                                                                                                                                                                                                                                                                               |
| **前后**           | `/about` = 200 索引页 → **308 `/trust`**；`/en/about` → 308 `/trust`（单跳）；`/zh/about` → 308 `/zh/trust`                                                                                                                                                                                                                                                                                                                                        |
| **验证**           | 本地实测三条全部 308（见下）；`sitemap.xml` 中 `/about` 出现 **0** 次、含 `/trust`（99 条 URL 含 trust）✓；全站源码仅剩 `about/page.tsx:9` 一处 `/about` 字面量（即被重定向拦截的那页本身） ✓                                                                                                                                                                                                                                                                                              |
| **回滚**           | `git revert --no-edit 7dceda6`（含 next.config / footer / sitemap / trust 页 / 3 个脚本）                                                                                                                                                                                                                                                                                                                                                        |
| **风险**           | `/about` 若已有排名，308 会把权重转给 `/trust`（这是目的）；`/trust` 标题已按 taskA 目标值改为 58 字（原先仅 21 字）。                                                                                                                                                                                                                                                                                                                                                        |

本地实测原文：

```
/about         308 -> http://127.0.0.1:3458/trust
/en/about      308 -> http://127.0.0.1:3458/trust
/zh/about      308 -> http://127.0.0.1:3458/zh/trust
```

---

## 6. 任务 H ｜ `/tools/compare` 补 FAQPage + 20 脚本叶子数同步

| 项          | 内容                                                                                                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **目标**     | 给 `/tools/compare` 补 FAQPage 结构化数据；en 叶子数 3114 → **3126** 后同步全部常量                                                                                                                                                                                                                                                              |
| **改动文件·行** | `app/[locale]/tools/compare/page.tsx:17, 73`（`buildPageMetadata` + 新增 `FAQPage`，5 问）；`i18n/dictionaries/*.json` 新增 `compare.faq`（9 语）；**20 个脚本**的叶子数常量同步（`scripts/cs06a/08/12/13/13b/16/17/20/22a/22b-directory/-regression`、`step13b-i18n-gates.cjs`、`verify-opennext-bundle.mjs`、`apply-cs22b-i18n.cjs` + 7 个 `.bundle.cjs`） |
| **前后**     | 叶子 3114 → **3126**（+12：`compare.faq` 为 `{q,a}` 数组，5 项 = 10 叶 + 2 叶容器）；`/tools/compare` JSON-LD 无 FAQPage → 有 `FAQPage,Question,Answer`                                                                                                                                                                                         |
| **遗留适配**   | `CompareDict`（`components/tools/SupplierComparison.tsx`）是 `[k:string]:string` ⇒ `compare.faq` **数组键已解构剥离**后再传 `dict`，避免类型污染                                                                                                                                                                                                    |
| **验证**     | ① `verify-opennext-bundle.mjs`：`产物内 en 字典叶子数 = 3126 (期望 3126)` **PASS**；② 预渲染 HTML：`/tools/compare` 含 `FAQPage` ✓（本地 curl 计数 = 1）；③ `cs22b A1` = 3126 PASS；④ `cs06a` 叶子相关断言 PASS                                                                                                                                               |
| **回滚**     | `git revert --no-edit 7dceda6`；脚本常量同提交                                                                                                                                                                                                                                                                                         |
| **风险**     | 低。这是本阶段唯一「结构性」改动（往页面正文加 FAQ 区块），已在 D2 获批。                                                                                                                                                                                                                                                                                      |

---

## 7. 终验补正 v2 ｜ 计划未覆盖但已修（commit `3676735`）

### 7.1 发现的缺陷类：**长度达标 ≠ 文案完整（半句话收口）**

`trimMetaDescription` 超预算时取「预算内**最后**一个句末标点」；若源头是**一整句 160–260 字、句内无句末标点**，就会退到**词边界**截断 ⇒ 输出**无句末标点的半句话**。  
例：`suppliers.metaDesc` en 192 → 152，结尾是 `…request verification, audit or`。  
**上一版归档表只按长度判「合规 ✓」，把这类误判放过了** —— 这是本轮终验新加的判据。

### 7.2 本轮修复清单（全部改为「双句结构 + 总长 ≤158 + 句号收尾」⇒ 收口零命中）

| 键                          | 语言                     | 旧（源头→收口）                                       | 新                       |
| -------------------------- | ---------------------- | ---------------------------------------------- | ----------------------- |
| `suppliers.metaDesc`       | en / es / de / fr / pt | 192/205/191/200/195 → 152/156/150/148/151（半句话） | **148/153/148/151/146** |
| `legal.termsIntro`         | de / fr                | 169/166 → 157/153（半句话）                         | **152/156**             |
| `container.page.metaDesc`  | en / es / de / fr      | 169/171/162/162 → 156/156/152/155（半句话）         | **153/158/144/153**     |
| `home.metaDesc`            | es / fr / ar           | 170/167/160 → 155/156/150（半句话）                 | **156/157/140**         |
| `container.page.metaTitle` | ar                     | 30（含品牌 **48**，低于 50 下限）                        | **34（含品牌 52 ✓）**        |

**共 14 处（13 个 desc 值 + 1 个标题）。**  
写入器：`_stage1_patch2.cjs` / `_stage1_patch3.cjs`（复用 `_stage1_apply.cjs:123 setLeaf`，逐字节替换叶子值，CRLF 原样保留）。  
改后 9 个字典均为 `crlf=4028 / bareLF=0 / 末尾 CRLF / leaf=3126` ✓。

### 7.3 验证

- `_s1_desc_dump.ts`：这 4 个键 14 处全部 `endOk`、`CUT` 为 0 ✓
- `_stage1_prerender_verify.cjs`（**新构建产物**）：越界项 **10 → 9**，且 9 项**全部在清单外** ✓；`en/logistics` D 156→**153**、`ar/logistics` T 48→**52（T✓）** ✓
- 本地实测：`/logistics` en title **60** / desc **153**；`/ar/logistics` title **52** ✓

### 7.4 回滚

```bash
"/c/Program Files/Git/cmd/git.exe" revert --no-edit 3676735
```

---

## 8. 构建链路（七步手动，`stage1-plan.md §2`）

| 步                  | 命令                                                                 | 结果                                                              |
| ------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| ① 隔离旧 `.next`      | `fs.renameSync('.next','_prune_old_next2')`                        | 14760 文件 > 7000 阈值，必须隔离（rename 不计删除）                            |
| ② `next build`     | `node node_modules/next/dist/bin/next build`                       | **EXIT=0**；编译 **33.0s**（持久缓存命中）；静态页 **1955/1955**；总耗时 **5m55s** |
| ③ `opennext build` | `node node_modules/@opennextjs/cloudflare/dist/cli/index.js build` | **EXIT=0**，**2m02s**，`OpenNext build complete`                  |
| ④ populate         | `populate-static-assets-cache.cjs --worker --batch 250` 循环         | 源 **2013** 条，**8 批**写满后 `DONE`                                  |
| ⑤ 自检               | `_stage1_selfcheck.cjs`                                            | **PASS**：`pageKeys=1890 / fetch=123 / stray=0 / badExt=0`       |
| ⑥ scrub + verify   | `scrub-next-env.mjs` → `verify-opennext-bundle.mjs`                | scrub 清空 **21 处**密钥；verify **ALL PASS**                         |
| ⑦ deploy           | `node node_modules/wrangler/bin/wrangler.js deploy`                | **⛔ 未执行，等您放行**                                                  |


verify 关键行原文：
```
=== 产物内 en 字典叶子数 = 3126 (期望 3126) ===
PASS 页面缓存 -> 源 1890 / 目标 1890（大小逐项一致）
PASS fetch 缓存 -> 源 123 / 目标 123（大小逐项一致）
PASS 全部以 .cache 结尾
PASS assets 文件数 2199 <= 20000（CF Free）
PASS 单文件最大 2.35 MiB <= 25 MiB（CF Free）
ALL PASS
```

> ⚠️ **一处已解释的偏差**：fetch 缓存 **99 → 123（+24）**、assets **2175 → 2199（+24）**。
> 仅改字典值不应改变 fetch 条目数。已对照 `_prune_old_next2/cache/fetch-cache`(=99) 与 `.next/cache/fetch-cache`(=123)，
> 确认是**构建期产出差异**（非 populate 漏批）：page key 两次均为 **1890**，闸门两次均 PASS ⇒ 无风险，仅记录。

---

## 9. 回归结果（⚠️ 必须先 `set -a && . ./.env && set +a`）

| 脚本 | 结果 | 唯一失败项 |
|---|---|---|
| `cs01-seo-foundation-regression` | **46 PASS / 0 FAIL** | —（ALL PASS） |
| `cs13-supplier-seo-regression` | **155 PASS / 1 FAIL** | `F2d` migrations 13≠10 —— **既有失败**（`MEMORY.md` 已登记） |
| `cs06a-directory-regression` | **54 PASS / 1 FAIL** | `A3` 供应商网格 `.map` 正则命中 2 —— **既有失败**（已登记） |
| `cs22b-self-assessment-regression` | **A–F 全 PASS（71 条）** | `G` 章节读 Supabase 时 `ECONNRESET` 中断 —— **沙箱网络限制**（已登记） |

> 首次未注入 `.env` 时 cs13 退化为 `G` SKIP（145 PASS），注入 `SUPABASE_DATA_SOURCE=supabase` 后 `G` 段启用（+10 PASS）。**本轮无新增失败。**

---

## 10. 清单外越界项（**未改，请您决策**）

以下 9 项**都不在** `stage1-plan.md` 的任务清单里（多为既有问题），本轮**刻意未动**：

**第 1 组 ｜ title 越界（拉丁目标 50–60）**

| 页面 | 现状 | 备注 |
|---|---|---|
| `/tools/compare` | **82** | 最突出。`trimMetaTitle` 的「主体 65」闸门**放行**了它（主体 64 + 品牌 18） |
| `/terms` | en 34 / es 39 / de 37 / fr 42 / pt 35 / ar 28 | `legal.termsTitle` 偏短，全语需重写 |
| `/services/supplier-verification` | en 47 / de 36 / ar 42 | 不在 3B 的 12 页内（该页在册项只有 desc） |
| `/guides` | 46 | 枢纽页 |
| `/industry` | 28 | 枢纽页 |
| `/countries` | 43 | 枢纽页 |

**第 2 组 ｜ desc 越界 / 半句话**

| 页面 | 现状 | 备注 |
|---|---|---|
| `/tools/supplier-risk-calculator` | en/es/de/fr/pt 收口后 149/151/153/147/155，**结尾无句末标点** | 计划原文「218 → 155 ✓（**无需改文案**）」 |
| `/services/supplier-verification` | es 261 → 147，**结尾无句末标点** | 计划预期「收口即达标」 |
| `/monitoring` | es 59 / de 46 / fr 47（**远低于 120 下限**） | `monitoring.metaDesc` 源头 ES/DE/FR 只有一句话 |
| `/countries` | desc 102 | 略低于 120 |
| `/case-studies`、`/chemicals`、`/field-reports` | zh / zh-TW desc 39 / 38 / 34 | 来源是 TS 常量（`CASE_LIST_META` / `lib/chemicals.ts` / `FIELD_REPORT_LIST_META`），要改 TS 而非字典 |

**建议**：这批**不在本轮放行范围**，我按您的纪律没有擅自改。
若您要收，我建议**一次只做第 1 组的 `/tools/compare` 82 + 第 2 组的 3 个 `/monitoring`**（改动面小、SERP 收益最直接），其余留批次。

---

## 11. 部署后必做（第 ⑦ 步之后）

1. **实测线上 `/robots.txt` 合并文本**（CF 托管段在前 + `app/robots.ts` 在后）—— 确认 12 组 UA 的 `Allow: /suppliers?q=` 未被托管段抵消。
2. 抽 10 页线上 HTML 复验 title / desc / canonical / hreflang / JSON-LD。
3. `post-publish-submit.cjs --from-file .sitemap-new.txt` 走 IndexNow 提交（Bing/Google ping 均不可达）。
4. 确认 `public/<BING_INDEXNOW_KEY>.txt` 已随本次 build 上线。

---

## 12. 本轮新增/保留的只读探针

| 文件 | 用途 |
|---|---|
| `scripts/_stage1_final_check.ts` | 真实 `buildPageMetadata` 预演 9 语 × 16 页 = 144 条终值 |
| `scripts/_s1_desc_dump.ts` | **新**：逐字打印「源头 → 收口后」，断言「是否被截断 / 结尾是否有句末标点」——补上长度断言漏掉的缺陷类 |
| `_stage1_prerender_verify.cjs` | 抽预渲染 HTML 的 title / desc / robots / canonical / hreflang / JSON-LD |
| `_stage1_meta_measure.cjs` | 9 语 title / desc 源头长度实测表 |
| `_stage1_selfcheck.cjs` | 复刻 populate 路径契约自检 |
| `_stage1_patch2.cjs` / `_stage1_patch3.cjs` | 终验补正的字典写入器（保留新旧对照，便于复核/回滚） |

（`_stage1_patch*.cjs` 与日志在根级 `/_*` 忽略区，不入库；`scripts/_s1_desc_dump.ts`、`scripts/_stage1_final_check.ts` 已入库。）
