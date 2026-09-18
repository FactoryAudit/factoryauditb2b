-- =============================================================================
-- CS-20 / 03_postcheck.sql —— 只读结构核验
--
-- 执行通道：node scripts/db-apply-sql.mjs --read-only --file supabase/cs20/03_postcheck.sql
-- 或：node scripts/db-apply-sql.mjs --read-only --sql "$(cat supabase/cs20/03_postcheck.sql)"
-- 性质：**纯 SELECT，零写入**。每条都返回 check_name / result / detail 三列。
--
-- 🔴 ACL 必须用 aclexplode(relacl) —— role_table_grants 对新建表常返空，
--    据其判「已收权」是**假 PASS**（CS-16 踩过）。
-- =============================================================================


-- 1) 列清单（应 15 列）
SELECT
  'columns' AS check_name,
  count(*)::text || ' cols' AS result,
  string_agg(column_name || ':' || data_type || CASE WHEN is_nullable = 'NO' THEN '!' ELSE '' END, ', ' ORDER BY ordinal_position) AS detail
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'supplier_reports'

UNION ALL

-- 2) 约束清单（应含 pkey / supplier_id UNIQUE / 4 条 CHECK / fkey）
SELECT
  'constraints',
  count(*)::text || ' constraints',
  string_agg(conname || ' = ' || pg_get_constraintdef(oid), ' | ' ORDER BY conname)
FROM pg_constraint
WHERE conrelid = 'public.supplier_reports'::regclass

UNION ALL

-- 3) RLS 状态与策略数（应 enabled = true、策略恰 1 条且为 SELECT/is_admin）
SELECT
  'rls',
  'enabled=' || c.relrowsecurity::text || ' forced=' || c.relforcerowsecurity::text || ' policies=' || (
    SELECT count(*)::text FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'supplier_reports'
  ),
  coalesce((
    SELECT string_agg(p.policyname || ' [' || p.cmd || ' to ' || array_to_string(p.roles, ',') || '] using=' || coalesce(p.qual, '-'), ' | ')
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'supplier_reports'
  ), 'NO POLICY')
FROM pg_class c
WHERE c.oid = 'public.supplier_reports'::regclass

UNION ALL

-- 4) 🔴 真实 ACL（aclexplode）—— anon 必须零权限、authenticated 只有 SELECT、service_role 保留写
SELECT
  'acl',
  'anon=' || coalesce((
    SELECT string_agg(DISTINCT a.privilege_type, ',' ORDER BY a.privilege_type)
    FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    JOIN pg_roles r ON r.oid = a.grantee WHERE r.rolname = 'anon'
  ), 'NONE')
  || ' | authenticated=' || coalesce((
    SELECT string_agg(DISTINCT a.privilege_type, ',' ORDER BY a.privilege_type)
    FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    JOIN pg_roles r ON r.oid = a.grantee WHERE r.rolname = 'authenticated'
  ), 'NONE')
  || ' | service_role=' || coalesce((
    SELECT count(*)::text || ' privs'
    FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    JOIN pg_roles r ON r.oid = a.grantee WHERE r.rolname = 'service_role'
  ), '0'),
  '期望 anon 零权限 / authenticated 仅查询 / service_role 保留读写'
FROM pg_class c
WHERE c.oid = 'public.supplier_reports'::regclass

UNION ALL

-- 5) updated_at 触发器（应恰 1 条，指向 public.set_updated_at）
SELECT
  'trigger',
  count(*)::text || ' trigger(s)',
  coalesce(string_agg(t.tgname || ' -> ' || p.proname, ' | '), 'NONE')
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.supplier_reports'::regclass AND NOT t.tgisinternal

UNION ALL

-- 6) 迁移版本登记
SELECT
  'schema_migrations',
  count(*)::text || ' row(s)',
  coalesce(string_agg(version || ' :: ' || note, ' | '), 'NONE')
FROM public.schema_migrations WHERE version = '020'

UNION ALL

-- 7) 行数（应为 0：本次只建结构）
SELECT
  'row_count',
  count(*)::text || ' rows',
  '建表后应为 0（迁移不含业务数据）'
FROM public.supplier_reports

UNION ALL

-- 8) 索引（UNIQUE 约束会自带一个）
SELECT
  'indexes',
  count(*)::text || ' index(es)',
  coalesce(string_agg(indexname || ' :: ' || indexdef, ' | '), 'NONE')
FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'supplier_reports';
