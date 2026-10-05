// lib/auditI18n.ts —— 审核/验真 UI 的本地化短语（CS-18 专用，自包含）
//
// 为什么不直接进 i18n/dictionaries/*.json：
//   全局字典要求「九语键集与 en 一致」且由脚本校验（CS-14/CS-17 铁律）。
//   验真页是新模块，先以自包含 map 落地，避免破坏全局字典契约；
//   完整并入九语字典是 Task #10 的工作。其余 6 语回落到英文（与既有口径一致）。
//
// 注意：这仍是「结构化文案」，不是散落在 JSX 里的硬编码字符串。

export type AuditLocale = "en" | "zh" | "zh-TW" | "ja" | "es" | "de" | "fr" | "pt" | "ar";

type Phrases = {
  title: string;
  verified: string;
  notVerifiable: string;
  notVerifiableHint: string;
  reportNumber: string;
  supplier: string;
  auditType: string;
  version: string;
  issued: string;
  sha256: string;
  verificationId: string;
  verifyUrl: string;
  copy: string;
  copied: string;
  note: string;
  issuedBy: string;
  revoked: string;
  superseded: string;
  valid: string;
  auditAnnounced: string;
  auditSemi: string;
  auditUnannounced: string;
};

const EN: Phrases = {
  title: "Report Verification",
  verified: "Report Verified",
  notVerifiable: "Report Not Publicly Verifiable",
  notVerifiableHint:
    "This verification ID is not publicly verifiable. The report may be private, not yet issued, or revoked. Contact the issuer for details.",
  reportNumber: "Report Number",
  supplier: "Supplier",
  auditType: "Audit Type",
  version: "Version",
  issued: "Issued",
  sha256: "SHA-256 (tamper-proof)",
  verificationId: "Verification ID",
  verifyUrl: "Verification URL",
  copy: "Copy",
  copied: "Copied",
  note: "This page proves the authenticity of a FactoryAuditB2B audit report. The SHA-256 fingerprint is computed from the report content and cannot be altered without detection.",
  issuedBy: "Issued by FactoryAuditB2B",
  revoked: "Revoked",
  superseded: "Superseded",
  valid: "Valid",
  auditAnnounced: "Announced",
  auditSemi: "Semi-announced",
  auditUnannounced: "Unannounced",
};

const ZH: Phrases = {
  title: "报告验真",
  verified: "报告已验证",
  notVerifiable: "报告不可公开验真",
  notVerifiableHint: "该验真编号不可公开验真。报告可能为私密、尚未签发或已撤销。请联系签发方了解详情。",
  reportNumber: "报告编号",
  supplier: "供应商",
  auditType: "审核方式",
  version: "版本",
  issued: "签发日期",
  sha256: "SHA-256（防篡改）",
  verificationId: "验真编号",
  verifyUrl: "验真网址",
  copy: "复制",
  copied: "已复制",
  note: "本页用于证明 FactoryAuditB2B 验厂报告的真实性。SHA-256 指纹由报告内容计算得出，任何篡改都将被发现。",
  issuedBy: "由 FactoryAuditB2B 签发",
  revoked: "已撤销",
  superseded: "已被新版替代",
  valid: "有效",
  auditAnnounced: "通知式",
  auditSemi: "半通知式",
  auditUnannounced: "不通知式",
};

const ZHTW: Phrases = {
  title: "報告驗真",
  verified: "報告已驗證",
  notVerifiable: "報告不可公開驗真",
  notVerifiableHint: "該驗真編號不可公開驗真。報告可能為私密、尚未簽發或已撤銷。請聯絡簽發方了解詳情。",
  reportNumber: "報告編號",
  supplier: "供應商",
  auditType: "審核方式",
  version: "版本",
  issued: "簽發日期",
  sha256: "SHA-256（防篡改）",
  verificationId: "驗真編號",
  verifyUrl: "驗真網址",
  copy: "複製",
  copied: "已複製",
  note: "本頁用於證明 FactoryAuditB2B 驗廠報告的真實性。SHA-256 指紋由報告內容計算得出，任何篡改都會被發現。",
  issuedBy: "由 FactoryAuditB2B 簽發",
  revoked: "已撤銷",
  superseded: "已被新版替代",
  valid: "有效",
  auditAnnounced: "通知式",
  auditSemi: "半通知式",
  auditUnannounced: "不通知式",
};

const JA: Phrases = {
  title: "レポート検証",
  verified: "レポート検証済み",
  notVerifiable: "レポートは公開検証できません",
  notVerifiableHint:
    "この検証IDは公開検証できません。レポートが非公開、未発行、または取消済みである可能性があります。詳細は発行元にお問い合わせください。",
  reportNumber: "レポート番号",
  supplier: "サプライヤー",
  auditType: "監査方式",
  version: "バージョン",
  issued: "発行日",
  sha256: "SHA-256（改ざん検知）",
  verificationId: "検証ID",
  verifyUrl: "検証URL",
  copy: "コピー",
  copied: "コピーしました",
  note: "本ページは FactoryAuditB2B 監査レポートの真正性を証明するものです。SHA-256 指紋はレポート内容から算出され、改ざんは必ず検知されます。",
  issuedBy: "発行元：FactoryAuditB2B",
  revoked: "取消済み",
  superseded: "新版に置換済み",
  valid: "有効",
  auditAnnounced: "予告制",
  auditSemi: "半予告制",
  auditUnannounced: "抜き打ち",
};

const ES: Phrases = {
  title: "Verificación de informes",
  verified: "Informe verificado",
  notVerifiable: "Informe no verificable públicamente",
  notVerifiableHint:
    "Este ID de verificación no se puede verificar públicamente. El informe puede ser privado, aún no emitido o revocado. Contacte con el emisor para más detalles.",
  reportNumber: "Número de informe",
  supplier: "Proveedor",
  auditType: "Tipo de auditoría",
  version: "Versión",
  issued: "Emitido",
  sha256: "SHA-256 (a prueba de manipulación)",
  verificationId: "ID de verificación",
  verifyUrl: "URL de verificación",
  copy: "Copiar",
  copied: "Copiado",
  note: "Esta página demuestra la autenticidad de un informe de auditoría de FactoryAuditB2B. La huella SHA-256 se calcula a partir del contenido del informe y no puede alterarse sin ser detectada.",
  issuedBy: "Emitido por FactoryAuditB2B",
  revoked: "Revocado",
  superseded: "Reemplazado",
  valid: "Válido",
  auditAnnounced: "Anunciada",
  auditSemi: "Semianunciada",
  auditUnannounced: "No anunciada",
};

const DE: Phrases = {
  title: "Berichtsverifizierung",
  verified: "Bericht verifiziert",
  notVerifiable: "Bericht nicht öffentlich verifizierbar",
  notVerifiableHint:
    "Diese Verifizierungs-ID ist nicht öffentlich verifizierbar. Der Bericht ist möglicherweise privat, noch nicht ausgestellt oder widerrufen. Wenden Sie sich für Details an den Aussteller.",
  reportNumber: "Berichtsnummer",
  supplier: "Lieferant",
  auditType: "Audit-Art",
  version: "Version",
  issued: "Ausgestellt",
  sha256: "SHA-256 (manipulationssicher)",
  verificationId: "Verifizierungs-ID",
  verifyUrl: "Verifizierungs-URL",
  copy: "Kopieren",
  copied: "Kopiert",
  note: "Diese Seite belegt die Echtheit eines Audit-Berichts von FactoryAuditB2B. Der SHA-256-Fingerabdruck wird aus dem Berichtsinhalt berechnet und kann nicht unbemerkt verändert werden.",
  issuedBy: "Ausgestellt von FactoryAuditB2B",
  revoked: "Widerrufen",
  superseded: "Ersetzt",
  valid: "Gültig",
  auditAnnounced: "Angekündigt",
  auditSemi: "Halb angekündigt",
  auditUnannounced: "Unangekündigt",
};

const FR: Phrases = {
  title: "Vérification des rapports",
  verified: "Rapport vérifié",
  notVerifiable: "Rapport non vérifiable publiquement",
  notVerifiableHint:
    "Cet identifiant de vérification n'est pas vérifiable publiquement. Le rapport peut être privé, pas encore émis ou révoqué. Contactez l'émetteur pour plus de détails.",
  reportNumber: "Numéro de rapport",
  supplier: "Fournisseur",
  auditType: "Type d'audit",
  version: "Version",
  issued: "Émis le",
  sha256: "SHA-256 (anti-falsification)",
  verificationId: "Identifiant de vérification",
  verifyUrl: "URL de vérification",
  copy: "Copier",
  copied: "Copié",
  note: "Cette page atteste l'authenticité d'un rapport d'audit FactoryAuditB2B. L'empreinte SHA-256 est calculée à partir du contenu du rapport et toute altération est détectée.",
  issuedBy: "Émis par FactoryAuditB2B",
  revoked: "Révoqué",
  superseded: "Remplacé",
  valid: "Valide",
  auditAnnounced: "Annoncé",
  auditSemi: "Semi-annoncé",
  auditUnannounced: "Inopiné",
};

const PT: Phrases = {
  title: "Verificação de relatórios",
  verified: "Relatório verificado",
  notVerifiable: "Relatório não verificável publicamente",
  notVerifiableHint:
    "Este ID de verificação não é verificável publicamente. O relatório pode ser privado, ainda não emitido ou revogado. Contacte o emissor para mais detalhes.",
  reportNumber: "Número do relatório",
  supplier: "Fornecedor",
  auditType: "Tipo de auditoria",
  version: "Versão",
  issued: "Emitido",
  sha256: "SHA-256 (à prova de adulteração)",
  verificationId: "ID de verificação",
  verifyUrl: "URL de verificação",
  copy: "Copiar",
  copied: "Copiado",
  note: "Esta página comprova a autenticidade de um relatório de auditoria da FactoryAuditB2B. A impressão digital SHA-256 é calculada a partir do conteúdo do relatório e qualquer adulteração será detetada.",
  issuedBy: "Emitido por FactoryAuditB2B",
  revoked: "Revogado",
  superseded: "Substituído",
  valid: "Válido",
  auditAnnounced: "Anunciada",
  auditSemi: "Semianunciada",
  auditUnannounced: "Não anunciada",
};

const AR: Phrases = {
  title: "التحقق من التقرير",
  verified: "تم التحقق من التقرير",
  notVerifiable: "التقرير غير قابل للتحقق العلني",
  notVerifiableHint:
    "معرّف التحقق هذا غير قابل للتحقق العلني. قد يكون التقرير خاصاً أو لم يصدر بعد أو تم إلغاؤه. يرجى التواصل مع الجهة المُصدرة لمعرفة التفاصيل.",
  reportNumber: "رقم التقرير",
  supplier: "المورّد",
  auditType: "نوع التدقيق",
  version: "الإصدار",
  issued: "تاريخ الإصدار",
  sha256: "SHA-256 (مقاوم للتلاعب)",
  verificationId: "معرّف التحقق",
  verifyUrl: "رابط التحقق",
  copy: "نسخ",
  copied: "تم النسخ",
  note: "توضّح هذه الصفحة صحة تقرير تدقيق صادر عن FactoryAuditB2B. تُحسب بصمة SHA-256 من محتوى التقرير ولا يمكن تعديلها دون اكتشافها.",
  issuedBy: "صادر عن FactoryAuditB2B",
  revoked: "ملغى",
  superseded: "مستبدل",
  valid: "ساري",
  auditAnnounced: "مُعلن",
  auditSemi: "شبه مُعلن",
  auditUnannounced: "غير مُعلن",
};

const MAP: Record<string, Phrases> = { en: EN, zh: ZH, "zh-TW": ZHTW, ja: JA, es: ES, de: DE, fr: FR, pt: PT, ar: AR };

export function auditVerifyPhrases(locale: string): Phrases {
  return MAP[locale] ?? EN;
}

export function auditTypeLabel(type: string, p: Phrases): string {
  if (type === "semi-announced") return p.auditSemi;
  if (type === "unannounced") return p.auditUnannounced;
  return p.auditAnnounced;
}

// ── 审核请求表单（§18-§21）─────────────────────────────────────────────────────
export type AuditRequestFormPhrases = {
  supplier: string;
  supplierPlaceholder: string;
  executionMethod: string;
  announced: string;
  semiAnnounced: string;
  unannounced: string;
  product: string;
  productCategory: string;
  preferredDate: string;
  preferredWindow: string;
  previousAudit: string;
  documentsAvailable: string;
  additionalComments: string;
  requestReceived: string;
  yourCode: string;
  copyCode: string;
};

const RQ_EN: AuditRequestFormPhrases = {
  supplier: "Supplier",
  supplierPlaceholder: "Select the supplier you want audited",
  executionMethod: "Execution Method",
  announced: "Announced",
  semiAnnounced: "Semi-announced",
  unannounced: "Unannounced",
  product: "Product / Scope",
  productCategory: "Product Category",
  preferredDate: "Preferred Date",
  preferredWindow: "Preferred Window",
  previousAudit: "Previous audit available",
  documentsAvailable: "Audit documents available",
  additionalComments: "Additional comments",
  requestReceived: "Audit request received. Our team will respond within one business day.",
  yourCode: "Your audit code",
  copyCode: "Copy code",
};

const RQ_ZH: AuditRequestFormPhrases = {
  supplier: "供应商",
  supplierPlaceholder: "选择需要验厂的供应商",
  executionMethod: "执行方式",
  announced: "通知式",
  semiAnnounced: "半通知式",
  unannounced: "不通知式",
  product: "产品 / 范围",
  productCategory: "产品类别",
  preferredDate: "期望日期",
  preferredWindow: "期望时段",
  previousAudit: "曾有验厂记录",
  documentsAvailable: "可提供验厂文件",
  additionalComments: "补充说明",
  requestReceived: "已收到验厂申请，我们的团队将在一个工作日内与您联系。",
  yourCode: "您的验厂编号",
  copyCode: "复制编号",
};

const RQ_ZHTW: AuditRequestFormPhrases = {
  supplier: "供應商",
  supplierPlaceholder: "選擇需要驗廠的供應商",
  executionMethod: "執行方式",
  announced: "通知式",
  semiAnnounced: "半通知式",
  unannounced: "不通知式",
  product: "產品 / 範圍",
  productCategory: "產品類別",
  preferredDate: "期望日期",
  preferredWindow: "期望時段",
  previousAudit: "曾有驗廠紀錄",
  documentsAvailable: "可提供驗廠文件",
  additionalComments: "補充說明",
  requestReceived: "已收到驗廠申請，我們的團隊將在一個工作日內與您聯繫。",
  yourCode: "您的驗廠編號",
  copyCode: "複製編號",
};

const RQ_JA: AuditRequestFormPhrases = {
  supplier: "サプライヤー",
  supplierPlaceholder: "監査したいサプライヤーを選択してください",
  executionMethod: "実施方式",
  announced: "予告制",
  semiAnnounced: "半予告制",
  unannounced: "抜き打ち",
  product: "製品 / 範囲",
  productCategory: "製品カテゴリー",
  preferredDate: "希望日",
  preferredWindow: "希望時間帯",
  previousAudit: "過去の監査記録あり",
  documentsAvailable: "監査書類の提供可能",
  additionalComments: "補足事項",
  requestReceived: "監査のお申し込みを受け付けました。担当チームが1営業日以内にご連絡します。",
  yourCode: "お客様の監査コード",
  copyCode: "コードをコピー",
};

const RQ_ES: AuditRequestFormPhrases = {
  supplier: "Proveedor",
  supplierPlaceholder: "Seleccione el proveedor que desea auditar",
  executionMethod: "Método de ejecución",
  announced: "Anunciada",
  semiAnnounced: "Semianunciada",
  unannounced: "No anunciada",
  product: "Producto / Alcance",
  productCategory: "Categoría de producto",
  preferredDate: "Fecha preferida",
  preferredWindow: "Franja horaria preferida",
  previousAudit: "Auditoría anterior disponible",
  documentsAvailable: "Documentos de auditoría disponibles",
  additionalComments: "Comentarios adicionales",
  requestReceived: "Solicitud de auditoría recibida. Nuestro equipo responderá en un día laborable.",
  yourCode: "Su código de auditoría",
  copyCode: "Copiar código",
};

const RQ_DE: AuditRequestFormPhrases = {
  supplier: "Lieferant",
  supplierPlaceholder: "Wählen Sie den zu prüfenden Lieferanten",
  executionMethod: "Durchführungsart",
  announced: "Angekündigt",
  semiAnnounced: "Halb angekündigt",
  unannounced: "Unangekündigt",
  product: "Produkt / Umfang",
  productCategory: "Produktkategorie",
  preferredDate: "Wunschdatum",
  preferredWindow: "Wunschzeitfenster",
  previousAudit: "Früheres Audit vorhanden",
  documentsAvailable: "Audit-Unterlagen verfügbar",
  additionalComments: "Zusätzliche Anmerkungen",
  requestReceived: "Auditanfrage eingegangen. Unser Team meldet sich innerhalb eines Werktags.",
  yourCode: "Ihr Audit-Code",
  copyCode: "Code kopieren",
};

const RQ_FR: AuditRequestFormPhrases = {
  supplier: "Fournisseur",
  supplierPlaceholder: "Sélectionnez le fournisseur à auditer",
  executionMethod: "Mode d'exécution",
  announced: "Annoncé",
  semiAnnounced: "Semi-annoncé",
  unannounced: "Inopiné",
  product: "Produit / Périmètre",
  productCategory: "Catégorie de produit",
  preferredDate: "Date souhaitée",
  preferredWindow: "Créneau souhaité",
  previousAudit: "Audit antérieur disponible",
  documentsAvailable: "Documents d'audit disponibles",
  additionalComments: "Commentaires supplémentaires",
  requestReceived: "Demande d'audit reçue. Notre équipe vous répondra dans un jour ouvré.",
  yourCode: "Votre code d'audit",
  copyCode: "Copier le code",
};

const RQ_PT: AuditRequestFormPhrases = {
  supplier: "Fornecedor",
  supplierPlaceholder: "Selecione o fornecedor que pretende auditar",
  executionMethod: "Método de execução",
  announced: "Anunciada",
  semiAnnounced: "Semianunciada",
  unannounced: "Não anunciada",
  product: "Produto / Âmbito",
  productCategory: "Categoria de produto",
  preferredDate: "Data pretendida",
  preferredWindow: "Janela pretendida",
  previousAudit: "Auditoria anterior disponível",
  documentsAvailable: "Documentos de auditoria disponíveis",
  additionalComments: "Comentários adicionais",
  requestReceived: "Pedido de auditoria recebido. A nossa equipa responderá no prazo de um dia útil.",
  yourCode: "O seu código de auditoria",
  copyCode: "Copiar código",
};

const RQ_AR: AuditRequestFormPhrases = {
  supplier: "المورّد",
  supplierPlaceholder: "اختر المورّد الذي تريد تدقيقه",
  executionMethod: "طريقة التنفيذ",
  announced: "مُعلن",
  semiAnnounced: "شبه مُعلن",
  unannounced: "غير مُعلن",
  product: "المنتج / النطاق",
  productCategory: "فئة المنتج",
  preferredDate: "التاريخ المفضّل",
  preferredWindow: "الفترة المفضّلة",
  previousAudit: "يتوفر تدقيق سابق",
  documentsAvailable: "تتوفر مستندات التدقيق",
  additionalComments: "ملاحظات إضافية",
  requestReceived: "تم استلام طلب التدقيق. سيتواصل فريقنا معك خلال يوم عمل واحد.",
  yourCode: "رمز التدقيق الخاص بك",
  copyCode: "نسخ الرمز",
};

const RQ_MAP: Record<string, AuditRequestFormPhrases> = { en: RQ_EN, zh: RQ_ZH, "zh-TW": RQ_ZHTW, ja: RQ_JA, es: RQ_ES, de: RQ_DE, fr: RQ_FR, pt: RQ_PT, ar: RQ_AR };

export function auditRequestFormPhrases(locale: string): AuditRequestFormPhrases {
  return RQ_MAP[locale] ?? RQ_EN;
}
