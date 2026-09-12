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
