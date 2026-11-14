-- 054 —— 清理 053 之后补做的 ID 返回值验收草稿
--
-- 修完 route.ts 的 supplierId 后需要一次真实调用来确证「supplierId == draftId」，
-- 并验证该 id 能打开 /supplier-assessment（不再 403）。验证已通过：
--   返回 supplierId = draftId = 7f891d35-33bd-402b-b0fb-62f5607d6c51
--   /zh/supplier-assessment?supplier=<该id>&email=<注册邮箱> → 200，无登录墙
-- 本条把这条测试数据清掉，保持 suppliers 总数与线索队列干净。

begin;

update leads set
  status         = 'rejected',
  internal_notes = 'TEST — verification that the register API returns the real suppliers primary key as supplierId (2026-11-14 next-step guidance release). Not a real application.',
  updated_at     = now()
where reference_id = 'LEAD-4BSNF9';

delete from suppliers
where slug = 'zz-r59b-id-check-test'
and is_published = false;

commit;
