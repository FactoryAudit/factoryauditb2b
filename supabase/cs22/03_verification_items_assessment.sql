-- CS-22 / 03 —— verification_items 锚定到自评估（只加 1 列 + 1 索引，无 DELETE / 无 DROP）
--
-- P0-B 结论：**不建** supplier_assessment_answers 表。
--   答案的唯一存储位置是 supplier_assessments.responses_json（CS-21 既有），
--   共 72 项来自 audit_templates / audit_sections / audit_questions。
--
-- 验证项（verification_items）必须能回答三个问题：
--   ① 核的是哪份自评估？ → assessment_id（本文件新增）
--   ② 核的是哪一题？     → item_key（= audit_questions.question_code，既有）
--   ③ 供应商答了什么？   → supplier_answer（既有，从 responses_json 快照）
-- 证据在 supplier_evidence（既有 assessment_id + item_key），天然与验证项对齐。
--
-- 为什么用 item_key 而不是 template_item_id：
--   audit_questions 的主键是 uuid，但 question_code 才是跨环境稳定、可人读、
--   且已作为 responses_json 的键存在的标识符 ⇒ 用它做关联键，不引入第二套 ID。

ALTER TABLE public.verification_items
  ADD COLUMN IF NOT EXISTS assessment_id uuid;

CREATE INDEX IF NOT EXISTS verification_items_assessment_idx
  ON public.verification_items (assessment_id);

-- 同一验证记录下同一题只允许一行（幂等建索引；已存在的重复行由 CS-C 审核台按需合并，不在此删数据）
CREATE UNIQUE INDEX IF NOT EXISTS verification_items_record_item_uniq
  ON public.verification_items (verification_record_id, item_key);

NOTIFY pgrst, 'reload schema';
