-- =============================================================================
-- FactoryAuditB2B — 一次性执行全部待办迁移
-- 生成时间：2026-09-12T01:05:40.003Z
-- 由 scripts/build-run-all-pending.mjs 自动生成，**请勿手改本文件**
--
-- 用法：整份复制 → Supabase Dashboard → SQL Editor → 粘贴 → Run
-- 幂等：两份迁移全部使用 IF NOT EXISTS / DO 块守卫，重复执行安全
--
-- 待办清单：
--   · PART 1 / 3 — 009 供应商档案扩展字段
--     suppliers 新增 9 列：公司类型 / 英文名 / 产能 / 月产量 / 厂区面积 / 出口起始年 / 自述证书(含颁发+到期日) / 授权 / 联系可见性
--   · PART 2 / 3 — 008 leads 线索落库表（CS-07）
--     建 leads 表：让工厂注册与买家询盘真正进数据库，不再只靠邮件
-- =============================================================================

-- ⚠️ 阅读提示：PART 2（008 leads）正文自称「不 ALTER suppliers」——
--    那是对 CS-07 自身范围的约束。suppliers 的加列在 PART 1（009）里，
--    两者已在本次合并中显式分区，互不越界。



-- ##############################################################################
-- ## PART 1 / 3 — 009 供应商档案扩展字段
-- ## 源文件：supabase/migrations/009_supplier_profile_extras.sql
-- ##############################################################################

-- =============================================================================
-- FactoryAuditB2B — 009 供应商档案扩展字段
-- 创建日期：2026-09-12
--
-- 执行位置：Supabase Dashboard → SQL Editor
-- 前置：无（可独立执行；008_leads.sql 另跑，互不依赖）
--
-- 为什么需要本迁移：
--   /api/supplier-register 收集 25 个字段，但 suppliers 表只能承载其中一部分。
--   productionCapacity / monthlyOutput / factorySize / exportSince / companyType /
--   englishName 在表里**没有对应列** ⇒ 工厂填得再全也无处落库，
--   档案页因此永远长不胖（这是「档案内容太少」的结构性原因）。
--   同时，CS-08 起申请表单已收集证书的**颁发日期 + 到期日期**，
--   但 suppliers.certifications 是 text[]，装不下日期。
--
-- 设计铁律（改动本文件前必读）：
--   1. 本文件**只加结构，不写任何业务数据**。INSERT/UPDATE 语句为 0 条。
--   2. 全部使用 IF NOT EXISTS，可重复执行。
--   3. 已有 31 列一个都不删、不改类型 —— 生产代码正在读写它们。
--   4. 🔴 self_reported_certificates 与 supplier_certifications 是**两条轴**：
--        · supplier_certifications = 平台核验过的证书（有 verification_status）
--        · self_reported_certificates = 工厂自述的证书声明（**未核验**）
--      二者**绝不可互相填充**。没有证据就是没有证据。
--   5. 🔴 export_since（出口起始年）不等于 established（成立年份）。
--      申请表单只问「Exporting Since」，**不构成成立年份的证据**。
--   6. 授权与可见性是**同意的载体**，必须落库才知道能不能公开：
--        · profile_authorized  ← 申请表单 authorizeCompanyProfile
--        · contact_visibility  ← 申请表单 contactVisibility
--      未授权一律不得公开联系方式。
-- =============================================================================

-- =============================================================================
-- 1. 公司登记与生产能力（申请表单原文，逐字保存，不做规范化）
-- =============================================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_type      text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS english_name      text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS production_capacity text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS monthly_output    text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS factory_size      text;

-- 出口起始年。与 established（成立年份）严格区分。
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS export_since      integer;

COMMENT ON COLUMN public.suppliers.company_type IS
  '申请表单「公司类型」原文（如 manufacturer and trading）。business_type 是平台规范化口径，本列保留申请人原话，二者并存。';
COMMENT ON COLUMN public.suppliers.english_name IS
  '申请表单「English Name」，用于海外买家检索。';
COMMENT ON COLUMN public.suppliers.production_capacity IS
  '申请表单「Production Capacity」原文。供应商自述，未经平台核实。';
COMMENT ON COLUMN public.suppliers.monthly_output IS
  '申请表单「Monthly Output」原文。供应商自述，未经平台核实。';
COMMENT ON COLUMN public.suppliers.factory_size IS
  '申请表单「Factory Size」原文（面积/规模）。供应商自述，未经平台核实。';
COMMENT ON COLUMN public.suppliers.export_since IS
  '出口起始年（申请表单 Exporting Since）。⚠️ 不等于成立年份 established，不得互相推导。';

-- =============================================================================
-- 2. 工厂自述证书（含颁发日期 / 到期日期）
--    结构：[{ "name": "...", "number": "...", "issued": "YYYY-MM-DD", "expires": "YYYY-MM-DD" }]
--    来源：申请表单的 certificatesJson（CS-08 起收集 issued/expires）
-- =============================================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS self_reported_certificates jsonb;

COMMENT ON COLUMN public.suppliers.self_reported_certificates IS
  '工厂**自述**的证书声明（含颁发/到期日期），未核验。与 supplier_certifications（平台核验记录）严格分离：本列只代表「供应商这么说」，绝不代表平台证实。展示时必须标注 Self-reported。';

-- =============================================================================
-- 3. 授权与联系可见性（同意载体）
-- =============================================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS profile_authorized boolean;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_visibility text;

COMMENT ON COLUMN public.suppliers.profile_authorized IS
  '供应商是否授权平台公开其公司档案（申请表单 Authorize Company Profile）。NULL = 未知/未表态，按未授权处理。';
COMMENT ON COLUMN public.suppliers.contact_visibility IS
  '联系方式的可见范围（申请表单 Contact Visibility）：public / platform / private。NULL 按 private 处理。';

-- =============================================================================
-- 4. 约束（幂等：Postgres 不支持 ADD CONSTRAINT IF NOT EXISTS，走 DO 块）
-- =============================================================================
DO $$
BEGIN
  -- 出口起始年：合理区间，挡住 1900 / 9999 这类脏值
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_export_since_range'
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT suppliers_export_since_range
      CHECK (export_since IS NULL OR (export_since >= 1800 AND export_since <= 2100));
  END IF;

  -- 自述证书必须是 JSON 数组或 NULL（挡住误写成对象/字符串）
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_self_reported_certs_is_array'
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT suppliers_self_reported_certs_is_array
      CHECK (
        self_reported_certificates IS NULL
        OR jsonb_typeof(self_reported_certificates) = 'array'
      );
  END IF;

  -- 联系可见性只允许三个值（NULL 表示未表态）
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_contact_visibility_values'
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT suppliers_contact_visibility_values
      CHECK (contact_visibility IS NULL OR contact_visibility IN ('public','platform','private'));
  END IF;
END $$;

-- =============================================================================
-- 5. 让 PostgREST 立刻感知新列（否则 PGRST205 / 列不存在）
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- 6. 自检：应返回 9 行，每行 true
-- =============================================================================
SELECT 'suppliers.' || c.column_name AS added_column, true AS ok
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'suppliers'
  AND c.column_name IN (
    'company_type','english_name','production_capacity','monthly_output',
    'factory_size','export_since','self_reported_certificates',
    'profile_authorized','contact_visibility'
  )
ORDER BY c.column_name;


-- ##############################################################################
-- ## PART 2 / 3 — 008 leads 线索落库表（CS-07）
-- ## 源文件：supabase/migrations/008_leads.sql
-- ##############################################################################

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

-- =============================================================================
-- PART 3 / 3 — 收尾：刷新 PostgREST 缓存 + 自检
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- 自检 A：009 的 9 个新列（应返回 9 行）
SELECT '009 suppliers.' || c.column_name AS item, true AS ok
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name = 'suppliers'
  AND c.column_name IN (
    'company_type','english_name','production_capacity','monthly_output',
    'factory_size','export_since','self_reported_certificates',
    'profile_authorized','contact_visibility'
  )
ORDER BY c.column_name;

-- 自检 B：leads 表存在且列数正确（应返回 1 行，col_count = 22）
SELECT '008 leads' AS item, COUNT(*) AS col_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads';

-- 自检 C：leads 三个 CHECK 与两条 RLS policy（各应返回预期条数）
SELECT 'leads CHECKs' AS item, COUNT(*) AS n
FROM pg_constraint
WHERE conrelid = 'public.leads'::regclass AND contype = 'c';

SELECT 'leads policies' AS item, COUNT(*) AS n
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'leads';

-- =============================================================================
-- 执行完毕。请把上面三段自检结果回贴，用于逐条核对。
-- =============================================================================
