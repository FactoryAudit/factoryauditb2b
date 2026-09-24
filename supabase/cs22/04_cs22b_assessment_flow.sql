-- CS-22 / CS-B —— 自评流程：状态机扩展 + 逐项审核备注
--
-- 铁律：只 ADD COLUMN / 放宽 CHECK / CREATE INDEX。
--       不 DROP 表、不 DROP 列、不 DELETE 数据、不 reset。
--       答案仍然只存 supplier_assessments.responses_json（**不建 answers 表**）。
--
-- 为什么必须动 CHECK：
--   1) supplier_assessments.status 目前只有
--      draft/submitted/under_review/published/rejected，
--      而 CS-B 的退回补件链路需要 action_required（管理员退回）与
--      resubmitted（供应商补件重交）。这是**放宽**枚举（超集），不是改语义。
--   2) supplier_evidence.visibility 目前只允许 public/paid，
--      而证据按 P0-D 必须**默认私有**，需要 private 这一档。同样是放宽。

-- ============================================================================
-- 1. supplier_assessments：逐项审核备注（管理员退回某一项时的 note，CS-C 写）
--    整体意见继续用既有 review_notes，这里只放**逐项**结构，两者不混用。
--    形状：{"<itemKey>": {"status": "NEED_MORE_INFO", "note": "...", "by": "...", "at": "..."}}
-- ============================================================================
ALTER TABLE public.supplier_assessments ADD COLUMN IF NOT EXISTS item_review_json jsonb;

-- 状态机放宽：新增 action_required / resubmitted（原五档全部保留）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'supplier_assessments_status_check'
       AND conrelid = 'public.supplier_assessments'::regclass
  ) THEN
    ALTER TABLE public.supplier_assessments
      DROP CONSTRAINT supplier_assessments_status_check;
  END IF;

  ALTER TABLE public.supplier_assessments
    ADD CONSTRAINT supplier_assessments_status_check
    CHECK (status IN (
      'draft','submitted','under_review','published','rejected',
      'action_required','resubmitted'
    ));
END $$;

-- ============================================================================
-- 2. supplier_evidence：允许 private（证据默认私有，仅签名 URL 可读）
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'supplier_evidence_visibility_check'
       AND conrelid = 'public.supplier_evidence'::regclass
  ) THEN
    ALTER TABLE public.supplier_evidence
      DROP CONSTRAINT supplier_evidence_visibility_check;
  END IF;

  ALTER TABLE public.supplier_evidence
    ADD CONSTRAINT supplier_evidence_visibility_check
    CHECK (visibility = ANY (ARRAY['public'::text, 'paid'::text, 'private'::text]));
END $$;

-- 逐项证据检索（一个审核项最多 5 份，服务端计数与列表都走这里）
CREATE INDEX IF NOT EXISTS ix_supplier_evidence_item
  ON public.supplier_evidence (assessment_id, item_key);

-- 草稿/补件期按供应商拉全量证据（页面初始化一次取完，避免逐项 N+1）
CREATE INDEX IF NOT EXISTS ix_supplier_evidence_supplier_created
  ON public.supplier_evidence (supplier_id, created_at DESC);

COMMENT ON COLUMN public.supplier_assessments.item_review_json IS
  '逐项审核备注：{"<itemKey>":{"status","note","by","at"}}。与整体意见 review_notes 分工，不互相覆盖。';

NOTIFY pgrst, 'reload schema';
