#!/usr/bin/env node
/**
 * apply-footer-i18n.cjs
 * 补齐 footer 命名空间 7 语言未译键（全站页脚共享组件，影响所有页面残留）。
 * 幂等保护：仅当现值 === en 值或缺失时写入。
 *
 * 用法: node scripts/apply-footer-i18n.cjs
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const en = JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8"));

const L10N = {
  "zh-TW": {
    trustCenter: "信任中心",
    operatedBy: "FactoryAuditB2B 是由 {entity} 營運的平台與品牌。",
    registeredBusiness: "中國註冊經營主體",
    coverageOnly: "第一階段覆蓋範圍。更多國家將隨審核員資源落實後增加。",
    verificationService: "供應商核查",
    inspectionService: "驗貨",
    monitoring: "供應商監控",
    fieldReports: "現場記錄",
    caseStudies: "案例研究",
  },
  ja: {
    trustCenter: "トラストセンター",
    operatedBy: "FactoryAuditB2B は {entity} が運営するプラットフォーム兼ブランドです。",
    registeredBusiness: "中国登録企業",
    coverageOnly: "第1フェーズの対象範囲。検証監査人を追加し次第、国を増やします。",
    verificationService: "サプライヤー検証",
    inspectionService: "検査",
    monitoring: "サプライヤーモニタリング",
    fieldReports: "現場レポート",
    caseStudies: "ケーススタディ",
    sampleReport: "サンプルレポート",
  },
  de: {
    trustCenter: "Trust Center",
    operatedBy: "FactoryAuditB2B ist eine Plattform und Marke, betrieben von {entity}.",
    registeredBusiness: "In China registriertes Unternehmen",
    coverageOnly: "Phase-1-Abdeckung. Weitere Länder folgen, sobald wir geprüfte Auditorkapazität hinzufügen.",
    verificationService: "Lieferantenverifizierung",
    inspectionService: "Inspektion",
    sourcingService: "Beschaffung",
    monitoring: "Lieferanten-Monitoring",
    fieldReports: "Feldberichte",
    caseStudies: "Fallstudien",
    sampleReport: "Beispielbericht",
  },
  fr: {
    trustCenter: "Centre de confiance",
    operatedBy: "FactoryAuditB2B est une plateforme et une marque exploitées par {entity}.",
    registeredBusiness: "Société enregistrée en Chine",
    coverageOnly: "Couverture de la phase 1. D'autres pays s'ajouteront au fur et à mesure de la capacité d'auditeurs vérifiés.",
    verificationService: "Vérification de fournisseurs",
    inspectionService: "Inspection",
    sourcingService: "Approvisionnement",
    monitoring: "Suivi des fournisseurs",
    fieldReports: "Rapports de terrain",
    caseStudies: "Études de cas",
    sampleReport: "Exemple de rapport",
  },
  es: {
    trustCenter: "Centro de confianza",
    operatedBy: "FactoryAuditB2B es una plataforma y marca operada por {entity}.",
    registeredBusiness: "Empresa registrada en China",
    platform: "Plataforma",
    resources: "Recursos",
    coverage: "Cobertura",
    logistics: "Logística",
    knowledgeBase: "Centro de recursos",
    pricing: "Precios",
    tagline:
      "Inteligencia de proveedores y verificación para compradores globales. Evalúa. Verifica. Audita.",
    privacy: "Política de privacidad",
    terms: "Términos del servicio",
    trainingPlans: "Planes de formación",
    coverageOnly:
      "Cobertura de la fase 1. Más países a medida que añadimos capacidad de auditores verificados.",
    verificationService: "Verificación de proveedores",
    inspectionService: "Inspección",
    monitoring: "Monitoreo de proveedores",
    fieldReports: "Informes de campo",
    caseStudies: "Casos de estudio",
    sampleReport: "Informe de muestra",
    about: "Sobre nosotros",
  },
  pt: {
    trustCenter: "Central de confiança",
    operatedBy: "A FactoryAuditB2B é uma plataforma e marca operada por {entity}.",
    registeredBusiness: "Empresa registrada na China",
    coverageOnly: "Cobertura da fase 1. Mais países serão adicionados à medida que houver capacidade de auditores verificados.",
    verificationService: "Verificação de fornecedores",
    inspectionService: "Inspeção",
    sourcingService: "Sourcing",
    monitoring: "Monitoramento de fornecedores",
    fieldReports: "Relatórios de campo",
    caseStudies: "Estudos de caso",
    sampleReport: "Relatório de exemplo",
  },
  ar: {
    trustCenter: "مركز الثقة",
    operatedBy: "FactoryAuditB2B منصة وعلامة تجارية يديرها {entity}.",
    registeredBusiness: "شركة مسجلة في الصين",
    platform: "المنصة",
    resources: "الموارد",
    coverage: "التغطية",
    logistics: "الخدمات اللوجستية",
    pricing: "الأسعار",
    privacy: "سياسة الخصوصية",
    terms: "شروط الخدمة",
    coverageOnly:
      "تغطية المرحلة الأولى. المزيد من البلدان مع إضافة قدرة مدققيين موثقين.",
    verificationService: "التحقق من الموردين",
    inspectionService: "الفحص",
    monitoring: "مراقبة الموردين",
    fieldReports: "تقارير ميدانية",
    caseStudies: "دراسات حالة",
  },
};

let total = 0;
for (const [loc, kv] of Object.entries(L10N)) {
  const file = path.join(DIR, `${loc}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!dict.footer) dict.footer = {};
  let n = 0;
  for (const [k, v] of Object.entries(kv)) {
    if (dict.footer[k] === undefined || dict.footer[k] === en.footer[k]) {
      dict.footer[k] = v;
      n++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`${loc}: 写入 ${n} 键`);
  total += n;
}
console.log(`共写入 ${total} 键。`);
