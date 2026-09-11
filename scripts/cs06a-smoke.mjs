/**
 * CS-06a 线上烟雾（生产站点，只读）
 *
 * 回答一个 curl 层面就能回答、但此前**没人自动问**的问题：
 *   Supplier Directory 的「计数标签」与「实际渲染的卡片」是否相等？
 *
 * ⚠️ 为什么必须单独一个 smoke：
 *   Bug B 不会让页面 500，也不会让 tsc 报错。它让页面**自己跟自己矛盾**：
 *   `?country=vietnam` 上「1 suppliers listed」旁边并排 4 张卡。
 *   现有五套回归覆盖的是访问层级 / 文案 / GA4 / 落库，**没有一套看目录的渲染源**。
 *   而且目录页返回 `no-store`（动态渲染），所以烟雾可直击、结果恒新鲜、无需清缓存。
 *
 * ⚠️ 反向对照（本次验收的硬要求）：
 *   同一个脚本必须在**部署前**也跑一次 —— 那时 Bug B 断言应当**成片失败**。
 *   如果部署前也全绿，说明探针是空转的，不能作为"真的修好了"的证据。
 *   用法：先 `node scripts/cs06a-smoke.mjs`（Before），部署后再跑一次（After）。
 *
 * ⚠️ 陷阱（沿用 CS-05c 的教训）：
 *   1. 同一句话在 HTML 段与 RSC 段转义方式不同 → 必须先做 HTML 实体归一化。
 *   2. 卡片数以 `href="…/suppliers/{slug}"` 的**去重 slug 数**计，不能用整页
 *      「出现次数」—— RSC payload 里 `"href":"/suppliers/xxx"` 会重复计数（冒号不是等号，故当前正则天然安全）。
 *
 * 用法：
 *   node scripts/cs06a-smoke.mjs
 *   BASE=https://factoryauditb2b.com node scripts/cs06a-smoke.mjs
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.BASE || "https://factoryauditb2b.com";

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
const PREFIXED = LOCALES.filter((l) => l !== "en");

/** locale 路径前缀：英文是默认语言，不带前缀（与 i18n/config.ts 的 localePath 一致） */
const prefix = (loc) => (loc === "en" ? "" : `/${loc}`);

/**
 * 基线快照（2026-09-11 线上实测的**已发布供应商**，DB 4 家 + nanjing-mxcomm 未发布）。
 * 严格自洽断言（count == cards）永远成立；这组数字是**快照**，
 * 供应商增减时只需更新这里，不必改断言逻辑。
 */
const SNAPSHOT = {
  "": 4,
  "?country=china": 3,
  "?country=vietnam": 1,
  "?industry=textiles": 2,
  "?q=Garment": 2,
  "?country=nowhere": 0,
};

/** 无筛选时的期望顺序 = risk_score 降序（分数越高 = 风险越低 = 越靠前） */
const EXPECTED_ORDER = [
  "shenzhen-precision-electronics",
  "guangzhou-textile-factory",
  "ho-chi-minh-garment",
  "dongguan-plastic-molding",
];

let pass = 0;
let fail = 0;
const failures = [];
/** Before/After 对照表 */
const matrix = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function section(t) {
  console.log(`\n=== ${t} ===`);
}

/** HTML 实体归一化 —— 让「同一句话的两种转义」可比 */
function normalize(html) {
  return html
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 请求间隔：本烟雾有 ~80 次请求，连发会被边缘限流（实测出现 503 风暴，
 *  表现为 sitemap=0 条、hreflang=0 条这类**假 FAIL**）。
 *  加节流 + 对 5xx 重试 —— 只消除基础设施噪声，不放宽任何断言。 */
const PACE_MS = 70;

/** 5xx / 429 视为可重试；4xx（尤其 404）不重试 */
async function get(pathname, init = {}) {
  const RETRYABLE = new Set([429, 500, 502, 503, 504]);
  const BACKOFF = [500, 1200, 2500];
  let last = null;
  for (let attempt = 0; attempt <= BACKOFF.length; attempt++) {
    if (attempt > 0) await sleep(BACKOFF[attempt - 1]);
    else await sleep(PACE_MS);
    const res = await fetch(`${BASE}${pathname}`, {
      headers: { "User-Agent": UA, ...(init.headers || {}) },
      redirect: init.redirect ?? "follow",
    });
    const body = await res.text();
    last = {
      status: res.status,
      body,
      headers: res.headers,
      finalUrl: res.url,
      location: res.headers.get("location") || "",
      type: res.headers.get("content-type") || "",
      attempts: attempt + 1,
    };
    if (!RETRYABLE.has(res.status)) return last;
  }
  return last;
}

/** 本地字典 —— 期望文案的单一事实源，不在这里再抄一份 */
function dict(loc) {
  const p = path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** 从 HTML 里数**卡片**：去重后的 `/suppliers/{slug}` 链接数 */
function cardSlugs(html, loc) {
  const pre = prefix(loc);
  const re = new RegExp(`href="${pre}/suppliers/([a-z0-9-]+)"`, "g");
  const set = new Set();
  for (const m of html.matchAll(re)) set.add(m[1]);
  return [...set];
}

/** 从 HTML 里读**计数标签**的数字（按该 locale 的 countLabel 模板定位） */
function countNumber(html, loc) {
  const tpl = dict(loc).suppliers.countLabel; // 例："{n} suppliers listed" / "已收录 {n} 家供应商"
  const parts = tpl.split("{n}").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(parts[0] + "(\\d+)" + (parts[1] ?? ""));
  const m = html.match(re);
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------------------
section("1. 计数标签 == 实际卡片数（9 语 × 6 状态）");
// ---------------------------------------------------------------------------

const STATES = Object.keys(SNAPSHOT);

/** 复用 §1 已经抓到的页面，§2 不再重复请求（省一半请求量，避开限流） */
const PAGE_CACHE = new Map();

for (const loc of LOCALES) {
  const pre = prefix(loc);
  for (const qs of STATES) {
    const url = `${pre}/suppliers${qs}`;
    const r = await get(url);
    const html = normalize(r.body);
    const cards = cardSlugs(html, loc);
    const n = countNumber(html, loc);
    const exp = SNAPSHOT[qs];
    const label = `${loc.padEnd(5)} ${(qs || "(无筛选)").padEnd(20)}`;

    PAGE_CACHE.set(`${loc}|${qs}`, { r, html, cards, n });
    matrix.push({ loc, qs, count: n, cards: cards.length, ok: n === cards.length });

    if (r.status !== 200) {
      check(`§1 ${label} HTTP 200`, false, `实际 ${r.status}（${r.attempts} 次尝试）`);
      continue;
    }
    // 自洽：这是 Bug B 的核心断言，永远必须成立
    check(`§1 ${label} count(${n}) == cards(${cards.length})`, n === cards.length, `标签=${n} 卡片=${cards.length}`);
    // 快照：确认筛选本身仍然"筛对了"（否则可能就是筛选谓词被改坏，而不是渲染修好了）
    check(`§1 ${label} 计数 == 快照 ${exp}`, n === exp, `实际 ${n}`);
  }
}

console.log("\n  —— Before/After 对照表（count 标签 / 实际卡片）——");
for (const m of matrix) {
  console.log(
    `  ${m.ok ? "OK  " : "MISMATCH"}  ${m.loc.padEnd(5)} ${(m.qs || "(无筛选)").padEnd(20)} count=${String(m.count).padStart(3)} cards=${String(m.cards).padStart(3)}`
  );
}

// ---------------------------------------------------------------------------
section("2. 空结果必须真的渲染 Empty State（此前完全不可达）");
// ---------------------------------------------------------------------------

for (const loc of LOCALES) {
  const cached = PAGE_CACHE.get(`${loc}|?country=nowhere`);
  const r = cached.r;
  const html = cached.html;
  const cards = cached.cards;
  const n = cached.n;
  const expectedEmpty = dict(loc).suppliers.empty;

  check(`§2 ${loc} HTTP 200`, r.status === 200, `实际 ${r.status}`);
  check(`§2 ${loc} 计数为 0`, n === 0, `实际 ${n}`);
  check(`§2 ${loc} 渲染 0 张卡`, cards.length === 0, `实际 ${cards.length}`);
  check(
    `§2 ${loc} 出现 empty 文案`,
    typeof expectedEmpty === "string" && expectedEmpty.length > 0 && html.includes(expectedEmpty),
    (expectedEmpty || "").slice(0, 80)
  );
}

// ---------------------------------------------------------------------------
section("3. 无筛选时的默认行为与顺序未变");
// ---------------------------------------------------------------------------

{
  const cached = PAGE_CACHE.get("en|");
  const html = cached.html;
  const cards = cached.cards;
  const n = cached.n;

  check("§3 无筛选 计数=4 且 卡片=4", n === 4 && cards.length === 4, `计数=${n} 卡片=${cards.length}`);
  check(
    "§3 卡片顺序 == risk_score 降序（shenzhen → guangzhou → ho-chi-minh → dongguan）",
    JSON.stringify(cards) === JSON.stringify(EXPECTED_ORDER),
    cards.join(" → ")
  );
  check(
    "§3 计数标签原文 == 字典模板替换后的字面值",
    html.includes(dict("en").suppliers.countLabel.replace("{n}", "4"))
  );
}

// ---------------------------------------------------------------------------
section("4. Bug A —— `/en/*` 301 保住 query");
// ---------------------------------------------------------------------------

{
  // 4.1 必须 301 且 Location 带 query
  const r1 = await get("/en/suppliers?country=china", { redirect: "manual" });
  check("§4.1 `/en/suppliers?country=china` 返回 301", r1.status === 301, `实际 ${r1.status}`);
  check(
    "§4.1 Location 指向 `/suppliers`",
    /(^|\/\/[^/]+)\/suppliers(\?|$)/.test(r1.location) || r1.location.endsWith("/suppliers"),
    r1.location
  );
  check(
    "§4.1 Location**包含** `country=china`（这就是修复点）",
    /country=china/.test(r1.location),
    r1.location
  );

  // 4.2 跟随一跳后筛选态真的保住了
  const r2 = await get("/en/suppliers?country=china");
  const html2 = normalize(r2.body);
  const cards2 = cardSlugs(html2, "en");
  const n2 = countNumber(html2, "en");
  check("§4.2 跟随一跳后 HTTP 200", r2.status === 200, `实际 ${r2.status}`);
  check(
    "§4.2 跟随一跳后 计数=3 且 卡片=3（筛选态未丢）",
    n2 === 3 && cards2.length === 3,
    `计数=${n2} 卡片=${cards2.length}`
  );

  // 4.3 多参数也要保住
  const r3 = await get("/en/suppliers?industry=textiles&q=Garment", { redirect: "manual" });
  check(
    "§4.3 多参数 301 同时保住 industry 与 q",
    r3.status === 301 && /industry=textiles/.test(r3.location) && /q=Garment/.test(r3.location),
    `status=${r3.status} loc=${r3.location}`
  );

  // 4.4 空路径仍回首页
  const rEn = await get("/en", { redirect: "manual" });
  check(
    "§4.4 `/en` → 301 `/`",
    rEn.status === 301 && /(^|\/\/[^/]+)\/$/.test(rEn.location),
    `status=${rEn.status} loc=${rEn.location}`
  );
  const rEnSlash = await get("/en/", { redirect: "manual" });
  // ⚠️ 实测：`/en/` 先被 Next 自己的尾斜杠归一化 308 到 `/en`（这一步在 middleware **之前**，
  //    属既有行为，本 Change Set 不碰），随后才由 middleware 301 到 `/`。
  //    断言必须写成这条真实链路，而不是"直接 301" —— 否则修的是断言不是代码。
  check(
    "§4.4 `/en/` 先 308 归一化到 `/en`（Next 既有行为，未被本 Change Set 触碰）",
    rEnSlash.status === 308 && /\/en$/.test(rEnSlash.location),
    `status=${rEnSlash.status} loc=${rEnSlash.location}`
  );
  const rEnSlashFollow = await get("/en/");
  check(
    "§4.4 `/en/` 跟随到底落在首页（无循环）",
    rEnSlashFollow.status === 200 && /^https:\/\/[^/]+\/$/.test(rEnSlashFollow.finalUrl),
    `status=${rEnSlashFollow.status} final=${rEnSlashFollow.finalUrl}`
  );

  // 4.5 无 query 的常规跳转
  const rPlain = await get("/en/suppliers", { redirect: "manual" });
  check(
    "§4.5 `/en/suppliers` → 301 `/suppliers`（且不追加空 `?`）",
    rPlain.status === 301 && /\/suppliers$/.test(rPlain.location),
    `status=${rPlain.status} loc=${rPlain.location}`
  );

  // 4.6 无重定向循环（跟随到底 ≤ 3 跳，最终落在不带 /en/ 的地址上）
  const rLoop = await get("/en/suppliers?country=china");
  check(
    "§4.6 无重定向循环（最终 URL 不含 /en/ 且状态 200）",
    rLoop.status === 200 && !/\/en\//.test(rLoop.finalUrl) && !/\/en$/.test(rLoop.finalUrl),
    `status=${rLoop.status} final=${rLoop.finalUrl}`
  );
}

// ---------------------------------------------------------------------------
section("5. 负向守护 —— 本轮不该动的都没动");
// ---------------------------------------------------------------------------

{
  // 5.1 8 个带前缀的 locale 不受 Bug A 修复影响
  for (const loc of PREFIXED) {
    const r = await get(`/${loc}/suppliers?country=china`, { redirect: "manual" });
    check(`§5.1 /${loc}/suppliers?country=china 仍为 200（未被 301）`, r.status === 200, `实际 ${r.status}`);
  }

  // 5.2 目录首页可索引 + canonical 自指（复用 §1 的响应）
  {
    const html = PAGE_CACHE.get("en|").html;
    check("§5.2 /suppliers 仍 `index, follow`", /<meta name="robots" content="index,\s*follow"/i.test(html));
    check(
      "§5.2 /suppliers canonical 自指（未被筛选态污染）",
      /<link rel="canonical" href="https:\/\/factoryauditb2b\.com\/suppliers"/i.test(html)
    );
  }

  // 5.3 筛选态仍 noindex（复用 §1 的响应）
  {
    const html = PAGE_CACHE.get("en|?country=china").html;
    check("§5.3 筛选态仍 `noindex, follow`", /<meta name="robots" content="noindex,\s*follow"/i.test(html));
  }

  // 5.4 hreflang 每页 12 条（⚠️ 不能按 `<link rel="alternate" hreflang=` 连续串匹配，会假阴性）
  {
    const PAGES = [
      { path: "/suppliers", cached: "en|" },
      { path: "/zh/suppliers?country=china", cached: "zh|?country=china" },
    ];
    let bad = [];
    for (const p of PAGES) {
      const html = PAGE_CACHE.get(p.cached).html;
      const n = (html.match(/rel="alternate"/g) || []).length;
      if (n !== 12) bad.push(`${p.path}=${n}`);
    }
    check("§5.4 hreflang 每页 12 条（复用 §1 的 2 个页面）", bad.length === 0, bad.join(", "));
  }

  // 5.5 sitemap 条数未变
  {
    const r = await get("/sitemap.xml");
    const n = (r.body.match(/<loc>/g) || []).length;
    check("§5.5 sitemap 仍 936 条", n === 936, `实际 ${n}`);
  }

  // 5.6 CS-05c-r2 未回退
  {
    const r = await get("/llms.txt");
    const body = normalize(r.body);
    check("§5.6 /llms.txt 仍 200", r.status === 200, `实际 ${r.status}`);
    check("§5.6 /llms.txt 仍无「per month」计量", !/per\s+month/i.test(body));
  }
}

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(64)}`);
console.log(`CS-06a 线上烟雾：${pass} PASS / ${fail} FAIL   （BASE=${BASE}）`);
if (fail) {
  console.log("\n失败项：");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log("全部通过 ✓");
