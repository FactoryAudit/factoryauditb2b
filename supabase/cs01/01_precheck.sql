-- =============================================================================
-- CS-01 —— 01_precheck.sql（只读，执行迁移【前】跑）
--
-- 目的：把迁移前的生产 schema 与数据量固定下来，作为「有没有丢数据」的对照基准。
-- 用法：整段粘进 Supabase SQL Editor → Run，把结果贴回来存档。
-- 本文件不含任何 DDL / DML，纯 SELECT。
-- =============================================================================

-- ---------- 1. 目标对象是否存在（期望：全部 false）----------
SELECT
  t.table_name,
  (t.table_name IS NOT NULL) AS exists_now
FROM (VALUES
  ('supplier_documents'),
  ('supplier_certifications'),
  ('supplier_audits'),
  ('admin_audit_log'),
  ('certification_program_alias'),
  ('schema_migrations')
) AS t(table_name)
LEFT JOIN information_schema.tables it
  ON it.table_name = t.table_name AND it.table_schema = 'public'
ORDER BY 1;

-- ---------- 2. suppliers 的核验相关列（期望：verification_level 不存在）----------
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'suppliers'
  AND column_name IN (
    'verification_level','verification_status','audit_status',
    'certifications','risk_score','inspection_history','access_tier','is_published'
  )
ORDER BY column_name;

-- ---------- 3. 迁移前数据计数（迁移后必须一致）----------
SELECT 'suppliers'             AS tbl, COUNT(*) AS n FROM public.suppliers
UNION ALL SELECT 'supplier_evidence',     COUNT(*) FROM public.supplier_evidence
UNION ALL SELECT 'supplier_capabilities', COUNT(*) FROM public.supplier_capabilities
UNION ALL SELECT 'profiles',              COUNT(*) FROM public.profiles
UNION ALL SELECT 'memberships',           COUNT(*) FROM public.memberships
UNION ALL SELECT 'rfqs',                  COUNT(*) FROM public.rfqs
UNION ALL SELECT 'saved_suppliers',       COUNT(*) FROM public.saved_suppliers
UNION ALL SELECT 'profile_views',         COUNT(*) FROM public.profile_views
UNION ALL SELECT 'rfq_matches',           COUNT(*) FROM public.rfq_matches
UNION ALL SELECT 'stripe_events',         COUNT(*) FROM public.stripe_events
ORDER BY 1;

-- ---------- 4. 现有 4 家的 legacy 声明（迁移后**不得**据此生成证据/审核记录）----------
SELECT slug, verification_status, audit_status, certifications, risk_score
FROM public.suppliers
ORDER BY slug;

-- ---------- 5. 现有 RLS 状态（期望：全部 true）----------
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY 1;

-- ---------- 6. 现有 policy 清单 ----------
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ---------- 7. Storage bucket（期望：迁移前不存在 / 或未建）----------
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'supplier-docs';
