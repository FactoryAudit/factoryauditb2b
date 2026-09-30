#!/usr/bin/env node
/**
 * scripts/apply-cs23-compliance-i18n.cjs —— CS-23 合规三页 i18n 注入
 *
 * 用途：给 9 语字典注入 CS-23 新增命名空间，并在注入后**自动同步**所有 en 叶子数
 *       冻结常量（沿用 apply-cs22b-i18n.cjs 的机制，不手改任何断言脚本）。
 *
 * 用法：
 *   node scripts/apply-cs23-compliance-i18n.cjs              # 注入全部 CS-23 键
 *   node scripts/apply-cs23-compliance-i18n.cjs confidentiality,compliance,footer
 *
 * 铁律（踩过的坑，勿删）：
 *   1. 字典必须**纯 CRLF + 末尾 CRLF**（cs13 F1d）。writeKeepEol 只做换行归一，
 *      不动 JSON 缩进 —— 已验证 9 语字典「parse → stringify(2 空格) → CRLF」
 *      与原文件**逐字节一致**，故整体重序列化是安全的。
 *   2. 幂等：已存在的键**不覆盖**（重复执行不会改坏已上线文案）。
 *   3. 叶子数常量同步的 OLD 值**从 RELEASE-RULES.md 读**（规则 3 的单一事实源），
 *      而不是写死 —— 这样同一脚本可重复执行（逐阶段加命名空间也不会踩空）。
 *      ⚠️ 因此本文件的注释**不要写任何裸的四位叶子数常量**：会被下一次同步
 *      当成待替换的旧值改掉，注释随即失真。需要指代时写「当前基线」。
 *   4. 排除 `scripts/_*`（探针是历史快照，禁改）与 `step13b-i18n-gates.cjs`
 *      （它是更早那次 clusters 扩容的历史迁移脚本，常量写死在脚本体里；
 *       改它会让那次迁移的映射语义错位，且它**不是闸门**、无人读取）。
 *   5. 禁止用两段正则改字典；禁止把 .next 删除（只允许重命名）。
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const DICT_DIR = path.join(ROOT, "i18n/dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

// ── 只同步这些命名空间（按阶段切分，便于逐阶段交付）────────────────────────
//    参数顺序无关：第一个非 `--` 开头的参数才是命名空间列表。
const ARGS = process.argv.slice(2);
const REQUESTED = (ARGS.find((a) => !a.startsWith("--")) || "all")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const wantAll = REQUESTED.length === 0 || REQUESTED.includes("all");
const want = (ns) => wantAll || REQUESTED.includes(ns);

/**
 * 默认**不覆盖**已存在的键（幂等，防止把已上线文案改回草稿）。
 * 传 `--overwrite` 才会用本文件里的文案覆盖既有值 —— 仅在**纠正自己刚注入的
 * 未上线文案**时使用（例如 metaDesc 超出 158 字符预算需要缩短）。
 */
const OVERWRITE = ARGS.includes("--overwrite");

// ============================================================================
// 文案（9 语人工撰写，非机翻 —— 承诺强度必须逐语对齐：我们自身的行为用「不…」
// 陈述句，对审核员/合作方的义务用「不得/必须」义务句，全语种一致）
// ============================================================================
const TRANS = {
  en: {
    "confidentiality.metaTitle": "Confidentiality Statement",
    "confidentiality.metaDesc":
      "How FactoryAuditB2B handles the product specifications, supplier names, RFQ content, contact details and audit reports you share with us.",
    "confidentiality.h1": "Confidentiality Statement",
    "confidentiality.updated": "Last updated: 2026-09-30",
    "confidentiality.intro":
      "This statement explains what we treat as confidential information, who is bound by it, and how we use it. It covers enquiries, RFQs, verification and audit work.",
    "confidentiality.sections.0.h": "What we treat as confidential",
    "confidentiality.sections.0.b":
      "Product specifications, order quantities, supplier names, RFQ content, contact details and audit reports that you share with us. Anything you mark as confidential, or that a reasonable reader would understand to be confidential, is treated the same way.",
    "confidentiality.sections.1.h": "Who is bound",
    "confidentiality.sections.1.b":
      "Our auditors, employees, contractors and service partners must keep this information confidential. Access is limited to the people who need it to do the work.",
    "confidentiality.sections.2.h": "How we use it",
    "confidentiality.sections.2.b":
      "Only to deliver the RFQ, verification, audit or inspection service you asked for. We do not use your confidential information for any other purpose.",
    "confidentiality.sections.3.h": "We do not sell it",
    "confidentiality.sections.3.b":
      "We do not sell, rent or trade your confidential information. We share it with a supplier or audit partner only where that is needed to deliver the service you requested.",
    "confidentiality.sections.4.h": "If these rules are broken",
    "confidentiality.sections.4.b":
      "A breach is handled internally: the work stops, access is withdrawn, and the person or partner involved faces disciplinary action or termination of the working relationship. We do not ask you to give up any remedy the law gives you.",
    "compliance.relatedTitle": "Related policies",
    "footer.confidentiality": "Confidentiality",
    "footer.integrity": "Integrity",
  },

  zh: {
    "confidentiality.metaTitle": "保密声明",
    "confidentiality.metaDesc":
      "FactoryAuditB2B 如何处理你提交的产品规格、供应商名称、RFQ 内容、联系信息与审核报告。",
    "confidentiality.h1": "保密声明",
    "confidentiality.updated": "最后更新：2026-09-30",
    "confidentiality.intro":
      "本声明说明我们把哪些信息视为保密信息、谁承担保密义务、以及我们如何使用这些信息。适用范围包括询盘、RFQ、核验与审核工作。",
    "confidentiality.sections.0.h": "哪些信息属于保密信息",
    "confidentiality.sections.0.b":
      "你提交给我们的产品规格、订单数量、供应商名称、RFQ 内容、联系信息与审核报告。你明确标注为保密的信息，或按通常理解应属保密的信息，同样适用。",
    "confidentiality.sections.1.h": "谁承担保密义务",
    "confidentiality.sections.1.b":
      "我们的审核员、员工、外包人员与服务合作伙伴均须对这些信息保密。接触范围仅限于为完成工作而确有必要的人员。",
    "confidentiality.sections.2.h": "使用范围",
    "confidentiality.sections.2.b":
      "仅用于交付你委托的 RFQ、核验、审核或验货服务。我们不会将你的保密信息用于任何其他目的。",
    "confidentiality.sections.3.h": "我们不出售这些信息",
    "confidentiality.sections.3.b":
      "我们不出售、出租或交换你的保密信息。仅在交付你所需服务确有必要时，才会向供应商或审核合作方提供。",
    "confidentiality.sections.4.h": "违反保密义务的后果",
    "confidentiality.sections.4.b":
      "一旦发生泄露，我们按内部程序处理：暂停相关工作、收回访问权限，并对相关个人或合作方予以纪律处理或终止合作。法律赋予你的救济权利，我们不会要求你放弃。",
    "compliance.relatedTitle": "相关政策",
    "footer.confidentiality": "保密声明",
    "footer.integrity": "廉洁准则",
  },

  "zh-TW": {
    "confidentiality.metaTitle": "保密聲明",
    "confidentiality.metaDesc":
      "FactoryAuditB2B 如何處理你提交的產品規格、供應商名稱、RFQ 內容、聯絡資訊與稽核報告。",
    "confidentiality.h1": "保密聲明",
    "confidentiality.updated": "最後更新：2026-09-30",
    "confidentiality.intro":
      "本聲明說明我們把哪些資訊視為保密資訊、誰負有保密義務、以及我們如何使用這些資訊。適用範圍包括詢價、RFQ、驗證與稽核工作。",
    "confidentiality.sections.0.h": "哪些資訊屬於保密資訊",
    "confidentiality.sections.0.b":
      "你提交給我們的產品規格、訂單數量、供應商名稱、RFQ 內容、聯絡資訊與稽核報告。你明確標示為保密的資訊，或依一般理解應屬保密的資訊，同樣適用。",
    "confidentiality.sections.1.h": "誰負有保密義務",
    "confidentiality.sections.1.b":
      "我們的稽核員、員工、外包人員與服務夥伴均須對這些資訊保密。接觸範圍僅限於為完成工作確有必要的人員。",
    "confidentiality.sections.2.h": "使用範圍",
    "confidentiality.sections.2.b":
      "僅用於交付你委託的 RFQ、驗證、稽核或驗貨服務。我們不會將你的保密資訊用於任何其他目的。",
    "confidentiality.sections.3.h": "我們不出售這些資訊",
    "confidentiality.sections.3.b":
      "我們不出售、出租或交換你的保密資訊。僅在交付你所需服務確有必要時，才會提供給供應商或稽核夥伴。",
    "confidentiality.sections.4.h": "違反保密義務的後果",
    "confidentiality.sections.4.b":
      "一旦發生洩漏，我們依內部程序處理：暫停相關工作、收回存取權限，並對相關人員或夥伴進行紀律處理或終止合作。法律賦予你的救濟權利，我們不會要求你放棄。",
    "compliance.relatedTitle": "相關政策",
    "footer.confidentiality": "保密聲明",
    "footer.integrity": "廉潔準則",
  },

  ja: {
    "confidentiality.metaTitle": "機密保持に関する声明",
    "confidentiality.metaDesc":
      "FactoryAuditB2B が、ご提供いただいた製品仕様・サプライヤー名・RFQ の内容・連絡先・監査報告書をどのように扱うかを説明します。",
    "confidentiality.h1": "機密保持に関する声明",
    "confidentiality.updated": "最終更新：2026-09-30",
    "confidentiality.intro":
      "本声明は、当社が何を機密情報として扱うか、誰が機密保持義務を負うか、どのように利用するかを説明するものです。対象は問い合わせ、RFQ、検証および監査業務です。",
    "confidentiality.sections.0.h": "機密情報として扱うもの",
    "confidentiality.sections.0.b":
      "お客様からご提供いただく製品仕様、発注数量、サプライヤー名、RFQ の内容、連絡先、監査報告書。お客様が機密と明示した情報、または一般に機密と解される情報も同様に扱います。",
    "confidentiality.sections.1.h": "機密保持義務を負う者",
    "confidentiality.sections.1.b":
      "当社の監査員、従業員、業務委託先、協力会社は、これらの情報を機密として保持しなければなりません。アクセスは業務上必要な範囲に限定します。",
    "confidentiality.sections.2.h": "利用範囲",
    "confidentiality.sections.2.b":
      "お客様が依頼された RFQ、検証、監査または検品サービスの提供に限って利用します。それ以外の目的で機密情報を利用することはありません。",
    "confidentiality.sections.3.h": "第三者への販売は行いません",
    "confidentiality.sections.3.b":
      "お客様の機密情報を販売、貸与、交換することはありません。ご依頼のサービス提供に必要な場合に限り、サプライヤーまたは監査パートナーに提供します。",
    "confidentiality.sections.4.h": "遵守が破られた場合",
    "confidentiality.sections.4.b":
      "漏えいが生じた場合は社内手続きで対応します。業務を停止し、アクセス権を回収し、関係する個人またはパートナーに対して懲戒または取引関係の終了を行います。法律上有する救済の権利を放棄していただくことはありません。",
    "compliance.relatedTitle": "関連ポリシー",
    "footer.confidentiality": "機密保持",
    "footer.integrity": "インテグリティ",
  },

  es: {
    "confidentiality.metaTitle": "Declaración de confidencialidad",
    "confidentiality.metaDesc":
      "Cómo tratamos las especificaciones de producto, los nombres de proveedores, el contenido de las RFQ, los contactos y los informes de auditoría.",
    "confidentiality.h1": "Declaración de confidencialidad",
    "confidentiality.updated": "Última actualización: 2026-09-30",
    "confidentiality.intro":
      "Esta declaración explica qué tratamos como información confidencial, quién está obligado a protegerla y cómo la utilizamos. Cubre consultas, RFQ, verificación y trabajos de auditoría.",
    "confidentiality.sections.0.h": "Qué tratamos como confidencial",
    "confidentiality.sections.0.b":
      "Las especificaciones de producto, cantidades de pedido, nombres de proveedores, contenido de las RFQ, datos de contacto e informes de auditoría que comparte con nosotros. Lo que marque como confidencial, o que un lector razonable entendería como confidencial, recibe el mismo tratamiento.",
    "confidentiality.sections.1.h": "Quién está obligado",
    "confidentiality.sections.1.b":
      "Nuestros auditores, empleados, colaboradores externos y socios de servicio deben mantener esta información en confidencialidad. El acceso se limita a quienes lo necesitan para realizar el trabajo.",
    "confidentiality.sections.2.h": "Para qué la utilizamos",
    "confidentiality.sections.2.b":
      "Solo para prestar el servicio de RFQ, verificación, auditoría o inspección que usted solicitó. No utilizamos su información confidencial con ningún otro fin.",
    "confidentiality.sections.3.h": "No la vendemos",
    "confidentiality.sections.3.b":
      "No vendemos, alquilamos ni intercambiamos su información confidencial. La compartimos con un proveedor o socio de auditoría únicamente cuando es necesario para prestar el servicio solicitado.",
    "confidentiality.sections.4.h": "Si se incumplen estas reglas",
    "confidentiality.sections.4.b":
      "Un incumplimiento se gestiona internamente: se detiene el trabajo, se retira el acceso y la persona o el socio implicado se enfrenta a medidas disciplinarias o a la terminación de la relación de trabajo. No le pedimos que renuncie a ningún recurso que la ley le otorgue.",
    "compliance.relatedTitle": "Políticas relacionadas",
    "footer.confidentiality": "Confidencialidad",
    "footer.integrity": "Integridad",
  },

  de: {
    "confidentiality.metaTitle": "Vertraulichkeitserklärung",
    "confidentiality.metaDesc":
      "Wie FactoryAuditB2B mit den von Ihnen übermittelten Produktspezifikationen, Lieferantennamen, RFQ-Inhalten, Kontaktdaten und Auditberichten umgeht.",
    "confidentiality.h1": "Vertraulichkeitserklärung",
    "confidentiality.updated": "Zuletzt aktualisiert: 2026-09-30",
    "confidentiality.intro":
      "Diese Erklärung beschreibt, was wir als vertrauliche Informationen behandeln, wer zur Vertraulichkeit verpflichtet ist und wie wir diese Informationen verwenden. Sie gilt für Anfragen, RFQs, Verifizierungen und Auditaufträge.",
    "confidentiality.sections.0.h": "Was wir als vertraulich behandeln",
    "confidentiality.sections.0.b":
      "Produktspezifikationen, Bestellmengen, Lieferantennamen, RFQ-Inhalte, Kontaktdaten und Auditberichte, die Sie uns übermitteln. Alles, was Sie als vertraulich kennzeichnen oder was ein verständiger Leser als vertraulich verstehen würde, wird genauso behandelt.",
    "confidentiality.sections.1.h": "Wer verpflichtet ist",
    "confidentiality.sections.1.b":
      "Unsere Auditoren, Mitarbeitenden, Auftragnehmer und Servicepartner müssen diese Informationen vertraulich behandeln. Der Zugriff ist auf die Personen beschränkt, die ihn für die Arbeit benötigen.",
    "confidentiality.sections.2.h": "Wofür wir sie verwenden",
    "confidentiality.sections.2.b":
      "Ausschließlich zur Erbringung der von Ihnen angefragten RFQ-, Verifizierungs-, Audit- oder Inspektionsleistung. Wir verwenden Ihre vertraulichen Informationen für keinen anderen Zweck.",
    "confidentiality.sections.3.h": "Wir verkaufen sie nicht",
    "confidentiality.sections.3.b":
      "Wir verkaufen, vermieten oder tauschen Ihre vertraulichen Informationen nicht. Wir geben sie nur dann an einen Lieferanten oder Auditpartner weiter, wenn dies zur Erbringung der angefragten Leistung erforderlich ist.",
    "confidentiality.sections.4.h": "Wenn diese Regeln verletzt werden",
    "confidentiality.sections.4.b":
      "Ein Verstoß wird intern bearbeitet: Die Arbeit wird gestoppt, der Zugriff entzogen und die betroffene Person oder der Partner muss mit arbeitsrechtlichen Konsequenzen oder der Beendigung der Zusammenarbeit rechnen. Wir verlangen nicht, dass Sie auf gesetzliche Ansprüche verzichten.",
    "compliance.relatedTitle": "Verwandte Richtlinien",
    "footer.confidentiality": "Vertraulichkeit",
    "footer.integrity": "Integrität",
  },

  fr: {
    "confidentiality.metaTitle": "Déclaration de confidentialité",
    "confidentiality.metaDesc":
      "Comment FactoryAuditB2B traite les spécifications produit, noms de fournisseurs, contenus de RFQ, coordonnées et rapports d'audit que vous nous transmettez.",
    "confidentiality.h1": "Déclaration de confidentialité",
    "confidentiality.updated": "Dernière mise à jour : 2026-09-30",
    "confidentiality.intro":
      "Cette déclaration précise ce que nous considérons comme des informations confidentielles, qui est tenu de les protéger et comment nous les utilisons. Elle couvre les demandes, les RFQ, la vérification et les travaux d'audit.",
    "confidentiality.sections.0.h": "Ce que nous considérons comme confidentiel",
    "confidentiality.sections.0.b":
      "Les spécifications produit, quantités commandées, noms de fournisseurs, contenus de RFQ, coordonnées et rapports d'audit que vous nous transmettez. Tout élément que vous marquez comme confidentiel, ou qu'un lecteur raisonnable comprendrait comme tel, reçoit le même traitement.",
    "confidentiality.sections.1.h": "Qui est tenu à la confidentialité",
    "confidentiality.sections.1.b":
      "Nos auditeurs, salariés, sous-traitants et partenaires de service doivent préserver la confidentialité de ces informations. L'accès est limité aux personnes qui en ont besoin pour réaliser le travail.",
    "confidentiality.sections.2.h": "L'usage que nous en faisons",
    "confidentiality.sections.2.b":
      "Uniquement pour fournir le service de RFQ, de vérification, d'audit ou d'inspection que vous avez demandé. Nous n'utilisons pas vos informations confidentielles à d'autres fins.",
    "confidentiality.sections.3.h": "Nous ne les vendons pas",
    "confidentiality.sections.3.b":
      "Nous ne vendons, ne louons ni n'échangeons vos informations confidentielles. Nous les transmettons à un fournisseur ou à un partenaire d'audit uniquement lorsque cela est nécessaire pour fournir le service demandé.",
    "confidentiality.sections.4.h": "En cas de manquement à ces règles",
    "confidentiality.sections.4.b":
      "Un manquement est traité en interne : le travail est arrêté, l'accès est retiré et la personne ou le partenaire concerné s'expose à une sanction disciplinaire ou à la rupture de la relation de travail. Nous ne vous demandons pas de renoncer aux recours que la loi vous accorde.",
    "compliance.relatedTitle": "Politiques associées",
    "footer.confidentiality": "Confidentialité",
    "footer.integrity": "Intégrité",
  },

  pt: {
    "confidentiality.metaTitle": "Declaração de Confidencialidade",
    "confidentiality.metaDesc":
      "Como tratamos as especificações de produto, os nomes de fornecedores, o conteúdo das RFQs, os contactos e os relatórios de auditoria.",
    "confidentiality.h1": "Declaração de Confidencialidade",
    "confidentiality.updated": "Última atualização: 2026-09-30",
    "confidentiality.intro":
      "Esta declaração explica o que tratamos como informação confidencial, quem está obrigado a protegê-la e como a utilizamos. Abrange pedidos, RFQs, verificação e trabalhos de auditoria.",
    "confidentiality.sections.0.h": "O que tratamos como confidencial",
    "confidentiality.sections.0.b":
      "As especificações de produto, quantidades encomendadas, nomes de fornecedores, conteúdo das RFQs, dados de contacto e relatórios de auditoria que nos entrega. O que marcar como confidencial, ou que um leitor razoável entenderia como confidencial, recebe o mesmo tratamento.",
    "confidentiality.sections.1.h": "Quem está obrigado",
    "confidentiality.sections.1.b":
      "Os nossos auditores, colaboradores, subcontratados e parceiros de serviço devem manter esta informação confidencial. O acesso é limitado a quem dele necessita para executar o trabalho.",
    "confidentiality.sections.2.h": "Para que a utilizamos",
    "confidentiality.sections.2.b":
      "Apenas para prestar o serviço de RFQ, verificação, auditoria ou inspeção que solicitou. Não utilizamos a sua informação confidencial para qualquer outro fim.",
    "confidentiality.sections.3.h": "Não a vendemos",
    "confidentiality.sections.3.b":
      "Não vendemos, alugamos nem trocamos a sua informação confidencial. Partilhamo-la com um fornecedor ou parceiro de auditoria apenas quando tal é necessário para prestar o serviço solicitado.",
    "confidentiality.sections.4.h": "Se estas regras forem violadas",
    "confidentiality.sections.4.b":
      "Uma violação é tratada internamente: o trabalho é interrompido, o acesso é retirado e a pessoa ou o parceiro envolvido fica sujeito a ação disciplinar ou ao fim da relação de trabalho. Não lhe pedimos que renuncie a qualquer meio de defesa que a lei lhe confira.",
    "compliance.relatedTitle": "Políticas relacionadas",
    "footer.confidentiality": "Confidencialidade",
    "footer.integrity": "Integridade",
  },

  ar: {
    "confidentiality.metaTitle": "بيان السرية",
    "confidentiality.metaDesc":
      "كيف تتعامل FactoryAuditB2B مع مواصفات المنتج وأسماء الموردين ومحتوى طلبات عروض الأسعار وبيانات الاتصال وتقارير التدقيق التي تشاركها معنا.",
    "confidentiality.h1": "بيان السرية",
    "confidentiality.updated": "آخر تحديث: 2026-09-30",
    "confidentiality.intro":
      "يوضح هذا البيان ما نعتبره معلومات سرية، ومن يلتزم بالحفاظ عليها، وكيف نستخدمها. ويشمل الاستفسارات وطلبات عروض الأسعار وأعمال التحقق والتدقيق.",
    "confidentiality.sections.0.h": "ما نعتبره سريًا",
    "confidentiality.sections.0.b":
      "مواصفات المنتج وكميات الطلب وأسماء الموردين ومحتوى طلبات عروض الأسعار وبيانات الاتصال وتقارير التدقيق التي تشاركها معنا. وأي معلومات تحددها كسرية، أو يفهم القارئ المعتاد أنها سرية، تُعامل بالطريقة نفسها.",
    "confidentiality.sections.1.h": "من يلتزم بالسرية",
    "confidentiality.sections.1.b":
      "يلتزم مدققونا وموظفونا والمتعاقدون معنا وشركاء الخدمة بالحفاظ على سرية هذه المعلومات. ويقتصر الوصول على من يحتاج إليها لإنجاز العمل.",
    "confidentiality.sections.2.h": "نطاق الاستخدام",
    "confidentiality.sections.2.b":
      "نستخدمها فقط لتقديم خدمة طلب عروض الأسعار أو التحقق أو التدقيق أو الفحص التي طلبتها. ولا نستخدم معلوماتك السرية لأي غرض آخر.",
    "confidentiality.sections.3.h": "لا نبيع هذه المعلومات",
    "confidentiality.sections.3.b":
      "لا نبيع معلوماتك السرية ولا نؤجرها ولا نقايضها. ولا نشاركها مع مورد أو شريك تدقيق إلا عند الحاجة لتقديم الخدمة التي طلبتها.",
    "confidentiality.sections.4.h": "عند مخالفة هذه القواعد",
    "confidentiality.sections.4.b":
      "تُعالج أي مخالفة داخليًا: يتوقف العمل، ويُسحب الوصول، ويواجه الشخص أو الشريك المعني إجراءً تأديبيًا أو إنهاء علاقة العمل. ولا نطلب منك التنازل عن أي حق يكفله لك القانون.",
    "compliance.relatedTitle": "السياسات ذات الصلة",
    "footer.confidentiality": "السرية",
    "footer.integrity": "النزاهة",
  },
};

// ============================================================================
// 阶段 2 —— /integrity 廉洁与商业行为准则
//
// 写作边界（用户明确要求）：
//   · 「不卖证书 / 不按审核结果收费」是首页既有声明的复述，非新增承诺。
//   · 利益冲突申报机制**引用仓库里已公开列出的真实文档名**（supplierNetwork.docs.3/4/5），
//     不编造新的内部流程名称。
//   · 违规后果只写到「调离项目、收回权限、重新评估合作关系、最重终止合作」，
//     不编造罚款金额、不编造法律条文。
// ============================================================================
const TRANS_INTEGRITY = {
  en: {
    "integrity.metaTitle": "Integrity & Business Conduct Code",
    "integrity.metaDesc":
      "The rules our auditors, staff and partners follow: no inducements, no conflicts of interest, no certificates for sale, and how to report a concern.",
    "integrity.h1": "Integrity & Business Conduct Code",
    "integrity.updated": "Last updated: 2026-09-30",
    "integrity.intro":
      "These rules apply to every auditor, employee, contractor and partner who works on a FactoryAuditB2B project. They exist because a verification result is only worth something if the person who produced it had nothing to gain from it.",
    "integrity.sections.0.h": "No inducements between auditors and factories",
    "integrity.sections.0.b":
      "An auditor must not ask for or accept any payment, kickback, gift, loan, meal or favour from a factory, or from anyone acting for it. Where a courtesy gift cannot be refused without causing offence, it is declared to us in writing.",
    "integrity.sections.1.h": "No undisclosed relationships",
    "integrity.sections.1.b":
      "An auditor must not work on a factory where they have a family, business or investment relationship, or any other personal interest. Any such relationship must be declared before the assignment starts.",
    "integrity.sections.2.h": "Pay is never tied to the result",
    "integrity.sections.2.b":
      "Nobody at FactoryAuditB2B is paid, rewarded or penalised according to the score, level or outcome a verification produces. Findings are not for sale in either direction.",
    "integrity.sections.3.h": "We do not sell certificates",
    "integrity.sections.3.b":
      "FactoryAuditB2B does not sell, issue or broker certificates, and does not charge by audit result. We verify, and we train.",
    "integrity.sections.4.h": "Conflict of interest declaration",
    "integrity.sections.4.b":
      "Auditors, staff and partners complete a conflict of interest declaration before each project and update it whenever circumstances change.",
    "integrity.sections.5.h": "How we handle a report",
    "integrity.sections.5.b":
      "Every report is logged, checked for conflicts, investigated, and answered to the person who raised it. If the concern is valid we act on it; if it is not, we explain why.",
    "integrity.sections.6.h": "Consequences for an auditor who breaks these rules",
    "integrity.sections.6.b":
      "The auditor is removed from the project immediately, their access is withdrawn, and the working relationship is reviewed — up to and including termination.",
    "integrity.docsTitle": "The commitments behind these rules",
    "integrity.docsLead":
      "These are the templates we use on every project. They are listed publicly so you can ask for a copy.",
    "integrity.reportTitle": "Reporting a concern",
    "integrity.reportBody":
      "If you believe an auditor, employee or partner has broken these rules, tell us. Reports reach our compliance mailbox, are handled confidentially, and are reviewed by someone with no role in the project concerned:",
  },

  zh: {
    "integrity.metaTitle": "廉洁与商业行为准则",
    "integrity.metaDesc":
      "我们的审核员、员工与合作方须遵守的规则：禁止利益往来、禁止利益冲突、不卖证书，以及举报渠道。",
    "integrity.h1": "廉洁与商业行为准则",
    "integrity.updated": "最后更新：2026-09-30",
    "integrity.intro":
      "本准则适用于参与 FactoryAuditB2B 项目的每一名审核员、员工、外包人员与合作方。制定它的原因很简单：只有出具结论的人在其中无可图之利，核验结果才有价值。",
    "integrity.sections.0.h": "审核员与工厂之间禁止任何利益往来",
    "integrity.sections.0.b":
      "审核员不得向工厂或代表工厂的任何人索取或收受任何款项、回扣、礼品、借款、宴请或好处。若因礼节无法当场拒收，须以书面形式向我们申报。",
    "integrity.sections.1.h": "禁止未披露的关联关系",
    "integrity.sections.1.b":
      "审核员不得承接与之存在亲属、商业、投资关系或其他个人利益的工厂的审核工作。此类关系必须在任务开始前申报。",
    "integrity.sections.2.h": "报酬绝不与审核结果挂钩",
    "integrity.sections.2.b":
      "FactoryAuditB2B 任何人员的报酬、奖励或处罚都不与核验产出的分数、等级或结论挂钩。结论不向任何一方出售。",
    "integrity.sections.3.h": "我们不卖证书",
    "integrity.sections.3.b":
      "FactoryAuditB2B 不出售、不签发、也不居间介绍证书，不按审核结果收费。我们做的是核验与培训。",
    "integrity.sections.4.h": "利益冲突申报",
    "integrity.sections.4.b":
      "审核员、员工与合作方在每个项目开始前须完成利益冲突申报，并在情况发生变化时及时更新。",
    "integrity.sections.5.h": "收到举报后的处理流程",
    "integrity.sections.5.b":
      "每一份举报都会登记、排查利益冲突、开展核查，并向举报人反馈结果。举报成立我们依规处理；不成立我们会说明原因。",
    "integrity.sections.6.h": "违规审核员的处理措施",
    "integrity.sections.6.b":
      "立即将其调离项目、收回访问权限，并重新评估合作关系，最重可终止合作。",
    "integrity.docsTitle": "支撑本准则的承诺文件",
    "integrity.docsLead": "这些是我们在每个项目中使用的模板。在此公开列出，便于你索取。",
    "integrity.reportTitle": "举报渠道",
    "integrity.reportBody":
      "如果你认为审核员、员工或合作方违反了本准则，请告知我们。举报将发送至我们的合规邮箱，按保密方式处理，并由与该项目无关的人员核查：",
  },

  "zh-TW": {
    "integrity.metaTitle": "廉潔與商業行為準則",
    "integrity.metaDesc":
      "我們的稽核員、員工與夥伴須遵守的規則：禁止利益往來、禁止利益衝突、不賣證書，以及檢舉管道。",
    "integrity.h1": "廉潔與商業行為準則",
    "integrity.updated": "最後更新：2026-09-30",
    "integrity.intro":
      "本準則適用於參與 FactoryAuditB2B 專案的每一名稽核員、員工、外包人員與夥伴。制定它的原因很簡單：只有出具結論的人在其中無可圖之利，驗證結果才有價值。",
    "integrity.sections.0.h": "稽核員與工廠之間禁止任何利益往來",
    "integrity.sections.0.b":
      "稽核員不得向工廠或代表工廠的任何人索取或收受任何款項、回扣、餽贈、借貸、招待或好處。若因禮節無法當場拒收，須以書面向我們申報。",
    "integrity.sections.1.h": "禁止未揭露的關聯關係",
    "integrity.sections.1.b":
      "稽核員不得承接與其有親屬、商業、投資關係或其他個人利益的工廠的稽核工作。此類關係必須在任務開始前申報。",
    "integrity.sections.2.h": "報酬絕不與稽核結果掛鉤",
    "integrity.sections.2.b":
      "FactoryAuditB2B 任何人員的報酬、獎勵或處罰都不與驗證產出的分數、等級或結論掛鉤。結論不向任何一方出售。",
    "integrity.sections.3.h": "我們不賣證書",
    "integrity.sections.3.b":
      "FactoryAuditB2B 不出售、不簽發、也不居間介紹證書，不按稽核結果收費。我們做的是驗證與培訓。",
    "integrity.sections.4.h": "利益衝突申報",
    "integrity.sections.4.b":
      "稽核員、員工與夥伴在每個專案開始前須完成利益衝突申報，並在情況變更時及時更新。",
    "integrity.sections.5.h": "收到檢舉後的處理流程",
    "integrity.sections.5.b":
      "每一份檢舉都會登記、排查利益衝突、進行查核，並向檢舉人回覆結果。檢舉成立我們依規處理；不成立我們會說明原因。",
    "integrity.sections.6.h": "違規稽核員的處理措施",
    "integrity.sections.6.b":
      "立即將其調離專案、收回存取權限，並重新評估合作關係，最重可終止合作。",
    "integrity.docsTitle": "支撐本準則的承諾文件",
    "integrity.docsLead": "這些是我們在每個專案中使用的範本。在此公開列出，方便你索取。",
    "integrity.reportTitle": "檢舉管道",
    "integrity.reportBody":
      "如果你認為稽核員、員工或夥伴違反了本準則，請告知我們。檢舉將寄至我們的合規信箱，以保密方式處理，並由與該專案無關的人員查核：",
  },

  ja: {
    "integrity.metaTitle": "誠実性と業務行動規範",
    "integrity.metaDesc":
      "当社の監査員、従業員、パートナーが守る規則です。利益供与の禁止、利益相反の禁止、証明書の販売禁止、そして通報窓口について定めます。",
    "integrity.h1": "誠実性と業務行動規範",
    "integrity.updated": "最終更新：2026-09-30",
    "integrity.intro":
      "本規範は、FactoryAuditB2B のプロジェクトに携わるすべての監査員、従業員、業務委託先、パートナーに適用されます。結論を出す者に何の利得もない場合にのみ、検証結果に価値が生まれるからです。",
    "integrity.sections.0.h": "監査員と工場の間のいかなる利益供与も禁止",
    "integrity.sections.0.b":
      "監査員は、工場または工場の代理人から、金銭、キックバック、贈答品、借入、接待その他の便宜を求めてはならず、受け取ってもなりません。儀礼上どうしても断れない場合は、書面で当社に申告します。",
    "integrity.sections.1.h": "未申告の関係の禁止",
    "integrity.sections.1.b":
      "監査員は、親族・取引・投資その他の個人的利益を有する工場の監査業務を担当してはなりません。こうした関係は業務開始前に申告しなければなりません。",
    "integrity.sections.2.h": "報酬を監査結果に連動させません",
    "integrity.sections.2.b":
      "FactoryAuditB2B のいかなる者も、検証が生み出すスコア、レベル、結論によって報酬・報奨・不利益を受けることはありません。結論はいずれの当事者にも販売しません。",
    "integrity.sections.3.h": "証明書は販売しません",
    "integrity.sections.3.b":
      "FactoryAuditB2B は証明書の販売、発行、仲介を行わず、監査結果に応じた課金も行いません。当社が行うのは検証と研修です。",
    "integrity.sections.4.h": "利益相反の申告",
    "integrity.sections.4.b":
      "監査員、従業員、パートナーは各プロジェクトの開始前に利益相反申告を完了し、状況が変わった場合は速やかに更新します。",
    "integrity.sections.5.h": "通報を受けた後の対応",
    "integrity.sections.5.b":
      "すべての通報は記録し、利益相反の有無を確認し、調査したうえで通報者に結果を回答します。通報が妥当であれば是正し、そうでない場合は理由を説明します。",
    "integrity.sections.6.h": "本規範に違反した監査員の措置",
    "integrity.sections.6.b":
      "直ちにプロジェクトから外し、アクセス権を回収し、取引関係を再評価します。最悪の場合は取引を終了します。",
    "integrity.docsTitle": "本規範を支えるコミットメント文書",
    "integrity.docsLead":
      "これらは当社がすべてのプロジェクトで使用するテンプレートです。ご請求いただけるよう公開しています。",
    "integrity.reportTitle": "通報窓口",
    "integrity.reportBody":
      "監査員、従業員またはパートナーが本規範に違反したと思われる場合はお知らせください。通報はコンプライアンス窓口に送られ、機密として扱い、当該プロジェクトに無関係な担当者が確認します：",
  },

  es: {
    "integrity.metaTitle": "Código de integridad y conducta",
    "integrity.metaDesc":
      "Las normas que siguen nuestros auditores, personal y socios: sin contraprestaciones, sin conflictos de interés, sin certificados en venta, y cómo denunciar.",
    "integrity.h1": "Código de integridad y conducta empresarial",
    "integrity.updated": "Última actualización: 2026-09-30",
    "integrity.intro":
      "Estas reglas se aplican a todo auditor, empleado, colaborador externo y socio que trabaje en un proyecto de FactoryAuditB2B. Existen porque un resultado de verificación solo vale algo si quien lo emitió no tenía nada que ganar con él.",
    "integrity.sections.0.h": "Sin contraprestaciones entre auditores y fábricas",
    "integrity.sections.0.b":
      "Un auditor no debe solicitar ni aceptar pagos, comisiones, regalos, préstamos, comidas o favores de una fábrica ni de quien actúe por ella. Cuando un obsequio de cortesía no pueda rechazarse sin ofender, se declara por escrito.",
    "integrity.sections.1.h": "Sin relaciones no declaradas",
    "integrity.sections.1.b":
      "Un auditor no debe trabajar en una fábrica con la que tenga una relación familiar, comercial o de inversión, ni ningún otro interés personal. Toda relación de este tipo debe declararse antes de empezar el encargo.",
    "integrity.sections.2.h": "La retribución nunca depende del resultado",
    "integrity.sections.2.b":
      "Nadie en FactoryAuditB2B recibe pagos, incentivos o penalizaciones en función de la puntuación, el nivel o el resultado de una verificación. Los hallazgos no están en venta en ningún sentido.",
    "integrity.sections.3.h": "No vendemos certificados",
    "integrity.sections.3.b":
      "FactoryAuditB2B no vende ni emite certificados ni actúa como intermediario en su venta, y no cobra en función del resultado de la auditoría. Verificamos y formamos.",
    "integrity.sections.4.h": "Declaración de conflicto de interés",
    "integrity.sections.4.b":
      "Los auditores, el personal y los socios cumplimentan una declaración de conflicto de interés antes de cada proyecto y la actualizan cuando cambian las circunstancias.",
    "integrity.sections.5.h": "Cómo tratamos una denuncia",
    "integrity.sections.5.b":
      "Toda denuncia se registra, se comprueba si hay conflicto, se investiga y se responde a quien la presentó. Si el motivo es válido, actuamos; si no lo es, explicamos por qué.",
    "integrity.sections.6.h": "Consecuencias para un auditor que incumpla estas reglas",
    "integrity.sections.6.b":
      "El auditor se aparta del proyecto de inmediato, se le retira el acceso y se revisa la relación de trabajo, hasta su posible terminación.",
    "integrity.docsTitle": "Los compromisos que sostienen estas reglas",
    "integrity.docsLead":
      "Estas son las plantillas que usamos en cada proyecto. Las publicamos para que pueda solicitarlas.",
    "integrity.reportTitle": "Cómo presentar una denuncia",
    "integrity.reportBody":
      "Si cree que un auditor, empleado o socio ha incumplido estas reglas, díganoslo. Las denuncias llegan a nuestro buzón de cumplimiento, se tratan de forma confidencial y las revisa alguien ajeno al proyecto:",
  },

  de: {
    "integrity.metaTitle": "Integritäts- und Verhaltenskodex",
    "integrity.metaDesc":
      "Die Regeln für unsere Auditoren, Mitarbeitenden und Partner: keine Zuwendungen, keine Interessenkonflikte, keine Zertifikate zum Verkauf, und wie Sie melden.",
    "integrity.h1": "Integritäts- und Verhaltenskodex",
    "integrity.updated": "Zuletzt aktualisiert: 2026-09-30",
    "integrity.intro":
      "Diese Regeln gelten für jeden Auditor, jede Mitarbeiterin, jeden Auftragnehmer und jeden Partner, der an einem Projekt von FactoryAuditB2B mitwirkt. Sie bestehen, weil ein Verifizierungsergebnis nur dann etwas wert ist, wenn die Person, die es erstellt hat, nichts davon hatte.",
    "integrity.sections.0.h": "Keine Zuwendungen zwischen Auditoren und Fabriken",
    "integrity.sections.0.b":
      "Ein Auditor darf von einer Fabrik oder von Personen, die für sie handeln, keine Zahlungen, Kickbacks, Geschenke, Darlehen, Bewirtungen oder Vorteile verlangen oder annehmen. Lässt sich ein Höflichkeitsgeschenk nicht ohne Kränkung ablehnen, wird es uns schriftlich gemeldet.",
    "integrity.sections.1.h": "Keine verschwiegenen Beziehungen",
    "integrity.sections.1.b":
      "Ein Auditor darf keine Fabrik prüfen, zu der eine familiäre, geschäftliche oder finanzielle Beziehung oder ein sonstiges persönliches Interesse besteht. Solche Beziehungen sind vor Auftragsbeginn offenzulegen.",
    "integrity.sections.2.h": "Vergütung ist nie an das Ergebnis gekoppelt",
    "integrity.sections.2.b":
      "Niemand bei FactoryAuditB2B wird nach Punkten, Stufe oder Ergebnis einer Verifizierung bezahlt, belohnt oder benachteiligt. Feststellungen sind in keiner Richtung käuflich.",
    "integrity.sections.3.h": "Wir verkaufen keine Zertifikate",
    "integrity.sections.3.b":
      "FactoryAuditB2B verkauft, erteilt und vermittelt keine Zertifikate und rechnet nicht nach Prüfergebnis ab. Wir verifizieren und schulen.",
    "integrity.sections.4.h": "Offenlegung von Interessenkonflikten",
    "integrity.sections.4.b":
      "Auditoren, Mitarbeitende und Partner füllen vor jedem Projekt eine Erklärung zu Interessenkonflikten aus und aktualisieren sie, wenn sich die Umstände ändern.",
    "integrity.sections.5.h": "Wie wir eine Meldung bearbeiten",
    "integrity.sections.5.b":
      "Jede Meldung wird erfasst, auf Interessenkonflikte geprüft, untersucht und der meldenden Person beantwortet. Ist der Hinweis berechtigt, handeln wir; wenn nicht, erklären wir warum.",
    "integrity.sections.6.h": "Folgen für Auditoren, die diese Regeln verletzen",
    "integrity.sections.6.b":
      "Der Auditor wird sofort vom Projekt abgezogen, sein Zugriff entzogen und die Zusammenarbeit überprüft – bis hin zu deren Beendigung.",
    "integrity.docsTitle": "Die Zusagen hinter diesen Regeln",
    "integrity.docsLead":
      "Dies sind die Vorlagen, die wir in jedem Projekt verwenden. Sie sind öffentlich gelistet, damit Sie eine Kopie anfordern können.",
    "integrity.reportTitle": "Eine Meldung abgeben",
    "integrity.reportBody":
      "Wenn Sie glauben, dass ein Auditor, eine Mitarbeiterin oder ein Partner gegen diese Regeln verstoßen hat, sagen Sie es uns. Meldungen erreichen unser Compliance-Postfach, werden vertraulich behandelt und von einer am Projekt unbeteiligten Person geprüft:",
  },

  fr: {
    "integrity.metaTitle": "Code d'intégrité et de conduite",
    "integrity.metaDesc":
      "Les règles que suivent nos auditeurs, notre personnel et nos partenaires : aucune contrepartie, aucun conflit d'intérêts, comment signaler.",
    "integrity.h1": "Code d'intégrité et de conduite professionnelle",
    "integrity.updated": "Dernière mise à jour : 2026-09-30",
    "integrity.intro":
      "Ces règles s'appliquent à tout auditeur, salarié, sous-traitant et partenaire travaillant sur un projet FactoryAuditB2B. Elles existent parce qu'un résultat de vérification n'a de valeur que si son auteur n'avait rien à y gagner.",
    "integrity.sections.0.h": "Aucune contrepartie entre auditeurs et usines",
    "integrity.sections.0.b":
      "Un auditeur ne doit ni solliciter ni accepter un paiement, une commission, un cadeau, un prêt, une invitation ou un avantage de la part d'une usine ou de toute personne agissant pour elle. Si un cadeau de courtoisie ne peut être refusé sans vexer, il nous est déclaré par écrit.",
    "integrity.sections.1.h": "Aucune relation non déclarée",
    "integrity.sections.1.b":
      "Un auditeur ne doit pas travailler sur une usine avec laquelle il a une relation familiale, commerciale ou financière, ou tout autre intérêt personnel. Ces relations doivent être déclarées avant le début de la mission.",
    "integrity.sections.2.h": "La rémunération n'est jamais liée au résultat",
    "integrity.sections.2.b":
      "Personne chez FactoryAuditB2B n'est payé, récompensé ou pénalisé selon la note, le niveau ou le résultat d'une vérification. Les constats ne sont pas à vendre, dans un sens comme dans l'autre.",
    "integrity.sections.3.h": "Nous ne vendons pas de certificats",
    "integrity.sections.3.b":
      "FactoryAuditB2B ne vend ni ne délivre de certificats et n'agit pas comme intermédiaire pour leur vente, et ne facture pas en fonction du résultat d'audit. Nous vérifions et nous formons.",
    "integrity.sections.4.h": "Déclaration de conflit d'intérêts",
    "integrity.sections.4.b":
      "Les auditeurs, le personnel et les partenaires remplissent une déclaration de conflit d'intérêts avant chaque projet et la mettent à jour dès que la situation change.",
    "integrity.sections.5.h": "Traitement d'un signalement",
    "integrity.sections.5.b":
      "Chaque signalement est enregistré, examiné au regard des conflits d'intérêts, instruit, puis une réponse est apportée à son auteur. Si le signalement est fondé, nous agissons ; sinon, nous expliquons pourquoi.",
    "integrity.sections.6.h": "Conséquences pour un auditeur qui enfreint ces règles",
    "integrity.sections.6.b":
      "L'auditeur est immédiatement retiré du projet, son accès est retiré et la relation de travail est réexaminée, jusqu'à sa rupture.",
    "integrity.docsTitle": "Les engagements qui sous-tendent ces règles",
    "integrity.docsLead":
      "Voici les modèles que nous utilisons sur chaque projet. Ils sont publiés pour que vous puissiez en demander une copie.",
    "integrity.reportTitle": "Signaler un problème",
    "integrity.reportBody":
      "Si vous pensez qu'un auditeur, un salarié ou un partenaire a enfreint ces règles, dites-le nous. Les signalements arrivent dans notre boîte de conformité, sont traités de façon confidentielle et sont examinés par une personne extérieure au projet concerné :",
  },

  pt: {
    "integrity.metaTitle": "Código de Integridade e Conduta",
    "integrity.metaDesc":
      "As regras que seguem os nossos auditores, colaboradores e parceiros: sem contrapartidas, sem conflitos de interesses, e como denunciar.",
    "integrity.h1": "Código de Integridade e Conduta Empresarial",
    "integrity.updated": "Última atualização: 2026-09-30",
    "integrity.intro":
      "Estas regras aplicam-se a todos os auditores, colaboradores, subcontratados e parceiros que trabalhem num projeto da FactoryAuditB2B. Existem porque um resultado de verificação só vale algo se quem o produziu não tiver nada a ganhar com ele.",
    "integrity.sections.0.h": "Sem contrapartidas entre auditores e fábricas",
    "integrity.sections.0.b":
      "Um auditor não deve pedir nem aceitar pagamentos, comissões, presentes, empréstimos, refeições ou favores de uma fábrica ou de quem atue por ela. Quando um presente de cortesia não puder ser recusado sem ofensa, é declarado por escrito.",
    "integrity.sections.1.h": "Sem relações não declaradas",
    "integrity.sections.1.b":
      "Um auditor não deve trabalhar numa fábrica com a qual tenha relação familiar, comercial ou de investimento, ou qualquer outro interesse pessoal. Essas relações devem ser declaradas antes do início do trabalho.",
    "integrity.sections.2.h": "A remuneração nunca depende do resultado",
    "integrity.sections.2.b":
      "Ninguém na FactoryAuditB2B é pago, premiado ou penalizado em função da pontuação, do nível ou do resultado de uma verificação. As conclusões não estão à venda em nenhum sentido.",
    "integrity.sections.3.h": "Não vendemos certificados",
    "integrity.sections.3.b":
      "A FactoryAuditB2B não vende, não emite nem intermedeia certificados, e não cobra em função do resultado da auditoria. Verificamos e formamos.",
    "integrity.sections.4.h": "Declaração de conflito de interesses",
    "integrity.sections.4.b":
      "Auditores, colaboradores e parceiros preenchem uma declaração de conflito de interesses antes de cada projeto e atualizam-na sempre que as circunstâncias mudarem.",
    "integrity.sections.5.h": "Como tratamos uma denúncia",
    "integrity.sections.5.b":
      "Todas as denúncias são registadas, verificadas quanto a conflitos, investigadas e respondidas a quem as apresentou. Se o motivo for válido, agimos; se não for, explicamos porquê.",
    "integrity.sections.6.h": "Consequências para um auditor que viole estas regras",
    "integrity.sections.6.b":
      "O auditor é retirado imediatamente do projeto, o seu acesso é revogado e a relação de trabalho é reavaliada, podendo ser terminada.",
    "integrity.docsTitle": "Os compromissos por trás destas regras",
    "integrity.docsLead":
      "Estes são os modelos que usamos em cada projeto. Estão listados publicamente para que possa pedir uma cópia.",
    "integrity.reportTitle": "Apresentar uma denúncia",
    "integrity.reportBody":
      "Se considerar que um auditor, colaborador ou parceiro violou estas regras, diga-nos. As denúncias chegam à nossa caixa de conformidade, são tratadas de forma confidencial e revistas por alguém alheio ao projeto:",
  },

  ar: {
    "integrity.metaTitle": "مدونة النزاهة والسلوك المهني",
    "integrity.metaDesc":
      "القواعد التي يلتزم بها مدققونا وموظفونا وشركاؤنا: حظر المقابل، وحظر تضارب المصالح، وعدم بيع الشهادات، وكيفية الإبلاغ.",
    "integrity.h1": "مدونة النزاهة والسلوك المهني",
    "integrity.updated": "آخر تحديث: 2026-09-30",
    "integrity.intro":
      "تنطبق هذه القواعد على كل مدقق وموظف ومتعاقد وشريك يعمل في مشروع لدى FactoryAuditB2B. وهي قائمة لأن نتيجة التحقق لا قيمة لها إلا إذا كان من أصدرها لا يجني منها شيئًا.",
    "integrity.sections.0.h": "لا مقابل بين المدققين والمصانع",
    "integrity.sections.0.b":
      "لا يجوز للمدقق أن يطلب أو يقبل أي مبلغ أو عمولة أو هدية أو قرض أو ضيافة أو منفعة من مصنع أو ممن يعمل لحسابه. وإذا تعذّر رد هدية مجاملة دون إحراج، فيجب الإفصاح عنها لنا كتابيًا.",
    "integrity.sections.1.h": "حظر العلاقات غير المفصح عنها",
    "integrity.sections.1.b":
      "لا يجوز للمدقق العمل على مصنع تربطه به علاقة عائلية أو تجارية أو استثمارية أو أي مصلحة شخصية أخرى. ويجب الإفصاح عن هذه العلاقات قبل بدء المهمة.",
    "integrity.sections.2.h": "الأجر لا يرتبط بالنتيجة أبدًا",
    "integrity.sections.2.b":
      "لا يتلقى أي شخص في FactoryAuditB2B أجرًا أو مكافأة أو جزاءً بناءً على الدرجة أو المستوى أو النتيجة التي يخرج بها التحقق. والنتائج ليست للبيع في أي اتجاه.",
    "integrity.sections.3.h": "نحن لا نبيع الشهادات",
    "integrity.sections.3.b":
      "لا تبيع FactoryAuditB2B الشهادات ولا تصدرها ولا تتوسط فيها، ولا تتقاضى أجرًا بحسب نتيجة التدقيق. نحن نتحقق وندرّب.",
    "integrity.sections.4.h": "الإفصاح عن تضارب المصالح",
    "integrity.sections.4.b":
      "يُكمل المدققون والموظفون والشركاء إقرار تضارب المصالح قبل كل مشروع، ويحدّثونه كلما تغيّرت الظروف.",
    "integrity.sections.5.h": "كيف نتعامل مع الإبلاغ",
    "integrity.sections.5.b":
      "يُسجَّل كل إبلاغ، ويُفحص من حيث تضارب المصالح، ويُحقَّق فيه، ويُرد على مقدّمه. فإن كان صحيحًا اتخذنا الإجراء، وإن لم يكن شرحنا السبب.",
    "integrity.sections.6.h": "النتائج المترتبة على مخالفة المدقق لهذه القواعد",
    "integrity.sections.6.b":
      "يُستبعد المدقق من المشروع فورًا، ويُسحب وصوله، وتُعاد مراجعة علاقة العمل، وقد تصل إلى إنهائها.",
    "integrity.docsTitle": "الالتزامات التي تقوم عليها هذه القواعد",
    "integrity.docsLead":
      "هذه هي النماذج التي نستخدمها في كل مشروع. وهي منشورة هنا لتطلب نسخة منها.",
    "integrity.reportTitle": "الإبلاغ عن مخالفة",
    "integrity.reportBody":
      "إذا كنت تعتقد أن مدققًا أو موظفًا أو شريكًا خالف هذه القواعد، فأخبرنا. تصل الإبلاغات إلى بريد الامتثال لدينا، وتُعالج بسرية، ويراجعها شخص لا علاقة له بالمشروع:",
  },
};

// 阶段 2 文案并入总表（阶段 1 的键不受影响）
for (const loc of LOCALES) Object.assign(TRANS[loc], TRANS_INTEGRITY[loc]);

// ============================================================================
// 阶段 3 —— /trust 追加的 Trust Center 区块（挂在既有 `trust` 命名空间下，tc* 前缀）
//
// 命名理由：该区块**住在 /trust 页内**，故不另开命名空间；`tc` 前缀避免与既有
// 94 个 trust 键（verify* / method* / levels* / principles*…）冲突。
// 卡片标题复用 `legal.privacyTitle` / `legal.termsTitle`（字面完全等价，零漂移）。
//
// 安全措施**只写仓库里真实落地的四项**（对应实现位置写在页面注释里）：
//   传输加密 / 服务端按会员等级字段裁剪 / 数据库默认拒绝公开访问 / 后台审计日志。
// 禁写 ISO 27001、渗透测试、加密算法细节、具体数据处理方名称。
// ============================================================================
const TRANS_TRUST = {
  en: {
    "trust.tcTitle": "Trust Center",
    "trust.tcLead":
      "The policies, commitments and controls behind our verification work, in one place.",
    "trust.tcCardConfTitle": "Confidentiality Statement",
    "trust.tcCardConfBody":
      "What we treat as confidential, who is bound by it, and what happens if those rules are broken.",
    "trust.tcCardIntegrityTitle": "Integrity & Business Conduct Code",
    "trust.tcCardIntegrityBody":
      "No inducements, no conflicts of interest, no certificates for sale, and how to report a concern.",
    "trust.tcCardPrivacyBody":
      "What data we collect, how we use it, and how to ask for access, correction or deletion.",
    "trust.tcCardTermsBody":
      "The rules for using the platform, and what we do and do not guarantee about suppliers.",
    "trust.tcSecurityTitle": "Security measures",
    "trust.tcSecurityBody":
      "What is in place today. We list only measures that are live, not ones we plan to build.",
    "trust.tcSecurityItems.0":
      "Encrypted transport — every page and API call is served over HTTPS.",
    "trust.tcSecurityItems.1":
      "Access control — supplier data is filtered per membership tier on the server before it is returned.",
    "trust.tcSecurityItems.2":
      "Database permissions — public access to our database is denied by default, and sensitive tables are readable only by server-side roles.",
    "trust.tcSecurityItems.3":
      "Activity logging — administrative actions are written to an audit log.",
    "trust.tcDataTitle": "How data moves through a project",
    "trust.tcDataBody":
      "To deliver a verification, audit or inspection we share the relevant details with the supplier and the third-party audit firm involved. We do not sell personal data.",
    "trust.tcReportTitle": "Reporting a concern",
    "trust.tcReportBody":
      "Write to our compliance mailbox about any integrity, confidentiality or data concern:",
  },

  zh: {
    "trust.tcTitle": "信任中心",
    "trust.tcLead": "支撑我们核验工作的政策、承诺与控制措施，集中在一处。",
    "trust.tcCardConfTitle": "保密声明",
    "trust.tcCardConfBody": "我们把什么视为保密信息、谁承担保密义务，以及违反后的处理。",
    "trust.tcCardIntegrityTitle": "廉洁与商业行为准则",
    "trust.tcCardIntegrityBody": "禁止利益往来、禁止利益冲突、不卖证书，以及举报渠道。",
    "trust.tcCardPrivacyBody": "我们收集哪些数据、如何使用，以及如何申请查阅、更正或删除。",
    "trust.tcCardTermsBody": "使用本平台的规则，以及我们对供应商做出与不做出哪些保证。",
    "trust.tcSecurityTitle": "安全措施",
    "trust.tcSecurityBody": "以下是我们当前已落实的措施。只列已上线，不列计划中。",
    "trust.tcSecurityItems.0": "传输加密 —— 所有页面与接口均通过 HTTPS 提供。",
    "trust.tcSecurityItems.1": "访问权限控制 —— 供应商数据在服务端按会员等级裁剪后再返回。",
    "trust.tcSecurityItems.2": "数据库权限 —— 数据库默认拒绝公开访问，敏感数据表仅服务端角色可读。",
    "trust.tcSecurityItems.3": "操作日志审计 —— 后台管理操作均记入审计日志。",
    "trust.tcDataTitle": "数据在项目中如何流转",
    "trust.tcDataBody":
      "为交付核验、审核或验货服务，我们会将必要信息提供给相关供应商与第三方审核机构。我们不出售个人数据。",
    "trust.tcReportTitle": "举报渠道",
    "trust.tcReportBody": "如涉及廉洁、保密或数据问题，请写信至我们的合规邮箱：",
  },

  "zh-TW": {
    "trust.tcTitle": "信任中心",
    "trust.tcLead": "支撐我們驗證工作的政策、承諾與控制措施，集中在一處。",
    "trust.tcCardConfTitle": "保密聲明",
    "trust.tcCardConfBody": "我們把什麼視為保密資訊、誰負有保密義務，以及違反後的處理。",
    "trust.tcCardIntegrityTitle": "廉潔與商業行為準則",
    "trust.tcCardIntegrityBody": "禁止利益往來、禁止利益衝突、不賣證書，以及檢舉管道。",
    "trust.tcCardPrivacyBody": "我們收集哪些資料、如何使用，以及如何申請查閱、更正或刪除。",
    "trust.tcCardTermsBody": "使用本平台的規則，以及我們對供應商做出與不做出哪些保證。",
    "trust.tcSecurityTitle": "安全措施",
    "trust.tcSecurityBody": "以下是我們目前已落實的措施。只列已上線，不列計畫中。",
    "trust.tcSecurityItems.0": "傳輸加密 —— 所有頁面與 API 均透過 HTTPS 提供。",
    "trust.tcSecurityItems.1": "存取權限控制 —— 供應商資料在伺服器端依會員等級裁剪後才回傳。",
    "trust.tcSecurityItems.2": "資料庫權限 —— 資料庫預設拒絕公開存取，敏感資料表僅伺服器端角色可讀。",
    "trust.tcSecurityItems.3": "操作日誌稽核 —— 後台管理操作均寫入稽核日誌。",
    "trust.tcDataTitle": "資料在專案中如何流動",
    "trust.tcDataBody":
      "為交付驗證、稽核或驗貨服務，我們會將必要資訊提供給相關供應商與第三方稽核機構。我們不出售個人資料。",
    "trust.tcReportTitle": "檢舉管道",
    "trust.tcReportBody": "如涉及廉潔、保密或資料問題，請來信至我們的合規信箱：",
  },

  ja: {
    "trust.tcTitle": "トラストセンター",
    "trust.tcLead":
      "当社の検証業務を支えるポリシー、コミットメント、管理措置を一か所にまとめました。",
    "trust.tcCardConfTitle": "機密保持に関する声明",
    "trust.tcCardConfBody":
      "何を機密として扱い、誰が義務を負い、破られた場合にどう対応するか。",
    "trust.tcCardIntegrityTitle": "誠実性と業務行動規範",
    "trust.tcCardIntegrityBody":
      "利益供与の禁止、利益相反の禁止、証明書の販売禁止、そして通報窓口。",
    "trust.tcCardPrivacyBody":
      "収集するデータ、その利用目的、閲覧・訂正・削除のご請求方法。",
    "trust.tcCardTermsBody":
      "本プラットフォームの利用規則と、サプライヤーについて保証する事項・しない事項。",
    "trust.tcSecurityTitle": "セキュリティ対策",
    "trust.tcSecurityBody":
      "現在実施している対策のみを記載します。計画中のものは含めません。",
    "trust.tcSecurityItems.0": "通信の暗号化 —— すべてのページと API は HTTPS で提供されます。",
    "trust.tcSecurityItems.1":
      "アクセス制御 —— サプライヤー情報はサーバー側で会員区分ごとに絞り込んでから返します。",
    "trust.tcSecurityItems.2":
      "データベース権限 —— データベースへの公開アクセスは既定で拒否し、機微なテーブルはサーバー側の権限でのみ読み取れます。",
    "trust.tcSecurityItems.3": "操作ログの記録 —— 管理画面での操作は監査ログに記録します。",
    "trust.tcDataTitle": "プロジェクトにおけるデータの流れ",
    "trust.tcDataBody":
      "検証・監査・検品サービスを提供するため、必要な情報を該当するサプライヤーと第三者監査機関に提供します。個人データを販売することはありません。",
    "trust.tcReportTitle": "通報窓口",
    "trust.tcReportBody":
      "誠実性、機密保持、データに関する懸念はコンプライアンス窓口までご連絡ください：",
  },

  es: {
    "trust.tcTitle": "Centro de confianza",
    "trust.tcLead":
      "Las políticas, los compromisos y los controles que sostienen nuestro trabajo de verificación, en un solo lugar.",
    "trust.tcCardConfTitle": "Declaración de confidencialidad",
    "trust.tcCardConfBody":
      "Qué tratamos como confidencial, quién está obligado y qué ocurre si se incumplen esas reglas.",
    "trust.tcCardIntegrityTitle": "Código de integridad y conducta",
    "trust.tcCardIntegrityBody":
      "Sin contraprestaciones, sin conflictos de interés, sin certificados en venta, y cómo denunciar.",
    "trust.tcCardPrivacyBody":
      "Qué datos recogemos, cómo los usamos y cómo solicitar acceso, rectificación o supresión.",
    "trust.tcCardTermsBody":
      "Las reglas de uso de la plataforma y qué garantizamos y qué no sobre los proveedores.",
    "trust.tcSecurityTitle": "Medidas de seguridad",
    "trust.tcSecurityBody":
      "Lo que está en vigor hoy. Solo enumeramos medidas activas, no las que prevemos implantar.",
    "trust.tcSecurityItems.0":
      "Cifrado en tránsito — todas las páginas y llamadas a la API se sirven por HTTPS.",
    "trust.tcSecurityItems.1":
      "Control de acceso — los datos de proveedores se filtran por nivel de membresía en el servidor antes de devolverse.",
    "trust.tcSecurityItems.2":
      "Permisos de base de datos — el acceso público a nuestra base de datos está denegado por defecto, y las tablas sensibles solo las leen roles del servidor.",
    "trust.tcSecurityItems.3":
      "Registro de actividad — las acciones administrativas se escriben en un registro de auditoría.",
    "trust.tcDataTitle": "Cómo circulan los datos en un proyecto",
    "trust.tcDataBody":
      "Para prestar una verificación, auditoría o inspección compartimos los datos necesarios con el proveedor y la firma auditora externa implicados. No vendemos datos personales.",
    "trust.tcReportTitle": "Cómo presentar una denuncia",
    "trust.tcReportBody":
      "Escriba a nuestro buzón de cumplimiento por cualquier asunto de integridad, confidencialidad o datos:",
  },

  de: {
    "trust.tcTitle": "Trust Center",
    "trust.tcLead":
      "Die Richtlinien, Zusagen und Kontrollen hinter unserer Verifizierungsarbeit – an einem Ort.",
    "trust.tcCardConfTitle": "Vertraulichkeitserklärung",
    "trust.tcCardConfBody":
      "Was wir als vertraulich behandeln, wer verpflichtet ist und was bei einem Verstoß geschieht.",
    "trust.tcCardIntegrityTitle": "Integritäts- und Verhaltenskodex",
    "trust.tcCardIntegrityBody":
      "Keine Zuwendungen, keine Interessenkonflikte, keine Zertifikate zum Verkauf – und wie Sie melden.",
    "trust.tcCardPrivacyBody":
      "Welche Daten wir erheben, wie wir sie nutzen und wie Sie Auskunft, Berichtigung oder Löschung verlangen.",
    "trust.tcCardTermsBody":
      "Die Regeln für die Nutzung der Plattform und was wir in Bezug auf Lieferanten zusagen – und was nicht.",
    "trust.tcSecurityTitle": "Sicherheitsmaßnahmen",
    "trust.tcSecurityBody":
      "Was heute in Betrieb ist. Wir listen nur live befindliche Maßnahmen, nicht geplante.",
    "trust.tcSecurityItems.0":
      "Verschlüsselte Übertragung – jede Seite und jeder API-Aufruf wird über HTTPS ausgeliefert.",
    "trust.tcSecurityItems.1":
      "Zugriffskontrolle – Lieferantendaten werden serverseitig nach Mitgliedsstufe gefiltert, bevor sie zurückgegeben werden.",
    "trust.tcSecurityItems.2":
      "Datenbankrechte – der öffentliche Zugriff auf unsere Datenbank ist standardmäßig gesperrt; sensible Tabellen sind nur für serverseitige Rollen lesbar.",
    "trust.tcSecurityItems.3":
      "Aktivitätsprotokollierung – administrative Aktionen werden in einem Audit-Log erfasst.",
    "trust.tcDataTitle": "Wie Daten durch ein Projekt laufen",
    "trust.tcDataBody":
      "Zur Erbringung einer Verifizierung, eines Audits oder einer Inspektion geben wir die erforderlichen Angaben an den betreffenden Lieferanten und die externe Auditfirma weiter. Wir verkaufen keine personenbezogenen Daten.",
    "trust.tcReportTitle": "Eine Meldung abgeben",
    "trust.tcReportBody":
      "Schreiben Sie an unser Compliance-Postfach bei Fragen zu Integrität, Vertraulichkeit oder Daten:",
  },

  fr: {
    "trust.tcTitle": "Centre de confiance",
    "trust.tcLead":
      "Les politiques, engagements et contrôles qui sous-tendent notre travail de vérification, réunis en un seul endroit.",
    "trust.tcCardConfTitle": "Déclaration de confidentialité",
    "trust.tcCardConfBody":
      "Ce que nous considérons comme confidentiel, qui est tenu à la confidentialité et ce qui se passe en cas de manquement.",
    "trust.tcCardIntegrityTitle": "Code d'intégrité et de conduite",
    "trust.tcCardIntegrityBody":
      "Aucune contrepartie, aucun conflit d'intérêts, aucun certificat en vente, et comment signaler.",
    "trust.tcCardPrivacyBody":
      "Quelles données nous collectons, comment nous les utilisons et comment demander accès, rectification ou suppression.",
    "trust.tcCardTermsBody":
      "Les règles d'utilisation de la plateforme et ce que nous garantissons ou non au sujet des fournisseurs.",
    "trust.tcSecurityTitle": "Mesures de sécurité",
    "trust.tcSecurityBody":
      "Ce qui est en place aujourd'hui. Nous ne listons que les mesures actives, pas celles à venir.",
    "trust.tcSecurityItems.0":
      "Chiffrement en transit — chaque page et chaque appel d'API est servi en HTTPS.",
    "trust.tcSecurityItems.1":
      "Contrôle d'accès — les données fournisseurs sont filtrées côté serveur selon le niveau d'adhésion avant d'être renvoyées.",
    "trust.tcSecurityItems.2":
      "Droits sur la base de données — l'accès public à notre base est refusé par défaut, et les tables sensibles ne sont lisibles que par des rôles côté serveur.",
    "trust.tcSecurityItems.3":
      "Journalisation des activités — les actions administratives sont inscrites dans un journal d'audit.",
    "trust.tcDataTitle": "Le parcours des données dans un projet",
    "trust.tcDataBody":
      "Pour fournir une vérification, un audit ou une inspection, nous transmettons les informations nécessaires au fournisseur et au cabinet d'audit tiers concernés. Nous ne vendons pas de données personnelles.",
    "trust.tcReportTitle": "Signaler un problème",
    "trust.tcReportBody":
      "Écrivez à notre boîte de conformité pour toute question d'intégrité, de confidentialité ou de données :",
  },

  pt: {
    "trust.tcTitle": "Centro de confiança",
    "trust.tcLead":
      "As políticas, os compromissos e os controlos que sustentam o nosso trabalho de verificação, num só lugar.",
    "trust.tcCardConfTitle": "Declaração de Confidencialidade",
    "trust.tcCardConfBody":
      "O que tratamos como confidencial, quem está obrigado e o que acontece se essas regras forem violadas.",
    "trust.tcCardIntegrityTitle": "Código de Integridade e Conduta",
    "trust.tcCardIntegrityBody":
      "Sem contrapartidas, sem conflitos de interesses, sem certificados à venda, e como denunciar.",
    "trust.tcCardPrivacyBody":
      "Que dados recolhemos, como os usamos e como pedir acesso, correção ou eliminação.",
    "trust.tcCardTermsBody":
      "As regras de utilização da plataforma e o que garantimos e não garantimos sobre os fornecedores.",
    "trust.tcSecurityTitle": "Medidas de segurança",
    "trust.tcSecurityBody":
      "O que está em vigor hoje. Listamos apenas medidas ativas, não as que planeamos implementar.",
    "trust.tcSecurityItems.0":
      "Encriptação em trânsito — todas as páginas e chamadas à API são servidas por HTTPS.",
    "trust.tcSecurityItems.1":
      "Controlo de acesso — os dados dos fornecedores são filtrados no servidor por nível de adesão antes de serem devolvidos.",
    "trust.tcSecurityItems.2":
      "Permissões da base de dados — o acesso público à nossa base de dados é negado por predefinição, e as tabelas sensíveis só são legíveis por funções do servidor.",
    "trust.tcSecurityItems.3":
      "Registo de atividade — as ações administrativas são gravadas num registo de auditoria.",
    "trust.tcDataTitle": "Como os dados circulam num projeto",
    "trust.tcDataBody":
      "Para prestar uma verificação, auditoria ou inspeção partilhamos as informações necessárias com o fornecedor e a empresa de auditoria externa envolvidos. Não vendemos dados pessoais.",
    "trust.tcReportTitle": "Apresentar uma denúncia",
    "trust.tcReportBody":
      "Escreva para a nossa caixa de conformidade sobre qualquer questão de integridade, confidencialidade ou dados:",
  },

  ar: {
    "trust.tcTitle": "مركز الثقة",
    "trust.tcLead":
      "السياسات والالتزامات والضوابط التي تقوم عليها أعمال التحقق لدينا، في مكان واحد.",
    "trust.tcCardConfTitle": "بيان السرية",
    "trust.tcCardConfBody": "ما نعتبره سريًا، ومن يلتزم به، وما يحدث عند مخالفة هذه القواعد.",
    "trust.tcCardIntegrityTitle": "مدونة النزاهة والسلوك المهني",
    "trust.tcCardIntegrityBody":
      "حظر المقابل، وحظر تضارب المصالح، وعدم بيع الشهادات، وكيفية الإبلاغ.",
    "trust.tcCardPrivacyBody":
      "البيانات التي نجمعها، وكيف نستخدمها، وكيفية طلب الوصول إليها أو تصحيحها أو حذفها.",
    "trust.tcCardTermsBody": "قواعد استخدام المنصة، وما نضمنه وما لا نضمنه بشأن الموردين.",
    "trust.tcSecurityTitle": "إجراءات الأمان",
    "trust.tcSecurityBody": "ما هو مطبَّق اليوم. نذكر فقط الإجراءات القائمة، لا المخطط لها.",
    "trust.tcSecurityItems.0": "تشفير النقل — تُقدَّم جميع الصفحات وطلبات الواجهة عبر HTTPS.",
    "trust.tcSecurityItems.1":
      "ضبط الوصول — تُفلتر بيانات الموردين على الخادم حسب مستوى العضوية قبل إرسالها.",
    "trust.tcSecurityItems.2":
      "صلاحيات قاعدة البيانات — الوصول العام إلى قاعدة بياناتنا مرفوض افتراضيًا، والجداول الحساسة لا يقرأها إلا أدوار الخادم.",
    "trust.tcSecurityItems.3": "سجل النشاط — تُدوَّن الإجراءات الإدارية في سجل تدقيق.",
    "trust.tcDataTitle": "كيف تنتقل البيانات خلال المشروع",
    "trust.tcDataBody":
      "لتقديم خدمة التحقق أو التدقيق أو الفحص نشارك المعلومات اللازمة مع المورد ومع شركة التدقيق الخارجية المعنية. ولا نبيع البيانات الشخصية.",
    "trust.tcReportTitle": "الإبلاغ عن مخالفة",
    "trust.tcReportBody":
      "اكتب إلى بريد الامتثال لدينا بشأن أي مسألة تتعلق بالنزاهة أو السرية أو البيانات:",
  },
};

// 阶段 3 文案并入总表
for (const loc of LOCALES) Object.assign(TRANS[loc], TRANS_TRUST[loc]);

// ============================================================================
// 阶段 4 —— `footer.trustCenter` **值级**变更（0 新叶）
//
// 原值 "About"：那是 /about 合并进 /trust 时期的临时措辞，指向整页。
// 现改为 "Trust Center"：页脚新增的锚点链接指向页内 `#trust-center` 区块，
// 标签必须与实际落点一致（否则 5 语里会出现「About 却跳到信任中心」的错配）。
// 各语取值与 `trust.tcTitle` 逐语一致，避免同一概念两种叫法。
// ============================================================================
const TRANS_FOOTER_FIX = {
  en: { "footer.trustCenter": "Trust Center" },
  zh: { "footer.trustCenter": "信任中心" },
  "zh-TW": { "footer.trustCenter": "信任中心" },
  ja: { "footer.trustCenter": "トラストセンター" },
  es: { "footer.trustCenter": "Centro de confianza" },
  de: { "footer.trustCenter": "Trust Center" },
  fr: { "footer.trustCenter": "Centre de confiance" },
  pt: { "footer.trustCenter": "Centro de confiança" },
  ar: { "footer.trustCenter": "مركز الثقة" },
};

// 阶段 4 并入总表
for (const loc of LOCALES) Object.assign(TRANS[loc], TRANS_FOOTER_FIX[loc]);

// ============================================================================
// 工具
// ============================================================================
/** 按点路径写入嵌套对象；数字段自动建数组（保证 {h,b} 数组形态） */
function setPath(root, dotted, value) {
  const segs = dotted.split(".");
  let cur = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    const nextIsIndex = /^\d+$/.test(segs[i + 1]);
    if (cur[s] === undefined) cur[s] = nextIsIndex ? [] : {};
    cur = cur[s];
  }
  const last = segs[segs.length - 1];
  cur[last] = value;
}

/** 返回该点路径的当前值（不存在返回 undefined） */
function getPath(root, dotted) {
  let cur = root;
  for (const s of dotted.split(".")) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[s];
  }
  return cur;
}

function countLeaves(o) {
  let n = 0;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v !== null && typeof v === "object") n += countLeaves(v);
    else n++;
  }
  return n;
}

function flattenKeys(o, prefix = "", out = []) {
  for (const k of Object.keys(o)) {
    const v = o[k];
    const np = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") flattenKeys(v, np, out);
    else out.push(np);
  }
  return out;
}

/** 与 apply-cs22b 同款：保留原文件换行风格（本仓库字典恒为 CRLF + 末尾 CRLF） */
function writeKeepEol(file, obj) {
  const original = fs.readFileSync(file, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const text =
    JSON.stringify(obj, null, 2).replace(/\r\n/g, "\n").replace(/\n/g, eol) + eol;
  fs.writeFileSync(file, text, "utf8");
}

// ============================================================================
// 1. 注入
// ============================================================================
const selected = {}; // 仅注入被请求的命名空间
for (const loc of LOCALES) {
  const bag = {};
  for (const [k, v] of Object.entries(TRANS[loc])) {
    const ns = k.split(".")[0];
    if (want(ns)) bag[k] = v;
  }
  selected[loc] = bag;
}

const injectedTotal = {};
for (const loc of LOCALES) {
  const file = path.join(DICT_DIR, `${loc}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  let added = 0;
  for (const [k, v] of Object.entries(selected[loc])) {
    const existing = getPath(dict, k);
    if (existing !== undefined && !OVERWRITE) continue; // 幂等：不覆盖既有值
    if (existing === v) continue; // 值相同则跳过，避免无谓写盘
    setPath(dict, k, v);
    added++;
  }
  writeKeepEol(file, dict);
  injectedTotal[loc] = added;
  console.log(`${loc.padEnd(6)} +${String(added).padStart(3)} 键   叶子=${countLeaves(dict)}`);
}

// ============================================================================
// 2. 9 语键集一致性 + 空值自检
// ============================================================================
const en = JSON.parse(fs.readFileSync(path.join(DICT_DIR, "en.json"), "utf8"));
const newLeaves = countLeaves(en);
let bad = 0;
const expectedKeys = Object.keys(selected.en).sort().join("|");
for (const loc of LOCALES) {
  const d = JSON.parse(fs.readFileSync(path.join(DICT_DIR, `${loc}.json`), "utf8"));
  const locKeys = Object.keys(selected[loc]).sort().join("|");
  if (locKeys !== expectedKeys) {
    console.error(`❌ 键集不一致: ${loc}`);
    bad++;
  }
  for (const k of Object.keys(selected[loc])) {
    const v = getPath(d, k);
    if (typeof v !== "string" || v.trim() === "") {
      console.error(`❌ 空值/非字符串: ${loc}.${k}`);
      bad++;
    }
  }
  const b = fs.readFileSync(path.join(DICT_DIR, `${loc}.json`));
  const s = b.toString("utf8");
  if (!s.endsWith("\r\n") || /(?<!\r)\n/.test(s)) {
    console.error(`❌ 换行符不合规（须纯 CRLF + 末尾 CRLF）: ${loc}`);
    bad++;
  }
}
console.log(bad === 0 ? "✅ 9 语键集一致 + 无空值 + CRLF 合规" : `❌ 自检失败 ${bad} 项`);

// ============================================================================
// 3. en 叶子数冻结常量自动同步（不手改任何断言脚本）
//    OLD 从 RELEASE-RULES.md 的「当前基线：**NNNN**」读 —— 规则 3 的单一事实源
// ============================================================================
const RULES = path.join(ROOT, "RELEASE-RULES.md");
const rulesSrc = fs.readFileSync(RULES, "utf8");
const m = rulesSrc.match(/当前基线：\*\*(\d+)\*\*/);
if (!m) {
  console.error("❌ 无法从 RELEASE-RULES.md 读到「当前基线：**NNNN**」，中止同步（不猜数字）");
  process.exit(1);
}
const OLD = m[1];

/** 需排除的文件：历史迁移脚本（改了会让那次迁移语义错位，且无人读取） */
const SKIP = new Set(["step13b-i18n-gates.cjs"]);

/**
 * 叶子数常量同步 —— **白名单 + 行内上下文** 双闸门。
 *
 * 为什么不「全目录盲替换 OLD」：实测事故（2026-09-30）——
 *   `scripts/cs08-local-smoke.mjs` / `cs11-local-smoke.mjs` 里的 `3210`
 *   其实是 **dev server 端口**（`next start -p 3210` / `http://localhost:3210`），
 *   盲替换把端口改成了叶子数，两个 smoke 脚本会静默连不上服务。
 * 所以：① 只碰下面这份显式白名单；② 同一行必须出现「断言类 token」才替换。
 */
const BUNDLE = (name) => `scripts/.${name}.bundle.cjs`;
const GATE_FILES = [
  "RELEASE-RULES.md",
  "scripts/apply-cs22b-i18n.cjs",
  "scripts/cs06a-directory-regression.ts",
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs13b-cluster-directory-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
  "scripts/cs22a-public-profile-regression.ts",
  "scripts/cs22b-self-assessment-regression.ts",
  "scripts/verify-opennext-bundle.mjs",
  // 编译副本（.bundle.cjs）：被 .gitignore 覆盖，但回归脚本与发布链会读
  BUNDLE("cs06a-directory-regression"),
  BUNDLE("cs08-form-regression"),
  BUNDLE("cs12-profile-regression"),
  BUNDLE("cs13-supplier-seo-regression"),
  BUNDLE("cs13b-cluster-directory-regression"),
  BUNDLE("cs16-supplier-mgmt-regression"),
  BUNDLE("cs17-commerce-regression"),
  BUNDLE("cs20-supplier-report"),
  BUNDLE("cs22a-public-profile-regression"),
  BUNDLE("cs22b-self-assessment-regression"),
];

/** 行内上下文闸门：只有这些 token 出现在同一行，那个数字才被当作叶子数常量 */
const GATE_LINE = /===|!==|期望|当前基线|EN_LEAF|enLeaf|leafCounts|baseKeys|const OLD|叶子数/;

const replacedList = [];
for (const rel of GATE_FILES) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) continue;
  const src = fs.readFileSync(fp, "utf8");
  if (!src.includes(OLD)) continue;
  let hits = 0;
  const lines = src.split("\n").map((line) => {
    if (!line.includes(OLD)) return line;
    if (!GATE_LINE.test(line)) return line; // 无断言上下文 ⇒ 不是叶子数常量，跳过
    hits++;
    return line.split(OLD).join(String(newLeaves));
  });
  if (hits === 0) continue;
  fs.writeFileSync(fp, lines.join("\n"), "utf8");
  replacedList.push(`${rel}（${hits} 处）`);
}

const skipped = [...SKIP].join(", ");
console.log("");
console.log(`跳过（历史迁移脚本，禁改）: ${skipped}`);
console.log(`en 叶子数: ${OLD} → ${newLeaves}（${Number(newLeaves) - Number(OLD) >= 0 ? "+" : ""}${Number(newLeaves) - Number(OLD)}）`);
console.log(`常量同步文件数: ${replacedList.length}`);
replacedList.sort().forEach((f) => console.log(`  · ${f}`));
console.log(`本次注入键数: ${Object.values(injectedTotal).reduce((a, b) => a + b, 0)}`);
console.log(bad === 0 ? "APPLY_CS23_OK" : "APPLY_CS23_CHECK");
