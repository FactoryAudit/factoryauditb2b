#!/usr/bin/env node
'use strict';
/*
 * verify-webmaster.cjs — automated verification checklist for:
 *   [1] Google Search Console property verification (DNS TXT record via Cloudflare API)
 *   [2] Bing Webmaster Tools API connection (apikey)
 *   [3] Site status + response time (delegates to monitor-site.cjs)
 *
 * Each step prints PASS / FAIL / SKIP. SKIP means the required credential env
 * var is missing (script still runs the rest). Wire this into CI or run after
 * deploy for a printed readiness report.
 *
 * Env:
 *   SITE_HOST                default factoryauditb2b.com
 *   CLOUDFLARE_API_TOKEN     Cloudflare token with Zone:DNS:Read
 *   CLOUDFLARE_ZONE_ID       Cloudflare zone id for the domain
 *   BING_WMT_API_KEY         Bing Webmaster Tools API key
 */

const SITE = process.env.SITE_HOST || 'factoryauditb2b.com';
const { execFileSync } = require('child_process');
const path = require('path');

async function checkGscDns() {
  console.log('\n[1] Google Search Console — DNS verification');
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) {
    console.log('    SKIP: set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID to auto-check the google-site-verification TXT record.');
    console.log('    Manual: in GSC > Settings > Ownership verification, choose "Domain name provider" and add the TXT record it shows.');
    return 'SKIP';
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zone}/dns_records?type=TXT&name=${encodeURIComponent(SITE)}`,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  const j = await res.json();
  const found = (j.result || []).some((r) => /google-site-verification=/.test(r.content));
  if (found) console.log('    PASS: google-site-verification TXT record present in Cloudflare DNS.');
  else console.log('    FAIL: no google-site-verification TXT record found in the zone.');
  return found ? 'PASS' : 'FAIL';
}

async function checkBingWmt() {
  console.log('\n[2] Bing Webmaster Tools — API connection');
  const key = process.env.BING_WMT_API_KEY;
  if (!key) {
    console.log('    SKIP: set BING_WMT_API_KEY to test the API. Get it from Bing WMT > Settings > API Access.');
    return 'SKIP';
  }
  const res = await fetch(
    `https://api.bingwebmastertools.com/v1/webmasters/GetUserSites?apikey=${encodeURIComponent(key)}`,
    { method: 'GET' }
  );
  const t = await res.text();
  if (res.ok) {
    console.log('    PASS: Bing WMT API responded.');
    try {
      const sites = JSON.parse(t);
      const urls = (sites || []).map((s) => s.PublicUrl || s.siteUrl).filter(Boolean);
      console.log('    Sites: ' + (urls.join(', ') || '(none returned)'));
    } catch { /* non-fatal */ }
    return 'PASS';
  }
  console.log(`    FAIL: ${res.status} ${t.slice(0, 200)}`);
  return 'FAIL';
}

function monitor() {
  console.log('\n[3] Site status + response time');
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'monitor-site.cjs')], { stdio: 'inherit', env: process.env });
  } catch {
    /* monitor sets its own exit code on failures; we keep the checklist alive */
  }
}

async function main() {
  console.log(`Webmaster verification checklist — ${SITE}`);
  const a = await checkGscDns();
  const b = await checkBingWmt();
  monitor();
  console.log(`\nRESULT: GSC_DNS=${a}   BING_WMT=${b}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
