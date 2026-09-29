# stage1.6 执行报告 —— 第 3 批 desc/title 修复 + CJK 占比判定

> 生成时间：2026-09-29｜基线：CF `72ef374c`｜回滚锚点：`6facaae8`

## 0. 本批做了什么（一句话）

把 stage1.6 建议书的 **66 处**源键改写落地（字典 54 + TS 13，含新增 fr 1 处），
并把 `lib/pageMeta.ts` 的「含 1 个汉字即按 CJK 预算」改成「CJK 字符**占比** > 25%」。

---

## 1. 字典层改写（54 处）—— 前后对比

| # | 源键 | 语种 | 旧（源头→收口） | 新（源头→收口） | 新结尾句末 | 新幂等 | 覆盖页 |
|---|---|---|---|---|---|---|---|
| 1 | `countryHub.metaDesc` | en | 173 → 152 ✗ | 130 → **130** | ✓ | ✓ | 见 §3 |
| 2 | `countryHub.metaDesc` | es | 215 → 156 ✗ | 147 → **147** | ✓ | ✓ | 见 §3 |
| 3 | `countryHub.metaDesc` | de | 173 → 153 ✗ | 128 → **128** | ✓ | ✓ | 见 §3 |
| 4 | `countryHub.metaDesc` | fr | 198 → 155 ✗ | 132 → **132** | ✓ | ✓ | 见 §3 |
| 5 | `countryHub.metaDesc` | pt | 208 → 151 ✗ | 134 → **134** | ✓ | ✓ | 见 §3 |
| 6 | `countryHub.metaDesc` | ar | 174 → 152 ✗ | 122 → **122** | ✓ | ✓ | 见 §3 |
| 7 | `industryPage.metaDesc` | es | 85 → 85 | 153 → **153** | ✓ | ✓ | 见 §3 |
| 8 | `industryPage.metaDesc` | pt | 82 → 82 | 153 → **153** | ✓ | ✓ | 见 §3 |
| 9 | `industryPage.metaDesc` | fr | 172 → 86 | 149 → **149** | ✓ | ✓ | 见 §3 |
| 10 | `inspection.metaDesc` | en | 191 → 155 ✗ | 132 → **132** | ✓ | ✓ | 见 §3 |
| 11 | `inspection.metaDesc` | es | 207 → 155 ✗ | 157 → **157** | ✓ | ✓ | 见 §3 |
| 12 | `inspection.metaDesc` | de | 183 → 151 ✗ | 135 → **135** | ✓ | ✓ | 见 §3 |
| 13 | `inspection.metaDesc` | fr | 225 → 156 ✗ | 156 → **156** | ✓ | ✓ | 见 §3 |
| 14 | `inspection.metaDesc` | pt | 189 → 157 ✗ | 144 → **144** | ✓ | ✓ | 见 §3 |
| 15 | `trainingPage.metaDesc` | es | 172 → 151 ✗ | 142 → **142** | ✓ | ✓ | 见 §3 |
| 16 | `trainingPage.metaDesc` | fr | 160 → 155 ✗ | 130 → **130** | ✓ | ✓ | 见 §3 |
| 17 | `serviceVerification.metaDesc` | es | 261 → 147 ✗ | 149 → **149** | ✓ | ✓ | 见 §3 |
| 18 | `careers.metaDesc` | en | 167 → 157 ✗ | 138 → **138** | ✓ | ✓ | 见 §3 |
| 19 | `careers.metaDesc` | es | 177 → 149 ✗ | 128 → **128** | ✓ | ✓ | 见 §3 |
| 20 | `careers.metaDesc` | de | 181 → 151 ✗ | 130 → **130** | ✓ | ✓ | 见 §3 |
| 21 | `careers.metaDesc` | fr | 203 → 156 ✗ | 138 → **138** | ✓ | ✓ | 见 §3 |
| 22 | `careers.metaDesc` | pt | 180 → 151 ✗ | 138 → **138** | ✓ | ✓ | 见 §3 |
| 23 | `pricing.metaDesc` | en | 187 → 154 ✗ | 150 → **150** | ✓ | ✓ | 见 §3 |
| 24 | `pricing.metaDesc` | es | 238 → 154 ✗ | 157 → **157** | ✓ | ✓ | 见 §3 |
| 25 | `pricing.metaDesc` | de | 180 → 148 ✗ | 130 → **130** | ✓ | ✓ | 见 §3 |
| 26 | `pricing.metaDesc` | fr | 212 → 151 ✗ | 143 → **143** | ✓ | ✓ | 见 §3 |
| 27 | `pricing.metaDesc` | pt | 254 → 154 ✗ | 141 → **141** | ✓ | ✓ | 见 §3 |
| 28 | `risk.page.metaDesc` | en | 218 → 149 ✗ | 142 → **142** | ✓ | ✓ | 见 §3 |
| 29 | `risk.page.metaDesc` | es | 235 → 151 ✗ | 151 → **151** | ✓ | ✓ | 见 §3 |
| 30 | `risk.page.metaDesc` | de | 243 → 153 ✗ | 152 → **152** | ✓ | ✓ | 见 §3 |
| 31 | `risk.page.metaDesc` | fr | 260 → 147 ✗ | 151 → **151** | ✓ | ✓ | 见 §3 |
| 32 | `risk.page.metaDesc` | pt | 227 → 155 ✗ | 140 → **140** | ✓ | ✓ | 见 §3 |
| 33 | `risk.page.metaTitle` | es | 主体 36｜合成 65 | 主体 **31**｜合成 **60** | — | — | 1 |
| 34 | `risk.page.metaTitle` | fr | 主体 33｜合成 62 | 主体 **29**｜合成 **58** | — | — | 1 |
| 35 | `risk.page.metaTitle` | pt | 主体 34｜合成 63 | 主体 **30**｜合成 **59** | — | — | 1 |
| 36 | `risk.page.metaTitle` | ar | 主体 20｜合成 49 | 主体 **26**｜合成 **55** | — | — | 1 |
| 37 | `methodology.metaDesc` | es | 249 → 153 ✗ | 156 → **156** | ✓ | ✓ | 见 §3 |
| 38 | `methodology.metaDesc` | fr | 240 → 157 ✗ | 150 → **150** | ✓ | ✓ | 见 §3 |
| 39 | `methodology.metaDesc` | pt | 233 → 153 ✗ | 155 → **155** | ✓ | ✓ | 见 §3 |
| 40 | `verifySupplier.metaDesc` | de | 166 → 157 ✗ | 127 → **127** | ✓ | ✓ | 见 §3 |
| 41 | `verifySupplier.metaDesc` | es | 159 → 149 ✗ | 126 → **126** | ✓ | ✓ | 见 §3 |
| 42 | `resourcesIndex.metaDesc` | es | 162 → 148 ✗ | 148 → **148** | ✓ | ✓ | 见 §3 |
| 43 | `resourcesIndex.metaDesc` | fr | 163 → 151 ✗ | 148 → **148** | ✓ | ✓ | 见 §3 |
| 44 | `trainingPlans.metaDesc` | es | 161 → 152 ✗ | 133 → **133** | ✓ | ✓ | 见 §3 |
| 45 | `legal.termsTitle` | en | 主体 16｜合成 34 | 主体 **35**｜合成 **53** | — | — | 1 |
| 46 | `legal.termsTitle` | es | 主体 21｜合成 39 | 主体 **37**｜合成 **55** | — | — | 1 |
| 47 | `legal.termsTitle` | de | 主体 19｜合成 37 | 主体 **39**｜合成 **57** | — | — | 1 |
| 48 | `legal.termsTitle` | fr | 主体 24｜合成 42 | 主体 **34**｜合成 **52** | — | — | 1 |
| 49 | `legal.termsTitle` | pt | 主体 17｜合成 35 | 主体 **40**｜合成 **58** | — | — | 1 |
| 50 | `legal.termsTitle` | ar | 主体 10｜合成 28 | 主体 **33**｜合成 **51** | — | — | 1 |
| 51 | `monitoring.metaDesc` | es | 217 → 59 | 148 → **148** | ✓ | ✓ | 见 §3 |
| 52 | `monitoring.metaDesc` | de | 252 → 46 | 143 → **143** | ✓ | ✓ | 见 §3 |
| 53 | `monitoring.metaDesc` | fr | 243 → 47 | 158 → **158** | ✓ | ✓ | 见 §3 |
| 54 | `chemicals.metaDesc` | zh | 38 → 38 | 61 → **61** | ✓ | ✓ | 见 §3 |

## 2. TS 内容层改写（13 处）—— 前后对比

| # | 源（文件·字段） | 生效语种 | 旧（源头→收口） | 新（源头→收口） | 新结尾句末 | 新幂等 |
|---|---|---|---|---|---|---|
| 1 | `caseStudies/trading-company-posing-as-factory` | en×7 | 185 → 147 ✗ | 144 → **144** | ✓ | ✓ |
| 2 | `caseStudies/legal-entity-mismatch-before-deposit` | en×7 | 192 → 155 ✗ | 142 → **142** | ✓ | ✓ |
| 3 | `caseStudies/label-defect-stopped-before-loading` | en×7 | 160 → 151 ✗ | 135 → **135** | ✓ | ✓ |
| 4 | `caseStudies/qualifying-replacement-supplier-vietnam` | en×7 | 171 → 154 ✗ | 127 → **127** | ✓ | ✓ |
| 5 | `fieldReports/carton-count-mismatch-at-loading` | en×7 | 165 → 157 ✗ | 138 → **138** | ✓ | ✓ |
| 6 | `fieldReports/moisture-in-cartons-before-shipment` | en×7 | 161 → 146 ✗ | 151 → **151** | ✓ | ✓ |
| 7 | `fieldReports/shared-building-fire-exits` | en×7 | 175 → 150 ✗ | 135 → **135** | ✓ | ✓ |
| 8 | `fieldReports/undisclosed-subcontracted-process` | en×7 | 162 → 155 ✗ | 126 → **126** | ✓ | ✓ |
| 9 | `industry/food-beverage/food-factory-audit-checklist` | en×7 | 166 → 148 ✗ | 133 → **133** | ✓ | ✓ |
| 10 | `industry/food-beverage/food-supplier-verification` | en×7 | 163 → 156 ✗ | 136 → **136** | ✓ | ✓ |
| 11 | `industry/chemicals/chemical-supplier-verification` | en×7 | 172 → 157 ✗ | 136 → **136** | ✓ | ✓ |
| 12 | `CASE_LIST_META.zh` | zh/zh-TW | 39 → 39 | 62 → **62** | ✓ | ✓ |
| 13 | `FIELD_REPORT_LIST_META.zh` | zh/zh-TW | 34 → 34 | 62 → **62** | ✓ | ✓ |

---

## 3. CJK 占比判定 —— 行业分类页效果

| 语种 | 行业分类页 desc 收口后长度（13 个行业） | 预算 | 结尾句末标点 |
|---|---|---|---|
| en | 120–133 | 拉丁 158 | ✓ |
| zh | 50–63 | CJK 90 | ✓ |
| zh-TW | 50–63 | CJK 90 | ✓ |
| ja | 73–86 | CJK 90 | ✓ |
| es | 140–153 | 拉丁 158 | ✓ |
| de | 139–152 | 拉丁 158 | ✓ |
| fr | 136–149 | 拉丁 158 | ✓ |
| pt | 140–153 | 拉丁 158 | ✓ |
| ar | 118–131 | 拉丁 158 | ✓ |

**逐页实测（新旧预渲染产物对照）**：13 行业 × 6 个拉丁/阿拉伯语种 = **78 页全部** 从「被夹在 64–90」升到 100–158；zh / zh-TW / ja 仍按 CJK 90 预算（设计如此，不套拉丁带宽）。

### 3b. 占比判定的连带影响（同一规则，非本批声明范围）

| 页面群 | 页数 | desc 变化 | 说明 |
|---|---|---|---|
| 行业分类页 | 78 | 64–90 → 118–153 | **本批目标**（验收 #5） |
| 供应商详情页 | 22 / 81 | 45–86 → 94–155 | 供应商名含中文（如「南京麦克森OE科技有限公司」）⇒ 旧规则按 90 夹断，新规则按占比回落拉丁 158 |
| 其余页面 | 0 | — | A/B 探针对照：**新增半句话 0 项 / 修好 0 项**，规则改动对源头侧半句完全中性 |

> ⚠️ 供应商页那 22 页现在最长 155 字符，且是「中文短句 + 长英文公司名」混排；按像素宽度估算略超 158 半角宽的展示位。这是「占比阈值 25%」的直接推论（该 22 页的 CJK 占比在 16–26% 之间）。若您希望供应商页继续按 CJK 90 预算，把阈值下调到 **10%** 即可精确分开（行业页 2.6–5%，供应商页 16–26%）——本批按您指定的 25% 执行，未擅自改阈值。

---

## 4. 构建链路 ①–⑦ 结果（七步手动，沙箱关闭）

| 步骤 | 命令 | 结果 |
|---|---|---|
| ① | `next build` | ✓ EXIT=0，1m46s，**`[queries] suppliers query failed` = 0 次** |
| ② | `opennext build` | ✓ EXIT=0，2m12s，`Worker saved in .open-next/worker.js` |
| ③ | `populate-static-assets-cache.cjs --worker --batch 250` ×7 | ✓ `DONE`（1981 项全量落地） |
| ④ | 路径契约自检 | ✓ `页面缓存 1895 / fetch 缓存 86 / 非预期路径 0 / 非 .cache 结尾 0` → `[populate] OK` |
| ⑤ | `scrub-next-env.mjs` | ✓ 清空 21 处密钥明文（production/development/test 各 7），自检通过 |
| ⑥ | `verify-opennext-bundle.mjs` | ✓ **ALL PASS**（en 字典叶子 3126 / 页面缓存 1895→1895 大小逐项一致 / assets 2167≤20000 / 单文件 2.35 MiB≤25 MiB / 无密钥） |
| ⑦ | `wrangler deploy`（`OPEN_NEXT_DEPLOY=true`） | ✓ EXIT=0，上传 1982 文件（185 已存在），gzip 3473.02 KiB，Worker 启动 25 ms |

**buildId**：`VjZ2H781zstWY1EfEu7Kw`

### 🔴 本步踩到的真坑（已修，值得入技能库）

本机**直连** `<ref>.supabase.co` 会被重置（`curl: Recv failure` / `fetch: ECONNRESET`），
而 `.env` 里 `SUPPLIER_DATA_SOURCE="supabase"` ⇒ `next build` 会**静默回落静态数据**：
构建日志只有几行 `[queries] suppliers query failed TypeError: fetch failed`，
产物里**供应商从 9 家掉到 4 家**、`/suppliers/<slug>` 少 5 个页面，**EXIT 仍是 0**。
本机 Windows 系统代理 `127.0.0.1:7897` 可达 Supabase（已验证返回 401 = 缺 apikey），
`scripts/with-proxy.cjs` 把 Node 全局 fetch 指向该代理后，构建期读到 **9 家已发布供应商**
（与上一版产物逐页一致）。**后续所有涉及 build 的操作都必须带这个 preload。**

---

## 5. 部署版本 ID + 回滚锚点

| 项 | 值 |
|---|---|
| 本次线上版本 | **`652a050b-cfa7-49cf-a238-56edf51f11e4`** |
| 部署前基线（可回滚） | `72ef374c` |
| 更早稳定锚点 | `6facaae8`（阶段 1 元数据修复） |
| 本轮代码提交 | `d313e58`（元数据/CJK/TW_MAP）、`0b9ab1e`（探针 + 代理 preload） |
| Worker | `factoryauditb2b`（`https://factoryauditb2b.factoryauditb2b.workers.dev`） |

**回滚方式**：Cloudflare 控制台 → Workers → factoryauditb2b → Deployments → 把 `72ef374c` 设为当前版本（无需重新构建）。

### 部署后线上验收

- `scripts/live-meta-verify.cjs`（默认抽样 10 页 + 指定 6 页）→ **ALL PASS**：canonical 自指、hreflang 9 语(BCP-47)+x-default、JSON-LD 可解析、title/desc 与本地预渲染**逐字一致**、**全部页面 `x-opennext-cache: HIT`**（预渲染确实进了缓存，未退化成每请求 SSR）。
- 本次改动页逐语种线上复核（HTTP 200）：`/terms` title en 53 / es 55 / de 57 / fr 52 / pt 58 / ar 51；`/tools/supplier-risk-calculator` title es 60 / fr 58 / pt 59 / ar 55；`/industry/food-beverage` desc en 133 / es 153 / de 152 / fr 149 / pt 153 / ar 131。
- `robots.txt` 未回归：13 组 UA 各含 `Allow: /suppliers?q=` 且保留 `Disallow: /*?`，`Sitemap:` 行在位。
- IndexNow：本批**无新增/删除 URL**（只改元数据），`sitemap-diff` 增量集为空 ⇒ 无需提交；如需强制重提交可清 `scripts/.sitemap-cache.txt` 后跑 `post-publish-submit.cjs`（全量 1746 条）。

---

## 6. desc-truncation-sweep 结果（141 → 0）

```
扫描预渲染 HTML: 1891 个文件
有 description: 1890｜无 description: 0
结尾无句末标点（半句话嫌疑）: 0

=> ALL CLEAN
```

| 验收项 | 目标 | 实测 |
|---|---|---|
| desc 半句话（`desc-truncation-sweep`） | 141 → 0 | **0（ALL CLEAN）** |
| title 越界清单（`title-length-sweep.cjs` A 段，10 项声明） | 11 → 0 | **10/10 通过（失败 0）** |
| desc 结尾句末标点 | 全部 | 1890/1890 ✓ |
| desc 收口幂等 | 全部声明的 67 处 | **67/67 PASS**（`_s16_cand`） |
| 行业分类页 desc 100–158 | 全部拉丁语种 | en 120–133 / es 140–153 / de 139–152 / fr 136–149 / pt 140–153 / ar 118–131 ✓ |
| 构建链路 ①–⑦ | 全绿 | ✓ |
| 回归无新增失败 | — | ✓（见 §7） |

> 关于「11 项」：建议书 §2b 的声明清单是 **10 项**（`legal.termsTitle` en/es/de/fr/pt/ar 6 项 + `risk.page.metaTitle` es/fr/pt/ar 4 项），已全部落 50–60。报告里的「11」我只复原到 10，第 11 项若在别处请指出，我按同一口径补做（`title-length-sweep.cjs` 已支持随时逐项断言）。

---

## 7. 回归结果（无新增失败）

| 回归 | 结果 | 失败项 | 是否既有 |
|---|---|---|---|
| `cs01-seo-foundation-regression` | **46 PASS / 0 FAIL** | — | — |
| `cs06a-directory-regression`（含 C8） | 54 PASS / 1 FAIL | `A3 网格 .map 消费 displayed :: 命中 2 次` | ✅ 既有（MEMORY 已登记） |
| `cs13-supplier-seo-regression` | 155 PASS / 1 FAIL | `F2d supabase/migrations 仍 10 个`（实际 13） | ✅ 既有 |
| `cs22b-self-assessment-regression` | 89 PASS / 1 FAIL | `G1 supplier_assessments 条数 = 9`（实际 10） | ✅ 既有（DB 数据漂移，非代码） |

- **C8 en 字典叶子数 = 3126 通过**（约束 1「只改值不增删键」达成）。
- 借助代理 preload，cs13 的 **G1–G10 真实 DB 断言全部执行并通过**（9 行、Sunny Food level=3 可索引），cs22b 的 **G1–G6 权限断言全部通过**——这两组上一轮因沙箱不可达是 SKIP，本轮拿到了真实结论。

---

## 8. 风险与未解决问题

1. **🔴 已成事实的 title 变长（需决策）**：占比判定同时解除了行业分类页 / 供应商页 title 的「含 1 汉字即按 CJK 36 字」误判。全站 **161 页** title 变化：
   - **122 页原本是被分隔符截断的残句**（如 `Electronics| FactoryAuditB2B`、`Automotive / 汽车 Supplier| FactoryAuditB2B`）→ 现已完整，**这是修复**；
   - 但其中 **107 页新长度 >60**（行业页最长 82），SERP 里可能被搜索引擎截断。
   - 根治需把 `TITLE_LATIN_BODY_BUDGET` 从 65 收到 42 左右（使合成 ≤60）——影响约 700 个标题，**不宜在本批夹带**，建议单开一批。
2. **供应商页 desc 变长**（§3b）：22/81 页升到最长 155 字符，中文+英文混排的像素宽可能略超展示位；如需收紧，把占比阈值降到 10%。
3. **TW_MAP 重跑是「补历史欠账」**：旧表只有 830 条而是 3428 条，说明多次内容变更后没重跑。本次重跑**语义对比 0 处值变更、仅新增**，并顺带修好 zh-TW 的 27 个页面标题（`阿裡`→`阿里`、`審核`→`稽核`、`诈骗`→`詐騙`、`尽职`→`盡職`）。**建议把「内容源中文变更后重跑 `gen-tw-mapping.py`」写进发布检查单**，否则会持续积累简体泄漏。
4. **本批未动（按决策 4/5）**：绕过 `buildPageMetadata` 的页面（`/tools`、`/tools/supplier-verification-checklist` 直接写 `metadata`，实测 es desc 达 208 字符）⇒ **stage1.7**；仍非幂等的 desc 源键 96 处（`CUT=Y` 但有句末标点、渲染结果完整）。
5. **`chemicals.metaDesc` zh 已补到 61**，但 zh-TW 走 `zh-TW.json` 自己的键、未经 twText，故未同步；如需一致需单独订正 zh-TW 字典（CJK，不影响本批验收）。
6. **`_prune_*` 隔离目录已累积 6 个**（`.next`/`.open-next` 各数 GB），确认无回滚需求后建议清理磁盘。

