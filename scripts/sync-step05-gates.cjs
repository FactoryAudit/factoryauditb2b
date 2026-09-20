/**
 * STEP-05 —— 门禁基线同步：en 字典叶子数 2846 → 2912。
 *
 * 为什么必须同步：项目把 en 字典叶子数当**冻结常量**来防「翻译把键结构改坏了」
 * （加键漏改常量 ⇒ 回归红，避免悄悄少键/多键）。STEP-05 新增
 *   · verifySupplier.* 命名空间（页面 6 + 卡片 14 + linkedPrefix 1 + 表单 30 +
 *     checks[3] + rules[4]）                                    （58）
 *   · supplierProfile.verifyThisSupplier                        （1）
 *   共 59 键 × 9 语 …… 但注意 checks / rules / valueOptions / urgencyOptions
 *   是数组与嵌套对象，实测叶子数 = 66（见 apply-step05-i18n.cjs 自检输出）
 *   ⇒ 2846 + 66 = 2912。
 *
 * 处理规则（与 sync-changesetB-gates.cjs 完全同一套）：
 *   · 除 cs06a 外的文件：全局替换 2846 → 2912（这些文件里 2846 只作为断言常量出现）。
 *   · cs06a：**先保护历史变更日志标记** `2827 → 2846`（历史不可篡改），
 *     再替换常量与 `2842 字符串` → `2908 字符串`，最后追加一条新的变更日志。
 *
 * 跑法：node scripts/sync-step05-gates.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FROM = "2846";
const TO = "2912";

const PLAIN = [
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
  "scripts/verify-opennext-bundle.mjs",
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

  // ① 历史标记占位（`2827 → 2846` 是既成事实的记录，不能被后续替换改写）
  let out = src.split("2827 → 2846").join("@@KEEP_HIST@@");
  // ② 类型分布注释
  out = out.split("2842 字符串").join("2908 字符串");
  // ③ 常量与其余注释中的数字
  const hits = out.split(FROM).length - 1;
  out = out.split(FROM).join(TO);
  // ④ 还原历史标记
  out = out.split("@@KEEP_HIST@@").join("2827 → 2846");

  // ⑤ 追加本次变更日志（紧跟 CHANGE SET B 那条之后）
  const anchor = `  //              home.clusters* 3 键 + clusters.* 命名空间 16 键 × 9 语`;
  const entry =
    anchor +
    `\n  // 2846 → 2912：STEP-05 /verify-supplier 最小闭环（提交 → 收集 → 入库 → 人工核验）——\n` +
    `  //              verifySupplier.* 命名空间 65 键（含 checks[3] / rules[4] /\n` +
    `  //              valueOptions 5 / urgencyOptions 3 叶子）+ supplierProfile.verifyThisSupplier 1 键 × 9 语\n` +
    `  //              （脚本：scripts/apply-step05-i18n.cjs，幂等 + 九语键集自检）`;
  if (out.includes(anchor) && !out.includes("2846 → 2912")) {
    out = out.replace(anchor, entry);
  } else if (!out.includes("2846 → 2912")) {
    console.log(`WARN  ${rel} 未找到追加锚点，请人工补一条变更日志`);
  }

  fs.writeFileSync(file, out, "utf8");
  total += hits;
  console.log(`OK    ${rel}  替换 ${hits} 处 + 追加变更日志`);
}

console.log(`\n完成：共替换 ${total} 处 ${FROM} → ${TO}`);
console.log("提示：跑 cs06a / cs08 / cs12 / cs13 / cs16 / cs17 / cs20 回归 + verify-opennext-bundle 验证");
