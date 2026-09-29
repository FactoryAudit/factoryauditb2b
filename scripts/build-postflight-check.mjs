#!/usr/bin/env node
// scripts/build-postflight-check.mjs —— 第 1.5 步闸门（`next build` 之后、`opennext build` 之前）
//
// ─────────────────────────────────────────────────────────────────────────────
// 在九步链路里的位置：
//
//   第 0 步   build-preflight-check.mjs    数据源通不通？→ 算出 EXPECTED_*（落盘基线）
//   第 1 步   next build 2>&1 | tee outputs/_next_$(date +%Y%m%d%H%M%S).log
//   第 1.5 步 build-postflight-check.mjs   ★ 本文件：产物对不对？日志干不干净？
//   第 2 步   opennext build
//   ...（第 7 步 wrangler deploy）
//
// ⚠️ 第 1 步的日志名**必须带时间戳**（`outputs/_next_20260929215448.log`）。
//   没有 `--log` 时本脚本会在 `outputs/` 里**自动挑选**最新的 next|build 日志；
//   带时间戳的名字能唯一确定「本次构建」，不会被 `_g42_build1.log` / `_g43_next2.log`
//   这类历史日志抢走。挑不到带时间戳的日志时会退回历史命名并**打印告警**（见
//   `resolveBuildLog()`），因为那有拿旧日志做断言的风险（＝假 PASS）。
//
// 为什么必须在第 1.5 步拦：
//   `next build` 的数据源失败**不报错**（见 preflight 头部注释的事故复盘）。
//   真正昂贵的动作在后面 —— `opennext build`（数分钟）+ `populate`（数千文件）+
//   `wrangler deploy`。在第 1 步之后 1 秒就能发现"产物少了一半"，
//   就没必要把整套链路跑完、再部署一个缺页的站点。
//
// 本脚本做三件事（全部**离线**，不碰网络）：
//   ① `/suppliers/*.html`（≤3 层、排除 `*/claim.html`）=== EXPECTED_SUPPLIERS × 语种数
//   ② `/guides/*.html`（≤3 层）=== EXPECTED_GUIDES × 语种数
//   ③ 构建日志里 `[queries] suppliers query failed` / `fetch failed` 必须 0 行
//
// 期望值来源（按优先级，**拿不到就 fail-closed，绝不猜**）：
//   1. `--expected-suppliers N --expected-guides M`（命令行）
//   2. 环境变量 `EXPECTED_SUPPLIERS` / `EXPECTED_GUIDES`
//   3. `.tmp/preflight-baseline.json`（第 0 步 preflight 自动落盘的基线）
//   4. 都没有 ⇒ exit 1
//
// 输出契约（可被外层脚本 grep）：
//   成功：`POSTFLIGHT_OK`        （exit 0）
//   失败：含子串 `构建产物不符`   （exit 1）
//
// 用法：
//   node scripts/build-postflight-check.mjs                              # 读第 0 步的基线 + 自动挑日志
//   node scripts/build-postflight-check.mjs --log outputs/_next_20260929215448.log
//   EXPECTED_SUPPLIERS=11 EXPECTED_GUIDES=47 node scripts/build-postflight-check.mjs
//
// ⚠️ 计数口径必须与 preflight 打印的派生化基线**逐字一致**，改这里要同步改 preflight：
//    · suppliers 必须排除 `*/claim.html`（否则 99 → 198）
//    · guides 必须限 `≤3` 层（否则会把 `guides/category/*` 也算进来，423 → 477）
//
// ⚠️ 三项检查里**第 ③ 项（构建日志）有意排在最前**：数据源失败时它是「因」，
//    页数不符只是「果」；失败块的第一行就是它。
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const APP_DIR_DEFAULT = path.join(ROOT, ".next", "server", "app");
const BASELINE_FILE = path.join(ROOT, ".tmp", "preflight-baseline.json");

// 深度上限：`en` 无前缀（`suppliers/<slug>.html` = 2 段），其余带前缀（`de/suppliers/<slug>.html` = 3 段）。
// 取 3 ⇒ 同时覆盖两者，且天然排除 `de/suppliers/<slug>/claim.html`（4 段）与
// `de/guides/category/<cat>.html`（4 段）。
const MAX_DEPTH = 3;

const FAIL_PHRASE = "构建产物不符";

// ─────────────────────────── 命令行参数 ───────────────────────────
function parseArgs(argv) {
  const out = { expectedSuppliers: null, expectedGuides: null, log: null, appDir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--expected-suppliers") out.expectedSuppliers = Number(next());
    else if (a === "--expected-guides") out.expectedGuides = Number(next());
    else if (a === "--log") out.log = next();
    else if (a === "--app-dir") out.appDir = next();
    else if (a.startsWith("--expected-suppliers=")) out.expectedSuppliers = Number(a.split("=")[1]);
    else if (a.startsWith("--expected-guides=")) out.expectedGuides = Number(a.split("=")[1]);
    else if (a.startsWith("--log=")) out.log = a.split("=")[1];
    else if (a.startsWith("--app-dir=")) out.appDir = a.split("=")[1];
  }
  return out;
}

// ─────────────────── 期望值解析（1 args > 2 env > 3 基线文件） ───────────────────
function readBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return null;
  try {
    return { json: JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")), mtime: fs.statSync(BASELINE_FILE).mtime };
  } catch {
    return null;
  }
}

/** 文件「诞生时间」：NTFS/ext4 上 birthtime≈创建时刻；取不到时退回 ctime/mtime。 */
function statBirth(file) {
  try {
    const s = fs.statSync(file);
    return s.birthtimeMs || s.ctimeMs || s.mtimeMs || null;
  } catch {
    return null;
  }
}

/** 文件最后写入时刻（mtime）：比「诞生时间」更适合判断「这份日志属于哪一次构建」。 */
function statMtime(file) {
  try {
    return fs.statSync(file).mtimeMs || null;
  } catch {
    return null;
  }
}

function resolveExpected(args) {
  const enumOr = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

  // 1. 命令行
  const cliS = enumOr(args.expectedSuppliers);
  const cliG = enumOr(args.expectedGuides);
  if (Number.isFinite(cliS) && Number.isFinite(cliG)) {
    return { expectedSuppliers: cliS, expectedGuides: cliG, source: "命令行参数", baseline: null };
  }

  // 2. 环境变量
  const envS = enumOr(process.env.EXPECTED_SUPPLIERS);
  const envG = enumOr(process.env.EXPECTED_GUIDES);
  if (Number.isFinite(envS) && Number.isFinite(envG)) {
    return { expectedSuppliers: envS, expectedGuides: envG, source: "环境变量", baseline: null };
  }

  // 3. 第 0 步落盘的基线
  const b = readBaseline();
  if (b) {
    const s = enumOr(b.json?.expectedSuppliers);
    const g = enumOr(b.json?.expectedGuides);
    if (Number.isFinite(s) && Number.isFinite(g)) {
      return { expectedSuppliers: s, expectedGuides: g, source: `.tmp/preflight-baseline.json`, baseline: b };
    }
  }

  return null;
}

// ─────────────── 语种数 / 回退常量长度（离线取源码真值） ───────────────
async function loadConsts() {
  const { build } = await import("esbuild");
  const res = await build({
    stdin: {
      contents: [
        'import { LOCALES } from "./i18n/config";',
        'import { STATIC_SUPPLIERS } from "./lib/staticData";',
        "export const LOCALE_COUNT = LOCALES.length;",
        "export const STATIC_SUPPLIER_COUNT = STATIC_SUPPLIERS.length;",
      ].join("\n"),
      resolveDir: ROOT,
      sourcefile: "postflight-consts.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(res.outputFiles[0].text, "utf8").toString("base64")
  );
  return { localeCount: mod.LOCALE_COUNT, staticSupplierCount: mod.STATIC_SUPPLIER_COUNT };
}

// ─────────────────────────── 产物收集与计数 ───────────────────────────
function collectHtmlFiles(dir) {
  const found = [];
  const stack = [{ abs: dir, rel: [] }];
  while (stack.length) {
    const { abs, rel } = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue; // 目录不存在/无权限 ⇒ 该子树计 0，由断言报错
    }
    for (const e of entries) {
      const childRel = [...rel, e.name];
      if (e.isDirectory()) stack.push({ abs: path.join(abs, e.name), rel: childRel });
      else if (e.name.endsWith(".html")) found.push(childRel);
    }
  }
  return found;
}

/** `suppliers/<slug>.html`（≤3 层，排除 claim.html） */
function isSupplierPage(segs) {
  return (
    segs.length >= 2 &&
    segs.length <= MAX_DEPTH &&
    segs[segs.length - 2] === "suppliers" &&
    segs[segs.length - 1] !== "claim.html"
  );
}

/** `guides/<slug>.html`（≤3 层；`guides/category/*` 是 4 层，自动排除） */
function isGuidePage(segs) {
  return segs.length >= 2 && segs.length <= MAX_DEPTH && segs[segs.length - 2] === "guides";
}

// ─────────────────────────── 构建日志（第 ③ 项） ───────────────────────────
const LOG_PATTERNS = [/\[queries\] suppliers query failed/, /fetch failed/];

/**
 * 第 1 步的**标准**日志名（带时间戳）：
 *   `outputs/_next_$(date +%Y%m%d%H%M%S).log` → `outputs/_next_20260929215448.log`
 * 时间戳能唯一确定「本次构建」⇒ 自动挑选时**优先**选它。
 */
const STAMPED_LOG_RE = /(?:^|[^A-Za-z])_?next_(\d{8,14})\.log$/i;
/** 历史遗留命名（`_g42_build1.log` / `_g43_next2.log`）：仍兜底可用，但优先级最低且会告警。 */
const LEGACY_LOG_RE = /(?:^|[^a-z])(next|build)\d*\.log$/i;
/** 第 2 步的日志也以 "next" 收尾（`_g43_opennext.log`）⇒ 必须排除，否则会拿它当构建日志（假 PASS）。 */
const LOG_EXCLUDE_RE = /opennext/i;

/**
 * 找构建日志：`--log` / `BUILD_LOG` > 自动挑选 `outputs/` 下最新的 next|build 日志。
 *
 * 自动挑选的排序键（**先判命名再判时间**）：
 *   ① 带时间戳的标准名 `_next_<ts>.log` 优先；
 *   ② 同组内按 mtime 倒序取最新；
 *   ③ 一组都没有（只存在历史命名）⇒ 退回历史命名，并在调用处打印告警。
 */
function resolveBuildLog(args) {
  const explicit = args.log || process.env.BUILD_LOG;
  if (explicit) {
    if (!fs.existsSync(explicit)) return { file: null, tried: explicit, auto: false };
    return {
      file: explicit,
      auto: false,
      suspect: LOG_EXCLUDE_RE.test(explicit), // 看起来是第 2 步 opennext 的日志
      legacy: !STAMPED_LOG_RE.test(explicit), // 不含时间戳 ⇒ 可能不是本次构建的日志
    };
  }
  const dir = path.join(ROOT, "outputs");
  if (!fs.existsSync(dir)) return { file: null, tried: "outputs/", auto: true };

  const cands = fs
    .readdirSync(dir)
    .filter((n) => !LOG_EXCLUDE_RE.test(n))
    .map((n) => {
      let m = 0;
      try {
        m = fs.statSync(path.join(dir, n)).mtimeMs;
      } catch {
        /* 竞态删除 ⇒ mtime 记 0，排最后 */
      }
      return { n, m, stamped: STAMPED_LOG_RE.test(n), legacy: LEGACY_LOG_RE.test(n) };
    })
    .filter((c) => c.stamped || c.legacy)
    .sort((a, b) => Number(b.stamped) - Number(a.stamped) || b.m - a.m);

  if (!cands.length) {
    return {
      file: null,
      tried: "outputs/_next_<时间戳>.log | outputs/*next*.log | outputs/*build*.log",
      auto: true,
    };
  }
  const picked = cands[0];
  return {
    file: path.join("outputs", picked.n),
    auto: true,
    legacy: !picked.stamped, // 用了历史命名 ⇒ 调用处打印告警（可能不是本次构建的日志）
  };
}

function scanLog(file) {
  const text = fs.readFileSync(file, "utf8");
  const hits = text
    .split(/\r?\n/)
    .map((line, i) => ({ line, no: i + 1 }))
    .filter(({ line }) => LOG_PATTERNS.some((re) => re.test(line)));
  return hits;
}

// ─────────────────────────── 失败出口 ───────────────────────────
function fail(reasons, extra = []) {
  console.error("");
  console.error(`❌ ${FAIL_PHRASE}`);
  for (const r of reasons) console.error(`   · ${r}`);
  for (const e of extra) console.error(`   ${e}`);
  console.error("");
  console.error("   ⛔ 已中止九步链路：**不要**继续第 2 步 `opennext build` / populate / deploy。");
  console.error("      先诊断数据源（第 ③ 项日志最先给出证据），再从第 1 步重跑。");
  process.exit(1);
}

// ─────────────────────────── 主流程 ───────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  // `--app-dir` 只用于自测（合成产物目录）；生产链路一律用 `.next/server/app`。
  const APP_DIR = args.appDir ? path.resolve(ROOT, args.appDir) : APP_DIR_DEFAULT;

  const expected = resolveExpected(args);
  if (!expected) {
    return fail(
      [
        "拿不到期望值（EXPECTED_SUPPLIERS / EXPECTED_GUIDES），无法执行第 ①② 项断言。",
      ],
      [
        `   期望值来源优先级：命令行 > 环境变量 > ${path.relative(ROOT, BASELINE_FILE)}`,
        "   ⇒ 先跑第 0 步：`node scripts/build-preflight-check.mjs`（它会落盘基线），",
        "      或显式传入：`--expected-suppliers 11 --expected-guides 47`。",
      ],
    );
  }

  const consts = await loadConsts();
  const { localeCount, staticSupplierCount } = consts;
  const expSupplierPages = expected.expectedSuppliers * localeCount;
  const expGuidePages = expected.expectedGuides * localeCount;

  console.log(
    `[postflight] 期望值来源 = ${expected.source}：` +
      `EXPECTED_SUPPLIERS=${expected.expectedSuppliers}, EXPECTED_GUIDES=${expected.expectedGuides}`,
  );
  console.log(`[postflight] 语种数 = ${localeCount}（i18n/config.ts）`);

  const reasons = [];
  const extras = [];

  // ---- 产物目录存在性（前置条件；不成立就没必要往下算） ----
  if (!fs.existsSync(APP_DIR)) {
    return fail([`构建产物目录不存在：${path.relative(ROOT, APP_DIR)} —— 第 1 步似乎没跑成功。`]);
  }

  // 构建日志**只解析一次**，供下面的配对告警与第 ③ 项共用。
  const found = resolveBuildLog(args);

  // ---- 配对告警：这份基线是不是属于**本次**构建的？ ----
  //
  // 正确流程是「第 0 步写基线 → 第 1 步写 `.next/BUILD_ID` 与构建日志」，因此：
  //   ✅ 基线早于 `BUILD_ID` 是**正常**的
  //      ——本脚本早期版本把这条判成异常，于是**每次正确流程都误报**，
  //        告警因此被当成噪音忽略（等于这条检查白写）。
  //   ❌ 基线比构建日志的**诞生时间**还早很多 ⇒ 陈旧基线（第 0 步没跟本次构建配对）
  //   ❌ 基线晚于 `BUILD_ID` ⇒ 第 0 步是在构建**之后**补跑的，反映的不是构建当时的数据源状态
  if (expected.baseline) {
    const baseM = expected.baseline.mtime.getTime();
    const STALE_MS = 10 * 60 * 1000;
    const logBirth = found.file ? statBirth(found.file) : null;
    const buildIdPath = path.join(ROOT, ".next", "BUILD_ID");
    const buildM = fs.existsSync(buildIdPath) ? fs.statSync(buildIdPath).mtimeMs : null;

    if (logBirth && baseM < logBirth - STALE_MS) {
      console.log(
        `[postflight] ⚠️ 基线（${new Date(baseM).toISOString()}）比本次构建日志的诞生时间（` +
          `${new Date(logBirth).toISOString()}）早 ${Math.round((logBirth - baseM) / 60000)} 分钟 ` +
          "—— 像是**陈旧基线**（第 0 步没跟本次构建配对），建议重跑第 0 步。",
      );
    }
    if (buildM !== null && baseM > buildM) {
      console.log(
        `[postflight] ⚠️ 基线（${new Date(baseM).toISOString()}）晚于本次构建（` +
          `${new Date(buildM).toISOString()}）—— 第 0 步似乎是在构建**之后**补跑的，` +
          "基线反映的不是构建当时的数据源状态。",
      );
    }
  }

  // ---- ③ 构建日志（**有意排在最前**）----
  //
  // 排序理由：数据源失败时，「日志里有失败痕迹」是**因**，「页数不符」只是**果**。
  // 先看到因比先看到果更直接 —— 否则读到的第一句是"页数少了 63 篇"，
  // 还得自己倒回去翻日志。所以本项既最先执行、最先打印，其 reason 也最先进入
  // `reasons[]`（失败块的第一行）。
  {
    if (!found.file) {
      reasons.push(
        `第 ③ 项无法执行：找不到构建日志${
          found.auto ? `（已尝试自动挑选 ${found.tried}）` : `（指定路径不存在：${found.tried}）`
        }。`,
      );
      extras.push("   请显式传入：`--log outputs/_next_<时间戳>.log`，或设 `BUILD_LOG=<path>`。");
    } else {
      const hits = scanLog(found.file);
      const ok = hits.length === 0;
      console.log(
        `[postflight] ③ 构建日志 = ${found.file}${found.auto ? "（自动选中）" : ""}` +
          ` → 失败行 ${hits.length}${ok ? " ✓" : " ✗"}`,
      );
      if (found.legacy) {
        // 历史命名 = 可能不是本次构建的日志 ⇒ 极可能"上一轮的干净日志让本轮假 PASS"
        console.log(
          "[postflight] ⚠️ 该日志名不含时间戳（历史遗留命名），**可能不是本次构建的日志** ⇒ " +
            "第 1 步请改用：next build 2>&1 | tee outputs/_next_$(date +%Y%m%d%H%M%S).log",
        );
      }
      if (found.suspect) {
        console.log(
          "[postflight] ⚠️ 指定路径看起来是第 2 步 opennext 的日志（含 `opennext`）—— " +
            "它**不会**出现 `[queries] suppliers query failed`，拿它做本项断言等于假 PASS。",
        );
      }
      // 反向保险：自动挑中的日志若比**本次构建**还旧，那它根本不是本次的日志
      // —— 用一份陈旧的干净日志断言「失败行 0」就是假 PASS（这正是第 ③ 项存在的意义）。
      // 只在 auto 模式告警：显式 `--log` 是人自己的选择，责任在人。
      //
      // ⚠️ 判据必须用日志的 **mtime（写完的时刻）**，不能用诞生时间：BUILD_ID 是构建
      //    **中途**才写的，而日志在构建**开始**就诞生 ⇒ 诞生时间天然早于 BUILD_ID，
      //    拿它比会在**每次正确构建**上误报（实测：日志诞生 21:59:36 / BUILD_ID 22:01:13
      //    / 日志写完 22:01:55）。配对成立的不变式是：`日志 mtime > BUILD_ID mtime`。
      if (found.auto) {
        const logM = statMtime(found.file);
        const buildIdPath = path.join(ROOT, ".next", "BUILD_ID");
        const buildM = fs.existsSync(buildIdPath) ? fs.statSync(buildIdPath).mtimeMs : null;
        if (logM && buildM !== null && logM < buildM - 60_000) {
          console.log(
            `[postflight] ⚠️ 自动挑中的日志（写完于 ${new Date(logM).toISOString()}）早于本次构建的 ` +
              `BUILD_ID（${new Date(buildM).toISOString()}）—— 它**不是本次构建的日志**，` +
              "本项的「失败行 0」不足以证明本次构建干净。请显式传 `--log <第 1 步日志>`。",
          );
        }
      }
      if (!ok) {
        reasons.push(`第 ③ 项不符：日志里有 ${hits.length} 行数据源失败痕迹。`);
        for (const h of hits.slice(0, 5)) extras.push(`   L${h.no}: ${h.line.trim().slice(0, 160)}`);
        if (hits.length > 5) extras.push(`   …（其余 ${hits.length - 5} 行省略）`);
      }
    }
  }

  const htmls = collectHtmlFiles(APP_DIR);
  const supplierPages = htmls.filter(isSupplierPage);
  const guidePages = htmls.filter(isGuidePage);

  // ---- ① suppliers ----
  {
    const ok = supplierPages.length === expSupplierPages;
    console.log(
      `[postflight] ① /suppliers/*.html = ${supplierPages.length}` +
        `（期望 ${expected.expectedSuppliers} × ${localeCount} = ${expSupplierPages}）${ok ? "✓" : "✗"}`,
    );
    if (!ok) {
      reasons.push(
        `第 ① 项不符：/suppliers/*.html 实得 ${supplierPages.length}，期望 ${expSupplierPages}。`,
      );
      // 回退指纹：恰好等于内置静态常量长度 × 语种数 ⇒ 几乎可以断定是静默回落
      const fallback = staticSupplierCount * localeCount;
      if (supplierPages.length === fallback) {
        extras.push(
          `   ⚠️ ${supplierPages.length} = STATIC_SUPPLIERS.length(${staticSupplierCount}) × ${localeCount}` +
            ` —— **构建期静默回退到内置静态常量**的铁证（数据源在 build 期失败）。`,
        );
      }
      const missing = expected.expectedSuppliers * localeCount - supplierPages.length;
      extras.push(`   实得与期望差 ${missing} 篇；先查第 ③ 项（构建日志）定位数据源。`);
    }
  }

  // ---- ② guides ----
  {
    const ok = guidePages.length === expGuidePages;
    console.log(
      `[postflight] ② /guides/*.html = ${guidePages.length}` +
        `（期望 ${expected.expectedGuides} × ${localeCount} = ${expGuidePages}）${ok ? "✓" : "✗"}`,
    );
    if (!ok) {
      reasons.push(`第 ② 项不符：/guides/*.html 实得 ${guidePages.length}，期望 ${expGuidePages}。`);
      extras.push(
        "   guides 是**静态常量**驱动的，它不符通常意味：`-maxdepth` 口径被改、" +
          "或 `GUIDES` 数量变了没同步 preflight 基线。",
      );
    }
  }

  // ---- ③ 构建日志已前移到本函数最前（见上方注释） ----

  if (reasons.length) return fail(reasons, extras);

  console.log("POSTFLIGHT_OK");
  process.exit(0);
}

await main();
