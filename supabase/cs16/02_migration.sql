-- =============================================================================
-- CS-16 / 02_migration.sql —— Supplier Management V1 结构迁移
--
-- 执行通道：node scripts/db-apply-sql.mjs supabase/cs16/02_migration.sql
-- 前置：无（幂等，可重复执行）
-- 性质：**只加结构，0 条业务数据 INSERT/UPDATE/DELETE**。
--
-- -----------------------------------------------------------------------------
-- 铁律（本迁移的全部约束）
-- -----------------------------------------------------------------------------
--   1. 只加列 / 建表 / 扩展 admin_audit_log，不删、不改、不锁表（suppliers 极小）。
--   2. 不动任何现有 RLS / policy（除新建的 supplier_consents）。
--   3. 不给 anon / authenticated 任何写权限（RLS 默认拒绝 + REVOKE 双重）。
--      service_role 写权限**必须保留**（server route 唯一写入通道，BYPASSRLS）。
--   4. supplier_consents 是历史留痕，仅追加：无 UPDATE/DELETE policy，仅 service_role INSERT。
--   5. 全部 IF NOT EXISTS，可重复执行。
--   6. 末尾 NOTIFY pgrst reload schema（否则 PGRST205）。
-- =============================================================================

BEGIN;


-- =============================================================================
-- 1. suppliers 新增 13 个 nullable 列（不破坏现有档案内容）
-- =============================================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS province              text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_person        text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_email         text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS whatsapp              text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_description   text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS authorized_at         timestamptz;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS authorized_by         text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS consent_version       text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS consent_ip            text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS consent_user_agent    text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_by            text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS unpublished_at        timestamptz;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS unpublished_by        text;

COMMENT ON COLUMN public.suppliers.province IS '省份/州（注册表单新增业务字段）。';
COMMENT ON COLUMN public.suppliers.contact_person IS '联系人姓名。FREE 层（注册买家可见），不进 PUBLIC（CS-12 公开边界只含工商登记级）。';
COMMENT ON COLUMN public.suppliers.contact_email IS '联系邮箱。同 contact_person 层级。';
COMMENT ON COLUMN public.suppliers.whatsapp IS 'WhatsApp 号码。同 contact_person 层级。';
COMMENT ON COLUMN public.suppliers.company_description IS '公司简介。同 contact_person 层级。';
COMMENT ON COLUMN public.suppliers.authorized_at IS '后台授权时间戳（profile_authorized 置 true 时写入）。';
COMMENT ON COLUMN public.suppliers.authorized_by IS '授权操作人（admin email / system）。';
COMMENT ON COLUMN public.suppliers.consent_version IS '注册时勾选的 consent 条款版本号。';
COMMENT ON COLUMN public.suppliers.consent_ip IS '注册提交客户端 IP（服务端取）。';
COMMENT ON COLUMN public.suppliers.consent_user_agent IS '注册提交客户端 UA（服务端取）。';
COMMENT ON COLUMN public.suppliers.updated_by IS '最后编辑操作人（admin email / system）。';
COMMENT ON COLUMN public.suppliers.unpublished_at IS '下架时间戳（spec 七）。';
COMMENT ON COLUMN public.suppliers.unpublished_by IS '下架操作人。';


-- =============================================================================
-- 2. supplier_consents —— 注册授权历史留痕（仅追加，不可篡改）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.supplier_consents (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       uuid        NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id           uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  consent_type      text        NOT NULL DEFAULT 'supplier_profile',
  consent_version   text        NOT NULL,
  consent_given     boolean     NOT NULL DEFAULT true,
  consent_timestamp timestamptz NOT NULL DEFAULT now(),
  ip_address        text,
  user_agent        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_consents_supplier ON public.supplier_consents(supplier_id);

COMMENT ON TABLE public.supplier_consents IS '注册/授权同意历史。仅追加，不可篡改：无 UPDATE/DELETE policy，仅 service_role 可 INSERT。';
COMMENT ON COLUMN public.supplier_consents.consent_type IS '当前仅 supplier_profile（同意平台展示所提交公司资料）。';
COMMENT ON COLUMN public.supplier_consents.consent_version IS '同意条款版本号，便于未来条款变更时追溯。';


-- =============================================================================
-- 3. admin_audit_log 扩展（spec 十：5 类操作简单日志）
-- =============================================================================
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS notes      text;

COMMENT ON COLUMN public.admin_audit_log.ip_address IS '管理操作来源 IP（服务端取）。';
COMMENT ON COLUMN public.admin_audit_log.notes IS '操作备注（如发布闸门原因）。';


-- =============================================================================
-- 4. RLS —— supplier_consents
--    PostgreSQL RLS 默认语义：开启后没有匹配的 policy = 拒绝。
--    真正生效链条：① RLS 开启 ② 只有 admin_select 一条策略 ③ REVOKE 在 GRANT 层再收一次。
--    生产写入一律走 server route 的 service_role（BYPASSRLS）。
-- =============================================================================
ALTER TABLE public.supplier_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_consents_admin_select ON public.supplier_consents;
CREATE POLICY supplier_consents_admin_select ON public.supplier_consents
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 防御纵深：anon 全收；authenticated 只留 SELECT（policy 已限 is_admin），写全部收回（含 MAINTAIN）
REVOKE ALL ON public.supplier_consents FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.supplier_consents FROM authenticated;
GRANT  SELECT ON public.supplier_consents TO authenticated;
-- service_role 不动（INSERT 通道，BYPASSRLS）


-- =============================================================================
-- 5. 版本登记
-- =============================================================================
INSERT INTO public.schema_migrations (version, note)
VALUES (
  '016',
  'CS-16: suppliers +13 cols + supplier_consents table + admin_audit_log(ip_address,notes) + RLS(admin select only) + revoke write from anon/authenticated'
)
ON CONFLICT (version) DO NOTHING;


-- =============================================================================
-- 6. PostgREST 重新加载 schema（否则 REST 报 PGRST205）
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;


-- =============================================================================
-- ✅ 执行成功标志：`Success. No rows returned`
--    下一步：跑 03_postcheck.sql（只读）确认结构到位。
-- =============================================================================
