// 把 .next / .open-next 改名挪走（**不删除**）：
//   1) 清 Next Data Cache（改了库内容必须清，否则构建静默固化上一次的库内容）
//   2) 绕开 opennext 构建期的 safe-delete 守卫（rmSync 大量文件会被拦）
//
// 🔴 构建关键路径上**只做改名**。历史备份清理是可选动作，必须显式传 --clean：
//    `node scripts/step13-rename-dirs.mjs --clean`
//
// 为什么把清理挪出去（真事故，不是理论风险）：
//   2026-09-21 07:21 的构建，改名步骤 0.1 秒就完成了（日志已打印 moved ...），
//   随后卡在"删旧备份"的 rmSync 循环里 —— 进程挂死 1.5 小时没有产出任何构建输出，
//   并持续持有日志文件句柄，导致后续重跑连日志都打不开。
//   Windows 上递归删除巨大的 .next/.open-next 备份目录可能长时间阻塞甚至卡死。
//   → 关键步骤不该等清理。构建链只调用本脚本的默认（改名）行为。
import { existsSync, renameSync, readdirSync, rmSync } from "node:fs";

const TS = Date.now();
const doClean = process.argv.includes("--clean");

// —— 第 1 步：挪走当前产物（构建正确性的前提，必须最先做，且必须快）——
let moved = 0;
for (const d of [".next", ".open-next"]) {
  if (!existsSync(d)) continue;
  const to = `${d}.step13-${TS}`;
  renameSync(d, to);
  moved++;
  console.log(`moved ${d} -> ${to}`);
}

if (!doClean) {
  console.log(`moved=${moved} clean=skipped（默认不清理；需要时手动加 --clean）`);
  process.exit(0);
}

// —— 第 2 步（可选，--clean）：清理历史备份，保留最近 4 个；删不掉就跳过 ——
const olds = readdirSync(".")
  .filter((n) => /^\.(next|open-next)\.(bak|phase3saved|s\d+prep|trash|step\d+)-\d+$/.test(n))
  .sort();
let removed = 0;
while (olds.length > 4) {
  const target = olds.shift();
  try {
    rmSync(target, { recursive: true, force: true });
    removed++;
  } catch (e) {
    console.log("skip remove " + target + " :: " + e.message);
  }
}

console.log(`moved=${moved} removedOldBackups=${removed}`);
