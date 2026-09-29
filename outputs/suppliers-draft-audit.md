# 内容侧路径① —— 12 家供应商草稿审核清单（只读，未做任何改动）

- 审核时间：2026-09-29
- 数据源：Supabase 生产库 `tcyhstswppoqwlmchsmc`（**只读**查询通道 `scripts/db-apply-sql.mjs --read-only`）
- 库内现状：`suppliers` 共 **21 行** = 已发布 **9** 家（`is_published=true`）+ 草稿 **12** 家（`is_published=false`）
- **本文件为审核结论，未写库、未改代码、未删除任何数据**

## 0. 结论摘要

| 分类 | 数量 | slug |
|---|---|---|
| **测试脏数据**（建议清理，先标记不删） | **4** | `supplier`、`step12-automated-verify-co`、`xiamen-jintaijin-polish-tech-co-ltd-1`、`xiamen-jintaijin-polish-tech-co-ltd-2` |
| 真实申请 · 可发布（补齐 0–1 项） | **2** | `u-w-y-company-limited`、`xiamen-jintaijin-polish-tech-co-ltd` |
| 真实申请 · 需补字段后才能发布 | **4** | `qingdao-xiuxinyang-international-trade-co-ltd`、`guangdong-junchi-sports-products-co-ltd`、`shenzhen-jorigin-packaging`、`loomeami` |
| 真实企业 · 暂不具备发布条件 | **2** | `batik-soehadi`（超出覆盖国）、`jisun`（来源可疑 + 字段缺） |

🔴 **一个必须先跟你说清的判断**：草稿行上的 `source_type` / `source_name` 两列**在真实入驻流程里根本不会被写入**。
注册接口 `app/api/supplier-register/route.ts` 的 `createSupplierDraft()`（第 133–217 行）只写 `suppliers` 草稿、`supplier_consents`、`admin_audit_log`，**没有写 `source_type` / `source_name`**。因此「检查 `source_type` 是否为 `supplier_application`」这项**对本批 12 家中的 11 家恒为 NULL**（唯一命中的 `shenzhen-jorigin-packaging` 反而是人工从邮箱录入的那条）。
👉 真正可核的来源留痕在 **`leads`（kind=supplier_application, tool=supplier-register）** 与 **`supplier_consents`** 两张表。本审核即以这两张表为主证据。

## 1. 12 家草稿完整清单

| # | slug | legal_name | 判断 | 理由（证据） |
|---|---|---|---|---|
| 1 | `qingdao-xiuxinyang-international-trade-co-ltd` | Qingdao Xiuxinyang International Trade Co., Ltd. | 真实 · 需补 | 有 lead `LEAD-BNDRPB`（2026-09-16）+ `supplier_consents` v1.0；联系人 Hunter／`hunter@qdxiuxinyang.com`／+86 153 1550 9971。⚠️ 公司名是 **International Trade**（贸易商，非工厂）；公司名写 Qingdao 但 `city="Rizhao, Shandong"` |
| 2 | `u-w-y-company-limited` | U.W.Y Company Limited | 真实 · **可发布** | lead `LEAD-LVKE6H` + consent；字段最全（industry=electronics／city／established=2005／address／website 均齐全）。⚠️ `english_name` 含破折号「—」与营销语「the professional display brand of」 |
| 3 | `xiamen-jintaijin-polish-tech-co-ltd` | Xiamen Jintaijin Polish Tech Co., Ltd. | 真实 · **可发布** | lead `LEAD-EWSP5U` + consent；industry=machinery／city=Xiamen／website surface-polish.com／address 齐全 |
| 4 | `guangdong-junchi-sports-products-co-ltd` | Guangdong Junchi Sports Products Co., Ltd. | 真实 · 需补 | lead `LEAD-5KCPV2` + consent；website qnovasports.com；city=Qingyuan。缺 `country_code`(unknown)、`industry_code`(NULL) |
| 5 | `shenzhen-jorigin-packaging` | Shenzhen Jiayuanmei Packaging Materials Co., Ltd. | 真实 · 需补授权留痕 | `source_type=supplier_application`／`source_name="Resend inbox 2026-09"`／created 2026-09-11（**早于** `leads` 表首条 09-13）⇒ 人工从邮件录入。**无 `supplier_consents` 行、无 `leads` 行**。⚠️ slug「jorigin」／法人名「Jiayuanmei」／域名 joriginpackaging.com 三名不一致 |
| 6 | `loomeami` | Loomeami | 真实 · 需补 | lead `LEAD-WUF5SP` + consent。`city="unknown"`；legal_name 是**品牌名**不是工商名；邮箱域名 `sky-run.com` ≠ 品牌域名 `loomeami.com` |
| 7 | `batik-soehadi` | Batik Soehadi | 真实 · **暂不可发布** | lead `LEAD-LVBN53` + consent；`country_code="indonesia"`。**印尼只在 `lib/coverage.ts` 的 `COVERAGE_ROADMAP` phase 2，没有国家页**，发布会产生指向不存在国家页的供应商档案，并与「5 国覆盖」定位冲突 |
| 8 | `jisun` | Jisun | 真实企业 · 来源待核 | lead `LEAD-SBNZDL`（2026-09-28，最新一条）+ consent；`jisun-arcade.com` 是真实站点。⚠️ `country_code="cn"`（值域不一致）；`consent_user_agent` 是 **HeadlessChrome**；industry_code=NULL、address=NULL、legal_name 仅品牌名 |
| 9 | `supplier` | 青岛信戈诺科技有限公司 | **测试脏数据**（真实内容 + 占位 slug） | lead `LEAD-TLMWKK` + consent，内容是真实企业；但 **slug 字面就是 `"supplier"`**（`uniqueSlug()` 兜底路径的产物）；industry_code=NULL、country_code=unknown；`city="青岛"`（中文，与其余行罗马字不一致）；邮箱个人 hotmail |
| 10 | `step12-automated-verify-co` | STEP12 Automated Verify Co | **测试脏数据** | 邮箱 `step12-register@example.com`（**example.com**）；`main_products=["verification only"]`；无 website；slug 自带 `automated-verify` |
| 11 | `xiamen-jintaijin-polish-tech-co-ltd-1` | Xiamen Jintaijin Polish Tech Co., Ltd. | **测试脏数据**（重复导入） | 与 #3 **同法人名／同邮箱／同网站**；created 2026-09-21，industry_code=NULL |
| 12 | `xiamen-jintaijin-polish-tech-co-ltd-2` | Xiamen Jintaijin Polish Tech Co., Ltd. | **测试脏数据**（重复导入） | 第三次导入，created 2026-09-22，`english_name="SurfacePolish"` |

## 2. 测试脏数据识别结果

**明确判定为测试脏数据 = 4 条**（与你的判断一致）：

| slug | 判据（任一条即足以定性） |
|---|---|
| `step12-automated-verify-co` | 邮箱域名 `example.com`；`main_products=["verification only"]`；slug 含 `automated-verify`；来自 STEP12 自动化验收脚本 |
| `xiamen-jintaijin-polish-tech-co-ltd-1` | 与已存在的 `xiamen-jintaijin-polish-tech-co-ltd` 同法人名/同邮箱/同网站 —— 重复导入 |
| `xiamen-jintaijin-polish-tech-co-ltd-2` | 同上，第三次重复导入 |
| `supplier` | slug 字面 `"supplier"`（`uniqueSlug()` 兜底产物），非正常 slug 形态 |

**另有 1 条孤立测试线索**（不在 `suppliers` 表内，附带汇报）：
- `leads` 里 `LEAD-GS63JJ` = `CS02D Live Factory Co., Ltd.` / `cs02d-mtz4wziq-sup@example.com`（CS-02D 回归测试），**没有对应的 supplier 草稿行**。

**未判为脏数据但需注意**：`jisun` 的 `consent_user_agent` 为 `HeadlessChrome`（无头浏览器），可能是脚本/代理提交，但企业本体（jisun-arcade.com）真实 ⇒ 归入「来源待核」，不归入脏数据。

> 约束遵守：**以上 4 条不删除、不修改，仅在此标记**，等你确认后再处理。

## 3. 真实入驻审核结果

### 3.1 来源与同意留痕核查（`leads` + `supplier_consents`）

| slug | `leads`（kind=supplier_application） | `supplier_consents` | `authorized_at`/`authorized_by` |
|---|---|---|---|
| qingdao-xiuxinyang-… | ✅ LEAD-BNDRPB | ✅ v1.0 given=true | ❌ 均 NULL |
| u-w-y-company-limited | ✅ LEAD-LVKE6H | ✅ v1.0 | ❌ NULL |
| xiamen-jintaijin-polish-tech-co-ltd | ✅ LEAD-EWSP5U | ✅ v1.0 | ❌ NULL |
| guangdong-junchi-… | ✅ LEAD-5KCPV2 | ✅ v1.0 | ❌ NULL |
| loomeami | ✅ LEAD-WUF5SP | ✅ v1.0 | ❌ NULL |
| batik-soehadi | ✅ LEAD-LVBN53 | ✅ v1.0 | ❌ NULL |
| jisun | ✅ LEAD-SBNZDL | ✅ v1.0 | ❌ NULL |
| shenzhen-jorigin-packaging | ❌ 无 | ❌ 无 | ❌ NULL |
| supplier | ✅ LEAD-TLMWKK | ✅ v1.0 | ❌ NULL |
| step12-automated-verify-co | ✅ LEAD-D3R69E | ✅ v1.0 | ❌ NULL |
| xiamen-…-1 | ✅ LEAD-GQ98NR | ✅ v1.0 | ❌ NULL |
| xiamen-…-2 | ✅ LEAD-9YE7E2 | ✅ v1.0 | ❌ NULL |

**结论**：
1. **11/12 有 web 端授权留痕**（`leads` + `supplier_consents` 双写，consent_version=1.0，IP/UA 服务端取）；唯一例外 `shenzhen-jorigin-packaging` 无任何留痕。
2. `authorized_at` / `authorized_by` **12/12 全为 NULL** —— 这两列属于「Admin 显式批准」用列（CS-22 语义），注册流程不写它们，因此**不能**当作来源留痕的替代。
3. **`source_type` / `source_name` 在注册流程中未被写入**（见 §0 红字）—— 若你希望「内部留痕」体现在这两列上，需要在 `createSupplierDraft()` 里补写，这属于**代码改动**，等你拍板。

### 3.2 逐条审核结论

| slug | 结论 | 阻塞项 |
|---|---|---|
| `u-w-y-company-limited` | ✅ **通过**（建议首批发布） | 仅 `english_name` 含破折号+营销语，上站前建议清洗（不阻塞发布） |
| `xiamen-jintaijin-polish-tech-co-ltd` | ✅ **通过**（建议首批发布） | 无 |
| `qingdao-xiuxinyang-international-trade-co-ltd` | ⚠️ 需补充 | ①`city` 与公司名不一致（Qingdao vs Rizhao）需核对；②确认是否按「贸易商」展示（`business_type` 为空） |
| `guangdong-junchi-sports-products-co-ltd` | ⚠️ 需补充 | `country_code=unknown`、`industry_code=NULL` |
| `shenzhen-jorigin-packaging` | ⚠️ 需补充 | ①补 web 授权留痕（无 consent/lead）；②核对三名一致性；③`industry_code` 已有(packaging)，其余字段尚可 |
| `loomeami` | ⚠️ 需补充 | ①`city=unknown`；②补工商全称；③邮箱域名与品牌域名不一致需确认归属 |
| `batik-soehadi` | ❌ **暂不发布** | 超出覆盖国（印尼 = ROADMAP phase 2，无国家页） |
| `jisun` | ❌ **暂不发布** | ①来源可疑（HeadlessChrome）；②`industry_code=NULL`；③`address=NULL`；④`country_code` 需归一 |

## 4. 字段补充清单

### 4.1 `country_code` 值域统一（你已授权「仅此项可改代码」）

| slug | 现值 | 建议值 | 依据 |
|---|---|---|---|
| `jisun` | `cn` | `china` | 城市 = Panyu District, Guangzhou；`COVERAGE_COUNTRIES` 用 `china` |
| `supplier` | `unknown` | `china` | legal_name = 青岛信戈诺科技有限公司；city=青岛 |
| `guangdong-junchi-sports-products-co-ltd` | `unknown` | `china` | legal_name 前缀 Guangdong；city=Qingyuan |

> 说明：`app/api/supplier-register/route.ts` 的 `resolveCountryCode()` 在无法匹配覆盖国时降级为 `"unknown"`（草稿未发布，设计上允许）—— 这三条属**注册时自由文本没写成覆盖国名**，需在发布前归一。**归一操作是数据改动，等你确认后执行。**

### 4.2 `industry_code` 缺失（6 条）

`guangdong-junchi-sports-products-co-ltd`、`jisun`、`step12-automated-verify-co`、`supplier`、`xiamen-…-1`、`xiamen-…-2`（后三条为脏数据/重复，可忽略）。

### 4.3 其他数据质量项（不阻塞，但会在页面上直接可见）

| slug | 问题 | 影响 |
|---|---|---|
| `u-w-y-company-limited` | `english_name` = `UWYES — the professional display brand of U.W.Y Company Limited` | 含 `—`（若进 title/desc 会触发「无破折号」红线）+ 营销语 |
| `qingdao-xiuxinyang-…` | 公司名含 `International Trade` | 平台卖点是「工厂/供应商」→ 需决定贸易商是否收录 |
| `supplier` | `city="青岛"`（中文） | 其余行均为罗马字，列表页会出现中英混排 |
| `loomeami` | `city="unknown"` | 页面会渲染 `—`（按「缺失值不用 0 顶替」铁律） |
| `jisun` | `city="Panyu District, Guangzhou"` | 城市粒度与其他行不一致（其他为 `Shenzhen`、`Xiamen`） |

### 4.4 不会展示的字段（供你放心）

`ROW_SELECT`（`lib/queries.ts:327`）**不含** `contact_email` / `contact_person` / `whatsapp` / `phone` / `company_description` / `source_url` ⇒ 即使发布，联系方式与来源 URL **都不会出现在公开页面**，与「`source_url` 先不展示、内部留痕」的裁决一致，**零代码改动**。

## 5. 发布计划（等你确认后执行）

### 5.1 分级建议

| 级别 | slug | 前置动作 |
|---|---|---|
| **A · 建议首批发布** | `u-w-y-company-limited`、`xiamen-jintaijin-polish-tech-co-ltd` | 无需补字段（`english_name` 破折号可选清洗） |
| **B · 补齐后发布** | `qingdao-xiuxinyang-…`、`guangdong-junchi-…`、`shenzhen-jorigin-packaging`、`loomeami` | 按 §4 补 `country_code`/`industry_code`/`city`；`shenzhen-jorigin-packaging` 需先补授权留痕 |
| **C · 暂不发布** | `batik-soehadi`（超覆盖国）、`jisun`（来源待核）、`supplier`、`xiamen-…-1`、`xiamen-…-2`、`step12-automated-verify-co` | 待你裁决或另行处理 |

### 5.2 发布动作（A 级，2 家）

1. `UPDATE suppliers SET is_published=true, profile_status='public' WHERE slug IN ('u-w-y-company-limited','xiamen-jintaijin-polish-tech-co-ltd');`
2. **重建 + 重新部署**（SSG 冻结：发布即数据冻结，必须清 `.next/cache` 后重建再部署）
3. 构建后必数：**`/suppliers/*.html = 81 + 2×9 = 99`**，`/guides/*.html = 423` 不变
4. 部署后线上验收 4 页（`/suppliers/u-w-y-company-limited`、`/suppliers/xiamen-jintaijin-polish-tech-co-ltd` + 2 个非 en 语种）
5. 确认 `sitemap` 是否收录、`COVERAGE` 国家页计数是否一致

### 5.3 若不采纳 A 级分级

也可以「零发布」先只做 §4.1 的 `country_code` 归一 + 清理脏数据（不删，改 `profile_status='rejected'` 之类），把发布推到下一轮。**请指定走哪条。**

## 6. 约束遵守声明

| 约束 | 状态 |
|---|---|
| 不改现有 9 家已发布数据 | ✅ 未触碰（只读查询 9 家 `country_code`/`profile_status` 核验） |
| 不改代码 | ✅ 未改（`country_code` 归一**也尚未执行**，等你确认） |
| 测试脏数据不删除、先标记 | ✅ 仅在本文标记 |
| 每个操作留痕 | ✅ 本文即留痕；查询走 `--read-only` 通道 |
| 不覆盖现有非空字段 | ✅ 未做任何写操作 |
| `is_published` 显式传 `false` | ✅ 未做写操作（注册流程本身已是显式 `is_published: false`，见 route.ts:176） |
