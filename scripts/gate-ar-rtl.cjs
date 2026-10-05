#!/usr/bin/env node
/**
 * scripts/gate-ar-rtl.cjs —— 门禁④：阿拉伯语规范门（只读）
 *
 * 扫描对象：`i18n/dictionaries/ar.json` 的全部取值 + `lib/contentI18n/ar.json` 的全部取值。
 * 判据（仅当取值含阿拉伯字母时生效）：
 *   R1 非规范问号：ASCII `?` 出现在阿拉伯文中（阿拉伯文句末问号必须是 ؟ U+061F）；
 *                  以及 `؟?` / `?؟` 混排。
 *   R2 双向控制字符：U+200E / U+200F / U+202A–U+202E / U+2066–U+2069。
 *   R3 标点前有空格：取值以 ؟ . , ! 结尾，但前一字符是空格（排版脏数据）。
 *   R4 ASCII 逗号/分号夹在阿拉伯字母之间（阿拉伯文应用 ، U+060C / ؛ U+061B）。
 *
 * 用法：
 *   node scripts/gate-ar-rtl.cjs
 *   node scripts/gate-ar-rtl.cjs --selftest
 *   node scripts/gate-ar-rtl.cjs --verbose
 *
 * 退出码：0 全通过 / 1 发现违规 / 2 数据缺失。
 */

const fs = require("fs");
const path = require("path");
const L = require("./gate-i18n-lib.cjs");

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");

const AR_LETTER = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const BIDI = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
const RULES = {
  R1: "非规范问号（阿拉伯文里出现 ASCII ? / ؟? 混排）",
  R2: "双向控制字符（U+200E/F、U+202A-E、U+2066-9）",
  R3: "标点前有空格（؟/./,/! 结尾但前一字符是空白）",
  R4: "ASCII 逗号/分号夹在阿拉伯字母之间（应用 ، / ؛）",
};

/** 纯函数核心：返回该取值命中的规则清单 */
function checkArabicValue(v) {
  const s = String(v == null ? "" : v);
  const hits = [];
  if (!AR_LETTER.test(s)) return hits; // 纯英文 / 专名 → 不适用本门
  if (/[؟][?]|[?][؟]/.test(s)) hits.push("R1");
  else if (AR_LETTER.test(s) && /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF][\s]*[?]/.test(s)) hits.push("R1");
  if (BIDI.test(s)) hits.push("R2");
  if (/[ \t\u00A0][؟.,!]\s*$/.test(s)) hits.push("R3");
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF][ \t]*[,;][ \t]*[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(s))
    hits.push("R4");
  return hits;
}

/** 收集待扫（source, key, value）三元组 */
function collectEntries() {
  const entries = [];
  const arDict = path.join(L.DICT_DIR, "ar.json");
  if (!fs.existsSync(arDict)) {
    console.error(`[gate-ar-rtl] 数据缺失：找不到 ${arDict}`);
    process.exit(2);
  }
  const flat = L.flatten(JSON.parse(fs.readFileSync(arDict, "utf8")));
  for (const k of Object.keys(flat)) {
    if (typeof flat[k] === "string") entries.push({ source: "i18n/dictionaries/ar.json", key: k, value: flat[k] });
  }
  const arContent = path.join(L.CONTENT_DIR, "ar.json");
  if (fs.existsSync(arContent)) {
    const cm = JSON.parse(fs.readFileSync(arContent, "utf8"));
    for (const k of Object.keys(cm)) {
      if (typeof cm[k] === "string")
        entries.push({ source: "lib/contentI18n/ar.json", key: k.slice(0, 80), value: cm[k] });
    }
  }
  return entries;
}

/** 纯函数核心：批量检查 */
function scan(entries) {
  const out = [];
  for (const e of entries) {
    const hits = checkArabicValue(e.value);
    if (hits.length) out.push({ ...e, rules: hits, value: e.value.slice(0, 140) });
  }
  return out;
}

function main() {
  const entries = collectEntries();
  console.log(`\n${"=".repeat(74)}`);
  console.log("门禁④ 阿拉伯语规范（RTL）");
  console.log(`${"=".repeat(74)}`);
  console.log(`扫描取值：${entries.length} 条（ar 字典 + contentI18n/ar）`);

  const violations = scan(entries);
  const byRule = {};
  for (const v of violations) for (const r of v.rules) byRule[r] = (byRule[r] || 0) + 1;
  console.log("\n各规则命中数：");
  for (const r of Object.keys(RULES)) console.log(`  ${r} ${RULES[r]}：${byRule[r] || 0}`);
  console.log(`\n合计违规：${violations.length} 条`);
  const show = VERBOSE ? violations : violations.slice(0, 30);
  for (const v of show)
    console.log(`  ✗ [${v.rules.join(",")}] ${v.source} :: ${v.key}\n      ${v.value}`);
  if (!VERBOSE && violations.length > show.length)
    console.log(`  …（共 ${violations.length} 条，--verbose 看全部）`);

  if (violations.length > 0) {
    console.log("\n❌ 门禁④ 未通过");
    process.exit(1);
  }
  console.log("\n✅ 门禁④ 通过");
  process.exit(0);
}

// ─────────────────────────────────────────────
// 自证
// ─────────────────────────────────────────────
function selftest() {
  const { check, done } = L.makeCheck();
  console.log("\n门禁④ gate-ar-rtl --selftest");

  console.log("\n── 阳性对照（指定）：阿拉伯文句末用 ASCII ? ⇒ 必须 FAIL ──");
  check("『هل هذا صحيح؟?』命中 R1", checkArabicValue("هل هذا صحيح؟?").includes("R1"));

  console.log("\n── 阴性对照（指定）：规范阿拉伯问号 ⇒ 必须 PASS ──");
  check("『هل هذا صحيح؟』不命中", checkArabicValue("هل هذا صحيح؟").length === 0);

  console.log("\n── 阳性对照：其它规则 ──");
  check("ASCII ? 结尾 → R1", checkArabicValue("هل هذا صحيح ?").includes("R1"));
  check("仅 ASCII ? 的阿拉伯句 → R1", checkArabicValue("كم السعر?").includes("R1"));
  check("双向控制字符 U+200F → R2", checkArabicValue("مرحبا\u200F بالعالم").includes("R2"));
  check("双向控制字符 U+202E → R2", checkArabicValue("مرحبا\u202E").includes("R2"));
  check("标点前空格（نهائي ؟）→ R3", checkArabicValue("هل أنت متأكد ؟").includes("R3"));
  check("ASCII 逗号夹在阿拉伯字母间 → R4", checkArabicValue("المورد, الشركة").includes("R4"));
  check("ASCII 分号夹在阿拉伯字母间 → R4", checkArabicValue("المورد; الشركة").includes("R4"));

  console.log("\n── 阴性对照：正常阿拉伯文 ⇒ 必须 PASS ──");
  check(
    "含规范 ، ؛ ؟ 的阿拉伯文不命中",
    checkArabicValue("هل تحققت من الشركة؟ نعم، تحققنا؛ والنتيجة إيجابية.").length === 0
  );
  check("阿拉伯文含拉丁专名 ISO 9001 不命中", checkArabicValue("شهادة ISO 9001 صالحة.").length === 0);
  check("英文取值不命中（本门不适用）", checkArabicValue("We verify factories in Asia?").length === 0);
  check("空串不命中", checkArabicValue("").length === 0);

  return done("门禁④ 自检结果");
}

if (argv.includes("--selftest")) process.exit(selftest());
else main();
