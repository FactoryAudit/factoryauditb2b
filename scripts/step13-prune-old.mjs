// 收敛构建链留下来的历史产物目录（.next.step13-* / .open-next.step13-*）。
//
// 背景：step13-rename-dirs.mjs 为了清 Data Cache + 绕开 opennext 的 safe-delete 守卫，
// 会把当前 .next / .open-next **改名挪走**而不是删除。这是构建正确性的前提，必须保留。
// 但每次构建都会多留一组（约 2.7GB），不做收敛时实测 9 个目录累计 10.8GB，
// 占满磁盘后下一次构建会直接失败。
//
// 为什么不用 rmSync：2026-09-21 的构建在 rmSync 循环里挂死 1.5 小时并持续持有日志句柄，
// 后续重跑连日志都打不开。本脚本改用 `cmd /c rmdir /s /q`（实测 1GB ≈ 20s，稳定），
// 每个目录带独立超时，删不掉就跳过 —— 清理永远不该拖住发布链。
//
// 保留策略：按时间戳分组，只保留最近 KEEP 组（.next 与 .open-next 同一次构建同 ts）。
// 默认 KEEP=1：留一组做构建失败时的对照，其余全清。
// 退出码恒为 0 —— 调用方（step13-build.mjs）不因清理失败而中断。
import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";

const KEEP = Number(process.env.STEP13_KEEP_OLD_GROUPS ?? 1);
const PER_DIR_TIMEOUT_MS = 180_000;

let names;
try {
  names = readdirSync(".").filter((n) => /^\.(next|open-next)\.step13-\d+$/.test(n));
} catch (e) {
  console.log("prune: readdir failed, skip :: " + e.message);
  process.exit(0);
}

if (names.length === 0) {
  console.log("prune: nothing to clean");
  process.exit(0);
}

const stampOf = (n) => n.match(/(\d+)$/)[1];
const stamps = [...new Set(names.map(stampOf))].sort((a, b) => Number(b) - Number(a));
const keepStamps = new Set(stamps.slice(0, Math.max(0, KEEP)));
const targets = names.filter((n) => !keepStamps.has(stampOf(n)));

if (targets.length === 0) {
  console.log(`prune: ${names.length} dirs, keep=${keepStamps.size} group(s), nothing removed`);
  process.exit(0);
}

const del = (dir) =>
  new Promise((resolve) => {
    let settled = false;
    const done = (r) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const p = spawn("cmd", ["/c", "rmdir", "/s", "/q", dir], { stdio: "ignore" });
    const timer = setTimeout(() => {
      try {
        p.kill();
      } catch {}
      done("timeout");
    }, PER_DIR_TIMEOUT_MS);
    p.on("error", (e) => {
      clearTimeout(timer);
      done("error:" + e.message);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      done(code === 0 ? "ok" : "fail:" + code);
    });
  });

let ok = 0;
let skipped = 0;
for (const dir of targets) {
  const t0 = Date.now();
  const r = await del(dir);
  const sec = Math.round((Date.now() - t0) / 1000);
  if (r === "ok") ok++;
  else skipped++;
  console.log(`prune ${dir} -> ${r} (${sec}s)`);
}

console.log(
  `prune: removed=${ok} skipped=${skipped} keptGroups=${keepStamps.size} (${[...keepStamps].join(",") || "-"})`
);
// 恒为 0：清理是尽力而为，绝不阻塞发布。
process.exit(0);
