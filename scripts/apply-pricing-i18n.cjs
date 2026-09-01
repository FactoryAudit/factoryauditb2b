/**
 * 手写补齐定价页（pricing 命名空间）的 8 语言文案。
 *
 * 为什么手写：定价页是转化页，也是用户第一眼看到的地方。机翻把
 * "No account needed" 翻成西语"No se necesita cuenta bancaria."（不需要银行账户）、
 * 把 href 一起翻掉造成死链，这类错误在定价页不可接受。
 *
 * 安全规则：
 * 1. 只在「当前值 === en 值」时覆盖 —— 已人工翻译的条目绝不覆盖（幂等、可续跑）
 * 2. href / available 等结构字段不翻译（这是 ja 站死链事故的根源）
 * 3. 价格数字、币种、USD 区间原样保留
 * 4. 同步修掉 en 里的过期文案：风险引擎已从 6 维扩到 8 维，
 *    "six-dimension breakdown" 是错的，en 与各语言一并改正
 *
 * 用法：node scripts/apply-pricing-i18n.cjs [--dry]
 */
const fs = require("fs");
const path = require("path");

const D = path.join(__dirname, "..", "i18n", "dictionaries");
const DRY = process.argv.includes("--dry");

/** en 自身的纠错：6 维 -> 8 维 */
const EN_FIXES = {
  "pricing.plans.0.features.0": "Supplier risk assessment with eight-dimension breakdown",
};

const T = {
  zh: {
    metaTitle: "服务与方案 — 免费工具、供应商核查、验厂、监控",
    metaDesc:
      "免费的供应商评估工具、99 美元起的供应商核查、399 美元起的工厂验厂、99 美元起的验货，以及订阅制供应商监控。全部价格以美元计。",
    h1: "服务与方案",
    lead: "工具免费使用。只有需要有人到现场核查供应商时才付费。",
    currencyNote: "全部价格以美元计。核查与验厂按项目报价。",
    plansTitle: "现在就能用的服务",
    plansLead: "四项现已开放。核查、验厂与验货按项目报价；监控为年度订阅。",
    comingSoonNote:
      "供应商监控为订阅制，按供应商按年报价。本页其余项均为按项目付费：没有订阅，不会自动续费。",
    reportsTitle: "报告与核查：参考价格区间",
    reportsLead:
      "以下每个数字都是参考区间，按项目报价。公开区间是为了让你在询价前先判断这项核查值不值得做。",
    reportsNote:
      "在线支付尚未开通。以上各项均由我们的团队报价并开票，因此不存在订阅，也不会自动续费。",
    alsoTitle: "其他服务",
    alsoCta: "获取报价",
    faqTitle: "价格常见问题",
    plans: [
      {
        name: "免费工具",
        note: "无需注册账号",
        features: [
          "供应商风险评估（含八个维度拆解）",
          "供应商核查清单",
          "工厂验厂清单与评分卡",
          "风险评分与建议的下一步",
        ],
        cta: "打开工具",
      },
      {
        name: "供应商核查",
        note: "按供应商报价，一项目一报",
        features: [
          "工商注册与法律主体核查",
          "工厂地址与现场证据",
          "判断是生产厂还是贸易公司",
          "质量与合规文件审阅",
          "书面报告附风险摘要",
        ],
        cta: "申请核查",
      },
      {
        name: "工厂验厂",
        price: "399 美元起",
        note: "按人天计费，另加差旅",
        features: [
          "按你要求的标准做现场评估",
          "质量、合规与用工记录审阅",
          "发现项按严重程度分级并附照片",
          "整改计划含责任人与完成日期",
          "整改期结束后可选择复审",
        ],
        cta: "申请验厂",
      },
      {
        name: "供应商监控",
        price: "订阅制",
        note: "按供应商按年报价",
        features: [
          "定期复核已核实的事实",
          "供应商风险变化提醒",
          "事实变更时更新报告",
          "与单次核查相同的证据政策",
        ],
        cta: "获取报价",
      },
    ],
    reports: [
      { name: "供应商尽职调查报告", note: "文件审阅与书面报告，不含现场走访。" },
      { name: "产品验货", note: "按人天计费，另加差旅，视国家与范围而定。" },
      { name: "现场工厂验厂", note: "按人天计费，另加差旅，视国家、厂区规模与标准而定。" },
    ],
    alsoItems: [
      "验货：生产中期与出货前检验，按人天报价",
      "采购寻源：按订单金额收取 3–5% 佣金，下单前报价",
      "供应商改进：验厂后的培训与整改支持，按工厂报价",
    ],
    faq: [
      {
        q: "使用工具需要付费吗？",
        a: "不需要。风险计算器、核查清单与评分卡全部免费，无需注册账号。只有当你需要我们核查或验厂某家供应商时才收费。",
      },
      {
        q: "一次供应商核查多少钱？",
        a: "按供应商报价。价格取决于所在国家、是否包含现场走访，以及需要审阅的文件数量。把公司名称发给我们，我们会给出报价。",
      },
      {
        q: "一次工厂验厂多少钱？",
        a: "按人天计费，另加差旅。单厂区质量验厂从一个人天起。SMETA 这类完整社会责任验厂通常需要两个或更多人天，视员工人数而定。",
      },
      {
        q: "供应商监控如何运作？",
        a: "监控是订阅制，按供应商按年报价。我们按你选择的周期复核已核实的事实，发生变化时给你发一份简短更新。你可以先做一次单次核查，之后再增加监控。",
      },
    ],
  },

  "zh-TW": {
    metaTitle: "服務與方案 — 免費工具、供應商核實、驗廠、監控",
    metaDesc:
      "免費的供應商評估工具、99 美元起的供應商核實、399 美元起的工廠驗廠、99 美元起的驗貨，以及訂閱制供應商監控。全部價格以美元計。",
    h1: "服務與方案",
    lead: "工具免費使用。只有需要有人到現場查核供應商時才付費。",
    currencyNote: "所有價格以美元計。查核與驗廠按專案報價。",
    plansTitle: "現在就能使用的服務",
    plansLead: "四項現已開放。查核、驗廠與驗貨按專案報價；監控為年度訂閱。",
    comingSoonNote:
      "供應商監控為訂閱制，按供應商按年報價。本頁其餘項目均為按專案付費：沒有訂閱，也不會自動續約。",
    reportsTitle: "報告與查核：參考價格區間",
    reportsLead:
      "以下每個數字都是參考區間，按專案報價。公開區間是為了讓你在詢價前先判斷這項查核值不值得做。",
    reportsNote:
      "線上支付尚未開放。以上各項均由我們的團隊報價並開立發票，因此沒有訂閱，也不會自動續約。",
    alsoTitle: "其他服務",
    alsoCta: "索取報價",
    faqTitle: "價格常見問題",
    plans: [
      {
        name: "免費工具",
        note: "無需註冊帳號",
        features: [
          "供應商風險評估（含八個維度拆解）",
          "供應商查核清單",
          "工廠驗廠清單與評分卡",
          "風險評分與建議的下一步",
        ],
        cta: "開啟工具",
      },
      {
        name: "供應商查核",
        note: "按供應商報價，一案一報",
        features: [
          "工商登記與法律主體查核",
          "工廠地址與現場證據",
          "判斷是生產廠還是貿易公司",
          "品質與合規文件審閱",
          "書面報告附風險摘要",
        ],
        cta: "申請查核",
      },
      {
        name: "工廠驗廠",
        price: "399 美元起",
        note: "按人天計費，另加差旅",
        features: [
          "依你要求的標準進行現場評估",
          "品質、合規與用工記錄審閱",
          "發現項目按嚴重程度分級並附照片",
          "矯正計畫含責任人與完成日期",
          "矯正期結束後可選擇複評",
        ],
        cta: "申請驗廠",
      },
      {
        name: "供應商監控",
        price: "訂閱制",
        note: "按供應商按年報價",
        features: [
          "定期複核已查證的事實",
          "供應商風險變化提醒",
          "事實變更時更新報告",
          "與單次查核相同的證據政策",
        ],
        cta: "索取報價",
      },
    ],
    reports: [
      { name: "供應商盡職調查報告", note: "文件審閱與書面報告，不含現場走訪。" },
      { name: "產品驗貨", note: "按人天計費，另加差旅，視國家與範圍而定。" },
      { name: "現場工廠驗廠", note: "按人天計費，另加差旅，視國家、廠區規模與標準而定。" },
    ],
    alsoItems: [
      "驗貨：生產中期與出貨前檢驗，按人天報價",
      "採購尋源：按訂單金額收取 3–5% 佣金，下單前報價",
      "供應商改善：驗廠後的培訓與矯正支持，按工廠報價",
    ],
    faq: [
      {
        q: "使用工具需要付費嗎？",
        a: "不需要。風險計算機、查核清單與評分卡全部免費，無需註冊帳號。只有當你需要我們查核或驗廠某家供應商時才收費。",
      },
      {
        q: "一次供應商查核多少錢？",
        a: "按供應商報價。價格取決於所在國家、是否包含現場走訪，以及需要審閱的文件數量。把公司名稱發給我們，我們會提供報價。",
      },
      {
        q: "一次工廠驗廠多少錢？",
        a: "按人天計費，另加差旅。單廠區品質驗廠從一個人天起。SMETA 這類完整社會責任驗廠通常需要兩個或更多人天，視員工人數而定。",
      },
      {
        q: "供應商監控如何運作？",
        a: "監控是訂閱制，按供應商按年報價。我們按你選擇的週期複核已查證的事實，發生變化時給你發一份簡短更新。你可以先做一次單次查核，之後再增加監控。",
      },
    ],
  },

  ja: {
    metaTitle: "サービスとプラン — 無料ツール、ベンダー検証、監査、モニタリング",
    metaDesc:
      "無料のサプライヤー評価ツール、99米ドルからのサプライヤー検証、399米ドルからの工場監査、99米ドルからの製品検査、サブスクリプション型のサプライヤーモニタリング。すべての価格は米ドル表示です。",
    h1: "サービスと料金プラン",
    lead: "ツールは無料で使えます。料金が発生するのは、現地でサプライヤーを確認する必要があるときだけです。",
    currencyNote: "すべて米ドル建てです。核查と監査は案件ごとに見積もります。",
    plansTitle: "今すぐ利用できるサービス",
    plansLead:
      "4 つすべて利用可能です。核查・監査・検品は案件ごとの見積もり、モニタリングは年額のサブスクリプションです。",
    comingSoonNote:
      "サプライヤーモニタリングはサブスクリプションで、サプライヤーごとに年額で見積もります。このページの他の項目はすべて案件ごとの都度払いです。サブスクリプションではなく、自動更新もありません。",
    reportsTitle: "報告書と核查：参考価格帯",
    reportsLead:
      "以下の金額はすべて参考値で、案件ごとに見積もります。価格帯を公開しているのは、問い合わせる前にその確認に価値があるかを判断していただくためです。",
    reportsNote:
      "オンライン決済はまだ開放していません。上記の各項目は弊社チームが見積もり、請求書を発行します。サブスクリプションではなく、自動更新もありません。",
    alsoTitle: "その他のサービス",
    alsoCta: "見積もりを依頼する",
    faqTitle: "料金に関するよくある質問",
    plans: [
      {
        name: "無料ツール",
        note: "アカウント登録は不要です",
        features: [
          "サプライヤーのリスク評価（8 つの観点で分析）",
          "サプライヤー核查チェックリスト",
          "工場監査チェックリストとスコアカード",
          "リスクスコアと推奨される次のステップ",
        ],
        cta: "ツールを開く",
      },
      {
        name: "サプライヤー核查",
        note: "サプライヤーごとに案件単位で見積もり",
        features: [
          "商業登記と法人格の確認",
          "工場住所と現場の証拠",
          "メーカーか商社かの判定",
          "品質・コンプライアンス書類の審査",
          "リスク要約付きの書面報告書",
        ],
        cta: "核查を依頼する",
      },
      {
        name: "工場監査",
        price: "399 米ドルから",
        note: "人日単位の料金に交通費を加算",
        features: [
          "要求される基準にもとづく現場評価",
          "品質・コンプライアンス・労務記録の審査",
          "写真付きで重要度別に分類した指摘事項",
          "担当者と期限を明記した改善計画",
          "改善期間後の再監査（オプション）",
        ],
        cta: "監査を依頼する",
      },
      {
        name: "サプライヤーモニタリング",
        price: "サブスクリプション",
        note: "サプライヤーごとに年額で見積もり",
        features: [
          "確認済み事項の定期的な再確認",
          "サプライヤーのリスク変化に関するアラート",
          "事実が変わった時点での報告書の更新",
          "単発の核查と同じ証拠ポリシー",
        ],
        cta: "見積もりを依頼する",
      },
    ],
    reports: [
      { name: "サプライヤー・デューデリジェンス報告書", note: "書類審査と書面報告書です。現場訪問は含まれません。" },
      { name: "製品検品", note: "国と範囲に応じて、人日単位の料金に交通費を加算します。" },
      {
        name: "工場への現場監査",
        note: "国・工場規模・基準に応じて、人日単位の料金に交通費を加算します。",
      },
    ],
    alsoItems: [
      "検品：製造中の確認と出荷前検品。人日単位で見積もり",
      "調達支援：発注金額の 3〜5% の手数料。発注前に見積もり",
      "サプライヤー改善：監査後の研修と是正措置の支援。工場単位で見積もり",
    ],
    faq: [
      {
        q: "ツールを使うのにお金はかかりますか？",
        a: "かかりません。リスク計算機、チェックリスト、スコアカードはすべて無料で、アカウント登録も不要です。料金が発生するのは、サプライヤーの核查や監査をご依頼いただいたときだけです。",
      },
      {
        q: "サプライヤー核查の費用はいくらですか？",
        a: "サプライヤーごとの見積もりです。価格は国、現場訪問の有無、審査する書類の量によって変わります。会社名をお送りいただければ見積もります。",
      },
      {
        q: "工場監査の費用はいくらですか？",
        a: "人日単位の料金に交通費を加算して見積もります。単一拠点の品質監査は 1 人日から、SMETA のような本格的な社会的責任監査は通常 2 人日以上（従業員数による）かかります。",
      },
      {
        q: "サプライヤーモニタリングはどのように機能しますか？",
        a: "モニタリングはサブスクリプションで、サプライヤーごとに年額で見積もります。ご指定の周期で確認済み事項を再確認し、変化があったときに短い更新をお送りします。まず単発の核查から始めて、後からモニタリングを追加することもできます。",
      },
    ],
  },

  de: {
    metaTitle: "Leistungen & Pläne — Kostenlose Tools, Verifizierung, Audit, Monitoring",
    metaDesc:
      "Kostenlose Lieferanten-Tools, Lieferantenverifizierung ab 99 USD, Werksaudits ab 399 USD, Produktinspektion ab 99 USD und Lieferanten-Monitoring im Abonnement. Alle Preise in USD.",
    h1: "Leistungen & Pläne",
    lead: "Die Tools sind kostenlos. Sie zahlen nur, wenn jemand den Lieferanten vor Ort prüfen soll.",
    currencyNote: "Alle Preise in USD. Verifizierung und Audit werden pro Projekt angeboten.",
    plansTitle: "Was Sie heute nutzen können",
    plansLead:
      "Alle vier sind verfügbar. Verifizierung, Audit und Inspektion werden pro Projekt angeboten; Monitoring ist ein Jahresabonnement.",
    comingSoonNote:
      "Lieferanten-Monitoring ist ein Abonnement und wird pro Lieferant und Jahr angeboten. Alle anderen Posten auf dieser Seite werden pro Projekt abgerechnet: kein Abonnement, keine automatische Verlängerung.",
    reportsTitle: "Berichte und Verifizierung: Richtwerte",
    reportsLead:
      "Alle Beträge sind Richtwerte und werden pro Projekt angeboten. Wir veröffentlichen Spannen, damit Sie vor der Anfrage einschätzen können, ob sich die Prüfung lohnt.",
    reportsNote:
      "Die Online-Zahlung ist noch nicht freigeschaltet. Jeder Posten oben wird von unserem Team angeboten und in Rechnung gestellt. Nichts davon ist ein Abonnement und nichts verlängert sich automatisch.",
    alsoTitle: "Ebenfalls verfügbar",
    alsoCta: "Angebot anfordern",
    faqTitle: "Fragen zu den Preisen",
    plans: [
      {
        name: "Kostenlose Tools",
        note: "Kein Konto erforderlich",
        features: [
          "Lieferanten-Risikobewertung, aufgeschlüsselt in acht Dimensionen",
          "Checkliste zur Lieferantenverifizierung",
          "Audit-Checkliste und Scorecard",
          "Risikowert und empfohlene nächste Schritte",
        ],
        cta: "Tools öffnen",
      },
      {
        name: "Lieferantenverifizierung",
        note: "Pro Lieferant, Angebot pro Projekt",
        features: [
          "Prüfung von Handelsregister und Rechtsträger",
          "Werksadresse und Nachweise zum Standort",
          "Feststellung: Hersteller oder Handelsunternehmen",
          "Prüfung von Qualitäts- und Compliance-Dokumenten",
          "Schriftlicher Bericht mit Risikozusammenfassung",
        ],
        cta: "Verifizierung anfragen",
      },
      {
        name: "Werksaudit",
        price: "ab 399 USD",
        note: "Pro Personentag plus Reisekosten",
        features: [
          "Bewertung vor Ort nach dem geforderten Standard",
          "Prüfung von Qualitäts-, Compliance- und Personalaufzeichnungen",
          "Feststellungen nach Schweregrad mit Fotos",
          "Maßnahmenplan mit Verantwortlichen und Terminen",
          "Optionales Folgeaudit nach der Korrekturfrist",
        ],
        cta: "Audit anfragen",
      },
      {
        name: "Lieferanten-Monitoring",
        price: "Abonnement",
        note: "Angebot pro Lieferant und Jahr",
        features: [
          "Geplante Neuprüfung verifizierter Fakten",
          "Risiko-Alerts zu Ihren Lieferanten",
          "Aktualisierter Bericht bei geänderten Fakten",
          "Gleiche Beweisrichtlinie wie bei Einzelprüfungen",
        ],
        cta: "Angebot anfordern",
      },
    ],
    reports: [
      { name: "Due-Diligence-Bericht zum Lieferanten", note: "Dokumentenprüfung und schriftlicher Bericht. Ohne Vor-Ort-Besuch." },
      { name: "Produktinspektion", note: "Angebot pro Personentag plus Reisekosten, je nach Land und Umfang." },
      {
        name: "Werksaudit vor Ort",
        note: "Angebot pro Personentag plus Reisekosten, je nach Land, Werksgröße und Standard.",
      },
    ],
    alsoItems: [
      "Inspektion: Kontrollen während der Produktion und vor dem Versand, Angebot pro Personentag",
      "Sourcing: 3–5 % Provision auf den Auftragswert, Angebot vor Auftragserteilung",
      "Lieferantenverbesserung: Schulung und Korrekturmaßnahmen nach einem Audit, Angebot pro Werk",
    ],
    faq: [
      {
        q: "Muss ich für die Tools bezahlen?",
        a: "Nein. Risikorechner, Checklisten und Scorecards sind kostenlos und ohne Konto nutzbar. Sie zahlen nur, wenn wir einen Lieferanten verifizieren oder auditieren sollen.",
      },
      {
        q: "Was kostet eine Lieferantenverifizierung?",
        a: "Sie wird pro Lieferant angeboten. Der Preis hängt vom Land ab, davon ob ein Vor-Ort-Besuch enthalten ist, und davon wie viele Dokumente geprüft werden müssen. Senden Sie uns den Firmennamen, wir erstellen das Angebot.",
      },
      {
        q: "Was kostet ein Werksaudit?",
        a: "Es wird pro Personentag plus Reisekosten angeboten. Ein Qualitätsaudit an einem Standort beginnt bei einem Personentag. Ein vollständiges Social-Compliance-Audit wie SMETA dauert meist zwei oder mehr, je nach Mitarbeiterzahl.",
      },
      {
        q: "Wie funktioniert das Lieferanten-Monitoring?",
        a: "Monitoring ist ein Abonnement, angeboten pro Lieferant und Jahr. Wir prüfen die verifizierten Fakten im von Ihnen gewählten Rhythmus neu und senden eine kurze Mitteilung, wenn sich etwas ändert. Sie können mit einer einmaligen Verifizierung starten und Monitoring später ergänzen.",
      },
    ],
  },

  fr: {
    metaTitle: "Services et formules — outils gratuits, vérification, audit, monitoring",
    metaDesc:
      "Outils gratuits d'évaluation des fournisseurs, vérification de fournisseur dès 99 USD, audits d'usine dès 399 USD, inspection de produit dès 99 USD et monitoring fournisseur par abonnement. Tous les prix en USD.",
    h1: "Services et formules",
    lead: "Les outils sont gratuits. Vous ne payez que lorsqu'il faut quelqu'un sur le terrain pour vérifier un fournisseur.",
    currencyNote: "Tous les prix sont en USD. La vérification et l'audit sont devisés par projet.",
    plansTitle: "Ce que vous pouvez utiliser dès maintenant",
    plansLead:
      "Les quatre sont disponibles. Vérification, audit et inspection sont devisés par projet ; le monitoring est un abonnement annuel.",
    comingSoonNote:
      "Le monitoring fournisseur est un abonnement devisé par fournisseur et par an. Tout le reste sur cette page est facturé au projet : pas d'abonnement, aucun renouvellement automatique.",
    reportsTitle: "Rapports et vérification : fourchettes indicatives",
    reportsLead:
      "Chaque montant ci-dessous est indicatif et devisé par projet. Nous publions des fourchettes pour que vous puissiez juger de l'intérêt de la vérification avant de demander un devis.",
    reportsNote:
      "Le paiement en ligne n'est pas encore ouvert. Chaque poste ci-dessus est devisé et facturé par notre équipe : rien ici n'est un abonnement et rien ne se renouvelle.",
    alsoTitle: "Également disponible",
    alsoCta: "Demander un devis",
    faqTitle: "Questions sur les tarifs",
    plans: [
      {
        name: "Outils gratuits",
        note: "Sans création de compte",
        features: [
          "Évaluation du risque fournisseur détaillée en huit dimensions",
          "Checklist de vérification fournisseur",
          "Checklist et scorecard d'audit d'usine",
          "Score de risque et prochaines étapes recommandées",
        ],
        cta: "Ouvrir les outils",
      },
      {
        name: "Vérification fournisseur",
        note: "Par fournisseur, devis par projet",
        features: [
          "Vérification de l'immatriculation et de l'entité légale",
          "Adresse de l'usine et preuves du site",
          "Détermination : fabricant ou société de négoce",
          "Revue des documents qualité et conformité",
          "Rapport écrit avec synthèse des risques",
        ],
        cta: "Demander une vérification",
      },
      {
        name: "Audit d'usine",
        price: "À partir de 399 USD",
        note: "Par jour-homme plus déplacement",
        features: [
          "Évaluation sur site selon le standard requis",
          "Revue des registres qualité, conformité et personnel",
          "Constats classés par gravité avec photographies",
          "Plan d'actions correctives avec responsables et échéances",
          "Réaudit optionnel après la période corrective",
        ],
        cta: "Demander un audit",
      },
      {
        name: "Monitoring fournisseur",
        price: "Abonnement",
        note: "Devis par fournisseur et par an",
        features: [
          "Nouvelles vérifications planifiées des faits vérifiés",
          "Alertes de changement de risque sur vos fournisseurs",
          "Rapport mis à jour quand les faits changent",
          "Même politique de preuves que pour les contrôles ponctuels",
        ],
        cta: "Demander un devis",
      },
    ],
    reports: [
      { name: "Rapport de diligence raisonnable fournisseur", note: "Revue documentaire et rapport écrit. Sans visite de site." },
      { name: "Inspection produit", note: "Devis par jour-homme plus déplacement, selon le pays et le périmètre." },
      {
        name: "Audit d'usine sur site",
        note: "Devis par jour-homme plus déplacement, selon le pays, la taille du site et le standard.",
      },
    ],
    alsoItems: [
      "Inspection : contrôles en cours de production et avant expédition, devis par jour-homme",
      "Sourcing : commission de 3–5 % sur la valeur de la commande, devis avant la commande",
      "Amélioration fournisseur : formation et actions correctives après un audit, devis par usine",
    ],
    faq: [
      {
        q: "Dois-je payer pour utiliser les outils ?",
        a: "Non. Le calculateur de risque, les checklists et les scorecards sont gratuits et sans compte. Vous ne payez que lorsque vous nous demandez de vérifier ou d'auditer un fournisseur.",
      },
      {
        q: "Combien coûte une vérification fournisseur ?",
        a: "Elle est devisée par fournisseur. Le prix dépend du pays, de la présence ou non d'une visite de site et du nombre de documents à examiner. Envoyez-nous le nom de l'entreprise et nous vous ferons un devis.",
      },
      {
        q: "Combien coûte un audit d'usine ?",
        a: "Il est devisé par jour-homme plus déplacement. Un audit qualité sur un seul site commence à un jour-homme. Un audit complet de conformité sociale tel que SMETA prend généralement deux jours ou plus, selon l'effectif.",
      },
      {
        q: "Comment fonctionne le monitoring fournisseur ?",
        a: "Le monitoring est un abonnement devisé par fournisseur et par an. Nous revérifions les faits vérifiés selon la fréquence choisie et vous envoyons une courte mise à jour en cas de changement. Vous pouvez commencer par une vérification ponctuelle et ajouter le monitoring plus tard.",
      },
    ],
  },

  es: {
    metaTitle: "Servicios y planes — herramientas gratuitas, verificación, auditoría, monitoreo",
    metaDesc:
      "Herramientas gratuitas de evaluación de proveedores, verificación de proveedores desde 99 USD, auditorías de fábrica desde 399 USD, inspección de producto desde 99 USD y monitoreo de proveedores por suscripción. Todos los precios en USD.",
    h1: "Servicios y planes",
    lead: "Las herramientas son gratuitas. Solo pagas cuando necesitas que alguien verifique al proveedor sobre el terreno.",
    currencyNote: "Todos los precios en USD. La verificación y la auditoría se presupuestan por proyecto.",
    plansTitle: "Lo que puedes usar hoy",
    plansLead:
      "Los cuatro están disponibles. Verificación, auditoría e inspección se presupuestan por proyecto; el monitoreo es una suscripción anual.",
    comingSoonNote:
      "El monitoreo de proveedores es una suscripción y se presupuesta por proveedor y año. Todo lo demás en esta página se cobra por proyecto: sin suscripción, sin renovación automática.",
    reportsTitle: "Informes y verificación: rangos orientativos",
    reportsLead:
      "Cada cifra es orientativa y se presupuesta por proyecto. Publicamos rangos para que puedas valorar si la comprobación vale la pena antes de pedir presupuesto.",
    reportsNote:
      "El pago en línea aún no está abierto. Cada concepto anterior lo presupuesta y factura nuestro equipo: nada aquí es una suscripción y nada se renueva automáticamente.",
    alsoTitle: "También disponible",
    alsoCta: "Pedir presupuesto",
    faqTitle: "Preguntas sobre precios",
    plans: [
      {
        name: "Herramientas gratuitas",
        note: "Sin cuenta",
        features: [
          "Evaluación de riesgo del proveedor desglosada en ocho dimensiones",
          "Checklist de verificación de proveedores",
          "Checklist y scorecard de auditoría de fábrica",
          "Puntuación de riesgo y próximos pasos recomendados",
        ],
        cta: "Abrir herramientas",
      },
      {
        name: "Verificación de proveedores",
        note: "Por proveedor, presupuesto por proyecto",
        features: [
          "Comprobación de registro mercantil y entidad legal",
          "Dirección de fábrica y evidencia del sitio",
          "Determinación de fabricante o trading company",
          "Revisión de documentos de calidad y cumplimiento",
          "Informe escrito con resumen de riesgo",
        ],
        cta: "Pedir verificación",
      },
      {
        name: "Auditoría de fábrica",
        price: "Desde 399 USD",
        note: "Por día-hombre más viaje",
        features: [
          "Evaluación in situ según el estándar requerido",
          "Revisión de registros de calidad, cumplimiento y laborales",
          "Hallazgos clasificados por severidad con fotografías",
          "Plan de acciones correctivas con responsables y fechas",
          "Reauditoría opcional tras el plazo correctivo",
        ],
        cta: "Pedir auditoría",
      },
      {
        name: "Monitoreo de proveedores",
        price: "Suscripción",
        note: "Presupuesto por proveedor y año",
        features: [
          "Recomprobaciones programadas de los hechos verificados",
          "Alertas de cambio de riesgo sobre tus proveedores",
          "Informe actualizado cuando cambian los hechos",
          "Misma política de evidencia que en las comprobaciones puntuales",
        ],
        cta: "Pedir presupuesto",
      },
    ],
    reports: [
      { name: "Informe de diligencia debida del proveedor", note: "Revisión documental e informe escrito. Sin visita al sitio." },
      { name: "Inspección de producto", note: "Presupuesto por día-hombre más viaje, según país y alcance." },
      {
        name: "Auditoría de fábrica in situ",
        note: "Presupuesto por día-hombre más viaje, según país, tamaño de la planta y estándar.",
      },
    ],
    alsoItems: [
      "Inspección: controles en línea y previos al envío, presupuesto por día-hombre",
      "Sourcing: comisión del 3–5 % sobre el valor del pedido, presupuesto antes de realizar el pedido",
      "Mejora de proveedores: formación y acciones correctivas tras una auditoría, presupuesto por fábrica",
    ],
    faq: [
      {
        q: "¿Tengo que pagar por usar las herramientas?",
        a: "No. La calculadora de riesgo, los checklists y los scorecards son gratuitos y no requieren cuenta. Solo pagas cuando nos pides verificar o auditar a un proveedor.",
      },
      {
        q: "¿Cuánto cuesta una verificación de proveedores?",
        a: "Se presupuesta por proveedor. El precio depende del país, de si incluye visita al sitio y de cuántos documentos hay que revisar. Envíanos el nombre de la empresa y te pasamos presupuesto.",
      },
      {
        q: "¿Cuánto cuesta una auditoría de fábrica?",
        a: "Se presupuesta por día-hombre más viaje. Una auditoría de calidad en una sola planta empieza en un día-hombre. Una auditoría social completa como SMETA suele requerir dos o más, según la plantilla.",
      },
      {
        q: "¿Cómo funciona el monitoreo de proveedores?",
        a: "Es una suscripción presupuestada por proveedor y año. Recomprobamos los hechos verificados con la frecuencia que elijas y te enviamos un breve aviso cuando algo cambia. Puedes empezar con una verificación puntual y añadir el monitoreo después.",
      },
    ],
  },

  pt: {
    metaTitle: "Serviços e planos — ferramentas gratuitas, verificação, auditoria, monitoramento",
    metaDesc:
      "Ferramentas gratuitas de avaliação de fornecedores, verificação de fornecedores a partir de 99 USD, auditorias de fábrica a partir de 399 USD, inspeção de produto a partir de 99 USD e monitoramento de fornecedores por assinatura. Todos os preços em USD.",
    h1: "Serviços e planos",
    lead: "As ferramentas são gratuitas. Você só paga quando precisa de alguém para verificar o fornecedor no local.",
    currencyNote: "Todos os preços em USD. Verificação e auditoria são orçadas por projeto.",
    plansTitle: "O que você pode usar hoje",
    plansLead:
      "Os quatro estão disponíveis. Verificação, auditoria e inspeção são orçadas por projeto; o monitoramento é uma assinatura anual.",
    comingSoonNote:
      "O monitoramento de fornecedores é uma assinatura orçada por fornecedor e por ano. Todo o resto nesta página é cobrado por projeto: sem assinatura, sem renovação automática.",
    reportsTitle: "Relatórios e verificação: faixas indicativas",
    reportsLead:
      "Cada valor abaixo é indicativo e orçado por projeto. Publicamos faixas para que você avalie se a verificação vale a pena antes de pedir orçamento.",
    reportsNote:
      "O pagamento online ainda não está aberto. Cada item acima é orçado e faturado pela nossa equipe: nada aqui é assinatura e nada renova automaticamente.",
    alsoTitle: "Também disponível",
    alsoCta: "Pedir orçamento",
    faqTitle: "Perguntas sobre preços",
    plans: [
      {
        name: "Ferramentas gratuitas",
        note: "Sem conta",
        features: [
          "Avaliação de risco do fornecedor detalhada em oito dimensões",
          "Checklist de verificação de fornecedores",
          "Checklist e scorecard de auditoria de fábrica",
          "Pontuação de risco e próximos passos recomendados",
        ],
        cta: "Abrir ferramentas",
      },
      {
        name: "Verificação de fornecedores",
        note: "Por fornecedor, orçado por projeto",
        features: [
          "Verificação de registro empresarial e entidade legal",
          "Endereço da fábrica e evidências do local",
          "Determinação de fabricante ou trading company",
          "Revisão de documentos de qualidade e conformidade",
          "Relatório escrito com resumo de risco",
        ],
        cta: "Pedir verificação",
      },
      {
        name: "Auditoria de fábrica",
        price: "A partir de 399 USD",
        note: "Por homem-dia mais deslocamento",
        features: [
          "Avaliação no local conforme o padrão exigido",
          "Revisão de registros de qualidade, conformidade e trabalho",
          "Achados classificados por gravidade com fotografias",
          "Plano de ação corretiva com responsáveis e prazos",
          "Reauditoria opcional após o prazo corretivo",
        ],
        cta: "Pedir auditoria",
      },
      {
        name: "Monitoramento de fornecedores",
        price: "Assinatura",
        note: "Orçado por fornecedor e por ano",
        features: [
          "Rechecks programados dos fatos verificados",
          "Alertas de mudança de risco nos seus fornecedores",
          "Relatório atualizado quando os fatos mudam",
          "Mesma política de evidências das verificações pontuais",
        ],
        cta: "Pedir orçamento",
      },
    ],
    reports: [
      { name: "Relatório de diligência prévia do fornecedor", note: "Revisão documental e relatório escrito. Sem visita ao local." },
      { name: "Inspeção de produto", note: "Orçado por homem-dia mais deslocamento, conforme país e escopo." },
      {
        name: "Auditoria de fábrica no local",
        note: "Orçado por homem-dia mais deslocamento, conforme país, porte da planta e padrão.",
      },
    ],
    alsoItems: [
      "Inspeção: verificações em linha e pré-embarque, orçadas por homem-dia",
      "Sourcing: comissão de 3–5% sobre o valor do pedido, orçada antes da colocação do pedido",
      "Melhoria de fornecedores: treinamento e ação corretiva após auditoria, orçada por fábrica",
    ],
    faq: [
      {
        q: "Preciso pagar para usar as ferramentas?",
        a: "Não. A calculadora de risco, os checklists e os scorecards são gratuitos e não exigem conta. Você só paga quando nos pede para verificar ou auditar um fornecedor.",
      },
      {
        q: "Quanto custa uma verificação de fornecedores?",
        a: "É orçada por fornecedor. O preço depende do país, de incluir visita ao local e de quantos documentos precisam de revisão. Envie o nome da empresa e faremos o orçamento.",
      },
      {
        q: "Quanto custa uma auditoria de fábrica?",
        a: "É orçada por homem-dia mais deslocamento. Uma auditoria de qualidade em um único local começa em um homem-dia. Uma auditoria social completa como SMETA costuma levar dois ou mais, conforme o número de funcionários.",
      },
      {
        q: "Como funciona o monitoramento de fornecedores?",
        a: "É uma assinatura orçada por fornecedor e por ano. Recheckamos os fatos verificados na periodicidade que você escolher e enviamos um breve aviso quando algo muda. Você pode começar com uma verificação pontual e incluir o monitoramento depois.",
      },
    ],
  },

  ar: {
    metaTitle: "الخدمات والخطط — أدوات مجانية، تحقق، تدقيق، مراقبة",
    metaDesc:
      "أدوات مجانية لتقييم الموردين، وتحقق من الموردين من 99 دولاراً، وتدقيق مصانع من 399 دولاراً، وفحص منتجات من 99 دولاراً، ومراقبة موردين بالاشتراك. جميع الأسعار بالدولار الأمريكي.",
    h1: "الخدمات والخطط",
    lead: "الأدوات مجانية. تدفع فقط عندما تحتاج إلى شخص يتحقق من المورد على أرض الواقع.",
    currencyNote: "جميع الأسعار بالدولار الأمريكي. يُسعَّر التحقق والتدقيق لكل مشروع.",
    plansTitle: "ما يمكنك استخدامه اليوم",
    plansLead:
      "الخطط الأربع متاحة الآن. يُسعَّر التحقق والتدقيق والفحص لكل مشروع؛ أما المراقبة فاشتراك سنوي.",
    comingSoonNote:
      "مراقبة الموردين اشتراك يُسعَّر لكل مورد سنوياً. كل شيء آخر في هذه الصفحة يُحاسَب لكل مشروع: لا اشتراك ولا تجديد تلقائي.",
    reportsTitle: "التقارير والتحقق: نطاقات إرشادية",
    reportsLead:
      "كل رقم أدناه إرشادي ويُسعَّر لكل مشروع. ننشر النطاقات لتتمكن من تقدير ما إذا كان الفحص يستحق الطلب قبل أن تطلب عرض سعر.",
    reportsNote:
      "الدفع الإلكتروني غير مفتوح بعد. كل بند أعلاه يُسعَّر ويُفوتر من فريقنا: لا شيء هنا اشتراك ولا شيء يُجدد تلقائياً.",
    alsoTitle: "متاح أيضاً",
    alsoCta: "اطلب عرض سعر",
    faqTitle: "الأسئلة الشائعة عن الأسعار",
    plans: [
      {
        name: "أدوات مجانية",
        note: "لا حاجة إلى حساب",
        features: [
          "تقييم مخاطر المورد مفصّلاً على ثمانية أبعاد",
          "قائمة تحقق من المورد",
          "قائمة تحقق وتقييم لتدقيق المصنع",
          "درجة المخاطر والخطوات التالية الموصى بها",
        ],
        cta: "فتح الأدوات",
      },
      {
        name: "التحقق من المورد",
        note: "لكل مورد، يُسعَّر لكل مشروع",
        features: [
          "التحقق من السجل التجاري والكيان القانوني",
          "عنوان المصنع وأدلة الموقع",
          "تحديد ما إذا كان مصنّعاً أم شركة تجارية",
          "مراجعة مستندات الجودة والامتثال",
          "تقرير مكتوب مع ملخص للمخاطر",
        ],
        cta: "اطلب تحققاً",
      },
      {
        name: "تدقيق المصنع",
        price: "من 399 دولاراً أمريكياً",
        note: "لكل يوم عمل إضافة إلى السفر",
        features: [
          "تقييم في الموقع وفق المعيار المطلوب",
          "مراجعة سجلات الجودة والامتثال والعمل",
          "ملاحظات مصنّفة بحسب الخطورة مع صور",
          "خطة إجراءات تصحيحية مع مسؤولين ومواعيد",
          "إعادة تدقيق اختيارية بعد فترة التصحيح",
        ],
        cta: "اطلب تدقيقاً",
      },
      {
        name: "مراقبة الموردين",
        price: "اشتراك",
        note: "يُسعَّر لكل مورد سنوياً",
        features: [
          "إعادة تحقق دورية من الوقائع الموثَّقة",
          "تنبيهات بتغير المخاطر على مورديك",
          "تقرير محدَّث عند تغير الوقائع",
          "سياسة الأدلة نفسها المتبعة في الفحوص الفردية",
        ],
        cta: "اطلب عرض سعر",
      },
    ],
    reports: [
      { name: "تقرير العناية الواجبة للمورد", note: "مراجعة مستندية وتقرير مكتوب. دون زيارة للموقع." },
      { name: "فحص المنتج", note: "يُسعَّر لكل يوم عمل إضافة إلى السفر، بحسب البلد والنطاق." },
      {
        name: "تدقيق المصنع في الموقع",
        note: "يُسعَّر لكل يوم عمل إضافة إلى السفر، بحسب البلد وحجم الموقع والمعيار.",
      },
    ],
    alsoItems: [
      "الفحص: فحوصات أثناء الإنتاج وقبل الشحن، تُسعَّر لكل يوم عمل",
      "التوريد: عمولة 3–5% على قيمة الطلب، تُسعَّر قبل تقديم الطلب",
      "تحسين الموردين: تدريب وإجراءات تصحيحية بعد التدقيق، تُسعَّر لكل مصنع",
    ],
    faq: [
      {
        q: "هل أحتاج إلى الدفع لاستخدام الأدوات؟",
        a: "لا. حاسبة المخاطر وقوائم التحقق وبطاقات التقييم مجانية ولا تحتاج إلى حساب. تدفع فقط عندما تطلب منا التحقق من مورد أو تدقيقه.",
      },
      {
        q: "كم تكلف عملية التحقق من المورد؟",
        a: "تُسعَّر لكل مورد. يعتمد السعر على البلد، وعلى ما إذا كان يشمل زيارة للموقع، وعلى عدد المستندات المطلوب مراجعتها. أرسل لنا اسم الشركة وسنقدم لك عرض سعر.",
      },
      {
        q: "كم تكلف عملية تدقيق المصنع؟",
        a: "تُسعَّر لكل يوم عمل إضافة إلى السفر. يبدأ تدقيق الجودة لموقع واحد من يوم عمل واحد. أما تدقيق الامتثال الاجتماعي الكامل مثل SMETA فيستغرق عادة يومَي عمل أو أكثر، بحسب عدد الموظفين.",
      },
      {
        q: "كيف تعمل مراقبة الموردين؟",
        a: "المراقبة اشتراك يُسعَّر لكل مورد سنوياً. نعيد التحقق من الوقائع الموثَّقة بالدورية التي تختارها، ونرسل لك تحديثاً موجزاً عند حدوث أي تغيير. يمكنك البدء بتحقق لمرة واحدة ثم إضافة المراقبة لاحقاً.",
      },
    ],
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

/** 把 T 里的嵌套结构摊平成 pricing.xxx 路径；数组保留索引 */
function flatten(node, prefix, out) {
  for (const k of Object.keys(node)) {
    const v = node[k];
    const p = `${prefix}.${k}`;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        const ip = `${p}.${i}`;
        if (item && typeof item === "object") flatten(item, ip, out);
        else out[ip] = item;
      });
    } else if (v && typeof v === "object") {
      flatten(v, p, out);
    } else {
      out[p] = v;
    }
  }
  return out;
}

// ---------- 先修 en 自身 ----------
const enPath = path.join(D, "en.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
let enFixed = 0;
for (const [k, v] of Object.entries(EN_FIXES)) {
  if (getPath(en, k) !== v) {
    setPath(en, k, v);
    enFixed++;
    console.log(`[en] 纠错 ${k}`);
  }
}
if (enFixed && !DRY) fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + "\n", "utf8");

// ---------- 逐语言写入（默认仅覆盖「仍等于英文」的条目） ----------
// FORCE：该语言的历史翻译被 MyMemory 污染成西班牙语（fix-i18n-critical.cjs
// 因防误伤跳过了 pt 的西语检测），且 pt 的 pricing 无有效人工翻译，
// 因此对手写翻译无条件覆盖，彻底清除西语残留。
const FORCE = new Set(["pt"]);
let total = 0;
for (const [lang, node] of Object.entries(T)) {
  const file = path.join(D, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const wanted = flatten(node, "pricing", {});
  let changed = 0;
  let skipped = 0;

  for (const [k, val] of Object.entries(wanted)) {
    const enVal = getPath(en, k);
    const cur = getPath(dict, k);
    if (typeof enVal !== "string" || typeof val !== "string") continue;
    // 关键：默认只覆盖「当前值 === en 值」的条目，保护已有人工翻译；
    // FORCE 语言（pt）无条件覆盖，以清除机翻西语污染
    if (!FORCE.has(lang) && cur !== enVal) {
      skipped++;
      continue;
    }
    setPath(dict, k, val);
    changed++;
  }

  console.log(`[${lang}] 写入 ${changed} 条，跳过已翻译 ${skipped} 条`);
  if (!DRY && changed) fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  total += changed;
}

console.log(`\n${DRY ? "DRY RUN" : "完成"}：共写入 ${total} 条（en 纠错 ${enFixed} 条）`);
