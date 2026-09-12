-- =============================================================================
-- CS-07 / 04_rollback.sql —— 回滚 Migration 008
--
-- ⚠️ 这不是正常执行步骤。仅在以下情况才用：
--     - 02_migration.sql 执行后 03_postcheck.sql 发现 FAIL ❌ / MISMATCH ❌
--     - CS-07 整体方案被推翻
--
-- 前置：CS-07 的写入代码（lib/leads.ts 及三个 route）必须先下线/回退，
--       否则下次请求会因表不存在报 PGRST205。
--
-- -----------------------------------------------------------------------------
-- 数据安全说明
-- -----------------------------------------------------------------------------
--   本回滚**只删除本次迁移新建的对象**：
--     · 表 public.leads（及其索引 / 约束 / trigger / policy）
--     · schema_migrations 里的 '008' 一行
--
--   现有业务表（suppliers / rfqs / memberships / profiles / …）**一个字节都不动**：
--     · 0 条 ALTER TABLE（迁移里从未改过它们）
--     · 0 条 UPDATE（迁移里从未改过数据）
--     · 0 条 policy 变更（迁移只对 leads 开 RLS）
--
--   ⇒ 回滚的唯一代价是：迁移之后新写入的 leads 记录会丢失。
--     若已上线并产生了真实线索，**先导出**：SQL Editor 里跑
--       SELECT * FROM public.leads ORDER BY created_at;
--     复制结果（或改用 Dashboard → Table Editor → Export CSV）后再执行本文件。
--
--   ⚠️ 另外：02_migration.sql 整份包在 BEGIN/COMMIT 里，
--      若它在执行时报错，Postgres 已**自动整体回滚**，不需要手工跑本文件。
--      本文件是为"已成功执行、但事后决定撤销"准备的。
-- =============================================================================

BEGIN;

-- ---------- 1. 删除 leads（DROP TABLE 会一并带走其索引 / 约束 / trigger / policy） ----------
DROP TABLE IF EXISTS public.leads;

-- ---------- 2. 版本登记回滚 ----------
DELETE FROM public.schema_migrations WHERE version = '008';

-- ---------- 3. 刷新 PostgREST schema cache ----------
NOTIFY pgrst, 'reload schema';

COMMIT;


-- =============================================================================
-- 回滚后自检（三段，预期全部 PASS ✅）
-- =============================================================================

-- 自检 1：leads 表已消失（预期 NOT EXISTS ✅）
SELECT 'leads 表' AS check_item,
       CASE WHEN to_regclass('public.leads') IS NULL
            THEN 'NOT EXISTS ✅ 回滚成功'
            ELSE 'STILL EXISTS ❌' END AS status;

-- 自检 2：leads 相关对象已全部消失（预期 0 行）
SELECT '残留索引'   AS kind, indexname AS name FROM pg_indexes
  WHERE schemaname='public' AND indexname LIKE 'leads%'
UNION ALL
SELECT '残留约束', conname FROM pg_constraint
  WHERE connamespace='public'::regnamespace AND conname LIKE 'leads_%'
UNION ALL
SELECT '残留 policy', policyname FROM pg_policies
  WHERE schemaname='public' AND policyname LIKE 'leads%'
UNION ALL
SELECT '残留 trigger', tgname FROM pg_trigger
  WHERE tgname LIKE 'leads%' AND NOT tgisinternal;

-- 自检 3：现有业务表完全不受影响（预期 suppliers 5 / profiles 4 / rfqs 1 / schema_migrations 7）
SELECT 'suppliers'         AS t, COUNT(*) AS n FROM public.suppliers
UNION ALL SELECT 'profiles',            COUNT(*) FROM public.profiles
UNION ALL SELECT 'memberships',         COUNT(*) FROM public.memberships
UNION ALL SELECT 'rfqs',                COUNT(*) FROM public.rfqs
UNION ALL SELECT 'supplier_capabilities', COUNT(*) FROM public.supplier_capabilities
UNION ALL SELECT 'supplier_evidence',   COUNT(*) FROM public.supplier_evidence
UNION ALL SELECT 'schema_migrations',   COUNT(*) FROM public.schema_migrations
ORDER BY t;

-- 自检 4：5 家供应商信任字段仍与迁移前快照一致（预期 0 行差异）
SELECT w.slug, 'MISMATCH ❌' AS status
FROM (VALUES
  ('dongguan-plastic-molding',       true,  'unverified', 'Identity Verified', 'Not yet audited', 56),
  ('guangzhou-textile-factory',      true,  'unverified', 'Document Verified', 'Audited 2026-03', 72),
  ('ho-chi-minh-garment',            true,  'unverified', 'Identity Verified', 'Pending',         59),
  ('nanjing-mxcomm',                 false, 'unverified', NULL,                NULL,              NULL),
  ('shenzhen-precision-electronics', true,  'unverified', 'Factory Verified',  'Audited 2026-06', 88)
) AS w(slug, want_pub, want_vl, want_vs, want_as, want_rs)
JOIN public.suppliers s ON s.slug = w.slug
WHERE s.is_published        IS DISTINCT FROM w.want_pub
   OR s.verification_level  IS DISTINCT FROM w.want_vl
   OR s.verification_status IS DISTINCT FROM w.want_vs
   OR s.audit_status        IS DISTINCT FROM w.want_as
   OR s.risk_score          IS DISTINCT FROM w.want_rs;
