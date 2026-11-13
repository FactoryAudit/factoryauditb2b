// scripts/sync-about-inperson-gates.cjs
//
// 把 en.json 叶子数门禁常量从 3336 同步到 3339（about 线下见面三键 × 9 语）。
// 规则来源：RELEASE-RULES.md 规则 3（多处同源，改字典必须全改）。
//
// 保护历史：含「→」的行不改（changelog 是既成事实），
// 唯一例外是 RELEASE-RULES.md 基线行 —— 单独精确处理并追加历史链。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OLD = "3336";
const NEW = "3339";

const GATE_FILES = [
  "scripts/verify-opennext-bundle.mjs",
  "scripts/cs06a-directory-regression.ts",
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs13b-cluster-directory-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
  "scripts/cs22a-public-profile-regression.ts",
  "scripts/cs22b-self-assessment-regression.ts",
];

let total = 0;
for (const rel of GATE_FILES) {
  const p = path.join(ROOT, rel);
  const raw = fs.readFileSync(p, "utf8");
  const crlf = raw.includes("\r\n");
  const lines = raw.split(/\r?\n/);
  let hits = 0;
  const out = lines.map((line) => {
    if (line.includes("→")) return line; // 历史 changelog，保护
    if (!line.includes(OLD)) return line;
    hits += (line.match(new RegExp(OLD, "g")) || []).length;
    return line.split(OLD).join(NEW);
  });
  const next = out.join(crlf ? "\r\n" : "\n");
  if (next !== raw) fs.writeFileSync(p, next, "utf8");
  total += hits;
  console.log(`${hits ? "SYNC" : "SKIP"} ${rel}  (${hits} 处)`);
}

// ---- cs06a：追加本轮 changelog ----
{
  const p = path.join(ROOT, "scripts/cs06a-directory-regression.ts");
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  const nl = s.includes("\r\n") ? "\r\n" : "\n";
  const anchor =
    "  //              （脚本：scripts/apply-wechat-i18n.cjs，幂等）";
  const add =
    anchor +
    nl +
    "  // 3336 → 3339：/about 加「线下见面」真实照片区块，强调核验由人执行、不外包——" +
    nl +
    "  //              about 命名空间新增 inPersonTitle / inPersonBody / inPersonCaption 3 键 × 9 语" +
    nl +
    "  //              （脚本：scripts/apply-about-inperson-i18n.cjs，幂等）";
  if (s.includes(anchor) && !s.includes("3336 → 3339")) s = s.replace(anchor, add);
  if (s !== before) {
    fs.writeFileSync(p, s, "utf8");
    console.log("SYNC scripts/cs06a-directory-regression.ts  (changelog)");
  }
}

// ---- RELEASE-RULES.md 基线行 ----
{
  const p = path.join(ROOT, "RELEASE-RULES.md");
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace("当前基线：**3336**", "当前基线：**3339**");
  s = s.replace("3307 → 3333 → **3336**", "3307 → 3333 → 3336 → **3339**");
  if (s !== before) {
    fs.writeFileSync(p, s, "utf8");
    console.log("SYNC RELEASE-RULES.md  (基线 + 历史链)");
  }
}

console.log(`\nTOTAL ${total} 处字面量替换完成（${OLD} → ${NEW}）`);
