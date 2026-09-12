// 由 02_migration.sql + 03_postcheck.sql **程序化合并** 05_all_in_one.sql
// 目的：保证"一键版"与权威源文件零漂移（手工复制必然产生偏差）。
const fs = await import("node:fs");
const dir = "F:/AI-验厂SEO网站/supabase/cs07/";
const read = (f) => fs.readFileSync(dir + f, "utf8").replace(/\r\n/g, "\n");

const mig = read("02_migration.sql").split("\n");
const migStart = mig.findIndex((l) => l.trim() === "BEGIN;");
if (migStart < 0) throw new Error("02 里找不到 BEGIN;");
const migBody = mig.slice(migStart).join("\n").trimEnd();

const post = read("03_postcheck.sql").split("\n");
const aIdx = post.findIndex((l) => /^-- A\. leads 的 22 列/.test(l));
if (aIdx < 0) throw new Error("03 里找不到 A 段标题");
const postBody = post.slice(aIdx - 1).join("\n").trimEnd();

const header = `-- =============================================================================
-- CS-07 / 05_all_in_one.sql —— 一次性粘贴版（迁移 + 只读验证）
--
-- 执行位置：Supabase Dashboard → SQL Editor → New query → 粘贴本文件 → Run
--
-- ⚠️ 本文件由 \`02_migration.sql\` + \`03_postcheck.sql\` **程序化合并**生成，
--    目的是保证与权威源文件零漂移。若两者内容不一致，**以 02 / 03 为准**。
--    重新生成命令： node scripts/build-cs07-all-in-one.mjs
--
-- 性质：第一部分改结构（DDL，包在 BEGIN/COMMIT 里），第二部分只读验证（纯 SELECT）。
-- 不执行 04_rollback.sql。
--
-- 前置：01_precheck.sql 已跑完，14 段零 FAIL / 零 CONFLICT。
-- 铁律：只新建 public.leads 一张表；0 条业务数据 INSERT/UPDATE/DELETE；
--       不 ALTER suppliers / rfqs / memberships / profiles；不动任何现有 RLS；
--       anon 零权限，service_role 写权限保留。
-- =============================================================================


-- ############################################################################
-- 第一部分：迁移（= 02_migration.sql 全文）
-- ############################################################################

${migBody}


-- ############################################################################
-- 第二部分：只读验证（= 03_postcheck.sql 全文）
-- ############################################################################

${postBody}
`;

fs.writeFileSync(dir + "05_all_in_one.sql", header, "utf8");
console.log("05_all_in_one.sql 已生成:", header.length, "chars");
console.log("含 BEGIN:", header.includes("BEGIN;"), "| 含 COMMIT:", header.includes("COMMIT;"));
console.log("迁移段行数:", migBody.split("\n").length, "| 验证段行数:", postBody.split("\n").length);

// ---- 归档副本：migrations/008_leads.sql 必须与 02_migration.sql **逐字节一致** ----
// 这样 supabase/migrations/ 目录才是 catalog 的诚实镜像（回归可做精确比对）。
const archSrc = fs.readFileSync(dir + "02_migration.sql");
fs.writeFileSync("F:/AI-验厂SEO网站/supabase/migrations/008_leads.sql", archSrc);
console.log("migrations/008_leads.sql 已写入:", archSrc.length, "bytes（与 02_migration.sql 逐字节一致）");
