# STEP 10-D — SUPPLIER CLUSTER LINKAGE ACCEPTANCE

> 日期：2026-09-20
> 范围：真实 Supplier → 8 个 P0 Industrial Clusters 关联（审计 + 回链机制 + 验收）
> 决策遵循：Evidence First（spec §3）、8 个 P0 仅允许归入（spec §6）、`normalizeCountryKey()` 复用（spec §13）、不修改生产国家字段（spec §14）、绝不直接改 production DB（spec §20）
> 部署：Version `008a5aec-cd19-4434-bd38-52bca3c4b145`，buildId `ECyQmcn2N1sS8po6SrezY`

---

## 1. Supplier Audit

对生产库 Supabase 做**只读** `database/query`（非推断），拉取全部 17 家真实 Supplier（`slug / legal_name / country_code / province / city / industry_code / main_products / company_description / is_published / cluster_slug`）与 8 个 P0 Cluster（`slug / name / country / country_code / province / city / industry / is_published / featured`）。

关键发现：17 家 Supplier 分布在 **14 个不同城市**；与 8 个 P0 的特定城市唯一重叠只有 **Dongguan**（且为塑料注塑，非电子）。因此在「国家+城市+行业+产品」四维同时命中（Level 1 Direct Match）上**空缺**。

## 2. Match Table

完整 17 行见 `STEP10-D-AUDIT.md`。汇总：

| # | Supplier | 位置 | 行业 | 候选 | Conf | Action | 理由（摘要） |
|---|---|---|---|---|---|---|---|
| 1 | batik-soehadi | ID/Surakarta | (null)/batik | — | — | KEEP_NULL | §9 印尼 REVIEW，不强制 batam/jepara |
| 2 | dongguan-plastic-molding | CN/Dongguan | plastics | dongguan-electronics | LOW | REVIEW | §8 Case 1：同城但行业不符，待人工确认 |
| 3 | guangdong-junchi-sports | unknown/Qingyuan | pickleball | — | LOW | KEEP_NULL | 清远无 P0 |
| 4 | guangzhou-sunny-food | CN/Guangzhou | food | — | LOW | KEEP_NULL | 调味品≠家居厨房 |
| 5 | guangzhou-textile-factory | CN/Guangzhou | textiles | — | LOW | KEEP_NULL | §8 Case 4 |
| 6 | ho-chi-minh-garment | VN/HoChiMinh | textiles | — | LOW | KEEP_NULL | §8 Case 3 胡志明纺织≠北宁电子 |
| 7 | jiangsu-liquid-damper | CN/Jiangsu | machinery | — | LOW | KEEP_NULL | 江苏机械无 P0 |
| 8 | loomeami | CN/unknown | loungewear | — | LOW | KEEP_NULL | 城市未知 |
| 9 | nanjing-mxcomm | CN/Nanjing | electronics | dongguan-elec? | LOW–MED | KEEP_NULL | 国家+行业匹、城市不符，禁南京→东莞 |
| 10 | qingdao-xiuxinyang | CN/Rizhao | apparel | — | LOW | KEEP_NULL | 山东服装无 P0 |
| 11 | shandong-loyal-industrial | CN/Jinan | machinery | — | LOW | KEEP_NULL | 济南食品机械无 P0 |
| 12 | shenzhen-jorigin-packaging | CN/Shenzhen | packaging | — | LOW | KEEP_NULL | §8 Case 2 类比，无深圳 P0 |
| 13 | shenzhen-precision-electronics | CN/Shenzhen | electronics | — | MED | KEEP_NULL | §8 Case 2 禁建深圳 Cluster |
| 14 | supplier(青岛信戈诺) | unknown/Qingdao | PPE | — | LOW | KEEP_NULL | 青岛劳保无 P0 |
| 15 | u-w-y-company-limited | CN/Shenzhen | display | — | LOW | KEEP_NULL | 深圳显示无 P0 |
| 16 | xiamen-jings-eyewear | CN/Xiamen | eyewear | — | LOW | KEEP_NULL | 厦门眼镜≠中山照明 |
| 17 | xiamen-jintaijin-polish | CN/Xiamen | polishing | — | LOW | KEEP_NULL | 厦门表面处理无 P0 |

## 3. ASSIGN Count

**0**。无任何 Supplier 在「国家+城市+行业+产品」上同时命中任一 P0（Level 1 Direct Match 空缺）。此为本步真实数据下唯一诚实结论——强行归类会违反 spec §5/§8 各 Case 护栏与「禁止自动猜测」(§5)。

## 4. REVIEW Count

**1**。`dongguan-plastic-molding`：唯一同城（Dongguan）但行业=plastics、产品为通用注塑/塑料件，未证明属电子产业链；不自动 ASSIGN，待人工确认；`cluster_slug` 维持 NULL。

## 5. KEEP_NULL Count

**16**（含 batik-soehadi 印尼 REVIEW 不变）。`cluster_slug` 全部维持 NULL。

## 6. Actual Supplier → Cluster Changes

**无写入**。17/17 的 `cluster_slug` 本就为 NULL，已是正确终态。符合 §20「绝不直接修改 production DB」——本轮零 DML。

> 可选升级：若人工确认 dongguan-plastic-molding 的注塑件确属东莞电子产业链，可经 Admin（`/admin/suppliers/[slug]` Cluster 选择器）将其置 `dongguan-electronics`；服务端已用 `listPublishedClusterSlugs()` 校验 slug 合法性。

## 7. Indonesia Supplier Review

`batik-soehadi`（Surakarta，industry=null，published=false）：**保持 `cluster_slug=NULL` / REVIEW**，未强制归入 `batam-electronics` 或 `jepara-furniture`（证据不足，spec §9）。

## 8. Admin Changes

- 供应商→集群选择器已于 STEP 10-B-3 落地（`/admin/suppliers/[slug]` 的 `<select>`，仅列已发布集群，显示 `name · country · province · city`，服务端存在性校验）。
- 本轮**未新增 Admin 字段/UI 改动**；选择器对 P0 集合（8 个）与写入校验均经代码审查确认有效。
- §43「Admin assignment」能力就绪：PATCH 经 `listPublishedClusterSlugs()` 白名单校验，非法 slug 一律拒绝写入。

## 9. Cluster Page Verification

`app/[locale]/industrial-clusters/[...segments]/page.tsx` 复用 `listSuppliersByClusterSlug(cluster.slug)`（§32 禁 N+1）。回归实测 8 个 P0 canonical 页（zh/en 共 16 请求）全部 **200** 且含空态文案「该产业带暂未收录已发布的供应商。」——无 500 / 空白 / 假计数（§40）。

## 10. Supplier Page Backlink Verification

`app/[locale]/suppliers/[slug]/page.tsx` 原将产业带渲染为**纯文本**（STEP-04 遗留）。本步按 §22 接入回链：
- 新增 `import { LEGACY_CLUSTER_REDIRECTS } from "@/lib/clusterRoutes"`；
- `cluster_slug` 命中已发布 P0（即 `LEGACY_CLUSTER_REDIRECTS` 集合）时，产业带行渲染为 `<Link href={p(canonical)} data-track="supplier_cluster_backlink">`，canonical 由 `buildClusterCanonicalPath` 生成（不得手写）；
- `cluster_slug=NULL`（REVIEW/KEEP_NULL）时保持纯文本，绝不产出指向不存在产业带的链接。

验证：tsc PASS；生产回归确认 0 关联供应商页**不含** `data-track="supplier_cluster_backlink"`（无假链接）。回链机制已就位，**将在首个真实关联时自动激活**。

## 11. Invalid Reference Check

生产库查询 `suppliers`：17 家 `cluster_slug` 全部为 NULL → 有效引用率 **100%**。无任何拼写/未发布/已删除 slug（§41/§42）。

## 12. Privacy

集群页与供应商页仅渲染公开 Supplier DTO（经 `redactSupplier` 裁剪），未暴露 email / phone / user_id / internal notes（§34）。本步未改动隐私层；未新增任何买家隐私字段。

## 13. Performance / N+1

`listSuppliersByClusterSlugs()` 与 `countSuppliersByClusterSlugs()` 均为 **1 次查询 + 内存过滤/分组**（§32 铁律），无 N+1。本步未改动查询层。

## 14. STEP 09 Regression

5 个 legacy 扁平路由（Dongguan / Rayong / Bac Ninh / Batam / Jepara）经 `middleware.ts` legacy 分支 → 301 → 层级 canonical → 200（zh 与默认语言各验，共 10 项）全部 PASS。STEP 10-D 未触碰 `lib/clusterRoutes.ts` / `middleware.ts`（§23 0 改动）。

## 15. TypeScript

`tsc --noEmit -p tsconfig.json` → **EXIT 0**（修复了回链变量作用域：`s` 为 SupplierView、`sp` 为字典，已正确区分）。

## 16. Build

`next build` → **Compiled successfully**，1645 静态页全部生成，0 错（约 4m25s）。

## 17. Deploy

`opennextjs-cloudflare build` → worker.js 落盘（约 9m37s）；`node scripts/cf-release.cjs` 五阶段全绿：
- ① populate 1567 文件；② scrub 21 密钥；③ verify ALL PASS（en 字典 2938、预渲染落地闸门 PASS、密钥自检干净）；④ wrangler 上传 1566 文件；⑤ sitemap diff new=0。
- 线上 Version `008a5aec-cd19-4434-bd38-52bca3c4b145`，buildId `ECyQmcn2N1sS8po6SrezY`；页面 HTML 注释含同款 buildId → 新构建确已生效。

## 18. Production Smoke Test

回归脚本 `regression-10d.mjs` 共 **30 项全部 PASS**：
- §38 301：10/10
- §40 空态：16/16
- §39 供应商页（已发布+未发布）：2/2
- §41/§42 数据完整性 17 家 valid：1/1
- §43 无非法 slug 写入：1/1

## 19. Git Commit

**N/A** — 项目非 git 仓库（见工作记忆），无 commit 步骤。代码改动留存于工作区 `app/[locale]/suppliers/[slug]/page.tsx` 与报告文件。

## 20. Future Cluster Candidates

仅记录，不建（留给 STEP 10-C）：

| Candidate | 国家/城市 | 行业 | 来源 |
|---|---|---|---|
| Shenzhen Electronics Manufacturing | CN/Shenzhen | electronics | shenzhen-precision-electronics, u-w-y-company-limited |
| Nanjing Electronics Manufacturing | CN/Nanjing | electronics | nanjing-mxcomm |
| Guangzhou Textile & Apparel | CN/Guangzhou | textiles | guangzhou-textile-factory |
| Ho Chi Minh / Vietnam Textile & Garment | VN/HoChiMinh | textiles | ho-chi-minh-garment |
| Qingdao Safety PPE | CN/Qingdao | PPE | supplier |
| Xiamen Eyewear | CN/Xiamen | eyewear | xiamen-jings-eyewear |
| Shandong Food Machinery | CN/Jinan | machinery | shandong-loyal-industrial |
| Guangzhou Food & Condiments | CN/Guangzhou | food | guangzhou-sunny-food |

## 21. Remaining STEP 10-E / 10-F / 10-G

- **10-E** Buyer Request / RFQ Linkage — 未启动
- **10-F** Cluster Detail UI — 未启动（本步仅接入 Supplier 回链与空态验证）
- **10-G** Homepage Featured Clusters — 未启动（`featured` 字段已在 10-B 落库，待前端模块）
- **10-C** Bulk Cluster Expansion — 未启动（Future Candidate 已记录，待优先级排序）

> 按 spec §45 **STOP**：完成 10-D 后不自动进入 10-C/10-E/10-F/10-G，等待下一阶段指令。

---

### 交付物
- `F:\AI-验厂SEO网站\STEP10-D-AUDIT.md` — 17 行完整匹配审计表 + Future Candidates
- `F:\AI-验厂SEO网站\STEP10-D-ACCEPTANCE.md` — 本报告（21 节）
- 代码改动：`app/[locale]/suppliers/[slug]/page.tsx`（回链机制）
- 回归：`regression-10d.mjs`（30/30 PASS）
