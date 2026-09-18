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
console.log("");
console.log("RESULT  PASS=" + pass + "  FAIL=" + fail);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of fails) console.log("  - " + f);
  process.exit(1);
}
console.log("ALL COMMERCIAL CONSISTENCY CHECKS PASSED");
