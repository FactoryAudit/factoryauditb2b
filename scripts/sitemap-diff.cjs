#!/usr/bin/env node
'use strict';
/*
 * sitemap-diff.cjs — fetch the live sitemap, diff against the last run,
 * and write only the NEW urls to .sitemap-new.txt (for submit-urls.cjs).
 *
 * This is the engine behind "auto-submit when a new page is published": because
 * the site is a static Next.js build on Cloudflare Workers, a "publish" == a
 * deploy. After deploy we diff the sitemap and push the delta.
 *
 *   node sitemap-diff.cjs
 *
 * Env: SITE_HOST (default factoryauditb2b.com)
 *      SITEMAP_CACHE / SITEMAP_NEW (override cache & output paths)
 *
 * ── 2026-11-08：支持 sitemapindex ────────────────────────────────────────
 * 站点 sitemap 从「单个 2.9 MB urlset」改成「index + 9 个语言分片」，
 * 原因是原文件在边缘被 30.00 秒稳定切断（详见 lib/sitemapSource.ts）。
 * 因此本脚本必须：先取 /sitemap.xml；若是 <sitemapindex>，再逐个取子分片合并。
 *
 * 🔴 完整性校验不可省：
 *    旧版只做 `res.ok` 判断，而**被截断的响应同样是 200**。
 *    一次截断就会让 current 少掉上千条 URL ⇒ 它们被写进缓存并标记为
 *    「已删除」，下一轮又全部变成「新增」推给 IndexNow，缓存彻底失真。
 *    所以每份 XML 都必须校验根元素已闭合，否则直接失败退出。
 */

const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE_HOST || 'factoryauditb2b.com';
const CACHE = process.env.SITEMAP_CACHE || path.join(__dirname, '.sitemap-cache.txt');
const NEW = process.env.SITEMAP_NEW || path.join(__dirname, '.sitemap-new.txt');
const TIMEOUT_MS = Number(process.env.SITEMAP_TIMEOUT_MS || 25000);

const BASE = `https://${SITE}`;

function isIndex(xml) {
  return /<sitemapindex[\s>]/.test(xml);
}

/** 根元素必须闭合 —— 截断的响应也是 200，只看状态码会静默污染缓存。 */
function assertComplete(xml, label) {
  const root = isIndex(xml) ? 'sitemapindex' : 'urlset';
  const re = new RegExp(`</${root}>\\s*$`);
  if (!re.test(xml)) {
    throw new Error(
      `${label}: <${root}> 未闭合，响应被截断（${Buffer.byteLength(xml)} bytes）。拒绝写入缓存。`
    );
  }
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

function parseUrls(xml) {
  const out = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

async function fetchAllUrls() {
  const rootUrl = `${BASE}/sitemap.xml`;
  const rootXml = await fetchText(rootUrl);
  assertComplete(rootXml, rootUrl);

  if (!isIndex(rootXml)) {
    // 兼容仍是单文件 urlset 的旧部署（首次上线切换时会走到这里）。
    return parseUrls(rootXml);
  }

  const children = parseUrls(rootXml);
  if (children.length === 0) throw new Error(`${rootUrl}: sitemapindex 里没有任何 <loc>`);

  const all = [];
  for (const child of children) {
    const xml = await fetchText(child);
    assertComplete(xml, child);
    all.push(...parseUrls(xml));
  }
  // 去重但保留顺序：同一 URL 若跨片重复，IndexNow 会因重复提交报错。
  return [...new Set(all)];
}

async function main() {
  const current = await fetchAllUrls();
  const currentSet = new Set(current);

  let prev = [];
  if (fs.existsSync(CACHE)) {
    prev = fs.readFileSync(CACHE, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  }
  const prevSet = new Set(prev);
  const added = current.filter((u) => !prevSet.has(u));
  const removed = prev.filter((u) => !currentSet.has(u));

  fs.writeFileSync(CACHE, current.join('\n'));
  fs.writeFileSync(NEW, added.join('\n'));

  console.log(`sitemap: total=${current.length}  new=${added.length}  removed=${removed.length}`);
  if (added.length) {
    console.log('NEW URLs (written to ' + NEW + '):');
    added.forEach((u) => console.log('  + ' + u));
  }
  if (removed.length) {
    console.log('REMOVED (not auto-deindexed — submit URL_DELETED manually if needed):');
    removed.forEach((u) => console.log('  - ' + u));
  }
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
