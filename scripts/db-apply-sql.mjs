// 通过 Supabase Management API 执行任意 SQL（含 DDL）
//
// 为什么需要它：PostgREST 只暴露表数据（DML），**不开放建表/加列**。
// Management API 的 /v1/projects/{ref}/database/query 可以直接跑 SQL，
// 这是本机唯一能让「迁移不再需要用户手工粘贴」的通道。
//
// 前置：`.env` 里要有 `SUPABASE_ACCESS_TOKEN`（sbp_ 开头）。
//   获取：https://supabase.com/dashboard/account/tokens → Generate new token
//   权限：细粒度 token 需勾 database_read（读）/ database_write（写）
//
// 🔴 安全铁律：
//   1. 该 token 等价于「可改数据库结构」的钥匙，**绝不可 NEXT_PUBLIC_**，
//      且必须留在 `scripts/scrub-next-env.mjs` 的 BUILD_OR_UNUSED 里
//      （否则会被 opennext 内联进 Worker 产物上传到 Cloudflare）。
//   2. 本脚本默认**拒绝**含 DROP TABLE / TRUNCATE / DELETE FROM 的脚本，
//      除非显式加 --allow-destructive。防手滑。
//   3. 只读核验一律加 --read-only（服务端 read_only=true，双保险）。
//
// 用法：
//   node scripts/db-apply-sql.mjs supabase/00_RUN_ALL_PENDING.sql
//   node scripts/db-apply-sql.mjs --read-only supabase/x.sql
//   node scripts/db-apply-sql.mjs --sql "select count(*) from suppliers"
//   node scripts/db-apply-sql.mjs --allow-destructive supabase/rollback.sql
import { readFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const readOnly = argv.includes("--read-only");
const allowDestructive = argv.includes("--allow-destructive");
const inlineIdx = argv.indexOf("--sql");

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}

const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const SITE = env.NEXT_PUBLIC_SUPABASE_URL || "";
const REF = (SITE.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (!TOKEN) {
  die(
    [
      "缺少 SUPABASE_ACCESS_TOKEN。",
      "",
      "获取方式（约 1 分钟）：",
      "  1. 打开 https://supabase.com/dashboard/account/tokens",
      "  2. Generate new token，名称建议 factoryauditb2b-cli",
      "     （细粒度 token 请勾选 database_read / database_write）",
      "  3. 复制 sbp_ 开头的字符串，追加到项目 .env：",
      "     SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx",
      "  4. 重新运行本脚本",
      "",
      "⚠️ 该 token 可执行任意 SQL（含建表/加列），只放本地 .env，绝不加 NEXT_PUBLIC_。",
    ].join("\n")
  );
}
if (!REF) die("无法从 NEXT_PUBLIC_SUPABASE_URL 解析 project ref，请检查 .env");

// —— 取 SQL ——
let sql;
let source;
if (inlineIdx >= 0) {
  sql = argv[inlineIdx + 1] || "";
  source = "--sql 内联";
} else {
  // 注意：不可写成 `a !== argv[inlineIdx + 1]`——未传 --sql 时 inlineIdx=-1，
  // argv[0] 正是文件路径本身，会被误过滤成 undefined（曾致「文件不存在：undefined」）。
  const file = argv.find((a) => !a.startsWith("--"));
  if (!file || !existsSync(file)) die("用法：node scripts/db-apply-sql.mjs <file.sql>（文件不存在：" + file + "）");
  sql = readFileSync(file, "utf8");
  source = file;
}
if (!sql.trim()) die("SQL 为空，无操作");

// —— 破坏性语句守卫 ——
const destructive = [
  ["DROP TABLE", /\bDROP\s+TABLE\b/i],
  ["TRUNCATE TABLE", /\bTRUNCATE\s+TABLE\b/i],
  ["DELETE FROM", /\bDELETE\s+FROM\b/i],
  ["DROP SCHEMA", /\bDROP\s+SCHEMA\b/i],
];
const hits = destructive.filter(([, re]) => re.test(sql)).map(([n]) => n);
if (hits.length && !allowDestructive && !readOnly) {
  die(
    "⚠️ 脚本含破坏性语句：" +
      hits.join(", ") +
      "\n   确认无误请加 --allow-destructive 重跑（本守卫用于防手滑）。"
  );
}

const stat = {
  语句数: (sql.match(/;/g) || []).length,
  "ADD COLUMN": (sql.match(/ADD\s+COLUMN/gi) || []).length,
  "CREATE TABLE": (sql.match(/CREATE\s+TABLE/gi) || []).length,
  "ALTER TABLE": (sql.match(/ALTER\s+TABLE/gi) || []).length,
};
console.log("来源：" + source);
console.log("模式：" + (readOnly ? "只读" : "读写"));
console.log("规模：" + JSON.stringify(stat));

const run = async () => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      authorization: "Bearer " + TOKEN,
      "content-type": "application/json",
    },
    body: JSON.stringify(readOnly ? { query: sql, read_only: true } : { query: sql }),
  });
  const text = await res.text();
  console.log("\nHTTP " + res.status);
  let j = null;
  try {
    j = JSON.parse(text);
  } catch {}
  if (res.ok) {
    console.log(JSON.stringify(j, null, 2).slice(0, 4000));
  } else {
    console.log(text.slice(0, 2000));
    if (res.status === 401) console.log("\n→ 401：token 无效或已撤销，请重新生成。");
    if (res.status === 403) console.log("\n→ 403：token 缺少 database_write 权限（细粒度 token 需勾选）。");
    process.exitCode = 1;
  }
};

run().catch((e) => {
  console.error("请求失败：" + e.message);
  process.exit(1);
});
