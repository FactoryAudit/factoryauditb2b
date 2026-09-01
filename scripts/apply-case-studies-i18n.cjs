/**
 * case-studies 页面本地化（#58 最后一块高价值硬编码英文）。
 * 补 caseStudies.h1/lead 的 7 语言翻译 + 新增页面键：
 * metaTitle / breadcrumbHome / breadcrumbCurrent / ctaTitle / ctaDesc / ctaRfq / ctaCustom。
 *
 * 安全规则：仅在「当前值 === en 值」或键缺失时写入（幂等，保护已有人工翻译）。
 */
const fs = require("fs");
const path = require("path");
const D = path.join(__dirname, "..", "i18n", "dictionaries");
const DRY = process.argv.includes("--dry");

const T = {
  h1: {
    "zh-TW": "案例研究",
    ja: "事例紹介",
    de: "Fallstudien",
    fr: "Études de cas",
    es: "Casos prácticos",
    pt: "Estudos de caso",
    ar: "دراسات الحالة",
  },
  lead: {
    "zh-TW": "供應商核實、驗廠、驗貨與尋源的方法演示。",
    ja: "サプライヤー検証・工場監査・検査・調達の進め方のデモンストレーション。",
    de: "Methoden-Demos zu Lieferantenverifizierung, Werksaudit, Inspektion und Sourcing.",
    fr: "Démonstrations de méthodes pour la vérification fournisseur, l'audit d'usine, l'inspection et le sourcing.",
    es: "Demostraciones de métodos de verificación de proveedores, auditoría de fábrica, inspección y sourcing.",
    pt: "Demonstrações de métodos de verificação de fornecedores, auditoria de fábrica, inspeção e sourcing.",
    ar: "عروض توضيحية لطرق التحقق من الموردين وتدقيق المصنع والفحص والتوريد.",
  },
  metaTitle: {
    en: "Supplier Verification, Audit & Inspection Case Studies",
    zh: "供应商核查、验厂与验货案例",
    "zh-TW": "供應商核實、驗廠與驗貨案例",
    ja: "サプライヤー検証・工場監査・製品検査の事例",
    de: "Fallstudien: Lieferantenverifizierung, Audit & Inspektion",
    fr: "Études de cas : vérification fournisseur, audit & inspection",
    es: "Casos prácticos: verificación de proveedores, auditoría e inspección",
    pt: "Estudos de caso: verificação de fornecedores, auditoria e inspeção",
    ar: "دراسات حالة: التحقق من الموردين والتدقيق والفحص",
  },
  breadcrumbHome: {
    en: "Home",
    zh: "首页",
    "zh-TW": "首頁",
    ja: "ホーム",
    de: "Startseite",
    fr: "Accueil",
    es: "Inicio",
    pt: "Início",
    ar: "الرئيسية",
  },
  breadcrumbCurrent: {
    en: "Case studies",
    zh: "案例研究",
    "zh-TW": "案例研究",
    ja: "事例紹介",
    de: "Fallstudien",
    fr: "Études de cas",
    es: "Casos prácticos",
    pt: "Estudos de caso",
    ar: "دراسات الحالة",
  },
  ctaTitle: {
    en: "Have a similar situation?",
    zh: "遇到类似情况？",
    "zh-TW": "遇到類似情況？",
    ja: "同じような状況ですか？",
    de: "Ähnliche Situation?",
    fr: "Une situation similaire ?",
    es: "¿Tienes una situación similar?",
    pt: "Tem uma situação parecida?",
    ar: "لديك موقف مشابه؟",
  },
  ctaDesc: {
    en: "Send us your requirement and we will scope the verification, audit or inspection for your product and market.",
    zh: "把你的需求发给我们，我们会为你的产品和市场规划核查、验厂或验货方案。",
    "zh-TW": "把你的需求發給我們，我們會為你的產品和市場規劃核實、驗廠或驗貨方案。",
    ja: "ご要件をお送りいただければ、製品と市場に合わせて検証・監査・検査の範囲を設計します。",
    de: "Senden Sie uns Ihre Anforderung und wir planen Verifizierung, Audit oder Inspektion für Ihr Produkt und Ihren Markt.",
    fr: "Envoyez-nous votre besoin et nous définirons la vérification, l'audit ou l'inspection adaptés à votre produit et à votre marché.",
    es: "Envíanos tu necesidad y definiremos la verificación, auditoría o inspección para tu producto y mercado.",
    pt: "Envie sua necessidade e vamos definir a verificação, auditoria ou inspeção para o seu produto e mercado.",
    ar: "أرسل لنا متطلباتك وسنحدد نطاق التحقق أو التدقيق أو الفحص لمنتجك وسوقك.",
  },
  ctaRfq: {
    en: "Post an RFQ",
    zh: "发布询价",
    "zh-TW": "發布詢價",
    ja: "RFQを投稿",
    de: "RFQ einstellen",
    fr: "Publier un RFQ",
    es: "Publicar un RFQ",
    pt: "Publicar um RFQ",
    ar: "انشر طلب عرض أسعار",
  },
  ctaCustom: {
    en: "Custom services",
    zh: "定制服务",
    "zh-TW": "客製服務",
    ja: "カスタムサービス",
    de: "Individuelle Leistungen",
    fr: "Services sur mesure",
    es: "Servicios personalizados",
    pt: "Serviços personalizados",
    ar: "خدمات مخصصة",
  },
};

const LANGS = ["en", "zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];
const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));

function getPath(obj, dotted) {
  return dotted.split(".").reduce((cur, p) => (cur == null ? undefined : cur[p]), obj);
}

let total = 0;
for (const lang of LANGS) {
  const file = path.join(D, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const cs = dict.caseStudies;
  let changed = 0;

  for (const [key, perLang] of Object.entries(T)) {
    const val = perLang[lang];
    if (val === undefined) continue;
    if (cs[key] !== undefined && cs[key] !== en.caseStudies[key]) {
      // 已有非 en 翻译则跳过（保护人工翻译）；en 的 metaTitle 等新键不算
      continue;
    }
    cs[key] = val;
    changed++;
  }
  console.log(`[${lang}] 写入 ${changed} 条`);
  if (!DRY && changed) fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  total += changed;
}
console.log(`\n${DRY ? "DRY RUN" : "完成"}：共写入 ${total} 条`);
