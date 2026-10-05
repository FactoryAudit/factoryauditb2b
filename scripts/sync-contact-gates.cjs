/**
 * /contact 页 i18n 门禁同步：en 字典叶子数 3258 → 3288。
 *
 * /contact 页去掉内联 `const COPY`，新增 root `contact` 命名空间（顶层 13 键 +
 * 嵌套 form 17 键 = 30 键，全字符串）× 9 语 ⇒ en 叶子数 3258 + 30 = 3288。
 *
 * 处理规则（与 sync-changesetB-gates.cjs / sync-step07-gates.cjs 同一套）：
 *   · PLAIN 文件：全局替换 3258 → 3288（这些文件里 3258 只作为断言常量/描述出现）。
 *   · RELEASE-RULES.md：全局替换（该行当前有 2 处 **3258**，既有约定即全文替换，
 *     见 scripts/_r71_memory_update.cjs 的备忘「RELEASE-RULES.md 同行 2 次 ⇒ 全文替换」）。
 *   · cs06a：替换常量/注释 + 修正 C7 注释里的字符串数（3122 → 3284，3258 = 3284 字符串
 *     + 4 boolean），最后追加一条 3258 → 3288 变更日志（历史条目不动）。
 *
 * 跑法：node scripts/sync-contact-gates.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FROM = "3258";
const TO = "3288";

const PLAIN = [
  "scripts/verify-opennext-bundle.mjs",
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
  "scripts/cs22a-public-profile-regression.ts",
  "scripts/cs22b-self-assessment-regression.ts",
  "scripts/cs13b-cluster-directory-regression.ts",
  "RELEASE-RULES.md",
];

let total = 0;

for (const rel of PLAIN) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.log(`SKIP  ${rel}（不存在）`);
    continue;
  }
  const src = fs.readFileSync(file, "utf8");
  const hits = src.split(FROM).length - 1;
  if (hits === 0) {
    console.log(`SKIP  ${rel}（无 ${FROM}）`);
    continue;
  }
  fs.writeFileSync(file, src.split(FROM).join(TO), "utf8");
  total += hits;
  console.log(`OK    ${rel}  替换 ${hits} 处`);
}

// ---- cs06a：常量/注释替换 + 修正字符串数 + 追加变更日志 ----
{
  const rel = "scripts/cs06a-directory-regression.ts";
  const file = path.join(ROOT, rel);
  let out = fs.readFileSync(file, "utf8");

  // C7 注释里的字符串数（3258 叶子 = 3284 字符串 + 4 boolean）
  out = out.split("= 3122 字符串 + 4 boolean").join("= 3284 字符串 + 4 boolean");

  const hits = out.split(FROM).length - 1;
  out = out.split(FROM).join(TO);

  // 追加本次变更日志（紧跟最后一条既成事实之后）
  const anchor =
    "  //              （脚本：scripts/apply-changesetB-i18n.cjs，幂等 + 九语键集自检）";
  const entry =
    anchor +
    "\n  // 3258 → 3288：/contact 页去掉内联 COPY，新增 contact 命名空间（顶层 13 + 嵌套 form 17 = 30 键，全字符串）× 9 语\n" +
    "  //              （脚本：scripts/_apply_contact_i18n.cjs，幂等 + 九语键集自检）";
  if (out.includes(anchor) && !out.includes("3258 → 3288")) {
    out = out.replace(anchor, entry);
  } else if (!out.includes("3258 → 3288")) {
    console.log(`WARN  ${rel} 未找到追加锚点，请人工补一条变更日志`);
  }

  fs.writeFileSync(file, out, "utf8");
  total += hits;
  console.log(`OK    ${rel}  替换 ${hits} 处 + 追加变更日志`);
}

console.log(`\n完成：共替换 ${total} 处 ${FROM} → ${TO}`);
console.log("提示：跑 cs06a / cs08 / cs12 / cs13 / cs13b / cs16 / cs17 / cs20 / cs22a / cs22b 回归 + verify-opennext-bundle 验证");
