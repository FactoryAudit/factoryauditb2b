-- =============================================================================
-- FactoryAuditB2B V2.1 — Supabase 初始 schema
-- 创建日期：2026-09-03
--
-- 设计约束（改动本文件前必读）：
--   1. suppliers.slug 必须与 lib/staticData.ts 的 STATIC_SUPPLIERS.slug 完全一致，
--      否则 /suppliers/{slug} 全部 404，已收录页面掉索引。
--   2. risk_score 语义：分数越高 = 风险越低（与 lib/riskEngine.ts 一致）。
--      阈值 >=85 LOW / >=70 MODERATE / >=55 ELEVATED / >=40 HIGH。
--   3. 应用层字段裁剪（lib/access.ts）是权限主力，RLS 是兜底。
--      因为 Postgres RLS 做不到列级权限，列级一律由应用层控制。
--   4. 所有写操作默认仅 admin；读操作按表分别放开。
-- =============================================================================

-- ---------- 0. 扩展与辅助 ----------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- updated_at 自动维护
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 判断当前请求者是否 admin（供所有 RLS policy 复用，避免重复子查询）
-- SECURITY DEFINER：绕过 RLS 查 profiles，防止 policy 递归
-- 注：is_admin() 的实际定义已移至下方 profiles 建表之后（见第 1 节末尾），
--     因为 SQL 函数在创建时会校验其引用的表是否已存在，必须先建 profiles 再建该函数。

-- =============================================================================
-- 1. profiles —— Supabase Auth 的 public 影子表
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  company     text,
  -- 'buyer'（默认，免费买家）| 'supplier'（供应商侧）| 'admin'（后台管理员）
  role        text NOT NULL DEFAULT 'buyer'
              CHECK (role IN ('buyer', 'supplier', 'admin')),
  locale      text DEFAULT 'en',
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS '用户档案。auth.users 由 Supabase 托管，本表只放业务字段，禁止存密码。';

-- 判断当前请求者是否 admin（供所有 RLS policy 复用，避免重复子查询）
-- SECURITY DEFINER：绕过 RLS 查 profiles，防止 policy 递归
-- 必须在 profiles 表创建之后定义（函数体引用 profiles，否则报 42P01 relation does not exist）
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 新用户注册时自动建 profile（email 从 auth.users 取）
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, locale)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- 2. memberships —— 会员订阅状态
--    Stripe 是真值来源，本表是投影。过期判定必须在应用层做双重校验
--    （status 字段可能因 webhook 延迟而滞后）。
-- =============================================================================
CREATE TABLE IF NOT EXISTS memberships (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 'free'（默认）| 'founding_buyer'（$99/年）
  plan                    text NOT NULL DEFAULT 'free'
                          CHECK (plan IN ('free', 'founding_buyer')),
  -- 'active' | 'canceled' | 'past_due' | 'expired'
  status                  text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'canceled', 'past_due', 'expired')),
  stripe_customer_id      text UNIQUE,
  stripe_subscription_id  text UNIQUE,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS memberships_user_unique ON memberships(user_id);
CREATE INDEX IF NOT EXISTS memberships_stripe_customer ON memberships(stripe_customer_id);

DROP TRIGGER IF EXISTS memberships_set_updated_at ON memberships;
CREATE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN memberships.current_period_end IS
  '订阅到期时间。应用层判定 isFoundingBuyer() 时必须同时检查 status=active 且 (此字段为空 或 > now())。';

-- 新用户注册时自动建一条 free 记录，避免"用户存在但无 membership 记录"的边界态
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO memberships (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();

-- =============================================================================
-- 3. suppliers —— 供应商主表（从 STATIC_SUPPLIERS 迁移）
-- =============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ★ URL 契约：必须与 lib/staticData.ts 的 4 个 slug 完全一致，改了就 404
  slug                text UNIQUE NOT NULL,
  legal_name          text NOT NULL,
  country_code        text NOT NULL,
  city                text NOT NULL,
  industry_code       text,
  business_type       text,
  established         int,
  employees           text,
  main_products       text[] NOT NULL DEFAULT '{}',
  export_markets      text[] NOT NULL DEFAULT '{}',
  verification_status text,
  -- 高分 = 低风险。与 lib/riskEngine.ts 同语义，勿反向。
  risk_score          int CHECK (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)),
  certifications      text[] NOT NULL DEFAULT '{}',
  audit_status        text,
  inspection_history  int NOT NULL DEFAULT 0,
  -- paid 层：8 维风险拆解（company/quality/compliance/production/
  --          supplychain/documentation/certification/digitalFootprint）
  risk_breakdown      jsonb,
  -- 'public'（游客可看全部 public 字段）| 'free' | 'paid'（仅会员）
  access_tier         text NOT NULL DEFAULT 'public'
                      CHECK (access_tier IN ('public', 'free', 'paid')),
  is_published        boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suppliers_country ON suppliers(country_code);
CREATE INDEX IF NOT EXISTS suppliers_industry ON suppliers(industry_code);
CREATE INDEX IF NOT EXISTS suppliers_published ON suppliers(is_published);
-- 目录页按风险分降序（低风险在前）
CREATE INDEX IF NOT EXISTS suppliers_risk ON suppliers(risk_score DESC);

DROP TRIGGER IF EXISTS suppliers_set_updated_at ON suppliers;
CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 4. supplier_capabilities —— 能力标签
-- =============================================================================
CREATE TABLE IF NOT EXISTS supplier_capabilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  -- 'AUDIT_TYPE' | 'STANDARD' | 'TAXONOMY'（与 lib/staticData.ts 的 StaticCapability 一致）
  ref_type    text NOT NULL,
  ref_code    text NOT NULL,
  verified    boolean NOT NULL DEFAULT false,
  -- 'Third Party' | 'Self-Reported'
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capabilities_supplier ON supplier_capabilities(supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS capabilities_dedup
  ON supplier_capabilities(supplier_id, ref_type, ref_code);

-- =============================================================================
-- 5. supplier_evidence —— 证据记录
-- =============================================================================
CREATE TABLE IF NOT EXISTS supplier_evidence (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type        text NOT NULL,
  -- VERIFIED | PENDING | UNVERIFIED | REJECTED
  status      text NOT NULL,
  source      text,
  date        date,
  note        text,
  -- 'public'（游客可见）| 'paid'（仅会员）
  visibility  text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'paid')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_supplier ON supplier_evidence(supplier_id);
CREATE INDEX IF NOT EXISTS evidence_visibility ON supplier_evidence(visibility);

COMMENT ON COLUMN supplier_evidence.visibility IS
  'paid 的证据不参与 lastChecked 计算，避免付费内容从公开元数据里泄漏。';

-- =============================================================================
-- 6. saved_suppliers —— 收藏
-- =============================================================================
CREATE TABLE IF NOT EXISTS saved_suppliers (
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS saved_user ON saved_suppliers(user_id);

-- =============================================================================
-- 7. profile_views —— 免费额度计数
--    去重计数：同一用户同月看同一供应商，只消耗 1 次额度。
--    唯一索引保证幂等，重复 POST 不会重复扣额度。
-- =============================================================================
CREATE TABLE IF NOT EXISTS profile_views (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  supplier_id   uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  -- 当月 1 号（用于按月重置额度，不用 timestamp 避免月末边界问题）
  period_month  date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_views_dedup
  ON profile_views(user_id, supplier_id, period_month);
CREATE INDEX IF NOT EXISTS profile_views_user_month
  ON profile_views(user_id, period_month);

COMMENT ON TABLE profile_views IS
  '免费用户每月 FREE_PROFILE_LIMIT(=5) 次额度。按 (user,supplier,month) 去重，重复访问不重复扣。';

-- =============================================================================
-- 8. rfqs / rfq_matches —— 询价单与匹配
-- =============================================================================
CREATE TABLE IF NOT EXISTS rfqs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 对外展示用短号（RFQ-XXXXXX），不暴露内部 uuid
  reference_id  text UNIQUE NOT NULL,
  -- 游客提交的 RFQ 允许 user_id 为空
  user_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  company       text,
  email         text NOT NULL,
  product       text NOT NULL,
  quantity      text,
  country       text,
  message       text,
  -- new | reviewing | matched | closed
  status        text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'reviewing', 'matched', 'closed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rfqs_user ON rfqs(user_id);
CREATE INDEX IF NOT EXISTS rfqs_status ON rfqs(status);
CREATE INDEX IF NOT EXISTS rfqs_created ON rfqs(created_at DESC);

DROP TRIGGER IF EXISTS rfqs_set_updated_at ON rfqs;
CREATE TRIGGER rfqs_set_updated_at
  BEFORE UPDATE ON rfqs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS rfq_matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id      uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  note        text,
  -- suggested | contacted | won | lost
  status      text NOT NULL DEFAULT 'suggested'
              CHECK (status IN ('suggested', 'contacted', 'won', 'lost')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rfq_matches_rfq ON rfq_matches(rfq_id);
CREATE UNIQUE INDEX IF NOT EXISTS rfq_matches_dedup ON rfq_matches(rfq_id, supplier_id);

-- =============================================================================
-- 9. stripe_events —— Webhook 幂等表
--    Stripe 会重复投递同一事件，必须去重，否则重复开通/重复扣额度。
-- =============================================================================
CREATE TABLE IF NOT EXISTS stripe_events (
  id           text PRIMARY KEY,      -- Stripe event.id
  type         text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE stripe_events IS
  'Stripe webhook 幂等表。处理前先 INSERT，主键冲突即说明已处理过，直接返回 200。';

-- =============================================================================
--                          RLS（Row Level Security）
-- 设计原则：应用层（lib/access.ts）是权限主力，RLS 是第二道防线。
--           服务端统一用 service_role 读写（绕过 RLS），RLS 主要防止
--           anon key 被直接拿去刷数据。
-- =============================================================================

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_evidence     ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_views         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_matches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events         ENABLE ROW LEVEL SECURITY;

-- ---------- profiles：只能看自己，admin 看全部 ----------
DROP POLICY IF EXISTS profiles_select_self ON profiles;
CREATE POLICY profiles_select_self ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_self ON profiles;
CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));
  -- ↑ 禁止用户把自己提权成 admin

DROP POLICY IF EXISTS profiles_admin_all ON profiles;
CREATE POLICY profiles_admin_all ON profiles
  FOR ALL USING (is_admin());

-- ---------- memberships：只能看自己的订阅，写操作仅服务端 ----------
DROP POLICY IF EXISTS memberships_select_self ON memberships;
CREATE POLICY memberships_select_self ON memberships
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS memberships_admin_all ON memberships;
CREATE POLICY memberships_admin_all ON memberships
  FOR ALL USING (is_admin());
-- 注意：INSERT/UPDATE 由服务端 service_role 执行（webhook），不开放给客户端

-- ---------- suppliers：所有人可读已发布的；写操作仅 admin ----------
DROP POLICY IF EXISTS suppliers_select_published ON suppliers;
CREATE POLICY suppliers_select_published ON suppliers
  FOR SELECT USING (is_published = true);
  -- 列级裁剪由 lib/access.ts 负责，RLS 做不到列级

DROP POLICY IF EXISTS suppliers_admin_all ON suppliers;
CREATE POLICY suppliers_admin_all ON suppliers
  FOR ALL USING (is_admin());

-- ---------- supplier_capabilities / supplier_evidence ----------
DROP POLICY IF EXISTS capabilities_select ON supplier_capabilities;
CREATE POLICY capabilities_select ON supplier_capabilities
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM suppliers s WHERE s.id = supplier_id AND s.is_published = true)
  );

DROP POLICY IF EXISTS capabilities_admin ON supplier_capabilities;
CREATE POLICY capabilities_admin ON supplier_capabilities
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS evidence_select ON supplier_evidence;
CREATE POLICY evidence_select ON supplier_evidence
  FOR SELECT USING (
    visibility = 'public'
    AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = supplier_id AND s.is_published = true)
  );

DROP POLICY IF EXISTS evidence_admin ON supplier_evidence;
CREATE POLICY evidence_admin ON supplier_evidence
  FOR ALL USING (is_admin());

-- ---------- saved_suppliers / profile_views：只能操作自己的 ----------
DROP POLICY IF EXISTS saved_all_self ON saved_suppliers;
CREATE POLICY saved_all_self ON saved_suppliers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS views_insert_self ON profile_views;
CREATE POLICY views_insert_self ON profile_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS views_select_self ON profile_views;
CREATE POLICY views_select_self ON profile_views
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS views_admin ON profile_views;
CREATE POLICY views_admin ON profile_views
  FOR ALL USING (is_admin());

-- ---------- rfqs：自己看自己的；游客可提交 ----------
DROP POLICY IF EXISTS rfqs_select_self ON rfqs;
CREATE POLICY rfqs_select_self ON rfqs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS rfqs_insert_anyone ON rfqs;
CREATE POLICY rfqs_insert_anyone ON rfqs
  FOR INSERT WITH CHECK (true);
  -- 游客也能发 RFQ（user_id 为 null），这是转化主线，不能挡

DROP POLICY IF EXISTS rfqs_admin_all ON rfqs;
CREATE POLICY rfqs_admin_all ON rfqs
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS rfq_matches_admin ON rfq_matches;
CREATE POLICY rfq_matches_admin ON rfq_matches
  FOR ALL USING (is_admin());

-- 用户可以看到"自己 RFQ 的匹配结果"
DROP POLICY IF EXISTS rfq_matches_select_owner ON rfq_matches;
CREATE POLICY rfq_matches_select_owner ON rfq_matches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rfqs r WHERE r.id = rfq_id AND r.user_id = auth.uid())
  );

-- ---------- stripe_events：仅服务端（service_role），客户端一律拒绝 ----------
-- 不建任何 policy = 默认全部拒绝，只有 service_role 能访问。这是有意的。

-- =============================================================================
-- 完成。下一步：跑 scripts/seed-suppliers.mjs 迁移 4 家供应商。
-- =============================================================================
