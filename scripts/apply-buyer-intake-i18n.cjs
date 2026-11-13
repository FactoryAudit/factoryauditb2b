// scripts/apply-buyer-intake-i18n.cjs
//
// 给 register.form 注入买家画像字段文案（9 语 × 12 键）。
// 幂等：已存在的键按本脚本值覆盖（便于措辞迭代），不存在的键新增。
// 严格保持原文件格式：JSON.stringify(indent=2) 往返后与原文逐字节比对已验证一致，
// CRLF 行尾按原文件检测后还原（项目字典用 CRLF，别改成 LF）。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"];

const COPY = {
  en: {
    phoneLabel: "Phone / WhatsApp (optional)",
    phonePlaceholder: "+1 555 000 0000",
    productsLabel: "Products you buy",
    productsPlaceholder: "e.g. kids bicycles, e-bikes, spare parts",
    portLabel: "Destination port (optional)",
    portPlaceholder: "e.g. Jebel Ali, Felixstowe, Los Angeles",
    servicesLabel: "Services you need (optional)",
    servicesAudit: "Factory audit / verification",
    servicesInspection: "Pre-shipment inspection",
    servicesSourcing: "Sourcing & supplier shortlist",
    servicesDueDiligence: "Supplier due diligence",
    errorProductsRequired: "Please tell us what products you buy.",
  },
  zh: {
    phoneLabel: "电话 / WhatsApp（选填）",
    phonePlaceholder: "+86 138 0000 0000",
    productsLabel: "您要采购的产品",
    productsPlaceholder: "例如：儿童自行车、电动自行车、零配件",
    portLabel: "目的港（选填）",
    portPlaceholder: "例如：杰贝阿里、费利克斯托、洛杉矶",
    servicesLabel: "需要的服务（选填）",
    servicesAudit: "验厂 / 工厂核实",
    servicesInspection: "出货前验货",
    servicesSourcing: "找厂与供应商初筛",
    servicesDueDiligence: "供应商背景调查",
    errorProductsRequired: "请填写您要采购的产品。",
  },
  "zh-TW": {
    phoneLabel: "電話 / WhatsApp（選填）",
    phonePlaceholder: "+886 900 000 000",
    productsLabel: "您要採購的產品",
    productsPlaceholder: "例如：兒童自行車、電動自行車、零配件",
    portLabel: "目的港（選填）",
    portPlaceholder: "例如：傑貝阿里、費利克斯托、洛杉磯",
    servicesLabel: "需要的服務（選填）",
    servicesAudit: "驗廠 / 工廠核實",
    servicesInspection: "出貨前驗貨",
    servicesSourcing: "找廠與供應商初篩",
    servicesDueDiligence: "供應商背景調查",
    errorProductsRequired: "請填寫您要採購的產品。",
  },
  es: {
    phoneLabel: "Teléfono / WhatsApp (opcional)",
    phonePlaceholder: "+34 600 000 000",
    productsLabel: "Productos que compra",
    productsPlaceholder: "p. ej. bicicletas infantiles, bicicletas eléctricas, repuestos",
    portLabel: "Puerto de destino (opcional)",
    portPlaceholder: "p. ej. Jebel Ali, Valencia, Los Ángeles",
    servicesLabel: "Servicios que necesita (opcional)",
    servicesAudit: "Auditoría / verificación de fábrica",
    servicesInspection: "Inspección previa al embarque",
    servicesSourcing: "Búsqueda y preselección de proveedores",
    servicesDueDiligence: "Due diligence de proveedores",
    errorProductsRequired: "Indíquenos qué productos compra.",
  },
  de: {
    phoneLabel: "Telefon / WhatsApp (optional)",
    phonePlaceholder: "+49 170 0000000",
    productsLabel: "Produkte, die Sie einkaufen",
    productsPlaceholder: "z. B. Kinderfahrräder, E-Bikes, Ersatzteile",
    portLabel: "Bestimmungshafen (optional)",
    portPlaceholder: "z. B. Jebel Ali, Hamburg, Los Angeles",
    servicesLabel: "Benötigte Leistungen (optional)",
    servicesAudit: "Fabrikaudit / Verifizierung",
    servicesInspection: "Vorversandinspektion",
    servicesSourcing: "Lieferantensuche & Vorauswahl",
    servicesDueDiligence: "Lieferanten-Due-Diligence",
    errorProductsRequired: "Bitte nennen Sie uns die Produkte, die Sie einkaufen.",
  },
  fr: {
    phoneLabel: "Téléphone / WhatsApp (facultatif)",
    phonePlaceholder: "+33 6 00 00 00 00",
    productsLabel: "Produits que vous achetez",
    productsPlaceholder: "ex. vélos enfants, vélos électriques, pièces détachées",
    portLabel: "Port de destination (facultatif)",
    portPlaceholder: "ex. Jebel Ali, Le Havre, Los Angeles",
    servicesLabel: "Services souhaités (facultatif)",
    servicesAudit: "Audit / vérification d'usine",
    servicesInspection: "Inspection avant expédition",
    servicesSourcing: "Sourcing et présélection de fournisseurs",
    servicesDueDiligence: "Due diligence fournisseurs",
    errorProductsRequired: "Merci d'indiquer les produits que vous achetez.",
  },
  pt: {
    phoneLabel: "Telefone / WhatsApp (opcional)",
    phonePlaceholder: "+55 11 90000 0000",
    productsLabel: "Produtos que compra",
    productsPlaceholder: "ex. bicicletas infantis, bicicletas elétricas, peças",
    portLabel: "Porto de destino (opcional)",
    portPlaceholder: "ex. Jebel Ali, Santos, Los Angeles",
    servicesLabel: "Serviços necessários (opcional)",
    servicesAudit: "Auditoria / verificação de fábrica",
    servicesInspection: "Inspeção antes do embarque",
    servicesSourcing: "Sourcing e pré-seleção de fornecedores",
    servicesDueDiligence: "Due diligence de fornecedores",
    errorProductsRequired: "Indique os produtos que compra.",
  },
  ja: {
    phoneLabel: "電話 / WhatsApp（任意）",
    phonePlaceholder: "+81 90 0000 0000",
    productsLabel: "購入する製品",
    productsPlaceholder: "例：子供用自転車、電動自転車、部品",
    portLabel: "仕向港（任意）",
    portPlaceholder: "例：ジェベルアリ、フェリクストウ、ロサンゼルス",
    servicesLabel: "必要なサービス（任意）",
    servicesAudit: "工場監査 / 実在確認",
    servicesInspection: "出荷前検品",
    servicesSourcing: "サプライヤー探索・一次選定",
    servicesDueDiligence: "サプライヤー Due Diligence",
    errorProductsRequired: "購入する製品をご記入ください。",
  },
  ar: {
    phoneLabel: "الهاتف / واتساب (اختياري)",
    phonePlaceholder: "+971 50 000 0000",
    productsLabel: "المنتجات التي تشتريها",
    productsPlaceholder: "مثال: دراجات أطفال، دراجات كهربائية، قطع غيار",
    portLabel: "ميناء الوصول (اختياري)",
    portPlaceholder: "مثال: جبل علي، فيليكستو، لوس أنجلوس",
    servicesLabel: "الخدمات التي تحتاجها (اختياري)",
    servicesAudit: "تدقيق / التحقق من المصنع",
    servicesInspection: "فحص ما قبل الشحن",
    servicesSourcing: "البحث عن الموردين والفرز الأولي",
    servicesDueDiligence: "التدقيق النافي للجهالة على الموردين",
    errorProductsRequired: "يرجى ذكر المنتجات التي تشتريها.",
  },
};

let changed = 0;
for (const loc of LOCALES) {
  const p = path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
  const raw = fs.readFileSync(p, "utf8");
  const crlf = raw.includes("\r\n");
  const dict = JSON.parse(raw);
  if (!dict.register?.form) {
    console.error(`FAIL ${loc}: register.form 不存在`);
    process.exitCode = 1;
    continue;
  }
  for (const [k, v] of Object.entries(COPY[loc])) {
    if (dict.register.form[k] !== v) {
      dict.register.form[k] = v;
      changed++;
    }
  }
  let out = JSON.stringify(dict, null, 2);
  if (crlf) out = out.replace(/\n/g, "\r\n");
  out += crlf ? "\r\n" : "\n";
  fs.writeFileSync(p, out, "utf8");
  const n = Object.keys(COPY[loc]).length;
  console.log(`OK ${loc}: register.form +${n} keys`);
}

// 九语键集自检
const keysets = LOCALES.map((l) => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "dictionaries", `${l}.json`), "utf8"));
  return Object.keys(d.register.form).sort().join("|");
});
if (new Set(keysets).size !== 1) {
  console.error("FAIL 九语 register.form 键集不一致");
  process.exitCode = 1;
} else {
  console.log(`OK 九语 register.form 键集一致（${keysets[0].split("|").length} 键）`);
}
console.log(changed === 0 ? "（无变化，幂等）" : `（写入 ${changed} 处）`);
