import { readFileSync } from "node:fs";
const out = [];
let n = 0;
(function walk(o) {
  if (o === null || o === undefined) return;
  if (typeof o === "object" && !Array.isArray(o)) {
    for (const k of Object.keys(o)) walk(o[k]);
  } else n++;
})(JSON.parse(readFileSync("i18n/dictionaries/en.json", "utf8")));
out.push("en leaf count now = " + n + " (was 2373)");

for (const loc of ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"]) {
  const d = JSON.parse(readFileSync(`i18n/dictionaries/${loc}.json`, "utf8"));
  const v = d?.rfq?.form?.labels?.publicConsent;
  out.push(`${loc}: ${v ? "OK" : "MISSING"} ${v ?? ""}`);
}

const GATES = [
  "RELEASE-RULES.md",
  "scripts/verify-opennext-bundle.mjs",
  "scripts/cs06a-directory-regression.ts",
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
];
for (const f of GATES) {
  const s = readFileSync(f, "utf8");
  const stale = s
    .split("\n")
    .filter((l) => !l.includes("→") && (l.includes("2938") || l.includes("2934"))).length;
  out.push(`${f}: stale(2938/2934)=${stale} has2939=${s.includes("2939")}`);
}
console.log(out.join("\n"));
