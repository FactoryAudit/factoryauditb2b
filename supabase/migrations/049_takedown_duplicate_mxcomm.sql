-- 049: 下线重复档案 nanjing-mxcomm
--
-- 背景（2026-11-14 全站档案审计）：
--   nanjing-mxcomm（南京麦克森OE科技有限公司，09-10 建）
--   与 nanjing-maxon-o-e-tech-co-ltd（NANJING MAXON O.E. TECH. CO., LTD，已核验 Level 1）
--   指向同一家企业：官网同为 mxcomm.cn、城市同为南京、产品线重叠。
--   两条公开档案并存 ⇒ 买家可能搜到那条「无邮箱 / 无简介 / 未核验」的白板页。
--
-- 保留哪条：maxon（英文法定名 + 完整注册地址 + 成立年份 2012 + 本周已做工商核验）。
-- 被下线的那条没有独有数据可合并：address 空、established 空、certifications 空，
-- main_products 与保留条重叠（无线 AP / 网桥 / 模块）。
--
-- 处理方式：只关发布开关，不删行（保留历史与可能的线索关联）。
-- 幂等：WHERE 里带 is_published = true。

update suppliers
set is_published           = false,
    profile_status         = 'private',
    public_profile_enabled = false
where slug = 'nanjing-mxcomm'
  and is_published = true;

-- 回滚（如需恢复）：
-- update suppliers
-- set is_published = true, profile_status = 'public', public_profile_enabled = true
-- where slug = 'nanjing-mxcomm';
