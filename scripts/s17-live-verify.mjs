#!/usr/bin/env node
// scripts/_s17_live_verify.mjs
//
// stage1.7 线上验收（抓真实 URL，与本地预渲染逐字对照）：
//   1. 供应商详情页 desc ≤90（CJK 主导）
//   2. /tools 与 /tools/supplier-verification-checklist desc ≤158 / ≤90
//   3. title 与本地产物逐字一致（= 未被额外裁剪）
//   4. 全部命中静态缓存（x-opennext-cache: HIT）
//
// 用法：NODE_OPTIONS="--require F:/AI-验厂SEO网站/scripts/with-proxy.cjs" node scripts/_s17_live_verify.mjs
'use strict';

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, '.next', 'server', 'app');
const BASE = process.env.LIVE_BASE || 'https://factoryauditb2b.com';
const LOCALES = ['en', 'zh', 'zh-TW', 'ja', 'es', 'de', 'fr', 'pt', 'ar'];

const L = (s) => [...s].length;
const CJK = () => /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;
const ratio = (s) => {
  const t = L(s);
  return t ? (s.match(CJK()) ?? []).length / t : 0;
};
const SENT = /[.。!！?？]/;
const decode = (s) =>
  String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();

const metaOf = (html, name) => {
  const m = html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`, 'i'));
  return m ? decode(m[1]) : null;
};
const titleOf = (html) => {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]) : null;
};

// 本地产物 rel -> URL
const localFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) localFiles.push(path.relative(APP, p).split(path.sep).join('/'));
  }
})(APP);

const urlFor = (rel) => {
  const noExt = rel.replace(/\.html$/, '');
  const seg = noExt.split('/');
  const loc = seg[0];
  if (!LOCALES.includes(loc)) return `${BASE}/${noExt}`; // 非语言前缀（如 404）
  const rest = seg.slice(1).join('/');
  return loc === 'en' ? `${BASE}/${rest}` : `${BASE}/${loc}/${rest}`;
};

const targets = localFiles.filter(
  (f) => /^[^/]+\/suppliers\/[^/]+\.html$/.test(f) || /^[^/]+\/tools(\.html|\/supplier-verification-checklist\.html)$/.test(f),
);

console.log(`线上验收：${targets.length} 个 URL（供应商 81 + tools 18），BASE=${BASE}\n`);

const fails = [];
let pass = 0;
let hit = 0;
let miss = 0;

async function one(rel) {
  const url = urlFor(rel);
  const local = fs.readFileSync(path.join(APP, rel), 'utf8');
  const lDesc = metaOf(local, 'description');
  const lTitle = titleOf(local);
  let res;
  try {
    res = await fetch(url, { headers: { 'user-agent': 'fab2b-verify/1.0' } });
  } catch (e) {
    fails.push(`${rel} 请求失败：${e.message}`);
    return;
  }
  if (!res.ok) {
    fails.push(`${rel} HTTP ${res.status}`);
    return;
  }
  const cache = res.headers.get('x-opennext-cache') || res.headers.get('cf-cache-status') || '(none)';
  if (/HIT/i.test(cache)) hit++;
  else miss++;
  const html = await res.text();
  const d = metaOf(html, 'description');
  const t = titleOf(html);

  // ① 与本地逐字一致（证明线上就是这版构建）
  if (d !== lDesc) fails.push(`${rel} desc 与本地不一致\n      本地(${lDesc ? L(lDesc) : 'null'}): ${lDesc}\n      线上(${d ? L(d) : 'null'}): ${d}`);
  else pass++;
  if (t !== lTitle) fails.push(`${rel} title 与本地不一致\n      本地: ${lTitle}\n      线上: ${t}`);
  else pass++;

  // ② 预算（拉丁 158 / CJK 90）
  if (d) {
    const budget = ratio(d) > 0.1 ? 90 : 158;
    if (L(d) > budget) fails.push(`${rel} desc ${L(d)} 超预算 ${budget}（cjk=${(ratio(d) * 100).toFixed(1)}%）`);
    else pass++;
    if (!SENT.test(d.slice(-1))) fails.push(`${rel} desc 结尾非句末标点：…${d.slice(-30)}`);
    else pass++;
  } else {
    fails.push(`${rel} 线上无 description`);
  }

  // ③ 静态缓存
  if (!/HIT/i.test(cache)) fails.push(`${rel} 未命中静态缓存（cache=${cache}）`);
}

let idx = 0;
async function worker() {
  while (idx < targets.length) {
    const rel = targets[++idx - 1];
    await one(rel);
  }
}
await Promise.all([0, 1, 2, 3, 4, 5].map(() => worker()));

console.log(`静态缓存：HIT=${hit}  非 HIT=${miss}`);
console.log('─'.repeat(64));
console.log(`断言：PASS=${pass}  FAIL=${fails.length}`);
if (fails.length) {
  fails.slice(0, 25).forEach((f) => console.log(`  ✗ ${f}`));
  if (fails.length > 25) console.log(`  … 另有 ${fails.length - 25} 条`);
  process.exit(1);
}
console.log('ALL OK');
