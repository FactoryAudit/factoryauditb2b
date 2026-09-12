-- =============================================================================
-- CS-07 / 05_all_in_one.sql —— 一次性粘贴版（迁移 + 只读验证）
--
-- 执行位置：Supabase Dashboard → SQL Editor → New query → 粘贴本文件 → Run
--
-- ⚠️ 本文件由 `02_migration.sql` + `03_postcheck.sql` **程序化合并**生成，
--    目的是保证与权威源文件零漂移。若两者内容不一致，**以 02 / 03 为准**。
--    重新生成命令： node scripts/build-cs07-all-in-one.mjs
--
-- 性质：第一部分改结构（DDL，包在 BEGIN/COMMIT 里），第二部分只读验证（纯 SELECT）。
-- 不执行 04_rollback.sql。
--
-- 前置：01_precheck.sql 已跑完，14 段零 FAIL / 零 CONFLICT。
-- 铁律：只新建 public.leads 一张表；0 条业务数据 INSERT/UPDATE/DELETE；
--       不 ALTER suppliers / rfqs / memberships / profiles；不动任何现有 RLS；
--       anon 零权限，service_role 写权限保留。
-- =============================================================================


-- ############################################################################
-- 第一部分：迁移（= 02_migration.sql 全文）
-- ############################################################################

BEGIN;


-- =============================================================================
-- 1. leads —— 买家里程线索引 / 供应商入驻申请 / 供应商认领申请（统一记录）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 对外短号（LEAD-XXXXXX，与 /api/rfq 的 RFQ-XXXXXX 同字符集）：
  -- 可在邮件、对话、工单里引用；也是 admin 后台定位一行的主键式字段。
  reference_id      text        NOT NULL UNIQUE,

  -- 三类来源，严格区分、不混用。
  -- buyer_lead          = 买家意向/留资（含工具页、custom-services、audit-request …）
  -- supplier_application = 供应商入驻申请（/api/supplier-register）
  -- supplier_claim       = 供应商认领既有档案（/api/supplier-claim）
  --   ⚠️ supplier_claim 只代表「收到了一条认领申请」，
  --      绝不等同于核验通过，绝不触发任何 Trust / Verification 变更。
  kind              text        NOT NULL DEFAULT 'buyer_lead',

  -- 具体来源：7 个表单 tool 值 + 'supplier-register' + 'supplier-claim'
  -- NOT NULL：由服务端决定（字面量或已规范化并带兜底的字段），不依赖 NULL。
  tool              text        NOT NULL,

  -- 跟进状态。contacted / won / lost 复用 rfq_matches 既有拼写，
  -- 避免同一个库里出现两套写法。
  status            text        NOT NULL DEFAULT 'new',

  -- ---- 联系字段 ----
  email             text        NOT NULL,
  first_name        text,
  company           text,
  country           text,
  phone             text,

  -- ---- ★ 此前被服务端静默丢弃的三个字段（P0-A）----
  sourcing          text,       -- 要采购什么 / 行业
  supplier_name     text,       -- 要核验 / 认领的供应商名
  supplier_website  text,       -- 该供应商官网

  message           text,

  -- ---- 评分与路由 ----
  score             int,        -- leadScore 0–100（分数越高意向越强）
  assigned_to       uuid,       -- 跟进负责人；当前单人运营，恒 NULL

  -- ---- ★ 无损兜底：原始业务字段全量保存 ----
  -- 上游表单新增字段时，即使列还没跟上，原始 payload 里也一定找得到。
  -- 超 16KB 时由应用层写入 {"_truncated":true,"_keys":[…]}
  -- —— **显式标记，绝不静默截断**（避免重演 P0-A 那类静默丢失）。
  payload           jsonb,

  -- ---- Admin 跟进 ----
  follow_up_note    text,
  followed_up_at    timestamptz,

  -- 提交者（已登录时才有；游客为 NULL）
  user_id           uuid,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT leads_kind_check
    CHECK (kind IN ('buyer_lead', 'supplier_application', 'supplier_claim')),
  CONSTRAINT leads_status_check
    CHECK (status IN ('new', 'contacted', 'quoted', 'won', 'lost')),
  -- 分数语义与 suppliers.risk_score 相反：这里高分 = 高意向
  CONSTRAINT leads_score_check
    CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  -- 可空归属一律 ON DELETE SET NULL，与 rfqs / 004 / 006 的可空外键约定一致
  CONSTRAINT leads_user_id_fkey
    FOREIGN KEY (user_id)     REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT leads_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL
);


-- =============================================================================
-- 2. 表 / 列注释（后台与后续开发者读这一层，比读 DDL 快）
-- =============================================================================
COMMENT ON TABLE  public.leads IS
  'CS-07：买家里程线索引 / 供应商入驻申请 / 认领申请的统一记录表。凡进入此表都只代表"收到了一条意向"，不代表任何核验、发布或信任状态。';

COMMENT ON COLUMN public.leads.reference_id IS
  '对外短号 LEAD-XXXXXX（32 字符集，去掉易混淆的 0/O/1/I）。UNIQUE 约束必须保留；撞号由 lib/leads.ts 自动重试解决。';

COMMENT ON COLUMN public.leads.kind IS
  'buyer_lead | supplier_application | supplier_claim —— 三类来源严格区分，不混用。supplier_claim 绝不等同于 verified。';

COMMENT ON COLUMN public.leads.status IS
  'new | contacted | quoted | won | lost。contacted/won/lost 与 rfq_matches 拼写一致。';

COMMENT ON COLUMN public.leads.tool IS
  '具体来源标识（表单/路由）。NOT NULL：一律由服务端决定，不做 NULL 依赖。';

COMMENT ON COLUMN public.leads.sourcing IS
  '要采购什么 / 所属行业。CS-07 之前该字段被服务端解析后丢弃（P0-A），现提升为真实列。';

COMMENT ON COLUMN public.leads.supplier_name IS
  '要核验 / 认领的供应商名称。CS-07 之前该字段从未被读取。';

COMMENT ON COLUMN public.leads.payload IS
  '原始提交载荷的无损兜底（≤16KB；超限时写入 {_truncated:true,_keys:[…]} 显式标记，绝不静默截断）。';

COMMENT ON COLUMN public.leads.score IS
  'leadScore 0–100，分数越高意向越强（与 suppliers.risk_score 语义相反，勿混用）。';

COMMENT ON COLUMN public.leads.assigned_to IS
  '跟进负责人。当前为单管理员运营，恒为 NULL；预留给后续分工。';


-- =============================================================================
-- 3. 索引（4 个普通索引；reference_id 的 UNIQUE 已自带唯一索引）
-- =============================================================================
CREATE INDEX IF NOT EXISTS leads_status  ON public.leads(status);
CREATE INDEX IF NOT EXISTS leads_kind    ON public.leads(kind);
CREATE INDEX IF NOT EXISTS leads_created ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS leads_email   ON public.leads(email);


-- =============================================================================
-- 4. updated_at 自动维护
--    **复用既有 public.set_updated_at()，绝不新建函数**
--    （与 suppliers / rfqs / memberships 完全同一个实现）
-- =============================================================================
DROP TRIGGER IF EXISTS leads_set_updated_at ON public.leads;
CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- 5. RLS —— 开启 + 仅 2 条 policy
--
--    PostgreSQL RLS 的默认语义：**开启后，没有匹配的 policy = 拒绝**。
--    所以「anon 不能 SELECT/INSERT/UPDATE/DELETE」**不需要**写 USING(false) 的惰性策略
--    —— permissive 策略之间是 OR，那种策略什么也不拦，只会多一个要核验的对象。
--
--    真正生效的链条是三层：
--      ① RLS 已开启
--      ② 只有 select_self / admin_all 两条策略（没有 anon 策略、没有写策略）
--      ③ 第 6 段把 anon / authenticated 的写权限在 GRANT 层再收一次
--    生产写入一律走 server route 的 service_role（BYPASSRLS）。
-- =============================================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 5.1 已登录用户只能看自己提交的
--     （游客提交 user_id 为 NULL，auth.uid() = NULL 永不为真 → 天然读不到任何行）
DROP POLICY IF EXISTS leads_select_self ON public.leads;
CREATE POLICY leads_select_self ON public.leads
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 5.2 管理员全权（仅作兜底；后台实际读写走 service_role + requireAdmin）
DROP POLICY IF EXISTS leads_admin_all ON public.leads;
CREATE POLICY leads_admin_all ON public.leads
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =============================================================================
-- 6. 授权收紧（防御纵深）
--
--    ⚠️ 为什么必须显式 REVOKE：
--      Supabase 在 public schema 对**新建的表**默认给 anon / authenticated 授 ALL，
--      即"建完表什么都不做" = 浏览器可直连写库。
--      本仓既有表从未显式 GRANT/REVOKE 过（grep 实证 0 命中），
--      所以 rfqs 今天对匿名是「可直接 INSERT」的（rfqs_insert_anyone WITH CHECK(true)）。
--      leads 装的是买家 PII，绝不能复制这个默认行为。
--
--    收权范围：
--      · anon          → 全收（连 SELECT 都没有）
--      · authenticated → 只留 SELECT（供 leads_select_self），写全部收回
--      · service_role  → **完全不动**（server route 的写入通道，BYPASSRLS）
-- =============================================================================
REVOKE ALL ON public.leads FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.leads FROM authenticated;
GRANT  SELECT ON public.leads TO authenticated;


-- =============================================================================
-- 7. 版本登记（与 001–007 同格式）
-- =============================================================================
INSERT INTO public.schema_migrations (version, note)
VALUES (
  '008',
  'CS-07: leads (buyer_lead|supplier_application|supplier_claim) 22 cols + 4 indexes + RLS(2 policies) + revoke write from anon/authenticated'
)
ON CONFLICT (version) DO NOTHING;


-- =============================================================================
-- 8. PostgREST 必须重新加载 schema（否则 REST 报 PGRST205）
--    NOTIFY 在事务内发出，提交后送达。
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;


-- =============================================================================
-- ✅ 执行成功的标志：`Success. No rows returned`
--    下一步：跑 03_postcheck.sql（只读，12 段）并把输出贴回给文哥。
--    ❌ 04_rollback.sql 不是正常步骤，仅在故障时使用。
-- =============================================================================


-- ############################################################################
-- 第二部分：只读验证（= 03_postcheck.sql 全文）
-- ############################################################################

-- =============================================================================
-- A. leads 的 22 列
-- =============================================================================

-- A1. 逐列实际值（预期 22 行）
SELECT c.ordinal_position AS pos,
       c.column_name,
       c.data_type,
       c.is_nullable,
       COALESCE(c.column_default, '(无 DEFAULT)') AS column_default,
       'EXISTS ✅' AS status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name   = 'leads'
ORDER BY c.ordinal_position;

-- A2. 缺失列检测（预期 0 行）
SELECT w.column_name AS missing_column, 'MISSING ❌' AS status
FROM (VALUES
  ('id'),('reference_id'),('kind'),('tool'),('status'),('email'),('first_name'),('company'),
  ('country'),('phone'),('sourcing'),('supplier_name'),('supplier_website'),('message'),
  ('score'),('assigned_to'),('payload'),('follow_up_note'),('followed_up_at'),
  ('user_id'),('created_at'),('updated_at')
) AS w(column_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = 'leads' AND c.column_name = w.column_name
WHERE c.column_name IS NULL;

-- A3. 类型 / 可空性偏差检测（预期 0 行）
SELECT w.column_name,
       w.want_type   AS expected_type,   COALESCE(c.data_type,   '(缺列)') AS actual_type,
       w.want_null   AS expected_null,   COALESCE(c.is_nullable, '(缺列)') AS actual_null,
       'MISMATCH ❌' AS status
FROM (VALUES
  ('id',               'uuid',                     'NO'),
  ('reference_id',     'text',                     'NO'),
  ('kind',             'text',                     'NO'),
  ('tool',             'text',                     'NO'),
  ('status',           'text',                     'NO'),
  ('email',            'text',                     'NO'),
  ('first_name',       'text',                     'YES'),
  ('company',          'text',                     'YES'),
  ('country',          'text',                     'YES'),
  ('phone',            'text',                     'YES'),
  ('sourcing',         'text',                     'YES'),
  ('supplier_name',    'text',                     'YES'),
  ('supplier_website', 'text',                     'YES'),
  ('message',          'text',                     'YES'),
  ('score',            'integer',                  'YES'),
  ('assigned_to',      'uuid',                     'YES'),
  ('payload',          'jsonb',                    'YES'),
  ('follow_up_note',   'text',                     'YES'),
  ('followed_up_at',   'timestamp with time zone', 'YES'),
  ('user_id',          'uuid',                     'YES'),
  ('created_at',       'timestamp with time zone', 'NO'),
  ('updated_at',       'timestamp with time zone', 'NO')
) AS w(column_name, want_type, want_null)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = 'leads' AND c.column_name = w.column_name
WHERE c.data_type IS DISTINCT FROM w.want_type
   OR c.is_nullable IS DISTINCT FROM w.want_null;

-- A4. 列数（预期 22）
SELECT COUNT(*) AS actual_column_count,
       CASE WHEN COUNT(*) = 22 THEN 'PASS ✅' ELSE 'FAIL ❌' END AS status
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads';


-- =============================================================================
-- B. 索引 / 约束
-- =============================================================================

-- B1. leads 上的全部索引（预期 5：4 普通 + 1 UNIQUE 自带）
SELECT i.indexname, i.indexdef
FROM pg_indexes i
WHERE i.schemaname = 'public' AND i.tablename = 'leads'
ORDER BY i.indexname;

-- B2. 缺失索引检测（预期 0 行）
SELECT w.indexname AS missing_index, 'MISSING ❌' AS status
FROM (VALUES
  ('leads_reference_id_key'),('leads_status'),('leads_kind'),('leads_created'),('leads_email')
) AS w(indexname)
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public' AND i.indexname = w.indexname
WHERE i.indexname IS NULL;

-- B3. leads 上的全部约束（预期：PK 1 + UNIQUE 1 + CHECK 3 + FK 2 = 7）
SELECT con.conname AS constraint_name,
       con.contype AS type,          -- p=PK, u=UNIQUE, c=CHECK, f=FK
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
WHERE con.connamespace = 'public'::regnamespace
  AND con.conrelid = 'public.leads'::regclass
ORDER BY con.contype, con.conname;

-- B4. 缺失约束检测（预期 0 行）
SELECT w.conname AS missing_constraint, 'MISSING ❌' AS status
FROM (VALUES
  ('leads_pkey'),('leads_reference_id_key'),
  ('leads_kind_check'),('leads_status_check'),('leads_score_check'),
  ('leads_user_id_fkey'),('leads_assigned_to_fkey')
) AS w(conname)
LEFT JOIN pg_constraint con
  ON con.conname = w.conname AND con.connamespace = 'public'::regnamespace
WHERE con.conname IS NULL;

-- B5. ★ reference_id 的 UNIQUE 必须存在（撞号靠应用层重试，不靠放宽约束）
SELECT 'reference_id UNIQUE 约束仍然存在' AS check_item,
       CASE WHEN EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE connamespace = 'public'::regnamespace
                AND conrelid = 'public.leads'::regclass
                AND contype = 'u'
                AND pg_get_constraintdef(oid) LIKE '%(reference_id)%'
            ) THEN 'PASS ✅' ELSE 'FAIL ❌ 有人放宽了唯一约束' END AS status;


-- =============================================================================
-- C. RLS / policy
-- =============================================================================

-- C1. leads 的 RLS 状态（预期 rowsecurity = true）
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relname = 'leads';

-- C2. leads 的全部 policy（预期恰好 2 行）
SELECT p.schemaname, p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
FROM pg_policies p
WHERE p.schemaname = 'public' AND p.tablename = 'leads'
ORDER BY p.policyname;

-- C3. policy 数量检测（预期 2 / 且必须恰好是这两个名字）
SELECT COUNT(*) AS leads_policy_count,
       CASE WHEN COUNT(*) = 2 THEN 'PASS ✅' ELSE 'FAIL ❌ 策略数不为 2' END AS count_status,
       CASE WHEN ARRAY(SELECT p.policyname FROM pg_policies p
                       WHERE p.schemaname='public' AND p.tablename='leads' ORDER BY p.policyname)
                 = ARRAY['leads_admin_all','leads_select_self']
            THEN 'PASS ✅' ELSE 'FAIL ❌ 策略名不符' END AS name_status
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'leads';

-- C4. ★ 危险策略检测：是否存在**给 anon 的策略**或**写策略**（预期 0 行）
SELECT p.policyname, p.roles, p.cmd, 'UNEXPECTED ❌' AS status
FROM pg_policies p
WHERE p.schemaname = 'public' AND p.tablename = 'leads'
  AND (p.roles::text LIKE '%anon%'
       OR p.cmd IN ('INSERT','UPDATE','DELETE'));

-- C5. ★ 全库 policy 总数（迁移前 30 + leads 的 2 = 预期 32）
SELECT COUNT(*) AS total_public_policies,
       CASE WHEN COUNT(*) = 32 THEN 'PASS ✅' ELSE 'CHECK ❌ 与迁移前 30 + 2 不符' END AS status
FROM pg_policies
WHERE schemaname = 'public';

-- C6. ★ 是否有**别的表**的 policy 被改动/牵入 leads（预期 0 行）
SELECT p.tablename, p.policyname, p.qual, p.with_check, 'UNEXPECTED ❌' AS status
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename <> 'leads'
  AND (COALESCE(p.qual,'') LIKE '%leads%' OR COALESCE(p.with_check,'') LIKE '%leads%');


-- =============================================================================
-- D. trigger（预期 1 个，且执行 public.set_updated_at()）
-- =============================================================================
SELECT t.tgname AS trigger_name,
       p.proname AS function_name,
       n2.nspname AS function_schema,
       CASE WHEN t.tgtype & 2  > 0 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
       'FOR EACH ROW' AS granularity
FROM pg_trigger t
JOIN pg_proc  p  ON p.oid = t.tgfoid
JOIN pg_namespace n2 ON n2.oid = p.pronamespace
WHERE t.tgrelid = 'public.leads'::regclass
  AND NOT t.tgisinternal;

-- D2. 必须复用既有函数（预期 1 行 = leads_set_updated_at / public / set_updated_at）
SELECT 'trigger 复用既有 set_updated_at()' AS check_item,
       CASE WHEN EXISTS (
              SELECT 1 FROM pg_trigger t
              JOIN pg_proc p ON p.oid = t.tgfoid
              JOIN pg_namespace n2 ON n2.oid = p.pronamespace
              WHERE t.tgrelid = 'public.leads'::regclass
                AND NOT t.tgisinternal
                AND n2.nspname = 'public'
                AND p.proname  = 'set_updated_at'
            ) THEN 'PASS ✅' ELSE 'FAIL ❌' END AS status;

-- D3. 不得新建 trigger 函数（预期 0 行）
SELECT p.proname AS unexpected_new_function, 'UNEXPECTED ❌ 本次迁移不应新建函数' AS status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname NOT IN ('set_updated_at','is_admin','handle_new_user','handle_new_profile','gen_random_uuid');


-- =============================================================================
-- E. ★ 授权（本段是"浏览器不可写库"的硬证据）
-- =============================================================================

-- E1. anon 对 leads 的权限（预期 0 行）
SELECT grantee, privilege_type, 'UNEXPECTED ❌ anon 不该有任何权限' AS status
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'leads' AND grantee = 'anon';

-- E2. authenticated 对 leads 的权限（预期恰好 1 行 = SELECT）
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'leads' AND grantee = 'authenticated'
ORDER BY privilege_type;

SELECT 'authenticated 只有 SELECT' AS check_item,
       CASE WHEN ARRAY(SELECT g.privilege_type FROM information_schema.role_table_grants g
                       WHERE g.table_schema='public' AND g.table_name='leads'
                         AND g.grantee='authenticated' ORDER BY g.privilege_type)
                 = ARRAY['SELECT']
            THEN 'PASS ✅' ELSE 'FAIL ❌' END AS status;

-- E3. 写权限必须只剩 service_role（预期：service_role 握有 INSERT/UPDATE/DELETE）
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'leads'
  AND privilege_type IN ('INSERT','UPDATE','DELETE')
ORDER BY grantee, privilege_type;

SELECT 'INSERT/UPDATE/DELETE 仅 service_role 持有' AS check_item,
       CASE WHEN NOT EXISTS (
              SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema='public' AND g.table_name='leads'
                AND g.privilege_type IN ('INSERT','UPDATE','DELETE')
                AND g.grantee <> 'service_role'
            ) THEN 'PASS ✅' ELSE 'FAIL ❌ 有非 service_role 角色持有写权限' END AS status;


-- =============================================================================
-- F. ★ 16 张表行数 vs 迁移前基线（预取 2026-09-11 12:50）
--    预期：除 schema_migrations(7→8) 与新增的 leads(0) 外，一字不变。
-- =============================================================================

-- F1. 实际行数
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
UNION ALL SELECT 'leads',                   COUNT(*) FROM public.leads
ORDER BY t;

-- F2. ★ 与基线自动比对（预期 0 行）
--     （刻意用显式子查询而非动态 SQL —— SQL Editor 里最稳）
SELECT x.t AS table_name, x.want AS expected_baseline, x.n AS actual, 'MISMATCH ❌' AS status
FROM (
            SELECT 'profiles'                AS t, 4  AS want, (SELECT COUNT(*) FROM public.profiles)                AS n
  UNION ALL SELECT 'memberships',                  4,      (SELECT COUNT(*) FROM public.memberships)
  UNION ALL SELECT 'suppliers',                    5,      (SELECT COUNT(*) FROM public.suppliers)
  UNION ALL SELECT 'supplier_capabilities',        7,      (SELECT COUNT(*) FROM public.supplier_capabilities)
  UNION ALL SELECT 'supplier_evidence',            3,      (SELECT COUNT(*) FROM public.supplier_evidence)
  UNION ALL SELECT 'supplier_documents',           0,      (SELECT COUNT(*) FROM public.supplier_documents)
  UNION ALL SELECT 'supplier_certifications',      0,      (SELECT COUNT(*) FROM public.supplier_certifications)
  UNION ALL SELECT 'supplier_audits',              0,      (SELECT COUNT(*) FROM public.supplier_audits)
  UNION ALL SELECT 'saved_suppliers',              0,      (SELECT COUNT(*) FROM public.saved_suppliers)
  UNION ALL SELECT 'profile_views',                0,      (SELECT COUNT(*) FROM public.profile_views)
  UNION ALL SELECT 'rfqs',                         1,      (SELECT COUNT(*) FROM public.rfqs)
  UNION ALL SELECT 'rfq_matches',                  0,      (SELECT COUNT(*) FROM public.rfq_matches)
  UNION ALL SELECT 'stripe_events',                0,      (SELECT COUNT(*) FROM public.stripe_events)
  UNION ALL SELECT 'admin_audit_log',              2,      (SELECT COUNT(*) FROM public.admin_audit_log)
  UNION ALL SELECT 'certification_program_alias',  29,     (SELECT COUNT(*) FROM public.certification_program_alias)
  UNION ALL SELECT 'schema_migrations',            8,      (SELECT COUNT(*) FROM public.schema_migrations)
  UNION ALL SELECT 'leads',                        0,      (SELECT COUNT(*) FROM public.leads)
) AS x
WHERE x.n IS DISTINCT FROM x.want;


-- =============================================================================
-- G. ★ 5 家供应商信任字段 vs 迁移前快照（预期 0 行差异）
--    CS-07 新增 supplier_claim 记录后，这些值必须完全不动 —— Claim ≠ Verification。
-- =============================================================================

-- G1. 实际快照
SELECT slug, is_published, verification_level, verification_status, audit_status,
       risk_score, certifications, access_tier, source_type, source_name, discovered_at, website
FROM public.suppliers
ORDER BY slug;

-- G2. ★ 与快照自动比对（预期 0 行）
SELECT w.slug,
       w.want_pub AS expected_pub,   s.is_published        AS actual_pub,
       w.want_vl  AS expected_level, s.verification_level  AS actual_level,
       w.want_vs  AS expected_status,s.verification_status AS actual_status,
       w.want_as  AS expected_audit, s.audit_status        AS actual_audit,
       w.want_rs  AS expected_risk,  s.risk_score          AS actual_risk,
       'MISMATCH ❌' AS status
FROM (VALUES
  ('dongguan-plastic-molding',       true,  'unverified', 'Identity Verified', 'Not yet audited', 56),
  ('guangzhou-textile-factory',      true,  'unverified', 'Document Verified', 'Audited 2026-03', 72),
  ('ho-chi-minh-garment',            true,  'unverified', 'Identity Verified', 'Pending',         59),
  ('nanjing-mxcomm',                 false, 'unverified', NULL,                NULL,              NULL),
  ('shenzhen-precision-electronics', true,  'unverified', 'Factory Verified',  'Audited 2026-06', 88)
) AS w(slug, want_pub, want_vl, want_vs, want_as, want_rs)
JOIN public.suppliers s ON s.slug = w.slug
WHERE s.is_published       IS DISTINCT FROM w.want_pub
   OR s.verification_level IS DISTINCT FROM w.want_vl
   OR s.verification_status IS DISTINCT FROM w.want_vs
   OR s.audit_status       IS DISTINCT FROM w.want_as
   OR s.risk_score         IS DISTINCT FROM w.want_rs;

-- G3. suppliers 行数仍为 5、is_published=false 的仍只有 nanjing-mxcomm（预期 5 / 1）
SELECT COUNT(*) AS suppliers_total,
       COUNT(*) FILTER (WHERE is_published = false) AS unpublished_total,
       CASE WHEN COUNT(*) = 5 AND COUNT(*) FILTER (WHERE is_published = false) = 1
            THEN 'PASS ✅' ELSE 'FAIL ❌' END AS status
FROM public.suppliers;


-- =============================================================================
-- H. suppliers / rfqs / memberships / profiles 列结构未变
--    预期列数：31 / 12 / 10 / 7
-- =============================================================================
SELECT w.t AS table_name, w.want AS expected_columns, a.n AS actual_columns,
       CASE WHEN a.n = w.want THEN 'PASS ✅' ELSE 'FAIL ❌ 列结构被改动' END AS status
FROM (VALUES
  ('suppliers', 31), ('rfqs', 12), ('memberships', 10), ('profiles', 7)
) AS w(t, want)
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS n
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = w.t
) a ON true;

-- H2. 4 张表的逐列清单（供与 precheck 第 8 段人工比对）
SELECT table_name, ordinal_position, column_name, data_type, is_nullable,
       COALESCE(column_default, '(无 DEFAULT)') AS column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('suppliers','rfqs','memberships','profiles')
ORDER BY table_name, ordinal_position;


-- =============================================================================
-- I. schema_migrations（预期含 008，共 8 行）
-- =============================================================================
SELECT version, note, applied_at
FROM public.schema_migrations
ORDER BY version;

SELECT '008 已登记' AS check_item,
       CASE WHEN EXISTS (SELECT 1 FROM public.schema_migrations WHERE version = '008')
            THEN 'PASS ✅' ELSE 'FAIL ❌' END AS status;


-- =============================================================================
-- J. leads 为 0 行（迁移只建结构，不凭空造数据）
-- =============================================================================
SELECT COUNT(*) AS leads_rows,
       CASE WHEN COUNT(*) = 0 THEN 'PASS ✅' ELSE 'FAIL ❌ 迁移不该写入任何业务数据' END AS status
FROM public.leads;


-- =============================================================================
-- K. 全库 policy 逐行清单（供与 precheck 第 7 段逐行比对；预期 32 行）
-- =============================================================================
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- =============================================================================
-- L. 汇总判定（预期全部 PASS ✅）
-- =============================================================================
SELECT 'A 列数 = 22'                                AS check_item,
       CASE WHEN (SELECT COUNT(*) FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='leads') = 22
            THEN 'PASS ✅' ELSE 'FAIL ❌' END AS status
UNION ALL
SELECT 'B 索引 = 5',
       CASE WHEN (SELECT COUNT(*) FROM pg_indexes
                  WHERE schemaname='public' AND tablename='leads') = 5
            THEN 'PASS ✅' ELSE 'FAIL ❌' END
UNION ALL
SELECT 'B 约束 = 7',
       CASE WHEN (SELECT COUNT(*) FROM pg_constraint
                  WHERE connamespace='public'::regnamespace
                    AND conrelid='public.leads'::regclass) = 7
            THEN 'PASS ✅' ELSE 'FAIL ❌' END
UNION ALL
SELECT 'C RLS 已开启',
       CASE WHEN (SELECT relrowsecurity FROM pg_class
                  WHERE relnamespace='public'::regnamespace AND relname='leads')
            THEN 'PASS ✅' ELSE 'FAIL ❌' END
UNION ALL
SELECT 'C leads policy = 2',
       CASE WHEN (SELECT COUNT(*) FROM pg_policies
                  WHERE schemaname='public' AND tablename='leads') = 2
            THEN 'PASS ✅' ELSE 'FAIL ❌' END
UNION ALL
SELECT 'C leads 上无 anon 策略 / 无写策略',
       CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='leads'
                    AND (roles::text LIKE '%anon%' OR cmd IN ('INSERT','UPDATE','DELETE')))
            THEN 'PASS ✅' ELSE 'FAIL ❌' END
UNION ALL
SELECT 'C 全库 policy = 32',
       CASE WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public') = 32
            THEN 'PASS ✅' ELSE 'FAIL ❌ 与迁移前 30 + 2 不符' END
UNION ALL
SELECT 'D trigger 指向 public.set_updated_at()',
       CASE WHEN EXISTS (
              SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
              JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE t.tgrelid='public.leads'::regclass AND NOT t.tgisinternal
                AND n.nspname='public' AND p.proname='set_updated_at')
            THEN 'PASS ✅' ELSE 'FAIL ❌' END
UNION ALL
SELECT 'E anon 对 leads 零权限',
       CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                  WHERE table_schema='public' AND table_name='leads' AND grantee='anon')
            THEN 'PASS ✅' ELSE 'FAIL ❌' END
UNION ALL
SELECT 'E authenticated 仅 SELECT',
       CASE WHEN ARRAY(SELECT privilege_type FROM information_schema.role_table_grants
                       WHERE table_schema='public' AND table_name='leads'
                         AND grantee='authenticated' ORDER BY privilege_type) = ARRAY['SELECT']
            THEN 'PASS ✅' ELSE 'FAIL ❌' END
UNION ALL
SELECT 'E 写权限仅 service_role',
       CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                  WHERE table_schema='public' AND table_name='leads'
                    AND privilege_type IN ('INSERT','UPDATE','DELETE')
                    AND grantee <> 'service_role')
            THEN 'PASS ✅' ELSE 'FAIL ❌' END
UNION ALL
SELECT 'F/G/H 关键表零变更（差异检测器均为 0 行）',
       '人工核对上方 F2 / G2 / H1 三段输出' AS status
UNION ALL
SELECT 'I schema_migrations 含 008',
       CASE WHEN EXISTS (SELECT 1 FROM public.schema_migrations WHERE version='008')
            THEN 'PASS ✅' ELSE 'FAIL ❌' END
UNION ALL
SELECT 'J leads = 0 行',
       CASE WHEN (SELECT COUNT(*) FROM public.leads) = 0
            THEN 'PASS ✅' ELSE 'FAIL ❌' END;


-- =============================================================================
-- ✅ 全部 PASS 后，请把 A1/A3/B1/B3/C2/C4/C5/E2/E3/F2/G2/H1/L 这些段落的输出贴回给文哥。
--    任何一段出现 FAIL ❌ / MISMATCH ❌ / UNEXPECTED ❌ → 立即停止，跑 04_rollback.sql 并告知文哥。
-- =============================================================================
