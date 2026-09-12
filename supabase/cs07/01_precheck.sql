-- =============================================================================
-- CS-07 / 01_precheck.sql —— Migration 008（leads 表）迁移前只读检查
--
-- 执行位置：Supabase Dashboard → SQL Editor
-- 性质：**只读**。本文件不含任何 INSERT / UPDATE / DELETE / CREATE / ALTER / DROP / GRANT。
--       全部是 SELECT / information_schema / pg_catalog 查询。
--
-- 目的：
--   1. 确认 leads 表**尚不存在**（若已存在 → 立即停止，不要跑 02_migration）
--   2. 确认依赖对象存在：set_updated_at() / is_admin() / profiles / pgcrypto
--   3. 检测 5 个计划索引名、约束名、policy 名是否冲突（索引名在本 schema 内全局唯一）
--   4. 给所有现有业务表拍**结构与行数基线**，供 03_postcheck 逐项比对
--   5. 确认 008 版本号未被占用
--
-- 执行后：**请把完整输出原样贴回给文哥**，文哥确认无 CONFLICT 后你再跑 02_migration.sql。
--
-- ⚠️ 本 Change Set 的铁律：**不得 ALTER suppliers / rfqs / memberships / profiles**
--    本文件第 8、9 段就是这条铁律的证据基线（迁移后必须一字不变）。
-- =============================================================================


-- =============================================================================
-- 1. leads 相关对象是否已被占用（预期：全部 NOT EXISTS ✅）
-- =============================================================================
SELECT 'leads 表'                          AS planned_object,
       CASE WHEN to_regclass('public.leads') IS NULL
            THEN 'NOT EXISTS ✅ 可创建'
            ELSE 'EXISTS ❌ 停止执行 —— 可能迁移跑过一次' END AS status
UNION ALL
SELECT '以 leads 开头的索引名（索引名在本 schema 内全局唯一）',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'leads%'
            )
            THEN 'NOT EXISTS ✅ 可创建' ELSE 'EXISTS ❌ 逐个看第 4 段' END
UNION ALL
SELECT '以 leads_ 开头的约束名',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE connamespace='public'::regnamespace AND conname LIKE 'leads_%'
            )
            THEN 'NOT EXISTS ✅ 可创建' ELSE 'EXISTS ❌ 逐个看第 5 段' END
UNION ALL
SELECT '以 leads 开头的触发器名',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_trigger WHERE tgname LIKE 'leads%' AND NOT tgisinternal
            )
            THEN 'NOT EXISTS ✅ 可创建' ELSE 'EXISTS ❌ 停止执行' END
UNION ALL
SELECT '以 leads 开头的 policy 名',
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'leads%'
            )
            THEN 'NOT EXISTS ✅ 可创建' ELSE 'EXISTS ❌ 逐个看第 6 段' END;


-- =============================================================================
-- 2. 依赖对象：migration 用到的函数与扩展必须已存在
--    预期：set_updated_at / is_admin 均 EXISTS；pgcrypto 已装（gen_random_uuid 来源）
-- =============================================================================
SELECT 'set_updated_at()'  AS dependency,
       CASE WHEN to_regproc('public.set_updated_at') IS NOT NULL
            THEN 'EXISTS ✅' ELSE 'MISSING ❌ 停止执行（001_init 应已建）' END AS status
UNION ALL
SELECT 'is_admin()',
       CASE WHEN to_regproc('public.is_admin') IS NOT NULL
            THEN 'EXISTS ✅' ELSE 'MISSING ❌ 停止执行（001_init 应已建）' END
UNION ALL
SELECT 'profiles 表',
       CASE WHEN to_regclass('public.profiles') IS NOT NULL
            THEN 'EXISTS ✅' ELSE 'MISSING ❌ 停止执行' END
UNION ALL
SELECT 'pgcrypto 扩展（gen_random_uuid）',
       CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname='pgcrypto')
            THEN 'EXISTS ✅' ELSE 'MISSING ❌ 停止执行（001_init 应已装）' END
UNION ALL
SELECT 'gen_random_uuid() 可直接调用',
       CASE WHEN (SELECT count(*) FROM pg_proc WHERE proname='gen_random_uuid') > 0
            THEN 'EXISTS ✅' ELSE 'MISSING ❌' END;


-- =============================================================================
-- 3. 基线行数（迁移后 03_postcheck 必须一字不变）
--    ⚠️ 这是"零数据变更"的硬证据。请务必保留本段输出。
-- =============================================================================
SELECT 'profiles'                AS t, COUNT(*) AS n FROM public.profiles
UNION ALL SELECT 'memberships',             COUNT(*) FROM public.memberships
UNION ALL SELECT 'suppliers',               COUNT(*) FROM public.suppliers
UNION ALL SELECT 'supplier_capabilities',   COUNT(*) FROM public.supplier_capabilities
UNION ALL SELECT 'supplier_evidence',       COUNT(*) FROM public.supplier_evidence
UNION ALL SELECT 'supplier_documents',      COUNT(*) FROM public.supplier_documents
UNION ALL SELECT 'supplier_certifications', COUNT(*) FROM public.supplier_certifications
UNION ALL SELECT 'supplier_audits',         COUNT(*) FROM public.supplier_audits
UNION ALL SELECT 'saved_suppliers',         COUNT(*) FROM public.saved_suppliers
UNION ALL SELECT 'profile_views',           COUNT(*) FROM public.profile_views
UNION ALL SELECT 'rfqs',                    COUNT(*) FROM public.rfqs
UNION ALL SELECT 'rfq_matches',             COUNT(*) FROM public.rfq_matches
UNION ALL SELECT 'stripe_events',           COUNT(*) FROM public.stripe_events
UNION ALL SELECT 'admin_audit_log',         COUNT(*) FROM public.admin_audit_log
UNION ALL SELECT 'certification_program_alias', COUNT(*) FROM public.certification_program_alias
UNION ALL SELECT 'schema_migrations',       COUNT(*) FROM public.schema_migrations
ORDER BY t;


-- =============================================================================
-- 4. 计划新增的 5 个索引 —— 名称冲突检测
--    预期：5 行全部 'OK 可新增 ✅'
--    若出现 CONFLICT → 不要跑 02_migration，先贴结果给文哥
-- =============================================================================
SELECT want.indexname AS planned_index,
       CASE WHEN i.indexname IS NULL THEN 'OK 可新增 ✅'
            ELSE 'CONFLICT 已存在 ❌ 停止执行' END AS is_conflict,
       i.indexdef AS existing_definition
FROM (VALUES
  ('leads_reference_id_key'),   -- UNIQUE（由 UNIQUE 约束自动建）
  ('leads_status'),             -- (status)
  ('leads_kind'),               -- (kind)
  ('leads_created'),            -- (created_at DESC)
  ('leads_email')               -- (email)
) AS want(indexname)
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
 AND i.indexname  = want.indexname
ORDER BY want.indexname;


-- =============================================================================
-- 5. 计划新增的 CHECK 约束名 —— 冲突检测
--    （约束名在表内唯一；因 leads 表尚不存在，预期全部 'OK 可新增 ✅'）
-- =============================================================================
SELECT want.conname AS planned_constraint,
       CASE WHEN c.conname IS NULL THEN 'OK 可新增 ✅'
            ELSE 'CONFLICT 已存在 ❌' END AS is_conflict
FROM (VALUES
  ('leads_kind_check'),
  ('leads_status_check'),
  ('leads_score_check')
) AS want(conname)
LEFT JOIN pg_constraint c
  ON c.conname = want.conname
 AND c.connamespace = 'public'::regnamespace
ORDER BY want.conname;


-- =============================================================================
-- 6. 计划新增的 policy 名 —— 冲突检测
--    预期：2 行全部 'OK 可新增 ✅'
--
--    ⚠️ 设计说明：**只有 2 条 policy，且不给 anon 任何写权限**。
--       PostgreSQL RLS 的默认行为就是"无 policy = 拒绝"，所以
--       「anon 不能 INSERT/UPDATE/DELETE/SELECT」**不需要**写一条 USING(false) 的策略
--       —— 那种策略是惰性的（permissive 策略之间是 OR），只会增加一个要核验的对象。
--       真正的生效链条是：RLS 已开启 + 只有 select_self / admin_all 两条策略
--                          + 第 13 段列出的 REVOKE 收回 anon/authenticated 的写权限。
--       生产写入一律走 server route 的 service_role（BYPASSRLS）。
-- =============================================================================
SELECT want.policyname AS planned_policy,
       CASE WHEN p.policyname IS NULL THEN 'OK 可新增 ✅'
            ELSE 'CONFLICT 已存在于 ' || p.tablename || ' ❌' END AS is_conflict
FROM (VALUES
  ('leads_select_self'),
  ('leads_admin_all')
) AS want(policyname)
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.policyname = want.policyname
ORDER BY want.policyname;


-- =============================================================================
-- 7. RLS 现状基线（迁移后必须完全一致）
--    🔴 本段是"不影响现有 RLS"的硬证据。
-- =============================================================================
SELECT relname              AS table_name,
       relrowsecurity       AS rls_enabled,
       relforcerowsecurity  AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'profiles','memberships','suppliers','supplier_capabilities','supplier_evidence',
    'saved_suppliers','profile_views','rfqs','rfq_matches','stripe_events',
    'supplier_documents','supplier_certifications','supplier_audits','admin_audit_log',
    'certification_program_alias','schema_migrations'
  )
ORDER BY relname;

-- 现有全部 policy（迁移后必须逐行一致）
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- =============================================================================
-- 8. 现有业务表的列结构基线
--    🔴 铁律证据：迁移后这 4 张表的列**一列不增、一列不减、类型不变**。
-- =============================================================================
SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('suppliers','rfqs','memberships','profiles')
ORDER BY table_name, ordinal_position;


-- =============================================================================
-- 9. ★ 信任字段快照（迁移后 03_postcheck 必须一字不差）
--    CS-07 新增 supplier_claim 记录后，这些值必须**完全不动** ——
--    Claim 与 Verification 严格分离。
-- =============================================================================
SELECT slug,
       is_published,
       verification_level,
       verification_status,
       audit_status,
       risk_score,
       inspection_history,
       certifications,
       access_tier,
       source_type,
       source_name,
       discovered_at,
       website,
       created_at,
       updated_at
FROM public.suppliers
ORDER BY slug;


-- =============================================================================
-- 10. 现有 status 值域对照（用于确认 leads 的状态枚举命名不冲突、可对齐）
--     预期：
--       rfqs.status          = new | reviewing | matched | closed
--       rfq_matches.status   = suggested | contacted | won | lost
--     → CS-07 的 leads.status 复用 contacted / won / lost 三个既有拼写，
--       另加 new / quoted，共 5 值（用户指定：New / Contacted / Quoted / Won / Lost）
-- =============================================================================
SELECT rel.relname AS table_name,
       con.conname AS constraint_name,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname IN ('rfqs','rfq_matches')
  AND con.contype = 'c'
ORDER BY rel.relname, con.conname;


-- =============================================================================
-- 11. 引用 profiles(id) 的现有外键（确认新增一条 FK 没有任何副作用）
--     说明：lead 上的 FK 只会给 **leads** 加约束，不会 ALTER profiles。
--           本段用于确认既有约定（ON DELETE 行为）以便保持一致。
-- =============================================================================
SELECT con.conname              AS fk_name,
       rel.relname              AS from_table,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND con.contype = 'f'
  AND pg_get_constraintdef(con.oid) LIKE '%REFERENCES profiles(id)%'
ORDER BY rel.relname, con.conname;


-- =============================================================================
-- 12. schema_migrations 现有版本（确认 008 未被占用）
--     预期：001, 002, 003, 004, 005, 006, 007 —— 共 7 行，不含 008
--     若已含 008 → 说明迁移跑过一次，**不要重复跑**，先贴结果给文哥
-- =============================================================================
SELECT version, note, applied_at
FROM public.schema_migrations
ORDER BY version;


-- =============================================================================
-- 13. 计划对象清单（只读回显，供 03_postcheck 逐项比对）
-- =============================================================================
SELECT * FROM (VALUES
  ('TABLE',    'leads',                    '新建，22 列（见 02_migration.sql）'),
  ('CONSTRAINT','leads_kind_check',        'kind IN (buyer_lead|supplier_application|supplier_claim)'),
  ('CONSTRAINT','leads_status_check',      'status IN (new|contacted|quoted|won|lost)'),
  ('CONSTRAINT','leads_score_check',       'score IS NULL OR 0..100'),
  ('CONSTRAINT','leads_reference_id_key',  'UNIQUE(reference_id)'),
  ('CONSTRAINT','leads_user_id_fkey',      'FK profiles(id) ON DELETE SET NULL'),
  ('CONSTRAINT','leads_assigned_to_fkey',  'FK profiles(id) ON DELETE SET NULL'),
  ('INDEX',    'leads_status',             '(status)'),
  ('INDEX',    'leads_kind',               '(kind)'),
  ('INDEX',    'leads_created',            '(created_at DESC)'),
  ('INDEX',    'leads_email',              '(email)'),
  ('TRIGGER',  'leads_set_updated_at',     'BEFORE UPDATE → set_updated_at()（复用既有函数，不新建函数）'),
  ('RLS',      'leads',                    'ENABLE ROW LEVEL SECURITY'),
  ('POLICY',   'leads_select_self',        'FOR SELECT TO authenticated USING (auth.uid() = user_id)'),
  ('POLICY',   'leads_admin_all',          'FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())'),
  ('GRANT',    'REVOKE INSERT/UPDATE/DELETE', 'FROM anon, authenticated —— 直接客户端写入显式收回'),
  ('MIGRATION','008',                      'INSERT INTO schema_migrations (version, note)')
) AS planned(object_kind, object_name, note)
ORDER BY object_kind, object_name;


-- =============================================================================
-- 14. 现有同类表的授权基线（用于确认上面的 REVOKE 真的生效）
--     说明：Supabase 在 public schema 对新表默认给 anon / authenticated 授 ALL，
--           所以"新建表 + 什么都不做"= 浏览器可直连写库。本段采集 rfqs 的现状作对照，
--           03_postcheck 会再跑一次 leads 版本，两者应当**不同**（leads 少了写权限）。
-- =============================================================================
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'rfqs'
ORDER BY grantee, privilege_type;

-- leads 当前状态（预期：0 行 —— 表还不存在）
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'leads'
ORDER BY grantee, privilege_type;


-- =============================================================================
-- ✅ 输出完以上 14 段后，请把**全部结果原样**贴回给文哥。
--    重点确认：
--      第 1 段     → leads 一切 NOT EXISTS ✅
--      第 2 段     → 5 项依赖全部 EXISTS ✅
--      第 4/5/6 段 → 全部 'OK 可新增 ✅'（无 CONFLICT）
--      第 3 段     → 抄下行数基线（03_postcheck 要逐行比对）
--      第 8/9 段   → 抄下结构与信任字段基线（03_postcheck 要逐列比对）
--      第 12 段    → 确认不含 008
--      第 14 段    → 抄下 rfqs 的授权基线（用于确认 leads 的 REVOKE 生效）
--    文哥确认后，才会给你 02_migration.sql。
--
--    若任一段出现 ❌ / CONFLICT：**立即停止，不要执行 02_migration.sql**，把结果贴回。
-- =============================================================================
