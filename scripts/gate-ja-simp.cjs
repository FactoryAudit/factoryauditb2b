#!/usr/bin/env node
/**
 * scripts/gate-ja-simp.cjs —— 门禁⑤：日语简体字门（只读）
 *
 * 扫描对象：`i18n/dictionaries/ja.json` 的全部取值 + `lib/contentI18n/ja.json` 的全部取值。
 * 判据（两路信号，见 gate-i18n-lib.cjs scanSimplifiedInJa）：
 *   ① 简体中文词表命中（ZH_WORDS）—— 对 JA 近乎零误报，日语不会出现这些词；
 *   ② 汉字串里出现简体专用字形（SIMPLIFIED_ONLY，**运行时从 _i18n_leak_scan.cjs 解析**）。
 *
 * 白名单（已知误报，日本新字体就是这些写法）：写 / 制 / 号 / 双 / 黄 / 内（外加 JA_ALLOW）。
 * 因此：『工場写真』必须 PASS、『生产制造』必须 FAIL。
 *
 * 用法：
 *   node scripts/gate-ja-simp.cjs
 *   node scripts/gate-ja-simp.cjs --selftest
 *   node scripts/gate-ja-simp.cjs --verbose
 *
 * 退出码：0 全通过 / 1 发现违规 / 2 数据缺失。
 */

const fs = require("fs");
const path = require("path");
const L = require("./gate-i18n-lib.cjs");

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");

/** 供应商原文 / 专名白名单：含公司后缀的供应商原名原样保留；语言中立项跳过 */
const COMPANY_SUFFIX_RE = /(有限公司|股份|集团|科技|工业|制造有限公司)/;

/**
 * 说明（team-lead 决策 3 收尾）：原先为 GSXT「国家企業信用信息公示系統 / 国家企业信用信息公示系统」
 * 加的专名白名单，在内容层把 `信用信息` → `信用情報` 之后**已无任何值匹配（死条目）**，故整体删除
 * —— 留着会掩盖未来把该专名写回简体「信息」的回归。
 * 判据本身不变：只要出现简体词表命中或简体专用字形就 FAIL。
 */
function isSupplierOriginal(v) {
  const s = String(v).trim();
  if (L.isNeutralValue(s)) return true;
  if (COMPANY_SUFFIX_RE.test(s)) return true;
  return false;
}

function collectEntries() {
  const entries = [];
  const jaDict = path.join(L.DICT_DIR, "ja.json");
  if (!fs.existsSync(jaDict)) {
    console.error(`[gate-ja-simp] 数据缺失：找不到 ${jaDict}`);
    process.exit(2);
  }
  const flat = L.flatten(JSON.parse(fs.readFileSync(jaDict, "utf8")));
  for (const k of Object.keys(flat)) {
    if (typeof flat[k] === "string") entries.push({ source: "i18n/dictionaries/ja.json", key: k, value: flat[k] });
  }
  const jaContent = path.join(L.CONTENT_DIR, "ja.json");
  if (fs.existsSync(jaContent)) {
    const cm = JSON.parse(fs.readFileSync(jaContent, "utf8"));
    for (const k of Object.keys(cm)) {
      if (typeof cm[k] === "string")
        entries.push({ source: "lib/contentI18n/ja.json", key: k.slice(0, 80), value: cm[k] });
    }
  }
  return entries;
}

/** 纯函数核心 */
function scan(entries) {
  const out = [];
  for (const e of entries) {
    if (isSupplierOriginal(e.value)) continue;
    const hits = L.scanSimplifiedInJa(e.value);
    if (hits.length) out.push({ ...e, hits, value: e.value.slice(0, 140) });
  }
  return out;
}

function main() {
  const entries = collectEntries();
  console.log(`\n${"=".repeat(74)}`);
  console.log("门禁⑤ 日语简体字");
  console.log(`${"=".repeat(74)}`);
  console.log(`扫描取值：${entries.length} 条（ja 字典 + contentI18n/ja）`);

  const violations = scan(entries);
  const byLoc = {}; // 按来源
  for (const v of violations) byLoc[v.source] = (byLoc[v.source] || 0) + 1;
  console.log("\n各来源命中数：");
  for (const s of Object.keys(byLoc)) console.log(`  ${s}：${byLoc[s]}`);
  console.log(`\n合计违规：${violations.length} 条`);
  const show = VERBOSE ? violations : violations.slice(0, 30);
  for (const v of show)
    console.log(`  ✗ ${v.source} :: ${v.key}\n      ${v.value}\n      → ${v.hits.join("; ")}`);
  if (!VERBOSE && violations.length > show.length)
    console.log(`  …（共 ${violations.length} 条，--verbose 看全部）`);

  if (violations.length > 0) {
    console.log("\n❌ 门禁⑤ 未通过");
    process.exit(1);
  }
  console.log("\n✅ 门禁⑤ 通过");
  process.exit(0);
}

// ─────────────────────────────────────────────
// 自证
// ─────────────────────────────────────────────
function selftest() {
  const { check, done } = L.makeCheck();
  console.log("\n门禁⑤ gate-ja-simp --selftest");

  console.log("\n── 复用证明：SIMPLIFIED_ONLY 由 _i18n_leak_scan.cjs 运行时解析 ──");
  check(`集合已加载（${L.SIMPLIFIED_ONLY.size} 字）`, L.SIMPLIFIED_ONLY.size > 100);
  check("集合含『写』（与真源一致）", L.SIMPLIFIED_ONLY.has("写"));
  check("集合不含『号/双/黄/内』（真源已剔除）", !["号", "双", "黄", "内"].some((c) => L.SIMPLIFIED_ONLY.has(c)));

  console.log("\n── 阳性对照（指定）：生产制造 ⇒ 必须 FAIL ──");
  check("『生产制造』命中", L.scanSimplifiedInJa("生产制造").length > 0);
  check("『核查供应商资质的完整流程』命中", L.scanSimplifiedInJa("核查供应商资质的完整流程").length > 0);
  check("简体字形『网络』命中", L.scanSimplifiedInJa("网络").length > 0);

  console.log("\n── 阴性对照（指定）：工場写真 ⇒ 必须 PASS ──");
  check("『工場写真』不命中（写为日语合法字形）", L.scanSimplifiedInJa("工場写真").length === 0);

  console.log("\n── 阴性对照：已知日语合法写法 / 正常日语 ──");
  check("『番号 双方向 黄色 内容』不命中", L.scanSimplifiedInJa("番号 双方向 黄色 内容").length === 0);
  check("『製造工程の管理』不命中", L.scanSimplifiedInJa("製造工程の管理").length === 0);
  check("『サプライヤーの品質管理と工場監査』不命中", L.scanSimplifiedInJa("サプライヤーの品質管理と工場監査").length === 0);
  check("『ISO 9001 認証を取得した工場』不命中", L.scanSimplifiedInJa("ISO 9001 認証を取得した工場").length === 0);
  console.log("\n── 阳性对照（决策 3 收尾）：GSXT 旧写法夹在日语句中 ⇒ 必须 FAIL ──");
  check(
    "『…国家企業信用信息公示系統で当該法人を照会します。』⇒ 不跳过（判据在旧写法上会 FAIL）",
    !isSupplierOriginal("営業許可証に記載された中国語名を求めたうえで、国家企業信用信息公示系統で当該法人を照会します。")
  );
  check(
    "整条『国家企業信用信息公示系統』⇒ 也不再豁免（白名单已删）",
    !isSupplierOriginal("国家企業信用信息公示系統")
  );
  check(
    "整条『国家企業信用信息公示系統（gsxt.gov.cn）』⇒ 不再豁免",
    !isSupplierOriginal("国家企業信用信息公示系統（gsxt.gov.cn）")
  );
  check("供应商原文白名单：『江门志宇科技』跳过", isSupplierOriginal("江门志宇科技"));

  return done("门禁⑤ 自检结果");
}

if (argv.includes("--selftest")) process.exit(selftest());
else main();
