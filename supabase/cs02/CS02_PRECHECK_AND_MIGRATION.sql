-- =============================================================================
-- FactoryAuditB2B — CS02_PRECHECK_AND_MIGRATION.sql
-- 创建日期：2026-09-10
--
-- 执行位置：Supabase Dashboard → SQL Editor
-- 前置：CS-01（004 + 005 + 006）已执行完毕，tag cs01-migrated
--
-- ⚠️ 本文件**不新增任何字段、不修改任何数据值**。
--    核查结论：现有 22 列已足以承载 legacy claim，无需重复建字段。
--    （详见下方 PART 1 第 6 节与文件末尾「为什么不需要新字段」）
--
-- 本文件唯一的结构性操作是 COMMENT ON COLUMN：
--   非破坏性、幂等、只改元数据、不触碰任何行数据。
-- =============================================================================


-- =============================================================================
-- PART 1 —— PRECHECK（只读 SELECT，先跑这段，确认现状）
-- =============================================================================

-- ---------- 1. suppliers 现有列清单（期望 22 列）----------
SELECT ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'suppliers'
ORDER BY ordinal_position;

-- ---------- 2. 4 家 Supplier 当前值（确认 legacy claim 原值）----------
SELECT slug, verification_status, audit_status, certifications,
       risk_score, verification_level, created_at, updated_at
FROM public.suppliers
ORDER BY slug;

-- ---------- 3. verification_level 分布（期望：unverified × 4）----------
SELECT verification_level, COUNT(*) AS n
FROM public.suppliers
GROUP BY verification_level
ORDER BY 1;

-- ---------- 4. verification_level 的 CHECK 约束（期望 5 档）----------
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.suppliers'::regclass
  AND contype = 'c'
  AND conname ILIKE '%verification_level%';

-- ---------- 5. Legacy claim 数量统计（期望 4 + 4 + 8 = 16 条）----------
SELECT 'verification_status' AS claim_kind, COUNT(*) FILTER (WHERE verification_status IS NOT NULL) AS n
FROM public.suppliers
UNION ALL
SELECT 'audit_status', COUNT(*) FILTER (WHERE audit_status IS NOT NULL) FROM public.suppliers
UNION ALL
SELECT 'certifications', COALESCE(SUM(jsonb_array_length(to_jsonb(certifications))), 0)
FROM public.suppliers
WHERE jsonb_typeof(to_jsonb(certifications)) = 'array';

-- ---------- 6. 候选复用字段核查（决定要不要建新字段）----------
--    逐条比对 CS-02 提议的 4 个字段与现有列：
SELECT
  'legacy_claim'      AS proposed_field,
  'verification_status + audit_status + certifications' AS covered_by_existing,
  '三列本身就是 legacy claim 本体，且要求不得删改 → 不新增' AS verdict
UNION ALL SELECT 'claim_recorded_at', 'created_at',
  '已有真实写入时间 2026-09-03 → 不新增（禁止填猜测日期）'
UNION ALL SELECT 'claim_status', 'verification_level',
  '平台核验状态已由 verification_level 表达；认证级 claim_status 在 supplier_certifications 表已有（006）→ 不新增'
UNION ALL SELECT 'claim_source', '(无)',
  '4 家来源单一（seed）；多来源归属 CS-03 Supplier Ingestion → 本次不新增';

-- ---------- 7. 现有列注释（ROLLBACK 时用于精确恢复，务必先看一眼）----------
SELECT c.column_name, col_description('public.suppliers'::regclass, c.ordinal_position) AS existing_comment
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name = 'suppliers'
ORDER BY c.ordinal_position;

-- ---------- 8. 3 张证据表必须为 0 行（禁止从 legacy 生成证据）----------
SELECT 'supplier_documents' AS tbl, COUNT(*) AS n FROM public.supplier_documents
UNION ALL SELECT 'supplier_certifications', COUNT(*) FROM public.supplier_certifications
UNION ALL SELECT 'supplier_audits',         COUNT(*) FROM public.supplier_audits
UNION ALL SELECT 'admin_audit_log',         COUNT(*) FROM public.admin_audit_log;

-- ---------- 9. 业务表计数（迁移前后必须完全一致）----------
SELECT 'suppliers' AS tbl, COUNT(*) AS n FROM public.suppliers
UNION ALL SELECT 'supplier_evidence',     COUNT(*) FROM public.supplier_evidence
UNION ALL SELECT 'supplier_capabilities', COUNT(*) FROM public.supplier_capabilities
UNION ALL SELECT 'profiles',              COUNT(*) FROM public.profiles
UNION ALL SELECT 'memberships',           COUNT(*) FROM public.memberships
UNION ALL SELECT 'rfqs',                  COUNT(*) FROM public.rfqs
ORDER BY 1;


-- =============================================================================
-- PART 2 —— MIGRATION（仅 COMMENT ON COLUMN，非破坏性、幂等）
--
-- ⚠️ 请先跑完 PART 1 并确认：
--    · 22 列存在（第 1 节）
--    · verification_level 4 家全 unverified（第 3 节）
--    · 3 张证据表全 0 行（第 8 节）
--    · 第 7 节已记录现有注释（供 rollback）
--
-- 目的：把「这几列是 legacy claim、不得用于公开等级」写进数据库元数据，
--       防止后人再次误用（本次 bug 正是因为没人知道它们是 legacy）。
-- 影响：0 行数据变更，0 结构变更，可重复执行。
-- =============================================================================

COMMENT ON COLUMN suppliers.verification_status IS
  'LEGACY CLAIM（历史声明，非当前公开状态）。CS-02 起禁止用此列推导公开 Verification Level —— 详情页公开等级的唯一权威源是 suppliers.verification_level。原值不得删除、不得修改，仅作历史追踪。';

COMMENT ON COLUMN suppliers.audit_status IS
  'LEGACY CLAIM（历史声明，非当前公开状态）。当前 supplier_audits 表为 0 行，故此列中的 "Audited 2026-06" / "Audited 2026-03" 等文本无任何审核记录支撑，公开侧不得显示为 Audited。原值不得删除、不得修改。';

COMMENT ON COLUMN suppliers.certifications IS
  'LEGACY CLAIM（供应商/来源自述的认证声明，非平台核验结果）。是否审阅过由 supplier_capabilities.verified 与 supplier_certifications 表决定。原值不得删除、不得修改。';

COMMENT ON COLUMN suppliers.verification_level IS
  '公开 Verification Level 的唯一权威源（CS-02 起）。与 supplier_certifications 相互独立：证书是第三方行为，本字段是平台行为。没有记录在案的核验事件不得上调此值。当前 4 家均为 unverified。';

-- schema cache 刷新（COMMENT 不改结构，但保持与 CS-01 一致的做法）
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- PART 3 —— POSTCHECK（只读，确认注释生效且数据零变化）
-- =============================================================================

-- ---------- 1. 4 条注释是否已写入 ----------
SELECT c.column_name,
       col_description('public.suppliers'::regclass, c.ordinal_position) AS comment_now
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name = 'suppliers'
  AND c.column_name IN ('verification_status','audit_status','certifications','verification_level')
ORDER BY c.column_name;

-- ---------- 2. 数据零变化校验（必须与 PART 1 第 2/3/8/9 节一致）----------
SELECT slug, verification_status, audit_status, certifications,
       risk_score, verification_level
FROM public.suppliers
ORDER BY slug;

SELECT verification_level, COUNT(*) AS n FROM public.suppliers GROUP BY 1 ORDER BY 1;

SELECT 'supplier_documents' AS tbl, COUNT(*) AS n FROM public.supplier_documents
UNION ALL SELECT 'supplier_certifications', COUNT(*) FROM public.supplier_certifications
UNION ALL SELECT 'supplier_audits',         COUNT(*) FROM public.supplier_audits
UNION ALL SELECT 'admin_audit_log',         COUNT(*) FROM public.admin_audit_log;

SELECT 'suppliers' AS tbl, COUNT(*) AS n FROM public.suppliers
UNION ALL SELECT 'supplier_evidence',     COUNT(*) FROM public.supplier_evidence
UNION ALL SELECT 'supplier_capabilities', COUNT(*) FROM public.supplier_capabilities
UNION ALL SELECT 'profiles',              COUNT(*) FROM public.profiles
UNION ALL SELECT 'memberships',           COUNT(*) FROM public.memberships
UNION ALL SELECT 'rfqs',                  COUNT(*) FROM public.rfqs
ORDER BY 1;

-- ---------- 3. 确认没有新增任何列（期望仍是 22 列）----------
SELECT COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'suppliers';


-- =============================================================================
--                     为什么 CS-02 不需要新增字段
-- =============================================================================
-- 用户原则：「只有确实没有合适字段时，才新增。不要为了结构完整而重复建字段。」
--
-- 1) legacy_claim      → 不新增。
--    verification_status / audit_status / certifications 三列**本身就是** legacy
--    claim 本体，且 CS-02 明确要求「不得删除、不得修改原值」。
--    再建一个 legacy_claim jsonb = 同一份数据存两处，未来必然不同步。
--
-- 2) claim_recorded_at → 不新增。
--    created_at 已有真实写入时间（2026-09-03T16:39:04~06+00:00）。
--    用户明确要求「不得填一个猜测日期」，而这里已有真日期，无需再造。
--
-- 3) claim_status      → 不新增。
--    · 平台侧核验状态由 verification_level 表达（CS-01 已建，当前 4 家 unverified）
--    · 认证级 claim_status 在 supplier_certifications 表已存在（006 建，带 CHECK）
--    · 该表当前 0 行，且 CS-02 禁止从 legacy 生成记录 —— 此刻无从谈起 claim_status
--
-- 4) claim_source      → 不新增。
--    4 家来源单一（seed 脚本写入）。真实多来源（供应商自提交 / T3 平台 / 人工）
--    属于 CS-03 Supplier Ingestion 的范围，届时再建不迟。
--
-- 结论：**CS-02 的 DDL = 4 条 COMMENT，0 新增字段，0 数据变更。**
-- =============================================================================
