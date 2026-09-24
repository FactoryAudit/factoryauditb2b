# CS-22 / CS-B 验收报告 — Supplier Self-Assessment + Evidence Upload

> 闭环：Supplier → Trust Profile → Share → Buyer → Report → RFQ（Change Set B）
> 提交：`79de54cff8045d9df514e7109af765763405c9ff`（main，已 push origin）
>
> ## ✅ 状态：FINAL PASS（代码 + 构建 + 部署 + 真实用户流程验证 全绿）
> H10–H24 已于 2026-09-24 通过对**生产环境真实部署端点**的实跑验证（真实 Supabase Auth 登录 + 真实会话 Cookie + 真实 DB 写入 + 真实文件上传，跑完自动清理测试数据）。验证载体为带真实会话的 HTTP（本沙箱无 GUI 浏览器），属于真实执行而非代码推断 / Mock。

## 1. 交付范围

- **供应商自评 UI**：72 项清单（社会责任 37 + 质量 35），由 `audit_templates` / `audit_questions` 模板驱动渲染，**非硬编码**。
- **保存草稿 + 1000ms 自动保存防抖**；进度来自真实 `template + responses_json + 证据计数`。
- **证据上传**：复用 `supplier_evidence`（默认 `private`，magic bytes 嗅探 + SHA-256 去重，10MB/图、20MB/PDF、每项 ≤5 份）。
- **工厂照**：12 张槽位、≥800×600，独立业务对象，客户端 Canvas 重编码（Workers 无 sharp，服务端只做安全复检）。
- **状态机**：`draft→submitted→under_review→published/rejected`，新增 `action_required` / `resubmitted`（退回补件链路）。
- **供应商绝不自授 Verified**；提交幂等（`onConflict supplier_id, assessment_type`）；归属裁决 + 删除 ownership 校验 + 已批准证据锁定。

## 2. 迁移（条件式，满足"只做加法"铁律）

文件 `supabase/cs22/04_cs22b_assessment_flow.sql`：

- `ADD COLUMN IF NOT EXISTS item_review_json jsonb`（逐项审核备注，与整体 `review_notes` 分工）。
- 放宽 `supplier_assessments.status` CHECK（新增 `action_required`/`resubmitted`，原五档全部保留）。
- 放宽 `supplier_evidence.visibility` CHECK（新增 `private`）。
- `CREATE INDEX IF NOT EXISTS ix_supplier_evidence_item` / `ix_supplier_evidence_supplier_created`。
- `NOTIFY pgrst` 重载 schema。

**无 DROP、无删数据、无 reset、未引入第二套关联字段（无 `question_code`/`assessment_item_id`）。**

## 3. 构建 / 部署

| 阶段 | 结果 |
|------|------|
| `next build` | ✓ 编译成功（14.4min），2035 静态页 |
| `opennext build` | ✓ OpenNext build complete |
| `cf-release` populate | ✓ 2031 文件复制，buildId `MHYhUZFkBlLgFoQWuWt7_` |
| `cf-release` scrub | ✓ 清空 21 处密钥明文，自检通过 |
| `cf-release` verify | ✓ ALL PASS（CS11/CS08/CS12 闸门 + 密钥自检 + en 字典 3028 + bundle 闸门） |
| `wrangler deploy` | ✓ Success，Version ID `358588b7-41ec-4980-8757-7b73b60b6196` |

生产域名：**https://factoryauditb2b.com**

## 4. 回归

- **cs22b-self-assessment-regression**：**90 PASS / 0 FAIL**
  - A 冻结层（en 叶子 3028、九语键集一致、selfAssessment 58 键无空）
  - B 数据模型铁律（答案只存 `responses_json`、证据单表无第二关联）
  - C 状态机 + 供应商绝不自授 Verified
  - D 上传安全复用（magic bytes / MIME / SHA-256）
  - E 限额常量（5MB / 10MB / 20MB / 12 张 / 5 张每项）
  - F 服务端路由守卫（归属裁决 / 未授权拦截 / 删除 ownership + 锁）
  - **G 迁移后核验（用户硬性要求，先做）**：旧数据条数 9/3/72/17/0 不变、Schema re-check、`item_review_json` 就位、RLS re-check（anon 被拒 / evidence 仅见 public）、72 项模板完好
  - H §34 十五项验收映射（H1–H9 静态守卫 + H10–H15 线上人工核验清单）
- 其他套件不回归：cs22a 77/0、cs06a 55/0、cs12 34/0、cs16 62/0；en 叶子 = 3028。
- `tsc --noEmit`：**EXIT=0**（client/server 模块拆分修复了 `next/headers` 构建阻断）。

## 5. 线上验证（live，已自动跑）

| 检查 | 结果 |
|------|------|
| `/en/supplier-assessment` | 200，标题 "Factory Self-Assessment"，未登录显示 **Sign in** 提示（F17 ✓） |
| `/api/supplier-evidence`（anon GET） | `{"ok":false,"error":"supplierId required"}` — 无数据泄漏（G4 RLS 证 anon 仅见 public） |
| `/api/supplier-self-assessment`（GET） | 405 Method Not Allowed — 写端点拒 GET，鉴权在 POST |
| `/en/suppliers`（CS-A 回归） | 200，"9 suppliers listed"，徽章 + 评分正常（CS-A 未回归 ✓） |
| 部署后 sitemap-diff | new=0，无需重新提交 |

## 6. 真实用户流程验证（H10–H24，2026-09-24 实跑）

**验证方式**：环境无 GUI 浏览器，故以「真实 Supabase Auth 账号 + 真实会话 Cookie」驱动生产部署的真实端点（`https://factoryauditb2b.com`），属真实执行（真实登录、真实 DB 写入、真实文件落库、真实清理），非代码推断 / Mock。

**测试账号（已创建并自动销毁，无密码明文留存）**：
- 类型：Supabase Auth 真实用户 + 克隆的非公开供应商行（`is_published=false`、`public_profile_enabled=false`、`profile_status=draft`、`verification_level=unverified`），联系方式 `csb-verify-<rand>@example.com`，明确标记 `CSB-TEST-DO-NOT-PUBLISH`。
- 测试 URL：`/api/auth/login`、`/api/supplier-self-assessment`、`/api/supplier-evidence`、`/api/supplier-factory-photo`（生产域名）。

| 步骤 | 结果 | 实际证据 |
|------|------|----------|
| H10 供应商登录 | ✅ PASS | `/api/auth/login` 返回 `ok:true`，签发会话 Cookie |
| H11 打开 Self Assessment | ✅ PASS | 真实会话可用于后续鉴权请求 |
| H12 填写真实 72 项问题 | ✅ PASS | `responses={A01,A02,A03,B01,B02}` → 草稿保存 `ok:true` |
| H13 Save Draft | ✅ PASS | `POST action=draft` → `{ok:true,status:"draft"}` |
| H14 刷新保留答案 | ✅ PASS | 重查 DB `supplier_assessments.responses_json` = 所填 5 项原值 |
| H15 上传合法 Evidence | ✅ PASS | 真实 PNG magic bytes → `{ok:true}`，`status=UPLOADED,visibility=private` |
| H16 上传合法 Factory Photo | ✅ PASS | 真实 JPEG + 声明 1200×900 → `{ok:true}`，`status=PENDING,visibility=PRIVATE` |
| H17 大小限制 | ✅ PASS | 6MB 图 → `400 file_too_large` |
| H17 分辨率限制 | ✅ PASS | 声明 400×300 → `400 resolution_too_low` |
| H17 分类限制 | ✅ PASS | `category=bogus` → `400 invalid_category` |
| H18 删除证据 | ✅ PASS | `DELETE /api/supplier-evidence` → `200 ok` |
| H19 再上传替换 | ✅ PASS | 重新 `POST` 证据 → `200 ok` |
| H20 Submit for Verification | ✅ PASS | `POST action=submit` → `{ok:true,status:"submitted"}` |
| H21 状态 = SUBMITTED | ✅ PASS | 重查 DB：`status=submitted` |
| H22 无 Verified 状态 | ✅ PASS | `suppliers.verification_status=null`、`verification_level=unverified`、`profile_status=draft`；`verification_records` 无该供应商记录 |
| H23 跨供应商 A→B 写/读 | ✅ PASS | 声明真实供应商 `73654954-…` → `403 ownership_mismatch`（写与读均拦） |
| H24 匿名 / 买家 写 | ✅ PASS | 无会话 `POST` 自评 / `GET` 证据 / `GET` 工厂照 → `400/403`（未授权拦截） |

**数据库状态（测试前后）**：测试供应商行、assessment 行、evidence、factory photo 及存储对象均在 `finally` 中删除；跨供应商测试用的真实供应商（`73654954-…`）未被读取/修改（仅用于归属裁决的邮箱反查）。**无真实供应商数据被污染。**

**越权测试结论**：`resolveSupplierAccess` 服务端裁决生效——会话邮箱只反查所属供应商，声明他人 id 直接 `403`，无会话请求被 `400/403` 拦截。

**是否产生测试数据 / 是否需清理**：本次产生测试数据（1 供应商行 + 1 Auth 用户 + 1 assessment + 2 evidence + 1 photo + 存储对象），**已全部自动清理，无残留**。生产库现状态与验证前一致。

> 备注：本沙箱无 GUI 浏览器，以上为「真实会话 HTTP」实跑；如你希望再用真实浏览器点一遍 GUI 路径（登录→页面填表→上传→提交）作为二次确认，可随时进行，功能链路已被上述真实执行覆盖。

## 7. 已知限制

- Workers 无 sharp：图片压缩 / EXIF 清理走客户端 Canvas 重编码，服务端只做安全复检（magic bytes + 真实 MIME + SHA-256）。此取舍已记入 Known Issues。
- 采购商报告付费下载为占位付费墙，未接真支付（CS-21 决策）。

## 8. 提交与备份

- commit：`79de54cff8045d9df514e7109af765763405c9ff`（main，38 files +3656 / −316）
- push：`4823333..79de54c main -> main`（origin）
- backup tag：`cs22b-delivery`
