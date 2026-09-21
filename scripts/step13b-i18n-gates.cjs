// STEP 13-B —— ① 给 9 语字典加 clusters.allCountries
//              ② 同步 en 叶子数冻结常量 2939 → 2940（2935 字符串 → 2936 字符串）
//
// 跳过含 "→" 的历史 changelog 行（避免把 "2938 → 2939" 这类历史记录改成错误数字）。
// 不动任何 STEP1x 的历史验收脚本与报告（它们是当时的快照）。
const { readFileSync, writeFileSync, existsSync } = require("node:fs");

const LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"];

const TEXT = {
  en: "All",
  zh: "全部",
  "zh-TW": "全部",
  es: "Todos",
  de: "Alle",
  fr: "Tous",
  pt: "Todos",
  ja: "すべて",
  ar: "الكل",
};

// ---------- 叶子计数（与 cs16/cs17 的 countLeaves 同口径：每个标量 = 1 叶） ----------
function countLeaves(obj) {
  if (obj === null || typeof obj !== "object") return 1;
  if (Array.isArray(obj)) return obj.reduce((a, x) => a + countLeaves(x), 0);
  return Object.values(obj).reduce((a, x) => a + countLeaves(x), 0);
}

// ---------- ① 字典 ----------
const dictReport = [];
const leavesBefore = {};
const leavesAfter = {};

for (const loc of LOCALES) {
  const file = `i18n/dictionaries/${loc}.json`;
  const d = JSON.parse(readFileSync(file, "utf8"));
  leavesBefore[loc] = countLeaves(d);

  const ns = d?.clusters;
  if (!ns) {
    dictReport.push(`${loc}: SKIP (clusters 不存在)`);
    leavesAfter[loc] = leavesBefore[loc];
    continue;
  }
  if (ns.allCountries) {
    dictReport.push(`${loc}: already present`);
    leavesAfter[loc] = countLeaves(d);
    continue;
  }
  // 插到 countryLabel 之后（语义相邻：国家筛选 / 国家标签）
  const rebuilt = {};
  for (const k of Object.keys(ns)) {
    rebuilt[k] = ns[k];
    if (k === "countryLabel") rebuilt.allCountries = TEXT[loc];
  }
  if (!("allCountries" in rebuilt)) rebuilt.allCountries = TEXT[loc];
  d.clusters = rebuilt;
  writeFileSync(file, JSON.stringify(d, null, 2) + "\n", "utf8");
  leavesAfter[loc] = countLeaves(JSON.parse(readFileSync(file, "utf8")));
  dictReport.push(`${loc}: +allCountries (${leavesBefore[loc]} → ${leavesAfter[loc]})`);
}

// ---------- ② 门禁常量同步 ----------
const GATE_FILES = [
  "RELEASE-RULES.md",
  "scripts/verify-opennext-bundle.mjs",
  "scripts/cs06a-directory-regression.ts",
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
  // 非门禁但引用当前常量值的注释（保持文档不撒谎）
  "lib/supplierCompleteness.ts",
];

const gateReport = [];
for (const f of GATE_FILES) {
  if (!existsSync(f)) {
    gateReport.push(`${f}: MISSING`);
    continue;
  }
  const s = readFileSync(f, "utf8");
  let n = 0;
  const lines = s.split("\n").map((line) => {
    if (line.includes("→")) return line; // 历史 changelog 行：原样保留
    const after = line.split("2939").join("2940").split("2935").join("2936");
    if (after !== line) n++;
    return after;
  });
  if (n > 0) {
    writeFileSync(f, lines.join("\n"), "utf8");
    gateReport.push(`${f}: ${n} 处已更新`);
  } else {
    gateReport.push(`${f}: 无 2939/2935`);
  }
}

console.log("=== 字典 ===");
console.log(dictReport.join("\n"));
console.log("\n=== 门禁常量 ===");
console.log(gateReport.join("\n"));
console.log("\n=== 叶子数一致性 ===");
for (const loc of LOCALES) {
  console.log(`${loc}: before=${leavesBefore[loc]} after=${leavesAfter[loc]}`);
}
