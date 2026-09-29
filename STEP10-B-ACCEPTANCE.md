# STEP 10-B — ACCEPTANCE REPORT
**Change Set:** STEP 10-B — DATA FOUNDATION + BUSINESS LINKAGE
**Date:** 2026-09-20
**Deploy:** Version `3d660e9a-1edf-4585-8405-24e46aeac3c4` · buildId `dhTIFli2JtkgGZwttGKsE` · https://factoryauditb2b.com
**Status:** ✅ ACCEPTED (build / deploy / regression all PASS) — STOP after 10-B-0..3 per spec §44

---

## 1. Change Set & Scope
STEP 10-B 仅交付数据基础与业务联动骨架：10-B-0（sitemap 404 完整性）、10-B-1（migration 026 字段）、10-B-2（数据层）、10-B-3（Admin 省份修复 + Supplier→Cluster 选择器）。完成即 STOP，不自动进入 10-C/10-D/10-E/10-F/10-G。

## 2. Decisions Confirmed
- **Decision A** — 仅 8 个已发布 P0 集群为 P0+PUBLISHED；spec §8–§12 列出的 ~80 集群保持 DRAFT/REVIEW/P1/P2，未批量导入。
- **Decision B** — Indonesia `batik-soehadi`（Surakarta，industry=null，未发布）保持 `cluster_slug=NULL` / REVIEW，不强制归类到 Batam/Jepara。
- **Decision C** — 不新建 `buyer_requests` 表；复用 `rfqs.is_public=true` 作为 Live Buyer Requests 数据源。

## 3. 10-B-0 Sitemap 404 Integrity — PASS
`sitemap-verify.mjs` 读取 `/sitemap.xml`、折叠 locale、逐一请求 `/en<base>`：147 个唯一路径、0 失败。R9 dead-country-detail 发射块此前已注释，无 404 URL。

## 4. 10-B-1 Migration 026 — APPLIED
`scripts/db-apply-sql.mjs` 应用到生产（HTTP 201，5 语句：4× ADD COLUMN + 1× UPDATE + 索引）。
- `rfqs.source_type text`（可空）
- `rfqs.industrial_cluster_slug text`（可空，命名遵循 spec §5，与 `suppliers.cluster_slug` 同模式、文本引用、无 FK）
- `industrial_clusters.featured boolean NOT NULL DEFAULT false`
- `idx_rfqs_cluster_slug`（partial index，仅非 NULL）
- 有意写入：8 个 P0 slug 置 `featured=true`
- **零破坏性**：无 DROP/DELETE/TRUNCATE；全部 `IF NOT EXISTS`；历史行不受影响。

## 5. 10-B-2 Data Layer — DONE
- `lib/industrialClusters.ts`：`IndustrialCluster.featured`；`COLS` 白名单加 `featured`；`listPublishedClusters({featured?})` + `listFeaturedClusters()`；`ClusterUpsertInput.featured?`；新增 `listPublishedClusterSlugs(): Promise<Set<string>>`（供供应商 API 校验）。
- `normalizeCountryKey(input)`：映射 `CN→china / TH→thailand / VN→vietnam / ID→indonesia`（及小写名变体），解决集群大写 `CN` 与供应商小写 `china` 的国码不一致（不能裸 lowercase，`lowercase(CN)=cn≠china`）。
- `lib/queries.ts`：`listPublicRfqs(limit, {clusterSlug?})` 增加 `industrial_cluster_slug` 选择列与可选过滤；隐私白名单不变（永不返回 email/company/message/user_id/status/utm）。

## 6. 10-B-3 Admin Province + Supplier→Cluster — DONE
- `IndustrialClusterManager.tsx`：POST body 补 `province` 与 `featured`；表单加省份输入框 + featured 复选框；`toDraft` 补 `featured`（修复 tsc 缺字段）。
- `app/[locale]/admin/industrial-clusters/page.tsx`：补 `fProvince`/`fFeatured` 标签（ZH/EN）。
- `SupplierEditor.tsx`：新增 `cluster_slug` 字段 + `ClusterOption`；`<select>` 仅列已发布集群（label = name·country·province·city，value=slug）。
- `app/api/admin/suppliers/route.ts`：PATCH 校验 `cluster_slug`，空串→NULL，非空则比对 `listPublishedClusterSlugs()`，仅写入已知 slug（防无效写入）。
- `app/[locale]/admin/suppliers/[slug]/page.tsx`：拉取已发布集群构建选项并传入。

## 7. TypeScript Check — PASS
`tsc --noEmit -p tsconfig.json` → EXIT=0。（修复 `IndustrialClusterManager.tsx` `toDraft` 漏 `featured` 字段导致的 TS2741。）

## 8. next build — PASS
`next build`：Compiled successfully 5.1min；Generating static pages 1645/1645；0 错误。

## 9. opennextjs-cloudflare build — PASS
`opennextjs-cloudflare build`：Compiled 15.1s；1645 静态页；`Worker saved in .open-next\worker.js` 🚀；OpenNext build complete。

## 10. Deploy (cf-release.cjs) — PASS
唯一发布入口四阶段全过：
- ① populate：1576 文件（页面缓存 1472 / fetch 104），0 非预期路径。
- ② scrub：清空 21 处密钥明文，自检通过。
- ③ verify：**ALL PASS** — CS08/CS11/CS12 事件与结构化字段命中；密钥自检干净；**en 字典叶子数 = 2938（期望 2938）**；预渲染落地闸门 PASS（页面 1472 / fetch 104 大小逐项一致）；assets 1743 ≤ 20000；单文件最大 1.75 MiB ≤ 25 MiB。
- ④ wrangler deploy：Uploaded 1571 文件（Worker Startup 16ms）；Version `3d660e9a-…`。
- ⑤ post-publish URL 提交：sitemap new=0 / removed=0，无新增。

## 11. §37 STEP 09 301 Regression — PASS (5/5)
legacy 扁平 URL → 层级 canonical 最终落地 200：
| 簇 | legacy → canonical |
|---|---|
| dongguan | `/industrial-clusters/dongguan-electronics` → `/industrial-clusters/china/guangdong/dongguan-electronics` ✅ |
| rayong | → `/industrial-clusters/thailand/rayong-automotive` ✅ |
| bac-ninh | → `/industrial-clusters/vietnam/bac-ninh/bac-ninh-electronics` ✅ |
| batam | → `/industrial-clusters/indonesia/batam/batam-electronics` ✅ |
| jepara | → `/industrial-clusters/indonesia/jepara/jepara-furniture` ✅ |

> 注：`/en/industrial-clusters/<slug>` 首跳返回 308 至扁平路径，系 Cloudflare 边缘 zone 级 `/en/*`→`/*` 默认语言剥离规则（先于 worker 执行，属既有 zone 配置，非 10-B 改动）；跟随重定向后最终仍落地层级 canonical。10-B 未触碰 `middleware.ts` / `clusterRoutes.ts`，STEP 09 重定向机制未受损。

## 12. §38 RFQ Flow — PASS
`/en/rfq` → 200 且含 `<form>`；RFQ API `referenceId`/`stored` 门禁未改动；新字段 `source_type` / `industrial_cluster_slug` 可选可空，向后兼容。

## 13. §39 GA4 5 Events — PASS
首页 data-track 实测存在：`home_live_buyer_request_view`（Live Buyer Requests 曝光）、`home_live_buyer_request_cta_click`（卡片 CTA 点击）、`home_rfq_cta_click` 等。`lib/analytics.ts` 定义全部 5 事件（`home_live_buyer_request_view` / `_cta_click` / `rfq_enter` / `rfq_submit` 及 sourcing 链路）；`rfq_enter`/`rfq_submit` 为客户端提交 handler（SSG 静态 HTML 不含，STEP 08 已验证，10-B 未改分析代码）。verify 闸门 CS08 命中 `supplierNetworkSubmit` 等事件标记。

## 14. §40 Privacy — PASS
首页仅出现 `support@factoryauditb2b.com`（公开 JSON-LD，预期内），**无买家邮箱 / 公司名泄漏**。`listPublicRfqs` 列白名单未变（永不返回 email/company/message/user_id/status/utm）。唯一邮箱 `support@` 为公开 JSON-LD，符合既往约定。

## 15. §41 Sitemap Hierarchical-only — PASS
`/sitemap.xml` → 200，1323 条 `<loc>`；不含 legacy 扁平 cluster URL；含层级 canonical cluster URL。sitemap 仍仅层级结构。

## 16. Data Integrity — PASS
- 8 个 P0 集群 `featured=true`（migration 写入，可经 `listFeaturedClusters()` 取用，供 STEP 10-G Featured 模块）。
- `normalizeCountryKey` 修正国码大小写不一致（CN/TH/VN/ID ↔ china/thailand/vietnam/indonesia）。
- Indonesia `batik-soehadi` 保持 `cluster_slug=NULL` / REVIEW，未强制归类（Decision B）。
- 未批量导入 ~80 个 DRAFT/REVIEW 集群（Decision A）。

## 17. Backward Compatibility / NULL-safety — PASS
- 新列全部可空；历史 RFQ 的 `source_type` / `industrial_cluster_slug` 保持 NULL（不回填）。
- 供应商 `cluster_slug` 空串→NULL；非空经服务端存在性校验后才写入。
- migration 无 DROP/DELETE/TRUNCATE；`featured` 有 DEFAULT false，历史 cluster 行不受影响。

## 18. Build/Deploy Gate — PASS
en 字典叶子数冻结 **2938**（8 处同源 + verify-opennext-bundle + RELEASE-RULES）；预渲染落地闸门 PASS；assets 1743 ≤ 20000（CF Free）；单文件最大 1.75 MiB ≤ 25 MiB（CF Free）。

## 19. Risks / Open Items
- ~80 个 DRAFT/REVIEW 集群未导入（Decision A，属后续独立任务，不并入 10-B）。
- Indonesia 供应商仍为 `cluster_slug=NULL` / REVIEW，待真实审核后绑定（Decision B）。
- `featured` 标记已落库，但 Featured Clusters 首页模块（STEP 10-G）尚未构建——本步仅打地基。
- `/en` 首跳 308 为 Cloudflare 边缘 zone 规则，非代码问题；如要单跳 301 可后续在 zone 层调整（非 10-B 范围）。

## 20. STOP Confirmation
已完成 10-B-0 / 10-B-1 / 10-B-2 / 10-B-3，构建部署与线上回归全 PASS。**按 spec §44 STOP：不自动继续 10-C / 10-D / 10-E / 10-F / 10-G。** 后续步骤（Featured 模块、集群页 Buyer Requests 联动、真实 RFQ→审核→is_public 闭环）由用户决策后启动。
