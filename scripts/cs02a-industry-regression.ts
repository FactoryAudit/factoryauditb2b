// scripts/cs02a-industry-regression.ts —— CS-02A Food Master Template 回归（只读，fail 时退出码 1）
//
// 守护四件事：
//   1) **内容与代码分离**：Master 模板必须对所有行业通用。页面源码（剥注释后）
//      不得出现 `food-beverage` 这类行业字面量分支 —— 否则 chemicals 上线时
//      整条链路要重写一遍（用户 2026-09-13 拍板：架构必须支持后续行业）。
//   2) **不编造**：子主题引用的 programCode 必须真的有 audit-guide 页
//      （isAudit=true），否则行业页会渲染 404 死链；正文不得出现无据数字声称。
//   3) **三处同源**：页面 generateStaticParams / sitemap / llms.txt 都只按
//      lib/industryContent.ts 的配置生成，未配置的组合不得出现在任何一处。
//   4) **CTS-02C G3 接线**：行业页与子主题页必须注入 industryCode + sourcePath，
//      且**绝不**注入 certifications_req（买家还没说要什么证书，不替他编）。
//
// 用法：
//   node scripts/run-regression.mjs cs02a-industry-regression
// （CS02A_ROOT 未设时由运行器注入 Windows 风格路径）

import * as fs from "node:fs";
import * as path from "node:path";
import {
  INDUSTRY_COPY,
  topicsForIndustry,
  findIndustryTopic,
  industryCopy,
} from "../lib/industryContent";
import { STATIC_PROGRAMS, STATIC_INDUSTRIES } from "../lib/staticData";

const ROOT = process.env.CS02A_ROOT ? path.resolve(process.env.CS02A_ROOT) : process.cwd();

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

/** 剥注释：先删块注释，再删行注释（顺序不可颠倒，否则 `//` 会被块注释吃掉）。
 *  `(^|[^:])` 前缀守卫：URL 里的 `https://` 不能被当成行注释切掉。 */
// 统一口径：见 scripts/stripComments.ts。
// 🔴 曾经这里各写一份「先块注释、再行注释」的两段正则 —— 当被扫文件的行注释里含 `/*`
//    （如 AccountMenu.tsx 的 `// /api/auth/*`），它会吞掉后面整段真实代码，
//    导致正向断言假 FAIL、反向断言假 PASS。
import { stripComments } from "./stripComments";
function readSource(rel: string): string {
  return stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

const MASTER = "app/[locale]/industry/[slug]/page.tsx";
const TOPIC = "app/[locale]/industry/[slug]/[topic]/page.tsx";
const HUB = "app/[locale]/industry/page.tsx";
const CONTENT = "lib/industryContent.ts";

// ---------------------------------------------------------------------------
section("A. 内容与代码分离（Master 模板不得写死行业）");

check("A1 lib/industryContent.ts 存在", exists(CONTENT));
check("A2 /industry hub 页存在", exists(HUB));
check("A3 Master 页存在", exists(MASTER));
check("A4 子主题页存在", exists(TOPIC));

const masterSrc = readSource(MASTER);
const topicSrc = readSource(TOPIC);
const hubSrc = readSource(HUB);

check("A5 Master 页源码无 food-beverage 行业分支", !/food-beverage/.test(masterSrc));
check("A6 子主题页源码无 food-beverage 行业分支", !/food-beverage/.test(topicSrc));
check("A7 /industry hub 页源码无 food-beverage 行业分支", !/food-beverage/.test(hubSrc));
check(
  "A8 Master 页从 lib/industryContent 取行业差异化内容",
  /from "@\/lib\/industryContent"/.test(readSource(MASTER)) ||
    /industryCopy/.test(masterSrc)
);
check(
  "A9 内容注册表按行业 code 索引（新增行业只改数据）",
  /INDUSTRY_COPY[^=]*=\s*\{/.test(stripComments(fs.readFileSync(path.join(ROOT, CONTENT), "utf8")))
);

// ---------------------------------------------------------------------------
section("B. 内容真实性（不编造、不死链）");

const configured = Object.keys(INDUSTRY_COPY);
check("B1 注册表至少配置了 1 个行业", configured.length >= 1, String(configured.length));
check(
  "B2 已配置行业都是 STATIC_INDUSTRIES 里的真实 code",
  configured.every((c) => STATIC_INDUSTRIES.some((i) => i.code === c)),
  configured.join(",")
);

const allTopics = configured.flatMap((c) => topicsForIndustry(c).map((t) => ({ c, t })));
check("B3 至少配置 1 个子主题", allTopics.length >= 1, String(allTopics.length));

const auditCodes = new Set(STATIC_PROGRAMS.filter((p) => p.isAudit).map((p) => p.code));
const badRefs: string[] = [];
for (const { c, t } of allTopics) {
  const codes = t.programCodes ?? (t.programCode ? [t.programCode] : []);
  for (const code of codes) {
    // 只有 isAudit=true 的项目才有 /audit-guide/{country}/{code} 页面
    if (!auditCodes.has(code)) badRefs.push(`${c}/${t.slug} -> ${code}`);
  }
}
check("B4 子主题引用的 programCode 都有 audit-guide 页（无 404 死链）", badRefs.length === 0, badRefs.join("; "));

const emptyCopy: string[] = [];
for (const { c, t } of allTopics) {
  const fields: [string, string][] = [
    ["title.en", t.title.en],
    ["title.zh", t.title.zh],
    ["metaDesc.en", t.metaDesc.en],
    ["metaDesc.zh", t.metaDesc.zh],
    ["intro.en", t.intro.en],
    ["intro.zh", t.intro.zh],
  ];
  for (const [k, v] of fields) if (!v || !v.trim()) emptyCopy.push(`${c}/${t.slug}.${k}`);
  t.sections.forEach((s, i) => {
    if (!s.h2.en.trim() || !s.h2.zh.trim()) emptyCopy.push(`${c}/${t.slug}.sections[${i}].h2`);
    s.body.forEach((b, j) => {
      if (!b.en.trim() || !b.zh.trim()) emptyCopy.push(`${c}/${t.slug}.sections[${i}].body[${j}]`);
    });
  });
  (t.checklist ?? []).forEach((x, i) => {
    if (!x.en.trim() || !x.zh.trim()) emptyCopy.push(`${c}/${t.slug}.checklist[${i}]`);
  });
}
check("B5 全部子主题正文 en/zh 双语齐备且非空", emptyCopy.length === 0, emptyCopy.slice(0, 5).join("; "));

// 无据声称：正文里不得出现「N 家工厂 / N 家供应商」这类可核验数字
const NUM_CLAIM = /\b\d+\s+(factories|suppliers|audits|inspections)\b/i;
const numClaims: string[] = [];
for (const { c, t } of allTopics) {
  const blob = [t.title.en, t.metaDesc.en, t.intro.en, ...t.sections.flatMap((s) => s.body.map((b) => b.en))].join(" ");
  if (NUM_CLAIM.test(blob)) numClaims.push(`${c}/${t.slug}`);
}
check("B6 正文无「N 家工厂/供应商」式无据数字声称", numClaims.length === 0, numClaims.join("; "));

check(
  "B7 未配置行业取不到子主题（Block B 整块不渲染）",
  STATIC_INDUSTRIES.filter((i) => !configured.includes(i.code)).every(
    (i) => topicsForIndustry(i.code).length === 0
  )
);
check(
  "B8 未配置 slug 的 findIndustryTopic 返回 undefined（页面据此 404）",
  findIndustryTopic("electronics", "food-safety-certification") === undefined
);
check("B9 industryCopy 对未配置行业返回 undefined", industryCopy("electronics") === undefined);

// ---------------------------------------------------------------------------
section("C. 三处同源（页面 / sitemap / llms.txt）");

const sitemapSrc = readSource("app/sitemap.ts");
const llmsSrc = readSource("app/llms.txt/route.ts");

check("C1 sitemap 提交 /industry 索引页", /"\/industry"/.test(sitemapSrc));
check(
  "C2 sitemap 用 topicsForIndustry 生成子主题（与页面同源）",
  /topicsForIndustry/.test(sitemapSrc)
);
check(
  "C3 llms.txt 用 topicsForIndustry 生成行业段（与页面同源）",
  /topicsForIndustry/.test(llmsSrc)
);
check("C4 llms.txt 有 Industry pages 段", /Industry pages/.test(llmsSrc));
check(
  "C5 子主题页 dynamicParams = false（未配置组合静态 404，禁止按需生成空壳页）",
  /export const dynamicParams = false/.test(topicSrc)
);
check(
  "C6 子主题页 generateStaticParams 由 topicsForIndustry 驱动",
  /topicsForIndustry/.test(topicSrc)
);

// ---------------------------------------------------------------------------
section("D. CS-02C G3 接线（RFQ 上下文注入）");

check(
  "D1 Master 页内嵌 RfqForm（CTA 已从 /training-plans 切到落库通道）",
  /<RfqForm/.test(masterSrc)
);
check("D2 Master 页不再链接 /training-plans", !/\/training-plans/.test(masterSrc));
check(
  "D3 Master 页注入 industryCode",
  /industryCode:\s*slug/.test(masterSrc)
);
check(
  "D4 Master 页注入 sourcePath = /industry/{slug}",
  /sourcePath:\s*`\/industry\/\$\{slug\}`/.test(masterSrc)
);
check(
  "D5 子主题页注入 sourcePath = /industry/{slug}/{topic}",
  /sourcePath:\s*`\/industry\/\$\{slug\}\/\$\{topicSlug\}`/.test(topicSrc)
);
// 🔴 反伪造铁律：买家还没说要什么证书，绝不替他填 certifications_req
check(
  "D6 两处都不注入 certificationsReq（不替买家编证书要求）",
  !/certificationsReq\s*:/.test(masterSrc) && !/certificationsReq\s*:/.test(topicSrc)
);

// ---------------------------------------------------------------------------
section("E. 既有行业零回归（G1 修复不得被本轮破坏）");

check(
  "E1 Master 页仍走 listSuppliersByIndustry（DB 优先，静态兜底）",
  /listSuppliersByIndustry/.test(masterSrc)
);
check(
  "E2 Master 页仍按有效 audit code 过滤（不产生 404 能力标签）",
  /validAuditCodes/.test(masterSrc)
);
check(
  "E3 Master 页仍渲染供应商计数（计数 == 列表项数）",
  /suppliers\.length/.test(masterSrc)
);
check(
  "E4 面包屑已改指真实存在的 /industry 索引（不再借用 /suppliers）",
  /\/industry"/.test(masterSrc) && !/item: `\$\{BASE\}\/suppliers`/.test(masterSrc)
);
check(
  "E5 whyTitle / whyLead 已可见渲染（JSON-LD FAQPage 不再只有结构化数据）",
  /p\.whyTitle/.test(masterSrc) && /p\.whyLead/.test(masterSrc)
);

// ---------------------------------------------------------------------------
section("F. 九语字典");

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"] as const;
const NEW_KEYS = ["hubMetaDesc", "hubLead", "topicsTitle"] as const;
const dicts: Record<string, Record<string, unknown>> = {};
for (const loc of LOCALES) {
  const p = path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
  check(`F1 字典存在：${loc}.json`, fs.existsSync(p));
  dicts[loc] = JSON.parse(fs.readFileSync(p, "utf8"));
}
const enIp = (dicts.en as { industryPage: Record<string, string> }).industryPage;
check("F2 en.industryPage 存在", Boolean(enIp));
for (const k of NEW_KEYS) {
  const missing = LOCALES.filter((l) => {
    const ip = (dicts[l] as { industryPage?: Record<string, string> }).industryPage;
    return !ip || typeof ip[k] !== "string" || ip[k].trim() === "";
  });
  check(`F3 九语 industryPage.${k} 齐备且非空`, missing.length === 0, missing.join(","));
}
check(
  "F4 九语 industryPage 键集合与 en 完全一致",
  LOCALES.every(
    (l) =>
      JSON.stringify(
        Object.keys((dicts[l] as { industryPage: Record<string, string> }).industryPage).sort()
      ) === JSON.stringify(Object.keys(enIp).sort())
  )
);
const noPlaceholder = LOCALES.filter((l) => {
  const ip = (dicts[l] as { industryPage: Record<string, string> }).industryPage;
  return !ip.ctaTitle.includes("{industry}") || !ip.topicsTitle.includes("{industry}");
});
check(
  "F5 九语 ctaTitle / topicsTitle 都保留 {industry} 占位符（翻译不得吞掉）",
  noPlaceholder.length === 0,
  noPlaceholder.join(",")
);

// ---------------------------------------------------------------------------
console.log("\n============================================================");
if (fail === 0) {
  console.log(`CS-02A 行业 Master 模板回归：${pass} PASS / 0 FAIL   （ROOT=${ROOT}）`);
  console.log("全部通过 ✓");
} else {
  console.log(`CS-02A 行业 Master 模板回归：${pass} PASS / ${fail} FAIL`);
  failures.forEach((f) => console.log("  - " + f));
  process.exit(1);
}
