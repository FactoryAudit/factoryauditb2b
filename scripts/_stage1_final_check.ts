/**
 * 阶段 1 只读终值核验 v2（修正键名：真实走生产同源 buildPageMetadata）
 *
 * v1 的键名选取有误（/terms 实际用 legal.termsTitle；field-reports / case-studies
 * 的 desc 来自 TS 常量而非字典），本版按各页 generateMetadata 的真实取值来源对表。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildPageMetadata } from "../lib/pageMeta";
import { pickZhCopy } from "../lib/tw";
import { FIELD_REPORT_LIST_META } from "../lib/fieldReports";
import { CASE_LIST_META } from "../lib/caseStudies";
import { GUIDES } from "../lib/guides";
import type { Locale } from "../i18n/config";

const ROOT = path.resolve(__dirname, "..");
const LOCALES: Locale[] = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
const L = (s: unknown) => [...String(s ?? "")].length;
const CJK = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

const dict = (l: Locale): any =>
  JSON.parse(readFileSync(path.join(ROOT, "i18n", "dictionaries", `${l}.json`), "utf8"));
const get = (o: any, k: string) => k.split(".").reduce((a, b) => (a == null ? a : a[b]), o);

// inScope = 本次阶段 1 任务 A/C 明确覆盖的对象
type Target = {
  path: string; label: string; inScope: boolean;
  title: (d: any, l: Locale) => string;
  desc: (d: any, l: Locale) => string;
};
const qms = GUIDES.find((g) => g.slug === "what-is-quality-management-system")!;

const TARGETS: Target[] = [
  { label: "/", path: "/", inScope: true, title: (d) => get(d, "home.metaTitle"), desc: (d) => get(d, "home.metaDesc") },
  { label: "/suppliers", path: "/suppliers", inScope: true, title: (d) => get(d, "suppliers.metaTitle"), desc: (d) => get(d, "suppliers.metaDesc") },
  { label: "/services", path: "/services", inScope: true, title: (d) => get(d, "servicesIndex.metaTitle"), desc: (d) => get(d, "servicesIndex.metaDesc") },
  { label: "/services/inspection", path: "/services/inspection", inScope: true, title: (d) => get(d, "inspection.metaTitle"), desc: (d) => get(d, "inspection.metaDesc") },
  { label: "/services/supplier-verification", path: "/services/supplier-verification", inScope: true, title: (d) => get(d, "serviceVerification.metaTitle"), desc: (d) => get(d, "serviceVerification.metaDesc") },
  { label: "/case-studies", path: "/case-studies", inScope: true, title: (d) => get(d, "caseStudies.metaTitle"), desc: (_d, l) => pickZhCopy(l, CASE_LIST_META) },
  { label: "/standard-report", path: "/standard-report", inScope: true, title: (d) => get(d, "standardReport.metaTitle"), desc: (d) => get(d, "standardReport.metaDesc") },
  { label: "/pricing", path: "/pricing", inScope: true, title: (d) => get(d, "pricing.metaTitle"), desc: (d) => get(d, "pricing.metaDesc") },
  { label: "/monitoring", path: "/monitoring", inScope: true, title: (d) => get(d, "monitoring.metaTitle"), desc: (d) => get(d, "monitoring.metaDesc") },
  { label: "/chemicals", path: "/chemicals", inScope: true, title: (d) => get(d, "chemicals.metaTitle"), desc: (d) => get(d, "chemicals.metaDesc") },
  { label: "/field-reports", path: "/field-reports", inScope: true, title: (d) => get(d, "fieldReports.metaTitle"), desc: (_d, l) => pickZhCopy(l, FIELD_REPORT_LIST_META) },
  { label: "/logistics", path: "/logistics", inScope: true, title: (d) => get(d, "container.page.metaTitle"), desc: (d) => get(d, "container.page.metaDesc") },
  { label: "/terms", path: "/terms", inScope: true, title: (d) => get(d, "legal.termsTitle"), desc: (d) => get(d, "legal.termsIntro") },
  { label: "/trust", path: "/trust", inScope: true, title: (d) => get(d, "trust.metaTitle"), desc: (d) => get(d, "trust.metaDesc") },
  { label: "/tools/supplier-risk-calculator", path: "/tools/supplier-risk-calculator", inScope: true, title: (d) => `${get(d, "risk.page.metaTitle")} | FactoryAuditB2B RiskScore™`, desc: (d) => get(d, "risk.page.metaDesc") },
  { label: "/guides/QMS", path: "/guides/what-is-quality-management-system", inScope: true, title: (_d, l) => pickZhCopy(l, { en: qms.metaTitleEn ?? qms.titleEn, zh: qms.metaTitleZh ?? qms.titleZh }), desc: (_d, l) => pickZhCopy(l, { en: qms.metaDescEn, zh: qms.metaDescZh }) },
];

const TITLE_BAD: string[] = [];
const DESC_BAD: string[] = [];
let n = 0;

for (const loc of LOCALES) {
  const d = dict(loc);
  console.log(`\n──────────── ${loc} ────────────`);
  for (const t of TARGETS) {
    const rawTitle = String(t.title(d, loc) ?? "");
    const rawDesc = String(t.desc(d, loc) ?? "");
    if (!rawTitle) continue;
    n++;
    const md: any = buildPageMetadata({ locale: loc, path: t.path, title: rawTitle, description: rawDesc });
    const fT = String(md.title), fD = String(md.description);
    const tBad = CJK.test(fT) ? L(fT) > 56 : L(fT) < 50 || L(fT) > 62;
    // desc：CJK 用项目口径 45–90（pageMeta 注释：43–81 本已合规）；拉丁 120–158
    const dBad = CJK.test(fD) ? L(fD) < 45 || L(fD) > 90 : L(fD) < 120 || L(fD) > 158;
    if (tBad) TITLE_BAD.push(`${loc} ${t.label} (${L(fT)})${t.inScope ? "" : " [旁]"}`);
    if (dBad) DESC_BAD.push(`${loc} ${t.label} (${L(fD)})${t.inScope ? "" : " [旁]"}`);
    console.log(`  ${tBad ? "✗T" : "  "}${dBad ? "✗D" : "  "} ${t.label.padEnd(34)} T=${String(L(fT)).padStart(3)} D=${String(L(fD)).padStart(3)}`);
  }
}

console.log("\n" + "=".repeat(96));
console.log(`共核验 ${n} 条（9 语 × ${TARGETS.length} 页）`);
console.log(`title 越界 ${TITLE_BAD.length}：${TITLE_BAD.length ? "\n  " + TITLE_BAD.join("\n  ") : " ✓"}`);
console.log(`desc  越界 ${DESC_BAD.length}：${DESC_BAD.length ? "\n  " + DESC_BAD.join("\n  ") : " ✓"}`);
console.log("=".repeat(96));
