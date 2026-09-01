#!/usr/bin/env node
/**
 * V1.1 P0-6/7/8 一次性字典更新（2026-09-01）
 * 1) pricing：plans/reports/faq 改为 V1.1 定价（Free $0 / Verification $99-129 / Audit $399+ / Inspection $99+ / Monitoring 订阅）
 * 2) reportPreview：options 价格对齐 V1.1
 * 3) trust：新增 Human+AI 分工 + 6 条验证原则
 * 4) methodology：新增 How We Verify 六步
 * 5) footer：新增 sampleReport 链接文案
 * 6) 新增 sampleReport 字典块
 * 策略：en/zh/zh-TW 手写；es/de/fr/pt/ja/ar 复制英文（英文回退，符合项目惯例）。
 * 运行：node scripts/apply-v11-dict.cjs
 */
const fs = require("fs");
const path = require("path");

const D = path.join(process.cwd(), "i18n", "dictionaries");
const LOCALES = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];
const copyEn = ["es", "de", "fr", "pt", "ja", "ar"];

function load(l) {
  return JSON.parse(fs.readFileSync(path.join(D, `${l}.json`), "utf8"));
}
function save(l, d) {
  fs.writeFileSync(path.join(D, `${l}.json`), JSON.stringify(d, null, 2) + "\n", "utf8");
}

/* ============ 1. pricing 改动（9 语言强制覆盖，价格数字通用） ============ */
const pricingChanges = {
  plans: [
    null, // plans[0] Free Tools 不变
    {
      name: "Supplier Verification",
      price: "$99 – $129",
      note: "Per supplier, quoted per project",
      available: true,
      features: [
        "Business registration and legal entity check",
        "Factory address and site evidence",
        "Manufacturer or trading company determination",
        "Quality and compliance document review",
        "Written report with a risk summary",
      ],
      cta: "Request verification",
      href: "/services/supplier-verification",
    },
    {
      name: "Factory Audit",
      price: "From $399",
      note: "Per man-day plus travel",
      available: true,
      features: [
        "On-site assessment against your required standard",
        "Quality, compliance and labour record review",
        "Findings graded by severity with photographs",
        "Corrective action plan with owners and dates",
        "Optional re-audit after the corrective period",
      ],
      cta: "Request an audit",
      href: "/factory-audit/request",
    },
    {
      name: "Supplier Monitoring",
      price: "Subscription",
      note: "Quoted per supplier per year",
      available: true,
      features: [
        "Scheduled re-checks of verified facts",
        "Risk change alerts on your suppliers",
        "Updated report when facts change",
        "Same evidence policy as one-off checks",
      ],
      cta: "Ask for a quote",
      href: "/custom-services",
    },
  ],
  comingSoonNote:
    "Supplier Monitoring is a subscription and is quoted per supplier per year. Everything else on this page is pay-per-project: no subscription, nothing renews automatically.",
  reports: [
    {
      name: "Supplier due diligence report",
      range: "USD 99 – 129",
      note: "Documentary review and written report. No site visit.",
    },
    {
      name: "Product inspection",
      range: "USD 99+",
      note: "Quoted per man-day plus travel, based on country and scope.",
    },
    {
      name: "On-site factory audit",
      range: "USD 399+",
      note: "Quoted per man-day plus travel, based on country, site size and standard.",
    },
  ],
  faq: [
    null, // q1 不变
    null, // q2 不变
    null, // q3 不变
    {
      q: "How does supplier monitoring work?",
      a: "Monitoring is a subscription, quoted per supplier per year. We re-check the verified facts on a schedule you choose and send you a short update when something changes. You can start with a one-off verification and add monitoring later.",
    },
  ],
};

/* ============ 2. reportPreview 价格对齐 ============ */
const reportPreviewChanges = {
  options: {
    basic: { price: "$99" },
    professional: { price: "$129" },
    independent: { price: "Custom quote" },
  },
};

/* ============ 3. trust 新增（en/zh/zh-TW 手写，其余英文回退） ============ */
const trustAdd = {
  en: {
    humanAiTitle: "How humans and AI work together",
    humanAiLead:
      "AI helps us read, organise and draft. A person reviews every output before anything is published or sent to a buyer.",
    humanAiItems: [
      "AI scans public records, extracts dates and numbers, and drafts the first version of a finding.",
      "A human verifies the source, checks the context, and decides what the report says.",
      "AI flags gaps in the evidence. A human decides whether a gap is material.",
      "AI never issues a verification level or a risk grade. Only a reviewer does.",
    ],
    principlesTitle: "Six principles we never break",
    principlesLead:
      "From the first draft to the final report, every verification follows these rules.",
    principles: [
      "Never hide uncertainty. If we could not confirm a fact, the report says so.",
      "No data is not good news. Missing evidence lowers the score; it is never treated as confirmation.",
      "We do not sell certificates. We verify and we train.",
      "Third-party reports are reviewed, never re-issued or forwarded.",
      "Payment does not change the outcome. A paid verification can still come back with problems.",
      "Samples and case studies are always labelled as demonstrations.",
    ],
  },
  zh: {
    humanAiTitle: "人与 AI 如何分工",
    humanAiLead:
      "AI 帮我们阅读、整理和起草。任何内容在发布或发给买家之前，都会经过人工复核。",
    humanAiItems: [
      "AI 扫描公开记录，提取日期和数字，起草第一版结论。",
      "人工核实信息来源、核对上下文，决定报告怎么写。",
      "AI 标出证据缺口，人工判断这个缺口是否影响结论。",
      "AI 不下核验等级、不给风险评级。只有审核员可以。",
    ],
    principlesTitle: "六条绝不打破的原则",
    principlesLead: "从初稿到终稿，每一次核验都遵守这些规则。",
    principles: [
      "绝不隐藏不确定性。无法确认的事实，报告会直接说明。",
      "没有数据不等于好消息。证据缺失会降低分数，绝不当作已确认。",
      "我们不卖证书。我们做核验和培训。",
      "第三方报告只做审阅，不重新出具，也不转发原件。",
      "付费不改变结论。付费核验同样可能发现问题。",
      "样例和案例研究一律标注为演示用途。",
    ],
  },
  "zh-TW": {
    humanAiTitle: "人與 AI 如何分工",
    humanAiLead:
      "AI 幫我們閱讀、整理和起草。任何內容在發布或發給買家之前，都會經過人工複核。",
    humanAiItems: [
      "AI 掃描公開紀錄，提取日期和數字，起草第一版結論。",
      "人工核實資訊來源、核對上下文，決定報告怎麼寫。",
      "AI 標出證據缺口，人工判斷這個缺口是否影響結論。",
      "AI 不下核驗等級、不給風險評級。只有審核員可以。",
    ],
    principlesTitle: "六條絕不打破的原則",
    principlesLead: "從初稿到終稿，每一次核驗都遵守這些規則。",
    principles: [
      "絕不隱藏不確定性。無法確認的事實，報告會直接說明。",
      "沒有資料不等於好消息。證據缺失會降低分數，絕不當作已確認。",
      "我們不賣證書。我們做核驗和培訓。",
      "第三方報告只做審閱，不重新出具，也不轉發原件。",
      "付費不改變結論。付費核驗同樣可能發現問題。",
      "範例和案例研究一律標註為演示用途。",
    ],
  },
};

/* ============ 4. methodology 新增 ============ */
const methodologyAdd = {
  en: {
    howWeVerifyTitle: "How we verify: six steps",
    howWeVerifyLead:
      "A verification is not a screenshot or a summary. It is a documented sequence, and each step has a written output.",
    howWeVerifySteps: [
      { title: "Screen", body: "We check the company against public registries, trade records and the supplied documents." },
      { title: "Request evidence", body: "We list exactly which documents we need, and mark every gap." },
      { title: "Review", body: "Each document is checked for validity, consistency and context by a person." },
      { title: "Score", body: "The rules engine turns the reviewed inputs into the eight-dimension risk score." },
      { title: "Report", body: "Findings, evidence status and recommendation are written with sources and dates." },
      { title: "Re-check", body: "Verified facts carry a checked date and can be re-checked on a schedule you choose." },
    ],
  },
  zh: {
    howWeVerifyTitle: "我们如何核验：六个步骤",
    howWeVerifyLead: "核验不是截图或摘要，而是一套有记录的流程，每一步都有书面产出。",
    howWeVerifySteps: [
      { title: "筛查", body: "我们把公司信息与公开登记、贸易记录和提交的文件逐一比对。" },
      { title: "索取证据", body: "我们列出需要的每份文件，并标注所有缺口。" },
      { title: "审阅", body: "每份文件由人工检查有效性、一致性和背景。" },
      { title: "评分", body: "规则引擎把已审阅的输入转化为八维风险分数。" },
      { title: "出报告", body: "结论、证据状态和建议都标注来源与日期。" },
      { title: "复核", body: "已核验的事实带有核验日期，可按你选择的周期再次复核。" },
    ],
  },
  "zh-TW": {
    howWeVerifyTitle: "我們如何核驗：六個步驟",
    howWeVerifyLead: "核驗不是截圖或摘要，而是一套有記錄的流程，每一步都有書面產出。",
    howWeVerifySteps: [
      { title: "篩查", body: "我們把公司資訊與公開登記、貿易記錄和提交的文件逐一比對。" },
      { title: "索取證據", body: "我們列出需要的每份文件，並標註所有缺口。" },
      { title: "審閱", body: "每份文件由人工檢查有效性、一致性和背景。" },
      { title: "評分", body: "規則引擎把已審閱的輸入轉化為八維風險分數。" },
      { title: "出報告", body: "結論、證據狀態和建議都標註來源與日期。" },
      { title: "複核", body: "已核驗的事實帶有核驗日期，可按你選擇的週期再次複核。" },
    ],
  },
};

/* ============ 5. footer 新增 ============ */
const footerAdd = {
  en: { sampleReport: "Sample report" },
  zh: { sampleReport: "样例报告" },
  "zh-TW": { sampleReport: "範例報告" },
};

/* ============ 6. sampleReport 新块 ============ */
const sampleReportBlock = {
  en: {
    metaTitle: "Sample Supplier Due Diligence Report — See What You Get",
    metaDesc:
      "A fully worked example of our Supplier Due Diligence Report. Fictional supplier, real structure: risk score, dimension breakdown, findings, evidence status and recommendation.",
    badge: "Sample report",
    h1: "Supplier Due Diligence Report",
    lead:
      "This page is a demonstration. The company below is fictional and the report is a sample. It shows the structure and the level of detail you receive when you order a verification.",
    sampleBanner:
      "SAMPLE / DEMONSTRATION — Fictional data. This is not a real supplier and not a real verification.",
    reportTitle: "Supplier Due Diligence Report",
    reportRef: "Report reference: SDD-2026-0001 (sample)",
    reportDate: "Report date: 12 August 2026",
    preparedFor: "Prepared for: Sample Buyer Ltd. (illustrative)",
    companySection: "1. Company snapshot",
    companyNameLabel: "Company name",
    companyName: "Shenzhen Northstar Electronics Co., Ltd.",
    countryLabel: "Country",
    companyCountry: "China",
    registeredLabel: "Registered",
    companyRegistered: "Yes — registration verified against public registry",
    yearLabel: "Year established",
    companyYear: "2015",
    employeeLabel: "Employees",
    companyEmployees: "180 (self-reported)",
    productsLabel: "Main products",
    companyProducts: "Consumer electronics accessories, USB-C cables",
    scoreSection: "2. Risk score",
    scoreLabel: "Overall score",
    scoreValue: "76 / 100",
    scoreLevel: "Low risk",
    scoreNote:
      "Higher score means lower risk. 76 puts this supplier in the low-risk band, with the caveats listed below.",
    dimensionSection: "3. Dimension breakdown",
    dimensionNote:
      "Each dimension is scored from the evidence on record. Missing evidence lowers the score; it is never treated as confirmation.",
    findingsSection: "4. Key findings",
    findings: [
      "Business registration matches the name on the purchase order and the factory signboard.",
      "ISO 9001:2015 certificate is valid until May 2028, issued by a recognised body.",
      "Social compliance audit (BSCI) is current, with 4 minor findings closed out.",
      "Export licence and VAT registration confirmed against public records.",
      "Digital footprint: active website since 2018, two Alibaba storefronts; no adverse news found in this review window.",
    ],
    evidenceSection: "5. Evidence status",
    evidenceIntro:
      "Evidence status reflects what our team actually reviewed. A document is marked as reviewed only when a copy was seen and checked.",
    evidenceItems: [
      "Business licence — Evidence Reviewed",
      "ISO 9001:2015 certificate — Evidence Reviewed",
      "BSCI audit report — Document Provided (not re-audited by us)",
      "Factory photos — Document Provided",
      "Export records — Restricted (third-party documents not forwarded)",
    ],
    recommendSection: "6. Recommendation",
    recommendBody:
      "Score 76/100, low risk. We recommend a document verification before the first order, and an on-site audit before a repeat order above USD 50,000.",
    ctaTitle: "Order a real verification",
    ctaLead:
      "Get this level of detail for your actual supplier. Verification starts at $99 per supplier, quoted per project.",
    ctaPrimary: "Request verification",
    ctaSecondary: "Back to pricing",
    disclaimer:
      "This sample uses fictional data and is for demonstration only. It is not a verification of any real company. Original third-party documents are never forwarded to buyers.",
  },
  zh: {
    metaTitle: "供应商尽调报告样例 — 先看交付物",
    metaDesc:
      "我们《供应商尽调报告》的完整示例。供应商为虚构，结构真实：风险分数、八维明细、关键发现、证据状态与建议。",
    badge: "样例报告",
    h1: "供应商尽调报告",
    lead:
      "本页是演示内容。下方的公司是虚构的，报告是样例。它展示了你订购核验后收到的报告结构和详细程度。",
    sampleBanner: "样例 / 演示 — 虚构数据。这不是真实的供应商，也不是真实的核验。",
    reportTitle: "供应商尽调报告",
    reportRef: "报告编号：SDD-2026-0001（样例）",
    reportDate: "报告日期：2026 年 8 月 12 日",
    preparedFor: "出具给：Sample Buyer Ltd.（示意）",
    companySection: "1. 公司概览",
    companyNameLabel: "公司名称",
    companyName: "深圳市北极星电子有限公司",
    countryLabel: "国家",
    companyCountry: "中国",
    registeredLabel: "注册状态",
    companyRegistered: "已注册 — 已与公开登记信息核对",
    yearLabel: "成立年份",
    companyYear: "2015",
    employeeLabel: "员工人数",
    companyEmployees: "180（企业自报）",
    productsLabel: "主营产品",
    companyProducts: "消费电子配件、USB-C 数据线",
    scoreSection: "2. 风险分数",
    scoreLabel: "综合得分",
    scoreValue: "76 / 100",
    scoreLevel: "低风险",
    scoreNote: "分数越高代表风险越低。76 分属于低风险区间，但存在下列需注意的事项。",
    dimensionSection: "3. 八维明细",
    dimensionNote: "每个维度按已记录的证据评分。证据缺失会降低分数，绝不视为已确认。",
    findingsSection: "4. 关键发现",
    findings: [
      "营业执照信息与采购订单及工厂招牌上的名称一致。",
      "ISO 9001:2015 证书有效期至 2028 年 5 月，由认可机构签发。",
      "社会责任审核（BSCI）在有效期内，4 项轻微发现已关闭。",
      "出口许可证和增值税登记已与公开记录核对确认。",
      "数字足迹：官网自 2018 年持续运营，两个阿里巴巴店铺；本次核查窗口期未发现负面信息。",
    ],
    evidenceSection: "5. 证据状态",
    evidenceIntro: "证据状态反映团队实际审阅过什么。只有实际看到并检查过副本的文件才会标注为已审阅。",
    evidenceItems: [
      "营业执照 — Evidence Reviewed",
      "ISO 9001:2015 证书 — Evidence Reviewed",
      "BSCI 审核报告 — Document Provided（我们未重新审核）",
      "工厂照片 — Document Provided",
      "出口记录 — Restricted（第三方文件不转发）",
    ],
    recommendSection: "6. 建议",
    recommendBody:
      "综合得分 76/100，低风险。建议首单前做一次文件核验，复购金额超过 5 万美元前安排一次现场验厂。",
    ctaTitle: "订购真实核验",
    ctaLead: "为你的真实供应商获取同等详细程度的报告。核验按供应商计价，起价 99 美元，按项目报价。",
    ctaPrimary: "申请核验",
    ctaSecondary: "返回定价页",
    disclaimer:
      "本样例使用虚构数据，仅供演示。它不是对任何真实公司的核验。第三方原始文件绝不转发给买家。",
  },
  "zh-TW": {
    metaTitle: "供應商盡調報告範例 — 先看交付物",
    metaDesc:
      "我們《供應商盡調報告》的完整範例。供應商為虛構，結構真實：風險分數、八維明細、關鍵發現、證據狀態與建議。",
    badge: "範例報告",
    h1: "供應商盡調報告",
    lead:
      "本頁是演示內容。下方的公司是虛構的，報告是範例。它展示了你訂購核驗後收到的報告結構和詳細程度。",
    sampleBanner: "範例 / 演示 — 虛構資料。這不是真實的供應商，也不是真實的核驗。",
    reportTitle: "供應商盡調報告",
    reportRef: "報告編號：SDD-2026-0001（範例）",
    reportDate: "報告日期：2026 年 8 月 12 日",
    preparedFor: "出具給：Sample Buyer Ltd.（示意）",
    companySection: "1. 公司概覽",
    companyNameLabel: "公司名稱",
    companyName: "深圳市北極星電子有限公司",
    countryLabel: "國家",
    companyCountry: "中國",
    registeredLabel: "註冊狀態",
    companyRegistered: "已註冊 — 已與公開登記資訊核對",
    yearLabel: "成立年份",
    companyYear: "2015",
    employeeLabel: "員工人數",
    companyEmployees: "180（企業自報）",
    productsLabel: "主營產品",
    companyProducts: "消費電子配件、USB-C 數據線",
    scoreSection: "2. 風險分數",
    scoreLabel: "綜合得分",
    scoreValue: "76 / 100",
    scoreLevel: "低風險",
    scoreNote: "分數越高代表風險越低。76 分屬於低風險區間，但存在下列需注意的事項。",
    dimensionSection: "3. 八維明細",
    dimensionNote: "每個維度按已記錄的證據評分。證據缺失會降低分數，絕不視為已確認。",
    findingsSection: "4. 關鍵發現",
    findings: [
      "營業執照資訊與採購訂單及工廠招牌上的名稱一致。",
      "ISO 9001:2015 證書有效期至 2028 年 5 月，由認可機構簽發。",
      "社會責任審核（BSCI）在有效期內，4 項輕微發現已關閉。",
      "出口許可證和增值稅登記已與公開紀錄核對確認。",
      "數位足跡：官網自 2018 年持續營運，兩個阿里巴巴店鋪；本次核查窗口期未發現負面資訊。",
    ],
    evidenceSection: "5. 證據狀態",
    evidenceIntro: "證據狀態反映團隊實際審閱過什麼。只有實際看到並檢查過副本的文件才會標註為已審閱。",
    evidenceItems: [
      "營業執照 — Evidence Reviewed",
      "ISO 9001:2015 證書 — Evidence Reviewed",
      "BSCI 審核報告 — Document Provided（我們未重新審核）",
      "工廠照片 — Document Provided",
      "出口紀錄 — Restricted（第三方文件不轉發）",
    ],
    recommendSection: "6. 建議",
    recommendBody:
      "綜合得分 76/100，低風險。建議首單前做一次文件核驗，複購金額超過 5 萬美元前安排一次現場驗廠。",
    ctaTitle: "訂購真實核驗",
    ctaLead: "為你的真實供應商獲取同等詳細程度的報告。核驗按供應商計價，起價 99 美元，按專案報價。",
    ctaPrimary: "申請核驗",
    ctaSecondary: "返回定價頁",
    disclaimer:
      "本範例使用虛構資料，僅供演示。它不是對任何真實公司的核驗。第三方原始文件絕不轉發給買家。",
  },
};

/* ============ 执行 ============ */
for (const l of LOCALES) {
  const d = load(l);
  const src = copyEn.includes(l) ? "en" : l;

  // 1. pricing 强制覆盖
  const pc = pricingChanges;
  if (pc.plans[1]) d.pricing.plans[1] = pc.plans[1];
  if (pc.plans[2]) d.pricing.plans[2] = pc.plans[2];
  if (pc.plans[3]) d.pricing.plans[3] = pc.plans[3];
  d.pricing.comingSoonNote = pc.comingSoonNote;
  d.pricing.reports = pc.reports;
  if (pc.faq[3]) d.pricing.faq[3] = pc.faq[3];

  // 2. reportPreview 价格
  d.reportPreview.options.basic.price = "$99";
  d.reportPreview.options.professional.price = "$129";
  d.reportPreview.options.independent.price = "Custom quote";

  // 3. trust 新增
  const ta = trustAdd[src] ?? trustAdd.en;
  d.trust.humanAiTitle = ta.humanAiTitle;
  d.trust.humanAiLead = ta.humanAiLead;
  d.trust.humanAiItems = ta.humanAiItems;
  d.trust.principlesTitle = ta.principlesTitle;
  d.trust.principlesLead = ta.principlesLead;
  d.trust.principles = ta.principles;

  // 4. methodology 新增
  const ma = methodologyAdd[src] ?? methodologyAdd.en;
  d.methodology.howWeVerifyTitle = ma.howWeVerifyTitle;
  d.methodology.howWeVerifyLead = ma.howWeVerifyLead;
  d.methodology.howWeVerifySteps = ma.howWeVerifySteps;

  // 5. footer 新增
  const fa = footerAdd[src] ?? footerAdd.en;
  d.footer.sampleReport = fa.sampleReport;

  // 6. sampleReport 新块
  const sb = sampleReportBlock[src] ?? sampleReportBlock.en;
  d.sampleReport = sb;

  save(l, d);
  console.log(`updated ${l}`);
}
console.log("done. run: node scripts/sync-dict.cjs --dry to check missing keys");
