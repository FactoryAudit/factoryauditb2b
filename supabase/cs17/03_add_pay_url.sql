-- =============================================================================
-- CS-17 / 03_add_pay_url.sql —— orders 增加 pay_url 列
--
-- 执行通道：node scripts/db-apply-sql.mjs supabase/cs17/03_add_pay_url.sql
--
-- 为什么需要这一列：
--   PayPal 托管收银台的跳转地址只在**创建当次**返回。客户关掉页面后再回到
--   /checkout/ORD-XXXXXX，如果没有存地址，就只能干等邮件 —— 转化率杀手。
--   存进 payload（jsonb）也能用，但"支付链接"是订单的一等字段，
--   混进 raw 输入兜底字段会让后续对账与清理都变脏，所以单独开列。
--
-- 约束：
--   - nullable：人工收款（电汇）的订单没有支付链接
--   - 不回看历史：新列，无数据迁移
-- =============================================================================

BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pay_url text;

COMMENT ON COLUMN public.orders.pay_url IS
  '收款渠道托管收银台地址（如 PayPal approve 链接）。人工收款订单为 NULL。仅服务端写入，前端只读展示。';

COMMIT;

NOTIFY pgrst, 'reload schema';
