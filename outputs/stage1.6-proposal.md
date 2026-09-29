# stage1.6 第 3 批 desc 修复 —— 改写建议（待确认）

> 生成时间：2026-09-29｜部署基线：CF `72ef374c`｜回滚锚点：`6facaae8`  
> 共 **66** 处源键改动，全部经 `trimMetaDescription` / `trimMetaTitle` 预演验证：**收口零命中（幂等）+ 结尾句末标点**。

## 0. 一处例外说明

`chemicals.metaTitle` 未动：zh/zh-TW 标题为 CJK（预算 36 字），不套拉丁 50–60 区间。

---

## 1. 数据源定位结果

| #  | 板块                                                                             | 数据源（唯一）                                                                              | 取值方式                                                  | 被标记页        |
| -- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------- | ----------- |
| 1  | countries 详情                                                                   | **字典 `countryHub.metaDesc`**                                                         | `{country}` 占位符替换（`name`=China…Philippines，纯拉丁）       | 30          |
| 2  | industry 分类                                                                    | **字典 `industryPage.metaDesc`**                                                       | `{industry}` 替换为**双语行业名**（如 `Food & Beverage / 食品饮料`） | 3           |
| 3  | industry 主题                                                                    | **`lib/industryContent.ts`** `INDUSTRY_COPY[..].topics[..].metaDesc.en/zh`           | `pickZhPair` ⇒ **7 语种回退 en**                          | 21          |
| 4  | case-studies 详情                                                                | **`lib/caseStudies.ts`** `CASE_STUDIES[..].metaDescEn/Zh`                            | `pickZhPair` ⇒ 7 语种回退 en                              | 28          |
| 5  | field-reports 详情                                                               | **`lib/fieldReports.ts`** `FIELD_REPORTS[..].metaDescEn/Zh`                          | `pickZhPair` ⇒ 7 语种回退 en                              | 28          |
| 6  | services                                                                       | 字典 `inspection.metaDesc` / `trainingPage.metaDesc` / `serviceVerification.metaDesc`  | 直读                                                    | 8           |
| 7  | careers / pricing / methodology / verify-supplier / resources / training-plans | 各自字典键                                                                                | 直读                                                    | 5+5+3+2+2+1 |
| 8  | tools 风险计算器                                                                    | 字典 `risk.page.metaDesc` + `risk.page.metaTitle`（页面拼 `\| FactoryAuditB2B RiskScore™`） | 直读 + 页面级后缀 29 字符                                      | 5           |
| 9  | monitoring                                                                     | 字典 `monitoring.metaDesc`                                                             | 直读（es/de/fr）                                          | 3（额外项）      |
| 10 | terms 标题                                                                       | 字典 `legal.termsTitle`（页面模板拼 `\| FactoryAuditB2B`，18 字符）                              | 直读                                                    | 6（额外项）      |
| 11 | chemicals 中文                                                                   | 字典 `chemicals.metaDesc`（zh 短，其余 8 语已达标）                                              | 直读                                                    | 2（额外项）      |
| 12 | case-studies 列表                                                                | **`CASE_LIST_META.zh`**                                                              | `pickZhCopy` ⇒ zh-TW 由 `twText` 繁化                    | 2（额外项）      |
| 13 | field-reports 列表                                                               | **`FIELD_REPORT_LIST_META.zh`**                                                      | 同上                                                    | 2（额外项）      |

🔴 **两个关键发现**

1. **`pickZhPair` 的 7 语种回退**：`case-studies` 4 条 + `field-reports` 4 条 + `industry` 主题 3 条 = **11 条 en 源头，覆盖 7 × 11 = 77 项**（占 141 的 55%）。
2. **`CJK_RE.test()` 把「拉丁文案 + 双语行业名」误判成中文** ⇒ 行业分类页的 desc 预算被压到 **90**（而非 158）。实测**影响 82 页**（76 个行业分类页 + 6 个供应商页），其 desc 被压在 64–90 字符。详见 §4。

---

## 2. 字典层改写对照（53 处）

| 源键                             | 语种 | 旧（源头→收口）    | 新（源头→收口）        | 结尾OK | 幂等 | 覆盖页 | 属 141 |
| ------------------------------ | -- | ----------- | --------------- | ---- | -- | --- | ----- |
| `countryHub.metaDesc`          | en | 173 → 152 ✗ | **130 → 130**   | ✓    | ✓  | 5   | 5     |
| `countryHub.metaDesc`          | es | 215 → 156 ✗ | **147 → 147**   | ✓    | ✓  | 5   | 5     |
| `countryHub.metaDesc`          | de | 173 → 153 ✗ | **128 → 128**   | ✓    | ✓  | 5   | 5     |
| `countryHub.metaDesc`          | fr | 198 → 155 ✗ | **132 → 132**   | ✓    | ✓  | 5   | 5     |
| `countryHub.metaDesc`          | pt | 208 → 151 ✗ | **134 → 134**   | ✓    | ✓  | 5   | 5     |
| `countryHub.metaDesc`          | ar | 174 → 152 ✗ | **122 → 122**   | ✓    | ✓  | 5   | 5     |
| `industryPage.metaDesc`        | es | 174 → 84 ✗  | **85 → 85**     | ✓    | ✓  | 13  | 2     |
| `industryPage.metaDesc`        | pt | 156 → 83 ✗  | **82 → 82**     | ✓    | ✓  | 13  | 1     |
| `inspection.metaDesc`          | en | 191 → 155 ✗ | **132 → 132**   | ✓    | ✓  | 1   | 1     |
| `inspection.metaDesc`          | es | 207 → 155 ✗ | **157 → 157**   | ✓    | ✓  | 1   | 1     |
| `inspection.metaDesc`          | de | 183 → 151 ✗ | **135 → 135**   | ✓    | ✓  | 1   | 1     |
| `inspection.metaDesc`          | fr | 225 → 156 ✗ | **156 → 156**   | ✓    | ✓  | 1   | 1     |
| `inspection.metaDesc`          | pt | 189 → 157 ✗ | **144 → 144**   | ✓    | ✓  | 1   | 1     |
| `trainingPage.metaDesc`        | es | 172 → 151 ✗ | **142 → 142**   | ✓    | ✓  | 1   | 1     |
| `trainingPage.metaDesc`        | fr | 160 → 155 ✗ | **130 → 130**   | ✓    | ✓  | 1   | 1     |
| `serviceVerification.metaDesc` | es | 261 → 147 ✗ | **149 → 149**   | ✓    | ✓  | 1   | 1     |
| `careers.metaDesc`             | en | 167 → 157 ✗ | **138 → 138**   | ✓    | ✓  | 1   | 1     |
| `careers.metaDesc`             | es | 177 → 149 ✗ | **128 → 128**   | ✓    | ✓  | 1   | 1     |
| `careers.metaDesc`             | de | 181 → 151 ✗ | **130 → 130**   | ✓    | ✓  | 1   | 1     |
| `careers.metaDesc`             | fr | 203 → 156 ✗ | **138 → 138**   | ✓    | ✓  | 1   | 1     |
| `careers.metaDesc`             | pt | 180 → 151 ✗ | **138 → 138**   | ✓    | ✓  | 1   | 1     |
| `pricing.metaDesc`             | en | 187 → 154 ✗ | **150 → 150**   | ✓    | ✓  | 1   | 1     |
| `pricing.metaDesc`             | es | 238 → 154 ✗ | **157 → 157**   | ✓    | ✓  | 1   | 1     |
| `pricing.metaDesc`             | de | 180 → 148 ✗ | **130 → 130**   | ✓    | ✓  | 1   | 1     |
| `pricing.metaDesc`             | fr | 212 → 151 ✗ | **143 → 143**   | ✓    | ✓  | 1   | 1     |
| `pricing.metaDesc`             | pt | 254 → 154 ✗ | **141 → 141**   | ✓    | ✓  | 1   | 1     |
| `risk.page.metaDesc`           | en | 218 → 149 ✗ | **142 → 142**   | ✓    | ✓  | 1   | 1     |
| `risk.page.metaDesc`           | es | 235 → 151 ✗ | **151 → 151**   | ✓    | ✓  | 1   | 1     |
| `risk.page.metaDesc`           | de | 243 → 153 ✗ | **152 → 152**   | ✓    | ✓  | 1   | 1     |
| `risk.page.metaDesc`           | fr | 260 → 147 ✗ | **151 → 151**   | ✓    | ✓  | 1   | 1     |
| `risk.page.metaDesc`           | pt | 227 → 155 ✗ | **140 → 140**   | ✓    | ✓  | 1   | 1     |
| `risk.page.metaTitle`          | es | 主体 36       | **主体 31｜合成 60** | —    | —  | 1   | —     |
| `risk.page.metaTitle`          | fr | 主体 33       | **主体 29｜合成 58** | —    | —  | 1   | —     |
| `risk.page.metaTitle`          | pt | 主体 34       | **主体 30｜合成 59** | —    | —  | 1   | —     |
| `risk.page.metaTitle`          | ar | 主体 20       | **主体 26｜合成 55** | —    | —  | 1   | —     |
| `methodology.metaDesc`         | es | 249 → 153 ✗ | **156 → 156**   | ✓    | ✓  | 1   | 1     |
| `methodology.metaDesc`         | fr | 240 → 157 ✗ | **150 → 150**   | ✓    | ✓  | 1   | 1     |
| `methodology.metaDesc`         | pt | 233 → 153 ✗ | **155 → 155**   | ✓    | ✓  | 1   | 1     |
| `verifySupplier.metaDesc`      | de | 166 → 157 ✗ | **127 → 127**   | ✓    | ✓  | 1   | 1     |
| `verifySupplier.metaDesc`      | es | 159 → 149 ✗ | **126 → 126**   | ✓    | ✓  | 1   | 1     |
| `resourcesIndex.metaDesc`      | es | 162 → 148 ✗ | **148 → 148**   | ✓    | ✓  | 1   | 1     |
| `resourcesIndex.metaDesc`      | fr | 163 → 151 ✗ | **148 → 148**   | ✓    | ✓  | 1   | 1     |
| `trainingPlans.metaDesc`       | es | 161 → 152 ✗ | **133 → 133**   | ✓    | ✓  | 1   | 1     |
| `legal.termsTitle`             | en | 主体 16       | **主体 35｜合成 53** | —    | —  | 1   | —     |
| `legal.termsTitle`             | es | 主体 21       | **主体 37｜合成 55** | —    | —  | 1   | —     |
| `legal.termsTitle`             | de | 主体 19       | **主体 39｜合成 57** | —    | —  | 1   | —     |
| `legal.termsTitle`             | fr | 主体 24       | **主体 34｜合成 52** | —    | —  | 1   | —     |
| `legal.termsTitle`             | pt | 主体 17       | **主体 40｜合成 58** | —    | —  | 1   | —     |
| `legal.termsTitle`             | ar | 主体 10       | **主体 33｜合成 51** | —    | —  | 1   | —     |
| `monitoring.metaDesc`          | es | 217 → 59    | **148 → 148**   | ✓    | ✓  | 1   | —     |
| `monitoring.metaDesc`          | de | 252 → 46    | **143 → 143**   | ✓    | ✓  | 1   | —     |
| `monitoring.metaDesc`          | fr | 243 → 47    | **158 → 158**   | ✓    | ✓  | 1   | —     |
| `chemicals.metaDesc`           | zh | 38 → 38     | **61 → 61**     | ✓    | ✓  | 1   | —     |

### 2b. title 越界对照（10 处）

| 源键                    | 语种 | 旧主体 | 旧合成 | 新主体    | 新合成    | 目标 50–60 |
| --------------------- | -- | --- | --- | ------ | ------ | -------- |
| `risk.page.metaTitle` | es | 36  | 65  | **31** | **60** | ✓        |
| `risk.page.metaTitle` | fr | 33  | 62  | **29** | **58** | ✓        |
| `risk.page.metaTitle` | pt | 34  | 63  | **30** | **59** | ✓        |
| `risk.page.metaTitle` | ar | 20  | 49  | **26** | **55** | ✓        |
| `legal.termsTitle`    | en | 16  | 34  | **35** | **53** | ✓        |
| `legal.termsTitle`    | es | 21  | 39  | **37** | **55** | ✓        |
| `legal.termsTitle`    | de | 19  | 37  | **39** | **57** | ✓        |
| `legal.termsTitle`    | fr | 24  | 42  | **34** | **52** | ✓        |
| `legal.termsTitle`    | pt | 17  | 35  | **40** | **58** | ✓        |
| `legal.termsTitle`    | ar | 10  | 28  | **33** | **51** | ✓        |

---

## 3. TS 内容层改写对照（13 处）

| 源（文件·字段）                                              | 生效语种     | 旧（源头→收口）    | 新（源头→收口）      | 结尾OK | 幂等 | 覆盖页 | 属 141 |
| ----------------------------------------------------- | -------- | ----------- | ------------- | ---- | -- | --- | ----- |
| `caseStudies/trading-company-posing-as-factory`       | en×7     | 185 → 147 ✗ | **144 → 144** | ✓    | ✓  | 7   | 7     |
| `caseStudies/legal-entity-mismatch-before-deposit`    | en×7     | 192 → 155 ✗ | **142 → 142** | ✓    | ✓  | 7   | 7     |
| `caseStudies/label-defect-stopped-before-loading`     | en×7     | 160 → 151 ✗ | **135 → 135** | ✓    | ✓  | 7   | 7     |
| `caseStudies/qualifying-replacement-supplier-vietnam` | en×7     | 171 → 154 ✗ | **127 → 127** | ✓    | ✓  | 7   | 7     |
| `fieldReports/carton-count-mismatch-at-loading`       | en×7     | 165 → 157 ✗ | **138 → 138** | ✓    | ✓  | 7   | 7     |
| `fieldReports/moisture-in-cartons-before-shipment`    | en×7     | 161 → 146 ✗ | **151 → 151** | ✓    | ✓  | 7   | 7     |
| `fieldReports/shared-building-fire-exits`             | en×7     | 175 → 150 ✗ | **135 → 135** | ✓    | ✓  | 7   | 7     |
| `fieldReports/undisclosed-subcontracted-process`      | en×7     | 162 → 155 ✗ | **126 → 126** | ✓    | ✓  | 7   | 7     |
| `industry/food-beverage/food-factory-audit-checklist` | en×7     | 166 → 148 ✗ | **133 → 133** | ✓    | ✓  | 7   | 7     |
| `industry/food-beverage/food-supplier-verification`   | en×7     | 163 → 156 ✗ | **136 → 136** | ✓    | ✓  | 7   | 7     |
| `industry/chemicals/chemical-supplier-verification`   | en×7     | 172 → 157 ✗ | **136 → 136** | ✓    | ✓  | 7   | 7     |
| `CASE_LIST_META.zh`                                   | zh/zh-TW | 39 → 39     | **62 → 62**   | ✓    | ✓  | 2   | —     |
| `FIELD_REPORT_LIST_META.zh`                           | zh/zh-TW | 34 → 34     | **62 → 62**   | ✓    | ✓  | 2   | —     |

---

## 4. 覆盖汇总

| 组      | 源键改动数 | 覆盖页面数 | 其中属「141 项」 |
| ------ | ----- | ----- | ---------- |
| 字典层    | 53    | 101   | 64         |
| TS 内容层 | 13    | 81    | 77         |

- `countryHub.metaDesc` 单语种 → **5 页**（china/malaysia/philippines/thailand/vietnam）
- `caseStudies/*.metaDescEn` 单条 → **7 页**（en/ja/es/de/fr/pt/ar）
- 11 条 en 源头 ⇒ **77 页**
- `CASE_LIST_META.zh` / `FIELD_REPORT_LIST_META.zh` 单条 → **2 页**（zh + zh-TW）

### 🔴 关于「industry 分类页 desc 只能到 84 字符」

`lib/pageMeta.ts` 的预算判定是 `CJK_RE.test(text) ? 90 : 158`——**只要有 1 个 CJK 字符就按 90 算**。  
行业分类页把 `{industry}` 替换成**双语名**（`Food & Beverage / 食品饮料`，22 字符含 4 个汉字），  
于是一整段拉丁文案的预算被压到 90。实测**全站 82 页**受此影响（76 行业分类页 + 6 供应商页），desc 长度被夹在 **64–90**。

| 方案             | 做法                                      | 行业分类页 desc（es 为例） | 影响面       | 风险                          |
| -------------- | --------------------------------------- | ----------------- | --------- | --------------------------- |
| **A（默认，本次只做）** | 只改源头，把行业名后的句子收短，保证含双语名 ≤90              | 84 字符             | 0（不改收口函数） | 无                           |
| **A+B（建议追加）**  | 把 `CJK_RE.test()` 改为**CJK 占比 > 25%** 判定 | 约 100–158 字符      | **82 页**  | 改动全站收口器，需全量重跑 sweep + 4 个回归 |

---

## 5. 风险与未解决问题

1. **`legal.termsTitle` 的 ar 值疑似原译文有误**：现值 `مدة الخدمة` 字面是「服务期限」，非「服务条款」；建议改为 `شروط الخدمة وقواعد استخدام المنصة`。**属语义订正，需您确认**。
2. **`risk.page.metaTitle` 的语义词挪动**：为把合成标题压进 50–60，es/fr/pt 改用「采购风险计算器」措辞（`riesgo de compra` / `risque d'achat` / `risco de compra`），en 保持 `Supplier Risk Calculator` 不变。若您希望严格保留「供应商」字面，则只能接受 62–65 字符的越界值——**请二选一**。
3. **`countryHub.metaDesc` 的 ar 原本是英文未翻译**（`Supplier verification and factory audit in {country}: …`）。本次一并译为阿拉伯语。
4. **新增中文串未进 `TW_MAP.str` 全串映射**：`twText` 走词组/单字兜底，实测输出正确（`文档`→`檔案` 等），但若要严格一致应重跑 `scripts/gen-tw-mapping.py`。
5. **存在绕过 `buildPageMetadata` 的页面**：`/tools`、`/tools/supplier-verification-checklist` 直接写 `metadata`，**不经 desc 收口**（实测 es desc 达 208 字符）。属另一类问题（未收口 ≠ 半句话），不在 141 内，未动。
6. **仍非幂等的 desc 源键（CUT=Y 但结尾有标点）**：全站审计命中 96 处（如 `coverage.metaDesc`、`servicesIndex.metaDesc`、`methodology.metaDesc` en/de、`monitoring.metaDesc` en/pt/ar 等）。它们渲染出的 desc **是完整句子**，仅比源头短，不属缺陷类；若要求全站幂等需再开一批。
