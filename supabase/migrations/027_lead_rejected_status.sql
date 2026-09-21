-- =====================================================================
-- STEP 13 CHANGE SET B —— leads 状态集扩展：新增 rejected
-- =====================================================================
--
-- 为什么必须改 schema（而不是沿用现有五档）：
--   现有 leads_status_check 只允许 new / contacted / quoted / won / lost，
--   **没有任何一档能表达"审核不通过"**。
--   spec B3 硬性要求：Reject 必须是 status='rejected'，**不是 DELETE**（保留审计轨迹）。
--   因此这是"现有 schema 不支持当前业务"的情形，放宽 CHECK 是唯一正解。
--
-- 为什么只加 rejected 一个值：
--   - spec B2 建议的 reviewing / approved 不是必需的：
--       "审核中"= new（尚未落定），"通过"= 对应草稿 Supplier 被 Publish（已有机制）。
--   - 每加一个状态值都会扩散到 LEAD_STATUSES / API 白名单 / 下拉 UI 三处，
--     最小改动原则下只加真正缺的那一档。
--
-- 安全性：
--   - 只 DROP + ADD 一个 CHECK 约束，**不动数据、不动列、不删行**。
--   - 放宽（增加允许值）不会拒绝任何既有行：现有 15 行 status 全为 new，全部仍合法。
-- =====================================================================

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'quoted'::text, 'won'::text, 'lost'::text, 'rejected'::text]));
