/**
 * STEP-05 —— /verify-supplier 页面 + 表单 + 档案页入口所需的字典键（九语，幂等）。
 *
 * 与 apply-step04-i18n.cjs / apply-changesetB-i18n.cjs 同一约定：
 *   幂等注入 + 九语键集一致性自检，避免"改了 8 个语言漏了 1 个"，
 *   也避免重复执行把译文覆盖回英文。
 *
 * 新增命名空间 verifySupplier：
 *   · 页面层：badge/h1/lead/breadcrumb/metaTitle/metaDesc
 *   · 卡片层：checksTitle/checksLead/checks[3]/rulesTitle/rules[4]/
 *             servicesTitle/servicesLead/serviceVerification/serviceAudit/servicesNote/
 *             directoryTitle/directoryLead/directoryCta/linkedPrefix
 *   · 表单层：form.*（含 valueOptions 5 键 + urgencyOptions 3 键）
 *   · 档案页入口：supplierProfile.verifyThisSupplier 1 键
 *
 * 🔴 副作用（必须同步处理，见脚本末尾自检输出）：
 *   九语 en 字典叶子数 2846 → 2853。项目把该数字作为**冻结常量**写在 8 处：
 *     scripts/cs06a-directory-regression.ts（C8）
 *     scripts/cs08-form-regression.ts（G4 + G5）
 *     scripts/cs12-profile-regression.ts（E4 + E5）
 *     scripts/cs13-supplier-seo-regression.ts（F1i）
 *     scripts/cs16-supplier-mgmt-regression.ts（A1-A6）
 *     scripts/cs17-commerce-regression.ts（A1-A6）
 *     scripts/cs20-supplier-report.ts（A1）
 *     scripts/verify-opennext-bundle.mjs（发布门禁）
 *   跑完本脚本后执行：node scripts/sync-step05-gates.cjs
 *
 * 跑法：node scripts/apply-step05-i18n.cjs
 */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");

// 注意：数组元素是叶子（checks[0..2] / rules[0..3]），每个占 1 个叶子。
const K = {
  en: {
    badge: "Supplier verification",
    h1: "Not sure about a supplier? Let us check before you pay",
    lead: "Send us the factory you are considering. We tell you what can be confirmed, what cannot, and what it costs — before money leaves your account.",
    breadcrumb: "Verify a supplier",
    metaTitle: "Verify a Supplier Before You Pay",
    metaDesc:
      "Send us a supplier's website or company name and we check the company, the site and the capability claims before you place an order or release a deposit.",
    checksTitle: "What we look at",
    checksLead: "Scope depends on the supplier and the risk. Typically:",
    checks: [
      "Whether the company legally exists and matches the name it uses",
      "Whether the address is a real site that actually operates",
      "Whether the products match the stated capability and equipment",
      "Whether the documents it sends you hold up against their source",
    ],
    rulesTitle: "What we will not do",
    rules: [
      "We do not guarantee an outcome. We report what we find, including when we cannot confirm something.",
      "We do not sell a clean result. A verification that finds a problem is a successful verification.",
      "We do not review your commercial terms, price or contract. That is not verification.",
      "Submitting a request does not change any supplier's status on this site.",
    ],
    servicesTitle: "Want the work done, not just scoped?",
    servicesLead: "Verification and factory audit are the two services buyers usually order next.",
    serviceVerification: "Supplier verification",
    serviceAudit: "Factory audit",
    servicesNote: "A specialist confirms the scope and the price with you before any work starts.",
    directoryTitle: "Check if the supplier is already listed",
    directoryLead: "Profiles show verification level, risk score and recorded evidence. Reading one costs nothing.",
    directoryCta: "Browse the supplier directory",
    linkedPrefix: "Checking:",
    formTitle: "Tell us about the supplier",
    form: {
      supplierUrlLabel: "Supplier website",
      supplierUrlHint: "Paste the link from their website, listing or email signature.",
      supplierUrlPlaceholder: "https://example.com",
      supplierNameLabel: "Supplier company name",
      supplierNameHint: "If you have no link, the name as written on their documents is enough.",
      supplierNamePlaceholder: "Name as it appears on their invoice or quote",
      eitherHint: "Fill in at least one of the two fields above so we know who to check.",
      emailLabel: "Your company email",
      emailHint: "We reply here with the scope and the price. It is not shared with the supplier.",
      emailPlaceholder: "you@company.com",
      nameLabel: "Your name",
      companyLabel: "Your company",
      countryLabel: "Country you import into",
      productLabel: "Product you are buying",
      productPlaceholder: "e.g. stainless steel kitchenware",
      valueLabel: "Order value",
      valueHint: "Helps us match the depth of checking to the money at risk.",
      valueOptions: {
        lt5k: "Under $5,000",
        "5k-25k": "$5,000 – $25,000",
        "25k-100k": "$25,000 – $100,000",
        gt100k: "Over $100,000",
        unknown: "Not decided yet",
      },
      urgencyLabel: "How soon do you need an answer?",
      urgencyOptions: {
        now: "I am about to pay",
        "30days": "Within 30 days",
        planning: "Still researching",
      },
      concernsLabel: "What worries you most?",
      concernsHint: "Anything specific: a claim that looks off, a payment request, a document you are unsure about.",
      submit: "Send verification request",
      submitting: "Sending…",
      privacyNote:
        "We use your details to scope and quote this request. We do not share your enquiry with the supplier.",
      notAVerdict:
        "This form starts a request. It is not a verification result, and nothing here means a supplier is approved or rejected.",
      successTitle: "Request received",
      successLead: "A specialist will review the details and reply within one business day.",
      errorGeneric: "Something went wrong on our side. Please try again.",
      errorRateLimited: "Too many requests from this address. Please wait a while or email us directly.",
      errorInvalidEmail: "Enter a valid company email address.",
      errorSupplierRequired: "Add the supplier's website or company name.",
    },
  },
  zh: {
    badge: "供应商核验",
    h1: "拿不准这家供应商？先让我们查清楚再付款",
    lead: "把你正在考虑的那家工厂发给我们。我们告诉你哪些能确认、哪些确认不了、费用是多少 —— 都在你掏钱之前。",
    breadcrumb: "核验供应商",
    metaTitle: "付款前先核验供应商",
    metaDesc:
      "把供应商的网址或公司名发给我们，在下单或付定金之前核实公司是否真实、厂址是否存在、能力声明是否站得住。",
    checksTitle: "我们查什么",
    checksLead: "范围取决于供应商与风险高低，通常包括：",
    checks: [
      "这家公司是否合法存在，名称是否与它对外使用的一致",
      "地址是否为真实、确实在运营的厂址",
      "产品与它声称的能力和设备是否对得上",
      "发给你的文件能否与其来源相互印证",
    ],
    rulesTitle: "我们不会做的事",
    rules: [
      "我们不保证结论。查出什么就说什么，包括确认不了的部分。",
      "我们不出售「干净结论」。查出问题的核验同样是成功的核验。",
      "我们不审你的商务条款、价格或合同 —— 那不是核验。",
      "提交请求不会改变任何供应商在本站的状态。",
    ],
    servicesTitle: "想要落地执行，而不只是先定范围？",
    servicesLead: "买家接下来最常下单的两项服务是核验与验厂。",
    serviceVerification: "供应商核验",
    serviceAudit: "验厂",
    servicesNote: "开工前，专员会先与你确认范围与价格。",
    directoryTitle: "先看看这家是否已在目录里",
    directoryLead: "档案里公开显示核验等级、风险分与已记录证据。查看不收费。",
    directoryCta: "浏览供应商目录",
    linkedPrefix: "正在核验：",
    formTitle: "告诉我们这家供应商的情况",
    form: {
      supplierUrlLabel: "供应商网址",
      supplierUrlHint: "粘贴官网、平台店铺或邮件签名里的链接。",
      supplierUrlPlaceholder: "https://example.com",
      supplierNameLabel: "供应商公司名",
      supplierNameHint: "没有链接的话，写它在发票或报价单上使用的名称即可。",
      supplierNamePlaceholder: "与发票或报价单上一致的公司名",
      eitherHint: "上面两栏至少填一栏，我们才知道要查谁。",
      emailLabel: "你的公司邮箱",
      emailHint: "我们用这个邮箱回复范围与价格，不会把它给供应商。",
      emailPlaceholder: "you@company.com",
      nameLabel: "你的姓名",
      companyLabel: "你的公司",
      countryLabel: "进口目的国",
      productLabel: "要采购的产品",
      productPlaceholder: "例如：不锈钢厨具",
      valueLabel: "订单金额",
      valueHint: "用来匹配核验深度与资金风险。",
      valueOptions: {
        lt5k: "5,000 美元以下",
        "5k-25k": "5,000 – 25,000 美元",
        "25k-100k": "25,000 – 100,000 美元",
        gt100k: "100,000 美元以上",
        unknown: "还没定",
      },
      urgencyLabel: "你多久需要答复？",
      urgencyOptions: {
        now: "马上就要付款了",
        "30days": "30 天内",
        planning: "还在调研阶段",
      },
      concernsLabel: "你最担心什么？",
      concernsHint: "任何具体疑点：看起来不对劲的说法、付款要求、你拿不准的文件。",
      submit: "提交核验请求",
      submitting: "提交中…",
      privacyNote: "你的资料仅用于确定本次请求的范围与报价，我们不会把你的询盘转给该供应商。",
      notAVerdict: "本表单只是发起请求，不是核验结论；填写与否都不代表该供应商被认可或否决。",
      successTitle: "请求已收到",
      successLead: "专员会审核你提供的信息，并在一个工作日内回复。",
      errorGeneric: "我们这边出了点问题，请重试。",
      errorRateLimited: "该地址提交过于频繁，请稍后再试或直接邮件联系我们。",
      errorInvalidEmail: "请填写有效的公司邮箱地址。",
      errorSupplierRequired: "请填写供应商的网址或公司名。",
    },
  },
  "zh-TW": {
    badge: "供應商核驗",
    h1: "拿不準這家供應商？先讓我們查清楚再付款",
    lead: "把你正在考慮的那家工廠發給我們。我們告訴你哪些能確認、哪些確認不了、費用是多少 —— 都在你掏錢之前。",
    breadcrumb: "核驗供應商",
    metaTitle: "付款前先核驗供應商",
    metaDesc:
      "把供應商的網址或公司名發給我們，在下單或付訂金之前核實公司是否真實、廠址是否存在、能力聲明是否站得住。",
    checksTitle: "我們查什麼",
    checksLead: "範圍取決於供應商與風險高低，通常包括：",
    checks: [
      "這家公司是否合法存在，名稱是否與它對外使用的一致",
      "地址是否為真實、確實在營運的廠址",
      "產品與它聲稱的能力和設備是否對得上",
      "發給你的文件能否與其來源相互印證",
    ],
    rulesTitle: "我們不會做的事",
    rules: [
      "我們不保證結論。查出什麼就說什麼，包括確認不了的部分。",
      "我們不出售「乾淨結論」。查出問題的核驗同樣是成功的核驗。",
      "我們不審你的商務條款、價格或合約 —— 那不是核驗。",
      "提交請求不會改變任何供應商在本站的狀態。",
    ],
    servicesTitle: "想要落地執行，而不只是先定範圍？",
    servicesLead: "買家接下來最常下單的兩項服務是核驗與驗廠。",
    serviceVerification: "供應商核驗",
    serviceAudit: "驗廠",
    servicesNote: "開工前，專員會先與你確認範圍與價格。",
    directoryTitle: "先看看這家是否已在目錄裡",
    directoryLead: "檔案裡公開顯示核驗等級、風險分與已記錄證據。查看不收費。",
    directoryCta: "瀏覽供應商目錄",
    linkedPrefix: "正在核驗：",
    formTitle: "告訴我們這家供應商的情況",
    form: {
      supplierUrlLabel: "供應商網址",
      supplierUrlHint: "貼上官網、平台店鋪或郵件簽名裡的連結。",
      supplierUrlPlaceholder: "https://example.com",
      supplierNameLabel: "供應商公司名",
      supplierNameHint: "沒有連結的話，寫它在發票或報價單上使用的名稱即可。",
      supplierNamePlaceholder: "與發票或報價單上一致的公司名",
      eitherHint: "上面兩欄至少填一欄，我們才知道要查誰。",
      emailLabel: "你的公司信箱",
      emailHint: "我們用這個信箱回覆範圍與價格，不會把它給供應商。",
      emailPlaceholder: "you@company.com",
      nameLabel: "你的姓名",
      companyLabel: "你的公司",
      countryLabel: "進口目的國",
      productLabel: "要採購的產品",
      productPlaceholder: "例如：不鏽鋼廚具",
      valueLabel: "訂單金額",
      valueHint: "用來匹配核驗深度與資金風險。",
      valueOptions: {
        lt5k: "5,000 美元以下",
        "5k-25k": "5,000 – 25,000 美元",
        "25k-100k": "25,000 – 100,000 美元",
        gt100k: "100,000 美元以上",
        unknown: "還沒定",
      },
      urgencyLabel: "你多久需要答覆？",
      urgencyOptions: {
        now: "馬上就要付款了",
        "30days": "30 天內",
        planning: "還在調研階段",
      },
      concernsLabel: "你最擔心什麼？",
      concernsHint: "任何具體疑點：看起來不對勁的說法、付款要求、你拿不準的文件。",
      submit: "提交核驗請求",
      submitting: "提交中…",
      privacyNote: "你的資料僅用於確定本次請求的範圍與報價，我們不會把你的詢盤轉給該供應商。",
      notAVerdict: "本表單只是發起請求，不是核驗結論；填寫與否都不代表該供應商被認可或否決。",
      successTitle: "請求已收到",
      successLead: "專員會審核你提供的資訊，並在一個工作日內回覆。",
      errorGeneric: "我們這邊出了點問題，請重試。",
      errorRateLimited: "該地址提交過於頻繁，請稍後再試或直接郵件聯繫我們。",
      errorInvalidEmail: "請填寫有效的公司信箱地址。",
      errorSupplierRequired: "請填寫供應商的網址或公司名。",
    },
  },
  ja: {
    badge: "サプライヤー検証",
    h1: "そのサプライヤー、支払う前に確認しませんか",
    lead: "検討中の工場の情報をお送りください。何が確認でき、何ができないか、費用はいくらかを、入金の前にご説明します。",
    breadcrumb: "サプライヤーを検証",
    metaTitle: "支払い前にサプライヤーを検証",
    metaDesc:
      "サプライヤーのウェブサイトまたは会社名をお送りください。発注や手付金の支払い前に、会社の実在性・工場の所在地・能力の主張を確認します。",
    checksTitle: "確認する内容",
    checksLead: "範囲はサプライヤーとリスクによりますが、通常は次のとおりです。",
    checks: [
      "会社が法的に実在し、使用している名称と一致するか",
      "住所が実際に操業している工場か",
      "製品が主張する能力・設備と整合するか",
      "送られてきた書類が原本と照合できるか",
    ],
    rulesTitle: "行わないこと",
    rules: [
      "結果を保証しません。確認できなかった点も含めて報告します。",
      "「問題なし」という結論を売りません。問題を見つける検証も成功した検証です。",
      "商談条件・価格・契約は審査しません。それは検証ではありません。",
      "リクエストの送信は、本サイト上のサプライヤーの状態を変えません。",
    ],
    servicesTitle: "範囲の確認だけでなく、実行までご希望ですか",
    servicesLead: "買い手が次に発注することが多いのは、検証と工場監査の2つです。",
    serviceVerification: "サプライヤー検証",
    serviceAudit: "工場監査",
    servicesNote: "作業開始前に、担当者が範囲と価格を確認します。",
    directoryTitle: "すでに掲載されているか確認する",
    directoryLead: "プロフィールには検証レベル、リスクスコア、記録された証拠が表示されます。閲覧は無料です。",
    directoryCta: "サプライヤー一覧を見る",
    linkedPrefix: "検証対象：",
    formTitle: "サプライヤーについて教えてください",
    form: {
      supplierUrlLabel: "サプライヤーのウェブサイト",
      supplierUrlHint: "公式サイト、出品ページ、メール署名のリンクを貼り付けてください。",
      supplierUrlPlaceholder: "https://example.com",
      supplierNameLabel: "サプライヤーの会社名",
      supplierNameHint: "リンクがない場合は、書類に記載された名称で十分です。",
      supplierNamePlaceholder: "請求書や見積書の表記どおり",
      eitherHint: "上の2項目のうち、少なくとも1つをご記入ください。",
      emailLabel: "会社のメールアドレス",
      emailHint: "範囲と価格はこちらに返信します。サプライヤーには共有しません。",
      emailPlaceholder: "you@company.com",
      nameLabel: "お名前",
      companyLabel: "貴社名",
      countryLabel: "輸入先の国",
      productLabel: "購入予定の製品",
      productPlaceholder: "例：ステンレス製キッチン用品",
      valueLabel: "発注金額",
      valueHint: "確認の深さを資金リスクに合わせるために使用します。",
      valueOptions: {
        lt5k: "5,000 米ドル未満",
        "5k-25k": "5,000 ～ 25,000 米ドル",
        "25k-100k": "25,000 ～ 100,000 米ドル",
        gt100k: "100,000 米ドル超",
        unknown: "未定",
      },
      urgencyLabel: "いつまでに回答が必要ですか",
      urgencyOptions: {
        now: "まもなく支払う予定",
        "30days": "30日以内",
        planning: "まだ検討中",
      },
      concernsLabel: "最も気になっている点は",
      concernsHint: "不自然な主張、支払い要求、判断に迷う書類など、具体的にご記入ください。",
      submit: "検証リクエストを送信",
      submitting: "送信中…",
      privacyNote: "ご入力の情報は本リクエストの範囲確定と見積もりにのみ使用し、サプライヤーには共有しません。",
      notAVerdict: "このフォームはリクエストの受付です。検証結果ではなく、記入の有無はサプライヤーの承認・否認を意味しません。",
      successTitle: "リクエストを受け付けました",
      successLead: "担当者が内容を確認し、1営業日以内にご返信します。",
      errorGeneric: "こちら側で問題が発生しました。もう一度お試しください。",
      errorRateLimited: "このアドレスからの送信が多すぎます。しばらく待つか、直接メールでご連絡ください。",
      errorInvalidEmail: "有効な会社のメールアドレスをご入力ください。",
      errorSupplierRequired: "サプライヤーのウェブサイトまたは会社名をご記入ください。",
    },
  },
  es: {
    badge: "Verificación de proveedores",
    h1: "¿Dudas sobre un proveedor? Verifícalo antes de pagar",
    lead: "Envíanos la fábrica que estás considerando. Te decimos qué se puede confirmar, qué no y cuánto cuesta, antes de que salga dinero de tu cuenta.",
    breadcrumb: "Verificar un proveedor",
    metaTitle: "Verifica un Proveedor Antes de Pagar",
    metaDesc:
      "Envíanos la web o el nombre de un proveedor y comprobamos la empresa, la planta y las capacidades declaradas antes de que hagas un pedido o pagues un anticipo.",
    checksTitle: "Qué revisamos",
    checksLead: "El alcance depende del proveedor y del riesgo. Normalmente:",
    checks: [
      "Si la empresa existe legalmente y coincide con el nombre que usa",
      "Si la dirección es una planta real que opera de verdad",
      "Si los productos coinciden con la capacidad y el equipo declarados",
      "Si los documentos que te envía resisten la comparación con su origen",
    ],
    rulesTitle: "Lo que no haremos",
    rules: [
      "No garantizamos un resultado. Informamos lo que encontramos, incluso lo que no podemos confirmar.",
      "No vendemos un resultado limpio. Una verificación que detecta un problema es una verificación exitosa.",
      "No revisamos tus condiciones comerciales, el precio ni el contrato. Eso no es verificación.",
      "Enviar una solicitud no cambia el estado de ningún proveedor en este sitio.",
    ],
    servicesTitle: "¿Quieres el trabajo hecho, no solo el alcance?",
    servicesLead: "La verificación y la auditoría de fábrica son los dos servicios que suelen contratar después.",
    serviceVerification: "Verificación de proveedor",
    serviceAudit: "Auditoría de fábrica",
    servicesNote: "Un especialista confirma contigo el alcance y el precio antes de empezar.",
    directoryTitle: "Comprueba si ya está en el directorio",
    directoryLead: "Los perfiles muestran nivel de verificación, puntuación de riesgo y evidencia registrada. Leerlos no cuesta nada.",
    directoryCta: "Ver el directorio de proveedores",
    linkedPrefix: "Verificando:",
    formTitle: "Cuéntanos sobre el proveedor",
    form: {
      supplierUrlLabel: "Web del proveedor",
      supplierUrlHint: "Pega el enlace de su web, de la plataforma o de la firma del correo.",
      supplierUrlPlaceholder: "https://ejemplo.com",
      supplierNameLabel: "Nombre de la empresa proveedora",
      supplierNameHint: "Si no tienes enlace, basta con el nombre tal como aparece en sus documentos.",
      supplierNamePlaceholder: "Nombre tal como figura en su factura o cotización",
      eitherHint: "Rellena al menos uno de los dos campos anteriores para saber a quién revisar.",
      emailLabel: "Correo corporativo",
      emailHint: "Aquí respondemos con el alcance y el precio. No se comparte con el proveedor.",
      emailPlaceholder: "tu@empresa.com",
      nameLabel: "Tu nombre",
      companyLabel: "Tu empresa",
      countryLabel: "País de importación",
      productLabel: "Producto que compras",
      productPlaceholder: "p. ej. menaje de acero inoxidable",
      valueLabel: "Valor del pedido",
      valueHint: "Nos ayuda a ajustar la profundidad de la comprobación al dinero en riesgo.",
      valueOptions: {
        lt5k: "Menos de 5.000 USD",
        "5k-25k": "5.000 – 25.000 USD",
        "25k-100k": "25.000 – 100.000 USD",
        gt100k: "Más de 100.000 USD",
        unknown: "Aún sin decidir",
      },
      urgencyLabel: "¿Cuándo necesitas una respuesta?",
      urgencyOptions: {
        now: "Estoy a punto de pagar",
        "30days": "En 30 días",
        planning: "Todavía investigando",
      },
      concernsLabel: "¿Qué te preocupa más?",
      concernsHint: "Cualquier detalle concreto: una afirmación dudosa, una petición de pago, un documento que no te convence.",
      submit: "Enviar solicitud de verificación",
      submitting: "Enviando…",
      privacyNote:
        "Usamos tus datos para definir y cotizar esta solicitud. No compartimos tu consulta con el proveedor.",
      notAVerdict:
        "Este formulario inicia una solicitud. No es un resultado de verificación y no significa que un proveedor esté aprobado o rechazado.",
      successTitle: "Solicitud recibida",
      successLead: "Un especialista revisará los detalles y responderá en un día hábil.",
      errorGeneric: "Algo falló de nuestro lado. Inténtalo de nuevo.",
      errorRateLimited: "Demasiadas solicitudes desde esta dirección. Espera un poco o escríbenos directamente.",
      errorInvalidEmail: "Introduce un correo corporativo válido.",
      errorSupplierRequired: "Añade la web o el nombre de la empresa proveedora.",
    },
  },
  de: {
    badge: "Lieferantenprüfung",
    h1: "Unsicher bei einem Lieferanten? Prüfen lassen, bevor Sie zahlen",
    lead: "Senden Sie uns die Fabrik, die Sie in Betracht ziehen. Wir sagen Ihnen, was bestätigt werden kann, was nicht und was es kostet – bevor Geld Ihr Konto verlässt.",
    breadcrumb: "Lieferant prüfen",
    metaTitle: "Lieferant prüfen, bevor Sie zahlen",
    metaDesc:
      "Senden Sie uns Website oder Firmennamen eines Lieferanten und wir prüfen Unternehmen, Standort und Kapazitätsangaben, bevor Sie bestellen oder eine Anzahlung leisten.",
    checksTitle: "Was wir prüfen",
    checksLead: "Der Umfang richtet sich nach Lieferant und Risiko. Typischerweise:",
    checks: [
      "Ob das Unternehmen rechtlich existiert und mit dem verwendeten Namen übereinstimmt",
      "Ob die Adresse ein realer, tatsächlich betriebener Standort ist",
      "Ob die Produkte zu den angegebenen Kapazitäten und Maschinen passen",
      "Ob die zugesandten Dokumente einer Prüfung gegen die Quelle standhalten",
    ],
    rulesTitle: "Was wir nicht tun",
    rules: [
      "Wir garantieren kein Ergebnis. Wir berichten, was wir finden – auch was wir nicht bestätigen können.",
      "Wir verkaufen kein sauberes Ergebnis. Eine Prüfung, die ein Problem findet, ist eine gelungene Prüfung.",
      "Wir prüfen keine Handelsbedingungen, Preise oder Verträge. Das ist keine Verifikation.",
      "Eine Anfrage ändert den Status eines Lieferanten auf dieser Seite nicht.",
    ],
    servicesTitle: "Sie wollen die Durchführung, nicht nur den Umfang?",
    servicesLead: "Verifikation und Werksaudit sind die zwei Leistungen, die Kunden danach am häufigsten beauftragen.",
    serviceVerification: "Lieferantenverifikation",
    serviceAudit: "Werksaudit",
    servicesNote: "Ein Spezialist bestätigt Umfang und Preis mit Ihnen, bevor die Arbeit beginnt.",
    directoryTitle: "Prüfen, ob der Lieferant bereits gelistet ist",
    directoryLead: "Profile zeigen Prüfstufe, Risikowert und dokumentierte Nachweise. Das Lesen kostet nichts.",
    directoryCta: "Lieferantenverzeichnis ansehen",
    linkedPrefix: "Prüfung von:",
    formTitle: "Erzählen Sie uns vom Lieferanten",
    form: {
      supplierUrlLabel: "Website des Lieferanten",
      supplierUrlHint: "Fügen Sie den Link von Website, Marktplatz oder E-Mail-Signatur ein.",
      supplierUrlPlaceholder: "https://beispiel.com",
      supplierNameLabel: "Firmenname des Lieferanten",
      supplierNameHint: "Ohne Link genügt der Name, wie er auf den Dokumenten steht.",
      supplierNamePlaceholder: "Name wie auf Rechnung oder Angebot",
      eitherHint: "Füllen Sie mindestens eines der beiden Felder aus, damit wir wissen, wen wir prüfen sollen.",
      emailLabel: "Ihre Firmen-E-Mail",
      emailHint: "Hier antworten wir mit Umfang und Preis. Sie wird nicht an den Lieferanten weitergegeben.",
      emailPlaceholder: "sie@firma.com",
      nameLabel: "Ihr Name",
      companyLabel: "Ihr Unternehmen",
      countryLabel: "Einfuhrland",
      productLabel: "Produkt, das Sie kaufen",
      productPlaceholder: "z. B. Edelstahl-Küchengeräte",
      valueLabel: "Auftragswert",
      valueHint: "Hilft uns, die Prüftiefe am Risiko auszurichten.",
      valueOptions: {
        lt5k: "Unter 5.000 USD",
        "5k-25k": "5.000 – 25.000 USD",
        "25k-100k": "25.000 – 100.000 USD",
        gt100k: "Über 100.000 USD",
        unknown: "Noch offen",
      },
      urgencyLabel: "Wie schnell brauchen Sie eine Antwort?",
      urgencyOptions: {
        now: "Ich stehe kurz vor der Zahlung",
        "30days": "Innerhalb von 30 Tagen",
        planning: "Noch in der Recherche",
      },
      concernsLabel: "Was bereitet Ihnen die größten Sorgen?",
      concernsHint: "Alles Konkrete: eine verdächtige Angabe, eine Zahlungsaufforderung, ein unklares Dokument.",
      submit: "Prüfanfrage senden",
      submitting: "Wird gesendet…",
      privacyNote:
        "Wir nutzen Ihre Angaben, um diese Anfrage zu umreißen und zu kalkulieren. Wir geben Ihre Anfrage nicht an den Lieferanten weiter.",
      notAVerdict:
        "Dieses Formular startet eine Anfrage. Es ist kein Prüfergebnis, und nichts hier bedeutet, dass ein Lieferant angenommen oder abgelehnt ist.",
      successTitle: "Anfrage erhalten",
      successLead: "Ein Spezialist prüft die Angaben und antwortet innerhalb eines Werktags.",
      errorGeneric: "Auf unserer Seite ist etwas schiefgelaufen. Bitte erneut versuchen.",
      errorRateLimited: "Zu viele Anfragen von dieser Adresse. Bitte warten Sie oder schreiben Sie uns direkt.",
      errorInvalidEmail: "Bitte eine gültige Firmen-E-Mail-Adresse eingeben.",
      errorSupplierRequired: "Bitte Website oder Firmenname des Lieferanten angeben.",
    },
  },
  fr: {
    badge: "Vérification de fournisseur",
    h1: "Un doute sur un fournisseur ? Vérifions avant de payer",
    lead: "Envoyez-nous l'usine que vous envisagez. Nous vous disons ce qui peut être confirmé, ce qui ne peut pas l'être et combien cela coûte — avant que l'argent ne quitte votre compte.",
    breadcrumb: "Vérifier un fournisseur",
    metaTitle: "Vérifier un fournisseur avant de payer",
    metaDesc:
      "Envoyez-nous le site ou le nom d'un fournisseur : nous vérifions l'entreprise, le site et les capacités annoncées avant votre commande ou votre acompte.",
    checksTitle: "Ce que nous examinons",
    checksLead: "L'étendue dépend du fournisseur et du risque. En général :",
    checks: [
      "Si l'entreprise existe légalement et correspond au nom qu'elle utilise",
      "Si l'adresse correspond à un site réel et effectivement en activité",
      "Si les produits correspondent aux capacités et équipements annoncés",
      "Si les documents envoyés résistent à une comparaison avec leur source",
    ],
    rulesTitle: "Ce que nous ne ferons pas",
    rules: [
      "Nous ne garantissons aucun résultat. Nous rapportons ce que nous trouvons, y compris ce que nous ne pouvons pas confirmer.",
      "Nous ne vendons pas de résultat propre. Une vérification qui détecte un problème est une vérification réussie.",
      "Nous n'examinons pas vos conditions commerciales, votre prix ni votre contrat. Ce n'est pas de la vérification.",
      "Envoyer une demande ne change le statut d'aucun fournisseur sur ce site.",
    ],
    servicesTitle: "Vous voulez l'exécution, pas seulement le périmètre ?",
    servicesLead: "La vérification et l'audit d'usine sont les deux prestations les plus commandées ensuite.",
    serviceVerification: "Vérification de fournisseur",
    serviceAudit: "Audit d'usine",
    servicesNote: "Un spécialiste confirme avec vous le périmètre et le prix avant tout démarrage.",
    directoryTitle: "Vérifiez si le fournisseur est déjà répertorié",
    directoryLead: "Les profils affichent le niveau de vérification, le score de risque et les preuves enregistrées. Consulter est gratuit.",
    directoryCta: "Parcourir l'annuaire des fournisseurs",
    linkedPrefix: "Vérification de :",
    formTitle: "Parlez-nous du fournisseur",
    form: {
      supplierUrlLabel: "Site du fournisseur",
      supplierUrlHint: "Collez le lien depuis son site, sa fiche plateforme ou sa signature e-mail.",
      supplierUrlPlaceholder: "https://exemple.com",
      supplierNameLabel: "Nom de l'entreprise fournisseur",
      supplierNameHint: "Sans lien, le nom tel qu'il figure sur ses documents suffit.",
      supplierNamePlaceholder: "Nom tel qu'il apparaît sur la facture ou le devis",
      eitherHint: "Renseignez au moins un des deux champs ci-dessus pour que nous sachions qui vérifier.",
      emailLabel: "Votre e-mail professionnel",
      emailHint: "Nous y répondons avec le périmètre et le prix. Il n'est pas transmis au fournisseur.",
      emailPlaceholder: "vous@entreprise.com",
      nameLabel: "Votre nom",
      companyLabel: "Votre entreprise",
      countryLabel: "Pays d'importation",
      productLabel: "Produit que vous achetez",
      productPlaceholder: "ex. articles de cuisine en inox",
      valueLabel: "Montant de la commande",
      valueHint: "Nous aide à adapter la profondeur de la vérification au risque financier.",
      valueOptions: {
        lt5k: "Moins de 5 000 USD",
        "5k-25k": "5 000 – 25 000 USD",
        "25k-100k": "25 000 – 100 000 USD",
        gt100k: "Plus de 100 000 USD",
        unknown: "Pas encore décidé",
      },
      urgencyLabel: "Sous quel délai vous faut-il une réponse ?",
      urgencyOptions: {
        now: "Je suis sur le point de payer",
        "30days": "Sous 30 jours",
        planning: "Encore en recherche",
      },
      concernsLabel: "Qu'est-ce qui vous inquiète le plus ?",
      concernsHint: "Tout point précis : une affirmation douteuse, une demande de paiement, un document incertain.",
      submit: "Envoyer la demande de vérification",
      submitting: "Envoi…",
      privacyNote:
        "Vos informations servent à cadrer et chiffrer cette demande. Nous ne transmettons pas votre demande au fournisseur.",
      notAVerdict:
        "Ce formulaire lance une demande. Ce n'est pas un résultat de vérification, et rien ici ne signifie qu'un fournisseur est approuvé ou rejeté.",
      successTitle: "Demande reçue",
      successLead: "Un spécialiste examinera les informations et répondra sous un jour ouvré.",
      errorGeneric: "Une erreur est survenue de notre côté. Merci de réessayer.",
      errorRateLimited: "Trop de demandes depuis cette adresse. Patientez ou écrivez-nous directement.",
      errorInvalidEmail: "Saisissez une adresse e-mail professionnelle valide.",
      errorSupplierRequired: "Ajoutez le site ou le nom de l'entreprise fournisseur.",
    },
  },
  pt: {
    badge: "Verificação de fornecedores",
    h1: "Em dúvida sobre um fornecedor? Vamos verificar antes de pagar",
    lead: "Envie-nos a fábrica que está a considerar. Dizemos-lhe o que pode ser confirmado, o que não pode e quanto custa — antes de o dinheiro sair da sua conta.",
    breadcrumb: "Verificar um fornecedor",
    metaTitle: "Verifique um Fornecedor Antes de Pagar",
    metaDesc:
      "Envie-nos o site ou o nome de um fornecedor e verificamos a empresa, as instalações e as capacidades declaradas antes de encomendar ou pagar um sinal.",
    checksTitle: "O que analisamos",
    checksLead: "O âmbito depende do fornecedor e do risco. Habitualmente:",
    checks: [
      "Se a empresa existe legalmente e corresponde ao nome que usa",
      "Se o endereço é uma fábrica real que efetivamente opera",
      "Se os produtos correspondem à capacidade e ao equipamento declarados",
      "Se os documentos que lhe enviam resistem à comparação com a origem",
    ],
    rulesTitle: "O que não fazemos",
    rules: [
      "Não garantimos um resultado. Relatamos o que encontramos, incluindo o que não conseguimos confirmar.",
      "Não vendemos um resultado limpo. Uma verificação que encontra um problema é uma verificação bem-sucedida.",
      "Não analisamos as suas condições comerciais, o preço ou o contrato. Isso não é verificação.",
      "Enviar um pedido não altera o estado de qualquer fornecedor neste site.",
    ],
    servicesTitle: "Quer o trabalho feito, não apenas o âmbito?",
    servicesLead: "A verificação e a auditoria de fábrica são os dois serviços mais pedidos a seguir.",
    serviceVerification: "Verificação de fornecedor",
    serviceAudit: "Auditoria de fábrica",
    servicesNote: "Um especialista confirma consigo o âmbito e o preço antes de começar.",
    directoryTitle: "Verifique se já está no diretório",
    directoryLead: "Os perfis mostram nível de verificação, pontuação de risco e evidência registada. Consultar é gratuito.",
    directoryCta: "Ver o diretório de fornecedores",
    linkedPrefix: "A verificar:",
    formTitle: "Fale-nos sobre o fornecedor",
    form: {
      supplierUrlLabel: "Site do fornecedor",
      supplierUrlHint: "Cole a ligação do site, da plataforma ou da assinatura de e-mail.",
      supplierUrlPlaceholder: "https://exemplo.com",
      supplierNameLabel: "Nome da empresa fornecedora",
      supplierNameHint: "Sem ligação, basta o nome tal como consta nos documentos.",
      supplierNamePlaceholder: "Nome tal como aparece na fatura ou cotação",
      eitherHint: "Preencha pelo menos um dos dois campos acima para sabermos quem verificar.",
      emailLabel: "E-mail da sua empresa",
      emailHint: "Respondemos aqui com o âmbito e o preço. Não é partilhado com o fornecedor.",
      emailPlaceholder: "voce@empresa.com",
      nameLabel: "O seu nome",
      companyLabel: "A sua empresa",
      countryLabel: "País de importação",
      productLabel: "Produto que compra",
      productPlaceholder: "ex. utensílios de cozinha em inox",
      valueLabel: "Valor da encomenda",
      valueHint: "Ajuda-nos a ajustar a profundidade da verificação ao risco financeiro.",
      valueOptions: {
        lt5k: "Menos de 5.000 USD",
        "5k-25k": "5.000 – 25.000 USD",
        "25k-100k": "25.000 – 100.000 USD",
        gt100k: "Mais de 100.000 USD",
        unknown: "Ainda por decidir",
      },
      urgencyLabel: "Com que urgência precisa de resposta?",
      urgencyOptions: {
        now: "Estou prestes a pagar",
        "30days": "Nos próximos 30 dias",
        planning: "Ainda em pesquisa",
      },
      concernsLabel: "O que o preocupa mais?",
      concernsHint: "Qualquer ponto concreto: uma afirmação duvidosa, um pedido de pagamento, um documento incerto.",
      submit: "Enviar pedido de verificação",
      submitting: "A enviar…",
      privacyNote:
        "Usamos os seus dados para definir e orçamentar este pedido. Não partilhamos o seu pedido com o fornecedor.",
      notAVerdict:
        "Este formulário inicia um pedido. Não é um resultado de verificação e nada aqui significa que um fornecedor está aprovado ou rejeitado.",
      successTitle: "Pedido recebido",
      successLead: "Um especialista analisará os detalhes e responderá num dia útil.",
      errorGeneric: "Algo falhou do nosso lado. Tente novamente.",
      errorRateLimited: "Demasiados pedidos deste endereço. Aguarde ou escreva-nos diretamente.",
      errorInvalidEmail: "Introduza um e-mail empresarial válido.",
      errorSupplierRequired: "Adicione o site ou o nome da empresa fornecedora.",
    },
  },
  ar: {
    badge: "التحقق من المورّدين",
    h1: "غير متأكد من مورّد؟ دعنا نتحقق قبل أن تدفع",
    lead: "أرسل لنا المصنع الذي تفكر فيه. نخبرك بما يمكن تأكيده، وما لا يمكن، وكم تبلغ التكلفة — قبل أن يخرج المال من حسابك.",
    breadcrumb: "التحقق من مورّد",
    metaTitle: "تحقق من المورّد قبل الدفع",
    metaDesc:
      "أرسل لنا موقع المورّد أو اسم الشركة ونتحقق من الشركة والموقع والطاقة الإنتاجية المعلنة قبل الطلب أو دفع الدفعة المقدمة.",
    checksTitle: "ما نتحقق منه",
    checksLead: "يتوقف النطاق على المورّد ومستوى المخاطرة. عادةً:",
    checks: [
      "هل الشركة موجودة قانونيًا وهل يتطابق اسمها مع الاسم الذي تستخدمه",
      "هل العنوان مصنع حقيقي يعمل فعليًا",
      "هل تتوافق المنتجات مع الطاقة والمعدات المعلنة",
      "هل تصمد المستندات المرسلة عند مقارنتها بمصدرها",
    ],
    rulesTitle: "ما لن نفعله",
    rules: [
      "لا نضمن نتيجة. نبلّغ بما نجد، بما في ذلك ما لا نستطيع تأكيده.",
      "لا نبيع نتيجة نظيفة. التحقق الذي يكشف مشكلة هو تحقق ناجح.",
      "لا نراجع شروطك التجارية أو السعر أو العقد. ذلك ليس تحققًا.",
      "إرسال الطلب لا يغيّر حالة أي مورّد على هذا الموقع.",
    ],
    servicesTitle: "تريد التنفيذ لا تحديد النطاق فقط؟",
    servicesLead: "التحقق وتدقيق المصنع هما الخدمتان الأكثر طلبًا بعد ذلك.",
    serviceVerification: "التحقق من المورّد",
    serviceAudit: "تدقيق المصنع",
    servicesNote: "يؤكد المتخصص معك النطاق والسعر قبل بدء العمل.",
    directoryTitle: "تحقق إن كان المورّد مدرجًا بالفعل",
    directoryLead: "تعرض الملفات مستوى التحقق ودرجة المخاطرة والأدلة المسجلة. الاطلاع مجاني.",
    directoryCta: "تصفح دليل المورّدين",
    linkedPrefix: "جارٍ التحقق من:",
    formTitle: "أخبرنا عن المورّد",
    form: {
      supplierUrlLabel: "موقع المورّد",
      supplierUrlHint: "الصق الرابط من موقعه أو صفحته على المنصات أو توقيع البريد.",
      supplierUrlPlaceholder: "https://example.com",
      supplierNameLabel: "اسم الشركة المورّدة",
      supplierNameHint: "إن لم يكن لديك رابط، يكفي الاسم كما هو مكتوب في مستنداته.",
      supplierNamePlaceholder: "الاسم كما يظهر في الفاتورة أو العرض",
      eitherHint: "املأ حقلًا واحدًا على الأقل من الحقلين أعلاه لنعرف من نتحقق منه.",
      emailLabel: "بريد شركتك الإلكتروني",
      emailHint: "نرد عليه بالنطاق والسعر. ولا يُشارك مع المورّد.",
      emailPlaceholder: "you@company.com",
      nameLabel: "اسمك",
      companyLabel: "شركتك",
      countryLabel: "بلد الاستيراد",
      productLabel: "المنتج الذي تشتريه",
      productPlaceholder: "مثال: أدوات مطبخ من الفولاذ المقاوم للصدأ",
      valueLabel: "قيمة الطلب",
      valueHint: "يساعدنا على مواءمة عمق التحقق مع المال المعرّض للخطر.",
      valueOptions: {
        lt5k: "أقل من 5,000 دولار",
        "5k-25k": "5,000 – 25,000 دولار",
        "25k-100k": "25,000 – 100,000 دولار",
        gt100k: "أكثر من 100,000 دولار",
        unknown: "لم يُحدد بعد",
      },
      urgencyLabel: "متى تحتاج الرد؟",
      urgencyOptions: {
        now: "على وشك الدفع",
        "30days": "خلال 30 يومًا",
        planning: "ما زلت أبحث",
      },
      concernsLabel: "ما يقلقك أكثر؟",
      concernsHint: "أي نقطة محددة: ادعاء مريب، طلب دفع، مستند غير واضح.",
      submit: "إرسال طلب التحقق",
      submitting: "جارٍ الإرسال…",
      privacyNote: "نستخدم بياناتك لتحديد نطاق هذا الطلب وتسعيره. ولا نشارك استفسارك مع المورّد.",
      notAVerdict:
        "هذه الاستمارة تبدأ طلبًا، وليست نتيجة تحقق. ولا يعني أي شيء هنا أن المورّد مقبول أو مرفوض.",
      successTitle: "تم استلام الطلب",
      successLead: "سيراجع المتخصص التفاصيل ويرد خلال يوم عمل واحد.",
      errorGeneric: "حدث خطأ من جانبنا. حاول مرة أخرى.",
      errorRateLimited: "طلبات كثيرة من هذا العنوان. انتظر قليلًا أو راسلنا مباشرة.",
      errorInvalidEmail: "أدخل بريدًا إلكترونيًا صحيحًا للشركة.",
      errorSupplierRequired: "أضف موقع المورّد أو اسم الشركة.",
    },
  },
};

const LOCALES = Object.keys(K);

// supplierProfile 命名空间下的新增键（不属于 verifySupplier 命名空间）
const SP_KEY = {
  en: "Verify this supplier",
  zh: "核验这家供应商",
  "zh-TW": "核驗這家供應商",
  ja: "このサプライヤーを検証",
  es: "Verificar este proveedor",
  de: "Diesen Lieferanten prüfen",
  fr: "Vérifier ce fournisseur",
  pt: "Verificar este fornecedor",
  ar: "التحقق من هذا المورّد",
};

let changed = 0;

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  if (!fs.existsSync(file)) {
    console.log(`SKIP  ${locale}（文件不存在）`);
    continue;
  }
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));

  let added = 0;

  if (obj.verifySupplier) {
    console.log(`SKIP  ${locale}（verifySupplier 已存在）`);
  } else {
    obj.verifySupplier = K[locale];
    added += countLeaves(K[locale]);
  }

  if (obj.supplierProfile && !("verifyThisSupplier" in obj.supplierProfile)) {
    obj.supplierProfile.verifyThisSupplier = SP_KEY[locale];
    added += 1;
  }

  if (added === 0) {
    console.log(`SKIP  ${locale}（已全部存在）`);
    continue;
  }

  const out = JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  changed++;
  console.log(`OK    ${locale}.json 新增 ${added} 键`);
}

/** 叶子计数：与 cs06a 的 leaves() 算法完全一致（对象递归、数组展开、原始值计 1） */
function countLeaves(obj) {
  const out = [];
  (function walk(o, prefix) {
    if (o === null || typeof o !== "object") {
      out.push(prefix);
      return;
    }
    if (Array.isArray(o)) {
      o.forEach((v, i) => walk(v, `${prefix}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(o)) walk(v, prefix ? `${prefix}.${k}` : k);
  })(obj, "");
  return out.length;
}

// ---- 九语键集一致性自检 ----
function leaves(obj, prefix = "", out = []) {
  if (obj === null || typeof obj !== "object") {
    out.push(prefix);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    leaves(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const enObj = JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8"));
const enLeaves = leaves(enObj).sort();
console.log(`\nen 字典叶子数 = ${enLeaves.length}`);
const strings = enLeaves.filter((k) => typeof k.split(".").reduce((o, x) => (o == null ? o : o[x]), enObj) === "string").length;
console.log(`  = ${strings} 字符串 + ${enLeaves.length - strings} 其他类型`);

let mismatch = 0;
for (const loc of LOCALES) {
  const o = JSON.parse(fs.readFileSync(path.join(DIR, `${loc}.json`), "utf8"));
  const l = leaves(o).sort();
  const missing = enLeaves.filter((k) => !l.includes(k));
  const extra = l.filter((k) => !enLeaves.includes(k));
  if (missing.length || extra.length) {
    mismatch++;
    console.log(`❌ ${loc}：缺 ${missing.length} 键 / 多 ${extra.length} 键`);
    if (missing.length) console.log(`     缺: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? " …" : ""}`);
    if (extra.length) console.log(`     多: ${extra.slice(0, 5).join(", ")}${extra.length > 5 ? " …" : ""}`);
  } else {
    console.log(`✅ ${loc}：键集与 en 完全一致（${l.length}）`);
  }
}

console.log(`\n完成：${changed} 个文件被写入；键集不一致语言数 = ${mismatch}`);
if (mismatch === 0) {
  console.log("→ 下一步：node scripts/sync-step05-gates.cjs（同步 8 处冻结常量）");
}
