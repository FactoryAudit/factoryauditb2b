#!/usr/bin/env node
/**
 * scripts/_gate_i18n_lib.cjs —— 五道多语言 QA 门禁的共用判据库（只读，不写任何业务文件）
 *
 * 设计原则：
 *   1. 判据与白名单**不重复发明**：能直接从 `scripts/_i18n_leak_scan.cjs`（唯一真源）
 *      解析出来的（ALLOW_EXACT / ALLOW_TOKENS / EN_MARKERS / EN_STRONG / ZH_WORDS /
 *      SIMPLIFIED_ONLY / JA_ALLOW），就运行时解析，保证"上游校准、下级跟着走"。
 *   2. 解析失败必须**大声失败**（throw），不得静默退化成空集合 —— 空集合会让所有门禁假绿。
 *   3. 本库只提供纯函数与常量，自身不读业务数据、不打印、不退出。
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, ".next", "server", "app");
const LEAK_SCAN = path.join(__dirname, "_i18n_leak_scan.cjs");
const DICT_DIR = path.join(ROOT, "i18n", "dictionaries");
const CONTENT_DIR = path.join(ROOT, "lib", "contentI18n");

/** 全部语种（含 zh / zh-TW / en） */
const LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"];
/** 拉丁文字语种 —— 不该出现 CJK */
const LATIN_LOCALES = ["es", "de", "fr", "pt", "ar"];
/** 内容映射 lib/contentI18n 覆盖的六语（en/zh/zh-TW 不在其中） */
const CONTENT_LOCALES = ["es", "de", "fr", "pt", "ja", "ar"];

// ─────────────────────────────────────────────
// 1. 从唯一真源 _i18n_leak_scan.cjs 解析已校准的集合
// ─────────────────────────────────────────────

const leakSrc = (() => {
  try {
    return fs.readFileSync(LEAK_SCAN, "utf8");
  } catch (e) {
    throw new Error(`无法读取判据真源 ${LEAK_SCAN}：${e.message}`);
  }
})();

/** 解析 `const VAR = [ "a", "b" , ... ];`（或 `= new Set([...])`）里的字符串字面量 */
function extractArray(varName) {
  const start = leakSrc.indexOf(`const ${varName} =`);
  if (start < 0) return null;
  const open = leakSrc.indexOf("[", start);
  const close = leakSrc.indexOf("]", open);
  if (open < 0 || close < 0) return null;
  const body = leakSrc.slice(open + 1, close).replace(/\/\/[^\n]*/g, "");
  return [...body.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

/** 解析 `const VAR = new Set( ( "abc" + ... ).split("") );` 这类逐字集合 */
function extractSplitSet(varName) {
  const re = new RegExp(`const ${varName} = new Set\\(([\\s\\S]*?)\\)\\.split\\(""\\)`);
  const m = leakSrc.match(re);
  if (!m) return null;
  const body = m[1].replace(/\/\/[^\n]*/g, "");
  const strs = [...body.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
  return new Set(strs.join("").split(""));
}

function must(name, v) {
  if (!v || (typeof v.size === "number" && v.size === 0) || (Array.isArray(v) && v.length === 0)) {
    throw new Error(`判据解析失败：${name} 为空/缺失（真源格式可能已变，请检查 _i18n_leak_scan.cjs）`);
  }
  return v;
}

const ALLOW_EXACT = must("ALLOW_EXACT", extractArray("ALLOW_EXACT"));
const ALLOW_TOKENS = new Set(
  must("ALLOW_TOKENS", extractArray("ALLOW_TOKENS")).map((s) => s.toUpperCase())
);
const EN_MARKERS = new Set(
  must("EN_MARKERS", extractArray("EN_MARKERS")).map((s) => s.toLowerCase())
);
const EN_STRONG = new Set(
  must("EN_STRONG", extractArray("EN_STRONG")).map((s) => s.toLowerCase())
);
const ZH_WORDS = must("ZH_WORDS", extractArray("ZH_WORDS"));
const SIMPLIFIED_ONLY = must("SIMPLIFIED_ONLY", extractSplitSet("SIMPLIFIED_ONLY"));
const JA_ALLOW = new Set(must("JA_ALLOW", extractArray("JA_ALLOW")));

/**
 * ja 允许的简体字误报例外（在 SIMPLIFIED_ONLY 集合内、但日本新字体确实这么写）。
 * 依据（team-lead 指定 + 实测）：写 / 制 / 号 / 双 / 黄 / 内。
 * 其中 号 已在 JA_ALLOW；其余显式声明，避免上游集合变化时误报。
 */
const JA_ALLOW_EXTRA = new Set(["写", "制", "号", "双", "黄", "内"]);

/**
 * 预处理替换表（与 _i18n_leak_scan.cjs 的 ALLOW_PHRASES 同口径）。
 * 为什么必须做：品牌名 / 标准名短语 / 语言切换器本族语名，出现在任何语种都合法，
 * 不先消化掉会把"含标准名的本地化标题"误判成整串英文。
 */
const ALLOW_PHRASES = [
  [/FactoryAuditB2B\.com/gi, "FABB"],
  [/FactoryAuditB2B/gi, "FABB"],
  [/Jiangmen Zhiyu Technology Co\., Ltd\./gi, "JZT"],
  [/Jiangmen Zhiyu Technology/gi, "JZT"],
  [/Code of Conduct/gi, "CoC"],
  [/RBA Code of Conduct/gi, "RBA CoC"],
  [/简体中文/g, " "],
  [/繁體中文/g, " "],
  [/日本語/g, " "],
  [/한국어/g, " "],
];

function normalize(text) {
  let s = String(text == null ? "" : text);
  for (const [re, rep] of ALLOW_PHRASES) s = s.replace(re, rep);
  return s;
}

// ─────────────────────────────────────────────
// 2. HTML → 可见文本（与 _i18n_leak_scan.cjs 同口径）
// ─────────────────────────────────────────────

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  "#39": "'", "#x27": "'", "#x2F": "/", "#47": "/",
  hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", times: "×", middot: "·", deg: "°",
};

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z#0-9]+);/g, (m, n) => (ENTITIES[n] !== undefined ? ENTITIES[n] : m));
}

function visibleText(html) {
  let s = html;
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  return s.replace(/\s+/g, " ").trim();
}

/** 抽取 SEO 元数据 + robots 指令 */
function seoMeta(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1];
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, ""])[1];
  const robots = (html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i) || [, ""])[1];
  return {
    title: decodeEntities(title).replace(/\s+/g, " ").trim(),
    desc: decodeEntities(desc).replace(/\s+/g, " ").trim(),
    robots: decodeEntities(robots).trim(),
  };
}

function isNoindex(meta) {
  return /noindex/i.test(meta.robots || "");
}

// ─────────────────────────────────────────────
// 3. 展平（递归；数组元素各算 1 叶）
// ─────────────────────────────────────────────

function flatten(obj, prefix = "", out = {}) {
  if (obj === null || typeof obj !== "object") {
    out[prefix] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      const k = prefix ? `${prefix}[${i}]` : `[${i}]`;
      if (v !== null && typeof v === "object") flatten(v, k, out);
      else out[k] = v;
    });
    return out;
  }
  for (const k of Object.keys(obj)) {
    const np = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === "object") flatten(v, np, out);
    else out[np] = v;
  }
  return out;
}

// ─────────────────────────────────────────────
// 4. 语言中立 / 白名单判据
// ─────────────────────────────────────────────

/** 任意文字系统里的"字母"（用于区分"纯数字符号"与"真文本"） */
const LETTER_RE =
  /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

/**
 * 非拉丁文字字母（希腊/西里尔/希伯来/阿拉伯/天城文/假名/汉字/谚文）。
 * 白名单 token 全是拉丁缩写/数字 ⇒ 只要出现非拉丁字母，这个串就是"真文本"，
 * 不能算"白名单串"。
 * 反例（曾经被误判为中立而静默跳过）：
 *   「サプライヤー核查は 1 社あたり $99 – $129 …」—— 拉丁部分只剩数字，被当成 token 串；
 *   「国家企業信用信息公示系統」—— 拉丁字母被剥光。
 */
const NON_LATIN_LETTER_RE =
  /[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF]/;

/** 用白名单 token / 纯数字构成的串（品牌 + 标准代号 + 数字）→ 不判为"语言相关" */
function isAllowOnly(s) {
  if (NON_LATIN_LETTER_RE.test(s)) return false; // 含非拉丁文字 ⇒ 真文本
  const words = s
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9'’\-.:]/g, ""))
    .filter(Boolean);
  if (words.length === 0) {
    // 拉丁字母/数字被剥光了。三种情况：
    //   · 纯标点/符号      ⇒ 语言中立（true）
    //   · 纯非拉丁文字（中日阿…）⇒ **不是**"白名单串"，判为语言相关（false）
    //     （否则「国家企業信用信息公示系統」这类纯汉字串会被误当"中立"而静默跳过）
    return !LETTER_RE.test(s);
  }
  let ok = 0;
  for (const w of words) {
    const raw = w.toUpperCase();
    const u = raw.replace(/\.$/, "");
    const isStdCode = /^\d[\d.,:+\-/]*$/.test(u);
    const isToken = ALLOW_TOKENS.has(u) || ALLOW_TOKENS.has(raw) || ALLOW_TOKENS.has(u + ".");
    const isBrand =
      u.length >= 3 && ALLOW_EXACT.some((a) => a.toUpperCase().replace(/\./g, "").startsWith(u));
    if (isStdCode || isToken || isBrand) ok++;
  }
  return ok / words.length >= 0.6;
}

/** 品牌词出现即视为语言中立（FactoryAuditB2B RiskScore™ 之类产品/品牌串） */
function containsBrand(s) {
  const lc = s.toLowerCase();
  return ALLOW_EXACT.some((a) => a.length >= 4 && lc.includes(a.toLowerCase()));
}

/** 语言中立项：URL / 邮箱 / 电话 / 纯数字符号 / 品牌与标准代号 / 全大写标签 / 日期 —— 任何语种都可原样相同 */
function isNeutralValue(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return true;
  if (!LETTER_RE.test(s)) return true; // 纯数字/符号/单位/emoji
  if (/^(https?:\/\/|mailto:|tel:|www\.|\/|#)/i.test(s)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return true;
  if (/^\+?[\d\s()\-]{7,}$/.test(s)) return true; // 电话
  if (!NON_LATIN_LETTER_RE.test(s) && containsBrand(s)) return true; // 纯拉丁品牌串
  if (isAllowOnly(s)) return true;
  // 全大写缩写 / 标准标签（CAS RN / IT / IA …）：无小写字母、含 ≥1 字母
  if (/[A-Z]/.test(s) && !/[a-z\u00C0-\u024F]/.test(s) && /^[A-Z0-9&/ .:\-\u2013\u2014·]+$/.test(s)) return true;
  // 日期 / 编号（2025 · T1、Feb 2025、Jun 2023）
  if (/^\d{4}\s*[·/\-\u2013\u2014]\s*[A-Za-z0-9]+\s*$/.test(s)) return true;
  if (/^[A-Za-z]{3,4}\.?\s+\d{4}$/.test(s)) return true;
  return false;
}

// ─────────────────────────────────────────────
// 5. "这看起来是英语自然语言吗" 判据（口径同 _i18n_leak_scan.cjs）
// ─────────────────────────────────────────────

/**
 * 某些 EN_MARKERS 在**目标语言里也是高频常用词**，会让"纯本地语句子"被误判成英文。
 * 实测证据（门禁① 两条 pt 假阳，线上 buildId Re7OjdNqpAwMpR-HTphlc）：
 *   `EN_MARKERS` 含 `do`（葡语 = of the）与 `as`（葡语 = the，阴性复数）；pt 句子
 *   "Como os feriados chineses de 2026 do Meio do Outono … afetam as auditorias." 恰好命中
 *   do/as 两个标记、越过 `markers >= 2` 阈值 ⇒ 被误报「整句英文描述」。pt-PT 正文里
 *   do/as 短语密度极高，属**系统性**假阳（与门禁② pt 那 6 个葡语同形词同源）。
 * 处理：按 locale 把"该语言里也高频"的标记**踢出计数**，只认该语言不常用的标记为英文证据。
 * 已知代价：一条真·英文若**只**靠 do/as 凑满 2 个标记（极罕见、且必是短句）会被放过；
 *   长英文段落必有 the/and/of/this/that/with 等词，不受影响（见 gate-seo-i18n --selftest 阳性对照）。
 * 纪律：仅在有**实测假阳证据**时才加语言/词，禁止预防性扩大豁免。
 *   （es 的 `so`、fr 的 `on` 等与 EN_MARKERS 亦有重叠，但暂无实测假阳，故本轮不动、留待证据。）
 */
const LOCALE_AMBIGUOUS_EN_MARKERS = {
  pt: new Set(["do", "as"]),
};

function looksEnglishSentence(run, locale) {
  const words = run.split(/\s+/).map((w) => w.replace(/[^A-Za-z'’\-]/g, "")).filter(Boolean);
  if (words.length < 6) return false;
  const kept = words.filter((w) => !ALLOW_TOKENS.has(w.toUpperCase()));
  if (kept.length < 5) return false;
  const lower = kept.filter((w) => w !== w.toUpperCase());
  if (lower.length < 4) return false;
  const ambiguous = LOCALE_AMBIGUOUS_EN_MARKERS[locale]; // 未传 locale ⇒ 不作剔除（保持原行为）
  let markers = 0;
  const seen = new Set();
  for (const w of kept) {
    const lw = w.toLowerCase();
    if (ambiguous && ambiguous.has(lw)) continue; // 目标语言里也高频 ⇒ 不算英文证据
    if (EN_MARKERS.has(lw) && !seen.has(lw)) {
      seen.add(lw);
      markers++;
    }
  }
  return markers >= 2;
}

function looksEnglishTitle(s) {
  const t = String(s || "").trim();
  if (t.length < 12) return false;
  const words = t.split(/\s+/).map((w) => w.replace(/[^A-Za-z'’\-]/g, "")).filter(Boolean);
  if (words.length < 3) return false;
  const kept = words.filter((w) => !ALLOW_TOKENS.has(w.toUpperCase()));
  if (kept.length < 3) return false;
  const lower = kept.filter((w) => w.length > 1 && w !== w.toUpperCase());
  if (lower.length < 2) return false;
  return kept.some((w) => EN_STRONG.has(w.toLowerCase()));
}

/** 英语功能词出现次数（用于"整段英文但措辞与 en 略不同"的疑似未译判据） */
const EN_FUNCTION_WORDS = [
  "the", "and", "of", "to", "in", "for", "with", "that", "this",
  "are", "is", "we", "you", "our", "your",
];

function countEnFunctionWords(s) {
  let n = 0;
  for (const w of EN_FUNCTION_WORDS) {
    const m = String(s).match(new RegExp(`\\b${w}\\b`, "gi"));
    if (m) n += m.length;
  }
  return n;
}

/**
 * 疑似未译：≥60 字符、纯 ASCII 可打印（含 – —）、且含 ≥8 个英语功能词。
 * 这条专门堵"整段英文但与 en 原句措辞略有不同 ⇒ 逃过等值判据"的盲区。
 */
function looksLikeUntranslatedEnglish(s) {
  const t = String(s == null ? "" : s);
  if (t.length < 60) return false;
  if (!/^[\x00-\x7F\s.,;:'"()\-\u2013\u2014?!%&/]+$/.test(t)) return false;
  return countEnFunctionWords(t) >= 8;
}

// ─────────────────────────────────────────────
// 6. 简体字判据（ja）
// ─────────────────────────────────────────────

/** 返回该 CJK 串里"简体专用且非日语合法"的字符数组 */
function jaSimplifiedChars(run) {
  if (JA_ALLOW.has(run)) return [];
  return [...run].filter((c) => SIMPLIFIED_ONLY.has(c) && !JA_ALLOW.has(c) && !JA_ALLOW_EXTRA.has(c));
}

/**
 * 扫描一段文本里的简体残留：① 简体词表命中 ② CJK 串里的简体专用字形。
 * 词表法对 JA 近乎零误报（日语也用汉字，靠字形判断易误报，靠词判断可靠）。
 */
function scanSimplifiedInJa(text) {
  const hits = [];
  const t = String(text || "");
  for (const w of ZH_WORDS) {
    if (t.includes(w)) hits.push(`简体词「${w}」`);
  }
  const re = /[\u4E00-\u9FFF\u3400-\u4DBF]{2,}/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const run = m[0];
    const bad = jaSimplifiedChars(run);
    if (bad.length > 0) hits.push(`${run.slice(0, 40)}  [简体字: ${[...new Set(bad)].join(" ")}]`);
  }
  return [...new Set(hits)];
}

// ─────────────────────────────────────────────
// 7. 遍历 / 路径工具
// ─────────────────────────────────────────────

function walkFiles(dir, ext, acc = []) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, ext, acc);
    else if (e.name.endsWith(ext)) acc.push(p);
  }
  return acc;
}

function relToApp(p) {
  return path.relative(APP, p).replace(/\\/g, "/");
}

// ─────────────────────────────────────────────
// 8. selftest 断言小工具
// ─────────────────────────────────────────────

function makeCheck() {
  let pass = 0;
  let fail = 0;
  const check = (name, cond) => {
    if (cond) {
      pass++;
      console.log(`  ✅ ${name}`);
    } else {
      fail++;
      console.log(`  ❌ ${name}`);
    }
  };
  const done = (title) => {
    console.log(`\n${title}：${pass} PASS / ${fail} FAIL\n`);
    return fail > 0 ? 1 : 0;
  };
  return { check, done, get pass() { return pass; }, get fail() { return fail; } };
}

module.exports = {
  ROOT, APP, LEAK_SCAN, DICT_DIR, CONTENT_DIR,
  LOCALES, LATIN_LOCALES, CONTENT_LOCALES,
  ALLOW_EXACT, ALLOW_TOKENS, EN_MARKERS, EN_STRONG, ZH_WORDS,
  SIMPLIFIED_ONLY, JA_ALLOW, JA_ALLOW_EXTRA,
  decodeEntities, visibleText, seoMeta, isNoindex,
  normalize, ALLOW_PHRASES,
  flatten,
  isNeutralValue, isAllowOnly, LETTER_RE,
  looksEnglishSentence, looksEnglishTitle,
  EN_FUNCTION_WORDS, countEnFunctionWords, looksLikeUntranslatedEnglish,
  scanSimplifiedInJa, jaSimplifiedChars,
  walkFiles, relToApp,
  makeCheck,
};
