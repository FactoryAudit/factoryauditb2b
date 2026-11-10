-- =============================================================================
-- Migration 038 —— 审核单支持「外部审核员联系方式」(Phase 1 派单闭环)
--
-- 背景（真实缺口）：
--   audits.auditor_id / audit_assignments.auditor_id 都是
--   `uuid REFERENCES profiles(id)`，而 profiles.role 只有 buyer/supplier/admin，
--   根本没有 auditor 角色，也没有审核员注册/登录入口。
--   ⇒ 现阶段任何派单都必须先给审核员建一个平台账号，这在业务上不成立，
--      结果就是「单进来了但派不出去」。
--
-- 设计（与 035 的外部供应商同构，破坏性最小）：
--   · 新增 auditor_name / auditor_email 两个可空文本列，承载「本次任务的
--     外部审核员」；auditor_id 保持原样（可为 NULL），将来审核员有了账号
--     再回填，不需要迁移数据。
--   · 不新增角色、不碰 profiles、不改任何现有 RLS / CHECK。
--   · audit_assignments 同样加两列 —— 历史行全部为 NULL，语义即「当时用
--     的是账号派单」，不回填、不编造。
--
-- 语义红线：
--   · auditor_email 是**派单联系方式**，不是平台账号，不构成任何身份核验。
--   · 缺失就是缺失：没填就是 NULL，绝不用空串顶替。
-- =============================================================================

BEGIN;

-- 1. 审核主记录：本次任务的外部审核员
ALTER TABLE public.audits
  ADD COLUMN IF NOT EXISTS auditor_name  text,
  ADD COLUMN IF NOT EXISTS auditor_email text;

COMMENT ON COLUMN public.audits.auditor_name IS
  'Phase1：本次审核的外部审核员姓名（无平台账号时使用）。与 auditor_id 互斥：有账号时优先 auditor_id。';
COMMENT ON COLUMN public.audits.auditor_email IS
  'Phase1：派单邮箱。仅用于发送任务书与接收报告，不等于平台账号，不构成身份核验。';

-- 2. 指派流水：把当时的联系方式留痕（历史行保持 NULL，不回填）
ALTER TABLE public.audit_assignments
  ADD COLUMN IF NOT EXISTS auditor_name  text,
  ADD COLUMN IF NOT EXISTS auditor_email text;

COMMENT ON COLUMN public.audit_assignments.auditor_name IS
  'Phase1：派单时记录的外部审核员姓名。auditor_id 为 NULL 时以此标识承接人。';
COMMENT ON COLUMN public.audit_assignments.auditor_email IS
  'Phase1：派单时记录的审核员邮箱，用于事后追溯「当时发给了谁」。';

-- 3. 便于后台按审核员检索（可空列，部分索引不占空间）
CREATE INDEX IF NOT EXISTS audits_auditor_email
  ON public.audits (lower(auditor_email))
  WHERE auditor_email IS NOT NULL;

COMMIT;
