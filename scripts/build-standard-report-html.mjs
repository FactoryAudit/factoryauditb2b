// 从 lib/standardReportHtml.ts（单一事实来源）生成可预览的 HTML 样张
// 用法: node scripts/build-standard-report-html.mjs
// 输出: .workbuddy/artifacts/standard-report-specimen.html（仅本地预览，不进 public/，不部署）
//
// 渲染规则一律走 lib/standardReportHtml.ts：
//   本脚本只负责「打包 → 调生成器 → 落盘」，不再自己拼 HTML。
//   adminPreview: true —— 本地件保留后台的「采购商下载（工厂不可见）」演示框。
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const tmp = join(tmpdir(), `std-report-${Date.now()}.mjs`);
await build({
  entryPoints: [join(ROOT, "lib/standardReportHtml.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmp,
  logLevel: "warning",
});
const M = await import(pathToFileURL(tmp).href);

const html = M.buildStandardReportHtml("zh", { adminPreview: true });

const outDir = join(ROOT, ".workbuddy", "artifacts");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "standard-report-specimen.html");
writeFileSync(outFile, html, "utf8");
console.log("✅ 生成:", outFile, "(" + html.length + " bytes)");
