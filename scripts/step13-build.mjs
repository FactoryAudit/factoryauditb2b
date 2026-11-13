// STEP 13 构建链：rename dirs → next build → opennext build → cf-release
// 全后台跑，日志写文件；任一步非 0 立即停。
import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const LOG = "D:/腾讯ai临时文件/2026-09-14-22-18-10/s13-build-log.txt";
const NODE = process.execPath;
writeFileSync(LOG, "STEP13 BUILD START " + new Date().toISOString() + "\n", "utf8");

const run = (args, label) =>
  new Promise((resolve) => {
    const t0 = Date.now();
    appendFileSync(LOG, `\n===== ${label} =====\n$ ${args.join(" ")}\n`, "utf8");
    const p = spawn(NODE, args, { stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", (b) => appendFileSync(LOG, b.toString(), "utf8"));
    p.stderr.on("data", (b) => appendFileSync(LOG, b.toString(), "utf8"));
    p.on("close", (code) => {
      appendFileSync(LOG, `\n>>>>> ${label} EXIT=${code} in ${Math.round((Date.now() - t0) / 1000)}s\n`, "utf8");
      resolve(code);
    });
  });

let code = await run(["scripts/step13-rename-dirs.mjs"], "RENAME");
if (code === 0) {
  // 改名已完成，此处删的都是更早的组（保留最近 1 组做对照）。
  // 脚本内部每目录独立超时、退出码恒 0 —— 清理永不阻塞发布。
  // 不加这一步的后果：每次构建多留约 2.7GB，实测 9 个目录已累计 10.8GB。
  await run(["scripts/step13-prune-old.mjs"], "PRUNE OLD BUILDS");
}
if (code === 0) {
  code = await run(["node_modules/next/dist/bin/next", "build"], "NEXT BUILD");
}
if (code === 0) {
  // 2026-11-10：OpenNext 1.20.5 起对 Next.js 15.5.24 判定「超出官方支持期」并直接退出。
  // 项目仍锁定 15.5.24（升级 Next 是独立任务，不能混在业务改动里做），
  // 这里显式声明「知悉风险、继续使用」——否则整条发布链在 opennext 阶段 5 秒即失败。
  code = await run(
    [
      "node_modules/@opennextjs/cloudflare/dist/cli/index.js",
      "build",
      "--dangerouslyUseUnsupportedNextVersion",
    ],
    "OPENNEXT BUILD"
  );
}
if (code === 0) {
  // 扫描器探测拦截必须打在生成产物上（middleware matcher 排除了所有含 "." 的路径，
  // /.env / *.php 根本不进 middleware）。脚本自带 40 条规则自测与锚点断言，
  // 锚点对不上会非 0 退出，宁可停在发布前也不要静默发一份没护栏的产物。
  code = await run(["scripts/patch-worker-scan-guard.mjs"], "PATCH SCAN GUARD");
}
if (code === 0) {
  code = await run(["scripts/cf-release.cjs"], "CF RELEASE");
}
appendFileSync(LOG, `\n===== ALL DONE code=${code} =====\n`, "utf8");
console.log("FINAL=" + code);
process.exit(code);
