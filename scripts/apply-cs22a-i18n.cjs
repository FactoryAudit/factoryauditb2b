// scripts/apply-cs22a-i18n.cjs —— CS-22 / CS-A 公开档案页 i18n 注入（幂等 + 9 语键集自检）
//
// 新增顶层命名空间 `trustProfile`，30 个字符串叶子 × 9 语。
// 文案纪律：
//   · 三态徽章必须"图标 + 文字 + 颜色"三重区分，文字里绝不出现泛化的 "Verified"；
//   · disclaimer 明确「核验 ≠ 法定认证、≠ 履约担保」，不写无据声称；
//   · 翻译为逐语种人工校对，非占位、非空串。

const fs = require("fs");
const path = require("path");

const DICT_DIR = path.join(process.cwd(), "i18n", "dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

const TRANS = {
  en: {
    badgeTitle: "Verification status",
    statusNone: "Not verified",
    statusSelf: "Self-assessed",
    statusOnline: "Online verified",
    statusOnSite: "On-site verified",
    statusExpired: "Verification expired",
    detailsTitle: "Verification details",
    labelId: "Verification ID",
    labelMethod: "Verification method",
    labelScope: "Scope",
    labelVerifiedAt: "Verified on",
    labelExpiresAt: "Valid until",
    labelStatus: "Status",
    methodOnline: "Remote review of documents and evidence",
    methodOnSite: "On-site visit and inspection",
    stateActive: "Active",
    stateExpired: "Expired",
    stateRevoked: "Revoked",
    disclaimer:
      "Verification covers only the information and evidence reviewed by FactoryAuditB2B. It is not statutory certification and does not guarantee supplier performance.",
    historyTitle: "Verification history",
    historyEmpty: "No verification records yet.",
    photosTitle: "Factory photos",
    photosEmpty: "No factory photos published yet.",
    shareCta: "Share profile",
    shareTitle: "Share this supplier profile",
    shareLead:
      "Copy the link and send it to buyers. The link does not expose internal supplier identifiers.",
    shareCopied: "Link copied",
    shareFailed: "Could not create the link. Please try again.",
    notPublicTitle: "This profile is not public",
    notPublicLead: "The supplier has not published this profile yet.",
  },
  zh: {
    badgeTitle: "核验状态",
    statusNone: "未核验",
    statusSelf: "工厂自评",
    statusOnline: "线上已核验",
    statusOnSite: "现场已核验",
    statusExpired: "核验已过期",
    detailsTitle: "核验详情",
    labelId: "核验编号",
    labelMethod: "核验方式",
    labelScope: "核验范围",
    labelVerifiedAt: "核验日期",
    labelExpiresAt: "有效期至",
    labelStatus: "状态",
    methodOnline: "远程资料与证据审核",
    methodOnSite: "现场走访与查验",
    stateActive: "生效中",
    stateExpired: "已过期",
    stateRevoked: "已撤销",
    disclaimer:
      "核验仅覆盖 FactoryAuditB2B 已审核的信息与证据，不等同于法定认证，也不构成对供应商履约能力的担保。",
    historyTitle: "核验历史",
    historyEmpty: "暂无核验记录。",
    photosTitle: "工厂照片",
    photosEmpty: "尚未发布工厂照片。",
    shareCta: "分享档案",
    shareTitle: "分享该供应商档案",
    shareLead: "复制链接发送给买家，链接不会暴露供应商内部标识。",
    shareCopied: "链接已复制",
    shareFailed: "链接生成失败，请重试。",
    notPublicTitle: "该档案未公开",
    notPublicLead: "该供应商尚未公开此档案。",
  },
  "zh-TW": {
    badgeTitle: "查核狀態",
    statusNone: "未查核",
    statusSelf: "工廠自評",
    statusOnline: "線上已查核",
    statusOnSite: "現場已查核",
    statusExpired: "查核已過期",
    detailsTitle: "查核詳情",
    labelId: "查核編號",
    labelMethod: "查核方式",
    labelScope: "查核範圍",
    labelVerifiedAt: "查核日期",
    labelExpiresAt: "有效期限",
    labelStatus: "狀態",
    methodOnline: "遠端資料與證據審查",
    methodOnSite: "現場訪查與查驗",
    stateActive: "生效中",
    stateExpired: "已過期",
    stateRevoked: "已撤銷",
    disclaimer:
      "查核僅涵蓋 FactoryAuditB2B 已審查的資訊與證據，不等同於法定認證，也不構成對供應商履約能力的保證。",
    historyTitle: "查核歷史",
    historyEmpty: "暫無查核記錄。",
    photosTitle: "工廠照片",
    photosEmpty: "尚未發布工廠照片。",
    shareCta: "分享檔案",
    shareTitle: "分享此供應商檔案",
    shareLead: "複製連結傳送給買家，連結不會揭露供應商內部識別碼。",
    shareCopied: "連結已複製",
    shareFailed: "連結產生失敗，請再試一次。",
    notPublicTitle: "此檔案未公開",
    notPublicLead: "該供應商尚未公開此檔案。",
  },
  ja: {
    badgeTitle: "検証ステータス",
    statusNone: "未検証",
    statusSelf: "自己評価済み",
    statusOnline: "オンライン検証済み",
    statusOnSite: "現地検証済み",
    statusExpired: "検証の有効期限切れ",
    detailsTitle: "検証の詳細",
    labelId: "検証ID",
    labelMethod: "検証方法",
    labelScope: "範囲",
    labelVerifiedAt: "検証日",
    labelExpiresAt: "有効期限",
    labelStatus: "ステータス",
    methodOnline: "書類と証拠のリモート審査",
    methodOnSite: "現地訪問と実地確認",
    stateActive: "有効",
    stateExpired: "期限切れ",
    stateRevoked: "取消済み",
    disclaimer:
      "検証は FactoryAuditB2B が審査した情報と証拠のみを対象とします。法的な認証ではなく、サプライヤーの履行能力を保証するものでもありません。",
    historyTitle: "検証履歴",
    historyEmpty: "検証記録はまだありません。",
    photosTitle: "工場写真",
    photosEmpty: "工場写真はまだ公開されていません。",
    shareCta: "プロフィールを共有",
    shareTitle: "このサプライヤープロフィールを共有",
    shareLead:
      "リンクをコピーしてバイヤーに送ってください。リンクにサプライヤーの内部識別子は含まれません。",
    shareCopied: "リンクをコピーしました",
    shareFailed: "リンクを作成できませんでした。もう一度お試しください。",
    notPublicTitle: "このプロフィールは非公開です",
    notPublicLead: "サプライヤーはまだこのプロフィールを公開していません。",
  },
  es: {
    badgeTitle: "Estado de verificación",
    statusNone: "Sin verificar",
    statusSelf: "Autoevaluada",
    statusOnline: "Verificada en línea",
    statusOnSite: "Verificada in situ",
    statusExpired: "Verificación caducada",
    detailsTitle: "Detalles de verificación",
    labelId: "ID de verificación",
    labelMethod: "Método de verificación",
    labelScope: "Alcance",
    labelVerifiedAt: "Verificada el",
    labelExpiresAt: "Válida hasta",
    labelStatus: "Estado",
    methodOnline: "Revisión remota de documentos y evidencias",
    methodOnSite: "Visita presencial e inspección",
    stateActive: "Activa",
    stateExpired: "Caducada",
    stateRevoked: "Revocada",
    disclaimer:
      "La verificación cubre únicamente la información y las evidencias revisadas por FactoryAuditB2B. No es una certificación legal ni garantiza el desempeño del proveedor.",
    historyTitle: "Historial de verificación",
    historyEmpty: "Aún no hay registros de verificación.",
    photosTitle: "Fotos de la fábrica",
    photosEmpty: "No se han publicado fotos de la fábrica.",
    shareCta: "Compartir perfil",
    shareTitle: "Compartir este perfil de proveedor",
    shareLead:
      "Copia el enlace y envíalo a los compradores. El enlace no expone identificadores internos del proveedor.",
    shareCopied: "Enlace copiado",
    shareFailed: "No se pudo crear el enlace. Inténtalo de nuevo.",
    notPublicTitle: "Este perfil no es público",
    notPublicLead: "El proveedor todavía no ha publicado este perfil.",
  },
  de: {
    badgeTitle: "Verifizierungsstatus",
    statusNone: "Nicht verifiziert",
    statusSelf: "Selbstbewertet",
    statusOnline: "Online verifiziert",
    statusOnSite: "Vor Ort verifiziert",
    statusExpired: "Verifizierung abgelaufen",
    detailsTitle: "Verifizierungsdetails",
    labelId: "Verifizierungs-ID",
    labelMethod: "Verifizierungsmethode",
    labelScope: "Umfang",
    labelVerifiedAt: "Verifiziert am",
    labelExpiresAt: "Gültig bis",
    labelStatus: "Status",
    methodOnline: "Prüfung von Dokumenten und Nachweisen aus der Ferne",
    methodOnSite: "Vor-Ort-Besuch und Inspektion",
    stateActive: "Aktiv",
    stateExpired: "Abgelaufen",
    stateRevoked: "Widerrufen",
    disclaimer:
      "Die Verifizierung umfasst ausschließlich die von FactoryAuditB2B geprüften Informationen und Nachweise. Sie ist keine gesetzliche Zertifizierung und garantiert nicht die Leistung des Lieferanten.",
    historyTitle: "Verifizierungsverlauf",
    historyEmpty: "Noch keine Verifizierungsdatensätze.",
    photosTitle: "Werksfotos",
    photosEmpty: "Noch keine Werksfotos veröffentlicht.",
    shareCta: "Profil teilen",
    shareTitle: "Dieses Lieferantenprofil teilen",
    shareLead:
      "Kopieren Sie den Link und senden Sie ihn an Einkäufer. Der Link enthält keine internen Lieferanten-IDs.",
    shareCopied: "Link kopiert",
    shareFailed: "Der Link konnte nicht erstellt werden. Bitte erneut versuchen.",
    notPublicTitle: "Dieses Profil ist nicht öffentlich",
    notPublicLead: "Der Lieferant hat dieses Profil noch nicht veröffentlicht.",
  },
  fr: {
    badgeTitle: "Statut de vérification",
    statusNone: "Non vérifié",
    statusSelf: "Auto-évalué",
    statusOnline: "Vérifié en ligne",
    statusOnSite: "Vérifié sur site",
    statusExpired: "Vérification expirée",
    detailsTitle: "Détails de la vérification",
    labelId: "ID de vérification",
    labelMethod: "Méthode de vérification",
    labelScope: "Périmètre",
    labelVerifiedAt: "Vérifié le",
    labelExpiresAt: "Valide jusqu'au",
    labelStatus: "Statut",
    methodOnline: "Examen à distance des documents et preuves",
    methodOnSite: "Visite sur site et inspection",
    stateActive: "Actif",
    stateExpired: "Expiré",
    stateRevoked: "Révoqué",
    disclaimer:
      "La vérification couvre uniquement les informations et preuves examinées par FactoryAuditB2B. Elle ne constitue pas une certification légale et ne garantit pas la performance du fournisseur.",
    historyTitle: "Historique de vérification",
    historyEmpty: "Aucun enregistrement de vérification pour l'instant.",
    photosTitle: "Photos de l'usine",
    photosEmpty: "Aucune photo d'usine publiée.",
    shareCta: "Partager le profil",
    shareTitle: "Partager ce profil fournisseur",
    shareLead:
      "Copiez le lien et envoyez-le aux acheteurs. Le lien n'expose aucun identifiant interne du fournisseur.",
    shareCopied: "Lien copié",
    shareFailed: "Impossible de créer le lien. Veuillez réessayer.",
    notPublicTitle: "Ce profil n'est pas public",
    notPublicLead: "Le fournisseur n'a pas encore publié ce profil.",
  },
  pt: {
    badgeTitle: "Status de verificação",
    statusNone: "Não verificado",
    statusSelf: "Autoavaliado",
    statusOnline: "Verificado online",
    statusOnSite: "Verificado in loco",
    statusExpired: "Verificação expirada",
    detailsTitle: "Detalhes da verificação",
    labelId: "ID de verificação",
    labelMethod: "Método de verificação",
    labelScope: "Escopo",
    labelVerifiedAt: "Verificado em",
    labelExpiresAt: "Válido até",
    labelStatus: "Situação",
    methodOnline: "Análise remota de documentos e evidências",
    methodOnSite: "Visita presencial e inspeção",
    stateActive: "Ativo",
    stateExpired: "Expirado",
    stateRevoked: "Revogado",
    disclaimer:
      "A verificação cobre apenas as informações e evidências analisadas pela FactoryAuditB2B. Não é uma certificação legal e não garante o desempenho do fornecedor.",
    historyTitle: "Histórico de verificação",
    historyEmpty: "Ainda não há registros de verificação.",
    photosTitle: "Fotos da fábrica",
    photosEmpty: "Nenhuma foto da fábrica publicada.",
    shareCta: "Compartilhar perfil",
    shareTitle: "Compartilhar este perfil de fornecedor",
    shareLead:
      "Copie o link e envie aos compradores. O link não expõe identificadores internos do fornecedor.",
    shareCopied: "Link copiado",
    shareFailed: "Não foi possível criar o link. Tente novamente.",
    notPublicTitle: "Este perfil não é público",
    notPublicLead: "O fornecedor ainda não publicou este perfil.",
  },
  ar: {
    badgeTitle: "حالة التحقق",
    statusNone: "غير مُتحقَّق منه",
    statusSelf: "تقييم ذاتي",
    statusOnline: "مُتحقَّق منه عبر الإنترنت",
    statusOnSite: "مُتحقَّق منه ميدانيًا",
    statusExpired: "انتهت صلاحية التحقق",
    detailsTitle: "تفاصيل التحقق",
    labelId: "رقم التحقق",
    labelMethod: "طريقة التحقق",
    labelScope: "النطاق",
    labelVerifiedAt: "تاريخ التحقق",
    labelExpiresAt: "صالح حتى",
    labelStatus: "الحالة",
    methodOnline: "مراجعة المستندات والأدلة عن بُعد",
    methodOnSite: "زيارة ميدانية ومعاينة",
    stateActive: "سارٍ",
    stateExpired: "منتهٍ",
    stateRevoked: "ملغى",
    disclaimer:
      "يقتصر التحقق على المعلومات والأدلة التي راجعتها FactoryAuditB2B، ولا يُعد شهادة نظامية ولا يضمن أداء المورّد.",
    historyTitle: "سجل التحقق",
    historyEmpty: "لا توجد سجلات تحقق بعد.",
    photosTitle: "صور المصنع",
    photosEmpty: "لم يتم نشر صور للمصنع بعد.",
    shareCta: "مشاركة الملف",
    shareTitle: "مشاركة ملف هذا المورّد",
    shareLead:
      "انسخ الرابط وأرسله إلى المشترين. الرابط لا يكشف أي معرّفات داخلية للمورّد.",
    shareCopied: "تم نسخ الرابط",
    shareFailed: "تعذّر إنشاء الرابط. يرجى المحاولة مرة أخرى.",
    notPublicTitle: "هذا الملف غير عام",
    notPublicLead: "لم ينشر المورّد هذا الملف بعد.",
  },
};

function leaves(o) {
  let n = 0;
  const walk = (x) => {
    if (x && typeof x === "object") {
      if (Array.isArray(x)) x.forEach(walk);
      else Object.values(x).forEach(walk);
    } else n++;
  };
  walk(o);
  return n;
}

/** 保留文件既有换行符（仓库当前为 LF；历史脚本曾写过 CRLF） */
function writeKeepEol(file, obj) {
  const original = fs.readFileSync(file, "utf8");
  const crlf = original.includes("\r\n");
  const eol = crlf ? "\r\n" : "\n";
  const text =
    JSON.stringify(obj, null, 2).replace(/\r\n/g, "\n").replace(/\n/g, eol) + eol;
  fs.writeFileSync(file, text, "utf8");
}

let addedTotal = 0;
for (const loc of LOCALES) {
  const file = path.join(DICT_DIR, `${loc}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!dict.trustProfile) dict.trustProfile = {};
  let added = 0;
  for (const [k, v] of Object.entries(TRANS[loc])) {
    if (dict.trustProfile[k] === undefined) {
      dict.trustProfile[k] = v;
      added++;
    }
  }
  writeKeepEol(file, dict);
  addedTotal += added;
  console.log(`${loc}: +${added} keys, leaves=${leaves(dict)}`);
}

// ---- 9 语键集一致性自检 ----
const en = JSON.parse(fs.readFileSync(path.join(DICT_DIR, "en.json"), "utf8"));
const enKeys = Object.keys(en.trustProfile).sort().join(",");
let consistent = true;
for (const loc of LOCALES) {
  const d = JSON.parse(fs.readFileSync(path.join(DICT_DIR, `${loc}.json`), "utf8"));
  if (Object.keys(d.trustProfile).sort().join(",") !== enKeys) {
    console.error(`KEYSET MISMATCH: ${loc}`);
    consistent = false;
  }
  // 空串 / 占位检测：任何一语的叶子值都不得为空
  for (const [k, v] of Object.entries(d.trustProfile)) {
    if (typeof v !== "string" || v.trim() === "") {
      console.error(`EMPTY VALUE: ${loc}.${k}`);
      consistent = false;
    }
  }
}
console.log(consistent ? "9-LANG KEYSET CONSISTENT ✓" : "KEYSET MISMATCH ✗");
console.log(`TOTAL ADDED: ${addedTotal}`);
console.log(`EN LEAVES NOW: ${leaves(en)}`);
