# STEP 10-C — FUTURE CLUSTER CANDIDATE VALIDATION（只读审计）

> 模式：**READ ONLY → VALIDATE → REPORT → STOP**
> 本轮**未写库、未改 `supplier.cluster_slug`、未新建/删除 Cluster、未改任何国家/省/市/行业字段、未部署**。
> 所有结论基于生产库真实快照 + 项目路由审计。

---

## 0. 数据快照（生产库真实状态）

| 维度 | 数值 |
| --- | --- |
| Suppliers | **17 家**（已发布 9 / 未发布 8） |
| P0 Clusters | **8 个**（全部 Published，无 DRAFT，无候选同名） |
| RFQs | **6 条**（仅 1 条 public；其余 5 条含 3 条 food-beverage **测试探针** + 1 条 chemicals public + 1 条不锈钢配件测试） |
| 城市分布 | 17 家散布于 **14 个不同城市** |
| 与 8 个 P0 城市/行业的重叠 | **0 家**（连 Dongguan 也是 plastics，非 dongguan-electronics）→ 这正是 STEP 10-D `ASSIGN=0` 的根因 |

---

## 1. 按城市聚合（候选集中度核心证据）

| City | 供应商数 | 明细（slug · industry · published） |
| --- | --- | --- |
| Guangzhou | 2 | `guangzhou-sunny-food` (food-beverage·pub) · `guangzhou-textile-factory` (textiles·pub) |
| Shenzhen | 2 | `shenzhen-precision-electronics` (electronics·pub) · `shenzhen-jorigin-packaging` (packaging·unpub) |
| Xiamen | 2 | `xiamen-jings-eyewear` (eyewear·pub) · `xiamen-jintaijin-polish-tech` (∅·unpub) |
| Surakarta | 1 | `batik-soehadi` (∅·unpub, Indonesia, REVIEW) |
| Dongguan | 1 | `dongguan-plastic-molding` (plastics·pub) |
| Qingyuan | 1 | `guangdong-junchi-sports` (∅·unpub, pickleball) |
| Ho Chi Minh | 1 | `ho-chi-minh-garment` (textiles·pub, Vietnam) |
| Jiangsu | 1 | `jiangsu-liquid-damper` (machinery·pub) |
| unknown | 1 | `loomeami` (∅·unpub, loungewear) |
| Nanjing | 1 | `nanjing-mxcomm` (electronics·pub) |
| Rizhao, Shandong | 1 | `qingdao-xiuxinyang` (∅·unpub, loungewear/apparel) |
| Jinan | 1 | `shandong-loyal-industrial` (machinery·pub, food machinery) |
| 青岛 (Qingdao) | 1 | `supplier` (∅·unpub, **country=unknown**, PPE, 占位 slug) |
| Shenzhen, Guangdong | 1 | `u-w-y-company-limited` (∅·unpub, smart TV/kiosk) |

**关键事实：没有任何「城市 + 行业」组合拥有 ≥2 家 Supplier。** 每个城市的 2 家供应商都分属不同行业。

## 2. 按行业聚合（跨城主题集中度）

| Industry | 供应商数 | slugs |
| --- | --- | --- |
| ∅（未填行业） | 7 | batik-soehadi, guangdong-junchi-sports, loomeami, qingdao-xiuxinyang, `supplier`, u-w-y, xiamen-jintaijin-polish |
| textiles | 2 | guangzhou-textile-factory, ho-chi-minh-garment |
| machinery | 2 | jiangsu-liquid-damper, shandong-loyal-industrial |
| electronics | 2 | nanjing-mxcomm, shenzhen-precision-electronics |
| plastics | 1 | dongguan-plastic-molding |
| food-beverage | 1 | guangzhou-sunny-food |
| packaging | 1 | shenzhen-jorigin-packaging |
| eyewear | 1 | xiamen-jings-eyewear |

> **隐藏发现**：若把 `textiles`(2) + 跨城 `apparel/loungewear`(`qingdao-xiuxinyang`, `loomeami`, 以及 `guangzhou-textile-factory` 的 garments) 合并，**Apparel/Textile 是整个库里最集中的行业（约 4–5 家）**，但地理上分散（广州 / 胡志明 / 日照 / unknown）。这点在 §6 业务判断中展开。

## 3. 现有 SEO 页面审计（重复风险判定）

项目已存在三类落地页：
- `country/[slug]`（国家页，如 `/country/china`）+ `countries/[slug]`
- `industry/[slug]` 与 `industry/[slug]/[topic]`（行业页，如 `/industry/electronics`、`/industry/textiles`）
- `industrial-clusters/[...segments]`（城市+行业簇页，即 8 个 P0）

**结论**：城市+行业 Cluster 页比「行业页 / 国家页」更细一级，是**互补长尾资产**，重复风险低——但前提是 Supplier 证据能撑起页面内容（否则是薄页）。

---

## 4. 8 项指定候选 — Evidence Validation（逐条）

### 4.1 Shenzhen Electronics Manufacturing
- Supplier 证据：仅 `shenzhen-precision-electronics`（electronics·pub，Consumer Electronics / PCB Assembly / Smart Home）。同城另一家 `shenzhen-jorigin-packaging` 是 packaging，**不计**。
- 城市/地区集中度：深圳 = 中国电子产业第一极（外部事实强），但库内仅 1 家。
- 行业一致性：1 家 electronics，清晰。
- 产品产业链：PCBA / 消费电子 / 智能家居，电子产业链完整。
- Buyer Intent：库内 0 条 electronics RFQ；但外部 "Shenzhen electronics manufacturer / PCB assembly" 搜索意图极强。
- SEO 价值：高（长尾互补，不与 `/industry/electronics` 冲突）。
- RFQ/审计闭环：电子厂 ISO/UL/CE 验厂 + 消费电子 RFQ，闭环价值高。
- 重复/细分风险：若再建 "Shenzhen Packaging" 会与本候选在同一城市过度细分（见 §6）。
- **判定：NEED_MORE_EVIDENCE**（论点强，但库内仅 1 家，需第 2 家或真实 RFQ 才达建簇证据 floor）。

### 4.2 Nanjing Electronics Manufacturing
- Supplier 证据：仅 `nanjing-mxcomm`（electronics·pub，工业无线 AP / Wi-Fi 模块 / 以太网交换机）——**仅 1 家**。
- 城市集中度：南京非一线电子枢纽，库内 1 家。
- 行业/产品：工业通信电子，清晰但细分。
- Buyer Intent：0 RFQ；外部 "Nanjing electronics" 搜索意图弱于深圳。
- SEO/闭环：中等（工业通信设备验厂需求存在，但主题窄）。
- **判定：NEED_MORE_EVIDENCE**（与深圳同为 1 家，但外部论点更弱，优先级低于深圳）。

### 4.3 Guangzhou Textile & Apparel
- Supplier 证据：仅 `guangzhou-textile-factory`（textiles·pub，Garments/Fabrics/Apparel）。同城 `guangzhou-sunny-food` 是 food，不计。
- 跨城佐证：库内另有 `ho-chi-minh-garment`(textiles)、`qingdao-xiuxinyang`(apparel)、`loomeami`(loungewear) → **纺织服装主题全库约 4–5 家**，但广州本地仅 1 家。
- 城市集中度：广州是传统纺织服装重镇（外部强）。
- Buyer Intent：0 条 textile RFQ；外部 "Guangzhou garment manufacturer" 意图强。
- SEO/闭环：高（服装社会责任审计 BSCI/WRAP 契合 FactoryAuditB2B）。
- **判定：NEED_MORE_EVIDENCE**（广州本地 1 家；主题证据在跨城层面更强，可后续考虑主题化而非纯城市锁）。

### 4.4 Ho Chi Minh / Vietnam Textile & Garment
- Supplier 证据：仅 `ho-chi-minh-garment`（textiles·pub，Garments/Uniforms）——**仅 1 家**。
- 城市集中度：胡志明 = 越南服装制造核心（外部强）。
- 行业/产品：服装，清晰。
- Buyer Intent：0 RFQ；但越南服装是全球 B2B 大垂直，外部意图强。
- SEO/闭环：高（越南服装厂验厂/社会责任审计是 FactoryAuditB2B 核心服务场景）。
- 重复风险：越南 P0 仅 `bac-ninh-electronics`，无越南纺织簇，不重复。
- **判定：NEED_MORE_EVIDENCE**（1 家强证据；越南纺织是战略级垂直，优先观察名单）。

### 4.5 Qingdao Safety PPE
- Supplier 证据：仅 `supplier`（**slug 即占位名 "supplier"**、`country=unknown`、unpub、产品含 safety gloves/helmets/PPE）。**数据质量不合格**：无国家、未发布、占位 slug。
- 城市集中度：`city="青岛"` 但 `country=unknown`，无法确证。
- 行业/产品：PPE 清晰，但记录本身不可信。
- Buyer Intent：0 RFQ。
- SEO/闭环：PPE 验厂（CE/ANSI）理论契合度高，但当前证据不可用。
- **判定：HOLD**（论点有效，但唯一证据是低质量未发布/国家不明/占位 slug 记录；须先清洗数据、补一条真实青岛 PPE 供应商，再评估）。

### 4.6 Xiamen Eyewear
- Supplier 证据：仅 `xiamen-jings-eyewear`（eyewear·pub，Optical Frames/Sunglasses/Reading/Prescription/OEM-ODM）——**1 家，质量高**。
- 城市集中度：厦门 = 全球眼镜制造枢纽（外部强）。
- 行业/产品：眼镜，单一清晰。
- Buyer Intent：0 RFQ；外部 "Xiamen eyewear factory / OEM eyewear" 意图强。
- SEO/闭环：高（眼镜厂 QC/光学验厂契合）。
- 重复风险：同城另一家 `xiamen-jintaijin-polish` 是抛光机（machinery），不构成细分冲突。
- **判定：NEED_MORE_EVIDENCE**（1 家强证据；厦门眼镜是论点最干净的候选之一）。

### 4.7 Shandong Food Machinery
- Supplier 证据：仅 `shandong-loyal-industrial`（machinery·pub，Food Processing Machinery / Snack Extrusion / Microwave Drying / Pet Food Lines）——**1 家，质量高**。位于 Jinan。
- 城市集中度：山东食品机械产业带（外部强，济南/潍坊一带）。
- 行业/产品：食品机械，清晰。
- Buyer Intent：0 RFQ；外部 "food processing machine manufacturer China" 意图强。
- SEO/闭环：高（食品机械 + 食品级 HACCP/食品安全审计契合）。
- **判定：NEED_MORE_EVIDENCE**（1 家强证据；与 `jiangsu-liquid-damper`(machinery, 江苏) 不同省不同细分，不重复）。

### 4.8 Guangzhou Food & Condiments
- Supplier 证据：仅 `guangzhou-sunny-food`（food-beverage·pub，Soy Sauce/Vinegar/Chili Sauce/Condiments）——**1 家**。
- 城市集中度：广州食品调味（外部中等）。
- 行业/产品：调味品，清晰。
- Buyer Intent：库内 food-beverage RFQ **全是测试探针**（"CS-02A brcgs rfq probe" ×2、"CS-02C...测试"），**无真实买家意图**。
- SEO/闭环：中（调味品厂食品安全审计可契合，但主题窄）。
- **判定：NEED_MORE_EVIDENCE**（1 家；且唯一 food-beverage RFQ 信号是测试数据，真实买家意图缺失）。

---

## 5. Candidate Matrix

> 评分词汇：Supplier 证据 = 匹配「已发布+可归属」供应商家数；Location = 城市是否明确；Industry = 行业是否清晰一致；Buyer Intent = 真实 RFQ(库内) / 外部搜索意图；SEO = 相对现有行业/国家页的长尾互补度；RFQ Value = 与审计/RFQ/Supplier 服务的闭环契合度。
> **不排名、不使用 Best/Winner。**

| Candidate | Supplier Evidence | Location Evidence | Industry Evidence | Buyer Intent | SEO Value | RFQ Value | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Shenzhen Electronics Manufacturing | 1 (pub, strong) | Clear | Coherent | Ext-strong / RFQ-none | High (complementary) | High | NEED_MORE_EVIDENCE |
| Nanjing Electronics Manufacturing | 1 (pub) | Clear | Coherent (niche) | Ext-weak / RFQ-none | Medium | Medium | NEED_MORE_EVIDENCE |
| Guangzhou Textile & Apparel | 1 (pub) + cross-city theme ~4-5 | Clear | Coherent | Ext-strong / RFQ-none | High | High | NEED_MORE_EVIDENCE |
| Ho Chi Minh / Vietnam Textile & Garment | 1 (pub) | Clear | Coherent | Ext-strong / RFQ-none | High | High | NEED_MORE_EVIDENCE |
| Qingdao Safety PPE | 1 (**low-quality**: unpub/unknown-country/placeholder-slug) | Ambiguous (country=unknown) | Coherent (PPE) | None / RFQ-none | Medium | High (theoretic) | HOLD |
| Xiamen Eyewear | 1 (pub, strong) | Clear | Coherent | Ext-strong / RFQ-none | High | High | NEED_MORE_EVIDENCE |
| Shandong Food Machinery | 1 (pub, strong) | Clear | Coherent | Ext-strong / RFQ-none | High | High | NEED_MORE_EVIDENCE |
| Guangzhou Food & Condiments | 1 (pub) | Clear | Coherent | None (test-probe only) | Medium | Medium | NEED_MORE_EVIDENCE |

**附加观察到的候选（用户未点名，但数据中出现）**：

| Candidate | Supplier Evidence | Note | Recommendation |
| --- | --- | --- | --- |
| Shenzhen Packaging | 1 (unpub, packaging) | 与 Shenzhen Electronics 同城，过度细分风险 | HOLD（待深圳电子簇验证后再考虑，避免同城碎片化） |
| Xiamen Polishing/Machinery | 1 (unpub) | 抛光机，niche | HOLD |
| Guangdong/Qingyuan Sports (Pickleball) | 1 (unpub, country=unknown) | 弱证据 | HOLD |
| China Loungewear/Sleepwear (cross-city) | 2-3 (loomeami + qingdao-xiuxinyang + guangzhou-textile garments) | 跨城 apparel 主题，地理不集中 | NEED_MORE_EVIDENCE（更适合"主题簇"而非城市锁） |

**汇总**：PROMOTE_TO_NEXT_STAGE = **0**；NEED_MORE_EVIDENCE = **8（指定）+ 1（附加）**；HOLD = **1（Qingdao PPE）+ 3（附加 niche）**；REJECT = **0**。

---

## 6. Cluster Creation Gate（基于真实数据提出，非机械套用）

当前库证明：若机械采用「≥2 家 Supplier」硬门槛，则**全部 8 个候选都会被永久挡住**（每个城市+行业仅有 1 家），项目永远无法启动新簇。因此 Gate 改为**多维加权、证据可替代**，而非单点数字：

- **G1 供应商证据底线**：≥1 家 **已发布 + 国家/行业可归属 + 产品与簇主题对齐** 的 Supplier。→ 直接排除 Qingdao PPE 的占位记录（unpub / country=unknown / slug="supplier"）。
- **G2 城市/地区明确**：city 非空且国家可归一（`normalizeCountryKey`），不得 `unknown`。
- **G3 行业一致性**：单一主导 `industry_code` 或紧凑产品族，非大杂烩。
- **G4 买家意图（二选一即可）**：(a) ≥1 条**真实**（非测试探针）RFQ 命中该行业/国家；**或** (b) 外部可验证的强搜索意图（需文档化，如 "Shenzhen electronics manufacturer" 量级）。测试探针 RFQ 一律不计。
- **G5 无重复/不过度细分**：slug 不与 8 个 P0 或已起草簇冲突；同城不得因微小行业差拆多个簇（如 Shenzhen Electronics vs Shenzhen Packaging 需合并或择一）。
- **G6 SEO 页价值**：必须是现有 `country/[slug]` / `industry/[slug]` 之外的**更细一级长尾资产**，而非重复覆盖。
- **G7 业务闭环契合**：能合理接入 FactoryAuditB2B 的 Audit / Supplier / RFQ 任一服务（电子→ISO/UL、纺织→BSCI/WRAP、食品机械→HACCP、PPE→CE/ANSI 等）。
- **G8 批次上限（防薄页蔓延）**：每轮新增簇 ≤ **3 个**，按 G1–G7 强度排序推进，避免一次性堆砌薄页。

**判定口径**：必须 **G1 + G2 + G3 + G5 + G6 + G7 全过**，且 **G4 至少满足 (a) 或 (b)**，方可 `PROMOTE_TO_NEXT_STAGE`。当前 8 个候选因 **G4(a) 全缺（库内 0 真实 RFQ）+ G1 仅 1 家**，均未达 PROMOTE。

---

## 7. 业务判断：8 个 P0 Cluster 是否覆盖过窄？

**结论：既因数据不足，也因架构偏保守——两者叠加。**

1. **数据不足（暂时性）**：当前仅 17 家 Supplier、散布 14 城，每个城市+行业最多 1 家。任何候选都凑不出 ≥2 家，这是样本量问题，会随 Supplier 入库自然缓解。

2. **架构偏保守（结构性）**：8 个 P0 是**自上而下按 SEO/行业代表性**选的（Jiangmen home-kitchen、Zhongshan lighting 等），与**我们实际拥有的 Supplier 完全零重叠**（STEP 10-D `ASSIGN=0` 即此）。结果是 8 个簇目前都是**无 Supplier 的空壳目的地页**，而真实 Supplier 集中度所在的城市（深圳、南京、广州、厦门、胡志明、济南、青岛）反而没有簇。

3. **最值得进入下一阶段的观察名单（非排名，按证据质量）**：
   - **Shenzhen Electronics** — 1 家强发布供应商 + 深圳电子外部论点最强。
   - **Xiamen Eyewear** — 1 家强发布供应商 + 厦门全球眼镜枢纽。
   - **Ho Chi Minh / Vietnam Textile** — 1 家发布供应商 + 越南服装是 FactoryAuditB2B 审计核心场景。
   - **Shandong Food Machinery** — 1 家强发布供应商 + 食品机械 HACCP 审计契合。
   - （Guangzhou Textile 论点也强，但建议以「跨城 Apparel/Textile 主题」而非纯广州锁来考虑。）

4. **目前不应建立的**：
   - **Qingdao Safety PPE**：唯一证据是低质量占位记录，须先清洗数据。
   - **Nanjing Electronics**：论点弱于深圳，且同城无第二家，优先级靠后。
   - **Guangzhou Food & Condiments**：真实买家意图缺失（food-beverage RFQ 全是测试探针）。
   - **同城过度细分**（如 Shenzhen Packaging 与 Shenzhen Electronics 并存）：违反 G5。

5. **结构性建议（供后续阶段参考，本轮不执行）**：库内 **Apparel/Textile 是集中度最高的行业（约 4–5 家）但地理分散**。若严格按「城市锁」建簇会把一个真实主题切碎；可考虑在 STEP 10-C 之后引入「主题簇 / 国家纺织簇」作为城市锁之外的补充维度，而非机械逐城建页。

---

## 8. 最终结论与 STOP

- 本步为**纯只读验证**，零写库、零改 slug、零建/删 Cluster、零部署。
- **无任何候选达到 PROMOTE_TO_NEXT_STAGE**：8 个指定候选全部 `NEED_MORE_EVIDENCE`，Qingdao PPE `HOLD`（数据质量），无 `REJECT`。
- 根因：库内 17 家 Supplier 过散（每城市+行业 ≤1 家）+ 真实 RFQ 缺失（food-beverage 为测试探针、public 仅 chemicals）。
- 已提出可执行的 **8 维 Cluster Creation Gate（G1–G8）**，作为下一步是否建簇的客观闸门。
- 8 个 P0 偏窄是「数据不足 + 架构保守」叠加，而非单纯保守。
- **STOP**：等待用户批准后再决定是否进入建簇（10-C 写入阶段）、或调整 P0、或补充 Supplier 数据以凑足 Gate 证据。

### 交付物
- 本报告：`STEP10-C-VALIDATION.md`
- 只读证据快照脚本：`db-10c-read.mjs`（输出 `10c-*.json`）
