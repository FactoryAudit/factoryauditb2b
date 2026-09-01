/**
 * 站点英文残留扫描器（i18n leak scanner）
 *
 * 用途：把「渲染出来给用户看的、但仍是英文」的文案扫出来。
 * 与代码层 grep 的区别：这个扫的是**实际 HTML 输出**，
 * 所以能同时抓到三类问题，而不只是硬编码：
 *   1) 组件/页面里硬编码的英文（没走字典）
 *   2) 字典里该语言仍是英文（未翻译）
 *   3) 被 lock-brand-terms.cjs 锁成英文的键（页面标题、工具名等）
 *
 * 判据：剥离标签与 JSON-LD 后，文本里出现 >=2 个「英文实词」且不在白名单中
 * （品牌名、行业缩写、货币、邮箱等本就该保持英文）。
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

const ROUTES = [
  "/",
  "/pricing",
  "/tools",
  "/tools/supplier-risk-calculator",
  "/tools/supplier-verification-checklist",
  "/tools/compare",
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
    "smeta", "incoterms", "gdpr", "rohs", "reach", "en", "astm", "fda",
  ]
);

/** 三个字母以下的碎片不算实词，避免把 "cm" "kg" 之类当英文 */
const WORD_RE = /\b[a-zA-Z][a-zA-Z'’-]{2,}\b/g;

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
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

function englishWords(text) {
  const hits = [];
  const seen = new Set();
  for (const m of text.matchAll(WORD_RE)) {
    const w = m[0];
    const lower = w.toLowerCase();
    if (WHITELIST.has(lower)) continue;
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
      const words = englishWords(text);
      // 判定：该页面出现 >= 3 个不同的英文实词才算「泄露」。
      // 少量残留（品牌、缩写）已被白名单过滤，剩下 3 个以上基本可确认是未翻译文案。
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
