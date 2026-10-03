-- =====================================================================
-- leads 状态集扩展：新增 withdrawn（申请人主动撤回 / 用户申请下架）
-- =====================================================================
--
-- 为什么必须改 schema（而不是沿用现有六档）：
--   现有 leads_status_check 允许 new / contacted / quoted / won / lost / rejected。
--   其中 rejected 的语义是「**我方**审核不通过」——027 号迁移与后台概览的
--   rejected 计数口径（lib/adminBusiness.ts）都是这个意思。
--   它**无法表达「申请人自己要求撤回 / 下架」**。
--
--   把用户主动撤回记成 rejected，会让后台统计把「客户撤回」误计为「我方否决」。
--   合规台账上这两件事必须可区分，因此新增独立档位 withdrawn。
--   本档的业务含义：**申请已终止、档案不予展示，但数据保留不删除**
--   （撤回 ≠ 删除；如需删除另走数据删除流程）。
--
-- 为什么只加 withdrawn 一个值：
--   每加一个状态值都会扩散到 LEAD_STATUSES / API 白名单 / 下拉 UI 三处
--   （见 lib/adminData.ts 的 LEAD_STATUSES 注释），最小改动原则下只加真正缺的那一档。
--
-- 安全性：
--   - 只 DROP + ADD 一个 CHECK 约束，**不动数据、不动列、不删行**。
--   - 放宽（增加允许值）不会拒绝任何既有行：现有行的 status 仍全部合法。
-- =====================================================================

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'quoted'::text, 'won'::text, 'lost'::text, 'rejected'::text, 'withdrawn'::text]));

NOTIFY pgrst, 'reload schema';
