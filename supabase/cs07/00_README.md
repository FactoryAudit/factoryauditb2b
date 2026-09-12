# CS-07 / Phase 1 — Migration 008：`public.leads`

**状态：代码全部就绪，但 ❗未执行、未 commit、未 deploy。等你按下面顺序在 Supabase SQL Editor 操作。**

- 完整方案：`.workbuddy/artifacts/FACTORYAUDITB2B_CS07A_MIGRATION_PLAN.md`
- pre-check 结果（14 段逐段证据）：`.workbuddy/artifacts/FACTORYAUDITB2B_CS07A_PRECHECK_RESULT.md`
- 用户已正式拍板：**22 列 DDL / RLS 仅 2 policy / C8 精确断言（每 CS 落地时同步更新常量）**
  - ⚠️ 基线已前移：CS-08（入驻表证书子表单 + 认证咨询弹窗，18 键 × 9 语）**先**落地，C8 已由 `2648` 改为 **`2666`**。
  - ⇒ 本 CS-07 的 `scripts/apply-cs07-i18n.cjs` 执行后，C8 应从 **`2666` 改为 `2684`**（再 +18 键 × 9 语）；**改断言常量，绝不弱化为 `>2600`**。

---

## 执行顺序（严格按序，每步把输出贴回给文哥）

| 步骤 | 文件 | 性质 | 预期输出 |
|---|---|---|---|
| ① | `01_precheck.sql` | **只读** | 14 段。重点：第 1 段 leads 全部 `NOT EXISTS`；第 4/5/6 段全 `OK 可新增`；第 7/14 段是**唯二**需要你回贴的字面输出 |
| ② | — | — | **停下来**，把 §7（`pg_policies`）与 §14（`role_table_grants`）贴给文哥。文哥核对无 CONFLICT 后再继续 |
| ③ | `02_migration.sql` | 写结构 | `Success. No rows returned` |
| ④ | `03_postcheck.sql` | **只读** | 12 段。重点：**F2 / G2 两个差异检测器必须 0 行**；L 段汇总必须全 `PASS ✅` |
| ⑤ | — | — | 把输出贴给文哥。比对通过 → 文哥开始写 CS-07 业务代码 |
| ❌ | `04_rollback.sql` | 写结构 | **不作为正常步骤**，仅在故障时使用 |
| 🅱 | `05_all_in_one.sql` | 迁移+验证 | **替代 ③+④ 的懒人版**（由 02+03 程序化合并，零漂移）。首次执行建议走 ③④，便于定位问题 |

> `05_all_in_one.sql` 由 `scripts/build-cs07-all-in-one.mjs` 从 `02` + `03` 自动生成。
> 改 DDL 请改 `02_migration.sql` 后重跑该脚本，**不要手改 05**。

---

## 这次做什么

**只新建 1 张表** `public.leads` —— 买家里程线索引 / 供应商入驻申请 / 供应商认领申请的统一记录。

```
id                uuid          PK, default gen_random_uuid()
reference_id      text          NOT NULL UNIQUE  ← LEAD-XXXXXX 对外短号
kind              text          NOT NULL default 'buyer_lead'
                                 buyer_lead | supplier_application | supplier_claim
tool              text          NOT NULL          ← 服务端决定，不依赖 NULL
status            text          NOT NULL default 'new'
                                 new | contacted | quoted | won | lost
email             text          NOT NULL
first_name / company / country / phone                                       text
sourcing          text          ★ CS-07 之前被服务端静默丢弃的三个字段
supplier_name     text          ★
supplier_website  text          ★
message           text
score             int           0–100（越高越强意向，与 risk_score 语义相反）
assigned_to       uuid          FK → profiles(id) ON DELETE SET NULL（当前恒 NULL）
payload           jsonb         ★ 原始提交载荷无损兜底
follow_up_note    text          ← Admin 跟进
followed_up_at    timestamptz   ←
user_id           uuid          FK → profiles(id) ON DELETE SET NULL（游客 NULL）
created_at / updated_at          timestamptz NOT NULL default now()
```

外加：**4 个普通索引**（`status` / `kind` / `created_at DESC` / `email`）· **1 个 trigger**（复用既有 `public.set_updated_at()`）·
**RLS + 恰好 2 条 policy**（`leads_select_self` / `leads_admin_all`）· **显式 REVOKE 收权** · **版本登记 008** · `NOTIFY pgrst`。

---

## 🔴 这次**不做**什么（铁律）

- **不 ALTER** `suppliers` / `rfqs` / `memberships` / `profiles` —— 一列不增、不改、不删
- **不写任何业务数据**：0 条 INSERT（除版本登记一行）/ 0 条 UPDATE / 0 条 DELETE
- **不动任何现有 RLS / policy** —— 只对新建的 `leads` 开 RLS
- **不删 / 不重构 / 不合并 `rfqs`** —— `/api/rfq` 的 POST/GET 与两张表完全原样
- **不改** `lib/rateLimit.ts`（全站共享安全文件 → P1 独立 Change Set）
- **不回填** Resend 历史邮件（邮件正文非结构化，回填必然要"猜"字段 = 伪造数据）
- **不因为收到 `supplier_claim` 就动 Trust**：不碰 `verification_level` / `verification_status` / `audit_status`，不自动建 evidence，不自动 verified

**现有 5 家 Supplier 的信任字段必须一字不变**（`03_postcheck.sql` G2 段会逐字段验证）：
`is_published` · `verification_level` · `verification_status` · `audit_status` · `risk_score`

---

## 🔴 三件必须先知道的事

### 1）`reference_id` 撞号 → **靠应用层自动重试，绝不靠放宽约束**

`leads_reference_id_key` 是 **UNIQUE**，必须保留。`lib/leads.ts::insertLead()` 会：
生成 `LEAD-XXXXXX` → INSERT → 若报 `23505` 且错误指向 `reference_id` 则**换号重试**（最多 5 次）；
每次失败都 `console.warn`；**任何路径都不抛错**（fail-open，邮件照发，线索不会因为落库失败而消失）。
32 字符集 6 位 ≈ **10.7 亿** 空间，5 次重试实际不可能耗尽。

> ⚠️ 顺带记录（本 CS **不改** `/api/rfq`）：`app/api/rfq/route.ts:100` 的注释写「撞上就重试一次」，
> 但代码**实际只 insert 一次**。记 P2，CS-07 在 `lib/leads.ts` 里做对。

### 2）`tool` 是 `NOT NULL` → 三个入口都必须给**明确、稳定**的值

| 入口 | 取值 |
|---|---|
| `/api/lead` | `clamp(lead.tool, 64).trim() \|\| "supplier-risk-calculator"` —— **本次补 `.trim()`**（此前传 `"   "` 会绕过 `\|\|` 兜底） |
| `/api/supplier-register` | 服务端字面量 `"supplier-register"` |
| `/api/supplier-claim` | 服务端字面量 `"supplier-claim"` |

`tool` 为空 = `23502` = **整条线索丢失**（P0-A 那类静默丢失的翻版），靠回归断言拦住。

### 3）为什么必须显式 `REVOKE`（不是多此一举）

Supabase 在 `public` schema 对**新建的表**默认给 `anon` / `authenticated` 授 **ALL** ——
即"建完表什么都不做" = **浏览器可直连写库**。
本仓既有表**从未显式 GRANT/REVOKE 过**（grep 实证 0 命中），所以 `rfqs` 今天对匿名是「可直接 INSERT」的
（`rfqs_insert_anyone ... WITH CHECK (true)`）。`leads` 装的是买家 PII，绝不能复制这个默认行为。

本迁移收权三层：
```
anon           → 全收（连 SELECT 都没有）
authenticated  → 只留 SELECT（供 leads_select_self），写全部收回
service_role   → 完全不动（server route 的唯一写入通道，BYPASSRLS）
```
❓ **「匿名不可写」与「服务端必须能写」是两件事，不矛盾**：`anon` 是浏览器里的公开 key，
`service_role` 只存在于服务端环境变量、从不进浏览器（绝无 `NEXT_PUBLIC_` 前缀）。

---

## 常见问题

**Q：执行要多久？会不会锁表？**
A：新建 1 张空表 + 4 个索引 + 1 个 trigger，毫秒级；表是空的，不涉及重写、不锁现有表。

**Q：失败了怎么办？**
A：整份包在 `BEGIN/COMMIT` 里 —— **报错会自动整体回滚**，不会留半成品，不需要手工跑 `04_rollback.sql`。
`04_rollback.sql` 是为"已成功执行、但事后决定撤销"准备的；它**只删 `leads` 表和 008 版本登记**，现有表一个字节不动。

**Q：跑完 `03_postcheck.sql` 我该看哪几段？**
A：只看 **F2 / G2 / H1 / L** 四段就够 —— 前三段是"预期 0 行 / 全 PASS"的差异检测器，L 段是汇总。
其余段落是留档输出（供文哥逐行比对）。

**Q：为什么要 `NOTIFY pgrst, 'reload schema'`？**
A：PostgREST 缓存 schema，不刷新的话新表在 REST 层读不到，会报 `PGRST205`。

**Q：`01_precheck.sql` 我能不能跳过？**
A：不能。它负责证明"没有同名索引 / 约束 / policy 冲突"，并给 `03_postcheck.sql` 提供比对基线。
其中 **§7（`pg_policies`）与 §14（`role_table_grants`）是唯一无法通过 REST/OpenAPI 在线替代的两段** —— 必须你跑。

---

## 文件清单

| 文件 | 角色 |
|---|---|
| `00_README.md` | 本文件 |
| `01_precheck.sql` | 迁移前只读检查（14 段） |
| `02_migration.sql` | **权威迁移 DDL**（改这里，别改 05） |
| `03_postcheck.sql` | 迁移后只读验证（12 段，含 3 个差异检测器） |
| `04_rollback.sql` | 回滚（非正常步骤） |
| `05_all_in_one.sql` | 由 02+03 程序化合并的一键版 |
| `../../migrations/008_leads.sql` | **与 `02_migration.sql` 逐字节一致**的归档副本（sha256 已核） |

**归档副本的意义**：让 `supabase/migrations/` 目录继续做 catalog 的诚实镜像 ——
CS-03 的 007 当时只落在 `supabase/cs03/`，导致"只看 migrations/ 会误判某列不存在"。本次补上这个缺口。
