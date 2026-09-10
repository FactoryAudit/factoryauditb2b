-- =============================================================================
-- CS-03 / 05_all_in_one.sql —— 合并迁移 + 只读验证（一次性粘贴）
--
-- 执行位置：Supabase Dashboard → SQL Editor → New query → 粘贴本文件 → Run
-- 性质：前半段改结构（DDL，BEGIN/COMMIT），后半段只读验证（SELECT，零写）
-- 不执行 04_rollback.sql
-- =============================================================================


-- =============================================================================
-- 第一部分：迁移（只加结构，0 条业务数据 INSERT/UPDATE/DELETE）
-- 铁律：全部 ADD COLUMN ... NULL 无 DEFAULT；不加任何 UNIQUE；不删不改现有 22 列
-- =============================================================================
BEGIN;

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS display_name        text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address             text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website             text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone               text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source_url          text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source_type         text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source_name         text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS discovered_at       timestamptz;

COMMENT ON COLUMN suppliers.display_name IS '展示名。与 legal_name 不同时填写。NULL = 未填写，前端回落 legal_name。';
COMMENT ON COLUMN suppliers.address IS '工厂地址。去重维度之一。NULL = 未知，不参与去重。';
COMMENT ON COLUMN suppliers.website IS '官网。去重第一优先级。NULL = 未知。';
COMMENT ON COLUMN suppliers.phone IS '联系电话。去重维度之一（末 9 位）。NULL = 未知。';
COMMENT ON COLUMN suppliers.registration_number IS '营业执照号 / 公司注册号。与 country_code 组合去重。NULL = 未知。';
COMMENT ON COLUMN suppliers.source_url IS '来源 URL。只说明"这条信息从哪来"，不等同于 Verified Evidence。';
COMMENT ON COLUMN suppliers.source_type IS '来源类型：T1 官方登记 / T2 公司自有渠道 / T3 B2B 平台 / T4 公开搜索 / manual 人工录入。';
COMMENT ON COLUMN suppliers.source_name IS '来源名称，如 "Alibaba" / "Manual admin entry"。';
COMMENT ON COLUMN suppliers.discovered_at IS '发现时间（不同于 created_at 入库时间）。现有 4 家保持 NULL —— 不伪造发现时间。';

CREATE INDEX IF NOT EXISTS suppliers_website  ON suppliers(website)             WHERE website IS NOT NULL;
CREATE INDEX IF NOT EXISTS suppliers_regno    ON suppliers(registration_number) WHERE registration_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS suppliers_phone    ON suppliers(phone)               WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS suppliers_geo      ON suppliers(country_code, city);
CREATE INDEX IF NOT EXISTS suppliers_source   ON suppliers(source_type)         WHERE source_type IS NOT NULL;

INSERT INTO schema_migrations (version, note)
VALUES ('007', 'CS-03: supplier ingestion fields (display_name/address/website/phone/registration_number/source_*/discovered_at) + 5 partial indexes, no UNIQUE added')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;


-- =============================================================================
-- 第二部分：只读验证（把下面所有结果全部复制贴回给文哥）
-- =============================================================================

-- A. 9 个新列是否已建（预期 9 行，全部 YES）
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

-- B. 5 个新索引（预期 5 行）
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='suppliers'
  AND indexname IN ('suppliers_website','suppliers_regno','suppliers_phone','suppliers_geo','suppliers_source')
ORDER BY indexname;

-- 确认没有意外新增 UNIQUE（预期：只有 id / slug）
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='suppliers' AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;

-- C. RLS 与 policy（应和迁移前一致）
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

-- D. ★★ 4 家现有 Supplier 关键字段快照（必须一字不差）
SELECT
  slug, legal_name, country_code, city,
  verification_level, verification_status, audit_status,
  risk_score, inspection_history, certifications,
  access_tier, is_published, created_at, updated_at,
  (display_name || address || website || phone || registration_number ||
   source_url || source_type || source_name) AS new_text_cols_concat,
  discovered_at
FROM public.suppliers
ORDER BY slug;

-- E. 行数（必须和迁移前完全一致）
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

-- F. 证据表必须仍为 0 行
SELECT
  'supplier_documents'      AS t, COUNT(*) AS n, CASE WHEN COUNT(*)=0 THEN 'PASS ✅' ELSE 'FAIL ❌' END AS r FROM public.supplier_documents
UNION ALL
SELECT 'supplier_certifications', COUNT(*), CASE WHEN COUNT(*)=0 THEN 'PASS ✅' ELSE 'FAIL ❌' END FROM public.supplier_certifications
UNION ALL
SELECT 'supplier_audits',         COUNT(*), CASE WHEN COUNT(*)=0 THEN 'PASS ✅' ELSE 'FAIL ❌' END FROM public.supplier_audits;

-- G. schema_migrations 版本（预期含 007）
SELECT version, note, applied_at
FROM public.schema_migrations
ORDER BY version;
