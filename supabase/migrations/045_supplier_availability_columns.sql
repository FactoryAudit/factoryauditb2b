-- 045_supplier_availability_columns.sql
--
-- 背景（2026-11-14 档案页走查）：
--   入驻表单有 auditAvailability / inspectionAvailability 两个勾选项
--   （「是否接受现场审核」「是否接受验货」），前端会把未勾选转成 "no" 提交。
--   但 suppliers 表**没有对应列**，这两个答案只落在 leads.payload 里，
--   档案页与买家端完全不读 ⇒ 供应商明确拒绝审核后，页面仍在推销「申请核验」。
--
-- 本迁移只做两件事：
--   ① 加两列（三态：yes / no / NULL）；
--   ② 从 leads.payload 回填已有档案，只补 NULL，不覆盖任何人工修改。
--
-- 🔴 为什么 NULL 必须保留：
--   NULL = 没问过 / 老表单没这项，**不等于拒绝**。
--   若把 NULL 一律填成 'no'，将来页面会显示「该供应商不接受现场审核」——凭空捏造的事实。
--
-- 幂等：加列用 if not exists；回填带 "两列均为 NULL" 条件，重跑影响 0 行。

alter table suppliers add column if not exists audit_availability text;
alter table suppliers add column if not exists inspection_availability text;

comment on column suppliers.audit_availability is
  '供应商入驻时对「是否接受现场审核」的回答：yes / no / NULL（NULL=未询问，不等于拒绝）';
comment on column suppliers.inspection_availability is
  '供应商入驻时对「是否接受验货」的回答：yes / no / NULL（NULL=未询问，不等于拒绝）';

update suppliers s
set
  audit_availability = case
    when l.payload->>'auditAvailability' = 'yes' then 'yes'
    when l.payload->>'auditAvailability' = 'no' then 'no'
    else null
  end,
  inspection_availability = case
    when l.payload->>'inspectionAvailability' = 'yes' then 'yes'
    when l.payload->>'inspectionAvailability' = 'no' then 'no'
    else null
  end
from leads l
where l.linked_supplier_id = s.id
  and l.reference_id in (
    'LEAD-J3ZJP2',
    'LEAD-MDX8ZJ',
    'LEAD-HBRZRZ',
    'LEAD-DXC6PX',
    'LEAD-C7UNP6'
  )
  and s.audit_availability is null
  and s.inspection_availability is null;
