# CS-01 执行顺序（Supabase SQL Editor）

DDL 无法通过 PostgREST 执行，必须由管理员在 **Supabase Dashboard → SQL Editor** 手工运行。

严格按编号执行，每步都要看输出：

| 步骤 | 文件 | 性质 | 期望 |
|---|---|---|---|
| 1 | `01_precheck.sql` | 只读 | 6 个目标对象全 `false`；`verification_level` 不存在；记录数据量基准 |
| 2 | `supabase/migrations/004_documents.sql` | **写入** | 4 表 + `suppliers.verification_level` |
| 3 | `supabase/migrations/005_storage.sql` | **写入** | 私有 bucket `supplier-docs` |
| 4 | `supabase/migrations/006_compliance_fields.sql` | **写入** | 补齐 §6/§7/§8/§9 字段 + 映射表 + 版本表 |
| 5 | `03_postcheck.sql` | 只读 | 表/列/索引/约束/RLS 全在；数据量与第 1 步一致 |
| 6 | `04_rollback.sql` | 仅在需要回退时 | — |

## 关键提醒

1. **第 4 步结尾自带 `NOTIFY pgrst, 'reload schema';`**。没刷新 schema cache，
   PostgREST 会继续报 `PGRST205 Could not find the table`。
2. **迁移不写任何业务数据**。第 5 步里 4 张新表应当全部是 **0 行**。
   如果出现非 0，说明有人/有脚本插了数据 —— 必须查清来源。
3. **绝不从 `suppliers.verification_status` / `audit_status` 反向生成证据或审核记录**。
   4 家供应商的 `verification_level` 迁移后必须全是 `unverified`。
4. `OEKO-TEX` 在映射表里是 `mapped = false`（`STATIC_PROGRAMS` 里没有它）。
   这不是遗漏，是**故意不猜测**。要映射需先在 `lib/staticData.ts` 补 taxonomy。
