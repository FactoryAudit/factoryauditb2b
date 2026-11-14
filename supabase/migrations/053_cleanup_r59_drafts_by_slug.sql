-- 053 —— 按 slug 删除 052 未删掉的两条验收草稿
--
-- 052 用 id 删，但用的是**接口返回的 supplierId**，而那是 route.ts 里
-- `crypto.randomUUID()` 临时生成的假 id（不指向任何行）⇒ delete 匹配 0 行，静默无效。
-- 真实主键在 suppliers.slug 上更好认，这里按 slug 删，并保留 is_published=false 安全闸。
--
-- 同轮修正：接口返回的 supplierId 已改为草稿真实主键（route.ts），
-- 否则注册成功页的「去完善档案」会带一个不存在的 supplier 参数，
-- 在 lib/supplierAccess 里撞 ownership_mismatch 403。

begin;

delete from suppliers
where slug in (
  'zz-r59-next-step-verification-test',
  'zz-r59-long-description-test'
)
and is_published = false;

commit;
