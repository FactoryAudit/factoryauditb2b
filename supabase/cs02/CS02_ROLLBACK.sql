-- =============================================================================
-- FactoryAuditB2B — CS02_ROLLBACK.sql
-- 创建日期：2026-09-10
--
-- ⚠️ 仅在需要回退时执行。只读本文件不会有任何影响。
--
-- CS-02 的 DDL 只有 4 条 COMMENT ON COLUMN —— 没有新增列、没有改数据。
-- 所以回滚的全部内容 = 把注释恢复原状（或清空）。
-- 不存在「删列导致丢数据」的风险。
-- =============================================================================


-- ---------- 0. 安全确认（先跑这段，确认数据与结构未被动过）----------
SELECT slug, verification_status, audit_status, certifications,
       risk_score, verification_level
FROM public.suppliers
ORDER BY slug;

SELECT COUNT(*) AS column_count_should_be_22
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'suppliers';

SELECT 'supplier_documents' AS tbl, COUNT(*) AS n FROM public.supplier_documents
UNION ALL SELECT 'supplier_certifications', COUNT(*) FROM public.supplier_certifications
UNION ALL SELECT 'supplier_audits',         COUNT(*) FROM public.supplier_audits;
-- 期望：4 家原值不变、22 列、3 张证据表 0 行


-- =============================================================================
-- 1. 回滚方式 A：把 4 条注释清空（推荐，最简单）
--    说明：这 4 列在 CS-02 之前**没有注释**（除 verification_level 有 004 写的
--    原注释，见方式 B）。清空 = 回到 CS-02 之前的状态。
-- =============================================================================

-- verification_status / audit_status / certifications：CS-02 前无注释 → 清空
COMMENT ON COLUMN suppliers.verification_status IS NULL;
COMMENT ON COLUMN suppliers.audit_status        IS NULL;
COMMENT ON COLUMN suppliers.certifications      IS NULL;


-- =============================================================================
-- 2. 回滚方式 B：verification_level 恢复到 004 写的原注释
--    （CS-02 只是增强了措辞，原注释见 004_documents.sql 第 216-217 行）
--    如果选了方式 A，就不要再跑这一段。
-- =============================================================================

-- COMMENT ON COLUMN suppliers.verification_level IS
--   '平台核验等级（spec §2）。与 supplier_certifications 相互独立：证书是第三方行为，本字段是平台行为。没有记录在案的核验事件不得上调此值。';


-- =============================================================================
-- 3. 确认回滚结果
-- =============================================================================

NOTIFY pgrst, 'reload schema';

SELECT c.column_name,
       col_description('public.suppliers'::regclass, c.ordinal_position) AS comment_now
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name = 'suppliers'
  AND c.column_name IN ('verification_status','audit_status','certifications','verification_level')
ORDER BY c.column_name;
-- 期望：前 3 列 comment_now = NULL；verification_level 保持 004 的原注释

SELECT COUNT(*) AS column_count_should_still_be_22
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'suppliers';


-- =============================================================================
-- 附：本 Change Set 不存在的数据回滚
-- =============================================================================
-- CS-02 全程未执行任何 INSERT / UPDATE / DELETE：
--   · 未导入 Supplier Evidence
--   · 未生成 Audit Record
--   · 未创建 Certification Record
--   · 未修改 verification_status / audit_status / certifications 原值
--   · 未修改 risk_score
--   · 未修改 inspection_history
-- 因此没有需要回滚的数据。代码改动的回滚走 git revert <commit>。
-- =============================================================================
