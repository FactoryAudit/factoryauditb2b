-- =============================================================================
-- FactoryAuditB2B V2.1 — 002_payments：多渠道支付（PayPal + 支付宝）
-- 创建日期：2026-09-04
--
-- 背景：001_init.sql 的 memberships / stripe_events 是 Stripe 专用结构。
--       现要支持 PayPal（订阅 + 一次性）与支付宝（国内人民币 + 跨境），
--       必须把"渠道"和"计费形态"提升为一等公民，而不是继续往表上糊 Stripe 字段。
--
-- 设计约束（改动本文件前必读）：
--   1. 向后兼容：stripe_customer_id / stripe_subscription_id 一列都不删，
--      老数据通过本脚本回填 provider='stripe'。V2.0/V2.1 已跑通的 Stripe 路径零改动。
--   2. 幂等：全部用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，可重复执行。
--   3. 单一事实源：价格仍以 lib/suppliers.ts 的 MEMBERSHIP_PRICE_USD 为准，
--      本表只记录"实际成交"的金额与币种（用于对账，不用于展示定价）。
--   4. RLS：memberships 已有 policy（本人可读 / admin 全权），新增列自动受同一 policy 保护。
--      payment_events 与 stripe_events 一样：不建任何 policy = 仅 service_role 可访问。
--
-- 为什么 provider/order id 分开存而不是合并成一个 JSON：
--   对账、退款、争议处理都要按 provider_subscription_id 精确查，
--   塞进 jsonb 就没法建索引、没法加唯一约束，属于自找麻烦。
-- =============================================================================

-- ---------- 1. memberships：渠道与计费形态 ----------

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe'
    CHECK (provider IN ('stripe', 'paypal', 'alipay'));

-- 'subscription'（每年自动续费）| 'one_time'（买一年，到期手动续）
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS billing_mode text
    CHECK (billing_mode IN ('subscription', 'one_time'));

-- 成交币种。美元会员 USD；国内支付宝人民币 CNY。
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- 成交金额（最小单位：USD=美分，CNY=分）。
-- 为什么存整数：浮点存金额是经典事故源，对账必出问题。
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS amount_minor integer;

-- 各渠道的"客户 id"与"一次性订单 id"。
-- 与既有 stripe_customer_id / stripe_subscription_id 并存，
-- 由应用层决定写哪个（Stripe 继续写 stripe_*，新渠道写 provider_*）。
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS provider_customer_id text;

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS provider_order_id text;

COMMENT ON COLUMN memberships.provider IS
  '支付渠道。stripe=Stripe（V2.1 既有路径）；paypal=PayPal；alipay=支付宝（国内人民币或跨境）。';
COMMENT ON COLUMN memberships.billing_mode IS
  'subscription=每年自动续费；one_time=买一年、到期手动续。PayPal 两种都能做；支付宝普通跨境收款只支持 one_time。';
COMMENT ON COLUMN memberships.amount_minor IS
  '成交金额最小单位（USD 美分 / CNY 分）。仅用于对账，不用于展示定价——展示价仍取 lib/suppliers.ts。';

-- 回填老数据：凡是有 Stripe id 的，标成 stripe + subscription
UPDATE memberships
   SET provider = 'stripe',
       billing_mode = 'subscription'
 WHERE provider = 'stripe'
   AND (stripe_subscription_id IS NOT NULL OR stripe_customer_id IS NOT NULL);

-- 查询常用：按渠道统计（后台"会员管理"页要按渠道分组看）
CREATE INDEX IF NOT EXISTS memberships_provider ON memberships(provider);
CREATE INDEX IF NOT EXISTS memberships_period_end ON memberships(current_period_end);

-- ---------- 2. payment_events：泛化的 webhook 幂等表 ----------
--
-- 为什么新开一张而不是改 stripe_events：
--   stripe_events 主键是 Stripe 的 event.id（形如 evt_xxx），
--   PayPal 的 event id 与支付宝的 trade_no 格式完全不同，
--   强行共用一张表会让"主键冲突即已处理"这个幂等前提变脆弱。
--   新表把 provider 纳入主键，冲突判断天然带渠道隔离。
--
-- 幂等用法（与 stripe_events 完全一致）：
--   处理前先 INSERT；主键冲突 = 已处理过 → 直接返回 200，绝不做第二次业务动作。

CREATE TABLE IF NOT EXISTS payment_events (
  provider     text NOT NULL CHECK (provider IN ('stripe', 'paypal', 'alipay')),
  event_id     text NOT NULL,
  event_type   text NOT NULL,
  payload      jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

CREATE INDEX IF NOT EXISTS payment_events_type ON payment_events(provider, event_type);
CREATE INDEX IF NOT EXISTS payment_events_time ON payment_events(processed_at DESC);

COMMENT ON TABLE payment_events IS
  '多渠道 webhook 幂等表。Stripe/PayPal/支付宝都会重复投递同一事件，'
  '处理前先 INSERT，主键冲突即说明已处理过，直接返回 200。'
  '不建任何 RLS policy = 仅 service_role 可访问（与 stripe_events 同策略）。';

-- =============================================================================
-- 完成。下一步：
--   1. 在 Supabase SQL Editor 执行本文件，再跑 NOTIFY pgrst, 'reload schema';
--   2. 代码实现 lib/payments/ 抽象层 + /api/paypal/* + /api/alipay/*
--   3. 自查：SELECT count(*) FROM information_schema.columns WHERE table_name='memberships';
-- =============================================================================
