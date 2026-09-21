# STEP 13-A — PRE-CODE AUDIT（只读审计，未改任何代码/数据）

> 时间：2026-09-21　对象：FactoryAuditB2B 生产库 + `F:\AI-验厂SEO网站`
> 模式：READ ONLY → AUDIT → REPORT → 再开发。本阶段**零 DML / 零代码改动**。
> 渠道：`scripts/db-apply-sql.mjs --read-only`（Supabase Management API，`read_only=true`）

---

## 1. Git 状态

| 项 | 值 |
| --- | --- |
| branch | `main` |
| HEAD | `2042b4b06a9d998d7273feb2447a1fd2cd683ff7` |
| `git log -1 --format=%H` | 与 `rev-parse HEAD` **一致** ⇒ STEP 12 commit 真实落盘 |
| 与远端 | `## main...origin/main [ahead 2]` |
| working tree | **脏**（2 个已跟踪文件被改 + 大量未跟踪临时产物） |

已跟踪文件的未提交改动：

- `middleware.ts` —— **STEP 09 ROUTE-04 的 legacy cluster 301 块**（22 行新增）。该代码**已随 STEP 09/12 上线生产**，但从未 commit，属「live-but-uncommitted drift」。
- `STEP12-ACCEPTANCE.md` —— 文档补丁，无害。

未跟踪：`step12-*.txt` 临时输出、`step12-backup.json`、`supabase/migrations/025/026`、`seed_p0_clusters.sql`、`.next.*` / `.open-next.*` 备份目录、`tmp/`。

> 处理方式：开工前先用一条独立 commit 固化 `middleware.ts` 漂移（它是生产事实，不应继续裸奔），CS 提交保持干净。

---

## 2. Database 状态（真实 SQL，非文档推断）

### 2.1 计数

| 表 | 真实值 | STEP 12 文档值 | 差异 |
| --- | --- | --- | --- |
| suppliers | **18** | 17 | **+1**（`step12-automated-verify-co`，STEP 12 线上验收脚本自己注册的测试供应商） |
| suppliers.published | 9 | 9 | 一致 |
| suppliers 未发布 | 9 | 8 | +1（同上，测试） |
| province 非空 | 14/18 | 14/17 | 一致（新行 province=NULL） |
| industry_code 非空 | 15/18 | 15/17 | 一致 |
| country_code 非空 | 18/18 | — | — |
| city 非空 | 18/18 | — | 含 `loomeami.city="unknown"` 字符串 |
| leads 总数 | 15 | 14 | +1（测试） |
| leads.supplier_application | **9** | 7 | 7 真实 + `CS02D Live Factory`（测试）+ `STEP12 Automated Verify Co`（测试） |
| rfqs 总数 | **8** | 6 | **+2**：`RFQ-94PJZS` / `RFQ-2EUKYM`（STEP 12 线上验收脚本提交） |
| rfqs.is_public=true | 1 | 1 | 仅真实那条 |
| rfqs 有 source_type | 2 | — | 全部是 STEP 12 新增的 2 条 |
| rfqs 有 source_path | 5 | — | — |
| rfq_matches | **0** | 0 | 一致 |

### 2.2 verification 分布

`AUDITED` 1 / `Document Verified` 1 / `Factory Verified` 1 / `Identity Verified` 2 / NULL 13。

### 2.3 约束（真实 `pg_constraint`，不是记忆）

```text
rfq_matches_status_check : status IN ('suggested','contacted','won','lost')     ← 与 spec 一致，无 'matched'
rfqs_status_check        : status IN ('new','reviewing','matched','closed')      ← 注意 rfqs 里 'matched' 合法
leads_status_check       : status IN ('new','contacted','quoted','won','lost')   ← 🔴 没有 reviewing / approved / rejected
leads_kind_check         : kind IN ('buyer_lead','supplier_application','supplier_claim','supplier_verification')
```

`rfq_matches` 外键：`rfq_id → rfqs(id) ON DELETE CASCADE`、`supplier_id → suppliers(id) ON DELETE CASCADE`。
**`rfq_matches` 上没有 (rfq_id, supplier_id) 唯一约束** ⇒ 幂等只能靠应用层保证（STEP 12 已做）。
`rfq_matches` 列只有 `id, rfq_id, supplier_id, note, status, created_at` ⇒ **无 updated_at**，状态流转的可追溯性只能靠 `admin_audit_log`。

### 2.4 列名纠错（别再猜）

- `suppliers` **没有 `company_name`**：名称列是 `legal_name` / `display_name` / `english_name`。
- `leads` **没有 `city`**：只有 `company` / `country` / `supplier_name` / `payload(jsonb)`。
- `supplier_consents` **没有 `consent_ip`**（是 `ip_address`）／没有 `supplier_id`？→ 有 `supplier_id`，另有 `consent_type`。

---

## 3. Supplier 现状

已发布 9 家（全部可参与匹配）：

| slug | country | province | city | industry | verification |
| --- | --- | --- | --- | --- | --- |
| shenzhen-precision-electronics | china | Guangdong | Shenzhen | electronics | Factory Verified |
| guangzhou-textile-factory | china | Guangdong | Guangzhou | textiles | Document Verified |
| dongguan-plastic-molding | china | Guangdong | Dongguan | plastics | Identity Verified |
| ho-chi-minh-garment | vietnam | — | Ho Chi Minh | textiles | Identity Verified |
| nanjing-mxcomm | china | Jiangsu | Nanjing | electronics | — |
| guangzhou-sunny-food | china | Guangdong | Guangzhou | food-beverage | **AUDITED / on_site_audit** |
| xiamen-jings-eyewear | china | Fujian | Xiamen | **eyewear（不在 13 项白名单）** | — |
| shandong-loyal-industrial | china | Shandong | Jinan | machinery | — |
| jiangsu-liquid-damper | china | Jiangsu | Jiangsu | machinery | — |

未发布 9 家：`shenzhen-jorigin-packaging`、`qingdao-xiuxinyang-international-trade-co-ltd`、`u-w-y-company-limited`、`supplier`（脏：country=unknown / slug 非法 / industry NULL）、`loomeami`（city=unknown）、`batik-soehadi`（province NULL）、`guangdong-junchi-sports-products-co-ltd`（country=unknown / industry NULL）、`xiamen-jintaijin-polish-tech-co-ltd`、`step12-automated-verify-co`（**测试**）。

---

## 4. Supplier Lead 现状

7 条真实 `supplier_application`，**全部 `status = new`**（零流转）：

| lead | 公司 | country | 对应草稿 supplier | 卡点 |
| --- | --- | --- | --- | --- |
| LEAD-BNDRPB | Qingdao Xiuxinyang | China | qingdao-xiuxinyang… | 未发布（industry/province 已补） |
| LEAD-LVKE6H | U.W.Y Company Limited | China | u-w-y-company-limited | 未发布 |
| LEAD-TLMWKK | 青岛信戈诺科技 | 中国 | `supplier`（脏 slug） | **数据质量不合格** |
| LEAD-WUF5SP | Loomeami | China | loomeami | city=unknown |
| LEAD-LVBN53 | Batik Soehadi | Indonesia | batik-soehadi | province 未定 |
| LEAD-5KCPV2 | Guangdong Junchi Sports | 中国 | guangdong-junchi-sports… | country=unknown + industry 缺（白名单无 sports） |
| LEAD-EWSP5U | Xiamen Jintaijin Polish Tech | China | xiamen-jintaijin… | 未发布 |

测试 2 条：`LEAD-GS63JJ`（CS02D Live Factory）、`LEAD-D3R69E`（STEP12 Automated Verify Co）。
`leads` 表**没有 city / industry 列**，`payload` 里也查不到 ⇒ Lead 列表的城市/行业只能从**关联草稿 Supplier** 取。

**Lead 与 Draft Supplier 之间没有外键**：只能按公司名（`company` / `supplier_name` ↔ `legal_name` / `display_name`）匹配。

---

## 5. RFQ 现状

| reference_id | product | industry | country | is_public | source_type | source_path | 性质 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **RFQ-CXJCRL** | Titanium dioxide | chemicals | china | **true** | null | /chemicals/titanium-dioxide | ✅ **唯一真实 RFQ** |
| RFQ-FMMNP6 | 最终验收测试-不锈钢配件 | — | CN | false | null | null | 测试 |
| RFQ-9H6MVF | CS-02C RFQ 通道连通性测试-请忽略 | food-beverage | DE | false | null | null | 测试 |
| RFQ-5L4WB6 | CS-02C 非法值归一测试-请忽略 | — | (空) | false | null | null | 测试 |
| RFQ-42GSVV | CS-02A brcgs rfq probe | food-beverage | china | false | null | /industry/food-beverage/brcgs-audit | 测试 |
| RFQ-9CVZTX | CS-02A brcgs rfq probe | food-beverage | china | false | null | /industry/food-beverage/brcgs-audit | 测试 |
| RFQ-94PJZS | STEP12 auto test - no consent | — | china | false | industry | /industry/chemicals | **测试（STEP12 验收产物）** |
| RFQ-2EUKYM | STEP12 auto test - with consent | — | china | false | direct | /rfq | **测试（STEP12 验收产物，已撤销公开）** |

真实 RFQ：`id = ecaab7d1-4350-44fb-935c-c9247f95dc79`，`status = new`。
`rfq_matches` = **0 行**（confirmed / contacted / won / lost 全 0）。

---

## 6. Matching 现状

- `lib/rfqMatching.ts` 已实现确定性打分（industry +50 / country +25 / 产品关键词 ≤+15 / 已核验 +10；score≤0 不推荐）。
- 硬过滤：`is_published=true`、国家非 unknown、有 industry 或 products、脏 slug `supplier` 黑名单。
- `GET/POST /api/admin/rfqs/[referenceId]/match` 已存在：requireAdmin → 非 admin 404；POST 只允许推荐池内 id（否则 422）；`confirmRfqMatches` 幂等跳过已存在。
- STEP 12 实测：真实 RFQ 可得 **8 条推荐**（`ho-chi-minh-garment` score=0 被正确排除）。
- **缺口**：没有「已确认匹配」的展示，没有 `suggested → contacted → won/lost` 的推进接口。

---

## 7. Admin 已有能力（逐项回答 spec 3.3）

| # | 问题 | 现状 |
| --- | --- | --- |
| 1 | 能看到 Supplier 完整度？ | ✅ 有（`admin/suppliers/[slug]` 的「数据完整度 x/7」，STEP12-B），但**逻辑是内联 IIFE，不可复用** |
| 2 | 能看到 Lead？ | ✅ 有（`admin/leads`），但只有 ref/kind/email/tool/created/status |
| 3 | 能 Publish？ | ✅ 有（`SupplierEditor` publish 按钮 + `/api/admin/suppliers` PATCH） |
| 4 | 能 Reject？ | ❌ **没有**。leads 状态集无 `rejected`；supplier 只能 unpublish |
| 5 | 能看到 RFQ source_path？ | ✅ 有（`admin/rfqs/[referenceId]` 显示 `source_type source_path`） |
| 6 | 能看到 source_type？ | ✅ 同上 |
| 7 | 能看到 public consent？ | ✅ 有（显示 `public: yes/no`） |
| 8 | 能运行 Matching？ | ✅ 有（GET match 接口 + 详情页直出推荐） |
| 9 | 能确认 Match？ | ✅ 有（POST + `RfqMatchPanel` 勾选确认，幂等） |
| 10 | 能改 Match status？ | ❌ **没有**（无任何 PATCH/接口） |
| 11 | 有没有重复功能？ | `admin/pending-review` 只管 documents/certifications/audits，**与 lead 审核不重叠** |
| 12 | 有已存在但未接通的功能？ | 有：`admin/rfqs` 列表已有「匹配/Match」列与入口；`rfq_matches` 表与 FK 早就绪但 0 行 |

---

## 8. 缺失能力

1. **统一的完整度计算函数**（现为内联，Lead 列表要用就得分叉）。
2. **Publish 服务端完整度闸门**（现只校验 `profile_authorized`，不校验 city/industry/products）。
3. **Lead → Draft Supplier 关联视图 + 完整度 + 一键跳转**。
4. **Lead reject**（status 集缺 `rejected`）。
5. **已确认匹配的展示**（Admin 看不到自己确认过谁）。
6. **Match 状态推进**（suggested → contacted → won/lost）+ 服务端校验 + 审计日志。
7. **Business Funnel**（真实 RFQ/已匹配/已联系/赢/丢，排除测试数据）。
8. **测试数据识别规则**（STEP 12 验收脚本留下 1 supplier + 2 rfq + 1 lead 在生产库）。

---

## 9. 可直接复用代码

- `lib/rfqMatching.ts`（`recommendSuppliersForRfq` / `confirmRfqMatches`）—— **不重写匹配引擎**
- `app/api/admin/rfqs/[referenceId]/match/route.ts`（GET/POST + 推荐池越权校验）
- `components/admin/RfqMatchPanel.tsx`（推荐展示 + 确认交互）
- `app/[locale]/admin/rfqs/[referenceId]/page.tsx`（RFQ 详情骨架）
- `components/admin/LeadStatusSelect.tsx` + `/api/admin/leads`（状态下拉，含枚举白名单）
- `lib/adminData.ts`：`requireAdmin` / `logAdminAction` / `updateLeadStatus` / `LEAD_STATUSES` / `getAdminSupplier`
- `app/api/admin/suppliers/route.ts` 的发布闸门骨架（`profile_authorized` → 422）
- `admin_audit_log`（审计留痕，避免为 rfq_matches 加 `updated_at` 列）

## 10. 必须新增代码

| 文件 | 用途 | CS |
| --- | --- | --- |
| `lib/supplierCompleteness.ts` | 7 项完整度 + publishable + blockers | A1 |
| `lib/adminBusiness.ts` | 测试数据识别 + Business Funnel 统计 | E |
| `app/api/admin/rfqs/[referenceId]/match/route.ts` 增 `PATCH` | 状态推进（服务端校验 + 审计） | D |
| `components/admin/RfqMatchFollowUp.tsx` | 已确认匹配列表 + Mark Contacted / Won / Lost | C/D |
| `supabase/migrations/027_lead_rejected.sql` | `leads_status_check` 增加 `rejected` | B3 |
| 页面/常量小改 | leads 列表加列、RFQ 详情加 email/挂载 follow-up、admin 概览加 funnel 区块 | B/C/E |

## 11. 不应该修改的代码

- `lib/rfqMatching.ts` 的打分规则与硬过滤（STEP 12 已验收，改动 = 重开已关闭议题）
- `lib/clusterRoutes.ts` / `middleware.ts` 的 301 逻辑（STEP 09 已验收，只补 commit 不改动）
- `lib/queries.ts` 的 `listPublicRfqs`（前台隐私边界，本轮不得碰）
- `app/api/rfq/route.ts` 的 consent 规则（不得默认公开）
- 任何 9 语字典（一旦加键要同步 9 处冻结常量 2939）—— **本轮后台新文案一律用 admin 双语常量**
- `suppliers.cluster_slug`、`industry_code` 白名单、`xiamen-jings-eyewear` 的 eyewear

## 12. 推荐最小 Change Set（按此顺序逐个测→部署→验收→commit）

| CS | 内容 | DDL |
| --- | --- | --- |
| 0 | 固化 `middleware.ts` 线上漂移（独立 commit） | 无 |
| A | `supplierCompleteness()` 统一函数 + 详情页改用它 + **Publish 服务端完整度闸门** | 无 |
| B | migration 027 加 `rejected` + Lead 列表（公司/国家/关联草稿/完整度/状态/动作） | 1 处 CHECK 放宽 |
| C | RFQ 详情补全字段（email/company/cert/cluster/target）+ 展示**已确认匹配** | 无 |
| D | `PATCH match` 状态推进（suggested→contacted→won/lost）+ Follow-up UI + 审计日志 | 无 |
| E | Business Funnel（排除测试数据）+ admin 概览轻量区块 | 无 |
| F | 真实 RFQ `RFQ-CXJCRL` 端到端：匹配 → 确认 → 幂等复测 → contacted | 只写业务数据 |

**C5「取消 Match」的处理**：库内状态集无 `removed`/`rejected`，且 spec 禁止随意新增状态 ⇒ **不提供删除**，改以推进到 `lost`（业务语义：不跟进）表达生命周期，历史行永久保留。
