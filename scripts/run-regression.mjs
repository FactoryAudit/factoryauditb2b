// scripts/run-regression.mjs —— 通用「TS 回归脚本」运行器
//
// 用法：
//   node scripts/run-regression.mjs cs06a-directory-regression CS06A_ROOT
//   node scripts/run-regression.mjs cs04-analytics-regression
//
// 为什么需要它：
//   1) 本机 Git Bash 缺 sed / dirname，`./node_modules/.bin/esbuild` 的 shim 跑不起来，
//      必须走 esbuild 的 JS API。
//   2) esbuild bundle 若落到仓库外执行，脚本里的 `__dirname` / 相对路径会失效，
//      产出"全部缺失"的假 FAIL —— 所以产物固定落在 scripts/ 内。
//   3) 这些回归脚本要求 ROOT 为 Windows 风格路径（`F:/...`），本运行器自动注入。

import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";

const name = process.argv[2];
const rootEnvName = process.argv[3];

if (!name) {
  console.error("用法: node scripts/run-regression.mjs <脚本名（不含 .ts）> [ROOT 环境变量名]");
  process.exit(2);
}

const root = process.cwd();
const entry = path.join(root, "scripts", `${name}.ts`);
const out = path.join(root, "scripts", `.${name}.bundle.cjs`);

if (rootEnvName && !process.env[rootEnvName]) {
  process.env[rootEnvName] = root.replace(/\\/g, "/");
}

// 🔑 兜底桩：`server-only` / `client-only` 是 Next 的**构建期哨兵包**
//    （exports 里只有 "react-server" 条件才指向空模块，Node 直跑会抛错）。
//    `lib/taxonomy.ts` 依赖 `server-only`，任何 import `lib/queries` 的回归脚本
//    都会因此打包失败 → 这里统一替换成空模块。
//    注意：只对这两个包名生效，绝不放宽其它未解析依赖（否则会把真错吞掉）。
const stubNextSentinels = {
  name: "stub-next-sentinels",
  setup(b) {
    b.onResolve({ filter: /^(server-only|client-only)$/ }, (a) => ({
      path: a.path,
      namespace: "next-sentinel-stub",
    }));
    b.onLoad({ filter: /.*/, namespace: "next-sentinel-stub" }, () => ({
      contents: "export {};",
      loader: "js",
    }));
  },
};

await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  logLevel: "warning",
  plugins: [stubNextSentinels],
});

await import(pathToFileURL(out).href);
