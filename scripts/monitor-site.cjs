#!/usr/bin/env node
'use strict';
/*
 * monitor-site.cjs — check HTTP status codes + response times for key URLs.
 * Good for a quick health dashboard and for the webmaster verification checklist.
 *
 *   node monitor-site.cjs
 *   node monitor-site.cjs --from-file urls.txt
 *   node monitor-site.cjs --path /services/inspection --path /about
 *
 * Env: SITE_HOST (default factoryauditb2b.com)
 * Exit code: 1 if any URL is not 2xx/3xx (so it can fail a CI health gate).
 */

const fs = require('fs');
const SITE = process.env.SITE_HOST || 'factoryauditb2b.com';

const DEFAULT_PATHS = [
  '/',
  '/sitemap.xml',
  '/robots.txt',
  '/about',
  '/contact',
  '/services/inspection',
  '/services/supplier-verification',
  '/services/supplier-improvement',
  // NOTE: /services/factory-audit is NOT a real route (404). Add here only if a
  // factory-audit page is published later.
  '/guides',
  '/case-studies',
  '/field-reports',
];

function collectPaths() {
  const paths = [];
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from-file') return fs.readFileSync(args[++i], 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
    if (args[i] === '--path') paths.push(args[++i]);
  }
  return paths.length ? paths : DEFAULT_PATHS;
}

async function checkOne(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow', method: 'GET' });
    const ms = Date.now() - start;
    return { url, status: res.status, ms, ok: res.status >= 200 && res.status < 400 };
  } catch (e) {
    return { url, status: 0, ms: Date.now() - start, ok: false, error: e.message };
  }
}

async function main() {
  const paths = collectPaths();
  const urls = paths.map((p) => (p.startsWith('http') ? p : `https://${SITE}${p}`));
  const results = [];
  for (const u of urls) {
    const r = await checkOne(u);
    results.push(r);
    const tag = r.ok ? 'OK ' : 'ERR';
    const line = `[${tag}] ${String(r.status).padStart(3)}  ${String(r.ms).padStart(4)}ms  ${u}`;
    console.log(r.error ? line + '  (' + r.error + ')' : line);
  }
  const avg = results.length ? Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length) : 0;
  const errs = results.filter((r) => !r.ok);
  console.log(`\nSummary: ${results.length} checked, ${results.length - errs.length} OK, ${errs.length} error(s), avg ${avg}ms`);
  if (errs.length) {
    console.log('FAILURES:');
    errs.forEach((e) => console.log('  ' + e.url + '  status=' + e.status + (e.error ? '  ' + e.error : '')));
    process.exitCode = 1;
  }
}
main();
