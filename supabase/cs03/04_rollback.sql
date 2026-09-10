-- =============================================================================
-- CS-03 / 04_rollback.sql —— 回滚 007 迁移
--
-- ⚠️ 这不是正常执行步骤。仅在以下情况才用：
--    - 02_migration 执行后 postcheck 发现异常
--    - CS-03 整体方案被推翻
--
-- 前置：CS-03 的 POST 代码必须已经下线（否则下次调用会因列不存在报 42703）
--
-- 数据安全：DROP COLUMN 只删这 9 个新增列。现有 4 行的这些列全是 NULL，
--           因此本次回滚不丢失任何既有业务数据。其余 22 列完全不受影响。
-- =============================================================================

BEGIN;

-- ---------- 1. 先删索引（顺序：索引 → 列） ----------
DROP INDEX IF EXISTS suppliers_website;
DROP INDEX IF EXISTS suppliers_regno;
DROP INDEX IF EXISTS suppliers_phone;
DROP INDEX IF EXISTS suppliers_geo;
DROP INDEX IF EXISTS suppliers_source;

-- ---------- 2. 删列 ----------
ALTER TABLE suppliers DROP COLUMN IF EXISTS discovered_at;
ALTER TABLE suppliers DROP COLUMN IF EXISTS source_name;
ALTER TABLE suppliers DROP COLUMN IF EXISTS source_type;
ALTER TABLE suppliers DROP COLUMN IF EXISTS source_url;
ALTER TABLE suppliers DROP COLUMN IF EXISTS registration_number;
ALTER TABLE suppliers DROP COLUMN IF EXISTS phone;
ALTER TABLE suppliers DROP COLUMN IF EXISTS website;
ALTER TABLE suppliers DROP COLUMN IF EXISTS address;
ALTER TABLE suppliers DROP COLUMN IF EXISTS display_name;

-- ---------- 3. 版本记账回滚 ----------
DELETE FROM schema_migrations WHERE version = '007';

-- ---------- 4. 刷新 PostgREST schema cache ----------
NOTIFY pgrst, 'reload schema';

COMMIT;


-- =============================================================================
-- 回滚后自检（应返回 0 行）
-- =============================================================================
SELECT column_name, 'STILL EXISTS ❌' AS status
FROM information_schema.columns
WHERE table_schema='public' AND table_name='suppliers'
  AND column_name IN (
    'display_name','address','website','phone','registration_number',
    'source_url','source_type','source_name','discovered_at'
  );
