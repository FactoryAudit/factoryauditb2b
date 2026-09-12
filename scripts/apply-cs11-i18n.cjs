// CS-11 幂等字典注入：新增 standardReport 命名空间（公开标准报告页）+ footer.standardReport
// 用法: node scripts/apply-cs11-i18n.cjs
//
// 格式铁律：2 空格缩进 + CRLF + 末尾换行（与仓库现有字典一致；已验证 JSON.stringify
//           round-trip 与现有文件逐字节相同）。
// 幂等：已存在 standardReport 命名空间则跳过该语言，不覆盖既有译文。
// ⚠️ 写完后必须同步 scripts/cs06a-directory-regression.ts 的 C8 精确常量（en 叶子数）。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const DIR = path.join(ROOT, "i18n", "dictionaries");

const standardReport = {
  en: {
    metaTitle: "Standard Supplier Due Diligence Report — Full Specimen",
    metaDesc:
      "Read the full standard supplier due diligence report free and without registering: 13 sections, 8 scored dimensions, evidence grading. Register once to download the specimen.",
    badge: "Standard report specimen",
    h1: "Standard supplier due diligence report",
    lead: "This is the exact structure every FactoryAuditB2B report follows. Read all 13 sections below — no account needed.",
    freeNote:
      "Free to read in full — no registration required. Registration is only needed to download a copy.",
    tocTitle: "Contents",
    downloadTitle: "Download this report",
    downloadLead:
      "Tell us who you are and we will send you a copy. We use these details to follow up on your sourcing request and nothing else.",
    formName: "Your name",
    formEmail: "Business email",
    formCompany: "Company",
    formCountry: "Country or region (optional)",
    formSourcing: "What are you sourcing? (optional)",
    formLang: "Report language",
    langEn: "English",
    langZh: "中文",
    formCta: "Get the report",
    formPrivacy:
      "We use your details to send the report and to follow up on your request. No newsletters, no third parties.",
    formError: "Something went wrong. Please try again, or email us directly.",
    unlockedTitle: "Thank you — your download is ready.",
    unlockedNote:
      "Choose a language and download the report. We have also sent you a confirmation by email.",
    downloadCta: "Download report",
    ctaTitle: "Want this report for a real supplier?",
    ctaLead:
      "Order a verification and we produce the same 13-section dossier for the factory you are evaluating.",
    ctaPrimary: "Request a verification",
    ctaSecondary: "Post a sourcing request",
  },
  zh: {
    metaTitle: "标准版供应商尽职调查报告 — 完整样张",
    metaDesc:
      "免注册免费阅读完整标准版报告：13 个章节、8 个评分维度、证据分级标注。填写一次登记信息即可下载样张。",
    badge: "标准版报告样张",
    h1: "标准版供应商尽职调查报告",
    lead: "这是 FactoryAuditB2B 每一份报告遵循的结构。下方 13 个章节全部公开，无需注册即可阅读。",
    freeNote: "全文免费阅读，无需注册。只有在下载副本时才需要登记。",
    tocTitle: "目录",
    downloadTitle: "下载这份报告",
    downloadLead: "留下你的信息，我们会把报告发给你。这些信息仅用于跟进你的采购需求，不做他用。",
    formName: "你的姓名",
    formEmail: "工作邮箱",
    formCompany: "公司名称",
    formCountry: "国家或地区（选填）",
    formSourcing: "你准备采购什么？（选填）",
    formLang: "报告语言",
    langEn: "英文",
    langZh: "中文",
    formCta: "获取报告",
    formPrivacy: "我们只会用这些信息发送报告并跟进你的需求，不订阅、不共享给第三方。",
    formError: "提交失败，请重试，或直接发邮件联系我们。",
    unlockedTitle: "谢谢 — 报告可以下载了。",
    unlockedNote: "选择语言后即可下载。我们同时给你发了一封确认邮件。",
    downloadCta: "下载报告",
    ctaTitle: "想看某家真实工厂的这份报告？",
    ctaLead: "下单核验服务，我们会为你在评估的工厂出具同样 13 个章节的档案。",
    ctaPrimary: "申请核验",
    ctaSecondary: "发布采购需求",
  },
  "zh-TW": {
    metaTitle: "標準版供應商盡職調查報告 — 完整樣張",
    metaDesc:
      "免註冊免費閱讀完整標準版報告：13 個章節、8 個評分維度、證據分級標註。填寫一次登記資訊即可下載樣張。",
    badge: "標準版報告樣張",
    h1: "標準版供應商盡職調查報告",
    lead: "這是 FactoryAuditB2B 每一份報告遵循的結構。下方 13 個章節全部公開，無需註冊即可閱讀。",
    freeNote: "全文免費閱讀，無需註冊。只有在下載副本時才需要登記。",
    tocTitle: "目錄",
    downloadTitle: "下載這份報告",
    downloadLead: "留下你的資訊，我們會把報告發給你。這些資訊僅用於跟進你的採購需求，不做他用。",
    formName: "你的姓名",
    formEmail: "工作信箱",
    formCompany: "公司名稱",
    formCountry: "國家或地區（選填）",
    formSourcing: "你準備採購什麼？（選填）",
    formLang: "報告語言",
    langEn: "英文",
    langZh: "中文",
    formCta: "取得報告",
    formPrivacy: "我們只會用這些資訊發送報告並跟進你的需求，不訂閱、不分享給第三方。",
    formError: "送出失敗，請重試，或直接寄信給我們。",
    unlockedTitle: "謝謝 — 報告可以下載了。",
    unlockedNote: "選擇語言後即可下載。我們同時寄了一封確認信給你。",
    downloadCta: "下載報告",
    ctaTitle: "想看某家真實工廠的這份報告？",
    ctaLead: "下單核驗服務，我們會為你在評估的工廠出具同樣 13 個章節的檔案。",
    ctaPrimary: "申請核驗",
    ctaSecondary: "發布採購需求",
  },
  ja: {
    metaTitle: "標準版サプライヤー調査レポート — 完全見本",
    metaDesc:
      "登録不要・無料で全文を読める標準版レポートの見本です。全13セクション、8つの評価軸、証拠の区分表示。ダウンロードには簡単な登録が必要です。",
    badge: "標準版レポート見本",
    h1: "標準版サプライヤー調査レポート",
    lead: "FactoryAuditB2B のすべてのレポートが従う構成です。以下の13セクションは登録なしで全文をお読みいただけます。",
    freeNote: "全文を無料で閲覧できます。登録が必要なのはダウンロード時のみです。",
    tocTitle: "目次",
    downloadTitle: "このレポートをダウンロード",
    downloadLead:
      "情報をご入力いただくと、レポートをお送りします。ご入力内容は調達のご相談への連絡以外には使用しません。",
    formName: "お名前",
    formEmail: "会社メールアドレス",
    formCompany: "会社名",
    formCountry: "国・地域（任意）",
    formSourcing: "調達予定の品目（任意）",
    formLang: "レポートの言語",
    langEn: "English",
    langZh: "中文",
    formCta: "レポートを受け取る",
    formPrivacy:
      "ご入力内容はレポートの送付とご相談の連絡のみに使用します。第三者への提供は行いません。",
    formError: "送信に失敗しました。もう一度お試しいただくか、直接メールでご連絡ください。",
    unlockedTitle: "ありがとうございます。ダウンロードの準備ができました。",
    unlockedNote: "言語を選んでダウンロードしてください。確認メールもお送りしています。",
    downloadCta: "レポートをダウンロード",
    ctaTitle: "実際のサプライヤーでこのレポートをご希望ですか？",
    ctaLead:
      "検証サービスをご依頼いただければ、評価中の工場について同じ13セクションのレポートを作成します。",
    ctaPrimary: "検証を依頼する",
    ctaSecondary: "調達依頼を投稿する",
  },
  es: {
    metaTitle: "Informe estándar de diligencia debida de proveedores — Espécimen completo",
    metaDesc:
      "Lea gratis y sin registrarse el informe estándar completo: 13 secciones, 8 dimensiones puntuadas y clasificación de evidencias. Descargue el espécimen tras un breve registro.",
    badge: "Espécimen de informe estándar",
    h1: "Informe estándar de diligencia debida de proveedores",
    lead: "Esta es la estructura exacta que sigue cada informe de FactoryAuditB2B. Lea las 13 secciones a continuación, sin crear una cuenta.",
    freeNote:
      "Lectura completa gratuita, sin registro. El registro solo es necesario para descargar una copia.",
    tocTitle: "Contenido",
    downloadTitle: "Descargar este informe",
    downloadLead:
      "Indíquenos quién es y le enviaremos una copia. Usamos estos datos solo para dar seguimiento a su solicitud de abastecimiento.",
    formName: "Su nombre",
    formEmail: "Correo electrónico de empresa",
    formCompany: "Empresa",
    formCountry: "País o región (opcional)",
    formSourcing: "¿Qué va a comprar? (opcional)",
    formLang: "Idioma del informe",
    langEn: "English",
    langZh: "中文",
    formCta: "Obtener el informe",
    formPrivacy:
      "Usamos sus datos para enviarle el informe y dar seguimiento a su solicitud. Sin boletines ni terceros.",
    formError: "Algo salió mal. Inténtelo de nuevo o escríbanos directamente.",
    unlockedTitle: "Gracias: su descarga está lista.",
    unlockedNote:
      "Elija un idioma y descargue el informe. También le hemos enviado una confirmación por correo.",
    downloadCta: "Descargar informe",
    ctaTitle: "¿Quiere este informe sobre un proveedor real?",
    ctaLead:
      "Solicite una verificación y elaboramos el mismo dossier de 13 secciones para la fábrica que está evaluando.",
    ctaPrimary: "Solicitar una verificación",
    ctaSecondary: "Publicar una solicitud de abastecimiento",
  },
  de: {
    metaTitle: "Standardbericht zur Lieferantenprüfung — Vollständiges Muster",
    metaDesc:
      "Lesen Sie den vollständigen Standardbericht kostenlos und ohne Registrierung: 13 Abschnitte, 8 bewertete Dimensionen, Kennzeichnung der Belege. Download nach kurzer Registrierung.",
    badge: "Muster des Standardberichts",
    h1: "Standardbericht zur Lieferantenprüfung",
    lead: "Dies ist die Struktur, der jeder FactoryAuditB2B-Bericht folgt. Lesen Sie alle 13 Abschnitte unten — ohne Konto.",
    freeNote:
      "Vollständig kostenlos lesbar, ohne Registrierung. Eine Registrierung ist nur für den Download nötig.",
    tocTitle: "Inhalt",
    downloadTitle: "Diesen Bericht herunterladen",
    downloadLead:
      "Sagen Sie uns, wer Sie sind, und wir senden Ihnen ein Exemplar. Wir nutzen diese Angaben ausschließlich für die Bearbeitung Ihrer Beschaffungsanfrage.",
    formName: "Ihr Name",
    formEmail: "Geschäftliche E-Mail",
    formCompany: "Unternehmen",
    formCountry: "Land oder Region (optional)",
    formSourcing: "Was möchten Sie beschaffen? (optional)",
    formLang: "Sprache des Berichts",
    langEn: "English",
    langZh: "中文",
    formCta: "Bericht erhalten",
    formPrivacy:
      "Wir nutzen Ihre Angaben nur für den Versand des Berichts und die Bearbeitung Ihrer Anfrage. Keine Newsletter, keine Weitergabe.",
    formError: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt.",
    unlockedTitle: "Danke — Ihr Download ist bereit.",
    unlockedNote:
      "Wählen Sie eine Sprache und laden Sie den Bericht herunter. Wir haben Ihnen außerdem eine Bestätigung per E-Mail gesendet.",
    downloadCta: "Bericht herunterladen",
    ctaTitle: "Dieser Bericht für einen echten Lieferanten?",
    ctaLead:
      "Beauftragen Sie eine Verifizierung und wir erstellen dasselbe 13-teilige Dossier für die Fabrik, die Sie prüfen.",
    ctaPrimary: "Verifizierung anfragen",
    ctaSecondary: "Beschaffungsanfrage veröffentlichen",
  },
  fr: {
    metaTitle: "Rapport standard de diligence fournisseurs — Spécimen complet",
    metaDesc:
      "Lisez gratuitement et sans inscription le rapport standard complet : 13 sections, 8 dimensions notées et classement des preuves. Téléchargez le spécimen après une courte inscription.",
    badge: "Spécimen de rapport standard",
    h1: "Rapport standard de diligence fournisseurs",
    lead: "Voici la structure exacte que suit chaque rapport FactoryAuditB2B. Lisez les 13 sections ci-dessous, sans créer de compte.",
    freeNote:
      "Lecture intégrale gratuite, sans inscription. L'inscription n'est nécessaire que pour le téléchargement.",
    tocTitle: "Sommaire",
    downloadTitle: "Télécharger ce rapport",
    downloadLead:
      "Dites-nous qui vous êtes et nous vous enverrons une copie. Nous n'utilisons ces informations que pour le suivi de votre demande de sourcing.",
    formName: "Votre nom",
    formEmail: "E-mail professionnel",
    formCompany: "Entreprise",
    formCountry: "Pays ou région (facultatif)",
    formSourcing: "Que souhaitez-vous sourcer ? (facultatif)",
    formLang: "Langue du rapport",
    langEn: "English",
    langZh: "中文",
    formCta: "Obtenir le rapport",
    formPrivacy:
      "Nous utilisons vos informations pour envoyer le rapport et assurer le suivi de votre demande. Aucune newsletter, aucun tiers.",
    formError: "Une erreur est survenue. Réessayez ou écrivez-nous directement.",
    unlockedTitle: "Merci — votre téléchargement est prêt.",
    unlockedNote:
      "Choisissez une langue et téléchargez le rapport. Nous vous avons également envoyé une confirmation par e-mail.",
    downloadCta: "Télécharger le rapport",
    ctaTitle: "Ce rapport pour un fournisseur réel ?",
    ctaLead:
      "Commandez une vérification et nous produisons le même dossier en 13 sections pour l'usine que vous évaluez.",
    ctaPrimary: "Demander une vérification",
    ctaSecondary: "Publier une demande de sourcing",
  },
  pt: {
    metaTitle: "Relatório padrão de diligência de fornecedores — Espécime completo",
    metaDesc:
      "Leia gratuitamente e sem cadastro o relatório padrão completo: 13 seções, 8 dimensões pontuadas e classificação de evidências. Baixe o espécime após um breve cadastro.",
    badge: "Espécime de relatório padrão",
    h1: "Relatório padrão de diligência de fornecedores",
    lead: "Esta é a estrutura exata que todo relatório da FactoryAuditB2B segue. Leia as 13 seções abaixo, sem criar uma conta.",
    freeNote:
      "Leitura completa gratuita, sem cadastro. O cadastro só é necessário para baixar uma cópia.",
    tocTitle: "Conteúdo",
    downloadTitle: "Baixar este relatório",
    downloadLead:
      "Diga-nos quem você é e enviaremos uma cópia. Usamos esses dados apenas para acompanhar sua demanda de sourcing.",
    formName: "Seu nome",
    formEmail: "E-mail corporativo",
    formCompany: "Empresa",
    formCountry: "País ou região (opcional)",
    formSourcing: "O que você vai comprar? (opcional)",
    formLang: "Idioma do relatório",
    langEn: "English",
    langZh: "中文",
    formCta: "Receber o relatório",
    formPrivacy:
      "Usamos seus dados para enviar o relatório e acompanhar sua solicitação. Sem newsletters e sem terceiros.",
    formError: "Algo deu errado. Tente novamente ou escreva para nós diretamente.",
    unlockedTitle: "Obrigado — seu download está pronto.",
    unlockedNote:
      "Escolha um idioma e baixe o relatório. Também enviamos uma confirmação por e-mail.",
    downloadCta: "Baixar relatório",
    ctaTitle: "Quer este relatório sobre um fornecedor real?",
    ctaLead:
      "Solicite uma verificação e produzimos o mesmo dossiê de 13 seções para a fábrica que você está avaliando.",
    ctaPrimary: "Solicitar uma verificação",
    ctaSecondary: "Publicar um pedido de sourcing",
  },
  ar: {
    metaTitle: "تقرير العناية الواجبة القياسي للموردين — نموذج كامل",
    metaDesc:
      "اقرأ تقرير العناية الواجبة القياسي كاملاً مجاناً وبدون تسجيل: ١٣ قسماً و٨ أبعاد مُقيَّمة وتصنيف للأدلة. نزّل النموذج بعد تسجيل قصير.",
    badge: "نموذج التقرير القياسي",
    h1: "تقرير العناية الواجبة القياسي للموردين",
    lead: "هذه هي البنية التي يتبعها كل تقرير من تقارير FactoryAuditB2B. اقرأ الأقسام الثلاثة عشر أدناه بدون إنشاء حساب.",
    freeNote: "القراءة الكاملة مجانية وبدون تسجيل. التسجيل مطلوب فقط لتنزيل نسخة.",
    tocTitle: "المحتويات",
    downloadTitle: "تنزيل هذا التقرير",
    downloadLead: "أخبرنا من أنت وسنرسل لك نسخة. نستخدم هذه البيانات فقط لمتابعة طلب التوريد الخاص بك.",
    formName: "اسمك",
    formEmail: "بريد إلكتروني للعمل",
    formCompany: "الشركة",
    formCountry: "البلد أو المنطقة (اختياري)",
    formSourcing: "ماذا تنوي شراءه؟ (اختياري)",
    formLang: "لغة التقرير",
    langEn: "English",
    langZh: "中文",
    formCta: "احصل على التقرير",
    formPrivacy:
      "نستخدم بياناتك لإرسال التقرير ومتابعة طلبك فقط. بدون رسائل تسويقية وبدون أطراف ثالثة.",
    formError: "حدث خطأ ما. يرجى المحاولة مرة أخرى أو مراسلتنا مباشرة.",
    unlockedTitle: "شكراً لك — التنزيل جاهز.",
    unlockedNote: "اختر لغة ثم نزّل التقرير. كما أرسلنا لك رسالة تأكيد بالبريد الإلكتروني.",
    downloadCta: "تنزيل التقرير",
    ctaTitle: "هل تريد هذا التقرير عن مورد حقيقي؟",
    ctaLead: "اطلب خدمة التحقق ونعدّ الملف نفسه من ١٣ قسماً للمصنع الذي تقيمه.",
    ctaPrimary: "اطلب تحققاً",
    ctaSecondary: "انشر طلب توريد",
  },
};

const footerLabel = {
  en: "Standard report",
  zh: "标准版报告",
  "zh-TW": "標準版報告",
  ja: "標準版レポート",
  es: "Informe estándar",
  de: "Standardbericht",
  fr: "Rapport standard",
  pt: "Relatório padrão",
  ar: "التقرير القياسي",
};

const LOCALES = Object.keys(standardReport);
let changed = 0;

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  if (!fs.existsSync(file)) {
    console.log(`SKIP  ${locale}（文件不存在）`);
    continue;
  }
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));
  let touched = false;

  if (!obj.standardReport) {
    obj.standardReport = standardReport[locale];
    touched = true;
  } else {
    console.log(`SKIP  ${locale}.standardReport 已存在（不覆盖既有译文）`);
  }

  if (obj.footer && !obj.footer.standardReport) {
    obj.footer.standardReport = footerLabel[locale];
    touched = true;
  }

  if (!touched) continue;

  // 格式铁律：2 空格缩进 + CRLF + 末尾换行
  const out = JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  changed++;
  console.log(`OK    ${locale}.json 已写入（${out.length} bytes）`);
}

console.log(`\n完成：${changed}/${LOCALES.length} 个语言文件被修改`);
