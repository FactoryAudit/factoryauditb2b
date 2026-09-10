-- =============================================================================
-- FactoryAuditB2B V2.1 — 004 供应商验证与证据中心（Verification & Evidence Center）
-- 创建日期：2026-09-10
--
-- 设计约束（改动本文件前必读）：
--   1. Verification（平台对供应商的核验行为）与 Certification（第三方对工厂的
--      证书）是两条独立轴，禁止混用。前者落在 suppliers.verification_level，
--      后者落在 supplier_certifications。
--   2. ISO 9001 是 Certification；BSCI/SMETA 是 Assessment/Social Compliance
--      Report；FactoryAuditB2B On-site Audit 是平台验证行为。数据必须分开。
--   3. 不得虚构核验。spec §20 明确：已有 supplier 的 verification_level
--      一律默认 'unverified'，不做按旧字段自动升档（旧 verification_status
--      是历史展示字段，继续由 lib/verification.ts 负责展示，不参与本次判定）。
--   4. 「Document Verified」只代表平台审核过该文件，不得表述为
--      「Certification Verified」。文案层约束见 README/交付报告。
--   5. 原始审核报告默认不公开。bucket 私有 + 公开侧只渲染元数据。
--   6. 写操作默认仅 admin；读操作按表分别放开（应用层用 service_role）。
--
-- 依赖：001_init.sql（set_updated_at() / is_admin() / suppliers / profiles）
-- =============================================================================

-- =============================================================================
-- 1. supplier_documents —— 文件元数据（真实文件在 Supabase Storage 私有 bucket）
--    字段命名对齐 spec §4：document_type / document_name / verification_status
--    / expiry_date / visibility
-- =============================================================================
CREATE TABLE IF NOT EXISTS supplier_documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id        uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  -- 文件类型（可扩展：新增值只需改 CHECK）
  document_type      text NOT NULL CHECK (document_type IN (
                       'business_license',        -- 营业执照
                       'factory_license',         -- 工厂资质
                       'iso_certificate',         -- 体系证书
                       'social_audit_report',     -- 社会责任审核报告（BSCI/SMETA/SA8000）
                       'quality_audit_report',    -- 质量审核报告
                       'product_test_report',     -- 产品检测报告
                       'other'
                     )),
  document_name      text NOT NULL,
  -- 可选：关联 STATIC_PROGRAMS.code（ISO9001/BSCI/...），用于按认证类型筛选
  program_code       text,
  -- Supabase Storage 对象路径：{supplier_id}/{document_type}/{yyyy-mm}/{uuid}-{filename}
  file_path          text NOT NULL,
  mime               text NOT NULL CHECK (mime IN ('application/pdf','image/jpeg','image/png')),
  -- 上限 10MB，与 storage bucket file_size_limit 保持一致
  size_bytes         bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256             text,
  -- 人工审核状态（spec §6）
  verification_status text NOT NULL DEFAULT 'PENDING'
                     CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED','EXPIRED')),
  -- AI 抽取流水线状态（spec §22）：上传不阻塞，AI 结果一律进 PENDING_REVIEW
  extraction_status  text NOT NULL DEFAULT 'NONE'
                     CHECK (extraction_status IN ('NONE','PROCESSING','PENDING_REVIEW','REVIEWED','FAILED')),
  -- 证书/报告自身有效期（可为空：营业执照等无固定有效期）
  expiry_date        date,
  -- admin=仅后台 | paid=会员可见元数据 | public=公开元数据。
  -- 注意：任何取值都不代表文件本体公开（bucket 始终私有）。
  visibility         text NOT NULL DEFAULT 'admin'
                     CHECK (visibility IN ('admin','paid','public')),
  uploaded_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at        timestamptz NOT NULL DEFAULT now(),
  verified_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at        timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_supplier   ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS documents_type       ON supplier_documents(document_type);
CREATE INDEX IF NOT EXISTS documents_review     ON supplier_documents(verification_status);
CREATE INDEX IF NOT EXISTS documents_expiry     ON supplier_documents(expiry_date)
  WHERE expiry_date IS NOT NULL;

DROP TRIGGER IF EXISTS documents_set_updated_at ON supplier_documents;
CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON supplier_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE supplier_documents IS
  '供应商文件元数据。真实文件存于 Supabase Storage 私有 bucket supplier-docs，永不公开原始 URL。';
COMMENT ON COLUMN supplier_documents.file_path IS
  'Storage 对象路径，非公开 URL。下载必须服务端签时。公开侧只展示元数据与状态。';

-- =============================================================================
-- 2. supplier_certifications —— 证书实体（替代 suppliers.certifications text[]）
--    旧 text[] 列保留作 fallback，不删。
-- =============================================================================
CREATE TABLE IF NOT EXISTS supplier_certifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id        uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  -- 证书类型，对应 STATIC_PROGRAMS.code（ISO9001/ISO14001/BSCI/SMETA/...）
  -- 不做 CHECK 枚举：管理员未来可新增类型，硬编码会堵死扩展。
  program_code       text NOT NULL,
  certificate_no     text,
  issuing_body       text,
  issue_date         date,
  expiry_date        date,
  scope              text,
  -- 审核状态（spec §6/§10）。Valid / Expiring Soon 由 expiry_date 计算，不落库，
  -- 避免状态与日期不一致（例如任务没跑导致一直显示 Valid）。
  verification_status text NOT NULL DEFAULT 'PENDING'
                     CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED','EXPIRED')),
  -- 关联的证据文件（证书扫描件）
  evidence_doc_id    uuid REFERENCES supplier_documents(id) ON DELETE SET NULL,
  verified_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at        timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS certifications_supplier ON supplier_certifications(supplier_id);
CREATE INDEX IF NOT EXISTS certifications_program  ON supplier_certifications(program_code);
CREATE INDEX IF NOT EXISTS certifications_status   ON supplier_certifications(verification_status);
CREATE INDEX IF NOT EXISTS certifications_expiry   ON supplier_certifications(expiry_date)
  WHERE expiry_date IS NOT NULL;

DROP TRIGGER IF EXISTS certifications_set_updated_at ON supplier_certifications;
CREATE TRIGGER certifications_set_updated_at
  BEFORE UPDATE ON supplier_certifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE supplier_certifications IS
  '第三方证书/报告实体。program_code 不设枚举，便于管理员新增类型。';
COMMENT ON COLUMN supplier_certifications.verification_status IS
  '仅代表平台是否审核过该证书资料，不代表证书真实性背书。';

-- =============================================================================
-- 3. supplier_audits —— 审核/验厂事件时间线（spec §2 的验证行为载体）
-- =============================================================================
CREATE TABLE IF NOT EXISTS supplier_audits (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id        uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  -- 与 suppliers.verification_level 的取值同源（见第 5 节）
  audit_type         text NOT NULL CHECK (audit_type IN (
                       'self_assessment',
                       'platform_assessment',
                       'on_site_audit',
                       'third_party_audit'
                     )),
  -- 标准/方案代码，可空（例如纯平台线上测评不挂标准）
  standard_code      text,
  auditor_name       text,
  auditor_org        text,
  audit_date         date NOT NULL,
  report_doc_id      uuid REFERENCES supplier_documents(id) ON DELETE SET NULL,
  result             text CHECK (result IN ('pass','pass_with_findings','fail','pending')),
  findings_critical  int NOT NULL DEFAULT 0 CHECK (findings_critical >= 0),
  findings_major     int NOT NULL DEFAULT 0 CHECK (findings_major >= 0),
  findings_minor     int NOT NULL DEFAULT 0 CHECK (findings_minor >= 0),
  cap_deadline       date,
  verification_status text NOT NULL DEFAULT 'PENDING'
                     CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED','EXPIRED')),
  verified_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at        timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audits_supplier ON supplier_audits(supplier_id);
CREATE INDEX IF NOT EXISTS audits_date     ON supplier_audits(audit_date DESC);
CREATE INDEX IF NOT EXISTS audits_type     ON supplier_audits(audit_type);
CREATE INDEX IF NOT EXISTS audits_review   ON supplier_audits(verification_status);

DROP TRIGGER IF EXISTS audits_set_updated_at ON supplier_audits;
CREATE TRIGGER audits_set_updated_at
  BEFORE UPDATE ON supplier_audits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE supplier_audits IS
  '审核事件（自评/平台评估/现场审核/第三方审核）。前台只展示 verification_status=VERIFIED 的记录。';

-- =============================================================================
-- 4. admin_audit_log —— 管理操作追溯（spec §19）
--    仅 service_role 写入（不开 INSERT policy）；admin 可读。
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           bigserial PRIMARY KEY,
  actor_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email  text,
  -- 例：doc.upload / doc.delete / cert.approve / cert.reject / cert.update
  --     / audit.approve / audit.reject / supplier.update
  action       text NOT NULL,
  target_type  text NOT NULL,   -- 'document' | 'certification' | 'audit' | 'supplier'
  target_id    text NOT NULL,
  -- 变更前/后快照（仅记录非敏感字段）
  diff         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_actor  ON admin_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS audit_log_recent ON admin_audit_log(created_at DESC);

COMMENT ON TABLE admin_audit_log IS
  '管理操作审计日志。不建 INSERT policy，仅 service_role 可写，防止客户端伪造。';

-- =============================================================================
-- 5. suppliers.verification_level —— 平台核验等级（与 Certification 解耦）
--    spec §2 五档；spec §20 要求已有数据一律默认 UNVERIFIED，不自动升档。
-- =============================================================================
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS verification_level text NOT NULL DEFAULT 'unverified'
  CHECK (verification_level IN (
    'unverified',          -- 目前没有足够验证证据
    'self_assessment',     -- 工厂自行提交资料与自评
    'platform_assessment', -- 平台完成资料审核/线上测评/风险评估
    'on_site_audit',       -- 平台或授权审核人员完成现场审核
    'third_party_audit'    -- 独立第三方机构完成审核
  ));

CREATE INDEX IF NOT EXISTS suppliers_verification_level ON suppliers(verification_level);

COMMENT ON COLUMN suppliers.verification_level IS
  '平台核验等级（spec §2）。与 supplier_certifications 相互独立：证书是第三方行为，本字段是平台行为。没有记录在案的核验事件不得上调此值。';

-- =============================================================================
--                          RLS（Row Level Security）
-- =============================================================================
ALTER TABLE supplier_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_audits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log         ENABLE ROW LEVEL SECURITY;

-- ---------- supplier_documents：admin 全权；付费/公开仅元数据、且须已发布 ----------
DROP POLICY IF EXISTS documents_admin_all ON supplier_documents;
CREATE POLICY documents_admin_all ON supplier_documents
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS documents_tier_select ON supplier_documents;
CREATE POLICY documents_tier_select ON supplier_documents
  FOR SELECT USING (
    visibility IN ('paid','public')
    AND verification_status <> 'REJECTED'
    AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = supplier_id AND s.is_published = true)
  );
  -- 注意：本 policy 只放开行，文件本体在私有 bucket，永远不经此路径公开。

-- ---------- supplier_certifications：公开侧仅 VERIFIED ----------
DROP POLICY IF EXISTS certifications_admin_all ON supplier_certifications;
CREATE POLICY certifications_admin_all ON supplier_certifications
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS certifications_verified_select ON supplier_certifications;
CREATE POLICY certifications_verified_select ON supplier_certifications
  FOR SELECT USING (
    verification_status = 'VERIFIED'
    AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = supplier_id AND s.is_published = true)
  );

-- ---------- supplier_audits：公开侧仅 VERIFIED ----------
DROP POLICY IF EXISTS audits_admin_all ON supplier_audits;
CREATE POLICY audits_admin_all ON supplier_audits
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS audits_verified_select ON supplier_audits;
CREATE POLICY audits_verified_select ON supplier_audits
  FOR SELECT USING (
    verification_status = 'VERIFIED'
    AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = supplier_id AND s.is_published = true)
  );

-- ---------- admin_audit_log：仅 admin 可读；写操作只走 service_role ----------
DROP POLICY IF EXISTS audit_log_admin_select ON admin_audit_log;
CREATE POLICY audit_log_admin_select ON admin_audit_log
  FOR SELECT USING (is_admin());
-- 不建 INSERT/UPDATE/DELETE policy = 客户端一律拒绝，只有 service_role 能写。

-- =============================================================================
-- 完成。下一步：
--   1) 跑 005_storage.sql 建私有 bucket
--   2) 跑 scripts/check-v21-config.mjs 自检
-- =============================================================================
