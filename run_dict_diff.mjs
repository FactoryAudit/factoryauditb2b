import fs from "node:fs";
const ROOT = "F:/AI-验厂SEO网站";
const prodPath = ROOT + "/.open-next/server-functions/default/i18n/dictionaries/en.json";
const cands = [
  "i18n/dictionaries/en.json",
  "messages/en.json",
  "lib/i18n/dictionaries/en.json",
  "src/i18n/dictionaries/en.json",
  "dictionaries/en.json",
];
let src = null;
for (const c of cands) if (fs.existsSync(ROOT + "/" + c)) { src = c; break; }

function leaves(o) { let n = 0; for (const v of Object.values(o)) n += v && typeof v === "object" ? leaves(v) : 1; return n; }
function keys(o, p = "") { const out = []; for (const [k, v] of Object.entries(o)) { if (v && typeof v === "object") out.push(...keys(v, p + k + ".")); else out.push(p + k); } return out; }

const prod = JSON.parse(fs.readFileSync(prodPath, "utf8"));
console.log("PROD leaves =", leaves(prod));
if (!src) { console.log("no src dict found among", cands); process.exit(0); }
const s = JSON.parse(fs.readFileSync(ROOT + "/" + src, "utf8"));
console.log("SRC", src, "leaves =", leaves(s));
const pk = new Set(keys(prod)), sk = new Set(keys(s));
const onlyProd = [...pk].filter((k) => !sk.has(k));
const onlySrc = [...sk].filter((k) => !pk.has(k));
console.log("keys in PROD not in SRC (" + onlyProd.length + "):");
console.log(onlyProd.join("\n"));
console.log("keys in SRC not in PROD (" + onlySrc.length + "):");
console.log(onlySrc.slice(0, 20).join("\n"));
