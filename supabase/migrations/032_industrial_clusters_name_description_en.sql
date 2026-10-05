-- =============================================================================
-- Migration 032 —— P1-15：Industrial Clusters 内容层英文列
--
-- ⚠️ 性质：**纯 ADD**。不 DROP 任何列、不改任何列语义、不删除任何数据。
--    仅为产业带实体补充英文版 `name` / `description`（既有两列只有中文）。
--
-- 背景：industrial_clusters 的 name / description 实测只有中文，而目录页卡片的
--   标题/简介、详情页 H1/导语、以及 <meta description> 兜底都直接渲染这两列，
--   导致 en 与 de/es/fr/pt/ja/ar 语种的产业带页内容全是中文。
--   已有的 seo_title / seo_description 虽然已是英文，但它们是 SEO 专用字段，
--   不能拿来做卡片标题与正文导语（语义与用途不同）。
--
--   因此新增 name_en / description_en 两列作为「英文内容源」：
--     · zh / zh-TW → 仍读中文 name / description（不动）
--     · en          → 读 name_en / description_en
--     · de/es/fr/pt/ja/ar → 以 name_en / description_en 为键查内容映射表，
--                           未命中回退 name_en（再由代码决定回退中文）
--   代码侧收口在 lib/industrialClusters.ts 的两个纯函数里，仍只有一套数据源。
--
-- 回填：本迁移只加列（NULL）。8 行的英文回填由后续 UPDATE 脚本按 slug 精确写入。
-- =============================================================================

BEGIN;

ALTER TABLE public.industrial_clusters ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.industrial_clusters ADD COLUMN IF NOT EXISTS description_en text;

COMMENT ON COLUMN public.industrial_clusters.name_en IS
  'P1-15：产业带英文名（内容层）。zh/zh-TW 读 name，en 读本列，其余 6 语以本列为键查内容映射表。';

COMMENT ON COLUMN public.industrial_clusters.description_en IS
  'P1-15：产业带英文简介（内容层）。与 name_en 同一取值链路，仅作为正文/卡片简介与 meta 兜底。';

INSERT INTO public.schema_migrations (version, note)
VALUES (
  '032',
  'P1-15: industrial_clusters +name_en text +description_en text (nullable). Pure ADD, no drop/rename. Enables per-locale cluster name/description without a second data source.'
)
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
