/**
 * STEP-06 —— 门禁基线同步：en 字典叶子数 2912 → 2926。
 *
 * STEP-06 新增 home.* 下 14 个叶子键（全字符串）+ 改写 ctaSecondary 值（不增键）：
 *   needTitle/needLead + entry{Find,Cluster,Verify,Rfq}{Title,Desc,Cta}（14 键 × 9 语）
 *   ⇒ 2912 + 14 = 2926（= 2922 字符串 + 4 boolean）。
 *
 * 处理规则（与 sync-step05-gates.cjs 同一套）：
 *   · 除 cs06a 外的文件：全局替换 2912 → 2926。
 *   · cs06a：先保护历史变更日志标记 `2846 → 2912`（不可篡改），
 *     再更新 `2908 字符串` → `2922 字符串`，替换其余 2912 → 2926，
 *     最后追加 `2912 → 2926` 变更日志。
 *
 * 跑法：node scripts/sync-step06-gates.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FROM = "2912";
const TO = "2926";

const PLAIN = [
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
  "scripts/verify-opennext-bundle.mjs",
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

// ---- cs06a：保护历史日志后再替换 ----
{
  const rel = "scripts/cs06a-directory-regression.ts";
  const file = path.join(ROOT, rel);
  const src = fs.readFileSync(file, "utf8");

  // ① 历史标记占位（`2846 → 2912` 是 STEP-05 的事实记录，不可被本次替换改写）
  let out = src.split("2846 → 2912").join("@@KEEP_STEP05@@");
  // ② 类型分布注释（STEP-05 基线 = 2908 字符串；STEP-06 +14 ⇒ 2922 字符串）
  out = out.split("2908 字符串").join("2922 字符串");
  // ③ 常量与其余注释中的数字
  const hits = out.split(FROM).length - 1;
  out = out.split(FROM).join(TO);
  // ④ 还原历史标记
  out = out.split("@@KEEP_STEP05@@").join("2846 → 2912");

  // ⑤ 追加本次变更日志（紧跟 STEP-05 那条之后）
  const anchor = `  //              （脚本：scripts/apply-step05-i18n.cjs，幂等 + 九语键集自检）`;
  if (out.includes(anchor) && !out.includes("2912 → 2926")) {
    out =
      out.replace(
        anchor,
        anchor +
          `\n  // 2912 → 2926：STEP-06 首页「What do you need?」四入口（home.* 下 14 键，全字符串）——\n` +
          `  //              needTitle/needLead + entry{Find,Cluster,Verify,Rfq}{Title,Desc,Cta} × 9 语\n` +
          `  //              （脚本：scripts/apply-step06-i18n.cjs，幂等 + 九语键集自检；ctaSecondary 仅改写值）`
      );
  } else if (!out.includes("2912 → 2926")) {
    console.log(`WARN  ${rel} 未找到追加锚点，请人工补一条变更日志`);
  }

  fs.writeFileSync(file, out, "utf8");
  total += hits;
  console.log(`OK    ${rel}  替换 ${hits} 处 + 追加变更日志`);
}

console.log(`\n完成：共替换 ${total} 处 ${FROM} → ${TO}`);
console.log("提示：跑 cs06a / cs08 / cs12 / cs13 / cs16 / cs17 / cs20 回归 + verify-opennext-bundle 验证");
