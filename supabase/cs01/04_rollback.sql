-- =============================================================================
-- CS-01 —— 04_rollback.sql（仅在需要回退时执行）
--
-- ⚠️ 只读本文件不会有任何影响。执行才会删结构。
-- ⚠️ 006 只加列不改数据，回滚不会丢业务数据（suppliers / supplier_evidence 等
--    一行都不会动）。但 supplier_certifications / supplier_audits /
--    supplier_documents 若已录入数据，DROP TABLE 会连带删除 —— 执行前先确认
--    这三张表是空表。
--
-- 建议顺序：先跑下面的「安全确认」，确认 3 张业务表都是 0 行再回滚。
-- =============================================================================

-- ---------- 0. 安全确认（先跑这段）----------
SELECT 'supplier_documents' AS tbl, COUNT(*) AS n FROM public.supplier_documents
UNION ALL SELECT 'supplier_certifications', COUNT(*) FROM public.supplier_certifications
UNION ALL SELECT 'supplier_audits',         COUNT(*) FROM public.supplier_audits
UNION ALL SELECT 'admin_audit_log',         COUNT(*) FROM public.admin_audit_log;
-- 只有全部为 0 时才继续往下执行。

-- ---------- 1. 回滚 006（只删 006 新增的东西，保留 004/005）----------
ALTER TABLE supplier_certifications DROP COLUMN IF EXISTS display_name;
ALTER TABLE supplier_certifications DROP COLUMN IF EXISTS certification_body;
ALTER TABLE supplier_certifications DROP COLUMN IF EXISTS certificate_number;
ALTER TABLE supplier_certifications DROP COLUMN IF EXISTS claim_status;
ALTER TABLE supplier_certifications DROP COLUMN IF EXISTS evidence_status;
ALTER TABLE supplier_certifications DROP COLUMN IF EXISTS source_url;
ALTER TABLE supplier_certifications DROP COLUMN IF EXISTS source_type;
ALTER TABLE supplier_certifications DROP COLUMN IF EXISTS last_checked_at;

ALTER TABLE supplier_documents DROP COLUMN IF EXISTS source_url;
ALTER TABLE supplier_documents DROP COLUMN IF EXISTS document_reference;
ALTER TABLE supplier_documents DROP COLUMN IF EXISTS review_status;
ALTER TABLE supplier_documents DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE supplier_documents DROP COLUMN IF EXISTS reviewed_by;

ALTER TABLE supplier_audits DROP COLUMN IF EXISTS audit_firm;
ALTER TABLE supplier_audits DROP COLUMN IF EXISTS scope;
ALTER TABLE supplier_audits DROP COLUMN IF EXISTS status;
ALTER TABLE supplier_audits DROP COLUMN IF EXISTS source_url;
ALTER TABLE supplier_audits DROP COLUMN IF EXISTS evidence_id;

ALTER TABLE admin_audit_log DROP COLUMN IF EXISTS ip;
ALTER TABLE admin_audit_log DROP COLUMN IF EXISTS metadata;

-- ⚠️ 顺序不能反：必须先 DELETE 再 DROP，否则 DROP 之后 DELETE 会报
--    "relation public.schema_migrations does not exist"。
DELETE FROM public.schema_migrations WHERE version IN ('004','005','006');

DROP TABLE IF EXISTS public.certification_program_alias;
DROP TABLE IF EXISTS public.schema_migrations;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- ---------- 2. 完整回退（连 004/005 一起撤，回到 CS-01 之前）----------
-- 只有在上一步不够、需要彻底回到 CS-01 之前时才执行。
-- ⚠️ 会删除 4 张表 + suppliers.verification_level 列 + storage bucket。
--    suppliers / supplier_evidence / supplier_capabilities 等既有数据不受影响。
-- =============================================================================
-- DROP TABLE IF EXISTS public.supplier_documents;
-- DROP TABLE IF EXISTS public.supplier_certifications;
-- DROP TABLE IF EXISTS public.supplier_audits;
-- DROP TABLE IF EXISTS public.admin_audit_log;
-- ALTER TABLE public.suppliers DROP COLUMN IF EXISTS verification_level;
-- DELETE FROM storage.buckets WHERE id = 'supplier-docs';
-- NOTIFY pgrst, 'reload schema';
