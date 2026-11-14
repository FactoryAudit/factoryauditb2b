-- 052 —— 清理「成功即引导」验收产生的两条测试草稿
--
-- 背景：2026-11-14 发布注册成功页改版（新增 company_description 字段 +
-- 三步下一步清单）。为确证「简介不会被静默截断」，向生产接口真实提交了两次：
--   · LEAD-7QZ562 / zz-r59-next-step-verification-test  167 字符，用于验证中文原样落库
--   · LEAD-JJX56N / zz-r59-long-description-test        1284 字符，用于验证 1200 上限
-- 两条都不是真实商机，且买家从未可见（is_published=false）。
--
-- 处理原则（与 048 一致）：线索不删行，只结案并写内部备注；草稿行删除。
-- 删除条件带 is_published = false 作为安全闸——万一被误发布则本条不会删掉它。

begin;

update leads set
  status         = 'rejected',
  internal_notes = 'TEST — supplier registration end-to-end verification for the 2026-11-14 next-step guidance release (company_description field + success page checklist). Not a real application.',
  updated_at     = now()
where reference_id in ('LEAD-7QZ562', 'LEAD-JJX56N');

delete from suppliers
where id in (
  'e3be6c82-d66c-452d-9334-5e0ede081d41',
  '1a60163c-7fb3-4dcc-a407-bb0f4d4f9196'
)
and is_published = false;

commit;
