#!/usr/bin/env node
/**
 * apply-trust-i18n.cjs
 * 为 8 语言（zh/zh-TW/ja/de/fr/es/pt/ar）补齐 trust 命名空间缺失/未译键，
 * 并补齐 verification.levels / levelsShort 缺失项（es 全部、其它语言个别）。
 *
 * 幂等保护：仅当 现值 === en 原值 或 键缺失 时写入；已有手写翻译不被覆盖。
 * 数组键按元素逐个比较（cur[i] === enVal[i] 或 undefined 时写）。
 * brandValue 是品牌名，保持原名不译。
 *
 * 用法: node scripts/apply-trust-i18n.cjs
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const en = JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8"));
const EN_TRUST = en.trust;

const TRUST_L10N = {
  // ---------------- 简体中文（只补 brandValue） ----------------
  zh: {
    brandValue: "FactoryAuditB2B",
  },

  // ---------------- 繁体中文 ----------------
  "zh-TW": {
    badge: "信任中心",
    h1: "信任中心",
    lead:
      "我們是誰、我們核驗什麼、我們不核驗什麼，以及我們如何處理證據。公開這些資訊，是為了讓你在委託我們核查別人之前，先核查我們。",
    metaTitle: "信任中心 — 誰在營運 FactoryAuditB2B，我們核驗什麼",
    metaDesc:
      "FactoryAuditB2B 的工商登記、營運主體、核驗方法、核驗等級、證據政策與資料保護說明。",
    regTitle: "工商登記",
    regLead:
      "公開驗證，但不公開全部隱私。我們公開採購商需要的登記事實，並對個人與敏感識別資訊做部分遮罩。",
    legalEntityLabel: "法律實體名稱",
    brandLabel: "品牌",
    brandValue: "FactoryAuditB2B",
    countryLabel: "註冊國家 / 地區",
    cityLabel: "所在城市",
    registrationYearLabel: "註冊年份",
    statusLabel: "登記狀態",
    authorityLabel: "登記機關",
    verificationDateLabel: "核驗日期",
    legalRepLabel: "法定代表人",
    registrationNumberLabel: "註冊號",
    addressLabel: "註冊地址",
    maskedNote:
      "已部分遮罩。完整資訊不在公開網路公開，簽署正式詢價後可按申請提供。",
    viewDocument: "查看營業執照",
    notConfigured: "工商登記資訊尚未公開。",
    notConfiguredLead:
      "管理員錄入後我們會公開登記紀錄。在那之前，直接聯絡我們，我們會發給你。",
    operatesTitle: "誰在營運 FactoryAuditB2B？",
    operatesBody:
      "FactoryAuditB2B 是由 {entity} 營運的平台與品牌。品牌名不是法律實體名，我們不會把兩者混為一談。",
    operatesLead:
      "FactoryAuditB2B 由一家在中國註冊的公司營運，為全球採購商提供供應商核查、工廠驗廠與採購支援。",
    operatesNotConfigured:
      "FactoryAuditB2B 由一家註冊公司營運。法律實體名稱配置完成後我們會立即公開。",
    scopeTitle: "業務範圍",
    scopeBody:
      "為從中國及東南亞採購的買家提供供應商核查、工廠驗廠、驗貨與採購支援。第一階段覆蓋中國、越南、泰國。",
    verifyTitle: "我們核驗什麼",
    verifyLead: "以下是核查服務覆蓋的檢查項。",
    verify: ["公司身分", "工廠地址", "文件", "認證", "生產能力", "審核證據"],
    notVerifyTitle: "我們不核驗什麼",
    notVerifyLead:
      "說清楚邊界本身就是服務的一部分。一份核查報告只有在寫明「什麼沒查」時才有價值。",
    notVerify: [
      "除非明確說明，我們不自行向供應商發證。",
      "除非你另行要求，我們不審閱財務報表。",
      "對於未向我們揭露的外包廠，我們不做核驗。",
      "我們不保證產品在實際使用中的效能表現。",
      "對於蓄意偽造的文件，我們無法保證百分之百識別，儘管交叉核對可以縮小差距。",
    ],
    methodTitle: "核驗方法",
    methodLead: "風險分數由權重公開的規則引擎計算。相同輸入永遠得到相同分數。",
    methodLink: "閱讀完整方法說明",
    levelsTitle: "核驗等級",
    levelsLead: "只有存在對應核驗事件與證據時，供應商才會被顯示為已核驗。",
    levelDescs: [
      "暫無核驗紀錄。",
      "已審閱登記與商業身分紀錄。",
      "已審閱證書、證照與審核文件。",
      "已透過定位證據與照片確認廠區。",
      "已完成現場驗廠，含發現項與書面報告。",
    ],
    evidenceTitle: "供應商證據政策",
    evidenceLead: "我們如何處理供應商與買家交給我們的文件。",
    evidence: [
      "每一項都記錄來源、日期與核驗狀態。",
      "第三方原始審核報告標示為已審閱，我們不轉發原件。",
      "供應商自行決定哪些內容公開、買家可見、受限或私密。",
      "未經授權，我們不公開揭露保密文件。",
    ],
    privacyTitle: "隱私與資料保護",
    privacyLead: "你發給我們的資訊會如何處理。",
    privacy: [
      "買家詢價僅用於回覆與製作報價。我們不販售聯絡資料。",
      "供應商文件用於維護供應商檔案並支援買家盡職調查。",
      "未經授權，我們不公開揭露保密文件。",
      "如需查詢、更正或刪除你的資料，請使用下方聯絡方式聯絡我們。",
    ],
    contactTitle: "聯絡我們",
    contactLead:
      "可觸達的管道。如果某個頁面承諾了我們做不到的事，請告訴我們，我們會更正。",
    contactEmailLabel: "電子郵件",
    whyTitle: "為什麼信任我們",
    whyLead: "四件我們能舉證的事，以及一件我們不能的事。",
    why1Title: "註冊公司",
    why1Body: "由註冊公司營運。我們公開實體名稱，而不是躲在品牌背後。",
    why2Title: "方法透明",
    why2Body: "風險分數基於一套有文件、權重公開的評估框架。",
    why3Title: "以證據為基礎的核驗",
    why3Body: "核驗狀態與可用證據綁定。沒有證據，就沒有「已核驗」標籤。",
    why4Title: "人工審核",
    why4Body: "AI 輔助流程，核驗決策由人做出，現場工作由人執行。",
    aiNote: "AI 輔助流程，核驗決策由人做出。",
    humanAiTitle: "人與 AI 如何協作",
    humanAiLead:
      "AI 幫助我們閱讀、整理與起草。任何內容在發布或發送給買家之前，都有人審核。",
    humanAiItems: [
      "AI 掃描公開紀錄、提取日期與數字，並起草第一版結論。",
      "人核實來源、檢查語境，並決定報告怎麼寫。",
      "AI 標出證據缺口，人決定缺口是否重大。",
      "AI 從不頒發核驗等級或風險評級，只有審核員可以。",
    ],
    principlesTitle: "我們絕不打破的六條原則",
    principlesLead: "從第一稿到最終報告，每次核驗都遵循這些規則。",
    principles: [
      "絕不隱瞞不確定性。如果我們無法確認某項事實，報告會明說。",
      "沒有數據不是好消息。缺失證據會降低分數，絕不視為確認。",
      "我們不出售證書。我們核驗，我們培訓。",
      "第三方報告只做審閱，絕不重發或轉發。",
      "付費不改變結果。付費核驗仍可能帶回問題。",
      "樣本與案例研究一律標示為示範。",
    ],
  },

  // ---------------- 日语 ----------------
  ja: {
    badge: "トラストセンター",
    h1: "トラストセンター",
    lead:
      "私たちが誰か、何を検証するか、検証しないこと、証拠の扱い方。あなたが他者を調査してもらう前に、私たち自身を確認できるよう公開しています。",
    metaTitle:
      "トラストセンター — FactoryAuditB2B を運営する主体と検証内容",
    metaDesc:
      "FactoryAuditB2B の法人登記、運営主体、検証方法、検証レベル、証拠ポリシー、データ保護について。",
    regTitle: "法人登記",
    regLead:
      "公開検証であって全情報の公開ではありません。買い手が必要とする登記事実を公開し、個人情報や機微な識別情報は一部マスクします。",
    legalEntityLabel: "法人名",
    brandLabel: "ブランド",
    brandValue: "FactoryAuditB2B",
    countryLabel: "登録国 / 地域",
    cityLabel: "都市",
    registrationYearLabel: "登記年",
    statusLabel: "登記ステータス",
    authorityLabel: "登記機関",
    verificationDateLabel: "検証日",
    legalRepLabel: "法定代表者",
    registrationNumberLabel: "登記番号",
    addressLabel: "登記住所",
    maskedNote:
      "一部マスク済み。完全な値は公開インターネット上に公開されず、署名済みの問い合わせがあれば開示します。",
    viewDocument: "法人登記を表示",
    notConfigured: "法人登記情報はまだ公開されていません。",
    notConfiguredLead:
      "管理者が登録すると登記記録を公開します。それまでの間は直接お問い合わせください。お送りします。",
    operatesTitle: "FactoryAuditB2B を運営しているのは誰か？",
    operatesBody:
      "FactoryAuditB2B は {entity} が運営するプラットフォーム兼ブランドです。ブランド名は法人名ではなく、両者を同一と扱うことはありません。",
    operatesLead:
      "FactoryAuditB2B は中国に登記された企業が運営し、世界中の買い手にサプライヤー検証、工場監査、調達支援を提供しています。",
    operatesNotConfigured:
      "FactoryAuditB2B は登記済みの企業が運営しています。法人名はトラストセンターに設定され次第、公開します。",
    scopeTitle: "事業範囲",
    scopeBody:
      "中国および東南アジアから輸入する買い手向けのサプライヤー検証、工場監査、検査、調達支援。第1フェーズの対象は中国、ベトナム、タイです。",
    verifyTitle: "検証する内容",
    verifyLead: "検証サービスでカバーするチェック項目は以下の通りです。",
    verify: [
      "会社の同一性",
      "工場の所在地",
      "書類",
      "認証",
      "生産能力",
      "監査証拠",
    ],
    notVerifyTitle: "検証しない内容",
    notVerifyLead:
      "境界を明示すること自体がサービスの一部です。検証レポートは「何をチェックしなかったか」が書かれていてこそ役立ちます。",
    notVerify: [
      "明示しない限り、私たち自身がサプライヤーに証明書を発行することはありません。",
      "依頼がない限り、財務諸表はレビューしません。",
      "開示されなかった下請けについては検証しません。",
      "製品の使用時の性能を保証しません。",
      "意図的に偽造された書類を確実に見抜くことはできませんが、クロスチェックで差は縮まります。",
    ],
    methodTitle: "検証方法",
    methodLead:
      "リスクスコアは公開された重み付けを持つ固定ルールエンジンで算出されます。同じ入力は常に同じスコアになります。",
    methodLink: "完全な方法論を読む",
    levelsTitle: "検証レベル",
    levelsLead:
      "対応する検証イベントと証拠が存在する場合にのみ、サプライヤーは「検証済み」と表示されます。",
    levelDescs: [
      "検証記録はありません。",
      "登記・法人身分の記録をレビューしました。",
      "証明書、ライセンス、監査書類をレビューしました。",
      "所在地の証拠と写真で工場を確認しました。",
      "現場監査を完了し、所見と書面レポートを作成しました。",
    ],
    evidenceTitle: "サプライヤー証拠ポリシー",
    evidenceLead: "サプライヤーや買い手から預かった書類の扱い方。",
    evidence: [
      "すべての項目は出典、日付、検証ステータスとともに保管されます。",
      "第三者の原本監査レポートは「レビュー済み」と表示します。再配布はしません。",
      "サプライヤーが公開範囲（公開、買い手のみ、制限、非公開）を選べます。",
      "許可なく機密文書を公開することはありません。",
    ],
    privacyTitle: "プライバシーとデータ保護",
    privacyLead: "お送りいただいた情報の扱いについて。",
    privacy: [
      "買い手の問い合わせは返信と見積作成にのみ使用します。連絡先データを販売することはありません。",
      "サプライヤーの書類はサプライヤープロフィールの維持と買い手のデューデリジェンス支援に使用します。",
      "許可なく機密文書を公開することはありません。",
      "データのアクセス、訂正、削除を希望する場合は、以下の連絡先からお問い合わせください。",
    ],
    contactTitle: "お問い合わせ",
    contactLead:
      "連絡可能なチャネルです。ページで約束したことが実現できない場合はお知らせください。修正します。",
    contactEmailLabel: "メール",
    whyTitle: "なぜ私たちを信頼できるのか",
    whyLead: "証明できる4つのこと、そして証明できないことはありません。",
    why1Title: "登記済み企業",
    why1Body:
      "登記済みの企業が運営しています。ブランドの背後に隠れず、実体名を公開しています。",
    why2Title: "透明な方法論",
    why2Body:
      "リスクスコアは文書化され、重みが公開された評価フレームワークに基づいています。",
    why3Title: "証拠に基づく検証",
    why3Body:
      "検証ステータスは利用可能な証拠と紐づきます。証拠がなければ「検証済み」ラベルはありません。",
    why4Title: "人のレビュー",
    why4Body:
      "AI はプロセスを支援します。検証の決定は人が行い、現地業務も人が行います。",
    aiNote: "AI はプロセスを支援し、検証の決定は人が行います。",
    humanAiTitle: "人と AI の協働方法",
    humanAiLead:
      "AI は読み取り、整理、下書きを支援します。公開または買い手に送信する前に、すべての成果物を人がレビューします。",
    humanAiItems: [
      "AI が公開記録をスキャンし、日付と数字を抽出し、所見の初版を起草します。",
      "人が出典を確認し、文脈をチェックし、レポートの内容を決定します。",
      "AI が証拠のギャップを指摘し、人がそのギャップが重要かどうかを判断します。",
      "AI は検証レベルやリスク評価を発行しません。レビュアーのみが行います。",
    ],
    principlesTitle: "私たちが決して破らない6つの原則",
    principlesLead: "初稿から最終レポートまで、すべての検証はこれらのルールに従います。",
    principles: [
      "不確実性を隠さない。事実を確認できなかった場合は、レポートに明記します。",
      "データがないことは良い知らせではない。証拠の欠如はスコアを下げますが、確認として扱うことは決してありません。",
      "証明書は販売しません。検証とトレーニングを行います。",
      "第三者レポートはレビューのみ。再発行や転送はしません。",
      "支払いによって結果は変わりません。有料の検証でも問題が検出されることがあります。",
      "サンプルとケーススタディは常にデモンストレーションとして明示します。",
    ],
  },

  // ---------------- 德语 ----------------
  de: {
    badge: "Trust Center",
    h1: "Trust Center",
    lead:
      "Wer wir sind, was wir verifizieren, was wir nicht verifizieren und wie wir mit Belegen umgehen. Veröffentlicht, damit Sie uns prüfen können, bevor Sie uns bitten, andere zu prüfen.",
    metaTitle:
      "Trust Center — Wer betreibt FactoryAuditB2B und was wir verifizieren",
    metaDesc:
      "Handelsregistereintrag, betreibendes Unternehmen, Verifizierungsmethodik, Verifizierungsstufen, Belegrichtlinie und Datenschutz für FactoryAuditB2B.",
    regTitle: "Handelsregistereintrag",
    regLead:
      "Öffentliche Verifikation, keine vollständige Offenlegung. Wir veröffentlichen die Registrierungsdaten, die ein Käufer benötigt, und maskieren persönliche und sensible Kennungen teilweise.",
    legalEntityLabel: "Name der juristischen Person",
    brandLabel: "Marke",
    brandValue: "FactoryAuditB2B",
    countryLabel: "Registriertes Land / Region",
    cityLabel: "Stadt",
    registrationYearLabel: "Jahr der Registrierung",
    statusLabel: "Registrierungsstatus",
    authorityLabel: "Registrierungsbehörde",
    verificationDateLabel: "Verifizierungsdatum",
    legalRepLabel: "Gesetzlicher Vertreter",
    registrationNumberLabel: "Registriernummer",
    addressLabel: "Registrierte Adresse",
    maskedNote:
      "Teilweise maskiert. Der vollständige Wert wird nicht im offenen Internet veröffentlicht und ist auf Anfrage unter einer unterzeichneten Anfrage verfügbar.",
    viewDocument: "Handelsregistereintrag ansehen",
    notConfigured: "Die Handelsregisterdaten sind noch nicht veröffentlicht.",
    notConfiguredLead:
      "Wir veröffentlichen unseren Registrierungsnachweis, sobald der Administrator ihn hinzugefügt hat. Bis dahin fragen Sie uns direkt, wir senden ihn Ihnen zu.",
    operatesTitle: "Wer betreibt FactoryAuditB2B?",
    operatesBody:
      "FactoryAuditB2B ist eine Plattform und Marke, betrieben von {entity}. Der Markenname ist nicht der Name der juristischen Person, und wir stellen beide nicht als dasselbe dar.",
    operatesLead:
      "FactoryAuditB2B wird von einem in China registrierten Unternehmen betrieben und bietet Lieferantenverifizierung, Fabrikaudits und Beschaffungsunterstützung für globale Käufer.",
    operatesNotConfigured:
      "FactoryAuditB2B wird von einem registrierten Unternehmen betrieben. Wir veröffentlichen den Namen der juristischen Person, sobald er im Trust Center konfiguriert ist.",
    scopeTitle: "Geschäftsumfang",
    scopeBody:
      "Lieferantenverifizierung, Fabrikaudit, Inspektion und Beschaffungsunterstützung für Käufer, die aus China und Südostasien importieren. Phase 1 umfasst China, Vietnam und Thailand.",
    verifyTitle: "Was wir verifizieren",
    verifyLead: "Diese Prüfungen umfasst unser Verifizierungsservice.",
    verify: [
      "Identität des Unternehmens",
      "Standort der Fabrik",
      "Dokumente",
      "Zertifizierungen",
      "Produktionskapazität",
      "Audit-Belege",
    ],
    notVerifyTitle: "Was wir nicht verifizieren",
    notVerifyLead:
      "Die Grenze klar zu benennen ist Teil des Service. Ein Verifizierungsbericht ist nur nützlich, wenn er sagt, was nicht geprüft wurde.",
    notVerify: [
      "Wir zertifizieren Lieferanten nicht selbst, sofern nicht ausdrücklich angegeben.",
      "Wir prüfen keine Finanzberichte, außer Sie bitten uns darum.",
      "Wir verifizieren keine Subunternehmer, die uns nicht offengelegt wurden.",
      "Wir garantieren keine Produktleistung im Gebrauch.",
      "Wir können absichtlich gefälschte Dokumente nicht mit Sicherheit erkennen, obwohl Querprüfungen die Lücke verkleinern.",
    ],
    methodTitle: "Verifizierungsmethodik",
    methodLead:
      "Risikobewertungen stammen aus einer festen Regel-Engine mit veröffentlichten Gewichten. Gleiche Eingaben ergeben immer dieselbe Bewertung.",
    methodLink: "Die vollständige Methodik lesen",
    levelsTitle: "Verifizierungsstufen",
    levelsLead:
      "Ein Lieferant wird nur dann als verifiziert angezeigt, wenn ein passendes Verifizierungsereignis und Belege existieren.",
    levelDescs: [
      "Kein Verifizierungsnachweis.",
      "Registrierung und Unternehmensidentität geprüft.",
      "Zertifikate, Lizenzen und Auditdokumente geprüft.",
      "Standort mit Ortsnachweis und Fotos bestätigt.",
      "Vor-Ort-Audit mit Feststellungen und schriftlichem Bericht abgeschlossen.",
    ],
    evidenceTitle: "Belegrichtlinie für Lieferanten",
    evidenceLead: "Wie wir mit Dokumenten umgehen, die Lieferanten und Käufer uns geben.",
    evidence: [
      "Jedes Element wird mit Quelle, Datum und Verifizierungsstatus gespeichert.",
      "Originale Drittauditberichte werden als geprüft markiert. Wir verteilen sie nicht weiter.",
      "Lieferanten wählen, was öffentlich, käufersichtbar, eingeschränkt oder privat ist.",
      "Wir veröffentlichen keine vertraulichen Dokumente ohne Genehmigung.",
    ],
    privacyTitle: "Datenschutz & Datensicherheit",
    privacyLead: "Was mit den Informationen passiert, die Sie uns senden.",
    privacy: [
      "Käuferanfragen dienen der Beantwortung und der Erstellung eines Angebots. Wir verkaufen keine Kontaktdaten.",
      "Lieferantendokumente dienen der Pflege des Lieferantenprofils und der Due-Diligence-Unterstützung für Käufer.",
      "Wir veröffentlichen keine vertraulichen Dokumente ohne Genehmigung.",
      "Für Zugriff, Korrektur oder Löschung Ihrer Daten kontaktieren Sie uns über die untenstehenden Angaben.",
    ],
    contactTitle: "Kontakt",
    contactLead:
      "Erreichbare Kanäle. Wenn eine Seite etwas verspricht, das wir nicht liefern können, sagen Sie es uns, wir korrigieren es.",
    contactEmailLabel: "E-Mail",
    whyTitle: "Warum uns vertrauen",
    whyLead: "Vier Dinge, die wir belegen können, und nichts, was wir nicht können.",
    why1Title: "Registriertes Unternehmen",
    why1Body:
      "Betrieben von einem registrierten Unternehmen. Wir veröffentlichen den Firmennamen, statt uns hinter einer Marke zu verstecken.",
    why2Title: "Transparente Methodik",
    why2Body:
      "Risikobewertungen basieren auf einem dokumentierten Bewertungsrahmen mit veröffentlichten Gewichten.",
    why3Title: "Belegbasierte Verifizierung",
    why3Body:
      "Der Verifizierungsstatus ist an verfügbare Belege gekoppelt. Kein Beleg, kein verifiziert-Label.",
    why4Title: "Menschliche Prüfung",
    why4Body:
      "KI unterstützt den Prozess. Menschen treffen die Verifizierungsentscheidungen, und Vor-Ort-Arbeit wird von Menschen erledigt.",
    aiNote: "KI unterstützt den Prozess. Menschen treffen die Verifizierungsentscheidungen.",
    humanAiTitle: "Wie Menschen und KI zusammenarbeiten",
    humanAiLead:
      "KI hilft uns beim Lesen, Organisieren und Entwerfen. Eine Person prüft jede Ausgabe, bevor etwas veröffentlicht oder an einen Käufer gesendet wird.",
    humanAiItems: [
      "KI scannt öffentliche Aufzeichnungen, extrahiert Daten und Zahlen und entwirft die erste Version einer Feststellung.",
      "Eine Person prüft die Quelle, den Kontext und entscheidet, was der Bericht sagt.",
      "KI weist auf Beleglücken hin. Eine Person entscheidet, ob eine Lücke wesentlich ist.",
      "KI vergibt keine Verifizierungsstufe oder Risikobewertung. Das tut nur ein Prüfer.",
    ],
    principlesTitle: "Sechs Prinzipien, die wir nie brechen",
    principlesLead: "Vom ersten Entwurf bis zum endgültigen Bericht folgt jede Verifizierung diesen Regeln.",
    principles: [
      "Unsicherheit nie verbergen. Wenn wir eine Tatsache nicht bestätigen konnten, sagt das der Bericht.",
      "Keine Daten sind keine gute Nachricht. Fehlende Belege senken die Bewertung; sie werden nie als Bestätigung behandelt.",
      "Wir verkaufen keine Zertifikate. Wir verifizieren und wir schulen.",
      "Drittberichte werden geprüft, nie neu ausgestellt oder weitergeleitet.",
      "Zahlung ändert das Ergebnis nicht. Eine bezahlte Verifizierung kann trotzdem Probleme aufzeigen.",
      "Stichproben und Fallstudien sind immer als Demonstrationen gekennzeichnet.",
    ],
  },

  // ---------------- 法语 ----------------
  fr: {
    badge: "Centre de confiance",
    h1: "Centre de confiance",
    lead:
      "Qui nous sommes, ce que nous vérifions, ce que nous ne vérifions pas et comment nous traitons les preuves. Publié pour que vous puissiez nous vérifier avant de nous demander de vérifier qui que ce soit d'autre.",
    metaTitle:
      "Centre de confiance — Qui exploite FactoryAuditB2B et ce que nous vérifions",
    metaDesc:
      "Enregistrement commercial, entité exploitante, méthodologie de vérification, niveaux de vérification, politique de preuves et protection des données pour FactoryAuditB2B.",
    regTitle: "Enregistrement commercial",
    regLead:
      "Vérification publique, pas divulgation complète. Nous publions les faits d'enregistrement dont un acheteur a besoin et masquons partiellement les identifiants personnels et sensibles.",
    legalEntityLabel: "Nom de l'entité légale",
    brandLabel: "Marque",
    brandValue: "FactoryAuditB2B",
    countryLabel: "Pays / région d'enregistrement",
    cityLabel: "Ville",
    registrationYearLabel: "Année d'enregistrement",
    statusLabel: "Statut d'enregistrement",
    authorityLabel: "Autorité d'enregistrement",
    verificationDateLabel: "Date de vérification",
    legalRepLabel: "Représentant légal",
    registrationNumberLabel: "Numéro d'enregistrement",
    addressLabel: "Adresse enregistrée",
    maskedNote:
      "Partiellement masqué. La valeur complète n'est pas publiée sur Internet et est disponible sur demande sous une demande signée.",
    viewDocument: "Voir l'enregistrement commercial",
    notConfigured: "Les détails de l'enregistrement commercial ne sont pas encore publiés.",
    notConfiguredLead:
      "Nous publions notre dossier d'enregistrement dès que l'administrateur l'a ajouté. En attendant, demandez-nous directement et nous vous l'enverrons.",
    operatesTitle: "Qui exploite FactoryAuditB2B ?",
    operatesBody:
      "FactoryAuditB2B est une plateforme et une marque exploitées par {entity}. Le nom de la marque n'est pas le nom de l'entité légale, et nous ne les présentons pas comme identiques.",
    operatesLead:
      "FactoryAuditB2B est exploité par une société enregistrée en Chine et fournit la vérification de fournisseurs, l'audit d'usine et le support d'approvisionnement pour les acheteurs mondiaux.",
    operatesNotConfigured:
      "FactoryAuditB2B est exploité par une société enregistrée. Nous publions le nom de l'entité légale dès qu'il est configuré dans le Centre de confiance.",
    scopeTitle: "Périmètre d'activité",
    scopeBody:
      "Vérification de fournisseurs, audit d'usine, inspection et support d'approvisionnement pour les acheteurs important de Chine et d'Asie du Sud-Est. La phase 1 couvre la Chine, le Vietnam et la Thaïlande.",
    verifyTitle: "Ce que nous vérifions",
    verifyLead: "Voici les contrôles couverts par notre service de vérification.",
    verify: [
      "Identité de l'entreprise",
      "Localisation de l'usine",
      "Documents",
      "Certifications",
      "Capacité de production",
      "Preuves d'audit",
    ],
    notVerifyTitle: "Ce que nous ne vérifions pas",
    notVerifyLead:
      "Énoncer la limite fait partie du service. Un rapport de vérification n'est utile que s'il indique ce qui n'a pas été contrôlé.",
    notVerify: [
      "Nous ne certifions pas nous-mêmes les fournisseurs, sauf indication explicite.",
      "Nous n'examinons pas les états financiers sauf si vous nous le demandez.",
      "Nous ne vérifions pas les sous-traitants qui ne nous ont pas été divulgués.",
      "Nous ne garantissons pas la performance du produit en utilisation.",
      "Nous ne pouvons pas détecter avec certitude les documents délibérément falsifiés, bien que les recoupements réduisent l'écart.",
    ],
    methodTitle: "Méthodologie de vérification",
    methodLead:
      "Les scores de risque proviennent d'un moteur de règles fixe avec des pondérations publiées. Les mêmes entrées produisent toujours le même score.",
    methodLink: "Lire la méthodologie complète",
    levelsTitle: "Niveaux de vérification",
    levelsLead:
      "Un fournisseur n'est affiché comme vérifié que lorsqu'un événement de vérification correspondant et des preuves existent.",
    levelDescs: [
      "Aucun enregistrement de vérification.",
      "Enregistrement et identité commerciale examinés.",
      "Certificats, licences et documents d'audit examinés.",
      "Site confirmé avec preuves de localisation et photographies.",
      "Audit sur site terminé avec constatations et rapport écrit.",
    ],
    evidenceTitle: "Politique de preuves des fournisseurs",
    evidenceLead: "Comment nous traitons les documents que fournisseurs et acheteurs nous donnent.",
    evidence: [
      "Chaque élément est stocké avec sa source, sa date et son statut de vérification.",
      "Les rapports d'audit tiers originaux sont marqués comme examinés. Nous ne les redistribuons pas.",
      "Les fournisseurs choisissent ce qui est public, visible par l'acheteur, restreint ou privé.",
      "Nous ne publions pas de documents confidentiels sans autorisation.",
    ],
    privacyTitle: "Confidentialité et protection des données",
    privacyLead: "Ce qui arrive aux informations que vous nous envoyez.",
    privacy: [
      "Les demandes d'acheteurs servent à répondre et à préparer un devis. Nous ne vendons pas de données de contact.",
      "Les documents des fournisseurs servent à maintenir le profil du fournisseur et à soutenir la diligence raisonnable des acheteurs.",
      "Nous ne divulguons pas publiquement de documents confidentiels sans autorisation.",
      "Pour demander l'accès, la correction ou la suppression de vos données, contactez-nous via les coordonnées ci-dessous.",
    ],
    contactTitle: "Contact",
    contactLead:
      "Canaux joignables. Si une page promet quelque chose que nous ne pouvons pas livrer, dites-le-nous et nous corrigerons.",
    contactEmailLabel: "E-mail",
    whyTitle: "Pourquoi nous faire confiance",
    whyLead: "Quatre choses que nous pouvons prouver, et rien que nous ne puissions pas.",
    why1Title: "Société enregistrée",
    why1Body:
      "Exploité par une société enregistrée. Nous publions le nom de l'entité au lieu de nous cacher derrière une marque.",
    why2Title: "Méthodologie transparente",
    why2Body:
      "Les scores de risque reposent sur un cadre d'évaluation documenté avec des pondérations publiées.",
    why3Title: "Vérification fondée sur les preuves",
    why3Body:
      "Le statut de vérification est lié aux preuves disponibles. Pas de preuve, pas de label vérifié.",
    why4Title: "Examen humain",
    why4Body:
      "L'IA assiste le processus. Les décisions de vérification sont prises par des personnes, et le travail sur site est effectué par des personnes.",
    aiNote: "L'IA assiste le processus. Les décisions de vérification sont prises par des personnes.",
    humanAiTitle: "Comment les humains et l'IA travaillent ensemble",
    humanAiLead:
      "L'IA nous aide à lire, organiser et rédiger. Une personne examine chaque résultat avant toute publication ou envoi à un acheteur.",
    humanAiItems: [
      "L'IA analyse les registres publics, extrait dates et chiffres, et rédige la première version d'un constat.",
      "Une personne vérifie la source, le contexte et décide ce que dit le rapport.",
      "L'IA signale les lacunes de preuves. Une personne décide si une lacune est importante.",
      "L'IA n'attribue jamais un niveau de vérification ou une note de risque. Seul un examinateur le fait.",
    ],
    principlesTitle: "Six principes que nous ne violons jamais",
    principlesLead: "Du premier brouillon au rapport final, chaque vérification suit ces règles.",
    principles: [
      "Ne jamais cacher l'incertitude. Si nous n'avons pas pu confirmer un fait, le rapport le dit.",
      "L'absence de données n'est pas une bonne nouvelle. Les preuves manquantes baissent le score ; elles ne sont jamais traitées comme une confirmation.",
      "Nous ne vendons pas de certificats. Nous vérifions et nous formons.",
      "Les rapports tiers sont examinés, jamais réédités ni transmis.",
      "Le paiement ne change pas le résultat. Une vérification payée peut quand même révéler des problèmes.",
      "Les échantillons et études de cas sont toujours étiquetés comme démonstrations.",
    ],
  },

  // ---------------- 西班牙语 ----------------
  es: {
    badge: "Centro de confianza",
    h1: "Centro de confianza",
    lead:
      "Quiénes somos, qué verificamos, qué no verificamos y cómo tratamos las pruebas. Publicado para que puedas comprobarnos antes de pedirnos que comprobemos a cualquier otra persona.",
    metaTitle:
      "Centro de confianza — Quién opera FactoryAuditB2B y qué verificamos",
    metaDesc:
      "Registro mercantil, entidad operadora, metodología de verificación, niveles de verificación, política de pruebas y protección de datos de FactoryAuditB2B.",
    regTitle: "Registro mercantil",
    regLead:
      "Verificación pública, no divulgación completa. Publicamos los datos de registro que un comprador necesita y mantenemos parcialmente ocultos los identificadores personales y sensibles.",
    legalEntityLabel: "Nombre de la entidad legal",
    brandLabel: "Marca",
    brandValue: "FactoryAuditB2B",
    countryLabel: "País / región de registro",
    cityLabel: "Ciudad",
    registrationYearLabel: "Año de registro",
    statusLabel: "Estado del registro",
    authorityLabel: "Autoridad de registro",
    verificationDateLabel: "Fecha de verificación",
    legalRepLabel: "Representante legal",
    registrationNumberLabel: "Número de registro",
    addressLabel: "Dirección registrada",
    maskedNote:
      "Parcialmente oculto. El valor completo no se publica en internet abierto y está disponible previa solicitud firmada.",
    viewDocument: "Ver registro mercantil",
    notConfigured: "Los datos del registro mercantil aún no se han publicado.",
    notConfiguredLead:
      "Publicamos nuestro expediente de registro en cuanto el administrador lo añada. Hasta entonces, pregúntanos directamente y te lo enviaremos.",
    operatesTitle: "¿Quién opera FactoryAuditB2B?",
    operatesBody:
      "FactoryAuditB2B es una plataforma y marca operada por {entity}. El nombre de la marca no es el nombre de la entidad legal, y no los presentamos como lo mismo.",
    operatesLead:
      "FactoryAuditB2B está operado por una empresa registrada en China y ofrece verificación de proveedores, auditoría de fábrica y apoyo de abastecimiento para compradores globales.",
    operatesNotConfigured:
      "FactoryAuditB2B está operado por una empresa registrada. Publicamos el nombre de la entidad legal en cuanto se configure en el Centro de confianza.",
    scopeTitle: "Ámbito de negocio",
    scopeBody:
      "Verificación de proveedores, auditoría de fábrica, inspección y apoyo de abastecimiento para compradores que importan de China y el Sudeste Asiático. La fase 1 cubre China, Vietnam y Tailandia.",
    verifyTitle: "Qué verificamos",
    verifyLead: "Estos son los controles que cubre nuestro servicio de verificación.",
    verify: [
      "Identidad de la empresa",
      "Ubicación de la fábrica",
      "Documentos",
      "Certificaciones",
      "Capacidad de producción",
      "Pruebas de auditoría",
    ],
    notVerifyTitle: "Qué no verificamos",
    notVerifyLead:
      "Declarar el límite es parte del servicio. Un informe de verificación solo es útil si dice qué no se comprobó.",
    notVerify: [
      "No certificamos proveedores por nuestra cuenta salvo que se indique explícitamente.",
      "No revisamos estados financieros salvo que nos lo pidas.",
      "No verificamos subcontratistas que no se nos hayan revelado.",
      "No garantizamos el rendimiento del producto en uso.",
      "No podemos detectar con certeza documentos deliberadamente falsificados, aunque las verificaciones cruzadas reducen la brecha.",
    ],
    methodTitle: "Metodología de verificación",
    methodLead:
      "Las puntuaciones de riesgo provienen de un motor de reglas fijo con pesos publicados. Las mismas entradas siempre producen la misma puntuación.",
    methodLink: "Leer la metodología completa",
    levelsTitle: "Niveles de verificación",
    levelsLead:
      "Un proveedor solo se muestra como verificado cuando existe un evento de verificación correspondiente y pruebas.",
    levelDescs: [
      "Sin registro de verificación.",
      "Registro e identidad comercial revisados.",
      "Certificados, licencias y documentos de auditoría revisados.",
      "Sitio confirmado con pruebas de ubicación y fotografías.",
      "Auditoría en sitio completada con hallazgos e informe escrito.",
    ],
    evidenceTitle: "Política de pruebas de proveedores",
    evidenceLead: "Cómo tratamos los documentos que proveedores y compradores nos entregan.",
    evidence: [
      "Cada elemento se almacena con su fuente, fecha y estado de verificación.",
      "Los informes de auditoría de terceros originales se marcan como revisados. No los redistribuimos.",
      "Los proveedores eligen qué es público, visible para el comprador, restringido o privado.",
      "No publicamos documentos confidenciales sin autorización.",
    ],
    privacyTitle: "Privacidad y protección de datos",
    privacyLead: "Qué ocurre con la información que nos envías.",
    privacy: [
      "Las consultas de compradores se usan para responder y preparar una cotización. No vendemos datos de contacto.",
      "Los documentos de proveedores se usan para mantener el perfil del proveedor y apoyar la diligencia debida del comprador.",
      "No divulgamos públicamente documentos confidenciales sin autorización.",
      "Para solicitar acceso, corrección o eliminación de tus datos, contáctanos mediante los datos a continuación.",
    ],
    contactTitle: "Contacto",
    contactLead:
      "Canales disponibles. Si una página promete algo que no podemos cumplir, dínoslo y lo corregiremos.",
    contactEmailLabel: "Correo electrónico",
    whyTitle: "Por qué confiar en nosotros",
    whyLead: "Cuatro cosas que podemos probar, y nada que no podamos.",
    why1Title: "Empresa registrada",
    why1Body:
      "Operado por una empresa registrada. Publicamos el nombre de la entidad en lugar de escondernos detrás de una marca.",
    why2Title: "Metodología transparente",
    why2Body:
      "Las puntuaciones de riesgo se basan en un marco de evaluación documentado con pesos publicados.",
    why3Title: "Verificación basada en pruebas",
    why3Body:
      "El estado de verificación está ligado a las pruebas disponibles. Sin pruebas, no hay etiqueta de verificado.",
    why4Title: "Revisión humana",
    why4Body:
      "La IA asiste el proceso. Las decisiones de verificación las toman personas, y el trabajo en sitio lo hacen personas.",
    aiNote: "La IA asiste el proceso. Las decisiones de verificación las toman personas.",
    humanAiTitle: "Cómo trabajan juntos humanos e IA",
    humanAiLead:
      "La IA nos ayuda a leer, organizar y redactar. Una persona revisa cada resultado antes de que se publique o se envíe a un comprador.",
    humanAiItems: [
      "La IA escanea registros públicos, extrae fechas y números, y redacta la primera versión de un hallazgo.",
      "Una persona verifica la fuente, comprueba el contexto y decide qué dice el informe.",
      "La IA señala lagunas en las pruebas. Una persona decide si una laguna es material.",
      "La IA nunca emite un nivel de verificación o una calificación de riesgo. Solo lo hace un revisor.",
    ],
    principlesTitle: "Seis principios que nunca rompemos",
    principlesLead: "Desde el primer borrador hasta el informe final, cada verificación sigue estas reglas.",
    principles: [
      "Nunca ocultar la incertidumbre. Si no pudimos confirmar un hecho, el informe lo dice.",
      "La ausencia de datos no es una buena noticia. Las pruebas faltantes bajan la puntuación; nunca se tratan como confirmación.",
      "No vendemos certificados. Verificamos y formamos.",
      "Los informes de terceros se revisan, nunca se reemiten ni se reenvían.",
      "El pago no cambia el resultado. Una verificación pagada puede volver con problemas.",
      "Las muestras y casos de estudio siempre se etiquetan como demostraciones.",
    ],
  },

  // ---------------- 葡萄牙语 ----------------
  pt: {
    badge: "Central de confiança",
    h1: "Central de confiança",
    lead:
      "Quem somos, o que verificamos, o que não verificamos e como tratamos as evidências. Publicado para que você possa nos verificar antes de nos pedir para verificar qualquer outra pessoa.",
    metaTitle:
      "Central de confiança — Quem opera a FactoryAuditB2B e o que verificamos",
    metaDesc:
      "Registro comercial, entidade operadora, metodologia de verificação, níveis de verificação, política de evidências e proteção de dados da FactoryAuditB2B.",
    regTitle: "Registro comercial",
    regLead:
      "Verificação pública, não divulgação completa. Publicamos os fatos de registro que um comprador precisa e mantemos identificadores pessoais e sensíveis parcialmente mascarados.",
    legalEntityLabel: "Nome da entidade legal",
    brandLabel: "Marca",
    brandValue: "FactoryAuditB2B",
    countryLabel: "País / região de registro",
    cityLabel: "Cidade",
    registrationYearLabel: "Ano de registro",
    statusLabel: "Status do registro",
    authorityLabel: "Autoridade de registro",
    verificationDateLabel: "Data de verificação",
    legalRepLabel: "Representante legal",
    registrationNumberLabel: "Número de registro",
    addressLabel: "Endereço registrado",
    maskedNote:
      "Parcialmente mascarado. O valor completo não é publicado na internet aberta e está disponível mediante solicitação assinada.",
    viewDocument: "Ver registro comercial",
    notConfigured: "Os detalhes do registro comercial ainda não foram publicados.",
    notConfiguredLead:
      "Publicamos nosso registro assim que o administrador o adicionar. Até lá, pergunte diretamente e nós o enviaremos.",
    operatesTitle: "Quem opera a FactoryAuditB2B?",
    operatesBody:
      "A FactoryAuditB2B é uma plataforma e marca operada por {entity}. O nome da marca não é o nome da entidade legal, e não os apresentamos como a mesma coisa.",
    operatesLead:
      "A FactoryAuditB2B é operada por uma empresa registrada na China e oferece verificação de fornecedores, auditoria de fábrica e suporte de sourcing para compradores globais.",
    operatesNotConfigured:
      "A FactoryAuditB2B é operada por uma empresa registrada. Publicamos o nome da entidade legal assim que ele for configurado na Central de confiança.",
    scopeTitle: "Âmbito de negócios",
    scopeBody:
      "Verificação de fornecedores, auditoria de fábrica, inspeção e suporte de sourcing para compradores que importam da China e do Sudeste Asiático. A fase 1 cobre China, Vietnã e Tailândia.",
    verifyTitle: "O que verificamos",
    verifyLead: "Estas são as verificações cobertas pelo nosso serviço.",
    verify: [
      "Identidade da empresa",
      "Localização da fábrica",
      "Documentos",
      "Certificações",
      "Capacidade de produção",
      "Evidências de auditoria",
    ],
    notVerifyTitle: "O que não verificamos",
    notVerifyLead:
      "Declarar o limite faz parte do serviço. Um relatório de verificação só é útil se disser o que não foi verificado.",
    notVerify: [
      "Não certificamos fornecedores por conta própria, salvo indicação explícita.",
      "Não revisamos demonstrações financeiras, a menos que você nos peça.",
      "Não verificamos subcontratados que não nos foram divulgados.",
      "Não garantimos o desempenho do produto em uso.",
      "Não podemos detectar com certeza documentos deliberadamente falsificados, embora as verificações cruzadas reduzam a lacuna.",
    ],
    methodTitle: "Metodologia de verificação",
    methodLead:
      "As pontuações de risco vêm de um motor de regras fixo com pesos publicados. As mesmas entradas sempre produzem a mesma pontuação.",
    methodLink: "Ler a metodologia completa",
    levelsTitle: "Níveis de verificação",
    levelsLead:
      "Um fornecedor só é exibido como verificado quando existe um evento de verificação correspondente e evidências.",
    levelDescs: [
      "Nenhum registro de verificação.",
      "Registro e identidade comercial revisados.",
      "Certificados, licenças e documentos de auditoria revisados.",
      "Local confirmado com evidências de localização e fotografias.",
      "Auditoria no local concluída com constatações e relatório escrito.",
    ],
    evidenceTitle: "Política de evidências de fornecedores",
    evidenceLead: "Como tratamos os documentos que fornecedores e compradores nos entregam.",
    evidence: [
      "Cada item é armazenado com sua fonte, data e status de verificação.",
      "Relatórios de auditoria de terceiros originais são marcados como revisados. Não os redistribuímos.",
      "Os fornecedores escolhem o que é público, visível ao comprador, restrito ou privado.",
      "Não publicamos documentos confidenciais sem autorização.",
    ],
    privacyTitle: "Privacidade e proteção de dados",
    privacyLead: "O que acontece com as informações que você nos envia.",
    privacy: [
      "As consultas de compradores são usadas para responder e preparar uma cotação. Não vendemos dados de contato.",
      "Os documentos dos fornecedores são usados para manter o perfil do fornecedor e apoiar a diligência devida do comprador.",
      "Não divulgamos publicamente documentos confidenciais sem autorização.",
      "Para solicitar acesso, correção ou exclusão dos seus dados, entre em contato pelos dados abaixo.",
    ],
    contactTitle: "Contato",
    contactLead:
      "Canais acessíveis. Se uma página prometer algo que não podemos entregar, avise-nos e corrigiremos.",
    contactEmailLabel: "E-mail",
    whyTitle: "Por que confiar em nós",
    whyLead: "Quatro coisas que podemos comprovar, e nada que não possamos.",
    why1Title: "Empresa registrada",
    why1Body:
      "Operada por uma empresa registrada. Publicamos o nome da entidade em vez de nos escondermos atrás de uma marca.",
    why2Title: "Metodologia transparente",
    why2Body:
      "As pontuações de risco são baseadas em uma estrutura de avaliação documentada com pesos publicados.",
    why3Title: "Verificação baseada em evidências",
    why3Body:
      "O status de verificação está ligado às evidências disponíveis. Sem evidências, não há selo de verificado.",
    why4Title: "Revisão humana",
    why4Body:
      "A IA assiste o processo. As decisões de verificação são tomadas por pessoas, e o trabalho no local é feito por pessoas.",
    aiNote: "A IA assiste o processo. As decisões de verificação são tomadas por pessoas.",
    humanAiTitle: "Como humanos e IA trabalham juntos",
    humanAiLead:
      "A IA nos ajuda a ler, organizar e redigir. Uma pessoa revisa cada resultado antes de qualquer publicação ou envio a um comprador.",
    humanAiItems: [
      "A IA examina registros públicos, extrai datas e números e redige a primeira versão de uma constatação.",
      "Uma pessoa verifica a fonte, checa o contexto e decide o que o relatório diz.",
      "A IA sinaliza lacunas nas evidências. Uma pessoa decide se uma lacuna é material.",
      "A IA nunca emite um nível de verificação ou uma nota de risco. Apenas um revisor o faz.",
    ],
    principlesTitle: "Seis princípios que nunca quebramos",
    principlesLead: "Do primeiro rascunho ao relatório final, cada verificação segue estas regras.",
    principles: [
      "Nunca esconder a incerteza. Se não pudemos confirmar um fato, o relatório diz isso.",
      "Ausência de dados não é uma boa notícia. Evidências ausentes reduzem a pontuação; nunca são tratadas como confirmação.",
      "Não vendemos certificados. Verificamos e treinamos.",
      "Relatórios de terceiros são revisados, nunca reemitidos ou encaminhados.",
      "O pagamento não muda o resultado. Uma verificação paga pode voltar com problemas.",
      "Amostras e estudos de caso são sempre rotulados como demonstrações.",
    ],
  },

  // ---------------- 阿拉伯语 ----------------
  ar: {
    badge: "مركز الثقة",
    h1: "مركز الثقة",
    lead:
      "من نحن، وما الذي نتحقق منه، وما الذي لا نتحقق منه، وكيف نتعامل مع الأدلة. ننشر ذلك لتتمكن من فحصنا قبل أن تطلب منا فحص أي جهة أخرى.",
    metaTitle: "مركز الثقة — من يدير FactoryAuditB2B وما الذي نتحقق منه",
    metaDesc:
      "السجل التجاري، الكيان المشغّل، منهجية التحقق، مستويات التحقق، سياسة الأدلة وحماية البيانات لموقع FactoryAuditB2B.",
    regTitle: "السجل التجاري",
    regLead:
      "تحقق عام، وليس كشفاً كاملاً. ننشر وقائع التسجيل التي يحتاجها المشتري ونُخفي جزئياً المعرفات الشخصية والحساسة.",
    legalEntityLabel: "اسم الكيان القانوني",
    brandLabel: "العلامة التجارية",
    brandValue: "FactoryAuditB2B",
    countryLabel: "بلد / منطقة التسجيل",
    cityLabel: "المدينة",
    registrationYearLabel: "سنة التسجيل",
    statusLabel: "حالة التسجيل",
    authorityLabel: "جهة التسجيل",
    verificationDateLabel: "تاريخ التحقق",
    legalRepLabel: "الممثل القانوني",
    registrationNumberLabel: "رقم التسجيل",
    addressLabel: "العنوان المسجل",
    maskedNote:
      "مُخفى جزئياً. لا تُنشر القيمة الكاملة على الإنترنت المفتوح، وهي متاحة عند الطلب من خلال استفسار موقّع.",
    viewDocument: "عرض السجل التجاري",
    notConfigured: "تفاصيل السجل التجاري غير منشورة بعد.",
    notConfiguredLead:
      "ننشر سجلنا التجاري بمجرد أن يضيفه المدير. وحتى ذلك الحين، اسألنا مباشرة وسنرسله إليك.",
    operatesTitle: "من يدير FactoryAuditB2B؟",
    operatesBody:
      "FactoryAuditB2B منصة وعلامة تجارية يديرها {entity}. اسم العلامة التجارية ليس اسم الكيان القانوني، ولا نقدمهما كشيء واحد.",
    operatesLead:
      "تُدار FactoryAuditB2B من قبل شركة مسجلة في الصين وتقدم التحقق من الموردين ومراجعة المصانع ودعم التوريد للمشترين حول العالم.",
    operatesNotConfigured:
      "تُدار FactoryAuditB2B من قبل شركة مسجلة. ننشر اسم الكيان القانوني بمجرد تكوينه في مركز الثقة.",
    scopeTitle: "نطاق الأعمال",
    scopeBody:
      "التحقق من الموردين ومراجعة المصانع والفحص ودعم التوريد للمشترين المستوردين من الصين وجنوب شرق آسيا. تغطي المرحلة الأولى الصين وفيتنام وتايلاند.",
    verifyTitle: "ما الذي نتحقق منه",
    verifyLead: "هذه هي الفحوصات التي تغطيها خدمة التحقق لدينا.",
    verify: [
      "هوية الشركة",
      "موقع المصنع",
      "المستندات",
      "الشهادات",
      "القدرة الإنتاجية",
      "أدلة المراجعة",
    ],
    notVerifyTitle: "ما الذي لا نتحقق منه",
    notVerifyLead:
      "توضيح الحدود جزء من الخدمة. تقرير التحقق لا يكون مفيداً إلا إذا ذكر ما لم يتم فحصه.",
    notVerify: [
      "لا نمنح الموردين شهادات بأنفسنا ما لم يُذكر ذلك صراحةً.",
      "لا نراجع البيانات المالية إلا إذا طلبت ذلك.",
      "لا نتحقق من المقاولين من الباطن الذين لم يفصحوا لنا عنهم.",
      "لا نضمن أداء المنتج عند الاستخدام.",
      "لا يمكننا اكتشاف المستندات المزورة عمداً بشكل مؤكد، رغم أن التدقيق المتبادل يقلص الفجوة.",
    ],
    methodTitle: "منهجية التحقق",
    methodLead:
      "تأتي درجات المخاطر من محرك قواعد ثابت بأوزان منشورة. نفس المدخلات تنتج دائماً نفس الدرجة.",
    methodLink: "قراءة المنهجية كاملة",
    levelsTitle: "مستويات التحقق",
    levelsLead:
      "لا يُعرض المورد على أنه «تم التحقق منه» إلا عند وجود حدث تحقق مطابق وأدلة.",
    levelDescs: [
      "لا يوجد سجل تحقق.",
      "تمت مراجعة التسجيل وهوية الشركة.",
      "تمت مراجعة الشهادات والتراخيص ومستندات المراجعة.",
      "تم تأكيد الموقع بأدلة موقعه وصور فوتوغرافية.",
      "اكتملت مراجعة الموقع مع النتائج وتقرير مكتوب.",
    ],
    evidenceTitle: "سياسة أدلة الموردين",
    evidenceLead: "كيف نتعامل مع المستندات التي يقدمها لنا الموردون والمشترون.",
    evidence: [
      "يُخزن كل عنصر مع مصدره وتاريخه وحالة تحققه.",
      "تُوسم تقارير المراجعة الأصلية من جهات خارجية بأنها قيد المراجعة. لا نعيد توزيعها.",
      "يختار الموردون ما هو عام أو مرئي للمشتري أو مقيد أو خاص.",
      "لا ننشر مستندات سرية دون إذن.",
    ],
    privacyTitle: "الخصوصية وحماية البيانات",
    privacyLead: "ماذا يحدث للمعلومات التي ترسلها إلينا.",
    privacy: [
      "تُستخدم استفسارات المشترين للرد وإعداد عرض السعر. لا نبيع بيانات التواصل.",
      "تُستخدم مستندات الموردين للحفاظ على ملف المورد ودعم العناية الواجبة للمشتري.",
      "لا نفصح علناً عن مستندات سرية دون إذن.",
      "لطلب الوصول إلى بياناتك أو تصحيحها أو حذفها، تواصل معنا عبر التفاصيل أدناه.",
    ],
    contactTitle: "التواصل",
    contactLead:
      "قنوات يمكن الوصول إليها. إذا وعدت صفحة بشيء لا نستطيع تقديمه، أخبرنا وسنصححه.",
    contactEmailLabel: "البريد الإلكتروني",
    whyTitle: "لماذا تثق بنا",
    whyLead: "أربعة أشياء يمكننا إثباتها، ولا شيء لا يمكننا إثباته.",
    why1Title: "شركة مسجلة",
    why1Body: "تُدار من قبل شركة مسجلة. ننشر اسم الكيان بدلاً من الاختباء خلف علامة تجارية.",
    why2Title: "منهجية شفافة",
    why2Body: "تعتمد درجات المخاطر على إطار تقييم موثق بأوزان منشورة.",
    why3Title: "تحقق قائم على الأدلة",
    why3Body: "حالة التحقق مرتبطة بالأدلة المتاحة. لا دليل، لا شارة «تم التحقق».",
    why4Title: "مراجعة بشرية",
    why4Body: "يساعد الذكاء الاصطناعي في العملية. القرارات النهائية يتخذها أشخاص، والعمل الميداني يقوم به أشخاص.",
    aiNote: "يساعد الذكاء الاصطناعي في العملية. القرارات النهائية يتخذها أشخاص.",
    humanAiTitle: "كيف يعمل البشر والذكاء الاصطناعي معاً",
    humanAiLead:
      "يساعدنا الذكاء الاصطناعي في القراءة والتنظيم والصياغة. يراجع شخص كل مخرج قبل نشره أو إرساله إلى مشترٍ.",
    humanAiItems: [
      "يفحص الذكاء الاصطناعي السجلات العامة، ويستخرج التواريخ والأرقام، ويصيغ النسخة الأولى من النتيجة.",
      "يتحقق شخص من المصدر ويفحص السياق ويقرر ما يقوله التقرير.",
      "يشير الذكاء الاصطناعي إلى ثغرات في الأدلة. يقرر شخص ما إذا كانت الثغرة جوهرية.",
      "لا يصدر الذكاء الاصطناعي مستوى تحقق أو درجة مخاطر أبداً. المراجع البشري وحده من يفعل ذلك.",
    ],
    principlesTitle: "ستة مبادئ لا نكسرها أبداً",
    principlesLead: "من المسودة الأولى إلى التقرير النهائي، يتبع كل تحقق هذه القواعد.",
    principles: [
      "لا نخفي عدم اليقين أبداً. إذا لم نتمكن من تأكيد حقيقة، يذكر التقرير ذلك.",
      "غياب البيانات ليس خبراً جيداً. الأدلة المفقودة تخفض الدرجة ولا تُعتبر تأكيداً أبداً.",
      "لا نبيع الشهادات. نحن نتحقق وندرب.",
      "تُراجع تقارير الأطراف الثالثة ولا يُعاد إصدارها أو إرسالها أبداً.",
      "الدفع لا يغير النتيجة. التحقق المدفوع قد يعود بمشاكل.",
      "تُوسم العينات ودراسات الحالة دائماً كتوضيحات.",
    ],
  },
};

// verification.levels / levelsShort 缺失项补齐（仅覆盖 ===en 或缺失项）
const LEVELS_EXTRA = {
  // es 全 5+5 未译
  es: {
    levels: [
      "Nivel 0: Sin verificar",
      "Nivel 1: Información comercial verificada",
      "Nivel 2: Documentos revisados",
      "Nivel 3: Fábrica verificada",
      "Nivel 4: Fábrica auditada",
    ],
    levelsShort: [
      "Sin verificar",
      "Comercial verificada",
      "Documentos revisados",
      "Fábrica verificada",
      "Fábrica auditada",
    ],
  },
  // 其它语言缺的个别项（ja/de/fr/zh-TW/pt/ar 缺 [1][3][4] 或 [3][4]）
  ja: {
    levels: {
      1: "レベル 1: 事業情報を確認済み",
      3: "レベル 3: 工場を検証済み",
      4: "レベル 4: 工場を監査済み",
    },
    levelsShort: {
      3: "工場検証済み",
      4: "工場監査済み",
    },
  },
  de: {
    levels: {
      1: "Stufe 1: Geschäftsinformationen geprüft",
      3: "Stufe 3: Fabrik verifiziert",
      4: "Stufe 4: Fabrik auditiert",
    },
    levelsShort: {
      3: "Fabrik verifiziert",
      4: "Fabrik auditiert",
    },
  },
  fr: {
    levels: {
      1: "Niveau 1 : Informations commerciales vérifiées",
      3: "Niveau 3 : Usine vérifiée",
      4: "Niveau 4 : Usine auditée",
    },
    levelsShort: {
      3: "Usine vérifiée",
      4: "Usine auditée",
    },
  },
  "zh-TW": {
    levels: {
      1: "等級 1：商業資訊已核對",
      3: "等級 3：工廠已核驗",
      4: "等級 4：工廠已驗廠",
    },
    levelsShort: {
      3: "工廠已核驗",
      4: "工廠已驗廠",
    },
  },
  pt: {
    levels: {
      1: "Nível 1: Informações comerciais verificadas",
      3: "Nível 3: Fábrica verificada",
      4: "Nível 4: Fábrica auditada",
    },
    levelsShort: {
      3: "Fábrica verificada",
      4: "Fábrica auditada",
    },
  },
  ar: {
    levels: {
      1: "المستوى 1: تم التحقق من المعلومات التجارية",
      3: "المستوى 3: تم التحقق من المصنع",
      4: "المستوى 4: تمت مراجعة المصنع",
    },
    levelsShort: {
      3: "تم التحقق من المصنع",
      4: "تمت مراجعة المصنع",
    },
  },
};

function apply(locale) {
  const file = path.join(DIR, `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const l10n = TRUST_L10N[locale];
  let written = 0;

  for (const [key, val] of Object.entries(l10n)) {
    const cur = dict.trust ? dict.trust[key] : undefined;
    const enVal = EN_TRUST[key];
    if (Array.isArray(val)) {
      if (!dict.trust) dict.trust = {};
      if (!Array.isArray(dict.trust[key])) dict.trust[key] = [];
      for (let i = 0; i < val.length; i++) {
        if (dict.trust[key][i] === undefined || dict.trust[key][i] === enVal[i]) {
          dict.trust[key][i] = val[i];
          written++;
        }
      }
    } else {
      if (!dict.trust) dict.trust = {};
      if (cur === undefined || cur === enVal) {
        dict.trust[key] = val;
        written++;
      }
    }
  }

  // verification.levels / levelsShort 补齐
  const extra = LEVELS_EXTRA[locale];
  if (extra) {
    for (const arrKey of ["levels", "levelsShort"]) {
      const src = extra[arrKey];
      if (!src) continue;
      const enArr = en.verification[arrKey];
      if (!dict.verification) dict.verification = {};
      if (!Array.isArray(dict.verification[arrKey])) dict.verification[arrKey] = [];
      const entries = Array.isArray(src) ? src.map((v, i) => [i, v]) : Object.entries(src).map(([i, v]) => [Number(i), v]);
      for (const [i, v] of entries) {
        if (dict.verification[arrKey][i] === undefined || dict.verification[arrKey][i] === enArr[i]) {
          dict.verification[arrKey][i] = v;
          written++;
        }
      }
    }
  }

  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`${locale}: 写入 ${written} 键`);
}

for (const loc of Object.keys(TRUST_L10N)) apply(loc);
console.log("完成。");
