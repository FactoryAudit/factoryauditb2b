-- =============================================================================
-- CS-20 / 02_migration.sql —— 每工厂「报告正文」存储（报告编辑器 V1）
--
-- 执行通道：node scripts/db-apply-sql.mjs supabase/cs20/02_migration.sql
-- 前置：无（幂等，可重复执行）
-- 性质：**只加结构，0 条业务数据 INSERT/UPDATE/DELETE**。
--
-- -----------------------------------------------------------------------------
-- 背景（为什么需要这张表）
-- -----------------------------------------------------------------------------
--   现状四层（2026-09-18 实查）：
--     ① /admin/report-standard   = 全局样张，13 章数据硬编码在 lib/standardReport.ts，不可编辑
--     ② /admin/suppliers/[slug]  = 每工厂「核验报告」导出（lib/supplierReportHtml.ts，只读、自动取 DB 真值）
--     ③ audit_reports 等 3 表    = CS-18 建好，但只有读（lib/audits.ts），后台签不出去
--     ④ 缺口                     = **报告正文没有存储**，suppliers 表也没有 13 章对应列
--   本迁移只补 ④ 的存储层：每工厂一行可编辑的报告正文。
--
-- -----------------------------------------------------------------------------
-- 铁律（本迁移的全部约束）
-- -----------------------------------------------------------------------------
--   1. 只建表 / 建索引 / 加触发器，不删、不改任何现有表。
--   2. 不动任何现有 RLS / policy（除新建的 supplier_reports）。
--   3. 不给 anon / authenticated 任何写权限（RLS 默认拒绝 + REVOKE 双重，含 MAINTAIN）。
--      service_role 写权限**必须保留**（server route 唯一写入通道，BYPASSRLS）。
--   4. 🔴 overall_score 允许 NULL 且语义为「未评分」，**绝不等于 0**。
--      CHECK 只拦越界（0..100），不填默认值 —— 缺失就是缺失（项目铁律）。
--   5. sections / actions 存 jsonb 数组；章节「无内容」= 数组为空 ⇒ 渲染时整章不出现，
--      绝不用占位文本或 0 顶替（反伪造铁律）。
--   6. 每个工厂最多一行（supplier_id UNIQUE）：报告正文是「当前版本」，不做多版本。
--      需要留痕的历史版本走 CS-18 的 audit_report_versions，不在这里重复造。
--   7. 全部 IF NOT EXISTS，可重复执行。
--   8. 末尾 NOTIFY pgrst reload schema（否则 PGRST205）。
-- =============================================================================

BEGIN;


-- =============================================================================
-- 1. supplier_reports —— 每工厂一份可编辑报告正文
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.supplier_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid        NOT NULL UNIQUE REFERENCES public.suppliers(id) ON DELETE CASCADE,

  -- 报告头（均可留空；留空时渲染方回退到中性文案，绝不编造编号/日期）
  report_number text,
  report_date   date,
  prepared_for  text,

  -- 总分。🔴 NULL = 未评分（渲染为「—」），与 0 分严格区分
  overall_score integer,
  score_note    text,

  -- 报告正文：按 lib/standardReport.ts 的 Section 形状存数组
  --   [{ no, titleEn, titleZh, introEn, introZh, kind, fields[], table{}, items[], bullets[] }]
  sections      jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- 建议行动：[{ en, zh }]
  actions       jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- 免责声明（双语；留空时渲染方用平台标准免责声明兜底）
  disclaimer_en text,
  disclaimer_zh text,

  -- 草稿 / 定稿。定稿只是人工标记，**不等于签发**（签发走 CS-18 的 audit_reports）
  status        text        NOT NULL DEFAULT 'draft',

  updated_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- 越界拦截。NULL 合法（= 未评分），0 合法（= 实测 0 分），二者不可混淆
  CONSTRAINT supplier_reports_score_range
    CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),
  CONSTRAINT supplier_reports_status
    CHECK (status IN ('draft', 'final')),
  CONSTRAINT supplier_reports_sections_is_array
    CHECK (jsonb_typeof(sections) = 'array'),
  CONSTRAINT supplier_reports_actions_is_array
    CHECK (jsonb_typeof(actions) = 'array')
);

COMMENT ON TABLE public.supplier_reports IS
  'CS-20：每工厂一份可编辑的报告正文（后台报告编辑器）。只存人工录入内容，不自动生成、不编造；空数组 = 未填。签发/验真走 CS-18 的 audit_reports，本表不承担签发语义。';
COMMENT ON COLUMN public.supplier_reports.supplier_id IS
  '所属供应商。UNIQUE ⇒ 每个工厂最多一行（报告正文只保留当前版本）。';
COMMENT ON COLUMN public.supplier_reports.report_number IS
  '报告编号（人工填）。留空时不渲染，绝不由系统编造。';
COMMENT ON COLUMN public.supplier_reports.report_date IS
  '报告日期（人工填）。留空时不渲染。';
COMMENT ON COLUMN public.supplier_reports.prepared_for IS
  '报告对象（如具体采购商）。留空时渲染中性文案。';
COMMENT ON COLUMN public.supplier_reports.overall_score IS
  '总分 0-100。🔴 NULL = 未评分，与 0 分严格区分；渲染方必须显示「—」而不是 0，颜色也不得借用最差档。';
COMMENT ON COLUMN public.supplier_reports.score_note IS
  '评分说明。可留空。';
COMMENT ON COLUMN public.supplier_reports.sections IS
  '正文章节 JSON 数组，形状对齐 lib/standardReport.ts 的 Section。数组为空 = 该章无内容 ⇒ 渲染时整章不出现。';
COMMENT ON COLUMN public.supplier_reports.actions IS
  '建议行动数组 [{en,zh}]。空数组 = 不渲染该区块。';
COMMENT ON COLUMN public.supplier_reports.disclaimer_en IS
  '英文免责声明。留空时渲染平台标准免责声明。';
COMMENT ON COLUMN public.supplier_reports.disclaimer_zh IS
  '中文免责声明。留空时渲染平台标准免责声明。';
COMMENT ON COLUMN public.supplier_reports.status IS
  'draft | final。仅人工标记「内容已定稿」，不构成对采购商的任何承诺，也不等于签发。';
COMMENT ON COLUMN public.supplier_reports.updated_by IS
  '最后编辑操作人（admin email / system）。由服务端填，绝不来自客户端。';


-- =============================================================================
-- 2. updated_at 自动维护（复用既有 public.set_updated_at()，不新建函数）
-- =============================================================================
DROP TRIGGER IF EXISTS supplier_reports_set_updated_at ON public.supplier_reports;
CREATE TRIGGER supplier_reports_set_updated_at
  BEFORE UPDATE ON public.supplier_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- 3. RLS —— supplier_reports
--    PostgreSQL RLS 默认语义：开启后没有匹配的 policy = 拒绝。
--    生效链条：① RLS 开启 ② 只有 admin_select 一条策略 ③ REVOKE 在 GRANT 层再收一次。
--    生产写入一律走 server route 的 service_role（BYPASSRLS）。
-- =============================================================================
ALTER TABLE public.supplier_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_reports_admin_select ON public.supplier_reports;
CREATE POLICY supplier_reports_admin_select ON public.supplier_reports
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 防御纵深：anon 全收；authenticated 只留 SELECT（policy 已限 is_admin），写全部收回（含 MAINTAIN）
REVOKE ALL ON public.supplier_reports FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.supplier_reports FROM authenticated;
GRANT  SELECT ON public.supplier_reports TO authenticated;
-- service_role 不动（唯一写入通道，BYPASSRLS）


-- =============================================================================
-- 4. 版本登记
-- =============================================================================
INSERT INTO public.schema_migrations (version, note)
VALUES (
  '020',
  'CS-20: supplier_reports (per-factory editable report body; supplier_id UNIQUE; overall_score NULL!=0; sections/actions jsonb arrays; RLS admin-select-only; revoke write from anon/authenticated incl MAINTAIN; set_updated_at trigger)'
)
ON CONFLICT (version) DO NOTHING;


-- =============================================================================
-- 5. PostgREST 重新加载 schema（否则 REST 报 PGRST205）
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;


-- =============================================================================
-- ✅ 执行成功标志：`Success. No rows returned`
--    下一步：跑 03_postcheck.sql（只读）确认结构到位。
-- =============================================================================
