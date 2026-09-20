/**
 * STEP-04 —— Supplier Profile 展示「地理大区 + 产业带」所需的 2 个行标签键（九语，幂等）。
 *
 * 为什么需要脚本而不是手改 9 个 JSON：
 *   与 apply-cs12-i18n.cjs 等既有脚本同一约定 —— 幂等注入 + 九语键集一致性自检，
 *   避免"改了 8 个语言漏了 1 个"，也避免后续重复执行把译文覆盖回英文。
 *
 * 新增键（supplierProfile 命名空间，沿用 industryLabel / businessTypeLabel 的 `*Label` 命名）：
 *   · supplierProfile.regionLabel            → Buyer Snapshot 的「地理大区」行
 *   · supplierProfile.industrialClusterLabel → Buyer Snapshot 的「产业带」行
 *
 * 🔴 副作用（必须同步处理，见脚本末尾自检输出）：
 *   九语 en 字典叶子数 2825 → 2827。项目把该数字作为**冻结常量**写在：
 *     scripts/verify-opennext-bundle.mjs（发布门禁）、cs06a C8、cs08 G4、
 *     cs12 E4、cs13 F1i、cs16 A1-A6、cs17 A1-A6、cs20 A1
 *   加键后这些常量必须同改（本 CS 已一并同步为 2827）。
 *
 * 跑法：node scripts/apply-step04-i18n.cjs
 */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");

const K = {
  en: { regionLabel: "Region", industrialClusterLabel: "Industrial cluster" },
  zh: { regionLabel: "地区", industrialClusterLabel: "产业带" },
  "zh-TW": { regionLabel: "地區", industrialClusterLabel: "產業帶" },
  ja: { regionLabel: "地域", industrialClusterLabel: "産業クラスター" },
  es: { regionLabel: "Región", industrialClusterLabel: "Clúster industrial" },
  de: { regionLabel: "Region", industrialClusterLabel: "Industriecluster" },
  fr: { regionLabel: "Région", industrialClusterLabel: "Cluster industriel" },
  pt: { regionLabel: "Região", industrialClusterLabel: "Clúster industrial" },
  ar: { regionLabel: "المنطقة", industrialClusterLabel: "التجمع الصناعي" },
};

const LOCALES = Object.keys(K);
let changed = 0;

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  if (!fs.existsSync(file)) {
    console.log(`SKIP  ${locale}（文件不存在）`);
    continue;
  }
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!obj.supplierProfile) {
    console.log(`WARN  ${locale} 缺 supplierProfile 命名空间，跳过该语言`);
    continue;
  }

  let added = 0;
  for (const [k, v] of Object.entries(K[locale])) {
    if (k in obj.supplierProfile) continue; // 幂等：不覆盖既有译文
    obj.supplierProfile[k] = v;
    added++;
  }

  if (added === 0) {
    console.log(`SKIP  ${locale}（已全部存在）`);
    continue;
  }

  const out = JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  changed++;
  console.log(`OK    ${locale}.json 新增 ${added} 键（supplierProfile）`);
}

// ---- 叶子数实测（en 为单一事实源，算法与 cs06a C7 的 leaves() 完全一致）----
function leaves(obj, prefix = "", out = []) {
  if (obj === null || typeof obj !== "object") {
    out.push(prefix);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    leaves(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const en = JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8"));
const enLeaves = leaves(en);
/** 叶子类型分布（cs06a 的注释用它说明「= 2823 字符串 + 4 boolean」） */
function leafTypes(o) {
  if (o === null || typeof o !== "object") return [typeof o];
  if (Array.isArray(o)) return o.flatMap(leafTypes);
  return Object.values(o).flatMap(leafTypes);
}
const types = leafTypes(en);
const nStr = types.filter((t) => t === "string").length;
const nBool = types.filter((t) => t === "boolean").length;
console.log(`\n完成：${changed}/${LOCALES.length} 个语言文件被修改`);
console.log(`en 叶子数 = ${enLeaves.length}（= ${nStr} 字符串 + ${nBool} boolean）`);
console.log(`  ← 必须同步 verify-opennext-bundle.mjs 与各 CS 回归常量`);

// ---- 九语键集一致性自检（getDictionary 无深 fallback，键集必须严格一致）----
const enKeys = JSON.stringify(Object.keys(en.supplierProfile).sort());
let mismatch = 0;
for (const locale of LOCALES) {
  const o = JSON.parse(fs.readFileSync(path.join(DIR, `${locale}.json`), "utf8"));
  const keys = JSON.stringify(Object.keys(o.supplierProfile || {}).sort());
  if (keys !== enKeys) {
    mismatch++;
    console.log(`  🔴 ${locale} 的 supplierProfile 键集与 en 不一致`);
  }
}
console.log(
  mismatch === 0
    ? "九语 supplierProfile 键集一致 ✓"
    : `键集不一致语言数 = ${mismatch}`
);
