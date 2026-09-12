// scripts/apply-cs02a-i18n.cjs —— CS-02A Food Master Template 字典变更
//
// 变更内容：
//   1. industryPage 新增 3 个键（hubMetaDesc / hubLead / topicsTitle）
//      —— /industry 索引页（P0）与 Master 页「行业指南」区块（P1）需要。
//   2. industryPage.ctaTitle / ctaDesc / ctaButton 改为 RFQ 导向文案
//      —— CTA 从 /training-plans 切到内嵌 RfqForm（CS-02C G3 落库通道），
//         原「培训方案」文案与按钮语义不再成立，必须同步改写。
//
// 铁律：本脚本只新增键与改值，**绝不删键**（en 叶子数 = 单一事实源，
//   改完必须同步 cs06a C8 / cs08 G4,G5 / cs12 E4,E5 / verify-opennext-bundle.mjs）。
// 输出格式：2 空格缩进 + CRLF + 末尾换行（与既有字典一致）。
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CS02A_ROOT || process.cwd();
const DIR = path.join(ROOT, "i18n", "dictionaries");

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

// 新增键（9 语）
const NEW_KEYS = {
  en: {
    hubMetaDesc:
      "Industry guides to supplier verification: what to check before you order, which audits apply, and the suppliers on record for each industry.",
    hubLead:
      "Each industry page lists the audits that apply, the suppliers on record, and the checks that matter before you place an order.",
    topicsTitle: "{industry} guides",
  },
  zh: {
    hubMetaDesc:
      "按行业的供应商验证指南：下单前应检查什么、适用哪些审核项目，以及各行业已登记的供应商。",
    hubLead:
      "每个行业页列出适用的审核项目、已登记的供应商，以及下单前真正重要的检查项。",
    topicsTitle: "{industry} 指南",
  },
  "zh-TW": {
    hubMetaDesc:
      "按行業的供應商驗證指南：下單前應檢查什麼、適用哪些審覈項目，以及各行業已登記的供應商。",
    hubLead:
      "每個行業頁列出適用的審覈項目、已登記的供應商，以及下單前真正重要的檢查項。",
    topicsTitle: "{industry} 指南",
  },
  ja: {
    hubMetaDesc:
      "業界別のサプライヤー検証ガイド：発注前に確認すべきこと、適用される監査、各業界で登録されているサプライヤー。",
    hubLead:
      "各業界ページには、適用される監査、登録済みサプライヤー、発注前に重要な確認事項が掲載されています。",
    topicsTitle: "{industry} ガイド",
  },
  es: {
    hubMetaDesc:
      "Guías de verificación de proveedores por sector: qué comprobar antes de pedir, qué auditorías aplican y los proveedores registrados en cada sector.",
    hubLead:
      "Cada página de sector enumera las auditorías que aplican, los proveedores registrados y las comprobaciones importantes antes de hacer un pedido.",
    topicsTitle: "Guías de {industry}",
  },
  de: {
    hubMetaDesc:
      "Branchen-Guides zur Lieferantenprüfung: was vor der Bestellung zu prüfen ist, welche Audits gelten und welche Lieferanten je Branche erfasst sind.",
    hubLead:
      "Jede Branchenseite listet die geltenden Audits, die erfassten Lieferanten und die vor der Bestellung wichtigen Prüfungen.",
    topicsTitle: "{industry}-Guides",
  },
  fr: {
    hubMetaDesc:
      "Guides de vérification des fournisseurs par secteur : quoi vérifier avant de commander, quels audits s'appliquent et les fournisseurs référencés par secteur.",
    hubLead:
      "Chaque page sectorielle liste les audits applicables, les fournisseurs référencés et les vérifications importantes avant de commander.",
    topicsTitle: "Guides {industry}",
  },
  pt: {
    hubMetaDesc:
      "Guias de verificação de fornecedores por setor: o que verificar antes de pedir, quais auditorias se aplicam e os fornecedores registados em cada setor.",
    hubLead:
      "Cada página setorial lista as auditorias aplicáveis, os fornecedores registados e as verificações importantes antes de fazer um pedido.",
    topicsTitle: "Guias de {industry}",
  },
  ar: {
    hubMetaDesc:
      "أدلة التحقق من الموردين حسب القطاع: ما يجب التحقق منه قبل الطلب، وعمليات التدقيق المنطبقة، والموردون المسجلون في كل قطاع.",
    hubLead:
      "تدرج كل صفحة قطاع عمليات التدقيق المنطبقة، والموردين المسجلين، والفحوصات المهمة قبل تقديم الطلب.",
    topicsTitle: "أدلة {industry}",
  },
};

// CTA 文案改写（键已存在，只改值）
const CTA = {
  en: {
    ctaTitle: "Request quotes from {industry} suppliers",
    ctaDesc:
      "Post an RFQ with your requirements. We return quotes with capability and risk context.",
    ctaButton: "Post an RFQ",
  },
  zh: {
    ctaTitle: "向 {industry} 供应商询价",
    ctaDesc: "提交 RFQ 并写明你的要求。我们会返回带能力与风险背景的报价。",
    ctaButton: "发布 RFQ",
  },
  "zh-TW": {
    ctaTitle: "向 {industry} 供應商詢價",
    ctaDesc: "提交 RFQ 並寫明你的要求。我們會回傳帶能力與風險背景的報價。",
    ctaButton: "發佈 RFQ",
  },
  ja: {
    ctaTitle: "{industry} サプライヤーに見積もりを依頼する",
    ctaDesc:
      "要件を記入して RFQ を投稿してください。能力とリスクの情報を含む見積もりをお返しします。",
    ctaButton: "RFQ を投稿する",
  },
  es: {
    ctaTitle: "Solicita presupuestos a proveedores de {industry}",
    ctaDesc:
      "Publica una RFQ con tus requisitos. Devolvemos presupuestos con contexto de capacidad y riesgo.",
    ctaButton: "Publicar RFQ",
  },
  de: {
    ctaTitle: "Angebote von {industry}-Lieferanten anfordern",
    ctaDesc:
      "Veröffentlichen Sie eine RFQ mit Ihren Anforderungen. Wir liefern Angebote mit Kontext zu Kapazität und Risiko.",
    ctaButton: "RFQ veröffentlichen",
  },
  fr: {
    ctaTitle: "Demandez des devis à des fournisseurs de {industry}",
    ctaDesc:
      "Publiez une RFQ avec vos exigences. Nous retournons des devis avec le contexte de capacité et de risque.",
    ctaButton: "Publier une RFQ",
  },
  pt: {
    ctaTitle: "Peça orçamentos a fornecedores de {industry}",
    ctaDesc:
      "Publique uma RFQ com os seus requisitos. Devolvemos orçamentos com contexto de capacidade e risco.",
    ctaButton: "Publicar RFQ",
  },
  ar: {
    ctaTitle: "اطلب عروض أسعار من موردي {industry}",
    ctaDesc:
      "انشر طلب عرض أسعار بمتطلباتك. نعيد إليك عروض أسعار مع سياق القدرة والمخاطر.",
    ctaButton: "انشر طلب عرض أسعار",
  },
};

let changed = 0;
for (const l of LOCALES) {
  const file = path.join(DIR, l + ".json");
  const raw = fs.readFileSync(file, "utf8");
  // 读：统一换行后 parse，避免 CRLF 影响
  const obj = JSON.parse(raw.replace(/\r\n/g, "\n"));
  const ip = obj.industryPage;
  if (!ip) throw new Error(l + ": industryPage 命名空间缺失");

  const before = Object.keys(ip).length;
  for (const [k, v] of Object.entries(NEW_KEYS[l])) {
    if (ip[k] !== undefined) throw new Error(l + "." + k + " 已存在，拒绝覆盖");
    ip[k] = v;
  }
  for (const [k, v] of Object.entries(CTA[l])) {
    if (ip[k] === undefined) throw new Error(l + "." + k + " 不存在，拒绝新增");
    ip[k] = v;
  }
  const after = Object.keys(ip).length;
  if (after !== before + 3) throw new Error(l + ": 键数异常 " + before + " -> " + after);

  const out = JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  changed++;
  console.log(l.padEnd(6) + " industryPage 键数 " + before + " -> " + after);
}
console.log("已写入 " + changed + " 个字典文件（新增 3 键 + 改写 CTA 3 值）");
