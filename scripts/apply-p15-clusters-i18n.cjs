#!/usr/bin/env node
/**
 * scripts/apply-p15-clusters-i18n.cjs —— P1-15 收口：clusters 命名空间新增 provinceLabel / cityLabel
 *
 * 用途：给 9 语字典的 clusters 命名空间注入 2 个标签键，并在注入后**自动同步**
 *       所有 en 叶子数冻结常量（沿用 apply-cs23-compliance-i18n.cjs 的机制，不手改断言脚本）。
 *
 * 用法：
 *   node scripts/apply-p15-clusters-i18n.cjs            # dry-run（默认，不写盘）
 *   node scripts/apply-p15-clusters-i18n.cjs --apply     # 写入
 *   node scripts/apply-p15-clusters-i18n.cjs --selftest  # 阴性对照（注入空值，闸门必须 FAIL）
 *
 * 铁律（沿用既有 apply 脚本）：
 *   1. 字典必须**纯 CRLF + 末尾 CRLF**（已验证 9 语 round-trip 逐字节无损）。
 *   2. 幂等：已存在的键不覆盖（--overwrite 才覆盖）。
 *   3. OLD 叶子数从 RELEASE-RULES.md「当前基线：**NNNN**」读（单一事实源）。
 *   4. 历史 changelog 行（含 "→ OLD" 且非「常量 →」）不改 —— 见 isHistorical()。
 *   5. 排除 scripts/_*（历史快照）与 step13b-i18n-gates.cjs（更早那次 clusters 迁移脚本）、
 *      sync-contact-gates.cjs（3258→3288 那次的历史脚本，禁改）。
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const DICT_DIR = path.join(ROOT, "i18n/dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes("--apply");
const SELFTEST = ARGS.includes("--selftest");
const OVERWRITE = ARGS.includes("--overwrite");

const NS = "clusters";
const KEYS = ["clusters.provinceLabel", "clusters.cityLabel"];

// ============================================================================
// 文案（9 语人工撰写）。en 是唯一源串口径 ⇒ en 用 "Province" / "City"。
// 与同列表既有 countryLabel/regionLabel/industryLabel 同构。
// ============================================================================
const TRANS = {
  en: { "clusters.provinceLabel": "Province", "clusters.cityLabel": "City" },
  zh: { "clusters.provinceLabel": "省份", "clusters.cityLabel": "城市" },
  "zh-TW": { "clusters.provinceLabel": "省份", "clusters.cityLabel": "城市" },
  ja: { "clusters.provinceLabel": "省", "clusters.cityLabel": "市" },
  es: { "clusters.provinceLabel": "Provincia", "clusters.cityLabel": "Ciudad" },
  de: { "clusters.provinceLabel": "Provinz", "clusters.cityLabel": "Stadt" },
  fr: { "clusters.provinceLabel": "Province", "clusters.cityLabel": "Ville" },
  pt: { "clusters.provinceLabel": "Província", "clusters.cityLabel": "Cidade" },
  ar: { "clusters.provinceLabel": "المحافظة", "clusters.cityLabel": "المدينة" },
};

// ============================================================================
// 常量同步白名单（与 apply-cs23 同源；不含历史迁移脚本）
// ============================================================================
const BUNDLE = (name) => `scripts/.${name}.bundle.cjs`;
const GATE_FILES = [
  "RELEASE-RULES.md",
  "scripts/apply-cs22b-i18n.cjs",
  "scripts/cs06a-directory-regression.ts",
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs13b-cluster-directory-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
  "scripts/cs22a-public-profile-regression.ts",
  "scripts/cs22b-self-assessment-regression.ts",
  "scripts/verify-opennext-bundle.mjs",
  BUNDLE("cs06a-directory-regression"),
  BUNDLE("cs08-form-regression"),
  BUNDLE("cs12-profile-regression"),
  BUNDLE("cs13-supplier-seo-regression"),
  BUNDLE("cs13b-cluster-directory-regression"),
  BUNDLE("cs16-supplier-mgmt-regression"),
  BUNDLE("cs17-commerce-regression"),
  BUNDLE("cs20-supplier-report"),
  BUNDLE("cs22a-public-profile-regression"),
  BUNDLE("cs22b-self-assessment-regression"),
];

// ============================================================================
// 工具
// ============================================================================
function setPath(root, dotted, value) {
  const segs = dotted.split(".");
  let cur = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    if (cur[s] === undefined) cur[s] = {};
    cur = cur[s];
  }
  cur[segs[segs.length - 1]] = value;
}
function getPath(root, dotted) {
  let cur = root;
  for (const s of dotted.split(".")) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[s];
  }
  return cur;
}
function countLeaves(o) {
  let n = 0;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v !== null && typeof v === "object") n += countLeaves(v);
    else n++;
  }
  return n;
}
function serialize(obj, eol) {
  return JSON.stringify(obj, null, 2).replace(/\r\n/g, "\n").replace(/\n/g, eol) + eol;
}

// ============================================================================
// 闸门
// ============================================================================
let gateFail = 0;
const gateMsg = (okFlag, msg) => {
  if (!okFlag) {
    gateFail++;
    console.error("❌ " + msg);
  } else {
    console.log("✅ " + msg);
  }
};

// G0 —— TRANS 键集 == KEYS
for (const loc of LOCALES) {
  const got = Object.keys(TRANS[loc]).sort().join("|");
  gateMsg(got === [...KEYS].sort().join("|"), `G0 ${loc} 译文键集 == 题面 KEYS`);
}

// G1 —— 每个字典纯 CRLF + 末尾 CRLF（写前）
for (const loc of LOCALES) {
  const s = fs.readFileSync(path.join(DICT_DIR, `${loc}.json`), "utf8");
  gateMsg(s.endsWith("\r\n") && !/(?<!\r)\n/.test(s), `G1 ${loc}.json 纯 CRLF + 末尾 CRLF`);
}

// G2 —— round-trip 无损（保证 diff 只有新增键）
for (const loc of LOCALES) {
  const file = path.join(DICT_DIR, `${loc}.json`);
  const s = fs.readFileSync(file, "utf8");
  const eol = s.includes("\r\n") ? "\r\n" : "\n";
  gateMsg(serialize(JSON.parse(s), eol) === s, `G2 ${loc}.json 重序列化逐字节无损`);
}

// ============================================================================
// 注入（内存）
// ============================================================================
const injectedTotal = {};
const inMemory = {};
for (const loc of LOCALES) {
  const file = path.join(DICT_DIR, `${loc}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  let added = 0;
  for (const k of KEYS) {
    let v = TRANS[loc][k];
    if (SELFTEST) v = ""; // 阴性对照：注入空值 ⇒ G4 必须 FAIL
    const existing = getPath(dict, k);
    if (existing !== undefined && !OVERWRITE) continue;
    if (existing === v) continue;
    setPath(dict, k, v);
    added++;
  }
  inMemory[loc] = dict;
  injectedTotal[loc] = added;
}

// G3 —— 幂等（已有 2 键 ⇒ added 0；dry-run/--apply 均成立）。仅提示。
console.log(
  `G3 注入数 ${LOCALES.map((l) => `${l}:+${injectedTotal[l]}`).join(" ")}` +
    (Object.values(injectedTotal).every((n) => n === 0) ? "（幂等：键已存在）" : "")
);

// G4 —— 9 语键集一致 + 2 键非空
const enKeys = Object.keys(inMemory.en[NS]).sort().join("|");
for (const loc of LOCALES) {
  const d = inMemory[loc];
  const locKeys = Object.keys(d[NS]).sort().join("|");
  if (locKeys !== enKeys) gateMsg(false, `G4 ${loc} clusters 键集与 en 不一致`);
  for (const k of KEYS) {
    const v = getPath(d, k);
    if (typeof v !== "string" || v.trim() === "") gateMsg(false, `G4 ${loc}.${k} 空值/非字符串`);
  }
}
if (gateFail === 0) console.log("✅ G4 9 语 clusters 键集一致 + 2 键非空");

// G5 —— 新叶子数
const newLeaves = countLeaves(inMemory.en);
console.log(`G5 en 叶子数 = ${newLeaves}${SELFTEST ? "（selftest）" : ""}`);

// ============================================================================
// 写盘
// ============================================================================
if (APPLY) {
  for (const loc of LOCALES) {
    const file = path.join(DICT_DIR, `${loc}.json`);
    const s0 = fs.readFileSync(file, "utf8");
    const eol = s0.includes("\r\n") ? "\r\n" : "\n";
    fs.writeFileSync(file, serialize(inMemory[loc], eol), "utf8");
  }
  console.log(`\n[--apply] 已写盘 ${LOCALES.length} 个字典`);
} else {
  console.log("\n[DRY-RUN] 未写盘（加 --apply 生效）");
}

// ============================================================================
// 常量同步（写盘时执行）
// ============================================================================
const RULES = path.join(ROOT, "RELEASE-RULES.md");
const rulesSrc = fs.readFileSync(RULES, "utf8");
const m = rulesSrc.match(/当前基线：\*\*(\d+)\*\*/);
if (!m) {
  console.error("❌ 无法从 RELEASE-RULES.md 读到「当前基线：**NNNN**」，中止同步");
  process.exit(1);
}
const OLD = m[1];
const NEW = String(newLeaves);

/** 历史 changelog 行：含「→ OLD」但不是「常量 → OLD」的目标值写法 */
const isHistorical = (line) =>
  new RegExp("→\\s*\\*{0,2}" + OLD).test(line) && !/常量\s*→/.test(line);

const replacedList = [];
const residual = [];
const resultText = {};
for (const rel of GATE_FILES) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) continue;
  const src = fs.readFileSync(fp, "utf8");
  if (!src.includes(OLD)) continue;
  let out;
  if (rel === "RELEASE-RULES.md") {
    out = src.split(OLD).join(NEW); // 当前基线 + 历史尾部两处都是当前值
  } else {
    out = src
      .split("\n")
      .map((line) => {
        if (!line.includes(OLD)) return line;
        if (isHistorical(line)) return line; // 历史记录，禁改
        return line.split(OLD).join(NEW);
      })
      .join("\n");
  }
  // cs06a C7 注释里的构成说明同步（纯注释，不影响断言）
  out = out.split("= 3284 字符串 + 4 boolean").join("= 3286 字符串 + 4 boolean");
  if (APPLY) fs.writeFileSync(fp, out, "utf8");
  replacedList.push(rel);
  resultText[rel] = out;

  // 残留检查（用最终文本，确保真实生效）
  const after = out;
  after.split("\n").forEach((line, i) => {
    if (line.includes(OLD) && !isHistorical(line)) {
      residual.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
    }
  });
}

// G6 —— 12 文件含 NEW 且无非法残留
console.log("");
console.log(`G6 en 叶子数: ${OLD} → ${NEW}（Δ=+${Number(NEW) - Number(OLD)}）`);
console.log(`   常量同步文件数: ${replacedList.length}`);
replacedList.sort().forEach((f) => console.log(`     · ${f}`));
gateMsg(
  residual.length === 0,
  `G6 无非法残留旧值（仅允许历史 changelog 行保留）` +
    (residual.length ? "\n     " + residual.join("\n     ") : "")
);
for (const rel of [
  "RELEASE-RULES.md",
  "scripts/cs06a-directory-regression.ts",
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs13b-cluster-directory-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
  "scripts/cs22a-public-profile-regression.ts",
  "scripts/cs22b-self-assessment-regression.ts",
  "scripts/verify-opennext-bundle.mjs",
]) {
  const fp = path.join(ROOT, rel);
  const txt = resultText[rel] ?? fs.readFileSync(fp, "utf8");
  gateMsg(txt.includes(NEW), `G6 ${rel} 含新值 ${NEW}`);
}

console.log("");
console.log(gateFail === 0 ? "APPLY_P15_OK" : `APPLY_P15_CHECK（${gateFail} 项失败）`);
process.exitCode = gateFail === 0 ? 0 : 1;
