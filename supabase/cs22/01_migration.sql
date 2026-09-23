-- CS-22 Supplier Trust Profile —— 增量迁移
--
-- 铁律：只 ADD COLUMN / CREATE TABLE IF NOT EXISTS。
--       不 DROP 任何列、不 DROP 任何表、不 DELETE 任何数据、不 reset。
--
-- 复用优先（已存在的不再建）：
--   suppliers                 (56 列，扩展公开/索引/状态/完整度)
--   supplier_assessments      (CS-21，responses_json 存结构化答案，不建 answers 表)
--   supplier_reports          (report_number 复用为对外 Report ID)
--   supplier_evidence         (扩展文件列；审核证据，默认私有)
--   report_verification_records (复用为报告在线验真)
--   admin_audit_log / audit_logs (复用为审计日志)
--   profile_views             (登录用户浏览；匿名浏览走 supplier_share_events)

-- ============================================================================
-- 1. 扩展 suppliers：公开档案开关 / 索引开关 / 档案状态 / 完整度
-- ============================================================================
-- public_profile_enabled：先给 true 保证线上已发布的 9 家供应商不因迁移掉线，
--   再把未发布的置 false（只填 NULL 行，绝不覆盖已有非空值）。
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS public_profile_enabled boolean DEFAULT true;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS search_index_enabled boolean DEFAULT false;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS profile_status text DEFAULT 'draft';

-- completeness_percent：可空。缺失值绝不用 0 顶替（NULL ≠ 0）。
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS completeness_percent integer;

UPDATE public.suppliers
   SET public_profile_enabled = false
 WHERE public_profile_enabled IS NULL
   AND is_published IS DISTINCT FROM true;

UPDATE public.suppliers
   SET profile_status = 'public'
 WHERE profile_status IS NULL
   AND is_published = true;

-- 档案状态白名单（Draft / Public / Unlisted / Private）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'suppliers_profile_status_check'
       AND conrelid = 'public.suppliers'::regclass
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT suppliers_profile_status_check
      CHECK (profile_status IS NULL OR profile_status IN ('draft','public','unlisted','private'));
  END IF;
END $$;

-- ============================================================================
-- 2. 扩展 supplier_evidence：审核证据文件列（默认私有）
--    Question → Answer → Evidence → Review
-- ============================================================================
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS assessment_id uuid;
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS item_key text;
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS file_size integer;
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS file_hash text;
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS uploaded_by text;
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS reviewer_note text;
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE public.supplier_evidence ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- 同供应商同文件去重（file_hash 可空，故用部分唯一索引）
CREATE UNIQUE INDEX IF NOT EXISTS ux_supplier_evidence_hash
  ON public.supplier_evidence (supplier_id, file_hash)
  WHERE file_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_supplier_evidence_supplier
  ON public.supplier_evidence (supplier_id);

-- ============================================================================
-- 3. 扩展 supplier_reports：报告类型 / 生成时间 / 关联验证
--    report_number 复用为对外 Report ID（FAB2B-RPT-20260924-XXXX），不新增同义列
-- ============================================================================
ALTER TABLE public.supplier_reports ADD COLUMN IF NOT EXISTS report_type text;
ALTER TABLE public.supplier_reports ADD COLUMN IF NOT EXISTS verification_id uuid;
ALTER TABLE public.supplier_reports ADD COLUMN IF NOT EXISTS generated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'supplier_reports_type_check'
       AND conrelid = 'public.supplier_reports'::regclass
  ) THEN
    ALTER TABLE public.supplier_reports
      ADD CONSTRAINT supplier_reports_type_check
      CHECK (report_type IS NULL OR report_type IN ('BASIC','DETAILED','FULL_AUDIT'));
  END IF;
END $$;

-- ============================================================================
-- 4. supplier_images —— 公开工厂展示图（与审核证据彻底分离）
--    审核证据 = supplier_evidence（默认私有）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.supplier_images (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  category        text NOT NULL,
  original_path   text,
  display_path    text,
  thumbnail_path  text,
  original_size   integer,
  display_size    integer,
  thumbnail_size  integer,
  mime_type       text,
  width           integer,
  height          integer,
  file_hash       text,
  status          text NOT NULL DEFAULT 'PENDING',
  visibility      text NOT NULL DEFAULT 'PRIVATE',
  uploaded_by     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'supplier_images_status_check'
       AND conrelid = 'public.supplier_images'::regclass
  ) THEN
    ALTER TABLE public.supplier_images
      ADD CONSTRAINT supplier_images_status_check
      CHECK (status IN ('PENDING','APPROVED','REJECTED'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'supplier_images_visibility_check'
       AND conrelid = 'public.supplier_images'::regclass
  ) THEN
    ALTER TABLE public.supplier_images
      ADD CONSTRAINT supplier_images_visibility_check
      CHECK (visibility IN ('PUBLIC','PRIVATE'));
  END IF;
END $$;

-- 同供应商同文件去重（重新上传同一张图直接挡掉）
CREATE UNIQUE INDEX IF NOT EXISTS ux_supplier_images_hash
  ON public.supplier_images (supplier_id, file_hash)
  WHERE file_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_supplier_images_supplier
  ON public.supplier_images (supplier_id, status);

-- ============================================================================
-- 5. verification_records —— ONLINE / ON_SITE 验证主记录（每次独立，保留历史）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.verification_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  verification_id   text NOT NULL UNIQUE,
  verification_type text NOT NULL,
  status            text NOT NULL DEFAULT 'ACTIVE',
  verified_at       timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,
  verified_by       text,
  scope             jsonb,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'verification_records_type_check'
       AND conrelid = 'public.verification_records'::regclass
  ) THEN
    ALTER TABLE public.verification_records
      ADD CONSTRAINT verification_records_type_check
      CHECK (verification_type IN ('ONLINE','ON_SITE'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'verification_records_status_check'
       AND conrelid = 'public.verification_records'::regclass
  ) THEN
    ALTER TABLE public.verification_records
      ADD CONSTRAINT verification_records_status_check
      CHECK (status IN ('ACTIVE','EXPIRED','REVOKED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_verification_records_supplier
  ON public.verification_records (supplier_id, status, expires_at DESC);

-- ============================================================================
-- 6. verification_items —— 逐项审核（APPROVE / REJECT / NEED_MORE_INFO）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.verification_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_record_id uuid NOT NULL REFERENCES public.verification_records(id) ON DELETE CASCADE,
  item_key              text NOT NULL,
  item_label            text,
  supplier_answer       text,
  evidence_count        integer NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'PENDING',
  reviewer_note         text,
  reviewed_by           text,
  reviewed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'verification_items_status_check'
       AND conrelid = 'public.verification_items'::regclass
  ) THEN
    ALTER TABLE public.verification_items
      ADD CONSTRAINT verification_items_status_check
      CHECK (status IN ('PENDING','APPROVED','REJECTED','NEED_MORE_INFO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_verification_items_record
  ON public.verification_items (verification_record_id);

-- ============================================================================
-- 7. supplier_share_events —— 分享与浏览事件（含匿名，用 hash 不存原始 IP）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.supplier_share_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  share_token  text,
  event_type   text NOT NULL,
  visitor_hash text,
  session_id   text,
  -- 独立日期列：timestamptz::date 依赖时区、非 IMMUTABLE，不能进索引表达式，
  -- 故用 date 列做「同访客同天」唯一键（DEFAULT 在插入时求值，无 IMMUTABLE 限制）。
  visit_date   date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'supplier_share_events_type_check'
       AND conrelid = 'public.supplier_share_events'::regclass
  ) THEN
    ALTER TABLE public.supplier_share_events
      ADD CONSTRAINT supplier_share_events_type_check
      CHECK (event_type IN (
        'SHARE_CREATED','PROFILE_VIEW','UNIQUE_VISIT',
        'BUYER_SIGNUP','REPORT_DOWNLOAD','RFQ','CONTACT'
      ));
  END IF;
END $$;

-- 同一访客同一天同一供应商只计一次 UNIQUE_VISIT（防刷）
CREATE UNIQUE INDEX IF NOT EXISTS ux_share_events_unique_visit
  ON public.supplier_share_events (supplier_id, visitor_hash, visit_date)
  WHERE event_type = 'UNIQUE_VISIT' AND visitor_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_share_events_supplier
  ON public.supplier_share_events (supplier_id, event_type);

-- ============================================================================
-- 8. supplier_visibility_scores —— 可见度积分（聚合，防刷后写入）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.supplier_visibility_scores (
  supplier_id     uuid PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  points          integer,
  profile_views   integer,
  unique_visitors integer,
  report_downloads integer,
  buyer_actions   integer,
  shares          integer,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. report_download_events —— 买家报告下载事件
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.report_download_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    uuid REFERENCES public.supplier_reports(id) ON DELETE SET NULL,
  supplier_id  uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  buyer_id     uuid,
  source       text,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_report_download_events_supplier
  ON public.report_download_events (supplier_id);

-- ============================================================================
-- 10. RLS + 授权：全部表收紧，写入一律走服务端 service_role（唯一写入层）
--     公开侧一律经服务端读取，anon 无任何直连权限（防私有文件被枚举）
-- ============================================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'supplier_images','verification_records','verification_items',
    'supplier_share_events','supplier_visibility_scores','report_download_events'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
