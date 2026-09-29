/**
 * stage1.6 候选文案 + 测量
 * 用法：node scripts/run-regression.mjs _s16_cand
 */

type C = { key: string; loc: string; old: string; neu: string; kind: "desc" | "title"; suffix?: string };

// ---------- 占位符最坏值 ----------
const WORST_COUNTRY = "Philippines";
const WORST_INDUSTRY = "Food & Beverage / 食品饮料";
const subst = (s: string) => s.replaceAll("{country}", WORST_COUNTRY).replaceAll("{industry}", WORST_INDUSTRY);

const RISK_SUFFIX = " | FactoryAuditB2B RiskScore™";
const TERMS_SUFFIX = " | FactoryAuditB2B";

export const CANDIDATES: C[] = [
  // ===== 1. countryHub.metaDesc =====
  { kind: "desc", key: "countryHub.metaDesc", loc: "en", suffix: WORST_COUNTRY,
    old: "Supplier verification and factory audit in {country}: manufacturing profile, typical sourcing risks, verification and audit considerations, industries, logistics and FAQs.",
    neu: "Supplier verification and factory audit in {country}. Manufacturing profile, sourcing risks, audit considerations and logistics." },
  { kind: "desc", key: "countryHub.metaDesc", loc: "es",
    old: "Verificación de proveedores y auditoría de fábrica en {country}: perfil de fabricación, riesgos típicos de abastecimiento, consideraciones de verificación y auditoría, industrias, logística y preguntas frecuentes.",
    neu: "Verificación de proveedores y auditoría de fábrica en {country}. Perfil de fabricación, riesgos de abastecimiento y consideraciones de auditoría." },
  { kind: "desc", key: "countryHub.metaDesc", loc: "de",
    old: "Lieferantenverifizierung und Werksaudit in {country}: Herstellungsprofil, typische Beschaffungsrisiken, Verifizierungs- und Auditüberlegungen, Branchen, Logistik und FAQs.",
    neu: "Lieferantenverifizierung und Werksaudit in {country}. Herstellungsprofil, Beschaffungsrisiken, Auditüberlegungen und Logistik." },
  { kind: "desc", key: "countryHub.metaDesc", loc: "fr",
    old: "Vérification des fournisseurs et audit d'usine en {country}\u00a0: profil de fabrication, risques d'approvisionnement typiques, considérations de vérification et d'audit, industries, logistique et FAQ.",
    neu: "Vérification des fournisseurs et audit d'usine en {country}. Profil de fabrication, risques d'approvisionnement et points d'audit." },
  { kind: "desc", key: "countryHub.metaDesc", loc: "pt",
    old: "Verificação de fornecedores e auditoria de fábrica em {country}: perfil de fabricação, riscos típicos de fornecimento, considerações de verificação e auditoria, indústrias, logística e perguntas frequentes.",
    neu: "Verificação de fornecedores e auditoria de fábrica em {country}. Perfil de fabricação, riscos de fornecimento e pontos de auditoria." },
  { kind: "desc", key: "countryHub.metaDesc", loc: "ar",
    old: "Supplier verification and factory audit in {country}: manufacturing profile, typical sourcing risks, verification and audit considerations, industries, logistical and FAQs.",
    neu: "التحقق من الموردين وتدقيق المصانع في {country}. ملف التصنيع ومخاطر التوريد الشائعة واعتبارات التدقيق والخدمات اللوجستية." },

  // ===== 2. industryPage.metaDesc =====
  // ⚠️ 决策 3 选了 A+B（CJK 占比判定）⇒ 预算从 90 放宽到 158，
  //    本键**不再是 Plan A 的「收短到 ≤90」**，而是写成 100–158 的双句完整句。
  //    · es/pt 的 old 是 stage1.6 先落地的 Plan A 短值（85/82），此处升级为 153
  //    · fr 是新增第 54 处：其源头 170 > 158，收口只取到首句（73–86），同样不达 100–158
  { kind: "desc", key: "industryPage.metaDesc", loc: "es",
    old: "Proveedores verificados de {industry} y los tipos de auditoría correctos.",
    neu: "Proveedores verificados de {industry} y los tipos correctos de auditoría. Revisamos fábrica, licencias, calidad y capacidad antes de ordenar." },
  { kind: "desc", key: "industryPage.metaDesc", loc: "pt",
    old: "Fornecedores verificados de {industry} e os tipos de auditoria certos.",
    neu: "Fornecedores verificados de {industry} e os tipos certos de auditoria. Conferimos fábrica, licenças, qualidade e capacidade antes de comprar." },
  { kind: "desc", key: "industryPage.metaDesc", loc: "fr",
    old: "Trouvez des fournisseurs vérifiés de {industry} et les bons types d'audit. Nous vérifions les usines et formons vos équipes à la qualité et au contrôle qualité.",
    neu: "Trouvez des fournisseurs vérifiés de {industry} et les bons types d'audit. Nous vérifions les usines et formons vos équipes à la qualité." },

  // ===== 3. inspection.metaDesc =====
  { kind: "desc", key: "inspection.metaDesc", loc: "en",
    old: "Pre-production, during-production, pre-shipment and container loading inspection for buyers and suppliers across China, Vietnam, Thailand, Malaysia and the Philippines. Quoted per inspection.",
    neu: "Pre-production, during-production, pre-shipment and container loading inspection in China and Southeast Asia. Quoted per inspection." },
  { kind: "desc", key: "inspection.metaDesc", loc: "es",
    old: "Inspección previa a la producción, durante la producción, previa al envío y carga de contenedores para compradores procedentes de China, Vietnam, Tailandia, Malasia y Filipinas. Presupuestado por inspección.",
    neu: "Inspección previa a la producción, durante la producción, previa al envío y carga de contenedores en China y el Sudeste Asiático. Presupuesto por inspección." },
  { kind: "desc", key: "inspection.metaDesc", loc: "de",
    old: "Vorproduktion, während der Produktion, Vorversand und Containerladekontrolle für Käufer, die aus China, Vietnam, Thailand, Malaysia und den Philippinen beziehen. Angabe je Inspektion.",
    neu: "Vorproduktion, während der Produktion, Vorversand und Containerladekontrolle in China und Südostasien. Preis auf Anfrage je Inspektion." },
  { kind: "desc", key: "inspection.metaDesc", loc: "fr",
    old: "Inspection de pré-production, en cours de production, de pré-expédition et de chargement de conteneurs pour les acheteurs en provenance de Chine, du Vietnam, de Thaïlande, de Malaisie et des Philippines. Devis par inspection.",
    neu: "Inspection de pré-production, en cours de production, de pré-expédition et de chargement de conteneurs en Chine et en Asie du Sud-Est. Devis par inspection." },
  { kind: "desc", key: "inspection.metaDesc", loc: "pt",
    old: "Inspeção de pré-produção, durante a produção, pré-embarque e carregamento de contêineres para compradores provenientes da China, Vietnã, Tailândia, Malásia e Filipinas. Orçado por inspeção.",
    neu: "Inspeção de pré-produção, durante a produção, pré-embarque e carregamento de contêineres na China e no Sudeste Asiático. Orçamento por inspeção." },

  // ===== 4. trainingPage.metaDesc =====
  { kind: "desc", key: "trainingPage.metaDesc", loc: "es",
    old: "Verificamos proveedores en China y Asia para evitar riesgos, luego capacitamos a los equipos de su fábrica en calidad y control de calidad para que los defectos no vuelvan.",
    neu: "Verificamos proveedores en China y Asia para reducir riesgos. Después capacitamos a los equipos de su fábrica en calidad y control de calidad." },
  { kind: "desc", key: "trainingPage.metaDesc", loc: "fr",
    old: "Nous vérifions les fournisseurs en Chine et en Asie pour éviter les risques, puis formons leurs équipes en qualité et QC afin que les défauts ne reviennent pas.",
    neu: "Nous vérifions les fournisseurs en Chine et en Asie pour réduire les risques. Nous formons ensuite leurs équipes en qualité et QC." },

  // ===== 5. serviceVerification.metaDesc es =====
  { kind: "desc", key: "serviceVerification.metaDesc", loc: "es",
    old: "Verificación independiente de proveedores que cubre el registro, la existencia de la fábrica, la capacidad de producción, el sistema de calidad, el cumplimiento y el historial de exportación. Un informe documentado antes de realizar un pedido o liberar el pago.",
    neu: "Verificación independiente de proveedores: registro, existencia de la fábrica, capacidad, calidad y cumplimiento. Informe documentado antes de pagar." },

  // ===== 6. careers.metaDesc =====
  { kind: "desc", key: "careers.metaDesc", loc: "en",
    old: "Join the FactoryAuditB2B network of auditors, supplier verification specialists, sourcing professionals and technology talent across China, Vietnam, Thailand and Asia.",
    neu: "Join the FactoryAuditB2B network of auditors, supplier verification specialists, sourcing professionals and technology talent across Asia." },
  { kind: "desc", key: "careers.metaDesc", loc: "es",
    old: "Únete a la red de FactoryAuditB2B de auditores, especialistas en verificación de proveedores, profesionales de compras y talento tecnológico en China, Vietnam, Tailandia y Asia.",
    neu: "Únete a la red de FactoryAuditB2B de auditores, especialistas en verificación de proveedores y profesionales de compras en Asia." },
  { kind: "desc", key: "careers.metaDesc", loc: "de",
    old: "Werde Teil des FactoryAuditB2B-Netzwerks aus Auditoren, Spezialisten für Lieferantenverifizierung, Beschaffungsprofis und Technologie-Talenten in China, Vietnam, Thailand und Asien.",
    neu: "Werde Teil des FactoryAuditB2B-Netzwerks aus Auditoren, Spezialisten für Lieferantenverifizierung und Beschaffungsprofis in Asien." },
  { kind: "desc", key: "careers.metaDesc", loc: "fr",
    old: "Rejoignez le réseau FactoryAuditB2B d'auditeurs, de spécialistes en vérification de fournisseurs, de professionnels du sourcing et de talents technologiques en Chine, au Vietnam, en Thaïlande et en Asie.",
    neu: "Rejoignez le réseau FactoryAuditB2B d'auditeurs, de spécialistes en vérification de fournisseurs et de professionnels du sourcing en Asie." },
  { kind: "desc", key: "careers.metaDesc", loc: "pt",
    old: "Junte-se à rede FactoryAuditB2B de auditores, especialistas em verificação de fornecedores, profissionais de sourcing e talentos de tecnologia na China, Vietname, Tailândia e Ásia.",
    neu: "Junte-se à rede FactoryAuditB2B de auditores, especialistas em verificação de fornecedores e profissionais de sourcing na Ásia e na China." },

  // ===== 7. pricing.metaDesc =====
  { kind: "desc", key: "pricing.metaDesc", loc: "en",
    old: "Free supplier evaluation tools, supplier verification from USD 99, factory audits from USD 399, product inspection from USD 199 and supplier monitoring by subscription. All prices in USD.",
    neu: "Free supplier evaluation tools, supplier verification from USD 99, factory audits from USD 399 and product inspection from USD 199. All prices in USD." },
  { kind: "desc", key: "pricing.metaDesc", loc: "es",
    old: "Herramientas gratuitas de evaluación de proveedores, verificación de proveedores desde 99 USD, auditorías de fábrica desde 399 USD, inspección de producto desde 199 USD y monitoreo de proveedores por suscripción. Todos los precios en USD.",
    neu: "Herramientas gratuitas, verificación de proveedores desde 99 USD, auditorías de fábrica desde 399 USD e inspección de producto desde 199 USD. Precios en USD." },
  { kind: "desc", key: "pricing.metaDesc", loc: "de",
    old: "Kostenlose Lieferanten-Tools, Lieferantenverifizierung ab 99 USD, Werksaudits ab 399 USD, Produktinspektion ab 199 USD und Lieferanten-Monitoring im Abonnement. Alle Preise in USD.",
    neu: "Kostenlose Tools, Lieferantenverifizierung ab 99 USD, Werksaudits ab 399 USD und Produktinspektion ab 199 USD. Alle Preise in USD." },
  { kind: "desc", key: "pricing.metaDesc", loc: "fr",
    old: "Outils gratuits d'évaluation des fournisseurs, vérification de fournisseur dès 99 USD, audits d'usine dès 399 USD, inspection de produit dès 199 USD et monitoring fournisseur par abonnement. Tous les prix en USD.",
    neu: "Outils gratuits, vérification de fournisseur dès 99 USD, audits d'usine dès 399 USD et inspection de produit dès 199 USD. Tous les prix en USD." },
  { kind: "desc", key: "pricing.metaDesc", loc: "pt",
    old: "Ferramentas gratuitas de avaliação de fornecedores, verificação de fornecedores a partir de 99 USD, auditorias de fábrica a partir de 399 USD, inspeção de produto a partir de 199 USD e monitoramento de fornecedores por assinatura. Todos os preços em USD.",
    neu: "Ferramentas gratuitas, verificação de fornecedores desde 99 USD, auditorias de fábrica desde 399 USD e inspeção desde 199 USD. Preços em USD." },

  // ===== 8. risk.page.metaDesc =====
  { kind: "desc", key: "risk.page.metaDesc", loc: "en",
    old: "Score any supplier from 0 to 100 across eight areas: company, quality, compliance, production, supply chain, documentation, certification and digital footprint. A higher score means lower risk. Free, no account needed.",
    neu: "Score any supplier from 0 to 100 across eight areas: company, quality, compliance, production and supply chain. Higher score means lower risk." },
  { kind: "desc", key: "risk.page.metaDesc", loc: "es",
    old: "Puntúa a cualquier proveedor de 0 a 100 en ocho áreas: empresa, calidad, cumplimiento, producción, cadena de suministro, documentación, certificación y huella digital. Una puntuación más alta significa menos riesgo. Gratis, sin cuenta.",
    neu: "Puntúa a cualquier proveedor de 0 a 100 en ocho áreas: empresa, calidad, cumplimiento, producción y cadena de suministro. Más puntuación, menos riesgo." },
  { kind: "desc", key: "risk.page.metaDesc", loc: "de",
    old: "Bewertet jeden Lieferanten von 0 bis 100 in acht Bereichen: Unternehmen, Qualität, Compliance, Produktion, Lieferkette, Dokumentation, Zertifizierung und digitaler Fußabdruck. Ein höherer Wert bedeutet geringeres Risiko. Kostenlos, ohne Konto.",
    neu: "Bewerten Sie jeden Lieferanten von 0 bis 100 in acht Bereichen: Unternehmen, Qualität, Compliance und Lieferkette. Höherer Wert heißt geringeres Risiko." },
  { kind: "desc", key: "risk.page.metaDesc", loc: "fr",
    old: "Notez n'importe quel fournisseur de 0 à 100 sur huit domaines : société, qualité, conformité, production, chaîne d'approvisionnement, documentation, certification et empreinte numérique. Un score plus élevé signifie un risque plus faible. Gratuit, sans compte.",
    neu: "Notez n'importe quel fournisseur de 0 à 100 sur huit domaines : société, qualité, conformité et production. Un score plus élevé, un risque plus faible." },
  { kind: "desc", key: "risk.page.metaDesc", loc: "pt",
    old: "Pontue qualquer fornecedor de 0 a 100 em oito áreas: empresa, qualidade, conformidade, produção, cadeia de suprimentos, documentação, certificação e pegada digital. Quanto maior a pontuação, menor o risco. Grátis, sem cadastro.",
    neu: "Pontue qualquer fornecedor de 0 a 100 em oito áreas: empresa, qualidade, conformidade e cadeia de suprimentos. Maior pontuação, menor risco." },

  // ===== 9. risk.page.metaTitle（后缀 29 字符）=====
  { kind: "title", key: "risk.page.metaTitle", loc: "es", suffix: RISK_SUFFIX,
    old: "Calculadora de riesgos del proveedor", neu: "Calculadora de riesgo de compra" },
  { kind: "title", key: "risk.page.metaTitle", loc: "fr", suffix: RISK_SUFFIX,
    old: "Calculateur de risque fournisseur", neu: "Calculateur de risque d'achat" },
  { kind: "title", key: "risk.page.metaTitle", loc: "pt", suffix: RISK_SUFFIX,
    old: "Calculadora de risco do fornecedor", neu: "Calculadora de risco de compra" },
  { kind: "title", key: "risk.page.metaTitle", loc: "ar", suffix: RISK_SUFFIX,
    old: "حاسبة مخاطر الموردين", neu: "حاسبة تقييم مخاطر الموردين" },

  // ===== 10. methodology.metaDesc =====
  { kind: "desc", key: "methodology.metaDesc", loc: "es",
    old: "El marco de puntuación, las dimensiones de riesgo, los pesos, las reglas de evidencia, las limitaciones y la política de actualización detrás de nuestras puntuaciones de riesgo del proveedor. Calculado por un motor de reglas determinista, no por IA.",
    neu: "El marco de puntuación, las dimensiones de riesgo, los pesos y las reglas de evidencia detrás de nuestras puntuaciones. Motor de reglas determinista, no IA." },
  { kind: "desc", key: "methodology.metaDesc", loc: "fr",
    old: "Le cadre de notation, les dimensions de risque, les pondérations, les règles de preuve, les limitations et la politique de mise à jour derrière nos scores de risque fournisseur. Calculé par un moteur de règles déterministe, et non par l'IA.",
    neu: "Le cadre de notation, les dimensions de risque, les pondérations et les règles de preuve derrière nos scores. Moteur de règles déterministe, pas d'IA." },
  { kind: "desc", key: "methodology.metaDesc", loc: "pt",
    old: "A estrutura de pontuação, dimensões de risco, pesos, regras de evidência, limitações e política de atualização por trás das nossas pontuações de risco de fornecedores. Calculado por um mecanismo de regras determinísticas, não por IA.",
    neu: "A estrutura de pontuação, as dimensões de risco, os pesos e as regras de evidência por trás das nossas pontuações. Motor de regras determinísticas, não IA." },

  // ===== 11. verifySupplier.metaDesc =====
  { kind: "desc", key: "verifySupplier.metaDesc", loc: "de",
    old: "Senden Sie uns Website oder Firmennamen eines Lieferanten und wir prüfen Unternehmen, Standort und Kapazitätsangaben, bevor Sie bestellen oder eine Anzahlung leisten.",
    neu: "Senden Sie uns Website oder Firmennamen eines Lieferanten. Wir prüfen Unternehmen, Standort und Kapazität, bevor Sie bestellen." },
  { kind: "desc", key: "verifySupplier.metaDesc", loc: "es",
    old: "Envíanos la web o el nombre de un proveedor y comprobamos la empresa, la planta y las capacidades declaradas antes de que hagas un pedido o pagues un anticipo.",
    neu: "Envíanos la web o el nombre de un proveedor. Comprobamos la empresa, la planta y las capacidades antes de que hagas un pedido." },

  // ===== 12. resourcesIndex.metaDesc =====
  { kind: "desc", key: "resourcesIndex.metaDesc", loc: "es",
    old: "Guías y herramientas sobre verificación de proveedores, auditoría de fábrica, riesgo de proveedores, abastecimiento en China y el sudeste asiático y cumplimiento.",
    neu: "Guías y herramientas sobre verificación de proveedores, auditoría de fábrica, riesgo de proveedores y abastecimiento en China y el Sudeste Asiático." },
  { kind: "desc", key: "resourcesIndex.metaDesc", loc: "fr",
    old: "Guides et outils sur la vérification des fournisseurs, l'audit d'usine, le risque fournisseur, l'approvisionnement en Chine et en Asie du Sud-Est et la conformité.",
    neu: "Guides et outils sur la vérification des fournisseurs, l'audit d'usine, le risque fournisseur et l'approvisionnement en Chine et en Asie du Sud-Est." },

  // ===== 13. trainingPlans.metaDesc es =====
  { kind: "desc", key: "trainingPlans.metaDesc", loc: "es",
    old: "Planes de capacitación de proveedores: sistemas de calidad, control de calidad, proceso de producción y capacitación de cumplimiento para sus equipos de fábrica.",
    neu: "Planes de capacitación para proveedores: sistemas de calidad, control de calidad y proceso de producción para sus equipos de fábrica." },

  // ===== 14. legal.termsTitle（后缀 18 字符）=====
  { kind: "title", key: "legal.termsTitle", loc: "en", suffix: TERMS_SUFFIX, old: "Terms of Service", neu: "Terms of Service and Platform Rules" },
  { kind: "title", key: "legal.termsTitle", loc: "es", suffix: TERMS_SUFFIX, old: "Términos del servicio", neu: "Términos del servicio y normas de uso" },
  { kind: "title", key: "legal.termsTitle", loc: "de", suffix: TERMS_SUFFIX, old: "Nutzungsbedingungen", neu: "Nutzungsbedingungen und Plattformregeln" },
  { kind: "title", key: "legal.termsTitle", loc: "fr", suffix: TERMS_SUFFIX, old: "Conditions d'Utilisation", neu: "Conditions d'Utilisation et règles" },
  { kind: "title", key: "legal.termsTitle", loc: "pt", suffix: TERMS_SUFFIX, old: "Termos de Serviço", neu: "Termos de Serviço e regras da plataforma" },
  { kind: "title", key: "legal.termsTitle", loc: "ar", suffix: TERMS_SUFFIX, old: "مدة الخدمة", neu: "شروط الخدمة وقواعد استخدام المنصة" },

  // ===== 15. monitoring.metaDesc =====
  { kind: "desc", key: "monitoring.metaDesc", loc: "es",
    old: "Mantenga actualizados los hechos verificados del proveedor. Revisiones programadas de registro, sitio, certificados y registros públicos, con una alerta cuando algo cambia. Suscripción, cotizada por proveedor por año.",
    neu: "Mantenga actualizados los hechos verificados del proveedor. Revisiones programadas de registro, sitio y certificados, con alerta cuando algo cambia." },
  { kind: "desc", key: "monitoring.metaDesc", loc: "de",
    old: "Verifizierte Lieferantenfakten aktuell halten. Geplante erneute Überprüfungen der Registrierung, des Standorts, der Zertifikate und der öffentlichen Aufzeichnungen mit einer Warnung, wenn sich etwas ändert. Abonnement, angegeben pro Lieferant und Jahr.",
    neu: "Verifizierte Lieferantenfakten aktuell halten. Geplante Überprüfungen von Registrierung, Standort und Zertifikaten, mit Warnung bei Änderungen." },
  { kind: "desc", key: "monitoring.metaDesc", loc: "fr",
    old: "Tenir à jour les faits vérifiés du fournisseur. Re-vérifications planifiées de l'enregistrement, du site, des certificats et des enregistrements publics, avec une alerte lorsque quelque chose change. Abonnement, coté par fournisseur et par an.",
    neu: "Tenir à jour les faits vérifiés du fournisseur. Re-vérifications planifiées de l'enregistrement, du site et des certificats, avec alerte en cas de changement." },

  // ===== 16. chemicals.metaDesc zh（CJK 目标 60–90）=====
  { kind: "desc", key: "chemicals.metaDesc", loc: "zh",
    old: "来自中国的化工原料：各自用途、买家需索取的文件，以及如何向已核验供应商询价。",
    neu: "来自中国的化工原料：各品种的常见用途、买家下单前应索取的文件与许可证，以及如何向已核验供应商询价并核对实际产能与交付周期。" },
];

// ---------- TS 层候选 ----------
export const TS_CANDIDATES: C[] = [
  { kind: "desc", key: "caseStudies/trading-company-posing-as-factory", loc: "en×7",
    old: "Illustrative example: how supplier verification caught a trading company presenting as a factory, and how the buyer re-contracted with the licensed manufacturer before paying a deposit.",
    neu: "Illustrative example: how supplier verification caught a trading company presenting as a factory, and how the buyer re-contracted before paying." },
  { kind: "desc", key: "caseStudies/legal-entity-mismatch-before-deposit", loc: "en×7",
    old: "Illustrative example: an on-site audit found the certificate belonged to a different legal entity than the one signing the contract, so the buyer re-issued the contract before releasing funds.",
    neu: "Illustrative example: an audit found the certificate belonged to a different legal entity than the contract signer, so the buyer re-issued it." },
  { kind: "desc", key: "caseStudies/label-defect-stopped-before-loading", loc: "en×7",
    old: "Illustrative example: a pre-shipment inspection caught a critical labelling defect above the AQL threshold, and the batch was reworked before container loading.",
    neu: "Illustrative example: a pre-shipment inspection caught a critical labelling defect above the AQL threshold, and the batch was reworked." },
  { kind: "desc", key: "caseStudies/qualifying-replacement-supplier-vietnam", loc: "en×7",
    old: "Illustrative example: how a buyer used an RFQ, registration checks and one on-site audit to qualify a second source in Vietnam when the China supplier hit capacity limits.",
    neu: "Illustrative example: how a buyer used an RFQ, registration checks and one on-site audit to qualify a second source in Vietnam." },
  { kind: "desc", key: "fieldReports/carton-count-mismatch-at-loading", loc: "en×7",
    old: "Illustrative field note: a container loading check where the carton count did not reconcile with the packing list, and what happened before the container was sealed.",
    neu: "Illustrative field note: a container loading check where the carton count did not reconcile with the packing list, and what happened next." },
  { kind: "desc", key: "fieldReports/moisture-in-cartons-before-shipment", loc: "en×7",
    old: "Illustrative field note: a pre-shipment inspection in a humid season where carton moisture and pallet wrapping did not match the buyer's packaging specification.",
    neu: "Illustrative field note: a pre-shipment inspection in a humid season where carton moisture and pallet wrapping did not match the buyer's specification." },
  { kind: "desc", key: "fieldReports/shared-building-fire-exits", loc: "en×7",
    old: "Illustrative field note: a social compliance audit where the supplier occupied two floors of a shared building, and the exit routes were not under the supplier's sole control.",
    neu: "Illustrative field note: a social compliance audit where the supplier occupied two floors of a shared building with shared exit routes." },
  { kind: "desc", key: "fieldReports/undisclosed-subcontracted-process", loc: "en×7",
    old: "Illustrative field note: a verification where the supplier's claimed in-house surface treatment was carried out at another site the buyer had not been told about.",
    neu: "Illustrative field note: a verification where the claimed in-house surface treatment was actually carried out at another site." },
  { kind: "desc", key: "industry/food-beverage/food-factory-audit-checklist", loc: "en×7",
    old: "A food factory audit checklist covering licences, food safety certificates, traceability, allergen control, cold chain and labelling, for buyer-side pre-order checks.",
    neu: "A food factory audit checklist covering licences, food safety certificates, traceability, allergen control, cold chain and labelling." },
  { kind: "desc", key: "industry/food-beverage/food-supplier-verification", loc: "en×7",
    old: "What supplier verification checks for a food factory: identity, licences, food safety certificate validity, traceability and cold chain, before you place an order.",
    neu: "What supplier verification checks for a food factory: identity, licences, food safety certificate validity, traceability and cold chain." },
  { kind: "desc", key: "industry/chemicals/chemical-supplier-verification", loc: "en×7",
    old: "What verification checks on a chemical manufacturer: registered identity, licence and permit scope, the site that actually produces, and the documents behind a grade claim.",
    neu: "What verification checks on a chemical manufacturer: registered identity, licence and permit scope, and the site that actually produces." },
  { kind: "desc", key: "CASE_LIST_META.zh", loc: "zh/zh-TW",
    old: "供应商核验、验厂、验货与寻源的方法示例：脱敏演示我们的工作方式，并非客户证言。",
    neu: "供应商核验、验厂、验货与寻源的方法示例：全部脱敏，用来说明现场查什么、发现项怎么记录，以及买家在付款与放行前可以采取的动作。" },
  { kind: "desc", key: "FIELD_REPORT_LIST_META.zh", loc: "zh/zh-TW",
    old: "来自验货、验厂与核验现场的脱敏方法示例：现场查什么、发现项怎么记录。",
    neu: "来自验货、验厂与核验现场的脱敏方法示例：每一则说明现场查什么、异常如何记录，以及订单、装运与货款因此发生的变化，供买家对照。" },
];
