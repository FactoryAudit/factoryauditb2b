-- 061_geo_category_capa_guide.sql
--
-- 目的（2026-11-16）：新增 GEO 正文类别 'capa-guide'。
--
-- 触发原因：第二批中文稿件（面向中国外贸工厂）里，
-- 「验厂消防硬件常见不符合项 / 自查整改清单」被标为 category='capa-guide'，
-- 而迁移 060 的 CHECK 只允许 guide|comparison|standard|industry。
-- seed 脚本的设计是"未知 category 整批拒收"（宁可中止也不写半批），
-- 因此这里必须显式放行，而不是在脚本里悄悄降级成 'guide'。
--
-- 路由归属：capa-guide → /guides/[slug]（与 guide / comparison 同族）。
-- 理由：它是"整改清单"型指南，不是独立的审核标准，也不属于行业枢纽。
-- 映射的唯一真源是 lib/geoKnowledge.ts 的 GEO_ROUTE_SEGMENT。
--
-- 🔴 加新值的标准动作（同 031 的 leads.status）：DROP + ADD CONSTRAINT。
--    PostgreSQL 的 CHECK 约束不能用 ALTER 追加选项，只能重建。

ALTER TABLE public.geo_knowledge_pages
  DROP CONSTRAINT IF EXISTS geo_knowledge_pages_category_check;

ALTER TABLE public.geo_knowledge_pages
  ADD CONSTRAINT geo_knowledge_pages_category_check
  CHECK (category IN ('guide', 'comparison', 'capa-guide', 'standard', 'industry'));

COMMENT ON COLUMN public.geo_knowledge_pages.category IS
  'guide|comparison|capa-guide→/guides，standard→/standards，industry→/industry';

-- PostgREST 需重载 schema 才能识别新约束
NOTIFY pgrst, 'reload schema';
