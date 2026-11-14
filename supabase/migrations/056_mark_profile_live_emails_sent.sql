-- 056_mark_profile_live_emails_sent.sql
--
-- 对应动作：2026-11-15 发送《供应商档案上线通知》14 封（模板 D）。
-- 依据：scripts/_send_supplier_profile_live_14.cjs 的实发结果（13 封一次成功 + Saras 补发 1 封）。
-- 每封的 Resend message id 原样记入 follow_up_note，便于日后在 Resend 后台按 id 追溯。
--
-- 🔴 只改状态与备注，不动 suppliers、不动邮箱、不动任何对外可见字段。
-- 🔴 不用 status='lost'/'rejected' 覆盖：这 14 条原本都是 new。
--
-- 回滚：
--   UPDATE leads SET status='new', follow_up_note=NULL, updated_at=now()
--   WHERE kind='supplier_application' AND reference_id IN (…下面 14 个…);

BEGIN;

UPDATE leads
SET status = 'contacted',
    follow_up_note = CASE reference_id
      WHEN 'LEAD-ZL8AH6' THEN '2026-11-15 profile-live email sent; Resend 01a1dae5-2dc1-7b7b-8492-699113b66312'
      WHEN 'LEAD-B4NKMP' THEN '2026-11-15 profile-live email sent; Resend 01a1dae5-bab5-7246-844c-41c06e805ac6'
      WHEN 'LEAD-87XLTG' THEN '2026-11-15 profile-live email sent; Resend 01a1dae6-473b-7329-99dc-3bdb45b73162'
      WHEN 'LEAD-7FQBT9' THEN '2026-11-15 profile-live email sent; Resend 01a1dae6-d420-7e5b-b944-0e4b14c645dc'
      WHEN 'LEAD-S7HG7S' THEN '2026-11-15 profile-live email sent; Resend 01a1dae7-6120-7441-a792-9ee3914db158'
      WHEN 'LEAD-EKRYFG' THEN '2026-11-15 profile-live email sent; Resend 01a1dae7-ed78-7414-a9f9-8c71533bd924'
      WHEN 'LEAD-TY6P3S' THEN '2026-11-15 profile-live email sent; Resend 01a1dae8-799f-7be8-8bd4-8d328d4755c1'
      WHEN 'LEAD-NSRH5S' THEN '2026-11-15 profile-live email sent; Resend 01a1dae9-0c53-749a-b970-5bd9b68e9595'
      WHEN 'LEAD-N4UEXZ' THEN '2026-11-15 profile-live email sent; Resend 01a1dae9-9ea9-7648-968b-03994f682031'
      WHEN 'LEAD-6DN6ZE' THEN '2026-11-15 profile-live email sent; Resend 01a1daea-2b10-77bf-a02c-fbed3d2fe813'
      WHEN 'LEAD-7KNECA' THEN '2026-11-15 profile-live email sent; Resend 01a1daea-b758-781e-841b-986964ee3b76'
      WHEN 'LEAD-V3KH75' THEN '2026-11-15 profile-live email sent; Resend 01a1daeb-43d9-7850-93ac-ff6aa3cb7f02'
      WHEN 'LEAD-F6ZAVX' THEN '2026-11-15 profile-live email sent; Resend 01a1daec-d6a3-7818-9f10-8c8acb4e93c0'
      WHEN 'LEAD-ZBSE62' THEN '2026-11-15 profile-live email sent; Resend 01a1daec-84f6-7c29-ace0-1cafc9e0c75e'
    END,
    updated_at = now()
WHERE kind = 'supplier_application'
  AND reference_id IN (
    'LEAD-ZL8AH6','LEAD-B4NKMP','LEAD-87XLTG','LEAD-7FQBT9','LEAD-S7HG7S',
    'LEAD-EKRYFG','LEAD-TY6P3S','LEAD-NSRH5S','LEAD-N4UEXZ','LEAD-6DN6ZE',
    'LEAD-7KNECA','LEAD-V3KH75','LEAD-F6ZAVX','LEAD-ZBSE62'
  );

COMMIT;
