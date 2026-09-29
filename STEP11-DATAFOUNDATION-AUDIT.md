# STEP 11 — SUPPLIER + BUYER DATA FOUNDATION AUDIT

> 只读审计 · READ ONLY → AUDIT → REPORT → STOP
> 审计时间：2026-09-20　审计对象：FactoryAuditB2B 生产库（Supabase）+ 代码（`F:\AI-验厂SEO网站`）
> 方法：仅 `SELECT`（Supabase Management API，read_only=true）；零 DML、零代码改动、零部署。
> 核心原则：**先获得真实数据，再让 Cluster / Industry / Country 从真实数据中自然形成。**

---

## 0. 当前真实数据底数（来自生产库只读拉取）

| 维度 | 数量 | 关键事实 |
| --- | --- | --- |
| Suppliers（总） | **17** | 9 已发布（legacy 种子）+ 8 草稿（register 转化） |
| Suppliers（已发布） | **9** | 全部缺 `province`、缺 `consent`、部分缺 `industry_code` |
| Suppliers（草稿/未发布） | **8** | 均经 register API，`consent` 已捕获，但 country=unknown / city 乱 / industry 空 |
| Industrial Clusters（已发布 P0） | **8** | 与 17 家 Supplier **0 城市+行业重叠** |
| RFQ（总） | **6** | 1 真实公开 + 5 测试探针 |
| RFQ（公开 = Live Buyer Request） | **1** | Titanium dioxide / chemicals / china（人工置 is_public=true） |
| RFQ（私有/测试） | **5** | product 含 "probe/测试/请忽略"，is_public=false |
| Leads（总） | **14** | 全部 status=new（从未被审核流转） |
| Leads（真实 supplier_application） | **7** | 真实公司，多为 suppliers 表外的新主体 |
| Leads（测试探针） | **5** | cs02d / example.com / probe-acceptance / 内部 smoke |
| Leads（真实 buyer_lead） | **0** | 2 条 buyer_lead 全是测试 |
| rfq_matches | **0** | 匹配表已建 schema 但从未写入 |
| orders | **0** | 零付费转化 |
| supplier_capabilities | **7** | 仅 7 条结构化能力（跨 17 家稀疏） |
| supplier_evidence | **3** | 仅 3 条证据 |
| supplier_consents | **7** | 仅注册转化的 8 草稿中 7 条有 consent（9 已发布 legacy 全部无 consent） |

---

## 1. 现有能力审计（代码层，只读确认）

### 1.1 Supplier 创建 / 提交
- **公开入口**：`/join-supplier-network` → `POST /api/supplier-register`（分支 B：供应商入驻申请）。
- **写入行为**（已确认）：限流 → 白名单校验 → `createSupplierDraft()` 直接 INSERT `suppliers` 草稿行（`is_published=false`、`verification_level='unverified'`、`profile_authorized`、`consent_version/ip/user_agent` 服务端取）→ INSERT `supplier_consents` → INSERT `admin_audit_log(consent_submitted)` → INSERT `leads(kind=supplier_application)` → 双邮件（管理员 + 供应商回执短号 LEAD-XXXXXX）。
- **结论**：真实 Supplier 获取链路**是通的**——提交即落库草稿 + 留痕 consent。但 `industry_code` 不在该 API 设置范围内（仅 `main_products`），`country` 无法识别时降级 `unknown`，`city` 缺省 `unknown`。

### 1.2 Supplier 发布 / 审核
- **Admin 入口**：`/admin/suppliers/[slug]`（`SupplierEditor.tsx`）+ `PATCH /api/admin/suppliers`（含 `cluster_slug` 服务端校验已发布 slug）。
- **流程**：草稿 → Admin 补 industry/city/country/province/verification → 置 `is_published=true` → SEO 收录。
- **现状缺口**：`leads` 中 7 条真实 supplier_application 全部 `status=new`，**从未被 Admin 审核流转**；8 条草稿 Supplier 也几乎全部未发布。审核动作存在但**未被实际执行**。

### 1.3 Supplier 字段完整性
- 真实字段 63 个，含：`industry_code`、`province`、`region`、`city`、`country_code`、`main_products`、`company_description`、`contact_visibility/person/email`、`verification_status`、`audit_status`、`source_url/source_type/source_name`、`consent_*`。
- **致命缺口**：`province` **17/17 = NULL**。Cluster 层级 canonical 路径（`/industrial-clusters/{country}/{province}/{slug}`）依赖 province，Supplier 侧 province 全空，意味着即便未来 assign `cluster_slug`，Supplier 自身地理位置维度仍无法复用。

### 1.4 RFQ 创建 / 公开状态
- **公开入口**：`/rfq` → `POST /api/rfq`（游客可提交，`user_id` 可空）。
- **写入行为**：限流 → 校验 email/product → INSERT `rfqs`（`status='new'`、`industry_code`/`certifications_req`/`source_path`/`source_type`/`industrial_cluster_slug` 可空归一）→ 双邮件。
- **⚠️ 关键缺陷**：insert **未设置 `is_public`**，该列默认 `false`。即**游客提交的 RFQ 默认进私有**，`is_public` 仅 1 条（Titanium dioxide）被人工置 true。→ 买家意图 → 首页 Live Buyer Requests 的环在提交层断开。
- **⚠️ 来源归因缺失**：`source_type` / `source_path` 字段已建并做归一校验，但当前 `/rfq` 表单未传这两个值（6 条 RFQ 全部 `source_type=null`、`source_path=null`）。→ 无法追踪 RFQ 来源页面。

### 1.5 RFQ → Supplier 匹配机制
- **schema 存在** `rfq_matches` 表（含 supplier 关联），`GET /api/rfq` 也 `select` 了 `rfq_matches`。
- **现实**：`rfq_matches` 行数 = **0**。Admin 可手工建匹配，但**从未发生**。→ RFQ → Supplier 匹配闭环**未运行**。

### 1.6 Supplier → Cluster 服务端校验（已具备）
- `PATCH /api/admin/suppliers` 对 `cluster_slug` 走 `listPublishedClusterSlugs()` 校验，仅接受已发布 P0 slug；空串→NULL。STEP 10-B 已落地，机制完好。

### 1.7 Admin 审核 / 取消发布 / 编辑
- `requireAdmin` 三层安全（拦截 / 字段白名单 / 枚举校验）齐全；`/admin/leads`、`/admin/rfqs`、`/admin/pending-review`、`/admin/suppliers` 均存在。能力具备，但**运营上未被执行**（14 leads 全 new、5 私有 RFQ 未清理、8 草稿未发布）。

### 1.8 SEO 页面动态生成（已具备）
- `country/[slug]`、`industry/[slug]`、`industrial-clusters/[...segments]` 三类页面均从 DB 动态读取（`listPublishedClusters` / `listSuppliersByClusterSlug` / 行业国家常量）。
- **现实**：Cluster 页 `listSuppliersByClusterSlug` 当前返回 0（8 P0 均无关联 Supplier）；Industry/Country 页同理缺真实 Supplier 数据驱动。

---

## 2. 测试数据识别与分类（§四 要求）

> 规则：测试/探针数据**不得**用于 SEO、Cluster Evidence、Buyer Intent、Supplier Count、RFQ Conversion Metrics。

### 2.1 Suppliers（17）
| 分类 | 数量 | 清单 / 说明 |
| --- | --- | --- |
| real（已发布 legacy） | 9 | dongguan-plastic-molding, guangzhou-sunny-food, guangzhou-textile-factory, ho-chi-minh-garment, jiangsu-liquid-damper, nanjing-mxcomm, shandong-loyal-industrial, shenzhen-precision-electronics, xiamen-jings-eyewear |
| real（草稿/register 转化，低质量） | 8 | batik-soehadi(REVIEW), guangdong-junchi-sports, loomeami, qingdao-xiuxinyang, shenzhen-jorigin-packaging, **supplier(=Qingdao PPE, slug 非法/脏数据)**, u-w-y-company-limited, xiamen-jintaijin-polish-tech |
| fake / placeholder / demo | 0 | 无显式占位符供应商；但 `supplier`（slug="supplier"）属**脏数据/不完整**，应归为 incomplete |
| incomplete（质量不合格） | 1 | `supplier`（country=unknown、city=青岛中文、slug=supplier 非法、未发布） |

> 注：17 家均为真实公司名，无 "test/demo/fake supplier"。真正的风险是 **incomplete + legacy 缺 consent/province**，不是伪装数据。

### 2.2 RFQ（6）
| 分类 | 数量 | 清单 / 说明 |
| --- | --- | --- |
| real（公开） | 1 | Titanium dioxide / 20MT / chemicals / china / is_public=true |
| real（私有，未公开） | 0 | — |
| **test probe（隔离）** | 5 | "CS-02A brcgs rfq probe"×2, "CS-02C 非法值归一测试-请忽略", "CS-02C RFQ 通道连通性测试-请忽略", "最终验收测试-不锈钢配件" — 全部 is_public=false，**不污染公开/SEO/Intent 指标** ✅ |

### 2.3 Leads（14）
| 分类 | 数量 | 说明 |
| --- | --- | --- |
| test probe | 5 | cs02d / example.com / probe-acceptance.invalid / 内部 smoke（contact-page） |
| real supplier_application | 7 | Xiamen Jintaijin、Guangdong Junchi、Loomeami、青岛信戈诺(Qingdao PPE)、U.W.Y、青岛秀欣阳、Batik Soehadi |
| real supplier_claim | 1 | CS02D Claim Co.（测试） |
| real supplier_verification | 3 | Probe Co ×3（测试） |
| real buyer_lead | **0** | 2 条 buyer_lead 全是测试 |

> 隔离结论：**当前生产库无一条真实 Buyer Lead**。买家侧转化入口（audit-request / contact）仅有测试流量。

---

## 3. 五个核心问题（Q1–Q5）

### Q1 — 获取一个真实新 Supplier 需要哪些步骤？
提交 → 数据验证 → Evidence → Consent → Admin Review → Publish → SEO/index

1. **提交**：买家/供应商填 `/join-supplier-network`，`POST /api/supplier-register`（限流+白名单+必填校验）。
2. **数据验证**：API 归一 email/country（未识别→unknown）/city/slug；写 `suppliers` 草稿 + `supplier_consents` + `admin_audit_log` + `leads`。
3. **Evidence**：当前仅 `self_reported_certificates` + `main_products`；`supplier_evidence` 仅 3 条、`supplier_capabilities` 仅 7 条——Evidence 层**几乎空白**。
4. **Consent**：register API **已捕获** consent_version/ip/ua（服务端取，可信）。但 9 家 legacy 已发布 Supplier 无 consent 留痕 → provenance 缺口。
5. **Admin Review**：`/admin/suppliers/[slug]` 补 industry/city/province/country/verification → 置 `is_published=true`。**此步当前未被执行**（8 草稿全未发布、7 真实 leads 全 new）。
6. **Publish**：`is_published=true` → 进入 `country/[slug]`/`industry/[slug]`/`suppliers/[slug]` SEO。
7. **SEO/index**：SSG + sitemap 自动收录已发布 Supplier。

**结论**：机制完整，瓶颈在 **Admin Review 未执行** + **草稿数据质量差（industry/province/country 缺失）** 导致即使发布也难成结构化 Cluster 证据。

### Q2 — 获取一个真实 Buyer RFQ 需要哪些步骤？
特殊检查项逐一回答：
- **测试/真实隔离**：✅ `is_public` 区分；测试探针全部 is_public=false，不污染公开/Intent 指标。
- **source attribution**：⚠️ `source_type`/`source_path` 字段已建但**表单未传、全部 null** → 无法归因来源页面。
- **buyer contact/company**：✅ `rfqs` 存 `company`/`email`/`message`/`user_id`（游客 user_id=null）；`contact_name` 仅进邮件不落库（rfqs 无姓名列）。
- **行业/国家/产品字段**：✅ `industry_code`(归一白名单)/`country`/`product`/`quantity` 均落库。
- **来源页面追踪**：⚠️ `source_path` 机制存在但**未启用**（表单不发）。

**结论**：RFQ 采集通道健康（验证/限流/邮件/隐私剥离均到位），但**默认私有 + 来源不归因**使其无法自然成为公开 Live Buyer Request 与 Buyer Intent 信号。

### Q3 — Supplier 数据距离有效 Cluster 还差什么？（不用"再建 Cluster"解决）
- **缺多少 Supplier**：要形成「城市+行业」Cluster，需每候选 ≥2 家同城市同行业 Supplier。当前 17 家散布 14 城，**0 个**「城市+行业」组合达 2 家。
- **缺什么行业**：Chemicals（仅有 1 公开 RFQ 无 Supplier）、Automotive（Rayong P0 无 Supplier）、Furniture（Foshan/Jepara P0 无 Supplier）、Home/Kitchen（Jiangmen P0 无 Supplier）、Lighting（Zhongshan P0 无 Supplier）、Electronics 除深圳/南京外缺（Bac Ninh/Dongguan/Batam P0 均无对应 Supplier）。
- **缺什么城市**：Rayong(TH)、Bac Ninh(VN)、Batam(ID)、Jepara(ID)、Dongguan(电子)、Jiangmen、Zhongshan、Foshan —— 8 个 P0 城市**全部 0 匹配 Supplier**。
- **缺什么国家**：Thailand、Indonesia（除 batik 未发布）、Vietnam（仅 Ho Chi Minh 纺织，无 Bac Ninh）。
- **缺什么产品/能力**：`supplier_capabilities` 仅 7 条、`supplier_evidence` 仅 3 条 → 结构化产品/能力/证据极稀疏。
- **质量最低字段**：`province`(17/17 NULL) > `industry_code`(7/17 NULL) > `consent`(9/17 缺) > `country_code`(2 家 unknown) > `verification_status`(12/17 空/未审)。

### Q4 — RFQ → Supplier → Service 闭环还差什么？
真实链路现状：
```
RFQ 提交 → rfqs(new) → [rfq_matches: 0 行] → Supplier 匹配(无) → Quote(无表) → Contact(仅 leads) → Audit/Inspection/Sourcing(orders=0)
```
- **RFQ → Supplier 匹配**：`rfq_matches`=0，无自动/手工匹配 → **断**。
- **Quote / Contact**：无 quote 表；`leads` 存买家联系但无报价工作流 → **弱**。
- **Audit / Inspection / Sourcing 入口**：`/api/audit/request` 可建 buyer_lead；`audits`=2、`supplier_audits`=1，服务可购买；但 `orders`=0（零付费）→ **入口在，转化未跑**。
- **结论**：闭环**不能真正落地**。基础设施（表/API/Admin）已 seeding，但匹配、报价、付费三环均为空，且真实 Buyer Lead=0。

### Q5 — 30 天最小数据增长目标（不以页面数为 KPI）
| 指标 | 当前 | 30 天目标 | 杠杆 |
| --- | --- | --- | --- |
| 已发布真实 Supplier | 9 | **+6~8**（把 7 条真实 leads + 干净草稿审完发布） | Admin 审核执行 |
| 真实 Buyer RFQ（公开） | 1 | **+5~10**（表单默认公开 + 来源归因） | 修 is_public 默认 / 表单置 true |
| 可匹配 Supplier（带 industry+province） | ~0 | **≥10**（补 17 家 industry/province） | 数据补全脚本（Admin 执行） |
| 结构化产品/能力数据 | 7 条 | **≥30 条** | 引导注册商填 capabilities |
| 真实 Buyer/Supplier 联系线索 | 7 真实 leads | **+20~30**（推广采集入口） | 表单/落地页投放 |
| Audit/Inspection 转化入口 | 2 audits | **≥3 条真实 audit 请求闭环** | 接通 audit-request → 跟进 |

> 优先级：**先补 17 家 Supplier 的 industry/province/consent（结构化地基），再让 Admin 把真实 leads 转为已发布 Supplier，再修 RFQ 默认公开 + 来源归因**。页面数不增长也能显著增厚真实数据。

---

## 4. 最终输出（A–F）

### A. 当前真实数据漏斗
```
Supplier acquisition
  /join-supplier-network → supplier-register → suppliers(draft) + leads
  → [Admin Review 缺失] → Published Supplier (9)
  → Structured Supplier (industry+province 缺失)
Buyer RFQ
  /rfq → rfq API → rfqs(new, 默认私有) → [is_public 未置] → Live Buyer Request (1)
  → Match (rfq_matches=0)
  → Quote (无)
  → Audit/Inspection/Sourcing (orders=0)
```

### B. 每一层当前数量
| 层 | 数量 |
| --- | --- |
| Supplier 提交（草稿） | 8（register 转化）+ legacy 9 = 17 |
| Published Supplier | 9 |
| Structured Supplier（industry+province 齐） | ~0 |
| Buyer RFQ（总） | 6 |
| 公开 RFQ（Live Buyer Request） | 1 |
| Match | 0 |
| Quote | 0 |
| Audit/Inspection/Sourcing 转化 | 0 付费 |

### C. 最大缺口（按严重度）
1. **`province` 全空（17/17）** —— 结构化 Cluster 关联与地理位置复用的最底层缺口。
2. **RFQ 默认私有 + 来源不归因** —— 买家意图无法形成公开信号与来源分析。
3. **rfq_matches=0 / orders=0** —— 匹配与付费闭环零运行。
4. **Admin Review 未执行** —— 7 真实 leads + 8 草稿沉睡，真实 Supplier 增长停滞。
5. **真实 Buyer Lead=0** —— 买家侧除测试外无流量。
6. **legacy 9 家缺 consent/industry** —— provenance 与结构化不足。

### D. 最小开发改动（仅列，本轮不执行）
1. **RFQ 提交默认公开**：`/api/rfq` insert 显式 `is_public: true`（或表单加"公开询价"开关），让真实 RFQ 自然成为 Live Buyer Request。
2. **RFQ 来源归因**：`/rfq` 表单传 `source_path`（当前页路径）+ `source_type`（industry/cluster/home/direct），落库已支持，仅接线。
3. **Supplier 结构化补全**：Admin 批量补 `industry_code`/`province`（或注册表单增加 province/industry 字段并归一）；写一次性 maintenance 脚本（经 Admin，非裸 SQL）。
4. **rfq_matches 激活**：Admin 手动匹配 UI（或规则匹配：同 industry_code + 同 country 推荐 Supplier），让 `GET /api/rfq` 的 matches 真实返回。
5. **province 回填**：对 legacy 9 家 + 8 草稿，按 city 映射 province（china→省），一次性补全（需 backup/rollback 记录）。

> 以上均属"数据地基/闭环接线"，**不新增 Cluster 页面、不新建产业带**。

### E. 30 天数据增长目标
见 Q5 表格。一句话：**9→15+ 已发布真实 Supplier、1→6+ 公开真实 RFQ、17 家全部补齐 industry+province、rfq_matches 从 0 起步产生真实匹配、≥3 条 audit 请求闭环**。KPI=真实数据条数，非页面数。

### F. 下一阶段唯一建议的 Change Set
**STEP 12 — DATA ACTIVATION（数据激活，非扩张）**
范围（待你批准后执行）：
1. 修 `/api/rfq` 默认 `is_public=true` + 接 `source_path`/`source_type`（最小代码改动，闭环买家意图）。
2. 写 maintenance 脚本补全 17 家 `province`/`industry_code`/`consent`（经 Admin API，带 backup/rollback）。
3. 激活 `rfq_matches`：Admin 手动匹配 + `GET /api/rfq` 返回真实推荐。
4. 运营 SOP：每周审核 `leads`（7 真实 supplier_application → 发布）、清理 5 测试探针 RFQ/leads。
5. **不进入 10-C/10-E/10-F/10-G**，不新建 Cluster。

---

## 5. 测试数据处置建议（隔离，不用于任何指标）
- **保留但隔离**：5 条测试 RFQ（is_public=false）、5 条 test leads、3 条 supplier_verification probe。
- **建议清理（经 Admin，非裸 SQL）**：`supplier`（slug="supplier" 脏数据）、`guangdong-junchi-sports`（country=unknown 草稿）等 incomplete 草稿，待补正则发布或删除。
- **严禁**：将测试探针计入 Supplier Count / RFQ Conversion / Buyer Intent / Cluster Evidence。

---

## 6. STOP
本轮为只读审计，已完成 **READ ONLY → AUDIT → REPORT**。
- 未修改 production DB
- 未修改 supplier.cluster_slug
- 未新建/删除 Cluster
- 未改国家/省/市/行业字段
- 未部署

**下一步由你拍板**：是否批准 STEP 12（DATA ACTIVATION）Change Set，或先只做运营层（审核 7 真实 leads → 发布）。当前按本步 STOP 原则停在这里。
