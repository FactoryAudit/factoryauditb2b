-- 051: 清理被误当作「公司简介」的元数据
--
-- 背景：
--   2026-11-14 打通 company_description 的展示后，发现 40 条里 29 条不是公司简介，
--   而是导入环节写进去的**结构化备注**：
--     · 28 条「第134届广交会展商（公开名录）。企业类型：生产企业；企业性质：私营企业；
--       贸易形式：OEM；展商标签：多届参展…」—— 广交会名录字段的拼接结果
--     · 1 条「Main Products: ... / Production Capacity: ...」—— 产品与产能清单
--   这些内容当「Company overview」摆给买家看，既不成立（不是企业自我介绍），
--   也与已有的 fairRecord（展位记录）、mainProducts（产品）、产能锁区字段重复。
--
-- 处理：只清空这 29 条，保留 11 条真正的英文公司简介。
-- 备份：清空前的全量值已导出到
--   D:/腾讯ai临时文件/2026-09-14-22-18-10/_vhtml/desc.json
--   （含 slug + company_description 原文，可按需回填）
--
-- 幂等：LIKE 条件命中即清，重复执行无副作用。

begin;

-- 1) 广交会名录元数据（28 条）
update suppliers
set company_description = null
where company_description like '第134届广交会展商%';

-- 2) 产品/产能清单冒充简介（1 条：brussels-sports）
update suppliers
set company_description = null
where company_description like 'Main Products:%'
  and company_description like '%Production Capacity:%';

commit;

-- 回滚示例（单条）：
-- update suppliers set company_description = '<原文>' where slug = '8flower';
