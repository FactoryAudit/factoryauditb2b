/**
 * 字典翻译覆盖率审计（只读）。
 *
 * 与 i18n-leak-scan.cjs 的分工：
 *   - i18n-leak-scan.cjs：扫**渲染后的页面**，找用户实际看到的英文
 *   - 本脚本：扫**字典文件本身**，按命名空间统计「仍等于英文」的条目数
 *
 * 注意：必须展开数组再比较。早期版本把数组当叶子值用 === 比较，
 * 两个数组引用永不相等，导致 pricing.plans 这类大块内容被误判成「已翻译」。
 *
 * 用法：
 *   node scripts/i18n-coverage.cjs                 # 全部语言概览
 *   node scripts/i18n-coverage.cjs --lang=ja       # 指定语言
 *   node scripts/i18n-coverage.cjs --ns=pricing    # 只看某个命名空间
 *   node scripts/i18n-coverage.cjs --list=pricing  # 列出该命名空间下未翻译的键
 */
const fs = require("fs");
const path = require("path");

const D = path.join(__dirname, "..", "i18n", "dictionaries");
const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split("=")[1] : d;
};
const ONLY_LANG = arg("lang", "") ? arg("lang", "").split(",") : null;
const ONLY_NS = arg("ns", "") ? arg("ns", "").split(",") : null;
const LIST_NS = arg("list", "");

const LANGS = ["zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];

/** 数组按下标展开，才能真正比较 pricing.plans.0.features.1 这类值 */
function flat(obj, prefix = "", out = {}) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === "object") flat(item, `${p}.${i}`, out);
        else out[`${p}.${i}`] = item;
      });
    } else if (v && typeof v === "object") {
      flat(v, p, out);
    } else {
      out[p] = v;
    }
  }
  return out;
}

const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));
const enFlat = flat(en);
const allKeys = Object.keys(enFlat);

console.log(`en 叶子键总数：${allKeys.length}\n`);

const rows = [];
for (const lang of LANGS) {
  if (ONLY_LANG && !ONLY_LANG.includes(lang)) continue;
  const dict = JSON.parse(fs.readFileSync(path.join(D, `${lang}.json`), "utf8"));
  const flatDict = flat(dict);

  const untranslated = [];
  let english = 0;
  let done = 0;
  let missing = 0;

  for (const k of allKeys) {
    if (ONLY_NS && !ONLY_NS.includes(k.split(".")[0])) continue;
    const v = flatDict[k];
    if (v === undefined) {
      missing++;
      continue;
    }
    if (typeof v === "string" && v === enFlat[k]) {
      english++;
      untranslated.push(k);
    } else {
      done++;
    }
  }
  rows.push({ lang, done, english, missing, untranslated });
}

const pad = (s, n) => String(s).padStart(n);
console.log("语言     已翻译    仍英文     缺键    覆盖率");
for (const r of rows) {
  const total = r.done + r.english + r.missing;
  const pct = total === 0 ? 0 : Math.round((r.done / total) * 100);
  console.log(
    `${r.lang.padEnd(7)} ${pad(r.done, 7)} ${pad(r.english, 8)} ${pad(r.missing, 7)}    ${pct}%`,
  );
}

// 按命名空间聚合，找出最该优先翻译的块
if (!ONLY_LANG || ONLY_LANG.length === 1) {
  const r = rows[0];
  const byNs = {};
  for (const k of r.untranslated) {
    const ns = k.split(".")[0];
    byNs[ns] = (byNs[ns] || 0) + 1;
  }
  const sorted = Object.entries(byNs).sort((a, b) => b[1] - a[1]);
  console.log(`\n[${r.lang}] 未翻译最多的命名空间：`);
  for (const [ns, n] of sorted.slice(0, 15)) console.log(`  ${pad(n, 5)}  ${ns}`);
}

if (LIST_NS) {
  const r = rows[0];
  const keys = r.untranslated.filter((k) => k.split(".")[0] === LIST_NS);
  console.log(`\n[${r.lang}] ${LIST_NS} 下未翻译的键（${keys.length} 条）：`);
  for (const k of keys.slice(0, 60)) console.log(`  ${k}`);
  if (keys.length > 60) console.log(`  …还有 ${keys.length - 60} 条`);
}
