-- =============================================================================
-- Migration 039 —— leads 增加 auditor_application（审核员申请落库）
--
-- 背景（真实缺口，2026-11-10 复核）：
--   /careers 是站上唯一面向「审核员 / 顾问 / 项目人员」的入口，但它
--   **只发邮件、一行不落库**（app/api/careers/route.ts 第一版设计如此）。
--   后果：申请人提交后，后台没有任何地方能看到这个人 ——
--     线索页查不到、成员页查不到（他人根本没建账号）、审核单也还没派给他。
--   实际表现就是「他说注册了，我后台什么都看不到」。
--
-- 设计（不新造第二套库）：
--   · 复用 public.leads 作为**唯一线索库**，新增第四类 kind=auditor_application。
--     leads 已有 reference_id / country / message / payload（jsonb 兜全量字段）
--     与后台 /admin/leads 运营台，零新增表、零新增页面。
--   · 只放宽 CHECK，不动列、不动 RLS、不动索引。
--
-- 语义红线：
--   · auditor_application 只代表「收到一份申请」，**不等于**通过审核、
--     不等于录用、更不等于平台账号。与 supplier_verification 同构。
--   · 不因为「申请了」就给 profiles 建行、给角色 —— 派单走
--     audits.auditor_name / auditor_email（migration 038），与账号解耦。
-- =============================================================================

BEGIN;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_kind_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_kind_check CHECK (
    kind = ANY (ARRAY[
      'buyer_lead'::text,
      'supplier_application'::text,
      'supplier_claim'::text,
      'supplier_verification'::text,
      'auditor_application'::text
    ])
  );

COMMIT;
