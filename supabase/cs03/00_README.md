# CS-03 — Supplier Ingestion 最小 Schema 扩展

**状态：未执行。等待你按下面的顺序在 Supabase SQL Editor 操作。**

完整方案见：`.workbuddy/artifacts/FACTORYAUDITB2B_CS03_MIGRATION_PLAN.md`

---

## 执行顺序（严格按序，每步把输出贴回给文哥）

| 步骤 | 文件 | 性质 | 预期输出 |
|---|---|---|---|
| ① | `01_precheck.sql` | **只读** | 11 段结果。重点看第 2 段：9 个计划列必须全部 `OK 可新增 ✅` |
| ② | — | — | **停下来**，把输出贴给文哥。文哥确认无 CONFLICT 后再继续 |
| ③ | `02_migration.sql` | 写结构 | `Success. No rows returned`（或 BEGIN/COMMIT 提示） |
| ④ | `03_postcheck.sql` | **只读** | 7 段结果。重点看 D 段：4 家 Supplier 关键字段必须与 ① 的第 8 段**一字不差** |
| ⑤ | — | — | 把输出贴给文哥。比对通过 → 文哥开始写 CS-03 代码 |
| ❌ | `04_rollback.sql` | 写结构 | **不作为正常步骤**，仅在需要回滚时使用 |

---

## 这次做什么

给 `public.suppliers` 加 **9 列**（全部 nullable、无 DEFAULT）+ **5 个普通索引**。

```
display_name          text         展示名
address               text         工厂地址
website               text         官网
phone                 text         电话
registration_number   text         注册号
source_url            text         来源 URL
source_type           text         T1/T2/T3/T4/manual
source_name           text         来源名称
discovered_at         timestamptz  发现时间
```

**不加**：`company_type`（复用已有 `business_type`）、`discovery_task_id`、`website_domain`、`status` 状态机、`created_by`/`updated_by`。
**不加任何 UNIQUE 约束** —— 去重交给应用层 Entity Resolution。

---

## 这次不做什么

- 不删、不改、不重命名任何现有列（22 列全部原样保留）
- 不写任何业务数据（0 条 INSERT/UPDATE/DELETE）
- 不动 RLS / policy
- 不动 `is_published` / `verification_level` 的语义
- 不自动生成任何 Evidence / Document / Audit 记录

**现有 4 家 Supplier 的以下字段必须一字不变**（`03_postcheck.sql` 第 D 段会验证）：
`verification_level` · `verification_status` · `audit_status` · `risk_score` · `inspection_history` · `certifications` · `is_published`

---

## 🔴 两个必须先知道的偏差

**1）`claim_status = 'SUPPLIER_REPORTED'` 不在 CHECK 约束里。**

`supplier_certifications.claim_status` 的合法值是：
`UNKNOWN / SELF_DECLARED / EVIDENCE_SUBMITTED / EVIDENCE_REVIEWED / VERIFIED / REJECTED / EXPIRED`

写 `SUPPLIER_REPORTED` 会抛 `23514 check constraint violated`。
**CS-03 改用 `SELF_DECLARED`**（语义等价：供应商自述），零额外 DDL。

**2）`country_code` 存的不是 ISO alpha-2，是小写 slug。**

生产实测是 `china` / `vietnam`，不是 `CN` / `VN`。`lib/coverage.ts` 和 `STATIC_COUNTRIES` 也全用小写 slug。
改成 ISO alpha-2 会牵动现有数据 + 全部国家落地页 URL + sitemap + 9 语内容，属于独立迁移。
**CS-03 沿用小写 slug 约定，但不设白名单** —— India / Bangladesh / Turkey / Indonesia 等可直接录入，只是没有对应落地页页面。

---

## 常见问题

**Q：执行要多久？**
A：4 行表，`ADD COLUMN ... NULL` 不带 DEFAULT → 只改 catalog，毫秒级。

**Q：会不会锁表？**
A：不会。不带 DEFAULT 的 ADD COLUMN 在 PG 11+ 不需要重写表。

**Q：失败了怎么办？**
A：跑 `04_rollback.sql`。它只删这 9 个新列，现有数据一个字节都不丢。

**Q：为什么要先跑 precheck 再跑 migration？**
A：确认没有列名冲突。如果 `website` 之类已经存在（比如你之前手动加过），migration 的 `IF NOT EXISTS` 会静默跳过，导致代码写入的列和你想的不一样 —— precheck 就是把这个风险前置暴露出来。
