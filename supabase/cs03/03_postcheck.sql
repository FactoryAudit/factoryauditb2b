-- =============================================================================
-- CS-03 / 03_postcheck.sql —— 迁移后只读验证
--
-- 执行位置：Supabase Dashboard → SQL Editor
-- 前置：02_migration.sql 已执行成功
-- 性质：只读。本文件不含任何写操作。
--
-- 重点验证：
--   A. 9 个新列已建、类型正确、nullable、无 DEFAULT
--   B. 5 个新索引已建
--   C. RLS / policy 与迁移前完全一致
--   D. ★ 4 家现有 Supplier 的全部关键字段一字未变（你 §十七 的复核要求）
--   E. 所有表行数与迁移前一致
--   F. 证据表仍为 0 行（不因迁移自动生成任何 Evidence / Document / Audit）
-- =============================================================================


-- =============================================================================
-- A. 9 个新列是否已建（预期 9 行，全部 YES）
-- =============================================================================
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  CASE WHEN c.column_default IS NULL THEN '(无 DEFAULT ✅)' ELSE c.column_default END AS column_default,
  'YES ✅' AS created
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name   = 'suppliers'
  AND c.column_name IN (
    'display_name','address','website','phone','registration_number',
    'source_url','source_type','source_name','discovered_at'
  )
ORDER BY c.column_name;

-- 缺失列检测（预期 0 行）
SELECT w.column_name AS missing_column, 'MISSING ❌' AS status
FROM (VALUES
  ('display_name'),('address'),('website'),('phone'),('registration_number'),
  ('source_url'),('source_type'),('source_name'),('discovered_at')
) AS w(column_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema='public' AND c.table_name='suppliers' AND c.column_name=w.column_name
WHERE c.column_name IS NULL;


-- =============================================================================
-- B. 5 个新索引（预期 5 行）
-- =============================================================================
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='suppliers'
  AND indexname IN ('suppliers_website','suppliers_regno','suppliers_phone','suppliers_geo','suppliers_source')
ORDER BY indexname;

-- 确认没有意外新增 UNIQUE 约束（预期：只有 id / slug 两个）
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='suppliers' AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;


-- =============================================================================
-- C. RLS 与 policy（应与 01_precheck 第 6 段输出完全一致）
-- =============================================================================
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relnamespace='public'::regnamespace
  AND relname IN ('suppliers','supplier_certifications','admin_audit_log')
ORDER BY relname;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('suppliers','supplier_certifications','admin_audit_log')
ORDER BY tablename, policyname;


-- =============================================================================
-- D. ★★ 4 家现有 Supplier 关键字段快照（与 01_precheck 第 8 段逐列比对）
--    必须一字不差。特别是：
--      verification_level  = unverified
--      verification_status = 原 legacy 值（Factory Verified / Document Verified / Identity Verified）
--      audit_status        = 原 legacy 值（Audited 2026-06 / Audited 2026-03 / ...）
--      risk_score / inspection_history / certifications / is_published
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
  updated_at,
  -- 9 个新列对现有 4 行必须全为 NULL
  (display_name || address || website || phone || registration_number ||
   source_url || source_type || source_name) AS new_text_cols_concat,
  discovered_at
FROM public.suppliers
ORDER BY slug;


-- =============================================================================
-- E. 行数（与 01_precheck 第 7 段比对，必须完全一致）
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
-- F. 证据表必须仍为 0 行（迁移绝不自动生成 Evidence / Document / Audit）
-- =============================================================================
SELECT
  'supplier_documents'      AS t, COUNT(*) AS n, CASE WHEN COUNT(*)=0 THEN 'PASS ✅' ELSE 'FAIL ❌' END AS r FROM public.supplier_documents
UNION ALL
SELECT 'supplier_certifications', COUNT(*), CASE WHEN COUNT(*)=0 THEN 'PASS ✅' ELSE 'FAIL ❌' END FROM public.supplier_certifications
UNION ALL
SELECT 'supplier_audits',         COUNT(*), CASE WHEN COUNT(*)=0 THEN 'PASS ✅' ELSE 'FAIL ❌' END FROM public.supplier_audits;


-- =============================================================================
-- G. schema_migrations 版本（预期含 007）
-- =============================================================================
SELECT version, note, applied_at
FROM public.schema_migrations
ORDER BY version;


-- =============================================================================
-- ✅ 以上全部输出请贴回给文哥。
--    文哥比对 D / E / F 三段与 precheck 一致后，才开始写 CS-03 代码。
-- =============================================================================
