/**
 * nav.menu 服务下拉标题 + 描述本地化（leak-scan v2 发现的真实残留）。
 * 7 语言 × 6 描述键 + 标题键（monitoring 全缺，fr 另有 title/inspection/sourcing）。
 * 安全规则：仅当现值 === en 原值（即尚未翻译）时才覆盖，幂等；
 * 已有手写翻译不受影响。
 */
const fs = require("fs");
const path = require("path");
const D = path.join(__dirname, "..", "i18n", "dictionaries");
const DRY = process.argv.includes("--dry");

const KEYS = [
  "verificationDesc",
  "factoryAuditDesc",
  "inspectionDesc",
  "sourcingDesc",
  "improvementDesc",
  "monitoringDesc",
];

const T = {
  "zh-TW": {
    verificationDesc: "在你付款之前確認公司、廠區與文件。",
    factoryAuditDesc: "依照你的買家要求之標準進行現場評估。",
    inspectionDesc: "生產中期與出貨前的檢驗。",
    sourcingDesc: "發布 RFQ，接觸我們可以核驗的供應商。",
    improvementDesc: "把稽核發現項轉化為矯正措施與培訓。",
    monitoringDesc: "定期複核與變更提醒",
    monitoring: "供應商監控",
  },
  ja: {
    verificationDesc: "支払い前に、会社・工場・書類を確認します。",
    factoryAuditDesc: "買い手が要求する基準に基づく現地評価。",
    inspectionDesc: "生産途中と出荷前の検査。",
    sourcingDesc: "RFQを投稿して、検証済みサプライヤーにリーチ。",
    improvementDesc: "監査結果を是正措置とトレーニングにつなげます。",
    monitoringDesc: "定期再チェックと変更アラート",
    monitoring: "サプライヤーモニタリング",
  },
  de: {
    verificationDesc: "Wir bestätigen Firma, Standort und Dokumente, bevor Sie zahlen.",
    factoryAuditDesc: "Vor-Ort-Bewertung nach der Norm, die Ihr Käufer verlangt.",
    inspectionDesc: "Kontrollen während der Produktion und vor dem Versand.",
    sourcingDesc: "RFQ einstellen und geprüfte Lieferanten erreichen.",
    improvementDesc: "Audit-Ergebnisse in Korrekturmaßnahmen und Schulung umsetzen.",
    monitoringDesc: "Geplante Nachprüfungen und Änderungswarnungen",
    monitoring: "Lieferantenüberwachung",
  },
  fr: {
    verificationDesc: "Confirmez l'entreprise, le site et les documents avant de payer.",
    factoryAuditDesc: "Évaluation sur site selon la norme exigée par votre acheteur.",
    inspectionDesc: "Contrôles en cours de production et avant expédition.",
    sourcingDesc: "Publiez un RFQ et atteignez des fournisseurs vérifiables.",
    improvementDesc: "Transformer les constats d'audit en actions correctives et formation.",
    monitoringDesc: "Revérifications planifiées et alertes de changement",
    monitoring: "Suivi fournisseur",
    inspection: "Inspection",
    sourcing: "Approvisionnement",
  },
  es: {
    verificationDesc: "Confirme la empresa, el sitio y los documentos antes de pagar.",
    factoryAuditDesc: "Evaluación en sitio según la norma que exige su comprador.",
    inspectionDesc: "Controles durante la producción y antes del envío.",
    sourcingDesc: "Publique una RFQ y llegue a proveedores verificables.",
    improvementDesc: "Convertir los hallazgos de auditoría en acciones correctivas y capacitación.",
    monitoringDesc: "Revisitas programadas y alertas de cambios",
    monitoring: "Monitoreo de proveedores",
  },
  pt: {
    verificationDesc: "Confirme a empresa, o local e os documentos antes de pagar.",
    factoryAuditDesc: "Avaliação no local segundo a norma exigida pelo seu comprador.",
    inspectionDesc: "Verificações durante a produção e antes do embarque.",
    sourcingDesc: "Publique uma RFQ e alcance fornecedores verificáveis.",
    improvementDesc: "Transformar os achados da auditoria em ações corretivas e treinamento.",
    monitoringDesc: "Revisitas programadas e alertas de mudanças",
    monitoring: "Monitoramento de fornecedores",
  },
  ar: {
    verificationDesc: "تحقق من الشركة والموقع والمستندات قبل الدفع.",
    factoryAuditDesc: "تقييم في الموقع وفقًا للمعيار الذي يطلبه المشتري.",
    inspectionDesc: "فحوصات أثناء الإنتاج وقبل الشحن.",
    sourcingDesc: "انشر طلب عرض أسعار وتواصل مع موردين يمكن التحقق منهم.",
    improvementDesc: "تحويل نتائج التدقيق إلى إجراءات تصحيحية وتدريب.",
    monitoringDesc: "إعادة فحص مجدولة وتنبيهات التغيير",
    monitoring: "مراقبة الموردين",
  },
};

const LANGS = ["zh-TW", "ja", "de", "fr", "es", "pt", "ar"];
let total = 0;

for (const lang of LANGS) {
  const file = path.join(D, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));
  const menu = dict.nav.menu;
  const enMenu = en.nav.menu;
  const added = [];
  const candidates = [...KEYS, ...Object.keys(T[lang])];
  for (const k of new Set(candidates)) {
    const target = T[lang][k];
    if (target === undefined) continue;
    if (menu[k] === enMenu[k] && target !== enMenu[k]) {
      menu[k] = target;
      added.push(k);
    }
  }
  console.log(`[${lang}] ${added.length ? `翻译 ${added.join(", ")}` : "已就绪，跳过"}`);
  if (!DRY && added.length) fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  total += added.length;
}

console.log(`\n${DRY ? "DRY RUN" : "完成"}：共覆盖 ${total} 个未翻译键`);
