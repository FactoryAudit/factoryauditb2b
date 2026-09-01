/**
 * #59 aria-label 本地化：给 9 语言字典补 4 组无障碍标签键。
 *  - nav.homeLabel  —— 页头 LOGO 链接（品牌名 + 首页）
 *  - nav.mainNav    —— 主导航 landmark
 *  - aiChat.close   —— 客服弹窗关闭按钮
 *  - logistics.ui.unit / logistics.ui.massUnit —— 集装箱计算器单位切换
 *
 * 安全规则：仅在键缺失时写入，幂等；已有翻译不受影响。
 */
const fs = require("fs");
const path = require("path");
const D = path.join(__dirname, "..", "i18n", "dictionaries");
const DRY = process.argv.includes("--dry");

const T = {
  en: { homeLabel: "FactoryAuditB2B home", mainNav: "Main", close: "Close", unit: "Unit", massUnit: "Mass unit" },
  zh: { homeLabel: "FactoryAuditB2B 首页", mainNav: "主导航", close: "关闭", unit: "单位", massUnit: "重量单位" },
  "zh-TW": { homeLabel: "FactoryAuditB2B 首頁", mainNav: "主導覽", close: "關閉", unit: "單位", massUnit: "重量單位" },
  ja: { homeLabel: "FactoryAuditB2B ホーム", mainNav: "メインナビゲーション", close: "閉じる", unit: "単位", massUnit: "質量の単位" },
  de: { homeLabel: "FactoryAuditB2B Startseite", mainNav: "Hauptnavigation", close: "Schließen", unit: "Einheit", massUnit: "Gewichtseinheit" },
  fr: { homeLabel: "FactoryAuditB2B accueil", mainNav: "Navigation principale", close: "Fermer", unit: "Unité", massUnit: "Unité de masse" },
  es: { homeLabel: "FactoryAuditB2B inicio", mainNav: "Navegación principal", close: "Cerrar", unit: "Unidad", massUnit: "Unidad de masa" },
  pt: { homeLabel: "FactoryAuditB2B início", mainNav: "Navegação principal", close: "Fechar", unit: "Unidade", massUnit: "Unidade de massa" },
  ar: { homeLabel: "FactoryAuditB2B الرئيسية", mainNav: "التنقل الرئيسي", close: "إغلاق", unit: "الوحدة", massUnit: "وحدة الكتلة" },
};

const LANGS = ["en", "zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];
let total = 0;

for (const lang of LANGS) {
  const file = path.join(D, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const v = T[lang];
  const added = [];

  if (!dict.nav.homeLabel) { dict.nav.homeLabel = v.homeLabel; added.push("nav.homeLabel"); }
  if (!dict.nav.mainNav) { dict.nav.mainNav = v.mainNav; added.push("nav.mainNav"); }
  if (!dict.aiChat.close) { dict.aiChat.close = v.close; added.push("aiChat.close"); }
  if (!dict.container.ui.unit) { dict.container.ui.unit = v.unit; added.push("container.ui.unit"); }
  if (!dict.container.ui.massUnit) { dict.container.ui.massUnit = v.massUnit; added.push("container.ui.massUnit"); }

  console.log(`[${lang}] ${added.length ? `新增 ${added.join(", ")}` : "已就绪，跳过"}`);
  if (!DRY && added.length) fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  total += added.length;
}

console.log(`\n${DRY ? "DRY RUN" : "完成"}：共写入 ${total} 个新键（9 语言 × 5 键）`);
