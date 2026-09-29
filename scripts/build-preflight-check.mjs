#!/usr/bin/env node
// scripts/build-preflight-check.mjs —— 构建**前置**闸门
//
// ─────────────────────────────────────────────────────────────────────────────
// 为什么需要这个脚本（2026-09-29 事故复盘）
//
//   `next build` 的数据源失败**不会**报错。`lib/queries.ts` 的设计是
//   「Supabase 查不到 → 静默回落 `lib/staticData.ts` 的 STATIC_SUPPLIERS」，
//   于是：
//     · 供应商 11 家 → 4 家
//     · `/suppliers/<slug>` 预渲染产物 99 篇 → 36 篇（其余 slug `notFound()`，不落 .html）
//     · `next build` **EXIT 仍为 0**，日志里只留一行
//       `[queries] suppliers query failed TypeError: fetch failed`
//
//   本次事故的真实数据：日志 1 行 `query failed`，产物 92 篇（应为 99），
//   `en` 目录只剩 4 篇 —— **恰好等于 STATIC_SUPPLIERS 的条数**，这是回退的铁证。
//   事故的根因不是网络，而是「构建链路里没有人在动手前先确认数据源活着」。
//
// 本脚本要做的事（动手前，而不是动手后）：
//   1. 按 `lib/queries.ts` 的 `useSupabase()` 同一套口径判定本次构建的数据源模式；
//   2. 走**与构建完全相同**的代理链路，对 Supabase 发一次真实的 REST 查询；
//   3. 查不通 ⇒ 打印「数据源失败，中止构建」并以 **exit 1** 结束（fail-closed）；
//   4. 查得通 ⇒ 打印本次构建应有的页数基线，供构建后逐字比对。
//
// 输出契约（可被外层脚本 grep）：
//   成功：`EXPECTED_SUPPLIERS=<n>, EXPECTED_GUIDES=<m>`   （exit 0）
//   失败：含子串 `数据源失败，中止构建`                    （exit 1）
//
// 下游配对：成功时会把期望值落盘到 `.tmp/preflight-baseline.json`，
//   第 1.5 步 `scripts/build-postflight-check.mjs` 读它来断言实际产物页数。
//   （`.tmp/` 已在 .gitignore 第 64 行忽略 ⇒ 不会污染工作树。）
//   ⚠️ 基线文件必须在 `.next/` **之外**：九步链路会先把 `.next` 改名挪走再重建。
//
// 在九步链路里的位置：
//   第 0 步   ★ 本文件：数据源通不通？→ 算出 EXPECTED_*（并落盘基线）
//   第 1 步   next build 2>&1 | tee outputs/_next_$(date +%Y%m%d%H%M%S).log
//   第 1.5 步 build-postflight-check.mjs --log <上一步日志>
//   ...
//   ⚠️ 第 1 步的日志名**带时间戳**是刻意约定：第 1.5 步在没显式传 `--log` 时会
//      自动挑选 `outputs/` 下最新的 next|build 日志；带时间戳的名字能唯一确定
//      「本次构建」，不会被 `_g42_build1.log` 这类历史日志抢走。
//
// 用法：
//   node scripts/build-preflight-check.mjs
//   FAB2B_PROXY=http://127.0.0.1:9999 node scripts/build-preflight-check.mjs   # 模拟数据源失败
//
// ⚠️ 代理口径与 `scripts/with-proxy.cjs` **必须保持一致**（同一默认端口 7897、
//    同样忽略被劫持的 HTTPS_PROXY）。这里**不复用** with-proxy.cjs，因为它只在
//    `NODE_OPTIONS=--require` preload 场景下生效；本脚本要能**裸跑**（用户直接
//    `node scripts/build-preflight-check.mjs`），所以自己装 dispatcher。
//    ⚠️ 改这里时务必同步改 with-proxy.cjs，否则"闸门说通、构建却回落"。
//
// ⚠️ 期望值全部**动态求取**，一个都不写死：
//    · EXPECTED_SUPPLIERS ← Supabase `suppliers where is_published=true`（实时行数）
//    · EXPECTED_GUIDES    ← `lib/guides.ts` 的 `GUIDES.length`（经 esbuild 取真值）
//    · 语种数              ← `i18n/config.ts` 的 `LOCALES.length`
//    写死过日子的断言就是"下次改数据时假 FAIL"的来源（见 cs14 的 A2/A3）。
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// 与 scripts/with-proxy.cjs 保持逐字一致的默认值
const DEFAULT_PROXY = "http://127.0.0.1:7897";

const ATTEMPTS = 3; // 首次 + 2 次重试：事故当天是「网关瞬时 401」，一次抖动不该拦发布
const RETRY_DELAY_MS = [0, 800, 1600];
const TIMEOUT_MS = 12_000;

const FAIL_PHRASE = "数据源失败，中止构建";

/** 基线落盘位置：必须在 `.next/` 之外（九步链路会把 `.next` 改名挪走再重建）。 */
const BASELINE_FILE = path.join(ROOT, ".tmp", "preflight-baseline.json");

/**
 * 把本次构建的期望值落盘，供第 1.5 步 `build-postflight-check.mjs` 读取。
 * 写失败**不影响**闸门结论（stdout 契约仍成立），只降级为告警。
 */
function writeBaseline(payload) {
  try {
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + "\n", "utf8");
    console.log(
      `[preflight] 已落盘基线：${path.relative(ROOT, BASELINE_FILE)}（供第 1.5 步 build-postflight-check.mjs 读取）`,
    );
    // 手工执行时最容易漏掉第 1.5 步 —— 把「谁在读这个文件」打在成功输出的最后一行。
    console.log(
      `[preflight] ▶ 下一步（第 1.5 步）跑 \`node scripts/build-postflight-check.mjs --log outputs/_next_<时间戳>.log\` ` +
        `时会读这个基线；**第 1.5 步不得跳过**。`,
    );
  } catch (e) {
    console.log(`[preflight] ⚠️ 基线落盘失败（${e.message}）—— 第 1.5 步需显式传 --expected-*`);
  }
}

// ────────────────────────────── 1. 读 .env ──────────────────────────────
//
// 本机 `node` 裸跑不会自动读 .env（仓库里其它脚本靠 `node --env-file=.env`）。
// 这里自己读，保证「用户敲的就是命令本身」也能跑通。
function loadDotEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!raw || /^\s*#/.test(raw)) continue;
    const m = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const fileEnv = loadDotEnv(path.join(ROOT, ".env"));
/** 进程环境优先（允许 `SUPPLIER_DATA_SOURCE=static node …` 这样临时覆盖），其次 .env。 */
const getEnv = (k) => (process.env[k]?.trim() || fileEnv[k] || "").trim();

// ────────────────────────────── 2. 装代理 ──────────────────────────────
//
// 与 with-proxy.cjs 同一决策表：FAB2B_PROXY > (信任环境代理) > 默认 7897。
// 本机存在一个 **不转发 supabase** 的 HTTPS_PROXY=127.0.0.1:5701，
// 旧脚本曾因按环境变量取值而被劫持 ⇒ 又一次静默回落（209 次 fetch failed）。
async function installProxy() {
  const ambient =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    "";
  const url =
    process.env.FAB2B_PROXY ||
    (process.env.FAB2B_TRUST_ENV_PROXY === "1" ? ambient : "") ||
    DEFAULT_PROXY;

  if (ambient && ambient !== url) {
    console.log(
      `[preflight] 已忽略环境里的代理变量 ${ambient}（本机已知它不转发 supabase）；` +
        `如确需使用请显式设 FAB2B_PROXY=${ambient}`,
    );
  }

  try {
    const { setGlobalDispatcher, ProxyAgent } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(url));
    return url;
  } catch (e) {
    console.log(`[preflight] ⚠️ 未启用代理（${e.message}）——将直连；请确认 node_modules/undici 存在`);
    return null;
  }
}

// ──────────────────── 3. 取「静态常量」的真值（esbuild） ────────────────────
//
// 不写死 47 / 9：直接 import 真实模块求 length。esbuild 的用法与本仓库
// `scripts/run-regression.mjs` 一致（本机 Git Bash 缺 sed/dirname，
// `.bin/esbuild` 的 shim 跑不起来，必须走 JS API）。
async function loadConstants() {
  const { build } = await import("esbuild");
  const res = await build({
    stdin: {
      contents: [
        'import { LOCALES } from "./i18n/config";',
        'import { GUIDES } from "./lib/guides";',
        'import { STATIC_SUPPLIERS } from "./lib/staticData";',
        "export const LOCALE_COUNT = LOCALES.length;",
        "export const GUIDE_COUNT = GUIDES.length;",
        "export const STATIC_SUPPLIER_COUNT = STATIC_SUPPLIERS.length;",
      ].join("\n"),
      resolveDir: ROOT,
      sourcefile: "preflight-consts.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const js = res.outputFiles[0].text;
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(js, "utf8").toString("base64")
  );
  return {
    localeCount: mod.LOCALE_COUNT,
    guideCount: mod.GUIDE_COUNT,
    staticSupplierCount: mod.STATIC_SUPPLIER_COUNT,
  };
}

// ─────────────────────── 4. 真实打一次数据源 ───────────────────────
async function queryOnce(url, key) {
  const endpoint = `${url.replace(/\/+$/, "")}/rest/v1/suppliers?select=slug&is_published=eq.true`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    const body = await r.text();
    if (!r.ok) {
      return { ok: false, reason: `HTTP ${r.status} ${body.slice(0, 240)}` };
    }
    const rows = JSON.parse(body);
    if (!Array.isArray(rows)) {
      return { ok: false, reason: `响应不是数组：${body.slice(0, 160)}` };
    }
    return { ok: true, count: rows.length };
  } catch (e) {
    const cause = e?.cause?.message ? ` / ${e.cause.message}` : "";
    const code = e?.cause?.code ? ` [${e.cause.code}]` : "";
    return { ok: false, reason: `${e.message}${cause}${code}` };
  } finally {
    clearTimeout(timer);
  }
}

async function queryWithRetry(url, key) {
  let last = { ok: false, reason: "未执行" };
  for (let i = 0; i < ATTEMPTS; i++) {
    if (RETRY_DELAY_MS[i]) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS[i]));
    last = await queryOnce(url, key);
    if (last.ok) return { ...last, attempts: i + 1 };
    console.log(`[preflight] 第 ${i + 1}/${ATTEMPTS} 次查询失败：${last.reason}`);
  }
  return { ...last, attempts: ATTEMPTS };
}

// ────────────────────────────── 5. 主流程 ──────────────────────────────
function abort(reason) {
  console.error("");
  console.error(`❌ ${FAIL_PHRASE}`);
  console.error(`   原因：${reason}`);
  console.error("");
  console.error("   `next build` 不会因数据源失败而报错 —— 它会静默回落到");
  console.error("   lib/staticData.ts 的内置常量并**照常 EXIT 0**，产出缺页的坏站点。");
  console.error("   请先修好数据源（或显式设 SUPPLIER_DATA_SOURCE=static）再构建。");
  process.exit(1);
}

async function main() {
  const mode = getEnv("SUPPLIER_DATA_SOURCE").toLowerCase();
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  // ---- 常量（不依赖网络，先取，便于失败信息里带上下文）----
  let consts;
  try {
    consts = await loadConstants();
  } catch (e) {
    return abort(`无法从源码求取期望值（esbuild 取 GUIDES/LOCALES 失败）：${e.message}`);
  }
  const { localeCount, guideCount, staticSupplierCount } = consts;

  // ---- 模式判定：与 lib/queries.ts 的 useSupabase() 逐条对齐 ----
  //   static                → 强制静态常量（构建**有意**不用库）
  //   supabase / 未设置      → 只有 service_role 配齐才走库，否则回落静态
  const adminConfigured = Boolean(url && key);
  const useSupabase = mode === "static" ? false : adminConfigured;

  if (!useSupabase) {
    if (mode === "static" && process.env.FAB2B_PREFLIGHT_ALLOW_STATIC !== "1") {
      // 有意走静态不是"故障"，但它是本次事故的形态 ⇒ 必须显式确认，绝不默认放行。
      return abort(
        `SUPPLIER_DATA_SOURCE=static：本次构建将使用内置静态常量（${staticSupplierCount} 家），` +
          `而非数据库。${staticSupplierCount} × ${localeCount} = ${staticSupplierCount * localeCount} 页，` +
          `与线上现状不符。如确为有意，请设 FAB2B_PREFLIGHT_ALLOW_STATIC=1 后重跑。`,
      );
    }
    if (mode !== "static") {
      // 未显式 static 却走不了库 ⇒ 正是 useSupabase() 里 isAdminConfigured() 为假的分支
      return abort(
        `未配齐 Supabase 凭证（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY），` +
          `构建将静默回落到 ${staticSupplierCount} 家静态常量。`,
      );
    }
  }

  if (!useSupabase) {
    // 走到这里只剩一种情况：显式 static 且已用 FAB2B_PREFLIGHT_ALLOW_STATIC=1 确认过。
    console.log(`[preflight] SUPPLIER_DATA_SOURCE=static（已显式允许）—— 期望值取静态常量`);
    console.log(`EXPECTED_SUPPLIERS=${staticSupplierCount}, EXPECTED_GUIDES=${guideCount}`);
    console.log(
      `[preflight] 派生产物基线（构建后逐字比对）：` +
        `/suppliers/*.html=${staticSupplierCount * localeCount}（${staticSupplierCount}×${localeCount}，排除 */claim.html）、` +
        `/guides/*.html=${guideCount * localeCount}（${guideCount}×${localeCount}，-maxdepth 3）`,
    );
    writeBaseline({
      mode: "static",
      expectedSuppliers: staticSupplierCount,
      expectedGuides: guideCount,
      localeCount,
      supplierPages: staticSupplierCount * localeCount,
      guidePages: guideCount * localeCount,
      proxy: null,
      checkedAt: new Date().toISOString(),
    });
    return process.exit(0);
  }

  const proxy = await installProxy();
  const result = await queryWithRetry(url, key);

  if (!result.ok) {
    return abort(
      `Supabase 查询失败（${result.attempts} 次尝试均失败，代理=${proxy ?? "直连"}）：${result.reason}`,
    );
  }
  if (result.count === 0) {
    return abort(
      `Supabase 可达但 suppliers 表 is_published=true 的行为 0 —— ` +
        `查询本身没错，是数据侧异常（构建同样会产出 0 篇档案页）。`,
    );
  }

  const supplierPages = result.count * localeCount;
  const guidePages = guideCount * localeCount;

  console.log(
    `[preflight] 数据源 OK：supabase，is_published=true 共 ${result.count} 行` +
      `（HTTP 200，${result.attempts} 次尝试，代理=${proxy ?? "直连"}）`,
  );
  console.log(`EXPECTED_SUPPLIERS=${result.count}, EXPECTED_GUIDES=${guideCount}`);
  console.log(
    `[preflight] 派生产物基线（构建后逐字比对）：` +
      `/suppliers/*.html=${supplierPages}（${result.count}×${localeCount}，排除 */claim.html）、` +
      `/guides/*.html=${guidePages}（${guideCount}×${localeCount}，-maxdepth 3）`,
  );
  writeBaseline({
    mode: "supabase",
    expectedSuppliers: result.count,
    expectedGuides: guideCount,
    localeCount,
    supplierPages,
    guidePages,
    proxy,
    checkedAt: new Date().toISOString(),
  });
  process.exit(0);
}

await main();
