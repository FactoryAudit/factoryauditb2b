-- =============================================================================
-- FactoryAuditB2B — 006 合规字段补齐（CS-01）
-- 创建日期：2026-09-10
--
-- 执行位置：Supabase Dashboard → SQL Editor
-- 前置：必须先执行 004_documents.sql 与 005_storage.sql
--
-- 设计铁律（改动本文件前必读）：
--   1. 本文件**只加结构，不写任何业务数据**。
--      绝不因为 suppliers.verification_status = 'Factory Verified' 或
--      audit_status = 'Audited 2026-06'，就自动生成 supplier_audits /
--      supplier_documents / supplier_certifications 记录来「补证据」。
--      没有证据就是没有证据。这三条 INSERT 语句在本文件中为 **0 条**。
--   2. 全部使用 IF NOT EXISTS，可重复执行。
--      但幂等不等于掩盖冲突：若对象已存在而结构不符，post-check 会报出来。
--   3. 已有 004 字段一个都不删、不改类型 —— 当前生产代码正在读写它们。
--   4. 「ISO 9001」与「ISO9001」的关联必须走显式 mapping 表，禁止字符串猜测。
--      STATIC_PROGRAMS 里不存在的（如 OEKO-TEX）一律 mapped=false 并留 note，
--      等 taxonomy 补齐后再映射。
-- =============================================================================

-- =============================================================================
-- 1. certification_program_alias —— 认证显示名 ↔ 程序代码 显式映射（CS-01 §6）
-- =============================================================================
CREATE TABLE IF NOT EXISTS certification_program_alias (
  id            bigserial PRIMARY KEY,
  -- 供应商/平台里出现的写法，例如 "ISO 9001"（带空格）
  display_name  text NOT NULL UNIQUE,
  -- lib/staticData.ts STATIC_PROGRAMS.code，例如 "ISO9001"
  -- NULL 表示「尚未映射到任何已知程序」，绝不是猜测出来的
  program_code  text,
  mapped        boolean NOT NULL DEFAULT false,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cert_alias_code ON certification_program_alias(program_code);
CREATE INDEX IF NOT EXISTS cert_alias_mapped ON certification_program_alias(mapped);

COMMENT ON TABLE certification_program_alias IS
  '认证显示名 → 程序代码的显式映射。禁止在应用层用 replace/正则猜测；未收录的写法必须 mapped=false。';
COMMENT ON COLUMN certification_program_alias.program_code IS
  'NULL = 尚未映射。不可臆测填充。';

-- 种子数据：只写"确定"的映射（来自 STATIC_PROGRAMS 的 22 个程序）
INSERT INTO certification_program_alias (display_name, program_code, mapped, note) VALUES
  ('SMETA',                    'SMETA',      true,  'Sedex'),
  ('BSCI',                     'BSCI',       true,  'amfori'),
  ('SA8000',                   'SA8000',     true,  'SAI'),
  ('WRAP',                     'WRAP',       true,  'WRAP'),
  ('ICTI Ethical Toy Program', 'ICTI',       true,  'ICTI'),
  ('ISO 9001',                 'ISO9001',    true,  '注意：显示名带空格，与 code 不同'),
  ('ISO9001',                  'ISO9001',    true,  'code 写法'),
  ('ISO 13485',                'ISO13485',   true,  'ISO'),
  ('IATF 16949',               'IATF16949',  true,  'IATF'),
  ('GMP',                      'GMP',        true,  'FDA/WHO'),
  ('ISO 14001',                'ISO14001',   true,  'ISO'),
  ('ISO 45001',                'ISO45001',   true,  'ISO'),
  ('BRC',                      'BRC',        true,  'BRCGS'),
  ('BRCGS',                    'BRC',        true,  'BRCGS 新名'),
  ('HACCP',                    'HACCP',      true,  'Codex'),
  ('FSSC 22000',               'FSSC22000',  true,  'FSSC'),
  ('CE',                       'CE',         true,  'EU'),
  ('CE Marking',               'CE',         true,  'EU 全称写法'),
  ('UL',                       'UL',         true,  'UL'),
  ('UL Certification',         'UL',         true,  'UL 全称写法'),
  ('CCC',                      'CCC',        true,  'CNCA'),
  ('ISO 37001',                'ISO37001',   true,  'ISO'),
  ('ISO 27001',                'ISO27001',   true,  'ISO'),
  ('RBA',                      'RBA',        true,  'RBA'),
  ('RBA Code of Conduct',      'RBA',        true,  'RBA 全称写法'),
  ('C-TPAT',                   'CTPAT',      true,  'U.S. CBP'),
  ('CTPAT',                    'CTPAT',      true,  'code 写法'),
  ('ISO 28000',                'ISO28000',   true,  'ISO'),
  -- ⚠️ 生产 suppliers.certifications 里存在，但 STATIC_PROGRAMS 里没有 → 不猜
  ('OEKO-TEX',                 NULL,         false, 'STATIC_PROGRAMS 中不存在的程序。需先在 lib/staticData.ts 补 taxonomy，再回来填 program_code。禁止字符串猜测。')
ON CONFLICT (display_name) DO UPDATE SET
  program_code = EXCLUDED.program_code,
  mapped       = EXCLUDED.mapped,
  note         = EXCLUDED.note;

-- =============================================================================
-- 2. supplier_certifications —— 补齐 CS-01 §6 要求的字段
--    保留 004 原有列（certificate_no / issuing_body / verification_status 等），
--    当前代码正在读写，一个都不动。
-- =============================================================================
ALTER TABLE supplier_certifications ADD COLUMN IF NOT EXISTS display_name        text;
ALTER TABLE supplier_certifications ADD COLUMN IF NOT EXISTS certification_body  text;
ALTER TABLE supplier_certifications ADD COLUMN IF NOT EXISTS certificate_number  text;
ALTER TABLE supplier_certifications ADD COLUMN IF NOT EXISTS source_url          text;
ALTER TABLE supplier_certifications ADD COLUMN IF NOT EXISTS source_type         text;
ALTER TABLE supplier_certifications ADD COLUMN IF NOT EXISTS last_checked_at     timestamptz;

-- claim_status：这条"声称"处于什么阶段（供应商自述 → 已核实）
ALTER TABLE supplier_certifications ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'UNKNOWN'
  CHECK (claim_status IN ('UNKNOWN','SELF_DECLARED','EVIDENCE_SUBMITTED','EVIDENCE_REVIEWED','VERIFIED','REJECTED','EXPIRED'));

-- evidence_status：支撑这条声称的证据处于什么状态。与 claim_status 是两条轴。
ALTER TABLE supplier_certifications ADD COLUMN IF NOT EXISTS evidence_status text NOT NULL DEFAULT 'NONE'
  CHECK (evidence_status IN ('NONE','SUBMITTED','REVIEWED','VERIFIED','REJECTED','EXPIRED'));

CREATE INDEX IF NOT EXISTS certifications_claim_status   ON supplier_certifications(claim_status);
CREATE INDEX IF NOT EXISTS certifications_evidence_status ON supplier_certifications(evidence_status);
CREATE INDEX IF NOT EXISTS certifications_source_type    ON supplier_certifications(source_type);
CREATE INDEX IF NOT EXISTS certifications_last_checked   ON supplier_certifications(last_checked_at)
  WHERE last_checked_at IS NOT NULL;

COMMENT ON COLUMN supplier_certifications.claim_status IS
  '声称自身的阶段。与 evidence_status 分离：有声称 ≠ 有证据，有证据 ≠ 已核实。';
COMMENT ON COLUMN supplier_certifications.source_url IS
  '来源 URL 只说明"这条信息从哪来"，绝不等同于 Verified Evidence。';

-- =============================================================================
-- 3. supplier_documents —— 补齐 CS-01 §7 要求的字段
-- =============================================================================
ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS source_url          text;
ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS document_reference  text;
ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS reviewed_at         timestamptz;
ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS reviewed_by         uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'PENDING'
  CHECK (review_status IN ('PENDING','IN_REVIEW','APPROVED','REJECTED','NEEDS_EVIDENCE'));

CREATE INDEX IF NOT EXISTS documents_review_status ON supplier_documents(review_status);
CREATE INDEX IF NOT EXISTS documents_source_type   ON supplier_documents(document_type);

COMMENT ON COLUMN supplier_documents.source_url IS
  '来源 URL 只说明文件从哪来，不是 Verified Evidence。是否采信由 review_status 决定。';
COMMENT ON COLUMN supplier_documents.review_status IS
  '人工复核状态。与 verification_status（平台是否审过文件）并存，二者语义不同。';

-- =============================================================================
-- 4. supplier_audits —— 补齐 CS-01 §8 要求的字段
-- =============================================================================
ALTER TABLE supplier_audits ADD COLUMN IF NOT EXISTS audit_firm  text;
ALTER TABLE supplier_audits ADD COLUMN IF NOT EXISTS scope       text;
ALTER TABLE supplier_audits ADD COLUMN IF NOT EXISTS source_url  text;
ALTER TABLE supplier_audits ADD COLUMN IF NOT EXISTS evidence_id uuid REFERENCES supplier_documents(id) ON DELETE SET NULL;

ALTER TABLE supplier_audits ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PENDING'
  CHECK (status IN ('PENDING','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED'));

CREATE INDEX IF NOT EXISTS audits_status      ON supplier_audits(status);
CREATE INDEX IF NOT EXISTS audits_audit_firm  ON supplier_audits(audit_firm) WHERE audit_firm IS NOT NULL;
CREATE INDEX IF NOT EXISTS audits_evidence_id ON supplier_audits(evidence_id) WHERE evidence_id IS NOT NULL;

COMMENT ON COLUMN supplier_audits.status IS
  '审核事件本身的执行状态。与 verification_status（记录是否已复核）是两条轴。';
COMMENT ON TABLE supplier_audits IS
  '⚠️ 只在真的发生过审核时才插记录。绝不从 suppliers.audit_status 文本自动生成。';

-- =============================================================================
-- 5. admin_audit_log —— 补齐 CS-01 §9 要求的字段
--    已有 004 列的语义对应关系（不重复建列，避免双份真相）：
--      actor       ← actor_id + actor_email
--      entity_type ← target_type
--      entity_id   ← target_id
--      before/after← diff (jsonb 差分)
--    下面只补 004 没有的：ip / metadata
-- =============================================================================
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS ip        text;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS metadata  jsonb;

COMMENT ON COLUMN admin_audit_log.ip IS
  '记录操作来源 IP（若应用层拿得到）。拿不到就留 NULL，不伪造。';
COMMENT ON COLUMN admin_audit_log.metadata IS
  '附加上下文（user-agent、request id 等）。diff 列承载 before/after，target_type/target_id 承载实体。';

-- =============================================================================
-- 6. schema_migrations —— 版本记录（此前没有，CS-00 报告里已列为遗留项）
-- =============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  note        text
);

INSERT INTO schema_migrations (version, note) VALUES
  ('001', 'init: profiles/suppliers/evidence/capabilities/rfqs'),
  ('002', 'payments: memberships/stripe_events'),
  ('003', 'fix profile company'),
  ('004', 'CS-01: documents/certifications/audits/admin_audit_log + suppliers.verification_level'),
  ('005', 'CS-01: private storage bucket supplier-docs'),
  ('006', 'CS-01: compliance fields + certification_program_alias')
ON CONFLICT (version) DO NOTHING;

-- =============================================================================
--                          RLS（Row Level Security）
-- =============================================================================

-- ---------- certification_program_alias：参照数据，公开可读；写仅 admin ----------
ALTER TABLE certification_program_alias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cert_alias_select ON certification_program_alias;
CREATE POLICY cert_alias_select ON certification_program_alias
  FOR SELECT USING (true);

DROP POLICY IF EXISTS cert_alias_admin_all ON certification_program_alias;
CREATE POLICY cert_alias_admin_all ON certification_program_alias
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---------- schema_migrations：仅 admin 可读；无写 policy（只走 service_role）----------
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schema_migrations_admin_select ON schema_migrations;
CREATE POLICY schema_migrations_admin_select ON schema_migrations
  FOR SELECT USING (is_admin());
-- 不建 INSERT/UPDATE/DELETE policy = 客户端一律拒绝写入

-- =============================================================================
-- 完成。下一步：
--   1) 刷新 PostgREST schema cache（否则新表仍是 404）
--   2) 跑 supabase/cs01/03_postcheck.sql 实测
-- =============================================================================
NOTIFY pgrst, 'reload schema';
