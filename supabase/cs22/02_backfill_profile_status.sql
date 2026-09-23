-- CS-22 / 02 —— 修正 profile_status 回填（纯数据校正，无 DELETE / 无 DROP / 无覆盖非空值）
--
-- 缺陷（2026-09-24 只读核验发现）：
--   01_migration.sql 里 `ADD COLUMN profile_status text DEFAULT 'draft'` 会把**已存在的 20 行**
--   全部填成 'draft'；随后的
--     `UPDATE suppliers SET profile_status='public' WHERE profile_status IS NULL`
--   因为没有任何一行是 NULL ⇒ 实际更新 0 行。
--   结果：9 家已发布（is_published=true）的供应商 profile_status 仍是 'draft'，
--   CS-A 的公开闸门会误判为「未公开」⇒ 线上档案页会被 noindex，等于 9 个已收录页面掉索引。
--
-- 修法：只把「已发布且仍为 draft」的行校正为 'public'。
--   未发布的行保持 'draft' 不动（不臆断它们是 private 还是 unlisted）。
-- 幂等：重复执行第二次影响行数为 0。

UPDATE public.suppliers
   SET profile_status = 'public'
 WHERE is_published = true
   AND (profile_status IS NULL OR profile_status = 'draft');

-- 让 PostgREST 立刻看到新数据（不改结构，仅为刷新 schema cache）
NOTIFY pgrst, 'reload schema';
