/**
 * 阶段 1 只读核验：打印「源头 desc → 收口后 desc」的逐字文本，
 * 用于确认是否出现「无句末标点的机器截断」。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { trimMetaDescription } from "../lib/pageMeta";
import type { Locale } from "../i18n/config";

const ROOT = path.resolve(__dirname, "..");
const LOCALES: Locale[] = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
const dict = (l: Locale): any =>
  JSON.parse(readFileSync(path.join(ROOT, "i18n", "dictionaries", `${l}.json`), "utf8"));
const get = (o: any, k: string) => k.split(".").reduce((a, b) => (a == null ? a : a[b]), o);
const L = (s: unknown) => [...String(s ?? "")].length;

const KEYS = [
  "suppliers.metaDesc",
  "legal.termsIntro",
  "home.lead",
  "home.metaDesc",
  "serviceVerification.metaDesc",
  "container.page.metaDesc",
  "risk.page.metaDesc",
  "monitoring.metaDesc",
];

for (const k of KEYS) {
  console.log(`\n########## ${k} ##########`);
  for (const loc of LOCALES) {
    const raw = String(get(dict(loc), k) ?? "");
    if (!raw) {
      console.log(`  ${loc.padEnd(6)} (MISSING)`);
      continue;
    }
    const out = trimMetaDescription(raw);
    const cut = out !== raw;
    const endOk = /[.。!！?？]$/.test(out);
    console.log(
      `  ${loc.padEnd(6)} ${String(L(raw)).padStart(3)} -> ${String(L(out)).padStart(3)}` +
        ` ${cut ? "CUT" : "   "} ${endOk ? "endOk" : "NO-END-PUNCT"}` +
        (cut ? `  ...${JSON.stringify(out.slice(-42))}` : "")
    );
  }
}
