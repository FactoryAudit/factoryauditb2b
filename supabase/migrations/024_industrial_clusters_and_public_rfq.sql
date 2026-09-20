-- =============================================================================
-- Migration 024 —— STEP 02B：Industrial Cluster 实体 + 采购信息公开闸门
--
-- ⚠️ 性质：**纯 ADD / EXTEND**。不 DROP 任何列、不改任何列语义、不删除任何数据。
--    历史 rfqs 一律 is_public=false 兜底（默认不公开，需后台显式发布）。
--
-- -----------------------------------------------------------------------------
-- 【必须新建表的显式说明 —— 按用户「先说明原因，并优先使用现有架构」的要求】
--
-- 需求：产业带（Industrial Cluster）必须是真实数据资产，由 Admin 管理，
--       前台 /industrial-clusters 从数据库读取；禁止前台写死、禁止静态 JSON。
--
-- 是否已存在可复用结构？—— 已全量核验，**不存在**：
--   · 全库 34 张表（OpenAPI schema 全量枚举）中，无任何 cluster / region /
--     country / city 维度表；地理与行业目前只是**前端常量**：
--       lib/coverage.ts（5 国 hubs/industries/registry）
--       lib/staticData.ts（13 个行业）
--       lib/taxonomy.ts
--     常量是编译期数据，Admin 无法增删改，也无法 is_published 下架 ——
--     用它们承载产业带就必然违反「禁止前台写死产业带数据」。
--   · suppliers 表在 023 已加 cluster / cluster_slug / cluster_tags **引用字段**，
--     但引用字段必须有被引用的实体表，否则 cluster_slug 无权威来源、
--     无法保证 /industrial-clusters/[slug] 与供应商档案一致（会出现死链/错链）。
--
-- 结论：industrial_clusters 是**唯一必要的新表**，且它是让 023 已加的 cluster_slug
--       从"自由文本"升级为"有权威来源的外键语义"的前提。不新建任何第二套
--       采购信息库 / 供应商库 / Admin。
--
-- 兼容性承诺：
--   · 新建表不影响任何既有表、既有 RLS、既有路由、既有查询；
--   · rfqs 新增列全部为可空 + 有默认值，**不回填历史数据**，现有询价单一行不动；
--   · 公开读取走 RLS（is_published=true），与 suppliers_select_published 同模式。
-- =============================================================================

BEGIN;


-- =============================================================================
-- 1. public.industrial_clusters —— 产业带实体（新建，唯一新增表）
--
--    字段对应用户指定清单：
--      name / slug / country / region / city / industry /
--      description / seo_title / seo_description / is_published / sort_order
--    另加（保持项目一致性）：
--      country_code —— 与 suppliers.country_code 同名同义（lib/coverage.ts 用小写单词）
--      industry_tags text[] —— 一个产业带可跨多行业，复用 suppliers 已有的 text[] 机制
--      created_at / updated_at —— 与全库 *_at 命名一致
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.industrial_clusters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  country         text,
  country_code    text,
  region          text,
  city            text,
  industry        text,
  industry_tags   text[],
  description     text,
  seo_title       text,
  seo_description text,
  is_published    boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.industrial_clusters IS
  'STEP-02B：产业带（Industrial Cluster）。产业带 ≠ 行政区：country/region/city 是行政维度，产业带是产业聚集维度（如 Foshan Furniture）。前台 /industrial-clusters 只读 is_published=true 的行。';
COMMENT ON COLUMN public.industrial_clusters.slug IS
  'URL slug，唯一。与 suppliers.cluster_slug（023）对应 —— 供应商引用产业带时使用本列值。';
COMMENT ON COLUMN public.industrial_clusters.is_published IS
  '发布闸门（默认 false）。未发布的行前台与 sitemap 均不可见 —— 后台下架即前台消失。';
COMMENT ON COLUMN public.industrial_clusters.sort_order IS
  '后台排序权重，升序，默认 100。';

-- 列表页/前台常用过滤：已发布 + 排序；按国家
CREATE INDEX IF NOT EXISTS idx_industrial_clusters_published
  ON public.industrial_clusters (is_published, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_industrial_clusters_country
  ON public.industrial_clusters (country_code);


-- =============================================================================
-- 2. RLS —— 与 suppliers 同模式（001_init 既有约定）：
--      · 公开只读已发布行
--      · admin 读写全部（is_admin() 为 001 既有函数，不新建）
-- =============================================================================
ALTER TABLE public.industrial_clusters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS industrial_clusters_select_published ON public.industrial_clusters;
CREATE POLICY industrial_clusters_select_published ON public.industrial_clusters
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS industrial_clusters_admin_all ON public.industrial_clusters;
CREATE POLICY industrial_clusters_admin_all ON public.industrial_clusters
  FOR ALL USING (is_admin());


-- =============================================================================
-- 3. public.rfqs —— 采购信息公开闸门
--
--    为什么需要：用户要求「后台发布 → 首页 Live Buyer Requests 显示；后台下架 → 前台消失」。
--    现有 rfqs 只有 status（new/reviewing/matched/closed）表示**内部处理进度**，
--    没有"是否对外公开展示"的闸门 —— 用 status 兼任会造成：
--      · status=closed 的成熟案例反而不能展示（语义错配）
--      · 无法区分"处理中但可对外招募供应商"与"处理中且不宜公开"
--    因此新增独立闸门列，**不动 status 语义**（现有后台状态流转一行不改）。
-- =============================================================================
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS is_public    boolean NOT NULL DEFAULT false;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS published_at timestamptz;

COMMENT ON COLUMN public.rfqs.is_public IS
  'STEP-02B：是否对外公开展示（首页 Live Buyer Requests / 公开采购需求）。默认 false —— 现有历史询价单不因本迁移而自动公开。与 status（内部处理进度）语义分离，互不影响。';
COMMENT ON COLUMN public.rfqs.published_at IS
  'STEP-02B：对外发布时间。历史行 NULL —— 不伪造。';

CREATE INDEX IF NOT EXISTS idx_rfqs_public ON public.rfqs (is_public, created_at DESC);


-- =============================================================================
-- 4. public.rfqs —— 买家来源追踪补缺
--    已存在（既有）：source_path / locale —— **不重复创建**。
--    本次补：与 suppliers / leads（023）完全同一套命名，便于跨表归因。
-- =============================================================================
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS utm_source     text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS utm_medium     text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS utm_campaign   text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS referrer       text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS landing_page   text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS first_touch_at timestamptz;

COMMENT ON COLUMN public.rfqs.first_touch_at IS
  'STEP-02B：买家首次触达时间。历史行 NULL —— 不伪造来源。';


-- =============================================================================
-- 5. 版本登记（与 001–023 同格式）
-- =============================================================================
INSERT INTO public.schema_migrations (version, note)
VALUES (
  '024',
  'STEP-02B: CREATE industrial_clusters (name/slug/country/country_code/region/city/industry/industry_tags/description/seo_title/seo_description/is_published/sort_order) + RLS (public read published / admin all) + rfqs +8 cols (is_public/published_at/utm_source|medium|campaign/referrer/landing_page/first_touch_at). Pure ADD, no drop/rename, no backfill'
)
ON CONFLICT (version) DO NOTHING;


-- =============================================================================
-- 6. PostgREST 重新加载 schema（否则新表/新列 REST 报 PGRST205 / PGRST204）
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;


-- =============================================================================
-- ✅ 成功标志：`Success. No rows returned`
--    本迁移**不回填任何历史数据**（rfqs 全部 is_public=false、来源列全 NULL）——禁止编造。
-- =============================================================================
