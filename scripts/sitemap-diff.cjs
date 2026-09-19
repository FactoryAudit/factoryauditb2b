#!/usr/bin/env node
'use strict';
/*
 * sitemap-diff.cjs — fetch the live sitemap.xml, diff against the last run,
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
 */

const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE_HOST || 'factoryauditb2b.com';
const CACHE = process.env.SITEMAP_CACHE || path.join(__dirname, '.sitemap-cache.txt');
const NEW = process.env.SITEMAP_NEW || path.join(__dirname, '.sitemap-new.txt');

async function fetchSitemap() {
  const res = await fetch(`https://${SITE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap fetch -> ${res.status}`);
  return res.text();
}
function parseUrls(xml) {
  const out = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

async function main() {
  const xml = await fetchSitemap();
  const current = parseUrls(xml);
  let prev = [];
  if (fs.existsSync(CACHE)) {
    prev = fs.readFileSync(CACHE, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  }
  const prevSet = new Set(prev);
  const added = current.filter((u) => !prevSet.has(u));
  const removed = prev.filter((u) => !new Set(current).has(u));

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
main().catch((e) => { console.error(e); process.exit(1); });
