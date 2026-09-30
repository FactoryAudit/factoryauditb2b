-- 029_public_source_clearance.sql
--
-- 背景：发布闸门（lib/supplierCompleteness.ts）要求「草稿 → 已发布」必须
--   profile_authorized === true。而该字段的唯一写入通道，是供应商本人在
--   入驻表单里勾选授权（app/api/supplier-register/route.ts:177）。
--
-- 问题：平台从公开渠道（如广交会参展商名录）自采的供应商档案，供应商本人
--   从未申请、也从未授权 ⇒ profile_authorized 恒为 null ⇒ 按现行规则
--   **永远无法发布**。2026-10-01 实测：191 家草稿中 181 家卡在这一条。
--
-- 🔴 为什么不直接让管理员代写 profile_authorized：
--   该字段的语义是「供应商授权」，库里另有 authorized_by / authorized_at
--   两个留痕列。由管理员代点，等于在库里写下一句「供应商授权过」的
--   **虚假事实**。将来若供应商主张未授权，这条记录不是抗辩依据，
--   而是加重情节（明知而为）。因此必须另开一条**语义独立**的通道。
--
-- 本迁移新增的三列，记录的是另一件真实发生过的事：
--   平台管理员在何时、以何身份，确认该档案来源为公开信息、不含个人数据。

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS public_source_cleared    boolean NOT NULL DEFAULT false;
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS public_source_cleared_at timestamptz;
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS public_source_cleared_by text;

COMMENT ON COLUMN public.suppliers.public_source_cleared IS
  '管理员确认：该档案来源为公开信息、不含个人数据，允许发布。与「供应商本人授权」的 profile_authorized 是两条独立通道，二者任一为 true 即可过发布闸门。';
COMMENT ON COLUMN public.suppliers.public_source_cleared_at IS
  '放行时间戳（服务端写入，不接受客户端传值）。';
COMMENT ON COLUMN public.suppliers.public_source_cleared_by IS
  '放行操作人邮箱（服务端写入，不接受客户端传值）。';

-- 注意：ADD COLUMN ... NOT NULL DEFAULT false 会把历史行全部回填为 false，
-- 这正是期望语义（历史行从未被放行过），因此**不需要**后续 UPDATE 回填。

NOTIFY pgrst, 'reload schema';
