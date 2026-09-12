// 全站 SEO 地图数据探针（只读）
//
// 用途：一次性拉齐「真实 URL 清单 + sitemap 异常 + robots + 未进 sitemap 的路由」，
//       供人工/报告使用。不写任何数据、不改任何文件。
//
// 用法：node scripts/seo-map-audit.mjs
//
// 为什么用线上 sitemap 而不是本地推断：sitemap 是站点对外提交的**唯一事实源**，
// 本地路由树只能看出「有哪些页面」，看不出「实际提交了哪些、有没有重复提交」。
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://factoryauditb2b.com";
const LOCALES = ["zh-TW", "zh", "ja", "es", "de", "fr", "pt", "ar"];
const ROOT = process.cwd();

// ---------- 1. 线上 sitemap ----------
const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const perPath = new Map();
for (const u of locs) {
  let p = new URL(u).pathname;
  const seg = p.split("/")[1];
  if (LOCALES.includes(seg)) p = p.slice(seg.length + 1) || "/";
  perPath.set(p, (perPath.get(p) ?? 0) + 1);
}
console.log(`[sitemap] URL 总数 ${locs.length} · 唯一路径 ${perPath.size}`);
const odd = [...perPath.entries()].filter(([, n]) => n !== 9);
console.log(`[sitemap] 非 9 条的路径 ${odd.length} 条：`);
for (const [p, n] of odd) console.log(`   ${n}x  ${p}`);

// ---------- 2. 重复来源定位 ----------
console.log("\n[dup] 各数据文件的 slug 出现情况：");
for (const f of [
  "lib/guides.ts",
  "lib/caseStudies.ts",
  "lib/fieldReports.ts",
  "lib/coverage.ts",
  "app/sitemap.ts",
]) {
  if (!fs.existsSync(path.join(ROOT, f))) continue;
  const s = fs.readFileSync(path.join(ROOT, f), "utf8");
  const slugs = [...s.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
  const seen = new Map();
  for (const x of slugs) seen.set(x, (seen.get(x) ?? 0) + 1);
  const dups = [...seen.entries()].filter(([, n]) => n > 1);
  console.log(
    `   ${f}  slug ${slugs.length} 个` +
      (dups.length ? `  🔴 内部重复：${dups.map(([k, n]) => `${k}×${n}`).join(", ")}` : "")
  );
  for (const name of ["factory-audit-checklist", "supplier-risk-assessment-guide"]) {
    const n = (s.match(new RegExp(name, "g")) ?? []).length;
    if (n) console.log(`       含 ${name} × ${n}`);
  }
}

// ---------- 3. robots.txt ----------
console.log(`\n[robots] ${BASE}/robots.txt`);
console.log(await (await fetch(`${BASE}/robots.txt`)).text());

// ---------- 4. 未进 sitemap 的应用路由 ----------
const inSitemap = new Set(perPath.keys());
const staticPaths = new Set();
const dynamicDirs = new Set();
(function walk(dir, segs) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "api") continue;
      walk(fp, [...segs, e.name]);
    } else if (/^page\.tsx?$/.test(e.name)) {
      const seg = [...segs, e.name];
      // 去掉 [locale] 与尾部 page.tsx
      const parts = seg.slice(0, -1).filter((s) => s !== "[locale]");
      const rendered = parts.map((s) => (s.startsWith("[") ? "<param>" : s)).join("/");
      const isDyn = parts.some((s) => s.startsWith("["));
      if (isDyn) dynamicDirs.add("/" + rendered);
      else staticPaths.add("/" + rendered);
    }
  }
})(path.join(ROOT, "app"), []);

console.log("\n[not-in-sitemap] 静态路由未提交：");
for (const p of [...staticPaths].sort()) {
  const norm = p === "/" ? "/" : p;
  if (!inSitemap.has(norm)) console.log("   " + norm);
}
console.log("\n[dynamic] 动态路由（模板层面，sitemap 按具体值展开）：");
for (const p of [...dynamicDirs].sort()) console.log("   " + p);
console.log("\n[in-sitemap] 已提交的动态展开前缀：");
for (const p of [...inSitemap].filter((x) => x.split("/").length > 2).sort()) {
  console.log("   " + p);
}
