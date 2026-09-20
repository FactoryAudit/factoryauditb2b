-- =============================================================================
-- Migration 023 —— STEP 02：Supplier 架构增量扩展（geography / cluster / source）
--
-- ⚠️ 性质：**纯 ADD / EXTEND**。本迁移不 DROP 任何列、不改任何列语义、不删除任何数据。
--    历史数据一律 NULL 兜底，**禁止编造** region / cluster / 来源。
--
-- 决策依据（用户 2026-09-20 拍板）：
--   决策 A：国家 / 行业路由复用现有 /countries/[slug] /country/[slug] /industry/[slug]，
--           本轮**不建**国家/行业重复页面（只为 STEP 03 的 cluster 维度铺数据层）。
--   决策 B：Verify Supplier 复用现有 leads 表（kind='supplier_verification'），不建新表。
--   决策 C：新增 region 列；**保留 province**；最终地理结构 country / region / province / city。
--
-- -----------------------------------------------------------------------------
-- 本迁移中唯一的「ALTER 既有约束」（按 §八 要求在此显式报告）：
--   现有：CONSTRAINT leads_kind_check CHECK (kind IN ('buyer_lead','supplier_application','supplier_claim'))
--   改为：CHECK (kind IN (... 同上三个 ..., 'supplier_verification'))
--   必要性：决策 B 明确要求 kind='supplier_verification'，而 kind 是 CHECK 约束枚举，
--           不放宽该约束则无法写入新 kind——**无向后兼容的替代方案**（payload 里塞不属于 kind 的
--           语义会让 admin 现有按 kind 过滤的查询全部失真，属于制造第二套语义，违反 ADD/EXTEND）。
--   兼容性：只**放宽**取值集合（原有 3 个值仍然合法），现有 11 行 leads 一行不受影响，
--           不删除列、不改列类型、不动 RLS / policy / GRANT / 触发器。
-- =============================================================================

BEGIN;


-- =============================================================================
-- 1. public.suppliers —— 地理维度：新增 region（province 保留不动）
-- =============================================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS region text;

COMMENT ON COLUMN public.suppliers.region IS
  'STEP-02：地理大区（如 Guangdong / Binh Duong）。与既有 province 并存、语义不同，禁止用 region 覆盖 province。历史行一律 NULL（不推测）。';


-- =============================================================================
-- 2. public.suppliers —— 产业带 cluster
--
--    选型说明（按 §三「优先复用现有机制」）：
--      · cluster / cluster_slug：单值主产业带，供详情页与 canonical 使用。
--      · cluster_tags text[]：一个供应商可属多个产业带。**复用本表已有的 array 机制**
--        （main_products / export_markets / certifications 均为 text[]），
--        不引入新关系表、不引入 JSON 新范式。
-- =============================================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cluster       text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cluster_slug  text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cluster_tags  text[];

COMMENT ON COLUMN public.suppliers.cluster IS
  'STEP-02：主产业带（如 Foshan Furniture）。产业带 ≠ 行政区：country/region/city 是行政维度，cluster 是产业聚集维度。历史行一律 NULL，禁止按公司名推测。';
COMMENT ON COLUMN public.suppliers.cluster_slug IS
  'STEP-02：产业带 slug，供 /industrial-clusters/[slug] 使用。历史行 NULL。';
COMMENT ON COLUMN public.suppliers.cluster_tags IS
  'STEP-02：多产业带标签（text[]，复用 main_products 同机制）。主值冗余在 cluster 列，两者不一致时以 cluster 为准。';


-- =============================================================================
-- 3. public.suppliers —— 来源追踪补缺
--    已存在（cs03）：source_type / source_name / source_url / discovered_at —— **不重复创建**。
--    本次补：utm_* / referrer / landing_page / first_touch_at。
--    命名规范：时间戳沿用项目 *_at 风格（discovered_at / submitted_at / published_at）。
-- =============================================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS utm_source    text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS utm_medium    text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS utm_campaign  text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS referrer      text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS landing_page  text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS first_touch_at timestamptz;

COMMENT ON COLUMN public.suppliers.first_touch_at IS
  'STEP-02：首次触达时间（供应商侧）。历史行 NULL —— 不伪造来源。';


-- =============================================================================
-- 4. public.leads —— 买家 / 线索来源追踪（与 suppliers 同一套命名）
--    不新建第二套 lead 系统；kind 取值集合放宽以容纳 supplier_verification。
-- =============================================================================
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_source    text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_medium    text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_campaign  text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS referrer      text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS landing_page  text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS first_touch_at timestamptz;

COMMENT ON COLUMN public.leads.first_touch_at IS
  'STEP-02：首次触达时间（买家侧）。历史行 NULL。';

-- 4.1 唯一一处 ALTER 既有约束（放宽，非收窄）—— 理由见文件头「ALTER 既有约束」段
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_kind_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_kind_check
  CHECK (kind IN ('buyer_lead', 'supplier_application', 'supplier_claim', 'supplier_verification'));

COMMENT ON COLUMN public.leads.kind IS
  'buyer_lead | supplier_application | supplier_claim | supplier_verification（023 新增）。四类严格区分；supplier_claim 与 supplier_verification 都不等同于 verified。';


-- =============================================================================
-- 5. 版本登记（与 001–022 同格式）
-- =============================================================================
INSERT INTO public.schema_migrations (version, note)
VALUES (
  '023',
  'STEP-02: suppliers +10 cols (region/cluster/cluster_slug/cluster_tags/utm_source|medium|campaign/referrer/landing_page/first_touch_at) + leads +6 cols (utm_*/referrer/landing_page/first_touch_at) + widen leads_kind_check with supplier_verification. Pure ADD, no drop/rename, no backfill'
)
ON CONFLICT (version) DO NOTHING;


-- =============================================================================
-- 6. PostgREST 重新加载 schema（否则新列 REST 报 PGRST204 / PGRST205）
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;


-- =============================================================================
-- ✅ 成功标志：`Success. No rows returned`
--    本迁移**不回填任何历史数据**（region/cluster 一律 NULL，来源一律 NULL）——禁止编造。
-- =============================================================================
