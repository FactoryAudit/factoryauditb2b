-- =============================================================================
-- CS-02C G3 · POSTCHECK（只读）—— 迁移后逐项核验
-- 跑法：node scripts/db-apply-sql.mjs supabase/cs02c/03_postcheck.sql --read-only
-- =============================================================================

-- 1. 新 7 列存在且类型正确（期望 7 行全 PASS）
SELECT column_name,
       data_type,
       is_nullable,
       CASE WHEN is_nullable = 'YES' THEN 'PASS ✅' ELSE 'FAIL ❌ 不可空' END AS nullable_ok
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'rfqs'
  AND column_name IN ('industry_code','certifications_req','oem_required',
                      'target_market','incoterm','source_path','locale')
ORDER BY column_name;

-- 2. 总列数（12 → 19）
SELECT COUNT(*) AS column_count FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'rfqs';

-- 3. 行数不变（应为 1，与 precheck 一致）
SELECT COUNT(*) AS rfq_rows FROM public.rfqs;

-- 4. 既有行逐字段与 precheck 第 3 步比对（期望逐字一致）
SELECT * FROM public.rfqs ORDER BY created_at;

-- 5. 新索引就位，且旧索引一个不少
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'rfqs'
ORDER BY indexname;

-- 6. RLS policy 未被改动（逐行与 precheck 第 5 步比对）
SELECT policyname, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'rfqs'
ORDER BY policyname;

-- 7. CHECK 约束未变（status 4 值域）
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.rfqs'::regclass
ORDER BY conname;

-- 8. ACL 未变
SELECT grantee, privilege_type
FROM pg_class c, aclexplode(c.relacl) a
WHERE c.relname = 'rfqs' AND c.relnamespace = 'public'::regnamespace
ORDER BY grantee, privilege_type;
