// scripts/apply-cs02b-i18n.cjs —— CS-02B Chemical Intelligence 字典变更
//
// 新增 chemicals 命名空间（9 键 × 9 语）。只增键、绝不删键。
// en 叶子数 2717 -> 2726，改完必须同步：
//   cs06a C8（+C7 注释）/ cs08 G4,G5 / cs12 E4,E5 / scripts/verify-opennext-bundle.mjs
// 输出格式：2 空格缩进 + CRLF + 末尾换行。
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CS02B_ROOT || process.cwd();
const DIR = path.join(ROOT, "i18n", "dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

const KEYS = [
  "metaTitle",
  "metaDesc",
  "lead",
  "casLabel",
  "synonymsLabel",
  "applicationLabel",
  "complianceLabel",
  "downstreamLabel",
  "relatedIndustries",
];

const NS = {
  en: {
    metaTitle: "Chemical raw materials: applications, documents and suppliers",
    metaDesc:
      "Chemical raw materials sourced from China: what each is used for, the documents buyers ask for, and how to request quotes from verified suppliers.",
    lead:
      "Each page covers one raw material: what it is used for, how buyers normally specify it, and the documents to request before an order. Where no supplier is listed yet, post an RFQ.",
    casLabel: "CAS RN",
    synonymsLabel: "Synonyms",
    applicationLabel: "Application",
    complianceLabel: "What buyers ask for",
    downstreamLabel: "Downstream uses",
    relatedIndustries: "Related industries",
  },
  zh: {
    metaTitle: "化工原料：应用、文件与供应商",
    metaDesc:
      "来自中国的化工原料：各自用途、买家需索取的文件，以及如何向已核验供应商询价。",
    lead:
      "每页覆盖一种原料：用途、买家通常如何定规格，以及下单前应索取的文件。若暂无登记供应商，可直接发布 RFQ。",
    casLabel: "CAS RN",
    synonymsLabel: "同义词",
    applicationLabel: "应用",
    complianceLabel: "买家索取什么",
    downstreamLabel: "下游应用",
    relatedIndustries: "相关行业",
  },
  "zh-TW": {
    metaTitle: "化工原料：應用、文件與供應商",
    metaDesc:
      "來自中國的化工原料：各自用途、買家需索取的文件，以及如何向已驗證供應商詢價。",
    lead:
      "每頁涵蓋一種原料：用途、買家通常如何定規格，以及下單前應索取的文件。若暫無登記供應商，可直接發佈 RFQ。",
    casLabel: "CAS RN",
    synonymsLabel: "同義詞",
    applicationLabel: "應用",
    complianceLabel: "買家索取什麼",
    downstreamLabel: "下游應用",
    relatedIndustries: "相關行業",
  },
  ja: {
    metaTitle: "化学原料：用途・書類・サプライヤー",
    metaDesc:
      "中国から調達する化学原料：用途、買い手が求める書類、検証済みサプライヤーへの見積もり依頼方法。",
    lead:
      "各ページは原料を 1 件ずつ扱います：用途、買い手が通常指定する項目、発注前に求める書類。登録サプライヤーがいない場合は RFQ を投稿してください。",
    casLabel: "CAS RN",
    synonymsLabel: "別名",
    applicationLabel: "用途",
    complianceLabel: "買い手が求める書類",
    downstreamLabel: "用途分野",
    relatedIndustries: "関連業界",
  },
  es: {
    metaTitle: "Materias primas químicas: aplicaciones, documentos y proveedores",
    metaDesc:
      "Materias primas químicas de China: usos, documentos que piden los compradores y cómo solicitar presupuestos a proveedores verificados.",
    lead:
      "Cada página cubre una materia prima: usos, cómo la especifican los compradores y los documentos que hay que pedir antes de ordenar. Si aún no hay proveedores registrados, publique una RFQ.",
    casLabel: "CAS RN",
    synonymsLabel: "Sinónimos",
    applicationLabel: "Aplicación",
    complianceLabel: "Qué piden los compradores",
    downstreamLabel: "Usos posteriores",
    relatedIndustries: "Sectores relacionados",
  },
  de: {
    metaTitle: "Chemische Rohstoffe: Anwendungen, Dokumente und Lieferanten",
    metaDesc:
      "Chemische Rohstoffe aus China: Verwendung, von Käufern angeforderte Dokumente und wie Sie Angebote von geprüften Lieferanten anfordern.",
    lead:
      "Jede Seite behandelt einen Rohstoff: Verwendung, wie Käufer ihn spezifizieren und welche Dokumente vor der Bestellung anzufordern sind. Wenn noch kein Lieferant gelistet ist, veröffentlichen Sie eine RFQ.",
    casLabel: "CAS RN",
    synonymsLabel: "Synonyme",
    applicationLabel: "Anwendung",
    complianceLabel: "Was Käufer anfordern",
    downstreamLabel: "Weiterverwendung",
    relatedIndustries: "Verwandte Branchen",
  },
  fr: {
    metaTitle: "Matières premières chimiques : applications, documents et fournisseurs",
    metaDesc:
      "Matières premières chimiques de Chine : usages, documents demandés par les acheteurs et comment demander des devis à des fournisseurs vérifiés.",
    lead:
      "Chaque page couvre une matière première : usages, spécifications habituelles des acheteurs et documents à demander avant de commander. Si aucun fournisseur n'est référencé, publiez une RFQ.",
    casLabel: "CAS RN",
    synonymsLabel: "Synonymes",
    applicationLabel: "Application",
    complianceLabel: "Ce que demandent les acheteurs",
    downstreamLabel: "Usages en aval",
    relatedIndustries: "Secteurs liés",
  },
  pt: {
    metaTitle: "Matérias-primas químicas: aplicações, documentos e fornecedores",
    metaDesc:
      "Matérias-primas químicas da China: usos, documentos exigidos pelos compradores e como pedir orçamentos a fornecedores verificados.",
    lead:
      "Cada página cobre uma matéria-prima: usos, como os compradores a especificam e os documentos a pedir antes de encomendar. Se ainda não houver fornecedores registados, publique uma RFQ.",
    casLabel: "CAS RN",
    synonymsLabel: "Sinónimos",
    applicationLabel: "Aplicação",
    complianceLabel: "O que os compradores pedem",
    downstreamLabel: "Usos a jusante",
    relatedIndustries: "Setores relacionados",
  },
  ar: {
    metaTitle: "المواد الخام الكيميائية: التطبيقات والمستندات والموردون",
    metaDesc:
      "المواد الخام الكيميائية من الصين: استخداماتها، والمستندات التي يطلبها المشترون، وكيفية طلب عروض أسعار من موردين موثّقين.",
    lead:
      "تغطي كل صفحة مادة خام واحدة: استخداماتها، وكيف يحدد المشترون مواصفاتها عادةً، والمستندات المطلوبة قبل الطلب. وإذا لم يكن هناك مورد مسجل بعد، انشر طلب عرض أسعار.",
    casLabel: "رقم CAS",
    synonymsLabel: "المرادفات",
    applicationLabel: "التطبيق",
    complianceLabel: "ما يطلبه المشترون",
    downstreamLabel: "الاستخدامات النهائية",
    relatedIndustries: "القطاعات ذات الصلة",
  },
};

for (const l of LOCALES) {
  const file = path.join(DIR, l + ".json");
  const obj = JSON.parse(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
  if (obj.chemicals) throw new Error(l + ": chemicals 命名空间已存在，拒绝覆盖");
  const ns = NS[l];
  const missing = KEYS.filter((k) => typeof ns[k] !== "string" || ns[k].trim() === "");
  if (missing.length) throw new Error(l + " 缺键: " + missing.join(","));
  obj.chemicals = {};
  for (const k of KEYS) obj.chemicals[k] = ns[k];
  fs.writeFileSync(file, JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n", "utf8");
  console.log(l.padEnd(6) + " chemicals 命名空间写入 " + KEYS.length + " 键");
}
console.log("完成：九语各新增 chemicals 命名空间（" + KEYS.length + " 键）");
