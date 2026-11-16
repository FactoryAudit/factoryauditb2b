-- 062_geo_page_cta.sql
--
-- 目的（2026-11-16）：给 GEO 问答页增加**可选**的页级 CTA（行动按钮）。
--
-- 触发原因：GEO V1.0 文档 PART 4.2 的四篇「中国工厂获客」专题各自要求明确的
-- CTA（Create Your Free Supplier Profile → /join-supplier-network 等）。
-- 但现有 GEO 渲染壳底部的 CTA 是全局固定的买家侧入口（Supplier Verification /
-- Supplier Risk Calculator），对「工厂如何免费入驻」这类文章文不对题。
--
-- 设计（零影响已上线内容）：
--   · cta_label / cta_href 两列都可空；
--   · 已上线 7 篇不填这两列 ⇒ 渲染壳走原有全局 CTA，行为完全不变；
--   · 新页填了才覆盖底部主 CTA 的文字与链接。
--
-- 🔴 安全口径：
--   · 只允许站内路径（以 / 开头、不含协议与主机），渲染层仍走 localePath() 加语言前缀，
--     不接受外链 —— 防止种子数据把用户导向外部站点；
--   · 不新增字典键（CTA 文案随数据走，与 comparisonTitle 同口径，站内 9 语字典已冻结）。

ALTER TABLE public.geo_knowledge_pages
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS cta_href  text;

COMMENT ON COLUMN public.geo_knowledge_pages.cta_label IS
  '可选：页级主 CTA 文案；NULL 时渲染壳用全局默认 CTA';
COMMENT ON COLUMN public.geo_knowledge_pages.cta_href IS
  '可选：页级主 CTA 站内路径（须以 / 开头）；NULL 时渲染壳用全局默认 CTA';

-- PostgREST 需重载 schema 才能识别新列
NOTIFY pgrst, 'reload schema';
