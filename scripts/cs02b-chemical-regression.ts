// scripts/cs02b-chemical-regression.ts —— CS-02B Chemical Intelligence 回归（只读）
//
// 守护五件事：
//   1) **数据真实性**：CAS RN 必须过校验位算法（防打字错误）；下游行业 code 必须真实存在
//      （否则是 /industry/{code} 死链）；en/zh 双语齐备；不得出现价格/产能/家数等无据声称。
//   2) **最小可用**：一期化学品数量受限（不得偷偷扩成几百条程序化页面）；
//      不生成 CAS 号页、不生成化学品 × 国家矩阵。
//   3) **不改数据库**：化工上下文只能靠既有列（industry_code + source_path + product 预填）
//      承载，不得出现新的数据库字段需求；certifications_req 仍不得被注入。
//   4) **三处同源**：页面 generateStaticParams / sitemap / llms.txt 都走 CHEMICALS。
//   5) **行业入口**：chemicals 已进 STATIC_INDUSTRIES 与 INDUSTRY_COPY（复用 Master 模板）。
//
// 用法：node scripts/run-regression.mjs cs02b-chemical-regression

import * as fs from "node:fs";
import * as path from "node:path";
import { CHEMICALS, casChecksumOk, findChemical } from "../lib/chemicals";
import { STATIC_INDUSTRIES } from "../lib/staticData";
import { INDUSTRY_COPY, topicsForIndustry } from "../lib/industryContent";

const ROOT = process.env.CS02B_ROOT ? path.resolve(process.env.CS02B_ROOT) : process.cwd();

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
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
function readSource(rel: string): string {
  return stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

const INDEX = "app/[locale]/chemicals/page.tsx";
const DETAIL = "app/[locale]/chemicals/[slug]/page.tsx";

// ---------------------------------------------------------------------------
section("A. 页面与路由");

check("A1 /chemicals 索引页存在", fs.existsSync(path.join(ROOT, INDEX)));
check("A2 /chemicals/[slug] 详情页存在", fs.existsSync(path.join(ROOT, DETAIL)));

const detailSrc = readSource(DETAIL);
check(
  "A3 详情页 dynamicParams = false（未收录的 slug 静态 404）",
  /export const dynamicParams = false/.test(detailSrc)
);
check(
  "A4 generateStaticParams 由 CHEMICALS 驱动（与 sitemap/llms.txt 同源）",
  /CHEMICALS\.map/.test(detailSrc)
);
check("A5 详情页未收录时 notFound", /if \(!chem\) notFound\(\)/.test(detailSrc));

// ---------------------------------------------------------------------------
section("B. 数据真实性（不编造）");

check("B1 一期化学品数量 >= 1", CHEMICALS.length >= 1, String(CHEMICALS.length));
// 🔴 收尾冲刺期约束：不做庞大化工数据库。上限守住，防止被扩成程序化页面海。
check(
  "B2 一期数量 <= 20（最小可用，不做程序化扩张）",
  CHEMICALS.length <= 20,
  String(CHEMICALS.length)
);

const badCas = CHEMICALS.filter((c) => !casChecksumOk(c.cas)).map((c) => `${c.slug}:${c.cas}`);
check("B3 全部 CAS RN 通过校验位算法", badCas.length === 0, badCas.join(", "));

check(
  "B4 casChecksumOk 能识别坏号（守门本身有效）",
  casChecksumOk("108-78-1") === true && casChecksumOk("108-78-2") === false
);

const codes = new Set(STATIC_INDUSTRIES.map((i) => i.code));
const badDown: string[] = [];
for (const c of CHEMICALS) {
  for (const d of c.downstream) if (!codes.has(d)) badDown.push(`${c.slug} -> ${d}`);
}
check("B5 下游行业 code 全部真实存在（无 /industry/{code} 死链）", badDown.length === 0, badDown.join("; "));

const empty: string[] = [];
for (const c of CHEMICALS) {
  if (!c.nameEn.trim() || !c.nameZh.trim()) empty.push(`${c.slug}.name`);
  if (!c.application.en.trim() || !c.application.zh.trim()) empty.push(`${c.slug}.application`);
  if (!c.compliance.en.trim() || !c.compliance.zh.trim()) empty.push(`${c.slug}.compliance`);
  if (c.synonyms.en.length === 0 || c.synonyms.zh.length === 0) empty.push(`${c.slug}.synonyms`);
}
check("B6 全部字段 en/zh 齐备且非空", empty.length === 0, empty.join("; "));

// 无据声称：不得出现价格、产能、「我们审核过 N 家」这类可核验数字
const CLAIM = /\b\d+\s*(USD|EUR|\$|factories|suppliers|audits|tonnes? per|MT per)/i;
const claims = CHEMICALS.filter((c) =>
  CLAIM.test(c.application.en + " " + c.compliance.en)
).map((c) => c.slug);
check("B7 正文无价格 / 产能 / 家数等无据声称", claims.length === 0, claims.join(", "));

const dupSlug = CHEMICALS.map((c) => c.slug);
check("B8 slug 唯一", new Set(dupSlug).size === dupSlug.length);
const dupCas = CHEMICALS.map((c) => c.cas);
check("B9 CAS RN 唯一", new Set(dupCas).size === dupCas.length);
check("B10 findChemical 对未收录 slug 返回 undefined", findChemical("not-a-chemical") === undefined);

// ---------------------------------------------------------------------------
section("C. RFQ 上下文（不改数据库）");

check(
  "C1 详情页注入 industryCode = chemicals（复用 CS-02C 既有列）",
  /industryCode:\s*INDUSTRY_CODE/.test(detailSrc) &&
    /INDUSTRY_CODE\s*=\s*"chemicals"/.test(detailSrc)
);
check(
  "C2 详情页注入 sourcePath = /chemicals/{slug}",
  /sourcePath:\s*`\/chemicals\/\$\{slug\}`/.test(detailSrc)
);
check("C3 预填 product = 化学品名（页面事实，可清空）", /defaultProduct:\s*name/.test(detailSrc));
// 🔴 反伪造：买家还没说要什么证书，绝不替他填
check("C4 不注入 certificationsReq", !/certificationsReq\s*:/.test(detailSrc));
check(
  "C5 本轮没有新增数据库字段需求（源码里没有 chemicals 相关 SQL/migration）",
  !fs.existsSync(path.join(ROOT, "supabase", "cs02b"))
);

// ---------------------------------------------------------------------------
section("D. 三处同源（页面 / sitemap / llms.txt）");

const sitemapSrc = readSource("app/sitemap.ts");
const llmsSrc = readSource("app/llms.txt/route.ts");
check("D1 sitemap 提交 /chemicals 索引", /"\/chemicals"/.test(sitemapSrc));
check("D2 sitemap 由 CHEMICALS 生成详情页", /CHEMICALS\.map/.test(sitemapSrc));
check("D3 llms.txt 有 Chemical raw materials 段", /Chemical raw materials/.test(llmsSrc));
check("D4 llms.txt 由 CHEMICALS 生成条目", /CHEMICALS/.test(llmsSrc));

// ---------------------------------------------------------------------------
section("E. 行业入口复用 Master 模板");

check(
  "E1 chemicals 已进 STATIC_INDUSTRIES",
  STATIC_INDUSTRIES.some((i) => i.code === "chemicals")
);
check("E2 chemicals 已在 INDUSTRY_COPY 注册", Object.keys(INDUSTRY_COPY).includes("chemicals"));
const chemTopics = topicsForIndustry("chemicals");
check("E3 chemicals 子主题已配置", chemTopics.length >= 1, String(chemTopics.length));
// 🔴 子主题不得引用尚不存在的审核项目（REACH/RoHS 还没进 STATIC_PROGRAMS）
const topicRefs = chemTopics.flatMap((t) => t.programCodes ?? (t.programCode ? [t.programCode] : []));
check(
  "E4 化工子主题不引用未上线的审核项目（避免 404 死链 + 无意义 URL 扩张）",
  topicRefs.length === 0,
  topicRefs.join(",")
);
check(
  "E5 索引页不写死行业字面量（复用 Master 模板，新增行业只改数据）",
  !/chemicals:\s*CHEM/.test(readSource("app/[locale]/industry/[slug]/page.tsx"))
);

// ---------------------------------------------------------------------------
section("F. 九语字典");

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"] as const;
const KEYS = [
  "metaTitle",
  // CS-19 / 工单 SEO-20260918-FAB 任务 2.1：/chemicals/[slug] 详情页标题尾部短标签。
  // 此前详情页标题尾部直接用列表页的 metaTitle（fr 70 / es 64 / pt 63 / de 59 字符），
  // 与「品种名 + CAS + 品牌后缀」拼出 48–124 字符的标题（最长 1,121px，超 Google 标题区一倍）。
  "detailTitleTail",
  "metaDesc",
  "lead",
  "casLabel",
  "synonymsLabel",
  "applicationLabel",
  "complianceLabel",
  "downstreamLabel",
  "relatedIndustries",
];
const enKeys: string[] = [];
for (const loc of LOCALES) {
  const p = path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
  check(`F1 字典存在：${loc}.json`, fs.existsSync(p));
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  const ns = d.chemicals;
  if (!ns) {
    check(`F2 ${loc} chemicals 命名空间存在`, false);
    continue;
  }
  check(`F2 ${loc} chemicals 命名空间存在`, true);
  const missing = KEYS.filter((k) => typeof ns[k] !== "string" || ns[k].trim() === "");
  check(`F3 ${loc} chemicals 十键齐备且非空`, missing.length === 0, missing.join(","));
  const ks = Object.keys(ns).sort();
  if (loc === "en") enKeys.push(...ks);
  else check(`F4 ${loc} chemicals 键集与 en 一致`, JSON.stringify(ks) === JSON.stringify([...KEYS].sort()));
}
check("F5 en chemicals 键数 = 10", enKeys.length === 10, String(enKeys.length));

// ---------------------------------------------------------------------------
console.log("\n============================================================");
if (fail === 0) {
  console.log(`CS-02B 化工智能回归：${pass} PASS / 0 FAIL   （ROOT=${ROOT}）`);
  console.log("全部通过 ✓");
} else {
  console.log(`CS-02B 化工智能回归：${pass} PASS / ${fail} FAIL`);
  failures.forEach((f) => console.log("  - " + f));
  process.exit(1);
}
