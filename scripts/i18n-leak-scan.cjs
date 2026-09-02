/**
 * 站点英文残留扫描器（i18n leak scanner）v2 —— 按语言特征精化
 *
 * 用途：把「渲染出来给用户看的、但仍是英文」的文案扫出来。
 * 与代码层 grep 的区别：这个扫的是**实际 HTML 输出**，能同时抓到三类问题：
 *   1) 组件/页面里硬编码的英文（没走字典）
 *   2) 字典里该语言仍是英文（未翻译）
 *   3) 被 lock-brand-terms.cjs 锁成英文的键
 *
 * v2 精化（解决拉丁语系误报）：
 *  - 原生词表：从各语言字典里「已翻译的部分」（值 !== en 值）提取拉丁词，
 *    这些词是该站点该语言的真实用词，扫描时跳过。
 *    未翻译键仍是英文 → 仍会被标出，误报消除但不掩盖真实残留。
 *  - 重音规则：含重音字母（é ü ñ ã ß 等）的拉丁词视为该语言原生词，跳过。
 *  - 非拉丁语言（zh/zh-TW/ja/ar）：拉丁词几乎必为品牌或残留，维持白名单逻辑。
 *
 * 用法：
 *   node scripts/i18n-leak-scan.cjs                    # 默认 http://localhost:3000
 *   node scripts/i18n-leak-scan.cjs --base=https://factoryauditb2b.com
 *   node scripts/i18n-leak-scan.cjs --lang=ja,ar       # 只看指定语言
 *   node scripts/i18n-leak-scan.cjs --out=.workbuddy/i18n-leak.json
 */
const fs = require("fs");
const path = require("path");

const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split("=")[1] : d;
};
const BASE = arg("base", "http://localhost:3000");
const ONLY_LANGS = arg("lang", "") ? arg("lang", "").split(",") : null;
const OUT = arg("out", ".workbuddy/i18n-leak.json");

// en 无前缀，其余带前缀
const LOCALES = ["zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];
// 拉丁语系语言：需要原生词表过滤
const LATIN_LOCALES = new Set(["de", "fr", "es", "pt"]);

const ROUTES = [
  "/",
  "/pricing",
  "/tools",
  "/tools/supplier-risk-calculator",
  "/tools/supplier-verification-checklist",
  "/tools/compare",
  // 5 个客户端工具页：选项文案曾未走字典，必须纳入扫描
  "/tools/supplier-scorecard",
  "/tools/audit-checklist",
  "/tools/audit-report-analyzer",
  "/tools/supplier-document-checker",
  "/tools/supplier-risk-assessment",
  "/services",
  "/services/supplier-verification",
  "/services/factory-audit",
  "/services/pre-shipment-inspection",
  "/resources",
  "/guides",
  "/monitoring",
  "/field-reports",
  "/case-studies",
  "/suppliers",
  "/countries/china",
  "/industry/electronics",
  "/audit-guide/china/SMETA",
  "/about",
  "/trust",
  "/sample-report",
  "/join-supplier-network",
  "/training-plans",
  "/rfq",
  "/logistics",
  "/factory-audit/request",
];

/** 允许保持英文的词：品牌、行业标准缩写、货币、协议、常见通用缩写 */
const WHITELIST = new Set(
  [
    "factoryauditb2b",
    "smeta", "bsci", "wrap", "sa8000", "rba", "iso", "iatf", "sedex", "ce", "ul",
    "haccp", "fssc", "aql", "moq", "fob", "oem", "odm", "rfq", "usd", "eur",
    "qa", "qc", "sop", "cap", "nc", "b2b", "saas", "ai", "cta", "url", "id",
    "email", "whatsapp", "google", "pdf", "csv", "xlsx", "http", "https",
    "psi", "dupro", "ppi", "cls", "cm", "kg", "lb", "ft", "gp", "hq",
    "com", "cn", "vn", "th", "my", "ph",
    "incoterms", "gdpr", "rohs", "reach", "astm", "fda",
    // 语言切换器里的语言自名（英语/德语无重音，会被误当英文残留）
    "english", "deutsch",
  ]
);

/**
 * 三个字母以下的碎片不算实词。字符集必须包含拉丁-1 重音字母
 * （À-Ö Ø-ö ø-ÿ + œ æ），否则 "Español" 会被切成 "Espa"+"ol"，
 * 重音规则永远匹配不到重音。
 */
const WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿ\u0152\u0153\u00C6\u00E6][A-Za-zÀ-ÖØ-öø-ÿ'’\u0152\u0153\u00C6\u00E6-]{2,}/g;
/** 含重音/特殊拉丁字母（é ü ñ ã ß œ 等）→ 视为该语言原生词，跳过 */
const ACCENTED_RE = /[À-ÿ\u0152\u0153\u00C6\u00E6]/;

const DICT_DIR = path.join(__dirname, "..", "i18n", "dictionaries");

function latinWords(text) {
  return [...new Set((text.match(WORD_RE) || []).map((w) => w.toLowerCase()))];
}

/** 从字典「已翻译部分」提取原生词表（值 === en 值的英文残留不进入词表，保持可被检出） */
function buildNativeWords(locale) {
  const enDict = JSON.parse(fs.readFileSync(path.join(DICT_DIR, "en.json"), "utf8"));
  const dict = JSON.parse(fs.readFileSync(path.join(DICT_DIR, `${locale}.json`), "utf8"));
  const native = new Set();
  const stack = [[dict, enDict]];
  while (stack.length) {
    const [d, e] = stack.pop();
    if (!d || !e) continue;
    for (const k of Object.keys(d)) {
      const v = d[k];
      const ev = e[k];
      if (typeof v === "string") {
        // 只有「确实翻译过」的值才算该语言原生语料
        if (typeof ev === "string" && v !== ev) {
          for (const w of latinWords(v)) native.add(w);
        }
      } else if (Array.isArray(v)) {
        // 数组项可能是字符串（直接提取）或对象（进 stack 递归）
        v.forEach((item, i) => {
          if (typeof item === "string") {
            const evItem = Array.isArray(ev) ? ev[i] : undefined;
            if (typeof evItem === "string" && item !== evItem) {
              for (const w of latinWords(item)) native.add(w);
            }
          } else if (item && typeof item === "object") {
            stack.push([item, Array.isArray(ev) ? ev[i] : undefined]);
          }
        });
      } else if (v && typeof v === "object") {
        stack.push([v, ev && typeof ev === "object" ? ev : {}]);
      }
    }
  }
  return native;
}

/** 预加载各语言原生词表（一次构建，多处复用） */
const NATIVE = new Map();
for (const l of LOCALES) NATIVE.set(l, LATIN_LOCALES.has(l) ? buildNativeWords(l) : new Set());

function stripHtml(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ") // JSON-LD / 脚本
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ") // React 的 <!-- --> 文本节点分隔符
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    // 数字实体统一解码（&#231; → ç 等），否则 "Français" 会被拆成 "Fran"+"ais" 两个词误报
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

function englishWords(text, locale) {
  const native = NATIVE.get(locale) ?? new Set();
  const hits = [];
  const seen = new Set();
  for (const m of text.matchAll(WORD_RE)) {
    const w = m[0];
    const lower = w.toLowerCase();
    if (WHITELIST.has(lower)) continue;
    if (ACCENTED_RE.test(w)) continue; // 含重音字母 → 原生词
    if (native.has(lower)) continue; // 字典已翻译部分用过 → 原生词
    if (seen.has(lower)) continue;
    seen.add(lower);
    hits.push(w);
  }
  return hits;
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) return { status: res.status, text: "" };
  return { status: res.status, text: await res.text() };
}

async function main() {
  const findings = [];
  let checked = 0;

  for (const locale of LOCALES) {
    if (ONLY_LANGS && !ONLY_LANGS.includes(locale)) continue;
    const prefix = `/${locale}`;
    let localeLeak = 0;

    for (const route of ROUTES) {
      const url = `${BASE}${prefix}${route}`;
      let res;
      try {
        res = await fetchText(url);
      } catch {
        continue;
      }
      if (res.status !== 200) continue;
      checked++;

      const text = stripHtml(res.text);
      const words = englishWords(text, locale);
      // 判定：该页面出现 >= 3 个不同的英文实词才算「泄露」。
      if (words.length >= 3) {
        localeLeak++;
        findings.push({ locale, route, count: words.length, sample: words.slice(0, 12) });
      }
    }
    console.log(
      `[${locale}] 命中 ${localeLeak} / ${ROUTES.length} 个页面存在英文残留`,
    );
  }

  findings.sort((a, b) => b.count - a.count);

  console.log(`\n共检查 ${checked} 个页面，${findings.length} 个页面存在英文残留\n`);
  console.log("英文实词最多的 20 个页面：");
  for (const f of findings.slice(0, 20)) {
    console.log(`  ${String(f.count).padStart(3)}  ${f.locale}${f.route}`);
    console.log(`        ${f.sample.join(", ")}`);
  }

  if (OUT) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(findings, null, 2), "utf8");
    console.log(`\n完整结果已写入 ${OUT}`);
  }
}

main().catch((e) => {
  console.error("扫描失败:", e);
  process.exit(1);
});
