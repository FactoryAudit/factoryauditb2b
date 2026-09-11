#!/usr/bin/env node
/**
 * apply-cs08-form-i18n.cjs
 *
 * CS-08：供应商入驻表单「证书结构化 + 我要获得证书」新增文案键，注入全部 9 语字典的
 * supplierNetwork.form.labels 下（扁平键，避免改动组件类型）。
 *
 * 新增 18 键：
 *   certName / certNumber / certIssued / certExpires / certAdd / certRemove
 *   certHelpOpen / certHelpTitle / certHelpLead / certHelpWanted / certHelpCompany
 *   certHelpContactName / certHelpContactEmail / certHelpNote
 *   certHelpSubmit / certHelpSubmitting / certHelpSuccess / certHelpError
 *
 * 幂等：已存在的键保留原值（不覆盖已翻译内容），仅补齐缺失。
 * 格式：2 空格缩进 + CRLF + 末尾换行（与既有字典一致）。
 *
 * 用法: node scripts/apply-cs08-form-i18n.cjs
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");

const EN = {
  certName: "Certification",
  certNumber: "Certificate no.",
  certIssued: "Issued",
  certExpires: "Valid until",
  certAdd: "Add another certificate",
  certRemove: "Remove",
  certHelpOpen: "I want to obtain certification",
  certHelpTitle: "Certification consulting request",
  certHelpLead:
    "Tell us which certifications you need. Our team will follow up with guidance on factory audits and certification for your target markets.",
  certHelpWanted: "Which certification(s) do you need?",
  certHelpCompany: "Company",
  certHelpContactName: "Contact person",
  certHelpContactEmail: "Email",
  certHelpNote: "Notes (optional)",
  certHelpSubmit: "Send request",
  certHelpSubmitting: "Sending...",
  certHelpSuccess: "Thanks. We received your request and will follow up by email.",
  certHelpError: "Something went wrong. Please try again or email us directly.",
};

const L10N = {
  zh: {
    certName: "认证项目",
    certNumber: "证书编号",
    certIssued: "签发日期",
    certExpires: "有效期至",
    certAdd: "添加更多证书",
    certRemove: "删除",
    certHelpOpen: "我要获得证书",
    certHelpTitle: "认证咨询需求",
    certHelpLead: "告诉我们你需要哪些认证。我们的团队会就面向目标市场的验厂与认证提供跟进指导。",
    certHelpWanted: "你需要哪些认证？",
    certHelpCompany: "公司名称",
    certHelpContactName: "联系人",
    certHelpContactEmail: "邮箱",
    certHelpNote: "备注（选填）",
    certHelpSubmit: "提交需求",
    certHelpSubmitting: "提交中…",
    certHelpSuccess: "谢谢，我们已收到你的需求，会通过邮件跟进。",
    certHelpError: "提交失败，请重试或直接给我们发邮件。",
  },
  "zh-TW": {
    certName: "認證項目",
    certNumber: "證書編號",
    certIssued: "簽發日期",
    certExpires: "有效期至",
    certAdd: "新增更多證書",
    certRemove: "刪除",
    certHelpOpen: "我要取得證書",
    certHelpTitle: "認證諮詢需求",
    certHelpLead: "告訴我們你需要哪些認證。我們的團隊會就面向目標市場的驗廠與認證提供後續指引。",
    certHelpWanted: "你需要哪些認證？",
    certHelpCompany: "公司名稱",
    certHelpContactName: "聯絡人",
    certHelpContactEmail: "電子郵件",
    certHelpNote: "備註（選填）",
    certHelpSubmit: "送出需求",
    certHelpSubmitting: "送出中…",
    certHelpSuccess: "謝謝，我們已收到你的需求，會透過電子郵件跟進。",
    certHelpError: "送出失敗，請重試或直接寄郵件給我們。",
  },
  ja: {
    certName: "認証項目",
    certNumber: "証明書番号",
    certIssued: "発行日",
    certExpires: "有効期限",
    certAdd: "証明書を追加",
    certRemove: "削除",
    certHelpOpen: "認証を取得したい",
    certHelpTitle: "認証コンサルティングのご依頼",
    certHelpLead:
      "必要な認証をお知らせください。対象市場に向けた工場監査・認証について、担当チームがご案内します。",
    certHelpWanted: "必要な認証は何ですか？",
    certHelpCompany: "会社名",
    certHelpContactName: "担当者",
    certHelpContactEmail: "メール",
    certHelpNote: "備考（任意）",
    certHelpSubmit: "依頼を送信",
    certHelpSubmitting: "送信中…",
    certHelpSuccess: "ありがとうございます。ご依頼を受け付けました。メールでご連絡します。",
    certHelpError: "送信に失敗しました。再試行するか、直接メールでご連絡ください。",
  },
  es: {
    certName: "Certificación",
    certNumber: "N.º de certificado",
    certIssued: "Emitido",
    certExpires: "Válido hasta",
    certAdd: "Añadir otra certificación",
    certRemove: "Eliminar",
    certHelpOpen: "Quiero obtener una certificación",
    certHelpTitle: "Solicitud de asesoría en certificación",
    certHelpLead:
      "Indícanos qué certificaciones necesitas. Nuestro equipo te orientará sobre auditorías de fábrica y certificación para tus mercados objetivo.",
    certHelpWanted: "¿Qué certificaciones necesitas?",
    certHelpCompany: "Empresa",
    certHelpContactName: "Persona de contacto",
    certHelpContactEmail: "Correo electrónico",
    certHelpNote: "Notas (opcional)",
    certHelpSubmit: "Enviar solicitud",
    certHelpSubmitting: "Enviando…",
    certHelpSuccess: "Gracias. Hemos recibido tu solicitud y te contactaremos por correo.",
    certHelpError: "Algo salió mal. Inténtalo de nuevo o escríbenos directamente.",
  },
  de: {
    certName: "Zertifizierung",
    certNumber: "Zertifikatsnummer",
    certIssued: "Ausgestellt",
    certExpires: "Gültig bis",
    certAdd: "Weitere Zertifizierung hinzufügen",
    certRemove: "Entfernen",
    certHelpOpen: "Ich möchte eine Zertifizierung erhalten",
    certHelpTitle: "Anfrage zur Zertifizierungsberatung",
    certHelpLead:
      "Teilen Sie uns mit, welche Zertifizierungen Sie benötigen. Unser Team berät Sie zu Werksaudits und Zertifizierung für Ihre Zielmärkte.",
    certHelpWanted: "Welche Zertifizierungen benötigen Sie?",
    certHelpCompany: "Unternehmen",
    certHelpContactName: "Ansprechpartner",
    certHelpContactEmail: "E-Mail",
    certHelpNote: "Hinweise (optional)",
    certHelpSubmit: "Anfrage senden",
    certHelpSubmitting: "Wird gesendet …",
    certHelpSuccess: "Danke. Wir haben Ihre Anfrage erhalten und melden uns per E-Mail.",
    certHelpError: "Etwas ist schiefgelaufen. Bitte erneut versuchen oder direkt per E-Mail kontaktieren.",
  },
  fr: {
    certName: "Certification",
    certNumber: "N° de certificat",
    certIssued: "Délivré le",
    certExpires: "Valable jusqu'au",
    certAdd: "Ajouter une autre certification",
    certRemove: "Supprimer",
    certHelpOpen: "Je souhaite obtenir une certification",
    certHelpTitle: "Demande de conseil en certification",
    certHelpLead:
      "Indiquez-nous les certifications dont vous avez besoin. Notre équipe vous accompagnera sur les audits d'usine et la certification pour vos marchés cibles.",
    certHelpWanted: "De quelles certifications avez-vous besoin ?",
    certHelpCompany: "Entreprise",
    certHelpContactName: "Personne à contacter",
    certHelpContactEmail: "E-mail",
    certHelpNote: "Remarques (facultatif)",
    certHelpSubmit: "Envoyer la demande",
    certHelpSubmitting: "Envoi…",
    certHelpSuccess: "Merci. Nous avons reçu votre demande et vous répondrons par e-mail.",
    certHelpError: "Une erreur est survenue. Réessayez ou écrivez-nous directement.",
  },
  pt: {
    certName: "Certificação",
    certNumber: "N.º do certificado",
    certIssued: "Emitido",
    certExpires: "Válido até",
    certAdd: "Adicionar outra certificação",
    certRemove: "Remover",
    certHelpOpen: "Quero obter uma certificação",
    certHelpTitle: "Pedido de consultoria em certificação",
    certHelpLead:
      "Diga-nos quais certificações precisa. A nossa equipa dará seguimento sobre auditorias de fábrica e certificação para os seus mercados-alvo.",
    certHelpWanted: "De que certificações precisa?",
    certHelpCompany: "Empresa",
    certHelpContactName: "Pessoa de contacto",
    certHelpContactEmail: "E-mail",
    certHelpNote: "Observações (opcional)",
    certHelpSubmit: "Enviar pedido",
    certHelpSubmitting: "A enviar…",
    certHelpSuccess: "Obrigado. Recebemos o seu pedido e responderemos por e-mail.",
    certHelpError: "Algo correu mal. Tente novamente ou escreva-nos diretamente.",
  },
  ar: {
    certName: "الشهادة",
    certNumber: "رقم الشهادة",
    certIssued: "تاريخ الإصدار",
    certExpires: "صالح حتى",
    certAdd: "إضافة شهادة أخرى",
    certRemove: "إزالة",
    certHelpOpen: "أريد الحصول على شهادة",
    certHelpTitle: "طلب استشارة بشأن الشهادات",
    certHelpLead:
      "أخبرنا بالشهادات التي تحتاجها. سيتابع فريقنا معك بشأن تدقيق المصنع والحصول على الشهادات لأسواقك المستهدفة.",
    certHelpWanted: "ما الشهادات التي تحتاجها؟",
    certHelpCompany: "الشركة",
    certHelpContactName: "جهة الاتصال",
    certHelpContactEmail: "البريد الإلكتروني",
    certHelpNote: "ملاحظات (اختياري)",
    certHelpSubmit: "إرسال الطلب",
    certHelpSubmitting: "جارٍ الإرسال…",
    certHelpSuccess: "شكرًا. تلقّينا طلبك وسنتابع معك عبر البريد الإلكتروني.",
    certHelpError: "حدث خطأ ما. حاول مرة أخرى أو راسلنا مباشرة.",
  },
};

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
const SECTIONS = { en: EN, ...L10N };

let added = 0;
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const next = SECTIONS[loc];
  if (!next) {
    console.error(`[cs08-i18n] 缺少 ${loc} 的翻译`);
    process.exit(1);
  }
  const enKeys = Object.keys(EN).sort();
  const locKeys = Object.keys(next).sort();
  if (enKeys.join("|") !== locKeys.join("|")) {
    const missing = enKeys.filter((k) => !locKeys.includes(k));
    const extra = locKeys.filter((k) => !enKeys.includes(k));
    console.error(`[cs08-i18n] ${loc} 键集不一致 missing=[${missing}] extra=[${extra}]`);
    process.exit(1);
  }
  const form = dict.supplierNetwork && dict.supplierNetwork.form;
  if (!form || !form.labels) {
    console.error(`[cs08-i18n] ${loc} 缺少 supplierNetwork.form.labels`);
    process.exit(1);
  }
  form.labels = { ...form.labels, ...next };
  const out = JSON.stringify(dict, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  added += 1;
}
console.log(`[cs08-i18n] 注入完成：${added} 个语言文件，每个 +${Object.keys(EN).length} 键`);
