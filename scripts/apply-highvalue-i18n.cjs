/**
 * 高价值页手写翻译（i18n 根治 · 第一批）。
 *
 * 覆盖用户可见频率最高的 UI 标题键（此前被 lock-brand-terms/sync-dict 的
 * KEEP_EN_PATHS 过度锁成英文的键，现已解锁）：
 *   home 覆盖区 / 工具标题 / toolsIndex / toolCards(7) / servicesIndex /
 *   pricing 顶部 / risk.dimensions(8) / verification.levelLabel /
 *   inspection / trust / footer 导航。
 *
 * 安全规则（与 apply-pricing-i18n.cjs 一致）：
 *  - 只在「当前值 === en 值」时覆盖，保护已有人工翻译；
 *  - 结构字段（href/price 等）不涉及；
 *  - 幂等：可重复执行。
 *
 * 用法：
 *   node scripts/apply-highvalue-i18n.cjs --dry   # 预览
 *   node scripts/apply-highvalue-i18n.cjs         # 写入
 */
const fs = require("fs");
const path = require("path");

const D = path.join(__dirname, "..", "i18n", "dictionaries");
const DRY = process.argv.includes("--dry");
const LANGS = ["zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];

/**
 * 键路径 → 8 语言翻译。
 * 术语与 apply-pricing-i18n.cjs / 各工具页字典保持一致：
 * Supplier Verification=供应商核查, Factory Audit=工厂验厂, Inspection=验货,
 * Sourcing=采购寻源, Supplier Improvement=供应商改进, Trust Center=信任中心。
 */
const T = {
  // ---------- home 覆盖区 ----------
  "home.coverageTitle": {
    zh: "我们核验供应商的地区",
    "zh-TW": "我們核實供應商的國家",
    ja: "サプライヤー検証の対象地域",
    de: "Wo wir Lieferanten verifizieren",
    fr: "Où nous vérifions les fournisseurs",
    es: "Dónde verificamos proveedores",
    pt: "Onde verificamos fornecedores",
    ar: "أين نتحقق من الموردين",
  },
  "home.coveragePhase": {
    zh: "第一阶段覆盖",
    "zh-TW": "第一階段涵蓋國家",
    ja: "フェーズ1の対象範囲",
    de: "Abdeckung Phase 1",
    fr: "Couverture phase 1",
    es: "Cobertura fase 1",
    pt: "Cobertura fase 1",
    ar: "التغطية في المرحلة الأولى",
  },
  "home.coverageService1": {
    zh: "供应商核查",
    "zh-TW": "供應商核實",
    ja: "サプライヤー検証",
    de: "Lieferantenverifizierung",
    fr: "Vérification fournisseur",
    es: "Verificación de proveedores",
    pt: "Verificação de fornecedores",
    ar: "التحقق من المورد",
  },
  "home.coverageService2": {
    zh: "工厂验厂",
    "zh-TW": "工廠驗廠",
    ja: "工場監査",
    de: "Werksaudit",
    fr: "Audit d'usine",
    es: "Auditoría de fábrica",
    pt: "Auditoria de fábrica",
    ar: "تدقيق المصنع",
  },
  "home.coverageService3": {
    zh: "验货",
    "zh-TW": "驗貨",
    ja: "製品検査",
    de: "Inspektion",
    fr: "Inspection",
    es: "Inspección",
    pt: "Inspeção",
    ar: "الفحص",
  },
  "home.coverageCta": {
    zh: "查看覆盖范围",
    "zh-TW": "查看涵蓋國家",
    ja: "対象地域を見る",
    de: "Abdeckung ansehen",
    fr: "Voir la couverture",
    es: "Ver cobertura",
    pt: "Ver cobertura",
    ar: "عرض التغطية",
  },
  "home.otherRegionTitle": {
    zh: "其他地区",
    "zh-TW": "其他地區",
    ja: "その他の地域",
    de: "Andere Regionen",
    fr: "Autres régions",
    es: "Otras regiones",
    pt: "Outras regiões",
    ar: "مناطق أخرى",
  },
  "home.otherRegionCta": {
    zh: "告诉我们你的采购地区",
    "zh-TW": "告訴我們你的採購地區",
    ja: "調達先の地域をお知らせください",
    de: "Sagen Sie uns, wo Sie einkaufen",
    fr: "Dites-nous où vous vous approvisionnez",
    es: "Dinos dónde compras",
    pt: "Diga-nos onde você compra",
    ar: "أخبرنا من أين تشتري",
  },
  "home.toolsTitle": {
    zh: "免费的供应商评估工具",
    "zh-TW": "免費的供應商評估工具",
    ja: "サプライヤー評価の無料ツール",
    de: "Kostenlose Tools zur Lieferantenbewertung",
    fr: "Outils gratuits pour évaluer les fournisseurs",
    es: "Herramientas gratuitas para evaluar proveedores",
    pt: "Ferramentas gratuitas para avaliar fornecedores",
    ar: "أدوات مجانية لتقييم الموردين",
  },

  // ---------- toolsIndex ----------
  "toolsIndex.badge": {
    zh: "免费工具",
    "zh-TW": "免費工具",
    ja: "無料ツール",
    de: "Kostenlose Tools",
    fr: "Outils gratuits",
    es: "Herramientas gratuitas",
    pt: "Ferramentas gratuitas",
    ar: "أدوات مجانية",
  },
  "toolsIndex.h1": {
    zh: "免费的供应商与工厂验厂工具",
    "zh-TW": "免費的供應商與工廠驗廠工具",
    ja: "無料のサプライヤー・工場監査ツール",
    de: "Kostenlose Tools für Lieferanten- und Werksaudits",
    fr: "Outils gratuits pour fournisseurs et audits d'usine",
    es: "Herramientas gratuitas de proveedores y auditoría de fábrica",
    pt: "Ferramentas gratuitas de fornecedores e auditoria de fábrica",
    ar: "أدوات مجانية للموردين وتدقيق المصانع",
  },

  // ---------- toolCards ----------
  "toolCards.riskCalculator.title": {
    zh: "供应商风险计算器",
    "zh-TW": "供應商風險計算器",
    ja: "サプライヤーリスク計算ツール",
    de: "Lieferanten-Risikorechner",
    fr: "Calculateur de risque fournisseur",
    es: "Calculadora de riesgo de proveedores",
    pt: "Calculadora de risco de fornecedores",
    ar: "حاسبة مخاطر المورد",
  },
  "toolCards.verificationChecklist.title": {
    zh: "供应商核查清单",
    "zh-TW": "供應商核實清單",
    ja: "サプライヤー検証チェックリスト",
    de: "Lieferantenverifizierungs-Checkliste",
    fr: "Checklist de vérification fournisseur",
    es: "Checklist de verificación de proveedores",
    pt: "Checklist de verificação de fornecedores",
    ar: "قائمة التحقق من المورد",
  },
  "toolCards.riskAssessment.title": {
    zh: "供应商风险评估",
    "zh-TW": "供應商風險評估",
    ja: "サプライヤーリスク評価",
    de: "Lieferanten-Risikobewertung",
    fr: "Évaluation du risque fournisseur",
    es: "Evaluación de riesgo de proveedores",
    pt: "Avaliação de risco de fornecedores",
    ar: "تقييم مخاطر المورد",
  },
  "toolCards.auditChecklist.title": {
    zh: "验厂清单生成器",
    "zh-TW": "驗廠清單生成器",
    ja: "工場監査チェックリスト生成ツール",
    de: "Werksaudit-Checklisten-Generator",
    fr: "Générateur de checklist d'audit d'usine",
    es: "Generador de checklist de auditoría de fábrica",
    pt: "Gerador de checklist de auditoria de fábrica",
    ar: "مولد قائمة تدقيق المصنع",
  },
  "toolCards.supplierScorecard.title": {
    zh: "供应商评估评分卡",
    "zh-TW": "供應商評估評分卡",
    ja: "サプライヤー評価スコアカード",
    de: "Lieferanten-Bewertungs-Scorecard",
    fr: "Scorecard d'évaluation fournisseur",
    es: "Scorecard de evaluación de proveedores",
    pt: "Scorecard de avaliação de fornecedores",
    ar: "بطاقة تقييم المورد",
  },
  "toolCards.auditReportAnalyzer.title": {
    zh: "验厂报告分析器",
    "zh-TW": "驗廠報告分析器",
    ja: "監査レポート分析ツール",
    de: "Audit-Bericht-Analysator",
    fr: "Analyseur de rapport d'audit",
    es: "Analizador de informes de auditoría",
    pt: "Analisador de relatórios de auditoria",
    ar: "محلل تقارير التدقيق",
  },
  "toolCards.documentChecker.title": {
    zh: "供应商文件核验器",
    "zh-TW": "供應商文件核實器",
    ja: "サプライヤー文書チェッカー",
    de: "Lieferanten-Dokumentenprüfer",
    fr: "Vérificateur de documents fournisseur",
    es: "Verificador de documentos de proveedores",
    pt: "Verificador de documentos de fornecedores",
    ar: "مدقق مستندات المورد",
  },

  // ---------- servicesIndex ----------
  "servicesIndex.badge": {
    zh: "服务",
    "zh-TW": "服務",
    ja: "サービス",
    de: "Leistungen",
    fr: "Services",
    es: "Servicios",
    pt: "Serviços",
    ar: "الخدمات",
  },
  "servicesIndex.servicesTitle": {
    zh: "我们做什么",
    "zh-TW": "我們做什麼",
    ja: "私たちのサービス",
    de: "Was wir tun",
    fr: "Ce que nous faisons",
    es: "Qué hacemos",
    pt: "O que fazemos",
    ar: "ماذا نقدم",
  },
  "servicesIndex.items.verification.title": {
    zh: "供应商核查",
    "zh-TW": "供應商核實",
    ja: "サプライヤー検証",
    de: "Lieferantenverifizierung",
    fr: "Vérification fournisseur",
    es: "Verificación de proveedores",
    pt: "Verificação de fornecedores",
    ar: "التحقق من المورد",
  },
  "servicesIndex.items.factoryAudit.title": {
    zh: "工厂验厂",
    "zh-TW": "工廠驗廠",
    ja: "工場監査",
    de: "Werksaudit",
    fr: "Audit d'usine",
    es: "Auditoría de fábrica",
    pt: "Auditoria de fábrica",
    ar: "تدقيق المصنع",
  },
  "servicesIndex.items.inspection.title": {
    zh: "验货",
    "zh-TW": "驗貨",
    ja: "製品検査",
    de: "Inspektion",
    fr: "Inspection",
    es: "Inspección",
    pt: "Inspeção",
    ar: "الفحص",
  },
  "servicesIndex.items.sourcing.title": {
    zh: "采购寻源",
    "zh-TW": "採購尋源",
    ja: "調達",
    de: "Sourcing",
    fr: "Sourcing",
    es: "Sourcing",
    pt: "Sourcing",
    ar: "التوريد",
  },
  "servicesIndex.items.improvement.title": {
    zh: "供应商改进",
    "zh-TW": "供應商改善",
    ja: "サプライヤー改善",
    de: "Lieferantenverbesserung",
    fr: "Amélioration fournisseur",
    es: "Mejora de proveedores",
    pt: "Melhoria de fornecedores",
    ar: "تحسين الموردين",
  },
  "servicesIndex.coverageTitle": {
    zh: "覆盖国家",
    "zh-TW": "涵蓋國家",
    ja: "対象国",
    de: "Abdeckung nach Land",
    fr: "Couverture par pays",
    es: "Cobertura por país",
    pt: "Cobertura por país",
    ar: "التغطية حسب البلد",
  },
  "servicesIndex.notSureCta": {
    zh: "评估供应商风险",
    "zh-TW": "評估供應商風險",
    ja: "サプライヤーリスクを評価する",
    de: "Lieferantenrisiko bewerten",
    fr: "Évaluer le risque fournisseur",
    es: "Evaluar el riesgo del proveedor",
    pt: "Avaliar o risco do fornecedor",
    ar: "قيّم مخاطر المورد",
  },

  // ---------- pricing 顶部（补充，与 apply-pricing-i18n.cjs 一致）----------
  "pricing.h1": {
    zh: "服务与方案",
    "zh-TW": "服務與方案",
    ja: "サービスと料金プラン",
    de: "Leistungen & Pläne",
    fr: "Services et formules",
    es: "Servicios y planes",
    pt: "Serviços e planos",
    ar: "الخدمات والخطط",
  },
  "pricing.plansTitle": {
    zh: "现在就能用的服务",
    "zh-TW": "現在就能用的服務",
    ja: "今すぐ使えるプラン",
    de: "Was Sie heute nutzen können",
    fr: "Ce que vous pouvez utiliser dès maintenant",
    es: "Lo que puedes usar hoy",
    pt: "O que você pode usar hoje",
    ar: "ما يمكنك استخدامه اليوم",
  },

  // ---------- risk.dimensions（8 维）----------
  "risk.dimensions.company.label": {
    zh: "公司风险",
    "zh-TW": "公司風險",
    ja: "会社リスク",
    de: "Unternehmensrisiko",
    fr: "Risque entreprise",
    es: "Riesgo de empresa",
    pt: "Risco da empresa",
    ar: "مخاطر الشركة",
  },
  "risk.dimensions.quality.label": {
    zh: "质量风险",
    "zh-TW": "品質風險",
    ja: "品質リスク",
    de: "Qualitätsrisiko",
    fr: "Risque qualité",
    es: "Riesgo de calidad",
    pt: "Risco de qualidade",
    ar: "مخاطر الجودة",
  },
  "risk.dimensions.compliance.label": {
    zh: "合规风险",
    "zh-TW": "合規風險",
    ja: "コンプライアンスリスク",
    de: "Compliance-Risiko",
    fr: "Risque de conformité",
    es: "Riesgo de cumplimiento",
    pt: "Risco de conformidade",
    ar: "مخاطر الامتثال",
  },
  "risk.dimensions.production.label": {
    zh: "生产风险",
    "zh-TW": "生產風險",
    ja: "生産リスク",
    de: "Produktionsrisiko",
    fr: "Risque de production",
    es: "Riesgo de producción",
    pt: "Risco de produção",
    ar: "مخاطر الإنتاج",
  },
  "risk.dimensions.supplychain.label": {
    zh: "供应链风险",
    "zh-TW": "供應鏈風險",
    ja: "サプライチェーンリスク",
    de: "Lieferkettenrisiko",
    fr: "Risque de chaîne d'approvisionnement",
    es: "Riesgo de cadena de suministro",
    pt: "Risco de cadeia de suprimentos",
    ar: "مخاطر سلسلة التوريد",
  },
  "risk.dimensions.documentation.label": {
    zh: "文件风险",
    "zh-TW": "文件風險",
    ja: "文書リスク",
    de: "Dokumentationsrisiko",
    fr: "Risque documentaire",
    es: "Riesgo documental",
    pt: "Risco documental",
    ar: "مخاطر المستندات",
  },
  "risk.dimensions.certification.label": {
    zh: "认证风险",
    "zh-TW": "認證風險",
    ja: "認証リスク",
    de: "Zertifizierungsrisiko",
    fr: "Risque de certification",
    es: "Riesgo de certificación",
    pt: "Risco de certificação",
    ar: "مخاطر الشهادات",
  },
  "risk.dimensions.digitalFootprint.label": {
    zh: "数字足迹风险",
    "zh-TW": "數位足跡風險",
    ja: "デジタルフットプリントリスク",
    de: "Risiko des digitalen Fußabdrucks",
    fr: "Risque d'empreinte numérique",
    es: "Riesgo de huella digital",
    pt: "Risco de pegada digital",
    ar: "مخاطر البصمة الرقمية",
  },

  // ---------- verification ----------
  "verification.levelLabel": {
    zh: "核查等级",
    "zh-TW": "核實等級",
    ja: "検証レベル",
    de: "Verifizierungsstufe",
    fr: "Niveau de vérification",
    es: "Nivel de verificación",
    pt: "Nível de verificação",
    ar: "مستوى التحقق",
  },

  // ---------- inspection ----------
  "inspection.badge": {
    zh: "产品验货",
    "zh-TW": "產品驗貨",
    ja: "製品検査",
    de: "Produktinspektion",
    fr: "Inspection produit",
    es: "Inspección de producto",
    pt: "Inspeção de produto",
    ar: "فحص المنتج",
  },
  "inspection.h1": {
    zh: "产品验货",
    "zh-TW": "產品驗貨",
    ja: "製品検査",
    de: "Produktinspektion",
    fr: "Inspection produit",
    es: "Inspección de producto",
    pt: "Inspeção de produto",
    ar: "فحص المنتج",
  },

  // ---------- trust ----------
  "trust.badge": {
    zh: "信任中心",
    "zh-TW": "信任中心",
    ja: "トラストセンター",
    de: "Vertrauenszentrum",
    fr: "Centre de confiance",
    es: "Centro de confianza",
    pt: "Centro de confiança",
    ar: "مركز الثقة",
  },
  "trust.h1": {
    zh: "信任中心",
    "zh-TW": "信任中心",
    ja: "トラストセンター",
    de: "Vertrauenszentrum",
    fr: "Centre de confiance",
    es: "Centro de confianza",
    pt: "Centro de confiança",
    ar: "مركز الثقة",
  },

  // ---------- footer ----------
  "footer.allTools": {
    zh: "全部免费工具",
    "zh-TW": "全部免費工具",
    ja: "無料ツール一覧",
    de: "Alle kostenlosen Tools",
    fr: "Tous les outils gratuits",
    es: "Todas las herramientas gratuitas",
    pt: "Todas as ferramentas gratuitas",
    ar: "جميع الأدوات المجانية",
  },
  "footer.riskCalculator": {
    zh: "风险计算器",
    "zh-TW": "風險計算器",
    ja: "リスク計算ツール",
    de: "Risikorechner",
    fr: "Calculateur de risque",
    es: "Calculadora de riesgo",
    pt: "Calculadora de risco",
    ar: "حاسبة المخاطر",
  },
  "footer.verificationChecklist": {
    zh: "核查清单",
    "zh-TW": "核實清單",
    ja: "検証チェックリスト",
    de: "Verifizierungs-Checkliste",
    fr: "Checklist de vérification",
    es: "Checklist de verificación",
    pt: "Checklist de verificação",
    ar: "قائمة التحقق",
  },
  "footer.supplierVerification": {
    zh: "供应商核查",
    "zh-TW": "供應商核實",
    ja: "サプライヤー検証",
    de: "Lieferantenverifizierung",
    fr: "Vérification fournisseur",
    es: "Verificación de proveedores",
    pt: "Verificação de fornecedores",
    ar: "التحقق من المورد",
  },
  "footer.factoryAudit": {
    zh: "工厂验厂",
    "zh-TW": "工廠驗廠",
    ja: "工場監査",
    de: "Werksaudit",
    fr: "Audit d'usine",
    es: "Auditoría de fábrica",
    pt: "Auditoria de fábrica",
    ar: "تدقيق المصنع",
  },
  "footer.sourcingService": {
    zh: "采购寻源",
    "zh-TW": "採購尋源",
    ja: "調達",
    de: "Sourcing",
    fr: "Sourcing",
    es: "Sourcing",
    pt: "Sourcing",
    ar: "التوريد",
  },
  "footer.improvementService": {
    zh: "供应商改进",
    "zh-TW": "供應商改善",
    ja: "サプライヤー改善",
    de: "Lieferantenverbesserung",
    fr: "Amélioration fournisseur",
    es: "Mejora de proveedores",
    pt: "Melhoria de fornecedores",
    ar: "تحسين الموردين",
  },
  "footer.allServices": {
    zh: "全部服务",
    "zh-TW": "全部服務",
    ja: "すべてのサービス",
    de: "Alle Leistungen",
    fr: "Tous les services",
    es: "Todos los servicios",
    pt: "Todos os serviços",
    ar: "جميع الخدمات",
  },
  "footer.containerCalculator": {
    zh: "集装箱装载计算器",
    "zh-TW": "貨櫃裝載計算器",
    ja: "コンテナ積載計算ツール",
    de: "Containerladungsrechner",
    fr: "Calculateur de chargement de conteneur",
    es: "Calculadora de carga de contenedor",
    pt: "Calculadora de carga de contêiner",
    ar: "حاسبة حمولة الحاويات",
  },
  "footer.trustCenter": {
    zh: "信任中心",
    "zh-TW": "信任中心",
    ja: "トラストセンター",
    de: "Vertrauenszentrum",
    fr: "Centre de confiance",
    es: "Centro de confianza",
    pt: "Centro de confiança",
    ar: "مركز الثقة",
  },
};

// ---------- 工具函数 ----------
function getPath(obj, dotted) {
  return dotted.split(".").reduce((cur, p) => (cur == null ? undefined : cur[p]), obj);
}
function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));
let total = 0;

for (const lang of LANGS) {
  const file = path.join(D, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  let changed = 0;
  let skipped = 0;
  const missing = [];

  for (const [k, translations] of Object.entries(T)) {
    const enVal = getPath(en, k);
    const cur = getPath(dict, k);
    const val = translations[lang];
    if (typeof enVal !== "string" || typeof val !== "string") continue;
    if (cur === undefined) {
      missing.push(k);
      continue;
    }
    // 只覆盖「仍等于英文」的条目，保护已有人工翻译
    if (cur !== enVal) {
      skipped++;
      continue;
    }
    setPath(dict, k, val);
    changed++;
  }

  console.log(`[${lang}] 写入 ${changed} 条，跳过已翻译 ${skipped} 条${missing.length ? `，缺键 ${missing.length}` : ""}`);
  if (!DRY && changed) fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  total += changed;
}

console.log(`\n${DRY ? "DRY RUN" : "完成"}：共写入 ${total} 条`);
