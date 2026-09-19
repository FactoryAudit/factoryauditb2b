#!/usr/bin/env node
'use strict';
/*
 * submit-urls.cjs — Push URLs to search engines after a publish.
 *
 *   Bing IndexNow API          -> https://api.indexnow.org/indexnow  (works for Bing + Yandex)
 *   Google Indexing API        -> https://indexing.googleapis.com/v3/urlNotifications:publish
 *   Google sitemap ping        -> https://www.google.com/ping?sitemap=...
 *
 * Usage:
 *   node submit-urls.cjs --url https://factoryauditb2b.com/services/inspection
 *   node submit-urls.cjs --from-file .sitemap-new.txt
 *   node submit-urls.cjs --dry-run --url https://factoryauditb2b.com/about   # no network, shows payloads
 *
 * Credentials (env — see .env.example, NEVER hardcode):
 *   BING_INDEXNOW_KEY            e.g. "a1b2c3d4e5f6..."
 *   BING_INDEXNOW_KEY_LOCATION   optional; default https://<SITE>/<KEY>.txt
 *   GOOGLE_SERVICE_ACCOUNT_JSON  path to a Google Cloud service-account key file
 *       OR  GOOGLE_SA_JSON       inline JSON string of the same key
 *   SITE_HOST                    default factoryauditb2b.com
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env so BING_INDEXNOW_KEY / GOOGLE_* are available when run directly
// (Next only inlines NEXT_PUBLIC_*; plain env vars must be loaded here).
(function loadEnv() {
  const f = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const SITE = process.env.SITE_HOST || 'factoryauditb2b.com';
const BASE = `https://${SITE}`;

// ----------------------------------------------------------------------------
// arg parsing
// ----------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { urls: [], dryRun: false, file: null };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--url') a.urls.push(argv[++i]);
    else if (t === '--from-file' || t === '-f') a.file = argv[++i];
    else if (t === '--dry-run') a.dryRun = true;
    else if (t === '--help' || t === '-h') { printHelp(); process.exit(0); }
  }
  return a;
}
function printHelp() {
  console.log(`submit-urls.cjs — push URLs to Bing IndexNow + Google Indexing API

  --url <url>        one URL to submit (repeatable)
  --from-file <f>    newline-separated URL list
  --dry-run          build & print payloads, do NOT send
  --help`);
}

// ----------------------------------------------------------------------------
// Bing IndexNow (Bing + Yandex both consume IndexNow)
// ----------------------------------------------------------------------------
async function submitBingIndexNow(urls, dryRun) {
  const key = process.env.BING_INDEXNOW_KEY;
  if (!key) {
    console.log('  · Bing IndexNow: BING_INDEXNOW_KEY not set — skipped');
    return { sent: 0 };
  }
  const keyLocation = process.env.BING_INDEXNOW_KEY_LOCATION || `${BASE}/${key}.txt`;
  const payload = { host: SITE, key, keyLocation, urlList: urls };
  if (dryRun) {
    console.log('  [DRY] Bing IndexNow POST https://api.indexnow.org/indexnow');
    console.log('        ' + JSON.stringify(payload));
    return { sent: urls.length };
  }
  // Bing + Yandex endpoints accept the identical payload
  const endpoints = ['https://api.indexnow.org/indexnow', 'https://yandex.com/indexnow'];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const body = await res.text();
      if (res.ok || res.status === 202) console.log(`  ✓ IndexNow accepted by ${new URL(ep).host} (${res.status})`);
      else console.error(`  ✗ IndexNow ${new URL(ep).host} -> ${res.status} ${body.slice(0, 160)}`);
    } catch (e) {
      console.error(`  ✗ IndexNow ${ep} -> ${e.message}`);
    }
  }
  return { sent: urls.length };
}

// ----------------------------------------------------------------------------
// Google service-account JWT (RS256, zero external deps)
// ----------------------------------------------------------------------------
function loadServiceAccount() {
  const inline = process.env.GOOGLE_SA_JSON;
  const p = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) return JSON.parse(inline);
  if (p && fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  return null;
}
function googleJWT(sa) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(enc(header) + '.' + enc(claim));
  sign.end();
  const sig = sign.sign(sa.private_key, 'base64url');
  return enc(header) + '.' + enc(claim) + '.' + sig;
}
async function googleToken(sa, dryRun) {
  if (dryRun) return 'DRY_RUN_TOKEN';
  const assertion = googleJWT(sa);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error('OAuth token failed: ' + (await res.text()).slice(0, 200));
  return (await res.json()).access_token;
}

// ----------------------------------------------------------------------------
// Google Indexing API
// ----------------------------------------------------------------------------
async function submitGoogleIndexing(urls, token, dryRun) {
  if (dryRun) {
    console.log(`  [DRY] Google Indexing API would publish ${urls.length} URL(s) as URL_UPDATED`);
    return { ok: urls.length, fail: 0 };
  }
  const endpoint = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
  let ok = 0, fail = 0;
  for (const url of urls) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type: 'URL_UPDATED' }),
      });
      if (res.ok) { ok++; console.log(`  ✓ Google ${url}`); }
      else { fail++; console.error(`  ✗ Google ${url} -> ${res.status} ${(await res.text()).slice(0, 160)}`); }
    } catch (e) { fail++; console.error(`  ✗ Google ${url} -> ${e.message}`); }
    // tiny spacing to be gentle on the API
    await new Promise((r) => setTimeout(r, 200));
  }
  return { ok, fail };
}

// ----------------------------------------------------------------------------
// Google sitemap ping (official general-submission path)
// ----------------------------------------------------------------------------
async function pingGscSitemap(dryRun) {
  const u = `https://www.google.com/ping?sitemap=${encodeURIComponent(BASE + '/sitemap.xml')}`;
  if (dryRun) { console.log('  [DRY] GSC sitemap ping: ' + u); return; }
  try {
    const res = await fetch(u);
    console.log(`  ${res.ok ? '✓' : '✗'} GSC sitemap ping -> ${res.status}`);
  } catch (e) { console.error(`  ✗ GSC sitemap ping -> ${e.message}`); }
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);
  let urls = args.urls.slice();
  if (args.file) {
    urls = urls.concat(
      fs.readFileSync(args.file, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
    );
  }
  urls = [...new Set(urls)];
  if (!urls.length) {
    console.error('No URLs provided. Use --url <url> or --from-file <file>.');
    process.exit(2);
  }
  console.log(`\n== Submit ${urls.length} URL(s) ${args.dryRun ? '(DRY-RUN)' : ''} ==`);

  await submitBingIndexNow(urls, args.dryRun);

  const sa = loadServiceAccount();
  if (sa) {
    const token = await googleToken(sa, args.dryRun);
    await submitGoogleIndexing(urls, token, args.dryRun);
  } else if (!args.dryRun) {
    console.log('  · Google Indexing API: GOOGLE_SERVICE_ACCOUNT_JSON not set — skipped (rely on sitemap ping)');
  }

  await pingGscSitemap(args.dryRun);
  console.log('== done ==\n');
}
main().catch((e) => { console.error(e); process.exit(1); });
