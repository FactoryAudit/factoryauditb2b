/**
 * stage1.6 探针：行业分类页 desc / title 收口前后对照（13 行业 × 9 语种 = 117 页）
 * 用法：node scripts/run-regression.mjs _s16_industry
 */
import * as fs from "fs";
import * as path from "path";
import { trimMetaDescription, trimMetaTitle, isCjkDominant } from "../lib/pageMeta";
import { STATIC_INDUSTRIES } from "../lib/staticData";
import { twText } from "../lib/tw";

const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"] as const;
const SUFFIX = " | FactoryAuditB2B";
const ENDER = /[.!?。！？؟۔…]["'”’»)\]）]*$/;

const dicts = new Map<string, any>();
for (const L of LOCALES) {
  dicts.set(L, JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "dictionaries", `${L}.json`), "utf8")));
}

type Row = { loc: string; code: string; srcLen: number; ratio: number; out: string };
const rows: Row[] = [];

for (const L of LOCALES) {
  const t = dicts.get(L)!;
  for (const ind of STATIC_INDUSTRIES) {
    const name = L === "zh-TW" ? twText(ind.name) : ind.name;
    const src = (t.industryPage.metaDesc as string).replaceAll("{industry}", name);
    const out = trimMetaDescription(src);
    const total = [...src].length;
    const cjk = (src.match(/[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
    rows.push({ loc: L, code: ind.code, srcLen: total, ratio: cjk / total, out });
  }
}

console.log("loc     code                     srcLen  cjk%   outLen  ender  cjkBudget  out");
console.log("-".repeat(118));
const bad: string[] = [];
const byLoc = new Map<string, { min: number; max: number }>();
for (const r of rows) {
  const ok = ENDER.test(r.out);
  const b = byLoc.get(r.loc) ?? { min: 999, max: 0 };
  const L = [...r.out].length;
  byLoc.set(r.loc, { min: Math.min(b.min, L), max: Math.max(b.max, L) });
  if (!ok) bad.push(`${r.loc}/${r.code} 结尾无句末标点: …${r.out.slice(-50)}`);
  console.log(
    `${r.loc.padEnd(7)} ${r.code.padEnd(24)} ${String(r.srcLen).padStart(6)}  ${(r.ratio * 100).toFixed(1).padStart(5)}%  ${String(L).padStart(6)}  ${
      ok ? "  ✓  " : "  ✗  "
    }  ${isCjkDominant(r.out) ? "  CJK-90 " : " LATIN-158"}  ${r.out.slice(0, 46)}`
  );
}

console.log("\n=== 各语种 desc 长度区间 ===");
for (const L of LOCALES) {
  const b = byLoc.get(L)!;
  console.log(`${L.padEnd(7)} ${b.min}–${b.max}`);
}
console.log(`\n=== 结尾无句末标点：${bad.length} 项 ===`);
for (const x of bad) console.log("  - " + x);

// ---- title 对照（行业分类页）----
console.log("\n=== 行业分类页 title 主体长度（未含品牌段）===");
const tRow: string[] = [];
for (const L of LOCALES) {
  const t = dicts.get(L)!;
  const lens = STATIC_INDUSTRIES.map((ind) => {
    const name = L === "zh-TW" ? twText(ind.name) : ind.name;
    const body = `${name} ${t.industryPage.pageTitle}`;
    const trimmed = trimMetaTitle(`${body}${SUFFIX}`);
    return { body: [...body].length, total: [...trimmed].length, cut: trimmed !== `${body}${SUFFIX}` };
  });
  const bodyMin = Math.min(...lens.map((x) => x.body));
  const bodyMax = Math.max(...lens.map((x) => x.body));
  const totMin = Math.min(...lens.map((x) => x.total));
  const totMax = Math.max(...lens.map((x) => x.total));
  tRow.push(`${L.padEnd(7)} 主体 ${bodyMin}–${bodyMax}　合成长度 ${totMin}–${totMax}`);
}
for (const r of tRow) console.log(r);
