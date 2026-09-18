// scripts/populate-static-assets-cache.cjs
//
// 干什么：把 `.open-next/cache/` 里的预渲染产物复制进
//   `.open-next/assets/cdn-cgi/_next_cache/`，供 Worker 通过 ASSETS 绑定读取。
//
// 为什么必须有这一步（2026-09-18 事故，务必先读）：
//   `open-next.config.ts` 选的是 `staticAssetsIncrementalCache`。
//   该缓存**只读**、数据在构建时冻结，靠 `populateCache` 把 `.open-next/cache`
//   复制进 assets 目录。但 `populateCache` **不在 `build` 流程里** ——
//   它只挂在 `deploy` / `preview` 两个子命令下
//   （见 node_modules/@opennextjs/cloudflare/dist/cli/commands/deploy.js 第 22 行）。
//   本仓库的部署链路是「next build → opennext build → wrangler deploy」，
//   用的是裸 `wrangler deploy`，于是这一步从未被执行过：
//   1454 个 `.cache`（151.6 MB）被整批丢弃、**零报错、零警告**，
//   线上因此退化为每个请求现场 SSR；CF 免费版 CPU 上限 10 ms/请求
//   ⇒ Cloudflare Error 1102 复发。
//
// 为什么不直接用官方的 `opennextjs-cloudflare populateCache`：
//   官方实现是一句 `fs.cpSync(cache, assets/cdn-cgi/_next_cache, {recursive:true})`
//   把 1493 个文件一把复制完。本机沙箱对单进程内的大批量文件写入有硬阈值
//   （实测单次 300 文件 / 31 MB 通过；1453 文件 / 151 MB 被**静默 kill**，
//     退出码 127，无任何错误输出），必然触发。
//   所以这里把同一次复制拆成「每批 N 个文件、每批一个独立子进程」，
//   并在主进程里循环调用直到全部完成。行为与官方实现等价。
//
// 特性：
//   · 幂等可续传 —— 目标已存在且字节数一致的文件直接跳过；
//   · 自我分批 —— 直接运行即可一次跑完，无需手工反复调用；
//   · 路径契约自检 —— 复制完复核 `<buildId>/` 与 `__fetch/<buildId>/` 两支对齐。
//
// 用法：
//   node scripts/populate-static-assets-cache.cjs            # 一次跑完
//   node scripts/populate-static-assets-cache.cjs --batch 200 # 调整每批上限
//   node scripts/populate-static-assets-cache.cjs --worker    # 内部用（单批）
//
// ⚠️ 每次重跑 `opennext build` 之后都必须再跑本脚本
//    （`createStaticAssets` 会重建 assets 目录，把 _next_cache 冲掉）。
//    跑完接着跑 scripts/verify-opennext-bundle.mjs 复核。

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, ".open-next", "cache");
// 与 @opennextjs/cloudflare 的 CACHE_DIR 常量保持一致
// （dist/api/overrides/incremental-cache/static-assets-incremental-cache.js）
const DST = path.join(ROOT, ".open-next", "assets", "cdn-cgi", "_next_cache");

const argv = process.argv.slice(2);
const isWorker = argv.includes("--worker");
const batchArg = argv.indexOf("--batch");
const BATCH = batchArg >= 0 ? Number(argv[batchArg + 1]) : 250;

/** 递归收集目录下所有文件，rel 相对于 base（默认 SRC） */
function collect(dir, base = SRC) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  (function rec(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) rec(p);
      else out.push({ abs: p, size: st.size, rel: path.relative(base, p).split(path.sep).join("/") });
    }
  })(dir);
  return out;
}

/** 单批：复制至多 BATCH 个尚未就位的文件，返回 {copied, skipped, remaining} */
function runBatch() {
  const files = collect(SRC);
  let copied = 0;
  let skipped = 0;
  let remaining = 0;
  let bytes = 0;
  for (const f of files) {
    const target = path.join(DST, f.rel);
    if (fs.existsSync(target) && fs.statSync(target).size === f.size) {
      skipped++;
      continue;
    }
    if (copied >= BATCH) {
      remaining++;
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(f.abs, target);
    copied++;
    bytes += f.size;
  }
  return { copied, skipped, remaining, bytes, total: files.length };
}

if (isWorker) {
  const r = runBatch();
  console.log(
    `copied=${r.copied} skipped=${r.skipped} remaining=${r.remaining} ` +
      `writtenMB=${(r.bytes / 1048576).toFixed(2)} totalSrc=${r.total}`
  );
  console.log(r.remaining === 0 ? "DONE" : "NEED_MORE");
  process.exit(0);
}

// ── 主进程：反复派生子进程，直到没有剩余 ────────────────────────────────
if (!fs.existsSync(SRC)) {
  console.error(`[populate] 找不到 ${SRC} —— 请先跑 opennext build`);
  process.exit(1);
}

console.log(`[populate] 源      ${SRC}`);
console.log(`[populate] 目标    ${DST}`);
console.log(`[populate] 每批上限 ${BATCH} 个文件`);

let round = 0;
let totalCopied = 0;
while (true) {
  round++;
  const res = spawnSync(process.execPath, [__filename, "--worker", "--batch", String(BATCH)], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const out = (res.stdout || "").trim();
  if (res.status !== 0 || !out) {
    console.error(`[populate] 第 ${round} 批失败（exit=${res.status}）`);
    console.error(out || res.stderr || "(无输出)");
    process.exit(1);
  }
  const line = out.split("\n").filter((l) => l.startsWith("copied=")).pop() || "";
  const m = line.match(/copied=(\d+) skipped=(\d+) remaining=(\d+)/);
  if (!m) {
    console.error(`[populate] 无法解析子进程输出：${JSON.stringify(out)}`);
    process.exit(1);
  }
  const copied = Number(m[1]);
  const remaining = Number(m[3]);
  totalCopied += copied;
  console.log(`[populate] 第 ${round} 批：copied=${copied} remaining=${remaining}`);
  if (remaining === 0) break;
}

// ── 路径契约自检 ────────────────────────────────────────────────────────
const buildIdFile = path.join(ROOT, ".next", "BUILD_ID");
const buildId = fs.existsSync(buildIdFile) ? fs.readFileSync(buildIdFile, "utf8").trim() : null;
if (!buildId) {
  console.error("[populate] 自检失败：读不到 .next/BUILD_ID");
  process.exit(1);
}

const dstKeys = collect(DST, DST).map((f) => f.rel);
const pageKeys = dstKeys.filter((k) => k.startsWith(buildId + "/"));
const fetchKeys = dstKeys.filter((k) => k.startsWith("__fetch/" + buildId + "/"));
const strayKeys = dstKeys.filter((k) => !pageKeys.includes(k) && !fetchKeys.includes(k));
const badExt = pageKeys.filter((k) => !k.endsWith(".cache"));

console.log();
console.log(`[populate] 本轮新复制 ${totalCopied} 个文件`);
console.log(`[populate] buildId          ${buildId}`);
console.log(`[populate] 页面缓存          ${pageKeys.length}`);
console.log(`[populate] fetch 缓存        ${fetchKeys.length}`);
console.log(`[populate] 非预期路径        ${strayKeys.length}${strayKeys.length ? " -> " + strayKeys.slice(0, 5).join(", ") : ""}`);
console.log(`[populate] 非 .cache 结尾    ${badExt.length}${badExt.length ? " -> " + badExt.slice(0, 5).join(", ") : ""}`);

if (pageKeys.length === 0) {
  console.error("[populate] 自检失败：页面缓存为空");
  process.exit(1);
}
if (strayKeys.length > 0 || badExt.length > 0) {
  console.error("[populate] 自检失败：路径契约不符");
  process.exit(1);
}
console.log("[populate] OK");
