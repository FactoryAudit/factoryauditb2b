/**
 * STEP-07 —— 门禁基线同步：en 字典叶子数 2926 → 2938。
 *
 * STEP-07 首页 Live Buyer Requests 模块新增 home.* 下 12 键（全字符串，无 boolean）：
 *   liveTitle/liveLead + liveEmptyTitle/liveEmptyLead/liveEmptyCta + liveViewAll
 *   + liveRespondCta/livePosted/liveQuantity/liveMarket/liveIndustry/liveCerts
 *   ⇒ 2926 + 12 = 2938（= 2934 字符串 + 4 boolean）。
 *
 * 处理规则（与 sync-step05/sync-step06-gates.cjs 同一套）：
 *   · 除 cs06a 外的文件：全局替换 2926 → 2938。
 *   · cs06a：先保护历史变更日志标记 `2912 → 2926`（不可篡改），
 *     再更新 C7 注释 `2922 字符串` → `2934 字符串`，替换 C8 断言 2926 → 2938，
 *     最后追加 `2926 → 2938` 变更日志。
 *   · RELEASE-RULES.md：2908 字符串 → 2934 字符串，2926 → 2938。
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const FROM = "2926";
const TO = "2938";
const FROM_STR = "2908 字符串";
const TO_STR = "2934 字符串";

const abs = (p) => path.join(ROOT, p);
const read = (p) => fs.readFileSync(abs(p), "utf8");
const write = (p, s) => fs.writeFileSync(abs(p), s);

const changed = [];

// 1) 简单全局替换（无历史 step 标记需要保护）
const simple = [
  "scripts/verify-opennext-bundle.mjs",
  "scripts/cs20-supplier-report.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs08-form-regression.ts",
];

for (const f of simple) {
  let s = read(f);
  if (!s.includes(FROM)) {
    console.log(`SKIP ${f} (无 ${FROM})`);
    continue;
  }
  s = s.split(FROM).join(TO);
  write(f, s);
  changed.push(f);
}

// 2) RELEASE-RULES.md
{
  const f = "RELEASE-RULES.md";
  let s = read(f);
  s = s.split(FROM_STR).join(TO_STR).split(FROM).join(TO);
  write(f, s);
  changed.push(f);
}

// 3) cs06a：保护历史 2912 → 2926，仅改 C7 注释字符串数 + C8 断言 + 追加 STEP07 日志
{
  const f = "scripts/cs06a-directory-regression.ts";
  let s = read(f);
  // C7 注释：叶子数 + 字符串数
  s = s
    .split("2926（= 2922 字符串 + 4 boolean）")
    .join("2938（= 2934 字符串 + 4 boolean）");
  // C8 断言
  s = s.split("baseKeys.length === 2926").join("baseKeys.length === 2938");
  // 追加 STEP-07 变更日志（插在 STEP-06 条目尾部 ctaSecondary 注释之后）
  const anchor =
    "  //              （脚本：scripts/apply-step06-i18n.cjs，幂等 + 九语键集自检；ctaSecondary 仅改写值）";
  const step07 = [
    "  // 2926 → 2938：STEP-07 首页 Live Buyer Requests 模块（home.* 下 12 键，全字符串）——",
    "  //              liveTitle/liveLead + liveEmptyTitle/liveEmptyLead/liveEmptyCta + liveViewAll",
    "  //              + liveRespondCta/livePosted/liveQuantity/liveMarket/liveIndustry/liveCerts × 9 语",
    "  //              （脚本：scripts/apply-step07-i18n.cjs，幂等 + 九语键集自检；复用 /rfq 提交流，不新建表）",
  ].join("\n");
  if (s.includes(anchor) && !s.includes("2926 → 2938")) {
    s = s.replace(anchor, anchor + "\n" + step07);
  } else if (!s.includes("2926 → 2938")) {
    console.log("WARN cs06a 未找到追加锚点，请人工补一条变更日志");
  }
  write(f, s);
  changed.push(f);
}

console.log("✅ STEP-07 门禁同步完成，更新文件：");
changed.forEach((f) => console.log("  - " + f));
