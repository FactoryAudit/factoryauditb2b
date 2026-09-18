-- =============================================================================
-- CS-16 / 03_postcheck.sql —— 只读核验迁移结果
-- 执行：node scripts/db-apply-sql.mjs --read-only supabase/cs16/03_postcheck.sql
-- 期望：每段全部返回 true / 期望行数。
-- =============================================================================

-- 1. suppliers 13 个新列是否到位
SELECT c.column_name, true AS ok
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'suppliers'
  AND c.column_name IN (
    'province','contact_person','contact_email','whatsapp','company_description',
    'authorized_at','authorized_by','consent_version','consent_ip','consent_user_agent',
    'updated_by','unpublished_at','unpublished_by'
  )
ORDER BY c.column_name;

-- 2. supplier_consents 表是否存在
SELECT 'supplier_consents' AS tbl,
       EXISTS (
         SELECT 1 FROM information_schema.tables t
         WHERE t.table_schema = 'public' AND t.table_name = 'supplier_consents'
       ) AS exists_;

-- 3. supplier_consents RLS 是否开启
SELECT c.relname AS tbl, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'supplier_consents';

-- 4. supplier_consents SELECT policy 是否存在
SELECT policyname AS policy, true AS ok
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'supplier_consents';

-- 5. admin_audit_log 新列是否到位
SELECT c.column_name, true AS ok
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'admin_audit_log'
  AND c.column_name IN ('ip_address','notes')
ORDER BY c.column_name;
