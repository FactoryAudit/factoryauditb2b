-- =============================================================================
-- Migration 025 —— STEP 09 ROUTE-02：Industrial Clusters 路由迁移（数据层扩展）
--
-- ⚠️ 性质：**纯 ADD / EXTEND**。不 DROP 任何列、不改任何列语义、不删除任何数据。
--    仅为层级 URL resolver 补充 `province` 维度（现有表只有 region/city，无 province）。
--
-- 背景：采用「扩展式」层级方案（用户拍板）。DB slug 保持不变，路由层根据
--   country / province / city 生成层级 URL：
--     /industrial-clusters/{country}/{parent}/{slug}
--   · CN 集群：parent = province（如 Guangdong）
--   · 其他（TH/VN/ID）：parent = city（如 Rayong / Bac Ninh / Batam / Jepara）
--   resolver 在 slug 已以 parent+"-" 开头时省略中间段，避免 /thailand/rayong/rayong-automotive。
--
-- 其余目标字段（parent_cluster_id / cluster_type / status）P0 暂不需要，
-- 延后到全国扩展阶段，保持本次变更最小、可回滚。
-- =============================================================================

BEGIN;

ALTER TABLE public.industrial_clusters ADD COLUMN IF NOT EXISTS province text;

COMMENT ON COLUMN public.industrial_clusters.province IS
  'STEP-09-ROUTE：行政省/省级单位（如 Guangdong）。与 region（大区，如 South China）、city 并存、语义不同。CN 集群的 URL 中间段取 province；非 CN 集群 province 通常为 NULL，URL 中间段取 city。';

CREATE INDEX IF NOT EXISTS idx_industrial_clusters_province
  ON public.industrial_clusters (country_code, province);

INSERT INTO public.schema_migrations (version, note)
VALUES (
  '025',
  'STEP-09-ROUTE: industrial_clusters +province text (nullable) + index (country_code, province). Pure ADD, no drop/rename, no backfill. Enables hierarchical URL resolver (country/province|city/slug).'
)
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
