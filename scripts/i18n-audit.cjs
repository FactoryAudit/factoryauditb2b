/**
 * 多语言字典体检脚本（只读，不改任何文件）。
 *
 * 检查四类问题：
 * 1. 链接字段（href/url/link/path）被机器翻译破坏 —— 会导致死链，最危险
 * 2. 值仍是英文（未翻译）
 * 3. 译成了错误语言（目标语言字符集不匹配，例如 ja 里出现西语）
 * 4. 占位符 / 品牌词被破坏（{country}、FactoryAuditB2B、SMETA 等）
 *
 * 用法：
 *   node scripts/i18n-audit.cjs            # 全部语言
 *   node scripts/i18n-audit.cjs --lang=ja  # 只看指定语言
 *   node scripts/i18n-audit.cjs --samples=5
 */
const fs = require("fs");
const path = require("path");

const D = path.join(__dirname, "..", "i18n", "dictionaries");
const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split("=")[1] : d;
};
const ONLY = arg("lang", "") ? arg("lang", "").split(",") : null;
const SAMPLES = Number(arg("samples", "3"));

/** 各语言「必须有」的字符集（命中即算该语言的正字） */
const SCRIPT_RE = {
  zh: /[\u4e00-\u9fff]/,
  "zh-TW": /[\u4e00-\u9fff]/,
  ja: /[\u3040-\u30ff\u4e00-\u9fff]/, // 假名或汉字
  ar: /[\u0600-\u06ff]/,
  de: null,
  fr: null,
  es: null,
  pt: null,
};

/** 拉丁语系不用字符集判断，改用「该语言特有的高频虚词/重音字符」识别是否翻错 */
const LATIN_HINT = {
  es: /\b(de|la|el|los|las|para|con|proveedor|herramientas|gratuitas?|necesita|pedido)\b/i,
  pt: /\b(de|da|do|para|com|fornecedor|ferramentas|gratuitas?|precisa|pedido|auditoria)\b/i,
  fr: /\b(de|le|la|les|pour|avec|fournisseur|outils|gratuits?|besoin)\b/i,
  de: /\b(der|die|das|und|für|mit|lieferant|werkzeuge|kostenlos)\b/i,
};

const LANGS = ["zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];

/** 展平：数组按下标展开，保证 pricing.plans.0.href 这类键也能被检查 */
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

const LINK_KEY = /(^|\.)(href|url|link|path|src|to)$/i;
const PLACEHOLDER_RE = /\{[a-zA-Z]+\}/g;
const BRAND_RE = /FactoryAuditB2B|SMETA|BSCI|ISO ?\d{4}|IATF|Sedex|WRAP|SA8000|HACCP|AQL|USD/g;

function isLinkLike(s) {
  return typeof s === "string" && /^(\/|https?:|#|mailto:)/.test(s);
}

const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));
const enFlat = flat(en);

let grand = { link: 0, eng: 0, wrong: 0, broken: 0 };

for (const lang of LANGS) {
  if (ONLY && !ONLY.includes(lang)) continue;
  const file = path.join(D, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const flatDict = flat(dict);

  const badLinks = [];
  const wrongLang = [];
  const brokenMark = [];
  let english = 0;
  let ok = 0;

  for (const k of Object.keys(flatDict)) {
    const v = flatDict[k];
    const e = enFlat[k];
    if (typeof v !== "string") continue;

    // 1) 链接字段：en 是路径/URL，目标语言必须也是
    if (LINK_KEY.test(k) && typeof e === "string" && isLinkLike(e) && !isLinkLike(v)) {
      badLinks.push(`${k} = ${JSON.stringify(v)}`);
      continue;
    }

    if (typeof e !== "string") continue;

    // 4) 占位符 / 品牌词被破坏
    const ep = (e.match(PLACEHOLDER_RE) || []).sort().join(",");
    const vp = (v.match(PLACEHOLDER_RE) || []).sort().join(",");
    const eb = (e.match(BRAND_RE) || []).sort().join(",");
    const vb = (v.match(BRAND_RE) || []).sort().join(",");
    if (ep !== vp || eb !== vb) {
      brokenMark.push(`${k}: ${JSON.stringify(e)} -> ${JSON.stringify(v)}`);
      continue;
    }

    // 2) 未翻译
    if (v === e) {
      english++;
      continue;
    }
    if (!/[A-Za-z]{3,}/.test(e)) {
      ok++; // 原文无实义英文（纯数字/符号），不算问题
      continue;
    }

    // 3) 译错语言
    const script = SCRIPT_RE[lang];
    if (script) {
      if (!script.test(v)) wrongLang.push(`${k} = ${JSON.stringify(v.slice(0, 60))}`);
      else ok++;
    } else {
      const mine = LATIN_HINT[lang];
      const others = Object.keys(LATIN_HINT).filter((l) => l !== lang);
      const hasMine = mine ? mine.test(v) : false;
      const foreignHit = others.find((l) => LATIN_HINT[l].test(v) && l !== "pt");
      // 只有「完全不像本语言、且像别的拉丁语言」时才判为错译
      // 说明：es/pt 词形极近，只提示不判错，避免误报
      if (!hasMine && foreignHit && lang !== "pt" && lang !== "es") {
        wrongLang.push(`${k} = ${JSON.stringify(v.slice(0, 60))}`);
      } else {
        ok++;
      }
    }
  }

  grand.link += badLinks.length;
  grand.eng += english;
  grand.wrong += wrongLang.length;
  grand.broken += brokenMark.length;

  console.log(`\n[${lang}]  已译 ${ok} | 仍英文 ${english} | 疑译错语言 ${wrongLang.length} | 坏链 ${badLinks.length} | 占位符/品牌被破坏 ${brokenMark.length}`);
  const show = (label, arr) => {
    if (!arr.length) return;
    console.log(`  ${label}:`);
    arr.slice(0, SAMPLES).forEach((s) => console.log(`    - ${s}`));
    if (arr.length > SAMPLES) console.log(`    …共 ${arr.length} 条`);
  };
  show("坏链（会导致死链，必须修）", badLinks);
  show("占位符/品牌词被破坏", brokenMark);
  show("疑译成错误语言", wrongLang);
}

console.log(`\n${"=".repeat(60)}`);
console.log(
  `合计：坏链 ${grand.link} | 仍英文 ${grand.eng} | 疑译错语言 ${grand.wrong} | 占位符/品牌被破坏 ${grand.broken}`,
);
