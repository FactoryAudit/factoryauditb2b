// P1-12：Field Reports 页所需的字典块。
// en / zh 手写，其余英文回退（与 monitoring / case studies 同策略）。
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const LOCALES = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

const en = {
  metaTitle: "Field Reports — On-Site Notes from Inspection, Audit and Verification",
  h1: "Field Reports",
  badge: "Field notes",
  lead: "Short notes from inspection, audit and verification work: what was checked on site, what was found, and how the finding was recorded.",
  updatedLabel: "Updated",
  readMore: "Read the field note",
  serviceLabels: {
    inspection: "Inspection",
    audit: "Factory audit",
    verification: "Supplier verification",
  },
  ctaTitle: "Want this level of detail on your own order?",
  ctaLead:
    "Tell us the product, the market and what worries you. We will scope the inspection, audit or verification.",
  ctaPrimary: "Post an RFQ",
  ctaSecondary: "Custom services",
};

const zh = {
  metaTitle: "现场记录 —— 来自验货、验厂与核验现场的笔记",
  h1: "现场记录",
  badge: "现场笔记",
  lead: "来自验货、验厂与核验现场的短篇记录：现场查了什么、发现了什么、发现项如何记录。",
  updatedLabel: "更新于",
  readMore: "阅读现场记录",
  serviceLabels: {
    inspection: "验货",
    audit: "验厂",
    verification: "供应商核验",
  },
  ctaTitle: "想让自己的订单也有这种颗粒度？",
  ctaLead: "告诉我们产品、市场和你担心的地方。我们来界定验货、验厂或核验的范围。",
  ctaPrimary: "发布 RFQ",
  ctaSecondary: "定制服务",
};

const VALUES = { en, zh, es: en, de: en, fr: en, pt: en, ja: en, "zh-TW": en, ar: en };

// 资源中心需要一张 Case Studies 卡与 Field Reports 配对。此前案例页的文案全在 TS
// 常量里，页级标题也顺手补进字典，避免在 /resources 页面里硬编码英文。
const CASE_STUDIES_BLOCK = {
  en: {
    h1: "Case Studies",
    lead: "Method walk-throughs for supplier verification, factory audit, inspection and sourcing.",
  },
  zh: {
    h1: "案例研究",
    lead: "供应商核验、验厂、验货与寻源的方法演示。",
  },
};

// 页脚入口文案
const FOOTER_LABEL = { en: "Field Reports", zh: "现场记录" };

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  dict.fieldReports = JSON.parse(JSON.stringify(VALUES[locale]));

  const cs = CASE_STUDIES_BLOCK[locale] ?? CASE_STUDIES_BLOCK.en;
  dict.caseStudies = { h1: cs.h1, lead: cs.lead };

  if (!dict.footer) throw new Error(`${locale}.json 缺少 footer 块`);
  dict.footer.fieldReports = FOOTER_LABEL[locale] ?? FOOTER_LABEL.en;

  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`  updated ${locale}.json`);
}
console.log("\nP1-12 dict applied");
