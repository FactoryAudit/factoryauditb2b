-- 030 —— 修正 profile_status 与 is_published 的长期不一致（纯数据校正，无 DELETE / 无 DROP / 无加列）
--
-- 缺陷（2026-10-02 只读核验发现）：
--   公开可见性由 lib/trustProfile.ts:isProfilePublic 的**三元与门**裁决：
--       is_published ∧ public_profile_enabled ∧ profile_status === 'public'
--
--   但**全仓没有任何代码写 profile_status**：
--     · app/api/admin/suppliers/route.ts 的发布分支只写 is_published = true；
--     · lib/adminData.ts:updateAdminSupplier 的白名单里**没有这一列**，
--       即使路由想写也到不了库。
--   结果：管理员在后台点「发布」后，profile_status 停在列默认值 'draft'
--     ⇒ 与门第三项恒 false ⇒ 审核通过、已发布的档案**永远不对外公开**。
--
--   线上实测（2026-10-02）：223 行中
--       draft   + pub=true  →  20 行   ← 本迁移要修的就是这 20 行
--       public  + pub=true  →  11 行   ← 全部来自 2026-09-24 的一次性 backfill（cs22/02），非代码写入
--       draft   + pub=false → 188 行   ← 未发布，保持不动
--       private + pub=false →   4 行   ← 未发布且人工置 private，保持不动
--
-- 代码侧已同步修复（本次一并提交）：
--   · app/api/admin/suppliers/route.ts：发布跃迁时写 profile_status='public'；
--     取消发布时置 'private'（人工设过 private/unlisted 的行保持原值不动）。
--   · lib/adminData.ts：白名单与 AdminSupplierDetail 补上 profile_status。
--   本迁移只负责把**历史遗留**的 20 行校正到与代码新行为一致，不改变任何可见性语义
--   （这 20 行 is_published 早已为 true，前端的 isProfilePublic 一直返回 false，
--    因此本次校正的净效果是：这 20 家从「后台以为已发布、实际不可见」变为真正可见）。
--
-- 幂等：重复执行第二次影响行数为 0。
-- 范围：只改 profile_status 一列；不碰 is_published / public_profile_enabled / 任何内容字段。

UPDATE public.suppliers
   SET profile_status = 'public'
 WHERE is_published = true
   AND (profile_status IS NULL OR profile_status = 'draft');

-- 让 PostgREST 立刻看到新数据（不改结构，仅为刷新 schema cache）
NOTIFY pgrst, 'reload schema';
