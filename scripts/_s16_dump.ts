/**
 * stage1.6 探针：导出第 3 批在册源键的当前值
 * 打印「键 / 语种 / 源头长度 / 收口后长度 / 结尾是否句末标点 / CUT(是否被截断)」
 *
 * 用法：node scripts/run-regression.mjs _s16_dump > _s16_dump.log
 */
import fs from "fs";
import path from "path";
import { trimMetaDescription } from "../lib/pageMeta";
import { CASE_STUDIES, CASE_LIST_META } from "../lib/caseStudies";
import { FIELD_REPORTS, FIELD_REPORT_LIST_META } from "../lib/fieldReports";
import { INDUSTRY_COPY } from "../lib/industryContent";
import { COVERAGE_COUNTRIES } from "../lib/coverage";

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"] as const;
type Loc = (typeof LOCALES)[number];

const dict = {} as Record<string, any>;
for (const l of LOCALES) {
  dict[l] = JSON.parse(fs.readFileSync(path.join("i18n/dictionaries", `${l}.json`), "utf8"));
}

const SENT = /[.。!！?？]/;
const lines: string[] = [];

function get(o: any, p: string) {
  return p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
}

function row(tag: string, loc: string, raw: string | undefined) {
  if (raw === undefined) {
    lines.push(`  ${tag.padEnd(34)} ${loc.padEnd(6)} (MISSING)`);
    return;
  }
  const out = trimMetaDescription(raw);
  const src = [...raw].length;
  const dst = [...out].length;
  const endOk = SENT.test(out.slice(-1));
  const cut = out !== raw;
  lines.push(
    `  ${tag.padEnd(34)} ${loc.padEnd(6)} src=${String(src).padStart(3)} out=${String(dst).padStart(3)} endOk=${
      endOk ? "Y" : "N"
    } CUT=${cut ? "Y" : "n"}`,
  );
}

const DICT_KEYS: Array<[string, string]> = [
  ["countries.list  coverage.metaDesc", "coverage.metaDesc"],
  ["countries.slug  countryHub.metaDesc", "countryHub.metaDesc"],
  ["industry.cat    industryPage.metaDesc", "industryPage.metaDesc"],
  ["services.inspection", "inspection.metaDesc"],
  ["services.supplier-improvement", "trainingPage.metaDesc"],
  ["services.supplier-verification", "serviceVerification.metaDesc"],
  ["careers", "careers.metaDesc"],
  ["pricing", "pricing.metaDesc"],
  ["tools.risk-calc desc", "risk.page.metaDesc"],
  ["tools.risk-calc title", "risk.page.metaTitle"],
  ["methodology", "methodology.metaDesc"],
  ["verify-supplier", "verifySupplier.metaDesc"],
  ["resources", "resourcesIndex.metaDesc"],
  ["training-plans", "trainingPlans.metaDesc"],
  ["terms title", "legal.termsTitle"],
  ["monitoring desc", "monitoring.metaDesc"],
  ["chemicals desc", "chemicals.metaDesc"],
];

lines.push("###################### A. 字典源键（9 语） ######################");
for (const [tag, key] of DICT_KEYS) {
  lines.push(`\n--- ${tag}  [${key}] ---`);
  for (const l of LOCALES) row(tag, l, get(dict[l], key));
}

lines.push("\n\n###################### B. TS 常量：case-studies 详情（pickZhPair） ######################");
for (const c of CASE_STUDIES) {
  lines.push(`\n--- ${c.slug} ---`);
  row(c.slug, "en -> 7语", (c as any).metaDescEn);
  row(c.slug, "zh/zh-TW", (c as any).metaDescZh);
}
lines.push("\n--- case-studies LIST (CASE_LIST_META) ---");
for (const l of ["en", "zh", "zh-TW"] as Loc[])
  row("caseList", l, (CASE_LIST_META as any)[l]);

lines.push("\n\n###################### C. TS 常量：field-reports 详情 ######################");
for (const r of FIELD_REPORTS) {
  lines.push(`\n--- ${r.slug} ---`);
  row(r.slug, "en -> 7语", (r as any).metaDescEn);
  row(r.slug, "zh/zh-TW", (r as any).metaDescZh);
}
lines.push("\n--- field-reports LIST (FIELD_REPORT_LIST_META) ---");
for (const l of ["en", "zh", "zh-TW"] as Loc[])
  row("fieldList", l, (FIELD_REPORT_LIST_META as any)[l]);

lines.push("\n\n###################### D. TS 常量：industry topics 详情（pickZhPair） ######################");
for (const [industry, copy] of Object.entries(INDUSTRY_COPY) as any[]) {
  for (const t of copy.topics as any[]) {
    lines.push(`\n--- ${industry}/${t.slug}  (${t.pageType}) ---`);
    row(t.slug, "en -> 7语", t.metaDesc?.en);
    row(t.slug, "zh/zh-TW", t.metaDesc?.zh);
  }
}

lines.push("\n\n###################### E. coverage.ts COVERAGE_COUNTRIES.metaDesc ######################");
for (const c of COVERAGE_COUNTRIES) {
  lines.push(`\n--- ${c.slug} ---`);
  row(c.slug, "coverage.ts", (c as any).metaDesc);
}

const out = lines.join("\n");
fs.writeFileSync("_s16_dump.log", out, "utf8");
console.log(out);
