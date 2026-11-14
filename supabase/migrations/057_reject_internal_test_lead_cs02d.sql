-- 057_reject_internal_test_lead_cs02d.sql
--
-- CS02D 是内部联调记录（邮箱域名 example.com、公司名 "CS02D Live Factory"），
-- 055 只按 step12-register@example.com 匹配，漏了这一条同类记录。
-- 与 055 的处理口径保持一致：内部测试记录 → rejected，保留行以备追溯。
--
-- 回滚：UPDATE leads SET status='new', updated_at=now() WHERE reference_id='LEAD-GS63JJ';

BEGIN;

UPDATE leads
SET status = 'rejected',
    follow_up_note = 'internal test record (example.com), closed 2026-11-15',
    updated_at = now()
WHERE kind = 'supplier_application'
  AND reference_id = 'LEAD-GS63JJ'
  AND email = 'cs02d-mtz4wziq-sup@example.com'
  AND status = 'new';

COMMIT;
