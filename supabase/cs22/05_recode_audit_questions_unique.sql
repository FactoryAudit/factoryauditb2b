-- =============================================================================
-- CS-22 / 05_recode_audit_questions_unique.sql
--
-- 修复数据缺陷：audit_questions 共 72 行，但仅有 41 个 distinct question_code。
-- 成因：CS-21 种子里 SOCIAL_COMPLIANCE 与 QUALITY 两套清单都沿用了 A01–H04 字母编号，
--       31 个字母编号在两张模板里各出现一次，导致 question_code 重复。
--
-- 危害（已体现在 CS-C 生产验收里）：
--   · responses_json / item_review_json 以 question_code 为键 → 最多只能存 41 个键；
--   · verification_items.item_key 以 question_code 为键 → 触发唯一索引
--     (verification_record_id, item_key) 冲突，批量插入整批失败（items=0）。
--
-- 修复：按「模板 + 组内顺序」重写为全局唯一编码
--   SOCIAL_COMPLIANCE -> SC01..SC37（9 组 37 项，A–I）
--   QUALITY           -> QC01..QC35（8 组 35 项，A–H）
-- 与种子文件 supabase/cs21/02_seed_audit_checklists.sql 修订后的编码保持一致。
--
-- 安全性：
--   · 全站无任何真实自评答案（唯一一条 self_assessment 的 responses_json = NULL）；
--   · 无任何外键以 question_code 为引用（verification_items 只存 item_key 文本，且无生产数据）；
--   · 纯 UPDATE 数据，不删行、不改结构，可安全重跑（幂等）。
-- =============================================================================

UPDATE public.audit_questions AS aq
SET question_code = ranked.new_code
FROM (
  SELECT
    aq2.id,
    CASE t.code
      WHEN 'SOCIAL_COMPLIANCE'
        THEN 'SC' || LPAD(
          ROW_NUMBER() OVER (
            PARTITION BY t.code ORDER BY s.sort_order, aq2.sort_order, aq2.id
          )::text, 2, '0')
      WHEN 'QUALITY'
        THEN 'QC' || LPAD(
          ROW_NUMBER() OVER (
            PARTITION BY t.code ORDER BY s.sort_order, aq2.sort_order, aq2.id
          )::text, 2, '0')
      ELSE 'OX' || LPAD(
          ROW_NUMBER() OVER (
            PARTITION BY t.code ORDER BY s.sort_order, aq2.sort_order, aq2.id
          )::text, 2, '0')
    END AS new_code
  FROM public.audit_questions aq2
  JOIN public.audit_sections s ON s.id = aq2.section_id
  JOIN public.audit_templates t ON t.id = s.template_id
) AS ranked
WHERE aq.id = ranked.id;

-- 自检（应返回 72 / 0 / 72）：
--   SELECT count(*) AS total, count(*) FILTER (WHERE c) AS dup, count(DISTINCT question_code) AS distinct_codes
--   FROM (SELECT question_code, count(*) OVER (PARTITION BY question_code) > 1 AS c FROM public.audit_questions) x;
