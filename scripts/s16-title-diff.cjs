#!/usr/bin/env node
'use strict';
/*
 * s16-title-diff.cjs <旧APP目录> <新APP目录>
 * 全站 <title> 逐页对照：改了哪些、旧的是否被分隔符截断成残句、新的有多长。
 */
const fs = require('fs');
const path = require('path');

const OLD = process.argv[2];
const NEW = process.argv[3];
const decode = (s) =>
  String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(path.relative(NEW, p).split(path.sep).join('/'));
  }
  return out;
}
const title = (root, rel) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  const h = fs.readFileSync(p, 'utf8');
  const m = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]).trim() : null;
};

const files = walk(NEW, []);
let changed = 0;
let oldMangled = 0;
let newOver60 = 0;
const groups = {};
const samples = [];
for (const rel of files) {
  if (/(_not-found|404|500|_error)/.test(rel)) continue;
  const o = title(OLD, rel);
  const n = title(NEW, rel);
  if (o === null || n === null || o === n) continue;
  changed++;
  const om = /[^ ]\| FactoryAuditB2B/.test(o);
  const no = [...n].length > 60;
  if (om) oldMangled++;
  if (no) newOver60++;
  const g = rel.split('/').slice(0, 2).join('/');
  groups[g] = (groups[g] || 0) + 1;
  if (samples.length < 12 && om) samples.push({ rel, o, n });
}
console.log(`全站 title 有变化：${changed}`);
console.log(`  旧标题被分隔符截断成残句（"xxx| FactoryAuditB2B" 无空格）：${oldMangled}`);
console.log(`  新标题 >60 字符：${newOver60}`);
console.log('\n--- 变化按目录 ---');
for (const [k, v] of Object.entries(groups).sort((a, b) => b[1] - a[1])) console.log(`  ${k}  ${v}`);
console.log('\n--- 旧残句样例（修好之前/之后）---');
for (const s of samples) console.log(`  ${s.rel}\n    old(${[...s.o].length}): ${s.o}\n    new(${[...s.n].length}): ${s.n}`);
