# 内容侧后续路径 · 设计文档（只做设计，不执行）

> 范围：路径②（信用系统人工核验）操作流程、路径③（询盘反哺）触发监控、`batik-soehadi` 处理、
> `jisun` 核实方案。**本轮不执行任何数据或代码改动。**

---

## 1. 路径② —— 国家企业信用信息公示系统人工核验 SOP

### 1.1 目标

把「B 级 4 家 draft」与「未来入驻申请」从「有表单元数据」升级为**有权威来源留痕的可发布档案**，
且**不采集任何个人数据、不突破技术措施、不高频请求**。

### 1.2 权威源（本项目已文档化，非新引入）

`lib/coverage.ts:107` 已把中国的权威来源写死为：
> National Enterprise Credit Information Publicity System (gsxt.gov.cn), searchable by company name
> or Unified Social Credit Code.

⇒ 人工核验**只用这一个源**，不引入天眼查/企查查等二次商采数据（避免「来源不可追溯」）。

### 1.3 逐步操作流程（每家约 10–15 分钟）

| 步 | 动作 | 记录什么 | 判定规则 |
|---|---|---|---|
| B0 | 前置：从 draft 取 `legal_name`（英文）+ `website`，向供应商索取**中文注册名** | 索取记录（邮件/微信） | 拿不到中文名 ⇒ **停止**，不臆测 |
| B1 | 打开 gsxt.gov.cn，**手工**输入中文注册名（不使用任何自动化请求） | 查询时间戳 | 命中唯一主体 ⇒ 继续；多主体 ⇒ 请供应商确认哪个是签约主体 |
| B2 | 核对 **18 位统一社会信用代码**（非旧注册号） | USCC 全码 | 与供应商提供的一致 ⇒ 通过；不一致 ⇒ 记录不一致并追问 |
| B3 | 核对**经营范围**首项 | 是否含「生产/制造」 | 只有「批发/零售」⇒ 判定为**贸易公司**，`business_type` 必须如实标注 |
| B4 | 核对**注册地址** vs 供应商给的 `city`/生产地址 | 两个地址原文 | 不一致 ⇒ 记录，并在档案里如实说明（不编造） |
| B5 | 检查 **经营异常名录 / 严重违法失信名单** | 是否在册 | 在册 ⇒ **不发布**，升级为高风险线索 |
| B6 | 记录 `source_url`（公示系统**不可直接深链**⇒ 记录「来源=gsxt + 查询日期 + 查询关键词」三元组） | `source_url` + `source_note` | 留痕缺失 ⇒ 该条不得进入发布批次 |
| B7 | 落库 | 走 `scripts/suppliers-intake.mjs`（dry-run → 人工过目 → 实写） | 只补 NULL、绝不覆盖非空值；`is_published=false` |

### 1.4 本 SOP 与既有合规原则的对应

- **不采集个人数据**：只记录企业主体信息（USCC / 经营范围为**公示信息**，非个人信息）。
  `scripts/suppliers-intake.mjs` 已内置「出现个人数据列即整批拒绝」的硬门禁。
- **不突破技术措施**：B1 明确要求**手工**查询；不得写脚本抓取 gsxt。
- **不高频请求**：人工节奏天然满足；每家一次查询。

### 1.5 输出物

每批一份 `outputs/verification-log-<批次>.md`：`slug` / 中文注册名 / USCC(掩码) /
经营范围判定 / 地址一致性 / 异常名录 / 查询日期 / 核验人 / 结论（通过·需补充·拒绝）。

---

## 2. 路径③ —— 询盘反哺的触发条件监控方案

### 2.1 现状（实测，全部只读）

`rfqs` 表 **10 行，全部是测试探针**，`status` 全为 `new`：

| reference_id | email | source_path | created_at |
|---|---|---|---|
| RFQ-9CVZTX | `cs02a.smoke@example.com` | `/industry/food-beverage/brcgs-audit` | 2026-09-12 |
| RFQ-CXJCRL | `cs02b.smoke@example.com` | `/chemicals/titanium-dioxide` | 2026-09-13 |
| RFQ-94PJZS | `step12-noconsent@example.com` | `/industry/chemicals` | 2026-09-20 16:29:38Z |
| RFQ-2EUKYM | `step12-consent@example.com` | `/rfq` | 2026-09-20 16:29:39Z |
| RFQ-SRFNCG | `step13-noconsent@example.com` | `/industry/chemicals` | 2026-09-21 02:11:43Z |
| RFQ-94U5JR | `step13-consent@example.com` | `/rfq` | 2026-09-21 02:11:44Z |

（另有 4 条 09-04～09-12 的早期探针，形态相同。）

🔴 **关键事实**：`rfqs` 表结构**不携带任何供应商标识**（无 `supplier_id` / 无工厂名）。
⇒ 「这些需求涉及哪些工厂」在本库**无法从数据回答**；能作为反向线索的只有
`product` + `industry_code` + `country` + `target_market` 四个字段。

🔴 **另一关键事实**：RFQ 提交**不写 `leads` 表**（`app/api/rfq/route.ts` 只 insert `rfqs`
+ 双邮件），所以反哺监控**只需看 `rfqs` 一张表**，不必 join。

### 2.2 基线（用于区分「真实」与「测试」）

- **时间基线**：最后一条测试行 = `2026-09-21T02:11:44Z`（RFQ-94U5JR）。
- **测试指纹**（10/10 命中，零反例）：
  - `email LIKE '%@example.com'`（10/10）
  - `company` 匹配 `%Test%` 或为空，且 `product` 匹配 `%probe%` / `%auto test%` / `%STEP1%`
- **真实信号**（任一即可疑为真实）：
  - `email` 域不是 `example.com` 且**不是无效域**
  - `company` 非空且不匹配 `%Test%`
  - `is_public = true`（测试探针从不传该字段 ⇒ 恒 false）

### 2.3 监控方案（设计，未实现）

**组件 A：只读探测器** `scripts/rfq-real-lead-watch.mjs`（未来实现）

```
判定：created_at > '2026-09-21T02:11:44Z'
  AND email NOT ILIKE '%@example.com'
  AND (company <> '' AND company NOT ILIKE '%test%')
  AND product NOT ILIKE '%probe%' AND product NOT ILIKE '%auto test%'
⇒ 输出「真实 RFQ 候选」清单 + 每条的四元组（product/industry_code/country/target_market）
```

设计约束：
- **只读**（`--read-only`），不写库、不发通知；
- 无候选 ⇒ 退出码 0 且**不产出任何输出**（避免噪声）；
- 有候选 ⇒ 打印清单并以退出码 2 结束（可作为调度器的分支条件）。

**组件 B：调度（等你拍板再建自动化）**
- 建议节奏：**每日 09:00** 跑一次组件 A；
- 触发条件：出现候选 ⇒ 推进 §2.4 的邀请流程；
- 若你希望改为每周，或希望「有候选才通知」，告诉我即可，我按 `automation_update` 建。

### 2.4 反向邀请流程（设计）

```
真实 RFQ 出现
  ├─ 归因：读 product / industry_code / country / target_market（四元组）
  ├─ 匹配：按 industry_code 找「已知供应源」
  │    · 优先：库内该行业的 draft 供应商（如 electronics 的 B 级）
  │    · 其次：公开商会/行业协会名录（人工查，不爬）
  ├─ 邀请：发 supplier-register 邀请邮件（模板见 §2.5）
  └─ 闭环：对方走 /supplier-register（= 已有 web 流程，产生 leads + supplier_consents 留痕）
```

🔴 **隐私边界（硬约束）**：邀请邮件**绝不透露买家身份、邮箱、公司名、询价原文**，
只允许说「有买家在找 <品类> 的供应商，市场是 <target_market>」。
买家侧 `is_public` 授权只控制**站内公开展示**，**不等于**授权把身份给第三方工厂。

### 2.5 邀请模板（中英双语）

**EN**
> Subject: Buyer demand for {product category} — supplier registration open
>
> Hello {company},
>
> We currently have a buyer enquiry for **{product category}** destined for **{target market}**.
> We're inviting manufacturers in this category to register a supplier profile so buyers can find you.
>
> Registration is free and takes about five minutes: {register_url}
>
> What we ask for: your registered company name, production site address, and product range.
> We do not share buyer details, and you can request removal at any time.
>
> FactoryAuditB2B

**中文**
> 主题：{品类} 买家需求 — 供应商入驻通道开放
>
> {公司名}，您好：
>
> 我们目前收到一条针对 **{品类}**、目标市场为 **{目标市场}** 的采购需求。
> 现邀请该品类的生产型企业登记供应商档案，方便买家检索到您。
>
> 登记免费，约五分钟：{register_url}
>
> 需要填写：注册公司名、生产地址、产品范围。
> 我们不会向您透露买家信息，您也可以随时要求下架档案。
>
> FactoryAuditB2B

> 模板纪律：无营销词、无破折号修辞、无「已验证」等无据声称，与站内文案口径一致。

### 2.6 预期效果评估（诚实口径）

| 项 | 评估 |
|---|---|
| 当前可执行性 | **0** —— 真实 RFQ = 0 条，无输入 |
| 单条 RFQ 的转化 | 未知，**本方案不提供任何转化率承诺**（无样本即无据） |
| 主要价值 | 把「买家需求」变成「供应商库扩张」的**自动触发钩子**，而不是靠人工想起来 |
| 主要风险 | 邀请邮件被当作 spam（建议：只在对方有公开企业邮箱时发，单次最多 10 封） |
| 结论 | **设计就绪、暂不启动**。等组件 A 出现首个候选再跑 §2.4。 |

---

## 3. `batik-soehadi` 处理建议

### 3.1 现状（实测）

```
batik-soehadi
  legal=Batik Soehadi   en=Batik Soehadi
  country=indonesia     city=Surakarta   ind=textiles
  pstat=draft           website=https://batiksoehadi.com
  留痕：LEAD-LVBN53 kind=supplier_application tool=supplier-register
        supplier_consents: supplier_profile v1.0 given=true
```

⇒ **是真实入驻申请**（有 web 表单 + 授权双留痕），不是脏数据。

### 3.2 阻塞点

`indonesia` **不在 `COVERAGE_COUNTRIES`**（只有 china / vietnam / thailand / malaysia / philippines）。
印尼仅登记在 `COVERAGE_ROADMAP` 的 **phase 2**（`lib/coverage.ts:1020`），**不建页、不进索引**。

后果（已核代码）：`countryNameOf("indonesia")` 查不到 ⇒ 档案页 Country 行会显示**字面量 `indonesia`**
（不会 404，但显示脏），且该档案无法挂到任何国家页。

### 3.3 建议：**保持 draft，不建印尼国家页（本轮）**

理由：
1. `lib/coverage.ts` 顶部明文规定：*「新增国家必须写真实差异内容。禁止把 China 复制成 Vietnam 只改国名。」*
   —— 仅为了 1 家供应商去写一整页印尼制造画像/风险/核查要点，成本高于收益。
2. 单一供应商撑不起国家页，会产出**薄内容页**，对 SEO 是负资产。
3. 现无任何印尼买家需求（RFQ 真实数 = 0），无「需求侧」证据。

### 3.4 该供应商的**替代承接方式**（建议采纳）

| 方案 | 做法 | 评价 |
|---|---|---|
| **方案 A（建议）** | 保持 draft；把它登记为「覆盖范围外线索」，走 `/custom-services` 私域承接 | 零代码、零薄页、可承接生意 |
| 方案 B | 建印尼国家页 → 再发布 | 需先有 ≥1 条真实差异化内容投入 + 至少 2–3 家印尼供应商才划算 |
| 方案 C | 强行发布到 china 国家页 | ❌ **否决** —— 国别造假，违反「不编造」铁律 |

### 3.5 触发「建印尼国家页」的条件（写入规则，避免拍脑袋）

同时满足 ①②③ 才启动：
1. 印尼供应商 ≥ **3 家**（draft+published 合计）；且
2. 印尼相关 RFQ / 询盘 ≥ **1 条真实**（非探针）；且
3. 有能力撰写**真实差异化**的 `en` + `zh` 内容（profile / risks / verificationNotes / auditNotes / hubs / standards / registry / FAQ 全套）。

---

## 4. `jisun` 人工核实方案

### 4.1 现状（实测）

```
jisun
  legal=Jisun   en=Jisun
  country=cn  →  待归一为 china
  city=Panyu District, Guangzhou      ind=<NULL>
  website=https://www.jisun-arcade.com
  pstat=draft    created=2026-09-28 13:18:20Z   ← 昨日
  留痕：LEAD-SBNZDL kind=supplier_application tool=supplier-register
        supplier_consents: supplier_profile v1.0 given=true
  产品：Claw Machines / Gacha / Prize & Skill Game Machines / Boxing / Ball & Pinball /
        Whack-a-Mole / Air Hockey / Shooting / Cotton Candy / Coin Exchange / Lottery Draw
```

⇒ **是真实入驻申请**（留痕完整）。`ind=<NULL>` 是唯一的字段缺口，共 11 个产品类目。

### 4.2 为什么需要人工核实（三个疑点）

| # | 疑点 | 为什么是疑点 |
|---|---|---|
| Q1 | `legal_name` 只有 `Jisun`（5 字母） | 不是完整注册名，无法在 gsxt 直接定位主体 |
| Q2 | `city="Panyu District, Guangzhou"` + 产品为游艺/游戏机 | 番禺是**游艺机产业带**，但制造厂与贸易商混杂，必须区分 |
| Q3 | 注册时间 = 昨日（2026-09-28） | 无历史交叉验证，`industry_code` 也为空 |

### 4.3 核实步骤（分四步，全部人工）

**第 1 步 · 补齐识别信息（向供应商索取，不发函不猜测）**
- 中文注册全名
- 18 位统一社会信用代码
- 是否有自有厂房（生产地址）vs 仅办公地址
- 主营产品中**哪些是自产、哪些是外购转售**

**第 2 步 · gsxt 核验（同 §1.3 的 B1–B5）**
- 用中文注册名定位主体 → 核对 USCC → 看经营范围首项是否含「生产制造」
  → 注册地址 vs 生产地址 → 经营异常/严重违法失信名录

**第 3 步 · 站点与主体一致性（轻量、公开）**
- `jisun-arcade.com` 是否为该企业自有域名（Whois 注册主体是否与该企业相关）
- 页面是否展示真实厂区/产线照片（与工厂自述区分开记录）
- 是否在站上自述为 manufacturer（**自述 ≠ 平台核验**，须如实标注两级）

**第 4 步 · 归类与定型**
- 填 `industry_code`：产品为游艺/游戏机 ⇒ 现行 13 个码中最贴近的是 **`machinery`**
  （`STATIC_INDUSTRIES` 无「游艺设备」码；若你希望新增专门的码，需另立工作项）
- 如实标注 `business_type`（工厂 / 贸易公司 / 工贸一体）
- 结论三选一：**发布** / **补齐后发布** / **拒绝**

### 4.4 门槛与产出

| 项 | 规则 |
|---|---|
| 可发布前置 | 第 1 步四项信息齐全 **且** gsxt 命中唯一主体 **且** 不在异常/失信名录 |
| 不可发布 | 拿不到中文注册名 或 gsxt 无对应主体 ⇒ 保留 draft，不得凭英文名发布 |
| 产出 | `outputs/jisun-verification.md`：四条信息 + gsxt 查询结果 + 归类结论 + 留痕日期 |

> 与 `batik-soehadi` 的区别：`jisun` 的国家（china）在覆盖范围内，**只要补齐字段即可发布**，
> 不存在国家页问题；因此它的优先级高于 `batik-soehadi`。

---

## 5. 附录 —— 本轮只读核验中发现的一处既有数据瑕疵（未改）

`xiamen-jings-eyewear` 是**已发布**供应商（`is_published=true`，`profile_status=public`），
其 `industry_code = "eyewear"` —— **不在** `STATIC_INDUSTRIES` 的 13 个码内
（`electronics / textiles / toys / footwear / machinery / plastics / home-appliances /
food-beverage / chemicals / automotive / furniture / packaging / cosmetics`）。

**影响评估（已核到代码，结论：低）**
- `app/[locale]/suppliers/[slug]/page.tsx:570` 行业格渲染为 `{s.industryCode ?? "—"}` ⇒
  显示原始小写串 `eyewear`（与其它供应商显示 `electronics` 等原始 code 的行为**一致**，非异常）。
- 全站 `/industry/${code}` 链接**只由 `STATIC_INDUSTRIES` 生成**，从不取供应商的
  `industry_code` ⇒ **不产生死链、不产生 404**。
- 该供应商不会出现在任何 `/industry/*` 列表或筛选中。

**建议**：作为独立小工作项二选一 —— ①把 `eyewear` 映射为 `machinery` 或
②在 `STATIC_INDUSTRIES` 增补 `eyewear` 码（会同时改变 sitemap / `/industry` 索引 / llms.txt，
需按「新页须同步 sitemap/导航/llms.txt」铁律处理）。**本轮不动**，等你拍板。
