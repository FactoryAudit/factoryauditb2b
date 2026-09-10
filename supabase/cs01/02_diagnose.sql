-- =============================================================================
-- CS-01 —— 02_diagnose.sql（安全诊断 · 只读 · 随时可跑）
--
-- 与 03_postcheck.sql 的区别：本文件全部用 to_regclass() / information_schema，
-- 不硬引用任何表 → **即使表不存在也不会报 42P01**，会安静地返回 false / NULL。
-- 用途：迁移中途卡住时，判断「到底建到哪一步了」。
-- =============================================================================

-- ---------- 1. 6 个目标对象是否存在（true = 已建；false = 未建）----------
SELECT
  to_regclass('public.supplier_documents')          IS NOT NULL AS documents,
  to_regclass('public.supplier_certifications')     IS NOT NULL AS certifications,
  to_regclass('public.supplier_audits')             IS NOT NULL AS audits,
  to_regclass('public.admin_audit_log')             IS NOT NULL AS audit_log,
  to_regclass('public.certification_program_alias') IS NOT NULL AS cert_alias,
  to_regclass('public.schema_migrations')           IS NOT NULL AS migrations;

-- ---------- 2. suppliers.verification_level 列是否已加 ----------
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'suppliers'
    AND column_name  = 'verification_level'
) AS has_verification_level;

-- ---------- 3. storage bucket 是否已建、是否私有 ----------
--   public = false 才是正确结果；查不到 = 005 没跑
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'supplier-docs';

-- ---------- 4. 迁移进度（schema_migrations 里记到哪一步）----------
--   若 migrations = false，这一节会报 42P01，属正常，跳过即可
SELECT version, applied_at FROM public.schema_migrations ORDER BY version;

-- =============================================================================
-- 结果怎么读：
--   documents/certifications/audits/audit_log 全 true  → 004 已成功
--   has_verification_level = true                      → 004 已成功
--   bucket public = false                              → 005 已成功
--   cert_alias = true 且 migrations = true             → 006 已成功
--   任意一项 false                                     → 对应那个脚本没跑成功，重跑它
-- =============================================================================
