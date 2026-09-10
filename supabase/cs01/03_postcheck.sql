-- =============================================================================
-- CS-01 —— 03_postcheck.sql（只读，执行迁移【后】跑）
--
-- 目的：实测表/列/索引/约束/RLS 是否真的建出来，以及数据有没有丢。
-- 不靠假设，一切以这里的输出为准。整段粘进 SQL Editor → Run。
-- =============================================================================

-- ---------- 1. 表是否存在 + 行数（期望：4 张新表均为 0 行）----------
--    ⚠️ 修复：之前用 (SELECT COUNT(*) FROM public.X) 硬引用，若表不存在整段 42P01。
--    现在用 CASE WHEN to_regclass 守护，表不存在时返回 NULL，不报错。
SELECT 'supplier_documents' AS tbl,
       to_regclass('public.supplier_documents') IS NOT NULL AS exists,
       CASE WHEN to_regclass('public.supplier_documents') IS NOT NULL
            THEN (SELECT COUNT(*) FROM public.supplier_documents) END AS n
UNION ALL SELECT 'supplier_certifications',
       to_regclass('public.supplier_certifications') IS NOT NULL,
       CASE WHEN to_regclass('public.supplier_certifications') IS NOT NULL
            THEN (SELECT COUNT(*) FROM public.supplier_certifications) END
UNION ALL SELECT 'supplier_audits',
       to_regclass('public.supplier_audits') IS NOT NULL,
       CASE WHEN to_regclass('public.supplier_audits') IS NOT NULL
            THEN (SELECT COUNT(*) FROM public.supplier_audits) END
UNION ALL SELECT 'admin_audit_log',
       to_regclass('public.admin_audit_log') IS NOT NULL,
       CASE WHEN to_regclass('public.admin_audit_log') IS NOT NULL
            THEN (SELECT COUNT(*) FROM public.admin_audit_log) END
UNION ALL SELECT 'certification_program_alias',
       to_regclass('public.certification_program_alias') IS NOT NULL,
       CASE WHEN to_regclass('public.certification_program_alias') IS NOT NULL
            THEN (SELECT COUNT(*) FROM public.certification_program_alias) END
UNION ALL SELECT 'schema_migrations',
       to_regclass('public.schema_migrations') IS NOT NULL,
       CASE WHEN to_regclass('public.schema_migrations') IS NOT NULL
            THEN (SELECT COUNT(*) FROM public.schema_migrations) END
ORDER BY 1;

-- ---------- 2. suppliers.verification_level（期望：存在，且 4 家全是 unverified）----------
SELECT verification_level, COUNT(*) AS n
FROM public.suppliers
GROUP BY verification_level
ORDER BY 1;

-- ---------- 3. 新增列是否真的建出来 ----------
SELECT table_name, column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'supplier_certifications' AND column_name IN
      ('display_name','certification_body','certificate_number','claim_status','evidence_status','source_url','source_type','last_checked_at'))
    OR (table_name = 'supplier_documents' AND column_name IN
      ('source_url','document_reference','review_status','reviewed_at','reviewed_by'))
    OR (table_name = 'supplier_audits' AND column_name IN
      ('audit_firm','scope','status','source_url','evidence_id'))
    OR (table_name = 'admin_audit_log' AND column_name IN ('ip','metadata'))
    OR (table_name = 'suppliers' AND column_name = 'verification_level')
  )
ORDER BY table_name, column_name;

-- ---------- 4. 索引（期望：下列索引全部存在）----------
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'documents_supplier','documents_type','documents_review','documents_expiry','documents_review_status',
    'certifications_supplier','certifications_program','certifications_status','certifications_expiry',
    'certifications_claim_status','certifications_evidence_status','certifications_source_type','certifications_last_checked',
    'audits_supplier','audits_date','audits_type','audits_review','audits_status','audits_audit_firm','audits_evidence_id',
    'audit_log_actor','audit_log_target','audit_log_recent',
    'cert_alias_code','cert_alias_mapped',
    'suppliers_verification_level'
  )
ORDER BY tablename, indexname;

-- ---------- 5. CHECK 约束（期望：新列上的约束都在）----------
SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE contype = 'c'
  AND conrelid::regclass::text IN (
    'supplier_certifications','supplier_documents','supplier_audits','suppliers'
  )
  AND (conname ILIKE '%claim_status%' OR conname ILIKE '%evidence_status%'
       OR conname ILIKE '%review_status%' OR conname ILIKE '%status%'
       OR conname ILIKE '%verification_level%')
ORDER BY 1, 2;

-- ---------- 6. 外键 ----------
SELECT conrelid::regclass AS tbl, conname,
       pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid::regclass::text IN (
    'supplier_documents','supplier_certifications','supplier_audits','admin_audit_log'
  )
ORDER BY 1, 2;

-- ---------- 7. RLS（期望：新表全部 true）----------
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'supplier_documents','supplier_certifications','supplier_audits',
    'admin_audit_log','certification_program_alias','schema_migrations'
  )
ORDER BY 1;

-- ---------- 8. policy（期望：新表都有 admin_all；公开侧只有 certified/verified 可读）----------
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'supplier_documents','supplier_certifications','supplier_audits',
    'admin_audit_log','certification_program_alias','schema_migrations'
  )
ORDER BY tablename, policyname;

-- ---------- 9. 数据有没有丢（必须与 precheck 完全一致）----------
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

-- ---------- 10. 映射表：哪些没映射上（期望 OEKO-TEX 在列）----------
SELECT display_name, program_code, mapped
FROM public.certification_program_alias
WHERE mapped = false
ORDER BY display_name;

-- ---------- 11. Storage bucket（期望：存在且 public = false）----------
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'supplier-docs';

-- ---------- 12. schema_migrations ----------
SELECT version, applied_at, note
FROM public.schema_migrations
ORDER BY version;
