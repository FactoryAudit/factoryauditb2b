-- STEP 10-B-1：产业带业务联动基础字段
--
-- 原则（spec §9–§11 / Decision A）：
--   · backward compatible：全部 ADD COLUMN IF NOT EXISTS，且无 DROP / DELETE / TRUNCATE
--   · NULL safe：source_type / industrial_cluster_slug 可空，历史 RFQ 保持 NULL（不回填）
--   · featured 有 DEFAULT false，历史 cluster 行不受影响
--   · 字段命名采用 industrial_cluster_slug（与 suppliers.cluster_slug 同模式，文本引用、无 FK）
--
-- 唯一有意的「数据写入」：把当前 8 个已发布 P0 集群标记为 featured（spec §28/§29）。

-- 1) RFQ ↔ Cluster 来源（复用 rfqs.is_public 作为 Buyer Request，不新建 buyer_requests 表）
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS industrial_cluster_slug text;

-- 2) 产业带 featured 标记（支撑首页 Featured Clusters 模块，STEP 10-G 用）
ALTER TABLE public.industrial_clusters ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

-- 3) 索引（仅在确有查询价值时加；featured 仅用于首页少量过滤，idx 提升可忽略，故不加；
--    industrial_cluster_slug 用于集群页 Buyer Requests 过滤，加一个轻量 btree）
CREATE INDEX IF NOT EXISTS idx_rfqs_cluster_slug
  ON public.rfqs (industrial_cluster_slug)
  WHERE industrial_cluster_slug IS NOT NULL;

-- 4) 有意数据写入：当前 8 个 P0 集群置 featured = true（spec §28/§29 第一阶段战略 Featured）
UPDATE public.industrial_clusters
  SET featured = true
  WHERE slug IN (
    'jiangmen-home-kitchen',
    'zhongshan-lighting',
    'foshan-furniture',
    'dongguan-electronics',
    'rayong-automotive',
    'bac-ninh-electronics',
    'batam-electronics',
    'jepara-furniture'
  );
