-- =============================================================================
-- CS-07 / 02_migration.sql —— Migration 008：public.leads
--
-- 执行位置：Supabase Dashboard → SQL Editor
-- 前置：01_precheck.sql 已跑完，且 14 段**零 FAIL / 零 CONFLICT**
--       （第 1 段 leads 全部 NOT EXISTS；第 4/5/6 段全部「OK 可新增」）
-- 性质：**只新建 1 张表**。0 条业务数据 INSERT / UPDATE / DELETE。
--
-- -----------------------------------------------------------------------------
-- 铁律（本迁移的全部约束）
-- -----------------------------------------------------------------------------
--   1. 不 ALTER suppliers / rfqs / memberships / profiles —— 一列不增、不改、不删。
--   2. 不动任何现有 RLS / policy —— 只对新建的 leads 开 RLS。
--   3. 不给 anon / authenticated 任何写权限（RLS 默认拒绝 + REVOKE 双重）。
--      service_role 写权限**必须保留**（server route 的唯一写入通道，BYPASSRLS）。
--   4. Claim 与 Verification 严格分离：本迁移只存记录，不产生任何 Trust 副作用。
--   5. 全部 IF NOT EXISTS / DROP … IF EXISTS，可重复执行（幂等）。
--   6. 唯一的 UNIQUE 是 reference_id —— 撞号由应用层（lib/leads.ts）重试解决，
--      **禁止**通过取消/放宽该约束来"解决"冲突。
--
-- -----------------------------------------------------------------------------
-- 重要：本文件包在 BEGIN/COMMIT 里。任何一句失败 → 整份迁移自动整体回滚，
--       不会留下半成品。回滚标准做法见 04_rollback.sql。
-- =============================================================================

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
