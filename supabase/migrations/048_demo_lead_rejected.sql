-- 048 —— 演示线索结案（不删行，只改状态，保留审计痕迹）
--
-- LEAD-62ZUPM 是 2026-11-14 端到端注册流程验证提交的线索，
-- 对应档案 example-precision-hardware-co-ltd 已于同日在 047 中下架。
-- 该线索不属于真实商机，若不结案会一直占据 new 队列。

begin;

update leads set
  status         = 'rejected',
  internal_notes = 'DEMO — end-to-end supplier registration test submitted 2026-11-14. Linked profile example-precision-hardware-co-ltd was retired the same day per client request. Not a real business opportunity.',
  updated_at     = now()
where reference_id = 'LEAD-62ZUPM';

commit;
