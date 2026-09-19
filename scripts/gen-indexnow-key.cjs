#!/usr/bin/env node
'use strict';
/*
 * gen-indexnow-key.cjs — generate + host the Bing IndexNow key file.
 *
 * Bing IndexNow REQUIRES the key to be hosted at https://<SITE>/<KEY>.txt
 * (the bare key as file content). Without it, every submission is rejected.
 * This script makes that happen locally so the next build/deploy serves it.
 *
 * Behaviour (idempotent — never clobbers an existing key):
 *   1. If BING_INDEXNOW_KEY is already set (.env), reuse it.
 *   2. Else if public/<hex>.txt already exists, reuse that key.
 *   3. Else generate a random 32-hex key, write public/<KEY>.txt, sync .env.
 *
 * Usage:  node scripts/gen-indexnow-key.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const ENVFILE = path.join(ROOT, '.env');
const SITE = process.env.SITE_HOST || 'factoryauditb2b.com';

function loadEnv() {
  if (!fs.existsSync(ENVFILE)) return {};
  const out = {};
  for (const line of fs.readFileSync(ENVFILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
function syncEnv(key) {
  const env = loadEnv();
  if (env.BING_INDEXNOW_KEY === key) {
    console.log('  · .env BING_INDEXNOW_KEY already matches — no change.');
    return;
  }
  let content = fs.existsSync(ENVFILE) ? fs.readFileSync(ENVFILE, 'utf8') : '';
  if (/^\s*BING_INDEXNOW_KEY\s*=/m.test(content)) {
    content = content.replace(/^\s*BING_INDEXNOW_KEY\s*=.*$/m, `BING_INDEXNOW_KEY="${key}"`);
  } else {
    content += `\n# ---- Bing IndexNow (auto-managed by scripts/gen-indexnow-key.cjs) ----\nBING_INDEXNOW_KEY="${key}"\n`;
  }
  fs.writeFileSync(ENVFILE, content);
  console.log('  · wrote BING_INDEXNOW_KEY into .env');
}

function findExistingKeyFile() {
  if (!fs.existsSync(PUBLIC)) return null;
  for (const f of fs.readdirSync(PUBLIC)) {
    const m = f.match(/^([a-f0-9]{8,64})\.txt$/i);
    if (m) return m[1];
  }
  return null;
}

function main() {
  const env = loadEnv();
  let key = env.BING_INDEXNOW_KEY || '';

  if (!key) key = findExistingKeyFile();
  if (!key) key = crypto.randomBytes(16).toString('hex'); // 32 hex chars

  // ensure public dir + write the hosted key file (content = the key itself)
  if (!fs.existsSync(PUBLIC)) fs.mkdirSync(PUBLIC, { recursive: true });
  const file = path.join(PUBLIC, `${key}.txt`);
  fs.writeFileSync(file, key);
  console.log(`\n[indexnow] key file written: public/${key}.txt`);
  console.log(`[indexnow] will be served at: https://${SITE}/${key}.txt`);

  syncEnv(key);
  console.log(`\n[indexnow] done. Rebuild + deploy so the file goes live, then submissions will be accepted by Bing/Yandex.`);
}
main();
