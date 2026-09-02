/**
 * sample-report V2 字典注入脚本（幂等，可重复跑）
 * 用法: node scripts/inject-sample-report-v2.cjs
 * 行为: 只给各语言字典的 sampleReport 块补缺失键，绝不覆盖现有键。
 * 9 语言全量翻译内置在本脚本，避免 9 次手改大 JSON。
 */
const fs = require("fs");
const path = require("path");

const DICT_DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const LANGS = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

const PATCH = {
  en: {
    execSection: "01 · Executive summary",
    execLead:
      "The overall 76/100 is built from the eight dimension scores below. Each dimension is checked against public records and on-site evidence.",
    strengthsTitle: "Strengths",
    strengths: [
      "Registered address matches a 6,200 m² industrial building, confirmed by video walkthrough",
      "Export licence active since 2016 with no customs penalties",
      "Tax credit rating B for three consecutive years",
      "Ownership unchanged since 2019, no equity pledges filed",
    ],
    concernsTitle: "Areas of concern",
    concerns: [
      "One open contract dispute filed by a US buyer in March 2026, still pending",
      "ISO 9001 certificate expires in 40 days, renewal confirmation required",
    ],
    profileNote:
      "Sourced from the National Enterprise Credit Information System (GSXT) and the Shenzhen Administration for Market Regulation.",
    usccLabel: "Unified Social Credit Code",
    legalRepLabel: "Legal representative",
    capitalLabel: "Registered capital",
    companyTypeValue: "Limited liability company",
    addressLabel: "Registered address",
    scopeLabel: "Business scope",
    ownershipSection: "03 · Ownership & control",
    ownershipNote:
      "Shareholder ledger from GSXT, cross-referenced with equity-pledge and freeze records.",
    shareholderLabel: "Shareholder",
    stakeLabel: "Stake",
    sinceLabel: "Since",
    ownershipAnalyst:
      "Ownership has been stable since 2019. The Hong Kong entity is controlled by the same legal representative, consistent with the payment instructions on file.",
    courtSection: "04 · Court & enforcement records",
    courtNote:
      "Pulled from China Judgements Online and the Supreme People's Court enforcement register.",
    caseTotalLabel: "Total cases (2019–2026)",
    caseOpenLabel: "Open",
    caseDefendantLabel: "As defendant",
    enforcementLabel: "Enforcement (被执行人)",
    courtSummary:
      "One sales contract dispute (filed Mar 2026) is pending. Two earlier cases were settled; one delivery-delay case was ruled in the supplier's favour.",
    changesSection: "05 · Registration changes",
    changesNote:
      "Every registration change is public. Late-stage changes to legal representative or capital are the strongest quiet predictor of trouble.",
    impactLow: "Low impact",
    impactMedium: "Medium impact",
    changes: [
      {
        date: "Feb 2025",
        impact: "low",
        title: "Business scope expanded — medical device components",
        desc: "Consistent with the buyer's declared product line.",
      },
      {
        date: "Jun 2023",
        impact: "medium",
        title: "Registered capital increased to CNY 8M",
        desc: "Verified as paid-in, not just subscribed.",
      },
      {
        date: "Aug 2022",
        impact: "medium",
        title: "Listed on operational-abnormality list",
        desc: "Late annual report; removed six months later.",
      },
    ],
    taxSection: "06 · Tax & trade compliance",
    taxNote:
      "A supplier's tax rating is a strong proxy for how they treat contractual obligations.",
    taxLabels: {
      rating: "Tax credit rating",
      vat: "VAT status",
      customs: "Customs registration",
      export: "Declared export volume 2025",
      markets: "Top destinations",
    },
    siteSection: "07 · Factory site verification",
    siteNote:
      "Satellite and street imagery review, plus a live unscripted video walkthrough of the registered address.",
    siteCheckLabels: {
      address: "Registered address matches physical building",
      signage: "Signage matches company name",
      video: "Live video walkthrough",
      machinery: "Machinery matches product claims",
      workers: "Workers on floor during walkthrough",
    },
    certSection: "08 · Certifications & IP",
    certNote: "Certificate authenticity checked against issuer registries where available.",
    certLabels: {
      certification: "Certification",
      number: "Number",
      issued: "Issued",
      status: "Status",
    },
    certStatusValid: "Valid",
    certStatusOnfile: "On file",
    ipNote:
      "7 utility-model patents, 3 design patents, 2 registered trademarks. No IP infringement lawsuits filed.",
    analystRole: "Senior analyst · Shenzhen desk",
    analystQuote:
      "A genuine manufacturer with eleven years of history and clean export records — but two loose ends to resolve before wiring the balance.",
    actionsTitle: "Before wiring the balance",
    recommendActions: [
      "Get a signed letter confirming the Hong Kong entity is a controlled affiliate and that payment to it discharges the mainland invoice.",
      "Request the renewed ISO 9001 certificate before shipment release.",
    ],
    formTitle: "Get the full sample report",
    formLead:
      "Leave your email and we will send the complete sample report as a PDF with a one-page reading guide.",
    formEmailPlaceholder: "Your work email",
    formCta: "Send me the report",
    formPrivacyNote:
      "We only use your email to send the sample. No spam, unsubscribe anytime.",
    socialTitle: "Follow us for sourcing insights",
    socialNote: "Factory verification case studies and supplier-risk explainers.",
  },
  zh: {
    execSection: "01 · 执行摘要",
    execLead:
      "综合得分 76/100 由下方八个维度的得分汇总而成。每个维度都对照公开记录与现场证据核查。",
    strengthsTitle: "优势",
    strengths: [
      "注册地址与宝安区一栋 6200㎡ 工业厂房一致，视频核验已确认",
      "出口资质自 2016 年持续有效，无海关处罚记录",
      "连续三年税务信用评级 B 级",
      "2019 年以来股权结构稳定，无股权质押记录",
    ],
    concernsTitle: "需关注事项",
    concerns: [
      "2026 年 3 月美国买家提起的一起合同纠纷仍在审理中",
      "ISO 9001 证书 40 天后到期，需确认续证",
    ],
    profileNote: "数据来源：国家企业信用信息公示系统（GSXT）与深圳市市场监督管理局。",
    usccLabel: "统一社会信用代码",
    legalRepLabel: "法定代表人",
    capitalLabel: "注册资本",
    companyTypeValue: "有限责任公司",
    addressLabel: "注册地址",
    scopeLabel: "经营范围",
    ownershipSection: "03 · 股权结构",
    ownershipNote: "股东名册取自 GSXT，并与股权质押、冻结记录交叉核对。",
    shareholderLabel: "股东",
    stakeLabel: "持股比例",
    sinceLabel: "入股时间",
    ownershipAnalyst:
      "2019 年以来股权结构稳定。香港主体由同一法定代表人控制，与档案中的付款指令一致。",
    courtSection: "04 · 涉诉与执行记录",
    courtNote: "数据来源：中国裁判文书网与最高人民法院执行信息公开网。",
    caseTotalLabel: "案件总数（2019–2026）",
    caseOpenLabel: "审理中",
    caseDefendantLabel: "作为被告",
    enforcementLabel: "被执行人记录",
    courtSummary: "2026 年 3 月立案的一起买卖合同纠纷正在审理中；此前两起案件已结案，一起延迟交货案判供应商胜诉。",
    changesSection: "05 · 工商变更记录",
    changesNote: "工商变更全部公开。法定代表人或注册资本在近期发生变更，是静默风险最强的信号之一。",
    impactLow: "影响低",
    impactMedium: "影响中",
    changes: [
      {
        date: "2025 年 2 月",
        impact: "low",
        title: "经营范围扩增——新增医疗器械零部件",
        desc: "与买方的既定产品线一致。",
      },
      {
        date: "2023 年 6 月",
        impact: "medium",
        title: "注册资本增至 800 万元",
        desc: "已核实为实缴而非认缴。",
      },
      {
        date: "2022 年 8 月",
        impact: "medium",
        title: "列入经营异常名录",
        desc: "因年报逾期；六个月后移除。",
      },
    ],
    taxSection: "06 · 税务与进出口合规",
    taxNote: "供应商的税务评级，是判断其如何对待合同义务（包括对您的义务）的强有力指标。",
    taxLabels: {
      rating: "税务信用评级",
      vat: "增值税纳税人类型",
      customs: "海关备案号",
      export: "2025 年申报出口额",
      markets: "主要出口市场",
    },
    siteSection: "07 · 工厂实地核验",
    siteNote: "对注册地址进行卫星与街景影像核查，并进行一次实时、不预先排练的视频验厂。",
    siteCheckLabels: {
      address: "注册地址与实体厂房一致",
      signage: "厂房标牌与公司名称一致",
      video: "实时视频验厂",
      machinery: "设备与产品描述一致",
      workers: "视频验厂时在岗工人数",
    },
    certSection: "08 · 认证与知识产权",
    certNote: "在可行范围内，证书真伪均已对照发证机构登记系统核实。",
    certLabels: {
      certification: "认证项目",
      number: "证书编号",
      issued: "发证时间",
      status: "状态",
    },
    certStatusValid: "有效",
    certStatusOnfile: "已存档",
    ipNote: "实用新型专利 7 项、外观设计专利 3 项、注册商标 2 项。未发现针对该公司的知识产权侵权诉讼。",
    analystRole: "高级分析师 · 深圳团队",
    analystQuote: "一家经营 11 年的真实制造商，出口记录干净——但有两处细节需要在付款前确认。",
    actionsTitle: "付款前请完成两件事",
    recommendActions: [
      "取得一封盖章函件，确认香港主体为受控关联方，且向该主体付款即视为履行大陆发票义务。",
      "在发货前取得续期后的 ISO 9001 证书。",
    ],
    formTitle: "获取完整样例报告",
    formLead: "留下您的邮箱，我们会把完整样例报告（PDF）和一页阅读指南发送给您。",
    formEmailPlaceholder: "您的企业邮箱",
    formCta: "发送报告给我",
    formPrivacyNote: "我们仅用您的邮箱发送样例报告。不发送垃圾邮件，可随时退订。",
    socialTitle: "关注我们，获取采购洞察",
    socialNote: "验厂案例研究与供应商风险解读。",
  },
  es: {
    execSection: "01 · Resumen ejecutivo",
    execLead:
      "La puntuación global de 76/100 se compone de las ocho dimensiones siguientes. Cada dimensión se verifica contra registros públicos y evidencia in situ.",
    strengthsTitle: "Puntos fuertes",
    strengths: [
      "La dirección registrada coincide con una nave industrial de 6.200 m², confirmado por videollamada",
      "Licencia de exportación activa desde 2016 sin sanciones aduaneras",
      "Calificación fiscal B durante tres años consecutivos",
      "Propiedad sin cambios desde 2019, sin prendas de acciones registradas",
    ],
    concernsTitle: "Puntos de atención",
    concerns: [
      "Una disputa contractual abierta presentada por un comprador estadounidense en marzo de 2026, aún pendiente",
      "El certificado ISO 9001 caduca en 40 días; se requiere confirmación de renovación",
    ],
    profileNote:
      "Fuente: Sistema Nacional de Información Crediticia Empresarial (GSXT) y la Administración de Regulación del Mercado de Shenzhen.",
    usccLabel: "Código de crédito social unificado",
    legalRepLabel: "Representante legal",
    capitalLabel: "Capital registrado",
    companyTypeValue: "Sociedad de responsabilidad limitada",
    addressLabel: "Dirección registrada",
    scopeLabel: "Objeto social",
    ownershipSection: "03 · Propiedad y control",
    ownershipNote:
      "Registro de accionistas de GSXT, contrastado con registros de prendas y congelaciones de acciones.",
    shareholderLabel: "Accionista",
    stakeLabel: "Participación",
    sinceLabel: "Desde",
    ownershipAnalyst:
      "La propiedad se ha mantenido estable desde 2019. La entidad de Hong Kong está controlada por el mismo representante legal, en línea con las instrucciones de pago registradas.",
    courtSection: "04 · Litigios y ejecuciones",
    courtNote:
      "Fuente: China Judgements Online y el registro de ejecuciones del Tribunal Supremo del Pueblo.",
    caseTotalLabel: "Casos totales (2019–2026)",
    caseOpenLabel: "Abiertos",
    caseDefendantLabel: "Como demandado",
    enforcementLabel: "Ejecución (被执行人)",
    courtSummary:
      "Una disputa de contrato de compraventa (presentada en marzo de 2026) está pendiente. Dos casos anteriores se resolvieron; un caso de retraso de entrega se falló a favor del proveedor.",
    changesSection: "05 · Cambios registrales",
    changesNote:
      "Todo cambio registral es público. Los cambios tardíos de representante legal o capital son el predictor silencioso más fuerte de problemas.",
    impactLow: "Impacto bajo",
    impactMedium: "Impacto medio",
    changes: [
      {
        date: "Feb 2025",
        impact: "low",
        title: "Objeto social ampliado — componentes de dispositivos médicos",
        desc: "Coherente con la línea de productos declarada por el comprador.",
      },
      {
        date: "Jun 2023",
        impact: "medium",
        title: "Capital registrado aumentado a CNY 8M",
        desc: "Verificado como desembolsado, no solo suscrito.",
      },
      {
        date: "Ago 2022",
        impact: "medium",
        title: "Incluido en la lista de anomalías operativas",
        desc: "Informe anual tardío; eliminado seis meses después.",
      },
    ],
    taxSection: "06 · Cumplimiento fiscal y comercial",
    taxNote:
      "La calificación fiscal de un proveedor es un buen indicador de cómo trata sus obligaciones contractuales.",
    taxLabels: {
      rating: "Calificación fiscal",
      vat: "Régimen de IVA",
      customs: "Registro aduanero",
      export: "Volumen exportado declarado 2025",
      markets: "Principales destinos",
    },
    siteSection: "07 · Verificación de fábrica",
    siteNote:
      "Revisión de imágenes satelitales y de calle, más una videollamada en vivo sin guion de la dirección registrada.",
    siteCheckLabels: {
      address: "La dirección registrada coincide con el edificio físico",
      signage: "El rótulo coincide con el nombre de la empresa",
      video: "Videollamada de verificación en vivo",
      machinery: "La maquinaria coincide con los productos declarados",
      workers: "Trabajadores presentes durante la videollamada",
    },
    certSection: "08 · Certificaciones y propiedad intelectual",
    certNote:
      "La autenticidad de los certificados se verificó contra los registros del emisor cuando fue posible.",
    certLabels: {
      certification: "Certificación",
      number: "Número",
      issued: "Emitido",
      status: "Estado",
    },
    certStatusValid: "Válido",
    certStatusOnfile: "En archivo",
    ipNote:
      "7 patentes de modelo de utilidad, 3 patentes de diseño, 2 marcas registradas. Sin demandas por infracción de PI.",
    analystRole: "Analista senior · Mesa de Shenzhen",
    analystQuote:
      "Un fabricante real con once años de historia y expediente exportador limpio — pero dos cabos sueltos que resolver antes de transferir el saldo.",
    actionsTitle: "Antes de transferir el saldo",
    recommendActions: [
      "Obtener una carta firmada que confirme que la entidad de Hong Kong es una afiliada controlada y que el pago a ella libera la factura continental.",
      "Solicitar el certificado ISO 9001 renovado antes de la liberación del envío.",
    ],
    formTitle: "Obtenga el informe de muestra completo",
    formLead:
      "Deje su correo y le enviaremos el informe de muestra completo en PDF con una guía de lectura de una página.",
    formEmailPlaceholder: "Su correo laboral",
    formCta: "Enviarme el informe",
    formPrivacyNote:
      "Solo usamos su correo para enviar la muestra. Sin spam, cancelación en cualquier momento.",
    socialTitle: "Síganos para obtener perspectivas de compra",
    socialNote: "Casos prácticos de verificación de fábricas y explicaciones sobre riesgo de proveedores.",
  },
  de: {
    execSection: "01 · Zusammenfassung",
    execLead:
      "Die Gesamtbewertung von 76/100 setzt sich aus den acht unten stehenden Dimensionswerten zusammen. Jede Dimension wird anhand öffentlicher Aufzeichnungen und Vor-Ort-Beweisen geprüft.",
    strengthsTitle: "Stärken",
    strengths: [
      "Registrierte Adresse entspricht einem Industriegebäude mit 6.200 m², per Video-Walkthrough bestätigt",
      "Exportlizenz seit 2016 aktiv, keine Zollstrafen",
      "Steuerbonität B seit drei aufeinanderfolgenden Jahren",
      "Eigentümerstruktur seit 2019 unverändert, keine Anteilsverpfändungen",
    ],
    concernsTitle: "Zu prüfende Punkte",
    concerns: [
      "Ein offener Vertragsstreit, eingereicht von einem US-Käufer im März 2026, noch anhängig",
      "ISO-9001-Zertifikat läuft in 40 Tagen ab, Verlängerung erforderlich",
    ],
    profileNote:
      "Quelle: Nationales System zur Unternehmenskreditinformation (GSXT) und die Marktaufsichtsbehörde von Shenzhen.",
    usccLabel: "Einheitlicher Sozialkredit-Code",
    legalRepLabel: "Gesetzlicher Vertreter",
    capitalLabel: "Registriertes Kapital",
    companyTypeValue: "Gesellschaft mit beschränkter Haftung",
    addressLabel: "Registrierte Adresse",
    scopeLabel: "Geschäftszweck",
    ownershipSection: "03 · Eigentum und Kontrolle",
    ownershipNote:
      "Aktionärsregister aus GSXT, abgeglichen mit Verpfändungs- und Einfrierungsregistern.",
    shareholderLabel: "Aktionär",
    stakeLabel: "Anteil",
    sinceLabel: "Seit",
    ownershipAnalyst:
      "Die Eigentümerstruktur ist seit 2019 stabil. Das Hongkong-Unternehmen wird vom selben gesetzlichen Vertreter kontrolliert, konsistent mit den Zahlungsanweisungen in den Akten.",
    courtSection: "04 · Gerichts- und Vollstreckungsverfahren",
    courtNote:
      "Quelle: China Judgements Online und das Vollstreckungsregister des Obersten Volksgerichts.",
    caseTotalLabel: "Fälle gesamt (2019–2026)",
    caseOpenLabel: "Offen",
    caseDefendantLabel: "Als Beklagter",
    enforcementLabel: "Vollstreckung (被执行人)",
    courtSummary:
      "Ein Vertragsstreit (eingereicht März 2026) ist anhängig. Zwei frühere Fälle wurden beigelegt; ein Lieferverzugsfall wurde zugunsten des Lieferanten entschieden.",
    changesSection: "05 · Registeränderungen",
    changesNote:
      "Jede Registeränderung ist öffentlich. Späte Änderungen bei Vertreter oder Kapital sind der stärkste stille Indikator für Probleme.",
    impactLow: "Geringe Auswirkung",
    impactMedium: "Mittlere Auswirkung",
    changes: [
      {
        date: "Feb 2025",
        impact: "low",
        title: "Geschäftszweck erweitert — Komponenten für Medizinprodukte",
        desc: "Konsistent mit der deklarierten Produktlinie des Käufers.",
      },
      {
        date: "Jun 2023",
        impact: "medium",
        title: "Registriertes Kapital auf 8 Mio. CNY erhöht",
        desc: "Als eingezahlt verifiziert, nicht nur gezeichnet.",
      },
      {
        date: "Aug 2022",
        impact: "medium",
        title: "Auf Liste betrieblicher Auffälligkeiten",
        desc: "Verspäteter Jahresbericht; sechs Monate später entfernt.",
      },
    ],
    taxSection: "06 · Steuer- und Handelskonformität",
    taxNote:
      "Die Steuerbonität eines Lieferanten ist ein starker Indikator dafür, wie er vertragliche Pflichten behandelt.",
    taxLabels: {
      rating: "Steuerbonität",
      vat: "Mehrwertsteuerstatus",
      customs: "Zollregistrierung",
      export: "Deklariertes Exportvolumen 2025",
      markets: "Hauptziele",
    },
    siteSection: "07 · Werksverifizierung",
    siteNote:
      "Satelliten- und Straßenbildprüfung sowie ein ungeskripteter Video-Walkthrough der registrierten Adresse.",
    siteCheckLabels: {
      address: "Registrierte Adresse entspricht dem physischen Gebäude",
      signage: "Beschilderung entspricht dem Firmennamen",
      video: "Live-Video-Walkthrough",
      machinery: "Maschinen entsprechen den Produktangaben",
      workers: "Arbeiter im Werk während des Walkthroughs",
    },
    certSection: "08 · Zertifizierungen und geistiges Eigentum",
    certNote:
      "Die Authentizität der Zertifikate wurde soweit möglich gegen Ausstellerregister geprüft.",
    certLabels: {
      certification: "Zertifizierung",
      number: "Nummer",
      issued: "Ausgestellt",
      status: "Status",
    },
    certStatusValid: "Gültig",
    certStatusOnfile: "Aktenkundig",
    ipNote:
      "7 Gebrauchsmuster, 3 Geschmacksmuster, 2 eingetragene Marken. Keine IP-Verletzungsklagen gegen das Unternehmen.",
    analystRole: "Senior-Analyst · Standort Shenzhen",
    analystQuote:
      "Ein echter Hersteller mit elfjähriger Geschichte und sauberen Exportakten — aber zwei offene Punkte vor der Überweisung des Restbetrags.",
    actionsTitle: "Vor der Überweisung des Restbetrags",
    recommendActions: [
      "Ein unterzeichnetes Schreiben einholen, das bestätigt, dass das Hongkong-Unternehmen eine kontrollierte Tochter ist und die Zahlung an sie die Festlandrechnung begleicht.",
      "Das verlängerte ISO-9001-Zertifikat vor der Versandfreigabe anfordern.",
    ],
    formTitle: "Den vollständigen Beispielbericht erhalten",
    formLead:
      "Hinterlassen Sie Ihre E-Mail und wir senden Ihnen den vollständigen Beispielbericht als PDF mit einer einseitigen Leseanleitung.",
    formEmailPlaceholder: "Ihre geschäftliche E-Mail",
    formCta: "Bericht senden",
    formPrivacyNote:
      "Wir nutzen Ihre E-Mail nur zum Versand der Beispielprobe. Kein Spam, jederzeit abbestellbar.",
    socialTitle: "Folgen Sie uns für Einkaufseinblicke",
    socialNote: "Werksprüfungs-Fallstudien und Lieferantenrisiko-Erklärungen.",
  },
  fr: {
    execSection: "01 · Résumé exécutif",
    execLead:
      "Le score global de 76/100 est construit à partir des huit dimensions ci-dessous. Chaque dimension est vérifiée sur la base de registres publics et de preuves sur site.",
    strengthsTitle: "Points forts",
    strengths: [
      "L'adresse enregistrée correspond à un bâtiment industriel de 6 200 m², confirmé par visite vidéo",
      "Licence d'exportation active depuis 2016 sans pénalités douanières",
      "Notation fiscale B depuis trois années consécutives",
      "Actionnariat inchangé depuis 2019, aucun nantissement d'actions",
    ],
    concernsTitle: "Points d'attention",
    concerns: [
      "Un litige contractuel ouvert déposé par un acheteur américain en mars 2026, toujours en cours",
      "Le certificat ISO 9001 expire dans 40 jours, confirmation de renouvellement requise",
    ],
    profileNote:
      "Source : Système national d'information sur le crédit des entreprises (GSXT) et Administration de régulation du marché de Shenzhen.",
    usccLabel: "Code de crédit social unifié",
    legalRepLabel: "Représentant légal",
    capitalLabel: "Capital enregistré",
    companyTypeValue: "Société à responsabilité limitée",
    addressLabel: "Adresse enregistrée",
    scopeLabel: "Objet social",
    ownershipSection: "03 · Actionnariat et contrôle",
    ownershipNote:
      "Registre des actionnaires issu du GSXT, recoupé avec les registres de nantissements et de gels d'actions.",
    shareholderLabel: "Actionnaire",
    stakeLabel: "Participation",
    sinceLabel: "Depuis",
    ownershipAnalyst:
      "L'actionnariat est stable depuis 2019. L'entité de Hong Kong est contrôlée par le même représentant légal, cohérent avec les instructions de paiement au dossier.",
    courtSection: "04 · Litiges et exécutions",
    courtNote:
      "Source : China Judgements Online et le registre des exécutions de la Cour suprême du peuple.",
    caseTotalLabel: "Total des dossiers (2019–2026)",
    caseOpenLabel: "En cours",
    caseDefendantLabel: "Comme défendeur",
    enforcementLabel: "Exécution (被执行人)",
    courtSummary:
      "Un litige de contrat de vente (déposé en mars 2026) est en cours. Deux affaires antérieures ont été réglées ; un cas de retard de livraison a été tranché en faveur du fournisseur.",
    changesSection: "05 · Modifications du registre",
    changesNote:
      "Chaque modification du registre est publique. Les changements tardifs de représentant légal ou de capital sont le meilleur indicateur silencieux de problèmes.",
    impactLow: "Impact faible",
    impactMedium: "Impact moyen",
    changes: [
      {
        date: "Fév 2025",
        impact: "low",
        title: "Objet social élargi — composants de dispositifs médicaux",
        desc: "Cohérent avec la gamme déclarée de l'acheteur.",
      },
      {
        date: "Juin 2023",
        impact: "medium",
        title: "Capital enregistré porté à 8 M CNY",
        desc: "Vérifié comme libéré, pas seulement souscrit.",
      },
      {
        date: "Août 2022",
        impact: "medium",
        title: "Inscrit sur la liste des anomalies opérationnelles",
        desc: "Rapport annuel en retard ; retiré six mois plus tard.",
      },
    ],
    taxSection: "06 · Conformité fiscale et commerciale",
    taxNote:
      "La notation fiscale d'un fournisseur est un bon indicateur de sa manière de traiter ses obligations contractuelles.",
    taxLabels: {
      rating: "Notation fiscale",
      vat: "Statut TVA",
      customs: "Enregistrement douanier",
      export: "Volume d'exportation déclaré 2025",
      markets: "Principales destinations",
    },
    siteSection: "07 · Vérification de l'usine",
    siteNote:
      "Examen d'images satellite et de rue, plus une visite vidéo en direct non scénarisée de l'adresse enregistrée.",
    siteCheckLabels: {
      address: "L'adresse enregistrée correspond au bâtiment physique",
      signage: "L'enseigne correspond au nom de l'entreprise",
      video: "Visite vidéo en direct",
      machinery: "Les machines correspondent aux produits déclarés",
      workers: "Ouvriers présents pendant la visite",
    },
    certSection: "08 · Certifications et propriété intellectuelle",
    certNote:
      "L'authenticité des certificats a été vérifiée auprès des registres des émetteurs lorsque possible.",
    certLabels: {
      certification: "Certification",
      number: "Numéro",
      issued: "Délivré",
      status: "Statut",
    },
    certStatusValid: "Valide",
    certStatusOnfile: "Au dossier",
    ipNote:
      "7 brevets de modèle d'utilité, 3 brevets de dessin, 2 marques déposées. Aucune action en contrefaçon contre l'entreprise.",
    analystRole: "Analyste senior · Bureau de Shenzhen",
    analystQuote:
      "Un vrai fabricant avec onze ans d'histoire et un dossier d'exportation propre — mais deux points à régler avant de virer le solde.",
    actionsTitle: "Avant de virer le solde",
    recommendActions: [
      "Obtenir une lettre signée confirmant que l'entité de Hong Kong est une filiale contrôlée et que le paiement qui lui est fait libère la facture continentale.",
      "Demander le certificat ISO 9001 renouvelé avant la libération de l'expédition.",
    ],
    formTitle: "Recevoir le rapport d'exemple complet",
    formLead:
      "Laissez votre e-mail et nous vous enverrons le rapport complet en PDF avec un guide de lecture d'une page.",
    formEmailPlaceholder: "Votre e-mail professionnel",
    formCta: "Envoyez-moi le rapport",
    formPrivacyNote:
      "Nous n'utilisons votre e-mail que pour envoyer l'échantillon. Pas de spam, désinscription à tout moment.",
    socialTitle: "Suivez-nous pour des conseils d'approvisionnement",
    socialNote: "Études de cas de vérification d'usines et analyses du risque fournisseur.",
  },
  pt: {
    execSection: "01 · Resumo executivo",
    execLead:
      "A pontuação geral de 76/100 é formada pelas oito dimensões abaixo. Cada dimensão é verificada contra registros públicos e evidências in loco.",
    strengthsTitle: "Pontos fortes",
    strengths: [
      "Endereço registrado corresponde a um prédio industrial de 6.200 m², confirmado por vídeo",
      "Licença de exportação ativa desde 2016, sem penalidades alfandegárias",
      "Classificação fiscal B por três anos consecutivos",
      "Estrutura societária estável desde 2019, sem penhor de ações",
    ],
    concernsTitle: "Pontos de atenção",
    concerns: [
      "Uma disputa contratual aberta por um comprador americano em março de 2026, ainda pendente",
      "Certificado ISO 9001 expira em 40 dias, confirmação de renovação necessária",
    ],
    profileNote:
      "Fonte: Sistema Nacional de Informações de Crédito Empresarial (GSXT) e Administração de Regulação do Mercado de Shenzhen.",
    usccLabel: "Código de crédito social unificado",
    legalRepLabel: "Representante legal",
    capitalLabel: "Capital registrado",
    companyTypeValue: "Sociedade limitada",
    addressLabel: "Endereço registrado",
    scopeLabel: "Objeto social",
    ownershipSection: "03 · Propriedade e controle",
    ownershipNote:
      "Registro de acionistas do GSXT, cruzado com registros de penhor e congelamento de ações.",
    shareholderLabel: "Acionista",
    stakeLabel: "Participação",
    sinceLabel: "Desde",
    ownershipAnalyst:
      "A estrutura societária é estável desde 2019. A entidade de Hong Kong é controlada pelo mesmo representante legal, consistente com as instruções de pagamento registradas.",
    courtSection: "04 · Registros judiciais e de execução",
    courtNote:
      "Fonte: China Judgements Online e o registro de execuções do Supremo Tribunal Popular.",
    caseTotalLabel: "Total de casos (2019–2026)",
    caseOpenLabel: "Em aberto",
    caseDefendantLabel: "Como réu",
    enforcementLabel: "Execução (被执行人)",
    courtSummary:
      "Uma disputa de contrato de compra e venda (março de 2026) está pendente. Dois casos anteriores foram encerrados; um caso de atraso de entrega foi julgado a favor do fornecedor.",
    changesSection: "05 · Alterações cadastrais",
    changesNote:
      "Toda alteração cadastral é pública. Mudanças tardias de representante legal ou capital são o indicador silencioso mais forte de problemas.",
    impactLow: "Baixo impacto",
    impactMedium: "Impacto médio",
    changes: [
      {
        date: "Fev 2025",
        impact: "low",
        title: "Objeto social ampliado — componentes de dispositivos médicos",
        desc: "Consistente com a linha de produtos declarada pelo comprador.",
      },
      {
        date: "Jun 2023",
        impact: "medium",
        title: "Capital registrado aumentado para CNY 8M",
        desc: "Verificado como integralizado, não apenas subscrito.",
      },
      {
        date: "Ago 2022",
        impact: "medium",
        title: "Incluído na lista de anormalidades operacionais",
        desc: "Relatório anual atrasado; removido seis meses depois.",
      },
    ],
    taxSection: "06 · Conformidade fiscal e comercial",
    taxNote:
      "A classificação fiscal de um fornecedor é um forte indicador de como ele trata obrigações contratuais.",
    taxLabels: {
      rating: "Classificação fiscal",
      vat: "Status de IVA",
      customs: "Registro alfandegário",
      export: "Volume exportado declarado 2025",
      markets: "Principais destinos",
    },
    siteSection: "07 · Verificação da fábrica",
    siteNote:
      "Revisão de imagens de satélite e de rua, além de uma vídeo visita ao vivo sem roteiro do endereço registrado.",
    siteCheckLabels: {
      address: "Endereço registrado corresponde ao prédio físico",
      signage: "Placa corresponde ao nome da empresa",
      video: "Vídeo visita ao vivo",
      machinery: "Maquinário corresponde aos produtos declarados",
      workers: "Trabalhadores presentes durante a vídeo visita",
    },
    certSection: "08 · Certificações e propriedade intelectual",
    certNote:
      "A autenticidade dos certificados foi verificada nos registros dos emissores quando possível.",
    certLabels: {
      certification: "Certificação",
      number: "Número",
      issued: "Emitido",
      status: "Status",
    },
    certStatusValid: "Válido",
    certStatusOnfile: "Em arquivo",
    ipNote:
      "7 patentes de modelo de utilidade, 3 patentes de desenho, 2 marcas registradas. Nenhuma ação de violação de PI contra a empresa.",
    analystRole: "Analista sênior · Mesa de Shenzhen",
    analystQuote:
      "Um fabricante real com onze anos de história e registro de exportação limpo — mas duas pontas soltas para resolver antes de transferir o saldo.",
    actionsTitle: "Antes de transferir o saldo",
    recommendActions: [
      "Obter uma carta assinada confirmando que a entidade de Hong Kong é uma afiliada controlada e que o pagamento a ela quita a fatura continental.",
      "Solicitar o certificado ISO 9001 renovado antes da liberação do embarque.",
    ],
    formTitle: "Receba o relatório de amostra completo",
    formLead:
      "Deixe seu e-mail e enviaremos o relatório completo em PDF com um guia de leitura de uma página.",
    formEmailPlaceholder: "Seu e-mail corporativo",
    formCta: "Enviar relatório",
    formPrivacyNote:
      "Usamos seu e-mail apenas para enviar a amostra. Sem spam, cancele quando quiser.",
    socialTitle: "Siga-nos para dicas de sourcing",
    socialNote: "Estudos de caso de verificação de fábricas e análises de risco de fornecedores.",
  },
  ja: {
    execSection: "01 · エグゼクティブサマリー",
    execLead:
      "総合スコア76/100は、以下の8つのディメンションのスコアから構成されます。各ディメンションは公開記録と現地調査の証拠に照らして確認されます。",
    strengthsTitle: "強み",
    strengths: [
      "登録住所が宝安区の6,200㎡の工業ビルと一致（ビデオウォークスルーで確認）",
      "2016年以降輸出許可が有効、税関処罰なし",
      "3年連続で納税信用格付B",
      "2019年以降株主構成に変更なし、株式質入れの記録なし",
    ],
    concernsTitle: "注意事項",
    concerns: [
      "2026年3月に米国バイヤーが提起した契約紛争が係争中",
      "ISO 9001認証が40日後に失効、更新確認が必要",
    ],
    profileNote: "出典：国家企業信用情報公示システム（GSXT）および深セン市市場監督管理局。",
    usccLabel: "統一社会信用コード",
    legalRepLabel: "法定代表者",
    capitalLabel: "登録資本",
    companyTypeValue: "有限責任公司",
    addressLabel: "登録住所",
    scopeLabel: "事業範囲",
    ownershipSection: "03 · 所有と支配構造",
    ownershipNote: "株主名簿はGSXTから取得し、株式質入れ・差し押さえ記録と照合。",
    shareholderLabel: "株主",
    stakeLabel: "保有比率",
    sinceLabel: "取得時期",
    ownershipAnalyst:
      "2019年以降、株主構成は安定しています。香港の法人は同一の法定代表者が支配しており、ファイル上の支払い指示と整合します。",
    courtSection: "04 · 訴訟・執行記録",
    courtNote: "出典：中国裁判文書網および最高人民法院執行情報公開網。",
    caseTotalLabel: "訴訟総数（2019–2026）",
    caseOpenLabel: "係争中",
    caseDefendantLabel: "被告として",
    enforcementLabel: "被執行人記録",
    courtSummary:
      "2026年3月提起の売買契約紛争が係争中。過去2件は和解、納期遅延1件は供給者勝訴の判決。",
    changesSection: "05 · 登記変更記録",
    changesNote:
      "登記変更はすべて公開されています。法定代表者や資本の直近の変更は、問題の最も強い静かな予兆です。",
    impactLow: "影響度：低",
    impactMedium: "影響度：中",
    changes: [
      {
        date: "2025年2月",
        impact: "low",
        title: "事業範囲の拡大——医療機器部品を追加",
        desc: "バイヤーの申告製品ラインと一致。",
      },
      {
        date: "2023年6月",
        impact: "medium",
        title: "登録資本を800万元に増資",
        desc: "払込済み（単なる申込ではない）と確認。",
      },
      {
        date: "2022年8月",
        impact: "medium",
        title: "経営異常名簿に記載",
        desc: "年次報告の遅延によるもの。6か月後に解除。",
      },
    ],
    taxSection: "06 · 税務・輸出入コンプライアンス",
    taxNote:
      "供給者の納税信用格付は、契約上の義務をどう扱うかを示す有力な指標です。",
    taxLabels: {
      rating: "納税信用格付",
      vat: "付加価値税区分",
      customs: "税関登録番号",
      export: "2025年申告輸出額",
      markets: "主要輸出先",
    },
    siteSection: "07 · 工場現地検証",
    siteNote:
      "登録住所の衛星・ストリートビュー調査に加え、台本なしのライブビデオウォークスルーを実施。",
    siteCheckLabels: {
      address: "登録住所と実在建物の一致",
      signage: "看板と会社名の一致",
      video: "ライブビデオウォークスルー",
      machinery: "設備と製品説明の一致",
      workers: "ウォークスルー時の従業員数",
    },
    certSection: "08 · 認証と知的財産",
    certNote: "可能な範囲で、認証の真正性を発行機関の登録と照合。",
    certLabels: {
      certification: "認証",
      number: "番号",
      issued: "発行",
      status: "ステータス",
    },
    certStatusValid: "有効",
    certStatusOnfile: "保管中",
    ipNote:
      "実用新案7件、意匠3件、登録商標2件。同社に対する知的財産権侵害訴訟なし。",
    analystRole: "シニアアナリスト · 深セン拠点",
    analystQuote:
      "11年の歴史を持つ実在のメーカーで輸出記録もクリーン——ただし残金振込前に確認すべき点が2つあります。",
    actionsTitle: "残金振込前の確認事項",
    recommendActions: [
      "香港法人が支配下の関連会社であること、および同社への支払いが中国本土の請求書の支払いを満たすことを確認する署名入り書面を取得する。",
      "出荷前に更新済みのISO 9001認証を入手する。",
    ],
    formTitle: "完全なサンプルレポートを受け取る",
    formLead:
      "メールアドレスを残していただければ、完全なサンプルレポート（PDF）と1ページの読み方ガイドをお送りします。",
    formEmailPlaceholder: "勤務先メールアドレス",
    formCta: "レポートを送る",
    formPrivacyNote:
      "メールはサンプル送付にのみ使用します。迷惑メールは送信せず、いつでも購読解除できます。",
    socialTitle: "調達のヒントをフォロー",
    socialNote: "工場検証のケーススタディとサプライヤーリスク解説。",
  },
  "zh-TW": {
    execSection: "01 · 執行摘要",
    execLead: "綜合得分 76/100 由下方八個維度的得分匯總而成。每個維度皆對照公開紀錄與現場證據查核。",
    strengthsTitle: "優勢",
    strengths: [
      "註冊地址與寶安區一棟 6200㎡ 工業廠房一致，影片核驗已確認",
      "出口資格自 2016 年持續有效，無海關處罰紀錄",
      "連續三年稅務信用評級 B 級",
      "2019 年以來股權結構穩定，無股權質押紀錄",
    ],
    concernsTitle: "需關注事項",
    concerns: [
      "2026 年 3 月美國買家提起的一起合約糾紛仍在審理中",
      "ISO 9001 證書 40 天後到期，需確認續證",
    ],
    profileNote: "資料來源：國家企業信用資訊公示系統（GSXT）與深圳市市場監督管理局。",
    usccLabel: "統一社會信用代碼",
    legalRepLabel: "法定代表人",
    capitalLabel: "註冊資本",
    companyTypeValue: "有限責任公司",
    addressLabel: "註冊地址",
    scopeLabel: "經營範圍",
    ownershipSection: "03 · 股權結構",
    ownershipNote: "股東名冊取自 GSXT，並與股權質押、凍結紀錄交叉核對。",
    shareholderLabel: "股東",
    stakeLabel: "持股比例",
    sinceLabel: "入股時間",
    ownershipAnalyst:
      "2019 年以來股權結構穩定。香港主體由同一法定代表人控制，與檔案中的付款指示一致。",
    courtSection: "04 · 涉訴與執行紀錄",
    courtNote: "資料來源：中國裁判文書網與最高人民法院執行資訊公開網。",
    caseTotalLabel: "案件總數（2019–2026）",
    caseOpenLabel: "審理中",
    caseDefendantLabel: "作為被告",
    enforcementLabel: "被執行人紀錄",
    courtSummary:
      "2026 年 3 月立案的一起買賣合約糾紛正在審理中；此前兩起案件已結案，一起延遲交貨案判供應商勝訴。",
    changesSection: "05 · 工商變更紀錄",
    changesNote: "工商變更全部公開。法定代表人或資本在近期發生變更，是靜默風險最強的訊號之一。",
    impactLow: "影響低",
    impactMedium: "影響中",
    changes: [
      {
        date: "2025 年 2 月",
        impact: "low",
        title: "經營範圍擴增——新增醫療器材零組件",
        desc: "與買方的既定產品線一致。",
      },
      {
        date: "2023 年 6 月",
        impact: "medium",
        title: "註冊資本增至 800 萬元",
        desc: "已核實為實繳而非認繳。",
      },
      {
        date: "2022 年 8 月",
        impact: "medium",
        title: "列入經營異常名錄",
        desc: "因年報逾期；六個月後移除。",
      },
    ],
    taxSection: "06 · 稅務與進出口合規",
    taxNote: "供應商的稅務評級，是判斷其如何對待合約義務（包括對您的義務）的強有力指標。",
    taxLabels: {
      rating: "稅務信用評級",
      vat: "增值稅納稅人類型",
      customs: "海關備案號",
      export: "2025 年申報出口額",
      markets: "主要出口市場",
    },
    siteSection: "07 · 工廠實地核驗",
    siteNote: "對註冊地址進行衛星與街景影像查核，並進行一次即時、未預先排練的影片驗廠。",
    siteCheckLabels: {
      address: "註冊地址與實體廠房一致",
      signage: "廠房標牌與公司名稱一致",
      video: "即時影片驗廠",
      machinery: "設備與產品描述一致",
      workers: "影片驗廠時在崗工人數",
    },
    certSection: "08 · 認證與智慧財產權",
    certNote: "在可行範圍內，證書真偽均已對照發證機構登記系統核實。",
    certLabels: {
      certification: "認證項目",
      number: "證書編號",
      issued: "發證時間",
      status: "狀態",
    },
    certStatusValid: "有效",
    certStatusOnfile: "已存檔",
    ipNote:
      "新型專利 7 項、設計專利 3 項、註冊商標 2 項。未發現針對該公司的智慧財產權侵權訴訟。",
    analystRole: "資深分析師 · 深圳團隊",
    analystQuote: "一家經營 11 年的真實製造商，出口紀錄乾淨——但有兩處細節需要在付款前確認。",
    actionsTitle: "付款前請完成兩件事",
    recommendActions: [
      "取得一封蓋章函件，確認香港主體為受控關聯方，且向該主體付款即視為履行大陸發票義務。",
      "在出貨前取得續期後的 ISO 9001 證書。",
    ],
    formTitle: "取得完整範例報告",
    formLead: "留下您的信箱，我們會把完整範例報告（PDF）和一頁閱讀指南發送給您。",
    formEmailPlaceholder: "您的公司信箱",
    formCta: "發送報告給我",
    formPrivacyNote: "我們僅用您的信箱發送範例報告。不發送垃圾郵件，可隨時退訂。",
    socialTitle: "關注我們，獲取採購洞察",
    socialNote: "驗廠案例研究與供應商風險解讀。",
  },
  ar: {
    execSection: "01 · الملخص التنفيذي",
    execLead:
      "تتكون النتيجة الإجمالية 76/100 من درجات الأبعاد الثمانية أدناه. يتم التحقق من كل بُعد مقابل السجلات العامة والأدلة الميدانية.",
    strengthsTitle: "نقاط القوة",
    strengths: [
      "العنوان المسجل يطابق مبنى صناعياً مساحته 6,200 م²، مؤكد بجولة فيديو",
      "رخصة التصدير نشطة منذ 2016 دون غرامات جمركية",
      "تصنيف ائتماني ضريبي B لثلاث سنوات متتالية",
      "هيكل الملكية مستقر منذ 2019، دون رهن أسهم مسجل",
    ],
    concernsTitle: "نقاط تستدعي الانتباه",
    concerns: [
      "نزاع تعاقدي مفتوح قدمه مشترٍ أمريكي في مارس 2026، لا يزال قيد النظر",
      "شهادة ISO 9001 تنتهي خلال 40 يوماً، يلزم تأكيد التجديد",
    ],
    profileNote:
      "المصدر: النظام الوطني لمعلومات الائتمان المؤسسي (GSXT) وإدارة تنظيم السوق في شنتشن.",
    usccLabel: "رمز الائتمان الاجتماعي الموحد",
    legalRepLabel: "الممثل القانوني",
    capitalLabel: "رأس المال المسجل",
    companyTypeValue: "شركة ذات مسؤولية محدودة",
    addressLabel: "العنوان المسجل",
    scopeLabel: "نطاق الأعمال",
    ownershipSection: "03 · الملكية والسيطرة",
    ownershipNote:
      "سجل المساهمين من GSXT، مُدقق مع سجلات رهن الأسهم وتجميدها.",
    shareholderLabel: "المساهم",
    stakeLabel: "الحصة",
    sinceLabel: "منذ",
    ownershipAnalyst:
      "هيكل الملكية مستقر منذ 2019. الكيان في هونغ كونغ تسيطر عليه نفس الجهة القانونية، بما يتوافق مع تعليمات الدفع المسجلة.",
    courtSection: "04 · سجلات الدعاوى والتنفيذ",
    courtNote:
      "المصدر: موقع أحكام الصين على الإنترنت وسجل التنفيذ للمحكمة الشعبية العليا.",
    caseTotalLabel: "إجمالي القضايا (2019–2026)",
    caseOpenLabel: "قيد النظر",
    caseDefendantLabel: "كمدعى عليه",
    enforcementLabel: "سجل المنفذ ضده (被执行人)",
    courtSummary:
      "نزاع عقد بيع واحد (قدم في مارس 2026) قيد النظر. حُسمت قضيتان سابقتان؛ وحُكم في قضية تأخير تسليم لصالح المورد.",
    changesSection: "05 · تغييرات السجل",
    changesNote:
      "كل تغيير في السجل علني. التغييرات المتأخرة في الممثل القانوني أو رأس المال هي أقوى مؤشر صامت على المشاكل.",
    impactLow: "تأثير منخفض",
    impactMedium: "تأثير متوسط",
    changes: [
      {
        date: "فبراير 2025",
        impact: "low",
        title: "توسيع نطاق الأعمال — مكونات الأجهزة الطبية",
        desc: "متسق مع خط الإنتاج المُعلن من المشتري.",
      },
      {
        date: "يونيو 2023",
        impact: "medium",
        title: "زيادة رأس المال المسجل إلى 8 ملايين يوان",
        desc: "تحققنا من أنه مدفوع فعلاً وليس مكتتباً فقط.",
      },
      {
        date: "أغسطس 2022",
        impact: "medium",
        title: "الإدراج في قائمة المخالفات التشغيلية",
        desc: "بسبب تأخر التقرير السنوي؛ أزيل بعد ستة أشهر.",
      },
    ],
    taxSection: "06 · الامتثال الضريبي والتجاري",
    taxNote:
      "التصنيف الضريبي للمورد مؤشر قوي على كيفية تعامله مع الالتزامات التعاقدية.",
    taxLabels: {
      rating: "التصنيف الائتماني الضريبي",
      vat: "حالة ضريبة القيمة المضافة",
      customs: "التسجيل الجمركي",
      export: "حجم الصادرات المصرح به 2025",
      markets: "أبرز الوجهات",
    },
    siteSection: "07 · التحقق من المصنع",
    siteNote:
      "مراجعة صور الأقمار الصناعية وخرائط الشوارع، بالإضافة إلى جولة فيديو مباشرة غير مسبوقة للعنوان المسجل.",
    siteCheckLabels: {
      address: "العنوان المسجل يطابق المبنى الفعلي",
      signage: "اللافتات تطابق اسم الشركة",
      video: "جولة فيديو مباشرة",
      machinery: "المعدات تطابق المنتجات المعلنة",
      workers: "عدد العمال أثناء الجولة",
    },
    certSection: "08 · الشهادات والملكية الفكرية",
    certNote:
      "تم التحقق من صحة الشهادات مقابل سجلات الجهات المصدرة حيثما أمكن.",
    certLabels: {
      certification: "الشهادة",
      number: "الرقم",
      issued: "تاريخ الإصدار",
      status: "الحالة",
    },
    certStatusValid: "سارية",
    certStatusOnfile: "في الملف",
    ipNote:
      "7 براءات اختراع نموذجية، 3 براءات تصميم، علامتان مسجلتان. لا توجد دعاوى انتهاك ملكية فكرية ضد الشركة.",
    analystRole: "محلل أول · فريق شنتشن",
    analystQuote:
      "مصنع حقيقي بتاريخ 11 عاماً وسجل تصدير نظيف — لكن هناك نقطتان يجب حلهما قبل تحويل الرصيد.",
    actionsTitle: "قبل تحويل الرصيد",
    recommendActions: [
      "الحصول على خطاب موقّع يؤكد أن الكيان في هونغ كونغ شركة تابعة خاضعة للسيطرة وأن الدفع إليه يُبرئ الفاتورة القارية.",
      "طلب شهادة ISO 9001 المجددة قبل الإفراج عن الشحنة.",
    ],
    formTitle: "احصل على تقرير العينة الكامل",
    formLead:
      "اترك بريدك الإلكتروني وسنرسل لك تقرير العينة الكامل بصيغة PDF مع دليل قراءة من صفحة واحدة.",
    formEmailPlaceholder: "بريدك الإلكتروني للعمل",
    formCta: "أرسل لي التقرير",
    formPrivacyNote:
      "نستخدم بريدك فقط لإرسال العينة. لا رسائل مزعجة، يمكنك إلغاء الاشتراك في أي وقت.",
    socialTitle: "تابعنا للحصول على رؤى التوريد",
    socialNote: "دراسات حالات التحقق من المصانع وشرح مخاطر الموردين.",
  },
};

// 深合并：叶子键仅当 target 缺失时才写入（幂等）
function applyPatch(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (target[k] === undefined) {
      target[k] = v;
    } else if (v && typeof v === "object" && !Array.isArray(v) && typeof target[k] === "object" && !Array.isArray(target[k])) {
      applyPatch(target[k], v);
    }
    // 数组（如 strengths/changes/faq）整体缺失才注入，避免替换既有数组
  }
}

let addedTotal = 0;
for (const lang of LANGS) {
  const file = path.join(DICT_DIR, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = JSON.stringify(dict);
  applyPatch(dict.sampleReport, PATCH[lang]);
  const after = JSON.stringify(dict);
  fs.writeFileSync(file, after + "\n", "utf8");
  const diff = [...new Set(Object.keys(PATCH[lang]).filter((k) => !before.includes(`"${k}"`) && after.includes(`"${k}"`)))];
  addedTotal += diff.length;
  console.log(`[${lang}] sampleReport 新增键: ${diff.length}`);
}
console.log(`全部完成，共注入 ${addedTotal} 个新键（幂等，重复运行不会叠加）`);
