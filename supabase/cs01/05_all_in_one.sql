-- =============================================================================
-- CS-01 —— 05_all_in_one.sql（004 + 005 + 006 合并，一次粘贴一次执行）
--
-- 内容与分档执行完全一致：语句、顺序、语义都没变，只是拼在一条脚本里。
-- 好处：SQL Editor 会把整段包在一个事务里 —— 任何一句失败则全部回滚，
--       不会出现「004 成功、006 失败」的半吊子状态。
-- 结尾自带 NOTIFY pgrst，无需再单独跑。
--
-- ⚠️ 前提条件：01_precheck.sql 已确认 6 个对象全 false（无冲突）。
-- ⚠️ 本脚本不写任何业务数据：对 supplier_documents / supplier_certifications /
--    supplier_audits 的 INSERT 语句数量为 0。
-- =============================================================================

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

-- ============================================ 005 ============================================
-- =============================================================================
-- FactoryAuditB2B V2.1 — 005 证据文件存储（Supabase Storage 私有 bucket）
-- 创建日期：2026-09-10
--
-- 设计约束：
--   1. bucket 必须私有（public = false）。原始审核报告/证书扫描件永不公开 URL。
--   2. 读写一律走服务端 service_role（绕过 RLS）。不建任何 storage.objects
--      policy —— 无 policy 即默认拒绝 anon/authenticated，这是有意的。
--   3. 文件大小上限 10MB、MIME 白名单 pdf/jpeg/png，与 supplier_documents
--      的 CHECK 约束保持一致。
--   4. 对象命名：{supplier_id}/{document_type}/{yyyy-mm}/{uuid}-{filename}
--      带前缀的目的：① 便于按供应商批量导出/删除；② 防止路径穿越。
--
-- 执行位置：Supabase Dashboard → SQL Editor（DDL/管理操作无法经 PostgREST 执行）
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-docs',
  'supplier-docs',
  false,          -- 私有：不生成公开 URL
  10485760,       -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 自检：确认 bucket 已建且为私有
DO $$
DECLARE
  v_public boolean;
BEGIN
  SELECT public INTO v_public FROM storage.buckets WHERE id = 'supplier-docs';
  IF v_public IS NULL THEN
    RAISE EXCEPTION '[005] bucket supplier-docs 未创建成功';
  END IF;
  IF v_public THEN
    RAISE EXCEPTION '[005] bucket supplier-docs 必须是私有（public=false），当前为公开';
  END IF;
  RAISE NOTICE '[005] OK：bucket supplier-docs 已就绪且为私有';
END $$;

-- =============================================================================
-- 完成。下一步：跑 scripts/check-v21-config.mjs 自检（应显示 storage bucket 存在）。
-- =============================================================================

-- ============================================ 006 ============================================
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
