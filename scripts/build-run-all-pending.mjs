// 把「所有待执行的迁移」合并成一个可直接粘贴进 Supabase SQL Editor 的文件
//
// 为什么生成而不是手写：008_leads.sql 与 supabase/cs07/02_migration.sql 必须逐字节一致，
// 手改合并文件会立刻造成两者漂移。本脚本只做拼接，源文件永远是唯一事实源。
//
// 用法: node scripts/build-run-all-pending.mjs
// 产出: supabase/00_RUN_ALL_PENDING.sql
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PARTS = [
  {
    title: "PART 1 / 3 — 009 供应商档案扩展字段",
    file: "supabase/migrations/009_supplier_profile_extras.sql",
    why: "suppliers 新增 9 列：公司类型 / 英文名 / 产能 / 月产量 / 厂区面积 / 出口起始年 / 自述证书(含颁发+到期日) / 授权 / 联系可见性",
  },
  {
    title: "PART 2 / 3 — 008 leads 线索落库表（CS-07）",
    file: "supabase/migrations/008_leads.sql",
    why: "建 leads 表：让工厂注册与买家询盘真正进数据库，不再只靠邮件",
  },
];

const VERIFY = `
-- =============================================================================
-- PART 3 / 3 — 收尾：刷新 PostgREST 缓存 + 自检
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- 自检 A：009 的 9 个新列（应返回 9 行）
SELECT '009 suppliers.' || c.column_name AS item, true AS ok
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name = 'suppliers'
  AND c.column_name IN (
    'company_type','english_name','production_capacity','monthly_output',
    'factory_size','export_since','self_reported_certificates',
    'profile_authorized','contact_visibility'
  )
ORDER BY c.column_name;

-- 自检 B：leads 表存在且列数正确（应返回 1 行，col_count = 22）
SELECT '008 leads' AS item, COUNT(*) AS col_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads';

-- 自检 C：leads 三个 CHECK 与两条 RLS policy（各应返回预期条数）
SELECT 'leads CHECKs' AS item, COUNT(*) AS n
FROM pg_constraint
WHERE conrelid = 'public.leads'::regclass AND contype = 'c';

SELECT 'leads policies' AS item, COUNT(*) AS n
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'leads';
`;

const missing = PARTS.filter((p) => !existsSync(p.file));
if (missing.length) {
  console.error("缺少源文件：" + missing.map((m) => m.file).join(", "));
  process.exit(1);
}

const stamp = new Date().toISOString();
let out = `-- =============================================================================
-- FactoryAuditB2B — 一次性执行全部待办迁移
-- 生成时间：${stamp}
-- 由 scripts/build-run-all-pending.mjs 自动生成，**请勿手改本文件**
--
-- 用法：整份复制 → Supabase Dashboard → SQL Editor → 粘贴 → Run
-- 幂等：两份迁移全部使用 IF NOT EXISTS / DO 块守卫，重复执行安全
--
-- 待办清单：
`;
for (const p of PARTS) out += `--   · ${p.title}\n--     ${p.why}\n`;
out += `-- =============================================================================

`;
out += `-- ⚠️ 阅读提示：PART 2（008 leads）正文自称「不 ALTER suppliers」——
--    那是对 CS-07 自身范围的约束。suppliers 的加列在 PART 1（009）里，
--    两者已在本次合并中显式分区，互不越界。
`;
out += `
`;

for (const p of PARTS) {
  out += `\n\n-- ##############################################################################\n`;
  out += `-- ## ${p.title}\n`;
  out += `-- ## 源文件：${p.file}\n`;
  out += `-- ##############################################################################\n\n`;
  out += readFileSync(p.file, "utf8").trimEnd();
  out += "\n";
}

out += VERIFY;
out += `
-- =============================================================================
-- 执行完毕。请把上面三段自检结果回贴，用于逐条核对。
-- =============================================================================
`;

writeFileSync("supabase/00_RUN_ALL_PENDING.sql", out, "utf8");
console.log("已生成 supabase/00_RUN_ALL_PENDING.sql (" + Buffer.byteLength(out) + " bytes)");
for (const p of PARTS) {
  console.log("  + " + p.file + " (" + readFileSync(p.file, "utf8").split("\n").length + " 行)");
}
