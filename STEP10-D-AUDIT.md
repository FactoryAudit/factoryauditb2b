# STEP 10-D — SUPPLIER CLUSTER MATCH REVIEW

> 审计日期：2026-09-20
> 数据源：Supabase 生产库（只读 `database/query`，非推断）
> 归类总原则：**Evidence First**（spec §3）。仅允许归入 8 个已发布 P0 Cluster（spec §6）。
> 国家归一：复用 `normalizeCountryKey()`（CN→china / TH→thailand / VN→vietnam / ID→indonesia，spec §13）。
> 不修改任何生产国家字段（spec §14）。

## 8 个 P0 Cluster（仅允许归入这些）

| slug | 国家/省/市 | 行业 |
|---|---|---|
| jiangmen-home-kitchen | CN / Guangdong / Jiangmen | Home & Kitchen |
| zhongshan-lighting | CN / Guangdong / Zhongshan | Lighting |
| foshan-furniture | CN / Guangdong / Foshan | Furniture |
| dongguan-electronics | CN / Guangdong / Dongguan | Electronics |
| rayong-automotive | TH / Rayong | Automotive |
| bac-ninh-electronics | VN / Bac Ninh | Electronics |
| batam-electronics | ID / Batam | Electronics |
| jepara-furniture | ID / Jepara | Furniture |

## 匹配表（全部 17 家）

| # | Supplier | 位置 | 行业 | 候选 Cluster | Confidence | Action | 理由 |
|---|---|---|---|---|---|---|
| 1 | batik-soehadi | ID / Surakarta | (null) / batik | — | — | **KEEP_NULL** | §9：Surakarta 蜡染纺织，无证据归入 Batam Electronics / Jepara Furniture；published=false；保持 REVIEW |
| 2 | dongguan-plastic-molding | CN / Dongguan | plastics | dongguan-electronics | LOW | **REVIEW** | §8 Case 1：同城 Dongguan，但 industry=plastics、产品为通用注塑/塑料件，未证明属电子产业链；不自动 ASSIGN，待人工确认 |
| 3 | guangdong-junchi-sports-products-co-ltd | unknown / Qingyuan | (null) / pickleball | — | LOW | **KEEP_NULL** | Qingyuan 无 P0；运动器材不匹配任一 P0 行业 |
| 4 | guangzhou-sunny-food | CN / Guangzhou | food-beverage | — | LOW | **KEEP_NULL** | 广州无 P0；调味品≠家居厨房制造 |
| 5 | guangzhou-textile-factory | CN / Guangzhou | textiles | — | LOW | **KEEP_NULL** | §8 Case 4：广州纺织，无广州 P0 |
| 6 | ho-chi-minh-garment | VN / Ho Chi Minh | textiles | — | LOW | **KEEP_NULL** | §8 Case 3：越南 P0 仅 bac-ninh-electronics；胡志明纺织≠北宁电子 |
| 7 | jiangsu-liquid-damper | CN / Jiangsu | machinery | — | LOW | **KEEP_NULL** | 江苏机械，无江苏 P0 |
| 8 | loomeami | CN / unknown | (null) / loungewear | — | LOW | **KEEP_NULL** | 城市未知，睡衣类，无 P0 匹配 |
| 9 | nanjing-mxcomm | CN / Nanjing | electronics | dongguan-electronics? | LOW–MED | **KEEP_NULL** | 国家+行业(电子)匹配，但城市/省不符（Nanjing≠Dongguan）；§12 中国优先看 province/city/industry，禁止南京→东莞强归 |
| 10 | qingdao-xiuxinyang-international-trade-co-ltd | CN / Rizhao(Shandong) | (null) / apparel | — | LOW | **KEEP_NULL** | 山东日照服装，无 P0 |
| 11 | shandong-loyal-industrial | CN / Jinan | machinery | — | LOW | **KEEP_NULL** | 济南食品机械，无 P0 |
| 12 | shenzhen-jorigin-packaging | CN / Shenzhen | packaging | — | LOW | **KEEP_NULL** | §8 Case 2 类比：深圳包装，无深圳 P0 |
| 13 | shenzhen-precision-electronics | CN / Shenzhen | electronics | — | MED | **KEEP_NULL** | §8 Case 2：深圳电子但无深圳 P0；禁止新建深圳 Cluster、禁止强归 dongguan-electronics |
| 14 | supplier（青岛信戈诺科技） | unknown / Qingdao | (null) / PPE | — | LOW | **KEEP_NULL** | 青岛劳保 PPE，无 P0 |
| 15 | u-w-y-company-limited | CN / Shenzhen | (null) / display | — | LOW | **KEEP_NULL** | 深圳显示/电子，无深圳 P0 |
| 16 | xiamen-jings-eyewear | CN / Xiamen | eyewear | — | LOW | **KEEP_NULL** | 厦门眼镜≠中山照明 |
| 17 | xiamen-jintaijin-polish-tech-co-ltd | CN / Xiamen | (null) / polishing equip | — | LOW | **KEEP_NULL** | 厦门表面处理设备，无 P0 |

## 计数

- **ASSIGN：0** — 无供应商在「国家+城市+行业+产品」上同时命中任一 P0（Level 1 Direct Match 空缺）。
- **REVIEW：1** — dongguan-plastic-molding（唯一同城但行业不符，待人工确认；cluster_slug 维持 NULL）。
- **KEEP_NULL：16** — 含 batik-soehadi（印尼 REVIEW 不变）。

## 关键结论

真实数据下，8 个 P0 是 8 个**特定城市**集群；17 家供应商分布在 **14 个不同城市**，与 P0 城市唯一重叠只有 Dongguan（且为塑料注塑，非电子）。
按 spec 自身写下的 Evidence First 与 §8–§13 各 Case 护栏，强行归类会违反用户规则；故 **ASSIGN=0 是本步数据下唯一诚实结论**。
任何写入均未发生（17/17 cluster_slug 本就为 NULL，已是正确终态），符合 §20「绝不直接改 production DB」。

## 待人工确认（可选升级）

- 若人工确认 dongguan-plastic-molding 的注塑件确属东莞电子产业链，可经 Admin 将其 `cluster_slug` 置 `dongguan-electronics`（服务端已校验 slug 合法性）。

## Future Cluster Candidates（仅记录，不建，留给 10-C）

| Candidate | 国家/城市 | 行业 | 来源 supplier |
|---|---|---|---|
| Shenzhen Electronics Manufacturing | CN / Shenzhen | electronics | shenzhen-precision-electronics, u-w-y-company-limited |
| Nanjing Electronics Manufacturing | CN / Nanjing | electronics | nanjing-mxcomm |
| Guangzhou Textile & Apparel | CN / Guangzhou | textiles | guangzhou-textile-factory |
| Ho Chi Minh / Vietnam Textile & Garment | VN / Ho Chi Minh | textiles | ho-chi-minh-garment |
| Qingdao Safety PPE | CN / Qingdao | PPE | supplier |
| Xiamen Eyewear | CN / Xiamen | eyewear | xiamen-jings-eyewear |
| Shandong Food Machinery | CN / Jinan | machinery | shandong-loyal-industrial |
| Guangzhou Food & Condiments | CN / Guangzhou | food | guangzhou-sunny-food |
