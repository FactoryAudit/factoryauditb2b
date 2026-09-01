#!/usr/bin/env node
/**
 * fix-es-pollution.cjs
 * 修复历史批量翻译脚本造成的西语污染：
 *  1) de/fr/ar 的 verification.levels[0][2] 与 levelsShort[0][1] 仍为西语（FORCE 整组覆盖）
 *  2) zh-TW/ja/de/fr/es/pt/ar 的固定污染键（pricing.faq.1.a / reportPreview / claim.* / consent.* /
 *     risk.page.metaDesc 等）——值带西语独有拼写或 BOM，直接覆盖正确翻译
 *  3) pt 的 verification.levels / levelsShort 整组 FORCE（半葡半西状态）
 *  4) 清理所有字符串值中的 BOM 字符（\uFEFF）
 *
 * 用法: node scripts/fix-es-pollution.cjs
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");

// ---- 1) de/fr/ar levels FORCE（levelsShort 同步整组） ----
const LEVELS_FIX = {
  de: {
    levels: [
      "Stufe 0: Nicht verifiziert",
      "Stufe 1: Geschäftsinformationen geprüft",
      "Stufe 2: Dokumente geprüft",
      "Stufe 3: Fabrik verifiziert",
      "Stufe 4: Fabrik auditiert",
    ],
    levelsShort: [
      "Nicht verifiziert",
      "Geschäft geprüft",
      "Dokumente geprüft",
      "Fabrik verifiziert",
      "Fabrik auditiert",
    ],
  },
  fr: {
    levels: [
      "Niveau 0 : Non vérifié",
      "Niveau 1 : Informations commerciales vérifiées",
      "Niveau 2 : Documents examinés",
      "Niveau 3 : Usine vérifiée",
      "Niveau 4 : Usine auditée",
    ],
    levelsShort: [
      "Non vérifié",
      "Informations vérifiées",
      "Documents examinés",
      "Usine vérifiée",
      "Usine auditée",
    ],
  },
  ar: {
    levels: [
      "المستوى 0: غير مُتحقق",
      "المستوى 1: تم التحقق من المعلومات التجارية",
      "المستوى 2: تمت مراجعة المستندات",
      "المستوى 3: تم التحقق من المصنع",
      "المستوى 4: تمت مراجعة المصنع",
    ],
    levelsShort: [
      "غير مُتحقق",
      "تحقق تجاري",
      "مستندات مُراجعة",
      "تم التحقق من المصنع",
      "تمت مراجعة المصنع",
    ],
  },
  pt: {
    levels: [
      "Nível 0: Não verificado",
      "Nível 1: Informações comerciais verificadas",
      "Nível 2: Documentos revisados",
      "Nível 3: Fábrica verificada",
      "Nível 4: Fábrica auditada",
    ],
    levelsShort: [
      "Não verificado",
      "Negócio verificado",
      "Documentos examinados",
      "Fábrica verificada",
      "Fábrica auditada",
    ],
  },
};

// ---- 2) 固定污染键修复（按语言） ----
const KEY_FIX = {
  "zh-TW": {
    "pricing.faq.1.a":
      "按供應商報價。價格取決於國家、方案是否包含現場走訪，以及需要審閱的文件量。把公司名稱發給我們，我們直接報價。",
    "reportPreview.options.professional.items.3": "按買家優先級定製的風險分析",
    "claim.benefits.3": "接收買家詢價與 RFQ 機會",
    "claim.verified.items.2": "接收買家詢價",
    "claim.verified.items.3": "產能標籤",
    "consent.public.items.0": "公司名稱",
  },
  ja: {
    "pricing.faq.1.a":
      "サプライヤーごとに見積もります。価格は国、現場訪問を含むかどうか、レビューが必要な書類の数によって変わります。会社名をお送りください。すぐに見積もりします。",
    "reportPreview.options.professional.items.3": "買い手の優先事項に合わせたリスク分析",
    "claim.benefits.3": "買い手の問い合わせとRFQの機会を受け取る",
    "claim.verified.items.2": "買い手の問い合わせ",
    "claim.verified.items.3": "能力タグ",
    "consent.public.items.0": "会社名",
  },
  de: {
    "pricing.faq.1.a":
      "Der Preis wird pro Lieferant angeboten. Er hängt vom Land ab, davon, ob der Standortbesuch enthalten ist, und von der Anzahl der zu prüfenden Dokumente. Senden Sie uns den Firmennamen und wir erstellen ein Angebot.",
    "reportPreview.options.professional.items.3": "Risikoanalyse mit käuferspezifischen Prioritäten",
    "claim.benefits.3": "Käuferanfragen und RFQ-Möglichkeiten erhalten",
    "claim.verified.items.2": "Käuferanfragen",
    "claim.verified.items.3": "Fähigkeits-Tags",
    "consent.public.items.0": "Firmenname",
  },
  fr: {
    "pricing.faq.1.a":
      "Le prix est établi par fournisseur. Il dépend du pays, de l'inclusion d'une visite sur site et du nombre de documents à examiner. Envoyez-nous le nom de l'entreprise et nous établirons un devis.",
    "reportPreview.options.professional.items.3":
      "Analyse des risques avec priorités spécifiques à l'acheteur",
    "claim.benefits.3": "Recevoir les demandes d'acheteurs et les opportunités RFQ",
    "claim.verified.items.2": "Demandes d'acheteurs",
    "claim.verified.items.3": "Étiquettes de capacités",
    "consent.public.items.0": "Nom de l'entreprise",
  },
  ar: {
    "pricing.faq.1.a":
      "يُسعَّر لكل مورد على حدة. يعتمد السعر على الدولة، وما إذا كانت الباقة تشمل زيارة الموقع، وعدد المستندات التي تتطلب مراجعة. أرسل لنا اسم الشركة وسنرسل لك السعر.",
    "reportPreview.options.professional.items.3": "تحليل مخاطر حسب أولويات المشتري",
    "claim.benefits.3": "استقبال استفسارات المشترين وفرص طلبات الأسعار RFQ",
    "claim.verified.items.2": "استفسارات المشترين",
    "claim.verified.items.3": "علامات القدرات",
    "consent.public.items.0": "اسم الشركة",
    "risk.page.metaDesc":
      "قيّم أي مورد من 0 إلى 100 عبر ثمانية مجالات: الشركة، الجودة، الامتثال، الإنتاج، سلسلة التوريد، الوثائق، الشهادات والبصمة الرقمية. الدرجة الأعلى تعني مخاطر أقل. مجاني، بدون حساب.",
  },
  pt: {
    "reportPreview.options.basic.items.2": "Estado de verificação",
    "reportPreview.options.professional.items.4": "Notas de verificação",
    "reportPreview.options.basic.items.0": "Visão geral do fornecedor",
    "reportPreview.options.professional.items.3":
      "Análise de riscos com prioridades específicas do comprador",
    "claim.benefits.1": "Adicionar produtos, certificações e detalhes de capacidade",
    "claim.benefits.2": "Mostre seu nível de verificação publicamente",
    "claim.benefits.3": "Receba consultas de compradores e oportunidades de RFQ",
    "claim.verified.items.0": "Nível de verificação no perfil",
    "claim.verified.items.1": "Estado de auditoria e certificações mostradas aos compradores",
    "claim.verified.items.2": "Consultas de compradores",
    "claim.verified.items.3": "Etiquetas de capacidade",
    "claim.premium.items.2": "Apresentações de compradores",
    "claim.free.items.0": "Atualize as informações da empresa",
    "consent.public.items.0": "Nome da empresa",
    "consent.public.items.3": "Estado de verificação",
    "consent.private.items.1": "Notas de trabalho de verificação",
    "consent.restricted.items.0": "Relatórios de auditoria originais",
  },
};

// ---- 3) claim.free.items 整组（es 仍英文、de/fr/pt/ar/zh-TW/ja 混西语） ----
const CLAIM_FREE_FIX = {
  es: [
    "Actualizar información de la empresa",
    "Añadir productos",
    "Añadir certificaciones",
    "Añadir datos de contacto",
  ],
  "zh-TW": ["更新公司資訊", "添加產品", "添加認證", "添加聯絡方式"],
  ja: ["会社情報を更新", "製品を追加", "認証を追加", "連絡先を追加"],
  de: [
    "Unternehmensinformationen aktualisieren",
    "Produkte hinzufügen",
    "Zertifizierungen hinzufügen",
    "Kontaktdaten hinzufügen",
  ],
  fr: [
    "Mettre à jour les informations de l'entreprise",
    "Ajouter des produits",
    "Ajouter des certifications",
    "Ajouter des coordonnées",
  ],
  pt: [
    "Atualize as informações da empresa",
    "Adicione produtos",
    "Adicione certificações",
    "Adicione dados de contato",
  ],
  ar: [
    "تحديث معلومات الشركة",
    "إضافة منتجات",
    "إضافة شهادات",
    "إضافة بيانات الاتصال",
  ],
};

function setPath(obj, pathStr, val) {
  const parts = pathStr.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (/^\d+$/.test(k)) {
      cur = cur[Number(k)];
    } else {
      if (!cur[k]) cur[k] = {};
      cur = cur[k];
    }
  }
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) cur[Number(last)] = val;
  else cur[last] = val;
}

function getVal(obj, pathStr) {
  let cur = obj;
  for (const p of pathStr.split(".")) cur = cur?.[p];
  return cur;
}

function cleanBOM(obj) {
  let n = 0;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string") {
      if (v.includes("\uFEFF")) {
        obj[k] = v.replace(/\uFEFF/g, "");
        n++;
      }
    } else if (v && typeof v === "object") {
      n += cleanBOM(v);
    }
  }
  return n;
}

let total = 0;

// levels FORCE
for (const [loc, fix] of Object.entries(LEVELS_FIX)) {
  const file = path.join(DIR, `${loc}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!dict.verification) dict.verification = {};
  for (const k of ["levels", "levelsShort"]) {
    dict.verification[k] = [...fix[k]];
    total += fix[k].length;
  }
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`${loc} levels/levelsShort FORCE 修复（整组）`);
}

// 固定键修复
for (const [loc, fixes] of Object.entries(KEY_FIX)) {
  const file = path.join(DIR, `${loc}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [p, val] of Object.entries(fixes)) {
    setPath(dict, p, val);
    total++;
  }
  const bom = cleanBOM(dict);
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`${loc} 固定键修复 ${Object.keys(fixes).length} 条, BOM 清理 ${bom} 处`);
}

// claim.free.items 整组
for (const [loc, items] of Object.entries(CLAIM_FREE_FIX)) {
  const file = path.join(DIR, `${loc}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!dict.claim) dict.claim = {};
  if (!dict.claim.free) dict.claim.free = {};
  dict.claim.free.items = [...items];
  total += items.length;
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`${loc} claim.free.items 整组修复 ${items.length} 项`);
}

console.log(`共修复 ${total} 处。`);
