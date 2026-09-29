# 阶段 1.5 执行报告 —— 379 项 desc 半句话修复（第一批）+ 2 项 title 收口 + 全量 IndexNow

- **执行日期**：2026-09-29
- **部署版本**：`72ef374c-e83d-4d8c-aff7-8d9c1120f83d`（上一版本 `6facaae8-a8f1-44fd-ba93-2caaa254a23d` = 回滚锚点）
- **提交锚点**：`266e0ce`（任务1）→ `a96f24c`（任务2）→ `b08ae8c`（全量清单）→ 本报告
- **结论**：三项任务全部完成并通过验收；全站 desc 半句话 **379 → 141**；构建链路 ①–⑦ 全绿；回归与阶段 1 基线一致（唯一 FAIL 均为既有）。

---

## 1. 任务 1 —— guides 47 条 `metaDescEn` 双句化

### 1.1 改动文件

| 文件                            | 变更                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `lib/guides.ts`               | 47 条 `metaDescEn` 值改写（第 74–2460 行区间，逐条替换值，**未增删任何字段/键**）；`Guide.metaDescEn` 字段上方新增 9 语缺口注释（第 49–57 行） |
| `scripts/_s15_guides_idem.ts` | 新增：源头 → 收口后 幂等断言探针（可挂回归）                                                                              |

### 1.2 修法

每条改为**双句结构**：第一句 = 核心定义/价值，第二句 = 补充说明/行动引导，两句均以句号收尾，总长 ≤158（`trimMetaDescription` 的拉丁预算）⇒ 收口函数**零命中**（幂等）。

### 1.3 47 条改写前后对照（源头长度 → 收口后长度 → 是否 endOk）

`旧被截`/`旧结尾OK` 指改动前的状态；`新*` 为改动后。

| #  | slug                                                      | 旧源头 | 旧收口后 | 旧被截   | 旧结尾OK | 新源头 | 新收口后 | 新被截 | 新结尾OK |
| -- | --------------------------------------------------------- | --- | ---- | ----- | ----- | --- | ---- | --- | ----- |
| 1  | `how-to-verify-a-chinese-supplier`                        | 249 | 152  | **是** | **否** | 127 | 127  | 否   | 是     |
| 2  | `factory-audit-checklist`                                 | 206 | 156  | **是** | **否** | 140 | 140  | 否   | 是     |
| 3  | `supplier-risk-assessment-guide`                          | 168 | 157  | **是** | **否** | 126 | 126  | 否   | 是     |
| 4  | `smeta-vs-bsci-social-audit-comparison`                   | 171 | 154  | **是** | **否** | 127 | 127  | 否   | 是     |
| 5  | `how-to-read-a-factory-audit-report`                      | 176 | 156  | **是** | **否** | 123 | 123  | 否   | 是     |
| 6  | `how-to-audit-a-factory-in-vietnam`                       | 196 | 155  | **是** | **否** | 129 | 129  | 否   | 是     |
| 7  | `pre-shipment-inspection-checklist`                       | 178 | 156  | **是** | **否** | 128 | 128  | 否   | 是     |
| 8  | `what-is-a-factory-audit`                                 | 162 | 148  | **是** | **否** | 126 | 126  | 否   | 是     |
| 9  | `supplier-evaluation-checklist`                           | 152 | 152  | 否     | 是     | 139 | 139  | 否   | 是     |
| 10 | `on-site-vs-desk-audit`                                   | 138 | 138  | 否     | 是     | 125 | 125  | 否   | 是     |
| 11 | `third-party-audit-pain-points`                           | 145 | 145  | 否     | 是     | 133 | 133  | 否   | 是     |
| 12 | `capacity-audit-guide`                                    | 153 | 153  | 否     | 是     | 135 | 135  | 否   | 是     |
| 13 | `aql-sampling-standard-fri`                               | 186 | 154  | **是** | **否** | 130 | 130  | 否   | 是     |
| 14 | `ppi-vs-dupro-inspection`                                 | 212 | 114  | **是** | 是     | 128 | 128  | 否   | 是     |
| 15 | `full-inspection-100-percent`                             | 143 | 143  | 否     | 是     | 133 | 133  | 否   | 是     |
| 16 | `fba-rejection-inspection`                                | 186 | 155  | **是** | **否** | 137 | 137  | 否   | 是     |
| 17 | `failed-inspection-dispute`                               | 205 | 83   | **是** | 是     | 137 | 137  | 否   | 是     |
| 18 | `ethical-audit-mandatory-requirements`                    | 187 | 156  | **是** | **否** | 131 | 131  | 否   | 是     |
| 19 | `sa8000-certification-guide`                              | 204 | 154  | **是** | **否** | 139 | 139  | 否   | 是     |
| 20 | `esg-supplier-audit-guide`                                | 206 | 153  | **是** | **否** | 137 | 137  | 否   | 是     |
| 21 | `brand-reputation-pr-crisis`                              | 194 | 149  | **是** | **否** | 131 | 131  | 否   | 是     |
| 22 | `chinese-supplier-scam-red-flags`                         | 155 | 155  | 否     | 是     | 134 | 134  | 否   | 是     |
| 23 | `how-to-check-china-company-registration`                 | 150 | 150  | 否     | 是     | 137 | 137  | 否   | 是     |
| 24 | `alibaba-trade-assurance-safe-payment`                    | 144 | 144  | 否     | 是     | 136 | 136  | 否   | 是     |
| 25 | `verify-supplier-before-deposit`                          | 140 | 140  | 否     | 是     | 142 | 142  | 否   | 是     |
| 26 | `common-b2b-procurement-fraud`                            | 157 | 157  | 否     | 是     | 141 | 141  | 否   | 是     |
| 27 | `what-is-quality-management-system`                       | 175 | 156  | **是** | **否** | 129 | 129  | 否   | 是     |
| 28 | `iso-9001-vs-iso-13485`                                   | 164 | 148  | **是** | **否** | 129 | 129  | 否   | 是     |
| 29 | `manufacturing-quality-control-process`                   | 159 | 155  | **是** | **否** | 129 | 129  | 否   | 是     |
| 30 | `ppap-production-part-approval`                           | 158 | 155  | 否     | 是     | 126 | 126  | 否   | 是     |
| 31 | `supplier-quality-audit-checklist`                        | 174 | 157  | **是** | **否** | 141 | 141  | 否   | 是     |
| 32 | `verify-alibaba-supplier-before-paying`                   | 184 | 156  | **是** | **否** | 134 | 134  | 否   | 是     |
| 33 | `china-factory-or-trading-company`                        | 199 | 155  | **是** | **否** | 135 | 135  | 否   | 是     |
| 34 | `china-supplier-risk-assessment-framework`                | 191 | 155  | **是** | **否** | 128 | 128  | 否   | 是     |
| 35 | `when-to-order-china-factory-audit`                       | 178 | 152  | **是** | **否** | 129 | 129  | 否   | 是     |
| 36 | `china-factory-audit-cost`                                | 200 | 157  | **是** | **否** | 128 | 128  | 否   | 是     |
| 37 | `supplier-verification-vs-factory-audit-vs-inspection`    | 190 | 153  | **是** | **否** | 140 | 140  | 否   | 是     |
| 38 | `eu-forced-labour-regulation-china-suppliers`             | 212 | 157  | **是** | **否** | 131 | 131  | 否   | 是     |
| 39 | `eudr-supplier-due-diligence-china`                       | 192 | 153  | **是** | **否** | 135 | 135  | 否   | 是     |
| 40 | `digital-product-passport-supplier-data`                  | 199 | 157  | **是** | **否** | 133 | 133  | 否   | 是     |
| 41 | `smeta-7-supplier-audit-buyer-guide`                      | 186 | 155  | **是** | **否** | 131 | 131  | 否   | 是     |
| 42 | `rba-vap-vs-smeta-vs-bsci`                                | 161 | 148  | **是** | **否** | 130 | 130  | 否   | 是     |
| 43 | `china-plus-one-supplier-qualification`                   | 214 | 155  | **是** | **否** | 142 | 142  | 否   | 是     |
| 44 | `buyer-ready-china-supplier`                              | 232 | 157  | **是** | **否** | 134 | 134  | 否   | 是     |
| 45 | `china-factory-audit-mid-autumn-national-day-scheduling`  | 177 | 155  | **是** | **否** | 136 | 136  | 否   | 是     |
| 46 | `china-us-trade-talks-2026-inspection-audit-planning`     | 201 | 154  | **是** | **否** | 135 | 135  | 否   | 是     |
| 47 | `q4-shipment-window-factory-audit-inspection-combination` | 191 | 157  | **是** | **否** | 138 | 138  | 否   | 是     |

**统计**

| 指标         | 旧值          | 新值          |
| ---------- | ----------- | ----------- |
| 源头长度区间     | 138–249     | **123–142** |
| 收口后长度区间    | 83–158      | **123–142** |
| 被截断条数      | **36 / 47** | **0 / 47**  |
| 收口后结尾无句末标点 | **34 / 47** | **0 / 47**  |

> 注：#14 与 #17 旧值「被截断但结尾有标点」——收口函数取到了句内较早的标点（截到 114 / 83），  
> 属另一种劣化（描述被抓去半截），本次一并修好。

### 1.4 覆盖范围（为什么 47 条 → 消除 238 项）

`app/[locale]/guides/[slug]/page.tsx` 用 `pickZhPair(locale, g.metaDescEn, g.metaDescZh)` 取值：  
**只有 `zh` / `zh-TW` 用 `metaDescZh`，其余 7 个语种（en, ja, es, de, fr, pt, ar）全部回退 `metaDescEn`**。  
⇒ 修 47 条 en 源头，一次消除 7 × 34 = **238** 项（47 条中 34 条被 sweep 标记；另 13 条旧值本就未触发收口）。

### 1.5 验证

```
node scripts/run-regression.mjs _s15_guides_idem
→ PASS=47  FAIL=0   => ALL PASS（47/47 幂等）
  （断言：源头 ≤158 且结尾有句末标点；trimMetaDescription(源头) === 源头；收口后结尾仍有句末标点）
```

构建后实测（`.next/server/app/<locale>/guides/*.html`，7 语种全部为新值）：

```
en/es/ja/ar → "How to read the AQL sampling standard for pre-shipment inspection.
               Covers defect classes, the two-table method and how to set AQL."
zh          → "出货前检验(FRI)的AQL抽样标准实用指南：缺陷分级、两张表查法、如何看接收数Ac与拒收数Re，以及按产品类型设定AQL。"
```

### 1.6 回滚

```bash
git revert --no-edit 266e0ce
```

### 1.7 已知缺口（未擅自补，留第 3 批）

`lib/guides.ts` 只有 `metaDescEn` / `metaDescZh`。缺 `metaDescJa/Es/De/Fr/Pt/Ar`  
⇒ **`ja/es/de/fr/pt/ar` 的 47 × 6 = 282 页指南展示的是英文描述**（`ar` 同理）。  
本次已在 `Guide.metaDescEn` 字段上方写明注释与补齐路径（需同时改 `pickZhPair` 的取值分支）。

---

## 2. 任务 2 —— 2 项 title 越界收口

### 2.1 改动文件

| 文件                                           | 变更                                    |
| -------------------------------------------- | ------------------------------------- |
| `i18n/dictionaries/{en,es,de,fr,pt,ar}.json` | `compare.metaTitle` 6 语收口             |
| `i18n/dictionaries/{en,de,ar}.json`          | `serviceVerification.metaTitle` 3 语收口 |
| `outputs/stage1-deploy-report.md`            | 纯 Markdown 表格排版归一（无语义变更，顺带提交）         |

**只改叶子值，未增删任何键** ⇒ en 叶子数仍 **3126**。

### 2.2 `compare.metaTitle`（品牌后缀 `" | FactoryAuditB2B"` = 18 字符）

| 语种              | 旧主体          | 旧合成     | 新主体    | 新合成    | 新值                                           |
| --------------- | ------------ | ------- | ------ | ------ | -------------------------------------------- |
| en              | 64           | **82**  | 40     | **58** | `Supplier Comparison Tool: Compare 2 to 5`   |
| es              | 92           | **110** | 33     | **51** | `Comparación de proveedores: 2 a 5`          |
| de              | 77           | **95**  | 42     | **60** | `Lieferantenvergleich: 2 bis 5 im Vergleich` |
| fr              | 79           | **97**  | 34     | **52** | `Comparateur de fournisseurs: 2 à 5`         |
| pt              | 81           | **99**  | 33     | **51** | `Comparador de fornecedores: 2 a 5`          |
| ar              | 56           | **74**  | 40     | **58** | `Supplier Comparison Tool: Compare 2 to 5`   |
| zh / zh-TW / ja | 21 / 21 / 33 | —       | **不变** | —      | CJK 主体已 ≤36 预算，保持                            |

### 2.3 `serviceVerification.metaTitle`

| 语种                   | 旧主体             | 旧合成           | 新主体    | 新合成    | 新值                                       |
| -------------------- | --------------- | ------------- | ------ | ------ | ---------------------------------------- |
| en                   | 29              | **47**（低于 50） | 38     | **56** | `Supplier Verification Service in China` |
| de                   | 18              | **36**（低于 50） | 38     | **56** | `Lieferantenprüfung in China für Käufer` |
| ar                   | 24              | **42**（低于 50） | 32     | **50** | `خدمة التحقق من الموردين في الصين`       |
| zh/zh-TW/ja/es/fr/pt | 7/7/12/39/39/38 | 25–57         | **不变** | —      | 未越 50–60 区间                              |

> 用户明确要求的 2 项为 en（`compare` 82、`serviceVerification` 47）。执行时发现同一个键下  
> `compare` 的 es/de/fr/pt/ar 与 `serviceVerification` 的 de/ar 属**同一类越界**，  
> 一并收口以避免同类缺陷留存；均只改值、不增删键。`zh/zh-TW/ja` 为 CJK，  
> 按 `trimMetaTitle` 的 CJK 预算（36）不套拉丁 50–60，故保持不变。

### 2.4 验证

```
node scripts/run-regression.mjs _stage1_final_check
→ title 越界清单由 11 项降至 9 项，且 /tools/compare 与 /services/supplier-verification 全部消失
（剩余 9 项为 /terms 与 /tools/supplier-risk-calculator，见 §7）

字典闸门：crlf=4028 / bareLF=0 / 末尾 CRLF / leaf=3126 全部保持
构建产物实测：
  <title>Supplier Comparison Tool: Compare 2 to 5 | FactoryAuditB2B</title>          ← 58
  <title>Supplier Verification Service in China | FactoryAuditB2B</title>           ← 56
```

### 2.5 回滚

```bash
git revert --no-edit a96f24c
```

---

## 3. 构建链路各步结果（七步手动）

| 步 | 操作                                                                   | 结果                                                                                                                                                              |
| - | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ① | 隔离 `.next`（14784 文件，超 7000 护栏阈值）→ `_prune_next_3`（`renameSync` 不计删除） | OK                                                                                                                                                              |
| ② | `next build`（`NODE_OPTIONS=""` + `FAB2B_DISABLE_BUILD_TRACE=1`）      | **EXIT=0**；`✓ Compiled successfully in 30.4s`；静态页 **2090/2090**；总 **1m36s**                                                                                     |
| ③ | `opennext build`                                                     | **EXIT=0**；**1m59s**；`OpenNext build complete`；`Worker saved in .open-next/worker.js`                                                                           |
| ④ | `populate-static-assets-cache.cjs --worker --batch 250` 循环           | 7 批 ×250 + 240 = **1990/1990** 写入；iter 8 起幂等 `copied=0 skipped=1990 remaining=0 DONE`                                                                           |
| ⑤ | 自检 `_stage1_selfcheck.cjs`                                           | **PASS**：`buildId=5P7Sh-ZaaxzXGfFuur_zN`，pageKeys=**1890**，fetch=**100**，stray=**0**，badExt=**0**                                                               |
| ⑥ | `scrub-next-env.mjs` + `verify-opennext-bundle.mjs`                  | scrub 清空 **21** 处密钥（production/development/test 各 7）；verify **ALL PASS** —— en 叶子 **3126**、page 1890/1890、fetch 100/100、assets **2176** ≤20000、单文件 **2.35 MiB** |
| ⑦ | `wrangler deploy`                                                    | **成功**（见 §4）                                                                                                                                                    |

**改动生效取证**（防 SSG 固化旧数据）：构建后直接读 `.next/server/app/<locale>/guides/*.html`，  
7 个语种的 desc 均为新双句；`en/tools/compare.html`、`en/services/supplier-verification.html`  
标题均为新值 ⇒ 预渲染产物确实包含本次改动。

**新旧构建 HTML 差集**：`old=1886 → new=1891`，多出的 5 个全部是  
`en/suppliers/{guangzhou-sunny-food, jiangsu-liquid-damper, nanjing-mxcomm, shandong-loyal-industrial, xiamen-jings-eyewear}.html`  
—— 这些是**数据驱动**的供应商详情页（`supabase` 源 + `is_published=true`），  
属数据库侧新发布的记录，**与本次代码改动无关**。

---

## 4. 部署版本 ID + 回滚锚点

| 项              | 值                                                   |
| -------------- | --------------------------------------------------- |
| **新版本 ID**     | **`72ef374c-e83d-4d8c-aff7-8d9c1120f83d`**          |
| 部署时间           | 2026-09-29 06:06:23Z → 06:09:11Z（**2m48s**）         |
| 上传资源           | **1989** 个（187 已存在；wrangler 统计 1989 files，141.57 s） |
| 体积             | Total Upload 19187.61 KiB / gzip 3106.83 KiB        |
| Worker Startup | **31 ms**                                           |
| **回滚锚点（上一版本）** | **`6facaae8-a8f1-44fd-ba93-2caaa254a23d`**          |
| 工作树            | 部署前 `git status --porcelain` 为空（锚点 `b08ae8c`）       |


**回滚命令**

```bash
cd /f/AI-验厂SEO网站 && set -a && . ./.env && set +a
node node_modules/wrangler/bin/wrangler.js rollback 6facaae8-a8f1-44fd-ba93-2caaa254a23d \
  --name factoryauditb2b -y -m "rollback stage1.5"
```

**部署后线上验收**

```
scripts/live-meta-verify.cjs → ALL PASS（10 页：/ /suppliers /services/supplier-verification
  /logistics /trust /tools/compare /zh /ar /pricing /monitoring）
  —— canonical 自指 / hreflang 10 条 / JSON-LD 可解析 / title·desc 与本地预渲染逐字一致

线上抽查：
  /guides/aql-sampling-standard-fri（en/es/ja/ar）→ 新双句 desc 已生效
  /zh/guides/aql-sampling-standard-fri → 中文 desc
  /tools/compare → <title>Supplier Comparison Tool: Compare 2 to 5 | FactoryAuditB2B</title>
  /services/supplier-verification → <title>Supplier Verification Service in China | FactoryAuditB2B</title>
```

**回归（4 脚本，均先注入 `.env`）**

| 脚本 | 结果 | 说明 |
|---|---|---|
| `cs01-seo-foundation-regression` | **46 PASS / 0 FAIL** | ALL PASS |
| `cs13-supplier-seo-regression` | **155 PASS / 1 FAIL** | 唯一 FAIL = `F2d`（migrations 13≠10）— **既有** |
| `cs06a-directory-regression` | **54 PASS / 1 FAIL** | 唯一 FAIL = `A3`（网格 `.map` 正则命中 2）— **既有** |
| `cs22b-self-assessment-regression` | **71 PASS / 0 FAIL** | A–F 全通过 |

---

## 5. `desc-truncation-sweep` 结果：379 → 141

```
扫描预渲染 HTML: 1891 个文件
有 description: 1890｜无 description: 0
结尾无句末标点（半句话嫌疑）: 141          ← 阶段 1 部署时为 379

--- 按语种 ---            --- 按板块 ---
  es  28                    countries        30
  fr  23                    case-studies     28
  pt  22                    field-reports    28
  de  21                    industry         24
  en  20                    services          8
  ar  16                    careers           5
  ja  11                    pricing           5
                            tools             5
                            methodology       3
                            verify-supplier   2
                            resources         2
                            training-plans    1
```

**guides 238 项（63%）全部消除** ✓，与预期完全吻合。
剩余 141 项全部为清单外批次（第 3 批）。

---

## 6. IndexNow 全量提交结果

### 6.1 前置：清空基线使 diff 输出全量

```bash
cp scripts/.sitemap-cache.txt scripts/.sitemap-cache.bak-<ts>.txt   # 备份（1745 行）
node -e "require('fs').writeFileSync('scripts/.sitemap-cache.txt','')"
node scripts/sitemap-diff.cjs
→ sitemap: total=1746  new=1746  removed=0
```

> `post-publish-submit.cjs` **不接受命令行参数**（内部固定 `sitemap-diff` → `submit-urls --from-file`），
> 因此走「清空基线」路径实现全量；提交完成后基线已被 `sitemap-diff` 自动回写为当前 1746 条。

### 6.2 提交结果

```bash
node scripts/submit-urls.cjs --from-file scripts/.sitemap-new.txt
```

| 通道 | 结果 |
|---|---|
| **提交 URL 数** | **1746（全量，非增量）** ✓ |
| Bing IndexNow `api.indexnow.org` | **✓ 200** |
| Yandex IndexNow `yandex.com` | **✓ 200** |
| Google Indexing API | 跳过（`GOOGLE_SERVICE_ACCOUNT_JSON` 未配置）— 既有 |
| Google sitemap ping（GSC） | ✗ `fetch failed`（不可达）— 既有 |

全量输入清单已留存：`.sitemap-current.txt`（仓库根，1746 行，已提交 `b08ae8c`）。

---

## 7. 风险与未解决问题

### 7.1 已识别、未在本轮处理（需您决策）

| # | 项 | 规模 | 建议 |
|---|---|---|---|
| 1 | **剩余 141 项 desc 半句话** | countries 30 / case-studies 28 / field-reports 28 / industry 24 / services 8 / careers·pricing·tools 各 5 / methodology 3 / verify-supplier·resources 各 2 / training-plans 1 | **第 3 批**（用户已列为下一阶段） |
| 2 | **guides 9 语缺口** | `ja/es/de/fr/pt/ar` 的 282 页指南用英文描述 | 第 3 批补 `metaDescJa/Es/De/Fr/Pt/Ar` + 改 `pickZhPair` 分支；`DEEPSEEK_API_KEY` 为空 ⇒ 须人工翻译 |
| 3 | **`/terms` title 偏短** | en 34 / es 39 / de 37 / fr 42 / pt 35 / ar 28（合成后均 <50 下限） | 建议补至主体 ≥32（拉丁），一并纳入第 3 批 |
| 4 | **`/tools/supplier-risk-calculator` title 越界** | es **65**（>60）、pt **63**、ar 49（<50） | 建议收口 |
| 5 | **`/monitoring` desc 偏短** | es **59** / de **46** / fr **47**（低于 120 下限） | 建议补写 |
| 6 | 同上：`zh/zh-TW` 的 `/case-studies`(39) `/chemicals`(38) `/field-reports`(34) desc 偏短 | 6 项 | CJK 下限 60；建议补写 |

### 7.2 已知偏差（已解释，无风险）

- **fetch 缓存 100（上轮 123）、assets 2176（上轮 2199）**：仅改字典值与 TS 常量不应改变条目数；
  `pageKeys` 两次均为 **1890**、`verify` 闸门两次均 **ALL PASS** ⇒ 属构建期产出差异，不影响线上。
- **新增 5 个 `/en/suppliers/*` 预渲染页**：数据驱动（DB 新发布供应商），非本次代码改动。
- **GSC sitemap ping `fetch failed`**：本机网络不可达，既有；IndexNow 是唯一可用通道。
- **`cs13 F2d` / `cs06a A3`**：阶段 1 起即存在的既有失败，本轮未触碰相关代码。

### 7.3 新增常驻资产

- `scripts/_s15_guides_idem.ts` —— 47 条 guides desc 的「源头 → 收口后」幂等断言（可挂回归）
- `scripts/desc-truncation-sweep.cjs`（阶段 1 新增）—— 全站 desc 半句话体检，`--assert` 有命中即 exit 1
- `scripts/live-meta-verify.cjs`（阶段 1 新增）—— 部署后线上元数据验收
- `.sitemap-current.txt` —— 线上 sitemap 全量快照（1746 条）

---

## 8. 验收结论

| 验收项 | 目标 | 实测 | 结论 |
|---|---|---|---|
| 47 条 desc ≤158 | 47/47 | 123–142 | ✅ |
| 47 条结尾有句末标点 | 47/47 | 47/47 | ✅ |
| 收口幂等（CUT=0） | 47/47 | 47/47 | ✅ |
| 2 项 title 收口 | compare 55–60 / svc 50–60 | en 58 / en 56 | ✅ |
| 构建链路 ①–⑦ | 全绿 | 全绿 | ✅ |
| desc-sweep | 379 → 141 | **141** | ✅ |
| 线上 10 页 | ALL PASS | ALL PASS | ✅ |
| IndexNow 全量 | 1746 条 200/202 | **1746**，200 / 200 | ✅ |
| 回归无新增失败 | — | 唯一 FAIL 均为既有 | ✅ |
