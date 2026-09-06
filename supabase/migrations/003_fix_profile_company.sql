-- 003_fix_profile_company.sql
--
-- 问题：注册时填的公司名没有存进 profiles.company。
--
-- 根因：001_init.sql 的 handle_new_user() 触发器只从
--   raw_user_meta_data 里取了 full_name 和 locale，漏了 company。
--   而 /api/auth/signup 是传了 company 的（options.data.company），
--   所以数据到了 auth.users，却没被同步到 profiles。
--
-- 影响：admin 后台看不到买家的公司名 —— B2B 场景里公司名是要跟进客户的关键字段。
--
-- 修复：重定义触发器，补上 company。
-- 注意：本文件只改函数定义，不动数据，可安全重复执行（CREATE OR REPLACE）。
--       已经注册的老用户需要单独补 company（用 service_role 或 SQL 手动 UPDATE）。

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, locale, company)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en'),
    COALESCE(NEW.raw_user_meta_data->>'company', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 触发器本身不用重建（001 里已建 on_auth_user_created），
-- 但重复执行一次 CREATE OR REPLACE FUNCTION 不会影响它。

COMMENT ON FUNCTION handle_new_user() IS
  '新用户注册时同步 profile；company 字段在 003 补齐';
