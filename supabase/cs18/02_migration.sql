-- =============================================================================
-- CS-18 / 02_migration.sql —— V2.1 Audit / Evidence / Report / Verification 结构
--
-- 执行通道：node scripts/db-apply-sql.mjs supabase/cs18/02_migration.sql
-- 前置：无（幂等，可重复执行）
-- 性质：**只加结构，0 条业务数据 INSERT/UPDATE/DELETE**（除 schema_migrations 登记）。
--
-- -----------------------------------------------------------------------------
-- 铁律（本迁移的全部约束）
-- -----------------------------------------------------------------------------
--   1. 只建表 / 加索引 / 扩 admin_audit_log，不删、不改、不锁表。
--   2. 既有表（suppliers / leads / rfqs / capabilities / certifications /
--      supplier_consents / orders / admin_audit_log）一律不动。
--   3. 所有审核/证据/报告表均属**私有数据**：REVOKE ALL FROM anon, authenticated；
--      生产写入与读取一律走 server route 的 service_role（BYPASSRLS），由应用层
--      按 visibility / 角色（admin / auditor / supplier / buyer）做权限判定。
--      绝不给 anon / authenticated 任何直接访问（含 SELECT）。
--   4. 全部 IF NOT EXISTS，可重复执行。
--   5. 末尾 NOTIFY pgrst reload schema（否则 PGRST205）。
--
-- 表清单（指令 §69-§73）建表顺序已按外键依赖排列：
--   audits → audit_templates → audit_sections → audit_questions → audit_responses
--   → audit_findings（先于 evidence / corrective_actions）
--   → audit_evidence（finding_id 引用 findings）
--   → corrective_actions（finding_id 引用 findings）
--   → audit_reports → audit_report_versions / report_verification_records
--   → audit_assignments → audit_logs
-- =============================================================================

BEGIN;


-- =============================================================================
-- 1. audits —— 审核主记录（指令 §17 / §47 状态机）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audits (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_code        text        NOT NULL UNIQUE,
  supplier_id       uuid        NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  buyer_id          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  auditor_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  audit_type        text        NOT NULL DEFAULT 'announced'
                          CHECK (audit_type IN ('announced','semi-announced','unannounced')),
  scope             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status            text        NOT NULL DEFAULT 'requested'
                          CHECK (status IN ('requested','quotation_sent','pending_approval','scheduled',
                                            'auditor_assigned','in_progress','findings_review','cap_required',
                                            'report_draft','report_issued','closed','cancelled')),
  standard_protocol text,
  product           text,
  product_category  text,
  preferred_date    date,
  preferred_window  text,
  special_requirements text,
  previous_audit_available boolean DEFAULT false,
  documents_available     boolean DEFAULT false,
  additional_comments     text,
  quote_professional_fee bigint,
  quote_travel_expense    bigint,
  quote_accommodation     bigint,
  quote_other_expense     bigint,
  quote_estimated_total   bigint,
  quote_approved_total    bigint,
  quote_actual_total      bigint,
  supplier_approved       boolean DEFAULT false,
  approval_time           timestamptz,
  receipt_url             text,
  scheduled_at            timestamptz,
  assigned_at             timestamptz,
  completed_at            timestamptz,
  created_by         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audits_supplier      ON public.audits(supplier_id);
CREATE INDEX IF NOT EXISTS audits_buyer        ON public.audits(buyer_id);
CREATE INDEX IF NOT EXISTS audits_auditor      ON public.audits(auditor_id);
CREATE INDEX IF NOT EXISTS audits_status       ON public.audits(status);
CREATE INDEX IF NOT EXISTS audits_code         ON public.audits(audit_code);

COMMENT ON TABLE public.audits IS '审核主记录。状态机见指令 §47；费用字段单位：分；NULL=未填，绝不默认 0。';
COMMENT ON COLUMN public.audits.audit_type IS '执行方式（通知/半通知/不通知），绝不等于风险等级（指令 §19）。';


-- =============================================================================
-- 2. audit_templates / sections / questions —— 动态审核清单（指令 §22/§23）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_templates (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text  NOT NULL UNIQUE,
  name        text  NOT NULL,
  name_zh     text,
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.audit_templates IS '审核模板（如通用供应商评估 / BSCI / ISO 9001）。';

CREATE TABLE IF NOT EXISTS public.audit_sections (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid  NOT NULL REFERENCES public.audit_templates(id) ON DELETE CASCADE,
  section_code text NOT NULL,
  title       text  NOT NULL,
  title_zh    text,
  parent_id   uuid  REFERENCES public.audit_sections(id) ON DELETE CASCADE,
  sort_order  int   NOT NULL DEFAULT 0,
  UNIQUE (template_id, section_code)
);
CREATE INDEX IF NOT EXISTS audit_sections_template ON public.audit_sections(template_id);
CREATE INDEX IF NOT EXISTS audit_sections_parent   ON public.audit_sections(parent_id);

CREATE TABLE IF NOT EXISTS public.audit_questions (
  id               uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id       uuid  NOT NULL REFERENCES public.audit_sections(id) ON DELETE CASCADE,
  question_code    text  NOT NULL,
  title            text  NOT NULL,
  title_zh         text,
  requirement      text,
  requirement_zh   text,
  guidance         text,
  guidance_zh      text,
  response_type    text  NOT NULL
       CHECK (response_type IN ('yes_no_na','text','number','date','single_select',
                                'multi_select','photo','document','signature')),
  options          jsonb DEFAULT NULL,
  severity_if_failed text CHECK (severity_if_failed IN ('critical','major','minor','observation') OR severity_if_failed IS NULL),
  mandatory        boolean DEFAULT false,
  sort_order       int   NOT NULL DEFAULT 0,
  UNIQUE (section_id, question_code)
);
CREATE INDEX IF NOT EXISTS audit_questions_section ON public.audit_questions(section_id);

COMMENT ON TABLE public.audit_questions IS '清单问题。response_type 覆盖指令 §23；severity_if_failed 仅当回答不达标时引用。';


-- =============================================================================
-- 3. audit_responses —— 审核员现场/桌面填写（指令 §23/§24）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_responses (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id      uuid  NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  question_id   uuid  NOT NULL REFERENCES public.audit_questions(id) ON DELETE CASCADE,
  auditor_id    uuid  REFERENCES public.profiles(id) ON DELETE SET NULL,
  response_value text,
  response_text  text,
  photo_urls    jsonb DEFAULT NULL,
  document_urls jsonb DEFAULT NULL,
  answered_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audit_id, question_id)
);
CREATE INDEX IF NOT EXISTS audit_responses_audit    ON public.audit_responses(audit_id);
CREATE INDEX IF NOT EXISTS audit_responses_question ON public.audit_responses(question_id);


-- =============================================================================
-- 4. audit_findings —— 发现项（指令 §29）【必须先于 evidence / corrective_actions】
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_findings (
  id                uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id          uuid  NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  question_id       uuid  REFERENCES public.audit_questions(id) ON DELETE SET NULL,
  category          text,
  severity          text  NOT NULL CHECK (severity IN ('critical','major','minor','observation')),
  requirement       text,
  description       text,
  objective_evidence text,
  root_cause        text,
  corrective_action text,
  responsible_person text,
  due_date          date,
  status            text  NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','in_progress','submitted','verified','closed')),
  closure_date      date,
  created_by        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_findings_audit  ON public.audit_findings(audit_id);
CREATE INDEX IF NOT EXISTS audit_findings_sev   ON public.audit_findings(severity);

COMMENT ON TABLE public.audit_findings IS '审核现场发现项（指令 §29）。severity 分级；status 见 §30。';


-- =============================================================================
-- 5. audit_evidence —— 证据（指令 §25/§26/§28）【finding_id 引用 findings，须在其后】
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_evidence (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        uuid  NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  supplier_id     uuid  NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  question_id     uuid  REFERENCES public.audit_questions(id) ON DELETE SET NULL,
  finding_id      uuid  REFERENCES public.audit_findings(id) ON DELETE SET NULL,
  uploaded_by     uuid  REFERENCES public.profiles(id) ON DELETE SET NULL,
  filename        text,
  file_type       text,
  file_size       bigint,
  storage_path    text,
  source          text  CHECK (source IN ('supplier_provided','public_website','gov_registry',
                                         'cert_body','audit_report','factory_visit','third_party','other') OR source IS NULL),
  description     text,
  issue_date      date,
  expiry_date     date,
  document_number text,
  issuing_body    text,
  verification_status text CHECK (verification_status IN ('self_declared','document_reviewed',
                                            'independently_verified','on_site_verified','unable_to_verify') OR verification_status IS NULL),
  status          text  NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted','under_review','accepted','rejected','expired','needs_update')),
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_evidence_audit     ON public.audit_evidence(audit_id);
CREATE INDEX IF NOT EXISTS audit_evidence_supplier  ON public.audit_evidence(supplier_id);
CREATE INDEX IF NOT EXISTS audit_evidence_finding   ON public.audit_evidence(finding_id);
CREATE INDEX IF NOT EXISTS audit_evidence_status    ON public.audit_evidence(status);

COMMENT ON TABLE public.audit_evidence IS '证据。storage_path 指向私有存储，绝不公开；verification_status/status 见指令 §28。';


-- =============================================================================
-- 6. corrective_actions —— 整改（指令 §30）【finding_id 引用 findings，须在其后】
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.corrective_actions (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id      uuid  NOT NULL REFERENCES public.audit_findings(id) ON DELETE CASCADE,
  supplier_id     uuid  REFERENCES public.suppliers(id) ON DELETE SET NULL,
  description     text,
  status          text  NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','submitted','verified','closed')),
  submitted_evidence jsonb DEFAULT NULL,
  verified_by     uuid  REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at     timestamptz,
  due_date        date,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS corrective_actions_finding ON public.corrective_actions(finding_id);
CREATE INDEX IF NOT EXISTS corrective_actions_supplier ON public.corrective_actions(supplier_id);

COMMENT ON TABLE public.corrective_actions IS '整改行动（指令 §30）。供应商可上传整改证据，审核员可 Verify Closure。';


-- =============================================================================
-- 7. audit_reports / versions / verification —— 报告与在线验真（指令 §31-§38/§65-§73）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_reports (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id       uuid  NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  supplier_id    uuid  NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  report_number  text  NOT NULL UNIQUE,
  verification_id text NOT NULL UNIQUE,
  status         text  NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','issued','superseded','revoked')),
  current_version int  NOT NULL DEFAULT 0,
  visibility     text  NOT NULL DEFAULT 'admin_only'
                   CHECK (visibility IN ('public_verification','buyer_only','supplier_only','admin_only')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_reports_audit       ON public.audit_reports(audit_id);
CREATE INDEX IF NOT EXISTS audit_reports_supplier    ON public.audit_reports(supplier_id);
CREATE INDEX IF NOT EXISTS audit_reports_verification ON public.audit_reports(verification_id);
CREATE INDEX IF NOT EXISTS audit_reports_number      ON public.audit_reports(report_number);

COMMENT ON TABLE public.audit_reports IS '报告主记录。verification_id 供 /verify/report/[id] 与 QR；visibility 决定公开范围（指令 §41）。';

CREATE TABLE IF NOT EXISTS public.audit_report_versions (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid  NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  version     text  NOT NULL,
  file_url    text,
  sha256      text,
  issued_at   timestamptz,
  issued_by   text,
  status      text  NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','issued','superseded','revoked')),
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, version)
);
CREATE INDEX IF NOT EXISTS audit_report_versions_report ON public.audit_report_versions(report_id);

COMMENT ON TABLE public.audit_report_versions IS '报告版本。每个终版生成 SHA-256 入库（指令 §34/§35）；sha256 用于上传件比对验真（指令 §38）。';

CREATE TABLE IF NOT EXISTS public.report_verification_records (
  id               uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        uuid  NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  verification_id  text  NOT NULL REFERENCES public.audit_reports(verification_id) ON DELETE CASCADE,
  public_status    text  NOT NULL DEFAULT 'valid'
                     CHECK (public_status IN ('valid','invalid','superseded','revoked')),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_verification_report ON public.report_verification_records(report_id);
CREATE INDEX IF NOT EXISTS report_verification_vid   ON public.report_verification_records(verification_id);


-- =============================================================================
-- 8. audit_assignments / audit_logs —— 指派与审计日志（指令 §46/§49/§68）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_assignments (
  id           uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id     uuid  NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  auditor_id   uuid  REFERENCES public.profiles(id) ON DELETE SET NULL,
  role         text  NOT NULL CHECK (role IN ('auditor','reviewer')),
  assigned_by  uuid  REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_assignments_audit   ON public.audit_assignments(audit_id);
CREATE INDEX IF NOT EXISTS audit_assignments_auditor ON public.audit_assignments(auditor_id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid  REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email text,
  action      text  NOT NULL,
  entity      text  NOT NULL,
  entity_id   uuid,
  old_value   jsonb DEFAULT NULL,
  new_value   jsonb DEFAULT NULL,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created ON public.audit_logs(created_at DESC);

COMMENT ON TABLE public.audit_logs IS '审核关键动作留痕（指令 §68）。actor 为操作人；敏感动作不可篡改。';


-- =============================================================================
-- 9. RLS —— 全部私有：REVOKE ALL FROM anon, authenticated（service_role 保留 BYPASSRLS）
-- =============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'public.audits','public.audit_templates','public.audit_sections','public.audit_questions',
      'public.audit_responses','public.audit_findings','public.audit_evidence','public.corrective_actions',
      'public.audit_reports','public.audit_report_versions','public.report_verification_records',
      'public.audit_assignments','public.audit_logs'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('REVOKE ALL ON %s FROM anon, authenticated;', t);
  END LOOP;
END $$;


-- =============================================================================
-- 10. 版本登记
-- =============================================================================
INSERT INTO public.schema_migrations (version, note)
VALUES (
  '018',
  'CS-18: audit subsystem schema (audits/templates/sections/questions/responses/findings/evidence/corrective_actions/reports/versions/verification/assignments/logs) + RLS(revoke all anon+authenticated, service_role only)'
)
ON CONFLICT (version) DO NOTHING;


-- =============================================================================
-- 11. PostgREST 重新加载 schema（否则 REST 报 PGRST205）
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;


-- =============================================================================
-- ✅ 执行成功标志：`Success. No rows returned`
--    下一步：跑 scripts/db-apply-sql.mjs 的只读核验（--read-only --sql "..."）确认结构到位。
-- =============================================================================
