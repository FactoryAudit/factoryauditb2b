-- 041_buyer_intake_fields.sql
--
-- 目的：买家注册时补齐「可撮合」所需的最小画像。
--   此前 profiles 只有 email / full_name / company，注册完无法判断这个买家
--   买什么、发到哪个港口、需要什么服务 —— 25 个买家账号里没有一个能直接拿去匹配供应商。
--
-- 字段语义（全部可空，历史行不受影响）：
--   phone           联系方式（WhatsApp / 电话，国际格式由前端提示，不强制规范）
--   buyer_products  关注/采购的产品（自由文本，一行一项，前端 textarea）
--   destination_port 目的港（自由文本：Jebel Ali / Felixstowe / Los Angeles…）
--   services_needed 需要的服务，白名单多选：audit / inspection / sourcing / due_diligence
--
-- 安全：profiles 已有 RLS（select self / admin all），新增列沿用表级策略；
--      写入只发生在服务端（service role），前端不直连。

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS buyer_products text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS destination_port text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS services_needed text[];

COMMENT ON COLUMN profiles.phone IS '买家联系方式（WhatsApp / 电话），注册时选填';
COMMENT ON COLUMN profiles.buyer_products IS '买家关注或采购的产品，自由文本，一行一项';
COMMENT ON COLUMN profiles.destination_port IS '买家目的港，注册时选填';
COMMENT ON COLUMN profiles.services_needed IS '买家需要的服务，白名单：audit / inspection / sourcing / due_diligence';

-- PostgREST 在 DDL 后需要重载 schema，否则新列不可见（项目既有约定）
NOTIFY pgrst, 'reload schema';
