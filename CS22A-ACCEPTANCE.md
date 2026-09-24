# CS-22A 验收报告 — Supplier Trust Profile 公开档案页

- 基础 commit：`aad2c74`（CS-22 地基，已验证为祖先）
- 本轮 commit：`48233334482f80b8a3b827bb05ec1f60a4a9847a`
- 远端状态：`refs/heads/main` = `4823333`（已 push，`git ls-remote` 实测一致）
- 部署版本：Cloudflare Workers Version `99f3b286-048c-418d-a024-91a8d036accd`，1947 assets，sitemap diff new=0
- 日期：2026-09-19

---

## 一、P0 四项硬约束（先于 UI 完成）

### P0-A 供应商归属（越权风险）
- 新增 `lib/supplierAccess.ts` 作为**唯一服务端归属裁决器**：会话邮箱优先 → `claimedSupplierId` 仅做一致性校验 → 一邮箱多供应商返回 `409 ambiguous_ownership`（绝不自动选中）→ 不匹配返回 `403 ownership_mismatch`。
- 每次请求重新查库，**不做 email→supplierId 缓存**（改邮箱不会残留错误归属）。
- `lib/supplierAssessments.ts` 中两处手写 `supEmail !== givenEmail` 比较已删除，全部改为 `resolveSupplierAccess()`。
- API 不再信任客户端传入的 `supplier_id` 作为身份依据，仅作一致性输入。
- 线上实测：错误邮箱访问 → **HTTP 403 `not_owner`**（非 200，非越权可读）。

### P0-B 评估数据模型（禁止建表）
- 未创建 `supplier_assessment_answers`。
- 复用 `supplier_assessments.responses_json` + `audit_templates`（社会责任 37 + 质量 35 = 72 项）。
- `supabase/cs22/03_verification_items_assessment.sql` 仅做加法：`verification_items.assessment_id uuid` + 索引 `verification_items_assessment_idx` + 唯一约束 `verification_items_record_item_uniq (verification_record_id, item_key)`。
- Verification Item 挂在 assessment_id / question_key 上，响应数据、证据、审核状态全部落在既有列。

### P0-C 图片限额（三档独立，未统一成 5MB）
| 场景 | 单张上限 | 数量上限 | 尺寸下限 |
|---|---|---|---|
| 公开工厂照 Public Factory Photo | 5 MB | 12 张/供应商 | 800×600 |
| 核验证据图 Verification Evidence | 10 MB | 5 张/核验项 | — |
| 供应商总计 | — | 50 张 / 200 MB | — |

- `lib/supplierImages.ts` 三个**相互独立**的门：`factoryPhotoCount`(12)、`evidenceItemCount`(5/项)、`currentCount`/`currentTotalBytes`(50/200MB，合计 `supplier_images` + `supplier_evidence` 图片 mime)。
- 曾用同一个 `currentCount` 同时卡 12 和 50 —— 已修复。

### P0-D 原图/公开图分离
- 原图（original）= 私有，永不外发；公开只走 display / thumbnail。
- `app/api/supplier-image/[imageId]/route.ts`：`VARIANTS = new Set(["display","thumbnail"])`，**不存在 original 分支**；需 `APPROVED` + `PUBLIC` 且供应商档案为 public 才签发 302 签名 URL（300s）。
- 公开档案页只调 `listPublicFactoryImages()`，读不到私有原图路径。

---

## 二、CS-A 交付：11 区块公开档案页

在**既有规范页** `app/[locale]/suppliers/[slug]/page.tsx` 上增强（未新建 `/supplier/[slug]`，避免与刚做完的 Google 索引审计产生重复内容冲突）。

| # | 区块 | 实现 |
|---|---|---|
| 1 | Header | 既有 |
| 2 | Verification Badge | `components/supplier/VerificationBadge.tsx`，复用 `lib/trustProfile.ts`（不自评） |
| 3 | Company Overview | 既有 |
| 4 | Products | 既有 |
| 5 | Manufacturing Capability | 既有 |
| 6 | Certifications | 既有（自述轴 ↔ 平台核验轴不交叉） |
| 7 | Factory Photos | `FactoryPhotoGallery.tsx`，仅公开图，lazy + 固定宽高 |
| 8 | Verification Details | `VerificationDetails.tsx`，`id="verification-details"` |
| 9 | Verification History | `<details>` 折叠，保留过期/撤销记录 |
| 10 | Buyer CTA | 既有 |
| 11 | Share CTA | `ShareProfileButton.tsx` + `/api/supplier-share` |

**徽章（CS-D 组件）**：`NONE ○` / `SELF_ASSESSED ◐` / `ONLINE_VERIFIED ✓` / `ON_SITE_VERIFIED ✓✓` / `EXPIRED ⌛`；图标 + 文字 + 颜色**三重信号**，颜色非唯一标识；点击锚点跳到 Verification Details（ID / Method / Scope / Verified Date / Expiry / Status）。只有 Admin 能置 Verified。

**分享**：`/api/supplier-share` 只收 `slug`，生成并复用 `share_token`（幂等，处理 23505），返回 `/suppliers/{slug}?ref={token}` —— **不含内部 Supplier UUID**。

---

## 三、CODE → TEST → BUILD → DEPLOY → LIVE VERIFY → COMMIT

### TEST
| 套件 | 结果 |
|---|---|
| `tsc --noEmit` | EXIT=0 |
| `cs22a-public-profile-regression.ts` | **77 PASS / 0 FAIL**（A–G 七节） |
| `cs06a` | 55 / 0 |
| `cs12-profile-regression.ts` | 34 / 0 |
| `cs16` | 62 / 0 |

> cs12 中 F2（裸 `data-track` 计数 `=== 3`）是**既有 FAIL**——在 `aad2c74` 上实测即为 4（STEP 10-D 引入）。已改为 4 个已知 `data-track` 的白名单精确断言 + 新增 F2b 断言 `profileShareClick` 不在页面内，**未通过改自己的代码去凑绿**。
> 回归断言前必须剥注释（TS/JS 走 `scripts/stripComments.ts`，SQL 剥 `--` 行），否则注释字面量造成假 FAIL —— 本次 C1/E2/E7/F18 已按此修正。

### BUILD
- `next build` EXIT=0 → `node node_modules/@opennextjs/cloudflare/dist/cli/index.js build` EXIT=0。
- `scripts/cf-release.cjs --skip-populate` 五步全绿（populate 因 `spawnSync` 子进程被沙箱静默 kill，改为 shell 循环 `--batch 60` × 33 轮共 1995 文件先跑完）。

### DEPLOY
- 1947 assets，Version `99f3b286-048c-418d-a024-91a8d036accd`，sitemap diff new=0。

### LIVE VERIFY（真实线上）
- 9 个已发布档案页全部 **200 + `robots=index, follow`**。
- 徽章：1 × SELF_ASSESSED、8 × NONE（与库内真实状态一致，无自授 Verified）。
- 分享按钮存在；分享 API 返回 `sup_...` token；带 `?ref=` 的分享链接 canonical **hasRef=false**（不污染规范链接）。
- 图片代理：伪造 id → 404；`v=original` → 404；非法 id → 400。
- 浏览埋点：200，库内出现 `PROFILE_VIEW` / `UNIQUE_VISIT` / `SHARE_CREATED`；同一访客同日 2 次调用 → UNIQUE_VISIT 去重为 1。
- zh 页渲染「工厂自评」「分享档案」。
- 归属错误邮箱 → **403 not_owner**。

### COMMIT
- `4823333 feat(CS-22A): Supplier Trust Profile 公开档案页（P0 四约束 + 11 区块）`
- 已 push；`git ls-remote origin refs/heads/main` = `4823333`，与本地 HEAD 一致。
- 基础仍是 `aad2c74`（`git merge-base --is-ancestor aad2c74 HEAD` = YES）。

---

## 四、本轮顺带修掉的真实生产缺陷

`supabase/cs22/01_migration.sql` 中 `ADD COLUMN profile_status text DEFAULT 'draft'` 会给**已存在的 20 行**回填 `'draft'`，导致后续 `UPDATE ... WHERE profile_status IS NULL` 命中 **0 行** —— 9 个已发布供应商卡在 `draft`，按 `isProfileNoindex` 判定会导致 9 个已收录页面被加 noindex。
已由 `supabase/cs22/02_backfill_profile_status.sql` 修正并验证：9 个 `is_published=true` → `public`，11 个未发布保持 `draft`。

---

## 五、i18n / Analytics

- `scripts/apply-cs22a-i18n.cjs`：`trustProfile` 命名空间 **30 键 × 9 语**，人工核对翻译（无机器伪造），EOL 保持、键集与空值自检通过 → 9 语各 +30，叶子数 **2940 → 2970**（13 处常量已同步）。
- 埋点全部复用既有 `lib/analytics.ts`：新增 `supplier_profile_share_cta_click`（归入 **CLICK_LEVEL_EVENTS**，不冒充转化）与 `supplier_verification_view`。

---

## 六、已知限制 / 下一步

- 供应商自评填写 UI 与证据上传**尚未做**（CS-A 范围不含），当前 8 家为 NONE 属真实数据状态。
- Admin 核验工作台 UI 未做（CS-C），核验记录目前只能由既有 admin API 写入。
- 付费下载报告（CS-F）未做。
- 顺序：CS-A（已完成并验收）→ CS-B → CS-C → CS-D → CS-E → CS-F → CS-G。
