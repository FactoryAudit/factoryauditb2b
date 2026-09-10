-- =============================================================================
-- CS-03 / 02_migration.sql —— Supplier Ingestion 最小字段扩展
--
-- 执行位置：Supabase Dashboard → SQL Editor
-- 前置：01_precheck.sql 已跑完，且 9 个计划列全部 "OK 可新增"
-- 性质：只加结构，不写任何业务数据。0 条 INSERT / UPDATE / DELETE。
--
-- 铁律：
--   1. 全部 ADD COLUMN ... NULL，无 DEFAULT → Postgres 只改 catalog，
--      不重写表、不加锁、现有 4 行数据一字不动。
--   2. 现有 22 列一列不删、不改类型、不改语义。
--   3. 不加任何 UNIQUE 约束 —— 真实世界存在共享电话/集团域名/多工厂同址，
--      重复必须由应用层 Entity Resolution 判断。DB 层只保留 id / slug。
--   4. 不建 status 状态机（沿用 is_published boolean）。
--   5. 全部 IF NOT EXISTS，可重复执行。
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. 新增 9 列（全部 nullable，全部无 DEFAULT）
-- =============================================================================

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS display_name        text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address             text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website             text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone               text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source_url          text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source_type         text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source_name         text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS discovered_at       timestamptz;

COMMENT ON COLUMN suppliers.display_name IS
  '展示名。与 legal_name 不同时填写（如 "Hengda Plastics"）。NULL = 未填写，前端回落 legal_name。';

COMMENT ON COLUMN suppliers.address IS
  '工厂地址。去重维度之一（country_code + city + address）。NULL = 未知，不参与去重。';

COMMENT ON COLUMN suppliers.website IS
  '官网。去重第一优先级（应用层 normDomain 归一化后比对）。NULL = 未知，不参与去重。';

COMMENT ON COLUMN suppliers.phone IS
  '联系电话。去重维度之一（应用层 normPhone 取末 9 位比对）。注意：园区/代理可能共享电话，命中后由人工 merge。';

COMMENT ON COLUMN suppliers.registration_number IS
  '营业执照号 / 公司注册号。与 country_code 组合去重。NULL = 未知。';

COMMENT ON COLUMN suppliers.source_url IS
  '来源 URL。只说明"这条信息从哪来"，绝不等同于 Verified Evidence。';

COMMENT ON COLUMN suppliers.source_type IS
  '来源类型：T1 官方登记 / T2 公司自有渠道 / T3 B2B 平台 / T4 公开搜索 / manual 人工录入。应用层校验，不设 DB CHECK 便于扩展。';

COMMENT ON COLUMN suppliers.source_name IS
  '来源名称，如 "Alibaba" / "Manual admin entry" / 登记处名称。';

COMMENT ON COLUMN suppliers.discovered_at IS
  '发现时间（不同于 created_at 入库时间）。现有 4 家保持 NULL —— 不伪造发现时间。';


-- =============================================================================
-- 2. 索引（全部普通索引，全部非 UNIQUE，全部部分索引）
-- =============================================================================

CREATE INDEX IF NOT EXISTS suppliers_website
  ON suppliers(website)             WHERE website IS NOT NULL;

CREATE INDEX IF NOT EXISTS suppliers_regno
  ON suppliers(registration_number) WHERE registration_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS suppliers_phone
  ON suppliers(phone)               WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS suppliers_geo
  ON suppliers(country_code, city);

CREATE INDEX IF NOT EXISTS suppliers_source
  ON suppliers(source_type)         WHERE source_type IS NOT NULL;


-- =============================================================================
-- 3. 版本记账
-- =============================================================================

INSERT INTO schema_migrations (version, note)
VALUES ('007', 'CS-03: supplier ingestion fields (display_name/address/website/phone/registration_number/source_*/discovered_at) + 5 partial indexes, no UNIQUE added')
ON CONFLICT (version) DO NOTHING;


-- =============================================================================
-- 4. 刷新 PostgREST schema cache（必须，否则报 PGRST205 / 42703）
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;


-- =============================================================================
-- ✅ 预期输出：Success. No rows returned（或 BEGIN / COMMIT 相关提示）
--    然后执行 03_postcheck.sql 并把结果贴回给文哥。
-- =============================================================================
