-- =============================================================================
-- CS-21 / 01_supplier_assessments.sql —— 三标签审核体系：审核登记主表
--
-- 执行通道：node scripts/db-apply-sql.mjs supabase/cs21/01_supplier_assessments.sql
-- 性质：只加结构（幂等），0 条业务数据。
--
-- 设计要点（与既有实现的边界）：
--   1. 三标签相互独立：工厂自评估 / 平台在线评估 / 平台现场审核 可同时持有。
--      suppliers.verification_level 是单枚举列（CS-01），无法表达「同时多标签」，
--      故本表每供应商每种类型一行，作为三标签的权威源。
--   2. assessment_type 取值对齐 verification_level 既有词汇：
--      self_assessment(工厂自评估) / platform_assessment(平台在线评估) / on_site_audit(平台现场审核，新增)。
--   3. 全部私有：REVOKE ALL FROM anon, authenticated；仅 service_role(BYPASSRLS) 可访问，
--      由应用层按角色(admin/supplier/buyer)判定。绝不给 anon/authenticated 直接权限。
--   4. risk_level 用平台五档(low/moderate/elevated/high/critical)，与清单 LOW/MED/HIGH
--      口径不同（README 冲突清单 #1），不可混用。
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_assessments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  assessment_type  text NOT NULL
                     CHECK (assessment_type IN ('self_assessment','platform_assessment','on_site_audit')),
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','submitted','under_review','published','rejected')),
  -- 标签① 工厂自评估：supplier 自填两份清单的 72 项结果
  responses_json   jsonb DEFAULT NULL,
  self_summary     text,
  -- 标签②③ 平台在线评估 / 平台现场审核：平台出具报告
  report_id        uuid REFERENCES public.audit_reports(id) ON DELETE SET NULL,
  report_number    text,
  report_summary   text,
  overall_grade    text,
  risk_level       text CHECK (risk_level IN ('low','moderate','elevated','high','critical') OR risk_level IS NULL),
  -- 标签③ SLA：供应商申请现场审核 -> 平台 7 个工作日内完成（submitted_at + 7 工作日）
  sla_due_at       timestamptz,
  -- 审核流转轨迹
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  published_at     timestamptz,
  reviewed_by      text,
  review_notes     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, assessment_type)
);

CREATE INDEX IF NOT EXISTS supplier_assessments_supplier ON public.supplier_assessments(supplier_id);
CREATE INDEX IF NOT EXISTS supplier_assessments_type    ON public.supplier_assessments(assessment_type);
CREATE INDEX IF NOT EXISTS supplier_assessments_status  ON public.supplier_assessments(status);

COMMENT ON TABLE public.supplier_assessments IS
  '三标签审核登记：self_assessment(工厂自评估)/platform_assessment(平台在线评估)/on_site_audit(平台现场审核)。每种类型每供应商一行；状态机 draft→submitted→under_review→published。';
COMMENT ON COLUMN public.supplier_assessments.risk_level IS
  '平台五档风险(low/moderate/elevated/high/critical)，与清单 LOW/MED/HIGH 口径不同，不可混用。';
COMMENT ON COLUMN public.supplier_assessments.sla_due_at IS
  '标签③现场审核 SLA 截止：供应商 submitted_at + 7 个工作日。NULL 表示非现场审核或尚未申请。';

-- RLS：私有，仅 service_role（BYPASSRLS）可访问。
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['public.supplier_assessments']) LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('REVOKE ALL ON %s FROM anon, authenticated;', t);
  END LOOP;
END $$;

INSERT INTO public.schema_migrations (version, note)
VALUES ('021', 'CS-21: supplier_assessments table (three-tag audit registry) + RLS(revoke all anon+authenticated, service_role only)')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
