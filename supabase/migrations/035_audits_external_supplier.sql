-- =============================================================================
-- Migration 035 —— 审核请求支持「客户指定的外部供应商」(R85)
--
-- 背景（真实缺陷）：
--   `/factory-audit/request` 的「供应商」是一个**只能选平台内已发布供应商**的
--   下拉框（`audits.supplier_id` NOT NULL REFERENCES suppliers(id)）。于是：
--     · 客户想验的工厂若不在本平台 ⇒ **根本无法提交**；
--     · 客户被迫随便挑一家平台内供应商 ⇒ 审核对象与仓库记录**对不上账**。
--   而该页的定位是「客户申请验厂」的入口 —— 受限在平台目录内，等于把
--   绝大多数真实需求直接挡在门外。
--
-- 设计：引入「供应商来源」二选一
--   supplier_source = 'platform'  → supplier_id 必填（保持既有行为，零回归）
--   supplier_source = 'external'  → supplier_id 为 NULL，
--                                   由 external_supplier_* 承载客户提供的
--                                   工厂名称 / 联系人 / 邮箱 / 电话 / 地址。
--
-- ⚠️ 这是一条**破坏性最小的**改造：
--   · 唯一的结构改动是 `supplier_id` 去掉 NOT NULL（**不删列、不删 FK**）；
--   · 其余全部是 ADD COLUMN IF NOT EXISTS（可空、无 DEFAULT ⇒ 不回填、不锁表）；
--   · 历史行由 DEFAULT 'platform' 兜底为「平台内」——它们本来也确实指向平台内供应商，
--     **不是编造，是既成事实**。
--
-- 🔴 为什么用 DEFAULT 'platform' 而不是留 NULL：
--   历史行的 supplier_id 全部非空，语义上 100% 属于 'platform'。留 NULL 会逼着
--   每一处读取都写 `?? 'platform'` 兜底（R76 的教训：兜底点越多越容易漏）。
--   这里一次写成 'platform'，读取层可以信任它。
--   （ADD COLUMN ... DEFAULT 会回填历史行，本次是**期望行为**。）
--
-- 语义红线：
--   · 外部供应商信息是**客户自述**，不是平台核验结果。它只回答「客户要验谁」，
--     绝不构成对任何一方的背书。后台与邮件呈现时必须保持这一区分。
--   · 缺失就是缺失：客户没填的字段一律 NULL，绝不用空串或 "N/A" 顶替。
-- =============================================================================

BEGIN;

-- 1. supplier_id 放开 NOT NULL（外部供应商没有平台档案）
ALTER TABLE public.audits ALTER COLUMN supplier_id DROP NOT NULL;

-- 2. 来源枚举
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS supplier_source text NOT NULL DEFAULT 'platform';

-- 3. 外部供应商字段（全部可空；仅 supplier_source='external' 时有值）
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS external_supplier_name    text;
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS external_supplier_contact text;
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS external_supplier_email   text;
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS external_supplier_phone   text;
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS external_supplier_address text;

COMMENT ON COLUMN public.audits.supplier_source IS
  'R85：审核对象来源。platform=平台内已发布供应商（supplier_id 必填）；external=客户指定的外部供应商（supplier_id 为 NULL，信息见 external_supplier_*）。';
COMMENT ON COLUMN public.audits.supplier_id IS
  'R85：平台内供应商 FK。仅在 supplier_source=''platform'' 时非空；外部供应商为 NULL（不再强制 NOT NULL）。';
COMMENT ON COLUMN public.audits.external_supplier_name IS
  'R85：外部供应商名称（客户自述，未核验）。仅 supplier_source=''external'' 时有值。';
COMMENT ON COLUMN public.audits.external_supplier_contact IS
  'R85：外部供应商联系人姓名（客户提供）。仅 external 时有值。';
COMMENT ON COLUMN public.audits.external_supplier_email IS
  'R85：外部供应商工作邮箱（客户提供）。与 external_supplier_phone 至少一项非空 —— 否则无法触达工厂。';
COMMENT ON COLUMN public.audits.external_supplier_phone IS
  'R85：外部供应商电话/WhatsApp（客户提供）。与 external_supplier_email 至少一项非空。';
COMMENT ON COLUMN public.audits.external_supplier_address IS
  'R85：外部供应商工厂地址（客户提供的可选项）。缺失即为 NULL，不用空串顶替。';

-- 4. 取值约束（CHECK 兜底，应用层也校验；两层都要有）
--    先 DROP 再 ADD，允许迁移可重跑。
ALTER TABLE public.audits DROP CONSTRAINT IF EXISTS audits_supplier_source_check;
ALTER TABLE public.audits ADD CONSTRAINT audits_supplier_source_check
  CHECK (supplier_source IN ('platform', 'external'));

-- 5. 二选一与门：来源与 FK 必须自洽，且 external 必须有名称 + 至少一项联系方式。
--    这条 CHECK 是数据库层的最后防线 —— 应用层 zod 已挡一次，但写入层不止一个调用方。
ALTER TABLE public.audits DROP CONSTRAINT IF EXISTS audits_supplier_ref_check;
ALTER TABLE public.audits ADD CONSTRAINT audits_supplier_ref_check
  CHECK (
    (supplier_source = 'platform' AND supplier_id IS NOT NULL)
    OR
    (supplier_source = 'external' AND supplier_id IS NULL
     AND external_supplier_name IS NOT NULL
     AND btrim(external_supplier_name) <> ''
     AND (external_supplier_email IS NOT NULL OR external_supplier_phone IS NOT NULL))
  );

-- 6. 后台按来源筛选用
CREATE INDEX IF NOT EXISTS audits_source ON public.audits(supplier_source);

-- 7. 版本登记
INSERT INTO public.schema_migrations (version, note)
VALUES (
  '035',
  'R85: audits.supplier_id -> nullable + supplier_source(platform|external) + external_supplier_{name,contact,email,phone,address}. Buyer can request an audit on a supplier outside the platform directory, providing the factory contact. CHECK enforces platform<->FK and external<->name+contact.'
)
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- ✅ 成功标志：`Success. No rows returned`
--    核验（只读）：
--      node scripts/db-apply-sql.mjs --read-only --sql "select id,audit_code,supplier_source,supplier_id from public.audits limit 5"
-- =============================================================================
