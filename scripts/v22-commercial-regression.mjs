/**
 * FactoryAuditB2B V2.2 — Commercial Rules Unification consistency regression.
 *
 * Spec §69-§76. Run: node scripts/v22-commercial-regression.mjs
 * Exits 0 when all checks pass, 1 on any failure.
 *
 * Truth sources:
 *   - lib/commercialConfig.ts  → public display truth (single source of price copy)
 *   - lib/commerce.ts          → order-amount truth (USD cents, server only)
 *   - i18n/dictionaries/*.json → display copy (9 locales, keys must mirror en)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const langs = ["en", "zh", "zh-TW", "de", "fr", "es", "pt", "ja", "ar"];

let pass = 0;
let fail = 0;
const fails = [];
function check(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log("  PASS  " + name);
  } else {
    fail++;
    fails.push(name + (detail ? "  — " + detail : ""));
    console.log("  FAIL  " + name + (detail ? "  — " + detail : ""));
  }
}

// ---------------------------------------------------------------------------
console.log("[1] lib/commercialConfig.ts — public price truth");
const cc = read("lib/commercialConfig.ts");
check("membership annual = 99", /membershipAnnualUsd:\s*99\b/.test(cc));
check("supplierVerification 99-129", /minUsd:\s*99\b[\s\S]*?maxUsd:\s*129\b/.test(cc));
check("factoryAudit starting = 399", /startingUsd:\s*399\b/.test(cc));
check("inspection starting = 199", /inspection:\s*\{[\s\S]*?startingUsd:\s*199\b/.test(cc));
check("sourcing commission 3-5%", /commissionMinPct:\s*3\b[\s\S]*?commissionMaxPct:\s*5\b/.test(cc));
check("training starter = 280", /training:\s*\{[\s\S]*?starterUsd:\s*280\b/.test(cc));
check("training pro = 950", /training:\s*\{[\s\S]*?proUsd:\s*950\b/.test(cc));
check("reportPreview basic = 99", /reportPreview:\s*\{[\s\S]*?basicUsd:\s*99\b/.test(cc));
check("reportPreview professional = 129", /reportPreview:\s*\{[\s\S]*?professionalUsd:\s*129\b/.test(cc));

// ---------------------------------------------------------------------------
// [1b] lib/suppliers.ts — MEMBERSHIP_PRICE_USD 必须是 COMMERCIAL 的转发绑定，
//      不得再是独立字面量（否则出现「两个 99」的双真源）。
console.log("[1b] lib/suppliers.ts — MEMBERSHIP_PRICE_USD forwarding binding");
const supSrc = read("lib/suppliers.ts");
check(
  "MEMBERSHIP_PRICE_USD = COMMERCIAL.membershipAnnualUsd",
  /export const MEMBERSHIP_PRICE_USD\s*=\s*COMMERCIAL\.membershipAnnualUsd\s*;/.test(supSrc),
);
check(
  "MEMBERSHIP_PRICE_USD no longer a bare integer literal",
  !/export const MEMBERSHIP_PRICE_USD\s*=\s*\d+\s*;/.test(supSrc),
);
check("lib/suppliers.ts imports COMMERCIAL", /from\s+["']\.\/commercialConfig["']/.test(supSrc));

// ---------------------------------------------------------------------------
console.log("[2] lib/commerce.ts — order amount truth (USD cents)");
const com = read("lib/commerce.ts");
check("inspection unitAmountMinor = 19900", /code:\s*"inspection"[\s\S]*?unitAmountMinor:\s*19900\b/.test(com));
check("verification_basic = 9900", /code:\s*"verification_basic"[\s\S]*?unitAmountMinor:\s*9900\b/.test(com));
check("verification_pro = 12900", /code:\s*"verification_pro"[\s\S]*?unitAmountMinor:\s*12900\b/.test(com));
check("factory_audit unitAmountMinor = 39900", /code:\s*"factory_audit"[\s\S]*?unitAmountMinor:\s*39900\b/.test(com));

// ---------------------------------------------------------------------------
console.log("[3] dictionaries — pricing ranges per locale");
const FORBIDDEN_DIM = [
  /10\s*dimension/i, /zehn\s*dimension/i, /dez\s*dimens/i, /diez\s*dimension/i,
  /عشرة\s*أبعاد/, /十個維度/, /10\s*個維度/, /10\s*维度/, /10-Dim/i, /10\s*次元/,
  /six\s*dimension/i,
];
for (const l of langs) {
  const raw = read("i18n/dictionaries/" + l + ".json");
  let d;
  try {
    d = JSON.parse(raw);
  } catch (e) {
    check(l + " dict parseable", false, e.message);
    continue;
  }
  const reports = d?.pricing?.reports;
  if (!Array.isArray(reports)) {
    check(l + " pricing.reports exists", false);
    continue;
  }
  const ranges = reports.map((r) => String(r.range || ""));
  const has199 = ranges.some((r) => /199/.test(r) && /\+/.test(r));
  const hasVerif = ranges.some((r) => /99/.test(r) && /129/.test(r));
  const hasAudit = ranges.some((r) => /399/.test(r) && /\+/.test(r));
  check(l + " inspection = USD 199+", has199, ranges.join(" | "));
  check(l + " verification = USD 99-129", hasVerif, ranges.join(" | "));
  check(l + " factory audit = USD 399+", hasAudit, ranges.join(" | "));
  const bad = FORBIDDEN_DIM.filter((re) => re.test(raw));
  check(l + " no '10/six dimension' copy", bad.length === 0, bad.map(String).join(","));
}

// ---------------------------------------------------------------------------
console.log("[3b] inspection page body — 'From USD 199 / man-day' in all locales");
for (const l of langs) {
  const d = JSON.parse(read("i18n/dictionaries/" + l + ".json"));
  const lead = String(d?.inspection?.pricingLead || "");
  check(l + " inspection.pricingLead shows 199", /199/.test(lead), lead.slice(0, 60));
}

// ---------------------------------------------------------------------------
// [3c] 培训价：字典只留 {price} 占位符，数字一律由 COMMERCIAL 注入（spec §39/§70）
// [3d] alsoItems 培训项同规则（④ 口径统一：不再写死「按工厂报价」）
// [3e] 目录型副本（membership meta / legal / paidLockLead / AI 兜底）必须等于 COMMERCIAL
console.log("[3c] dictionaries — training plan prices are {price} placeholders");
const numOf = (re) => { const m = cc.match(re); return m ? m[1] : ""; };
const C = {
  membership: numOf(/membershipAnnualUsd:\s*(\d+)/),
  verifMin: numOf(/minUsd:\s*(\d+)/),
  verifMax: numOf(/maxUsd:\s*(\d+)/),
  audit: numOf(/factoryAudit:\s*\{[\s\S]*?startingUsd:\s*(\d+)/),
  insp: numOf(/inspection:\s*\{[\s\S]*?startingUsd:\s*(\d+)/),
  trainStarter: numOf(/training:\s*\{[\s\S]*?starterUsd:\s*(\d+)/),
  trainPro: numOf(/training:\s*\{[\s\S]*?proUsd:\s*(\d+)/),
};
// 词边界匹配：\b99\b 不会命中 "199"（避免假 PASS）
const hasNum = (s, n) => n !== "" && new RegExp("\\b" + n + "\\b").test(String(s));
for (const l of langs) {
  const d = JSON.parse(read("i18n/dictionaries/" + l + ".json"));
  const pl = d?.trainingPlans?.plans || [];
  check(l + " trainingPlans[0].price = {price}", pl?.[0]?.price === "${price}", String(pl?.[0]?.price));
  check(l + " trainingPlans[1].price = {price}", pl?.[1]?.price === "${price}", String(pl?.[1]?.price));
  check(l + " trainingPlans[2] has no {price}", !/\{price\}/.test(String(pl?.[2]?.price || "")), String(pl?.[2]?.price));
  const also = Array.isArray(d?.pricing?.alsoItems) ? d.pricing.alsoItems : [];
  check(l + " alsoItems training row uses {price}", also.some((s) => /\{price\}/.test(String(s))), also.join(" | "));
}
console.log("[3e] dictionary price copies == COMMERCIAL (" + JSON.stringify(C) + ")");
for (const l of langs) {
  const d = JSON.parse(read("i18n/dictionaries/" + l + ".json"));
  const plans = d?.pricing?.plans || [];
  check(l + " plans[1].price has verification min+max",
    hasNum(plans?.[1]?.price, C.verifMin) && hasNum(plans?.[1]?.price, C.verifMax), String(plans?.[1]?.price));
  check(l + " plans[2].price has audit starting price",
    hasNum(plans?.[2]?.price, C.audit), String(plans?.[2]?.price));
  const memberKeys = {
    "membership.metaTitle": d?.membership?.metaTitle,
    "membership.metaDesc": d?.membership?.metaDesc,
    "membership.faq[0].a": d?.membership?.faq?.[0]?.a,
    "supplierProfile.paidLockLead": d?.supplierProfile?.paidLockLead,
    "legal.termsSections[7].b": d?.legal?.termsSections?.[7]?.b,
    "register.membershipLink": d?.register?.membershipLink,
  };
  const badMember = Object.entries(memberKeys).filter(([, v]) => !hasNum(v, C.membership)).map(([k]) => k);
  check(l + " membership price copies = " + C.membership, badMember.length === 0, badMember.join(","));
  const fb = d?.aiChat?.fallbackAnswers || {};
  check(l + " aiChat.pricing carries verification/audit/membership prices",
    hasNum(fb.pricing, C.verifMin) && hasNum(fb.pricing, C.verifMax) && hasNum(fb.pricing, C.audit) && hasNum(fb.pricing, C.membership),
    String(fb.pricing).slice(0, 70));
  check(l + " aiChat.training carries training prices",
    hasNum(fb.training, C.trainStarter) && hasNum(fb.training, C.trainPro), String(fb.training).slice(0, 70));
}

// ---------------------------------------------------------------------------
console.log("[4] sitemap — /membership removed");
const sm = read("app/sitemap.ts");
check("sitemap omits /membership", !sm.includes('"/membership"'));

// ---------------------------------------------------------------------------
console.log("[5] next.config.mjs — /membership → /pricing permanent redirect");
const cfg = read("next.config.mjs");
check(
  "redirect /membership → /pricing (permanent)",
  cfg.includes('source: "/membership"') && cfg.includes('destination: "/pricing"') && cfg.includes("permanent: true"),
);
check(
  "redirect /:locale/membership → /:locale/pricing (permanent)",
  cfg.includes('source: "/:locale/membership"') && cfg.includes('destination: "/:locale/pricing"') && cfg.includes("permanent: true"),
);

// ---------------------------------------------------------------------------
console.log("[6] rendered code — no stray p(\"/membership\") / no public 'Verified Supplier'");
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|mjs|cjs|jsx?)$/.test(e)) out.push(p);
  }
  return out;
}
const appFiles = walk(join(ROOT, "app"));
const compFiles = walk(join(ROOT, "components"));
const allFiles = [...appFiles, ...compFiles];
let renderedMembership = false;
let publicVerifiedSupplier = false;
for (const f of allFiles) {
  const src = readFileSync(f, "utf8");
  if (/p\(\s*"\/membership"\s*\)/.test(src)) renderedMembership = true;
  // 'Verified Supplier' only forbidden in user-facing copy; lib/supplierNetwork is internal model
  if (/\bVerified Supplier\b/.test(src) && !/lib[\\/]supplierNetwork/.test(f)) {
    publicVerifiedSupplier = true;
  }
}
check("no rendered p(\"/membership\") link", !renderedMembership);
check("no public 'Verified Supplier' surfaced", !publicVerifiedSupplier);

// ---------------------------------------------------------------------------
console.log("[7] analytics — membership_page_view / membership_cta retired");
const an = read("lib/analytics.ts");
check("no membership_page_view event", !/membership_page_view/.test(an));
check("no membership_cta event", !/membership_cta/.test(an));

// ---------------------------------------------------------------------------
// [8] lib/ai.ts — AI 知识库不得硬编码公开展示价（必须读 COMMERCIAL 插值）
console.log("[8] lib/ai.ts — price facts must come from COMMERCIAL");
const aiSrc = read("lib/ai.ts");
check("ai.ts imports COMMERCIAL", /from\s+["']\.\/commercialConfig["']/.test(aiSrc));
check("ai.ts injects membership price", /\$\$\{COMMERCIAL\.membershipAnnualUsd\}/.test(aiSrc));
check("ai.ts injects training prices", /\$\$\{COMMERCIAL\.training\.starterUsd\}/.test(aiSrc));
const HARDCODED_AI = /\$(?:99|129|199|280|399|950)\b/;
const aiHit = aiSrc.match(HARDCODED_AI);
check("ai.ts has no hardcoded public price literal", !aiHit, aiHit ? aiHit[0] : "");

// ---------------------------------------------------------------------------
console.log("");
console.log("RESULT  PASS=" + pass + "  FAIL=" + fail);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of fails) console.log("  - " + f);
  process.exit(1);
}
console.log("ALL COMMERCIAL CONSISTENCY CHECKS PASSED");
