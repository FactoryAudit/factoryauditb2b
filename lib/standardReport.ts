// lib/standardReport.ts —— 「标准版工厂尽调报告」样张单一事实来源
//
// 用途：管理后台 /admin/report-standard 的**标准样张**，用于定义"最好的报告"长什么样。
// 性质：
//   - **内部样张**（后台 requireAdmin 闸门，工厂不可见）。
//   - 全部为**虚构演示数据**，页面必须显著标注 SAMPLE，禁止当作真实结论传播。
//   - 标签采用**双语（en/zh）内联**：后台是单人内部工具（noindex）。
//     采购商侧的多语言报告（9 语）在 CS-09 正式化，届时标签迁入 i18n 命名空间。
//
// 反伪造铁律：自我申报与已核验必须**分级标注**（self-reported / reviewed / verified），
// 不得把未核验项写成已核验。本文件的数据刻意体现这一点。

export type Lang = "en" | "zh";
export type Bi = { en: string; zh: string };

/** 双语标签简写 */
const L = (en: string, zh: string): Bi => ({ en, zh });

// ---------- 报告头 ----------

export const SPECIMEN_BANNER: Bi = L(
  "STANDARD SPECIMEN — Fictional data for internal template review only. Not a real supplier assessment.",
  "标准样张 — 虚构演示数据，仅供内部模板评审，不构成对任何真实供应商的评估结论。"
);

export const REPORT_HEADER = {
  title: L("Supplier Due Diligence Report", "供应商尽职调查报告"),
  subtitle: L("Standard edition · full dossier", "标准版 · 完整档案"),
  ref: "SDD-2026-STD-0001",
  date: "2026-09-11",
  preparedFor: L("Prepared for: Buyer (on request)", "报告对象：采购商（按需出具）"),
  pageOf: L("Standard template v1.0", "标准模板 v1.0"),
} as const;

/** 采购商可选语言（需求：采购商自行选择语言） */
export const REPORT_LANGUAGES = [
  "en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar",
] as const;

// ---------- 总评分 + 8 维 ----------

export const SCORE = {
  value: 82,
  max: 100,
  band: L("Low risk", "低风险"),
  note: L(
    "Higher score means lower risk. 82 places this supplier in the low-risk band. Scores are built only from evidence on record; missing evidence lowers the score rather than being assumed.",
    "分数越高风险越低。82 分属于低风险区间。评分只基于在案证据构建；证据缺失会降低分数，而不会被默认补全。"
  ),
  dims: [
    { key: "company", score: 88, label: L("Company identity", "主体身份") },
    { key: "quality", score: 84, label: L("Quality management", "质量管理") },
    { key: "compliance", score: 80, label: L("Compliance & labour", "合规与劳工") },
    { key: "production", score: 78, label: L("Production capability", "生产能力") },
    { key: "supplychain", score: 76, label: L("Supply chain", "供应链") },
    { key: "documentation", score: 86, label: L("Documentation", "文件一致性") },
    { key: "certification", score: 85, label: L("Certifications", "认证资质") },
    { key: "digitalFootprint", score: 74, label: L("Digital footprint", "数字足迹") },
  ],
} as const;

// ---------- 报告正文 ----------

export type Field = { label: Bi; value: string; note?: Bi; level?: "verified" | "reported" | "none" };
export type Table = { headers: Bi[]; rows: string[][]; statusCol?: number };
export type Item = { title: Bi; meta?: string; desc?: Bi; level?: "low" | "med" };
export type Section = {
  no: string;
  title: Bi;
  intro?: Bi;
  kind: "fields" | "table" | "timeline" | "list" | "bullets";
  fields?: Field[];
  table?: Table;
  items?: Item[];
  bullets?: Bi[];
};

/** 证据分级标记（贯穿全报告） */
export const EVIDENCE_MARK = {
  verified: L("Verified", "已核验"),
  reported: L("Self-reported", "企业自报"),
  none: L("Not on file", "无记录"),
} as const;

export const SECTIONS: Section[] = [
  {
    no: "01",
    title: L("Executive summary", "执行摘要"),
    kind: "bullets",
    intro: L(
      "The overall 82/100 is the weighted result of the eight dimensions below. Strengths are evidence-backed; concerns are items we could not yet verify.",
      "总分 82/100 由下列八个维度加权得出。优势项均有证据支撑；关注项是目前尚无法核验的事项。"
    ),
    bullets: [
      L("Genuine manufacturer with 11 years of operating history; registration consistent across registry, export records and site evidence.", "真实制造企业，经营 11 年；工商登记、出口记录与现场证据三者一致。"),
      L("Quality system certified (ISO 9001:2015) and social-compliance audited (BSCI), both currently within validity.", "质量体系已认证（ISO 9001:2015），社会责任已审核（BSCI），两者均在有效期内。"),
      L("Clean litigation record: no enforcement actions (被执行人) and no open judgment-debt cases.", "涉诉记录干净：无被执行人记录，无未结执行案件。"),
      L("Concern: production capacity figures are self-reported; no third-party throughput verification on file yet.", "关注项：产能数字为企业自报，尚无第三方产能核验记录。"),
      L("Concern: two certifications have lapsed and are shown as expired, not valid.", "关注项：两项认证已过期，报告中如实标注为「已过期」，而非「有效」。"),
    ],
  },
  {
    no: "02",
    title: L("Company profile", "主体档案"),
    intro: L(
      "Sourced from the National Enterprise Credit Information System (GSXT), cross-checked against export and site evidence.",
      "来源：国家企业信用信息公示系统（GSXT），并与出口记录、现场证据交叉核对。"
    ),
    kind: "fields",
    fields: [
      { label: L("Legal name", "企业名称"), value: "Shenzhen XX Electronics Co., Ltd.", level: "verified" },
      { label: L("Unified Social Credit Code", "统一社会信用代码"), value: "91440300MA5EXXXXXX", level: "verified" },
      { label: L("Legal representative", "法定代表人"), value: "Zhang XX", level: "verified" },
      { label: L("Registered capital", "注册资本"), value: "CNY 8,000,000", level: "verified" },
      { label: L("Year established", "成立年份"), value: "2015", level: "verified" },
      { label: L("Company type", "企业类型"), value: "Limited liability company", level: "verified" },
      { label: L("Registered address", "注册地址"), value: "Building 4, XX Industrial Park, Bao'an District, Shenzhen", level: "verified" },
      { label: L("Business scope", "经营范围"), value: "Production · Manufacturing · Import & Export", level: "verified" },
    ],
  },
  {
    no: "03",
    title: L("Ownership & control", "股权与控制"),
    intro: L(
      "Shareholder ledger from GSXT, cross-referenced with equity-pledge and change records. Stable since 2019.",
      "股东名册来自 GSXT，并与股权出质、变更记录交叉核对。2019 年以来稳定。"
    ),
    kind: "table",
    table: {
      headers: [L("Shareholder", "股东"), L("Type", "类型"), L("Contribution", "认缴出资"), L("Stake", "持股比例"), L("Since", "入股时间")],
      rows: [
        ["Shareholder A", "Individual", "CNY 5,200,000", "65%", "2014"],
        ["Shareholder B", "Individual", "CNY 2,000,000", "25%", "2016"],
        ["Shareholder C", "Corporate (HK)", "CNY 800,000", "10%", "2019"],
      ],
    },
  },
  {
    no: "04",
    title: L("Court & enforcement records", "涉诉与执行记录"),
    intro: L(
      "Pulled from China Judgements Online and the Supreme People's Court enforcement list.",
      "来源：中国裁判文书网 + 全国法院被执行人信息查询。"
    ),
    kind: "fields",
    fields: [
      { label: L("Total cases (2019–2026)", "案件总数（2019–2026）"), value: "4", level: "verified" },
      { label: L("Open cases", "在审案件"), value: "1", level: "verified" },
      { label: L("As defendant", "作为被告"), value: "3", level: "verified" },
      { label: L("Enforcement (被执行人)", "被执行人"), value: "0", note: L("No enforcement record — a positive indicator.", "无被执行记录 —— 正面指标。"), level: "verified" },
    ],
  },
  {
    no: "05",
    title: L("Registration changes", "工商变更"),
    intro: L(
      "Every registration change is public. Late-stage legal-representative changes are treated as a watch item.",
      "工商变更均为公开信息。经营后期更换法定代表人属观察项。"
    ),
    kind: "timeline",
    items: [
      { title: L("Registered capital increased to CNY 8,000,000", "注册资本增至人民币 800 万元"), meta: "2021-03", desc: L("Consistent with stated expansion; no red flag.", "与所述扩产相符，无异常。"), level: "low" },
      { title: L("Business scope extended to include import & export", "经营范围扩展至进出口"), meta: "2022-07", desc: L("Aligns with export records from 2022 onward.", "与 2022 年起的出口记录一致。"), level: "low" },
      { title: L("Legal representative changed", "法定代表人变更"), meta: "2024-09", desc: L("Watch item: verify current signatory authority before wiring payment.", "观察项：付款前请核实当前有权签字人。"), level: "med" },
    ],
  },
  {
    no: "06",
    title: L("Tax & trade compliance", "税务与进出口"),
    intro: L(
      "Tax rating is a strong proxy for how a supplier treats contracts and reporting.",
      "纳税评级是企业对待合同与申报态度的有力参照。"
    ),
    kind: "fields",
    fields: [
      { label: L("Tax credit rating", "纳税信用评级"), value: "B (2025) · B (2024) · B (2023)", level: "verified" },
      { label: L("VAT status", "增值税资格"), value: "General taxpayer", level: "verified" },
      { label: L("Customs registration", "海关注册编码"), value: "4403960XXXX", level: "verified" },
      { label: L("Export value (2025)", "出口额（2025）"), value: "USD 3.1M", level: "reported" },
      { label: L("Main export markets", "主要出口市场"), value: "United States · Germany · Australia", level: "reported" },
    ],
  },
  {
    no: "07",
    title: L("Licenses & qualifications", "经营资质"),
    intro: L(
      "Operating licences and export rights. Each is checked against the issuing authority where possible.",
      "营业执照与出口经营权。尽可能与发证机关核对。"
    ),
    kind: "fields",
    fields: [
      { label: L("Business licence", "营业执照"), value: "In force", level: "verified" },
      { label: L("Import & export rights", "进出口经营权"), value: "Registered", level: "verified" },
      { label: L("Special production permit", "特种生产许可"), value: "Not applicable (consumer electronics)", level: "none" },
    ],
  },
  {
    no: "08",
    title: L("Certifications", "认证与资质"),
    intro: L(
      "Certificate authenticity is checked against issuer registries where available. Expired certificates are shown as expired — never as valid.",
      "证书尽可能在发证机构登记库核验。已过期证书如实标注为「已过期」，绝不标为「有效」。"
    ),
    kind: "table",
    table: {
      statusCol: 4,
      headers: [
        L("Certification", "认证项目"),
        L("Certificate no.", "证书编号"),
        L("Issued", "签发日期"),
        L("Expires", "有效期至"),
        L("Status", "状态"),
        L("Source", "来源"),
      ],
      rows: [
        ["ISO 9001:2015", "CN-XXXX-Q", "2023-09-12", "2026-09-11", "valid", "verified"],
        ["ISO 14001:2015", "CN-XXXX-E", "2024-02-03", "2027-02-02", "valid", "verified"],
        ["BSCI (amfori)", "—", "2025-04-18", "2027-04-17", "valid", "verified"],
        ["CE (product-specific)", "—", "2024-11-20", "2026-08-31", "expired", "reported"],
        ["OHSAS 18001", "—", "2018-05-10", "2021-05-09", "expired", "reported"],
        ["HACCP", "—", "—", "—", "none", "reported"],
      ],
    },
  },
  {
    no: "09",
    title: L("Production capability", "生产能力"),
    intro: L(
      "Capacity figures come from the supplier's own submission unless a third party verified them. The source column makes the difference explicit.",
      "产能数字来自企业自报，除非有第三方核验。来源列会明确区分。"
    ),
    kind: "fields",
    fields: [
      { label: L("Total employees", "员工总数"), value: "180", level: "reported" },
      { label: L("Production-floor workers", "生产一线人数"), value: "~120", level: "reported" },
      { label: L("Factory area", "厂房面积"), value: "6,200 m²", level: "reported" },
      { label: L("Production lines", "生产线数量"), value: "14 injection / assembly lines", level: "reported" },
      { label: L("Monthly output", "月产量"), value: "~450,000 units", level: "reported" },
      { label: L("Annual capacity", "年产能"), value: "~5.4M units", level: "reported" },
      { label: L("Throughput verification", "产能核验"), value: "Not yet verified by third party", level: "none" },
    ],
  },
  {
    no: "10",
    title: L("Factory site verification", "工厂实地核验"),
    intro: L(
      "Satellite and street imagery review, plus an unscripted video walkthrough where provided.",
      "卫星与街景影像复核，并在有条件时观看无脚本的现场视频。"
    ),
    kind: "fields",
    fields: [
      { label: L("Address match", "地址一致性"), value: "Registry address matches site imagery", level: "verified" },
      { label: L("Signage", "厂区标牌"), value: "Chinese & English company signage present", level: "reported" },
      { label: L("Video walkthrough", "现场视频"), value: "22 min, unscripted", level: "reported" },
      { label: L("Machinery observed", "可见设备"), value: "14 injection lines", level: "reported" },
      { label: L("Workers on floor", "现场工人"), value: "~80 at time of filming", level: "reported" },
    ],
  },
  {
    no: "11",
    title: L("Export & markets", "出口与市场"),
    kind: "fields",
    fields: [
      { label: L("Export since", "出口起始年份"), value: "2022", level: "reported" },
      { label: L("Main export markets", "主要出口市场"), value: "United States · Germany · Australia", level: "reported" },
      { label: L("Reference customers", "参考客户"), value: "Not disclosed", level: "none" },
    ],
  },
  {
    no: "12",
    title: L("Contact & authorization", "联系方式与授权"),
    intro: L(
      "Contact visibility and the supplier's authorization status govern what may be shown to buyers.",
      "联系方式的可见范围与企业授权状态，决定可向采购商披露的内容。"
    ),
    kind: "fields",
    fields: [
      { label: L("Contact person", "联系人"), value: "Li XX (Sales Manager)", level: "reported" },
      { label: L("Email", "邮箱"), value: "sales@xx-electronics.example", level: "reported" },
      { label: L("Phone", "电话"), value: "+86 755 XXXX XXXX", level: "reported" },
      { label: L("Contact visibility", "联系方式可见性"), value: "Platform-mediated", level: "reported" },
      { label: L("Profile-display authorization", "资料展示授权"), value: "Authorized", note: L("Supplier consented to profile display; required before any buyer-facing report.", "企业已授权资料展示；这是出具采购商报告的前提。"), level: "verified" },
    ],
  },
  {
    no: "13",
    title: L("Data sources & methodology", "数据来源与方法"),
    kind: "list",
    bullets: [
      L("Registry: National Enterprise Credit Information System (GSXT).", "工商：国家企业信用信息公示系统（GSXT）。"),
      L("Litigation: China Judgements Online + enforcement list.", "涉诉：中国裁判文书网 + 被执行人信息查询。"),
      L("Certifications: issuer registries where available; otherwise supplier-submitted scans.", "认证：优先发证机构登记库；否则采用企业提交的扫描件。"),
      L("Site: satellite/street imagery + unscripted video walkthrough.", "现场：卫星/街景影像 + 无脚本现场视频。"),
      L("Everything not independently verified is marked 'Self-reported'.", "凡未经独立核验者，一律标注「企业自报」。"),
    ],
  },
];

export const RECOMMENDED_ACTIONS: Bi[] = [
  L("Before wiring the balance: confirm the current legal representative's signing authority.", "付款前：确认现任法定代表人的签字权限。"),
  L("Request third-party throughput verification if the order depends on stated capacity.", "若订单依赖所述产能，请要求第三方产能核验。"),
  L("Ask the supplier to renew the expired CE and OHSAS certificates, or provide a renewal plan.", "要求企业续办已过期的 CE 与 OHSAS 认证，或提供续办计划。"),
];

export const DISCLAIMER: Bi = L(
  "This report is an informational due-diligence dossier. It is not a certification, accreditation, or guarantee of supplier performance. Items marked 'Self-reported' have not been independently verified.",
  "本报告为信息性尽职调查档案，不构成认证、认可或对供应商履约能力的保证。标注为「企业自报」的项目未经独立核验。"
);

// ---------- 买家侧（工厂不可见）下载门禁文案 ----------

export const BUYER_DOWNLOAD = {
  title: L("Buyer download (hidden from suppliers)", "采购商下载（工厂不可见）"),
  note: L(
    "This control is rendered only inside the authenticated buyer area. It is never shown on public supplier pages, so the factory never sees that its report is sold.",
    "该功能仅在已登录的采购商区域渲染，绝不出现在公开供应商页面，因此工厂不会看到其报告被出售。"
  ),
  cta: L("Download full report (paid)", "下载完整报告（付费）"),
  langLabel: L("Report language", "报告语言"),
  priceNote: L("Price shown in USD. Payment provider not yet configured — manual unlock for now.", "价格以 USD 标注。支付渠道尚未配置 —— 当前为人工开通。"),
} as const;
