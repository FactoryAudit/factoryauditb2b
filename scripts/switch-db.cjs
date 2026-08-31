#!/usr/bin/env node
/**
 * 数据库一键切换（SQLite 本地开发 ⇄ PostgreSQL 生产上线）
 * ------------------------------------------------------------
 * 为什么要切？
 *   SQLite 是「本地文件数据库」。部署到 Vercel 后，服务器文件系统是临时的，
 *   客户提交的询盘可能随时丢失。生产必须用 PostgreSQL 才能稳定存住询盘。
 *
 * 用法：
 *   node scripts/switch-db.cjs postgres   → 切到 PostgreSQL（准备上线）
 *   node scripts/switch-db.cjs sqlite     → 切回 SQLite（本地开发）
 *   node scripts/switch-db.cjs            → 查看当前用的是哪个
 */
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const arg = (process.argv[2] || "").toLowerCase();

if (!fs.existsSync(schemaPath)) {
  console.log("[FAIL] 找不到 prisma/schema.prisma");
  process.exit(1);
}

let schema = fs.readFileSync(schemaPath, "utf8");
const current = /provider\s*=\s*"(\w+)"/.exec(schema);
const currentProvider = current ? current[1] : "unknown";

// 只查看当前状态
if (!arg) {
  console.log(`当前数据库: ${currentProvider}`);
  console.log(currentProvider === "sqlite"
    ? "  → 本地开发模式。上线前请运行: npm run db:postgres"
    : "  → 生产模式(PostgreSQL)。改回本地开发请运行: npm run db:sqlite");
  process.exit(0);
}

if (arg !== "postgres" && arg !== "postgresql" && arg !== "sqlite") {
  console.log("[FAIL] 参数只能是 postgres 或 sqlite");
  process.exit(1);
}

const target = arg.startsWith("postgres") ? "postgresql" : "sqlite";

if (currentProvider === target) {
  console.log(`已经是 ${target}，无需切换。`);
  process.exit(0);
}

// 备份
const backupPath = schemaPath + ".bak";
fs.writeFileSync(backupPath, schema, "utf8");

schema = schema.replace(/provider\s*=\s*"\w+"/, `provider = "${target}"`);

// PostgreSQL：加 directUrl（migrate/seed 走非池化直连，避免 PgBouncer 事务模式问题）
// SQLite：移除 directUrl（sqlite provider 不支持该字段）
if (target === "postgresql") {
  if (!schema.includes("DATABASE_URL_UNPOOLED")) {
    schema = schema.replace(
      /url\s*=\s*env\("DATABASE_URL"\)/,
      'url = env("DATABASE_URL")\n  directUrl = env("DATABASE_URL_UNPOOLED")'
    );
  }
} else {
  schema = schema.replace(/\n\s*directUrl\s*=\s*env\("DATABASE_URL_UNPOOLED"\)/g, "");
}

fs.writeFileSync(schemaPath, schema, "utf8");

const line = "=".repeat(58);
console.log(line);
console.log(`  已切换数据库: ${currentProvider} → ${target}`);
console.log(line);
console.log(`原文件已备份: prisma/schema.prisma.bak\n`);

if (target === "postgresql") {
  console.log("接下来 3 步（按顺序做）：\n");
  console.log("  1. 去 https://neon.tech 注册（免费），创建一个数据库，");
  console.log("     复制它的连接串。Neon 控制台会给出两种：");
  console.log("       · Pooled（带 -pooler）：应用运行时用 → 填 .env 的 DATABASE_URL");
  console.log("       · Direct（直连）：migrate/seed 用 → 填 .env 的 DATABASE_URL_UNPOOLED\n");
  console.log("  2. 把 .env 里的 DATABASE_URL 换成 Pooled 连接串，末尾加 ?sslmode=require");
  console.log('     DATABASE_URL="postgresql://user:pass@xxx-pooler.neon.tech/dbname?sslmode=require"');
  console.log('     DATABASE_URL_UNPOOLED="postgresql://user:pass@xxx.neon.tech/dbname?sslmode=require"\n');
  console.log("  3. 建表 + 灌初始数据：");
  console.log("     npx prisma db push");
  console.log("     npm run db:seed\n");
  console.log("  然后就可以部署了。\n");
} else {
  console.log("已切回 SQLite。把 .env 的 DATABASE_URL 改回：");
  console.log('  DATABASE_URL="file:./dev.db"\n');
  console.log("然后运行：npx prisma db push && npm run db:seed\n");
}
