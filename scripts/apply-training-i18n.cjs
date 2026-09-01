/**
 * training-plans 页面本地化（#58 A 类硬编码英文迁移）。
 *
 * 原 PLANS/FAQ 数组硬编码在 app/[locale]/training-plans/page.tsx，
 * 本脚本把文案迁入字典 trainingPlans.plans / .faq / .priceNote。
 * 结构字段（price 数字、hl 高亮标记）不入字典；period 按语言翻译。
 *
 * 安全规则：
 *  - 对每个语言，仅当 trainingPlans.plans/faq/priceNote **缺失**时写入
 *    （数组一旦存在即视为已就绪，避免覆盖后续人工修订）；
 *  - 9 语言（含 en）一次写入，保证 TS 类型 Dictionary 结构一致。
 *
 * 用法：
 *   node scripts/apply-training-i18n.cjs --dry
 *   node scripts/apply-training-i18n.cjs
 */
const fs = require("fs");
const path = require("path");

const D = path.join(__dirname, "..", "i18n", "dictionaries");
const DRY = process.argv.includes("--dry");

const CONTENT = {
  en: {
    priceNote: "All prices in USD, per factory.",
    plans: [
      {
        name: "Starter Training",
        price: "$280",
        period: "/ factory",
        features: [
          "1-day on-site quality basics",
          "QC checklist & SOP template",
          "Pre-training gap audit",
          "Certificate of completion",
        ],
        cta: "Start",
      },
      {
        name: "Pro Training",
        price: "$950",
        period: "/ factory",
        features: [
          "3-day quality system + QC",
          "Production process training",
          "Management review workshop",
          "Post-training audit & report",
          "Quarterly refresher",
        ],
        cta: "Choose Pro",
      },
      {
        name: "Enterprise Training",
        price: "Custom",
        period: "",
        features: [
          "Multi-site rollout",
          "Compliance & safety modules",
          "Train-the-trainer program",
          "Dedicated account manager",
          "API & reporting",
        ],
        cta: "Contact us",
      },
    ],
    faq: [
      {
        q: "Who delivers the training?",
        a: "Our auditors and QC engineers deliver training on-site or online, in the factory's working language where possible.",
      },
      {
        q: "Does training include an audit?",
        a: "Every plan starts with a gap audit so the training targets the factory's real weaknesses, not generic slides.",
      },
      {
        q: "Can training be tailored to my industry?",
        a: "Yes. We scope the modules (quality, QC, production process, compliance) to your product and target market.",
      },
    ],
  },
  zh: {
    priceNote: "全部价格以美元计，按工厂报价。",
    plans: [
      {
        name: "入门培训",
        price: "$280",
        period: "/ 每家工厂",
        features: [
          "1 天现场质量基础",
          "QC 检查清单与 SOP 模板",
          "培训前差距审计",
          "完成证书",
        ],
        cta: "开始",
      },
      {
        name: "专业培训",
        price: "$950",
        period: "/ 每家工厂",
        features: [
          "3 天质量体系与 QC",
          "生产流程培训",
          "管理评审工作坊",
          "培训后审计与报告",
          "季度复习",
        ],
        cta: "选择专业版",
      },
      {
        name: "企业培训",
        price: "定制",
        period: "",
        features: [
          "多工厂推广",
          "合规与安全模块",
          "培训师培训计划",
          "专属客户经理",
          "API 与报告",
        ],
        cta: "联系我们",
      },
    ],
    faq: [
      {
        q: "由谁授课？",
        a: "我们的审核员和 QC 工程师授课，可在现场或线上进行，条件允许时使用工厂的工作语言。",
      },
      {
        q: "培训包含审计吗？",
        a: "每个方案都从差距审计开始，让培训针对工厂的实际弱点，而不是通用课件。",
      },
      {
        q: "培训能按行业定制吗？",
        a: "可以。我们根据你的产品和目标市场规划模块（质量、QC、生产流程、合规）。",
      },
    ],
  },
  "zh-TW": {
    priceNote: "全部價格以美元計，按工廠報價。",
    plans: [
      {
        name: "入門培訓",
        price: "$280",
        period: "/ 每家工廠",
        features: [
          "1 天現場品質基礎",
          "QC 檢查清單與 SOP 模板",
          "培訓前差距審計",
          "完成證書",
        ],
        cta: "開始",
      },
      {
        name: "專業培訓",
        price: "$950",
        period: "/ 每家工廠",
        features: [
          "3 天品質體系與 QC",
          "生產流程培訓",
          "管理評審工作坊",
          "培訓後審計與報告",
          "季度複習",
        ],
        cta: "選擇專業版",
      },
      {
        name: "企業培訓",
        price: "客製",
        period: "",
        features: [
          "多工廠推廣",
          "合規與安全模組",
          "培訓師培訓計畫",
          "專屬客戶經理",
          "API 與報告",
        ],
        cta: "聯絡我們",
      },
    ],
    faq: [
      {
        q: "由誰授課？",
        a: "我們的審核員與 QC 工程師授課，可在現場或線上進行，條件允許時使用工廠的工作語言。",
      },
      {
        q: "培訓包含審計嗎？",
        a: "每個方案都從差距審計開始，讓培訓針對工廠的實際弱點，而不是通用教材。",
      },
      {
        q: "培訓能按行業客製嗎？",
        a: "可以。我們根據你的產品與目標市場規劃模組（品質、QC、生產流程、合規）。",
      },
    ],
  },
  ja: {
    priceNote: "すべての価格は米ドル建て、工場ごとに提示します。",
    plans: [
      {
        name: "スタータートレーニング",
        price: "$280",
        period: "/ 工場ごと",
        features: [
          "1日間のオンサイト品質基礎",
          "QCチェックリストとSOPテンプレート",
          "トレーニング前ギャップ監査",
          "修了証書",
        ],
        cta: "始める",
      },
      {
        name: "プロトレーニング",
        price: "$950",
        period: "/ 工場ごと",
        features: [
          "3日間の品質システムとQC",
          "生産工程トレーニング",
          "マネジメントレビュー研修",
          "トレーニング後の監査とレポート",
          "四半期ごとの復習",
        ],
        cta: "プロを選ぶ",
      },
      {
        name: "エンタープライズトレーニング",
        price: "カスタム",
        period: "",
        features: [
          "複数工場への展開",
          "コンプライアンスと安全モジュール",
          "トレーナー養成プログラム",
          "専任アカウントマネージャー",
          "APIとレポート",
        ],
        cta: "お問い合わせ",
      },
    ],
    faq: [
      {
        q: "誰がトレーニングを実施しますか？",
        a: "当社の監査員とQCエンジニアが、可能な場合は工場の使用言語で、オンサイトまたはオンラインで実施します。",
      },
      {
        q: "トレーニングには監査が含まれますか？",
        a: "すべてのプランはギャップ監査から始まるため、一般的な資料ではなく、工場の実際の弱点に合わせた内容になります。",
      },
      {
        q: "業界に合わせてカスタマイズできますか？",
        a: "はい。製品と対象市場に合わせてモジュール（品質、QC、生産工程、コンプライアンス）を構成します。",
      },
    ],
  },
  de: {
    priceNote: "Alle Preise in USD, pro Fabrik.",
    plans: [
      {
        name: "Starter-Training",
        price: "$280",
        period: "/ pro Fabrik",
        features: [
          "1-tägige Qualitätsgrundlagen vor Ort",
          "QC-Checkliste und SOP-Vorlage",
          "Gap-Audit vor dem Training",
          "Abschlusszertifikat",
        ],
        cta: "Starten",
      },
      {
        name: "Pro-Training",
        price: "$950",
        period: "/ pro Fabrik",
        features: [
          "3-tägiges Qualitätssystem und QC",
          "Produktionsprozess-Training",
          "Management-Review-Workshop",
          "Audit und Bericht nach dem Training",
          "Vierteljährliche Auffrischung",
        ],
        cta: "Pro wählen",
      },
      {
        name: "Enterprise-Training",
        price: "Individuell",
        period: "",
        features: [
          "Rollout an mehreren Standorten",
          "Compliance- und Sicherheitsmodule",
          "Train-the-Trainer-Programm",
          "Fester Ansprechpartner",
          "API und Reporting",
        ],
        cta: "Kontaktieren Sie uns",
      },
    ],
    faq: [
      {
        q: "Wer führt das Training durch?",
        a: "Unsere Auditoren und QC-Ingenieure führen das Training vor Ort oder online durch, möglichst in der Arbeitssprache der Fabrik.",
      },
      {
        q: "Ist ein Audit im Training enthalten?",
        a: "Jedes Paket beginnt mit einem Gap-Audit, damit das Training auf die tatsächlichen Schwächen der Fabrik eingeht statt auf allgemeine Folien.",
      },
      {
        q: "Kann das Training auf meine Branche zugeschnitten werden?",
        a: "Ja. Wir passen die Module (Qualität, QC, Produktionsprozess, Compliance) an Ihr Produkt und Ihren Zielmarkt an.",
      },
    ],
  },
  fr: {
    priceNote: "Tous les prix en USD, par usine.",
    plans: [
      {
        name: "Formation Starter",
        price: "$280",
        period: "/ par usine",
        features: [
          "Bases qualité d'une journée sur site",
          "Checklist QC et modèle SOP",
          "Audit d'écart avant la formation",
          "Certificat de fin de formation",
        ],
        cta: "Commencer",
      },
      {
        name: "Formation Pro",
        price: "$950",
        period: "/ par usine",
        features: [
          "Système qualité et QC sur 3 jours",
          "Formation au processus de production",
          "Atelier de revue de direction",
          "Audit et rapport après la formation",
          "Révision trimestrielle",
        ],
        cta: "Choisir Pro",
      },
      {
        name: "Formation Entreprise",
        price: "Sur mesure",
        period: "",
        features: [
          "Déploiement multi-sites",
          "Modules conformité et sécurité",
          "Programme de formation de formateurs",
          "Gestionnaire de compte dédié",
          "API et reporting",
        ],
        cta: "Nous contacter",
      },
    ],
    faq: [
      {
        q: "Qui dispense la formation ?",
        a: "Nos auditeurs et ingénieurs QC dispensent la formation sur site ou en ligne, dans la langue de travail de l'usine lorsque c'est possible.",
      },
      {
        q: "La formation inclut-elle un audit ?",
        a: "Chaque formule commence par un audit d'écart afin que la formation cible les faiblesses réelles de l'usine, pas des présentations génériques.",
      },
      {
        q: "La formation peut-elle être adaptée à mon secteur ?",
        a: "Oui. Nous calibrons les modules (qualité, QC, processus de production, conformité) selon votre produit et votre marché cible.",
      },
    ],
  },
  es: {
    priceNote: "Todos los precios en USD, por fábrica.",
    plans: [
      {
        name: "Formación Starter",
        price: "$280",
        period: "/ por fábrica",
        features: [
          "Fundamentos de calidad de 1 día en el sitio",
          "Checklist de control de calidad y plantilla SOP",
          "Auditoría de brechas antes de la formación",
          "Certificado de finalización",
        ],
        cta: "Empezar",
      },
      {
        name: "Formación Pro",
        price: "$950",
        period: "/ por fábrica",
        features: [
          "Sistema de calidad y control de calidad de 3 días",
          "Formación en proceso de producción",
          "Taller de revisión de gerencia",
          "Auditoría e informe posteriores a la formación",
          "Refresco trimestral",
        ],
        cta: "Elegir Pro",
      },
      {
        name: "Formación Enterprise",
        price: "Personalizado",
        period: "",
        features: [
          "Despliegue en múltiples plantas",
          "Módulos de cumplimiento y seguridad",
          "Programa de formación de formadores",
          "Gerente de cuenta dedicado",
          "API e informes",
        ],
        cta: "Contáctanos",
      },
    ],
    faq: [
      {
        q: "¿Quién imparte la formación?",
        a: "Nuestros auditores e ingenieros de control de calidad la imparten en el sitio o en línea, en el idioma de trabajo de la fábrica cuando es posible.",
      },
      {
        q: "¿La formación incluye una auditoría?",
        a: "Cada plan comienza con una auditoría de brechas para que la formación aborde las debilidades reales de la fábrica, no diapositivas genéricas.",
      },
      {
        q: "¿Puedo adaptar la formación a mi sector?",
        a: "Sí. Ajustamos los módulos (calidad, control de calidad, proceso de producción, cumplimiento) a tu producto y mercado objetivo.",
      },
    ],
  },
  pt: {
    priceNote: "Todos os preços em USD, por fábrica.",
    plans: [
      {
        name: "Formação Starter",
        price: "$280",
        period: "/ por fábrica",
        features: [
          "Fundamentos de qualidade de 1 dia no local",
          "Checklist de controle de qualidade e modelo SOP",
          "Auditoria de lacunas antes do treinamento",
          "Certificado de conclusão",
        ],
        cta: "Começar",
      },
      {
        name: "Formação Pro",
        price: "$950",
        period: "/ por fábrica",
        features: [
          "Sistema de qualidade e controle de qualidade de 3 dias",
          "Treinamento do processo de produção",
          "Workshop de revisão gerencial",
          "Auditoria e relatório pós-treinamento",
          "Reciclagem trimestral",
        ],
        cta: "Escolher Pro",
      },
      {
        name: "Formação Enterprise",
        price: "Personalizado",
        period: "",
        features: [
          "Implantação em várias unidades",
          "Módulos de conformidade e segurança",
          "Programa de treinamento de instrutores",
          "Gerente de conta dedicado",
          "API e relatórios",
        ],
        cta: "Fale conosco",
      },
    ],
    faq: [
      {
        q: "Quem ministra o treinamento?",
        a: "Nossos auditores e engenheiros de controle de qualidade ministram presencialmente ou on-line, no idioma de trabalho da fábrica quando possível.",
      },
      {
        q: "O treinamento inclui auditoria?",
        a: "Cada plano começa com uma auditoria de lacunas para que o treinamento foque nas fraquezas reais da fábrica, não em slides genéricos.",
      },
      {
        q: "Posso personalizar o treinamento para o meu setor?",
        a: "Sim. Ajustamos os módulos (qualidade, controle de qualidade, processo de produção, conformidade) ao seu produto e mercado-alvo.",
      },
    ],
  },
  ar: {
    priceNote: "جميع الأسعار بالدولار الأمريكي، لكل مصنع.",
    plans: [
      {
        name: "التدريب الأساسي",
        price: "$280",
        period: "/ لكل مصنع",
        features: [
          "أساسيات الجودة ليوم واحد في الموقع",
          "قائمة فحص الجودة وقالب SOP",
          "تدقيق الفجوة قبل التدريب",
          "شهادة إتمام",
        ],
        cta: "ابدأ",
      },
      {
        name: "التدريب الاحترافي",
        price: "$950",
        period: "/ لكل مصنع",
        features: [
          "نظام الجودة ومراقبة الجودة لمدة 3 أيام",
          "تدريب عملية الإنتاج",
          "ورشة مراجعة الإدارة",
          "تدقيق وتقرير بعد التدريب",
          "مراجعة ربع سنوية",
        ],
        cta: "اختر الاحترافي",
      },
      {
        name: "تدريب المؤسسات",
        price: "حسب الطلب",
        period: "",
        features: [
          "التوسع في عدة مصانع",
          "وحدات الامتثال والسلامة",
          "برنامج تدريب المدربين",
          "مدير حساب مخصص",
          "واجهة API والتقارير",
        ],
        cta: "اتصل بنا",
      },
    ],
    faq: [
      {
        q: "من يقدم التدريب؟",
        a: "يقدمه مدققونا ومهندسو مراقبة الجودة في الموقع أو عبر الإنترنت، بلغة العمل في المصنع كلما أمكن.",
      },
      {
        q: "هل يشمل التدريب تدقيقاً؟",
        a: "تبدأ كل خطة بتدقيق فجوة بحيث يستهدف التدريب نقاط الضعف الفعلية في المصنع، لا شرائح عامة.",
      },
      {
        q: "هل يمكن تخصيص التدريب حسب قطاعي؟",
        a: "نعم. نضبط الوحدات (الجودة، مراقبة الجودة، عملية الإنتاج، الامتثال) وفق منتجك وسوقك المستهدف.",
      },
    ],
  },
};

const LANGS = ["en", "zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];
let total = 0;

for (const lang of LANGS) {
  const file = path.join(D, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const tp = dict.trainingPlans;
  const added = [];

  if (!tp.priceNote) {
    tp.priceNote = CONTENT[lang].priceNote;
    added.push("priceNote");
  }
  if (!tp.plans) {
    tp.plans = CONTENT[lang].plans;
    added.push("plans");
  }
  if (!tp.faq) {
    tp.faq = CONTENT[lang].faq;
    added.push("faq");
  }

  console.log(`[${lang}] ${added.length ? `新增 ${added.join(", ")}` : "已就绪，跳过"}`);
  if (!DRY && added.length) fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  total += added.length;
}

console.log(`\n${DRY ? "DRY RUN" : "完成"}：共写入 ${total} 个新键（9 语言）`);
