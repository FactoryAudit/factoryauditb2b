# 内容侧路径③ —— 询盘反向转供应源（**仅设计，未执行任何动作**）

- 设计时间：2026-09-29
- 数据源：Supabase 生产库（只读查询）
- 状态：**设计方案**。未发送任何邀请、未写入任何数据、未改任何代码

## 0. 结论先行（必须先看这一条）

🔴 **路径③ 目前没有可用的输入。** `/rfq` 通道里的 **10 条采购需求全部是内部测试探针**，真实买家需求为 **0 条**；`rfq_matches` 的 3 条记录也全部来自 STEP12/STEP13 自动化验收脚本。

⇒ 路径③的设计可以做、也已经做完（见 §3–§5），但**触发条件尚未满足**。建议：**设计就绪、暂不启动**，等出现第一条真实 RFQ 后再走。若你希望现在就「造出供应源」，那属于路径①（人工核验企业）或路径②，不是路径③。

## 1. `/rfq` 已提交的采购需求有多少条？

**10 条，且 10/10 为测试数据。**

| # | reference_id | company（采购方） | product | 判定 |
|---|---|---|---|---|
| 1 | RFQ-FMMNP6 | FactoryAuditB2B | 最终验收测试-不锈钢配件 | 测试 |
| 2 | RFQ-9H6MVF | FactoryAuditB2B (self-test) | CS-02C RFQ 通道连通性测试-请忽略 | 测试 |
| 3 | RFQ-5L4WB6 | （空） | CS-02C 非法值归一测试-请忽略 | 测试 |
| 4 | RFQ-42GSVV | CS-02A Test Co | CS-02A brcgs rfq probe | 测试 |
| 5 | RFQ-9CVZTX | CS-02A Test Co | CS-02A brcgs rfq probe | 测试 |
| 6 | RFQ-CXJCRL | CS-02B Test Co | Titanium dioxide | 测试 |
| 7 | RFQ-94PJZS | （空） | STEP12 auto test - no consent | 测试 |
| 8 | RFQ-2EUKYM | （空） | STEP12 auto test - with consent | 测试 |
| 9 | RFQ-SRFNCG | （空） | STEP13 auto verify - no consent | 测试 |
| 10 | RFQ-94U5JR | （空） | STEP13 auto verify - with consent | 测试 |

- 状态（`status`）全部为 `new`，无人处理。
- 时间跨度 2026-09-04 → 2026-09-21，全部集中在开发验收期。

**附：`rfq_matches`（需求 ↔ 供应商匹配表）= 3 条**，全部指向同一个 `rfq_id`（`ecaab7d1-…`，即 STEP12 的测试 RFQ），`note` 均为 `STEP12 admin-confirmed match by step13-regression@system`，`status='won'`。⇒ 同样是测试产物。

## 2. 这些需求涉及的工厂有哪些？

**0 家具体工厂。**

原因（表结构决定，非数据缺失）：
- `rfqs` 表的字段是**买家侧需求描述**：`company`（采购方自称）、`product`、`quantity`、`country`、`industry_code`、`message`。它**不携带任何供应商/工厂标识**。
- 唯一能与 `suppliers` 建立关系的表是 `rfq_matches`，而它当前 3 行全部是测试匹配，指向的 `supplier_id` 是 STEP12 测试期间创建的行，不是真实工厂。
- 因此「从 RFQ 反向找到工厂」这一步在当前数据上**没有起点**。

**可用的替代输入**（同样都很薄，一并列出以免遗漏）：

| 来源表 | 条数 | 内容 |
|---|---|---|
| `leads` kind=`buyer_lead` | 2 | `LEAD-E96S7W`（Live Verification Ltd / stainless steel fasteners，CS-02D 测试）、`LEAD-3P6BK4`（contact 页冒烟测试） |
| `leads` kind=`supplier_claim` | 1 | `LEAD-HNFY5C`（CS-02D Claim Co.，测试） |
| `leads` kind=`supplier_verification` | 3 | `LEAD-WZ5D5K/T7DY9Y/5PBRKR`（Step05 限流探针） |
| `leads` kind=`supplier_application` | 12 | 见 `outputs/suppliers-draft-audit.md`（这才是真实供给源的入口） |

## 3. 反向邀请设计（走 `supplier_application` 流程）

### 3.1 触发条件（必须先满足）

≥ 1 条**真实** RFQ，且满足：有明确 `product` + `quantity` + `industry_code`，采购方可回信。当前 0 条 ⇒ 未触发。

### 3.2 端到端流程（复用现有链路，零新建）

```
真实 RFQ（rfqs）
   │ ① 人工归类：product → industry_code（化学品/纺织/电子/机械/包装…）
   ▼
候选工厂名单（人工编制，含 source_url）
   │ ② 一对一人工发送邀请（中英双语模板）
   ▼
工厂自助提交 /suppliers/register
   │ ③ POST /api/supplier-register  → 自动落 3 处：
   │      · suppliers 草稿（is_published=false, verification_level=unverified, access_tier=public）
   │      · supplier_consents（consent_type=supplier_profile, v1.0, IP/UA 服务端取）
   │      · leads（kind=supplier_application, tool=supplier-register）+ admin 邮件
   ▼
人工审核（对照 outputs/suppliers-draft-audit.md 的口径）
   │ ④ 补 country_code / industry_code / city → 决定发布
   ▼
is_published=true, profile_status='public'  →  重建 + 重新部署（SSG 冻结）
   │ ⑤ /suppliers/*.html 计数 = 81 + 新增数 × 9
   ▼
RFQ ↔ 供应商 匹配（rfq_matches）
```

**为什么必须走 `supplier_application` 而不是管理员代录**：
- 只有走 `/suppliers/register`，`supplier_consents` 才会生成 v1.0 授权留痕（IP/UA **服务端取**，不可伪造）；
- `leads` 会给出 `LEAD-XXXXXX` 短号做回执，方便工厂直接拿号问进度；
- 管理员代录会绕过同意书，与「付费不买结论 / 公开边界由同意书管辖」的铁律冲突。

### 3.3 合规边界（不可越线）

| 允许 | 禁止 |
|---|---|
| 从公开名录、展会目录、企业信用公示系统**人工**读取**企业级**信息 | 采集**个人**数据（个人邮箱/手机/微信） |
| 一对一发送邀请（**单个**企业、**单封**邮件、可退订） | 批量爬取邮箱、批量群发 |
| 引导对方**自助**在 `/suppliers/register` 提交 | 突破登录墙/验证码/反爬；绕过 robots.txt |
| 记录 `source_url` 作内部留痕 | 高频请求（已实测：Kompass 禁 `/o/`+`/*?`、阿里禁 `/corporations/`、中国制造网禁 `/company-search/`；**均不得抓取**） |

> ⚠️ 上一轮已实测 4 个候选渠道的 robots.txt 与登录墙，结论是**第一批不走爬虫**。路径③沿用同一结论：**只做人工一对一邀请**。

## 4. 邀请模板（中英双语，纯文本可直接发）

### 4.1 英文（发海外/英文沟通的工厂）

> **Subject:** A verified buyer enquiry for your product line — list your factory free on FactoryAuditB2B
>
> Hello,
>
> We received a sourcing enquiry on FactoryAuditB2B for **{PRODUCT}** ({QUANTITY}, target market: **{TARGET_MARKET}**), and manufacturers in your category in **{COUNTRY}** are a fit.
>
> We do not sell certificates and we do not charge for a listing. If you would like this buyer and others to find you, you can list your factory on our supplier directory at no cost:
> **{REGISTER_URL}**
>
> Listing requires you to confirm that we may publish your **company registration details only** (legal name, city, industry, main products, years in business). Contact details are not published.
>
> You will receive a short reference number on submission so you can check progress with us at any time.
>
> If you would prefer not to be contacted again, reply with "unsubscribe" and we will remove you from this list.
>
> Regards,
> FactoryAuditB2B

### 4.2 中文（发国内工厂）

> **主题：** 有一条已核验的采购需求，可能与您产线匹配 —— 免费收录至 FactoryAuditB2B
>
> 您好，
>
> 我们在 FactoryAuditB2B 收到一条 **{产品}** 的采购需求（{数量}，目标市场：**{目标市场}**），贵司所在品类与 **{国家}** 产地比较匹配。
>
> 我们不卖证书，收录也不收费。如果您希望买家找到您，可在此免费登记工厂信息：
> **{REGISTER_URL}**
>
> 登记时需您确认：我们**仅公开工商登记级信息**（企业全称、城市、行业、主营产品、成立年份），**不公开联系方式**。
>
> 提交后系统会给您一个短号，方便随时向我们查询进度。
>
> 如不希望再收到联系，回复「退订」即可，我们会将您移出名单。
>
> FactoryAuditB2B

### 4.3 模板占位符

| 占位符 | 取值来源 | 备注 |
|---|---|---|
| `{PRODUCT}` / `{QUANTITY}` | `rfqs.product` / `rfqs.quantity` | 直接取，不自造 |
| `{TARGET_MARKET}` | `rfqs.target_market` | 无则省略该从句 |
| `{COUNTRY}` | `rfqs.country` | |
| `{REGISTER_URL}` | `https://factoryauditb2b.com/suppliers/register` | 需实测一次可达 |

> 🔴 合规红线：模板**不得**声称「已验证该工厂」「已核验资质」等未经核实的话；对方在登记表勾选授权前，我们**不掌握**其授权。

## 5. 预期效果评估（保守口径）

| 指标 | 保守估计 | 依据 |
|---|---|---|
| 邀请 → 登记转化率 | **5–15%** | B2B 冷邮件行业经验值；工厂对「免费收录」的响应通常高于付费邀约 |
| 单封邮件有效触达 | 需要一次真实 RFQ 才能启动 | 当前 0 条真实 RFQ |
| 若首批邀请 30 家 | 期望 2–5 家登记 | 5–15% × 30 |
| 登记 → 通过审核占比 | **50–70%** | 参照现有 12 家草稿：11 家有 web 授权留痕，但仅 2 家字段齐全可直接发布 |
| 达到 D1 阈值（50 家）所需 | **尚未可估算** | 需要先有真实需求驱动；当前录入主要靠路径① |

**风险与限制**：
1. **无输入 → 无输出**：没有真实 RFQ，邀请邮件缺少「具体需求」这个唯一的钩子，转化率会显著低于上表。
2. **送达率**：自有 SMTP 尚未配置（历史遗留 Ethereal 假邮箱），且生产 `MAIL_PROVIDER=http`（Workers 禁 SMTP）⇒ 邀请邮件最好走**人工邮箱单独发**，不进自动化队列。
3. **合规风险**：批量发送 = 垃圾邮件 + 违反「不采集个人数据」。必须一对一、可退订。
4. **供给质量**：邀请来的工厂仍是 `unverified`，不能因为「是我们邀请的」就跳过后面的核验。

## 6. 建议的启动条件（写进下一轮触发）

满足以下**全部**条件才启动路径③：
1. `/rfq` 出现 ≥ 1 条真实（非测试）采购需求；
2. 该需求有可用 `industry_code` 与 `product`；
3. 有 3–10 家可人工触达的候选工厂（企业级联系方式，非个人）；
4. 你确认「邀请邮件用人工邮箱一对一发送」。
