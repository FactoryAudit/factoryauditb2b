// 从 lib/standardReportHtml.ts（单一事实来源）生成可预览的 HTML 样张
// 用法: node scripts/build-standard-report-html.mjs
// 输出: .workbuddy/artifacts/standard-report-specimen.html（仅本地预览，不进 public/，不部署）
//
// 渲染规则一律走 lib/standardReportHtml.ts：
//   本脚本只负责「打包 → 调生成器 → 落盘」，不再自己拼 HTML。
//
// 用法: node scripts/build-standard-report-html.mjs [lang] [--admin]
//   lang   默认 zh（可选 en）
//   --admin  加后台「采购商下载（工厂不可见）」演示框；
//            **不加才是公开下载版**（生成器默认 false，保证公开件永不含该框）。
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

const argv = process.argv.slice(2);
const lang = argv.find((a) => a === "en" || a === "zh") ?? "zh";
const adminPreview = argv.includes("--admin");

const html = M.buildStandardReportHtml(lang, { adminPreview });
const fname = M.standardReportFileName(lang);

const outDir = join(ROOT, ".workbuddy", "artifacts");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, fname);
writeFileSync(outFile, html, "utf8");
console.log(
  "✅ 生成: " + outFile + " (" + html.length + " bytes) | lang=" + lang + " adminPreview=" + adminPreview
);
console.log(
  adminPreview
    ? "   （后台预览版：含 ADMIN PREVIEW 演示框）"
    : "   （公开下载版：与买家留资后拿到的文件一致）"
);
