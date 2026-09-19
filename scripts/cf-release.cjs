// scripts/cf-release.cjs
//
// 干什么：本仓库到 Cloudflare Workers 的**唯一发布入口**。
//   把原先手工「四步走」串成一条命令，并把 CS-19 漏掉的那一步补进来：
//
//     ① populate 静态资源增量缓存   ← 2026-09-18 事故补入，此前完全没有
//     ② scrub-next-env              清掉产物里的密钥明文
//     ③ verify-opennext-bundle      产物闸门（含预渲染落地断言）
//     ④ wrangler deploy             真正上传
//
// 为什么要有这个入口：
//   原先的链路是「next build → opennext build → scrub → wrangler deploy」，
//   全程靠人记。而 `open-next.config.ts` 用的是 `staticAssetsIncrementalCache`，
//   它的预渲染产物必须靠 `populateCache` 才进 assets —— 该命令**不在 build 流程里**，
//   只挂在 opennext 的 deploy/preview 子命令下。既然本仓库刻意用裸 `wrangler deploy`
//   （为了保住 scrub 的顺序），那一步就必然被漏掉，且**静默无声**：
//   1454 个 `.cache`（151.6 MB）被丢弃、零报错，线上退化为每请求现场 SSR，
//   CF 免费版 CPU 上限 10 ms ⇒ Error 1102 复发。
//   把它写进脚本、并让脚本在闸门不过时拒绝部署，才是这个 bug 的根治。
//
// 前置（本脚本不代跑，避免误伤 Next 的 Data Cache 语义）：
//   · 清 `.next/cache`（改了数据库内容后必须；否则 SSG 会固化上一次构建的库内容且零报错）
//   · `next build`
//   · `opennextjs-cloudflare build`（用 scripts/_opennext_run.cjs build）
//
// 用法：
//   node scripts/cf-release.cjs                 # 完整发布
//   node scripts/cf-release.cjs --dry-run       # 只做前 3 步 + wrangler dry-run
//   node scripts/cf-release.cjs --skip-populate # 跳过第①步（仅在确认 assets 未被重建时）
//
// ⚠️ 必须关沙箱运行：wrangler 要联网，且 populate 要写 1493 个文件。

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const SKIP_POPULATE = argv.includes("--skip-populate");

// ── 从 .env 注入环境变量（CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 等）
//    仅当环境中尚未设置该键时才注入，避免覆盖调用方显式传入的值。
const ENV_FILE = path.join(ROOT, ".env");
if (fs.existsSync(ENV_FILE)) {
  for (const raw of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

function runNode(script, label) {
  console.log(`\n=========== ${label} ===========`);
  execFileSync(process.execPath, [path.join(ROOT, "scripts", script)], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
}

function step(name, fn) {
  try {
    fn();
  } catch (e) {
    console.error(`\n[release] ✗ 第 ${name} 步失败，已终止，未部署。`);
    process.exit(1);
  }
  console.log(`[release] ✓ ${name}`);
}

// ── 前置检查：构建产物必须在 ────────────────────────────────────────────
const need = [
  ".next/BUILD_ID",
  ".open-next/worker.js",
  ".open-next/.build/open-next.config.edge.mjs",
  ".open-next/cache",
];
const missing = need.filter((p) => !fs.existsSync(path.join(ROOT, p)));
if (missing.length) {
  console.error("[release] 缺少构建产物，先跑 next build + opennext build：");
  for (const m of missing) console.error("  - " + m);
  process.exit(1);
}

console.log("[release] 目标     factoryauditb2b");
console.log("[release] account  " + (process.env.CLOUDFLARE_ACCOUNT_ID ? "已注入" : "未注入(!)"));
console.log("[release] token    " + (process.env.CLOUDFLARE_API_TOKEN ? "已注入" : "未注入(!)"));
console.log("[release] 模式     " + (DRY ? "dry-run" : "真实发布"));

if (SKIP_POPULATE) {
  console.log("[release] ⚠️ 跳过第①步 populate（调用方已确认 assets 未被重建）");
} else {
  step("① populate 静态资源增量缓存", () => runNode("populate-static-assets-cache.cjs", "① populate"));
}

step("② scrub-next-env", () => runNode("scrub-next-env.mjs", "② scrub"));

// ③ 闸门必须跑在 scrub 之后：verify 会断言产物里无密钥明文，
//    若放在 scrub 之前，它验的是一份还没清理的产物，等于白验。
step("③ verify-opennext-bundle", () => runNode("verify-opennext-bundle.mjs", "③ verify"));

step("④ wrangler deploy", () => {
  const args = [path.join(ROOT, "node_modules/wrangler/bin/wrangler.js"), "deploy"];
  if (DRY) args.push("--dry-run", "--outdir", path.join(ROOT, ".wrangler-dryrun"));
  console.log(`\n=========== ④ wrangler ${DRY ? "dry-run" : "deploy"} ===========`);
  // 🔴 必须设 OPEN_NEXT_DEPLOY=true，否则 wrangler 会「自作主张」代理：
  //
  //   wrangler 检测到 OpenNext 项目（wrangler-dist/cli.js:407689
  //   maybeDelegateToOpenNextDeployCommand）会执行
  //       npx opennextjs-cloudflare deploy
  //   而 opennext 的 deploy 命令**又会调一次 populateCache**，
  //   其实现是一句 `fs.cpSync(cache → assets/cdn-cgi/_next_cache, {recursive:true})`，
  //   要一口气写 1493 个文件 / 151 MB。
  //
  //   两条硬约束让这条链在本机必挂：
  //     ① 本机对单进程大批量文件写入有硬阈值（实测 300 文件 / 31 MB 通过，
  //        1453 文件被静默 kill、退出码 127、无任何错误输出）；
  //     ② 代理走的是 `npx`，本机 npx/npm 不可靠。
  //   失败现场：wrangler 打一行空的 `X [ERROR]` 就退出，**看不出任何原因**。
  //
  //   历史部署之所以没暴露这个问题，是因为那时 open-next.config.ts 还是空配置
  //   （`incrementalCache` = "dummy"），populateCache 走 default 分支
  //   **什么都没复制**（历史日志里的 "Incremental cache does not need populating"
  //   就是铁证），所以代理链一路畅通。
  //
  //   OPEN_NEXT_DEPLOY=true 正是 opennext 自己在代理后用来防无限递归的开关
  //   （见 dist/cli/commands/deploy.js 传给 wrangler 的 env），
  //   设上它 wrangler 就跳过代理、直接部署 —— 与 opennext 自己跑完
  //   populateCache 之后的行为完全一致。我们已经用第①步的分批复制
  //   （scripts/populate-static-assets-cache.cjs）完成了同一件事。
  console.log("[release] OPEN_NEXT_DEPLOY=true（跳过 wrangler 的 opennext 代理）");
  execFileSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, OPEN_NEXT_DEPLOY: "true" },
  });
});

// ⑤ 发布后自动通知搜索引擎（Bing IndexNow / Google Indexing API / GSC sitemap ping）。
//    best-effort：凭据缺失或网络异常仅告警，绝不影响已经上线的部署。
//    脚本内部已做幂等（sitemap-diff 只提交新增 URL），可安全每次发布触发。
console.log("\n=========== ⑤ post-publish URL submission ===========");
try {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "post-publish-submit.cjs")], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  console.log("[release] ✓ ⑤ 发布后 URL 提交完成");
} catch (e) {
  console.error(
    "[release] ⚠️ ⑤ URL 提交未成功（凭据缺失或网络问题），不影响已上线部署；补齐 .env 后手动重跑即可。",
  );
}

console.log("\n[release] 全部步骤完成 ✅");
if (DRY) console.log("[release] 这是 dry-run，线上没有任何变更。");
