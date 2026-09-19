-- =============================================================================
-- CS-21 / 03_assessment_report_file.sql —— 三标签审核：报告文件引用列
--
-- 执行通道：node scripts/db-apply-sql.mjs supabase/cs21/03_assessment_report_file.sql
-- 性质：只加列（幂等），0 条业务数据。
--
-- 设计要点：
--   1. 报告文件本体存 Supabase 私有 bucket（supplier-docs），与供应商文档同桶但独立路径段
--      assessment_report，不污染 supplier_documents 表的 DOCUMENT_TYPES 白名单语义。
--   2. 本表只存引用（path/name/size），不存文件本体。缺失即 NULL（绝不补 0）。
--   3. 权限继承 01 迁移：REVOKE ALL FROM anon, authenticated，仅 service_role 可访问。
-- =============================================================================

BEGIN;

-- 报告文件引用（标签②③ 平台出具的报告 PDF 等）。全 NULL，缺失不补 0。
ALTER TABLE public.supplier_assessments
  ADD COLUMN IF NOT EXISTS report_file_path text,
  ADD COLUMN IF NOT EXISTS report_file_name text,
  ADD COLUMN IF NOT EXISTS report_file_size int;

COMMENT ON COLUMN public.supplier_assessments.report_file_path IS
  'Supabase 私有 bucket(supplier-docs) 内对象路径，格式 {supplier_id}/assessment_report/{yyyy-mm}/{uuid}-{safeName}。NULL=未上传。';
COMMENT ON COLUMN public.supplier_assessments.report_file_name IS
  '上传时的原始文件名（已 sanitize），用于下载时建议文件名。NULL=未上传。';
COMMENT ON COLUMN public.supplier_assessments.report_file_size IS
  '报告文件字节数。NULL=未上传（绝不补 0）。';

INSERT INTO public.schema_migrations (version, note)
VALUES ('022', 'CS-21: supplier_assessments report_file_path/name/size columns (assessment report file reference, private bucket)')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
