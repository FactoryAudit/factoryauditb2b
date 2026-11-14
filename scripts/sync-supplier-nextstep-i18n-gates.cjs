// scripts/sync-supplier-nextstep-i18n-gates.cjs
//
// 把 en.json 叶子数门禁常量从 3343 同步到 3350。
//
// 本轮变更（2026-11-14，供应商注册「成功即引导」）：
//   supplierNetwork 新增 7 键 × 9 语
//     · form.labels.companyDescription  注册表新增「公司简介」（直接落 company_description）
//     · nextTitle / nextLead            成功页标题与说明
//     · nextPhoto / nextDesc / nextCapacity  三条下一步清单
//     · nextCta                         按钮：去完善档案
//
// 规则来源：RELEASE-RULES.md 规则 3（多处同源，改字典必须全改）。
//
// 保护历史：含「→」的行不改（changelog 是既成事实）。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OLD = "3343";
const NEW = "3350";

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

// ---- cs06a：修掉 C7 注释里既有的错误拆解（3343 ≠ 3299 字符串 + 4 boolean）+ 追加本轮 changelog ----
{
  const p = path.join(ROOT, "scripts/cs06a-directory-regression.ts");
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  const nl = s.includes("\r\n") ? "\r\n" : "\n";

  s = s.replace(
    `  // C7 九语字典：键集合与 en 完全一致，叶子数恒为 ${NEW}（= 3299 字符串 + 4 boolean）`,
    `  // C7 九语字典：键集合与 en 完全一致，叶子数恒为 ${NEW}`
  );

  const anchor =
    "  //              （脚本：scripts/_r58_supplier_form_i18n.cjs；同轮删掉 labels 里手写的「 *」，不改叶子数）";
  const add =
    anchor +
    nl +
    "  // 3343 → 3350：供应商注册「成功即引导」——成功页从一句「已收到」改为下一步清单，" +
    nl +
    "  //              注册表补公司简介字段（落 company_description，发布后即买家可见）——" +
    nl +
    "  //              supplierNetwork 新增 form.labels.companyDescription / nextTitle / nextLead /" +
    nl +
    "  //              nextPhoto / nextDesc / nextCapacity / nextCta 7 键 × 9 语" +
    nl +
    "  //              （脚本：scripts/_r59_supplier_next_step_i18n.cjs，幂等）";
  if (s.includes(anchor) && !s.includes("3343 → 3350")) s = s.replace(anchor, add);

  if (s !== before) {
    fs.writeFileSync(p, s, "utf8");
    console.log("SYNC scripts/cs06a-directory-regression.ts  (注释修正 + changelog)");
  }
}

// ---- RELEASE-RULES.md 基线行 ----
{
  const p = path.join(ROOT, "RELEASE-RULES.md");
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace("当前基线：**3343**", "当前基线：**3350**");
  s = s.replace("3339 → **3343**", "3339 → 3343 → **3350**");
  if (s !== before) {
    fs.writeFileSync(p, s, "utf8");
    console.log("SYNC RELEASE-RULES.md  (基线 + 历史链)");
  }
}

console.log(`\nTOTAL ${total} 处字面量替换完成（${OLD} → ${NEW}）`);
