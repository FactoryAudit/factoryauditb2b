// P1-10：Supplier Profile 升级所需的字典键。
// 9 语言策略沿用项目惯例：en / zh 手写，其余英文回退。
// 只补缺键，不覆盖已存在的值（幂等，可重复运行）。
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const LOCALES = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

const en = {
  riskScore: "Risk score",
  scoreDirection: "Higher score means lower risk.",
  lastChecked: "Last checked",
  noCheckRecord: "No check on record",
  recVerified:
    "Evidence on record covers the items listed above. Re-check the scope against your order before releasing a deposit, and refresh the record if the last check is more than 12 months old.",
  recUnverified:
    "Verify the factory address and request recent quality and audit records before placing a large order or releasing a deposit.",
};

const zh = {
  riskScore: "风险分数",
  scoreDirection: "分数越高，风险越低。",
  lastChecked: "最近核验",
  noCheckRecord: "暂无核验记录",
  recVerified:
    "上述条目已有记录可查。付定金前请对照订单复核核验范围；若最近一次核验已超过 12 个月，建议重新核验。",
  recUnverified:
    "下大单或付定金前，先核验工厂地址，并索取近期的质量与审核记录。",
};

const VALUES = {
  en,
  zh,
  es: en,
  de: en,
  fr: en,
  pt: en,
  ja: en,
  "zh-TW": en,
  ar: en,
};

let changed = 0;
for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!dict.supplierProfile) {
    throw new Error(`${locale}.json 缺少 supplierProfile 块`);
  }
  let dirty = false;
  for (const [key, value] of Object.entries(VALUES[locale])) {
    if (dict.supplierProfile[key] !== value) {
      dict.supplierProfile[key] = value;
      dirty = true;
    }
  }
  if (dirty) {
    fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
    changed += 1;
    console.log(`  updated ${locale}.json`);
  } else {
    console.log(`  skip    ${locale}.json (no change)`);
  }
}
console.log(`\nP1-10 dict applied: ${changed} file(s) changed`);
