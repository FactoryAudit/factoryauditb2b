/**
 * 验厂申请表本地化（#58 A 类）。
 * 给 auditRequest.form 增加：
 *  - industries: string[] —— 行业下拉选项显示文案（11 项，与组件内
 *    INDUSTRIES 常量的 value 顺序一一对应；value 保持英文提交）
 *  - noneCustom: string —— 认证下拉「None / Custom」显示文案
 *
 * 认证缩写（SMETA/BSCI/WRAP/SA8000/RBA/ISO 9001 等）保持英文不翻译。
 * 安全规则：仅在键缺失时写入，幂等。
 */
const fs = require("fs");
const path = require("path");
const D = path.join(__dirname, "..", "i18n", "dictionaries");
const DRY = process.argv.includes("--dry");

const T = {
  en: {
    industries: ["Electronics", "Textiles & Garments", "Furniture", "Toys", "Automotive", "Machinery", "Plastics", "Food", "Packaging", "Chemicals", "Other"],
    noneCustom: "None / Custom",
  },
  zh: {
    industries: ["电子", "纺织服装", "家具", "玩具", "汽车", "机械", "塑料", "食品", "包装", "化工", "其他"],
    noneCustom: "无 / 定制",
  },
  "zh-TW": {
    industries: ["電子", "紡織服裝", "家具", "玩具", "汽車", "機械", "塑膠", "食品", "包裝", "化工", "其他"],
    noneCustom: "無 / 客製",
  },
  ja: {
    industries: ["電子機器", "繊維・アパレル", "家具", "玩具", "自動車", "機械", "プラスチック", "食品", "包装", "化学", "その他"],
    noneCustom: "なし / カスタム",
  },
  de: {
    industries: ["Elektronik", "Textil & Bekleidung", "Möbel", "Spielzeug", "Automobil", "Maschinenbau", "Kunststoffe", "Lebensmittel", "Verpackung", "Chemie", "Sonstige"],
    noneCustom: "Keine / Individuell",
  },
  fr: {
    industries: ["Électronique", "Textile & habillement", "Ameublement", "Jouets", "Automobile", "Machines", "Plastiques", "Alimentation", "Emballage", "Chimie", "Autre"],
    noneCustom: "Aucun / Sur mesure",
  },
  es: {
    industries: ["Electrónica", "Textil y confección", "Muebles", "Juguetes", "Automoción", "Maquinaria", "Plásticos", "Alimentos", "Envases", "Química", "Otro"],
    noneCustom: "Ninguno / Personalizado",
  },
  pt: {
    industries: ["Eletrônicos", "Têxtil e confecções", "Móveis", "Brinquedos", "Automotivo", "Máquinas", "Plásticos", "Alimentos", "Embalagens", "Química", "Outro"],
    noneCustom: "Nenhum / Personalizado",
  },
  ar: {
    industries: ["الإلكترونيات", "المنسوجات والملابس", "الأثاث", "الألعاب", "السيارات", "الآلات", "البلاستيك", "الأغذية", "التغليف", "الكيماويات", "أخرى"],
    noneCustom: "لا يوجد / حسب الطلب",
  },
};

const LANGS = ["en", "zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];
let total = 0;

for (const lang of LANGS) {
  const file = path.join(D, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const form = dict.auditRequest.form;
  const added = [];
  if (!form.industries) {
    form.industries = T[lang].industries;
    added.push("industries");
  }
  if (!form.noneCustom) {
    form.noneCustom = T[lang].noneCustom;
    added.push("noneCustom");
  }
  console.log(`[${lang}] ${added.length ? `新增 ${added.join(", ")}` : "已就绪，跳过"}`);
  if (!DRY && added.length) fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  total += added.length;
}
console.log(`\n${DRY ? "DRY RUN" : "完成"}：共写入 ${total} 个新键（9 语言）`);
