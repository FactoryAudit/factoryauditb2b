/**
 * CS-01 回归验证：SEO Technical Foundation
 *
 * 纯只读校验（源码扫描 + 字典读取 + 纯函数调用），不写数据、不发网络请求、不读数据库。
 * 运行方式：node scripts/run-regression.mjs cs01-seo-foundation-regression CS01_ROOT
 *
 * 守护的九件事（对应 CHANGE SET 01 的九个子项）：
 *   ① metadata 必须进 <head>（Next 流式元数据的 htmlLimitedBots 名单补丁）
 *   ② sitemap 重复项删除（GUIDES slug 唯一）
 *   ③ hreflang 清理（一语种一代码 + x-default，无别名重复）
 *   ④ robots 冲突修复（允许组与禁止组无交集、同 UA 不重复）
 *   ⑤ 删除非法 llms.txt HTML 标签
 *   ⑥ /register 索引策略（noindex + 不进 sitemap）
 *   ⑦ 旧路径内链改新路径
 *   ⑧ /sample-report → /standard-report
 *   ⑨ 中文 audit-guide 标题修复（国名本地化 + metaDesc 9 语翻译）
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { hreflangFor } from "../i18n/hreflang";
import { LOCALES } from "../i18n/config";
import { GUIDES } from "../lib/guides";
import { countryDisplayName } from "../lib/countryNames";
import robots from "../app/robots";
import {
  CONVERSION_EVENTS,
  CLICK_LEVEL_EVENTS,
  UNWIRED_EVENTS,
  ANALYTICS_EVENTS,
} from "../lib/analytics";

// 注意：本脚本会被 esbuild 打包后执行，__dirname 不可靠。
const ROOT = process.env.CS01_ROOT ? path.resolve(process.env.CS01_ROOT) : process.cwd();

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

/**
 * 读取源码文件（**自动剥注释**）。
 *
 * 为什么必须剥：说明性注释里往往会逐字引用被禁的写法（例如
 *「此处原本有 <link rel="llms.txt">」），不剥注释就会稳定假 FAIL。
 * 遇到疑似误报的正确做法是收窄判定窗口，而不是放宽断言。
 *
 * 只删两种注释，避免误伤字符串里的 "https://"：
 *   1) 块注释（含 JSX 的 {/* ... *\/}）
 *   2) 行注释（整行与行尾都算）
 *
 * ⚠️ 历史：这里曾经是「先按行过滤掉 // 整行注释，再跑块注释正则」。
 * 它确实躲开了「先块后行」顺序的坑，但仍漏掉**行尾**注释
 * （`code; // 见 /api/auth/*` 这种）—— 那个 `/*` 会进入块注释阶段。
 * 2026-09-18 起统一改走 scripts/stripComments.ts 的逐字符状态机。
 */
import { stripComments } from "./stripComments";

const read = (rel: string): string => {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? stripComments(fs.readFileSync(p, "utf8")) : "";
};

const readDict = (loc: string): any =>
  JSON.parse(read(path.join("i18n", "dictionaries", `${loc}.json`)));

// 递归收集文件（排除 node_modules / .next / .open-next / 脚本自身）
function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === ".open-next") continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const SELF = "scripts/cs01-seo-foundation-regression.ts";

// ---------------------------------------------------------------------------
section("A. P0-1 metadata 必须进入 <head>");

const nextConfig = read("next.config.mjs");
check("A1 next.config.mjs 声明 htmlLimitedBots", nextConfig.includes("htmlLimitedBots"));
check(
  "A2 传的是 RegExp（Next 会取 .source 再重建）",
  /htmlLimitedBots:\s*[A-Za-z_$][\w$]*\s*,/.test(nextConfig) &&
    /new RegExp\(/.test(nextConfig)
);
// Googlebot **不在** Next 内置名单里（内置只有 `*-Google` / `Google-*` 形式），
// 这是实测发现的根因，必须守住。
check("A3 名单显式包含 Googlebot", /"Googlebot"/.test(nextConfig));
const AI_SEARCH = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Claude-User"];
check(
  `A4 名单包含 5 个 AI 检索爬虫（${AI_SEARCH.join("/")}）`,
  AI_SEARCH.every((b) => nextConfig.includes(`"${b}"`)),
  AI_SEARCH.filter((b) => !nextConfig.includes(`"${b}"`)).join(",")
);
const BUILTIN = ["Bingbot", "applebot", "Slurp", "DuckDuckBot", "baiduspider", "Chrome-Lighthouse"];
check(
  "A5 内置默认名单关键项被完整保留（未整体替换）",
  BUILTIN.every((b) => nextConfig.includes(`"${b}"`)),
  BUILTIN.filter((b) => !nextConfig.includes(`"${b}"`)).join(",")
);

// ---------------------------------------------------------------------------
section("B. P0-2 sitemap 重复项删除");

const slugs = GUIDES.map((g: any) => g.slug);
const slugSet = new Set<string>(slugs);
check(
  `B1 GUIDES 无重复 slug（${slugs.length} 条 / ${slugSet.size} 唯一）`,
  slugs.length === slugSet.size,
  slugs.filter((s: string, i: number) => slugs.indexOf(s) !== i).join(",")
);
check("B2 GUIDES 非空且至少 5 条", slugSet.size >= 5, `实际 ${slugSet.size}`);
const sitemapSrc = read("app/sitemap.ts");
check("B3 sitemap 不再提交 /sample-report", !sitemapSrc.includes('"/sample-report"'));
check("B4 sitemap 不再提交 /register", !sitemapSrc.includes('"/register"'));

// ---------------------------------------------------------------------------
section("C. hreflang 清理");

const hreflang = hreflangFor("/tools/compare") as Record<string, string>;
const codes = Object.keys(hreflang);
check(
  `C1 hreflang 条数 = 语种数 + x-default（${LOCALES.length + 1}）`,
  codes.length === LOCALES.length + 1,
  `实际 ${codes.length}: ${codes.join(",")}`
);
check("C2 不再有 en-US 别名（与 en 同 URL 的重复声明）", !("en-US" in hreflang));
check("C3 不再有 zh-Hans 别名（与 zh-CN 同 URL 的重复声明）", !("zh-Hans" in hreflang));
check("C4 含 x-default", "x-default" in hreflang);
check(
  "C5 x-default 指向英文（无前缀）地址",
  hreflang["x-default"] === "https://factoryauditb2b.com/tools/compare",
  hreflang["x-default"]
);
const uniqUrls = new Set<string>(Object.values(hreflang));
check(
  `C6 去重 URL 数 = 语种数（${LOCALES.length}），无同 URL 重复声明`,
  uniqUrls.size === LOCALES.length,
  `实际 ${uniqUrls.size}`
);
check(
  "C7 9 个语种各自的 htmlLang 全部出现",
  ["en", "zh-CN", "es", "de", "fr", "pt-BR", "ja", "zh-Hant", "ar"].every((c) => c in hreflang),
  codes.join(",")
);

// ---------------------------------------------------------------------------
section("D. robots 冲突修复");

const rules = robots().rules as Array<{ userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] }>;
const uaOf = (r: (typeof rules)[number]): string[] =>
  r.userAgent === undefined ? ["*"] : Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent];
const allowed = new Set<string>();
const disallowed = new Set<string>();
const seenUa = new Map<string, number>();
for (const r of rules) {
  for (const ua of uaOf(r)) {
    seenUa.set(ua, (seenUa.get(ua) ?? 0) + 1);
    const isBlock = JSON.stringify(r.disallow ?? []).includes('"/"');
    if (isBlock) disallowed.add(ua);
    else allowed.add(ua);
  }
}
const dupUa = [...seenUa.entries()].filter(([, n]) => n > 1).map(([u]) => u);
check("D1 同一 UA 只出现一次（不再有指令相反的重复组）", dupUa.length === 0, dupUa.join(","));
const overlap = [...allowed].filter((u) => disallowed.has(u));
check("D2 允许组与禁止组无交集", overlap.length === 0, overlap.join(","));
const SEARCH_BOTS = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Claude-User", "Googlebot", "Bingbot"];
check(
  "D3 AI 检索 / 传统搜索爬虫在允许组",
  SEARCH_BOTS.every((b) => allowed.has(b)),
  SEARCH_BOTS.filter((b) => !allowed.has(b)).join(",")
);
const TRAIN_BOTS = ["GPTBot", "ClaudeBot", "CCBot", "Bytespider", "Google-Extended"];
check(
  "D4 AI 训练爬虫在禁止组（与 Cloudflare 托管段一致）",
  TRAIN_BOTS.every((b) => disallowed.has(b)),
  TRAIN_BOTS.filter((b) => !disallowed.has(b)).join(",")
);
check("D5 有通配 * 兜底规则且 allow /", rules.some((r) => uaOf(r).includes("*") && JSON.stringify(r.allow ?? []).includes('"/"')));

// ---------------------------------------------------------------------------
section("E. 删除非法 llms.txt HTML 标签");

const layout = read("app/[locale]/layout.tsx");
check("E1 不再有 <link rel=\"llms.txt\">", !layout.includes('rel="llms.txt"'));
check("E2 不再有 meta name=llms.txt（other 字段）", !layout.includes('"llms.txt"'));
check("E3 /llms.txt 路由仍然存在", fs.existsSync(path.join(ROOT, "app/llms.txt/route.ts")));
const llmsSrc = read("app/llms.txt/route.ts");
check("E4 llms.txt 不再引用已 308 的 /sample-report", !llmsSrc.includes("/sample-report"));

// ---------------------------------------------------------------------------
section("F. /register 索引策略");

const registerSrc = read("app/[locale]/register/page.tsx");
check("F1 /register 已设 noindex", /robots:\s*\{\s*index:\s*false/.test(registerSrc));

// ---------------------------------------------------------------------------
section("G. /sample-report → /standard-report");

const sampleSrc = read("app/[locale]/sample-report/page.tsx");
check("G1 sample-report 页改为 permanentRedirect", sampleSrc.includes("permanentRedirect"));
check("G2 重定向目标是 /standard-report", sampleSrc.includes('"/standard-report"'));
const footer = read("components/SiteFooter.tsx");
check("G3 页脚不再链接 /sample-report", !footer.includes('"/sample-report"'));

// ---------------------------------------------------------------------------
section("H. 埋点三桶互斥（sample-report 事件已归档）");

const conv = new Set<string>(CONVERSION_EVENTS as readonly string[]);
const click = new Set<string>(CLICK_LEVEL_EVENTS as readonly string[]);
const unwired = new Set<string>(UNWIRED_EVENTS as readonly string[]);
check("H1 sampleReportSubmit 已移出转化桶", !conv.has(ANALYTICS_EVENTS.sampleReportSubmit));
check("H2 sampleReportCta 已移出点击桶", !click.has(ANALYTICS_EVENTS.sampleReportCta));
check(
  "H3 两者都在未接线桶",
  unwired.has(ANALYTICS_EVENTS.sampleReportSubmit) && unwired.has(ANALYTICS_EVENTS.sampleReportCta)
);
check(
  "H4 三桶仍然互斥（无事件同时出现在两桶）",
  [...conv].every((e) => !click.has(e) && !unwired.has(e)) &&
    [...click].every((e) => !unwired.has(e))
);

// ---------------------------------------------------------------------------
section("I. audit-guide 9 语标题 / 描述本地化");

const en = readDict("en");
const zh = readDict("zh");
const zhTW = readDict("zh-TW");
check("I1 zh 标题模板为国名+空格+标准名（修 ChinaBSCI）", zh.auditGuide.metaTitle === "{country} {type} 验厂", zh.auditGuide.metaTitle);
check("I2 zh-TW 标题模板同样补空格", zhTW.auditGuide.metaTitle === "{country} {type} 驗廠", zhTW.auditGuide.metaTitle);
const OTHERS = ["zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
const stillEnglish = OTHERS.filter((l) => readDict(l).auditGuide.metaDesc === en.auditGuide.metaDesc);
check(
  "I3 8 个非英语种 metaDesc 均已翻译（不再与 en 逐字相同）",
  stillEnglish.length === 0,
  stillEnglish.join(",")
);
check(
  "I4 9 语 auditGuide 键集一致",
  OTHERS.every((l) => {
    const d = readDict(l);
    const a = Object.keys(d.auditGuide ?? {}).sort().join(",");
    const b = Object.keys(en.auditGuide ?? {}).sort().join(",");
    return a === b;
  })
);
const auditGuideSrc = read("app/[locale]/audit-guide/[country]/[auditType]/page.tsx");
check("I5 audit-guide 页使用 countryDisplayName", auditGuideSrc.includes("countryDisplayName"));
check(
  "I6 标题不再直接塞英文名 c.name（已被本地化变量取代）",
  !auditGuideSrc.includes('replaceAll("{country}", c.name)')
);

// ---------------------------------------------------------------------------
section("J. 国名本地化数据");

const COUNTRY_CODES = ["china", "vietnam", "thailand", "malaysia", "philippines"];
const missing: string[] = [];
for (const code of COUNTRY_CODES) {
  for (const loc of LOCALES) {
    const v = countryDisplayName(loc as never, code, "FALLBACK");
    if (v === "FALLBACK") missing.push(`${code}/${loc}`);
  }
}
check("J1 5 国 × 9 语国名齐备", missing.length === 0, missing.join(","));
check("J2 zh 中国 = 中国", countryDisplayName("zh", "china", "x") === "中国", countryDisplayName("zh", "china", "x"));
check("J3 zh-TW 泰國 = 泰國", countryDisplayName("zh-TW", "thailand", "x") === "泰國", countryDisplayName("zh-TW", "thailand", "x"));
check("J4 ja ベトナム", countryDisplayName("ja", "vietnam", "x") === "ベトナム", countryDisplayName("ja", "vietnam", "x"));
check("J5 fr Chine", countryDisplayName("fr", "china", "x") === "Chine", countryDisplayName("fr", "china", "x"));
check("J6 未知国家回退英文名（不臆造译名）", countryDisplayName("zh", "atlantis", "Atlantis") === "Atlantis");

// ---------------------------------------------------------------------------
section("K. 旧路径内链已改新路径");

const OLD = ['"/knowledge', '"/inspectors', '"/country/', '"/supplier/'];
const offenders: string[] = [];
for (const rel of [...walk("app"), ...walk("components")]) {
  if (rel === SELF) continue;
  if (!/\.tsx?$/.test(rel)) continue;
  // 重定向路由文件本身以旧路径命名，属预期存在，不算内链
  if (/\/(knowledge|inspectors)\/page\.tsx$/.test(rel)) continue;
  if (/\/country\/\[slug\]\/page\.tsx$/.test(rel)) continue;
  if (/\/supplier\/\[country\]\/\[slug\]\/page\.tsx$/.test(rel)) continue;
  const src = read(rel);
  for (const o of OLD) {
    if (src.includes(o)) offenders.push(`${rel} → ${o}`);
  }
}
check(
  "K1 源码中无指向旧路径（/knowledge /inspectors /country/ /supplier/）的内链",
  offenders.length === 0,
  offenders.slice(0, 6).join(" | ")
);

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`CS-01 SEO Foundation 回归：${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("\n失败项：");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("ALL PASS");
