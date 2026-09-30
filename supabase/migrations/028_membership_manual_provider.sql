-- =============================================================================
-- FactoryAuditB2B — 028：memberships.provider 增加 'manual' 取值
-- 创建日期：2026-09-30
--
-- 为什么需要本迁移：
--   002_payments.sql 把 provider 约束为 ('stripe','paypal','alipay')。
--   但本项目的实际成交路径是「先跑询盘 + 线下成交」—— 买家谈定后由运营在
--   后台手动开通会员，这笔钱不走任何支付渠道，webhook 永远不会触发。
--   如果没有 'manual' 取值，手动开通只能写 provider='stripe'，
--   后果：对账时分不清「Stripe 真实收款」与「线下人工开通」，等于把账搅浑。
--
-- 设计约束：
--   1. 纯增量：只放宽 CHECK，不动任何列、不删任何数据。
--   2. 幂等：DROP CONSTRAINT IF EXISTS 后可重复执行。
--   3. 向后兼容：既有 stripe/paypal/alipay 取值全部保留，老数据零影响。
--   4. 只放宽不收紧：即使将来去掉手动开通功能，历史 manual 行仍然合法。
--
-- 注意：ADD CONSTRAINT 会全表校验一次。memberships 当前为个位数行，代价可忽略；
--       若某天该表很大，应先加 NOT VALID 再单独 VALIDATE。
-- =============================================================================

-- 先确认没有越界数据（若有，ADD CONSTRAINT 会失败并中止，属预期保护）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM memberships
     WHERE provider IS NOT NULL
       AND provider NOT IN ('stripe', 'paypal', 'alipay', 'manual')
  ) THEN
    RAISE EXCEPTION 'memberships.provider 存在越界取值，请先人工处理再执行本迁移';
  END IF;
END $$;

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_provider_check;

ALTER TABLE memberships ADD CONSTRAINT memberships_provider_check
  CHECK (provider IN ('stripe', 'paypal', 'alipay', 'manual'));

COMMENT ON COLUMN memberships.provider IS
  '支付渠道。stripe=Stripe；paypal=PayPal；alipay=支付宝；'
  'manual=运营人员在后台手动开通（线下成交，不经支付渠道，无 webhook）。';

-- 自助核验：
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'memberships_provider_check';
