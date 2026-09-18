-- =============================================================================
-- CS-17 / 02_migration.sql —— Commerce V1：服务订单（public.orders）
--
-- 执行通道：node scripts/db-apply-sql.mjs supabase/cs17/02_migration.sql
-- 前置：无（幂等，可重复执行）
-- 性质：**只加结构，0 条业务数据 INSERT/UPDATE/DELETE**。
--
-- -----------------------------------------------------------------------------
-- 为什么建这张表（商业化 = 让"我要买"有落点）
-- -----------------------------------------------------------------------------
--   在此之前全站只能收线索（public.leads / public.rfqs），**收不到钱**。
--   orders 是第一条真正的交易记录：订单号 + 服务端算出的金额 + 收款方式 + 核销状态。
--
-- -----------------------------------------------------------------------------
-- 铁律（本迁移的全部约束）
-- -----------------------------------------------------------------------------
--   1. 只建新表，不动任何既有表 / 既有 RLS / 既有 policy。
--   2. **anon 与 authenticated 一律零权限**（连 SELECT 都不给）。
--      这与 CS-16 的"GRANT SELECT TO authenticated"不同，是刻意的：
--      orders 含客户 PII（email / company / country），
--      任何已登录用户都能 SELECT 全表 = 把别人的订单读走。
--      唯一读写通道 = service_role（BYPASSRLS），后台已经 requireAdmin() 二次校验。
--   3. 金额 amount_minor 为 NULL 表示"需人工报价"——
--      **绝不用 0 顶替**（0 会被读成"免费"，是资损方向的事故）。
--   4. 全部 IF NOT EXISTS，可重复执行。
--   5. 末尾 NOTIFY pgrst reload schema（否则 PGRST205）。
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. public.orders —— 服务订单
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- 对外订单号 ORD-XXXXXX（lib/commerce.ts makeOrderReferenceId 生成，
  -- 撞号由应用层重试解决，与 public.leads.reference_id 同一字符集）
  reference_id    text        NOT NULL UNIQUE,

  service_code    text        NOT NULL,
  service_name    text        NOT NULL,   -- 下单时快照，避免价目表改名后历史订单失真
  quantity        integer     NOT NULL DEFAULT 1,

  currency        text        NOT NULL DEFAULT 'USD',
  -- 总金额（最小单位）。NULL = 需人工报价，绝不是 0。
  amount_minor    integer     NULL,

  status          text        NOT NULL DEFAULT 'pending_payment',

  email           text        NOT NULL,
  company         text        NULL,
  country         text        NULL,
  supplier_slug   text        NULL,
  locale          text        NOT NULL DEFAULT 'en',
  source_path     text        NULL,
  notes           text        NULL,

  provider        text        NULL,       -- 收款渠道：paypal | bank_transfer | null（人工）
  provider_ref    text        NULL,       -- 渠道侧订单号
  payload         jsonb       NULL,       -- 原始业务字段兜底

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz NULL
);

CREATE INDEX IF NOT EXISTS orders_status_created_idx
  ON public.orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_email_idx
  ON public.orders (email);

COMMENT ON TABLE  public.orders IS 'CS-17 Commerce V1：服务订单。服务端价目表定价，前端不可传金额。';
COMMENT ON COLUMN public.orders.reference_id IS '对外订单号 ORD-XXXXXX。撞号由 lib/commerce.ts 重试解决。';
COMMENT ON COLUMN public.orders.amount_minor IS '总金额（USD 美分）。NULL = 需人工报价；缺失绝不是 0。';
COMMENT ON COLUMN public.orders.status IS 'pending_payment | paid | cancelled | refunded。流转见 lib/commerce.ts canTransition。';
COMMENT ON COLUMN public.orders.provider IS '收款渠道。null 表示尚未生成收款方式（人工跟进）。';

-- 状态白名单（与 lib/commerce.ts ORDER_STATUSES 一一对应）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_status_check
      CHECK (status IN ('pending_payment', 'paid', 'cancelled', 'refunded'));
  END IF;
END $$;

-- 金额：要么 NULL（人工报价），要么正数
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_amount_minor_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_amount_minor_check
      CHECK (amount_minor IS NULL OR amount_minor > 0);
  END IF;
END $$;

-- 数量：1..30（与 lib/commerce.ts MAX_QUANTITY 一致）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_quantity_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_quantity_check
      CHECK (quantity >= 1 AND quantity <= 30);
  END IF;
END $$;

-- 币种一期只允许 USD（不预置"以后会用"的多币种，避免误配）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_currency_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_currency_check
      CHECK (currency = 'USD');
  END IF;
END $$;

-- 邮箱非空（后端已校验，这里是最后一道）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_email_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_email_check
      CHECK (length(email) >= 3 AND position('@' in email) > 1);
  END IF;
END $$;


-- =============================================================================
-- 2. updated_at 触发器（自建函数，不依赖其它迁移的命名）
-- =============================================================================
CREATE OR REPLACE FUNCTION public.orders_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_set_updated_at();


-- =============================================================================
-- 3. RLS：启用 + 零 policy = 拒绝所有非 owner 角色
--    （service_role 自带 BYPASSRLS，是唯一读写通道）
-- =============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 4. 授权：anon / authenticated 零权限（含 SELECT）
--    ⚠️ REVOKE 清单必须含 MAINTAIN —— PG17 public schema 默认授权残留
-- =============================================================================
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.orders FROM authenticated;

COMMIT;

-- PostgREST 重新加载 schema（否则新表返回 PGRST205）
NOTIFY pgrst, 'reload schema';
