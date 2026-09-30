#!/usr/bin/env node
/**
 * deploy/package-standalone.mjs —— 把 standalone 构建产物整理成「可直接上传宝塔」的目录
 *
 * 前置：先用 standalone 模式构建
 *   FAB2B_OUTPUT=standalone FAB2B_DISABLE_BUILD_TRACE=1 \
 *   FAB2B_PROXY=http://127.0.0.1:7897 \
 *   NODE_OPTIONS="--require=<repo>/scripts/with-proxy.cjs" \
 *   node node_modules/next/dist/bin/next build
 *
 * 本脚本做三件事（Next 自托管的标准三件套，缺一不可）：
 *   1. .next/standalone/  →  <pkg>/          （server.js + 最小 node_modules）
 *   2. .next/static/      →  <pkg>/.next/static   ★ 不拷 ⇒ 线上 CSS/JS 全 404
 *   3. public/            →  <pkg>/public         ★ 不拷 ⇒ favicon/验证文件 404
 *
 * 为什么不让服务器自己构建：
 *   `next build` 要预渲染 ~1500 个页面，峰值内存 1–2GB。
 *   小内存 VPS（1C1G）必 OOM，而失败信息往往是隐晦的 "JS heap out of memory"。
 *   本地构建 + 上传产物，把内存压力留在开发机，服务器只负责跑 server.js。
 *
 * 用法：
 *   node deploy/package-standalone.mjs            # 组装目录
 *   node deploy/package-standalone.mjs --clean    # 组装前先清空目标目录
 */

import { existsSync, mkdirSync, cpSync, rmSync, statSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PKG = join(ROOT, "_baota_pkg");

const CLEAN = process.argv.includes("--clean");

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function dirSizeMB(p) {
  let total = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.isFile()) total += statSync(f).size;
    }
  };
  walk(p);
  return (total / 1048576).toFixed(1);
}

function fileCount(p) {
  let n = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) walk(f);
      else n += 1;
    }
  };
  walk(p);
  return n;
}

// ── 前置校验 ────────────────────────────────────────────────────────────────
const standalone = join(ROOT, ".next", "standalone");
if (!existsSync(standalone)) {
  die(
    `.next/standalone 不存在 —— 说明这次不是 standalone 构建。\n` +
      `  请先执行：FAB2B_OUTPUT=standalone node node_modules/next/dist/bin/next build`
  );
}
if (!existsSync(join(standalone, "server.js"))) {
  die(".next/standalone/server.js 不存在 —— standalone 产物不完整，请重新构建。");
}
if (!existsSync(join(ROOT, ".next", "static"))) {
  die(".next/static 不存在 —— 没有它线上所有 CSS/JS 都会 404。");
}
if (!existsSync(join(ROOT, "public"))) {
  die("public/ 不存在 —— 没有它 favicon 与站点验证文件会 404。");
}

// ── 组装 ────────────────────────────────────────────────────────────────────
if (CLEAN && existsSync(PKG)) {
  rmSync(PKG, { recursive: true, force: true });
}
mkdirSync(PKG, { recursive: true });

/**
 * 逐项拷贝（不用 cpSync(目录, 目录) —— 目标已存在时它会把源目录整个塞进去，
 * 变成 <pkg>/standalone/... 多一层，线上 server.js 就找不到了）。
 */
function copyInto(srcDir, destDir, exclude = new Set()) {
  mkdirSync(destDir, { recursive: true });
  for (const e of readdirSync(srcDir, { withFileTypes: true })) {
    if (exclude.has(e.name)) {
      console.log(`     ↳ 跳过 ${e.name}（安全排除）`);
      continue;
    }
    cpSync(join(srcDir, e.name), join(destDir, e.name), { recursive: true });
  }
}

// 🔴 安全排除：Next 会把项目根的 `.env` 一并拷进 standalone 产物。
//    那份 .env 含 SUPABASE_ACCESS_TOKEN / CLOUDFLARE_API_TOKEN 等**构建期**密钥
//    （能改库结构、能发部署），而服务器上没有任何代码读它们。
//    原样上传 = 把不必要的最高权限钥匙送到生产机上，故必须剔除。
//    服务器实际读取的是 `.env.production`（步骤 3 由你手工创建）。
const STANDALONE_EXCLUDE = new Set([".env", ".env.local", ".env.development.local"]);

console.log("① 拷贝 .next/standalone → 包根目录 …");
copyInto(standalone, PKG, STANDALONE_EXCLUDE);

console.log("② 拷贝 .next/static → 包内 .next/static …");
mkdirSync(join(PKG, ".next"), { recursive: true });
cpSync(join(ROOT, ".next", "static"), join(PKG, ".next", "static"), { recursive: true });

console.log("③ 拷贝 public → 包内 public …");
cpSync(join(ROOT, "public"), join(PKG, "public"), { recursive: true });

// 日志目录（PM2 配置里用到；不预建会让 PM2 在某些版本下启动失败）
mkdirSync(join(PKG, "logs"), { recursive: true });
writeFileSync(join(PKG, "logs", ".gitkeep"), "", "utf8");

// 部署辅助文件随包走，服务器上不用再找仓库
cpSync(join(ROOT, "deploy", "ecosystem.config.js"), join(PKG, "ecosystem.config.js"));
cpSync(join(ROOT, "deploy", "env.production.example"), join(PKG, "env.production.example"));
cpSync(join(ROOT, "deploy", "nginx.conf"), join(PKG, "nginx.conf"));

// ── 报告 ────────────────────────────────────────────────────────────────────
const critical = [
  "server.js",
  "package.json",
  "node_modules",
  ".next/static",
  ".next/server",
  "public",
];
console.log("\n── 完整性自检 ──");
let missing = 0;
for (const rel of critical) {
  const ok = existsSync(join(PKG, rel));
  if (!ok) missing += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${rel}`);
}

console.log(`\n── 产物 ──`);
console.log(`  目录   ${PKG}`);
console.log(`  体积   ${dirSizeMB(PKG)} MB`);
console.log(`  文件数 ${fileCount(PKG)}`);

// 🔴 安全断言：包内绝不允许出现项目根 .env（含构建期最高权限密钥）
const leakedEnv = [".env", ".env.local"].filter((f) => existsSync(join(PKG, f)));
if (leakedEnv.length > 0) {
  die(`包内检测到 ${leakedEnv.join(", ")} —— 含构建期密钥，禁止上传。请检查排除规则。`);
}
console.log(`  ✓ 未夹带 .env（构建期密钥未泄漏）`);

if (missing > 0) {
  die(`有 ${missing} 个关键路径缺失，产物不可用。`);
}
console.log(`\n✓ 打包完成。下一步：tar -czf outputs/la_fab2b.tar.gz -C _baota_pkg .`);
