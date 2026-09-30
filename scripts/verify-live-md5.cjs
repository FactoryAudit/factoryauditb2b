#!/usr/bin/env node
/**
 * scripts/verify-live-md5.cjs —— 部署落地硬判据（RELEASE-RULES.md 规则 5）
 *
 * 判据：md5(线上响应体) === md5(.next/server/app/** 预渲染产物)
 *
 * 为什么需要这一层（探针 PASS 不够）：
 *   「探针 PASS」证明的是**内容对不对**；本判据证明的是**发出去的就是这次构建的那份**。
 *   当链路上有边缘缓存（本站预渲染产物带 `s-maxage=31536000`，理论可缓存一年）、
 *   回源、CDN 时，探针完全可能在**旧版本**上 PASS —— 只要新内容是旧内容的超集
 *   （改文案、加区块、加 FAQ 都属于超集），旧版页面对新断言照样命中。
 *   md5 逐字节相等一次性排除这种假绿灯。
 *
 * 前提（必须成立，否则本判据无意义）：
 *   1. `.next/server/app/**` 就是**本次部署的那份构建**。
 *      `scripts/release.sh` 第 3 行开头会把 `.next` / `.open-next` 整体改名隔离后重建，
 *      链路跑完时 `.next` 即本次产物 —— 所以**部署后立刻**跑才对得上。
 *   2. 目标路由是**预渲染 / ISR 静态产物**。`force-dynamic` 路由（如 `/industrial-clusters`、
 *      后台、API）每请求现渲染，字节天然不同，**不适用本判据**（探针那层管它们）。
 *   3. 对比基准只能是 `.next/server/app` 下的静态 `*.html` 产物。
 *      `.open-next/cache` 下是增量缓存的 **JSON 包装**（`*.cache` 而非裸 HTML），不能直接对拍。
 *
 * ⚠️ 写本文件时踩过的坑：块注释里**不能出现** glob 的「星号 + 斜杠」组合，
 *   它会提前闭合注释导致 SyntaxError。因此注释里一律写作「`.../app` 下的 `*.html`」。
 *
 * 用法：
 *   node scripts/verify-live-md5.cjs                          # 默认关键路由集（12 条）
 *   node scripts/verify-live-md5.cjs /terms /pricing          # 指定路由（不带前导斜杠亦可：terms）
 *   node scripts/verify-live-md5.cjs --all-locales /terms     # 展开为 9 语
 *   node scripts/verify-live-md5.cjs --retries=6 --delay=20000
 *   node scripts/verify-live-md5.cjs --allow-skip             # 缺产物降级为 SKIP（不推荐）
 *   node scripts/verify-live-md5.cjs --via=fetch              # curl 不可用时改用 node fetch
 *
 * ⚠️ Git Bash / MSYS 下 `/terms` 这类**参数**会被改写成 `<MSYS 根>/terms`。
 *   本脚本按「最长存在后缀」自动还原并打印一行提示；要彻底避免可先 `export MSYS_NO_PATHCONV=1`。
 *
 * 输出契约（可被 release.sh grep）：
 *   全部对拍通过 → 末行 `LIVE_MD5_OK`，exit 0
 *   任一对拍失败 → 末行 `LIVE_MD5_MISMATCH`，exit 1
 *
 * 退出码：
 *   0 = 全部一致    1 = 有 MISMATCH / 无可比对项    2 = 参数或环境错误
 *
 * 注：线上侧一律用 `execFileSync('curl', [...])`（`--noproxy '*'`）而**不用 node fetch** ——
 *   release.sh 会 export NODE_OPTIONS=--require with-proxy.cjs，把全局 fetch 指向 7897；
 *   而本机环境预置的 HTTPS_PROXY=:5701 会劫持直连。用 curl 显式 --noproxy 绕开两者，
 *   且 execFileSync 不经过 shell ⇒ 也不会踩 MSYS 的 `*` 展开 / 路径转换。
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.FAB2B_BASE_URL || 'https://factoryauditb2b.com';
const LOCALES = ['en', 'zh', 'zh-TW', 'ja', 'es', 'de', 'fr', 'pt', 'ar'];

/** 默认关键路由集：都为预渲染产物（应始终静态）+ 覆盖历次改动热点。
 *  这份清单不只是「对拍对象」，还是一条**不变量**：这些路由必须保持预渲染。
 *  其中 `/industrial-clusters` 曾是 `force-dynamic`（stage1.8 改为预渲染）——
 *  它一旦被改回动态渲染，在 CF Workers 免费额度下就是 5xx / 1102 的隐患。 */
const DEFAULT_TARGETS = [
  '/',
  '/pricing',
  '/terms',
  '/privacy',
  '/countries',
  '/countries/thailand',
  '/suppliers',
  '/industrial-clusters',
  '/trust',
  '/monitoring',
  '/rfq',
  '/custom-services',
  '/services/inspection',
];

// ── 参数解析 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = { retries: 4, delay: 15000, allLocales: false, allowSkip: false, via: 'curl', json: false };
const targets = [];
for (const a of argv) {
  if (a === '--all-locales') opts.allLocales = true;
  else if (a === '--allow-skip') opts.allowSkip = true;
  else if (a === '--json') opts.json = true;
  else if (a.startsWith('--retries=')) opts.retries = Number(a.slice(10));
  else if (a.startsWith('--delay=')) opts.delay = Number(a.slice(8));
  else if (a.startsWith('--via=')) opts.via = a.slice(6);
  else if (a === '-h' || a === '--help') {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').replace(/^ \* ?/gm, ''));
    process.exit(0);
  } else if (a.startsWith('-')) {
    console.error(`未知参数：${a}`);
    process.exit(2);
  } else targets.push(a);
}
const usingDefaults = targets.length === 0;
if (usingDefaults) targets.push(...DEFAULT_TARGETS);
if (!Number.isFinite(opts.retries) || opts.retries < 1) opts.retries = 1;
if (!Number.isFinite(opts.delay) || opts.delay < 0) opts.delay = 0;

// ── 线上路径 → 预渲染产物路径 ───────────────────────────────────────────────
/**
 * 映射规则（实测自 `.next/server/app` 布局）：
 *   `/`                → `.next/server/app/en.html`
 *   `/ar`              → `.next/server/app/ar.html`
 *   `/terms`           → `.next/server/app/en/terms.html`   （en 走无前缀规范址）
 *   `/ar/terms`        → `.next/server/app/ar/terms.html`
 *   `/zh-TW/pricing`   → `.next/server/app/zh-TW/pricing.html`
 */
function artifactFor(livePath) {
  const clean = livePath.split('?')[0].split('#')[0];
  const segs = clean.split('/').filter(Boolean);
  const hasPrefix = segs.length && LOCALES.includes(segs[0]);
  const loc = hasPrefix ? segs.shift() : 'en';
  const rel = segs.join('/');
  return path.join(ROOT, '.next', 'server', 'app', rel ? `${loc}/${rel}.html` : `${loc}.html`);
}

function normalize(p) {
  if (!p) return '/';
  let s = p.split('?')[0];
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s;
}

/**
 * 把命令行参数还原成真实路由。
 *
 * 为什么需要：在 Git Bash / MSYS 下，形如 `/trust` 的**参数**会被自动改写成
 * `<MSYS 安装根>/trust`（即 `C:/.../PortableGit/versions/x.y.z/trust`）——
 * 与本项目已知的 MSYS 路径转换坑同源，但发生在**参数**上而不是命令串里，
 * 因此 `execFileSync` 也挡不住（改写发生在 node 收到 argv 之前）。
 * 对策：按「最长存在后缀」还原。因为本站路由都是 '/' 起头的路径，
 * 逐个去掉前导段直到命中已有预渲染产物，得到的即原路由，且**唯一**。
 * 想避免还原动作可设 `MSYS_NO_PATHCONV=1`。
 */
function resolveTarget(raw) {
  const asIs = normalize(raw);
  if (fs.existsSync(artifactFor(asIs))) return { path: asIs, recovered: false };
  const segs = raw.split(/[\\/]+/).filter(Boolean);
  for (let k = 1; k < segs.length; k++) {
    const cand = '/' + segs.slice(k).join('/');
    if (fs.existsSync(artifactFor(cand))) return { path: cand, recovered: true, from: raw };
  }
  return { path: asIs, recovered: false };
}

// ── 线上取字节（curl 直连，proxy-safe） ─────────────────────────────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fab2b-md5-'));

function fetchViaCurl(url, outFile) {
  const code = execFileSync(
    'curl',
    [
      '-sS',
      '--noproxy', '*',
      '--max-time', '45',
      '-H', 'Cache-Control: no-cache',
      '-H', 'Pragma: no-cache',
      '-H', 'Accept-Encoding: identity',
      '-o', outFile,
      '-w', '%{http_code}',
      url,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  const buf = fs.readFileSync(outFile);
  return { status: Number(code), buf };
}

async function fetchViaFetch(url, outFile) {
  const r = await fetch(url, {
    headers: { 'cache-control': 'no-cache', 'accept-encoding': 'identity', 'user-agent': 'fab2b-md5/1.0' },
    redirect: 'manual',
  });
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(outFile, buf);
  return { status: r.status, buf };
}

function curlAvailable() {
  try {
    execFileSync('curl', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 主流程 ──────────────────────────────────────────────────────────────────
(async function main() {
  const expanded = [];
  for (const t of targets) {
    const r = resolveTarget(t);
    if (r.recovered) {
      console.log(`[md5] 参数 ${t} 被 MSYS 改写，已按最长存在后缀还原为 ${r.path}（如要避免请设 MSYS_NO_PATHCONV=1）`);
    }
    const n = r.path;
    expanded.push(n);
    if (opts.allLocales && !LOCALES.includes(n.split('/').filter(Boolean)[0] || '')) {
      for (const loc of LOCALES) if (loc !== 'en') expanded.push(normalize(`/${loc}${n === '/' ? '' : n}`));
    }
  }
  const list = [...new Set(expanded)];

  const via = opts.via === 'fetch' ? 'fetch' : curlAvailable() ? 'curl' : 'fetch';
  if (opts.via === 'curl' && via === 'fetch') {
    console.warn('[md5] curl 不可用，回退 node fetch（注意：若 NODE_OPTIONS 注入了 with-proxy.cjs，会走代理）');
  }

  console.log('=== 落地对拍：md5(线上响应体) == md5(.next/server/app 预渲染产物) ===');
  console.log(`  基准 URL   ${BASE}`);
  console.log(`  对比基准   .next/server/app/**/*.html`);
  console.log(`  线上通道   ${via}${via === 'curl' ? " (--noproxy '*')" : ''}`);
  console.log(`  目标       ${list.length} 条${usingDefaults ? '（默认关键路由集）' : '（命令行指定）'} · 重试 ${opts.retries} 次 × ${opts.delay}ms`);
  console.log('');

  const results = [];
  let okCount = 0, skipCount = 0, failCount = 0;

  for (let i = 0; i < list.length; i++) {
    const live = list[i];
    const artifact = artifactFor(live);
    const relArtifact = path.relative(ROOT, artifact).split(path.sep).join('/');
    const tag = `[${String(i + 1).padStart(2, ' ')}/${list.length}] ${live.padEnd(30, ' ')}`;

    if (!fs.existsSync(artifact)) {
      // 默认集里的目标**应当总有预渲染产物**；缺失 ⇒ 该路由已变成动态渲染（回归）。
      const isDefault = DEFAULT_TARGETS.includes(live);
      if (usingDefaults && isDefault && !opts.allowSkip) {
        failCount++;
        results.push({ live, status: 'NO_ARTIFACT', artifact: relArtifact });
        console.log(`${tag} FAIL      该路由无预渲染产物 ⇒ 已变为动态渲染（默认集应为静态）`);
      } else {
        skipCount++;
        results.push({ live, status: 'SKIP', artifact: relArtifact });
        console.log(`${tag} skip      ${relArtifact} 不存在（动态路由 / 未预渲染）`);
      }
      continue;
    }

    const localBuf = fs.readFileSync(artifact);
    const localMd5 = md5(localBuf);
    const outFile = path.join(tmpDir, `r${i}.bin`);

    let last = null;
    for (let attempt = 1; attempt <= opts.retries; attempt++) {
      const url = `${BASE}${live}${live.includes('?') ? '&' : '?'}md5cb=${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
      let got = null;
      try {
        got = via === 'curl' ? fetchViaCurl(url, outFile) : await fetchViaFetch(url, outFile);
      } catch (e) {
        last = { status: 0, err: e.message, md5: null, size: 0 };
        if (attempt < opts.retries) { console.log(`${tag} retry ${attempt}/${opts.retries}  取数失败：${String(e.message).slice(0, 90)}`); await sleep(opts.delay); continue; }
        break;
      }
      const liveMd5 = md5(got.buf);
      last = { status: got.status, md5: liveMd5, size: got.buf.length };
      if (got.status === 200 && liveMd5 === localMd5) break;
      if (attempt < opts.retries) {
        const why = got.status !== 200 ? `HTTP ${got.status}` : `md5 ${liveMd5.slice(0, 8)}≠${localMd5.slice(0, 8)}`;
        console.log(`${tag} retry ${attempt}/${opts.retries}  ${why}（传播窗口内，${opts.delay}ms 后重试）`);
        await sleep(opts.delay);
      }
    }

    if (last && last.status === 200 && last.md5 === localMd5) {
      okCount++;
      results.push({ live, status: 'OK', md5: localMd5, size: localBuf.length, artifact: relArtifact });
      console.log(`${tag} ok        md5=${localMd5}  size=${localBuf.length}  (${relArtifact})`);
    } else {
      failCount++;
      results.push({
        live, status: 'MISMATCH', artifact: relArtifact,
        liveMd5: last && last.md5, localMd5, liveSize: last && last.size, localSize: localBuf.length,
        httpStatus: last && last.status, err: last && last.err,
      });
      const detail = last && last.err
        ? `取数失败：${last.err}`
        : last && last.status !== 200
          ? `HTTP ${last.status}`
          : `live md5=${String(last && last.md5).slice(0, 12)}… size=${last && last.size} / local md5=${localMd5.slice(0, 12)}… size=${localBuf.length}`;
      console.log(`${tag} MISMATCH  ${detail}`);
      console.log(`${' '.repeat(tag.length)}            基准 ${relArtifact}`);
    }
  }

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  const compared = okCount + failCount;
  console.log('');
  console.log('--- 汇总 ---');
  console.log(`  对拍通过 ${okCount} / ${compared}${skipCount ? `   跳过 ${skipCount}（无预渲染产物）` : ''}`);

  if (failCount) {
    console.log('');
    console.log('LIVE_MD5_MISMATCH');
    console.log('  失败路由：');
    for (const r of results.filter((x) => x.status === 'MISMATCH' || x.status === 'NO_ARTIFACT')) {
      console.log(`    ${r.live.padEnd(30)} ${r.status === 'NO_ARTIFACT' ? '无预渲染产物（路由已变动态？）' : `http=${r.httpStatus} live=${String(r.liveMd5).slice(0, 12)}… local=${String(r.localMd5).slice(0, 12)}…`}`);
    }
    console.log('  诊断顺序（先便宜后昂贵）：');
    console.log('    ① 传播窗口：部署刚返回时边缘仍可能命中上一版 ⇒ 加大 --retries/--delay 复跑。');
    console.log('    ② 该路由并非预渲染：带 Set-Cookie 或每请求现渲染 ⇒ 不适用本判据，改用内容探针。');
    console.log('    ③ `.next` 与本次部署不是同一份构建：是否在 deploy 之后又跑过 build/清理？');
    console.log('      （判据：`.next` 必须在部署前生成、部署后未被改动。）');
    console.log('    ④ 部署没真正覆盖：比对 Version ID 与 `.open-next/DEPLOYED_VERSION`。');
    if (opts.json) console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }
  if (compared === 0) {
    console.log('');
    console.log('LIVE_MD5_MISMATCH');
    console.log('  没有任何一条完成对拍（全部 SKIP）—— 该结果不构成「已落地」的证据。');
    if (opts.json) console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }
  console.log('');
  console.log('LIVE_MD5_OK');
  if (opts.json) console.log(JSON.stringify(results, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error('[md5] 运行异常：', e && e.stack ? e.stack : e);
  process.exit(2);
});
