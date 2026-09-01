/**
 * countryHub 面包屑/标题本地化（leak-scan v2 发现的硬编码残留）。
 *  - breadcrumbHome: 国家页面包屑「Home」
 *  - h1Template: 国家页 H1「{country} Supplier Verification & Factory Audit」
 *    （页面与 generateMetadata 共用）
 * 安全规则：仅当现值 === en 原值时才覆盖，幂等。
 */
const fs = require("fs");
const path = require("path");
const D = path.join(__dirname, "..", "i18n", "dictionaries");
const DRY = process.argv.includes("--dry");

const T = {
  en: { breadcrumbHome: "Home", h1Template: "{country} Supplier Verification & Factory Audit" },
  zh: { breadcrumbHome: "首页", h1Template: "{country}供应商核查与工厂验厂审核" },
  "zh-TW": { breadcrumbHome: "首頁", h1Template: "{country}供應商核實與工廠驗廠稽核" },
  ja: { breadcrumbHome: "ホーム", h1Template: "{country}のサプライヤー確認と工場監査" },
  de: { breadcrumbHome: "Startseite", h1Template: "{country}: Lieferantenverifizierung und Fabrik-Audit" },
  fr: { breadcrumbHome: "Accueil", h1Template: "{country} : vérification de fournisseur et audit d'usine" },
  es: { breadcrumbHome: "Inicio", h1Template: "{country}: verificación de proveedores y auditoría de fábrica" },
  pt: { breadcrumbHome: "Início", h1Template: "{country}: verificação de fornecedores e auditoria de fábrica" },
  ar: { breadcrumbHome: "الرئيسية", h1Template: "{country}: التحقق من الموردين وتدقيق المصنع" },
};

const LANGS = ["en", "zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];
let total = 0;

for (const lang of LANGS) {
  const file = path.join(D, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));
  const hub = dict.countryHub;
  const enHub = en.countryHub;
  const added = [];
  for (const k of ["breadcrumbHome", "h1Template"]) {
    if (hub[k] === enHub[k] || hub[k] === undefined) {
      hub[k] = T[lang][k];
      added.push(k);
    }
  }
  console.log(`[${lang}] ${added.length ? `写入 ${added.join(", ")}` : "已就绪，跳过"}`);
  if (!DRY && added.length) fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  total += added.length;
}

console.log(`\n${DRY ? "DRY RUN" : "完成"}：共写入 ${total} 个键（9 语言 × 2 键）`);
