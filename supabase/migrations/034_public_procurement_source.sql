-- =============================================================================
-- Migration 034 —— 公开采购信息：来源标注（STEP-LEAD-01）
--
-- ⚠️ 性质：**纯 ADD COLUMN**。不 DROP / 不改任何既有列语义、不回填历史数据。
--    历史 rfqs（买家自行提交）两列一律 NULL —— **不伪造来源**。
--
-- 背景：`/suppliers` 的 Live Buyer Requests 区块此前**从未上线过**
--   （生产库 rfqs 共 10 行，全部 is_public=false，且均为测试探针）。
--   现在要把它变成「真实存在的采购需求」入口，其中一部分由平台每周从
--   公开采购渠道（UNGM 联合国采购 / SAM.gov 美国联邦招标）整理发布。
--
--   这类条目的需求方**不是本站买家**，因此必须在卡片上标明来源，
--   既避免冒名，也让访客能回到原公告核对。为此需要两个可空列承载
--   「来源机构名」与「原公告 URL」。
--
-- 为什么不复用既有的 source_type：该列是**白名单枚举**
--   （industrial_cluster / industry / home / direct，见 app/api/rfq/route.ts），
--   语义是「买家从哪个站内入口进来」的归因，与「外部来源机构」是两件事，
--   塞进去会破坏既有归因语义。
--
-- 兼容性承诺：
--   · 两列均可空、无 DEFAULT ⇒ 不回填、不锁表、不影响既有 10 行；
--   · 公开读取仍走原 `listPublicRfqs`（is_public=true AND status<>'closed'）；
--   · 买家提交路径（POST /api/rfq）**完全不动**，其写入的两列为 NULL。
-- =============================================================================

BEGIN;

ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS source_url  text;

COMMENT ON COLUMN public.rfqs.source_name IS
  'STEP-LEAD-01：采购信息的来源机构名（如 UNDP / US Department of Defense）。仅当该条由平台从公开采购渠道整理发布时非空；买家自行提交的 RFQ 一律 NULL —— 不伪造来源。';
COMMENT ON COLUMN public.rfqs.source_url IS
  'STEP-LEAD-01：原公告 URL。前台以「来源机构名 ↗」外链呈现，供访客核对原文。买家自行提交的 RFQ 一律 NULL。';

-- 公开列表按 is_public + created_at 已有 idx_rfqs_public，本迁移无需新增索引。

INSERT INTO public.schema_migrations (version, note)
VALUES (
  '034',
  'STEP-LEAD-01: rfqs +2 nullable cols (source_name / source_url) to label platform-curated public procurement listings. Pure ADD, no backfill; buyer-submitted RFQs keep NULL.'
)
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- ✅ 成功标志：`Success. No rows returned`
-- =============================================================================
