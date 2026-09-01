// P1-14：Supplier Monitoring 页所需的字典块。
// 9 语言策略沿用项目惯例：en / zh 手写，其余英文回退。
// 只补缺块，已有则整体覆盖（本页为新增页，字典块此前不存在）。
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const LOCALES = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

const en = {
  metaTitle: "Supplier Monitoring — Scheduled Re-Checks and Risk Change Alerts",
  metaDesc:
    "Keep verified supplier facts current. Scheduled re-checks of registration, site, certificates and public records, with an alert when something changes. Subscription, quoted per supplier per year.",
  badge: "Service",
  h1: "Supplier Monitoring",
  lead: "A verification is a snapshot. Monitoring re-runs the checks on a schedule and tells you when a fact you relied on has changed.",

  quickAnswerTitle: "What it is, in one paragraph",
  quickAnswer:
    "We re-check the facts we verified for you, on a cadence you choose, against public registers, scheme databases and the documents on file. When a fact changes or a certificate expires, you get an alert stating what changed, which source confirmed it, and what it means for your order. The evidence policy is the same as a one-off verification: we state what we could confirm and flag what we could not.",
  honestNote:
    "Monitoring lowers the chance of being surprised by a change that public records already show. It does not predict how a supplier will perform, and it cannot see a change that has not been recorded anywhere.",

  recheckTitle: "What we re-check",
  recheckLead:
    "Only items that leave a public or documentary trace. We do not re-check anything we cannot source.",
  recheckItems: [
    "Business registration status: active, revoked, relocated or renamed",
    "Legal entity name and registered address",
    "Certificate and audit report validity against the issuing scheme's database",
    "Expiry dates on the documents we hold",
    "Public records and adverse reports we can source and cite",
    "The supplier's own declarations, compared against what we hold",
  ],

  cadenceTitle: "How often",
  cadenceLead:
    "You set the cadence when we scope the engagement. Three common starting points:",
  cadenceItems: [
    {
      name: "Quarterly",
      when: "Four re-checks a year.",
      note: "For suppliers carrying your largest volume or your tightest compliance requirement.",
    },
    {
      name: "Twice a year",
      when: "Two re-checks a year.",
      note: "The usual starting point for an active supplier.",
    },
    {
      name: "Once a year",
      when: "One re-check a year.",
      note: "For suppliers you buy from occasionally, or to keep a dormant record current.",
    },
  ],

  alertTitle: "What triggers an alert",
  alertLead:
    "An alert goes out when a re-check returns something different from what we hold:",
  alertItems: [
    "Registration status changes",
    "Legal name or registered address changes",
    "A certificate or audit report on file expires or is withdrawn",
    "A new public record or adverse report we can cite",
    "A scheduled re-check finds no change, and you still get a dated confirmation",
  ],

  deliverTitle: "What you receive",
  deliverLead:
    "Every re-check produces a dated record, whether or not anything changed.",
  deliverItems: [
    "A dated re-check record for each supplier",
    "An alert naming the fact that changed and the source that confirmed it",
    "An updated report reflecting the current state of the record",
    "The same evidence labels as a one-off check: reviewed, provided, restricted",
  ],

  notCoveredTitle: "What monitoring does not cover",
  notCoveredLead:
    "Monitoring inherits the limits of a verification. It does not extend them.",

  pricingTitle: "Pricing",
  pricingLead:
    "Priced as a subscription, quoted per supplier per year, based on cadence and how many suppliers you want covered.",
  pricingNote:
    "No online checkout. Tell us the suppliers and the cadence, and we will quote.",
  pricingCta: "Ask for a quote",

  faqTitle: "Questions buyers ask",
  faq: [
    {
      q: "Is monitoring the same as a factory audit?",
      a: "No. An audit is an on-site assessment against a standard. Monitoring re-checks facts that leave a documentary or public trace. They answer different questions, and most buyers want both at different points.",
    },
    {
      q: "What if a supplier changes something between re-checks?",
      a: "Then the next re-check catches it, and the alert is dated to the day we confirmed it. A scheduled check cannot be continuous, and we do not claim it is.",
    },
    {
      q: "Can I add suppliers later?",
      a: "Yes. The subscription is quoted per supplier, so adding one means adjusting the quote rather than starting over.",
    },
    {
      q: "Do you visit the factory as part of monitoring?",
      a: "Not by default. Standard monitoring is a desk re-check of registers and documents. An on-site visit can be added at the cadence you choose and is quoted separately.",
    },
    {
      q: "Can a supplier pay to be monitored?",
      a: "No. Monitoring is bought by the buyer. A supplier cannot pay to change what a re-check reports.",
    },
  ],

  ctaTitle: "Set up monitoring",
  ctaLead:
    "Tell us which suppliers you want covered and how often. We will confirm what can be re-checked and quote.",
  ctaPrimary: "Request monitoring",
  ctaSecondary: "See pricing",
};

const zh = {
  metaTitle: "供应商监控 — 定期复核与风险变更提醒",
  metaDesc:
    "让已核验的供应商信息保持最新。按设定周期复核工商登记、工厂地址、证书与公开记录，发生变化时发出提醒。按年订阅，按供应商家数报价。",
  badge: "服务",
  h1: "供应商监控",
  lead: "一次核验只是一张快照。监控按周期重跑核查项，当你依赖的某个事实发生变化时通知你。",

  quickAnswerTitle: "一段话说明它是什么",
  quickAnswer:
    "我们按你设定的周期，对已核验的事实重新核查，比对公开登记、认证机构数据库和存档文件。当某项事实发生变化或证书到期，你会收到提醒，写明变了什么、依据哪个来源确认、对你的订单意味着什么。证据口径与单次核验一致：能确认的写确认，确认不了的明确标注。",
  honestNote:
    "监控能降低「公开记录里已经变了、但你不知道」的概率。它不预测供应商的履约表现，也看不到尚未被任何渠道记录的变化。",

  recheckTitle: "复核哪些项",
  recheckLead: "只复核留有公开或文件痕迹的条目。无法取证的条目不做复核。",
  recheckItems: [
    "工商登记状态：存续、吊销、迁址或更名",
    "法人主体名称与注册地址",
    "证书与审核报告在发证机构数据库中的有效性",
    "存档文件的到期日",
    "可溯源、可引用的公开记录与负面信息",
    "供应商自述内容与我们存档版本的比对",
  ],

  cadenceTitle: "多久一次",
  cadenceLead: "周期在我们确认服务范围时由你决定。三个常见起点：",
  cadenceItems: [
    { name: "每季度", when: "每年四次复核。", note: "适用于订单量最大或合规要求最严的供应商。" },
    { name: "每半年", when: "每年两次复核。", note: "活跃供应商的常规起点。" },
    { name: "每年", when: "每年一次复核。", note: "偶尔采购的供应商，或仅为保持档案不过期。" },
  ],

  alertTitle: "什么情况会触发提醒",
  alertLead: "当复核结果与我们存档的内容不一致时发出提醒：",
  alertItems: [
    "登记状态发生变化",
    "法人名称或注册地址发生变化",
    "存档的证书或审核报告到期、被撤销",
    "出现可引用的新公开记录或负面信息",
    "按时复核未发现变化，你仍会收到带日期的确认记录",
  ],

  deliverTitle: "你会收到什么",
  deliverLead: "无论是否有变化，每次复核都会生成带日期的记录。",
  deliverItems: [
    "每家供应商的带日期复核记录",
    "变更提醒，写明变化的事实与确认来源",
    "反映当前状态的更新版报告",
    "与单次核验相同的证据标注：已审阅 / 供应商提供 / 受限",
  ],

  notCoveredTitle: "监控不覆盖什么",
  notCoveredLead: "监控继承核验本身的边界，不会扩大它。",

  pricingTitle: "价格",
  pricingLead: "按年订阅，按供应商家数报价，取决于复核周期与覆盖家数。",
  pricingNote: "无线上支付。告诉我们供应商清单与周期，我们报价。",
  pricingCta: "获取报价",

  faqTitle: "买家常问的问题",
  faq: [
    {
      q: "监控等同于验厂吗？",
      a: "不是。验厂是到现场按标准做评估；监控是对留有文件或公开痕迹的事实做复核。两者回答的问题不同，多数买家在不同阶段都需要。",
    },
    {
      q: "如果供应商在两次复核之间变了呢？",
      a: "那就在下一次复核时发现，提醒日期以我们确认当天为准。定期核查不可能是连续的，我们也不会这样宣称。",
    },
    {
      q: "后面能增加供应商吗？",
      a: "可以。订阅按供应商家数报价，增加一家是调整报价，不需要重新开始。",
    },
    {
      q: "监控包含到工厂现场吗？",
      a: "默认不包含。标准监控是对登记与文件的桌面复核。可以按你选择的周期加现场走访，单独报价。",
    },
    {
      q: "供应商可以付费做监控吗？",
      a: "不可以。监控由买方采购，供应商无法付费改变复核结果。",
    },
  ],

  ctaTitle: "开通监控",
  ctaLead: "告诉我们要覆盖哪些供应商、多久复核一次。我们会确认可复核项并报价。",
  ctaPrimary: "申请监控",
  ctaSecondary: "查看定价",
};

const VALUES = { en, zh, es: en, de: en, fr: en, pt: en, ja: en, "zh-TW": en, ar: en };

// 页脚入口文案（与 monitoring 页配套）
const FOOTER_LABEL = { en: "Supplier Monitoring", zh: "供应商监控" };

// 导航 / 服务索引页入口文案（与 monitoring 页配套）
const NAV_LABEL = {
  en: {
    monitoring: "Supplier Monitoring",
    monitoringDesc: "Scheduled re-checks and change alerts",
    indexTitle: "Supplier Monitoring",
    indexDesc:
      "Keep verified supplier facts current. Scheduled re-checks of registration, address, certificates and public records, with an alert when something changes.",
  },
  zh: {
    monitoring: "供应商监控",
    monitoringDesc: "定期复核与变更提醒",
    indexTitle: "供应商监控",
    indexDesc:
      "让已核验的信息保持最新。按周期复核工商登记、地址、证书与公开记录，发生变化时发出提醒。",
  },
};

// 定价页 Monitoring 卡改指 /monitoring，与监控页互链。
// 用数组下标定位第 4 张卡，不比对套餐名（9 语言套餐名不同）。
const MONITORING_PLAN_INDEX = 3;

let changed = 0;
for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  dict.monitoring = JSON.parse(JSON.stringify(VALUES[locale]));

  if (!dict.footer) throw new Error(`${locale}.json 缺少 footer 块`);
  dict.footer.monitoring = FOOTER_LABEL[locale] ?? FOOTER_LABEL.en;

  const nav = NAV_LABEL[locale] ?? NAV_LABEL.en;
  if (!dict.nav?.menu) throw new Error(`${locale}.json 缺少 nav.menu 块`);
  dict.nav.menu.monitoring = nav.monitoring;
  dict.nav.menu.monitoringDesc = nav.monitoringDesc;

  if (!dict.servicesIndex?.items) throw new Error(`${locale}.json 缺少 servicesIndex.items`);
  dict.servicesIndex.items.monitoring = { title: nav.indexTitle, desc: nav.indexDesc };

  if (!dict.pricing?.plans?.[MONITORING_PLAN_INDEX]) {
    throw new Error(`${locale}.json pricing.plans[${MONITORING_PLAN_INDEX}] 不存在`);
  }
  dict.pricing.plans[MONITORING_PLAN_INDEX].href = "/monitoring";

  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  changed += 1;
  console.log(`  updated ${locale}.json`);
}
console.log(`\nP1-14 dict applied: ${changed} file(s)`);
