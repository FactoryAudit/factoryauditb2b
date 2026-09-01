// scripts/lock-brand-terms.cjs (v3)
// 只锁「品牌名 / 行业缩写」类键。UI 页面标题一律不锁——它们必须跟随语言，
// 翻译由 scripts/apply-highvalue-i18n.cjs（手写）与 translate-deepseek.cjs（批量）负责。
// v3 变更：从清单剔除全部 UI 标题键（home/toolsIndex/toolCards/servicesIndex/
// pricing/risk.dimensions/verification/inspection/trust/footer），
// 此前把可见标题锁成英文是英文残留的直接根源之一。
const fs = require("fs");
const path = require("path");
const D = path.join(process.cwd(), "i18n", "dictionaries");
const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));

/** 完整的"必须英文"key 路径清单（只含品牌/缩写） */
const KEEP_EN_PATHS = [
  // 品牌
  "brand.name", "brand.eva", "brand.tagline",
  // 行业缩写：翻译了反而没人认得
  "nav.rfq",
];

const LANGS = ["es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

function readPath(obj, dotted) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}
function setPath(obj, dotted, val) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

let totalReset = 0;
for (const lang of LANGS) {
  const p = path.join(D, lang + ".json");
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  let changed = 0;
  for (const key of KEEP_EN_PATHS) {
    const want = readPath(en, key);
    if (want === undefined) continue;
    const have = readPath(d, key);
    if (have !== want) {
      setPath(d, key, want);
      changed++;
    }
  }
  if (changed > 0) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n", "utf8");
    console.log(`[${lang}] reset ${changed} brand terms to en`);
    totalReset += changed;
  } else {
    console.log(`[${lang}] ok`);
  }
}
console.log(`total: ${totalReset} terms reset across 7 langs`);