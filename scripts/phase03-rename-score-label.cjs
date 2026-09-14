// PHASE 03 §一：把「Risk score / Risk Signal」这一**展示标签**改名为「Supplier profile score」
//
// 只改**值**，不动键结构 ⇒ 九语键集与 en 仍然逐字一致，叶子数不变
// （所以无需同步 cs06a C8 / cs08 G4/G5 / cs12 E4/E5 / verify-opennext-bundle 四个常量）。
//
// 🔴 不改算法、不改历史分数、不删字段 —— 只改前台标签文字。
// 显式说明「评分不构成独立风险判定」的那句免责声明不在这里，
// 它由 lib/seo/supplierSeo.ts 的文案层提供（见该文件 scoreDisclaimer）。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.env.PHASE03_ROOT ?? process.cwd();

const SCORE_LABEL = {
  en: "Supplier profile score",
  zh: "供应商档案评分",
  "zh-TW": "供應商檔案評分",
  ja: "サプライヤープロフィールスコア",
  es: "Puntuación del perfil del proveedor",
  de: "Lieferantenprofil-Punktzahl",
  fr: "Score du profil fournisseur",
  pt: "Pontuação do perfil do fornecedor",
  ar: "درجة ملف المورد",
};

for (const l of Object.keys(SCORE_LABEL)) {
  const file = path.join(ROOT, "i18n", "dictionaries", `${l}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const beforeLabel = dict.suppliers?.riskLabel;
  const beforeScore = dict.supplierProfile?.riskScore;
  if (!dict.suppliers || !dict.supplierProfile) {
    console.error(`❌ ${l}: 缺少 suppliers / supplierProfile 命名空间`);
    process.exit(1);
  }
  dict.suppliers.riskLabel = SCORE_LABEL[l];
  dict.supplierProfile.riskScore = SCORE_LABEL[l];

  // 保持既有格式：2 空格缩进 + CRLF + 末尾换行
  const out = JSON.stringify(dict, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(
    `${l.padEnd(6)} riskLabel: ${JSON.stringify(beforeLabel)} -> ${JSON.stringify(SCORE_LABEL[l])}`
  );
  console.log(
    `${"".padEnd(6)} riskScore: ${JSON.stringify(beforeScore)} -> ${JSON.stringify(SCORE_LABEL[l])}`
  );
}
console.log("\n✅ 完成：9 语标签已改名（键结构未变，叶子数未变）");
