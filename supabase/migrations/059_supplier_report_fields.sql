-- 059_supplier_report_fields.sql
--
-- 目的（2026-11-16）：让「导出报告直接可用」。
--   13 章尽职调查报告共 40 个字段，但供应商档案里缺 5 项**只能由企业提供**的信息，
--   导致报告这几格永远是空的。补齐后：
--     供应商填档案 → 报告自动带出 → 平台只需补核验结论 → 一键导出
--
-- 只加列、不加约束、不设 DEFAULT（避免回填历史行成假数据）。
-- 🔴 缺失值一律 NULL，绝不用空串或 0 顶替（R76 铁律）。

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS legal_representative  text,
  ADD COLUMN IF NOT EXISTS registered_capital    text,
  ADD COLUMN IF NOT EXISTS business_scope        text,
  ADD COLUMN IF NOT EXISTS production_workers    text,
  ADD COLUMN IF NOT EXISTS reference_customers   text;

COMMENT ON COLUMN public.suppliers.legal_representative IS '法定代表人（报告 02 主体档案用）';
COMMENT ON COLUMN public.suppliers.registered_capital   IS '注册资本，保留原币种与单位文本，如「人民币 800 万元」';
COMMENT ON COLUMN public.suppliers.business_scope       IS '经营范围，取自营业执照原文';
COMMENT ON COLUMN public.suppliers.production_workers   IS '生产一线人数（与 employees 总数区分）';
COMMENT ON COLUMN public.suppliers.reference_customers  IS '可披露的参考客户，逗号分隔；企业自愿填写';

-- PostgREST 需要重载 schema 才能识别新列
NOTIFY pgrst, 'reload schema';
