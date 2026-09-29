#!/usr/bin/env node
// scripts/_s17_verify_artifacts.mjs
//
// stage1.7 离线验收（直接读预渲染产物，不依赖线上）：
//   A. 供应商详情页 desc —— 阈值 10% 是否生效（CJK 主导页必须 ≤90）
//   B. /tools 两页 desc —— 收口到 buildPageMetadata 后是否落预算（拉丁 158 / CJK 90）
//   C. title 未被额外裁剪 —— 与 stage1.6 基线产物逐页对比，确认 title 仍走 25% 阈值
//
// 用法：node scripts/_s17_verify_artifacts.mjs
'use strict';

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const NEW_APP = path.join(ROOT, '.next', 'server', 'app');
const BASELINE_CANDIDATES = [
  '_prune_next_20260929074737/server/app', // stage1.6 已上线产物（本机兜底快照）
];
const OLD_APP = BASELINE_CANDIDATES.map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p)) || null;

const CJK_RE = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;
const SENT = /[.。!！?？]/;

let pass = 0;
const fails = [];
const ck = (cond, msg) => {
  if (cond) pass++;
  else fails.push(msg);
};

const decode = (s) =>
  String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

const len = (s) => [...s].length;
const cjkRatio = (s) => {
  const t = len(s);
  if (!t) return 0;
  return ((s.match(CJK_RE) ?? []).length) / t;
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(path.relative(NEW_APP, p).split(path.sep).join('/'));
  }
  return out;
}

const descOf = (root, rel) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  const h = fs.readFileSync(p, 'utf8');
  const m = h.match(/<meta name="description" content="([^"]*)"/i);
  return m ? decode(m[1]) : null;
};
const titleOf = (root, rel) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  const h = fs.readFileSync(p, 'utf8');
  const m = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]).trim() : null;
};

const files = walk(NEW_APP);
console.log(`产物页数：${files.length}（新）｜基线：${OLD_APP ? OLD_APP.replace(ROOT, '.') : '（缺失）'}\n`);

// ───────────────────────── A. 供应商详情页 desc ─────────────────────────
console.log('########## A. 供应商详情页 desc（阈值 10%）##########');
const supp = files.filter((f) => /\/suppliers\/[^/]+\.html$/.test(f));
const aCjkOver = [];
let aMaxAll = 0;
let aMaxAllAt = '';
let aCjkDominant = 0;
for (const rel of supp) {
  const d = descOf(NEW_APP, rel);
  if (d === null) continue;
  const n = len(d);
  const r = cjkRatio(d);
  if (n > aMaxAll) {
    aMaxAll = n;
    aMaxAllAt = rel;
  }
  if (r > 0.1) {
    aCjkDominant++;
    if (n > 90) aCjkOver.push(`${rel}  [${n}] cjk=${(r * 100).toFixed(1)}%`);
  }
  ck(SENT.test(d.slice(-1)), `${rel} desc 结尾非句末标点：…${d.slice(-30)}`);
}
console.log(`  供应商页数：${supp.length}`);
console.log(`  其中 CJK 占比 >10%（走 90 预算）：${aCjkDominant}`);
console.log(`  最长 desc：${aMaxAll} 字符（${aMaxAllAt}）`);
ck(aCjkOver.length === 0, `有 ${aCjkOver.length} 页 CJK 主导的供应商 desc >90`);
if (aCjkOver.length) aCjkOver.slice(0, 12).forEach((x) => console.log(`    ✗ ${x}`));
console.log(`  断言（CJK 主导页 desc ≤90 且结尾句末标点）⇒ ${aCjkOver.length === 0 ? 'OK' : 'FAIL'}\n`);

// ───────────────────────── B. /tools 两页 desc ──────────────────────────
console.log('########## B. /tools 与 /tools/supplier-verification-checklist desc ##########');
const toolFiles = files.filter(
  (f) => /\/tools\.html$/.test(f) || /\/tools\/supplier-verification-checklist\.html$/.test(f),
);
const bOver = [];
for (const rel of toolFiles) {
  const d = descOf(NEW_APP, rel);
  if (d === null) {
    bOver.push(`${rel}  （无 desc）`);
    continue;
  }
  const n = len(d);
  const r = cjkRatio(d);
  const budget = r > 0.1 ? 90 : 158;
  const okLen = n <= budget;
  const okSent = SENT.test(d.slice(-1));
  if (!okLen || !okSent) bOver.push(`${rel}  [${n}] 预算 ${budget} cjk=${(r * 100).toFixed(1)}% ${okSent ? '' : '结尾无标点'}`);
  console.log(`  ${rel.padEnd(52)} [${String(n).padStart(3)}] 预算 ${budget} cjk=${(r * 100).toFixed(1)}% ${okLen && okSent ? '✓' : '✗'}`);
  ck(okLen, `${rel} desc ${n} 超预算 ${budget}`);
  ck(okSent, `${rel} desc 结尾无句末标点`);
}
console.log(`  断言（两页 9 语全落预算）⇒ ${bOver.length === 0 ? 'OK' : 'FAIL'}\n`);

// ───────────────────────── C. title 未被额外裁剪 ────────────────────────
console.log('########## C. title 与 stage1.6 基线逐页对比 ##########');
if (!OLD_APP) {
  console.log('  ⚠️ 找不到基线产物，跳过对比');
} else {
  let changed = 0;
  let shortened = 0;
  let shortenedSuppliers = 0;
  const samples = [];
  for (const rel of files) {
    if (/(_not-found|404|500|_error)/.test(rel)) continue;
    const o = titleOf(OLD_APP, rel);
    const n = titleOf(NEW_APP, rel);
    if (o === null || n === null || o === n) continue;
    changed++;
    if (len(n) < len(o)) {
      shortened++;
      if (/\/suppliers\//.test(rel)) shortenedSuppliers++;
      if (samples.length < 10) samples.push(`${rel}  ${len(o)} → ${len(n)}\n      old: ${o}\n      new: ${n}`);
    }
  }
  console.log(`  title 有变化的页面：${changed}`);
  console.log(`  其中**变短**（= 被额外裁剪）的页面：${shortened}`);
  console.log(`  其中属于供应商详情页的：${shortenedSuppliers}`);
  if (samples.length) console.log('  样例：\n      ' + samples.join('\n      '));
  ck(shortenedSuppliers === 0, `有 ${shortenedSuppliers} 页供应商 title 被额外裁剪`);
  console.log(`  断言（供应商页 title 零裁剪）⇒ ${shortenedSuppliers === 0 ? 'OK' : 'FAIL'}\n`);
}

// ───────────────────────── 汇总 ─────────────────────────────────────────
console.log('─'.repeat(64));
console.log(`断言：PASS=${pass}  FAIL=${fails.length}`);
if (fails.length) {
  fails.slice(0, 20).forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log('ALL OK');
