/**
 * /suppliers V2 优化 —— 9 语字典注入（幂等）
 *
 * 纪律：
 *   1. 只动 suppliers 命名空间；新增键 + 覆写指定的 8 个既有键，其余键原样保留。
 *   2. 绝不删 Supplier 数据、不改数据库权限、不改会员逻辑 —— 本脚本只写文案。
 *   3. 品牌词 Founder Buyer 保持英文（lock-brand-terms 约定）。
 *   4. 输出格式：2 空格缩进 + CRLF + 文件末尾换行（与现有字典一致）。
 *
 * 用法：node scripts/apply-suppliers-v2-i18n.cjs
 */
const fs = require("fs");
const path = require("path");

const D = path.join(process.cwd(), "i18n", "dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

// 值数组按 LOCALES 顺序一一对应
const V = {
  // ---------- 覆写既有键 ----------
  h1: [
    "Explore Global Suppliers",
    "探索全球供应商",
    "探索全球供應商",
    "世界中のサプライヤーを探す",
    "Explore proveedores globales",
    "Globale Lieferanten entdecken",
    "Explorez les fournisseurs du monde entier",
    "Explore fornecedores globais",
    "استكشف الموردين حول العالم",
  ],
  lead: [
    "Discover real suppliers across China and Southeast Asia. Explore products, certifications, factory information and risk signals before you buy.",
    "发现来自中国及东南亚的真实供应商，了解产品、认证、工厂信息和风险信号，再决定是否下单。",
    "發掘來自中國及東南亞的真實供應商，了解產品、認證、工廠資訊與風險訊號，再決定是否下單。",
    "中国および東南アジアの実際のサプライヤーを見つけましょう。製品・認証・工場情報・リスクシグナルを発注前に確認できます。",
    "Descubra proveedores reales en China y el sudeste asiático. Explore productos, certificaciones, información de fábrica y señales de riesgo antes de comprar.",
    "Entdecken Sie echte Lieferanten in China und Südostasien. Prüfen Sie Produkte, Zertifizierungen, Fabrikdaten und Risikosignale vor dem Kauf.",
    "Découvrez de vrais fournisseurs en Chine et en Asie du Sud-Est. Explorez produits, certifications, informations d'usine et signaux de risque avant d'acheter.",
    "Descubra fornecedores reais na China e no Sudeste Asiático. Veja produtos, certificações, dados de fábrica e sinais de risco antes de comprar.",
    "اكتشف موردين حقيقيين في الصين وجنوب شرق آسيا. اطّلع على المنتجات والشهادات ومعلومات المصنع ومؤشرات المخاطر قبل الشراء.",
  ],
  // 品牌名由 buildPageMetadata 自动追加 "| FactoryAuditB2B"，这里不要重复写品牌。
  // 原标题含 "Verified Suppliers"，与「2 家零证据」的事实冲突，必须去掉。
  metaTitle: [
    "Global Supplier Database - China & Southeast Asia Suppliers",
    "全球供应商数据库 - 中国及东南亚供应商",
    "全球供應商資料庫 - 中國及東南亞供應商",
    "グローバルサプライヤーデータベース - 中国および東南アジアのサプライヤー",
    "Base de datos global de proveedores - China y el sudeste asiático",
    "Globale Lieferantendatenbank - China und Südostasien",
    "Base de données mondiale de fournisseurs - Chine et Asie du Sud-Est",
    "Base global de fornecedores - China e Sudeste Asiático",
    "قاعدة بيانات الموردين العالمية - الصين وجنوب شرق آسيا",
  ],
  metaDesc: [
    "Discover manufacturers and suppliers in China and Southeast Asia. Explore supplier profiles, products, risk signals and verification services with FactoryAuditB2B.",
    "发现中国及东南亚的制造商与供应商。浏览供应商档案、产品、风险信号，并了解 FactoryAuditB2B 的核验服务。",
    "發掘中國及東南亞的製造商與供應商。瀏覽供應商檔案、產品、風險訊號，並了解 FactoryAuditB2B 的驗證服務。",
    "中国および東南アジアのメーカーとサプライヤーを探せます。プロフィール、製品、リスクシグナル、検証サービスをご確認ください。",
    "Descubra fabricantes y proveedores en China y el sudeste asiático. Explore perfiles, productos, señales de riesgo y servicios de verificación.",
    "Entdecken Sie Hersteller und Lieferanten in China und Südostasien. Profile, Produkte, Risikosignale und Verifizierungsdienste.",
    "Découvrez des fabricants et fournisseurs en Chine et en Asie du Sud-Est. Profils, produits, signaux de risque et services de vérification.",
    "Descubra fabricantes e fornecedores na China e no Sudeste Asiático. Veja perfis, produtos, sinais de risco e serviços de verificação.",
    "اكتشف المصنّعين والموردين في الصين وجنوب شرق آسيا. استعرض الملفات والمنتجات ومؤشرات المخاطر وخدمات التحقق.",
  ],
  // 原 "Unlock the full supplier database" 让首次访问者以为这是收费目录 → 改为卖 intelligence
  unlockTitle: [
    "Need deeper supplier intelligence?",
    "需要更深入的供应商情报？",
    "需要更深入的供應商情報？",
    "より深いサプライヤー情報が必要ですか？",
    "¿Necesita inteligencia de proveedores más profunda?",
    "Brauchen Sie tiefere Lieferanten-Intelligenz?",
    "Besoin d'une intelligence fournisseur plus approfondie ?",
    "Precisa de inteligência mais profunda sobre fornecedores?",
    "هل تحتاج إلى معلومات أعمق عن الموردين؟",
  ],
  unlockLead: [
    "Founder Buyer members can access enhanced supplier intelligence, including evidence records, risk insights, deeper factory information and advanced supplier research.",
    "Founder Buyer 会员可获取增强的供应商情报，包括证据记录、风险洞察、更深入的工厂信息与高级供应商研究。",
    "Founder Buyer 會員可取得增強的供應商情報，包括證據紀錄、風險洞察、更深入的工廠資訊與進階供應商研究。",
    "Founder Buyer メンバーは、証拠記録、リスク分析、より詳細な工場情報、高度なサプライヤーリサーチを含む強化された情報を利用できます。",
    "Los miembros Founder Buyer acceden a inteligencia de proveedores mejorada: registros de evidencia, análisis de riesgo, información más profunda de fábrica e investigación avanzada.",
    "Founder Buyer Mitglieder erhalten erweiterte Lieferanten-Intelligenz: Evidenzakten, Risikoanalysen, tiefere Fabrikdaten und erweiterte Recherche.",
    "Les membres Founder Buyer accèdent à une intelligence fournisseur enrichie : dossiers de preuves, analyses de risque, informations d'usine approfondies et recherche avancée.",
    "Membros Founder Buyer têm acesso a inteligência aprimorada: registros de evidência, análises de risco, dados mais profundos da fábrica e pesquisa avançada.",
    "يمكن لأعضاء Founder Buyer الوصول إلى معلومات محسّنة عن الموردين: سجلات الأدلة وتحليلات المخاطر ومعلومات أعمق عن المصنع وبحث متقدم.",
  ],
  // 原 "Free accounts get {n} supplier profiles per month." 把 5 个/月当成第一层卖点 → 降级为补充说明
  unlockNote: [
    "Basic supplier information is free to browse. Free accounts can access a limited number of enhanced supplier profiles each month.",
    "基础供应商信息免费浏览。免费账户每月可访问有限数量的增强供应商档案。",
    "基礎供應商資訊免費瀏覽。免費帳戶每月可存取有限數量的增強供應商檔案。",
    "基本的なサプライヤー情報は無料で閲覧できます。無料アカウントでは、拡張プロフィールの閲覧は毎月一定数までです。",
    "La información básica es gratuita. Las cuentas gratuitas pueden acceder a un número limitado de perfiles mejorados cada mes.",
    "Grundlegende Lieferanteninformationen sind kostenlos. Kostenlose Konten können jeden Monat eine begrenzte Anzahl erweiterter Profile aufrufen.",
    "Les informations de base sont gratuites. Les comptes gratuits peuvent consulter un nombre limité de profils enrichis chaque mois.",
    "As informações básicas são gratuitas. Contas gratuitas podem acessar um número limitado de perfis aprimorados por mês.",
    "المعلومات الأساسية مجانية. يمكن للحسابات المجانية الوصول إلى عدد محدود من الملفات المحسّنة كل شهر.",
  ],
  // 系统当前只支持 公司名 / 产品 / 城市 三个字段，placeholder 不得宣称能搜认证（避免虚假能力）
  searchPlaceholder: [
    "Search suppliers, products or cities",
    "搜索供应商、产品或城市",
    "搜尋供應商、產品或城市",
    "サプライヤー・製品・都市で検索",
    "Buscar proveedores, productos o ciudades",
    "Lieferanten, Produkte oder Städte suchen",
    "Rechercher des fournisseurs, produits ou villes",
    "Buscar fornecedores, produtos ou cidades",
    "ابحث عن موردين أو منتجات أو مدن",
  ],

  // ---------- 新增键 ----------
  freeNote: [
    "Basic supplier information is free to browse.",
    "基础供应商信息免费浏览。",
    "基礎供應商資訊免費瀏覽。",
    "基本的なサプライヤー情報は無料でご覧いただけます。",
    "La información básica de proveedores se consulta gratis.",
    "Grundlegende Lieferanteninformationen sind kostenlos einsehbar.",
    "Les informations de base sur les fournisseurs sont consultables gratuitement.",
    "As informações básicas de fornecedores são de consulta gratuita.",
    "يمكن تصفح المعلومات الأساسية عن الموردين مجانًا.",
  ],
  evidenceLevel: [
    "Evidence level",
    "证据等级",
    "證據等級",
    "証拠レベル",
    "Nivel de evidencia",
    "Evidenzstufe",
    "Niveau de preuve",
    "Nível de evidência",
    "مستوى الأدلة",
  ],
  // 0 条证据 → 不得显示 verified / audited
  evidenceNone: [
    "No evidence on file",
    "暂无证据记录",
    "暫無證據紀錄",
    "証拠記録なし",
    "Sin evidencia registrada",
    "Keine Evidenz hinterlegt",
    "Aucune preuve enregistrée",
    "Sem evidência registrada",
    "لا توجد أدلة مسجلة",
  ],
  // ≥1 条已核验证据 → 只说「文件已审核」，不说「工厂已核验 / 已审核」（无 audit 记录支撑）
  evidenceDocs: [
    "Documents reviewed",
    "文件已审核",
    "文件已審核",
    "書類を確認済み",
    "Documentos revisados",
    "Dokumente geprüft",
    "Documents examinés",
    "Documentos revisados",
    "تمت مراجعة المستندات",
  ],
  lastEvidence: [
    "Last evidence",
    "最近证据",
    "最近證據",
    "最新の証拠",
    "Última evidencia",
    "Letzte Evidenz",
    "Dernière preuve",
    "Última evidência",
    "آخر دليل",
  ],
  svcTitle: [
    "Need to verify a supplier before you order?",
    "下单前需要核验供应商？",
    "下單前需要驗證供應商？",
    "発注前にサプライヤーを確認しますか？",
    "¿Necesita verificar un proveedor antes de hacer el pedido?",
    "Möchten Sie einen Lieferanten vor der Bestellung prüfen?",
    "Besoin de vérifier un fournisseur avant de commander ?",
    "Precisa verificar um fornecedor antes de fazer o pedido?",
    "هل تحتاج إلى التحقق من مورد قبل الطلب؟",
  ],
  svcLead: [
    "FactoryAuditB2B can help with supplier verification, factory audit, product inspection, sourcing and compliance.",
    "FactoryAuditB2B 可提供供应商核验、工厂审核、产品检验、采购寻源与合规服务。",
    "FactoryAuditB2B 可提供供應商驗證、工廠審核、產品檢驗、採購尋源與合規服務。",
    "FactoryAuditB2B はサプライヤー検証、工場監査、製品検査、 sourcing、コンプライアンスに対応できます。",
    "FactoryAuditB2B puede ayudar con verificación de proveedores, auditoría de fábrica, inspección de producto, sourcing y cumplimiento.",
    "FactoryAuditB2B unterstützt bei Lieferantenprüfung, Werksaudit, Produktinspektion, Sourcing und Compliance.",
    "FactoryAuditB2B peut vous aider : vérification de fournisseurs, audit d'usine, inspection produit, sourcing et conformité.",
    "A FactoryAuditB2B pode ajudar com verificação de fornecedores, auditoria de fábrica, inspeção de produto, sourcing e conformidade.",
    "يمكن لـ FactoryAuditB2B المساعدة في التحقق من الموردين وتدقيق المصانع وفحص المنتجات والتوريد والامتثال.",
  ],
  svcCta: [
    "Request Supplier Verification",
    "申请供应商核验",
    "申請供應商驗證",
    "サプライヤー検証を依頼する",
    "Solicitar verificación de proveedor",
    "Lieferantenprüfung anfragen",
    "Demander une vérification de fournisseur",
    "Solicitar verificação de fornecedor",
    "اطلب التحقق من مورد",
  ],
  faq1q: [
    "Are supplier profiles free to browse?",
    "供应商档案可以免费浏览吗？",
    "供應商檔案可以免費瀏覽嗎？",
    "サプライヤープロフィールは無料で閲覧できますか？",
    "¿Se pueden consultar gratis los perfiles de proveedores?",
    "Sind Lieferantenprofile kostenlos einsehbar?",
    "Les profils de fournisseurs sont-ils consultables gratuitement ?",
    "Os perfis de fornecedores podem ser consultados gratuitamente?",
    "هل يمكن تصفح ملفات الموردين مجانًا؟",
  ],
  faq1a: [
    "Yes. Basic supplier information is available for discovery. Enhanced intelligence and verification services may require membership or a paid service.",
    "可以。基础供应商信息免费开放浏览；更深入的情报与核验服务可能需要会员资格或付费服务。",
    "可以。基礎供應商資訊免費開放瀏覽；更深入的情報與驗證服務可能需要會員資格或付費服務。",
    "はい。基本情報は無料で閲覧できます。より深い情報や検証サービスには会員登録または有料サービスが必要な場合があります。",
    "Sí. La información básica está disponible para su consulta. La inteligencia mejorada y los servicios de verificación pueden requerir membresía o un servicio de pago.",
    "Ja. Grundlegende Informationen sind frei einsehbar. Erweiterte Intelligenz und Verifizierungsdienste können eine Mitgliedschaft oder einen kostenpflichtigen Service erfordern.",
    "Oui. Les informations de base sont disponibles. L'intelligence enrichie et les services de vérification peuvent nécessiter une adhésion ou un service payant.",
    "Sim. As informações básicas estão disponíveis para consulta. Inteligência aprimorada e serviços de verificação podem exigir assinatura ou serviço pago.",
    "نعم. المعلومات الأساسية متاحة للتصفح. قد تتطلب المعلومات المحسّنة وخدمات التحقق عضوية أو خدمة مدفوعة.",
  ],
  faq2q: [
    "Are all suppliers verified?",
    "所有供应商都已核验吗？",
    "所有供應商都已驗證嗎？",
    "すべてのサプライヤーは検証済みですか？",
    "¿Están todos los proveedores verificados?",
    "Sind alle Lieferanten verifiziert?",
    "Tous les fournisseurs sont-ils vérifiés ?",
    "Todos os fornecedores são verificados?",
    "هل جميع الموردين موثّقون؟",
  ],
  faq2a: [
    "No. Supplier information is shown with different evidence levels. FactoryAuditB2B does not treat self-declared information as independently verified.",
    "不是。供应商信息按不同的证据等级展示。FactoryAuditB2B 不会把供应商自我声明的信息视为已独立核验。",
    "不是。供應商資訊依不同的證據等級呈現。FactoryAuditB2B 不會將供應商自我聲明的資訊視為已獨立驗證。",
    "いいえ。サプライヤー情報は証拠レベルに応じて表示されます。FactoryAuditB2B は自己申告情報を独立検証済みとはみなしません。",
    "No. La información se muestra con distintos niveles de evidencia. FactoryAuditB2B no considera la información autodeclarada como verificada de forma independiente.",
    "Nein. Lieferanteninformationen werden mit unterschiedlichen Evidenzstufen angezeigt. FactoryAuditB2B behandelt selbst gemeldete Angaben nicht als unabhängig verifiziert.",
    "Non. Les informations sont affichées avec différents niveaux de preuve. FactoryAuditB2B ne considère pas les informations autodéclarées comme vérifiées de manière indépendante.",
    "Não. As informações são exibidas com diferentes níveis de evidência. A FactoryAuditB2B não trata informações autodeclaradas como verificadas de forma independente.",
    "لا. تُعرض معلومات الموردين بمستويات أدلة مختلفة. لا تعتبر FactoryAuditB2B المعلومات المُصرَّح بها ذاتيًا مؤكدة بشكل مستقل.",
  ],
  faq3q: [
    "Can I request a supplier verification?",
    "可以申请核验某家供应商吗？",
    "可以申請驗證某家供應商嗎？",
    "サプライヤーの検証を依頼できますか？",
    "¿Puedo solicitar la verificación de un proveedor?",
    "Kann ich eine Lieferantenprüfung anfragen?",
    "Puis-je demander la vérification d'un fournisseur ?",
    "Posso solicitar a verificação de um fornecedor?",
    "هل يمكنني طلب التحقق من مورد؟",
  ],
  faq3a: [
    "Yes. Send us the supplier details and we will check the company, the site and the available documents before you place an order.",
    "可以。把供应商信息发给我们，我们会在你下单前核查公司主体、现场和现有文件。",
    "可以。把供應商資訊提供給我們，我們會在您下單前核查公司主體、現場與現有文件。",
    "はい。サプライヤー情報をご連絡いただければ、ご発注前に会社・現場・入手可能な書類を確認します。",
    "Sí. Envíenos los datos del proveedor y comprobaremos la empresa, las instalaciones y los documentos disponibles antes de que haga el pedido.",
    "Ja. Senden Sie uns die Lieferantendaten und wir prüfen Unternehmen, Standort und verfügbare Dokumente vor Ihrer Bestellung.",
    "Oui. Envoyez-nous les informations du fournisseur : nous vérifierons l'entreprise, le site et les documents disponibles avant votre commande.",
    "Sim. Envie os dados do fornecedor e verificaremos a empresa, o local e os documentos disponíveis antes de você fazer o pedido.",
    "نعم. أرسل لنا بيانات المورد وسنتحقق من الشركة والموقع والمستندات المتاحة قبل تقديم الطلب.",
  ],
};

let total = 0;
for (let i = 0; i < LOCALES.length; i++) {
  const loc = LOCALES[i];
  const file = path.join(D, `${loc}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const json = JSON.parse(raw);
  if (!json.suppliers) throw new Error(`${loc}.json 缺少 suppliers 命名空间`);

  let n = 0;
  for (const [key, values] of Object.entries(V)) {
    if (i >= values.length) throw new Error(`${key} 缺 ${loc} 的翻译`);
    if (json.suppliers[key] !== values[i]) n++;
    json.suppliers[key] = values[i];
  }

  // 格式：2 空格缩进 → CRLF → 末尾换行（与现有字典文件保持一致）
  const out = JSON.stringify(json, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  total += n;
  console.log(`${loc.padEnd(6)} 写入/更新 ${n} 个键`);
}
console.log(`\n完成：9 语 × ${Object.keys(V).length} 键，共变更 ${total} 处`);
