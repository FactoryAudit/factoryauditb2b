-- =============================================================================
-- CS-03 / 01_precheck.sql —— 迁移前只读检查
--
-- 执行位置：Supabase Dashboard → SQL Editor
-- 性质：只读。本文件不含任何 INSERT / UPDATE / DELETE / CREATE / ALTER / DROP。
-- 目的：确认现有列、检测新增列冲突、采集默认值/可空性/索引/RLS/行数，
--       并给 4 家现有 Supplier 的关键字段拍快照（供 03_postcheck 逐列比对）。
--
-- 执行后：请把完整输出贴回给文哥。
-- =============================================================================


-- =============================================================================
-- 1. 目标表是否存在
-- =============================================================================
SELECT
  'suppliers 表'                AS item,
  CASE WHEN to_regclass('public.suppliers') IS NOT NULL
       THEN 'EXISTS ✅' ELSE 'MISSING ❌ 停止执行' END AS status;

SELECT
  'supplier_certifications 表'  AS item,
  CASE WHEN to_regclass('public.supplier_certifications') IS NOT NULL
       THEN 'EXISTS ✅' ELSE 'MISSING ❌ 停止执行' END AS status;

SELECT
  'admin_audit_log 表'          AS item,
  CASE WHEN to_regclass('public.admin_audit_log') IS NOT NULL
       THEN 'EXISTS ✅' ELSE 'MISSING ❌ 停止执行' END AS status;


-- =============================================================================
-- 2. CS-03 计划新增的 9 列 —— 冲突检测
--    预期：9 行全部 is_conflict = 'OK 可新增'
--    若出现 'CONFLICT 已存在' → 不要跑 02_migration，先贴结果给文哥
-- =============================================================================
SELECT
  c.column_name                                     AS planned_column,
  CASE WHEN c.column_name IS NULL
       THEN 'OK 可新增 ✅'
       ELSE 'CONFLICT 已存在 ❌ 停止执行' END        AS is_conflict,
  c.data_type                                       AS existing_type,
  c.is_nullable                                     AS existing_nullable,
  c.column_default                                  AS existing_default
FROM (VALUES
  ('display_name'),
  ('address'),
  ('website'),
  ('phone'),
  ('registration_number'),
  ('source_url'),
  ('source_type'),
  ('source_name'),
  ('discovered_at')
) AS want(column_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name   = 'suppliers'
 AND c.column_name  = want.column_name
ORDER BY want.column_name;


-- =============================================================================
-- 3. suppliers 现有全部列（迁移前基线）
-- =============================================================================
SELECT
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'suppliers'
ORDER BY ordinal_position;


-- =============================================================================
-- 4. 现有 CHECK 约束（确认 verification_level / access_tier 未被篡改）
-- =============================================================================
SELECT
  con.conname            AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public' AND rel.relname = 'suppliers'
  AND con.contype = 'c'
ORDER BY con.conname;


-- =============================================================================
-- 5. 现有索引（确认 5 个计划新增的索引名不冲突）
-- =============================================================================
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'suppliers'
ORDER BY indexname;

-- 计划新增索引名冲突检测
SELECT
  i.indexname AS planned_index,
  CASE WHEN i.indexname IS NULL THEN 'OK 可新增 ✅'
       ELSE 'CONFLICT 已存在 ❌' END AS is_conflict
FROM (VALUES
  ('suppliers_website'),
  ('suppliers_regno'),
  ('suppliers_phone'),
  ('suppliers_geo'),
  ('suppliers_source')
) AS want(indexname)
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public' AND i.tablename = 'suppliers' AND i.indexname = want.indexname
ORDER BY want.indexname;


-- =============================================================================
-- 6. RLS 状态与 policy（迁移前后必须完全一致）
-- =============================================================================
SELECT
  relname        AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('suppliers','supplier_certifications','admin_audit_log')
ORDER BY relname;

SELECT
  schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('suppliers','supplier_certifications','admin_audit_log')
ORDER BY tablename, policyname;


-- =============================================================================
-- 7. 行数基线（迁移后必须一字不变）
-- =============================================================================
SELECT 'suppliers'               AS t, COUNT(*) AS n FROM public.suppliers
UNION ALL SELECT 'supplier_evidence',       COUNT(*) FROM public.supplier_evidence
UNION ALL SELECT 'supplier_capabilities',   COUNT(*) FROM public.supplier_capabilities
UNION ALL SELECT 'supplier_documents',      COUNT(*) FROM public.supplier_documents
UNION ALL SELECT 'supplier_certifications', COUNT(*) FROM public.supplier_certifications
UNION ALL SELECT 'supplier_audits',         COUNT(*) FROM public.supplier_audits
UNION ALL SELECT 'admin_audit_log',         COUNT(*) FROM public.admin_audit_log
UNION ALL SELECT 'profiles',                COUNT(*) FROM public.profiles
UNION ALL SELECT 'memberships',             COUNT(*) FROM public.memberships
UNION ALL SELECT 'rfqs',                    COUNT(*) FROM public.rfqs
ORDER BY t;


-- =============================================================================
-- 8. ★ 4 家现有 Supplier 关键字段快照（你 §十七 要求的复核基线）
--    迁移后 03_postcheck 会再跑一次同样的查询，逐列比对必须完全一致。
-- =============================================================================
SELECT
  slug,
  legal_name,
  country_code,
  city,
  verification_level,
  verification_status,
  audit_status,
  risk_score,
  inspection_history,
  certifications,
  access_tier,
  is_published,
  created_at,
  updated_at
FROM public.suppliers
ORDER BY slug;


-- =============================================================================
-- 9. supplier_certifications 的 claim_status CHECK（确认可用值域）
--    预期看到：UNKNOWN / SELF_DECLARED / EVIDENCE_SUBMITTED /
--              EVIDENCE_REVIEWED / VERIFIED / REJECTED / EXPIRED
--    特别注意：没有 SUPPLIER_REPORTED —— CS-03 改用 SELF_DECLARED
-- =============================================================================
SELECT
  con.conname            AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public' AND rel.relname = 'supplier_certifications'
  AND con.contype = 'c'
ORDER BY con.conname;


-- =============================================================================
-- 10. admin_audit_log 是否已有 ip / metadata 列（006 应已建）
--     预期：两列都存在 → CS-03 审计日志无需加列
-- =============================================================================
SELECT
  c.column_name AS wanted_column,
  CASE WHEN c.column_name IS NULL THEN 'MISSING ❌' ELSE 'EXISTS ✅' END AS status
FROM (VALUES ('ip'), ('metadata')) AS want(column_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name   = 'admin_audit_log'
 AND c.column_name  = want.column_name;


-- =============================================================================
-- 11. schema_migrations 现有版本（确认 007 未被占用）
--     预期：001, 002, 003, 004, 005, 006
--     若已含 007 → 说明迁移跑过一次，不要重复跑 02_migration，先贴结果给文哥
-- =============================================================================
SELECT version, note, applied_at
FROM public.schema_migrations
ORDER BY version;


-- =============================================================================
-- ✅ 输出完以上 11 段后，请把全部结果贴回给文哥。
--    文哥确认无 CONFLICT 后，你再执行 02_migration.sql。
-- =============================================================================
