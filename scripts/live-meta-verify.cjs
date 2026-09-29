#!/usr/bin/env node
'use strict';
/*
 * live-meta-verify.cjs — 部署后线上 SEO 元数据验收（只读，需联网）
 *
 *   抓线上 HTML，抽 title / description / canonical / hreflang / JSON-LD，
 *   并与本地预渲染产物（.next/server/app/**）逐字对照 —— 用于回答
 *   「这次部署上线的是不是我这版构建」。
 *
 *   node scripts/live-meta-verify.cjs               # 默认 10 页抽样
 *   node scripts/live-meta-verify.cjs / /trust /zh  # 自定义路径
 *   LIVE_BASE=https://xxx node scripts/live-meta-verify.cjs
 *
 * 断言项：canonical 自指、hreflang 含 9 语 + x-default、JSON-LD 可解析、
 *        title/desc 与本地预渲染逐字一致（动态页跳过该项）。
 *
 * 注意（踩过的坑）：
 *  - 站点 hreflang 用 **`hrefLang`（大写 L）** 且语言码是 **BCP-47**：
 *    zh-CN / zh-Hant / pt-BR —— 不是 URL 段的 zh / zh-TW / pt。
 *  - canonical 统一**不带尾斜杠**，根路径即裸域名 https://factoryauditb2b.com。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, '.next', 'server', 'app');
const BASE = process.env.LIVE_BASE || 'https://factoryauditb2b.com';

const DEFAULTS = ['/', '/suppliers', '/services/supplier-verification', '/logistics', '/trust', '/tools/compare', '/zh', '/ar', '/pricing', '/monitoring'];
const args = process.argv.slice(2).filter((a) => a.startsWith('/'));
const PAGES = args.length ? args : DEFAULTS;

// 路径 -> 本地预渲染 HTML（用于逐字对照；动态页为 null）
function localHtmlFor(p) {
  const clean = p.replace(/\/+$/, '');
  if (clean === '') return path.join(APP, 'en.html');
  const m = clean.match(/^\/(zh-TW|zh|ja|es|de|fr|pt|ar|en)(\/.*)?$/);
  const loc = m ? m[1] : 'en';
  const rest = m ? m[2] || '' : clean;
  const file = path.join(APP, loc + rest + '.html');
  return fs.existsSync(file) ? file : null;
}

const decode = (s) =>
  String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

const len = (s) => [...String(s)].length;
const pick = (html, re) => {
  const m = html.match(re);
  return m ? decode(m[1]).trim() : null;
};

function extract(html) {
  const title = pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc =
    pick(html, /<meta[^>]*name="description"[^>]*content="([^"]*)"/i) ||
    pick(html, /<meta[^>]*content="([^"]*)"[^>]*name="description"/i);
  const canonical =
    pick(html, /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i) ||
    pick(html, /<link[^>]*href="([^"]*)"[^>]*rel="canonical"/i);
  const robots = pick(html, /<meta[^>]*name="robots"[^>]*content="([^"]*)"/i);

  const hreflang = [];
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    if (!/rel="alternate"/i.test(tag)) continue;
    const hl = tag.match(/hreflang="([^"]*)"/i); // 大小写不敏感，兼容 hrefLang
    const href = tag.match(/href="([^"]*)"/i);
    if (hl && href) hreflang.push({ hreflang: hl[1], href: decode(href[1]) });
  }

  const jsonld = [];
  const ldRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = ldRe.exec(html))) jsonld.push(m[1].trim());

  return { title, desc, canonical, robots, hreflang, jsonld };
}

async function grab(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'FactoryAuditB2B-meta-verify/1.0', 'cache-control': 'no-cache' },
    redirect: 'manual',
  });
  return {
    status: res.status,
    loc: res.headers.get('location'),
    cfCache: res.headers.get('cf-cache-status'),
    onCache: res.headers.get('x-opennext-cache'),
    body: await res.text(),
  };
}

(async () => {
  let fails = 0;
  const note = (ok, msg) => {
    if (!ok) fails++;
    console.log(`  ${ok ? 'PASS' : '**FAIL**'}  ${msg}`);
  };
  const norm = (u) => String(u || '').replace(/\/+$/, '');

  for (const p of PAGES) {
    console.log(`\n================ ${p} ================`);
    let r;
    try {
      r = await grab(BASE + p);
    } catch (e) {
      console.log(`  **FAIL**  请求异常: ${e.message}`);
      fails++;
      continue;
    }
    if (r.status !== 200) {
      console.log(`  **FAIL**  HTTP ${r.status}${r.loc ? ' -> ' + r.loc : ''}`);
      fails++;
      continue;
    }
    console.log(`  HTTP 200 | cf-cache-status=${r.cfCache} | x-opennext-cache=${r.onCache}`);

    const live = extract(r.body);
    console.log(`  title(${live.title ? len(live.title) : '-'}) = ${live.title}`);
    console.log(`  desc(${live.desc ? len(live.desc) : '-'}) = ${live.desc}`);
    console.log(`  canonical = ${live.canonical} | robots = ${live.robots}`);
    console.log(`  hreflang = ${live.hreflang.length} 条 | JSON-LD = ${live.jsonld.length} 块`);

    note(norm(live.canonical) === norm(BASE + p), `canonical 自指 (期望 ${BASE + p})`);

    const langs = new Set(live.hreflang.map((x) => x.hreflang));
    const need = ['en', 'zh-CN', 'zh-Hant', 'ja', 'es', 'de', 'fr', 'pt-BR', 'ar', 'x-default'];
    const missing = need.filter((x) => !langs.has(x));
    note(missing.length === 0, `hreflang 含 9 语(BCP-47) + x-default (缺: ${missing.join(',') || '无'})`);

    let bad = 0;
    for (const block of live.jsonld) {
      try {
        JSON.parse(block);
      } catch {
        bad++;
      }
    }
    note(bad === 0, `JSON-LD 全部可 JSON.parse (${live.jsonld.length - bad}/${live.jsonld.length})`);

    const lp = localHtmlFor(p);
    if (lp) {
      const lo = extract(fs.readFileSync(lp, 'utf8'));
      note(lo.title === live.title, 'title 与本地预渲染逐字一致');
      if (lo.title !== live.title) console.log(`        本地: ${lo.title}\n        线上: ${live.title}`);
      note(lo.desc === live.desc, 'desc 与本地预渲染逐字一致');
      if (lo.desc !== live.desc) {
        console.log(`        本地(${len(lo.desc || '')}): ${lo.desc}\n        线上(${len(live.desc || '')}): ${live.desc}`);
      }
    } else {
      console.log('  (无本地预渲染产物，仅线上自洽断言)');
      note(!!live.title && !!live.desc, 'title/desc 均存在');
    }
  }

  console.log(`\n================ 汇总 ================`);
  console.log(fails === 0 ? 'ALL PASS' : `${fails} 项 FAIL`);
  process.exit(fails === 0 ? 0 : 1);
})();
