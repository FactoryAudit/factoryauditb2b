#!/usr/bin/env node
'use strict';
/*
 * post-publish-submit.cjs — the auto-trigger. Run this AFTER `wrangler deploy`
 * (or from CI / a daily cron). It diffs the sitemap and pushes only the new
 * URLs to Bing IndexNow + Google Indexing API.
 *
 *   node post-publish-submit.cjs
 *
 * Pipeline:
 *   1) sitemap-diff.cjs  -> computes .sitemap-new.txt
 *   2) submit-urls.cjs --from-file .sitemap-new.txt
 *
 * Env: same credential vars as submit-urls.cjs (+ SITE_HOST).
 */

const { execFileSync } = require('child_process');
const path = require('path');

// Load .env so BING_INDEXNOW_KEY / GOOGLE_* are available at release time
// (Next only inlines NEXT_PUBLIC_*; plain env vars must be loaded here).
// Real env vars (e.g. wrangler secret) take precedence over .env.
(function loadEnv() {
  const fs = require('fs');
  const f = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

function run(script, args) {
  const p = path.join(__dirname, script);
  console.log(`\n--- ${script} ${args.join(' ')} ---`);
  execFileSync(process.execPath, [p, ...args], { stdio: 'inherit', env: process.env });
}

function main() {
  run('sitemap-diff.cjs', []);
  const newFile = path.join(__dirname, '.sitemap-new.txt');
  const hasNew = require('fs').existsSync(newFile) && require('fs').readFileSync(newFile, 'utf8').trim().length > 0;
  if (!hasNew) {
    console.log('\nNo new URLs — nothing to submit.');
    return;
  }
  run('submit-urls.cjs', ['--from-file', newFile]);
  console.log('\nAuto-submit complete.');
}
try { main(); } catch (e) { console.error(e); process.exit(1); }
