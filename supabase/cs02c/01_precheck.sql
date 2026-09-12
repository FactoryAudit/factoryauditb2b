-- =============================================================================
-- CS-02C G3 · PRECHECK（只读）—— rfqs 行业化 7 列迁移前的基线快照
-- 跑法：node scripts/db-apply-sql.mjs supabase/cs02c/01_precheck.sql --read-only
-- =============================================================================

-- 1. 当前列清单（迁移前 rfqs 应为 12 列）
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'rfqs'
ORDER BY ordinal_position;

-- 2. 行数基线（迁移后必须完全一致；CS-02C 时点为 1 行）
SELECT COUNT(*) AS rfq_rows FROM public.rfqs;

-- 3. 既有行全文（迁移后逐字段比对，任何值都不许变）
SELECT * FROM public.rfqs ORDER BY created_at;

-- 4. 现有索引（迁移后应多出 rfqs_industry，其余不变）
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'rfqs'
ORDER BY indexname;

-- 5. 现有 RLS policy（迁移后必须逐行一致）
SELECT policyname, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'rfqs'
ORDER BY policyname;

-- 6. 现有 CHECK 约束（status 的 4 值域必须保持不变）
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.rfqs'::regclass
ORDER BY conname;

-- 7. ACL 基线（aclexplode 才是真值；迁移后必须逐行一致）
SELECT grantee, privilege_type
FROM pg_class c, aclexplode(c.relacl) a
WHERE c.relname = 'rfqs' AND c.relnamespace = 'public'::regnamespace
ORDER BY grantee, privilege_type;
