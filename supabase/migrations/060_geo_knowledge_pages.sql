-- 060_geo_knowledge_pages.sql
--
-- 目的（2026-11-16）：承载 AI Search / GEO 长尾问答页的正文数据。
--
-- 为什么单独一张表，而不是继续往 lib/guides.ts 里堆常量：
--   这批内容是「一个问题 = 一个页面」的问答体（h1Question + BLUF 摘要 + 对比表 +
--   零容忍清单 + FAQ），运营会按搜索意图持续新增，且需要独立的 lastmod。
--   放库里的唯一理由是**增删改不依赖改代码**；但注意 🔴 本站前台是**预渲染**的
--   ⇒ 写库后必须重新构建部署才会出现在线上，不存在「改库即生效」。
--
-- 设计口径：
--   · 一行 = 一个 (slug, locale)。同 slug 的未来语种译文各占一行，读取层按
--     locale 精确匹配、缺失回落 'en'（与 lib/pickGuideDesc.ts 同一套策略）。
--   · 三个富文本块（对比表 / 零容忍 / FAQ）用 jsonb 存，因为它们的**形状**
--     由内容决定：对比表列数逐页不同，塞进固定列会立刻出现一堆 NULL 列。
--   · comparison_title / zero_tolerance_title 是**可见标题**，随数据携带。
--     🔴 不放进字典：站内 9 语字典已冻结（en 叶子数 3293），加一个键要同步
--     12 份源文件 + apply 脚本。lib/guides.ts 的 tables[].title 同样是数据携带。
--   · 缺失值一律 NULL / 空数组，绝不用空串顶替（R76）。
--
-- 🔴 可见性：本表**没有** is_published 闸门。写入即视为可上线。
--   原因：本表唯一写入方是 scripts/seed-geo-knowledge.mjs，写入前会做结构校验；
--   再加一道默认为 false 的闸门，只会重演 suppliers.profile_status DEFAULT 'draft'
--   那次的坑（字段没人写 ⇒ 页面静默 404，而所有本地门全绿）。
--   要下架一页，删掉对应行并重新部署。

CREATE TABLE IF NOT EXISTS public.geo_knowledge_pages (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   text        NOT NULL,
  locale                 text        NOT NULL DEFAULT 'en',
  category               text        NOT NULL,
  target_audience        text        NOT NULL DEFAULT 'western_buyer',
  h1_question            text        NOT NULL,
  bluf_summary           text        NOT NULL,
  comparison_title       text,
  comparison_table       jsonb,
  zero_tolerance_title   text,
  zero_tolerance_list    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  faqs                   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  -- category 直接决定渲染到哪个路由族（见 lib/geoKnowledge.ts 的 GEO_ROUTE_SEGMENT）：
  --   guide | comparison → /guides/[slug]
  --   standard           → /standards/[slug]
  --   industry           → /industry/[slug]
  -- 加新值必须同步：本约束 + lib/geoKnowledge.ts 的 GEO_CATEGORIES + 路由页。
  CONSTRAINT geo_knowledge_pages_category_check
    CHECK (category IN ('guide', 'comparison', 'standard', 'industry')),

  -- slug 必须是 URL 安全的 kebab-case：它同时是 sitemap 里的路径段，
  -- 含大写 / 空格 / 非 ASCII 会让线上 404 或产生需要转义的 URL。
  CONSTRAINT geo_knowledge_pages_slug_format
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  CONSTRAINT geo_knowledge_pages_slug_locale_key UNIQUE (slug, locale)
);

COMMENT ON TABLE  public.geo_knowledge_pages IS 'GEO/AI Search 问答页正文；一行 = 一个 (slug, locale)。写入后需重新构建部署才上线';
COMMENT ON COLUMN public.geo_knowledge_pages.category            IS 'guide|comparison→/guides，standard→/standards，industry→/industry';
COMMENT ON COLUMN public.geo_knowledge_pages.comparison_table    IS '{"headers":string[],"rows":string[][]}；渲染为原生 <table>，列数逐页不同故用 jsonb';
COMMENT ON COLUMN public.geo_knowledge_pages.comparison_title    IS '对比表的可见标题（随数据携带，不占字典键）；NULL ⇒ 整块不渲染';
COMMENT ON COLUMN public.geo_knowledge_pages.zero_tolerance_list IS 'string[]；空数组 ⇒ 整块不渲染';
COMMENT ON COLUMN public.geo_knowledge_pages.faqs                IS '[{"question":string,"answer":string}]；非空时自动注入 FAQPage 结构化数据';

-- 读取层按 (category, locale) 列页，按 slug 取单页；两个方向都建索引。
CREATE INDEX IF NOT EXISTS geo_knowledge_pages_category_locale_idx
  ON public.geo_knowledge_pages (category, locale);

-- updated_at 由触发器维护：sitemap 的 lastmod 直接读这一列，
-- 若允许人工忘写，lastmod 会停在首次插入时间（R60：宁可缺失也不回落 now()）。
DROP TRIGGER IF EXISTS geo_knowledge_pages_set_updated_at ON public.geo_knowledge_pages;
CREATE TRIGGER geo_knowledge_pages_set_updated_at
  BEFORE UPDATE ON public.geo_knowledge_pages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 权限 ────────────────────────────────────────────────────────────────────
-- 全是公开营销正文、无 PII，但**不需要** anon 直读：唯一读取方是构建期的
-- 服务端（service_role，绕过 RLS）。因此一律收回，不留任何 RLS 策略。
ALTER TABLE public.geo_knowledge_pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.geo_knowledge_pages FROM anon, authenticated;

-- PostgREST 需要重载 schema 才能识别新表
NOTIFY pgrst, 'reload schema';
