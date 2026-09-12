-- =============================================================================
-- CS-02C G3 · MIGRATION —— rfqs 行业化 7 列
--
-- 用户 2026-09-13 拍板「批准，但先设计再迁移」；本文件只做 **加列**：
--   * 7 列全部 nullable、无默认值 —— 既有 1 行数据零变化；
--   * 不改任何既有列的类型/名称/CHECK/RLS/GRANT；
--   * 不回填任何历史行（历史 RFQ 的行业上下文无从知晓，编值 = 造假）；
--   * 合法值校验放应用层（lib/queries / app/api/rfq），库层不加 CHECK ——
--     行业清单由 STATIC_INDUSTRIES 维护，加 CHECK 会把「改清单」变成「改库结构」。
--
-- 跑法：node scripts/db-apply-sql.mjs supabase/cs02c/02_migration.sql
-- 回滚：supabase/cs02c/04_rollback.sql（破坏性，需 --allow-destructive + 二次确认）
-- =============================================================================

ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS industry_code      text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS certifications_req text[];
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS oem_required       boolean;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS target_market      text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS incoterm           text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS source_path        text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS locale             text;

-- 匹配查询按行业过滤（CS-02F 的 rfq_matches 排序）。数据量小，单列 btree 足够，不建 GIN。
CREATE INDEX IF NOT EXISTS rfqs_industry ON public.rfqs(industry_code);

COMMENT ON COLUMN public.rfqs.industry_code      IS 'CS-02C G3：买家询价所属行业（STATIC_INDUSTRIES code，如 food-beverage）。可空=旧数据/未带上下文。合法值由应用层校验。';
COMMENT ON COLUMN public.rfqs.certifications_req IS 'CS-02C G3：买家要求的审核/认证 code 数组（如 {HACCP,BRC}）。可空。匹配时与 supplier_capabilities.ref_code 求交集。';
COMMENT ON COLUMN public.rfqs.oem_required       IS 'CS-02C G3：是否需要贴牌/代工（OEM/ODM）。NULL=未表态（表单未提供该上下文），true/false=明确表态。';
COMMENT ON COLUMN public.rfqs.target_market      IS 'CS-02C G3：目标销售市场（如 EU / US）。自由文本，应用层 clamp 80 字符。';
COMMENT ON COLUMN public.rfqs.incoterm           IS 'CS-02C G3：贸易术语（FOB/CIF/EXW...）。自由文本，应用层 clamp 20 字符。';
COMMENT ON COLUMN public.rfqs.source_path        IS 'CS-02C G3：询价来源页路径（如 /industry/food-beverage），前端 ?src= 或页面注入。CS-02 ROI 归因唯一依据。应用层 clamp 300 且必须以 / 开头。';
COMMENT ON COLUMN public.rfqs.locale             IS 'CS-02C G3：提交时界面语言（9 语之一）。可空。';

-- 加列后必须刷新 schema cache，否则 PostgREST 报 PGRST205 / 新列读不到
NOTIFY pgrst, 'reload schema';
