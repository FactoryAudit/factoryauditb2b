// 把 lib/verification.ts 里硬编码英文的 NOT_COVERED 迁到字典。
// 该清单现在被供应商详情页与监控页共用，硬编码英文会在 8 个非英文站点上露出来。
// en / zh 手写，其余英文回退。
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const LOCALES = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

const en = [
  "Financial statements",
  "Product performance in use",
  "Current production utilisation",
  "Subcontractors that were not disclosed to us",
];

const zh = [
  "财务报表",
  "产品在实际使用中的表现",
  "当前产能利用率",
  "未向我们披露的外协工厂",
];

const VALUES = { en, zh, es: en, de: en, fr: en, pt: en, ja: en, "zh-TW": en, ar: en };

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!dict.verification) throw new Error(`${locale}.json 缺少 verification 块`);
  dict.verification.notCovered = [...VALUES[locale]];
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`  updated ${locale}.json (${dict.verification.notCovered.length} items)`);
}
console.log("\nnotCovered dict applied");
