-- 055_publish_registered_supplier_drafts.sql
--
-- 目的：把 19 条「注册后从未被处理」的供应商草稿收口。
--   背景：这些行的 leads.status 全是 new，suppliers.is_published 全是 false，
--         最早一条停在 2026-10-16（29 天）。其中 6 家在四项发布闸门上已全部通过，
--         仅因为没人点发布而一直躺在草稿区。
--
-- 🔴 执行顺序硬性约束（漏一步就自曝）：
--   1) 执行本迁移
--   2) 重新构建并发版（/suppliers/[slug] 是构建期静态页，不重建则新档案 404）
--   3) 逐个 curl 验证 12 个 URL 返回 200 且内容正确
--   4) 才允许发《供应商档案上线通知》邮件
--
-- 🔴 本迁移不含 UPDATE profile_authorized —— 授权是供应商自己在注册表单勾的，
--   平台不得代写。下面所有发布动作都以既有的 profile_authorized = true 为前提，
--   并在 WHERE 里再次断言，防止误伤未授权行。
--
-- 🔴 回滚：见文件末尾。

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. 数据规范化（仅影响尚未发布的行，外部不可见）
-- ─────────────────────────────────────────────────────────────

-- 1.1 supplier-2（雄县宸帆）：city 字段混进了省份，导致城市显示成 "Baoding, Hebei"
UPDATE suppliers
SET city = 'Baoding',
    province = 'Hebei',
    updated_at = now()
WHERE slug = 'supplier-2'
  AND is_published = false
  AND city = 'Baoding, Hebei';

-- 1.2 supplier-1/supplier-2 的 slug 是早期注册的兜底值，URL 无意义且形似占位符
--     档案未发布，此时改名不会产生任何外链失效。
UPDATE suppliers
SET slug = 'guangzhou-oni-display',
    updated_at = now()
WHERE slug = 'supplier-1'
  AND is_published = false;

UPDATE suppliers
SET slug = 'xiongan-chenfan-electric',
    updated_at = now()
WHERE slug = 'supplier-2'
  AND is_published = false;

-- 1.3 OrganicTex：city 为 "unknown"，其注册自我描述明确写 "Shanghai-based"
UPDATE suppliers
SET city = 'Shanghai',
    province = 'Shanghai',
    updated_at = now()
WHERE slug = 'organictex-group'
  AND is_published = false
  AND (city IS NULL OR lower(city) = 'unknown');

-- 1.3b JGN（已发布）：country_code 存的是注册人填的一整句话
--      "not-provided-trading-supplier-based-in-china"，导致档案首屏直接渲染成
--      "Dalian, not-provided-trading-supplier-based-in-china"，概览格写
--      "Country: not-provided-trading-supplier-based-in-china"。
--      该行的 address 已是 "Dalian, Liaoning, China 116011"，国家可确定为 china。
--      ⚠️ 这是修数据，不是改国家判定：不改地址、不改城市、不改任何对外文案。
UPDATE suppliers
SET country_code = 'china',
    updated_at = now()
WHERE slug = 'jgn'
  AND country_code = 'not-provided-trading-supplier-based-in-china';

-- 1.4 补齐 industry_code（发布闸门的阻断项之一）。
--     判定依据写在每行注释里，全部来自供应商自己提交的官网或自述，不做主观归类。
UPDATE suppliers SET industry_code = 'cosmetics', updated_at = now()
WHERE slug = 'guangzhou-guocui-biological-technology-co-ltd'
  AND is_published = false AND industry_code IS NULL;
-- ↑ 官网 guocuiskincare.com：护肤品 OEM/ODM，500 件起订

UPDATE suppliers SET industry_code = 'machinery', updated_at = now()
WHERE slug = 'ntgd-knife-valve-co-ltd'
  AND is_published = false AND industry_code IS NULL;
-- ↑ 官网 knifevalve.net：刀闸阀（手动/气动/电动/液动）

UPDATE suppliers SET industry_code = 'machinery', updated_at = now()
WHERE slug = 'zhengna-technology'
  AND is_published = false AND industry_code IS NULL;
-- ↑ 官网 zenatc.com：精密冲压、CNC、钣金、弹簧、注塑、紧固件

UPDATE suppliers SET industry_code = 'building-materials', updated_at = now()
WHERE slug = 'shenzhen-aodeke-optoelectronics-co-ltd'
  AND is_published = false AND industry_code IS NULL;
-- ↑ 官网 floodbarrierstore.com：可重复使用铝制防洪挡水板/车库挡水门

UPDATE suppliers SET industry_code = 'home-goods', updated_at = now()
WHERE slug = 'yongkang-zhuolin-industrial-and-trading-co-ltd'
  AND is_published = false AND industry_code IS NULL;
-- ↑ 官网 bgdrinkware.com：定制水瓶、保温杯、随行杯

UPDATE suppliers SET industry_code = 'furniture', updated_at = now()
WHERE slug = 'guangzhou-oni-display'
  AND is_published = false AND industry_code IS NULL;
-- ↑ 官网 onidisplay.com：定制零售陈列道具、店装与店面家具

UPDATE suppliers SET industry_code = 'textiles', updated_at = now()
WHERE slug = 'organictex-group'
  AND is_published = false AND industry_code IS NULL;
-- ↑ 自述：天然彩棉原料、纱线、面料、婴童用品

-- ── 非中国供应商（2026-11-14 起平台不再限于中国）──
UPDATE suppliers SET industry_code = 'textiles', updated_at = now()
WHERE slug = 'saras-udyog'
  AND is_published = false AND industry_code IS NULL;
-- ↑ 官网 macramethread.com：Macramé 绳、编织带、丝绒缎带（印度斋浦尔，1991 年起）

UPDATE suppliers SET industry_code = 'machinery', updated_at = now()
WHERE slug = 'ds-consultancy-services'
  AND is_published = false AND industry_code IS NULL;
-- ↑ 官网 owcmachine.in：有机废弃物处理机（OWC / 堆肥机）10–1000 kg/日（印度 Ghaziabad）

-- ─────────────────────────────────────────────────────────────
-- 2. 发布（12 家）
--    每行都是：未发布 + 已授权 + 城市/行业/主营三项齐备，与
--    lib/supplierCompleteness.ts 的 blockers 判定一一对应。
-- ─────────────────────────────────────────────────────────────

-- 注：suppliers 表没有 published_at 列，只有 unpublished_at（下架时间）。
-- 上线时间只能由 updated_at 近似，不要凭空 ADD COLUMN —— 那会让所有历史行的语义变味。
UPDATE suppliers
SET is_published = true,
    unpublished_at = NULL,
    updated_at = now()
WHERE is_published = false
  AND profile_authorized = true
  AND slug IN (
    -- A 组：闸门本已全过
    'guangdong-zhijin-new-materials-co-ltd',
    'shaoxing-xiaoyouji-textiles',
    'shandong-qilu-industry-trade',
    'xiongan-chenfan-electric',
    'wahfei-technology',
    -- B 组：本迁移第 1.4 步补齐 industry_code 后达标
    'guangzhou-guocui-biological-technology-co-ltd',
    'ntgd-knife-valve-co-ltd',
    'zhengna-technology',
    'shenzhen-aodeke-optoelectronics-co-ltd',
    'yongkang-zhuolin-industrial-and-trading-co-ltd',
    'guangzhou-oni-display',
    'organictex-group',
    -- 非中国供应商：平台不限中国（印尼 Batik Soehadi、巴基斯坦 Brussels Sports 已在架）
    'saras-udyog',
    'ds-consultancy-services'
  )
  AND city IS NOT NULL AND lower(city) NOT IN ('unknown', 'n/a', 'na', 'tbd', '-')
  AND industry_code IS NOT NULL
  AND COALESCE(cardinality(main_products), 0) > 0;

-- ─────────────────────────────────────────────────────────────
-- 3. 剔除项（不发布，线索结案，保留行以备追溯）
--    这些不是供应商：内部测试记录 / 媒体运营商 / 采购代理 / 主体不一致
-- ─────────────────────────────────────────────────────────────

UPDATE leads SET status = 'rejected', updated_at = now()
WHERE kind = 'supplier_application'
  AND status = 'new'
  AND email IN (
    'step12-register@example.com',   -- 内部测试记录
    'info@logicmedia.ru'             -- 俄罗斯室内广告运营商，主营字段只有一个 "Add"
  );

-- 主体不一致：档案写 Guangzhou Ruiqi Supply Chain，官网主体为 TOP KNIVES LLC，
-- 在没有本人确认前不得替任何一方发布。线索保持 new，留待人工核实。
UPDATE leads SET status = 'rejected', updated_at = now()
WHERE kind = 'supplier_application'
  AND status = 'new'
  AND email = 'info@otfknifewholesale.com';

-- 采购代理（XILINK，非制造商）与 lost 状态的印度厂商 Vendekin（Pune）：
-- 本次不发布，留待第二轮核实。仅在此登记，不做任何写入。
-- 注：saras-udyog / ds-consultancy-services 两家印度厂商已按「平台不限中国」纳入
-- 上面的发布名单（第 2 节），不在本排除项内。

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- 回滚（如需）：
--   UPDATE suppliers SET is_published = false, updated_at = now()
--   WHERE slug IN (
--     'guangdong-zhijin-new-materials-co-ltd','shaoxing-xiaoyouji-textiles',
--     'shandong-qilu-industry-trade','xiongan-chenfan-electric','wahfei-technology',
--     'guangzhou-guocui-biological-technology-co-ltd','ntgd-knife-valve-co-ltd',
--     'zhengna-technology','shenzhen-aodeke-optoelectronics-co-ltd',
--     'yongkang-zhuolin-industrial-and-trading-co-ltd','guangzhou-oni-display',
--     'organictex-group','saras-udyog','ds-consultancy-services'
--   );
--   -- slug 改名的回滚：
--   UPDATE suppliers SET slug = 'supplier-1' WHERE slug = 'guangzhou-oni-display';
--   UPDATE suppliers SET slug = 'supplier-2' WHERE slug = 'xiongan-chenfan-electric';
--   -- country_code 修复的回滚（一般不需要：旧值本身就是脏数据）：
--   UPDATE suppliers SET country_code = 'not-provided-trading-supplier-based-in-china' WHERE slug = 'jgn';
--   -- 线索状态回滚：
--   UPDATE leads SET status = 'new'
--   WHERE email IN ('step12-register@example.com','info@logicmedia.ru','info@otfknifewholesale.com');
-- ─────────────────────────────────────────────────────────────
