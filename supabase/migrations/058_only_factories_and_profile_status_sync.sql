-- 058 —— 只收工厂：下架非制造商，并修正 profile_status 与 is_published 的长期不一致
--
-- 背景（2026-11-15，用户口径「不要非工厂的」）：
--
-- 1) 状态不一致（技术债，与 030 迁移同型）
--    055 批量发布 14 家注册草稿时只写了 is_published = true，
--    profile_status 仍停在列默认值 'draft'。而 lib/trustProfile.ts 的
--    isProfilePublic() 是**三元与门**：
--        is_published ∧ public_profile_enabled ∧ profile_status = 'public'
--    于是这 14 家虽然详情页 200、目录可见、进了 sitemap，但：
--        · app/[locale]/suppliers/[slug]/page.tsx 不加载工厂照片
--        · 分享模块不渲染、ProfileViewTracker 不启动
--    这正是 030 迁移记录过的坑（「发布必须同步写 profile_status」）。
--
-- 2) 非制造商清理（业务口径）
--    经逐家核实，这 14 家里有 2 家不是工厂：
--      · shandong-qilu-industry-trade —— company_type 自述「贸易商」，
--        无官网、无简介、无产能、无厂房面积、无图片、无审核记录。
--      · organictex-group —— 官网明写「20+ partner factories」「Partner cotton plantations」，
--        自我定位是从原料到成品的供应链管理方，无自有生产设施。
--    其余 12 家均自述 Manufacturer/Manufacturers，且有可核对的工厂信息
--    （DS Consultancy Services 填报厂房面积 100000、产能 100、10 名员工，
--      实际做堆肥设备 owcmachine.in，名称带 Consultancy 但主体是设备制造）。
--    工贸一体（guangzhou-oni-display「制造商、贸易商」、
--      yongkang-zhuolin-industrial-and-trading 自述 Manufacturer）按工厂保留。
--
-- 3) 线索层拒绝
--      · LEAD-G8GQZK XILINK Global Trade —— 申请人明确写「not a manufacturer」
--      · LEAD-A7QYVT 杭州阿登科技 —— 官网为 ChatGPT 临时站（*.chatgpt.site），
--        companyType 只写 "Supplier of ..."，无自有工厂证据
--      · 4 条 CS02D / Probe 内部测试残留
--    以上均**不发信**，仅改状态留痕。
--
-- 回滚语句见文件末尾。

BEGIN;

-- 1) 下架非工厂（保留数据行，只撤下公开）
UPDATE suppliers
SET is_published = false,
    profile_status = 'private',
    public_profile_enabled = false,
    unpublished_at = now(),
    unpublished_by = 'manual:non-manufacturer(only-factories)',
    updated_at = now()
WHERE slug IN ('shandong-qilu-industry-trade', 'organictex-group');

-- 2) 其余已发布档案同步 profile_status（030 同一口径）
UPDATE suppliers
SET profile_status = 'public',
    updated_at = now()
WHERE is_published = true
  AND (profile_status IS NULL OR profile_status = 'draft');

-- 3) 拒绝非工厂线索（不发信）
UPDATE leads
SET status = 'rejected',
    internal_notes = '2026-11-15 按「只收工厂」拒绝：申请人自述 "Sourcing and export agent; not a manufacturer"，无自有工厂。未发信。',
    updated_at = now()
WHERE reference_id = 'LEAD-G8GQZK';

UPDATE leads
SET status = 'rejected',
    internal_notes = '2026-11-15 按「只收工厂」拒绝：官网为 ChatGPT 临时站（*.chatgpt.site），companyType 只写 "Supplier of..."，无自有工厂证据、无厂房/产能信息。未发信。',
    updated_at = now()
WHERE reference_id = 'LEAD-A7QYVT';

-- 4) 结案内部测试残留（CS02D Claim Co. + 3 条 Probe Co）
UPDATE leads
SET status = 'rejected',
    internal_notes = '2026-11-15 内部测试残留（CS02D / Probe），非真实申请。',
    updated_at = now()
WHERE reference_id IN ('LEAD-HNFY5C', 'LEAD-5PBRKR', 'LEAD-WZ5D5K', 'LEAD-T7DY9Y');

COMMIT;

-- ===========================================================================
-- 回滚（按需执行）
-- ---------------------------------------------------------------------------
-- 恢复 2 家：
-- UPDATE suppliers SET is_published = true, profile_status = 'public',
--   public_profile_enabled = true, unpublished_at = NULL, unpublished_by = NULL
-- WHERE slug IN ('shandong-qilu-industry-trade', 'organictex-group');
--
-- 12 家回到 055 之后的状态（不推荐，会重新触发照片/分享不渲染）：
-- UPDATE suppliers SET profile_status = 'draft'
-- WHERE slug IN ('ds-consultancy-services','guangdong-zhijin-new-materials-co-ltd',
--   'guangzhou-guocui-biological-technology-co-ltd','guangzhou-oni-display',
--   'ntgd-knife-valve-co-ltd','saras-udyog','shaoxing-xiaoyouji-textiles',
--   'shenzhen-aodeke-optoelectronics-co-ltd','wahfei-technology','xiongan-chenfan-electric',
--   'yongkang-zhuolin-industrial-and-trading-co-ltd','zhengna-technology');
--
-- 线索恢复：
-- UPDATE leads SET status = 'new', internal_notes = NULL
-- WHERE reference_id IN ('LEAD-G8GQZK','LEAD-A7QYVT','LEAD-HNFY5C',
--   'LEAD-5PBRKR','LEAD-WZ5D5K','LEAD-T7DY9Y');
-- ===========================================================================
