/**
 * CHANGE SET B —— 门禁基线同步：en 字典叶子数 2827 → 2846。
 *
 * 为什么必须同步：项目把 en 字典叶子数当**冻结常量**来防「翻译把键结构改坏了」
 * （加键漏改常量 ⇒ CI 红，避免悄悄少键/多键）。CHANGE SET B 新增
 *   · home.clustersTitle / clustersLead / clustersCta                （3）
 *   · clusters.* 命名空间（h1/lead/metaTitle/metaDesc/breadcrumbHome/breadcrumb/
 *     emptyTitle/emptyLead/countryLabel/regionLabel/industryLabel/supplierCount/
 *     viewSuppliers/suppliersTitle/suppliersEmpty/detailMetaDesc）    （16）
 * 共 19 键 × 9 语 ⇒ en 叶子数 2827 + 19 = 2846。
 *
 * 处理规则：
 *   · 除 cs06a 外的文件：全局替换 2827 → 2846（这些文件里 2827 只作为断言常量出现）。
 *   · cs06a：**先保护历史变更日志标记** `2825 → 2827`（历史不可篡改），
 *     再替换常量，最后追加一条新的变更日志；同时把注释里的 `2823 字符串` → `2842 字符串`
 *     （2846 = 2842 字符串 + 4 boolean）。
 *
 * 跑法：node scripts/sync-changesetB-gates.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FROM = "2827";
const TO = "2846";

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
  const out = src.split(FROM).join(TO);
  fs.writeFileSync(file, out, "utf8");
  total += hits;
  console.log(`OK    ${rel}  替换 ${hits} 处`);
}

// ---- cs06a：保护历史日志后再替换 ----
{
  const rel = "scripts/cs06a-directory-regression.ts";
  const file = path.join(ROOT, rel);
  const src = fs.readFileSync(file, "utf8");

  // ① 历史标记占位（`2825 → 2827` 是既成事实的记录，不能被后续替换改写）
  let out = src.split("2825 → 2827").join("@@KEEP_HIST@@");
  // ② 常量与注释中的数字
  out = out.split("2823 字符串").join("2842 字符串");
  const hits = out.split(FROM).length - 1;
  out = out.split(FROM).join(TO);
  // ③ 还原历史标记
  out = out.split("@@KEEP_HIST@@").join("2825 → 2827");

  // ④ 追加本次变更日志（紧跟 STEP-04 那条之后）
  const anchor = `  //               supplierProfile.regionLabel / industrialClusterLabel 2 键 × 9 语`;
  const entry =
    anchor +
    `\n  // 2827 → 2846：CHANGE SET B 首页 Industrial Clusters 轻量入口 + 产业带目录/详情页 ——\n` +
    `  //               home.clusters* 3 键 + clusters.* 命名空间 16 键 × 9 语`;
  if (out.includes(anchor) && !out.includes("2827 → 2846")) {
    out = out.replace(anchor, entry);
  } else if (!out.includes("2827 → 2846")) {
    console.log(`WARN  ${rel} 未找到追加锚点，请人工补一条变更日志`);
  }

  fs.writeFileSync(file, out, "utf8");
  total += hits;
  console.log(`OK    ${rel}  替换 ${hits} 处 + 追加变更日志`);
}

console.log(`\n完成：共替换 ${total} 处 ${FROM} → ${TO}`);
console.log("提示：跑 cs13 / cs16 / cs17 / cs20 / cs06a / cs08 / cs12 回归 + verify-opennext-bundle 验证");
