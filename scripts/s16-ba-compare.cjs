#!/usr/bin/env node
'use strict';
/*
 * _s16_ba.cjs — 同一份产物对照探针（stage1.6 用）
 * 用法: node scripts/_s16_ba.cjs <旧APP目录> <新APP目录>
 *
 * 对「行业分类页」( <loc>/industry/<slug>.html ) 输出：
 *   旧 desc 长度 → 新 desc 长度、是否落在 100–158、结尾是否句末标点
 * 并对 /terms 与 /tools/supplier-risk-calculator 输出 title 前后对照。
 */
const fs = require('fs');
const path = require('path');

const OLD = process.argv[2];
const NEW = process.argv[3];
const LOCALES = ['en', 'zh', 'zh-TW', 'ja', 'es', 'de', 'fr', 'pt', 'ar'];
const SENT = /[.!?。！？؟۔…]["'”’»)\]）]*$/;
const decode = (s) =>
  String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

function meta(dir, rel, which) {
  const f = path.join(dir, rel);
  if (!fs.existsSync(f)) return null;
  const html = fs.readFileSync(f, 'utf8');
  const re =
    which === 'title' ? /<title[^>]*>([\s\S]*?)<\/title>/i : /<meta[^>]*name="description"[^>]*content="([^"]*)"/i;
  const m = html.match(re);
  return m ? decode(m[1]).trim() : null;
}

const CLASS_RE = /^[a-z-]+\/industry\/[a-z-]+\.html$/;
console.log('loc      slug                    oldLen  newLen  新落 100-158  新结尾标点');
console.log('-'.repeat(92));
const stat = new Map();
let badCount = 0;
for (const L of LOCALES) {
  const dir = path.join(NEW, L, 'industry');
  if (!fs.existsSync(dir)) continue;
  const slugs = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace(/\.html$/, ''))
    .sort();
  for (const s of slugs) {
    const rel = `${L}/industry/${s}.html`;
    if (!CLASS_RE.test(rel)) continue;
    const o = meta(OLD, rel, 'desc');
    const n = meta(NEW, rel, 'desc');
    const nlen = n ? [...n].length : -1;
    const isCjk = n ? (n.match(/[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length / nlen > 0.25 : false;
    const inBand = isCjk ? nlen <= 90 : nlen >= 100 && nlen <= 158;
    const okEnd = n ? SENT.test(n) : false;
    if (!okEnd) badCount++;
    const b = stat.get(L) ?? { min: 9e9, max: 0, cjk: false };
    stat.set(L, { min: Math.min(b.min, nlen), max: Math.max(b.max, nlen), cjk: isCjk });
    console.log(
      `${L.padEnd(8)} ${s.padEnd(22)} ${String(o ? [...o].length : -1).padStart(6)}  ${String(nlen).padStart(6)}   ${
        inBand ? '  ✓  ' : '  ✗  '
      }${isCjk ? '(CJK≤90)' : '        '}  ${okEnd ? '✓' : '✗'}`
    );
  }
}
console.log('\n=== 行业分类页 desc 长度区间（新产物）===');
for (const L of LOCALES) {
  const b = stat.get(L);
  if (b) console.log(`${L.padEnd(8)} ${b.cjk ? 'CJK 预算 90' : '拉丁预算 158'}　${b.min}–${b.max}`);
}
console.log(`\n结尾无句末标点: ${badCount} 项`);

console.log('\n=== 声明 title 前后对照 ===');
for (const [route, key] of [
  ['/terms', 'legal.termsTitle'],
  ['/tools/supplier-risk-calculator', 'risk.page.metaTitle'],
]) {
  console.log(`\n${key} @ ${route}`);
  for (const L of LOCALES) {
    const rel = `${L}${route}.html`;
    const o = meta(OLD, rel, 'title');
    const n = meta(NEW, rel, 'title');
    console.log(
      `  ${L.padEnd(6)} ${String(o ? [...o].length : -1).padStart(3)} -> ${String(n ? [...n].length : -1).padStart(3)}   ${n ?? ''}`
    );
  }
}
