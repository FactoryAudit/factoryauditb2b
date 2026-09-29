#!/usr/bin/env node
'use strict';
/*
 * desc-truncation-sweep.cjs — 全站 meta description「半句话」体检（离线，只读）
 *
 * 为什么需要它：`trimMetaDescription`（lib/pageMeta.ts）在超预算时取「预算内最后一个
 * 句末标点」；**若源头是一整句、句内没有句末标点**，就只能退到词边界截断，
 * 输出一段**没有句末标点的半句话**。这类缺陷「长度达标」，用长度断言完全抓不到，
 * 必须单独断言「结尾是否有句末标点」。
 *
 * 它扫描 .next/server/app/**\/*.html —— 即真正被部署的预渲染产物，因此结论与线上一致。
 *
 *   node scripts/desc-truncation-sweep.cjs            # 报告
 *   node scripts/desc-truncation-sweep.cjs --assert   # 有命中即 exit 1（可挂进回归）
 *
 * 修法（勿改收尾策略）：把源头 desc 改成**双句结构**且总长 ≤ 预算
 * （拉丁 158 / CJK 90），使收口函数零命中，即为幂等。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, '.next', 'server', 'app');
const ASSERT = process.argv.includes('--assert');
const SKIP = /(_not-found|404|500|_error)/;

// 句末标点：拉丁 . ! ? ｜ CJK 。！？ ｜ 阿拉伯 ؟ ۔ ｜ 省略号 …（允许尾随引号/括号）
const ENDER = /[.!?。！？؟۔…]["'”’»)\]）]*$/;

const decode = (s) =>
  String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}

if (!fs.existsSync(APP)) {
  console.error(`未找到预渲染目录: ${APP}\n请先执行 next build。`);
  process.exit(2);
}

const files = walk(APP, []);
const bad = [];
let withDesc = 0;
let noDesc = 0;

for (const f of files) {
  const rel = path.relative(APP, f).replace(/\\/g, '/');
  if (SKIP.test(rel)) continue;
  const html = fs.readFileSync(f, 'utf8');
  const m =
    html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i) ||
    html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/i);
  if (!m) {
    noDesc++;
    continue;
  }
  const desc = decode(m[1]).trim();
  if (!desc) {
    noDesc++;
    continue;
  }
  withDesc++;
  if (!ENDER.test(desc)) bad.push({ rel, len: [...desc].length, tail: desc.slice(-70) });
}

console.log(`扫描预渲染 HTML: ${files.length} 个文件`);
console.log(`有 description: ${withDesc}｜无 description: ${noDesc}`);
console.log(`结尾无句末标点（半句话嫌疑）: ${bad.length}\n`);

const byLoc = {};
const bySec = {};
for (const b of bad) {
  const parts = b.rel.replace(/\.html$/, '').split('/');
  byLoc[parts[0]] = (byLoc[parts[0]] || 0) + 1;
  const sec = parts.length > 1 ? parts[1] : '(root)';
  bySec[sec] = (bySec[sec] || 0) + 1;
}
if (bad.length) {
  console.log('--- 按语种 ---');
  for (const [k, v] of Object.entries(byLoc).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(8)} ${v}`);
  }
  console.log('\n--- 按板块 ---');
  for (const [k, v] of Object.entries(bySec).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(22)} ${v}`);
  }
  console.log('\n--- 明细 ---');
  for (const b of bad) console.log(`  ${b.rel}  [${b.len}]  ...${b.tail}`);
}

if (bad.length) {
  console.log(`\n=> ${bad.length} 项需修（源头改为双句、总长 ≤ 预算）`);
  if (ASSERT) process.exit(1);
} else {
  console.log('\n=> ALL CLEAN');
}
