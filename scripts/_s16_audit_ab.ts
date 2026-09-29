/**
 * stage1.6 A/B 探针：同一批源键，在「旧规则（含 1 个 CJK 即 90）」与
 * 「新规则（CJK 占比 >25% 才 90）」下的半句话数量对照。
 * 目的：证明 CJK 占比改动本身没有**新增**半句话（不掩盖、不制造缺陷）。
 *
 * 用法：node scripts/run-regression.mjs _s16_audit_ab
 */
import fs from "fs";
import path from "path";
import { trimMetaDescription } from "../lib/pageMeta";
import { GUIDES } from "../lib/guides";
import { CASE_STUDIES, CASE_LIST_META, CASE_DISCLOSURE } from "../lib/caseStudies";
import { FIELD_REPORTS, FIELD_REPORT_LIST_META, FIELD_REPORT_DISCLOSURE } from "../lib/fieldReports";
import { INDUSTRY_COPY } from "../lib/industryContent";
import { CHEMICALS } from "../lib/chemicals";
import { COVERAGE_COUNTRIES, COVERAGE_SERVICES } from "../lib/coverage";

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
const dict: Record<string, any> = {};
for (const l of LOCALES) dict[l] = JSON.parse(fs.readFileSync(path.join("i18n", "dictionaries", `${l}.json`), "utf8"));

const SENT = /[.。!！?？]/;
const DANGLING = /[\s,;:，、；：\-–—]+$/u;
const CJK_ONE = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const WORST_COUNTRY = "Philippines";
const WORST_INDUSTRY = "Food & Beverage / 食品饮料";
const subst = (s: string) => s.replaceAll("{country}", WORST_COUNTRY).replaceAll("{industry}", WORST_INDUSTRY);

/** 旧规则（stage1.6 之前）：含 1 个 CJK 字符即按 90 预算 */
function trimOld(text: string): string {
  const budget = CJK_ONE.test(text) ? 90 : 158;
  const chars = [...text];
  if (chars.length <= budget) return text;
  const head = chars.slice(0, budget).join("");
  for (let i = head.length - 1; i >= 0; i--) {
    if (SENT.test(head[i])) return head.slice(0, i + 1).trim();
  }
  const sp = head.lastIndexOf(" ");
  return (sp > 0 ? head.slice(0, sp) : head).replace(DANGLING, "").trim();
}

type Row = { key: string; loc: string; src: string };
const rows: Row[] = [];
function test(key: string, loc: string, raw: string | undefined) {
  if (typeof raw !== "string" || raw.length < 45) return;
  rows.push({ key, loc, src: subst(raw) });
}

const KEY_RE = /(desc|intro)$/i;
function walkDict(obj: any, p: string, loc: string) {
  for (const [k, v] of Object.entries(obj)) {
    const np = p ? `${p}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) walkDict(v, np, loc);
    else if (typeof v === "string" && KEY_RE.test(k)) test(np, loc, v);
  }
}
for (const l of LOCALES) walkDict(dict[l], "", l);

for (const g of GUIDES) {
  test(`guides/${g.slug}`, "en×7", (g as any).metaDescEn);
  test(`guides/${g.slug}`, "zh", (g as any).metaDescZh);
}
for (const c of CASE_STUDIES) {
  test(`caseStudies/${c.slug}`, "en×7", (c as any).metaDescEn);
  test(`caseStudies/${c.slug}`, "zh", (c as any).metaDescZh);
}
for (const r of FIELD_REPORTS) {
  test(`fieldReports/${r.slug}`, "en×7", (r as any).metaDescEn);
  test(`fieldReports/${r.slug}`, "zh", (r as any).metaDescZh);
}
for (const [ind, copy] of Object.entries(INDUSTRY_COPY) as any[]) {
  for (const t of copy.topics as any[]) {
    test(`industry/${ind}/${t.slug}`, "en×7", t.metaDesc?.en);
    test(`industry/${ind}/${t.slug}`, "zh", t.metaDesc?.zh);
  }
}
for (const c of CHEMICALS as any[]) {
  test(`chemicals/${c.slug}`, "en", c.metaDescEn ?? c.metaDesc?.en);
  test(`chemicals/${c.slug}`, "zh", c.metaDescZh ?? c.metaDesc?.zh);
}
for (const c of COVERAGE_COUNTRIES as any[]) test(`coverage/${c.slug}`, "coverage.ts", c.metaDesc);
for (const s of COVERAGE_SERVICES as any[]) test(`coverageSvc/${s.slug ?? s.slugSuffix}`, "coverage.ts", s.metaDesc);
test("CASE_LIST_META", "en", (CASE_LIST_META as any).en);
test("CASE_LIST_META", "zh", (CASE_LIST_META as any).zh);
test("FIELD_REPORT_LIST_META", "en", (FIELD_REPORT_LIST_META as any).en);
test("FIELD_REPORT_LIST_META", "zh", (FIELD_REPORT_LIST_META as any).zh);
test("CASE_DISCLOSURE", "en", (CASE_DISCLOSURE as any).en);
test("FIELD_REPORT_DISCLOSURE", "en", (FIELD_REPORT_DISCLOSURE as any).en);

let oldHalf = 0;
let newHalf = 0;
const oldHalfKeys: string[] = [];
const newHalfKeys: string[] = [];
const onlyNew: string[] = [];
const fixedByNew: string[] = [];
for (const r of rows) {
  const o = trimOld(r.src);
  const n = trimMetaDescription(r.src);
  const oh = !SENT.test(o.slice(-1));
  const nh = !SENT.test(n.slice(-1));
  if (oh) {
    oldHalf++;
    oldHalfKeys.push(`${r.key}[${r.loc}] ${[...r.src].length}->${[...o].length}`);
  }
  if (nh) {
    newHalf++;
    newHalfKeys.push(`${r.key}[${r.loc}] ${[...r.src].length}->${[...n].length}`);
  }
  if (!oh && nh) onlyNew.push(`${r.key}[${r.loc}] ${[...r.src].length}  old->${[...o].length}  new->${[...n].length}`);
  if (oh && !nh) fixedByNew.push(`${r.key}[${r.loc}]`);
}

console.log(`受检源键：${rows.length}`);
console.log(`旧规则（含 1 CJK 即 90）半句话：${oldHalf}`);
console.log(`新规则（CJK 占比 >25%）半句话：${newHalf}`);
console.log(`\n新增半句话（旧 OK → 新 半句）：${onlyNew.length}`);
for (const x of onlyNew) console.log("  ✗ " + x);
console.log(`\n被修好的（旧 半句 → 新 OK）：${fixedByNew.length}`);
for (const x of fixedByNew.slice(0, 60)) console.log("  ✓ " + x);
console.log("\n---- 新规则下的半句话全量 ----");
for (const x of newHalfKeys) console.log("  · " + x);
