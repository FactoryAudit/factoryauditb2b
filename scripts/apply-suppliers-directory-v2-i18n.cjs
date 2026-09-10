/**
 * Supplier Directory V2 —— 9 语字典注入（幂等）
 *
 * 目标：把 /suppliers 的 #supplier-directory 区块明确为
 *   「免费发现 + 免费基础资料 + 深度情报/核验/工厂服务收费」
 *
 * 纪律：
 *   1. 只动 suppliers 命名空间，其余键原样保留。
 *   2. 不虚构规模数字（countLabel 仍由 filtered.length 实时算）。
 *   3. 品牌词 Founder Buyer 保持英文。
 *   4. ⚠️ 不改 notListedTitle —— 它被首页 app/[locale]/page.tsx 引用，
 *      改了就等于顺手改 Homepage（指令§40 禁止）。
 *   5. 服务名复用既有 servicesIndex.items.*，不重复造词。
 *   6. 输出：2 空格缩进 + CRLF + 末尾换行。
 *
 * 用法：node scripts/apply-suppliers-directory-v2-i18n.cjs
 */
const fs = require("fs");
const path = require("path");

const D = path.join(process.cwd(), "i18n", "dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

const V = {
  // ---------- 覆写既有键 ----------
  lead: [
    "Discover suppliers across China and Southeast Asia. Browse basic supplier information, products, certifications and risk signals for free.",
    "免费发现来自中国及东南亚的供应商，浏览基础公司信息、产品、认证与风险信号。",
    "免費發掘來自中國及東南亞的供應商，瀏覽基礎公司資訊、產品、認證與風險訊號。",
    "中国および東南アジアのサプライヤーを無料で探せます。基礎情報、製品、認証、リスクシグナルを閲覧できます。",
    "Descubra proveedores en China y el sudeste asiático. Consulte gratis información básica, productos, certificaciones y señales de riesgo.",
    "Entdecken Sie Lieferanten in China und Südostasien. Basisinformationen, Produkte, Zertifizierungen und Risikosignale kostenlos ansehen.",
    "Découvrez des fournisseurs en Chine et en Asie du Sud-Est. Consultez gratuitement les informations de base, produits, certifications et signaux de risque.",
    "Descubra fornecedores na China e no Sudeste Asiático. Veja gratuitamente informações básicas, produtos, certificações e sinais de risco.",
    "اكتشف الموردين في الصين وجنوب شرق آسيا. تصفح المعلومات الأساسية والمنتجات والشهادات ومؤشرات المخاطر مجانًا.",
  ],
  metaDesc: [
    "Discover suppliers across China and Southeast Asia. Explore products, certifications, supplier information and risk signals, with verification, audit and inspection services available when you need deeper due diligence.",
    "发现中国及东南亚的供应商。浏览产品、认证、供应商信息与风险信号；需要更深入尽调时可申请核验、审核与验货服务。",
    "發掘中國及東南亞的供應商。瀏覽產品、認證、供應商資訊與風險訊號；需要更深入盡職調查時可申請驗證、審核與驗貨服務。",
    "中国および東南アジアのサプライヤーを探せます。製品・認証・情報・リスクシグナルを閲覧でき、必要に応じて検証・監査・検査サービスもご利用いただけます。",
    "Descubra proveedores en China y el sudeste asiático. Explore productos, certificaciones, información y señales de riesgo, con servicios de verificación, auditoría e inspección disponibles.",
    "Entdecken Sie Lieferanten in China und Südostasien. Produkte, Zertifizierungen, Informationen und Risikosignale; dazu Verifizierungs-, Audit- und Inspektionsdienste.",
    "Découvrez des fournisseurs en Chine et en Asie du Sud-Est. Produits, certifications, informations et signaux de risque, avec vérification, audit et inspection disponibles.",
    "Descubra fornecedores na China e no Sudeste Asiático. Veja produtos, certificações, informações e sinais de risco, com verificação, auditoria e inspeção disponíveis.",
    "اكتشف الموردين في الصين وجنوب شرق آسيا. استعرض المنتجات والشهادات ومعلومات الموردين ومؤشرات المخاطر، مع إمكانية التحقق والتدقيق والفحص.",
  ],
  searchButton: [
    "Search Suppliers",
    "搜索供应商",
    "搜尋供應商",
    "サプライヤーを検索",
    "Buscar proveedores",
    "Lieferanten suchen",
    "Rechercher des fournisseurs",
    "Buscar fornecedores",
    "ابحث عن موردين",
  ],
  // 「Featured suppliers」→「Supplier Directory」：去掉"精选"暗示（指令 §5）
  featuredTitle: [
    "Supplier Directory",
    "供应商目录",
    "供應商目錄",
    "サプライヤーディレクトリ",
    "Directorio de proveedores",
    "Lieferantenverzeichnis",
    "Annuaire de fournisseurs",
    "Diretório de fornecedores",
    "دليل الموردين",
  ],
  featuredLead: [
    "Browse available suppliers and explore their public profiles.",
    "浏览现有供应商，查看他们的公开档案。",
    "瀏覽現有供應商，查看他們的公開檔案。",
    "登録済みのサプライヤーを閲覧し、公開プロフィールをご確認ください。",
    "Consulte los proveedores disponibles y explore sus perfiles públicos.",
    "Verfügbare Lieferanten ansehen und öffentliche Profile erkunden.",
    "Consultez les fournisseurs disponibles et explorez leurs profils publics.",
    "Veja os fornecedores disponíveis e explore seus perfis públicos.",
    "تصفح الموردين المتاحين واستعرض ملفاتهم العامة.",
  ],
  // 旧文案强调"不是完整市场、覆盖很小" → 改为"可免费浏览 + 找不到可发 RFQ"
  exampleNote: [
    "Browse available suppliers for free. If you cannot find the right supplier, post an RFQ and we can help source and verify one for you.",
    "可免费浏览现有供应商。若未找到合适的，可发布 RFQ，我们可协助寻源并核验。",
    "可免費瀏覽現有供應商。若未找到合適的，可發布 RFQ，我們可協助尋源並驗證。",
    "登録済みのサプライヤーは無料で閲覧できます。見つからない場合は RFQ を投稿いただければ、 sourcing と検証を支援します。",
    "Consulte los proveedores disponibles gratis. Si no encuentra el adecuado, publique un RFQ y le ayudaremos a buscarlo y verificarlo.",
    "Verfügbare Lieferanten kostenlos ansehen. Passend? RFQ posten – wir helfen bei Sourcing und Verifizierung.",
    "Consultez les fournisseurs disponibles gratuitement. Introuvable ? Publiez un RFQ : nous vous aidons à sourcer et vérifier.",
    "Veja os fornecedores disponíveis gratuitamente. Não encontrou? Publique um RFQ e ajudamos a buscar e verificar.",
    "تصفح الموردين المتاحين مجانًا. إن لم تجد المناسب، أرسل RFQ ونساعدك في التوريد والتحقق.",
  ],
  riskLabel: [
    "Risk Signal",
    "风险信号",
    "風險訊號",
    "リスクシグナル",
    "Señal de riesgo",
    "Risikosignal",
    "Signal de risque",
    "Sinal de risco",
    "مؤشر المخاطر",
  ],
  evidenceLevel: [
    "Evidence",
    "证据",
    "證據",
    "証拠",
    "Evidencia",
    "Evidenz",
    "Preuves",
    "Evidência",
    "الأدلة",
  ],
  evidenceDocs: [
    "Evidence reviewed: {n}",
    "已审核证据：{n}",
    "已審核證據：{n}",
    "確認済みの証拠：{n}",
    "Evidencia revisada: {n}",
    "Geprüfte Evidenz: {n}",
    "Preuves examinées : {n}",
    "Evidência revisada: {n}",
    "الأدلة المراجعة: {n}",
  ],
  evidenceNone: [
    "Not yet reviewed",
    "尚未审核",
    "尚未審核",
    "未確認",
    "Aún sin revisar",
    "Noch nicht geprüft",
    "Pas encore examiné",
    "Ainda não revisado",
    "لم تتم المراجعة بعد",
  ],
  notListedLead: [
    "Tell us what you need. We can help source suitable suppliers and, when requested, verify the company and factory before you place an order.",
    "告诉我们您的需求。我们可协助寻源合适的供应商，并在需要时于您下单前核验公司与工厂。",
    "告訴我們您的需求。我們可協助尋源合適的供應商，並在需要時於您下單前驗證公司與工廠。",
    "必要な条件をお知らせください。最適なサプライヤーの sourcing と、ご要望に応じてご発注前の会社・工場の検証を支援します。",
    "Cuéntenos qué necesita. Podemos ayudarle a buscar proveedores adecuados y, si lo solicita, verificar la empresa y la fábrica antes de su pedido.",
    "Sagen Sie uns, was Sie brauchen. Wir helfen bei der Suche passender Lieferanten und prüfen auf Wunsch Unternehmen und Werk vor Ihrer Bestellung.",
    "Dites-nous ce dont vous avez besoin. Nous pouvons sourcer des fournisseurs adaptés et, sur demande, vérifier l'entreprise et l'usine avant votre commande.",
    "Diga o que você precisa. Podemos ajudar a buscar fornecedores adequados e, se solicitado, verificar a empresa e a fábrica antes do pedido.",
    "أخبرنا بما تحتاجه. يمكننا المساعدة في توريد موردين مناسبين، وعند الطلب، التحقق من الشركة والمصنع قبل الطلب.",
  ],
  claimLead: [
    "Create a free supplier profile and get discovered by international buyers. Need independent verification? Request our Supplier Verification or Factory Audit services.",
    "免费创建供应商档案，让国际买家发现您。需要独立核验？可申请我们的供应商核验或工厂审核服务。",
    "免費建立供應商檔案，讓國際買家發現您。需要獨立驗證？可申請我們的供應商驗證或工廠審核服務。",
    "無料でサプライヤープロフィールを作成し、海外バイヤーに見つけてもらいましょう。独立した検証が必要な場合は、サプライヤー検証または工場監査サービスをご依頼ください。",
    "Cree un perfil de proveedor gratuito y déjese encontrar por compradores internacionales. ¿Necesita verificación independiente? Solicite nuestros servicios de verificación o auditoría de fábrica.",
    "Erstellen Sie ein kostenloses Lieferantenprofil und werden Sie von internationalen Einkäufern gefunden. Unabhängige Prüfung nötig? Fordern Sie unsere Lieferantenprüfung oder Werksaudit an.",
    "Créez un profil fournisseur gratuit et soyez découvert par des acheteurs internationaux. Besoin d'une vérification indépendante ? Demandez nos services de vérification ou d'audit d'usine.",
    "Crie um perfil de fornecedor gratuito e seja descoberto por compradores internacionais. Precisa de verificação independente? Solicite nossos serviços de verificação ou auditoria de fábrica.",
    "أنشئ ملف مورد مجاني وكن مرئيًا للمشترين الدوليين. هل تحتاج تحققًا مستقلًا؟ اطلب خدمات التحقق من الموردين أو تدقيق المصنع.",
  ],
  svcTitle: [
    "Need More Confidence Before You Order?",
    "下单前需要更多把握？",
    "下單前需要更多把握？",
    "ご発注前にさらなる確信が欲しいですか？",
    "¿Necesita más confianza antes de hacer el pedido?",
    "Brauchen Sie mehr Sicherheit vor der Bestellung?",
    "Besoin de plus de confiance avant de commander ?",
    "Precisa de mais confiança antes de fazer o pedido?",
    "هل تحتاج مزيدًا من الثقة قبل الطلب؟",
  ],
  svcLead: [
    "Supplier discovery is free. For deeper intelligence and independent checks, request:",
    "供应商发现免费。如需更深入的情报与独立核查，可申请：",
    "供應商發掘免費。如需更深入的情報與獨立查核，可申請：",
    "サプライヤーの探索は無料です。より深い情報と独立した確認が必要な場合は、以下をご依頼ください：",
    "La búsqueda de proveedores es gratuita. Para inteligencia más profunda y comprobaciones independientes, solicite:",
    "Die Lieferantensuche ist kostenlos. Für tiefere Einblicke und unabhängige Prüfungen anfragen:",
    "La découverte de fournisseurs est gratuite. Pour une intelligence plus poussée et des vérifications indépendantes, demandez :",
    "A descoberta de fornecedores é gratuita. Para inteligência mais profunda e verificações independentes, solicite:",
    "اكتشاف الموردين مجاني. للحصول على معلومات أعمق وتحقق مستقل، اطلب:",
  ],
  svcCta: [
    "Request Verification",
    "申请核验",
    "申請驗證",
    "検証を依頼する",
    "Solicitar verificación",
    "Verifizierung anfragen",
    "Demander une vérification",
    "Solicitar verificação",
    "اطلب التحقق",
  ],
  unlockLead: [
    "Founder Buyer members can access enhanced supplier intelligence, including evidence records, risk insights, deeper factory information, advanced supplier research and supplier monitoring.",
    "Founder Buyer 会员可获取增强的供应商情报，包括证据记录、风险洞察、更深入的工厂信息、高级供应商研究与供应商监控。",
    "Founder Buyer 會員可取得增強的供應商情報，包括證據紀錄、風險洞察、更深入的工廠資訊、進階供應商研究與供應商監控。",
    "Founder Buyer メンバーは、証拠記録、リスク分析、詳細な工場情報、高度なリサーチ、サプライヤーモニタリングを含む強化情報を利用できます。",
    "Los miembros Founder Buyer acceden a inteligencia mejorada: registros de evidencia, análisis de riesgo, información más profunda de fábrica, investigación avanzada y monitorización.",
    "Founder Buyer Mitglieder erhalten erweiterte Intelligenz: Evidenzakten, Risikoanalysen, tiefere Fabrikdaten, erweiterte Recherche und Monitoring.",
    "Les membres Founder Buyer accèdent à une intelligence enrichie : dossiers de preuves, analyses de risque, informations d'usine approfondies, recherche avancée et suivi.",
    "Membros Founder Buyer têm acesso a inteligência aprimorada: registros de evidência, análises de risco, dados de fábrica, pesquisa avançada e monitoramento.",
    "يمكن لأعضاء Founder Buyer الوصول إلى معلومات محسّنة: سجلات الأدلة وتحليلات المخاطر ومعلومات المصنع والبحث المتقدم والمراقبة.",
  ],

  // ---------- 新增键 ----------
  verificationLabel: [
    "Verification",
    "核验状态",
    "驗證狀態",
    "検証ステータス",
    "Verificación",
    "Verifizierung",
    "Vérification",
    "Verificação",
    "التحقق",
  ],
  verificationNotYet: [
    "Not yet verified",
    "尚未核验",
    "尚未驗證",
    "未検証",
    "Aún no verificado",
    "Noch nicht verifiziert",
    "Pas encore vérifié",
    "Ainda não verificado",
    "لم يتم التحقق بعد",
  ],
  trustNote: [
    "Supplier profiles may contain self-declared information and publicly available data. Verification status and evidence levels are shown separately. FactoryAuditB2B does not treat supplier claims as independent verification.",
    "供应商档案可能包含供应商自我声明的信息与公开数据。核验状态与证据等级分开呈现。FactoryAuditB2B 不会将供应商声明视为独立核验。",
    "供應商檔案可能包含供應商自我聲明的資訊與公開資料。驗證狀態與證據等級分開呈現。FactoryAuditB2B 不會將供應商聲明視為獨立驗證。",
    "サプライヤープロフィールには自己申告情報や公開データが含まれる場合があります。検証ステータスと証拠レベルは別々に表示されます。FactoryAuditB2B はサプライヤーの申告を独立した検証とはみなしません。",
    "Los perfiles pueden contener información autodeclarada y datos públicos. El estado de verificación y los niveles de evidencia se muestran por separado. FactoryAuditB2B no considera las declaraciones del proveedor como verificación independiente.",
    "Profile können selbst gemeldete Angaben und öffentliche Daten enthalten. Verifizierungsstatus und Evidenzstufen werden getrennt ausgewiesen. FactoryAuditB2B behandelt Lieferantenangaben nicht als unabhängige Verifizierung.",
    "Les profils peuvent contenir des informations autodéclarées et des données publiques. Le statut de vérification et les niveaux de preuve sont affichés séparément. FactoryAuditB2B ne considère pas les déclarations comme une vérification indépendante.",
    "Os perfis podem conter informações autodeclaradas e dados públicos. Status de verificação e níveis de evidência são exibidos separadamente. A FactoryAuditB2B não trata declarações como verificação independente.",
    "قد تحتوي ملفات الموردين على معلومات مُصرَّح بها ذاتيًا وبيانات عامة. يُعرض حالة التحقق ومستويات الأدلة بشكل منفصل. لا تعتبر FactoryAuditB2B تصريحات الموردين تحققًا مستقلًا.",
  ],
  riskNote: [
    "Risk signals are based on currently available supplier information and evidence. They are not a substitute for independent verification or an on-site audit.",
    "风险信号基于当前可得的供应商信息与证据，不能替代独立核验或现场审核。",
    "風險訊號基於目前可得的供應商資訊與證據，不能取代獨立驗證或現場審核。",
    "リスクシグナルは現在入手可能な情報と証拠に基づくもので、独立した検証や実地監査の代わりにはなりません。",
    "Las señales de riesgo se basan en la información y evidencia disponibles. No sustituyen una verificación independiente ni una auditoría in situ.",
    "Risikosignale basieren auf verfügbaren Informationen und Evidenz. Sie ersetzen keine unabhängige Verifizierung oder Vor-Ort-Audit.",
    "Les signaux de risque reposent sur les informations et preuves disponibles. Ils ne remplacent pas une vérification indépendante ni un audit sur site.",
    "Os sinais de risco baseiam-se nas informações e evidências disponíveis. Não substituem verificação independente nem auditoria in loco.",
    "تعتمد مؤشرات المخاطر على المعلومات والأدلة المتاحة حاليًا. لا تغني عن التحقق المستقل أو التدقيق الميداني.",
  ],
  svcNote: [
    "Supplier discovery is free. Verification and field services are paid services.",
    "供应商发现免费。核验与现场服务为付费服务。",
    "供應商發掘免費。驗證與現場服務為付費服務。",
    "サプライヤーの探索は無料です。検証および現場サービスは有料です。",
    "La búsqueda de proveedores es gratuita. La verificación y los servicios de campo son de pago.",
    "Die Lieferantensuche ist kostenlos. Verifizierung und Feldservices sind kostenpflichtig.",
    "La découverte de fournisseurs est gratuite. La vérification et les services terrain sont payants.",
    "A descoberta de fornecedores é gratuita. Verificação e serviços de campo são pagos.",
    "اكتشاف الموردين مجاني. التحقق والخدمات الميدانية خدمات مدفوعة.",
  ],
  founderCta: [
    "View Founder Buyer",
    "了解 Founder Buyer",
    "了解 Founder Buyer",
    "Founder Buyer を見る",
    "Ver Founder Buyer",
    "Founder Buyer ansehen",
    "Voir Founder Buyer",
    "Ver Founder Buyer",
    "اطّلع على Founder Buyer",
  ],
  cardCta: [
    "View Supplier",
    "查看供应商",
    "查看供應商",
    "サプライヤーを見る",
    "Ver proveedor",
    "Lieferant ansehen",
    "Voir le fournisseur",
    "Ver fornecedor",
    "عرض المورد",
  ],
  faq4q: [
    "What does the risk signal mean?",
    "风险信号是什么意思？",
    "風險訊號是什麼意思？",
    "リスクシグナルとは何ですか？",
    "¿Qué significa la señal de riesgo?",
    "Was bedeutet das Risikosignal?",
    "Que signifie le signal de risque ?",
    "O que significa o sinal de risco?",
    "ماذا يعني مؤشر المخاطر؟",
  ],
  faq4a: [
    "Risk signals are based on currently available supplier information and evidence. They are not a substitute for independent verification or an on-site audit.",
    "风险信号基于当前可得的供应商信息与证据，不能替代独立核验或现场审核。",
    "風險訊號基於目前可得的供應商資訊與證據，不能取代獨立驗證或現場審核。",
    "リスクシグナルは現在入手可能な情報と証拠に基づくもので、独立した検証や実地監査の代わりにはなりません。",
    "Las señales de riesgo se basan en la información y evidencia disponibles. No sustituyen una verificación independiente ni una auditoría in situ.",
    "Risikosignale basieren auf verfügbaren Informationen und Evidenz. Sie ersetzen keine unabhängige Verifizierung oder ein Vor-Ort-Audit.",
    "Les signaux de risque reposent sur les informations et preuves disponibles. Ils ne remplacent pas une vérification indépendante ni un audit sur site.",
    "Os sinais de risco baseiam-se nas informações e evidências disponíveis. Não substituem verificação independente nem auditoria in loco.",
    "تعتمد مؤشرات المخاطر على المعلومات والأدلة المتاحة. لا تغني عن التحقق المستقل أو التدقيق الميداني.",
  ],
};

let total = 0;
for (let i = 0; i < LOCALES.length; i++) {
  const loc = LOCALES[i];
  const file = path.join(D, `${loc}.json`);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!json.suppliers) throw new Error(`${loc}.json 缺少 suppliers 命名空间`);

  let n = 0;
  for (const [key, values] of Object.entries(V)) {
    if (i >= values.length) throw new Error(`${key} 缺 ${loc} 的翻译`);
    if (json.suppliers[key] !== values[i]) n++;
    json.suppliers[key] = values[i];
  }

  fs.writeFileSync(
    file,
    JSON.stringify(json, null, 2).replace(/\n/g, "\r\n") + "\r\n",
    "utf8"
  );
  total += n;
  console.log(`${loc.padEnd(6)} 写入/更新 ${n} 个键`);
}
console.log(`\n完成：9 语 × ${Object.keys(V).length} 键，共变更 ${total} 处`);
