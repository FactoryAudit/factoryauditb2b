# SupplierAssess｜Evidence Security 最终验收报告

生成时间：2026-09-18
核查对象仓库：`F:\AI-验厂SEO网站`（`package.json` name = `factoryauditb2b`，线上 `factoryauditb2b.com`）
核查方式：只读 —— 全仓文本扫描 + Supabase 只读 SQL + git 状态检查。**未执行任何删除或改动。**

---

## 0. 结论先行（Premise Mismatch）

**规格描述的 Evidence 私有文件 + 120 秒短时票据子系统，在本仓库中不存在。**

因此：

- TEST 01 – TEST 08 **全部 BLOCKED**（无法执行，不是"未通过"，是"不存在可测对象"）。
- **没有任何 `__SECTEST_*` 记录需要清理**（全库 0 条）。
- 规格所述"正式 Evidence 基线原本为 0、现存 10 条测试记录"**与本库实际不符**：本库 Evidence 表真实基线为 **4 行**（`audit_evidence` 1 行 + `supplier_evidence` 3 行），且无任何测试夹具。

同时确认：本机不存在名为 `SupplierAssess` 的项目。F: 盘另有 `verifyb2`（`F:\检测网站20260515`）与 `ai-pdf-cn`（`F:\PDF 网站搭建`）两个项目，经扫描**均无** `__SECTEST_` / `download-url` / `hasFile` / `public_pending` 相关代码。

按规格自身要求「**禁止把未执行写成 PASS**」「环境导致某一步无法执行：必须明确标记 MOCK / BLOCKED / TODO」，本报告对每项均给出状态与证据，不做任何代填。

---

## 1. 规格假设 vs 仓库实际（逐项证据）

| 规格中的假设 | 仓库实际 | 核查证据 |
|---|---|---|
| 项目名 `SupplierAssess` | 不存在 | Grep `SupplierAssess` 全仓 → 0 命中 |
| `/admin/evidence` 页面 | **不存在** | 全仓 admin 页面共 15 个（audits / orders / leads / members / rfqs / pending-review / report-standard / suppliers / suppliers/new / suppliers/[slug] / suppliers/[slug]/audits / documents / certifications），**无 evidence** |
| `download-url` 签发 120s 票据 | **不存在** | Grep `download-url` / `downloadUrl` → 0 命中 |
| `download` endpoint 再次执行授权 | **不存在** | 唯一的 evidence 接口是 `POST /api/admin/audits/[auditId]/evidence`，只写元数据 |
| 前端只接收 `hasFile` | **不存在** | Grep `hasFile` → 0 命中 |
| `fileKey` 字段 | **不存在** | `audit_evidence` 列清单中无 `file_key`（见 §1.2） |
| `public_pending` 安全边界 | **不存在** | Grep `public_pending` → 0 命中 |
| 10 条 `__SECTEST_*` Evidence | **0 条** | `to_jsonb(t)::text ilike '%SECTEST%'` → audit_evidence 0 / supplier_evidence 0 |
| Evidence 基线 = 0 | **= 4** | `count(*)`：audit_evidence 1、supplier_evidence 3 |
| 票据签到/re-authorization 日志 | **不存在** | 无该链路，无对应日志 |

### 1.1 本仓库实际存在的"最接近"机制

`lib/storage.ts`（Supabase Storage 私有 bucket 封装）：

- bucket：`supplier-docs`（**私有**，代码注释明示"永不生成公开 URL"）
- `createSignedUrl(path, expiresInSeconds = 300)` —— 默认 **300 秒**
- 唯一调用点：`app/api/admin/suppliers/[slug]/documents/route.ts:52` → `previewUrl: await createSignedUrl(r.file_path, 300)`
- 作用域：**仅 `supplier_documents`（供应商文件中心）的后台预览**，与 Evidence 无关
- 安全设计（已具备，且与规格要求方向一致）：服务端专用 + 动态 import 防 client bundle 泄漏、服务端拼装对象路径防穿越、MIME 白名单 + 10MB 上限、文件名 sanitize

`audit_evidence.storage_path` 在该 route 的源码注释中自述为 **MOCK 占位**：

> 「storage_path 在 V2.1 为「路径/外链」占位：真实私有存储上传列入 Backlog（MOCK），与 admin 文件中心（supplier_documents）一致——先写元数据，blob 上传后补。」

即：**Evidence 目前没有真实文件存储，更没有下载链路。**

### 1.2 证据表真实结构

`audit_evidence`（1 行）：
```
id, audit_id, supplier_id, question_id, finding_id, uploaded_by, filename,
file_type, file_size, storage_path, source, description, issue_date, expiry_date,
document_number, issuing_body, verification_status, status, uploaded_at, created_at
```
→ 无 `file_key`、无 `bucket`、无 `is_public`、无 `public_pending`、无 `approved`。

`supplier_evidence`（3 行）：
```
id, supplier_id, type, status, source, date, note, visibility, created_at
```
→ 无任何文件字段。

---

## 2. Download Flow

**规格期望：**
```
request → auth → permission → signed ticket → download endpoint → re-authorization → file
```

**本仓库实际：**
```
（不存在）
```
Evidence 侧唯一链路为元数据写入：
```
POST /api/admin/audits/[auditId]/evidence
  → requireAdmin()  → 非 admin 返回 404（项目统一防枚举口径，非 403）
  → 校验 supplierId 必填 / source 枚举
  → attachEvidence(...)  仅写元数据行，无 blob 上传、无票据、无下载
```
供应商文件中心（`supplier_documents`）链路为：
```
GET/POST /api/admin/suppliers/[slug]/documents
  → requireAdmin()
  → createSignedUrl(file_path, 300) 返回临时预览 URL 给后台
```
——**不存在独立的 `download-url` 票据签发端点，也不存在"下载前二次授权"的 `download` 端点。**

---

## 3. Authorization Matrix（现状）

| 角色 | 现有可访问面 | 实际授权结果 |
|---|---|---|
| Admin | `/api/admin/audits/[auditId]/evidence`（写元数据）、`/api/admin/suppliers/[slug]/documents`（含 300s 签名预览） | 允许；`requireAdmin()` 通过 |
| Supplier Owner | 无 evidence / 无文件下载端点 | 无此能力（不存在该端点） |
| Buyer / Public User | 无 | 无此能力（不存在该端点） |
| Unauthenticated | 同上 | `requireAdmin()` 未通过 → 返回 **404**（项目统一口径），不泄漏任何存储信息 |

说明：本项目未授权响应的既有约定是 **404 掩蔽**（`{ ok:false, error:"not_found" }`）而非 403，用于防枚举；这与规格 §四要求的 "401/403/404 语义" 存在口径差异 —— 若要改成 403，需先确认是否接受放弃防枚举。

---

## 4. Security Tests（逐项）

| 编号 | 场景 | 状态 | 原因 |
|---|---|---|---|
| TEST 01 | Admin 正常下载（`/admin/evidence` → Download） | **BLOCKED** | 页面不存在；无下载链路；无真实 Evidence 文件 |
| TEST 02 | 未授权用户 | **BLOCKED** | 无下载端点可测 |
| TEST 03 | 跨供应商访问 | **BLOCKED** | 无下载端点可测 |
| TEST 04 | `public_pending`（isPublic=true, approved=false） | **BLOCKED** | 字段与边界均不存在 |
| TEST 05 | `no_file`（有记录无 fileKey） | **BLOCKED** | 无 `fileKey` 概念 |
| TEST 06 | 票据过期（120s） | **BLOCKED** | 无票据机制 |
| TEST 07 | 取消发布后旧票据 | **BLOCKED** | 无票据、无发布态联动 |
| TEST 08 | Evidence 删除后旧票据 | **BLOCKED** | 无票据机制 |

**未执行 ≠ PASS。以上 8 项均为 BLOCKED。**

---

## 5. Frontend Leakage Check

- Evidence 前端页面不存在 → **该检查无对象（N/A）**。
- 正面发现（既有设计，非本轮改动）：`lib/storage.ts` 顶部强制注释"绝不可被客户端组件 import"，且 admin 侧一律动态 import；对外仅暴露元数据，文件本体走短时签名。**方向与规格要求一致**，可直接作为未来实现 Evidence 票据下载的基础。

---

## 6. Cleanup

**未执行删除操作**（无对象可删）。

| 指标 | 要求 | 实测 | 结论 |
|---|---|---|---|
| `__SECTEST_*` 数量 | 0 | audit_evidence 0 / supplier_evidence 0 | 已满足（本轮无需动作） |
| Evidence 总数 | 0 | **4**（audit_evidence 1 + supplier_evidence 3） | **不满足，但非测试夹具** |

**重要提示：** 实测的 4 行**不是**测试夹具，无法判定为可删。规格要求"Evidence = 0"与本库现状冲突，且删除正式证据数据属于破坏性操作，**在未逐行确认来源前我不会执行任何删除**。

---

## 7. Regression

| 项目 | 规格命令 | 实际 | 结果 |
|---|---|---|---|
| Typecheck | `npm run typecheck` | 项目**无此脚本**；等价执行 `tsc --noEmit` | **PASS**（EXIT=0） |
| Build | `npm run build` | `next build` | **PASS**（EXIT=0，已于 PHASE 08 执行并成功部署） |
| Lint | `npm run lint` | `next lint` | **BLOCKED** —— `eslint` 与 `eslint-config-next` 均未安装，且本沙箱 `npm install` 被安全策略拦截 |
| Test | `npm run test` | 项目**无此脚本** | N/A（不存在） |
| E2E | `npm run e2e` | 项目**无此脚本** | N/A（不存在） |
| Commerce 一致性回归 | — | `scripts/v22-commercial-regression.mjs` | **PASS**（61/61） |
| 字典 JSON 校验 | — | 9 语 `i18n/dictionaries/*.json` | **PASS**（9/9 合法） |
| 线上可用性 | — | `/admin/evidence`、`/suppliers`、`/search` | `/suppliers` 正常（页面存在）；**`/admin/evidence` 不存在**；**`/search` 路由亦不存在**（本仓库无搜索页，`Glob app/**/search/**` → 0） |

---

## 8. Git 状态

- 分支：仅 `main`（含 `remotes/origin/main`）；**无其它分支**、**无 stash** → Evidence 相关代码未藏在别处。
- `git diff --check`：**干净**（无空白/冲突标记）。
- 工作区：**100 个文件已 staged、尚未提交**，`+9288 / −571`。内容为 V2.1 CS-16/CS-17/CS-18 与 V2.2 商业规则统一 + SEO 清理（字典、admin、audit、orders、docs 等）。
  - 这是上一轮尝试提交时因上下文超限中断所遗留，**与本任务无关**。
- 本任务**未创建 commit**：规格 §九明确禁止混入 SEO / multilingual / Supplier Profile / 新业务功能，而当前 staged 内容正好属于这些类别；且本任务无任何 evidence-security 变更可以提交。

---

## 9. 未解决事项 / 需要确认

1. **规格归属不明**：`SupplierAssess` 与所述 Evidence 票据子系统不在本机任何项目中。请确认它属于哪个仓库/路径，或是否需要在 FactoryAuditB2B 中**新建**该子系统（后者属于"新增业务功能"，与规格开头"本次不要新增业务功能"冲突，需你改口径）。
2. **规格 §六 目标值冲突**：要求 `Evidence = 0`，而本库存在 4 行真实 Evidence。在未确认这 4 行来源与归属前，不执行删除。
3. **Lint 无法执行**：需安装 eslint 依赖（沙箱内被拦截），或改用沙箱外环境。
4. **未授权响应口径**：项目现用 404 掩蔽（防枚举），规格要求 401/403/404 语义化，二者需择一。
5. **V2.2 未提交**：100 文件仍 staged，等待提交安排。

---

## 10. 决策记录（2026-09-18）

用户裁定：

1. **规格归属** → 「先按现状收口，暂不动」。不新建子系统、不修改代码。
2. **V2.2 提交** → 「先不动」。100 文件保持 staged，不创建 commit。

因此本轮**最终动作 = 0**：无删除、无变更、无提交。本报告即本轮唯一产出。

复启条件（任一满足即可继续）：

- 提供 `SupplierAssess` 真实仓库路径 → 在该仓库执行 TEST 01–08；或
- 明确授权在 FactoryAuditB2B 新建「Evidence 私有存储 + 短时票据下载」（属新增功能，需放宽规格口径）；或
- 提供 Evidence 4 行的来源与归属说明 → 方可评估是否存在需清理的记录。

---

## 附：本轮执行的只读核查命令（可复现）

```bash
# 全仓文本扫描
Grep "__SECTEST_"                        → 0 files
Grep "hasFile|fileKey|public_pending|download-url|downloadUrl"  → 0 files
Grep "SupplierAssess|supplierassess"     → 0 files
Glob "app/**/evidence/**"                → 仅 app/api/admin/audits/[auditId]/evidence/route.ts

# 数据库（只读）
select table_name from information_schema.tables where table_schema='public'
  and (table_name ilike '%evidence%' or ...)      → audit_evidence, supplier_evidence
select count(*) from public.audit_evidence                          → 1
select count(*) from public.supplier_evidence                       → 3
select count(*) ... where to_jsonb(t)::text ilike '%SECTEST%'       → 0, 0

# git
git branch -a   → 仅 main
git stash list  → 空
git diff --check → 干净
git diff --cached --stat → 100 files changed, 9288 insertions(+), 571 deletions(-)
```
