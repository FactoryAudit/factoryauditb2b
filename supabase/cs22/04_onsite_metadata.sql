-- CS-22 CHANGE SET C（现场核验元数据）—— 增量迁移
--
-- 铁律：只 ADD COLUMN。不 DROP 列 / 不 DROP 表 / 不 DELETE 数据 / 不 reset。
--
-- verification_records 当前只有 scope(jsonb,=被标记项) 与 notes(text)。
-- 现场核验（ON_SITE）需要独立记录访厂元数据：visit_date / verifier / location。
-- 这些列为 ONLINE 记录保留为 NULL，互不影响。

ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS visit_date date;
ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS verifier text;
ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS location text;

-- 既有 RLS（CS-22 / 01）已对 verification_records 收紧：
--   anon 无任何权限；authenticated 仅 SELECT；写入一律走 service_role（唯一写入层）。
-- 新增列自动继承行级策略，无需重建策略。此处重申授权以防万一（幂等）。
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['verification_records']) LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
