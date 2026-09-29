#!/usr/bin/env node
'use strict';
/*
 * title-length-sweep.cjs — <title> 长度体检（离线，只读）
 *
 * 为什么需要它：`trimMetaTitle`（lib/pageMeta.ts）只是**兜底安全网**，只保证「不超预算」，
 * 不保证「落在 SERP 可读区间」——标题过短同样浪费展示位。
 *
 * 口径说明（避免出现「1194 项越界」这类噪声）：
 *   · 50–60 是**拉丁字母**的经验区间。阿拉伯文、CJK 的「字符数 ≠ 像素宽」，
 *     全站套同一带宽会把几百条正常标题全打成越界 ⇒ 那些语种不进断言。
 *   · 因此本脚本分两段：
 *       A. 声明清单断言 —— 只对「已书面定过目标」的标题（stage1.6 §2b 的 10 处）逐语种断言 50–60
 *       B. 全站分布观察 —— 按语种给出长度 min/median/max 与越界计数，仅报告，不参与 --assert
 *
 *   node scripts/title-length-sweep.cjs            # 报告
 *   node scripts/title-length-sweep.cjs --assert   # A 段有命中即 exit 1
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// 默认扫描当前构建产物；SWEEP_APP 可指向隔离出来的旧产物目录（`_prune_next_*`）
// 以便「同一探针」做改动前后对照。
const APP = process.env.SWEEP_APP ? path.resolve(process.env.SWEEP_APP) : path.join(ROOT, '.next', 'server', 'app');
const ASSERT = process.argv.includes('--assert');
const SKIP = /(_not-found|404|500|_error)/;
const LATIN_MIN = 50;
const LATIN_MAX = 60;
const CJK_RE_G = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;
// 拉丁带宽只对这些语种有意义（en/es/de/fr/pt 为拉丁字母，ja/zh/zh-TW 为 CJK，ar 为阿拉伯文）
const LATIN_BAND_LOCALES = new Set(['en', 'es', 'de', 'fr', 'pt']);

// A 段：stage1.6 §2b 声明清单（**逐 (路由, 语种) 配对** → 目标 50–60）
// 只断言「已书面定过目标」的 10 项；zh/zh-TW/ja 的 CJK 标题与未声明的语种不在内。
const DECLARED = [
  { route: '/terms', key: 'legal.termsTitle', locales: ['en', 'es', 'de', 'fr', 'pt', 'ar'] },
  { route: '/tools/supplier-risk-calculator', key: 'risk.page.metaTitle', locales: ['es', 'fr', 'pt', 'ar'] },
];

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

function titleOf(rel) {
  const f = path.join(APP, rel);
  if (!fs.existsSync(f)) return null;
  const html = fs.readFileSync(f, 'utf8');
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]).trim() : null;
}

if (!fs.existsSync(APP)) {
  console.error(`未找到预渲染目录: ${APP}\n请先执行 next build。`);
  process.exit(2);
}

const LOCALES = ['en', 'zh', 'zh-TW', 'ja', 'es', 'de', 'fr', 'pt', 'ar'];

// ---------- A 段 ----------
console.log(`===== A. 声明清单 ${DECLARED.reduce((a, d) => a + d.locales.length, 0)} 项（assert 口径 50–60）=====`);
console.log('（下面把 9 个语种全印出来便于核对；只有标 ⌾ 的才参与 assert）');
let aFail = 0;
let aTotal = 0;
for (const d of DECLARED) {
  console.log(`\n${d.key}  @ ${d.route}`);
  for (const L of LOCALES) {
    const declared = d.locales.includes(L);
    const t = titleOf(`${L}${d.route}.html`);
    if (declared) aTotal++;
    if (t === null) {
      console.log(`  ${L.padEnd(6)} ${declared ? '⌾' : ' '} <未找到产物>`);
      if (declared) aFail++;
      continue;
    }
    const n = [...t].length;
    if (!declared) {
      console.log(`  ${L.padEnd(6)}   [${String(n).padStart(3)}]      ${t}`);
      continue;
    }
    const ok = n >= LATIN_MIN && n <= LATIN_MAX;
    if (!ok) aFail++;
    console.log(`  ${L.padEnd(6)} ⌾ [${String(n).padStart(3)}] ${ok ? '✓' : '✗'}  ${t}`);
  }
}

// ---------- B 段 ----------
const files = walk(APP, []);
const byLoc = new Map();
let withTitle = 0;
let noTitle = 0;
for (const f of files) {
  const rel = path.relative(APP, f).replace(/\\/g, '/');
  if (SKIP.test(rel)) continue;
  const html = fs.readFileSync(f, 'utf8');
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m || !decode(m[1]).trim()) {
    noTitle++;
    continue;
  }
  withTitle++;
  const t = decode(m[1]).trim();
  const loc = rel.split('/')[0];
  const total = [...t].length;
  const cjk = (t.match(CJK_RE_G) ?? []).length;
  const isCjk = total > 0 && cjk / total > 0.25;
  const b = byLoc.get(loc) ?? { lens: [], bad: [] };
  b.lens.push(total);
  if (LATIN_BAND_LOCALES.has(loc)) {
    // 拉丁语种里 CJK 标题（如 zh 页面被误路由）不参与
    if (!isCjk && (total < LATIN_MIN || total > LATIN_MAX)) b.bad.push({ rel, total, t });
  }
  byLoc.set(loc, b);
}

console.log('\n\n===== B. 全站分布（仅观察，不参与 assert）=====');
console.log(`扫描 ${files.length} 个 HTML｜有 title ${withTitle}｜无 title ${noTitle}`);
console.log('\n语种     数量   min  中位  max   拉丁带宽越界(50–60)');
let bBad = 0;
for (const L of LOCALES) {
  const b = byLoc.get(L);
  if (!b) continue;
  const s = [...b.lens].sort((x, y) => x - y);
  const med = s[Math.floor(s.length / 2)];
  bBad += b.bad.length;
  console.log(
    `${L.padEnd(8)} ${String(s.length).padStart(4)} ${String(s[0]).padStart(5)} ${String(med).padStart(5)} ${String(s[s.length - 1]).padStart(5)}   ${b.bad.length}`
  );
}
if (bBad) {
  console.log('\n---- 拉丁语种带宽越界明细（前 40）----');
  for (const L of LOCALES) {
    const b = byLoc.get(L);
    if (!b) continue;
    for (const x of b.bad.slice(0, 40)) console.log(`  ${x.rel}  [${String(x.total).padStart(3)}]  ${x.t}`);
  }
}

console.log(`\n=> A 段 ${aTotal - aFail}/${aTotal} 通过（失败 ${aFail} 项）｜B 段拉丁带宽越界 ${bBad} 项（观察值）`);
if (ASSERT && aFail) process.exit(1);
