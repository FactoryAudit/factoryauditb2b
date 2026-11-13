// scripts/apply-rfq-request-types-i18n.cjs
//
// 给 rfq.form 注入「需求类型分流」文案（9 语 × 26 键），并更新若干既有文案的值。
//
// 幂等：已存在的键按本脚本值覆盖（便于措辞迭代），不存在的键新增。
// 严格保持原文件格式：JSON.stringify(indent=2) 往返 + CRLF 还原（项目字典用 CRLF）。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"];

const COPY = {
  en: {
    labels: {
      requestType: "What do you need?",
      phone: "Phone / WhatsApp",
      optional: "optional",
      factoryName: "Factory / supplier name",
      factoryLocation: "Factory location (city, country)",
      auditType: "Audit type",
      auditTypeHint: "e.g. social compliance (BSCI / Sedex), quality, environmental, factory verification",
      preferredDate: "Preferred date",
      destinationPort: "Destination port",
      inspectionStandard: "Inspection level (AQL)",
      quantity: "Quantity / scope",
      message: "Specifications / requirements",
      country: "Country / target market",
      submit: "Send request",
      submitting: "Sending…",
    },
    types: {
      product: "Buying products",
      sourcing: "Finding suppliers",
      audit: "Factory audit / verification",
      inspection: "Inspection / QC",
      other: "Something else",
    },
    hints: {
      audit: "Audit scope, required standard, factory size, preferred dates…",
      inspection: "Product, order quantity, AQL level, preferred inspection date…",
      other: "Describe what you need, including any deadline or budget…",
    },
    offer: {
      price: "Unit price",
      moq: "MOQ",
      leadTime: "Lead time",
      notes: "Your offer",
    },
    respond: {
      to: "Responding to request {ref}",
      note: "This is what the buyer chose to publish. Send your offer and our team will pass it on.",
      success:
        "Your offer was received. Our team will review it and contact you if the buyer wants to take it further.",
    },
    errorRequired: "Please fill in the required fields marked *.",
    success: "We received your request. Our team will review it and reply within one business day.",
    h1: "Tell us what you need",
    lead: "Buying products, booking a factory audit or arranging an inspection — pick one and we will come back with scope and a quote.",
  },
  zh: {
    labels: {
      requestType: "您需要什么？",
      phone: "电话 / WhatsApp",
      optional: "选填",
      factoryName: "工厂 / 供应商名称",
      factoryLocation: "工厂所在地（城市、国家）",
      auditType: "审核类型",
      auditTypeHint: "例如社会责任（BSCI / Sedex）、质量、环境、工厂核实",
      preferredDate: "期望日期",
      destinationPort: "目的港",
      inspectionStandard: "验货标准（AQL）",
      quantity: "数量 / 范围",
      message: "规格 / 具体要求",
      country: "国家 / 目标市场",
      submit: "提交需求",
      submitting: "提交中…",
    },
    types: {
      product: "采购产品",
      sourcing: "寻找供应商",
      audit: "验厂 / 工厂核实",
      inspection: "验货 / 质检",
      other: "其他需求",
    },
    hints: {
      audit: "审核范围、所需标准、工厂规模、期望日期……",
      inspection: "产品、订单数量、AQL 标准、期望验货日期……",
      other: "请描述您的需求，包括时间节点或预算……",
    },
    offer: {
      price: "单价",
      moq: "起订量",
      leadTime: "交货期",
      notes: "您的报价说明",
    },
    respond: {
      to: "正在回应需求 {ref}",
      note: "以下为买家授权公开的内容。提交报价后，我们会转交给买家。",
      success: "已收到您的报价。我们会先审核，如买家有意向会主动联系您。",
    },
    errorRequired: "请填写带 * 的必填项。",
    success: "已收到您的需求。我们会在 1 个工作日内人工审阅并回复您。",
    h1: "告诉我们您需要什么",
    lead: "采购产品、预约验厂、安排验货——选一项告诉我们，我们会给出方案与报价。",
  },
  "zh-TW": {
    labels: {
      requestType: "您需要什麼？",
      phone: "電話 / WhatsApp",
      optional: "選填",
      factoryName: "工廠 / 供應商名稱",
      factoryLocation: "工廠所在地（城市、國家）",
      auditType: "稽核類型",
      auditTypeHint: "例如社會責任（BSCI / Sedex）、品質、環境、工廠核實",
      preferredDate: "期望日期",
      destinationPort: "目的港",
      inspectionStandard: "驗貨標準（AQL）",
      quantity: "數量 / 範圍",
      message: "規格 / 具體要求",
      country: "國家 / 目標市場",
      submit: "提交需求",
      submitting: "提交中…",
    },
    types: {
      product: "採購產品",
      sourcing: "尋找供應商",
      audit: "驗廠 / 工廠核實",
      inspection: "驗貨 / 品質檢驗",
      other: "其他需求",
    },
    hints: {
      audit: "稽核範圍、所需標準、工廠規模、期望日期……",
      inspection: "產品、訂單數量、AQL 標準、期望驗貨日期……",
      other: "請描述您的需求，包括時間節點或預算……",
    },
    offer: {
      price: "單價",
      moq: "最小訂購量",
      leadTime: "交期",
      notes: "您的報價說明",
    },
    respond: {
      to: "正在回應需求 {ref}",
      note: "以下為買家授權公開的內容。提交報價後，我們會轉交給買家。",
      success: "已收到您的報價。我們會先審核，如買家有意願會主動聯繫您。",
    },
    errorRequired: "請填寫標示 * 的必填欄位。",
    success: "已收到您的需求。我們會在 1 個工作日內人工審閱並回覆您。",
    h1: "告訴我們您需要什麼",
    lead: "採購產品、預約驗廠、安排驗貨——選一項告訴我們，我們會提供方案與報價。",
  },
  es: {
    labels: {
      requestType: "¿Qué necesita?",
      phone: "Teléfono / WhatsApp",
      optional: "opcional",
      factoryName: "Nombre de la fábrica / proveedor",
      factoryLocation: "Ubicación de la fábrica (ciudad, país)",
      auditType: "Tipo de auditoría",
      auditTypeHint:
        "p. ej. cumplimiento social (BSCI / Sedex), calidad, medio ambiente, verificación de fábrica",
      preferredDate: "Fecha preferida",
      destinationPort: "Puerto de destino",
      inspectionStandard: "Nivel de inspección (AQL)",
      quantity: "Cantidad / alcance",
      message: "Especificaciones / requisitos",
      country: "País / mercado objetivo",
      submit: "Enviar solicitud",
      submitting: "Enviando…",
    },
    types: {
      product: "Comprar productos",
      sourcing: "Buscar proveedores",
      audit: "Auditoría / verificación de fábrica",
      inspection: "Inspección / control de calidad",
      other: "Otra necesidad",
    },
    hints: {
      audit: "Alcance de la auditoría, norma exigida, tamaño de la fábrica, fechas preferidas…",
      inspection: "Producto, cantidad del pedido, nivel AQL, fecha de inspección preferida…",
      other: "Describa lo que necesita, incluidos plazos o presupuesto…",
    },
    offer: {
      price: "Precio unitario",
      moq: "Pedido mínimo",
      leadTime: "Plazo de entrega",
      notes: "Su oferta",
    },
    respond: {
      to: "Respondiendo a la solicitud {ref}",
      note: "Esto es lo que el comprador autorizó a publicar. Envíe su oferta y nuestro equipo la trasladará.",
      success:
        "Hemos recibido su oferta. Nuestro equipo la revisará y le contactará si el comprador quiere avanzar.",
    },
    errorRequired: "Complete los campos obligatorios marcados con *.",
    success:
      "Hemos recibido su solicitud. Nuestro equipo la revisará y le responderá en un día hábil.",
    h1: "Díganos qué necesita",
    lead: "Comprar productos, solicitar una auditoría de fábrica o programar una inspección: elija una opción y le responderemos con alcance y presupuesto.",
  },
  de: {
    labels: {
      requestType: "Was benötigen Sie?",
      phone: "Telefon / WhatsApp",
      optional: "optional",
      factoryName: "Fabrik- / Lieferantenname",
      factoryLocation: "Standort der Fabrik (Stadt, Land)",
      auditType: "Audittyp",
      auditTypeHint:
        "z. B. Sozialstandards (BSCI / Sedex), Qualität, Umwelt, Fabrikverifizierung",
      preferredDate: "Wunschtermin",
      destinationPort: "Bestimmungshafen",
      inspectionStandard: "Prüfniveau (AQL)",
      quantity: "Menge / Umfang",
      message: "Spezifikationen / Anforderungen",
      country: "Land / Zielmarkt",
      submit: "Anfrage senden",
      submitting: "Wird gesendet…",
    },
    types: {
      product: "Produkte einkaufen",
      sourcing: "Lieferanten finden",
      audit: "Fabrikaudit / Verifizierung",
      inspection: "Warenprüfung / QS",
      other: "Etwas anderes",
    },
    hints: {
      audit: "Auditumfang, geforderte Norm, Fabrikgröße, Wunschtermine…",
      inspection: "Produkt, Bestellmenge, AQL-Niveau, Wunschtermin der Prüfung…",
      other: "Beschreiben Sie Ihren Bedarf, inklusive Fristen oder Budget…",
    },
    offer: {
      price: "Stückpreis",
      moq: "Mindestmenge",
      leadTime: "Lieferzeit",
      notes: "Ihr Angebot",
    },
    respond: {
      to: "Antwort auf Anfrage {ref}",
      note: "Dies ist der vom Käufer freigegebene Inhalt. Senden Sie Ihr Angebot, wir leiten es weiter.",
      success:
        "Wir haben Ihr Angebot erhalten. Unser Team prüft es und meldet sich, wenn der Käufer weitergehen möchte.",
    },
    errorRequired: "Bitte füllen Sie die mit * markierten Pflichtfelder aus.",
    success:
      "Wir haben Ihre Anfrage erhalten. Unser Team prüft sie und antwortet innerhalb eines Werktags.",
    h1: "Sagen Sie uns, was Sie brauchen",
    lead: "Produkte einkaufen, ein Fabrikaudit beauftragen oder eine Prüfung organisieren – wählen Sie aus, und wir melden uns mit Umfang und Angebot.",
  },
  fr: {
    labels: {
      requestType: "De quoi avez-vous besoin ?",
      phone: "Téléphone / WhatsApp",
      optional: "facultatif",
      factoryName: "Nom de l'usine / du fournisseur",
      factoryLocation: "Localisation de l'usine (ville, pays)",
      auditType: "Type d'audit",
      auditTypeHint:
        "ex. conformité sociale (BSCI / Sedex), qualité, environnement, vérification d'usine",
      preferredDate: "Date souhaitée",
      destinationPort: "Port de destination",
      inspectionStandard: "Niveau d'inspection (AQL)",
      quantity: "Quantité / périmètre",
      message: "Spécifications / exigences",
      country: "Pays / marché cible",
      submit: "Envoyer la demande",
      submitting: "Envoi…",
    },
    types: {
      product: "Acheter des produits",
      sourcing: "Trouver des fournisseurs",
      audit: "Audit / vérification d'usine",
      inspection: "Inspection / contrôle qualité",
      other: "Autre besoin",
    },
    hints: {
      audit: "Périmètre de l'audit, norme requise, taille de l'usine, dates souhaitées…",
      inspection: "Produit, quantité commandée, niveau AQL, date d'inspection souhaitée…",
      other: "Décrivez votre besoin, y compris les délais ou le budget…",
    },
    offer: {
      price: "Prix unitaire",
      moq: "Quantité minimale",
      leadTime: "Délai de livraison",
      notes: "Votre offre",
    },
    respond: {
      to: "Réponse à la demande {ref}",
      note: "Voici ce que l'acheteur a autorisé à publier. Envoyez votre offre, nous la transmettrons.",
      success:
        "Nous avons reçu votre offre. Notre équipe l'examine et vous contactera si l'acheteur souhaite aller plus loin.",
    },
    errorRequired: "Veuillez remplir les champs obligatoires marqués d'un *.",
    success:
      "Nous avons reçu votre demande. Notre équipe l'examine et vous répond sous un jour ouvré.",
    h1: "Dites-nous ce qu'il vous faut",
    lead: "Acheter des produits, commander un audit d'usine ou organiser une inspection : choisissez une option, nous reviendrons avec un périmètre et un devis.",
  },
  pt: {
    labels: {
      requestType: "Do que você precisa?",
      phone: "Telefone / WhatsApp",
      optional: "opcional",
      factoryName: "Nome da fábrica / fornecedor",
      factoryLocation: "Localização da fábrica (cidade, país)",
      auditType: "Tipo de auditoria",
      auditTypeHint:
        "ex. conformidade social (BSCI / Sedex), qualidade, ambiental, verificação de fábrica",
      preferredDate: "Data preferida",
      destinationPort: "Porto de destino",
      inspectionStandard: "Nível de inspeção (AQL)",
      quantity: "Quantidade / escopo",
      message: "Especificações / requisitos",
      country: "País / mercado-alvo",
      submit: "Enviar solicitação",
      submitting: "Enviando…",
    },
    types: {
      product: "Comprar produtos",
      sourcing: "Encontrar fornecedores",
      audit: "Auditoria / verificação de fábrica",
      inspection: "Inspeção / controle de qualidade",
      other: "Outra necessidade",
    },
    hints: {
      audit: "Escopo da auditoria, norma exigida, porte da fábrica, datas preferidas…",
      inspection: "Produto, quantidade do pedido, nível AQL, data de inspeção preferida…",
      other: "Descreva o que você precisa, incluindo prazos ou orçamento…",
    },
    offer: {
      price: "Preço unitário",
      moq: "Quantidade mínima",
      leadTime: "Prazo de entrega",
      notes: "Sua oferta",
    },
    respond: {
      to: "Respondendo à solicitação {ref}",
      note: "Este é o conteúdo que o comprador autorizou publicar. Envie sua oferta e nossa equipe encaminha.",
      success:
        "Recebemos sua oferta. Nossa equipe vai analisar e entrar em contato se o comprador quiser avançar.",
    },
    errorRequired: "Preencha os campos obrigatórios marcados com *.",
    success:
      "Recebemos sua solicitação. Nossa equipe vai analisar e responder em até um dia útil.",
    h1: "Diga-nos do que você precisa",
    lead: "Comprar produtos, contratar uma auditoria de fábrica ou agendar uma inspeção: escolha uma opção e voltamos com escopo e orçamento.",
  },
  ja: {
    labels: {
      requestType: "ご必要なものは何ですか？",
      phone: "電話 / WhatsApp",
      optional: "任意",
      factoryName: "工場・サプライヤー名",
      factoryLocation: "工場所在地（都市・国）",
      auditType: "監査の種類",
      auditTypeHint: "例：社会的責任（BSCI / Sedex）、品質、環境、工場確認",
      preferredDate: "希望日",
      destinationPort: "仕向港",
      inspectionStandard: "検査水準（AQL）",
      quantity: "数量・範囲",
      message: "仕様・ご要望",
      country: "国・対象市場",
      submit: "依頼を送信",
      submitting: "送信中…",
    },
    types: {
      product: "製品の調達",
      sourcing: "サプライヤー探し",
      audit: "工場監査・確認",
      inspection: "検品・品質管理",
      other: "その他",
    },
    hints: {
      audit: "監査範囲、必要基準、工場規模、希望時期…",
      inspection: "製品、発注数量、AQL 水準、希望検品日…",
      other: "ご要望をできるだけ具体的に（期限やご予算も）…",
    },
    offer: {
      price: "単価",
      moq: "最小ロット",
      leadTime: "納期",
      notes: "ご提案内容",
    },
    respond: {
      to: "{ref} への回答",
      note: "ここには買い手が公開を許可した内容のみ表示しています。ご提案を送信いただければ担当者がお伝えします。",
      success:
        "ご提案を受け付けました。内容を確認のうえ、買い手が希望した場合にご連絡します。",
    },
    errorRequired: "* の付いた必須項目をご入力ください。",
    success: "ご依頼を受け付けました。担当者が確認のうえ、1 営業日以内にご返信します。",
    h1: "ご必要なものをお聞かせください",
    lead: "製品の調達、工場監査のご依頼、検品の手配——いずれかをお選びください。範囲とお見積りをご案内します。",
  },
  ar: {
    labels: {
      requestType: "ما الذي تحتاجه؟",
      phone: "الهاتف / واتساب",
      optional: "اختياري",
      factoryName: "اسم المصنع / المورّد",
      factoryLocation: "موقع المصنع (المدينة، الدولة)",
      auditType: "نوع التدقيق",
      auditTypeHint:
        "مثال: المسؤولية الاجتماعية (BSCI / Sedex)، الجودة، البيئة، التحقق من المصنع",
      preferredDate: "التاريخ المفضل",
      destinationPort: "ميناء الوصول",
      inspectionStandard: "مستوى الفحص (AQL)",
      quantity: "الكمية / النطاق",
      message: "المواصفات / المتطلبات",
      country: "الدولة / السوق المستهدف",
      submit: "إرسال الطلب",
      submitting: "جارٍ الإرسال…",
    },
    types: {
      product: "شراء منتجات",
      sourcing: "البحث عن مورّدين",
      audit: "تدقيق / التحقق من المصنع",
      inspection: "الفحص / مراقبة الجودة",
      other: "احتياج آخر",
    },
    hints: {
      audit: "نطاق التدقيق، المعيار المطلوب، حجم المصنع، التواريخ المفضلة…",
      inspection: "المنتج، كمية الطلب، مستوى AQL، تاريخ الفحص المفضل…",
      other: "صف ما تحتاجه، بما في ذلك أي موعد نهائي أو ميزانية…",
    },
    offer: {
      price: "سعر الوحدة",
      moq: "الحد الأدنى للطلب",
      leadTime: "مدة التسليم",
      notes: "عرضك",
    },
    respond: {
      to: "الرد على الطلب {ref}",
      note: "هذا ما أذن المشتري بنشره. أرسل عرضك وسينقله فريقنا إليه.",
      success:
        "استلمنا عرضك. سيراجعه فريقنا ويتواصل معك إذا رغب المشتري في المتابعة.",
    },
    errorRequired: "يرجى تعبئة الحقول الإلزامية المعلّمة بـ *.",
    success: "استلمنا طلبك. سيراجعه فريقنا ويرد عليك خلال يوم عمل واحد.",
    h1: "أخبرنا بما تحتاجه",
    lead: "شراء منتجات، أو طلب تدقيق مصنع، أو ترتيب فحص — اختر واحدًا وسنعود إليك بالنطاق وعرض السعر.",
  },
};

function countLeaves(o) {
  if (Array.isArray(o)) return o.reduce((n, v) => n + countLeaves(v), 0);
  if (o && typeof o === "object") return Object.values(o).reduce((n, v) => n + countLeaves(v), 0);
  return 1;
}

let changed = 0;
const before = {};

for (const loc of LOCALES) {
  const p = path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
  const raw = fs.readFileSync(p, "utf8");
  const crlf = raw.includes("\r\n");
  const dict = JSON.parse(raw);
  if (!dict.rfq?.form) {
    console.error(`FAIL ${loc}: rfq.form 不存在`);
    process.exitCode = 1;
    continue;
  }
  before[loc] = countLeaves(dict);

  const f = dict.rfq.form;
  const c = COPY[loc];
  f.labels = f.labels || {};
  for (const [k, v] of Object.entries(c.labels)) {
    if (f.labels[k] !== v) {
      f.labels[k] = v;
      changed++;
    }
  }
  for (const block of ["types", "hints", "offer", "respond"]) {
    f[block] = f[block] || {};
    for (const [k, v] of Object.entries(c[block])) {
      if (f[block][k] !== v) {
        f[block][k] = v;
        changed++;
      }
    }
  }
  if (f.errorRequired !== c.errorRequired) {
    f.errorRequired = c.errorRequired;
    changed++;
  }
  if (f.success !== c.success) {
    f.success = c.success;
    changed++;
  }
  if (dict.rfq.h1 !== c.h1) {
    dict.rfq.h1 = c.h1;
    changed++;
  }
  if (dict.rfq.lead !== c.lead) {
    dict.rfq.lead = c.lead;
    changed++;
  }

  let out = JSON.stringify(dict, null, 2);
  if (crlf) out = out.replace(/\n/g, "\r\n");
  out += crlf ? "\r\n" : "\n";
  fs.writeFileSync(p, out, "utf8");
  const after = countLeaves(dict);
  console.log(`OK ${loc}: leaves ${before[loc]} → ${after} (+${after - before[loc]})`);
}

// 九语键集自检：rfq.form 下各块键必须完全一致（少一个就会在别的语言渲染出 undefined）
const signatures = LOCALES.map((l) => {
  const d = JSON.parse(
    fs.readFileSync(path.join(ROOT, "i18n", "dictionaries", `${l}.json`), "utf8")
  );
  const f = d.rfq.form;
  return ["labels", "types", "hints", "offer", "respond"]
    .map((b) => `${b}:${Object.keys(f[b] || {}).sort().join(",")}`)
    .join("|");
});
if (new Set(signatures).size !== 1) {
  console.error("FAIL 九语 rfq.form 键集不一致");
  process.exitCode = 1;
} else {
  console.log("OK 九语 rfq.form 键集一致");
}
console.log(changed === 0 ? "（无变化，幂等）" : `（写入 ${changed} 处）`);
