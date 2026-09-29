/**
 * stage1.6 审计：全站「desc 类源键」的收口幂等性普查（源头侧）
 *
 * 口径：对每个候选源串代入最坏占位符（{country}=Philippines / {industry}=Food & Beverage / 食品饮料）
 * 后跑 trimMetaDescription，比较是否被改动（CUT）与结果结尾是否有句末标点（endOk）。
 *
 * 用法：node scripts/run-regression.mjs _s16_audit_all > _s16_audit.log
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
for (const l of LOCALES) dict[l] = JSON.parse(fs.readFileSync(path.join("i18n/dictionaries", `${l}.json`), "utf8"));

const SENT = /[.。!！?？]/;
const WORST_COUNTRY = "Philippines";
const WORST_INDUSTRY = "Food & Beverage / 食品饮料";

function subst(s: string) {
  return s.replaceAll("{country}", WORST_COUNTRY).replaceAll("{industry}", WORST_INDUSTRY);
}

type Row = { key: string; loc: string; src: number; out: number; endOk: boolean; cut: boolean };
const rows: Row[] = [];

function test(key: string, loc: string, raw: string | undefined) {
  if (typeof raw !== "string" || raw.length < 45) return;
  const s = subst(raw);
  const out = trimMetaDescription(s);
  rows.push({
    key,
    loc,
    src: [...s].length,
    out: [...out].length,
    endOk: SENT.test(out.slice(-1)),
    cut: out !== s,
  });
}

// ---------- 1) 字典递归：末段键名含 desc / intro ----------
const KEY_RE = /(desc|intro)$/i;
function walkDict(obj: any, p: string, loc: string) {
  for (const [k, v] of Object.entries(obj)) {
    const np = p ? `${p}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) walkDict(v, np, loc);
    else if (typeof v === "string" && KEY_RE.test(k)) test(np, loc, v);
  }
}
for (const l of LOCALES) walkDict(dict[l], "", l);

// ---------- 2) TS 内容层 ----------
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

// ---------- 输出 ----------
const bad = rows.filter((r) => !r.endOk || r.cut);
const half = rows.filter((r) => !r.endOk);
console.log(`受检 desc 类源键总数: ${rows.length}`);
console.log(`收口有改动(CUT) : ${rows.filter((r) => r.cut).length}`);
console.log(`结尾无句末标点(半句话): ${half.length}`);
console.log("");
function dump(title: string, arr: Row[]) {
  console.log(`\n########## ${title} (${arr.length}) ##########`);
  const byKey: Record<string, Row[]> = {};
  for (const r of arr) (byKey[r.key] ||= []).push(r);
  for (const [k, v] of Object.entries(byKey)) {
    console.log(`  ${k}`);
    console.log(`      ${v.map((x) => `${x.loc}[${x.src}->${x.out}${x.endOk ? "" : " ✗"}]`).join("  ")}`);
  }
}
dump("A. 半句话（endOk=N）", half);
dump("B. 被截断但结尾有标点（CUT=Y, endOk=Y）", rows.filter((r) => r.cut && r.endOk));
