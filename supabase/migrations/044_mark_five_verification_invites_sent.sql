-- 044_mark_five_verification_invites_sent.sql
--
-- 背景：2026-11-14 10:09-10:12（UTC+8）向第一批 5 家已授权供应商发送「核验邀请」（模板 A，
--       中文正文 + 英文附录，纯文本，BCC 管理员留痕，间隔 35s）。
-- 依据：Resend HTTP API 返回 5 个 message id，且 GET /emails/{id} 全部 last_event = delivered。
--
-- 只改状态与备注，不改任何档案字段、不改 verification_level。
-- 幂等：每条带 status='new' 条件，重跑影响 0 行。

update leads set
  status = 'contacted',
  follow_up_note = '2026-11-14 10:09 发出核验邀请（模板 A 中英双语，Resend delivered，id=01a1d7d1-31f6-78e7-9413-3bab61012260）',
  updated_at = now()
where reference_id = 'LEAD-J3ZJP2' and status = 'new';

update leads set
  status = 'contacted',
  follow_up_note = '2026-11-14 10:10 发出核验邀请（模板 A 中英双语，Resend delivered，id=01a1d7d1-be5b-77bd-8606-06ce30476bac）',
  updated_at = now()
where reference_id = 'LEAD-MDX8ZJ' and status = 'new';

update leads set
  status = 'contacted',
  follow_up_note = '2026-11-14 10:10 发出核验邀请（模板 A 中英双语，Resend delivered，id=01a1d7d2-4b37-7a63-95d3-2fcb357093e9）',
  updated_at = now()
where reference_id = 'LEAD-HBRZRZ' and status = 'new';

update leads set
  status = 'contacted',
  follow_up_note = '2026-11-14 10:11 发出核验邀请（模板 A 中英双语，Resend delivered，id=01a1d7d2-d767-7e2a-b6e6-551fef594738）',
  updated_at = now()
where reference_id = 'LEAD-DXC6PX' and status = 'new';

update leads set
  status = 'contacted',
  follow_up_note = '2026-11-14 10:11 发出核验邀请（模板 A 中英双语，Resend delivered，id=01a1d7d3-6364-7a2f-9f2f-8b1527f7db09）',
  updated_at = now()
where reference_id = 'LEAD-C7UNP6' and status = 'new';
