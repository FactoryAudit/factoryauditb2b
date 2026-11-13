// scripts/sync-wechat-gates.cjs
//
// 把 en.json 叶子数门禁常量从 3333 同步到 3336（contact 微信三键 × 9 语）。
// 规则来源：RELEASE-RULES.md 规则 3（多处同源，改字典必须全改）。
//
// 保护历史：含「→」的 changelog 行不改（history 是不可篡改的既成事实），
// 唯一例外是 RELEASE-RULES.md 的基线行 —— 它同时承载当前值，单独精确处理。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OLD = "3333";
const NEW = "3336";

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
  // RELEASE-RULES 的 8 处清单没列这两个，但它们确实断言同一常量：
  // 漏改 ⇒ 单跑验收脚本时假 FAIL。一并同步。
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

// ---- cs06a：追加本轮 changelog（放在 3307 → 3333 那条之后） ----
{
  const p = path.join(ROOT, "scripts/cs06a-directory-regression.ts");
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  const nl = s.includes("\r\n") ? "\r\n" : "\n";
  const anchor =
    "  //              （脚本：scripts/apply-rfq-request-types-i18n.cjs，幂等 + 九语键集自检）";
  const add =
    anchor +
    nl +
    "  // 3333 → 3336：/contact 加微信二维码 + 手机号（与 WhatsApp 同号，号码读 NEXT_PUBLIC_WHATSAPP_NUMBER）——" +
    nl +
    "  //              contact 命名空间新增 wechatLabel / wechatNote / wechatAlt 3 键 × 9 语" +
    nl +
    "  //              （脚本：scripts/apply-wechat-i18n.cjs，幂等）";
  if (s.includes(anchor) && !s.includes("3333 → 3336")) s = s.replace(anchor, add);
  if (s !== before) {
    fs.writeFileSync(p, s, "utf8");
    console.log("SYNC scripts/cs06a-directory-regression.ts  (changelog)");
  }
}

// ---- RELEASE-RULES.md 基线行（同一条 line 上出现两次当前值） ----
{
  const p = path.join(ROOT, "RELEASE-RULES.md");
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace("当前基线：**3333**", "当前基线：**3336**");
  s = s.replace(
    "3291 → 3292 → 3295 → 3307 → **3333**",
    "3291 → 3292 → 3295 → 3307 → 3333 → **3336**"
  );
  if (s !== before) {
    fs.writeFileSync(p, s, "utf8");
    console.log("SYNC RELEASE-RULES.md  (基线 + 历史链)");
  }
}

console.log(`\nTOTAL ${total} 处字面量替换完成（${OLD} → ${NEW}）`);
