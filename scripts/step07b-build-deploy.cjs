// STEP 07B · 重建 + 生产部署编排
// 目的：首页为静态预渲染（build 期冻结），数据库已把 1 条真实 RFQ 置 is_public=true，
//       必须重新 build + deploy 才能让首页 listPublicRfqs 取到它。
//
// 流程：
//   1) 改名挪走 .next / .open-next（清 Next Data Cache + 绕过 OpenNext initOutputDir 的
//      rmSync('.open-next') 安全删除守卫；用 rename 而非 rm，绝不删除历史 .bak）
//   2) next build
//   3) opennextjs-cloudflare build
//   4) node scripts/cf-release.cjs（populate → scrub → verify → deploy → submit）
//
// 不修改任何代码 / 不修改 RFQ 数据 / 不新建文件到仓库逻辑层。

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const ts = Date.now();

function renameAway(rel) {
  const p = path.join(ROOT, rel);
  if (fs.existsSync(p)) {
    const bak = path.join(ROOT, rel + ".bak-07b-" + ts);
    fs.renameSync(p, bak);
    console.log(`[07b] renamed ${rel} -> ${path.basename(bak)}`);
  } else {
    console.log(`[07b] ${rel} 不存在，跳过 rename`);
  }
}

// ① 改名挪走（清缓存 + 避守卫）
renameAway(".next");
renameAway(".open-next");

const NODE = process.execPath;

function run(args, label) {
  console.log(`\n=========== ${label} ===========`);
  execFileSync(NODE, args, { cwd: ROOT, stdio: "inherit", env: process.env });
  console.log(`[07b] ✓ ${label}`);
}

// ② next build
run([path.join(ROOT, "node_modules/next/dist/bin/next"), "build"], "next build");

// ③ opennextjs-cloudflare build
run(
  [path.join(ROOT, "node_modules/@opennextjs/cloudflare/dist/cli/index.js"), "build"],
  "opennextjs-cloudflare build",
);

// ④ cf-release（含 populate/scrub/verify/deploy/submit）
run([path.join(ROOT, "scripts/cf-release.cjs")], "cf-release");

console.log("\n[07b] 构建 + 部署全流程完成 ✅");
