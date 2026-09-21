// lib/guides.ts — 指南内容库（Supplier Intelligence Resources 的第一批英文正文）
//
// 结构按 AI Search 可引用性设计（PRD §26/§27）：
// Quick Answer → Definition → Key Points → Steps → Examples → Checklist → FAQ → Sources
// 页面渲染时再补上 Tool / Service / Methodology / Last Updated / Related。
//
// 与 lib/coverage.ts 同样的原则：事实型编辑内容放数据文件，en / zh 手写，
// 其他国家回退英文。禁止为了凑数生成模板化内容。

export type GuideCategory =
  | "verification"
  | "audit"
  | "risk"
  | "china"
  | "sea"
  | "compliance";

export interface GuideContent {
  quickAnswer: string;
  definition: string;
  keyPoints: string[];
  steps: { title: string; body: string }[];
  examples: { title: string; body: string }[];
  checklist: string[];
  faq: { q: string; a: string }[];
  sources: { name: string; note: string }[];
  /**
   * 可选的对比 / 清单 / 时间线 / 风险矩阵表格。
   * 服务端直出真实 <table>：AI Search 与精选摘要优先抽取结构化表格，
   * 且指令禁止把核心信息做成图片或隐藏在 JS tab 后。
   * 标题随数据携带，不占字典 key（避免触碰 en 叶子数冻结常量）。
   */
  tables?: { title: string; headers: string[]; rows: string[][] }[];
}

export interface Guide {
  slug: string;
  category: GuideCategory;
  /** 标题即 H1，也是搜索意图的主关键词 */
  titleEn: string;
  titleZh: string;
  metaDescEn: string;
  metaDescZh: string;
  /** 最后更新日期（ISO），AI Search 与读者都看这个 */
  updated: string;
  /** 相关工具（至少 1 个，PRD §46） */
  tools: { href: string }[];
  /** 相关服务（至少 1 个） */
  services: { href: string }[];
  /** 相关指南 slug */
  related: string[];
  /**
   * 编辑性上下文内链（非工具 / 非服务），例如 RFQ、产业带、供应商入驻。
   * 锚文本随数据携带且每篇不同，避免全站重复 anchor text。
   */
  links?: { href: string; labelEn: string; labelZh: string }[];
  en: GuideContent;
  zh: GuideContent;
}

export const GUIDES: Guide[] = [
  {
    slug: "how-to-verify-a-chinese-supplier",
    category: "verification",
    titleEn: "How to Verify a Chinese Supplier",
    titleZh: "如何核验中国供应商",
    metaDescEn:
      "A step-by-step process for verifying a Chinese supplier: match the Chinese registered name, check the Unified Social Credit Code, confirm the production address, review quality and compliance evidence, then decide whether an on-site audit is needed.",
    metaDescZh:
      "核验中国供应商的分步流程：核对中文注册名与统一社会信用代码、确认生产地址、审阅质量与合规证据，再判断是否需要现场验厂。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/services/china-factory-audit" },
    ],
    related: ["factory-audit-checklist", "supplier-risk-assessment-guide"],
    en: {
      quickAnswer:
        "A practical supplier verification process should confirm the company's identity, operating location, manufacturing capability, quality controls, relevant certifications and recent audit evidence before a buyer places a significant order. In China, the first four checks are cheap and fast because company records are public. The last three usually need the supplier's cooperation, and one of them usually needs a site visit.",
      definition:
        "Chinese supplier verification is the process of confirming that a company exists as a registered legal entity, that the site it names is where your product will actually be made, and that the capability, quality and compliance claims it makes are backed by documents you can check. It is not the same as a factory audit. Verification asks \"is this what you say it is?\". An audit asks \"how well does it run?\".",
      keyPoints: [
        "The English name you were given is often not the registered name. Contracts should carry the entity that appears on the business licence.",
        "The registered address on a Chinese business licence is frequently an office, not the production site. The gap is where problems hide.",
        "Trading companies can look like factories online. The business scope on the licence separates the two in one line.",
        "A certificate held by a parent entity does not cover the entity that will sign your contract.",
        "Verification without a site visit cannot confirm that the equipment exists or that the quality system is running.",
      ],
      steps: [
        {
          title: "Match the English name to the Chinese registered name",
          body: "Ask for the Chinese name on the business licence and the 18-digit Unified Social Credit Code, then look the entity up on the National Enterprise Credit Information Publicity System (gsxt.gov.cn). If the supplier will not give you the registered name, treat that as a finding.",
        },
        {
          title: "Confirm the legal entity is the one you will contract with",
          body: "Check business scope, registered capital, establishment date and the legal representative. Manufacturers list production in their business scope. Trading companies list wholesale and retail only. If exports run through a separate trading entity, that entity is the one on your invoice and should be checked too.",
        },
        {
          title: "Separate the registered address from the production address",
          body: "Compare the two. When they differ, ask which site your order will run on, and get that address in writing. This single question resolves more disputes than any other check on the list.",
        },
        {
          title: "Review quality and compliance evidence",
          body: "Ask for ISO 9001 certification, product test reports from an accredited laboratory, and any social compliance audit such as BSCI or SMETA. Check the certificate holder name, the scope, and the expiry date against the entity you are contracting with.",
        },
        {
          title: "Capability and subcontracting",
          body: "Ask what equipment runs in-house, what monthly output it supports, and which processes leave the site. Undisclosed subcontracting is common in peak season and is the usual reason a compliant factory ships non-compliant goods.",
        },
        {
          title: "Decide whether you need a site visit",
          body: "If the order value justifies it, or if any of the checks above came back incomplete, put someone on site. A one-man-day factory audit costs less than most deposits and tells you what documentary checks cannot.",
        },
      ],
      examples: [
        {
          title: "The supplier's name does not match the licence",
          body: "A buyer was quoted by \"Bright Industrial Limited\", a Hong Kong entity. The factory in Dongguan was a separate company with a different name and a different legal representative. The contract eventually named the Dongguan entity, because that is where the production risk sat.",
        },
        {
          title: "Registered address is an office in a different district",
          body: "A Shenzhen electronics supplier listed a registered address in a Futian office tower and produced in a plant in Bao'an. Neither was wrong, but the buyer's insurance and audit scope had named the wrong site until the check surfaced it.",
        },
        {
          title: "The certificate belongs to the group",
          body: "A BSCI report was issued to a parent holding company covering four plants. The plant that would make the order was not among them. The certificate was valid, and it was still the wrong certificate.",
        },
        {
          title: "Peak season subcontracting",
          body: "A garment supplier disclosed embroidery and washing as outsourced processes only after the buyer asked directly. Both subcontractors were added to the audit scope, and one of them had no fire safety clearance.",
        },
      ],
      checklist: [
        "Chinese registered name and Unified Social Credit Code obtained",
        "Entity confirmed on the National Enterprise Credit Information Publicity System",
        "Business scope confirms manufacturing, not trading only",
        "Registered address compared with the production address",
        "Contracting entity identified and named in the contract",
        "ISO 9001 certificate holder, scope and expiry checked",
        "Product test reports from an accredited laboratory reviewed",
        "Social compliance audit history requested (BSCI, SMETA, SA8000 or WRAP)",
        "Equipment list and monthly capacity stated in writing",
        "Outsourced processes and subcontractor names disclosed",
        "Bank account name matches the contracting entity",
        "Site visit or factory audit scheduled where the order justifies it",
      ],
      faq: [
        {
          q: "Can I verify a Chinese supplier without visiting China?",
          a: "Partly. Business registration, legal entity status, export records and adverse records can all be checked remotely from public and third-party sources. What you cannot confirm remotely is that the production equipment exists, that the quality system runs day to day, or that the site you were told about is the site that will produce your order.",
        },
        {
          q: "What is a Unified Social Credit Code?",
          a: "An 18-character code issued to every registered entity in China, printed on the business licence. It replaced the old registration number and is the most reliable identifier for looking a company up on gsxt.gov.cn.",
        },
        {
          q: "How do I tell a factory from a trading company?",
          a: "Check the business scope on the licence. Manufacturers list production or manufacturing. Trading companies list wholesale, retail and import-export. A trading company can still be a good supplier, but you should know which one you are dealing with and price accordingly.",
        },
        {
          q: "How long does verification take?",
          a: "A documentary check is usually finished within two business days once you provide the company name and address. A site visit or factory audit is normally scheduled within a week for a single site in a major manufacturing belt.",
        },
      ],
      sources: [
        {
          name: "National Enterprise Credit Information Publicity System (gsxt.gov.cn)",
          note: "The official public registry for Chinese companies, searchable by name or Unified Social Credit Code.",
        },
        {
          name: "ISO 9001 certification registers",
          note: "Used to confirm that a quality management certificate is current, in scope and issued to the contracting entity.",
        },
        {
          name: "amfori BSCI and Sedex SMETA audit platforms",
          note: "Used to confirm social compliance audit history where the supplier has granted access.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "一套可执行的中国供应商核验流程，应当在下大额订单之前确认：公司身份、实际经营地点、制造能力、质量控制、相关认证，以及近期审核证据。在中国，前四项因为企业登记信息公开而又快又便宜；后三项通常需要供应商配合，其中一项通常需要现场走访。",
      definition:
        "中国供应商核验，是确认三件事的过程：这家公司是不是合法注册的实体；它给的地址是不是你的产品实际生产的地方；它宣称的产能、质量和合规是否有你可以核对的文件支撑。它不等于验厂。核验问的是「你说的和事实一致吗」，验厂问的是「它运行得好不好」。",
      keyPoints: [
        "对方给的英文名通常不是注册名。合同应写营业执照上的法律实体。",
        "中国营业执照上的注册地址经常是办公室而非生产地。差异就是风险藏身之处。",
        "贸易公司在网上可以看起来像工厂。执照上的经营范围一句话就能区分。",
        "挂在母公司名下的证书，不覆盖与你签合同的法律实体。",
        "不做现场走访的核验，无法确认设备是否存在、质量体系是否在运转。",
      ],
      steps: [
        {
          title: "把英文名与中文注册名对上",
          body: "索要营业执照上的中文名称和 18 位统一社会信用代码，然后在国家企业信用信息公示系统（gsxt.gov.cn）查询该主体。如果供应商不肯给注册名，这本身就是一条发现项。",
        },
        {
          title: "确认签约主体",
          body: "核查经营范围、注册资本、成立日期和法定代表人。工厂的经营范围里会写生产制造，贸易公司只有批发零售。如果出口走独立的贸易主体，发票上出现的是那个主体，也要一并核查。",
        },
        {
          title: "把注册地址与生产地址分开看",
          body: "两者对照。不一致时，问清楚订单在哪个厂区生产，并要求书面确认。这一个问题解决的纠纷，比清单上其他任何一项都多。",
        },
        {
          title: "审阅质量与合规证据",
          body: "索要 ISO 9001 证书、具备资质实验室出具的检测报告，以及 BSCI 或 SMETA 等社会责任审核记录。核对证书持证主体、范围和有效期，是否与签约主体一致。",
        },
        {
          title: "产能与外发",
          body: "问清楚哪些设备是自有、月产量能支撑多少、哪些工序会离开厂区。旺季未披露的外发很常见，也是合规工厂生产出不合规货物的常见原因。",
        },
        {
          title: "判断是否需要现场走访",
          body: "如果订单金额值得，或者上面任何一项核查不完整，就派人到现场。一个人天的验厂比多数定金都便宜，而且能告诉你文件核查查不到的东西。",
        },
      ],
      examples: [
        {
          title: "供应商名称与执照对不上",
          body: "买家拿到的是一家香港主体「Bright Industrial Limited」的报价，而东莞的工厂是另一家公司，名称和法定代表人都不同。最后合同签的是东莞主体，因为生产风险在那里。",
        },
        {
          title: "注册地址是另一个区的写字楼",
          body: "一家深圳电子供应商的注册地址在福田的写字楼，实际生产在宝安的厂区。两者都不算错，但买家的保险和审核范围一直指向错误地址，直到这次核查才发现。",
        },
        {
          title: "证书属于集团",
          body: "一份 BSCI 报告是发给覆盖四家工厂的母公司的，而实际要生产该订单的厂区不在其中。证书有效，但它仍然是错的证书。",
        },
        {
          title: "旺季外发",
          body: "一家服装供应商在买家直接追问后才披露绣花和水洗是外发工序。两个外发厂随后被纳入审核范围，其中一个没有消防验收。",
        },
      ],
      checklist: [
        "已获取中文注册名与统一社会信用代码",
        "已在国家企业信用信息公示系统确认主体",
        "经营范围确认是生产制造，而非仅贸易",
        "已对照注册地址与生产地址",
        "已确定签约主体并写入合同",
        "已核对 ISO 9001 证书持证主体、范围与有效期",
        "已审阅具备资质实验室的检测报告",
        "已索取社会责任审核记录（BSCI / SMETA / SA8000 / WRAP）",
        "设备清单与月产能已书面确认",
        "已披露外发工序与外发厂名称",
        "银行账户名称与签约主体一致",
        "订单值得时已安排现场走访或验厂",
      ],
      faq: [
        {
          q: "不去中国能不能核验供应商？",
          a: "部分可以。工商登记、法律实体状态、出口记录和不良记录都可以远程通过官方与第三方数据源核查。远程无法确认的是：生产设备是否真实存在、质量体系是否日常运转、对方告知的地址是否就是实际生产地址。",
        },
        {
          q: "什么是统一社会信用代码？",
          a: "中国发给每一个注册主体的 18 位代码，印在营业执照上。它取代了旧注册号，是在 gsxt.gov.cn 查询企业最可靠的标识。",
        },
        {
          q: "怎么区分工厂和贸易公司？",
          a: "看执照上的经营范围。工厂会写生产或制造，贸易公司写批发、零售和进出口。贸易公司也可以是好供应商，但你应当知道自己面对的是哪一类，并据此定价。",
        },
        {
          q: "核验需要多久？",
          a: "在你提供公司名称和地址之后，文件核查通常在两个工作日内完成。主要制造带内单厂区的现场走访或验厂，一般一周内可以排期。",
        },
      ],
      sources: [
        { name: "国家企业信用信息公示系统（gsxt.gov.cn）", note: "中国企业官方公开登记平台，可按名称或统一社会信用代码查询。" },
        { name: "ISO 9001 认证登记库", note: "用于确认质量管理体系证书有效、在范围内、且发证对象为签约主体。" },
        { name: "amfori BSCI 与 Sedex SMETA 审核平台", note: "在供应商已授权访问的前提下，用于确认社会责任审核历史。" },
      ],
    },
  },
  {
    slug: "factory-audit-checklist",
    category: "audit",
    titleEn: "Factory Audit Checklist: What Auditors Actually Check",
    titleZh: "工厂验厂检查表：审核员实际看什么",
    metaDescEn:
      "A factory audit checklist covering documentation, production control, quality management, social compliance and corrective action, with the records auditors ask for and the findings that come up most often.",
    metaDescZh:
      "覆盖文件、生产控制、质量管理、社会责任合规与整改的验厂检查表，列出审核员会索要的记录和最常见的发现项。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/audit-report-analyzer" },
    ],
    services: [
      { href: "/factory-audit/request" },
      { href: "/services/china-factory-audit" },
      { href: "/services/supplier-improvement" },
    ],
    related: ["how-to-verify-a-chinese-supplier", "supplier-risk-assessment-guide"],
    en: {
      quickAnswer:
        "A factory audit checks four things: whether the company is what it claims to be, whether it can make your product consistently, whether it treats its workers and the environment within the standard you named, and whether its records support its answers. Auditors do this by walking the floor, reading records and interviewing staff, then grading every finding by severity.",
      definition:
        "A factory audit is an on-site assessment of a supplier against a stated standard or checklist. The auditor reviews documents, walks the production floor, interviews employees and management, and issues a written report with findings graded by severity and a corrective action plan. Audits are usually described by their standard: quality (ISO 9001), social compliance (BSCI, SMETA, SA8000, WRAP), or a buyer's own proprietary checklist.",
      keyPoints: [
        "Audit findings are graded, not pass or fail. Your organisation decides what it will accept.",
        "Records matter as much as the floor. An auditor who cannot see a record will write it down as missing.",
        "Employee interviews are the part suppliers prepare least well, and they surface the issues records hide.",
        "The corrective action plan is the deliverable that actually changes anything. The report without one is a photograph.",
        "A re-audit is the only way to know whether corrective actions were completed or just promised.",
      ],
      steps: [
        {
          title: "Open with scope and entity",
          body: "Confirm which legal entity and which building is in scope, who owns the site, and what is made there. Larger groups sometimes show the newest plant and ship from an older one.",
        },
        {
          title: "Review documentation",
          body: "Business licence, factory operating permit, quality manual, calibration records, incoming inspection records, production records, non-conformance logs, training records, and the certificates you were shown during verification.",
        },
        {
          title: "Walk the floor",
          body: "Raw material storage, incoming inspection, production lines, in-process checks, finished goods, packing, warehousing, and the laboratory or testing area. Note housekeeping, equipment condition and whether the process on the wall matches the process on the line.",
        },
        {
          title: "Interview staff",
          body: "Where the standard requires it, interviews happen away from the production floor and away from management. Working hours, wage records, recruitment fees and overtime are the areas where findings concentrate.",
        },
        {
          title: "Grade findings and agree corrective actions",
          body: "Findings are graded by severity, discussed at a closing meeting, and written up with owners and target dates. Critical findings usually require action before the next order ships.",
        },
      ],
      examples: [
        {
          title: "Calibration expired on the torque drivers",
          body: "A minor finding on paper, and a major one in practice: every assembly built with an out-of-calibration tool has an unverified torque value. The corrective action was recalibration plus a 100% recheck of the last production batch.",
        },
        {
          title: "Incoming inspection records exist but are all identical",
          body: "Three weeks of inspection records with the same measurements and the same signature. The auditor recorded the finding as records not maintained in practice, which is a quality system failure rather than a paperwork one.",
        },
        {
          title: "Recruitment fees charged to migrant workers",
          body: "Wage records and contracts were in order, but interviews showed workers had paid a fee to an agent to get the job. This is a critical finding under most social compliance standards and requires repayment.",
        },
        {
          title: "Subcontracted process outside the audit scope",
          body: "The main plant passed cleanly. A walk through the packing area revealed cartons from a second site that had never been disclosed. The audit scope was extended and the second site failed.",
        },
      ],
      checklist: [
        "Business licence and factory operating permit for the audited site",
        "Quality manual and documented procedures",
        "Equipment list with calibration certificates in date",
        "Incoming material inspection records",
        "In-process and final inspection records",
        "Non-conformance logs and corrective action records",
        "Training records for operators and inspectors",
        "Certificates and test reports matching the contracted entity",
        "Working hour and wage records for the audit period",
        "Employment contracts and recruitment fee evidence",
        "Health and safety records, fire equipment inspection and evacuation drills",
        "Environmental permits and waste disposal records where applicable",
      ],
      faq: [
        {
          q: "What is the difference between a factory audit and an inspection?",
          a: "An audit assesses the supplier's system: how it controls quality, how it manages compliance, whether its records are real. An inspection checks a specific shipment: quantity, workmanship, packing and specification against your order. Audits are scheduled before or between orders; inspections happen before shipment.",
        },
        {
          q: "How many man-days does an audit need?",
          a: "A single-site quality audit usually starts at one man-day. A full social compliance audit such as SMETA typically needs two or more, scaled by headcount. Large sites with multiple buildings need more time regardless of the standard.",
        },
        {
          q: "Do you issue the certificate?",
          a: "No. Assessment and certification are different activities performed by different bodies. We assess and report. If you need a certificate, our report tells you what still needs fixing before a certification body is likely to issue one.",
        },
        {
          q: "What happens after a critical finding?",
          a: "The supplier commits to a corrective action with a target date. Most buyers then require a re-audit or documented evidence that the action was completed before the next order ships. A critical finding with no follow-up is not a closed finding.",
        },
      ],
      sources: [
        {
          name: "ISO 9001 quality management systems standard",
          note: "The reference framework for most quality audits, including documented procedures and internal audit requirements.",
        },
        {
          name: "amfori BSCI and Sedex SMETA audit methodologies",
          note: "The reference frameworks for social compliance audits, including interview protocols and finding grading.",
        },
        {
          name: "IATF 16949 and VDA 6.3",
          note: "Automotive-specific frameworks used for process audits in Thailand and other automotive manufacturing bases.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "工厂验厂核查四件事：公司是否与它声称的一致；它能否稳定地做出你的产品；它在用工和环境上是否符合你指定的标准；它的记录是否支撑它的回答。审核员通过走车间、读记录、访谈员工来完成，并对每一项发现按严重度分级。",
      definition:
        "工厂验厂是按约定标准或检查表对供应商进行的现场评估。审核员审阅文件、走访生产车间、访谈员工与管理层，并出具书面报告，发现项按严重度分级，附整改计划。验厂通常按标准命名：质量（ISO 9001）、社会责任（BSCI、SMETA、SA8000、WRAP），或买家自有检查表。",
      keyPoints: [
        "验厂发现项是分级，不是通过或不通过。接受与否由你的公司决定。",
        "记录和车间同样重要。审核员看不到的记录，会直接记为缺失。",
        "员工访谈是供应商准备最薄弱的一环，也最能暴露记录掩盖的问题。",
        "整改计划才是真正能改变结果的交付物。没有整改计划的报告只是一张照片。",
        "只有复审才能确认整改是落实了，还是仅仅承诺了。",
      ],
      steps: [
        {
          title: "从范围与主体开场",
          body: "确认审核的是哪个法律实体、哪栋厂房，场地归属谁，生产什么。大集团有时会带你参观最新厂区，实际从老厂区出货。",
        },
        {
          title: "审阅文件",
          body: "营业执照、工厂运营许可、质量手册、校准记录、来料检验记录、生产记录、不合格品台账、培训记录，以及核验阶段对方出示的证书。",
        },
        {
          title: "走访车间",
          body: "原料仓、来料检验、生产线、过程检验、成品、包装、仓储、实验室或检测区。注意现场管理、设备状况，以及墙上的流程是否与线上的流程一致。",
        },
        {
          title: "访谈员工",
          body: "标准有要求时，访谈要在车间之外、管理层不在场的情况下进行。工时、工资记录、招聘费和加班是发现项最集中的地方。",
        },
        {
          title: "分级发现项并确认整改",
          body: "发现项按严重度分级，在末次会议上沟通，并写明责任人与完成期限。严重项通常要求下一批出货前完成整改。",
        },
      ],
      examples: [
        {
          title: "扭矩批头校准过期",
          body: "纸面上是轻微项，实际上是严重项：用超校准期工具装配的每一台产品，扭矩值都无法确认。整改动作是重新校准，并对上一生产批次做 100% 复检。",
        },
        {
          title: "来料检验记录存在但内容完全相同",
          body: "三周的检验记录，测量值和签名都一样。审核员记录为「记录未实际维护」，这属于质量体系失效，而不只是文件问题。",
        },
        {
          title: "向外籍劳工收取招聘费",
          body: "工资记录和合同都合规，但访谈显示工人曾向中介支付费用才获得工作。这在多数社会责任标准下属于严重项，并要求退还费用。",
        },
        {
          title: "审核范围之外的外发工序",
          body: "主厂审得很干净。走过包装区时发现了来自另一个从未披露厂区的纸箱。审核范围随即扩大，第二个厂区不合格。",
        },
      ],
      checklist: [
        "被审厂区的营业执照与工厂运营许可",
        "质量手册与成文程序文件",
        "设备清单及有效期内的校准证书",
        "来料检验记录",
        "过程检验与成品检验记录",
        "不合格品台账与整改记录",
        "操作员与检验员的培训记录",
        "与签约主体一致的证书与检测报告",
        "审核周期内的工时与工资记录",
        "劳动合同与招聘费相关证据",
        "健康安全记录、消防器材检查与疏散演练",
        "适用情况下的环保许可与废弃物处置记录",
      ],
      faq: [
        {
          q: "验厂和验货有什么区别？",
          a: "验厂评估供应商的体系：它如何控制质量、如何管理合规、记录是否真实。验货检查具体某一批货：数量、工艺、包装和对订单规格的符合性。验厂安排在下单前或两批订单之间；验货安排在出货前。",
        },
        {
          q: "验厂需要几个人天？",
          a: "单厂区质量审核通常从一个人天起。SMETA 这类完整社会责任审核一般需要两天以上，按人数调整。多栋厂房的大型厂区，无论按什么标准都需要更多时间。",
        },
        {
          q: "你们发证吗？",
          a: "不发。评估与认证是不同机构做的不同事情。我们只做评估并出具报告。如果你需要证书，报告会告诉你还有哪些问题需要在认证机构发证前解决。",
        },
        {
          q: "出现严重项之后怎么办？",
          a: "供应商承诺整改并给出完成期限。多数买家随后要求复审，或要求提供整改完成的书面证据，之后才允许下一批出货。没有跟进的严重项不算已关闭。",
        },
      ],
      sources: [
        { name: "ISO 9001 质量管理体系标准", note: "多数质量审核的参考框架，包含成文程序与内部审核要求。" },
        { name: "amfori BSCI 与 Sedex SMETA 审核方法", note: "社会责任审核的参考框架，包含访谈规程与发现项分级。" },
        { name: "IATF 16949 与 VDA 6.3", note: "泰国等汽车制造基地常用的过程审核框架。" },
      ],
    },
  },
  {
    slug: "supplier-risk-assessment-guide",
    category: "risk",
    titleEn: "Supplier Risk Assessment: How to Score a Supplier",
    titleZh: "供应商风险评估：如何给供应商打分",
    metaDescEn:
      "How supplier risk assessment works: the six risk dimensions, how they are weighted, what evidence moves the score, and how to act on a result instead of just filing it.",
    metaDescZh:
      "供应商风险评估怎么运作：六个风险维度、权重如何分配、哪些证据会改变分数，以及拿到结果之后怎么行动而不是归档了事。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-scorecard" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/services/supplier-improvement" },
    ],
    related: ["how-to-verify-a-chinese-supplier", "factory-audit-checklist"],
    en: {
      quickAnswer:
        "Supplier risk assessment scores a supplier across weighted dimensions, usually company stability, quality, compliance, production, supply chain and documentation. The score is only as good as the evidence behind it, so the useful output is not the number but the list of what is missing. Act on that list: close the evidence gaps, or price the risk into the order.",
      definition:
        "Supplier risk assessment is a structured way to estimate the chance that a supplier will cause you a problem, and how bad that problem would be. It converts answers about company stability, quality control, compliance, production capacity, supply chain exposure and documentation into a single score with a dimension breakdown. A good assessment is deterministic: the same inputs always produce the same score.",
      keyPoints: [
        "A score without a breakdown is not actionable. You need to know which dimension is driving it.",
        "Missing evidence is a finding. \"We don't know\" should raise the score, not leave it unchanged.",
        "Deterministic scoring beats AI-generated scoring. If you cannot reproduce the number, you cannot defend it internally.",
        "Risk is not the same as quality. A well-run factory in an unstable region can still be a high-risk supplier.",
        "The point of the score is the decision it supports: order, renegotiate, verify, audit, or walk away.",
      ],
      steps: [
        {
          title: "Answer the questions with what you actually know",
          body: "Guessing inflates or deflates the score in both directions. Where you do not know, answer as unknown rather than assuming the best case. Unknown is information.",
        },
        {
          title: "Read the dimension breakdown, not just the total",
          body: "A score of 45 driven by documentation gaps is a very different problem from a score of 45 driven by production risk. The first is a paperwork exercise. The second may mean you need a second source.",
        },
        {
          title: "List what is missing",
          body: "Every gap on the list is a request you can send to the supplier. Most suppliers will produce a document they forgot to send. The ones who will not are telling you something.",
        },
        {
          title: "Decide the action, not just the rating",
          body: "Low risk: proceed with normal terms. Medium: close evidence gaps before the deposit. High: verification or an audit before any payment. Critical: do not place the order until something changes.",
        },
        {
          title: "Re-score after the gaps are closed",
          body: "The score should move. If it does not, the assessment is not tracking reality and the inputs need revisiting.",
        },
      ],
      examples: [
        {
          title: "Medium score driven by documentation",
          body: "A Vietnamese garment supplier scored 44, with most of the weight in documentation: no recent audit on file and an expired ISO certificate. Two documents later the score dropped to 28 with no change to the factory itself.",
        },
        {
          title: "Low score hiding concentrated production risk",
          body: "A Thai automotive parts supplier scored 21 and looked clean. The dimension breakdown showed all its capacity in one plant in a flood-prone province. The buyer added a second-source requirement rather than an audit.",
        },
        {
          title: "High score from subcontracting",
          body: "A Chinese electronics supplier scored 68. Production risk carried most of it: 40% of assembly was subcontracted during peak season and the subcontractor had never been audited. The action was an audit of the subcontractor, not of the main plant.",
        },
        {
          title: "Score moved after corrective action",
          body: "An audit found four major findings. After the corrective action period and a re-audit, the supplier's reassessment dropped 19 points. The score tracked the work rather than the promise.",
        },
      ],
      checklist: [
        "Company identity confirmed against the business registration",
        "Years in business and ownership structure known",
        "Quality system documented and certified where claimed",
        "Product test reports current and in scope",
        "Social compliance audit history available",
        "Capacity stated and compared with your order volume",
        "Key processes identified as in-house or subcontracted",
        "Subcontractors named and audited where material",
        "Single-source dependencies identified",
        "Payment terms and bank account checked against the contracting entity",
        "Score recorded with the date and the inputs used",
        "Reassessment scheduled after corrective actions",
      ],
      faq: [
        {
          q: "How is the risk score calculated?",
          a: "Each answer contributes to one of six weighted dimensions: company, quality, compliance, production, supply chain and documentation. The weights are fixed and published, and the calculation is deterministic, so the same inputs always give the same result. Our methodology page lists the weights in full.",
        },
        {
          q: "Does the AI decide the score?",
          a: "No. The score comes from a rules engine. Language models are used only to explain the result in plain language, and they cannot change the number. This matters because a score you cannot reproduce is a score you cannot defend.",
        },
        {
          q: "What is a good risk score?",
          a: "It depends on what you are buying and how much you are spending. Under 30 with no critical gaps is usually fine for a repeat order. Between 30 and 60 means close the evidence gaps before you pay a deposit. Above 60 means verify or audit before committing.",
        },
        {
          q: "How often should I re-score a supplier?",
          a: "At minimum once a year, and after any change that matters: a new production site, a change of ownership, a lapsed certificate, a quality incident, or a large increase in order volume.",
        },
      ],
      sources: [
        {
          name: "ISO 31000 risk management guidelines",
          note: "General framework for identifying, analysing and evaluating risk, applied here at supplier level.",
        },
        {
          name: "ISO 9001 clause 8.4 control of externally provided processes",
          note: "The basis for evaluating and re-evaluating suppliers within a quality management system.",
        },
        {
          name: "FactoryAuditB2B risk methodology",
          note: "Our own published weights and dimension definitions, used by the Supplier Risk Calculator.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "供应商风险评估按加权维度给供应商打分，通常包括公司稳定性、质量、合规、生产、供应链和文件。分数只和它背后的证据一样可靠，所以真正有用的输出不是那个数字，而是「缺什么」的清单。按清单行动：补齐证据缺口，或者把风险算进订单价格里。",
      definition:
        "供应商风险评估是一种结构化方法，用来估计一家供应商出问题的可能性，以及问题会有多严重。它把关于公司稳定性、质量控制、合规、产能、供应链敞口和文件的回答，转化为一个带维度拆解的分数。好的评估必须是确定性的：相同输入永远得到相同分数。",
      keyPoints: [
        "没有维度拆解的分数无法行动。你必须知道是哪个维度在拉高它。",
        "证据缺失本身就是发现项。「我们不知道」应该把分数推高，而不是让它保持不变。",
        "确定性评分优于 AI 生成评分。不能复现的数字，内部就无法自证。",
        "风险不等于质量。一家运行良好的工厂，如果所在地不稳定，仍然是高风险供应商。",
        "分数的意义在于它支持的决策：下单、重谈、核验、验厂，还是放弃。",
      ],
      steps: [
        {
          title: "按你实际知道的情况作答",
          body: "猜测会让分数在两个方向上失真。不知道就选「未知」，不要按最好的情况假设。未知本身也是信息。",
        },
        {
          title: "看维度拆解，而不是只看总分",
          body: "由文件缺口推高的 45 分，和由生产风险推高的 45 分，是两个完全不同的问题。前者是补文件，后者可能需要你开第二供应源。",
        },
        {
          title: "列出缺失项",
          body: "清单上每一个缺口都是一条可以发给供应商的要求。多数供应商会把忘了发的文件补上。不肯补的那些，已经在告诉你一些事情。",
        },
        {
          title: "决定动作，而不只是定级",
          body: "低风险：按常规条款执行。中风险：付定金前补齐证据缺口。高风险：付款前先核验或验厂。极高风险：在情况改变之前不要下单。",
        },
        {
          title: "缺口补齐后重新打分",
          body: "分数应该会变化。如果没变，说明评估没有反映现实，需要重新检查输入项。",
        },
      ],
      examples: [
        {
          title: "中风险由文件缺口拉高",
          body: "一家越南服装供应商得 44 分，权重主要在文件：没有近期审核记录，ISO 证书已过期。补齐两份文件后分数降到 28，工厂本身没有任何变化。",
        },
        {
          title: "低分掩盖了集中的生产风险",
          body: "一家泰国汽车零部件供应商得 21 分，看起来很干净。维度拆解显示它的产能全部集中在易受洪水影响省份的一个厂区。买家随后增加了第二供应源要求，而不是安排验厂。",
        },
        {
          title: "高分来自外发",
          body: "一家中国电子供应商得 68 分，生产风险占大头：旺季 40% 的组装外发，而外发厂从未被审核过。正确的动作是审核外发厂，而不是审核主厂。",
        },
        {
          title: "整改后分数下降",
          body: "一次验厂查出四个主要发现项。整改期满并复审之后，该供应商的复评分数下降了 19 分。分数跟随的是实际动作，而不是承诺。",
        },
      ],
      checklist: [
        "已对照工商登记确认公司身份",
        "已知经营年限与股权结构",
        "质量体系成文，宣称的认证属实",
        "产品检测报告在有效期内且在范围内",
        "社会责任审核历史可获取",
        "产能已书面说明并与订单量比对",
        "已区分关键工序是自有还是外发",
        "重要的外发厂已具名并接受审核",
        "已识别单一来源依赖",
        "付款条款与银行账户已对照签约主体核查",
        "分数连同日期与所用输入项一并记录",
        "整改完成后已安排复评",
      ],
      faq: [
        {
          q: "风险分数是怎么算的？",
          a: "每个答案计入六个加权维度之一：公司、质量、合规、生产、供应链、文件。权重固定并公开，计算过程是确定性的，因此相同输入必然得到相同结果。方法说明页列出了完整权重。",
        },
        {
          q: "分数是 AI 决定的吗？",
          a: "不是。分数由规则引擎计算。语言模型只负责把结果解释成人话，它无法改变数字。这一点很重要：无法复现的分数，是无法自证的分数。",
        },
        {
          q: "多少分算好？",
          a: "取决于你买什么、花多少钱。30 分以下且无严重缺口，对返单通常没问题。30 到 60 分意味着付定金前先补齐证据缺口。60 分以上意味着下单前先核验或验厂。",
        },
        {
          q: "多久重新评一次？",
          a: "至少每年一次，并在任何重大变化之后：新增生产场地、股权变更、证书失效、质量事故，或订单量大幅上升。",
        },
      ],
      sources: [
        { name: "ISO 31000 风险管理指南", note: "识别、分析与评价风险的通用框架，此处应用于供应商层面。" },
        { name: "ISO 9001 第 8.4 条 外部提供过程的控制", note: "质量管理体系内评价与重新评价供应商的依据。" },
        { name: "FactoryAuditB2B 风险方法说明", note: "我们公开的权重与维度定义，供应商风险计算器使用的就是这套模型。" },
      ],
    },
  },

  // ---------- 新增指南（SEO 内容扩展，2026-08-31） ----------
  // 以下 6 篇覆盖高意图搜索簇，并修复此前 guides[0].related 引用的两个缺失 slug。



  {
    slug: "smeta-vs-bsci-social-audit-comparison",
    category: "compliance",
    titleEn: "SMETA vs BSCI: Social Audit Comparison",
    titleZh: "SMETA 与 BSCI 对比：社会责任审核怎么选",
    metaDescEn:
      "SMETA vs BSCI explained: what each social audit covers, who runs them, reporting differences, recognition, and how to choose the right one for your supply base and buyers.",
    metaDescZh:
      "SMETA 与 BSCI 对比：各自覆盖什么、由谁执行、报告差异、认可度，以及如何为你的供应基与采购方选对审核。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/audit-checklist" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/factory-audit/request" },
    ],
    related: ["supplier-risk-assessment-guide", "factory-audit-checklist", "how-to-read-a-factory-audit-report"],
    en: {
      quickAnswer:
        "SMETA and BSCI are both social audits built on the same base standards, but SMETA is a flexible audit method reported through a shared platform, while BSCI is a managed programme with a single code and grading. Choose BSCI when your buyer mandates it; choose SMETA when you want one audit readable by many retailers.",
      definition:
        "SMETA (Sedex Members Ethical Trade Audit) is an audit method created by Sedex; it measures a site against the ETI Base Code and local law, and reports results into the Sedex database. BSCI (Business Social Compliance Initiative) is a full programme run by amfori with its own code, a 13-performance-area grading and a corrective-action cycle.",
      keyPoints: [
        "Both rest on the ETI Base Code plus national law, so the underlying checks overlap heavily.",
        "SMETA is method-plus-platform: one audit can satisfy multiple customers who read Sedex.",
        "BSCI is a programme with a uniform code, a numbered grading (A to E) and a required corrective plan.",
        "BSCI restricts who may audit (amfori-approved auditors); SMETA accepts affiliate auditors under Sedex rules.",
        "Neither issues a 'pass' certificate; both produce a report and a list of findings to manage.",
      ],
      steps: [
        { title: "Check what your buyer requires", body: "If a customer mandates BSCI, run BSCI. If several retailers each want visibility, SMETA on Sedex is often the cheaper single audit." },
        { title: "Confirm scope and sites", body: "Decide which sites and which workers are in scope; both audits cover the whole site, not a single product line." },
        { title: "Book an approved auditor", body: "Use an amfori-approved auditor for BSCI; use a Sedex-affiliated auditor for SMETA." },
        { title: "Manage the findings", body: "Turn the report into a corrective-action plan with dates; BSCI grades the result, SMETA tracks it on the platform." },
      ],
      examples: [
        { title: "Single retailer mandate", body: "A European buyer required BSCI grade C or better; the factory booked a BSCI audit and closed major findings within 60 days." },
        { title: "Multi-customer base", body: "A supplier selling to several UK retailers ran one SMETA audit and shared the Sedex report with all of them, avoiding three separate audits." },
        { title: "Cost of a single audit", body: "A mid-size factory paid a comparable fee for either scheme; the saving came from avoiding a second audit, not from the scheme price. SMETA's shared report delivered that saving when the buyer accepted Sedex." },
      ],
      checklist: [
        "Buyer requirement confirmed (BSCI mandate vs Sedex visibility)",
        "Audit scope and sites defined",
        "Approved auditor selected for the chosen scheme",
        "ETI Base Code and local law covered",
        "Corrective-action plan with deadlines agreed",
        "Report shared through the right platform",
      ],
      faq: [
        { q: "Which is more recognised?", a: "Both are widely recognised. BSCI is common with European retailers in amfori networks; SMETA is common where Sedex membership is expected. Recognition depends on your buyer, not on the scheme itself." },
        { q: "Can one replace the other?", a: "Not automatically. A SMETA report does not become a BSCI grade, and a BSCI report does not auto-post to Sedex. Run the scheme your buyer asks for." },
        { q: "Do they check product quality?", a: "No. Both are social audits about labour, safety, environment and ethics. Product quality needs a separate quality audit or inspection." },
      ],
      sources: [
        { name: "Sedex SMETA guidance", note: "The audit method and reporting model behind SMETA." },
        { name: "amfori BSCI code and performance areas", note: "The uniform code and A to E grading used by BSCI." },
        { name: "ETI Base Code", note: "The labour standard both schemes build on." },
      ],
    },
    zh: {
      quickAnswer:
        "SMETA 与 BSCI 都基于同一套底层标准，但 SMETA 是可在共享平台读取的灵活审核方法，BSCI 是带统一准则与评级的管理项目。采购方强制要求 BSCI 就做 BSCI；想一份报告服务多家零售商就读 Sedex 上的 SMETA。",
      definition:
        "SMETA（Sedex 会员道德贸易审核）是 Sedex 创立的审核方法，按 ETI 基本准则与当地法律测量工厂，结果写入 Sedex 数据库。BSCI（商界社会责任倡议）是 amfori 运营的完整项目，有统一准则、13 个绩效领域评级与纠偏周期。",
      keyPoints: [
        "两者都建立在 ETI 基本准则加当地法律之上，底层检查高度重合。",
        "SMETA 是方法加平台：一次审核可满足多个读 Sedex 的客户。",
        "BSCI 是项目：统一准则、A 到 E 编号评级，并要求纠偏计划。",
        "BSCI 限定由 amfori 认可审核员执行；SMETA 接纳 Sedex 规则的附属审核员。",
        "两者都不发「通过」证书，都产出报告与待处理发现项清单。",
      ],
      steps: [
        { title: "确认采购方要求", body: "客户强制 BSCI 就做 BSCI；多家零售商都要可视性时，Sedex 上的 SMETA 往往是最省的一次审核。" },
        { title: "确定范围与厂区", body: "决定哪些厂区、哪些工人纳入范围；两种审核都覆盖整个厂区，而非单条产品线。" },
        { title: "预约认可审核员", body: "BSCI 用 amfori 认可审核员；SMETA 用 Sedex 附属审核员。" },
        { title: "跟进发现项", body: "把报告转成带日期的纠偏计划；BSCI 对结果评级，SMETA 在平台跟踪。" },
      ],
      examples: [
        { title: "单一零售商强制", body: "某欧洲买家要求 BSCI C 级或以上，工厂预约 BSCI 审核并在 60 天内关闭严重发现项。" },
        { title: "多客户基", body: "一家供货多家英国零售商的供应商只跑了一次 SMETA，把 Sedex 报告共享给全部客户，省去三次独立审核。" },
      ],
      checklist: [
        "已确认采购方要求（BSCI 强制 vs Sedex 可视性）",
        "已定义审核范围与厂区",
        "已为所选体系选择认可审核员",
        "已覆盖 ETI 基本准则与当地法律",
        "已约定带截止日的纠偏计划",
        "已通过正确平台共享报告",
      ],
      faq: [
        { q: "哪个更被认可？", a: "两者都被广泛认可。BSCI 在 amfori 网络的欧洲零售商中常见；SMETA 在期望 Sedex 会员资格时常见。认可度取决于你的买家，而非体系本身。" },
        { q: "能互相替代吗？", a: "不能自动替代。SMETA 报告不会变成 BSCI 评级，BSCI 报告也不会自动上 Sedex。按采购方要求做对应体系。" },
        { q: "它们查产品质量吗？", a: "不查。两者都是关于劳工、安全、环境、道德的社责审核。产品质量需要单独的质量审核或验货。" },
        { q: "要花多少钱、多久？", a: "典型审核现场约 1-3 天加出报告，费用随厂区规模与工人数量浮动。更大的成本变量是能否一次审核满足所有买家；为另一体系再跑一次审核才是真正累加的开销。" },
        { q: "新供应商该从哪个体系起步？", a: "先看买家强制要求。若没人指定，Sedex 上的 SMETA 是更灵活的默认，因为一份报告可服务多家客户；只有当买家要求评级时才转 BSCI。" },
      ],
      sources: [
        { name: "Sedex SMETA 指引", note: "SMETA 背后的审核方法与报告模型。" },
        { name: "amfori BSCI 准则与绩效领域", note: "BSCI 使用的统一准则与 A 到 E 评级。" },
        { name: "ETI 基本准则", note: "两个体系共同依托的劳工标准。" },
      ],
    },
  },

  {
    slug: "how-to-read-a-factory-audit-report",
    category: "audit",
    titleEn: "How to Read a Factory Audit Report",
    titleZh: "如何读懂工厂验厂报告",
    metaDescEn:
      "How to read a factory audit report: separate the score from the findings, read the major and critical items first, check the evidence, and decide what to do about each finding.",
    metaDescZh:
      "如何读懂工厂验厂报告：把分数与发现项分开看，先看严重与致命项，核对证据，再对每项发现决定处理方式。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/audit-report-analyzer" },
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/factory-audit/request" },
      { href: "/services/supplier-verification" },
    ],
    related: ["factory-audit-checklist", "smeta-vs-bsci-social-audit-comparison", "supplier-risk-assessment-guide"],
    en: {
      quickAnswer:
        "Read a factory audit report in three passes: first the major and critical findings, then the evidence behind each, then the score. A high average score can still hide one critical item that should stop the order.",
      definition:
        "A factory audit report records what an auditor observed on site against a checklist: legal status, facility, quality system, labour, safety and environment, each with a finding and usually a severity grade. The report is a record of conditions, not a pass or fail certificate.",
      keyPoints: [
        "Severity beats score: one critical finding outweighs a clean average.",
        "Read the evidence photos and document references, not just the summary.",
        "Check the audit date and whether the site visited is the one that will make your product.",
        "Distinguish a systemic failure from a one-off slip; the fix differs.",
        "A report describes a moment in time; re-audit after major corrective actions.",
      ],
      steps: [
        { title: "Open with the summary of findings", body: "Scan the count of critical, major, minor and pass items. This frames everything else." },
        { title: "Read every critical and major item", body: "For each, read the observation, the standard breached, and the evidence. Judge whether it is systemic or isolated." },
        { title: "Verify the site and date", body: "Confirm the audited entity, address and date match the supplier you intend to use and the current period." },
        { title: "Map findings to action", body: "Decide per finding: accept, require correction with proof, or stop the order. Set deadlines for corrections." },
      ],
      examples: [
        { title: "High score, one critical", body: "A report scored well overall but flagged undisclosed subcontracting; the buyer required the subcontractor to be added to the audit before shipment." },
        { title: "Low score, fixable", body: "Several minor documentation gaps with no critical items; the buyer accepted the order with a pre-shipment inspection to confirm correction." },
      ],
      checklist: [
        "Critical and major findings read in full",
        "Evidence photos and document refs checked",
        "Audited entity matches the contract",
        "Audit date is current",
        "Systemic vs isolated judged per item",
        "Corrective actions and deadlines recorded",
      ],
      faq: [
        { q: "Does a good score mean the factory is safe to use?", a: "Not alone. A good average can sit on top of one critical item such as child labour or a fake certificate. Always read the findings before the score." },
        { q: "Who wrote the report?", a: "An independent auditor engaged for the audit. Scheme-approved firms such as SGS, Intertek, BV and TUV issue the underlying report; this platform verifies and, on request, audits." },
        { q: "How fresh must the report be?", a: "Use a report from the last 12 months as a baseline; require a fresh audit after any major change or a critical finding." },
      ],
      sources: [
        { name: "ISO 19011 auditing principles", note: "How audit findings and evidence should be recorded." },
        { name: "SA8000 and ETI Base Code", note: "The standards most social findings reference." },
        { name: "FactoryAuditB2B audit report analyzer", note: "A tool that structures a pasted report into severity-graded findings." },
      ],
    },
    zh: {
      quickAnswer:
        "读工厂验厂报告分三遍：先看严重与致命发现项，再看每项背后的证据，最后看分数。平均分再高，也可能藏着一条应中止订单的致命项。",
      definition:
        "工厂验厂报告记录审核员现场对照清单的所见：法律资质、厂房、质量体系、劳工、安全、环境，每项带结论并通常有严重度分级。报告是对状况的记录，不是通过或不通过的证书。",
      keyPoints: [
        "严重度胜过分数：一条致命项压过干净的平均分。",
        "读证据照片与文件引用，而不只是摘要。",
        "核对审核日期与被访厂区是否就是为你生产产品的那家。",
        "区分系统性失效与偶发失误，整改方式不同。",
        "报告只描述某一时刻，重大整改后需复评。",
      ],
      steps: [
        { title: "从发现项摘要入手", body: "扫一遍致命、严重、轻微与通过项的数量，这框定了其余内容。" },
        { title: "逐项读严重与致命项", body: "对每项读观察、被违反的标准与证据，判断是系统性还是孤立的。" },
        { title: "核实厂区与日期", body: "确认被审核主体、地址、日期与你打算使用的供应商及当前时段一致。" },
        { title: "把发现项映射到动作", body: "逐项决定：接受、要求带证据整改，或中止订单，并设整改期限。" },
      ],
      examples: [
        { title: "高分，一条致命", body: "一份报告总体分不错，但标出未披露的转包；买家要求先把转包方纳入审核才发货。" },
        { title: "低分，可修", body: "若干轻微文件缺口且无致命项；买家接受订单，并以出货前验货确认整改。" },
      ],
      checklist: [
        "已通读严重与致命发现项",
        "已核对证据照片与文件引用",
        "被审核主体与合同一致",
        "审核日期为近期",
        "逐项判断系统性 vs 孤立",
        "已记录整改动作与期限",
      ],
      faq: [
        { q: "分数好就代表工厂可用吗？", a: "不能单看。好看的平均分可能压着一条致命项，如童工或假证。永远先读发现项再读分数。" },
        { q: "报告谁写的？", a: "为本次审核聘请的独立审核员。SGS、Intertek、BV、TUV 等认可机构出具底层报告；本平台做核验，并按需安排验厂。" },
        { q: "报告要多新？", a: "以近 12 个月报告作基线；发生任何重大变化或出现致命项后，要求重新审核。" },
      ],
      sources: [
        { name: "ISO 19011 审核原则", note: "审核发现与证据应如何记录。" },
        { name: "SA8000 与 ETI 基本准则", note: "多数社责发现项引用的标准。" },
        { name: "FactoryAuditB2B 验厂报告分析器", note: "把粘贴的报告结构化为按严重度分级的发现项的工具。" },
      ],
    },
  },

  {
    slug: "how-to-audit-a-factory-in-vietnam",
    category: "sea",
    titleEn: "How to Audit a Factory in Vietnam",
    titleZh: "如何在越南验厂",
    metaDescEn:
      "How to audit a factory in Vietnam: confirm investment and business registration, verify the real production site, review quality and social compliance, and order an on-site audit before a deposit.",
    metaDescZh:
      "如何在越南验厂：确认投资与商业登记、核实真实生产场地、审阅质量与社会合规，并在付定金前安排现场审核。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/vietnam-factory-audit" },
      { href: "/services/vietnam-supplier-verification" },
    ],
    related: ["factory-audit-checklist", "how-to-verify-a-chinese-supplier", "supplier-risk-assessment-guide"],
    en: {
      quickAnswer:
        "To audit a factory in Vietnam, confirm the enterprise registration and the Investment Registration Certificate where relevant, verify the production site is real and matches the address, review quality and social compliance records, then order an on-site audit before you pay a deposit.",
      definition:
        "Auditing a factory in Vietnam means confirming that the supplier is a registered enterprise, that the site named is where production happens, and that quality and labour practices meet your requirements. Vietnam's registration system is public but split between the National Business Registration Portal and sector licences, so the first checks are about which records prove the entity.",
      keyPoints: [
        "Confirm the Enterprise Registration Certificate and, for foreign-invested plants, the Investment Registration Certificate.",
        "The registered address on the certificate is not always the production site; verify the factory physically.",
        "Vietnam clusters manufacturing in the north (Bac Ninh, Bac Giang, Hai Phong) and the south (Binh Duong, Dong Nai, Ho Chi Minh).",
        "Social compliance matters for EU and US buyers; review labour, fire safety and environmental permits.",
        "A deposit should follow an on-site audit, not precede it, for a first or high-value order.",
      ],
      steps: [
        { title: "Confirm registration", body: "Pull the Enterprise Registration Certificate from the National Business Registration Portal and match the legal entity to the contract." },
        { title: "Verify the site", body: "Visit or commission a visit to confirm the factory exists at the stated address and can make your product." },
        { title: "Review quality and compliance", body: "Ask for the quality system, inspection records, labour files, fire safety and environmental permits." },
        { title: "Order the on-site audit", body: "Book an independent audit before the deposit; grade findings and require corrections with proof." },
      ],
      examples: [
        { title: "Northern electronics cluster", body: "A buyer verified a Bac Ninh plant through the registration portal, then audited on site before releasing a deposit for a new product line." },
        { title: "Southern garment shop", body: "An audit in Binh Duong found the registered address was a trading office; the buyer required the actual production site to be added before ordering." },
      ],
      checklist: [
        "Enterprise Registration Certificate confirmed",
        "Investment Registration Certificate where applicable",
        "Production site verified at the stated address",
        "Quality system and inspection records reviewed",
        "Labour, fire safety and environmental permits checked",
        "On-site audit booked before deposit",
      ],
      faq: [
        { q: "Is Vietnamese company data public?", a: "Yes, through the National Business Registration Portal, though it is less centralised than China's system and some sector licences sit outside it." },
        { q: "Do I need a local auditor?", a: "Use an independent auditor who knows Vietnamese registration and labour rules; a local language and site access improve the result." },
        { q: "How does Vietnam compare with China for verification?", a: "Both need site verification. China's company records are more centralised; Vietnam's are public but spread across more systems, so confirmation takes a little more care." },
      ],
      sources: [
        { name: "Vietnam National Business Registration Portal", note: "Public source for Enterprise Registration Certificates." },
        { name: "Vietnam Law on Enterprises", note: "The basis for enterprise registration and legal status checks." },
        { name: "FactoryAuditB2B Vietnam coverage", note: "Country-specific verification and audit notes for Vietnam." },
      ],
    },
    zh: {
      quickAnswer:
        "在越南验厂，先确认企业登记与（如适用）投资登记证，核实生产场地真实且与地址一致，审阅质量与社会合规记录，再在付定金前安排现场审核。",
      definition:
        "在越南验厂即确认供应商是已登记企业、所报场地确为生产发生地、质量与用工符合你的要求。越南登记系统公开，但分散在国家企业登记门户与行业许可之间，所以第一步是弄清哪份文件能证明主体。",
      keyPoints: [
        "确认《企业登记证》，外资厂还要看《投资登记证》。",
        "登记证上的地址未必是生产场地，要实地核实工厂。",
        "越南制造集中在北部（北宁、北江、海防）与南部（平阳、同奈、胡志明）。",
        "对欧美买家，社会合规很关键：核对劳工、消防与环保许可。",
        "首单或大额订单，定金应在现场审核之后而非之前。",
      ],
      steps: [
        { title: "确认登记", body: "从国家企业登记门户调取《企业登记证》，核对法律主体与合同一致。" },
        { title: "核实场地", body: "实地或委托走访，确认工厂在所示地址存在且能生产你的产品。" },
        { title: "审阅质量与合规", body: "索取质量体系、检验记录、劳工档案、消防与环保许可。" },
        { title: "安排现场审核", body: "定金前预约独立审核，对发现项分级并要求带证据整改。" },
      ],
      examples: [
        { title: "北部电子集群", body: "买家通过登记门户核实北宁工厂，再在下放新产品线定金前做了现场审核。" },
        { title: "南部服装厂", body: "同奈审核发现登记地址是贸易办公室；买家要求先把实际生产场地补入才下单。" },
      ],
      checklist: [
        "已确认《企业登记证》",
        "适用时确认《投资登记证》",
        "已在所示地址核实生产场地",
        "已审阅质量体系与检验记录",
        "已核对劳工、消防与环保许可",
        "定金前已预约现场审核",
      ],
      faq: [
        { q: "越南公司信息公开吗？", a: "公开，通过国家企业登记门户；但它不如中国集中，部分行业许可在该系统之外，确认需更细心。" },
        { q: "需要本地审核员吗？", a: "用熟悉越南登记与劳工规则的独立审核员；本地语言与现场进入能力会提升结果。" },
        { q: "越南与中国核验有何不同？", a: "两者都需现场核实。中国公司记录更集中；越南公开但分散在更多系统，确认要多花一点功夫。" },
      ],
      sources: [
        { name: "越南国家企业登记门户", note: "《企业登记证》的公开来源。" },
        { name: "越南《企业法》", note: "企业登记与法律身份核查的依据。" },
        { name: "FactoryAuditB2B 越南覆盖", note: "针对越南的核验与验厂要点。" },
      ],
    },
  },

  {
    slug: "pre-shipment-inspection-checklist",
    category: "audit",
    titleEn: "Pre-Shipment Inspection Checklist",
    titleZh: "出货前验货清单",
    metaDescEn:
      "A pre-shipment inspection checklist: when to inspect, what to check (quantity, workmanship, function, packaging, labelling, loading), sampling plans and how to act on the result.",
    metaDescZh:
      "出货前验货清单：何时验货，查什么（数量、做工、功能、包装、标签、装柜），抽样方案，以及如何处理结果。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-verification-checklist" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/factory-audit/request" },
    ],
    related: ["factory-audit-checklist", "how-to-read-a-factory-audit-report", "supplier-risk-assessment-guide"],
    en: {
      quickAnswer:
        "A pre-shipment inspection checks the finished goods after production but before they leave the factory: quantity, workmanship, function, packing, labelling and, if requested, container loading. Use an AQL sampling plan and only release payment against a pass result.",
      definition:
        "Pre-shipment inspection (PSI) is a quality check performed when at least 80 percent of an order is packed and ready. An inspector samples units using an AQL plan, records defects by severity, and reports whether the batch is acceptable to ship.",
      keyPoints: [
        "Inspect at 80 to 100 percent production complete, not at the start of packing.",
        "Use an AQL sampling plan (such as ANSI/ASQ Z1.4) so the sample size and accept numbers are objective.",
        "Check quantity, workmanship, function, packing and labelling, plus on-time shipment risk.",
        "Classify defects as critical, major or minor; a critical defect can reject the whole batch.",
        "Tie payment release to the inspection result, not to the supplier's promise.",
      ],
      steps: [
        { title: "Schedule at the right moment", body: "Book the inspection when production and packing are 80 percent done, so you can still hold or fix the batch." },
        { title: "Agree the AQL level", body: "Set the acceptable quality limit and sample size with the buyer before the inspection." },
        { title: "Run the checks", body: "Count quantity, test function, assess workmanship, verify packing and labelling against the spec and the purchase order." },
        { title: "Act on the result", body: "Accept, request rework, or reject. Release payment only against a pass, and photograph loading if included." },
      ],
      examples: [
        { title: "Catch before shipping", body: "A PSI on a toy order found a labelling error on 12 percent of units; the supplier reworked the batch before container loading." },
        { title: "Function failure", body: "A PSI on small appliances found a critical electrical defect; the buyer rejected the batch and re-sourced rather than risk a recall." },
      ],
      checklist: [
        "Production and packing at least 80 percent complete",
        "AQL level and sample size agreed",
        "Quantity counted against the purchase order",
        "Function and workmanship tested",
        "Packing and labelling verified to spec",
        "Result tied to payment release",
      ],
      faq: [
        { q: "When should pre-shipment inspection happen?", a: "When 80 to 100 percent of the order is produced and packed. Earlier gives too little to sample; later leaves no time to fix." },
        { q: "What is AQL?", a: "Acceptable Quality Limit: the worst tolerable defect rate in a batch. It sets the sample size and the accept or reject numbers used during inspection." },
        { q: "Does inspection replace a factory audit?", a: "No. Inspection checks the batch; an audit checks the site and system. Use both: audit the factory, inspect the shipment." },
      ],
      sources: [
        { name: "ANSI/ASQ Z1.4 sampling standard", note: "The common AQL sampling plan used for inspections." },
        { name: "ISO 2859 attribute sampling", note: "International equivalent for lot-by-lot inspection." },
        { name: "FactoryAuditB2B inspection service", note: "How we scope and report pre-shipment inspections." },
      ],
    },
    zh: {
      quickAnswer:
        "出货前验货在生产完成后、货物离厂前检查成品：数量、做工、功能、包装、标签，以及（如要求）装柜。采用 AQL 抽样方案，并只在结果为通过时才放款。",
      definition:
        "出货前验货（PSI）是在订单至少 80% 已包装就绪时做的质量检查。检验员按 AQL 方案抽样，按严重度记录缺陷，并报告该批是否可发运。",
      keyPoints: [
        "在生产完成 80% 至 100% 时验，而非刚开始包装。",
        "用 AQL 抽样方案（如 ANSI/ASQ Z1.4），让样本量与接收数客观。",
        "查数量、做工、功能、包装、标签，以及按时发货风险。",
        "缺陷分致命、严重、轻微；一条致命缺陷可整批拒收。",
        "把放款与验货结果挂钩，而非与供应商承诺挂钩。",
      ],
      steps: [
        { title: "在正确时点预约", body: "生产及包装完成 80% 时预约，这样还能拦下或修复整批。" },
        { title: "约定 AQL 等级", body: "验货前与买家定好可接受质量限与样本量。" },
        { title: "执行检查", body: "清点数量、测试功能、评估做工、按规格与采购单核对包装与标签。" },
        { title: "按结果处理", body: "接受、要求返工或拒收；仅结果为通过才放款，含装柜时拍照。" },
      ],
      examples: [
        { title: "发货前拦下", body: "某玩具单的 PSI 发现 12% 单位标签错误，供应商在装柜前返工了该批。" },
        { title: "功能失效", body: "某小家电 PSI 发现致命电气缺陷，买家拒收并重新寻源，而非承担召回风险。" },
      ],
      checklist: [
        "生产与包装至少完成 80%",
        "已约定 AQL 等级与样本量",
        "已按采购单清点数量",
        "已测试功能与做工",
        "已按规格核对包装与标签",
        "结果已与放款挂钩",
      ],
      faq: [
        { q: "出货前验货应在何时？", a: "订单生产并包装 80% 至 100% 时。太早抽样不足，太晚没时间修。" },
        { q: "AQL 是什么？", a: "可接受质量限：一批中可容忍的最差缺陷率。它决定验货时的样本量与接收/拒收数。" },
        { q: "验货能替代验厂吗？", a: "不能。验货查批次，验厂查现场与体系。两者都要：验厂审工厂，验货审 shipment。" },
      ],
      sources: [
        { name: "ANSI/ASQ Z1.4 抽样标准", note: "验货常用的 AQL 抽样方案。" },
        { name: "ISO 2859 计数抽样", note: "逐批检验的国际等效标准。" },
        { name: "FactoryAuditB2B 验货服务", note: "我们如何界定与报告出货前验货。" },
      ],
    },
  },
  {
    slug: "what-is-a-factory-audit",
    category: "audit",
    titleEn: "What Is a Factory Audit? How Buyers Choose a Reliable Audit Firm",
    titleZh: "什么是第三方验厂？海外买家如何选择靠谱的验厂机构",
    metaDescEn:
      "What a B2B factory audit is, why overseas buyers need one, and how to choose a reliable third-party audit firm: product experience, speed and report transparency.",
    metaDescZh:
      "第三方验厂（Factory Audit）是什么、跨国采购为什么必须做、以及如何选择靠谱的验厂机构：行业经验、响应速度、报告透明度。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
    ],
    services: [{ href: "/factory-audit/request" }, { href: "/services/china-factory-audit" }],
    related: ["factory-audit-checklist", "on-site-vs-desk-audit", "supplier-evaluation-checklist"],
    en: {
      quickAnswer:
        "A factory audit is an on-site check by an independent inspector who verifies that a supplier exists, can make your product, and runs a real quality and compliance system. Buyers use it to avoid phantom factories, inflated capacity claims and quality surprises. Choose a firm by product-category experience, turnaround speed and report transparency, not by price alone.",
      definition:
        "A third-party factory audit is an assessment performed by an organization independent of both buyer and seller. An experienced auditor visits the site and evaluates the supplier's legality, production capability, quality management system (QMS) and working conditions, then issues a report that lets a buyer thousands of miles away see the factory as it actually runs.",
      keyPoints: [
        "Verification, not trust: a polished online profile can be fabricated; an on-site audit exposes trading companies pretending to be factories.",
        "Capacity reality check: suppliers may claim 100k units a month while running three old machines; an audit punctures the capacity bubble.",
        "Quality confidence up front: reviewing incoming, in-process and final QC, material storage and equipment maintenance stops defects at the source.",
        "Independent evidence: a good audit report is produced by a party with no stake in the order, so the buyer can rely on it.",
        "A starting point, not a one-time fix: re-audit after corrective actions to confirm they were completed, not just promised.",
      ],
      steps: [
        {
          title: "Define scope and standard",
          body: "Decide which legal entity and building are in scope, and which standard applies (your own checklist, ISO 9001, BSCI, SMETA or SA8000). Tell the supplier what you will check before the visit.",
        },
        {
          title: "Book a qualified auditor",
          body: "Use a firm with experience in your product category (electronics, apparel, machinery) and the certifications relevant to your market. Confirm they can reach the site and schedule the visit.",
        },
        {
          title: "Review the report, not just the verdict",
          body: "A useful report carries unedited site photos, videos and a graded list of findings (non-conformities), not a simple pass or fail. Read the findings by severity.",
        },
        {
          title: "Act on the findings",
          body: "Close critical findings before the next order ships. Request a corrective action plan with owners and dates, then re-audit to confirm.",
        },
      ],
      examples: [
        {
          title: "Trading company uncovered",
          body: "A large manufacturer seen at a trade show turned out to be a few-person trading company; an on-site audit of the actual production site protected the buyer from a subcontracting scam.",
        },
        {
          title: "Capacity bubble punctured",
          body: "A supplier promised 100k units a month; the auditor counted three outdated machines and a much smaller workforce, so the buyer split the order across two factories.",
        },
      ],
      checklist: [
        "Scope and standard agreed with the supplier",
        "Auditor experienced in your product category",
        "Site visit scheduled, not desk-only",
        "Report includes unedited photos and graded findings",
        "Critical findings have a corrective action plan",
        "Re-audit planned if findings are open",
      ],
      faq: [
        {
          q: "Is a factory audit the same as an inspection?",
          a: "No. An audit assesses the site and system (can it make your product well and compliantly); an inspection checks a finished batch. Use both: audit the factory, inspect the shipment.",
        },
        {
          q: "How fast can an audit happen?",
          a: "A capable firm can often arrange an on-site audit within 48 hours and issue a detailed report within 24 hours of the visit, depending on location and scope.",
        },
        {
          q: "What makes a report trustworthy?",
          a: "Unedited site photos and video, a graded findings list, and an auditor independent of the transaction. A one-line pass with no evidence is not a report.",
        },
        {
          q: "Do I need an audit for a small trial order?",
          a: "For a low-value, low-risk trial you can start with a desk (document) review; reserve a full on-site audit for the first large order or high-safety products.",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B audit service", note: "How we scope, conduct and report factory audits across Asia." },
        { name: "ISO 9001 quality management", note: "The common baseline for a quality-system portion of an audit." },
      ],
    },
    zh: {
      quickAnswer:
        "验厂是由独立审核员到工厂实地，核实供应商是否真实存在、能否生产你的产品、是否运行真正的质量与合规体系。买家用它规避皮包公司、产能虚标和质量翻车。选机构看行业经验、响应速度和报告透明度，而不是只比价格。",
      definition:
        "第三方验厂是指由独立于买卖双方的机构，派有经验的审核员到工厂实地，对供应商的合法性、生产能力、质量管理体系（QMS）和工作环境做全面评估，并出具报告，让远在千里之外的买家能看见工厂真实的运转状态。",
      keyPoints: [
        "验证而非信任：网上光鲜的图片可能是伪造的，实地审核能立刻拆穿贸易公司冒充源头工厂。",
        "产能 reality check：供应商说月产10万件，现场可能只有3台旧机器；验厂能刺破产能泡沫。",
        "质量信心前置：提前看进料、制程和成品 QC、原料仓储与设备维护，从源头切断劣质品。",
        "独立证据：好报告由与订单无利益关系的第三方出具，买家可放心依赖。",
        "起点而非一次性：整改后要做复审，确认动作真的完成，而不只是承诺。",
      ],
      steps: [
        {
          title: "确定范围与标准",
          body: "明确哪个法律主体、哪栋厂房在范围内，以及适用哪种标准（你的自有清单、ISO 9001、BSCI、SMETA 或 SA8000）。访厂前把要查的内容告知供应商。",
        },
        {
          title: "预约合格审核员",
          body: "选择熟悉你产品类目（电子、服装、机械）且具备相关市场认证经验的机构，确认能到达现场并安排档期。",
        },
        {
          title: "看报告而非只看结论",
          body: "有价值的报告含未修音的现场实拍照片、视频，以及按严重度分级的不符合项清单，而非简单的通过或不通过。按严重度读发现项。",
        },
        {
          title: "按发现项行动",
          body: "下批订单发货前先关闭关键发现项；要求带责任人和期限的整改计划，并复审确认。",
        },
      ],
      examples: [
        {
          title: "识破贸易公司",
          body: "展会上看着实力雄厚的的大型制造商，实地审核发现只是几人贸易公司；对真实生产现场的验厂让买家避开了转包骗局。",
        },
        {
          title: "刺破产能泡沫",
          body: "供应商承诺月产10万件，审核员数到3台旧机器、人数远少于宣称，买家于是把订单拆分到两家工厂。",
        },
      ],
      checklist: [
        "范围与标准已和供应商约定",
        "审核员熟悉你的产品类目",
        "已安排实地访厂，而非仅桌面审核",
        "报告含未修音照片与分级发现项",
        "关键发现项有整改计划",
        "若有未结发现项已计划复审",
      ],
      faq: [
        {
          q: "验厂和验货是一回事吗？",
          a: "不是。验厂评估现场与体系（能否把产品做好且合规），验货查已完成的批次。两者都要：验厂审工厂，验货审 shipment。",
        },
        {
          q: "验厂能多快完成？",
          a: "靠谱机构通常能在48小时内安排实地审核，并在访厂后24小时内出具详细报告，具体取决于地点和范围。",
        },
        {
          q: "什么样的报告可信？",
          a: "含未修音现场照片与视频、分级发现项清单，且审核员与交易独立。一句无证据的通过不是报告。",
        },
        {
          q: "小额试单也需要验厂吗？",
          a: "低值低风险试单可先做桌面（文件）审核；首次大单或高安全产品（医疗、母婴、电子）再上完整实地验厂。",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B 验厂服务", note: "我们如何在亚洲范围内界定、执行并报告验厂。" },
        { name: "ISO 9001 质量管理体系", note: "验厂中质量体系部分的常见基线。" },
      ],
    },
  },
  {
    slug: "supplier-evaluation-checklist",
    category: "verification",
    titleEn: "Supplier Evaluation Checklist 2026: Cut B2B Sourcing Risk",
    titleZh: "2026供应商评估清单(Checklist)：全面降低B2B采购风险",
    metaDescEn:
      "A 2026 supplier evaluation checklist covering legality, capacity, quality system, ESG and documentation, with the records auditors ask for at each step.",
    metaDescZh:
      "2026版供应商评估清单，覆盖资质合法性、产能、质量体系、ESG 与文件，列出每个环节审核员会索取的记录。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [{ href: "/services/supplier-verification" }, { href: "/services/china-supplier-verification" }],
    related: ["supplier-risk-assessment-guide", "factory-audit-checklist", "what-is-a-factory-audit"],
    en: {
      quickAnswer:
        "A supplier evaluation checklist scores a candidate across legality, production capacity, quality system, ESG basics and documentation. In 2026, with compliance and transparency demands rising, the checklist must cover beneficial ownership, recent audit evidence and subcontracting disclosure, not just certificates.",
      definition:
        "A supplier evaluation checklist is a standardized set of items used to judge whether a supplier is safe to order from. Unlike a risk score, the checklist is the evidence list: for each item, the buyer collects a document or observation that confirms or contradicts the supplier's claim.",
      keyPoints: [
        "Legality first: a valid business licence, matching registered and operating addresses, and the right import/export and industry permits.",
        "Capacity second: machine count, model, age and maintenance records; workforce and QC ratios; whether the line is actually running your product.",
        "Quality system in practice: incoming (IQC), in-process (IPQC) and outgoing (OQC) records, non-conformance handling, and recent calibration certificates.",
        "ESG basics: fire safety, wage and hour compliance with local law, and no child or forced labour.",
        "2026 additions: beneficial ownership, the most recent audit report on file, and a written statement of any subcontracting.",
      ],
      steps: [
        {
          title: "Legality and identity",
          body: "Verify the business licence, registered capital versus actual scale, registered versus operating address, and import/export and industry permits.",
        },
        {
          title: "Production and capacity",
          body: "Collect machine inventory with model and age, maintenance logs, headcount and engineer/QC ratios, and evidence the line is currently producing your type of product.",
        },
        {
          title: "Quality management",
          body: "Request IQC, IPQC and OQC records, non-conformance logs, and calibration certificates dated within the last year.",
        },
        {
          title: "ESG and compliance",
          body: "Check fire safety, wage and hour records against local law, and confirm no child or forced labour through interviews and documents.",
        },
        {
          title: "Consolidate into a decision",
          body: "Map each checklist item to found or missing evidence, then decide: proceed, request documents, audit, or walk away.",
        },
      ],
      examples: [
        {
          title: "Address mismatch",
          body: "A supplier's registered address was an office while production ran at a different site; asking for the production address in writing resolved a recurring dispute before any deposit.",
        },
        {
          title: "Missing calibration",
          body: "An otherwise strong supplier had no recent torque-driver calibration; the buyer required recalibration and a recheck of the last batch before shipping.",
        },
      ],
      checklist: [
        "Business licence valid and matches the contracting entity",
        "Registered and operating addresses reconciled",
        "Import/export and industry permits present",
        "Machine inventory with age and maintenance logs",
        "IQC / IPQC / OQC records available",
        "Recent calibration certificates (within 12 months)",
        "Fire safety and wage/hour compliance evidenced",
        "Subcontracting disclosed in writing",
      ],
      faq: [
        {
          q: "Checklist or risk score, which first?",
          a: "Use the checklist to collect evidence, then feed it into a risk score. The checklist is the input; the score is the output.",
        },
        {
          q: "What changed for 2026?",
          a: "Buyers now expect beneficial-ownership clarity, a recent audit report on file, and explicit subcontracting disclosure, on top of the classic licence and quality checks.",
        },
        {
          q: "Can I do this without flying out?",
          a: "A desk review covers legality and documents; an on-site audit confirms the floor. Many buyers combine a low-cost desk check with a targeted on-site audit.",
        },
        {
          q: "How many suppliers should I evaluate?",
          a: "Screen a wide pool on the desk, then audit the top two or three on-site before committing a large order.",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B verification checklist tool", note: "A structured template that maps each item to the evidence to collect." },
        { name: "ISO 9001 documentation requirements", note: "The quality-records baseline auditors expect to see." },
      ],
    },
    zh: {
      quickAnswer:
        "供应商评估清单从资质合法性、产能、质量体系、ESG 基础和文件五个维度给候选供应商打分。2026年合规与透明度要求提高，清单必须覆盖实益所有人、近期审核证据和转包披露，而不只是证书。",
      definition:
        "供应商评估清单是用于判断供应商是否值得下单的一套标准化条目。与风险分数不同，清单是证据清单：每一项都对应一份能证实或推翻供应商说法的文件或观察。",
      keyPoints: [
        "资质优先：有效营业执照、注册地与经营地一致、具备进出口与相关行业许可。",
        "产能次之：设备数量、型号、使用年限与维护记录；人数与工程师/QC 比例；产线是否真在跑你的产品。",
        "质量体系看执行：进料(IQC)、制程(IPQC)、出货(OQC)记录，不合格品处理，以及近期的校准证书。",
        "ESG 基础：消防安全、工资工时符合当地法律、无童工或强迫劳动。",
        "2026新增：实益所有人、在档的最近一次审核报告、以及书面的转包声明。",
      ],
      steps: [
        {
          title: "资质与身份",
          body: "核实营业执照、注册资本与实际规模是否匹配、注册地与经营地是否一致、以及进出口与相关行业许可。",
        },
        {
          title: "生产与产能",
          body: "收集设备清单（含型号与年限）、维护日志、人数与工程师/QC 比例，并取证产线当前在生产你这类产品。",
        },
        {
          title: "质量管理",
          body: "索取 IQC、IPQC、OQC 记录、不合格品日志，以及近一年内的校准证书。",
        },
        {
          title: "ESG 与合规",
          body: "核对消防安全、工资工时记录是否符合当地法律，并通过访谈与文件确认无童工或强迫劳动。",
        },
        {
          title: "汇总成决策",
          body: "把每个清单项映射到已找到或缺失的证据，再决定：直接推进、补文件、验厂，还是放弃。",
        },
      ],
      examples: [
        {
          title: "地址不符",
          body: "某供应商注册地是办公室，生产却在另一处；书面要来生产地址，在付定金前化解了反复出现的纠纷。",
        },
        {
          title: "校准缺失",
          body: "一家本不错的供应商没有近期扭矩扳手校准记录；买家要求重新校准并对上批产品全检后才发货。",
        },
      ],
      checklist: [
        "营业执照有效且与签约主体一致",
        "注册地与经营地已核对",
        "具备进出口与相关行业许可",
        "设备清单含年限与维护日志",
        "IQC / IPQC / OQC 记录可查",
        "近期校准证书（12个月内）",
        "消防安全与工资工时已举证",
        "转包已书面披露",
      ],
      faq: [
        {
          q: "先用清单还是先打分？",
          a: "先用清单收集证据，再喂给风险评分。清单是输入，分数是输出。",
        },
        {
          q: "2026年有什么变化？",
          a: "买家现在期望看清实益所有人、在档的近期审核报告，并明确披露转包，叠加传统的执照与质量检查。",
        },
        {
          q: "不飞过去能做吗？",
          a: "桌面审核覆盖资质与文件；实地审核确认现场。很多买家把低成本的桌面检查与有针对性的实地审核结合。",
        },
        {
          q: "该评估多少家供应商？",
          a: "先用桌面广筛，再对前两三名家做实地审核，然后才下大单。",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B 供应商核验清单工具", note: "把每项映射到应收集证据的结构化模板。" },
        { name: "ISO 9001 文件要求", note: "审核员期望看到的质量记录基线。" },
      ],
    },
  },
  {
    slug: "on-site-vs-desk-audit",
    category: "audit",
    titleEn: "On-Site vs Desk Audit: Which Supplier Check Should You Use?",
    titleZh: "工厂实地审核 vs 线上文件审核：B2B采购该怎么选？",
    metaDescEn:
      "On-site versus desk (virtual) supplier audit: the trade-offs, when each works, and a combined approach that screens wide then audits deep.",
    metaDescZh:
      "实地审核与桌面（线上）审核的取舍、各自适用场景，以及先广筛再深挖的组合策略。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/audit-checklist" },
    ],
    services: [{ href: "/factory-audit/request" }, { href: "/services/china-factory-audit" }],
    related: ["what-is-a-factory-audit", "factory-audit-checklist", "capacity-audit-guide"],
    en: {
      quickAnswer:
        "A desk audit verifies documents and databases remotely and is cheap and fast, good for early screening. An on-site audit sends an inspector to the floor and is the only way to confirm real capacity, conditions and ownership. Most buyers combine them: desk-screen 20 candidates, then on-site-audit the top 3.",
      definition:
        "A desk audit (or virtual audit) checks a supplier through submitted documents, business databases and interviews without a site visit. An on-site audit places an independent inspector at the factory to walk the floor, interview workers and count equipment. They answer different questions and are not substitutes.",
      keyPoints: [
        "Desk audit: low cost, hours to 1-2 days, but cannot confirm real production capability or spot a shell site.",
        "On-site audit: sees what documents hide, catches a dirty floor, untrained operators or a subcontracted shell.",
        "Documents can be forged or expired, so desk results are a screen, not a verdict.",
        "On-site costs a few hundred dollars and needs 1-2 weeks lead time, but it is the lock-in step for a large order.",
        "Combine: desk-screen the pool, then on-site-audit the shortlist.",
      ],
      steps: [
        {
          title: "Start with a desk audit",
          body: "Collect the business licence, tax registration, ISO certificates and bank statements, then cross-check against public business databases to shortlist candidates.",
        },
        {
          title: "Flag the must-audit cases",
          body: "Send any high-value, strategic or high-safety (medical, infant, electronics) supplier to an on-site audit regardless of desk result.",
        },
        {
          title: "Schedule the on-site visit",
          body: "Book an independent inspector 1-2 weeks out; confirm access to the floor, not just the showroom.",
        },
        {
          title: "Reconcile the two",
          body: "If the desk file and the floor disagree, trust the floor. Investigate the gap before placing the order.",
        },
      ],
      examples: [
        {
          title: "Cheap screen, expensive miss",
          body: "A desk-clean supplier later failed on-site when the inspector found the factory was a showroom with production at an unlisted subcontractor.",
        },
        {
          title: "Combined win",
          body: "A buyer desk-screened 20 suppliers, on-site-audited the top 3, and found the best partner was not the one with the glossiest documents.",
        },
      ],
      checklist: [
        "Desk: licence, tax, ISO, bank statements checked",
        "Desk: public database cross-check done",
        "On-site: floor walk, not showroom only",
        "On-site: worker interviews off the floor",
        "On-site: equipment counted and condition noted",
        "Both: results reconciled before ordering",
      ],
      faq: [
        {
          q: "Can a desk audit replace an on-site audit?",
          a: "No. It can remove obvious risks early, but it cannot confirm the floor, the machines or the workers. Use it as a screen, not a substitute.",
        },
        {
          q: "When is on-site mandatory?",
          a: "First large order, a strategic OEM partner, or any product with safety exposure (medical, infant, electronics) should always get an on-site audit.",
        },
        {
          q: "How much does on-site cost and how long?",
          a: "Typically a few hundred dollars with 1-2 weeks lead time, versus hours to days for a desk audit.",
        },
        {
          q: "What if desk and on-site disagree?",
          a: "Trust the floor. A mismatch usually means the documents were incomplete or the site was not the one that will make your product.",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B document checker", note: "A tool that structures a desk audit from the documents suppliers provide." },
        { name: "FactoryAuditB2B on-site audit", note: "How we scope and report a floor-level audit." },
      ],
    },
    zh: {
      quickAnswer:
        "桌面审核远程核验文件与数据库，便宜又快，适合早期初筛。实地审核派审核员下车间，是确认真实产能、现场状况与所有权的唯一方式。多数买家组合使用：桌面筛20家，再实地审前3家。",
      definition:
        "桌面（线上）审核不访厂，靠提交的文件、商业数据库和访谈核查供应商。实地审核派独立审核员到工厂走车间、访谈工人、清点设备。两者回答不同问题，不能互相替代。",
      keyPoints: [
        "桌面审核：成本低，几小时到1-2天，但无法确认真实产能，也发现不了空壳现场。",
        "实地审核：能看到文件看不到的问题——脏乱的车间、不规范的工人、转包的空壳。",
        "文件可能伪造或过期，所以桌面结果只是初筛，不是结论。",
        "实地审核花几百美元、需提前1-2周预约，但它是大单锁定的关键一步。",
        "组合：桌面广筛候选，再对短名单实地审核。",
      ],
      steps: [
        {
          title: "先做桌面审核",
          body: "收集营业执照、税务登记、ISO 证书和银行流水，再与公开企业数据库交叉核对，筛出候选。",
        },
        {
          title: "标记必须实地审的",
          body: "任何高价值、战略级或高安全（医疗、母婴、电子）供应商，无论桌面结果如何都送实地审核。",
        },
        {
          title: "预约实地访厂",
          body: "提前1-2周预约独立审核员；确认能进车间，而不只是样品间。",
        },
        {
          title: "核对两者",
          body: "若桌面文件与现场不符，以现场为准；下单前查清缺口。",
        },
      ],
      examples: [
        {
          title: "便宜初筛，昂贵漏判",
          body: "一家桌面干净的供应商后来实地失败：审核员发现工厂只是样品间，生产在未被列出的转包方处。",
        },
        {
          title: "组合取胜",
          body: "某买家桌面筛20家、实地审前3家，发现最佳伙伴并非文件最光鲜的那家。",
        },
      ],
      checklist: [
        "桌面：执照、税务、ISO、银行流水已查",
        "桌面：公开数据库交叉核对已做",
        "实地：走车间而非只看样品间",
        "实地：脱离现场的工人访谈",
        "实地：设备已清点并记录状态",
        "两者：下单前结果已核对",
      ],
      faq: [
        {
          q: "桌面审核能替代实地吗？",
          a: "不能。它能早期排除明显风险，但确认不了车间、设备和工人。把它当初筛，不是替代。",
        },
        {
          q: "何时必须实地？",
          a: "首次大单、战略 OEM 伙伴、或任何有安全暴露的产品（医疗、母婴、电子）都应实地审核。",
        },
        {
          q: "实地多少钱、多久？",
          a: "通常几百美元、提前1-2周；桌面则几小时到几天。",
        },
        {
          q: "两者不符怎么办？",
          a: "以现场为准。不一致通常说明文件不完整，或现场并非生产你产品的那家。",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B 文件核查工具", note: "用供应商提供的文件结构化桌面审核的工具。" },
        { name: "FactoryAuditB2B 实地验厂", note: "我们如何界定与报告车间级审核。" },
      ],
    },
  },
  {
    slug: "third-party-audit-pain-points",
    category: "risk",
    titleEn: "Supply Chain Risk: What a Third-Party Factory Audit Actually Fixes",
    titleZh: "供应链风控必看：专业的第三方验厂能为你解决哪些痛点？",
    metaDescEn:
      "How a professional third-party factory audit solves the three biggest sourcing pains: fake factories, unstable quality and missed delivery dates.",
    metaDescZh:
      "专业第三方验厂如何解决采购三大痛点：供应商造假、质量不稳、交期延误。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-verification-checklist" },
    ],
    services: [{ href: "/factory-audit/request" }, { href: "/services/supplier-improvement" }],
    related: ["supplier-risk-assessment-guide", "factory-audit-checklist", "what-is-a-factory-audit"],
    en: {
      quickAnswer:
        "A third-party factory audit directly attacks three sourcing pains: suppliers who are actually trading companies, samples that beat the bulk, and delivery dates that slip. An independent auditor confirms the real site, the real quality system and the real capacity before you pay.",
      definition:
        "Many B2B buyers lose money not to bad luck but to blind trust. A professional factory audit is the control that turns the supplier said into the auditor observed, closing the gaps where profit and reputation leak out of the supply chain.",
      keyPoints: [
        "Fake or layered suppliers: a manufacturer that is really a tiny trader who subcontracts to a poor workshop.",
        "Schrodinger quality: perfect samples, defective bulk, because there is no real quality system.",
        "Delivery roulette: shipping next week becomes a standing excuse and you miss the season.",
        "The audit observes, it does not negotiate: findings are graded evidence, not opinions.",
        "A few hundred dollars of audit can prevent tens of thousands in claims and penalties.",
      ],
      steps: [
        {
          title: "Expose the real entity",
          body: "The auditor checks the actual address, signboard and production-line ownership, and counts workers and lines, puncturing the middleman's story.",
        },
        {
          title: "Check the quality system, not the sample",
          body: "Review IQC and IPQC, test equipment and SOPs to confirm good quality is managed, not luck.",
        },
        {
          title: "Measure real capacity",
          body: "Assess true capacity ceiling, current order backlog and key-machine status to warn of delivery risk before you commit.",
        },
        {
          title: "Get a corrective plan",
          body: "Turn findings into owners and dates, then re-audit to confirm the fix, not just the promise.",
        },
      ],
      examples: [
        {
          title: "Subcontractor behind the logo",
          body: "A large manufacturer collected a deposit then subcontracted to a small workshop; an audit of the real site protected the buyer.",
        },
        {
          title: "Capacity mismatch",
          body: "Promised monthly output far exceeded the line's real ceiling; the audit flagged delivery risk and the buyer split the order.",
        },
      ],
      checklist: [
        "Real site and production-line ownership confirmed",
        "IQC / IPQC and SOPs reviewed",
        "Equipment and calibration status checked",
        "True capacity ceiling and backlog assessed",
        "Findings graded with a corrective plan",
        "Re-audit scheduled for open items",
      ],
      faq: [
        {
          q: "Will an audit stop a supplier from lying?",
          a: "It makes lying observable. When the floor contradicts the claim, you decide before paying, not after.",
        },
        {
          q: "Is it worth it for a small order?",
          a: "For low-value, low-risk orders a desk review may suffice; reserve a full audit for orders where a failure is expensive.",
        },
        {
          q: "What does an audit cost versus the risk?",
          a: "A few hundred dollars typically, against potential claims and penalties in the tens of thousands.",
        },
        {
          q: "Does the audit fix quality by itself?",
          a: "No. It surfaces the gaps; the supplier fixes them. You verify the fix with a re-audit.",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B risk calculator", note: "Estimate the cost of a sourcing failure before you order." },
        { name: "FactoryAuditB2B audit service", note: "How we turn observed findings into a corrective plan." },
      ],
    },
    zh: {
      quickAnswer:
        "第三方验厂直接打击三大采购痛点：实为贸易公司的供应商、样板好大货差的薛定谔质量、以及一拖再拖的交期。独立审核员在你付款前确认真实的现场、真实的质量体系和真实的产能。",
      definition:
        "很多 B2B 企业吃亏不是因为运气差，而是盲目信任。专业验厂是把供应商说变成审核员观察到的控制手段，堵住利润和声誉从供应链漏出的缺口。",
      keyPoints: [
        "造假或层层转包：看似制造商，其实是为小作坊转包的微型贸易商。",
        "薛定谔质量：样板完美、大货残次，因为根本没有真正的质管体系。",
        "交期轮盘：下周一定发货成了口头禅，你错过销售季。",
        "审核员只观察不谈判：发现项是有分级的证据，不是意见。",
        "几百美元验厂，可能挽回数万美元的索赔与违约金。",
      ],
      steps: [
        {
          title: "拆穿真实主体",
          body: "审核员核对实际地址、厂牌与产线所有权，并清点工人与产线，戳破中间商话术。",
        },
        {
          title: "查体系而非样板",
          body: "审阅 IQC、IPQC、检测设备与 SOP，确认好质量是被管出来的，而非碰运气。",
        },
        {
          title: "测算真实产能",
          body: "评估真实产能上限、当前订单积压与核心设备状态，在下单前预警交期风险。",
        },
        {
          title: "拿到整改计划",
          body: "把发现项转为责任人与期限，并复审确认整改已完成，而非只承诺。",
        },
      ],
      examples: [
        {
          title: "招牌后的转包方",
          body: "某大型制造商收定金后把订单转包小作坊；对真实现场的验厂保护了买家。",
        },
        {
          title: "产能错配",
          body: "承诺的月产远超产线真实上限；验厂标出交期风险，买家拆分了订单。",
        },
      ],
      checklist: [
        "真实现场与产线所有权已确认",
        "IQC / IPQC 与 SOP 已审阅",
        "设备与校准状态已查",
        "真实产能上限与积压已评估",
        "发现项已分级并附整改计划",
        "未结项已安排复审",
      ],
      faq: [
        {
          q: "验厂能阻止供应商撒谎吗？",
          a: "它让谎言可被观察。当现场与说法矛盾，你在付款前就能决定，而不是之后。",
        },
        {
          q: "小单也值得做吗？",
          a: "低值低风险单做桌面审核即可；把完整验厂留给失败代价高的订单。",
        },
        {
          q: "验厂成本 vs 风险？",
          a: "通常几百美元，对应可能数万美元的索赔与违约金。",
        },
        {
          q: "验厂自己能改善质量吗？",
          a: "不能。它暴露缺口，由供应商修复，你用复审确认。",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B 风险计算器", note: "下单前估算采购失败的代价。" },
        { name: "FactoryAuditB2B 验厂服务", note: "我们如何把观察到的发现项转为整改计划。" },
      ],
    },
  },
  {
    slug: "capacity-audit-guide",
    category: "audit",
    titleEn: "Capacity Audit: How to Prevent Supplier Delivery Delays",
    titleZh: "产能审核(Capacity Audit)全解析：如何从源头避免交期延误？",
    metaDescEn:
      "What a capacity audit checks, why sales promises and certificates do not prove capacity, and the data that predicts whether your order will ship on time.",
    metaDescZh:
      "产能审核查什么、为什么销售承诺和证书都不能代表产能，以及能预测订单能否准时发货的关键数据。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
    ],
    services: [{ href: "/factory-audit/request" }, { href: "/services/china-factory-audit" }],
    related: ["factory-audit-checklist", "on-site-vs-desk-audit", "supplier-evaluation-checklist"],
    en: {
      quickAnswer:
        "A capacity audit confirms how many good units a factory can reliably produce in a period, by counting machines, labour and bottlenecks rather than trusting the sales pitch. It predicts delivery risk before you commit a large order.",
      definition:
        "A capacity audit is the branch of a factory audit that does not ask whether the factory can make your product, but how many it can make steadily. The auditor calculates the real daily and monthly capacity from cycle times, machine load and staffing, not from the brochure.",
      keyPoints: [
        "Certificates prove management discipline, not machine count; a quality certificate does not mean high capacity.",
        "Salespeople routinely overstate capacity to win the order; only the floor tells the truth.",
        "Bottleneck sets the limit: the slowest process defines real daily output, not the fastest.",
        "Temporary labour swings capacity, so the skilled-to-temp ratio matters.",
        "If your order takes over 80 percent of stated capacity, delay is almost certain because the factory serves other clients too.",
      ],
      steps: [
        {
          title: "Count key machines",
          body: "List core machines (injection moulders, CNC, lines) with daily standard output per machine and standby equipment for failures.",
        },
        {
          title: "Assess labour",
          body: "Record actual headcount, and the skilled-to-temporary ratio; a high temp ratio signals unstable capacity.",
        },
        {
          title: "Find the bottleneck",
          body: "Identify the slowest process in the line; that process, not the average, sets the real daily ceiling.",
        },
        {
          title: "Check material and scheduling",
          body: "Confirm raw-material stock and supplier stability, and review the current order backlog to see if your slot is real.",
        },
      ],
      examples: [
        {
          title: "80 percent trap",
          body: "A buyer's order consumed 85 percent of stated capacity; with other clients queued, the factory missed the ship window. A capacity audit would have flagged it.",
        },
        {
          title: "Hidden bottleneck",
          body: "Two fast lines fed one slow curing step; the real daily output was half the sales claim. The audit reported the curing step as the limit.",
        },
      ],
      checklist: [
        "Key machines counted with per-machine output",
        "Standby equipment identified",
        "Headcount and skilled/temp ratio recorded",
        "Bottleneck process located",
        "Raw-material stock and supplier stability checked",
        "Current backlog and your real slot reviewed",
      ],
      faq: [
        {
          q: "Does a quality certificate prove capacity?",
          a: "No. ISO proves the system is managed; it says nothing about how many machines are running. Capacity needs a floor check.",
        },
        {
          q: "What is the single best predictor of delay?",
          a: "Your order's share of the factory's real capacity. Above roughly 80 percent, delay risk rises sharply because the plant also serves others.",
        },
        {
          q: "How is real capacity calculated?",
          a: "From cycle time per unit at the bottleneck, times machine count and effective shifts, minus downtime, not from the sales estimate.",
        },
        {
          q: "When should I order a capacity audit?",
          a: "Before any large or time-sensitive order, especially for seasonal goods where a missed window means lost sales.",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B capacity audit", note: "How we measure real, not claimed, production capacity." },
        { name: "FactoryAuditB2B risk calculator", note: "Translate capacity findings into delivery-risk terms." },
      ],
    },
    zh: {
      quickAnswer:
        "产能审核通过清点机器、人力和瓶颈工序，确认工厂在一段时间内能稳定产出多少合格品，而非相信销售话术。它让你下大单前预判交期风险。",
      definition:
        "产能审核是验厂的一个分支，不问工厂能不能做你的产品，而问能稳定做多少。审核员用节拍时间、设备负荷与人员配置算出真实的日产能与月产能，而非看宣传册。",
      keyPoints: [
        "证书证明管理规范，不代表机器数量；质量证书不等于高产能。",
        "销售为拿单常夸大产能；只有车间说真话。",
        "瓶颈决定上限：最慢的工序定义真实日产出，而非最快的。",
        "临时工比例波动产能，所以熟练工与临时工之比很关键。",
        "若你的订单占宣称产能 80% 以上，交期几乎必然延误，因为工厂还要服务其他客户。",
      ],
      steps: [
        {
          title: "清点核心设备",
          body: "列出核心机器（注塑机、CNC、产线），含每台每日标准产出，以及应对故障的备用设备。",
        },
        {
          title: "评估人力",
          body: "记录实际到岗人数，以及熟练工与临时工之比；临时工占比高意味着产能不稳。",
        },
        {
          title: "找瓶颈",
          body: "定位产线最慢的工序；决定真实日上限的是它，不是平均值。",
        },
        {
          title: "查物料与排期",
          body: "确认原料库存与上游稳定性，并看当前订单积压，判断你的档期是否真实。",
        },
      ],
      examples: [
        {
          title: "80%陷阱",
          body: "买家订单占宣称产能 85%，其他客户排队，工厂错过船期。产能审核本可提前标出。",
        },
        {
          title: "隐藏瓶颈",
          body: "两条快线喂一条慢固化工序，真实日产只有销售宣称的一半；审核把固化工序报为上限。",
        },
      ],
      checklist: [
        "核心设备已清点并含单机产出",
        "已识别备用设备",
        "已记录人数与熟练/临时工比",
        "已定位瓶颈工序",
        "已查原料库存与供应商稳定性",
        "已看当前积压与你的真实档期",
      ],
      faq: [
        {
          q: "质量证书能证明产能吗？",
          a: "不能。ISO 证明体系受管理，不说有多少机器在跑。产能需要实地核查。",
        },
        {
          q: "预测延误最好的单一指标？",
          a: "你的订单占工厂真实产能的比例。超过约80%，因工厂还服务他人，延误风险急升。",
        },
        {
          q: "真实产能怎么算？",
          a: "瓶颈处单件节拍 × 机器数 × 有效班次，减去停机，而非销售估算。",
        },
        {
          q: "何时该做产能审核？",
          a: "任何大单或有时效的订单之前，尤其是季节性商品，错过窗口等于丢销售。",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B 产能审核", note: "我们如何测量真实而非宣称的产能。" },
        { name: "FactoryAuditB2B 风险计算器", note: "把产能发现翻译成交期风险语言。" },
      ],
    },
  },
  {
    slug: "aql-sampling-standard-fri",
    category: "audit",
    titleEn: "How to Read the AQL Sampling Standard: A Pre-Shipment Inspection (FRI) Guide",
    titleZh: "AQL抽样标准怎么看？出货前检验(FRI)必备指南",
    metaDescEn: "A practical guide to reading the AQL sampling standard for pre-shipment inspection (FRI): defect classes, the two-table method, how to read Ac and Re, and how to set AQL by product type.",
    metaDescZh: "出货前检验(FRI)的AQL抽样标准实用指南：缺陷分级、两张表查法、如何看接收数Ac与拒收数Re，以及按产品类型设定AQL。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/services/supplier-improvement" },
    ],
    related: ["pre-shipment-inspection-checklist", "ppi-vs-dupro-inspection", "failed-inspection-dispute"],
    en: {
      quickAnswer: "AQL (Acceptable Quality Limit) is the worst defect rate a buyer is willing to accept in a random sample. In a Final Random Inspection (FRI), an inspector draws a random sample based on lot size and inspection level, then accepts or rejects the lot using Ac (accept) and Re (reject) numbers from the AQL table.",
      definition: "Pre-shipment inspection, usually called FRI (Final Random Inspection), is carried out when production is 100% complete and at least 80% of the goods are packed. The inspector then checks a random sample against an AQL plan. AQL itself defines the maximum number of defects acceptable within a given sample size. It is expressed as a percentage or fraction per hundred units, not as a guarantee that the rest of the lot is perfect.",
      keyPoints: [
        "Defects are graded in three classes: critical (usually 0), major (commonly 1.5 or 2.5) and minor (commonly 4.0).",
        "Most inspections use General Inspection Level II by default; the level sets how large the sample is, not how strict the limit is.",
        "Reading AQL uses two tables: a sample-size code letter table, then a single-sampling plan table that gives the sample size and the Ac/Re numbers.",
        "Ac/Re means accept/reject. If defects found are at or below Ac the lot passes; at or above Re it is rejected.",
        "Do not blindly demand zero defects. For low-cost consumer goods AQL 2.5/4.0 is industry norm; for high-precision electronics tighten to 1.0/2.5.",
      ],
      steps: [
        { title: "Find the sample-size code letter", body: "Take your total order quantity and the inspection level (Level II by default) to the first AQL table and read off the code letter. For example, a lot of 5,000 units at Level II maps to code letter L." },
        { title: "Read the sample size from the second table", body: "Move to the single-sampling plan table with code letter L and read the sample size, for example 200 units to be inspected." },
        { title: "Set the AQL and read Ac and Re", body: "Pick your AQL for each defect class, then read across to the Ac (accept) and Re (reject) numbers. At AQL 2.5 the Ac/Re might be 10/11, meaning up to 10 major defects in the sample passes the lot and 11 or more rejects it." },
        { title: "Sample randomly across the batch", body: "The inspector must draw units from different pallets and from the top, middle and bottom of different cartons. Never let the factory choose which cartons are opened." },
        { title: "Combine sampling with functional tests", body: "Beyond appearance, require on-site functional tests such as drop tests, pull tests or power-on tests. These findings are often more decisive than cosmetic defects." },
      ],
      examples: [
        { title: "5,000 units at AQL 2.5", body: "Lot of 5,000, Level II, code letter L, sample 200. For major defects at AQL 2.5 the Ac/Re is 10/11. The inspector finds 9 major defects, the lot passes; a tenth would still pass, an eleventh rejects the whole batch." },
        { title: "Cheap promotional goods", body: "A buyer of low-cost promotional items set AQL 2.5 major and 4.0 minor. Accepting a small defect rate kept inspection cost sensible while still catching systemic failures." },
        { title: "High-value electronics", body: "For a consumer-electronics line the same buyer tightened to AQL 1.0 major and 2.5 minor, because a single functional failure in the field cost more than a larger sample." },
      ],
      checklist: [
        "Lot size and inspection level (Level II default) confirmed",
        "Sample-size code letter read from Table 1",
        "Sample size read from Table 2",
        "AQL values set per defect class",
        "Ac and Re numbers read for each AQL",
        "Random sampling across pallets and carton top/middle/bottom",
        "Functional tests (drop, pull, power-on) included",
        "FRI timing confirmed: 100% produced, at least 80% packed",
        "Inspection result recorded with photos and defect counts",
      ],
      faq: [
        { q: "What exactly is AQL?", a: "AQL stands for Acceptable Quality Limit. It is the worst defect rate a buyer will accept in the sampled portion of a lot. It is a sampling benchmark, not a promise about the unopened units." },
        { q: "Which inspection level should I use?", a: "General Inspection Level II is the industry default and is sufficient for most orders. Level I uses a smaller sample for lower risk; Level III uses a larger sample for higher risk or tighter assurance." },
        { q: "Why not specify zero defects?", a: "A zero-AQL plan forces a near-100% sample and is rarely cost-effective. AQL 2.5/4.0 already controls the defects that matter for most consumer goods; reserve tighter limits for safety or high-value items." },
        { q: "Can AQL be used for safety-critical products?", a: "For hazardous or regulated products the critical-defect limit is normally 0 regardless of AQL, and additional certification or full inspection is usually required." },
      ],
      sources: [
        { name: "ANSI/ASQ Z1.4 and ISO 2859-1 sampling standards", note: "The reference sampling plans behind AQL tables used worldwide for incoming and final inspection." },
        { name: "FactoryAuditB2B inspection services", note: "On-site FRI and AQL-based sampling carried out by local inspectors with photo-documented reports." },
      ],
    },
    zh: {
      quickAnswer: "AQL（可接受质量限）是买家在随机样本中能容忍的最差缺陷率。出货前检验(FRI)中，检验员按订单数量与检验水平抽取随机样本，再用 AQL 表上的接收数(Ac)与拒收数(Re)判定整批合格或拒收。",
      definition: "出货前检验(FRI, Final Random Inspection)在货物 100% 生产完成、且至少 80% 已包装入箱时进行，检验员按 AQL 方案抽查随机样本。AQL 本身定义了在给定样本量下可接受的最大缺陷数量，以每百件中的百分比或分数表示，它不是一个「其余都是良品」的保证。",
      keyPoints: [
        "缺陷分为三级：致命缺陷（通常 0）、主要缺陷（常用 1.5 或 2.5）、次要缺陷（常用 4.0）。",
        "多数检验默认采用一般检验水平 II；它决定样本大小，而非判定松紧。",
        "看 AQL 要用两张表：先查样本量字码表，再查单次抽样计划表得到样本量与 Ac/Re。",
        "Ac/Re 即接收数/拒收数：缺陷数≤Ac 整批通过，≥Re 整批拒收。",
        "不要盲目追求零缺陷。低价消费品 AQL 2.5/4.0 是行业惯例；高精密电子应收紧到 1.0/2.5。",
      ],
      steps: [
        { title: "查样本量字码", body: "用订单总数量与检验水平（默认 II 级）在第一张表中查出字母代码。例如 5000 件、II 级对应字码 L。" },
        { title: "查抽样数量", body: "拿字码 L 到第二张单次抽样计划表，读出抽样数量，例如抽 200 件。" },
        { title: "设定 AQL 并读 Ac/Re", body: "为各缺陷等级选定 AQL，再横向读出接收数 Ac 与拒收数 Re。若 AQL 2.5 下 Ac/Re 为 10/11，则在抽出的 200 件中，主要缺陷≤10 整批通过，≥11 整批拒收。" },
        { title: "跨整批随机抽样", body: "检验员必须从不同栈板、不同纸箱的顶部、中部、底部抽取，严禁由工厂指定纸箱。" },
        { title: "抽样结合功能测试", body: "外观之外，必须现场进行跌落、拉力或通电等功能性测试，这些发现往往比单纯外观瑕疵更具决定性。" },
      ],
      examples: [
        { title: "5000 件、AQL 2.5", body: "批次 5000、II 级、字码 L、抽样 200。主要缺陷 AQL 2.5 的 Ac/Re 为 10/11：发现 9 个主要缺陷整批通过，第 11 个才拒收整批。" },
        { title: "廉价促销品", body: "某买家对低价促销品设定 AQL 2.5/4.0，既控制了系统性故障，又把验货成本保持在合理水平。" },
        { title: "高价值电子", body: "同一买家对消费电子线收紧到 AQL 1.0/2.5，因为一次现场失效的售后成本远高于多抽的样本。" },
      ],
      checklist: [
        "确认订单数量与检验水平（默认 II 级）",
        "从表一读出样本量字码",
        "从表二读出抽样数量",
        "已按缺陷等级设定 AQL",
        "已读出各 AQL 的 Ac 与 Re",
        "跨栈板与纸箱顶/中/底随机抽样",
        "已包含功能测试（跌落、拉力、通电）",
        "已确认 FRI 时机：100% 完工、至少 80% 已装箱",
        "检验结果附照片与缺陷计数记录",
      ],
      faq: [
        { q: "AQL 到底是什么？", a: "AQL 即可接受质量限，是买家在抽样部分能接受的最差缺陷率。它是抽样基准，不是对未开箱部分的承诺。" },
        { q: "该用哪个检验水平？", a: "一般检验水平 II 是行业默认，适用于多数订单。I 级样本更小、适合低风险；III 级样本更大、适合高风险或更高保证。" },
        { q: "为什么不指定零缺陷？", a: "零 AQL 方案会逼出接近 100% 的抽样，极少划算。AQL 2.5/4.0 已能控制多数消费品的关键缺陷，仅在安全或高价值品上收紧。" },
        { q: "安全相关产品能用 AQL 吗？", a: "对危险或受管制产品，致命缺陷限通常无论 AQL 一律为 0，且通常需要额外认证或全检。" },
      ],
      sources: [
        { name: "ANSI/ASQ Z1.4 与 ISO 2859-1 抽样标准", note: "全球出货与来料检验 AQL 表的底层抽样方案来源。" },
        { name: "FactoryAuditB2B 验货服务", note: "本地检验员执行的 FRI 与 AQL 抽样，附照片留证报告。" },
      ],
    },
  },
  {
    slug: "ppi-vs-dupro-inspection",
    category: "audit",
    titleEn: "PPI vs DUPRO: Which Production Inspection Matters More?",
    titleZh: "生产初期检验(PPI) vs 生产中期检验(DUPRO)：哪个更重要？",
    metaDescEn: "PPI (pre-production) and DUPRO (during-production) inspections move quality control earlier than final inspection. This guide compares timing, focus and cost, and explains why DUPRO usually offers the best value.",
    metaDescZh: "生产初期检验(PPI)与生产中期检验(DUPRO)把质量控制前移到终检之前。本指南对比时机、重点与成本，并说明为何 DUPRO 通常性价比更高。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/services/supplier-improvement" },
    ],
    related: ["aql-sampling-standard-fri", "pre-shipment-inspection-checklist", "full-inspection-100-percent"],
    en: {
      quickAnswer: "PPI (pre-production inspection) checks materials and setup before mass production; DUPRO (during-production inspection) checks the line once 20% to 80% is done. If you can only fund one, DUPRO usually delivers more value because it catches systemic line problems while there is still time to fix them.",
      definition: "Production inspection splits quality control across the manufacturing cycle instead of betting everything on a final random inspection. PPI takes place at 0% to 10% completion, focused on materials, calibration and the golden sample. DUPRO takes place at 20% to 80% completion, when the line is running and early defects have started to surface.",
      keyPoints: [
        "PPI controls material and setup risk before large-scale work begins.",
        "DUPRO catches line-level systemic defects and predicts the delivery date while there is still time to correct them.",
        "The later a defect is found, the more expensive it is to fix; both inspections move the finding earlier than FRI.",
        "If budget allows only one early checkpoint, DUPRO is usually the better choice.",
        "First-time suppliers, complex processes and tight deadlines are the strongest cases for DUPRO.",
      ],
      steps: [
        { title: "Trigger PPI before mass production", body: "For costly or special materials, past material-substitution problems, or brand-new product lines, inspect at 0% to 10%: raw materials, machine calibration, the golden sample and the production schedule." },
        { title: "Trigger DUPRO during the run", body: "Once 20% to 80% is produced, inspect finished and semi-finished output, confirm the process follows the agreed workflow, check packaging and labels, and estimate the final delivery date." },
        { title: "Compare the two checkpoints", body: "PPI answers whether you are starting right (materials, setup). DUPRO answers whether the line is actually producing good product and will ship on time (process stability, schedule)." },
        { title: "Act on the DUPRO window", body: "Because DUPRO still leaves time before shipment, use it to stop wrong operations, rework what is already wrong, and correct how the remaining units are made." },
      ],
      examples: [
        { title: "Wrong material caught by PPI", body: "A supplier substituted a cheaper alloy in the first batch. PPI at 5% caught it before 10,000 units were made, saving a full rework." },
        { title: "Line drift caught by DUPRO", body: "A toy line's weld strength dropped after a shift change. DUPRO at 45% found it, the process was reset, and the last 55% shipped clean." },
        { title: "Schedule slip predicted", body: "DUPRO showed the bottleneck station was behind by a week; the buyer rebooked the container instead of discovering the delay at the port." },
      ],
      checklist: [
        "PPI scheduled for 0% to 10% completion where risk is high",
        "Raw materials and components checked against spec",
        "Machine calibration verified at PPI",
        "Golden sample confirmed at PPI",
        "DUPRO scheduled for 20% to 80% completion",
        "Semi-finished and finished units checked at DUPRO",
        "Process compliance and packaging/labels checked at DUPRO",
        "Final delivery date estimated from DUPRO findings",
      ],
      faq: [
        { q: "Which is more important, PPI or DUPRO?", a: "If you can only choose one, DUPRO usually wins. PPI controls material and setup risk but cannot predict line or fatigue problems; DUPRO sits in the sweet spot where enough product exists to judge quality and there is still time to fix it." },
        { q: "When is PPI worth it on its own?", a: "When materials are expensive or special, when a supplier has a history of substitution, or for a brand-new product line where getting the start wrong is very costly." },
        { q: "Does DUPRO replace final inspection?", a: "No. DUPRO reduces risk mid-run, but a final random inspection (FRI) is still recommended to confirm the finished, packed lot." },
      ],
      sources: [
        { name: "FactoryAuditB2B production inspection", note: "PPI and DUPRO carried out by local inspectors across the manufacturing cycle." },
        { name: "ANSI/ASQ Z1.4 sampling for in-process checks", note: "Sampling plans applied to during-production lots." },
      ],
    },
    zh: {
      quickAnswer: "PPI（生产初期检验）在大货前核查材料与设备；DUPRO（生产中期检验）在完成 20%–80% 时核查产线。若只够预算做一项，DUPRO 通常价值更高——它能在仍有时间修正时揪出产线系统性问题。",
      definition: "生产检验把质量控制分布到制造周期中，而不是把赌注全押在最终抽检。PPI 在 0%–10% 完工时进行，聚焦原材料、设备校准与首件样；DUPRO 在 20%–80% 完工时进行，此时产线已全速运转、早期缺陷开始暴露。",
      keyPoints: [
        "PPI 在大规模生产前控制材料与设备风险。",
        "DUPRO 在仍有时间修正时，揪出产线系统性缺陷并预估交期。",
        "缺陷发现越晚修复越贵，两项检验都比终检更靠前。",
        "若预算只够一个前置节点，DUPRO 通常更优。",
        "首次合作、工序复杂、交期紧张，是 DUPRO 最强场景。",
      ],
      steps: [
        { title: "大货前触发 PPI", body: "对昂贵或特殊材料、曾有以次充好历史、或全新产品线，在 0%–10% 时检验：原材料、设备校准、首件样与生产排期。" },
        { title: "生产中触发 DUPRO", body: "完成 20%–80% 时，检验半成品与成品、确认工艺按约定执行、核查包装与标签，并预估最终交期。" },
        { title: "对比两个节点", body: "PPI 回答「是否起手正确」（材料、设置）；DUPRO 回答「产线是否真在产出良品、能否准时交」（稳定性、排期）。" },
        { title: "抓住 DUPRO 窗口", body: "DUPRO 距发货仍有时间，用它叫停错误操作、返工已错部分、修正剩余产品的生产方式。" },
      ],
      examples: [
        { title: "PPI 抓出用错料", body: "供应商在首批用更便宜的合金替代。PPI 在 5% 时抓到，避免 1 万件全部返工。" },
        { title: "DUPRO 抓出产线漂移", body: "某玩具线换班后焊点强度下降，DUPRO 在 45% 时发现，工艺重置后后 55% 干净出货。" },
        { title: "提前预判延误", body: "DUPRO 显示瓶颈工位落后一周，买家改订柜而非到港才发现延误。" },
      ],
      checklist: [
        "高风险时在 0%–10% 排 PPI",
        "原材料与零部件按规格核查",
        "PPI 时核实设备校准",
        "PPI 时确认首件样",
        "20%–80% 排 DUPRO",
        "DUPRO 查半成品与成品",
        "DUPRO 查工艺合规与包装标签",
        "依 DUPRO 发现预估最终交期",
      ],
      faq: [
        { q: "PPI 和 DUPRO 哪个更重要？", a: "只选一项时 DUPRO 通常胜出。PPI 控材料与设置风险，却预测不了产线或疲劳问题；DUPRO 正处于「已产足够量判断质量、仍有时间修正」的甜点区。" },
        { q: "PPI 什么情况下值得单独做？", a: "材料昂贵或特殊、供应商有以次充好前科、或全新产品线——起手做错代价极高时。" },
        { q: "DUPRO 能替代终检吗？", a: "不能。DUPRO 降低生产过程中风险，但成品装箱后仍建议做最终随机检验(FRI)确认。" },
      ],
      sources: [
        { name: "FactoryAuditB2B 生产检验", note: "本地检验员在制造周期内执行的 PPI 与 DUPRO。" },
        { name: "ANSI/ASQ Z1.4 在制品抽样", note: "应用于生产中期批次的抽样方案。" },
      ],
    },
  },
  {
    slug: "full-inspection-100-percent",
    category: "audit",
    titleEn: "Why Cross-Border Buyers Use 100% Full Inspection",
    titleZh: "为什么跨国采购一定要做全检？避免退货率飙升的关键",
    metaDescEn: "Why 100% full inspection is replacing AQL sampling for cross-border, high-value and high-compliance goods, and when the extra cost is worth it.",
    metaDescZh: "为何全检(100% Inspection)正在取代 AQL 抽样，成为跨境、高价值与高合规货物的标配，以及何时这笔额外成本值得花。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/audit-checklist" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/services/supplier-improvement" },
    ],
    related: ["aql-sampling-standard-fri", "ppi-vs-dupro-inspection", "fba-rejection-inspection"],
    en: {
      quickAnswer: "AQL sampling accepts a known percentage of defects, but in cross-border trade a return costs many times a local one. 100% full inspection examines every unit and is worth it for high-value goods, strict-compliance markets, trial orders and assembly or blind-box products where a missing part makes the item useless.",
      definition: "Full inspection, or 100% inspection, means checking every single unit in a lot for appearance, function or performance and removing all defective pieces. It is becoming the default for cross-border e-commerce, premium manufacturing and luxury goods, where a single defect reaching the end customer carries a cost far beyond the product price.",
      keyPoints: [
        "AQL sampling's hidden cost is that you accept a defect rate; cross-border returns multiply that cost by logistics, duties, overseas warehousing and platform penalties.",
        "Full inspection can push return rates close to zero by intercepting defects at the port of loading.",
        "It protects brand reputation and platform account health, where defect-rate red lines can suspend a seller.",
        "It forces suppliers to self-check upstream, because no defect escapes unnoticed.",
        "Use it for high-value items, strict-compliance markets, trial orders and products with multiple high-value parts.",
      ],
      steps: [
        { title: "Decide where full inspection pays off", body: "Apply 100% inspection to high unit-value goods, strictly regulated markets (infant, medical, food-contact), trial orders with a new supplier, and assembly or blind-box products where a missing part makes the item unusable." },
        { title: "Define the check scope", body: "Specify appearance, function and performance tests for every unit, plus any market-specific checks such as FBA compliance for Amazon-bound goods." },
        { title: "Separate pass and fail at the line", body: "Have the inspector or a dedicated sorting line split good and defective units in real time so defective pieces never reach the carton." },
        { title: "Use it as a supplier signal", body: "A full-inspection result tells you the supplier's true process capability on the first order and sets the baseline for future cooperation." },
      ],
      examples: [
        { title: "Consumer electronics", body: "A single dead-on-arrival unit triggered a return, a negative review and an account-metric hit. Full inspection at the factory cost less than one such incident." },
        { title: "Infant product", body: "For a product in a strictly regulated category, any safety defect meant recall and penalty exposure; 100% functional testing was the only acceptable control." },
        { title: "Assembly kit", body: "A multi-part kit with one missing component was unsellable. Full inspection caught missing parts before shipping." },
      ],
      checklist: [
        "High-value, regulated, trial or multi-part order identified",
        "Per-unit appearance, function and performance checks defined",
        "Market-specific checks (for example FBA compliance) included",
        "Pass/fail separation built into the line",
        "Defective units removed before carton packing",
        "Result used to baseline supplier capability",
      ],
      faq: [
        { q: "Is full inspection always better than sampling?", a: "No. It costs more and is unnecessary for low-value, low-risk, stable repeat orders. It earns its cost when a single defect's downstream cost is high." },
        { q: "When is full inspection clearly worth it?", a: "High unit value, strict-compliance markets, first orders with a new supplier, and products with multiple high-value parts where a miss makes the item useless." },
        { q: "Does full inspection guarantee zero defects?", a: "It reduces defects to near zero for the checked attributes, but it depends on the check definition and inspector discipline. A clear scope and real-time pass/fail separation matter most." },
      ],
      sources: [
        { name: "FactoryAuditB2B full inspection", note: "100% appearance, function and performance sorting carried out at the factory before shipment." },
        { name: "Platform defect-rate policies (for example Amazon ODR)", note: "Order-defect-rate red lines that make pre-shipment defect control a business survival issue." },
      ],
    },
    zh: {
      quickAnswer: "AQL 抽样默认接受一定比例的不良，但跨国贸易中一次退货的成本是本地市场的数倍。全检(100% Inspection)逐件检查每一件，对高价值、高合规、试产订单以及缺件即报废的组装/盲盒产品值得做。",
      definition: "全检即对批次中每一件产品逐一做外观、功能或性能检查，挑出所有不良品。它正成为跨境电商、高端制造与奢侈品的默认做法——一件缺陷品抵达终端客户的成本，远高于产品本身价格。",
      keyPoints: [
        "AQL 抽样的隐性代价是「接受一定比例不良」，跨国退货会把这成本乘以物流、关税、海外仓与平台惩罚。",
        "全检在起运港拦截缺陷，可将退货率压到趋近于零。",
        "它保护品牌声誉与平台账号健康——缺陷率红线可令卖家被封。",
        "它倒逼供应商前端自检，因为没有瑕疵能逃过。",
        "高价值、高合规市场、试产订单、多高值配件产品都应全检。",
      ],
      steps: [
        { title: "判断全检值得的场景", body: "对高客单价、严格合规市场（婴童、医疗、食品接触）、与新供应商的试产订单，以及缺件即报废的组装/盲盒产品，采用 100% 全检。" },
        { title: "界定检查范围", body: "逐件规定外观、功能与性能测试，并加入市场特定检查（如亚马逊货物的 FBA 合规）。" },
        { title: "产线实时分良次品", body: "让检验员或专门挑选线实时分离良品与不良品，使不良品永不上箱。" },
        { title: "把全检当作供应商信号", body: "全检结果能告诉你供应商首单的真实工艺水平，并为后续合作设定基线。" },
      ],
      examples: [
        { title: "消费电子", body: "一台到手即坏的机器引发退货、差评与账号指标下滑。出厂全检的成本低于一次此类事故。" },
        { title: "婴童产品", body: "严格管制品类任何安全缺陷都意味着召回与罚款风险，100% 功能测试是唯一可接受的控制。" },
        { title: "组装套件", body: "多配件套件少装一个即无法使用，全检在发货前抓出缺件。" },
      ],
      checklist: [
        "已识别高价值/合规/试产/多配件订单",
        "已定义逐件外观、功能、性能检查",
        "已含市场特定检查（如 FBA 合规）",
        "产线已建良次品分离",
        "不良品在装箱前已剔除",
        "结果已用于供应商能力基线",
      ],
      faq: [
        { q: "全检一定优于抽样吗？", a: "不一定。它成本更高，对低价值、低风险、稳定复购订单并无必要。当单件缺陷的下游成本很高时，它才物有所值。" },
        { q: "何时全检明显值得？", a: "高客单价、严格合规市场、与新供应商的首单，以及多高值配件缺件即报废的产品。" },
        { q: "全检能保证零缺陷吗？", a: "对受检项它能把缺陷压到趋近于零，但取决于检查界定与检验纪律。清晰的范围与实时良次品分离最关键。" },
      ],
      sources: [
        { name: "FactoryAuditB2B 全检", note: "出厂前对每一件做外观、功能与性能挑选。" },
        { name: "平台缺陷率政策（如亚马逊 ODR）", note: "订单缺陷率红线，使发货前缺陷控制成为生存问题。" },
      ],
    },
  },
  {
    slug: "fba-rejection-inspection",
    category: "audit",
    titleEn: "Control Amazon FBA Rejection Risk with Inspection",
    titleZh: "B2B跨境电商卖家必备：如何通过验货控制亚马逊FBA拒收风险？",
    metaDescEn: "How to build FBA inbound compliance into your inspection process: the most common rejection triggers, and a four-step checklist covering labels, drop tests, weighing and inner packaging.",
    metaDescZh: "如何把 FBA 入仓合规植入验货流程：最常见的拒收雷区，以及覆盖标签、跌落测试、称重量与内部包装的四步清单。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/services/supplier-improvement" },
    ],
    related: ["aql-sampling-standard-fri", "full-inspection-100-percent", "failed-inspection-dispute"],
    en: {
      quickAnswer: "FBA rejects whole shipments for label, packaging, weight and carton problems. Build compliance into inspection: verify scannable FNSKU and FBA carton labels, run an ISTA 1A drop test, measure weight and dimensions on site, and confirm inner cushioning.",
      definition: "Amazon FBA has strict inbound standards. A single label error, an unmarked polybag, an overweight carton or a crushed box can get a shipment rejected, returned to overseas storage or destroyed, with extra cost and a stockout. Inspection must go beyond product quality to cover FBA inbound compliance.",
      keyPoints: [
        "Label issues are the most common and most fatal FBA rejection trigger: unscannable or wrong FNSKU, missing or damaged FBA carton labels, uncovered UPC.",
        "Packaging violations include polybags over 5 inches without a suffocation warning, and sets without a do-not-separate label.",
        "Overweight cartons over 50 lb need a team-lift label; oversized cartons over the length limit are rejected.",
        "Carton damage from poor boxing fails after long sea freight; use 5- or 7-layer corrugated where needed.",
        "Never trust the factory's packing list for weight and dimensions; measure on site.",
      ],
      steps: [
        { title: "Build an FBA-specific inspection checklist", body: "Ask the inspector to verify labels, not just product. Provide accurate PDF FNSKU and FBA carton labels, and require the inspector to scan barcodes with a reader on site and photograph the result." },
        { title: "Run an ISTA 1A drop test", body: "Simulate FBA handling with a 1-corner, 3-edge, 6-face drop test. If the inner pack or product is damaged, require thicker corrugated (5- or 7-layer) before shipping." },
        { title: "Weigh and measure on site", body: "The inspector must carry a tape and scale and measure random cartons. If a carton approaches the 50 lb limit, require repacking or a team-lift label immediately." },
        { title: "Review inner packaging experience", body: "FBA staff do not handle packages gently. Confirm enough cushioning (pearl cotton, bubble) and, for fragile items, a 2-foot free-fall pass so the end customer receives an intact product." },
      ],
      examples: [
        { title: "Unscannable FNSKU", body: "A shipment was rejected because the FNSKU printed too lightly to scan. Scan-testing at the factory would have caught it before the container left." },
        { title: "Overweight carton", body: "A carton hit 52 lb with no team-lift label; the receiving center refused it. On-site weighing would have triggered repacking." },
        { title: "Crushed box after sea freight", body: "Thin single-wall cartons collapsed in transit. Switching to 7-layer corrugated resolved it after the drop test failed." },
      ],
      checklist: [
        "FNSKU and FBA carton labels present, correct and scannable",
        "UPC barcodes covered where required",
        "Polybags over 5 inches carry a suffocation warning",
        "Sets labelled do-not-separate or sold-as-set",
        "Cartons under 50 lb or bearing a team-lift label",
        "Carton dimensions within FBA length limits",
        "ISTA 1A drop test passed",
        "On-site weight and dimension measured, not assumed",
        "Inner cushioning adequate for fragile items",
      ],
      faq: [
        { q: "What is the most common FBA rejection cause?", a: "Label problems: an unscannable or wrong FNSKU, a missing or damaged FBA carton label, or an uncovered UPC. They are cheap to fix at the factory and expensive to discover after arrival." },
        { q: "What is the 50 lb rule?", a: "A single carton over about 50 lb (22.5 kg) must carry a team-lift label, and very heavy cartons may need a mechanical-lift label. Overweight cartons without the label are rejected." },
        { q: "Is a product-quality pass enough for FBA?", a: "No. FBA rejection is usually about inbound compliance, not product defects. Labels, packaging, weight and carton condition must be inspected separately." },
      ],
      sources: [
        { name: "Amazon FBA inbound requirements", note: "The official label, packaging, weight and carton standards that drive rejection decisions." },
        { name: "ISTA 1A drop-test protocol", note: "The 1-corner, 3-edge, 6-face procedure used to validate shipping carton durability." },
      ],
    },
    zh: {
      quickAnswer: "FBA 会因标签、包装、重量与纸箱问题整批拒收。把合规植入验货：核验可扫描的 FNSKU 与 FBA 外箱标、做 ISTA 1A 跌落测试、现场实测重量尺寸、确认内部缓冲。",
      definition: "亚马逊 FBA 入仓标准极严。一个标签错误、未贴警示的塑料袋、超重纸箱或破损箱体，都可能让整批被拒收、退回海外仓甚至销毁，产生额外费用并导致断货。验货必须跳出产品质量，覆盖 FBA 入仓合规。",
      keyPoints: [
        "标签问题最常见也最致命：FNSKU 无法扫描或贴错、FBA 外箱标缺失/破损、原 UPC 未遮盖。",
        "包装违规含：大于 5 英寸塑料袋无防窒息警告、套装未贴「不可分开」标签。",
        "单箱超 50 磅需贴 Team Lift 标；超长边限制的外箱会被拒。",
        "劣质纸箱经长途海运后破损，必要时用 5 层或 7 层瓦楞。",
        "切勿轻信工厂装箱单的重量尺寸，必须现场实测。",
      ],
      steps: [
        { title: "定制 FBA 专项验货清单", body: "要求检验员不仅查产品，必须核对标签。提供准确的 PDF 版 FNSKU 与 FBA 外箱标，并要求现场用扫码枪实测条码可读性并拍照存档。" },
        { title: "执行 ISTA 1A 跌落测试", body: "按 1 角 3 边 6 面模拟 FBA 操作与配送。跌落後内包装或产品损坏，必须要求更换更厚瓦楞（5 层或 7 层）再发货。" },
        { title: "现场测重与量方", body: "检验员携带卷尺与电子秤，随机抽取外箱实测。一旦单箱逼近 50 磅红线，立刻要求重新分装或提前贴超重警示标。" },
        { title: "审查内部包装体验", body: "FBA 仓员工不会温柔对待包裹。确认有足够缓冲（珍珠棉、气泡膜）；易碎品须通过 2 英尺自由落体，确保最终客户收到完好。" },
      ],
      examples: [
        { title: "FNSKU 无法扫描", body: "一批因 FNSKU 打印过淡无法扫描被拒收。工厂端扫码实测本可在柜子离港前抓出。" },
        { title: "超重纸箱", body: "某箱 52 磅且无 Team Lift 标，收货中心拒收。现场称重本可触发重新分装。" },
        { title: "海运后箱体压溃", body: "单层薄纸箱运输中塌陷，跌落测试未过后改用 7 层瓦楞解决。" },
      ],
      checklist: [
        "FNSKU 与 FBA 外箱标齐全、正确且可扫描",
        "需遮盖处 UPC 已遮盖",
        "大于 5 英寸塑料袋带防窒息警告",
        "套装已贴「不可分开」标签",
        "纸箱低于 50 磅或已贴 Team Lift 标",
        "纸箱尺寸在 FBA 限长内",
        "已通过 ISTA 1A 跌落测试",
        "现场实测重量与尺寸，未凭装箱单假设",
        "易碎品内部缓冲充足",
      ],
      faq: [
        { q: "FBA 拒收最常见原因？", a: "标签问题：FNSKU 无法扫描或贴错、FBA 外箱标缺失/破损、UPC 未遮盖。工厂端修极便宜，到仓后发现极昂贵。" },
        { q: "50 磅规则是什么？", a: "单箱超过约 50 磅（22.5 公斤）须贴 Team Lift 标，更重的可能要 Mechanical Lift 标。无标的超重箱会被拒。" },
        { q: "产品质量合格就能进 FBA 吗？", a: "不能。FBA 拒收通常是入仓合规问题而非产品缺陷。标签、包装、重量与箱体状况必须单独验。" },
      ],
      sources: [
        { name: "亚马逊 FBA 入仓要求", note: "驱动拒收决策的官方标签、包装、重量与纸箱标准。" },
        { name: "ISTA 1A 跌落测试协议", note: "用于验证运输纸箱耐久性的 1 角 3 边 6 面程序。" },
      ],
    },
  },
  {
    slug: "failed-inspection-dispute",
    category: "audit",
    titleEn: "Failed Inspection? 5 Strategies to Negotiate with Your Supplier",
    titleZh: "产品检验不合格怎么办？与供应商谈判及处理纠纷的5个策略",
    metaDescEn: "A failed inspection report is the start of a negotiation, not the end of the order. Five strategies to sort defects, freeze payment, demand a corrective plan, allocate rework cost and re-rate the supplier.",
    metaDescZh: "一份不合格验货报告是谈判的开始而非订单的终结。五个策略：区分缺陷、冻结尾款、索要纠正计划、界定返工成本、重新评估供应商。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/audit-report-analyzer" },
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/services/supplier-improvement" },
    ],
    related: ["aql-sampling-standard-fri", "fba-rejection-inspection", "pre-shipment-inspection-checklist"],
    en: {
      quickAnswer: "A failed inspection is a negotiation. Stay calm, separate critical defects from cosmetic ones, freeze the balance pending a corrective action plan, define who pays for rework and re-inspection, and re-rate the supplier afterwards based on how they handled it.",
      definition: "When an inspection report comes back FAILED or REJECTED, the order is not dead. It is the opening of a commercial negotiation. How you handle it tests both your communication and the stability of your supply chain. The goal is to recover the order where possible while protecting your leverage.",
      keyPoints: [
        "A failed report is a negotiation, not a verdict; the order can usually be recovered.",
        "Hold the balance payment; leverage sits with the buyer until the goods pass.",
        "A corrective action plan (CAP) is the gate to any further negotiation.",
        "Rework, sorting and re-inspection costs are normally deducted from the supplier's payment.",
        "Re-rate the supplier afterwards; attitude and accountability decide whether they stay.",
      ],
      steps: [
        { title: "Dissect the report: core vs edge issues", body: "Before reacting, classify findings as critical, major or minor. Functional or safety defects are principled rejections. Minor cosmetic or marking issues can be accepted conditionally and used as leverage for a discount." },
        { title: "Freeze the balance and demand a CAP", body: "The rule is pay the balance only against a passed report. Tell the factory to stop shipment and require a formal corrective action plan within 48 hours answering what went wrong, how this lot is fixed, and how future orders avoid it." },
        { title: "Define rework or sorting and who pays", body: "For fixable defects, require 100% sorting or rework. Put in writing: rework duration, whether it risks the sailing, the re-inspection fee deducted from payment, and free replacement of any good parts damaged during rework." },
        { title: "Bring in third-party 100% sorting if trust breaks", body: "If the factory is passive or you distrust their self-sorting, hire a third-party QC to sort 100% at the factory. The bottom line: their travel and labour cost is borne by the factory and deducted from payment." },
        { title: "Re-rate the supplier and build a淘汰 mechanism", body: "After resolution, re-grade the supplier. Cooperative, accountable suppliers who paid re-inspection and met rework quality are worth developing. Arrogant or evasive ones should be phased out through a backup-supplier pipeline." },
      ],
      examples: [
        { title: "Cosmetic mark used as leverage", body: "A minor carton-mark error was accepted conditionally in exchange for a 3% discount on the balance, avoiding a full rework delay." },
        { title: "CAP forced a real fix", body: "A major functional defect came with a vague excuse. The CAP requirement forced root-cause analysis and a process change before the next lot." },
        { title: "Third-party sort saved the order", body: "With no confidence in self-sorting, a third-party 100% sort at factory cost recovered a large order without further defects reaching the customer." },
      ],
      checklist: [
        "Report findings classified critical/major/minor",
        "Critical or functional defects rejected on principle",
        "Balance payment frozen pending passed report",
        "Corrective action plan requested (48h) with root cause, fix and prevention",
        "Rework/sorting scope and timeline in writing",
        "Re-inspection fee agreed to be deducted from payment",
        "Damaged good parts to be replaced free by factory",
        "Third-party sorting option reserved if trust breaks",
        "Supplier re-rated after resolution",
      ],
      faq: [
        { q: "Does a failed inspection mean I lose the order?", a: "Not usually. It opens a negotiation. With the balance still in your hands, you have leverage to demand a fix, a discount or sorting before releasing payment." },
        { q: "Who pays for re-inspection?", a: "Industry practice is that the second or third inspection caused by an initial failure is deducted from the supplier's payment. Put it in writing before rework starts." },
        { q: "What if the supplier refuses to take responsibility?", a: "That is a strong signal to phase them out. Use a backup-supplier pipeline, and never let a supplier hold your tooling hostage as leverage over you." },
      ],
      sources: [
        { name: "FactoryAuditB2B inspection reports", note: "Graded findings and re-inspection support used as the evidence base for supplier negotiation." },
        { name: "Corrective action plan (CAP) practice", note: "The standard format suppliers use to answer root cause, immediate fix and prevention." },
      ],
    },
    zh: {
      quickAnswer: "检验不合格是谈判的开始而非订单的终结。保持冷静、区分致命缺陷与外观瑕疵、在纠正预防措施(CAP)前冻结尾款、界定返工与二次验货谁出钱，事后按供应商的配合度重新定级。",
      definition: "当验货报告回到 FAILED 或 REJECTED，订单并未死亡，而是一场商业博弈的开始。如何处理既考验沟通，也决定供应链稳定性。目标是在可能时挽回订单，同时守住你的主动权。",
      keyPoints: [
        "不合格报告是谈判而非判决，订单通常可挽回。",
        "冻结尾款，见到合格报告才付——钱在你手主动权就在。",
        "纠正预防措施(CAP)是继续谈判的门槛。",
        "返工、挑选与二次验货费用通常从供应商货款中扣除。",
        "事后重新定级供应商，态度与担责决定去留。",
      ],
      steps: [
        { title: "拆解报告：核心 vs 边缘问题", body: "发火前先区分缺陷为致命、主要或次要。功能缺失或安全隐患是原则性拒收；纸箱唛头印错、轻微划痕等通常不影响销售，可有条件接受并作为尾款折扣筹码。" },
        { title: "冻结尾款并要求 CAP", body: "铁律是「见合格验货报告付尾款」。告知工厂暂停发货，要求 48 小时内提交正式纠正预防措施(CAP)，回答三问：为何出错、这批怎么补救、未来如何避免。" },
        { title: "界定返工/挑选与成本归属", body: "可修复缺陷要求 100% 全检挑选或返工。书面敲定：返工天数、是否导致甩柜、二次验货费从尾款扣除、返工损坏的良品配件由工厂免费补。" },
        { title: "信任破裂时引入第三方全检", body: "若工厂返工消极或你不信其自挑结果，雇第三方 QC 驻厂 100% 全检。底线：差旅与工时费由工厂承担，从货款抵扣。" },
        { title: "重新定级并建立淘汰机制", body: "纠纷处理后重新定级。配合、担责、返工达标的供应商值得培养；傲慢推诿甚至扣模具相挟的，收货后启动备选库逐步淘汰。" },
      ],
      examples: [
        { title: "外观瑕疵作筹码", body: "一处轻微纸箱唛头错误被有条件接受，换取尾款 3% 折扣，避免整批返工延误。" },
        { title: "CAP 逼出真整改", body: "一个主要功能性缺陷伴含糊借口。CAP 要求逼出根因分析与工艺改变，才下下一单。" },
        { title: "第三方挑选救回订单", body: "对自挑毫无信心，第三方驻厂 100% 挑选以工厂费用挽回大单，不良品未到达客户。" },
      ],
      checklist: [
        "报告已按致命/主要/次要分级",
        "功能或安全隐患原则性拒收",
        "尾款已冻结，待合格报告支付",
        "已索要 CAP（48h），含根因、补救与预防",
        "返工/挑选范围与时限已书面化",
        "二次验货费已约定从货款扣除",
        "返工损坏良品由工厂免费补",
        "信任破裂时预留第三方挑选",
        "纠纷处理后已重新定级供应商",
      ],
      faq: [
        { q: "检验不合格就意味着丢单吗？", a: "通常不然。它开启谈判。尾款仍在你手，你有权在放行付款前要求整改、折扣或挑选。" },
        { q: "二次验货谁出钱？", a: "行业通例：因初次不通过导致的第二、三次验货费从供应商货款扣除。返工开始前书面写明。" },
        { q: "供应商拒不担责怎么办？", a: "这是应逐步淘汰的强信号。用备选供应商库，且绝不让供应商以扣押模具要挟你。" },
      ],
      sources: [
        { name: "FactoryAuditB2B 验货报告", note: "分级发现与二次验货支持，作为供应商谈判的证据基础。" },
        { name: "纠正预防措施(CAP)规范", note: "供应商回答根因、即时补救与预防的标准格式。" },
      ],
    },
  },
  {
    slug: "ethical-audit-mandatory-requirements",
    category: "compliance",
    titleEn: "Ethical Audit Mandatory Requirements: What Buyers Force Suppliers to Do",
    titleZh: "道德审核强制要求：采购方逼供应商做什么",
    metaDescEn:
      "What an ethical audit actually mandates: the labour, health-and-safety, environmental and management-system requirements buyers enforce, and the documents a supplier must produce to pass.",
    metaDescZh:
      "道德审核到底强制什么：采购方对劳工、健康安全、环境与管理体系的硬性要求，以及供应商必须提供的文件证据。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-verification-checklist" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/factory-audit/request" },
    ],
    related: ["smeta-vs-bsci-social-audit-comparison", "supplier-risk-assessment-guide", "factory-audit-checklist"],
    en: {
      quickAnswer:
        "An ethical audit mandates that a supplier meets baseline labour, health-and-safety, environmental and management requirements before it can be approved. Buyers enforce this through a code of conduct, on-site verification and document checks; the supplier must prove no child or forced labour, legal working hours, safe conditions, and a functioning complaint mechanism.",
      definition:
        "An ethical audit (also called a social compliance audit) is a structured assessment of whether a factory respects workers' rights and basic human-rights standards. It is driven by the buyer's code of conduct, which usually mirrors the ETI Base Code or SA8000 principles, and is verified on site against documents, interviews and physical inspection.",
      keyPoints: [
        "No child labour and no involuntary or forced labour are zero-tolerance items in every scheme.",
        "Working hours and wages must comply with local law and the code: legal overtime, paid leave, and no withholding of IDs or wages.",
        "Health and safety covers fire exits, structural safety, machine guarding, chemicals and emergency preparedness.",
        "Environmental basics: legal waste handling, no unauthorized discharges, and basic hazard controls.",
        "A confidential worker grievance mechanism and anti-discrimination, anti-harassment policy are now expected, not optional.",
        "Buyers usually require a signed code of conduct plus records, not just a clean site visit.",
      ],
      steps: [
        { title: "Adopt and sign the buyer's code of conduct", body: "The supplier must acknowledge the buyer's code in writing; many platforms auto-append it to the purchase order. This is the contractual baseline the audit measures against." },
        { title: "Prepare the document set", body: "Collect payroll, time cards, age verification, contracts, social insurance, fire drills, and environmental permits. Missing records are the most common cause of failing an ethical audit." },
        { title: "Run a self-assessment against the code", body: "Before the auditor arrives, walk the code line by line with the site manager and close obvious gaps: unguarded machines, blocked exits, undocumented workers." },
        { title: "Host the on-site audit", body: "The auditor reviews documents, tours the facility, and conducts private worker interviews. Keep production running so the visit reflects reality." },
        { title: "Close findings within the agreed window", body: "Major and critical findings require a corrective-action plan with dates. Buyers track this through the audit platform until verified closed." },
      ],
      examples: [
        { title: "Retailer onboarding gate", body: "A new apparel supplier could not ship until its ethical audit cleared child-labour and fire-safety items; it fixed blocked exits and added age records within 30 days." },
        { title: "Subcontractor discovery", body: "An audit found undeclared subcontracting and home workers, a critical finding. The buyer required full disclosure and re-audit before renewal." },
      ],
      checklist: [
        "Signed code of conduct on file",
        "No child or forced labour (age records verified)",
        "Legal working hours and overtime, wages paid in full",
        "Fire exits clear, drills documented, first-aid present",
        "Machine guarding and chemical controls in place",
        "Confidential grievance mechanism communicated to workers",
        "Anti-discrimination and anti-harassment policy posted",
        "Environmental permits and waste handling evidence",
        "Corrective-action plan with dates for any findings",
      ],
      faq: [
        { q: "Is an ethical audit the same as a quality audit?", a: "No. A quality audit checks the product and process capability; an ethical audit checks how workers are treated and whether the site respects basic rights and law. Both may run at the same factory but measure different things." },
        { q: "What is the single biggest fail reason?", a: "Missing or inconsistent records — payroll that does not match time cards, or workers without verified age files. Fix the paper trail first." },
        { q: "Can a small factory pass?", a: "Yes, if it meets the baseline. Size is not the issue; undocumented workers, safety gaps and excessive overtime are." },
      ],
      sources: [
        { name: "ETI Base Code", note: "The labour-rights standard most buyer codes are built on." },
        { name: "SA8000 standard", note: "A certifiable social-accountability standard covering the same baseline plus a management system." },
        { name: "FactoryAuditB2B ethical audit support", note: "On-site social compliance verification with document and interview evidence." },
      ],
    },
    zh: {
      quickAnswer:
        "道德审核要求供应商在通过核准前满足基本的劳工、健康安全、环境与管理体系要求。采购方通过行为准则、现场核查与文件检查来执行；供应商必须证明无童工与强迫劳动、工时工资合法、条件安全，并设有可用的投诉机制。",
      definition:
        "道德审核（也称社会责任合规审核）是对工厂是否尊重劳动者权利与基本人权标准的结构化评估。它由买家的行为准则驱动，准则通常对标 ETI 基本准则或 SA8000 原则，并在现场以文件、访谈与实地检查核实。",
      keyPoints: [
        "无童工、无强迫或 involuntary 劳动是所有体系的零容忍项。",
        "工时与工资须符合当地法律与准则：合法加班、带薪假，不扣押证件或工资。",
        "健康安全涵盖消防出口、结构安全、机械防护、化学品与应急准备。",
        "环境基本要求：合法废物处置、无违规排放、基本危害控制。",
        "保密的工人申诉机制与反歧视、反骚扰政策如今是必选项，而非可选项。",
        "买家通常要求签署行为准则加提供记录，而不只是一次干净的检查。",
      ],
      steps: [
        { title: "采纳并签署买家行为准则", body: "供应商须书面确认买家准则；许多平台会自动把它附在采购订单上。这是审核衡量的合同基线。" },
        { title: "准备文件包", body: "收集工资单、工时卡、年龄证明、合同、社保、消防演练与环境许可。缺记录是道德审核失败最常见的原因。" },
        { title: "按准则做自评", body: "审核员到场前，与厂区主管逐条对照准则并关闭明显缺口：无防护的机械、堵塞的出口、无记录的工人。" },
        { title: "接待现场审核", body: "审核员审阅文件、巡视厂区、进行私下工人访谈。保持生产运行，让访问反映真实情况。" },
        { title: "在约定期限内关闭发现项", body: "严重与致命发现项需带日期的纠偏计划。买家通过审核平台跟踪直至验证关闭。" },
      ],
      examples: [
        { title: "零售商准入门槛", body: "一家新服装供应商在道德审核清除童工与消防安全项前无法出货；它在 30 天内修好堵塞出口并补全年龄记录。" },
        { title: "发现未申报外发", body: "一次审核发现未申报的外发加工与家庭工，属致命发现项。买家要求完全披露并复审后才续约。" },
      ],
      checklist: [
        "行为准则已签署存档",
        "无童工或强迫劳动（年龄记录已核实）",
        "工时与加班合法、工资足额发放",
        "消防出口畅通、演练有记录、急救到位",
        "机械防护与化学品控制到位",
        "保密申诉机制已告知工人",
        "反歧视与反骚扰政策已张贴",
        "环境许可与废物处置证据",
        "任何发现项均带日期的纠偏计划",
      ],
      faq: [
        { q: "道德审核等同质量审核吗？", a: "不等。质量审核查产品与过程能力；道德审核查工人待遇及是否尊重基本权利与法律。两者可能在同一工厂进行，但衡量对象不同。" },
        { q: "失败最常见的原因是什么？", a: "缺记录或记录不一致——工资单与时卡对不上，或工人无核实的年龄档案。先补文件链。" },
        { q: "小工厂能过吗？", a: "能，只要达到基线。规模不是问题；无记录工人、安全缺口与过度加班才是。" },
      ],
      sources: [
        { name: "ETI 基本准则", note: "多数买家准则依托的劳工权利标准。" },
        { name: "SA8000 标准", note: "可认证的社会责任标准，覆盖同样基线并加管理体系。" },
        { name: "FactoryAuditB2B 道德审核支持", note: "带文件与访谈证据的现场社会责任合规核查。" },
      ],
    },
  },
  {
    slug: "sa8000-certification-guide",
    category: "compliance",
    titleEn: "SA8000 Certification: How Hard Is It and What It Really Takes",
    titleZh: "SA8000 认证：到底难在哪、要准备什么",
    metaDescEn:
      "A realistic look at SA8000 certification: what the standard demands, why it is harder than a one-off social audit, the time and system investment required, and whether it is worth it for your supply base.",
    metaDescZh:
      "务实看 SA8000 认证：标准要求什么、为何比一次性社会审核更难、所需时间与体系投入，以及对你的供应基是否值得。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-verification-checklist" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/factory-audit/request" },
    ],
    related: ["ethical-audit-mandatory-requirements", "smeta-vs-bsci-social-audit-comparison", "supplier-risk-assessment-guide"],
    en: {
      quickAnswer:
        "SA8000 is a certifiable social-accountability standard built on the same worker-rights baseline as other social audits, but it demands a documented management system, worker committees and annual surveillance — so it is harder and more sustained than a single SMETA or BSCI audit. Expect 6-12 months of preparation for a first certificate.",
      definition:
        "SA8000, managed by Social Accountability International (SAI), is a management-system standard for social accountability. Unlike an audit report that only snapshots a site, SA8000 requires the factory to embed the standard into policy, training, worker participation and continual improvement, then prove it through certification audits and yearly surveillance.",
      keyPoints: [
        "SA8000 covers child labour, forced labour, health and safety, freedom of association, discrimination, discipline, working hours, remuneration and management system.",
        "The management-system element is what makes it hard: documented procedures, worker-management committees, and training, not just a clean site.",
        "Certification requires a two-stage audit (documentary plus on-site) and then surveillance audits every year, with full re-certification on a cycle.",
        "It is voluntary and buyer-driven; few buyers mandate it, but it signals a deeper commitment than a one-off audit.",
        "First certificate typically takes 6-12 months of preparation; factories with weak records can take longer.",
      ],
      steps: [
        { title: "Gap assessment against the standard", body: "Map current practice to the nine SA8000 elements and list gaps in policy, records and worker participation. Most factories fail here on undocumented procedures." },
        { title: "Build the management system", body: "Write the social-performance policy, appoint a representative, form a worker-management committee, and roll out training. This is the heaviest lift and the main differentiator from a simple audit." },
        { title: "Collect and align evidence", body: "Payroll, contracts, age files, safety records and meeting minutes must be consistent and retrievable. Inconsistency defeats the system requirement." },
        { title: "Stage 1 and Stage 2 certification audit", body: "Stage 1 reviews documentation and readiness; Stage 2 verifies implementation on site with interviews. Both must pass before a certificate is issued." },
        { title: "Maintain through surveillance", body: "Annual surveillance audits check that the system is alive, not just documented. Treat it as an operating system, not a one-time project." },
      ],
      examples: [
        { title: "Toy exporter aiming at EU buyers", body: "A toy factory spent nine months building its committee and training before certification; the certificate later shortened several buyer onboarding reviews." },
        { title: "Subcontractor without records", body: "A facility with no HR files needed over a year to reach certifiable status; the management system, not the site conditions, was the bottleneck." },
      ],
      checklist: [
        "Gap assessment completed against all nine elements",
        "Written social-performance policy and nominated representative",
        "Worker-management committee established and meeting",
        "Training delivered and documented",
        "Consistent payroll, contracts, age and safety records",
        "Grievance mechanism active and used",
        "Stage 1 and Stage 2 audits passed",
        "Surveillance audit scheduled and budgeted annually",
      ],
      faq: [
        { q: "Is SA8000 harder than BSCI or SMETA?", a: "Yes for most factories, because it requires a sustained management system and yearly surveillance rather than a single audit event. The worker-rights checks themselves are similar." },
        { q: "How long to the first certificate?", a: "Commonly 6-12 months of genuine preparation. Factories starting from weak records or no committee take longer; treat the system build as the critical path." },
        { q: "Do I need SA8000 if my buyer accepts SMETA?", a: "Usually no. SA8000 is valuable when a buyer specifically requests it or when you want to differentiate on social accountability. For most, SMETA or BSCI satisfies the buyer's social audit." },
      ],
      sources: [
        { name: "Social Accountability International — SA8000", note: "The standard owner and certification requirements." },
        { name: "ETI Base Code", note: "The underlying worker-rights baseline shared with most social audits." },
        { name: "FactoryAuditB2B social audit support", note: "Gap assessment and on-site verification that feeds SA8000 preparation." },
      ],
    },
    zh: {
      quickAnswer:
        "SA8000 是可认证的社会责任标准，与多数社会审核基于同一套劳动者权利基线，但它要求成文的管理体系、工人委员会与年度监督，因此比一次性的 SMETA 或 BSCI 审核更难、更持续。首次获证通常需 6-12 个月准备。",
      definition:
        "SA8000 由社会责任国际(SAI)管理，是一项社会责任管理体系标准。与只给厂区拍快照的审核报告不同，SA8000 要求工厂把标准嵌入政策、培训、工人参与与持续改进，再通过认证审核与年度监督来证明。",
      keyPoints: [
        "SA8000 覆盖童工、强迫劳动、健康安全、结社自由、歧视、惩戒、工时、报酬与管理体系九项。",
        "成文的「管理体系」是难点：成文程序、工人-管理层委员会与培训，而非只是干净的现场。",
        "认证需两阶段审核（文件加现场），之后每年监督审核，并按周期完整再认证。",
        "它属自愿、由买家驱动；极少买家强制，但比一次性审核传递更深的承诺。",
        "首次获证通常需 6-12 个月准备；记录薄弱的工厂可能更久。",
      ],
      steps: [
        { title: "对照标准做差距评估", body: "把现状映射到 SA8000 九要素，列出政策、记录与工人参与上的缺口。多数工厂卡在无成文程序。" },
        { title: "建立管理体系", body: "撰写社会责任政策、任命代表、组建工人-管理层委员会并开展培训。这是最重的活，也是与简单审核的根本区别。" },
        { title: "收集并校准证据", body: "工资单、合同、年龄档案、安全记录与会议纪要必须一致且可取。不一致即破坏体系要求。" },
        { title: "第一阶段与第二阶段认证审核", body: "第一阶段审文件与就绪度；第二阶段现场核实实施并访谈。两者都通过才发证。" },
        { title: "靠监督维持", body: "年度监督审核检查体系是否活着，而不只是写在纸上。把它当运营系统，而非一次性项目。" },
      ],
      examples: [
        { title: "面向欧盟买家的玩具出口商", body: "一家玩具厂花九个月建委员会与培训才获证；该证书后来缩短了多个买家准入复核。" },
        { title: "无记录的外发厂", body: "一家无人事档案的工厂花了一年多才达可认证状态；瓶颈是管理体系，而非现场条件。" },
      ],
      checklist: [
        "已完成九要素差距评估",
        "已写社会责任政策并任命代表",
        "已建立工人-管理层委员会并开会",
        "已开展并留存培训记录",
        "工资、合同、年龄与安全记录一致",
        "申诉机制在运行且被使用",
        "第一阶段与第二阶段审核通过",
        "年度监督审核已排期并预算",
      ],
      faq: [
        { q: "SA8000 比 BSCI 或 SMETA 难吗？", a: "对多数工厂是，因为它要求持续的管理体系与年度监督，而非单一审核事件。劳动者权利检查本身相似。" },
        { q: "首次获证要多久？", a: "通常 6-12 个月真实准备。从薄弱记录或无委员会起步的工厂更久；把体系建设视为关键路径。" },
        { q: "买家接受 SMETA 还需要 SA8000 吗？", a: "通常不需要。当买家特别要求，或你想在社会责任上拉开差距时，SA8000 才有价值。多数情况下 SMETA 或 BSCI 已满足买家社审。" },
      ],
      sources: [
        { name: "社会责任国际 — SA8000", note: "标准所有者与认证要求。" },
        { name: "ETI 基本准则", note: "与多数社会审核共用的底层劳动者权利基线。" },
        { name: "FactoryAuditB2B 社会审核支持", note: "差距评估与现场核查，为 SA8000 准备打底。" },
      ],
    },
  },
  {
    slug: "esg-supplier-audit-guide",
    category: "compliance",
    titleEn: "ESG Supplier Audit: What It Covers Beyond Social Compliance",
    titleZh: "ESG 供应商审核：超出社会责任合规的部分",
    metaDescEn:
      "How an ESG supplier audit differs from a traditional social audit: the environmental, governance and traceability layers added on top of labour standards, and what buyers now expect from their supply chain.",
    metaDescZh:
      "ESG 供应商审核与传统社会审核有何不同：在劳工标准之上新增的环境、治理与可追溯层，以及买家现在对供应链的期望。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/services/supplier-improvement" },
    ],
    related: ["ethical-audit-mandatory-requirements", "smeta-vs-bsci-social-audit-comparison", "supplier-risk-assessment-guide"],
    en: {
      quickAnswer:
        "An ESG supplier audit adds environmental and governance scrutiny on top of the social (labour) checks of a traditional audit. Beyond no child labour and safe conditions, it examines carbon and energy use, waste and water, anti-corruption controls, traceability and whether the supplier can report data buyers now demand.",
      definition:
        "ESG stands for Environmental, Social and Governance. An ESG supplier audit evaluates a factory across all three pillars: the Social pillar overlaps with a standard ethical audit, while the Environmental and Governance pillars add new expectations around resource use, emissions, business integrity and supply-chain transparency.",
      keyPoints: [
        "The Social pillar is the familiar one: labour rights, health and safety, no forced or child labour.",
        "The Environmental pillar adds energy, carbon, water, waste and chemical management, often with quantified targets.",
        "The Governance pillar adds anti-corruption, conflicts of interest, subcontractor control and accurate record-keeping.",
        "Traceability and conflict-minerals or country-of-origin disclosure are increasingly required for the E and G pillars.",
        "Buyers increasingly want auditable data, not assurances — expect to report metrics, not just pass a visit.",
      ],
      steps: [
        { title: "Map the three pillars to your operation", body: "Start from the buyer's ESG questionnaire and align each question to a function: HR for Social, facilities for Environmental, finance and compliance for Governance." },
        { title: "Collect environmental data", body: "Meter energy and water, quantify waste streams and hazardous materials, and estimate carbon where the buyer requires it. Spreadsheets beat estimates when auditors ask for evidence." },
        { title: "Put governance controls in writing", body: "Document an anti-corruption policy, a gift and hospitality rule, subcontractor approval, and a whistle-blower channel. Governance fails most often on missing paperwork, not bad intent." },
        { title: "Build traceability", body: "Know where key materials come from and keep origin records; for electronics, conflict-minerals declarations are commonly requested." },
        { title: "Report against a framework", body: "Align disclosures to a recognized framework (such as GRI or the buyer's own template) so the data is comparable and auditable year over year." },
      ],
      examples: [
        { title: "Apparel brand scope-3 ask", body: "A buyer required per-factory energy and water data for its scope-3 reporting; suppliers that already metered output passed quickly, others spent a quarter installing meters." },
        { title: "Governance red flag", body: "An audit found no anti-corruption policy and undocumented related-party transactions, a governance finding that blocked onboarding until corrected." },
      ],
      checklist: [
        "Social baseline met (labour, safety, no forced/child labour)",
        "Energy and water measured and recorded",
        "Waste and hazardous-material handling documented",
        "Carbon or emissions data provided where required",
        "Anti-corruption and whistle-blower policy in place",
        "Subcontractor approval and control documented",
        "Material traceability and origin records kept",
        "Disclosures aligned to a reporting framework",
      ],
      faq: [
        { q: "Is an ESG audit just a social audit with a new name?", a: "Not quite. The Social part overlaps, but ESG adds Environmental metrics and Governance controls that a traditional social audit does not cover in depth." },
        { q: "Which pillar is hardest for factories?", a: "Environmental data is usually the weakest because few factories meter energy or water. Governance paperwork is the next common gap." },
        { q: "Do small suppliers need ESG audits?", a: "Larger buyers are pushing ESG down the chain, so even small suppliers feel it through buyer questionnaires. Start with the data buyers actually request rather than a full standard." },
      ],
      sources: [
        { name: "Global Reporting Initiative (GRI)", note: "A widely used ESG disclosure framework buyers reference." },
        { name: "ETI Base Code", note: "The Social pillar baseline shared with social audits." },
        { name: "FactoryAuditB2B ESG readiness support", note: "On-site verification of environmental and governance evidence." },
      ],
    },
    zh: {
      quickAnswer:
        "ESG 供应商审核在传统审核的社责（劳工）检查之上，增加了环境与治理审查。除了无童工与安全条件，它还审视碳与能耗、废弃物与用水、反腐控制、可追溯性，以及供应商能否报告买家现在要求的数据。",
      definition:
        "ESG 指环境、社会与治理。ESG 供应商审核从这三个支柱评估工厂：社会支柱与标准道德审核重叠，而环境与治理支柱新增了对资源使用、排放、商业诚信与供应链透明度的期望。",
      keyPoints: [
        "社会支柱最熟悉：劳工权利、健康安全、无强迫或童工。",
        "环境支柱新增能源、碳、水、废弃物与化学品管理，常带量化目标。",
        "治理支柱新增反腐、利益冲突、外发加工管控与准确记账。",
        "可追溯性与冲突矿产或原产国披露，正越来越成为 E 与 G 支柱的硬性要求。",
        "买家越来越要可审计的数据而非保证——准备交指标，而不只是过一次访问。",
      ],
      steps: [
        { title: "把三支柱映射到运营", body: "从买家的 ESG 问卷出发，把每个问题对应到职能：HR 管社会、设施管环境、财务与合规管治理。" },
        { title: "收集环境数据", body: "计量能源与用水、量化废物流与危化品，并在买家要求时估算碳。当审核员要证据时，表格比估算更有力。" },
        { title: "把治理控制写成文", body: "成文反腐政策、礼品与招待规则、外发审批与举报渠道。治理多半败在缺文件，而非恶意。" },
        { title: "建立可追溯", body: "清楚关键物料来源并保留原产地记录；对电子行业，冲突矿产声明常被要求。" },
        { title: "按框架报告", body: "把披露对齐公认框架（如 GRI 或买家自有模板），使数据可比较、可逐年审计。" },
      ],
      examples: [
        { title: "服装品牌的范畴三要求", body: "某买家要求每家工厂的能源与用水数据用于其范畴三报告；已装表的供应商很快通过，其余花了一个季度装表。" },
        { title: "治理红旗", body: "一次审核发现无反腐政策且无关联交易的书面记录，属治理发现项，整改前阻断准入。" },
      ],
      checklist: [
        "社会基线达标（劳工、安全、无强迫/童工）",
        "能源与用水已计量并记录",
        "废弃物与危化品处置已成文",
        "按要求提供碳或排放数据",
        "已设反腐与举报政策",
        "外发审批与管控已成文",
        "物料可追溯与原产地记录留存",
        "披露已对齐报告框架",
      ],
      faq: [
        { q: "ESG 审核只是改名的社责审核吗？", a: "不完全。社会部分重叠，但 ESG 新增了传统社责审核不深究的环境指标与治理控制。" },
        { q: "对工厂哪根支柱最难？", a: "环境数据通常最弱，因为很少工厂计量能源或用水。治理文书是次常见的缺口。" },
        { q: "小供应商需要 ESG 审核吗？", a: "大买家正把 ESG 沿链条下推，所以小供应商也会通过买家问卷感受到。先从买家真正要求的数据做起，而非整套标准。" },
      ],
      sources: [
        { name: "全球报告倡议组织(GRI)", note: "买家常引用的 ESG 披露框架。" },
        { name: "ETI 基本准则", note: "与社会审核共用的社会支柱基线。" },
        { name: "FactoryAuditB2B ESG 就绪支持", note: "环境与治理证据的现场核查。" },
      ],
    },
  },
  {
    slug: "brand-reputation-pr-crisis",
    category: "risk",
    titleEn: "Brand Reputation and PR Crisis: When a Supplier Scandal Hits Your Brand",
    titleZh: "品牌声誉与公关危机：供应商丑闻牵连品牌时怎么办",
    metaDescEn:
      "How a supplier's social or safety scandal becomes your brand crisis, the early-warning signals to watch, and a practical response playbook to protect reputation and keep the supply chain moving.",
    metaDescZh:
      "供应商的社会或安全丑闻如何变成你的品牌危机、要盯哪些预警信号，以及保护声誉又不中断供应链的实操应对手册。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/audit-checklist" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/services/supplier-improvement" },
    ],
    related: ["ethical-audit-mandatory-requirements", "supplier-risk-assessment-guide", "how-to-verify-a-chinese-supplier"],
    en: {
      quickAnswer:
        "When a supplier is exposed for labour abuse, pollution or safety failures, the brand that sourced from it is judged by association. Protect reputation by verifying before you buy, monitoring after, and having a response playbook: acknowledge fast, show evidence of action, and fix the root cause rather than hide it.",
      definition:
        "A brand-reputation crisis in sourcing happens when negative attention to a supplier's conduct transfers to the buyer's brand. Because consumers and media now trace products to their makers, a single unreported subcontractor incident can become a public-relations event for the brand that hired them.",
      keyPoints: [
        "Guilt by association is the mechanism: buyers are judged by the conduct of suppliers they chose, even subcontractors they did not know about.",
        "Most crises start small — a local news item, a worker post, an NGO report — and escalate through social media before the brand notices.",
        "Prevention beats apology: verified suppliers, published standards and routine monitoring cost far less than a crisis response.",
        "Speed and evidence win: acknowledge within hours, show the audit or corrective action, and avoid 'no comment'.",
        "Cutting the supplier outright is rarely the first move; fixing root cause while protecting workers is usually the stronger story.",
      ],
      steps: [
        { title: "Pre-qualify and publish your standard", body: "Only source from suppliers that passed a social audit, and publish your code of conduct so expectations are clear and visible." },
        { title: "Monitor continuously, not annually", body: "Watch supplier news, worker forums and NGO trackers between audits; a yearly audit alone leaves an 11-month blind spot." },
        { title: "Trigger the response playbook on first signal", body: "On any credible allegation, launch a fact-find within 24 hours: verify the site, scope the issue, and identify affected orders." },
        { title: "Communicate with evidence", body: "Acknowledge the issue, state what you are doing (audit, remediation, worker protection), and share verified findings. Silence reads as guilt." },
        { title: "Remediate and report closure", body: "Fix the root cause with the supplier, verify through re-audit, and publish the outcome. A resolved case with evidence rebuilds more trust than denial." },
      ],
      examples: [
        { title: "Subcontractor blind spot", body: "A brand was named in a report about a subcontractor it had never audited. Because it had a published standard and moved to audit within days, the story shifted from 'complicit' to 'responsive'." },
        { title: "Slow response backfire", body: "Another brand issued 'no comment' for a week; social media filled the gap with worst-case guesses, and the silence became the headline." },
      ],
      checklist: [
        "Suppliers pre-qualified by social audit",
        "Code of conduct published and shared",
        "Continuous monitoring between audits in place",
        "24-hour fact-find trigger defined",
        "Spokesperson and message approved in advance",
        "Evidence-based acknowledgement ready",
        "Remediation plan with worker protection",
        "Re-audit and public closure documented",
      ],
      faq: [
        { q: "Am I responsible for a subcontractor I didn't know about?", a: "Publicly and legally, buyers are increasingly held accountable for their supply chain, including unknown subcontractors. The defence is demonstrable oversight, not ignorance." },
        { q: "Should I drop the supplier immediately?", a: "Not usually as the first step. Abrupt cuts can abandon workers and look like cover-up. Investigate, protect workers, fix root cause, and decide on the relationship after evidence." },
        { q: "How fast must we respond?", a: "The first acknowledgement should come within hours of a credible allegation; a week of silence is itself a reputational hit. Prepare the playbook before, not during, a crisis." },
      ],
      sources: [
        { name: "ETI Base Code and buyer codes", note: "The conduct standard brands publish and enforce." },
        { name: "Modern slavery and supply-chain transparency laws", note: "Legal drivers that make oversight a duty, not a choice." },
        { name: "FactoryAuditB2B monitoring and re-audit", note: "Continuous verification and evidence for crisis response." },
      ],
    },
    zh: {
      quickAnswer:
        "当供应商因劳工虐待、污染或安全事故被曝光，向其采购的品牌会因关联而被评判。保护声誉的方法是在采购前核验、采购后监测，并备好应对手册：快速承认、出示行动证据、修复根因而非掩盖。",
      definition:
        "采购中的品牌声誉危机，指对供应商行为的负面关注转移到买家品牌身上。由于消费者与媒体如今能把产品追溯到制造者，一次未被上报的外发事故也能变成雇佣它的品牌的公关事件。",
      keyPoints: [
        "关联定罪是机制：买家会因所选供应商（甚至不知情的外发）的行为被评判。",
        "多数危机从小处起——一条地方新闻、工人发帖、NGO 报告——并在品牌察觉前经社媒升级。",
        "预防胜过道歉：已核验供应商、公开标准与例行监测，成本远低于危机应对。",
        "速度与证据制胜：数小时内承认、出示审核或纠偏、避免「不予置评」。",
        "直接砍掉供应商很少是第一步；边保护工人边修复根因，通常更站得住脚。",
      ],
      steps: [
        { title: "前置资质并公开标准", body: "只从通过社会审核的供应商采购，并公布行为准则，让期望清晰可见。" },
        { title: "持续监测而非一年一次", body: "在两次审核之间盯供应商新闻、工人论坛与 NGO 追踪器；仅靠年审会留下 11 个月盲区。" },
        { title: "首个信号即触发手册", body: "对任何可信指控，24 小时内启动事实核查：核实厂区、界定范围、识别受影响订单。" },
        { title: "用证据沟通", body: "承认问题、说明你在做什么（审核、整改、保护工人）、共享核实发现。沉默会被读作有罪。" },
        { title: "整改并公布闭环", body: "与供应商修复根因、经复审核实并公布结果。有证据的已结案例比否认更能重建信任。" },
      ],
      examples: [
        { title: "外发盲区", body: "某品牌因一家从未审核的外发商被报告点名。因其有公开标准并在数日内启动审核，叙事从「共谋」转为「响应迅速」。" },
        { title: "慢响应反噬", body: "另一品牌一周「不予置评」，社媒用最坏猜测填补空白，沉默本身成了头条。" },
      ],
      checklist: [
        "供应商经社会审核前置资质",
        "行为准则已公开并共享",
        "两次审核间持续监测已就位",
        "已定义 24 小时事实核查触发",
        "发言人及口径已提前批准",
        "基于证据的承认已备好",
        "带工人保护的整改计划",
        "复审核实与公开闭环已记录",
      ],
      faq: [
        { q: "我没听说过的分包商也要我负责吗？", a: "在公众与法律上，买家越来越要为包括不知情分包商在内的供应链负责。抗辩理由是可证明的监管，而非不知情。" },
        { q: "我该立刻砍掉供应商吗？", a: "通常不作为第一步。贸然切断可能抛弃工人、像在掩盖。先调查、保护工人、修复根因，证据出来后再决定关系。" },
        { q: "必须多快响应？", a: "对可信指控，首次承认应在数小时内；一周沉默本身就是声誉打击。手册要在危机前而非危机中准备。" },
      ],
      sources: [
        { name: "ETI 基本准则与买家准则", note: "品牌公布并执行的行事标准。" },
        { name: "现代奴役与供应链透明法", note: "让监管成为义务而非选择的 legal 驱动。" },
        { name: "FactoryAuditB2B 监测与复审", note: "用于危机响应的持续核查与证据。" },
      ],
    },
  },
  {
    slug: "chinese-supplier-scam-red-flags",
    category: "risk",
    titleEn: "12 Red Flags of a Chinese Supplier Scam (Spot Them Before You Pay)",
    titleZh: "中国供应商诈骗的 12 个红旗信号：下单前这样识别",
    metaDescEn:
      "The most common warning signs that a China supplier is a scam: pressure tactics, no verifiable entity, fake certificates, and how to verify before you pay.",
    metaDescZh:
      "中国供应商诈骗最常见的红旗信号：催促付款、无法核实实体、假证书，以及付款前如何核验。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/factory-audit/request" },
    ],
    related: ["how-to-verify-a-chinese-supplier", "supplier-risk-assessment-guide", "verify-supplier-before-deposit"],
    en: {
      quickAnswer:
        "The strongest scam signals are pressure to pay fast, refusal to share a verifiable business license, requests to move off-platform, and certificates that fail a registry check. Verify the legal entity and start small before any large deposit.",
      definition:
        "A supplier scam in cross-border sourcing is any pattern where a party poses as a manufacturer or trader to take payment without delivering conforming goods. Red flags are observable behaviours that let a buyer screen most bad actors before money leaves the account.",
      keyPoints: [
        "Pushy deposit demands and 'today only' pricing are classic pressure tactics.",
        "No verifiable unified social credit code or business license is a hard stop.",
        "Requests to leave Alibaba or use personal bank transfers raise risk sharply.",
        "Fake or recycled ISO/CE certificates are common; check the issuing body.",
        "No real factory address, no video call on site, and no traceable history are warnings.",
      ],
      steps: [
        { title: "Demand the unified social credit code", body: "Ask for the 18-digit code and the exact legal entity name. A genuine supplier provides it; a scammer stalls or sends a mismatched name." },
        { title: "Run an entity and certificate check", body: "Cross-check the credit code and any certificate number against public registries and the issuer. Mismatches or 'we lost the file' are red flags." },
        { title: "Insist on platform or escrow payment", body: "Keep communication and payment on Alibaba Trade Assurance or a similar escrow. Off-platform wire to a personal account is the biggest single warning." },
        { title: "Start with a small paid sample", body: "A real factory will produce a sample against your spec. A scammer avoids specifics or sends a stock photo." },
      ],
      examples: [
        { title: "The 'golden supplier' with no entity", body: "A buyer was pushed to wire a 30% deposit to a personal account; the 'factory' had no credit code and vanished after payment." },
        { title: "Recycled certificate", body: "An audit certificate was real but belonged to a different company; the issuer lookup exposed the mismatch before any order." },
      ],
      checklist: [
        "Unified social credit code provided and verified",
        "Legal entity name matches the contract and bank account",
        "Payment stays on a platform or escrow, not personal wire",
        "Certificate numbers check against the issuing body",
        "Real factory address confirmed by video or third-party visit",
        "Sample produced to your spec before bulk deposit",
        "No 'today only' pressure or off-platform requests",
        "trade references or verifiable export history available",
      ],
      faq: [
        { q: "Is a low price alone a red flag?", a: "Not by itself, but a price far below market plus pressure to pay fast usually is. Scammers bait with impossible prices." },
        { q: "Can a verified Alibaba supplier still scam me?", a: "Less likely, but still verify the entity and use Trade Assurance. Platform verification is a starting point, not a guarantee." },
        { q: "What if they refuse video call?", a: "Treat refusal as a red flag. A genuine factory will show its line on a call or accept a third-party inspection." },
      ],
      sources: [
        { name: "FactoryAuditB2B supplier verification", note: "Entity, certificate and on-site checks that screen bad actors." },
        { name: "China National Enterprise Credit Information Publicity System", note: "The official registry for unified social credit codes." },
      ],
    },
    zh: {
      quickAnswer:
        "最强的诈骗信号是催促快速付款、拒绝提供可核实的营业执照、要求离开平台交易，以及证书在登记系统中查不到。付款前务必核实法律实体并从小单起步。",
      definition:
        "跨境采购中的供应商诈骗，是指某方冒充工厂或贸易商收取货款却交付不符货物的一切套路。红旗信号是可观察的行为，让买家在钱离账前筛掉多数坏人。",
      keyPoints: [
        "催促付定金与「仅限今天」的报价是典型的施压话术。",
        "无法提供可核实的统一社会信用代码或营业执照是硬性红线。",
        "要求离开阿里或用个人银行转账，风险骤升。",
        "伪造或套用 ISO/CE 证书很常见，须查发证机构。",
        "无真实工厂地址、拒绝现场视频、查无历史都是警告。",
      ],
      steps: [
        { title: "索取统一社会信用代码", body: "要求提供 18 位代码与准确法律实体名。真实供应商会给；骗子会拖延或给不匹配的名字。" },
        { title: "做实体与证书核查", body: "将信用代码与任何证书号对照公开登记系统与发证机构。对不上或「文件丢了」即红旗。" },
        { title: "坚持平台或托管付款", body: "沟通与付款留在阿里 Trade Assurance 或类似托管。离开平台向个人账户电汇是最大单一警告。" },
        { title: "从小额付费样品起步", body: "真实工厂会按你的规格打样；骗子回避细节或发库存图。" },
      ],
      examples: [
        { title: "无实体的「金牌供应商」", body: "某买家被催着向个人账户电汇 30% 定金；该「工厂」无信用代码，付款后消失。" },
        { title: "套用证书", body: "一份审核证书真实但属于另一家公司；发证机构查询在订单前揭穿了矛盾。" },
      ],
      checklist: [
        "已提供并核实统一社会信用代码",
        "法律实体名与合同及银行账户一致",
        "付款留在平台或托管，非个人电汇",
        "证书号在发证机构可查",
        "真实工厂地址经视频或第三方走访确认",
        "批量定金前已按你的规格打样",
        "无「仅限今天」施压或离开平台要求",
        "可提供贸易参考或可核查出口历史",
      ],
      faq: [
        { q: "低价本身算红旗吗？", a: "单独不算，但远低于市场又催促付款通常就是。骗子用不可能低价做诱饵。" },
        { q: "已核实的阿里供应商还会骗我吗？", a: "概率较低，但仍要核实实体并用 Trade Assurance。平台核实是起点，不是保证。" },
        { q: "拒绝视频通话怎么办？", a: "视为红旗。真实工厂愿意在通话中展示产线，或接受第三方验厂。" },
      ],
      sources: [
        { name: "FactoryAuditB2B 供应商核验", note: "实体、证书与现场核查，筛掉坏人。" },
        { name: "国家企业信用信息公示系统", note: "统一社会信用代码的官方登记系统。" },
      ],
    },
  },
  {
    slug: "how-to-check-china-company-registration",
    category: "risk",
    titleEn: "How to Check a China Company Registration (License & Credit Code)",
    titleZh: "如何查中国公司工商注册：营业执照与信用代码核验",
    metaDescEn:
      "Step-by-step: verify a Chinese supplier's unified social credit code, legal name and business scope using public registries, and what mismatches mean.",
    metaDescZh:
      "分步核验中国供应商的统一社会信用代码、法律实体名与经营范围，使用公开登记系统，以及不一致意味着什么。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-verification-checklist" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/factory-audit/request" },
    ],
    related: ["chinese-supplier-scam-red-flags", "how-to-verify-a-chinese-supplier", "supplier-risk-assessment-guide"],
    en: {
      quickAnswer:
        "Every Chinese company has an 18-digit unified social credit code on its business license. Verify the code, legal name and business scope against the National Enterprise Credit Information Publicity System; any mismatch with the contract or bank account is a stop.",
      definition:
        "Company registration in China is recorded in the National Enterprise Credit Information Publicity System under a unified social credit code that fuses the old organisation, tax and social-security numbers. Checking it confirms a supplier is a real, registered legal entity.",
      keyPoints: [
        "The unified social credit code is 18 characters: a digit/letter mix unique to each entity.",
        "The legal name on the license must match the contract, invoice and bank account exactly.",
        "Business scope shows what the company may legally do; a 'manufacturer' with no production scope is a trader or shell.",
        "Abnormal operation status (经营异常) or serious violations are public and must block the deal.",
        "Foreign buyers cannot always log in to the registry; use a verification service or a local check.",
      ],
      steps: [
        { title: "Get the exact legal name and code", body: "Ask the supplier for the business license (or a clear photo) and copy the 18-digit code and full legal name verbatim." },
        { title: "Search the public registry", body: "Enter the code at the National Enterprise Credit Information Publicity System. Confirm the entity exists, its status is normal, and the scope fits." },
        { title: "Match name, account and scope", body: "The license name must equal the contract party and the receiving bank account; the scope must cover the product made or traded." },
        { title: "Check penalties and anomalies", body: "Read the abnormal-operation and penalty sections. Any serious violation or 'listed abnormal' status is a red flag." },
      ],
      examples: [
        { title: "Trader posing as factory", body: "The license scope was 'wholesale', not manufacturing; the 'factory' was a trading shell with no production licence." },
        { title: "Name mismatch on the account", body: "The contract party and the receiving bank account belonged to two different entities, exposing a pass-through scam." },
      ],
      checklist: [
        "18-digit unified social credit code obtained",
        "Entity found in the public registry",
        "Status is normal, not abnormal or revoked",
        "Legal name matches contract, invoice and bank account",
        "Business scope covers the product",
        "No serious violations or penalty records",
        "Establishment date and capital look consistent with claims",
        "Registered address is a real office or plant, not a virtual one",
      ],
      faq: [
        { q: "Can I check it myself from outside China?", a: "The registry is public but sometimes needs a local number or captcha; many buyers use a verification service or ask a local agent." },
        { q: "What if the code is 15 digits?", a: "Older organisation codes were 9-15 digits. The unified code has been mandatory since 2015; insist on the 18-digit code." },
        { q: "Does a valid license mean they are a good factory?", a: "No. It confirms a real legal entity, not capability or quality. Pair it with an audit or sample before scaling." },
      ],
      sources: [
        { name: "National Enterprise Credit Information Publicity System", note: "Official source for credit code, status and penalties." },
        { name: "FactoryAuditB2B document check", note: "Structured verification of licenses and certificates." },
      ],
    },
    zh: {
      quickAnswer:
        "每家中国公司在营业执照上都有 18 位统一社会信用代码。在「国家企业信用信息公示系统」核验代码、法律实体名与经营范围；任何与合同或银行账户的不一致都应叫停。",
      definition:
        "中国公司登记记录在「国家企业信用信息公示系统」下，以统一社会信用代码管理——它融合了旧的组织机构、税务与社保编号。核验它可确认供应商是真实注册的法律实体。",
      keyPoints: [
        "统一社会信用代码为 18 位，由数字与字母组成，每家企业唯一。",
        "执照上的法律名称必须与合同、发票、银行账户完全一致。",
        "经营范围显示公司可合法从事的业务；自称「工厂」却无生产范围的，是贸易商或空壳。",
        "经营异常或严重违法信息对外公示，必须阻断交易。",
        "境外买家未必能登录登记系统，可用核验服务或本地核查替代。",
      ],
      steps: [
        { title: "拿到准确法律名称与代码", body: "向供应商要营业执照（或清晰照片），逐字抄下 18 位代码与完整法律名称。" },
        { title: "检索公示系统", body: "在「国家企业信用信息公示系统」输入代码，确认实体存在、状态正常、范围相符。" },
        { title: "比对名称、账户与范围", body: "执照名称须等于合同主体与收款银行账户；范围须覆盖所制造或贸易的产品。" },
        { title: "查处罚与异常", body: "读「经营异常」与「行政处罚」栏目。任何严重违法或列入异常都属红旗。" },
      ],
      examples: [
        { title: "冒充工厂的贸易商", body: "执照范围为「批发」而非生产；该「工厂」是无生产许可的贸易空壳。" },
        { title: "账户名不一致", body: "合同主体与收款银行账户分属两个实体，暴露过账骗局。" },
      ],
      checklist: [
        "已取得 18 位统一社会信用代码",
        "实体在公示系统中可查",
        "状态正常，非异常或注销",
        "法律名称与合同、发票、银行账户一致",
        "经营范围覆盖该产品",
        "无严重违法或处罚记录",
        "成立日期与注册资本与说法相符",
        "注册地址是真实办公或厂房，非虚拟地址",
      ],
      faq: [
        { q: "我在境外能自己查吗？", a: "公示系统对外公开，但有时需本地手机号或验证码；许多买家用核验服务或请本地代理。" },
        { q: "代码是 15 位怎么办？", a: "旧组织机构代码为 9-15 位。统一代码自 2015 年起强制，须坚持 18 位。" },
        { q: "执照有效就等于好工厂吗？", a: "不等于。它只确认是真实法律实体，不代表能力或质量。配合验厂或打样再放量。" },
      ],
      sources: [
        { name: "国家企业信用信息公示系统", note: "代码、状态与处罚的官方来源。" },
        { name: "FactoryAuditB2B 文件核查", note: "执照与证书的结构化核验。" },
      ],
    },
  },
  {
    slug: "alibaba-trade-assurance-safe-payment",
    category: "risk",
    titleEn: "Alibaba Trade Assurance: How It Protects Your Sourcing Payment",
    titleZh: "阿里 Trade Assurance 安全付款：保护你的采购资金",
    metaDescEn:
      "What Alibaba Trade Assurance covers, how the escrow-style protection works, its limits, and how to combine it with inspection for safe sourcing.",
    metaDescZh:
      "阿里 Trade Assurance 保什么、类托管保护如何运作、它的局限，以及如何与验货结合实现安全采购。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/compare" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/services/china-supplier-verification" },
    ],
    related: ["verify-supplier-before-deposit", "chinese-supplier-scam-red-flags", "pre-shipment-inspection-checklist"],
    en: {
      quickAnswer:
        "Trade Assurance is Alibaba's free order-protection programme: your payment is held and only released against agreed terms, and you can claim if the supplier fails to ship or ships non-conforming goods. It is not insurance and caps at the supplier's coverage, so pair it with inspection.",
      definition:
        "Trade Assurance is a built-in protection on Alibaba.com that covers orders placed and paid through the platform. It gives the buyer a contractual route to a refund or re-shipment when the supplier breaches the agreed product, quantity, delivery or quality terms.",
      keyPoints: [
        "Coverage applies only to orders paid through Alibaba's specified channels, not off-platform wires.",
        "It protects against non-shipment, late delivery and goods not matching the contract.",
        "It is not insurance; payout is capped by the supplier's available coverage and the claim evidence.",
        "You must open the dispute with photos, inspection reports and the contract within the window.",
        "Combine it with a pre-shipment inspection to catch quality issues before release.",
      ],
      steps: [
        { title: "Place and pay on-platform", body: "Create the order through Trade Assurance and pay via Alibaba's channels so the protection attaches to the transaction." },
        { title: "Lock the contract terms", body: "State product spec, quantity, price, delivery date and acceptance standard clearly; disputes are judged against these terms." },
        { title: "Inspect before releasing payment", body: "Order a pre-shipment inspection; if it fails, hold payment and open a dispute with the report as evidence." },
        { title: "Open a dispute in time", body: "If the supplier breaches, file within the allowed window with photos, the inspection report and messages as proof." },
      ],
      examples: [
        { title: "Refund after failed inspection", body: "A buyer withheld release after a pre-shipment inspection found the wrong material, then won a Trade Assurance refund using the report." },
        { title: "No cover off-platform", body: "A buyer who wired outside Alibaba had no claim when goods never arrived; the protection never attached." },
      ],
      checklist: [
        "Order created under Trade Assurance",
        "Payment through Alibaba's specified channels",
        "Contract states spec, quantity, date and acceptance",
        "Pre-shipment inspection booked before release",
        "Dispute window and evidence rules noted",
        "Supplier coverage limit checked against order value",
        "Communication kept on the platform",
        "Photos and reports saved from day one",
      ],
      faq: [
        { q: "Is Trade Assurance the same as insurance?", a: "No. It is a platform-backed order protection with limits, not a policy. For high-value orders, add inspection and your own terms." },
        { q: "Does it cover quality defects?", a: "Yes, if the goods do not match the contracted spec and you prove it with inspection and photos within the window." },
        { q: "What if I paid by bank transfer directly?", a: "Then the protection does not attach. Always pay through the Alibaba channel named in the order." },
      ],
      sources: [
        { name: "Alibaba Trade Assurance terms", note: "The official coverage and dispute rules." },
        { name: "FactoryAuditB2B pre-shipment inspection", note: "Evidence that strengthens any claim." },
      ],
    },
    zh: {
      quickAnswer:
        "Trade Assurance 是阿里免费的交易保护机制：货款被托管，仅在约定条款达成后释放；若供应商不发货或发不符货物，你可索赔。它不是保险且有额度上限，须与验货搭配。",
      definition:
        "Trade Assurance 是阿里国际站内置的保护，覆盖通过平台下单并付款的订单。当供应商违反约定的产品、数量、交期或质量条款时，买家可据此获得退款或补发。",
      keyPoints: [
        "保护只适用于经阿里指定渠道付款的订单，不适用于离开平台的电汇。",
        "它保护不发货、迟交以及货物与合同不符。",
        "它不是保险；赔付受供应商可用额度与索赔证据上限约束。",
        "必须在窗口内凭照片、验货报告与合同发起纠纷。",
        "与出货前验货结合，可在放款前拦下质量问题。",
      ],
      steps: [
        { title: "在平台内下单并付款", body: "通过 Trade Assurance 建单并用阿里渠道付款，保护才附加到该交易。" },
        { title: "锁定合同条款", body: "清楚写明产品规格、数量、价格、交期与验收标准；纠纷依这些条款判定。" },
        { title: "放款前验货", body: "订出货前验货；不通过则扣留货款，并以报告为证据发起纠纷。" },
        { title: "及时发起纠纷", body: "若供应商违约，在允许窗口内凭照片、验货报告与聊天记录举证。" },
      ],
      examples: [
        { title: "验货不通过获退款", body: "某买家在出货前验货发现材质错误，扣留放款，凭报告赢得 Trade Assurance 退款。" },
        { title: "离开平台无保障", body: "某买家在阿里外电汇，货未到却无索赔依据；保护从未附加。" },
      ],
      checklist: [
        "订单建在 Trade Assurance 下",
        "经阿里指定渠道付款",
        "合同写明规格、数量、交期与验收",
        "放款前已订出货前验货",
        "已留意纠纷窗口与证据规则",
        "已核对供应商额度与订单金额",
        "沟通留在平台内",
        "从第一天起保存照片与报告",
      ],
      faq: [
        { q: "Trade Assurance 等于保险吗？", a: "不等于。它是平台托底的订单保护且有上限，非保单。高值订单请加验货与自有条款。" },
        { q: "覆盖质量缺陷吗？", a: "覆盖，前提是货物不符合同规格，且你在窗口内用验货与照片举证。" },
        { q: "我直接银行转账了怎么办？", a: "保护不附加。务必通过订单中指定的阿里渠道付款。" },
      ],
      sources: [
        { name: "阿里 Trade Assurance 条款", note: "官方保障与纠纷规则。" },
        { name: "FactoryAuditB2B 出货前验货", note: "强化任何索赔的证据。" },
      ],
    },
  },
  {
    slug: "verify-supplier-before-deposit",
    category: "risk",
    titleEn: "Verify a Supplier Before Paying Deposit: 5-Step Checklist",
    titleZh: "付定金前验证供应商：5 步清单避免被骗",
    metaDescEn:
      "A practical pre-deposit verification sequence: entity check, sample, video, references and contract terms that protect your advance payment.",
    metaDescZh:
      "实用的付定金前核验流程：实体核查、打样、视频、参考与合同条款，保护你的预付款。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/factory-audit/request" },
    ],
    related: ["chinese-supplier-scam-red-flags", "how-to-check-china-company-registration", "alibaba-trade-assurance-safe-payment"],
    en: {
      quickAnswer:
        "Before any deposit, confirm the legal entity, order a paid sample to your spec, verify the site by video or third-party visit, check references, and put acceptance terms in the contract. These five steps stop most advance-payment fraud.",
      definition:
        "Pre-deposit verification is the sequence of checks a buyer runs before releasing an advance payment. Because deposits are hard to recover, the goal is to convert trust into evidence: a real entity, real capability and a contract that lets you claw back.",
      keyPoints: [
        "Verify the entity (credit code, license, bank account match) before money moves.",
        "A paid sample to your spec reveals real production ability, not just photos.",
        "Video call on the line or a third-party visit confirms a real plant exists.",
        "References from other buyers reduce the chance of a fresh shell company.",
        "Contract acceptance terms and escrow make recovery possible if things go wrong.",
      ],
      steps: [
        { title: "Verify the legal entity", body: "Check the unified social credit code and confirm the license name matches the contract and bank account. No match, no deposit." },
        { title: "Order a paid sample", body: "Pay for a sample made to your specification. A real factory delivers; a scammer stalls or sends a generic item." },
        { title: "Confirm the site", body: "Do a live video walk of the line or commission a third-party visit. A real address and equipment are hard to fake." },
        { title: "Check references", body: "Ask for two buyer references and, if possible, verify them. A long export history is harder to invent than a website." },
        { title: "Set contract and payment terms", body: "Write acceptance criteria, inspection rights and use escrow or staged payment so you can withhold or recover." },
      ],
      examples: [
        { title: "Sample exposed a trader", body: "The 'manufacturer' could not produce the sample to spec and routed to a third party, revealing it was a pass-through." },
        { title: "Reference check saved the deposit", body: "One reference confirmed a bad experience; the buyer walked away before wiring the deposit." },
      ],
      checklist: [
        "Entity verified (code, license, account match)",
        "Paid sample produced to spec",
        "Site confirmed by video or visit",
        "At least two buyer references checked",
        "Acceptance criteria written in contract",
        "Inspection right and escrow/staged payment agreed",
        "No off-platform personal-wire request accepted",
        "Deposit amount proportionate to verified trust",
      ],
      faq: [
        { q: "How much deposit is safe?", a: "Lower is safer. Many buyers start at 30% with escrow, and only raise it after a proven track record." },
        { q: "Is a sample enough on its own?", a: "It is strong evidence but pair it with entity and site checks; a sample alone can still come from a broker." },
        { q: "What if they refuse a contract?", a: "Treat refusal as a stop. A genuine supplier expects written terms." },
      ],
      sources: [
        { name: "FactoryAuditB2B verification workflow", note: "Entity, sample and on-site steps in one flow." },
        { name: "Supplier verification checklist tool", note: "A reusable pre-deposit checklist." },
      ],
    },
    zh: {
      quickAnswer:
        "付任何定金前，先确认法律实体、按你的规格订付费样品、用视频或第三方走访核实现场、查参考、并把验收条款写进合同。这五步能拦下多数预付款诈骗。",
      definition:
        "付定金前核验是买家在放出预付款前执行的一连串检查。因为定金难追回，目标是把信任变成证据：真实实体、真实能力，以及一份能让你挽回损失的合同。",
      keyPoints: [
        "放款前核实实体（信用代码、执照、银行账户一致）。",
        "按你规格的付费样品能暴露真实生产能力，而非仅照片。",
        "产线视频或第三方走访确认真实工厂存在。",
        "其他买家的参考降低遇到全新空壳的概率。",
        "合同验收条款与托管让出问题时可扣留或追回。",
      ],
      steps: [
        { title: "核实法律实体", body: "查统一社会信用代码，确认执照名与合同及银行账户一致。不一致就不付定金。" },
        { title: "订付费样品", body: "为按你规格制作的样品付款。真实工厂能交付；骗子拖延或发通用货。" },
        { title: "核实现场", body: "做产线实时视频或委托第三方走访。真实地址与设备难以伪造。" },
        { title: "查参考", body: "要两个买家参考并尽可能核实。长期出口历史比网站更难编造。" },
        { title: "定合同与付款条款", body: "写清验收标准、验货权，用托管或分期付款以便扣留或追回。" },
      ],
      examples: [
        { title: "样品暴露贸易商", body: "该「制造商」无法按规格打样并转给第三方，暴露其为过账商。" },
        { title: "参考核查保住定金", body: "一个参考证实不良经历，买家在电汇前退出。" },
      ],
      checklist: [
        "实体已核实（代码、执照、账户一致）",
        "已按规格交付付费样品",
        "现场经视频或走访确认",
        "至少两个买家参考已查",
        "验收标准写入合同",
        "验货权与托管/分期付款已约定",
        "不接受离开平台的个人电汇要求",
        "定金比例与已核实信任相称",
      ],
      faq: [
        { q: "多少定金安全？", a: "越低越安全。许多买家以 30% 托管起步，有记录后再提高。" },
        { q: "样品本身够吗？", a: "是强证据，但需配合实体与现场核查；单一样品也可能来自中间商。" },
        { q: "拒绝合同怎么办？", a: "视为叫停。真实供应商期待书面条款。" },
      ],
      sources: [
        { name: "FactoryAuditB2B 核验流程", note: "实体、样品与现场一步到位。" },
        { name: "供应商核验清单工具", note: "可复用的付定金前清单。" },
      ],
    },
  },
  {
    slug: "common-b2b-procurement-fraud",
    category: "risk",
    titleEn: "Common B2B Procurement Fraud Tactics (with Real Cases)",
    titleZh: "B2B 采购常见诈骗手法与真实案例解析",
    metaDescEn:
      "The tactics behind B2B sourcing fraud: fake factories, phantom shipments, invoice redirect and certificate reuse, with cases and how verification stops each.",
    metaDescZh:
      "B2B 采购诈骗的手法：假工厂、幽灵发货、发票重定向与证书套用，附案例与核验如何逐一拦截。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/factory-audit/request" },
    ],
    related: ["chinese-supplier-scam-red-flags", "verify-supplier-before-deposit", "how-to-check-china-company-registration"],
    en: {
      quickAnswer:
        "The four common tactics are fake-factory posing, phantom shipments (paid but never sent or sent junk), invoice-redirect to a fraudulent account, and reused certificates. Each is stopped by entity verification, sample, on-platform payment and document checks.",
      definition:
        "B2B procurement fraud uses the distance and trust gap in cross-border buying to take payment without delivering value. Knowing the playbook lets a buyer build checks that defeat each tactic before money moves.",
      keyPoints: [
        "Fake-factory scams show stock photos and refuse site visits while claiming to be the maker.",
        "Phantom shipments take full payment then send nothing, or stuff containers with worthless goods.",
        "Invoice redirect swaps the receiving account at the last moment, often after a hack or social engineering.",
        "Certificate reuse puts a real certificate from another company on the bid.",
        "All four fail against entity check, sample, escrow and document verification.",
      ],
      steps: [
        { title: "Map the tactic to a control", body: "Treat each known tactic as a checklist item: entity, sample, payment channel, document check." },
        { title: "Block fake-factory with a visit", body: "Require a video walk or third-party audit; a real maker shows the line, not a brochure." },
        { title: "Stop phantom shipments with escrow", body: "Release payment only against inspection and shipping proof; never prepay in full to an unknown entity." },
        { title: "Defeat invoice redirect", body: "Verify any account change by a second channel and write the account into the contract; treat last-minute swaps as fraud." },
      ],
      examples: [
        { title: "The swapped account", body: "Mid-deal the 'supplier' emailed new bank details; a phone check to the verified number exposed the redirected fraud." },
        { title: "The empty container", body: "Full payment sent, container arrived with scrap; escrow and inspection would have stopped the release." },
      ],
      checklist: [
        "Entity verified before any payment",
        "Site confirmed by video or third-party audit",
        "Sample produced to spec",
        "Payment on platform or escrow, not full prepay",
        "Certificate numbers checked against issuer",
        "Bank account matches contract and is re-verified on change",
        "Shipping proof and inspection before release",
        "Second-channel confirmation for any account change",
      ],
      faq: [
        { q: "Which tactic is most common?", a: "Fake-factory posing and invoice redirect are frequent; both fail against basic entity and account verification." },
        { q: "Can a big platform listing prevent this?", a: "It lowers risk but does not remove it; still verify the entity and use protected payment." },
        { q: "What is the cheapest control?", a: "The entity and certificate check via public registries costs little and stops most bad actors." },
      ],
      sources: [
        { name: "FactoryAuditB2B risk assessment", note: "Scores and maps supplier risk before ordering." },
        { name: "Enterprise credit registry", note: "The free control behind entity verification." },
      ],
    },
    zh: {
      quickAnswer:
        "四种常见手法：冒充工厂、幽灵发货（收款不发货或发废料）、发票重定向到欺诈账户、套用证书。逐一靠实体核验、打样、平台付款与文件核查拦截。",
      definition:
        "B2B 采购诈骗利用跨境采购的距离与信任缺口，收款却交付无价值。了解套路可让买家建立在钱移动前就击败每种手法的检查。",
      keyPoints: [
        "冒充工厂骗局展示库存图、拒绝走访，却自称制造商。",
        "幽灵发货收全款后不发货，或往集装箱塞 worthless 货物。",
        "发票重定向在最后一刻换收款账户，常经黑客或社工。",
        "证书套用把别家真实证书贴到投标上。",
        "四种都败于实体核查、打样、托管与文件核验。",
      ],
      steps: [
        { title: "把手法映射到控制", body: "将每种已知手法作为清单项：实体、样品、付款渠道、文件核查。" },
        { title: "用走访拦冒充工厂", body: "要求产线视频或第三方审核；真实制造商展示产线而非宣传册。" },
        { title: "用托管拦幽灵发货", body: "仅凭验货与发货证明放款；绝不对未知实体全款预付。" },
        { title: "破解发票重定向", body: "任何账户变更用第二渠道核实并写入合同；把临门一脚换账户视为欺诈。" },
      ],
      examples: [
        { title: "被替换的账户", body: "交易中段「供应商」邮件发来新银行信息；用已核实号码电话核对揭穿重定向欺诈。" },
        { title: "空集装箱", body: "付全款，集装箱到货是废料；托管与验货本可拦下放款。" },
      ],
      checklist: [
        "任何付款前实体已核实",
        "现场经视频或第三方审核确认",
        "已按规格打样",
        "平台或托管付款，非全款预付",
        "证书号在发证机构可查",
        "银行账户与合同一致且变更时重新核实",
        "放款前有发货证明与验货",
        "任何账户变更经第二渠道确认",
      ],
      faq: [
        { q: "哪种手法最常见？", a: "冒充工厂与发票重定向频发；两者都败于基本实体与账户核验。" },
        { q: "大平台店铺能防吗？", a: "降低风险但不消除；仍要核实实体并用受保护付款。" },
        { q: "最便宜的控制是什么？", a: "经公示系统做实体与证书核查几乎零成本，却能拦下多数坏人。" },
      ],
      sources: [
        { name: "FactoryAuditB2B 风险评估", note: "下单前为供应商风险打分与映射。" },
        { name: "企业信用公示系统", note: "实体核验背后的免费控制。" },
      ],
    },
  },
  {
    slug: "what-is-quality-management-system",
    category: "audit",
    titleEn: "What Is a Quality Management System (QMS): The Operating System of a Manufacturer",
    titleZh: "质量管理体系(QMS)是什么：制造企业的底层系统",
    metaDescEn:
      "A plain explanation of a QMS: what it is, the plan-do-check-act cycle, the documents it produces, and why buyers should care about a supplier's system, not just a certificate.",
    metaDescZh:
      "通俗解释 QMS：是什么、PDCA 循环、它产出的文件，以及买家为何该关注供应商的体系而非仅一张证书。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-quality-checker" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/factory-audit/request" },
    ],
    related: ["iso-9001-vs-iso-13485", "manufacturing-quality-control-process", "supplier-quality-audit-checklist"],
    en: {
      quickAnswer:
        "A Quality Management System is the repeatable set of processes, documents and responsibilities a factory uses to make the same good product every time. Buyers should judge the system (not just a certificate) because it is what keeps quality consistent batch after batch.",
      definition:
        "A QMS is the documented operating system of a manufacturer: how it plans, controls, checks and improves production. Standards like ISO 9001 describe the shape; the QMS is the actual practice on the floor, in the files and in people's habits.",
      keyPoints: [
        "A QMS turns 'good luck' into 'repeatable process' so quality does not depend on one person.",
        "The core loop is Plan-Do-Check-Act (PDCA), repeated for every process.",
        "It produces real artefacts: quality manuals, procedures, work instructions, records and corrective actions.",
        "A certificate shows intent; the system shows whether quality actually holds across batches.",
        "Buyers use the QMS to predict consistency, not just to tick a box at audit time.",
      ],
      steps: [
        { title: "Map the process flow", body: "List each step from incoming material to shipment and the control at each step. Gaps here are where defects are born." },
        { title: "Require documented procedures", body: "Each critical process needs a written instruction and an owner, so training and execution do not drift." },
        { title: "Demand records, not promises", body: "Ask for recent inspection records and corrective-action reports; records prove the system runs." },
        { title: "Verify at audit", body: "During a factory audit, check that documents match the floor: instructions posted, checks done, non-conformance handled." },
      ],
      examples: [
        { title: "Two certificates, one result", body: "Two suppliers held ISO 9001, but only one had records and corrective actions on the floor; only that one held spec across reorders." },
        { title: "System beat heroics", body: "A plant without a star operator but with a real QMS outperformed a plant that relied on one experienced line leader who left." },
      ],
      checklist: [
        "Process flow documented from incoming to shipment",
        "Quality manual and procedures exist and are current",
        "Each critical process has an owner and work instruction",
        "Inspection and test records retained and retrievable",
        "Non-conformance handled by corrective action, not silence",
        "Management review evidence exists",
        "Training records show competence",
        "PDCA visible in how issues are closed",
      ],
      faq: [
        { q: "Is a QMS the same as ISO 9001?", a: "ISO 9001 is a standard that defines what a QMS should cover; the QMS is the supplier's actual system. A certificate says they aim for it; records show if they run it." },
        { q: "Do small factories need a formal QMS?", a: "Even a simple one helps. The point is repeatable process and records, not the size of the binder." },
        { q: "Why should a buyer care about the system?", a: "Because consistency across batches protects your reorders. A one-off good sample means little without a system behind it." },
      ],
      sources: [
        { name: "ISO 9001 quality management principles", note: "The reference shape of a QMS." },
        { name: "FactoryAuditB2B factory audit", note: "Where the system is verified against the floor." },
      ],
    },
    zh: {
      quickAnswer:
        "质量管理体系是工厂用来「每次都做出同样好产品」的可重复流程、文件与职责集合。买家应看体系（而非仅一张证书），因为它决定质量能否批批稳定。",
      definition:
        "QMS 是制造商成文的操作系统：如何计划、控制、检查并改进生产。ISO 9001 之类标准描述其形状，QMS 是车间、文件与人习惯里的真实实践。",
      keyPoints: [
        "QMS 把「靠运气」变成「可重复流程」，质量不再依赖某一个人。",
        "核心循环是 PDCA（计划-执行-检查-处理），对每个流程反复进行。",
        "它产出真实物证：质量手册、程序、作业指导书、记录与纠正措施。",
        "证书代表意图；体系代表质量是否跨批次真正稳定。",
        "买家用 QMS 预测一致性，而非仅在审核时打个勾。",
      ],
      steps: [
        { title: "梳理流程", body: "列出从来料到出货的每一步及每步控制点。这里的缺口就是缺陷的源头。" },
        { title: "要求成文程序", body: "每个关键流程需有书面作业指导书与负责人，避免培训与执行漂移。" },
        { title: "要记录不要承诺", body: "索取近期检验记录与纠正措施报告；记录证明体系在运行。" },
        { title: "审核时核实", body: "验厂时核对文件与现场一致：指导书张贴、检查执行、不合格被处理。" },
      ],
      examples: [
        { title: "两证一果", body: "两家都持 ISO 9001，但只有一家有现场记录与纠正措施；只有这家在多次返单中保持规格。" },
        { title: "体系胜过个人英雄", body: "一家无明星操作员但有真实 QMS 的厂，胜过了一家依赖一位离职产线老手的厂。" },
      ],
      checklist: [
        "来料到出货的流程已成文",
        "质量手册与程序存在且现行有效",
        "每个关键流程有负责人与作业指导书",
        "检验与测试记录留存可取",
        "不合格以纠正措施处理，而非掩盖",
        "管理层评审证据存在",
        "培训记录证明能力",
        "PDCA 体现在问题关闭方式中",
      ],
      faq: [
        { q: "QMS 等于 ISO 9001 吗？", a: "ISO 9001 是定义 QMS 应覆盖什么的标准；QMS 是供应商的真实体系。证书说明其目标；记录说明其是否运行。" },
        { q: "小厂需要正式 QMS 吗？", a: "简单的一套也有帮助。重点是可重复流程与记录，而非文件厚薄。" },
        { q: "买家为何要关心体系？", a: "因为跨批次一致性保护你的返单。没有体系支撑，一次好样品意义不大。" },
      ],
      sources: [
        { name: "ISO 9001 质量管理原则", note: "QMS 的参考形状。" },
        { name: "FactoryAuditB2B 工厂审核", note: "体系与现场核对的环节。" },
      ],
    },
  },
  {
    slug: "iso-9001-vs-iso-13485",
    category: "audit",
    titleEn: "ISO 9001 vs ISO 13485: Which Quality System Fits Your Supplier",
    titleZh: "ISO 9001 与 ISO 13485 区别：质量体系怎么选",
    metaDescEn:
      "The real difference between ISO 9001 and ISO 13485, when a medical-device grade system is required, and how to read a supplier's certificate for sourcing decisions.",
    metaDescZh:
      "ISO 9001 与 ISO 13485 的真实区别、何时需要医疗器械级体系，以及如何为采购决策读懂供应商证书。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/audit-checklist" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/services/supplier-verification" },
    ],
    related: ["what-is-quality-management-system", "supplier-quality-audit-checklist", "manufacturing-quality-control-process"],
    en: {
      quickAnswer:
        "ISO 9001 is the general quality-management standard for any industry; ISO 13485 is ISO 9001 adapted for medical devices, with stricter control of documentation, traceability and risk. Choose 13485 only when the product is a regulated medical device; otherwise 9001 suffices.",
      definition:
        "Both are QMS standards. ISO 9001 sets the baseline for consistent quality in any organisation. ISO 13485 builds on it for the medical-device sector, where patient safety demands stronger records, traceability and risk controls than general manufacturing.",
      keyPoints: [
        "ISO 9001 fits general manufacturing, trading and service suppliers.",
        "ISO 13485 is required for most regulated medical-device production and some components.",
        "13485 removes the 'continuous improvement' clause and hardens documentation and traceability instead.",
        "A 13485 certificate does not mean the factory makes any device well; scope still matters.",
        "Read the certificate scope and accreditation body, not just the logo, before deciding.",
      ],
      steps: [
        { title: "Confirm the product's regulatory class", body: "If it is a medical device under FDA, EU MDR or similar, 13485 is typically expected; otherwise 9001 is enough." },
        { title: "Read the certificate scope", body: "Check which products and sites the certificate covers. A logo on the wall is not proof for your item." },
        { title: "Verify the accreditation body", body: "A recognised accreditor (e.g. UKAS, ANAB, DAkkS) matters more than the certificate paper." },
        { title: "Audit the practice, not the logo", body: "During a supplier audit, confirm traceability and records match the claimed standard." },
      ],
      examples: [
        { title: "Right standard, wrong scope", body: "A 13485 certificate covered only packaging, not the device itself; the buyer needed the device scope before qualifying." },
        { title: "9001 was enough", body: "A non-medical consumer product needed only 9001; pushing for 13485 added cost with no buyer benefit." },
      ],
      checklist: [
        "Product regulatory class confirmed",
        "Required standard mapped to the class",
        "Certificate scope covers your product and site",
        "Accreditation body is recognised",
        "Certificate valid and not expired",
        "Traceability and records present on the floor",
        "Risk controls documented for device work",
        "Audit confirms practice matches the certificate",
      ],
      faq: [
        { q: "Is 13485 better than 9001?", a: "Not 'better' — more specific. It is the right standard for regulated medical devices and unnecessary for general goods." },
        { q: "Can a 9001 factory make medical parts?", a: "Only if the device rules allow it and the relevant controls are in place; many regulated devices require 13485." },
        { q: "What if the certificate is expired?", a: "Treat it as no certificate. Verify the current valid certificate with the accreditation body." },
      ],
      sources: [
        { name: "ISO 13485 standard", note: "The medical-device QMS requirements." },
        { name: "ISO 9001 standard", note: "The general QMS baseline." },
      ],
    },
    zh: {
      quickAnswer:
        "ISO 9001 是适用于任何行业的通用质量管理标准；ISO 13485 是为其适配医疗器械的版本，对文件、可追溯性与风险的控制更严。仅当产品是受监管医疗器械时才选 13485，否则 9001 足够。",
      definition:
        "两者都是 QMS 标准。ISO 9001 为任何组织设定一致质量的基线。ISO 13485 在其上针对医疗器械行业，因患者安全需在记录、可追溯性与风险控制上强于普通制造。",
      keyPoints: [
        "ISO 9001 适用于通用制造、贸易与服务供应商。",
        "ISO 13485 是多数受监管医疗器械生产及部分零部件所需。",
        "13485 去掉「持续改进」条款，转而强化文件与可追溯性。",
        "持 13485 证书不代表工厂任何器械都做得好；范围仍关键。",
        "决策前读证书范围与认可机构，而非仅看标志。",
      ],
      steps: [
        { title: "确认产品监管类别", body: "若属 FDA、欧盟 MDR 等下的医疗器械，通常期望 13485；否则 9001 足够。" },
        { title: "读证书范围", body: "查证书覆盖哪些产品与场所。墙上标志不等于你的物料被覆盖。" },
        { title: "核实认可机构", body: "受认可的认可机构（如 UKAS、ANAB、DAkkS）比证书纸张更重要。" },
        { title: "审实践而非标志", body: "供应商审核时确认可追溯性与记录符合声称标准。" },
      ],
      examples: [
        { title: "标准对范围错", body: "一份 13485 证书仅覆盖包装而非器械本身；买家在准入前需要器械范围。" },
        { title: "9001 已足够", body: "非医疗消费品只需 9001；强求 13485 徒增成本无收益。" },
      ],
      checklist: [
        "已确认产品监管类别",
        "所需标准已映射到类别",
        "证书范围覆盖你的产品与场所",
        "认可机构受承认",
        "证书有效未过期",
        "现场有可追溯性与记录",
        "器械工作有书面风险控制",
        "审核确认实践符合证书",
      ],
      faq: [
        { q: "13485 比 9001 好？", a: "不是「更好」而是更专。它是受监管医疗器械的正确标准，对普通货品不必要。" },
        { q: "9001 工厂能做医疗零件吗？", a: "仅当器械规则允许且相关控制到位；许多受监管器械要求 13485。" },
        { q: "证书过期怎么办？", a: "视为无证书。向认可机构核实当前有效证书。" },
      ],
      sources: [
        { name: "ISO 13485 标准", note: "医疗器械 QMS 要求。" },
        { name: "ISO 9001 标准", note: "通用 QMS 基线。" },
      ],
    },
  },
  {
    slug: "manufacturing-quality-control-process",
    category: "audit",
    titleEn: "Manufacturing Quality Control Process: Incoming, IPQC, FQC and OQC",
    titleZh: "制造质量控制流程：来料/IPQC/FQC/OQC 全解",
    metaDescEn:
      "How a factory controls quality across the line: incoming inspection, in-process IPQC, final FQC and outgoing OQC, with the checkpoints that protect your order.",
    metaDescZh:
      "工厂如何在线控制质量：来料检验、过程 IPQC、终检 FQC 与出货 OQC，以及保护你订单的关键控制点。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-quality-checker" },
      { href: "/tools/audit-checklist" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/factory-audit/request" },
    ],
    related: ["what-is-quality-management-system", "supplier-quality-audit-checklist", "ppap-production-part-approval"],
    en: {
      quickAnswer:
        "Quality control runs at four gates: incoming (IQC) checks materials, in-process (IPQC) watches the line, final (FQC) checks the finished unit, and outgoing (OQC) verifies before shipment. Ask which gates a supplier actually runs before you rely on them.",
      definition:
        "Quality control is the set of inspections along production that catch defects before they reach you. The four standard gates — IQC, IPQC, FQC, OQC — split responsibility so a problem is found at the cheapest point, not after delivery.",
      keyPoints: [
        "IQC checks raw materials and components on arrival; bad inputs doom the output.",
        "IPQC samples during production to catch drift, tooling wear and setup errors early.",
        "FQC inspects the finished product against the spec before it is packed.",
        "OQC verifies the packed lot and the right quantity and labelling before it leaves.",
        "A factory that skips gates saves pennies and ships your risk; verify which it runs.",
      ],
      steps: [
        { title: "Define accept criteria per gate", body: "Write the AQL or spec for IQC, IPQC, FQC and OQC so checks are comparable, not casual." },
        { title: "Ask for the QC plan", body: "Request the supplier's inspection plan and recent records; absence of a plan is a warning." },
        { title: "Add your own inspection", body: "Book a pre-shipment (FQC/OQC) inspection so an independent check confirms the lot before it ships." },
        { title: "Close loops with CAPA", body: "When a gate fails, require corrective and preventive action so the same defect does not repeat." },
      ],
      examples: [
        { title: "IQC caught the sub", body: "Incoming check found plating thickness below spec; stopping at IQC avoided a full batch recall later." },
        { title: "No IPQC, line drift", body: "A line drifted after a tool change with no IPQC; defects surfaced only at FQC and delayed the whole order." },
      ],
      checklist: [
        "IQC plan for incoming materials",
        "IPQC points defined along the line",
        "FQC against the finished spec",
        "OQC before shipment (quantity, label, packing)",
        "AQL or spec written for each gate",
        "Records retained per batch",
        "Failed lots trigger CAPA",
        "Independent pre-shipment inspection booked",
      ],
      faq: [
        { q: "Is FQC the same as a pre-shipment inspection?", a: "FQC is the factory's own final check; a pre-shipment inspection is your independent verification, ideally both." },
        { q: "Do I need all four gates?", a: "For critical or high-value items, yes. For simple goods, at least IQC and OQC protect most risk." },
        { q: "What if the supplier has no QC plan?", a: "Treat it as a major risk and add your own inspection, or qualify a supplier that does." },
      ],
      sources: [
        { name: "FactoryAuditB2B inspection services", note: "Independent FQC/OQC verification." },
        { name: "AQL sampling standard", note: "The common acceptance rule for each gate." },
      ],
    },
    zh: {
      quickAnswer:
        "质量控制设在四道闸门：来料(IQC)查物料、过程(IPQC)盯产线、终检(FQC)查成品、出货(OQC)发货前核实。依赖供应商前先问它真正跑了哪些闸门。",
      definition:
        "质量控制是生产沿线的一系列检验，在你收到前拦下缺陷。四个标准闸门——IQC、IPQC、FQC、OQC——分摊责任，让问题在最便宜的环节被发现，而非交货后。",
      keyPoints: [
        "IQC 在到货时查原材料与零部件；坏输入注定坏输出。",
        "IPQC 在生产中抽样，及早抓漂移、模具磨损与调机错误。",
        "FQC 在打包前按规格查成品。",
        "OQC 在发货前核实已打包批次的数量、标签与包装。",
        "跳过闸门的工厂省小钱、发你的风险；核实它跑了哪些。",
      ],
      steps: [
        { title: "为每个闸门定义接收标准", body: "为 IQC/IPQC/FQC/OQC 写明 AQL 或规格，使检查可比对而非随意。" },
        { title: "要 QC 计划", body: "索取供应商检验计划与近期记录；无计划即警告。" },
        { title: "加你自己的检验", body: "订出货前(FQC/OQC)验货，由独立检查在发货前确认批次。" },
        { title: "用 CAPA 闭环", body: "闸门失败时要求纠正与预防措施，避免同类缺陷重复。" },
      ],
      examples: [
        { title: "IQC 拦下次品", body: "来料检发现镀层厚度低于规格；在 IQC 叫停避免后续整批召回。" },
        { title: "无 IPQC 产线漂移", body: "换模后产线漂移且无 IPQC；缺陷仅在 FQC 暴露并拖垮整单。" },
      ],
      checklist: [
        "来料有 IQC 计划",
        "产线定义 IPQC 点",
        "成品按规格 FQC",
        "出货前 OQC（数量、标签、包装）",
        "每道闸门写明 AQL 或规格",
        "每批留存记录",
        "失败批次触发 CAPA",
        "已订独立出货前验货",
      ],
      faq: [
        { q: "FQC 等于出货前验货吗？", a: "FQC 是工厂自己的终检；出货前验货是你的独立核实，理想是两者都有。" },
        { q: "四道闸门都要吗？", a: "关键或高值物料要。简单货品至少 IQC 与 OQC 覆盖多数风险。" },
        { q: "供应商无 QC 计划怎么办？", a: "视为重大风险，加你自己的验货，或准入有计划的供应商。" },
      ],
      sources: [
        { name: "FactoryAuditB2B 验货服务", note: "独立 FQC/OQC 核实。" },
        { name: "AQL 抽样标准", note: "各闸门的通用接收规则。" },
      ],
    },
  },
  {
    slug: "ppap-production-part-approval",
    category: "audit",
    titleEn: "PPAP: Production Part Approval Process for Automotive and Precision Sourcing",
    titleZh: "PPAP 生产件批准流程：汽车与精密制造准入",
    metaDescEn:
      "What PPAP is, the 18 elements it requires, when it applies (automotive, aerospace, precision), and how to use it to qualify a supplier before mass production.",
    metaDescZh:
      "PPAP 是什么、它要求的 18 项要素、何时适用（汽车、航天、精密），以及如何用它在大批量前准入供应商。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/audit-checklist" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/factory-audit/request" },
    ],
    related: ["what-is-quality-management-system", "manufacturing-quality-control-process", "supplier-quality-audit-checklist"],
    en: {
      quickAnswer:
        "PPAP is the automotive-industry process that proves a supplier can make a part to spec, repeatedly, using the real production tool, line and process. It packages 18 elements (design records, FMEA, control plan, samples, capability studies) into one approval before mass production.",
      definition:
        "PPAP — Production Part Approval Process — is an AIAG standard used mainly in automotive, and adopted by aerospace and precision industries, to confirm that a supplier's production process can consistently deliver the approved part. It is the gate between prototype and full production.",
      keyPoints: [
        "PPAP proves the part is made on the actual production tool and process, not a one-off prototype.",
        "It bundles 18 elements: design records, DFMEA/PFMEA, control plan, capability studies, samples and more.",
        "It is triggered by new parts, engineering changes, tool moves and process shifts.",
        "A PPAP level defines how many elements the customer requires; level 3 is common.",
        "Without PPAP, a 'first article' that passes can still fail at volume.",
      ],
      steps: [
        { title: "Agree the PPAP level", body: "With the customer or buyer, set the required PPAP submission level and the part to be approved." },
        { title: "Build the 18 elements", body: "Assemble design records, FMEAs, control plan, process flow, capability studies (Cpk/Ppk) and sample parts from the real run." },
        { title: "Run a real production lot", body: "Produce the sample on the actual line and tool so the study reflects volume reality, not a demo." },
        { title: "Review and approve", body: "The buyer reviews the package; only on approval does mass production begin. Re-PPAP on defined changes." },
      ],
      examples: [
        { title: "Capability stopped a launch", body: "Cpk was below the required 1.33; PPAP caught it before volume, avoiding thousands of out-of-spec parts." },
        { title: "Tool move needed re-PPAP", body: "Moving the die to a new shop changed results; re-PPAP confirmed the process still held." },
      ],
      checklist: [
        "PPAP level agreed with the buyer",
        "Design records and change history complete",
        "DFMEA and PFMEA current",
        "Control plan matches the process",
        "Process flow documented",
        "Capability studies (Cpk/Ppk) meet the target",
        "Sample parts from the real production run",
        "Dimensional and material results on file",
        "Approval signed before mass production",
        "Re-PPAP triggers defined for changes",
      ],
      faq: [
        { q: "Is PPAP only for automotive?", a: "It originated in automotive (AIAG) but aerospace and precision sectors adopt it because the discipline transfers." },
        { q: "What Cpk is expected?", a: "Commonly 1.33 or higher for stable processes; the buyer sets the target in the control plan." },
        { q: "Do I need PPAP for simple parts?", a: "If the part is non-critical and the buyer does not require it, a lighter check may do; for safety or fit-critical parts, PPAP pays off." },
      ],
      sources: [
        { name: "AIAG PPAP standard", note: "The 18-element approval reference." },
        { name: "FactoryAuditB2B process audit", note: "Where the production process behind PPAP is verified." },
      ],
    },
    zh: {
      quickAnswer:
        "PPAP 是汽车行业流程，证明供应商能用真实生产工装、产线与工艺反复做出符合规格的零件。它把 18 项要素（设计记录、FMEA、控制计划、样件、能力研究）打包成量产前的单一批准。",
      definition:
        "PPAP（生产件批准流程）是主要用于汽车、也被航天与精密行业采用的 AIAG 标准，确认供应商生产工艺能持续交付已批准零件。它是原型与全面生产之间的闸门。",
      keyPoints: [
        "PPAP 证明零件是用真实生产工装与工艺制造，而非一次性原型。",
        "它捆绑 18 项要素：设计记录、DFMEA/PFMEA、控制计划、能力研究、样件等。",
        "触发条件含新零件、工程变更、工装搬迁与工艺变动。",
        "PPAP 等级定义客户要求多少要素；3 级常见。",
        "无 PPAP，通过的「首件」仍可能在量产失败。",
      ],
      steps: [
        { title: "约定 PPAP 等级", body: "与买方约定所需 PPAP 提交等级及待批准零件。" },
        { title: "构建 18 项", body: "汇总设计记录、FMEA、控制计划、过程流程、能力研究(Cpk/Ppk)与真实试产样件。" },
        { title: "跑真实生产批", body: "用实际产线与工装生产样件，使研究反映量产现实而非演示。" },
        { title: "评审批准", body: "买方审包；仅批准后才量产。定义变更时重做 PPAP。" },
      ],
      examples: [
        { title: "能力研究拦下上市", body: "Cpk 低于要求的 1.33；PPAP 在量产前拦下，避免数千件超差零件。" },
        { title: "工装搬迁需重做", body: "模具搬新厂结果变化；重做 PPAP 确认工艺仍稳。" },
      ],
      checklist: [
        "已与买方约定 PPAP 等级",
        "设计记录与变更史完整",
        "DFMEA 与 PFMEA 现行",
        "控制计划与工艺匹配",
        "过程流程已成文",
        "能力研究(Cpk/Ppk)达标",
        "样件来自真实生产批",
        "尺寸与材料结果已存档",
        "量产前批准已签",
        "已定义变更触发重做 PPAP",
      ],
      faq: [
        { q: "PPAP 只用于汽车？", a: "源于汽车(AIAG)，但航天与精密行业因其纪律可迁移而采用。" },
        { q: "期望 Cpk 多少？", a: "稳定过程通常 1.33 或更高；买方在控制计划中设定目标。" },
        { q: "简单零件需要 PPAP 吗？", a: "若零件非关键且买方不要求，轻量检查即可；安全或配合关键件，PPAP 物有所值。" },
      ],
      sources: [
        { name: "AIAG PPAP 标准", note: "18 项批准参考。" },
        { name: "FactoryAuditB2B 过程审核", note: "核实 PPAP 背后的生产工艺。" },
      ],
    },
  },
  {
    slug: "supplier-quality-audit-checklist",
    category: "audit",
    titleEn: "Supplier Quality Audit Checklist: The Quality Dimension Beyond a Basic Factory Audit",
    titleZh: "供应商质量审核清单：区别于常规验厂的质量维度",
    metaDescEn:
      "A quality-focused supplier audit checklist: system, incoming and in-process control, measurement and calibration, traceability and CAPA — the dimensions a basic audit misses.",
    metaDescZh:
      "以质量为中心的供应商审核清单：体系、来料与过程控制、量测与校准、可追溯性与 CAPA——常规验厂遗漏的维度。",
    updated: "2026-09-21",
    tools: [
      { href: "/tools/supplier-quality-checker" },
      { href: "/tools/audit-checklist" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/factory-audit/request" },
    ],
    related: ["manufacturing-quality-control-process", "what-is-quality-management-system", "iso-9001-vs-iso-13485"],
    en: {
      quickAnswer:
        "A supplier quality audit goes past 'is the factory real' to 'will it hold spec'. Check the QMS, incoming/IPQC controls, gauge calibration, batch traceability and CAPA discipline — the levers that keep your defect rate low across reorders.",
      definition:
        "A basic factory audit confirms a site exists and is safe; a supplier quality audit scores the quality system that decides whether your product is made right every time. It is the audit that protects repeat orders, not just the first one.",
      keyPoints: [
        "Score the QMS, not just the building: procedures, owners, records.",
        "Check incoming and in-process control points actually run on the line.",
        "Verify gauges and test equipment are calibrated and within date.",
        "Confirm batch traceability from material to finished unit.",
        "CAPA discipline shows whether defects are fixed or hidden.",
      ],
      steps: [
        { title: "Review the quality system", body: "Read the quality manual and procedures; confirm they exist and match the floor." },
        { title: "Walk the control points", body: "Observe IQC and IPQC in action; records should match what operators do." },
        { title: "Check calibration and measuring", body: "Inspect gauge logs and calibration stickers; out-of-date equipment invalidates checks." },
        { title: "Test traceability and CAPA", body: "Pick a batch and trace it end to end; open a past non-conformance to see if CAPA closed it." },
      ],
      examples: [
        { title: "Calibration gap", body: "A line used an expired caliper; the 'passed' dimensions were untrustworthy until recalibrated." },
        { title: "Traceability saved a recall", body: "Batch tracing isolated a bad lot to one material sub-supplier, limiting the impact." },
      ],
      checklist: [
        "Quality manual and procedures current",
        "IQC and IPQC running with records",
        "Gauges and testers calibrated, in-date",
        "Batch traceability material to finished unit",
        "Non-conformance handled by CAPA",
        "Training records for quality roles",
        "Management review of quality metrics",
        "Independent quality audit booked before qualification",
      ],
      faq: [
        { q: "Is this different from a factory audit?", a: "Yes. A factory audit checks existence and compliance; a quality audit scores the system that holds your spec. Both matter; this one protects reorders." },
        { q: "When do I need a quality audit?", a: "Before qualifying a supplier for recurring or critical orders, not just a one-off sample." },
        { q: "Can inspection replace it?", a: "Inspection catches a lot; a quality audit explains why defects happen and prevents them. Use both." },
      ],
      sources: [
        { name: "FactoryAuditB2B supplier quality audit", note: "The quality-dimension on-site audit." },
        { name: "ISO 9001 clause structure", note: "The system areas a quality audit scores." },
      ],
    },
    zh: {
      quickAnswer:
        "供应商质量审核不止问「工厂真实吗」，更问「能否守住规格」。查 QMS、来料/过程控制、量具校准、批次可追溯性与 CAPA 纪律——这些才是跨返单压低不良率的杠杆。",
      definition:
        "基础验厂确认厂区存在且安全；供应商质量审核为决定「产品是否每次都做对」的质量体系打分。它是保护返单而非仅首单的审核。",
      keyPoints: [
        "打的是 QMS 而非厂房：程序、负责人、记录。",
        "查来料与过程控制点是否真的在产线运行。",
        "核实量具与测试设备已校准且在有效期内。",
        "确认从物料到成品的批次可追溯。",
        "CAPA 纪律显示缺陷是被修还是被藏。",
      ],
      steps: [
        { title: "评审质量体系", body: "读质量手册与程序；确认存在且与现场一致。" },
        { title: "走查控制点", body: "观察 IQC 与 IPQC 实况；记录应与操作员动作一致。" },
        { title: "查校准与量测", body: "检量具台账与校准标签；过期设备使检查无效。" },
        { title: "测可追溯与 CAPA", body: "抽一批端到端追溯；打开一桩过往不合格看 CAPA 是否关闭。" },
      ],
      examples: [
        { title: "校准缺口", body: "产线用了过期卡尺；在校准前「通过」的尺寸不可信。" },
        { title: "可追溯避免召回", body: "批次追溯把坏批隔离到一家材料子供应商，限制影响。" },
      ],
      checklist: [
        "质量手册与程序现行有效",
        "IQC 与 IPQC 有记录运行",
        "量具与测试仪已校准在期",
        "批次可追溯物料到成品",
        "不合格以 CAPA 处理",
        "质量岗位培训记录",
        "质量指标管理层评审",
        "准入前已订独立质量审核",
      ],
      faq: [
        { q: "这和验厂不同吗？", a: "不同。验厂查存在与合规；质量审核为守规格的体系打分。两者都重要，后者护返单。" },
        { q: "何时需要质量审核？", a: "在准入 recurring 或关键订单的供应商前，而非仅一次性样品。" },
        { q: "验货能替代吗？", a: "验货拦一批；质量审核解释缺陷为何发生并预防。两者并用。" },
      ],
      sources: [
        { name: "FactoryAuditB2B 供应商质量审核", note: "质量维度的现场审核。" },
        { name: "ISO 9001 条款结构", note: "质量审核打分的体系区域。" },
      ],
    },
  },
  {
    slug: "verify-alibaba-supplier-before-paying",
    category: "verification",
    titleEn: "How to Verify an Alibaba Supplier Before Paying a Deposit",
    titleZh: "付定金前如何核验阿里巴巴供应商",
    metaDescEn:
      "Learn how to verify an Alibaba supplier before paying a deposit: confirm the legal entity, factory address, capability, certificates and payment entity with a 17-point buyer checklist.",
    metaDescZh:
      "付定金前核验阿里巴巴供应商的17项清单：核对法律主体、工厂地址、生产能力、证书与收款主体，判断何时必须改为现场验厂。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/services/china-factory-audit" },
    ],
    related: [
      "verify-supplier-before-deposit",
      "china-factory-or-trading-company",
      "how-to-check-china-company-registration",
      "alibaba-trade-assurance-safe-payment",
      "chinese-supplier-scam-red-flags",
    ],
    links: [
      { href: "/rfq", labelEn: "See live buyer requests", labelZh: "查看真实采购需求" },
      {
        href: "/suppliers",
        labelEn: "Browse supplier profiles with evidence on record",
        labelZh: "浏览带证据记录的供应商档案",
      },
      {
        href: "/factory-audit/request",
        labelEn: "Request an on-site factory audit",
        labelZh: "申请现场工厂验厂",
      },
    ],
    en: {
      quickAnswer:
        "Before paying a deposit, verify five things: the legal entity behind the storefront (Chinese registered name and Unified Social Credit Code), the address where your product will actually be made, the manufacturing capability for your specific product, the certificates and test reports required in your market, and the bank entity that will receive your money. Alibaba badges and Trade Assurance describe platform activity, not manufacturing. If any of these five cannot be evidenced in documents, treat the deposit as unsecured: request further evidence first, or commission an on-site audit.",
      definition:
        "Alibaba supplier verification is the process of confirming that the company behind a platform storefront is a legally registered entity that actually manufactures, or legitimately controls the manufacture of, the product you intend to buy. It combines business registration checks, address matching, capability evidence, document review and payment-entity checks. It is not the same as a factory audit: verification can largely be completed from documents and public records, while an audit requires a physical site visit and is the only method that can confirm production reality on the day of the visit.",
      keyPoints: [
        "A Gold Supplier badge, years-on-platform or response rate describe platform activity. They are not evidence of manufacturing capability.",
        "Match the Unified Social Credit Code to the Chinese registered name. The English trading name shown on the platform is usually not the legal entity.",
        "A business licence proves that a company is registered to exist. It does not prove that the company owns or operates a factory.",
        "If the bank account beneficiary differs from the legal entity on the licence, treat the payment as high risk regardless of how professional the communication is.",
        "Subcontracting is common and is not inherently fraudulent, but you should know who actually makes your product and where.",
        "Document checks can be completed in days; an on-site audit is the only way to confirm that production equipment and staff are actually there.",
      ],
      steps: [
        {
          title: "Verify the legal company name",
          body: "Ask for the Chinese registered name, the Unified Social Credit Code (an 18-character code on the business licence) and a copy of the licence. Confirm that the registered name on the licence matches the entity you will contract with. The English name on the storefront is a marketing label and carries no legal weight.",
        },
        {
          title: "Decide whether the counterparty is a factory or a trading company",
          body: "Read the registered business scope on the licence. Manufacturing scope typically names the product category and includes production or processing wording; a trading scope is usually limited to sales, wholesale, import and export. A company can hold both, so read the scope rather than the self-description.",
        },
        {
          title: "Match the factory address to the production site",
          body: "Compare the registered address, the address quoted for production and the address that will appear on export documents. A registered address in an office building while production is claimed elsewhere is normal, but you need the production address in writing, because that is the address an auditor would visit.",
        },
        {
          title: "Verify manufacturing capability for your product",
          body: "Request the equipment list, the number of production lines, shift pattern and monthly capacity for your product category specifically. Capability is product-specific: a factory that makes stainless steel fabrication is not automatically capable of making your injection-moulded housing.",
        },
        {
          title: "Check certificates and test reports against the legal entity",
          body: "ISO 9001, product test reports and market-specific approvals must name the same legal entity and cover the product and scope you are buying. A certificate issued to a parent company, a sister company or an expired scope is not evidence for your order.",
        },
        {
          title: "Verify bank and contract information",
          body: "The beneficiary of the bank account should be the legal entity on the business licence, or an entity the supplier can document as its own export arm. Requests to pay a personal account, a third-party account or an unrelated company name are the single most reliable fraud signal in cross-border sourcing.",
        },
        {
          title: "Check subcontracting risk",
          body: "Ask directly which operations are performed in-house and which are subcontracted, and ask for the subcontractor names. Uncontrolled subcontracting is how quality and compliance obligations quietly move to a facility nobody has assessed.",
        },
        {
          title: "Decide whether documentary verification is enough",
          body: "If the order value is low and the documents are consistent, documented verification may be sufficient. If the order is large, the product carries safety or compliance risk, or the evidence is incomplete, an on-site audit is the appropriate next step before the deposit is released.",
        },
      ],
      examples: [
        {
          title: "Mistake: treating the platform badge as verification",
          body: "A buyer saw five years of Gold Supplier history and assumed the supplier was a factory. The business scope on the licence was wholesale and import-export only. The goods were made by an unnamed third workshop, and the buyer had no contractual relationship with the actual manufacturer.",
        },
        {
          title: "Mistake: paying a bank account that does not match the licence",
          body: "The pro forma invoice named one company while the bank beneficiary was a different entity in another city. The supplier explained it as an export agent. When the shipment failed inspection, the buyer had no enforceable claim against the entity that received the money.",
        },
        {
          title: "Example: consistent evidence chain",
          body: "The licence name, the ISO 9001 certificate, the test report and the bank beneficiary all named the same legal entity, and the quoted production address matched the address on the export documents. That consistency is what reduces risk, not the badge count.",
        },
      ],
      checklist: [
        "Chinese registered name obtained, not only the English storefront name.",
        "Unified Social Credit Code captured from the business licence.",
        "Registered business scope read and understood (manufacturing vs trading).",
        "Registered capital and establishment date reviewed for plausibility against claimed scale.",
        "Production address confirmed in writing and distinct from the registered office if different.",
        "Equipment list and line count provided for your product category.",
        "Monthly capacity stated and cross-checked against your order volume.",
        "Quality system certificate valid, in scope, and naming the same legal entity.",
        "Product test reports issued by an accredited laboratory for your destination market.",
        "Bank beneficiary name identical to the legal entity on the licence.",
        "Contract signed by, or on behalf of, the same legal entity.",
        "Subcontracted operations disclosed, with subcontractor identity where applicable.",
        "Export experience evidenced by previous shipment records to your market.",
        "Sample produced on the quoted production line, not sourced elsewhere.",
        "Red-flag scan completed: pressure tactics, unusual payment routing, reluctance to share the licence.",
        "Deposit amount limited to what you could lose without a legal claim.",
        "Decision recorded: proceed, request more evidence, or commission an audit.",
      ],
      tables: [
        {
          title: "17-Point Alibaba Supplier Verification Checklist",
          headers: ["#", "Check", "Acceptable evidence", "Risk if missing"],
          rows: [
            ["1", "Chinese registered name", "Copy of business licence", "You may be contracting an entity that does not exist"],
            ["2", "Unified Social Credit Code", "18-character code on the licence", "No way to confirm registration status"],
            ["3", "Legal entity status", "Registration record shows active, not revoked", "Contract may be unenforceable"],
            ["4", "Establishment date", "Date on the licence", "Claimed experience may be fabricated"],
            ["5", "Registered capital", "Amount on the licence", "Scale claims may be unsupported"],
            ["6", "Business scope", "Manufacturing or trading wording", "You may be buying from an intermediary"],
            ["7", "Legal representative", "Name on the licence matches signatory", "Signature may not bind the company"],
            ["8", "Registered address", "Licence address", "Cannot locate the entity if disputes arise"],
            ["9", "Production address", "Written confirmation, site photos with geolocation", "Audit and inspection cannot be correctly scoped"],
            ["10", "Equipment list", "Machine inventory for your process", "Capability claims unverified"],
            ["11", "Production capacity", "Lines x shifts x monthly output", "Delivery dates may be unrealistic"],
            ["12", "Quality system certificate", "Valid ISO 9001 naming the same entity", "No systematic process control"],
            ["13", "Product test reports", "Accredited lab report for your market", "Compliance and safety risk"],
            ["14", "Bank beneficiary", "Account name equals legal entity", "Payment recovery risk"],
            ["15", "Export record", "Prior shipment documentation", "Unknown experience with your market"],
            ["16", "Subcontracting disclosure", "Written statement of outsourced steps", "Hidden compliance and quality exposure"],
            ["17", "Deposit exposure", "Deposit sized to an acceptable loss", "Disproportionate loss if the deal fails"],
          ],
        },
        {
          title: "Platform Signals vs Independent Verification",
          headers: ["Signal", "What it actually tells you", "What it does not tell you"],
          rows: [
            ["Gold Supplier membership", "The company paid for a platform membership tier", "Whether it manufactures anything"],
            ["Years on platform", "Account age", "Whether the entity or ownership changed"],
            ["Trade Assurance coverage", "The platform holds a dispute mechanism for covered orders", "Product quality, compliance or factory existence"],
            ["Response rate", "Communication behaviour", "Production reality"],
            ["On-site check by platform", "A visit occurred at some point by some party", "Current capability for your product, or who owns the site"],
            ["Verified supplier badge", "The platform validated specific documents it chose to check", "That the documents cover your product and order"],
          ],
        },
      ],
      faq: [
        {
          q: "How do I verify an Alibaba supplier before paying?",
          a: "Confirm the Chinese registered name and Unified Social Credit Code, read the business scope to tell factory from trading company, get the production address in writing, check capability evidence for your product, confirm certificates name the same entity, and make sure the bank beneficiary matches the licence. Complete all of these before releasing a deposit.",
        },
        {
          q: "Is Trade Assurance enough protection when paying a deposit?",
          a: "Trade Assurance is a platform dispute and payment-holding mechanism with defined coverage limits and eligibility rules. It addresses order disputes, not the underlying question of whether the supplier can manufacture your product or whether the factory exists. Treat it as a payment safeguard layered on top of verification, not as a substitute for it.",
        },
        {
          q: "Can I verify a Chinese supplier without visiting the factory?",
          a: "Yes, documentary verification covers registration, scope, address plausibility, certificates, test reports and payment entity, and can be completed remotely in days. What it cannot confirm is production reality: that the equipment, staff and processes exist at the stated site. That requires an on-site audit.",
        },
        {
          q: "How do I check if an Alibaba supplier is a real factory?",
          a: "Read the registered business scope on the business licence for manufacturing wording, compare the registered address with the stated production address, request the equipment list and line count, and check whether certificates name the same legal entity. A video walkthrough showing the company name at the entrance is supporting evidence, not proof on its own.",
        },
        {
          q: "What is a Unified Social Credit Code?",
          a: "It is the 18-character identifier issued to every registered entity in China and printed on the business licence. It is the most reliable single key for confirming that a company is legally registered, and it is the reference you should use when checking registration status and matching a supplier to its certificates.",
        },
        {
          q: "Should I pay the deposit to a personal bank account?",
          a: "No. A request to pay an individual, a third-party company or an unrelated entity is a well-established fraud pattern. The beneficiary should be the legal entity named on the business licence, or an export entity the supplier can document as its own.",
        },
        {
          q: "When should I order a factory audit instead of just checking documents?",
          a: "Order an audit when the order value is material, the product carries safety, regulatory or customer-mandated compliance risk, the evidence chain is inconsistent, or the supplier is new to you and claims capability you cannot verify any other way. Document checks answer whether the paperwork is consistent; an audit answers whether the factory is real.",
        },
      ],
      sources: [
        {
          name: "Alibaba.com platform documentation",
          note: "Describes what supplier badges, membership tiers and Trade Assurance cover, and the limits of platform-held protections.",
        },
        {
          name: "State Administration for Market Regulation (SAMR), China",
          note: "The national authority for enterprise registration; the Unified Social Credit Code and registered business scope are issued and recorded here.",
        },
        {
          name: "FactoryAuditB2B Methodology",
          note: "How this site defines evidence levels and risk scores, and why a risk score is decision support rather than certification.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "付定金前必须核验五件事：店铺背后的法律主体（中文注册名与统一社会信用代码）、产品实际生产地址、针对你产品的具体生产能力、目标市场要求的证书与检测报告，以及最终收款的银行主体。阿里巴巴的徽章与信保描述的是平台活跃度，不是制造能力。这五项中任何一项拿不出文件证据，就该把这笔定金视为无保障：先补证据，或直接做现场验厂。",
      definition:
        "阿里巴巴供应商核验，是确认平台店铺背后公司是否为合法注册主体，且该主体是否真实生产、或合法掌控你所购产品生产的过程。它结合工商登记核查、地址比对、能力证据、文件审阅与收款主体核验。它不等同于验厂：核验主要靠文件与公开记录完成，而验厂必须到现场，是唯一能确认「访问当天生产真实存在」的方法。",
      keyPoints: [
        "金牌供应商徽章、在平台年限、回复率描述的是平台活跃度，不是制造能力的证据。",
        "把统一社会信用代码与中文注册名对上；平台展示的英文商号通常不是法律主体。",
        "营业执照只证明公司合法注册存在，不证明这家公司拥有或运营工厂。",
        "若银行账户收款人与执照上的法律主体不一致，无论沟通多专业，都应视为高风险付款。",
        "分包很常见，本身不等于欺诈，但你必须知道产品实际是谁、在哪里生产的。",
        "文件核查几天可完成；现场验厂是唯一能确认设备与人员真实存在的方式。",
      ],
      steps: [
        {
          title: "核验法律主体名称",
          body: "索取中文注册名、统一社会信用代码（执照上的18位代码）与执照复印件，确认执照上的注册名与你将签约的主体一致。店铺展示的英文名称只是营销标签，没有法律效力。",
        },
        {
          title: "判断交易对手是工厂还是贸易公司",
          body: "看执照上的经营范围。生产类经营范围通常会写明产品类别并含生产、加工等表述；贸易类范围通常仅限销售、批发、进出口。一家公司可以同时具备两类资质，所以要看经营范围而不是对方的自我描述。",
        },
        {
          title: "把工厂地址与实际生产地对上",
          body: "比对注册地址、对方声称的生产地址、以及将来出现在出口单证上的地址。注册地在写字楼而生产在别处很常见，但你需要拿到书面的生产地址，因为那才是审核员会去现场的地址。",
        },
        {
          title: "核验针对你产品的生产能力",
          body: "索取设备清单、产线数量、班次安排，以及针对你所在产品类别的月产能。能力是产品特定的：会做不锈钢钣金的工厂，不等于能做你的注塑外壳。",
        },
        {
          title: "核对证书与检测报告是否指向同一主体",
          body: "ISO 9001、产品检测报告与市场准入认证，必须写明同一法律主体，且覆盖你所购产品与范围。开给母公司、兄弟公司或已过期范围的证书，不构成你这笔订单的证据。",
        },
        {
          title: "核验银行与合同信息",
          body: "银行账户收款人应当是执照上的法律主体，或者是供应商能证明为其自有出口主体的实体。要求付款到个人账户、第三方账户或无关公司名下的账户，是跨境采购中最可靠的欺诈信号。",
        },
        {
          title: "排查分包风险",
          body: "直接问哪些工序自制、哪些外包，并要求提供外协厂名称。失控的分包，正是质量与合规义务悄悄转移到一家无人评估过的工厂的路径。",
        },
        {
          title: "判断文件核验是否足够",
          body: "订单金额小且文件一致时，文件核验可能已足够。订单金额大、产品涉及安全或合规风险、或证据链不完整时，在放出定金前做现场验厂才是合适的下一步。",
        },
      ],
      examples: [
        {
          title: "错误做法：把平台徽章当成核验",
          body: "买家看到五年金牌供应商记录，就认定对方是工厂。但执照经营范围只有批发与进出口。货物由一家未披露的第三方作坊生产，买家与真正的制造商之间没有任何合同关系。",
        },
        {
          title: "错误做法：付款到与执照不符的账户",
          body: "形式发票写的是甲公司，银行收款人却是异地另一家实体，供应商解释为出口代理。货物验货失败后，买家对实际收款方没有任何可执行的索赔依据。",
        },
        {
          title: "正面示例：证据链一致",
          body: "执照名称、ISO 9001 证书、检测报告与银行收款人四者都指向同一法律主体，且报价中的生产地址与出口单证一致。降低风险的是这种一致性，而不是徽章数量。",
        },
      ],
      checklist: [
        "已拿到中文注册名，而不只是英文店铺名。",
        "已从营业执照上取得统一社会信用代码。",
        "已阅读并理解经营范围（生产类还是贸易类）。",
        "已核对注册资本与成立日期是否与声称规模相符。",
        "已书面确认生产地址，如与注册地不同需分别记录。",
        "已取得针对你产品类别的设备清单与产线数量。",
        "已取得月产能，并与你的订单量交叉核对。",
        "质量体系证书有效、范围正确且指向同一法律主体。",
        "产品检测报告由认可实验室出具，覆盖你的目标市场。",
        "银行收款人名称与执照上的法律主体完全一致。",
        "合同由同一法律主体签署或授权签署。",
        "已书面披露外包工序，并在适用时提供外协方身份。",
        "已有发往你目标市场的既往出货记录作为出口经验证据。",
        "样品是在报价产线上生产的，而非外购。",
        "已完成红旗扫描：施压话术、异常付款路径、不愿提供执照。",
        "定金金额已控制在「即使没有索赔权也可承受」的范围内。",
        "已记录决策：继续、补充证据，或委托验厂。",
      ],
      tables: [
        {
          title: "阿里巴巴供应商17项核验清单",
          headers: ["#", "核验项", "可接受的证据", "缺失的后果"],
          rows: [
            ["1", "中文注册名", "营业执照复印件", "你可能在与一个不存在的主体签约"],
            ["2", "统一社会信用代码", "执照上的18位代码", "无法确认注册状态"],
            ["3", "主体状态", "登记记录显示在营而非吊销", "合同可能不可执行"],
            ["4", "成立日期", "执照上的日期", "声称的经验年限可能造假"],
            ["5", "注册资本", "执照上的金额", "规模声称可能无依据"],
            ["6", "经营范围", "生产类或贸易类表述", "你可能是在向中间商采购"],
            ["7", "法定代表人", "执照上的姓名与签字人一致", "签字可能无法约束公司"],
            ["8", "注册地址", "执照地址", "发生纠纷时找不到主体"],
            ["9", "生产地址", "书面确认，含定位的现场照片", "验厂与验货无法正确界定范围"],
            ["10", "设备清单", "对应你工艺的机器清单", "能力声称未经验证"],
            ["11", "生产能力", "产线数×班次×月产量", "交期承诺可能不现实"],
            ["12", "质量体系证书", "有效的ISO 9001且指向同一主体", "缺乏系统化的过程控制"],
            ["13", "产品检测报告", "认可实验室针对目标市场的报告", "合规与安全风险"],
            ["14", "银行收款人", "账户名等于法律主体", "付款回收风险"],
            ["15", "出口记录", "既往出货单证", "对目标市场经验不明"],
            ["16", "分包披露", "外包工序的书面说明", "隐藏的合规与质量敞口"],
            ["17", "定金敞口", "定金规模在可承受损失内", "交易失败时损失不成比例"],
          ],
        },
        {
          title: "平台信号与独立核验的区别",
          headers: ["信号", "它实际告诉你什么", "它不能告诉你什么"],
          rows: [
            ["金牌供应商会员", "这家公司购买了平台会员等级", "它是否生产任何东西"],
            ["在平台年限", "账号注册时长", "主体或股权是否变更过"],
            ["信保覆盖", "平台对符合条件的订单提供争议机制", "产品质量、合规性或工厂是否存在"],
            ["回复率", "沟通行为", "生产真实情况"],
            ["平台实地核验", "某时曾有某方到访过", "当前对你产品的能力，或场地归属"],
            ["已核验供应商徽章", "平台验证过它选择核查的特定文件", "这些文件是否覆盖你的产品与订单"],
          ],
        },
      ],
      faq: [
        {
          q: "付定金前如何核验阿里巴巴供应商？",
          a: "确认中文注册名与统一社会信用代码；通过经营范围判断工厂还是贸易公司；书面取得生产地址；核验针对你产品的能力证据；确认证书指向同一主体；并确保银行收款人与执照一致。全部完成再放定金。",
        },
        {
          q: "有信保（Trade Assurance）就够了吗？",
          a: "信保是平台提供的争议与货款保全机制，有明确的保障上限与适用规则，解决的是订单争议，而不是「供应商能否生产你的产品」或「工厂是否存在」这个根本问题。应把它当作叠在核验之上的付款保障，而非核验的替代品。",
        },
        {
          q: "不去工厂现场能核验中国供应商吗？",
          a: "可以。文件核验覆盖注册、经营范围、地址合理性、证书、检测报告与收款主体，几天内可远程完成。它无法确认的是生产真实性，即设备、人员与流程是否真在所称场地存在——那需要现场验厂。",
        },
        {
          q: "怎么判断阿里巴巴供应商是不是真工厂？",
          a: "查看执照经营范围是否有生产类表述；比对注册地址与声称的生产地址；索取设备清单与产线数量；核对证书是否指向同一法律主体。展示门口公司名称的视频是辅助证据，本身不构成证明。",
        },
        {
          q: "统一社会信用代码是什么？",
          a: "是中国发给每个注册主体的18位标识符，印在营业执照上。它是确认公司是否合法注册最可靠的单一索引，也是你在核查注册状态、以及把供应商与其证书对应起来时应使用的参照。",
        },
        {
          q: "可以把定金付到个人账户吗？",
          a: "不可以。要求付款给个人、第三方公司或无关实体，是跨境采购中公认的欺诈模式。收款人应当是执照上的法律主体，或供应商能证明为其自有的出口主体。",
        },
        {
          q: "什么时候该做验厂而不是只查文件？",
          a: "当订单金额重大、产品涉及安全/法规/客户强制合规风险、证据链不一致，或供应商是新合作方且声称的能力无法通过其他方式验证时，应做验厂。文件核查回答的是「文件是否自洽」，验厂回答的是「工厂是否真实」。",
        },
      ],
      sources: [
        { name: "阿里巴巴平台规则文档", note: "说明供应商徽章、会员等级与信保的覆盖范围，以及平台保障机制的边界。" },
        { name: "中国国家市场监督管理总局（SAMR）", note: "全国企业登记机关；统一社会信用代码与经营范围由其核发并记录。" },
        { name: "FactoryAuditB2B 方法论", note: "本站如何定义证据等级与风险评分，以及为何风险评分只是决策参考而非认证。" },
      ],
    },
  },
  {
    slug: "china-factory-or-trading-company",
    category: "verification",
    titleEn: "Factory or Trading Company? How to Check Your Chinese Supplier",
    titleZh: "工厂还是贸易公司？如何判断中国供应商的真实身份",
    metaDescEn:
      "How to tell whether a Chinese supplier is a factory or a trading company: read the business scope, match addresses, check equipment evidence, export records and certificates against the legal entity.",
    metaDescZh:
      "判断中国供应商是工厂还是贸易公司：看经营范围、比对注册地址与生产地址、核验设备证据、出口记录与证书是否指向同一法律主体。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/services/china-factory-audit" },
    ],
    related: [
      "verify-alibaba-supplier-before-paying",
      "how-to-check-china-company-registration",
      "how-to-verify-a-chinese-supplier",
      "supplier-evaluation-checklist",
      "chinese-supplier-scam-red-flags",
    ],
    links: [
      { href: "/rfq", labelEn: "Post a buyer RFQ", labelZh: "发布采购需求" },
      {
        href: "/suppliers",
        labelEn: "Compare supplier profiles by company type",
        labelZh: "按公司类型比较供应商档案",
      },
    ],
    en: {
      quickAnswer:
        "Read the registered business scope on the Chinese business licence first. Manufacturing scope names the product category and includes production or processing wording; a trading scope is usually limited to sales, wholesale and import-export. Then cross-check three things: whether the registered address and the stated production address match, whether the equipment and capacity evidence is specific to your product, and whether certificates such as ISO 9001 name the same legal entity. A trading company is not automatically a problem, but you should know who actually manufactures your product before you pay.",
      definition:
        "In China, a factory (manufacturer) holds a business licence whose registered scope permits production or processing of goods, and typically owns or leases the production site and equipment. A trading company holds a licence whose scope permits sale, wholesale and import-export, and buys from manufacturers to resell. The distinction matters because contracts, quality obligations, audit scope and compliance responsibility usually sit with whoever actually controls production, which is not always the entity that signs your contract.",
      keyPoints: [
        "The registered business scope on the licence is the most direct evidence; self-description on a website or platform profile is not.",
        "A company can hold both manufacturing and trading scope, so read the scope rather than accepting a label.",
        "The registered address is frequently an office; the production address is what matters for audits and inspections.",
        "Certificates naming a different legal entity do not transfer to the company you are contracting.",
        "A trading company can be commercially useful: consolidation, smaller MOQs, export handling and communication.",
        "The risk is not that an intermediary exists, but that you do not know the actual manufacturer when compliance or quality is at stake.",
      ],
      steps: [
        {
          title: "Obtain the business licence and read the scope",
          body: "Ask for a copy of the business licence and read the registered scope in Chinese. Production wording tied to your product category indicates manufacturing scope. Scope limited to sales, wholesale, import and export indicates a trading company.",
        },
        {
          title: "Compare the registered address with the production address",
          body: "A manufacturer's production site is usually where its equipment is; a trading company often quotes a manufacturer's address as its own. Ask which address will appear on export documents and which address an auditor should visit.",
        },
        {
          title: "Ask for production equipment evidence",
          body: "A factory can list its machines, line count, shift pattern and output. A trading company usually cannot produce equipment evidence for your product because it does not own the equipment. Vague or stock-photo responses are a signal, not proof of either.",
        },
        {
          title: "Check employee numbers and capacity claims",
          body: "Cross-check headcount, social insurance records where available, and stated monthly capacity against the order size you plan. Capacity claimed without any link to equipment or staffing is assertion, not evidence.",
        },
        {
          title: "Match certificates to the legal entity",
          body: "ISO 9001, product certifications and test reports must name the entity that will manufacture your product. If a certificate names a different company, ask for the contractual relationship that makes it applicable to your order.",
        },
        {
          title: "Review export documentation",
          body: "Export records, customs documentation and previous bills of lading show whether the entity exports in its own name. A trading company exporting in its own name is normal; what you need is clarity on who is the manufacturer of record.",
        },
        {
          title: "Decide what level of identity certainty you need",
          body: "For low-risk, low-value goods, knowing you are dealing with a trading company may be enough. Where product safety, customer-mandated compliance or IP is at stake, identify the actual manufacturer and have it assessed or audited.",
        },
      ],
      examples: [
        {
          title: "Signal: scope says trading, profile says manufacturer",
          body: "The platform profile described a factory with 200 staff. The licence scope listed only wholesale and import-export, and the equipment list could not be produced. The supplier was a trading company buying from two workshops it would not name.",
        },
        {
          title: "Signal: equipment evidence is product-specific and consistent",
          body: "The supplier provided a machine list matching the process, stated a capacity consistent with the line count, and its ISO certificate named the same entity at the stated production address. The evidence chain supported the manufacturing claim.",
        },
        {
          title: "Acceptable outcome: trading company, disclosed",
          body: "A buyer sources five product lines through one trading company that consolidates shipments and handles export formalities, and the buyer has separately audited the two named factories. The intermediary adds value and the manufacturer is known.",
        },
      ],
      checklist: [
        "Business licence obtained and the registered scope read in Chinese.",
        "Scope checked for production or processing wording for your product category.",
        "Registered address recorded separately from the stated production address.",
        "Equipment list requested and assessed for relevance to your process.",
        "Line count, shifts and monthly capacity stated and cross-checked.",
        "Headcount and staffing claims checked against claimed output.",
        "ISO 9001 and product certificates checked for the same legal entity name.",
        "Certificate scope verified as covering your product, not just the company.",
        "Export documentation reviewed to see who exports in whose name.",
        "Subcontracted operations disclosed in writing.",
        "Whether the supplier permits a site visit at the production address confirmed.",
        "Decision recorded: acceptable as intermediary, or manufacturer must be identified and assessed.",
      ],
      tables: [
        {
          title: "Factory vs Trading Company: Evidence Signals",
          headers: ["Evidence", "Manufacturer signal", "Trading company signal"],
          rows: [
            ["Registered business scope", "Names product category with production or processing wording", "Limited to sales, wholesale, import-export"],
            ["Registered address", "Often the production site or an office at the same site", "Office address, production site elsewhere and unnamed"],
            ["Equipment list", "Can list machines, lines and output for the process", "Cannot produce equipment evidence for the product"],
            ["Capacity statement", "Tied to lines, shifts and staffing", "Stated without link to equipment or staff"],
            ["ISO 9001 certificate", "Issued to the same entity at the production address", "Issued to another entity, or not available"],
            ["Product test reports", "Applicant is the manufacturer", "Applicant is a trading entity or unrelated company"],
            ["Export records", "Exports in own name as manufacturer of record", "Exports in own name as seller, manufacturer not identified"],
            ["Site visit response", "Welcomes a visit to the stated production site", "Deflects, or offers a visit to an unrelated showroom"],
          ],
        },
        {
          title: "Is a Trading Company a Problem?",
          headers: ["Situation", "Assessment", "What to do"],
          rows: [
            ["Small order, standard product, disclosed intermediary", "Low risk", "Contract the trading company, confirm product specification in writing"],
            ["Consolidation across several factories", "Useful, if factories are known", "Ask for the factory list and assess the one making your product"],
            ["Intermediary will not name the manufacturer", "High risk", "Treat as unverified; do not rely on compliance claims"],
            ["Customer requires SMETA, BSCI or RBA at the production site", "Identity is critical", "Identify the manufacturer and audit that site, not the intermediary"],
            ["Product safety, certification or IP exposure", "Identity is critical", "Contract with the manufacturer, or obtain its written commitment and audit rights"],
          ],
        },
      ],
      faq: [
        {
          q: "How do I tell if a Chinese supplier is a factory or a trading company?",
          a: "Start with the registered business scope on the business licence: production or processing wording indicates a manufacturer, while sales, wholesale and import-export wording indicates a trading company. Then confirm with equipment evidence, address matching and certificates issued to the same legal entity.",
        },
        {
          q: "Is a trading company bad?",
          a: "No. A trading company can add real value through consolidation, smaller minimum order quantities, export formalities and communication. The problem is not the intermediary itself, it is not knowing who actually manufactures the product when quality, safety or compliance obligations are at stake.",
        },
        {
          q: "Can a company be both a factory and a trading company?",
          a: "Yes. Many Chinese companies hold both manufacturing and trading scope, and some manufacture part of their range while reselling the rest. This is why the business scope should be read rather than relying on a self-declared label.",
        },
        {
          q: "Does ISO 9001 prove the supplier is a manufacturer?",
          a: "Not on its own. ISO 9001 certifies a quality management system for a named entity and scope. It proves the certificate holder operates a documented quality system, not that it owns production equipment. Check that the certificate names the entity making your product and that the scope covers it.",
        },
        {
          q: "Why does the registered address differ from the factory address?",
          a: "It is common for the registered address to be an office or a registered agent address while production happens elsewhere. That is normal, but you need the actual production address in writing because that is the site an audit or inspection would cover.",
        },
        {
          q: "Should I audit the trading company or the factory?",
          a: "Audit the site where your product is made. Auditing an intermediary's office tells you little about production capability, working conditions or process control. If the intermediary will not identify the factory, that itself is the finding.",
        },
      ],
      sources: [
        {
          name: "State Administration for Market Regulation (SAMR), China",
          note: "Issues the business licence and records the registered business scope, which is the primary evidence of manufacturing versus trading status.",
        },
        {
          name: "ISO (International Organization for Standardization)",
          note: "Publishes ISO 9001 and maintains the certification framework; certificates are issued to a named entity and a defined scope.",
        },
        {
          name: "FactoryAuditB2B Methodology",
          note: "How evidence levels are assigned when a supplier's identity and production site cannot be matched to the contracting entity.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "先看营业执照上的经营范围。生产类范围会写明产品类别并含生产、加工等表述；贸易类范围通常仅限销售、批发、进出口。再交叉核对三件事：注册地址与声称的生产地址是否一致；设备与产能证据是否针对你的产品；ISO 9001 等证书是否指向同一法律主体。贸易公司本身不是问题，但付款前你必须知道产品到底是谁生产的。",
      definition:
        "在中国，工厂（制造商）持有的营业执照，其经营范围允许生产或加工货物，通常拥有或租赁生产场地与设备；贸易公司持有的执照，其经营范围允许销售、批发与进出口，通过向制造商采购后转售。这个区分很重要，因为合同、质量义务、审核范围与合规责任通常落在实际控制生产的一方，而它并不总是与你签约的那一方。",
      keyPoints: [
        "执照上的经营范围是最直接的证据；网站或平台主页上的自我描述不是。",
        "一家公司可以同时具备生产与贸易两类经营范围，所以要看范围而不是接受标签。",
        "注册地址常常是办公室；对验厂与验货而言，重要的是生产地址。",
        "证书上写的是另一家法律主体，则该证书不能转移给你正在签约的公司。",
        "贸易公司可以很有商业价值：拼柜整合、更低起订量、出口手续与沟通。",
        "风险不在于中间商存在，而在于当合规或质量出问题时，你不知道真正的制造商是谁。",
      ],
      steps: [
        {
          title: "取得营业执照并阅读经营范围",
          body: "索取营业执照复印件，阅读中文的经营范围。与你产品类别绑定的生产类表述说明具备生产资质；仅限销售、批发、进出口的范围说明是贸易公司。",
        },
        {
          title: "比对注册地址与生产地址",
          body: "制造商的生产场地通常就是设备所在地；贸易公司常把制造商的地址当作自己的来报。要问清楚哪个地址会出现在出口单证上、审核员应该去哪个地址。",
        },
        {
          title: "索取生产设备证据",
          body: "工厂能列出机器、产线数、班次与产量。贸易公司通常拿不出针对你产品的设备证据，因为设备不是它的。回答含糊或用图库照片是信号，但不足以单独证明任一种身份。",
        },
        {
          title: "核对员工人数与产能声称",
          body: "把人数、可获得的社保记录、以及声称的月产能，与你计划的订单量交叉核对。没有与设备或人员挂钩的产能声称只是断言，不是证据。",
        },
        {
          title: "把证书与法律主体对上",
          body: "ISO 9001、产品认证与检测报告必须写明将生产你产品的主体。若证书写的是另一家公司，要求对方说明使其适用于你订单的合同关系。",
        },
        {
          title: "审阅出口单证",
          body: "出口记录、报关单证与既往提单能显示该主体是否以自己名义出口。贸易公司以自己名义出口很正常；你需要明确的是谁是其记录中的制造商。",
        },
        {
          title: "判断你需要多高的身份确定性",
          body: "低风险低值商品，知道对方是贸易公司可能就够了。涉及产品安全、客户强制合规或知识产权时，必须识别真正的制造商并对其评估或验厂。",
        },
      ],
      examples: [
        {
          title: "信号：范围写贸易，主页写工厂",
          body: "平台主页描述一家200人的工厂，但执照经营范围只有批发与进出口，且拿不出设备清单。这家供应商是贸易公司，从两家它不愿透露的作坊采购。",
        },
        {
          title: "信号：设备证据产品对口且一致",
          body: "供应商提供了与工艺匹配的机器清单，声称的产能与产线数量一致，其 ISO 证书又指向同一主体且位于所称生产地址。证据链支持其制造声称。",
        },
        {
          title: "可接受的结果：贸易公司，但已披露",
          body: "买家通过一家贸易公司采购五条产品线，由其拼柜并处理出口手续，同时买家已分别对两家点名的工厂做过验厂。中间商创造了价值，且制造商是已知的。",
        },
      ],
      checklist: [
        "已取得营业执照，并阅读了中文经营范围。",
        "已核对经营范围中是否有针对你产品类别的生产或加工表述。",
        "已分别记录注册地址与声称的生产地址。",
        "已索取设备清单，并评估其与你的工艺是否相关。",
        "已取得产线数、班次与月产能并交叉核对。",
        "已把人数与用工声称同声称产量核对。",
        "已核对 ISO 9001 与产品证书上的法律主体名称是否一致。",
        "已确认证书范围覆盖你的产品，而不只是这家公司。",
        "已审阅出口单证，看清谁以谁的名义出口。",
        "已书面披露外包工序。",
        "已确认对方是否允许到所称生产地址实地走访。",
        "已记录决策：可作为中间商接受，或必须识别制造商并评估。",
      ],
      tables: [
        {
          title: "工厂与贸易公司的证据信号对照",
          headers: ["证据", "制造商信号", "贸易公司信号"],
          rows: [
            ["经营范围", "写明产品类别并含生产、加工表述", "仅限销售、批发、进出口"],
            ["注册地址", "通常是生产场地或同址办公室", "办公地址，生产场地在别处且不透露"],
            ["设备清单", "能列出该工艺的机器、产线与产量", "拿不出该产品的设备证据"],
            ["产能说明", "与产线、班次、人员挂钩", "与设备或人员无关的口头声称"],
            ["ISO 9001 证书", "发给生产地址上的同一主体", "发给另一主体，或无法提供"],
            ["产品检测报告", "申请人为制造商", "申请人为贸易主体或无关公司"],
            ["出口记录", "以制造商名义出口并作为记录制造商", "以卖方名义出口，制造商未识别"],
            ["对实地走访的反应", "欢迎到所称生产地址走访", "推脱，或只带你去无关的展厅"],
          ],
        },
        {
          title: "贸易公司是不是问题？分情况判断",
          headers: ["情形", "评估", "该怎么做"],
          rows: [
            ["小订单、标准品、中间商已披露", "低风险", "与贸易公司签约，书面确认产品规格"],
            ["多家工厂拼柜整合", "只要工厂已知就有价值", "索取工厂清单，评估真正生产你产品的那家"],
            ["中间商不愿透露制造商", "高风险", "视为未核验；不要依赖其合规声称"],
            ["客户要求在生产场地做 SMETA/BSCI/RBA", "身份是决定性的", "识别制造商并审核该场地，而不是中间商"],
            ["涉及产品安全、认证或知识产权", "身份是决定性的", "与制造商签约，或取得其书面承诺与审核权"],
          ],
        },
      ],
      faq: [
        {
          q: "怎么判断中国供应商是工厂还是贸易公司？",
          a: "先看营业执照上的经营范围：含生产、加工表述说明是制造商，仅限销售、批发、进出口说明是贸易公司。再用设备证据、地址比对、以及开给同一法律主体的证书来确认。",
        },
        {
          q: "贸易公司不好吗？",
          a: "不一定。贸易公司能通过拼柜整合、更低的起订量、出口手续与沟通创造真实价值。问题不在中间商本身，而在于当质量、安全或合规责任出现时，你不知道产品到底是谁生产的。",
        },
        {
          q: "一家公司能既是工厂又是贸易公司吗？",
          a: "可以。很多中国公司同时具备生产与贸易两类经营范围，有些自己生产一部分、转售其余部分。所以必须阅读经营范围，而不是依赖自我声明的标签。",
        },
        {
          q: "ISO 9001 能证明供应商是制造商吗？",
          a: "单靠它不能。ISO 9001 认证的是某具名主体与范围内的质量管理体系，证明持证方运行着文件化的质量体系，而不证明它拥有生产设备。要核查证书是否写明生产你产品的主体，且范围覆盖该产品。",
        },
        {
          q: "为什么注册地址和工厂地址不一样？",
          a: "注册地址是办公室或注册代理地址、而生产在别处，这很常见，本身正常。但你需要书面的实际生产地址，因为验厂与验货覆盖的是那个场地。",
        },
        {
          q: "应该审核贸易公司还是工厂？",
          a: "审核生产你产品的场地。审核中间商的办公室，几乎无法告诉你生产能力、工作条件或过程控制的情况。如果中间商不愿指出工厂，这本身就构成审核发现。",
        },
      ],
      sources: [
        { name: "中国国家市场监督管理总局（SAMR）", note: "核发营业执照并记录经营范围，是判断生产资质与贸易资质的首要证据来源。" },
        { name: "ISO（国际标准化组织）", note: "发布 ISO 9001 并维护认证框架；证书发给具名主体并界定明确范围。" },
        { name: "FactoryAuditB2B 方法论", note: "当供应商身份与生产场地无法与签约主体对应时，本站如何判定证据等级。" },
      ],
    },
  },
  {
    slug: "china-supplier-risk-assessment-framework",
    category: "risk",
    titleEn: "How to Compare Chinese Suppliers: A Practical Supplier Risk Assessment Framework",
    titleZh: "如何比较中国供应商：一套可落地的供应商风险评估框架",
    metaDescEn:
      "A practical supplier risk assessment framework for comparing Chinese suppliers across eight dimensions, scoring them consistently and deciding when a comparison should become a factory audit.",
    metaDescZh:
      "用八个维度比较中国供应商的实用风险评估框架：统一打分、横向对比三家供应商，并判断何时应从比较升级为现场验厂。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-scorecard" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/services/china-factory-audit" },
    ],
    related: [
      "supplier-risk-assessment-guide",
      "supplier-evaluation-checklist",
      "verify-alibaba-supplier-before-paying",
      "when-to-order-china-factory-audit",
      "how-to-verify-a-chinese-supplier",
    ],
    links: [
      { href: "/rfq", labelEn: "Post a buyer RFQ and shortlist suppliers", labelZh: "发布采购需求并筛选供应商" },
      { href: "/suppliers", labelEn: "Compare supplier profiles side by side", labelZh: "并排比较供应商档案" },
    ],
    en: {
      quickAnswer:
        "Score every candidate supplier on the same eight dimensions: company, factory, production, quality, compliance, supply chain, documentation and digital reputation. Give each dimension a level rather than a guess, and keep the evidence that supports it. When you place three suppliers side by side on the same grid, the differences that matter stop being about price and start being about where the risk actually sits. Use the comparison to choose what to verify next, not to declare a winner.",
      definition:
        "Supplier risk assessment is a structured way of comparing candidate suppliers on comparable evidence instead of impressions. It assigns a level to each risk dimension, records the evidence behind each level, and produces a comparable picture across suppliers. A risk score is decision support: it tells you where to look, what to verify and which gaps matter. It is not a certificate, and it does not replace verification or an on-site audit where production reality has to be confirmed.",
      keyPoints: [
        "Compare suppliers on the same dimensions with the same definitions, or the comparison is meaningless.",
        "Score what you have evidence for and mark the rest as unknown. Unknown is not low risk.",
        "Price differences usually reflect capability, compliance and capacity differences that the grid makes visible.",
        "A supplier with strong documents and weak production evidence is a different risk from the reverse; treat them differently.",
        "The output of a comparison is a decision about what to verify next, not a final ranking.",
        "Recalculate after new evidence arrives; a risk score is a snapshot, not a permanent grade.",
      ],
      steps: [
        {
          title: "Fix the candidate list and the product scope",
          body: "Decide which suppliers are actually comparable for the same product, specification and volume. Comparing a specialist against a generalist on price alone produces the wrong answer before you start.",
        },
        {
          title: "Collect the same evidence pack from each supplier",
          body: "Request the same documents from every candidate: business licence, scope, production address, equipment or capability evidence, certificates, test reports and export record. Uneven evidence is itself a finding.",
        },
        {
          title: "Score the eight dimensions",
          body: "Work through company, factory, production, quality, compliance, supply chain, documentation and digital reputation for each supplier, assigning a level supported by named evidence rather than an overall impression.",
        },
        {
          title: "Mark unknowns explicitly",
          body: "Where evidence is missing, record unknown. Treating missing data as acceptable is the most common way a comparison produces false confidence.",
        },
        {
          title: "Place the suppliers side by side",
          body: "Build one grid with suppliers as columns and dimensions as rows. Differences that were invisible in separate conversations become obvious: one supplier is strong on documents and weak on production, another the reverse.",
        },
        {
          title: "Decide what each gap means",
          body: "For each weak dimension, decide whether it can be closed with documents, requires a site visit, or is disqualifying for your product and market. Not every gap deserves the same response.",
        },
        {
          title: "Convert the decision into verification or audit scope",
          body: "Turn the identified gaps into a specific request: document checks for documentary gaps, an on-site audit for production and compliance gaps, and inspection for order-specific quality risk.",
        },
        {
          title: "Recalculate after evidence arrives",
          body: "Update the score when new documents, an audit or an inspection result lands. A supplier's risk profile changes, and the comparison should reflect the current state.",
        },
      ],
      examples: [
        {
          title: "Three suppliers, same product, different risk shape",
          body: "Supplier A is cheapest but has no production evidence and will not confirm the production address. Supplier B has complete documents but a capacity far below the required volume. Supplier C is mid-priced with consistent evidence and an audit on record. On price alone A wins; on the grid, C is the only one whose risk is understood.",
        },
        {
          title: "Unknown treated as low risk",
          body: "A scoring sheet left compliance blank for two suppliers because no certificates had been received, and the tool averaged the missing dimensions as acceptable. Both suppliers looked stronger than they were. Blank should read as unknown.",
        },
        {
          title: "Comparison becomes an audit scope",
          body: "The grid showed that all three candidates were unverified on production reality and subcontracting. Instead of ranking them, the buyer ordered a site audit for the two finalists, scoped to the dimensions where the grid showed gaps.",
        },
      ],
      checklist: [
        "Candidate suppliers are comparable on product, specification and volume.",
        "The same evidence pack has been requested from every candidate.",
        "Business licence and scope obtained for each candidate.",
        "Production address confirmed in writing for each candidate.",
        "Capability evidence reviewed for the specific product, not the company overall.",
        "Certificates checked for validity, scope and matching legal entity.",
        "Compliance requirements for the destination market identified and mapped.",
        "Supply chain and subcontracting position understood for each candidate.",
        "Export experience to your market evidenced.",
        "Every blank dimension recorded as unknown, not as acceptable.",
        "Side-by-side grid completed with suppliers as columns.",
        "Each gap assigned a response: document check, site audit, or disqualifying.",
        "Score recalculated after new evidence arrives.",
      ],
      tables: [
        {
          title: "The Eight Supplier Risk Dimensions",
          headers: ["Dimension", "What it covers", "Typical evidence", "Common failure mode"],
          rows: [
            ["Company", "Legal identity, registration status, ownership stability", "Business licence, Unified Social Credit Code, registration record", "Contracting an entity that is not the counterparty on paper"],
            ["Factory", "Whether the production site exists and is the stated one", "Address confirmation, site photos with geolocation, site visit", "Registered office presented as the factory"],
            ["Production", "Equipment, lines, capacity and process fit", "Equipment list, line count, shift pattern, output records", "Capacity claimed with no link to equipment or staff"],
            ["Quality", "Quality management system and process control", "ISO 9001 in scope, inspection records, defect history", "Certificate held but no evidence of it being applied"],
            ["Compliance", "Social, environmental and market compliance", "SMETA, BSCI, RBA or equivalent; product test reports", "Certificate issued to a different legal entity"],
            ["Supply chain", "Subcontracting, material sources, dependency", "Subcontractor disclosure, material declarations", "Undisclosed subcontracting to unassessed sites"],
            ["Documentation", "Consistency and traceability of the paperwork", "Matching names and addresses across all documents", "Inconsistent entity names between licence, certificate and invoice"],
            ["Digital reputation", "Public footprint and consistency of claims", "Website, platform history, public records, dispute traces", "Claimed scale inconsistent with any public footprint"],
          ],
        },
        {
          title: "Comparing Three Suppliers on the Same Grid",
          headers: ["Dimension", "Supplier A", "Supplier B", "Supplier C"],
          rows: [
            ["Price", "Lowest", "Highest", "Mid"],
            ["Company", "Verified registration", "Verified registration", "Verified registration"],
            ["Factory", "Production address not confirmed", "Confirmed", "Confirmed"],
            ["Production", "No equipment evidence", "Capacity below requirement", "Capacity matches requirement"],
            ["Quality", "No system evidence", "ISO 9001 in scope", "ISO 9001 in scope, records shown"],
            ["Compliance", "Unknown", "Unknown", "Audit on record"],
            ["Supply chain", "Subcontracting not disclosed", "Disclosed", "Disclosed, subcontractor named"],
            ["Overall read", "Cheapest, risk not understood", "Strong documents, cannot deliver volume", "Risk understood and verifiable"],
          ],
        },
      ],
      faq: [
        {
          q: "What is supplier risk assessment?",
          a: "It is a structured comparison of candidate suppliers across defined risk dimensions, scored on evidence rather than impressions. The output shows where risk sits in each supplier, which gaps matter for your product and market, and what should be verified or audited next.",
        },
        {
          q: "How do I compare suppliers fairly?",
          a: "Fix the product, specification and volume first so the candidates are genuinely comparable, then request the same evidence pack from each and score the same dimensions with the same definitions. Comparing on price alone hides exactly the differences that cause failures later.",
        },
        {
          q: "Should missing information be scored as low risk?",
          a: "No. Missing information should be recorded as unknown, and unknown should be treated as a reason to ask for evidence. Averaging blanks into an acceptable score is the most common way a comparison creates false confidence.",
        },
        {
          q: "How many dimensions should a supplier scorecard have?",
          a: "Enough to cover where risk actually arises: company identity, factory reality, production capability, quality, compliance, supply chain, documentation and public footprint. Fewer than this misses structural risk; far more becomes administration without decisions.",
        },
        {
          q: "Does a good risk score mean a supplier is safe?",
          a: "No. A risk score describes what is known at a point in time and where the gaps are. It is decision support for choosing what to verify, and it is not a certificate, a guarantee or a substitute for an on-site audit where production reality matters.",
        },
        {
          q: "When should a comparison become a factory audit?",
          a: "When the grid shows gaps that documents cannot close, typically production reality, working conditions, subcontracting and process control. If two or more finalists have the same unresolved production gaps, audit them rather than ranking them on incomplete data.",
        },
      ],
      sources: [
        {
          name: "FactoryAuditB2B Supplier Risk Calculator",
          note: "The free tool that scores a supplier across these dimensions and shows where evidence is missing.",
        },
        {
          name: "ISO 9001 quality management systems",
          note: "The standard most commonly cited as quality evidence; valid only for the named entity and scope.",
        },
        {
          name: "FactoryAuditB2B Methodology",
          note: "Dimension weights, how unknown is handled, and the stated limitations of a risk score.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "用同样的八个维度给每个候选供应商打分：公司、工厂、生产、质量、合规、供应链、文件、数字声誉。每个维度给的是「等级」而不是猜测，并保留支撑它的证据。当三家供应商被放在同一张网格上并排比较时，真正重要的差异就不再停留在价格，而变成「风险到底在哪里」。用比较结果决定下一步核验什么，而不是宣布谁胜出。",
      definition:
        "供应商风险评估，是用可比证据而非印象来比较候选供应商的结构化方法。它给每个风险维度定级、记录支撑该等级的证据，并生成可横向比较的图景。风险评分是决策支持：它告诉你该看哪里、该核验什么、哪些缺口重要。它不是证书，也不能替代核验；在必须确认生产真实性时，更不能替代现场验厂。",
      keyPoints: [
        "必须用同样的维度、同样的定义比较供应商，否则比较没有意义。",
        "只给有证据的维度打分，其余标记为未知。未知不等于低风险。",
        "价格差异通常反映的是能力、合规与产能差异，网格会让这些差异显形。",
        "文件强而生产证据弱的供应商，与相反情况的供应商风险不同，应当区别对待。",
        "比较的输出是「下一步核验什么」的决策，而不是最终排名。",
        "新证据到达后要重算；风险评分是快照，不是永久评级。",
      ],
      steps: [
        {
          title: "锁定候选名单与产品范围",
          body: "确定哪些供应商在同一产品、规格与数量上真正可比。在开始之前，只比价格地拿专业厂和综合厂对比，得出的答案就已经是错的。",
        },
        {
          title: "向每家供应商索取同一套证据包",
          body: "向每个候选方索取相同的文件：营业执照、经营范围、生产地址、设备或能力证据、证书、检测报告与出口记录。证据不齐本身就是一项发现。",
        },
        {
          title: "给八个维度打分",
          body: "对每家供应商逐一评估公司、工厂、生产、质量、合规、供应链、文件与数字声誉，依据具名证据给出等级，而不是凭整体印象。",
        },
        {
          title: "明确标注未知",
          body: "证据缺失处记录为未知。把缺失数据当作可接受，是让比较产生虚假信心最常见的原因。",
        },
        {
          title: "把供应商并排放在一起",
          body: "做一张网格：供应商为列、维度为行。分散沟通中看不见的差异就会显形：一家文件强而生产弱，另一家正好相反。",
        },
        {
          title: "判断每个缺口意味着什么",
          body: "对每个薄弱维度，判断它可以用文件补齐、需要现场走访，还是对你的产品与市场而言直接出局。不是每个缺口都值得同等应对。",
        },
        {
          title: "把决策转化为核验或验厂范围",
          body: "把识别出的缺口变成具体请求：文件缺口做文件核查，生产与合规缺口做现场验厂，订单特定的质量风险做验货。",
        },
        {
          title: "证据到达后重算",
          body: "当新文件、验厂或验货结果到达时更新评分。供应商的风险画像会变化，比较也应反映当前状态。",
        },
      ],
      examples: [
        {
          title: "三家供应商，同一产品，风险形状不同",
          body: "A 家最便宜，但拿不出生产证据且不愿确认生产地址；B 家文件齐全，但产能远低于需求；C 家价格居中，证据一致且有既往验厂记录。只比价格 A 胜出；放在网格上，C 是唯一风险被看清的一家。",
        },
        {
          title: "把未知当成低风险",
          body: "一份评分表因未收到证书而把两家供应商的合规项留空，工具把缺失维度按可接受处理并计入平均，两家看起来都比实际更强。空白应读作未知。",
        },
        {
          title: "比较升级为验厂范围",
          body: "网格显示三家候选方在生产真实性与分包上都未核验。买家没有排序，而是对两家入围方下达现场验厂，范围正好覆盖网格中显示缺口的维度。",
        },
      ],
      checklist: [
        "候选供应商在产品、规格与数量上可比。",
        "已向每个候选方索取同一套证据包。",
        "已取得每家的营业执照与经营范围。",
        "已书面确认每家的生产地址。",
        "已针对具体产品（而非公司整体）审阅能力证据。",
        "已核对证书的有效性、范围与法律主体一致性。",
        "已识别并映射目标市场的合规要求。",
        "已了解每家的供应链与分包状况。",
        "已有发往你目标市场的出口经验证据。",
        "每个空白维度都记录为未知，而不是可接受。",
        "已完成供应商为列的并排网格。",
        "已为每个缺口指定应对：文件核查、现场验厂或出局。",
        "新证据到达后已重算评分。",
      ],
      tables: [
        {
          title: "供应商风险的八个维度",
          headers: ["维度", "覆盖什么", "典型证据", "常见失效模式"],
          rows: [
            ["公司", "法律身份、注册状态、股权稳定性", "营业执照、统一社会信用代码、登记记录", "签约主体与纸面对手方不一致"],
            ["工厂", "生产场地是否存在、是否为所称场地", "地址确认、带定位的现场照片、实地走访", "把注册办公室当作工厂呈现"],
            ["生产", "设备、产线、产能与工艺匹配度", "设备清单、产线数、班次、产量记录", "产能声称与设备人员无关联"],
            ["质量", "质量管理体系与过程控制", "范围有效的 ISO 9001、检验记录、不良史", "有证书但无执行证据"],
            ["合规", "社会责任、环境与目标市场合规", "SMETA、BSCI、RBA 或等效；产品检测报告", "证书开给另一法律主体"],
            ["供应链", "分包、材料来源、依赖性", "分包披露、材料声明", "向未评估场地未披露分包"],
            ["文件", "单证的一致性与可追溯性", "所有文件上的名称与地址相互吻合", "执照、证书、发票上的主体名不一致"],
            ["数字声誉", "公开足迹与声称的一致性", "官网、平台历史、公开记录、纠纷痕迹", "声称规模与任何公开足迹都对不上"],
          ],
        },
        {
          title: "三家供应商在同一网格上的比较",
          headers: ["维度", "供应商 A", "供应商 B", "供应商 C"],
          rows: [
            ["价格", "最低", "最高", "居中"],
            ["公司", "注册已核验", "注册已核验", "注册已核验"],
            ["工厂", "生产地址未确认", "已确认", "已确认"],
            ["生产", "无设备证据", "产能低于需求", "产能匹配需求"],
            ["质量", "无体系证据", "ISO 9001 范围有效", "ISO 9001 范围有效且有记录"],
            ["合规", "未知", "未知", "有既往验厂记录"],
            ["供应链", "分包未披露", "已披露", "已披露并点名外协方"],
            ["总体判断", "最便宜，但风险未被看清", "文件强，但交付不了量", "风险被看清且可验证"],
          ],
        },
      ],
      faq: [
        {
          q: "什么是供应商风险评估？",
          a: "它是按既定风险维度、以证据而非印象给候选供应商打分的结构化比较。输出显示每家供应商的风险落在哪里、哪些缺口对你的产品与市场重要、以及接下来应核验或验厂什么。",
        },
        {
          q: "怎样才叫公平地比较供应商？",
          a: "先锁定产品、规格与数量，使候选方真正可比；然后向每家索取同一套证据包，并用同样定义、同样维度打分。只比价格，恰好会掩盖那些日后造成失败差异。",
        },
        {
          q: "缺失信息可以按低风险计分吗？",
          a: "不可以。缺失应记录为未知，而未知应当成为索取证据的理由。把空白按可接受计入平均，是让比较产生虚假信心最常见的方式。",
        },
        {
          q: "供应商评分卡应该有多少个维度？",
          a: "足以覆盖风险真正产生的环节即可：公司身份、工厂真实性、生产能力、质量、合规、供应链、文件与公开足迹。少于这些会漏掉结构性风险；多得多则变成不产生决策的行政负担。",
        },
        {
          q: "风险评分高就等于供应商安全吗？",
          a: "不等于。风险评分描述的是某一时点上已知的信息与缺口所在，它是用来决定核验什么的决策支持，不是证书、不是保证，在生产真实性重要时更不能替代现场验厂。",
        },
        {
          q: "什么时候比较应升级为验厂？",
          a: "当网格显示文件无法补齐的缺口时，通常是生产真实性、工作条件、分包与过程控制。若两家及以上入围方存在同样的未解决生产缺口，应当去验厂，而不是在 incomplete 数据上排序。",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B 供应商风险计算器", note: "按上述维度给供应商打分并指出证据缺失之处的免费工具。" },
        { name: "ISO 9001 质量管理体系", note: "最常被援引为质量证据的标准；仅对具名主体与范围有效。" },
        { name: "FactoryAuditB2B 方法论", note: "维度权重、未知项的处理方式，以及风险评分的既定局限。" },
      ],
    },
  },
  {
    slug: "when-to-order-china-factory-audit",
    category: "audit",
    titleEn: "When Should You Order a Factory Audit in China?",
    titleZh: "什么时候该在中国做工厂验厂？",
    metaDescEn:
      "A risk-based guide to deciding when to order a China factory audit: order value, product risk, evidence gaps, supplier change, customer requirements and suspected subcontracting.",
    metaDescZh:
      "按风险判断何时该在中国下单验厂：订单金额、产品风险、证据缺口、更换供应商、客户要求与疑似分包，附决策表与验厂能证明与不能证明的边界。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
    ],
    services: [
      { href: "/services/china-factory-audit" },
      { href: "/services/china-supplier-verification" },
    ],
    related: [
      "what-is-a-factory-audit",
      "supplier-verification-vs-factory-audit-vs-inspection",
      "on-site-vs-desk-audit",
      "china-supplier-risk-assessment-framework",
      "factory-audit-checklist",
    ],
    links: [
      {
        href: "/factory-audit/request",
        labelEn: "Request a factory audit",
        labelZh: "申请工厂验厂",
      },
      { href: "/rfq", labelEn: "See what buyers are sourcing", labelZh: "查看买家正在采购什么" },
    ],
    en: {
      quickAnswer:
        "Order a factory audit when the decision cannot be made from documents: before a large first order, when the supplier's evidence is incomplete or inconsistent, when the product carries safety or regulatory risk, when you are switching suppliers, when a customer mandates a standard such as SMETA, BSCI or RBA, when you suspect undisclosed subcontracting, or after a previous supplier failure. An audit is a baseline at a point in time. It is not the first step for every order, and it does not certify that a factory will stay compliant.",
      definition:
        "A factory audit is an on-site assessment of a production facility against a defined scope, carried out by an auditor who visits the site, reviews records, observes processes and interviews management and workers where the scope includes social criteria. It produces a report of findings at the time of the visit. Audits are described as baselines rather than guarantees: they show what was true on the day, which is why follow-up and corrective action closure matter more than a single pass result.",
      keyPoints: [
        "An audit is not always the first step. Documentary verification is faster and cheaper and often resolves the question.",
        "Order value alone should not drive the decision; product risk and evidence quality matter more.",
        "A customer-mandated standard determines the audit scope, not the supplier's preference.",
        "Undisclosed subcontracting is one of the strongest reasons to audit, because documents rarely reveal it.",
        "An audit records a baseline on the day of the visit and does not guarantee future performance.",
        "The value of an audit is what happens after it: corrective actions, closure and re-checks.",
      ],
      steps: [
        {
          title: "Start with documentary verification, not an audit",
          body: "Confirm registration, scope, address, certificates and payment entity first. Many supplier questions are answered by documents within days, and an audit requested too early spends money on gaps that a document request would have closed.",
        },
        {
          title: "Audit before the first large order",
          body: "When the first order is large enough that a failure would be material, an audit before release converts an unknown into a documented baseline. Size the decision by what you could lose, not by a fixed order threshold.",
        },
        {
          title: "Audit when supplier evidence is incomplete",
          body: "If the supplier cannot produce equipment evidence, will not confirm the production address, or provides certificates naming a different entity, the gap is not administrative; it is a reason to visit the site.",
        },
        {
          title: "Audit when product risk is high",
          body: "Products with safety, electrical, chemical, children's or food-contact exposure carry consequences that documents alone cannot price. Higher product risk lowers the threshold for auditing.",
        },
        {
          title: "Audit when changing suppliers or adding capacity",
          body: "A new supplier, a new production site or a rapid capacity increase changes what you know. Moving volume to a site nobody has visited is a common source of quality and compliance surprises.",
        },
        {
          title: "Audit when a customer requires SMETA, BSCI or RBA",
          body: "Where a customer mandates a standard, the scope is set by that requirement. Confirm which programme, which pillars or modules, and whether the customer accepts an existing report before commissioning a new one.",
        },
        {
          title: "Audit when you suspect subcontracting",
          body: "If you suspect your product is made somewhere other than the stated site, documents will usually confirm nothing. An unannounced or semi-announced visit is the method that establishes where production actually happens.",
        },
        {
          title: "Audit after a previous supplier failure",
          body: "After a failed inspection, a delivery collapse or a compliance incident, an audit scoped to the failure mode tells you whether the cause is systemic and whether remaining with the supplier is defensible.",
        },
      ],
      examples: [
        {
          title: "Audit not needed: small reorder, consistent history",
          body: "A buyer reorders a standard product from a supplier with three clean inspections and unchanged ownership. Documentary checks plus a pre-shipment inspection answer the actual question at lower cost than another audit.",
        },
        {
          title: "Audit needed: new supplier, large first order",
          body: "A first order of significant value with a supplier found online, whose capability evidence cannot be verified remotely. An audit before the deposit converts an unverified claim into an observed baseline.",
        },
        {
          title: "Audit needed: customer mandate",
          body: "A European retailer requires a SMETA 4-pillar report before onboarding. The scope is fixed by the customer, and a general factory audit will not satisfy the requirement.",
        },
      ],
      checklist: [
        "Documentary verification completed before considering an audit.",
        "Order value and exposure quantified, not guessed.",
        "Product risk identified: safety, regulatory, customer-mandated.",
        "Evidence gaps listed with what would close each one.",
        "Customer requirement confirmed: programme, pillars, report age accepted.",
        "Production address confirmed as the site to be audited.",
        "Subcontracting position understood and noted in the audit scope.",
        "Audit scope written down: what must be covered and why.",
        "Announced or semi-announced approach decided.",
        "Corrective action and follow-up expectations agreed in advance.",
        "Decision recorded: audit now, verify documents first, or inspect the shipment.",
      ],
      tables: [
        {
          title: "Factory Audit Decision Table",
          headers: ["Situation", "Order value", "Product risk", "Recommended action"],
          rows: [
            ["New supplier, no prior history", "Low", "Low", "Documentary verification, then inspect the first shipment"],
            ["New supplier, no prior history", "Low", "High", "Verification plus a scoped audit"],
            ["New supplier, no prior history", "High", "Low", "Audit before releasing significant payment"],
            ["New supplier, no prior history", "High", "High", "Audit before order confirmation; inspection before shipment"],
            ["Existing supplier, clean history", "Any", "Low", "Periodic re-check; inspect shipments"],
            ["Existing supplier, compliance incident", "Any", "Any", "Audit scoped to the failure mode"],
            ["Suspected undisclosed subcontracting", "Any", "Any", "Site visit at the stated production address"],
            ["Customer requires SMETA, BSCI or RBA", "Any", "Any", "Audit to the mandated programme and pillars"],
            ["Capacity increase or new site", "High", "Any", "Audit the new site before moving volume"],
          ],
        },
        {
          title: "What a Factory Audit Can and Cannot Prove",
          headers: ["Question", "Can an audit answer it?", "Note"],
          rows: [
            ["Does the production site exist at the stated address?", "Yes", "Confirmed by physical presence on the day"],
            ["Are the stated equipment and lines present?", "Yes", "Observed during the visit"],
            ["Are working hours and wage records consistent?", "Yes, for the period reviewed", "Based on records sampled and interviews conducted"],
            ["Are certificates valid and in scope?", "Yes", "Checked against issuing body records where available"],
            ["Will the factory stay compliant after the audit?", "No", "An audit is a baseline on the day of the visit"],
            ["Will this specific shipment be defect-free?", "No", "That is what inspection is for"],
            ["Is the supplier financially stable?", "Partly", "Not a financial audit; limited to observable indicators"],
            ["Does the factory own the site?", "Partly", "Ownership may require separate documentary checks"],
          ],
        },
      ],
      faq: [
        {
          q: "When should I order a factory audit?",
          a: "Order one when the decision cannot be settled with documents: before a materially large first order, when evidence is incomplete, when product risk is high, when switching suppliers or sites, when a customer mandates a standard, when you suspect subcontracting, or after a supplier failure.",
        },
        {
          q: "Is a factory audit always necessary before the first order?",
          a: "No. For small, low-risk orders with a supplier whose documents are consistent, documentary verification plus a pre-shipment inspection is often the proportionate response. Scale the check to what you could lose.",
        },
        {
          q: "Can a factory audit guarantee future compliance?",
          a: "No. An audit records conditions on the day of the visit and is best understood as a baseline. Sustained compliance depends on corrective action closure, monitoring and re-checks, which is why follow-up matters more than a single result.",
        },
        {
          q: "What is the difference between an audit and an inspection?",
          a: "An audit assesses the factory and its systems, usually independent of a specific shipment. An inspection checks a specific shipment against your specification and quantity. They answer different questions and are often both needed at different stages.",
        },
        {
          q: "Should the audit be announced?",
          a: "Announced audits are standard for most programmes and allow records to be prepared. Semi-announced or unannounced approaches are used where the concern is whether normal conditions are visible. The right approach depends on what you are trying to establish.",
        },
        {
          q: "Can I reuse an audit report the supplier already has?",
          a: "Sometimes. Check the issuing body, the standard and pillars covered, the date, and whether your customer accepts it. A report issued to a different legal entity, or covering a different site, does not apply to your order.",
        },
        {
          q: "How long does a factory audit take?",
          a: "A single-site audit is commonly completed within one to several days on site depending on scope, size and the standard applied, with the report following afterwards. Multi-site programmes and 4-pillar social audits take longer than a focused capability assessment.",
        },
      ],
      sources: [
        {
          name: "Sedex (SMETA)",
          note: "Publishes the SMETA methodology and the distinction between audit types and pillars; reports are produced by independent audit companies.",
        },
        {
          name: "Responsible Business Alliance (RBA)",
          note: "Operates the Validated Assessment Program (VAP) and states that an assessment is a baseline at a point in time rather than a guarantee.",
        },
        {
          name: "amfori (BSCI)",
          note: "Operates the amfori Social Sustainability audit programme used by many European buyers.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "当决策无法靠文件做出时，就该验厂：大额首单之前、供应商证据不完整或不一致时、产品涉及安全或法规风险时、更换供应商时、客户强制要求 SMETA/BSCI/RBA 等标准时、怀疑存在未披露分包时，或在上一次供应商失败之后。验厂是某一时点的基线快照，它不是每一单的第一步，也不证明工厂会持续合规。",
      definition:
        "工厂验厂是由审核员到生产现场，按既定范围进行的实地评估：走访场地、审阅记录、观察流程，并在范围含社会责任标准时访谈管理层与员工。产出的是访问当天的发现报告。验厂被描述为基线而非保证：它呈现的是当天为真的情况，因此整改关闭与复审跟进比单次通过结果更重要。",
      keyPoints: [
        "验厂不总是第一步。文件核验更快更便宜，往往就能解决问题。",
        "不应只由订单金额驱动决策；产品风险与证据质量更重要。",
        "客户强制的标准决定审核范围，而不是供应商的偏好。",
        "未披露的分包是验厂最强的理由之一，因为文件几乎不会暴露它。",
        "验厂记录的是访问当天的基线，不保证未来表现。",
        "验厂的价值在于之后发生的事：纠正措施、关闭与复审。",
      ],
      steps: [
        {
          title: "先做文件核验，而不是直接验厂",
          body: "先确认注册、经营范围、地址、证书与收款主体。很多供应商问题几天内靠文件就能回答，过早下单验厂，会把钱花在一次文件索取就能补齐的缺口上。",
        },
        {
          title: "大额首单之前验厂",
          body: "当首单大到失败会造成实质损失时，在付款前验厂能把未知转化为有记录的基线。按你可能损失多少来决定，而不是按某个固定订单门槛。",
        },
        {
          title: "供应商证据不完整时验厂",
          body: "若供应商拿不出设备证据、不愿确认生产地址，或提供的证书指向另一主体，这个缺口不是行政性的，它就是去现场的理由。",
        },
        {
          title: "产品风险高时验厂",
          body: "涉及安全、电气、化学、儿童用品或食品接触的产品，其后果无法只靠文件衡量。产品风险越高，验厂的触发门槛越低。",
        },
        {
          title: "更换供应商或增加产能时验厂",
          body: "新供应商、新生产场地或快速扩产，都会改变你已知的信息。把订单量转到没人去过的场地，是质量与合规意外的常见来源。",
        },
        {
          title: "客户要求 SMETA、BSCI 或 RBA 时验厂",
          body: "客户强制某项标准时，范围由该要求决定。先确认具体项目、涵盖哪些支柱或模块，以及客户是否接受已有的报告，再决定是否新做一次。",
        },
        {
          title: "怀疑分包时验厂",
          body: "若怀疑产品在所称场地之外生产，文件通常什么也确认不了。通知或半通知的实地走访，才是确定生产实际发生在哪里的方法。",
        },
        {
          title: "上一次供应商失败之后验厂",
          body: "在验货失败、交付崩塌或合规事件之后，针对失效模式设定范围的验厂，能告诉你是系统性原因，以及继续合作是否站得住脚。",
        },
      ],
      examples: [
        {
          title: "不需要验厂：小额返单、历史一致",
          body: "买家向一家有三次干净验货记录、股权未变的供应商返单标准品。文件核查加出货前验货，就能以低于再验一次厂的成本回答真正的问题。",
        },
        {
          title: "需要验厂：新供应商、大额首单",
          body: "首单金额可观，供应商来自线上，其能力证据无法远程验证。在付定金前验厂，能把未经核实的声称转化为观察到的基线。",
        },
        {
          title: "需要验厂：客户强制要求",
          body: "某欧洲零售商要求入驻前提供 SMETA 四支柱报告。范围由客户固定，通用工厂验厂无法满足该要求。",
        },
      ],
      checklist: [
        "在考虑验厂之前已完成文件核验。",
        "已量化（而非猜测）订单金额与风险敞口。",
        "已识别产品风险：安全、法规、客户强制。",
        "已列出证据缺口，以及各自靠什么补齐。",
        "已确认客户要求：项目、支柱、可接受的报告时效。",
        "已确认生产地址即为待审场地。",
        "已了解分包状况，并写入验厂范围。",
        "已书面写下验厂范围：必须覆盖什么、为什么。",
        "已决定通知、半通知或不通知的方式。",
        "已事先约定纠正措施与跟进预期。",
        "已记录决策：现在验厂、先查文件，还是只验这批货。",
      ],
      tables: [
        {
          title: "验厂决策表",
          headers: ["情形", "订单金额", "产品风险", "建议动作"],
          rows: [
            ["新供应商，无既往记录", "低", "低", "先文件核验，再验首批货"],
            ["新供应商，无既往记录", "低", "高", "核验 + 有范围的验厂"],
            ["新供应商，无既往记录", "高", "低", "放出大额款项前验厂"],
            ["新供应商，无既往记录", "高", "高", "确认订单前验厂，出货前验货"],
            ["现有供应商，历史干净", "任意", "低", "定期复审 + 验货"],
            ["现有供应商，发生合规事件", "任意", "任意", "针对失效模式验厂"],
            ["怀疑未披露分包", "任意", "任意", "到所称生产地址实地走访"],
            ["客户要求 SMETA/BSCI/RBA", "任意", "任意", "按强制项目与支柱验厂"],
            ["扩产或新增场地", "高", "任意", "转移订单量前先审新场地"],
          ],
        },
        {
          title: "验厂能证明与不能证明什么",
          headers: ["问题", "验厂能回答吗", "说明"],
          rows: [
            ["生产场地是否在所称地址存在", "能", "以当天实地到场确认"],
            ["所称设备与产线是否存在", "能", "访问期间现场观察"],
            ["工时与工资记录是否一致", "能，针对所审阅期间", "基于抽样记录与所开展的访谈"],
            ["证书是否有效且在范围内", "能", "在可获得时与发证机构记录核对"],
            ["验厂后工厂会持续合规吗", "不能", "验厂是访问当天的基线"],
            ["这一批货会无缺陷吗", "不能", "那是验货的职责"],
            ["供应商财务是否稳健", "部分", "不是财务审计，仅限于可观察迹象"],
            ["工厂是否拥有该场地", "部分", "权属可能需另行文件核查"],
          ],
        },
      ],
      faq: [
        {
          q: "什么时候该做工厂验厂？",
          a: "当决策无法靠文件解决时：大额首单前、证据不完整时、产品风险高时、更换供应商或场地时、客户强制标准时、怀疑分包时，或供应商失败之后。",
        },
        {
          q: "首单前一定要验厂吗？",
          a: "不一定。金额小、风险低、且供应商文件自洽时，文件核验加出货前验货往往是相称的应对。按你可能损失多少来配置检查力度。",
        },
        {
          q: "验厂能保证未来合规吗？",
          a: "不能。验厂记录的是访问当天的状况，最准确的理解是基线。持续合规取决于整改关闭、监控与复审，因此跟进比单次结果更重要。",
        },
        {
          q: "验厂和验货有什么区别？",
          a: "验厂评估的是工厂及其体系，通常与某一批货无关；验货检查的是某一批货是否符合你的规格与数量。两者回答不同问题，常在不同阶段都需要。",
        },
        {
          q: "验厂应该提前通知吗？",
          a: "多数项目采用通知式，便于准备记录；当关注点是「能否看到常态」时，会采用半通知或不通知方式。选哪种取决于你要确认什么。",
        },
        {
          q: "供应商已有的验厂报告可以复用吗？",
          a: "有时可以。核查发证机构、覆盖的标准与支柱、日期，以及客户是否接受。开给另一法律主体、或覆盖另一场地的报告，不适用于你的订单。",
        },
        {
          q: "工厂验厂需要多久？",
          a: "单场地验厂通常在现场一到数天完成，取决于范围、规模与所适用的标准，报告随后出具。多场地项目与四支柱社会责任验厂，比聚焦的能力评估耗时更长。",
        },
      ],
      sources: [
        { name: "Sedex（SMETA）", note: "发布 SMETA 方法论及审核类型与支柱的区分；报告由独立审核公司出具。" },
        { name: "责任商业联盟（RBA）", note: "运营 VAP 验证评估计划，并明确评估是某一时点的基线而非保证。" },
        { name: "amfori（BSCI）", note: "运营众多欧洲买家使用的 amfori 社会可持续性审核项目。" },
      ],
    },
  },
  {
    slug: "china-factory-audit-cost",
    category: "audit",
    titleEn: "China Factory Audit Cost in 2026: What Affects the Price",
    titleZh: "2026年中国工厂验厂费用：价格由什么决定",
    metaDescEn:
      "What determines China factory audit cost: location, audit type, duration, number of sites, required standard, auditor qualification, scope, travel and corrective action follow-up. How to read a quote.",
    metaDescZh:
      "中国工厂验厂费用由什么决定：所在地、验厂类型、天数、场地数量、要求的标准、审核员资质、范围、差旅与整改跟进。教你读懂报价单。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/china-factory-audit" },
      { href: "/services/china-supplier-verification" },
    ],
    related: [
      "when-to-order-china-factory-audit",
      "what-is-a-factory-audit",
      "rba-vap-vs-smeta-vs-bsci",
      "supplier-verification-vs-factory-audit-vs-inspection",
      "on-site-vs-desk-audit",
    ],
    links: [
      {
        href: "/factory-audit/request",
        labelEn: "Request a factory audit quote",
        labelZh: "索取验厂报价",
      },
      {
        href: "/methodology",
        labelEn: "How audit scope and risk scores are defined",
        labelZh: "验厂范围与风险评分如何界定",
      },
    ],
    en: {
      quickAnswer:
        "There is no single market price for a China factory audit, and any figure quoted without scope should be treated as incomplete. Cost is driven by location and travel, audit type, time on site, number of sites, the standard required, auditor qualification and experience, reporting scope and language, and whether corrective action follow-up is included. Two quotes can differ substantially because they are quoting different scopes. Compare quotes on what is included, not on the headline number.",
      definition:
        "Factory audit cost is the price of delivering a defined scope of work at a defined site: auditor time on site, preparation, travel, reporting, and any follow-up to close corrective actions. Because scope is the main variable, cost is best understood by decomposition rather than by benchmark. A quote that specifies the standard, the site, the duration, the deliverable and the follow-up terms is comparable; a quote that states only a day rate is not.",
      keyPoints: [
        "A single number without a scope is not a price; it is an incomplete specification.",
        "Location drives travel time and cost more than most buyers expect, especially outside major manufacturing clusters.",
        "The required standard sets the scope: a 4-pillar social audit is a different amount of work from a focused capability assessment.",
        "Multi-site programmes cost more than a single site, and each additional site adds auditor days and travel.",
        "Auditor qualification and language capability affect both price and report usefulness.",
        "Corrective action follow-up is frequently excluded from the headline price and should be confirmed before ordering.",
      ],
      steps: [
        {
          title: "Define the question the audit must answer",
          body: "Write down what you need to know: capability, quality system, social compliance, a customer-mandated standard, or a specific failure mode. An audit quoted without a question will be priced on assumptions.",
        },
        {
          title: "Fix the site and the legal entity",
          body: "Confirm the production address and the legal entity in scope. Quoting the wrong site or entity is the most common cause of a quote changing after order.",
        },
        {
          title: "Choose the standard or scope",
          body: "Decide whether you need a defined programme such as SMETA, BSCI or RBA, or a buyer-defined scope. The programme determines pillars, record sampling and reporting format, and therefore the work involved.",
        },
        {
          title: "Estimate auditor days from size and complexity",
          body: "Larger sites, more workers and more processes require more auditor time. Headcount, number of buildings and shift patterns are the inputs that determine duration.",
        },
        {
          title: "Account for travel and location",
          body: "Auditor travel time and cost depend on where the site is relative to the auditor base. Remote sites and multi-city programmes add both days and expenses.",
        },
        {
          title: "Confirm reporting scope and language",
          body: "Specify report language, format and turnaround. Reports requiring translation, customer-specific templates or additional reviewers cost more than a standard report.",
        },
        {
          title: "Decide on corrective action follow-up",
          body: "Ask whether closure of corrective actions, a follow-up visit or a desktop review of evidence is included. Follow-up is where an audit produces lasting value and is often priced separately.",
        },
        {
          title: "Compare quotes on inclusions",
          body: "Put quotes side by side and compare site, standard, auditor days, deliverables, turnaround and follow-up. The cheapest quote is usually the one with the narrowest scope, not the best value.",
        },
      ],
      examples: [
        {
          title: "Two quotes, different scopes",
          body: "One quote covers a one-day capability assessment at a single site with a standard English report. The other covers a two-day 4-pillar social audit with worker interviews, translated report and corrective action follow-up. They differ substantially because they are different jobs, not because one provider is overpriced.",
        },
        {
          title: "Scope creep after order",
          body: "A buyer ordered a general audit and later added a customer-mandated SMETA requirement. The price changed because the standard changed the sampling, reporting and record review requirements.",
        },
        {
          title: "Cheap quote, narrow scope",
          body: "A low quote covered a site walk-through and a photographic report, with no record review and no worker interviews. It was inexpensive because it could not answer the compliance question the buyer actually had.",
        },
      ],
      checklist: [
        "The question the audit must answer is written down.",
        "Production address and legal entity confirmed for the quote.",
        "Standard or scope named: programme, pillars, or buyer-defined scope.",
        "Site size, headcount and shift pattern provided to the provider.",
        "Number of auditor days stated in the quote.",
        "Travel and location assumptions stated.",
        "Report language, format and turnaround specified.",
        "Corrective action follow-up included or explicitly excluded.",
        "Whether a desktop document review is included, clarified.",
        "Whether re-audit or follow-up visits are priced separately, clarified.",
        "Quotes compared on inclusions rather than headline price.",
      ],
      tables: [
        {
          title: "What Determines Factory Audit Cost",
          headers: ["Cost driver", "Why it changes the price", "What to specify when requesting a quote"],
          rows: [
            ["Location and travel", "Auditor travel time and expenses vary by distance from the auditor base", "Full production address, and whether remote travel is involved"],
            ["Audit type", "Capability, quality, social compliance and customer-mandated programmes require different work", "Which type of audit you need"],
            ["Duration on site", "Auditor days scale with site size, headcount and process complexity", "Headcount, number of buildings, shift pattern"],
            ["Number of sites", "Each additional site adds auditor days and travel", "How many sites must be covered"],
            ["Required standard", "Programmes such as SMETA, BSCI or RBA set sampling and reporting requirements", "The exact programme and pillars required"],
            ["Auditor qualification", "Lead auditor experience and language capability affect delivery", "Required auditor profile and working language"],
            ["Reporting scope", "Translation, customer templates and additional reviewers add work", "Report language, format and turnaround"],
            ["Corrective action follow-up", "Closure review, desktop verification or a follow-up visit is additional work", "Whether follow-up to closure is included"],
            ["Announcement approach", "Unannounced or semi-announced visits affect planning", "Whether the visit is announced"],
            ["Turnaround time", "Expedited reporting compresses scheduling", "Required report delivery date"],
          ],
        },
        {
          title: "Reading a Quote: What Should Be Included",
          headers: ["Item", "Should appear in the quote", "Why it matters"],
          rows: [
            ["Scope statement", "Yes", "Defines what the auditor will and will not cover"],
            ["Site and legal entity", "Yes", "Prevents the audit being delivered at the wrong place"],
            ["Standard or pillars", "Yes, if mandated", "Determines sampling and report acceptance"],
            ["Auditor days", "Yes", "The main driver of cost"],
            ["Travel assumptions", "Yes", "Avoids later adjustments"],
            ["Deliverable", "Yes", "Report format, language and turnaround"],
            ["Corrective action handling", "Explicitly stated", "Often excluded; determines what happens after findings"],
            ["Follow-up visit terms", "Explicitly stated", "Closure usually requires revisiting evidence"],
            ["Exclusions", "Yes", "Makes the boundary of the work explicit"],
          ],
        },
      ],
      faq: [
        {
          q: "How much does a China factory audit cost?",
          a: "There is no single market price that applies across scopes. Cost is determined by location and travel, audit type, auditor days, number of sites, the required standard, auditor qualification, reporting scope and corrective action follow-up. Request a quote against a written scope and compare providers on what is included.",
        },
        {
          q: "Why do two audit quotes differ so much?",
          a: "Usually because they are quoting different scopes. One may be a one-day capability assessment while another is a multi-day social audit with worker interviews, translation and follow-up. Compare the inclusions rather than the headline figure.",
        },
        {
          q: "Is a cheaper audit worse?",
          a: "Not necessarily, but a materially cheaper quote usually reflects a narrower scope: fewer auditor days, no record review, no interviews or no follow-up. Check whether the cheaper scope can still answer your question.",
        },
        {
          q: "What affects factory audit cost the most?",
          a: "Auditor days on site and the required standard. Both are driven by site size, headcount and programme requirements, which is why providing accurate site information produces a more accurate quote.",
        },
        {
          q: "Is corrective action follow-up included?",
          a: "Frequently it is not. Many quotes cover the audit and report only, with closure of corrective actions priced separately. Confirm this before ordering, because follow-up is where the audit produces lasting value.",
        },
        {
          q: "Does a SMETA audit cost more than a general factory audit?",
          a: "It can, because a defined programme sets specific requirements for record sampling, worker interviews, reporting format and, depending on the pillars, the breadth of the assessment. The difference reflects scope, not a premium for the name.",
        },
        {
          q: "Can I reduce cost without reducing value?",
          a: "Yes, by defining the scope tightly around the question you need answered, providing accurate site information, and choosing a single site where the risk is actually concentrated. Reducing auditor days on a complex site usually reduces value rather than cost.",
        },
      ],
      sources: [
        {
          name: "Sedex (SMETA)",
          note: "Defines SMETA audit types and pillars, which are a primary driver of audit scope and therefore of the work involved.",
        },
        {
          name: "Responsible Business Alliance (RBA)",
          note: "Sets the VAP assessment framework and scope requirements that determine assessment duration.",
        },
        {
          name: "FactoryAuditB2B Methodology",
          note: "How this site defines audit scope, evidence levels and the limitations of what an audit can establish.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "中国工厂验厂没有一个统一市场价，任何不带范围就报出的数字都应视为不完整。费用受所在地与差旅、验厂类型、现场天数、场地数量、要求的标准、审核员资质与经验、报告范围与语言、以及是否含整改跟进等因素驱动。两份报价可能相差很大，因为它们报的是不同的范围。比较报价要看包含项，而不是看表面数字。",
      definition:
        "验厂费用，是在既定场地交付既定工作范围的价格：审核员现场时间、准备、差旅、报告，以及关闭纠正措施的任何跟进。由于范围是主要变量，费用最适合用拆解来理解，而不是用基准价。写明了标准、场地、时长、交付物与跟进条款的报价才可比；只报一个日费率的报价不可比。",
      keyPoints: [
        "没有范围的单一数字不是价格，而是一份不完整的规格说明。",
        "所在地对差旅时间与成本的影响，超出多数买家的预期，尤其在主要制造集群之外。",
        "要求的标准决定范围：四支柱社会责任验厂与聚焦的能力评估，工作量完全不同。",
        "多场地项目比单场地贵，每增加一个场地都会叠加审核人天与差旅。",
        "审核员资质与语言能力同时影响价格与报告的可用性。",
        "整改跟进常被排除在表面报价之外，下单前应确认。",
      ],
      steps: [
        {
          title: "写下验厂必须回答的问题",
          body: "明确你要知道什么：能力、质量体系、社会责任合规、客户强制标准，还是某个具体失效模式。没有问题就报价，只会按假设定价。",
        },
        {
          title: "锁定场地与法律主体",
          body: "确认范围内的生产地址与法律主体。报错场地或主体，是下单后报价变动最常见的原因。",
        },
        {
          title: "选择标准或范围",
          body: "决定你需要 SMETA、BSCI、RBA 等既定项目，还是买家自定义范围。项目决定了支柱、记录抽样与报告格式，因而决定工作量。",
        },
        {
          title: "按规模与复杂度估算审核人天",
          body: "场地越大、员工越多、流程越复杂，所需审核时间越长。人数、厂房数与班次，是决定时长的输入项。",
        },
        {
          title: "计入差旅与地理位置",
          body: "审核员差旅时间与成本，取决于场地相对审核员驻地的距离。偏远场地与多城市项目会同时增加天数与费用。",
        },
        {
          title: "确认报告范围与语言",
          body: "明确报告语言、格式与交付时限。需要翻译、客户定制模板或额外复核人手的报告，成本高于标准报告。",
        },
        {
          title: "决定是否含整改跟进",
          body: "询问是否包含纠正措施关闭、跟进走访或证据的桌面复核。跟进正是验厂产生长期价值之处，常单独计价。",
        },
        {
          title: "按包含项比较报价",
          body: "把报价并排，比较场地、标准、审核人天、交付物、时限与跟进。最便宜的报价通常是范围最窄的那个，而不是性价比最好的。",
        },
      ],
      examples: [
        {
          title: "两份报价，两个范围",
          body: "一份覆盖单场地一天的能力评估加标准英文报告；另一份覆盖两天四支柱社会责任验厂，含员工访谈、报告翻译与整改跟进。两者相差很大，因为它们是不同的工作，而不是某一家定价过高。",
        },
        {
          title: "下单后范围蔓延",
          body: "买家先订了通用验厂，后来追加客户强制的 SMETA 要求。价格变了，因为标准改变了抽样、报告与记录审阅的要求。",
        },
        {
          title: "便宜的报价，狭窄的范围",
          body: "一份低价报价只覆盖场地走一遍加照片报告，没有记录审阅、没有员工访谈。它便宜，是因为它回答不了买家真正关心的合规问题。",
        },
      ],
      checklist: [
        "已写下验厂必须回答的问题。",
        "已为报价确认生产地址与法律主体。",
        "已点明标准或范围：项目、支柱或买家自定义范围。",
        "已向服务方提供场地规模、人数与班次。",
        "报价中已写明审核人天。",
        "已写明差旅与地理假设。",
        "已明确报告语言、格式与时限。",
        "已明确整改跟进是包含还是排除。",
        "已澄清是否包含桌面文件审阅。",
        "已澄清复审或跟进走访是否单独计价。",
        "已按包含项（而非表面价格）比较报价。",
      ],
      tables: [
        {
          title: "验厂费用由什么决定",
          headers: ["成本驱动因素", "它为何改变价格", "询价时应说明什么"],
          rows: [
            ["所在地与差旅", "审核员差旅时间与费用随距驻地远近而变", "完整生产地址，是否涉及偏远差旅"],
            ["验厂类型", "能力、质量、社会责任合规与客户强制项目工作量不同", "你需要哪类验厂"],
            ["现场时长", "审核人天随场地规模、人数与流程复杂度增加", "人数、厂房数、班次安排"],
            ["场地数量", "每多一个场地都叠加审核人天与差旅", "必须覆盖几个场地"],
            ["要求的标准", "SMETA、BSCI、RBA 等项目规定抽样与报告要求", "具体的项目与支柱"],
            ["审核员资质", "主任审核员经验与语言能力影响交付", "要求的审核员背景与工作语言"],
            ["报告范围", "翻译、客户模板与额外复核增加工作量", "报告语言、格式与时限"],
            ["整改跟进", "关闭复核、桌面验证或跟进走访属额外工作", "是否包含整改关闭"],
            ["通知方式", "不通知或半通知走访影响排期", "走访是否预先通知"],
            ["交付时限", "加急报告压缩排期", "要求的报告交付日期"],
          ],
        },
        {
          title: "读懂报价单：应该包含哪些项",
          headers: ["项目", "报价中应出现", "为何重要"],
          rows: [
            ["范围说明", "是", "界定审核员覆盖与不覆盖什么"],
            ["场地与法律主体", "是", "防止验厂被交付在错误的地点"],
            ["标准或支柱", "如客户强制则必须有", "决定抽样与报告是否被接受"],
            ["审核人天", "是", "成本的主要驱动因素"],
            ["差旅假设", "是", "避免后续调整"],
            ["交付物", "是", "报告格式、语言与时限"],
            ["纠正措施处理", "必须明确写明", "常被排除；决定发现项之后发生什么"],
            ["跟进走访条款", "必须明确写明", "关闭通常需要重新审视证据"],
            ["排除项", "是", "让工作边界变得明确"],
          ],
        },
      ],
      faq: [
        {
          q: "中国工厂验厂多少钱？",
          a: "没有一个适用所有范围的统一市场价。费用由所在地与差旅、验厂类型、审核人天、场地数量、要求的标准、审核员资质、报告范围与整改跟进决定。请按书面范围索取报价，并按包含项比较服务方。",
        },
        {
          q: "为什么两份验厂报价差这么多？",
          a: "通常因为它们报的范围不同。一份可能是一天的能力评估，另一份是含员工访谈、翻译与跟进的多日社会责任验厂。应比较包含项，而不是表面数字。",
        },
        {
          q: "便宜的验厂就差吗？",
          a: "不一定，但明显便宜的报价通常反映范围更窄：审核人天更少、无记录审阅、无访谈或无跟进。要核查这个更窄的范围是否仍能回答你的问题。",
        },
        {
          q: "什么对验厂费用影响最大？",
          a: "现场审核人天与所要求的标准。两者都由场地规模、人数与项目要求驱动，因此提供准确的场地信息，才能得到更准确的报价。",
        },
        {
          q: "整改跟进包含在内吗？",
          a: "常常不包含。许多报价只覆盖验厂与报告，纠正措施关闭单独计价。下单前务必确认，因为跟进正是验厂产生长期价值的地方。",
        },
        {
          q: "SMETA 验厂比通用验厂贵吗？",
          a: "有可能。因为既定项目对记录抽样、员工访谈、报告格式有具体要求，并按支柱决定评估广度。这个差异反映的是范围，而不是为名称付溢价。",
        },
        {
          q: "能在不降低价值的前提下省钱吗？",
          a: "可以：围绕你真正要回答的问题收紧范围、提供准确的场地信息、以及在风险真正集中的单一场地做。在复杂场地上压缩审核人天，通常减少的是价值而不是成本。",
        },
      ],
      sources: [
        { name: "Sedex（SMETA）", note: "界定 SMETA 审核类型与支柱，这是审核范围、进而工作量的主要驱动因素。" },
        { name: "责任商业联盟（RBA）", note: "设定 VAP 评估框架与决定评估时长的范围要求。" },
        { name: "FactoryAuditB2B 方法论", note: "本站如何界定验厂范围、证据等级，以及验厂能够确立之事项的局限。" },
      ],
    },
  },
  {
    slug: "supplier-verification-vs-factory-audit-vs-inspection",
    category: "verification",
    titleEn: "Supplier Verification vs Factory Audit vs Inspection: What a Buyer Needs",
    titleZh: "供应商核验、工厂验厂与验货的区别：买家到底需要哪个",
    metaDescEn:
      "A direct comparison of supplier verification, factory audit and pre-shipment inspection: what each one answers, what it costs in time, and which to order first in common sourcing situations.",
    metaDescZh:
      "直接对比供应商核验、工厂验厂与出货前验货：各自回答什么问题、时间成本如何，以及在常见采购场景下该先做哪个。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/services/china-factory-audit" },
    ],
    related: [
      "verify-alibaba-supplier-before-paying",
      "when-to-order-china-factory-audit",
      "what-is-a-factory-audit",
      "pre-shipment-inspection-checklist",
      "on-site-vs-desk-audit",
    ],
    links: [
      {
        href: "/factory-audit/request",
        labelEn: "Request a factory audit",
        labelZh: "申请工厂验厂",
      },
      { href: "/rfq", labelEn: "Post a buyer RFQ", labelZh: "发布采购需求" },
    ],
    en: {
      quickAnswer:
        "Verification answers whether the company is real and legally who it claims to be. A factory audit answers whether the site can make your product and meets the standard you require. An inspection answers whether this specific shipment matches your specification. Most buyers need verification first, an audit before committing significant volume, and inspection before shipping. They answer different questions, so ordering the wrong one produces a clean report that does not address your risk.",
      definition:
        "These are three different scopes of work. Supplier verification is documentary: registration, business scope, address, certificates, payment entity and consistency across records. A factory audit is on-site: it assesses capability, systems and compliance at the production site against a defined scope. An inspection is shipment-specific: it checks quantity, workmanship, specification and packing of a particular order. Confusing them is the most common reason a buyer pays for a report that does not answer the question they had.",
      keyPoints: [
        "Verification is about identity and documents; it can be completed remotely in days.",
        "An audit is about the site and its systems; it requires physical presence and produces a baseline.",
        "An inspection is about a shipment; it says nothing about the factory's ongoing capability.",
        "A clean inspection does not mean the supplier is verified, and a verified supplier can still ship a bad batch.",
        "The right sequence is usually verification, then audit, then inspection, scaled to order value and risk.",
        "State the question first, then choose the scope; choosing a service first often produces the wrong answer.",
      ],
      steps: [
        {
          title: "Write down the question you need answered",
          body: "Is this company real? Can this factory make my product? Is this shipment acceptable? The question determines the scope, and most mis-ordered work comes from skipping this step.",
        },
        {
          title: "Start with verification for any new supplier",
          body: "Confirm the legal entity, business scope, production address, certificates and payment entity. This is the fastest and least expensive check, and it frequently resolves whether to proceed at all.",
        },
        {
          title: "Add an audit when documents cannot settle the question",
          body: "When capability, working conditions, process control or a customer-mandated standard must be established on site, an audit is the appropriate scope. It produces a baseline at the time of the visit.",
        },
        {
          title: "Use inspection to protect each shipment",
          body: "Before shipment, check quantity, workmanship, specification compliance and packing against your requirements. Inspection protects the order in front of you, not the supplier relationship behind it.",
        },
        {
          title: "Combine them where the risk is layered",
          body: "A new supplier for a safety-critical product justifies verification, an audit before the deposit and inspection before shipment. Each layer addresses a failure mode the others cannot.",
        },
        {
          title: "Keep the reports and compare over time",
          body: "Verification records, audit baselines and inspection history together show whether a supplier is improving or drifting. A single report of any type is a snapshot.",
        },
      ],
      examples: [
        {
          title: "New Alibaba supplier, first moderate order",
          body: "Start with verification: licence, scope, address, certificates and payment entity. If the evidence chain is consistent and the product is low risk, add a pre-shipment inspection and skip the audit for this order.",
        },
        {
          title: "Existing supplier with recurring quality problems",
          body: "Verification is not the answer; the supplier is real. A quality-focused audit addresses the process cause, while inspection contains the damage on the current shipment. Both may be needed.",
        },
        {
          title: "Customer requires SMETA before onboarding",
          body: "Only an audit against the required programme and pillars satisfies this. Neither verification nor inspection substitutes for it, because the customer is asking about the site and its systems.",
        },
      ],
      checklist: [
        "The question to be answered is written before ordering any service.",
        "Supplier identity confirmed: legal entity and Unified Social Credit Code.",
        "Business scope reviewed to distinguish factory from trading company.",
        "Production address confirmed and used consistently across documents.",
        "Decision made on whether an audit is needed before the deposit.",
        "Audit scope matched to the customer requirement where one exists.",
        "Inspection booked before shipment for the specific order.",
        "Inspection criteria, AQL and packing requirements defined in advance.",
        "Reports retained and compared across orders.",
      ],
      tables: [
        {
          title: "What Each Service Answers",
          headers: ["Need", "Best starting point", "Why"],
          rows: [
            ["Is this company real?", "Supplier verification", "Registration records answer it directly"],
            ["Does this factory actually exist?", "Supplier verification, then site visit", "Documents first, physical confirmation second"],
            ["Can it manufacture my product?", "Verification plus factory audit", "Capability must be observed, not asserted"],
            ["Does the factory meet buyer requirements?", "Factory audit", "Requires on-site assessment against a scope"],
            ["Is my current order produced correctly?", "Pre-shipment inspection", "Checks the specific shipment against specification"],
            ["Are working conditions acceptable?", "Social compliance audit", "Requires record review and interviews on site"],
            ["Will the next order also be good?", "Audit plus inspection history", "No single check predicts future performance"],
          ],
        },
        {
          title: "Comparison: Verification vs Audit vs Inspection",
          headers: ["Aspect", "Supplier verification", "Factory audit", "Pre-shipment inspection"],
          rows: [
            ["Question answered", "Is the company real and who is it legally?", "Can the site make this and does it meet the standard?", "Is this shipment acceptable?"],
            ["Method", "Documentary and public records", "On-site assessment", "Physical check of goods"],
            ["Typical duration", "Days", "One to several days on site plus report", "Hours to a day per shipment"],
            ["Output", "Verification record with evidence levels", "Findings report with corrective actions", "Inspection report with defect classification"],
            ["Main limitation", "Cannot confirm production reality", "Baseline on the day, not a guarantee", "Says little about ongoing capability"],
            ["Best used", "Before any commitment", "Before significant volume or a customer mandate", "Before shipping each order"],
          ],
        },
      ],
      faq: [
        {
          q: "What is the difference between supplier verification and a factory audit?",
          a: "Verification confirms the company's legal identity, registration, scope, address and consistency of records, largely from documents. An audit is an on-site assessment of whether the site can make your product and meets the required standard. Verification can be done remotely; an audit cannot.",
        },
        {
          q: "Is a factory audit the same as an inspection?",
          a: "No. An audit assesses the factory and its systems, usually independent of any shipment. An inspection checks a specific order for quantity, workmanship, specification and packing. A supplier can pass an audit and still ship a defective batch.",
        },
        {
          q: "Which one should I order first?",
          a: "Usually verification first, because it is fastest and cheapest and often determines whether to proceed. Then an audit before committing significant volume or when a customer mandates a standard. Then inspection before each shipment.",
        },
        {
          q: "Can one service replace another?",
          a: "No. They answer different questions. A verification report does not prove capability, an audit does not certify a shipment, and an inspection does not establish that the factory is compliant or stable.",
        },
        {
          q: "Do I still need an audit if the supplier passed inspection?",
          a: "It depends on your question. Passing inspection means that shipment was acceptable. If you need to know about capability, working conditions or systems for future volume, inspection does not answer that.",
        },
        {
          q: "What if my customer requires a specific audit?",
          a: "Follow the requirement exactly: the programme, the pillars or modules, and the report format. Neither verification nor inspection satisfies a customer-mandated social compliance audit.",
        },
      ],
      sources: [
        {
          name: "ISO 2859-1 (AQL sampling)",
          note: "The sampling standard underlying accept/reject decisions in pre-shipment inspection.",
        },
        {
          name: "Sedex (SMETA) and Responsible Business Alliance (RBA)",
          note: "Programmes that define social compliance audit scope; neither is satisfied by verification or inspection alone.",
        },
        {
          name: "FactoryAuditB2B Methodology",
          note: "How this site separates verification evidence levels from audit findings and inspection results.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "核验回答「这家公司是否真实、法律上是否如其所称」；验厂回答「这个场地能否生产你的产品、是否满足你要求的标准」；验货回答「这一批货是否符合你的规格」。多数买家的顺序是：先核验，在投入可观订单量前验厂，出货前验货。三者回答不同问题，选错就会拿到一份干净但不回应你风险的报告。",
      definition:
        "这是三种不同的工作范围。供应商核验是文件性的：注册、经营范围、地址、证书、收款主体，以及各项记录之间的一致性。工厂验厂是现场性的：按既定范围评估生产场地的能力、体系与合规。验货是订单特定的：检查某笔订单的数量、做工、规格符合性与包装。混淆三者，是买家花钱买到一份不回答其问题报告的最常见原因。",
      keyPoints: [
        "核验关乎身份与文件，可在几天内远程完成。",
        "验厂关乎场地及其体系，需要实地到场，产出的是基线。",
        "验货关乎某一批货，它不说明工厂的持续能力。",
        "验货合格不等于供应商已核验；已核验的供应商仍可能发运一批不良品。",
        "正确顺序通常是核验→验厂→验货，并按订单金额与风险调整力度。",
        "先写出问题，再选范围；先选服务，往往得到错误答案。",
      ],
      steps: [
        {
          title: "写下你需要回答的问题",
          body: "这家公司是真的吗？这家工厂能做我的产品吗？这批货可以接受吗？问题决定范围，而多数选错服务都源于跳过这一步。",
        },
        {
          title: "任何新供应商都从核验开始",
          body: "确认法律主体、经营范围、生产地址、证书与收款主体。这是最快、最省钱的检查，且常常直接决定是否继续推进。",
        },
        {
          title: "文件无法定论时加做验厂",
          body: "当能力、工作条件、过程控制或客户强制标准必须在现场确立时，验厂就是合适的范围，它产出的是访问时点的基线。",
        },
        {
          title: "用验货保护每一批货",
          body: "出货前按你的要求检查数量、做工、规格符合性与包装。验货保护的是眼前这批订单，而不是背后的供应商关系。",
        },
        {
          title: "风险分层时组合使用",
          body: "为安全关键产品引入新供应商，值得做核验、付定金前验厂、出货前验货。每一层都应对其他层无法覆盖的失效模式。",
        },
        {
          title: "保留报告并长期对比",
          body: "核验记录、验厂基线与验货历史合在一起，能显示供应商是在改善还是在滑坡。任何单份报告都只是快照。",
        },
      ],
      examples: [
        {
          title: "阿里巴巴新供应商，首单金额中等",
          body: "从核验开始：执照、经营范围、地址、证书与收款主体。若证据链一致且产品风险低，加做出货前验货，这一单可跳过验厂。",
        },
        {
          title: "现有供应商反复出现质量问题",
          body: "核验不是答案，供应商是真的。聚焦质量的验厂针对的是过程原因，而验货用于控制当前这批货的损失。两者可能都需要。",
        },
        {
          title: "客户要求入驻前提供 SMETA",
          body: "只有按所要求的项目与支柱做验厂才能满足。核验与验货都不能替代，因为客户问的是场地及其体系。",
        },
      ],
      checklist: [
        "订购任何服务前先写下要回答的问题。",
        "已确认供应商身份：法律主体与统一社会信用代码。",
        "已审阅经营范围以区分工厂与贸易公司。",
        "已确认生产地址，并在所有文件中一致使用。",
        "已决策付定金前是否需要验厂。",
        "在有客户要求时，验厂范围已与该要求对齐。",
        "已为具体订单在出货前预约验货。",
        "已提前定义验货判定标准、AQL 与包装要求。",
        "已保留报告并跨订单对比。",
      ],
      tables: [
        {
          title: "各自回答什么问题",
          headers: ["需求", "最佳起点", "原因"],
          rows: [
            ["这家公司是真的吗", "供应商核验", "登记记录可直接回答"],
            ["这家工厂真的存在吗", "先核验，再实地走访", "先文件，再现场确认"],
            ["它能生产我的产品吗", "核验 + 工厂验厂", "能力必须被观察，而不是被声称"],
            ["工厂满足买家要求吗", "工厂验厂", "需按范围做现场评估"],
            ["我当前这批货做得对吗", "出货前验货", "检查具体批次是否符合规格"],
            ["工作条件可接受吗", "社会责任验厂", "需现场审阅记录并访谈"],
            ["下一批也会好吗", "验厂 + 验货历史", "没有任何单次检查能预测未来表现"],
          ],
        },
        {
          title: "核验、验厂、验货对比",
          headers: ["方面", "供应商核验", "工厂验厂", "出货前验货"],
          rows: [
            ["回答的问题", "公司是否真实、法律上是谁", "场地能否生产、是否符合标准", "这批货是否可接受"],
            ["方法", "文件与公开记录", "现场评估", "实物检查"],
            ["典型耗时", "数天", "现场一到数天，另加报告", "每批数小时至一天"],
            ["产出", "带证据等级的核验记录", "含纠正措施的发现报告", "含缺陷分级的验货报告"],
            ["主要局限", "无法确认生产真实性", "是当天基线而非保证", "对持续能力说明有限"],
            ["最佳用途", "任何承诺之前", "投入可观订单量或客户强制前", "每批出货之前"],
          ],
        },
      ],
      faq: [
        {
          q: "供应商核验和工厂验厂有什么区别？",
          a: "核验主要靠文件确认公司的法律身份、注册、经营范围、地址与记录一致性；验厂是现场评估该场地能否生产你的产品并满足要求标准。核验可远程完成，验厂不能。",
        },
        {
          q: "验厂和验货是一回事吗？",
          a: "不是。验厂评估的是工厂及其体系，通常与某批货无关；验货检查的是具体订单的数量、做工、规格与包装。供应商可以通过验厂，仍然发运一批不良品。",
        },
        {
          q: "应该先做哪个？",
          a: "通常先核验，因为它最快最省，且常常决定是否继续；然后在投入可观订单量前或客户强制时验厂；最后每批出货前验货。",
        },
        {
          q: "三者可以互相替代吗？",
          a: "不可以。它们回答不同问题。核验报告不证明能力，验厂不认证某批货，验货也不能确立工厂是否合规或稳定。",
        },
        {
          q: "供应商验货通过了，还需要验厂吗？",
          a: "取决于你的问题。验货通过只说明这批货可接受。若你想知道未来订单量下的能力、工作条件或体系，验货回答不了。",
        },
        {
          q: "如果客户要求做特定验厂怎么办？",
          a: "严格按要求执行：项目、支柱或模块、报告格式。核验与验货都不能满足客户强制的社会责任验厂要求。",
        },
      ],
      sources: [
        { name: "ISO 2859-1（AQL 抽样）", note: "支撑出货前验货合格/不合格判定的抽样标准。" },
        { name: "Sedex（SMETA）与责任商业联盟（RBA）", note: "界定社会责任验厂范围的项目；仅靠核验或验货均无法满足。" },
        { name: "FactoryAuditB2B 方法论", note: "本站如何区分核验证据等级、验厂发现与验货结果。" },
      ],
    },
  },
  {
    slug: "eu-forced-labour-regulation-china-suppliers",
    category: "compliance",
    titleEn: "EU Forced Labour Regulation: What Importers Need From Chinese Suppliers",
    titleZh: "欧盟强迫劳动法规：进口商需要向中国供应商索取什么",
    metaDescEn:
      "What the EU Forced Labour Regulation means for importers of Chinese goods: the official timeline, the supplier and factory evidence to collect, supply chain risk, and when an on-site audit supports due diligence.",
    metaDescZh:
      "欧盟强迫劳动法规对中国商品进口商意味着什么：官方时间表、需收集的供应商与工厂证据、供应链风险，以及现场验厂如何支撑尽职调查。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/services/china-factory-audit" },
    ],
    related: [
      "eudr-supplier-due-diligence-china",
      "rba-vap-vs-smeta-vs-bsci",
      "smeta-7-supplier-audit-buyer-guide",
      "ethical-audit-mandatory-requirements",
      "supplier-quality-audit-checklist",
    ],
    links: [
      {
        href: "/factory-audit/request",
        labelEn: "Request a factory audit for due diligence evidence",
        labelZh: "为尽职调查证据申请工厂验厂",
      },
      { href: "/methodology", labelEn: "How evidence levels are defined", labelZh: "证据等级如何界定" },
    ],
    en: {
      quickAnswer:
        "The EU Forced Labour Regulation prohibits placing products made with forced labour on the EU market, and it applies regardless of where the goods were made. For importers of Chinese goods, the practical work is documentary and supply chain based: know the legal entity and production site behind each product, collect workforce and labour records, map subcontractors, and be able to produce that evidence if a competent authority asks. On-site audits support due diligence but do not certify compliance. This page is general information, not legal advice; check the official European Commission sources for the current text and dates.",
      definition:
        "The EU Forced Labour Regulation is a European Union regulation that prohibits economic operators from placing or exporting products made with forced labour on the EU market. It is product-based rather than company-based, meaning the obligation attaches to the product and its supply chain rather than to a certification status. Authorities may request information during investigations, and importers are expected to be able to show what they knew and what they did about identified risk.",
      keyPoints: [
        "The obligation is product-based and applies regardless of the country of manufacture.",
        "Knowing the production site, not just the contracting supplier, is the foundation of any response.",
        "Subcontracting and labour supply arrangements are where forced labour risk most often hides in practice.",
        "Authorities can request information during an investigation; being able to produce evidence is the practical test.",
        "An audit records conditions at a point in time. It supports due diligence but is not a compliance certificate.",
        "This is general information, not legal advice. Verify current requirements with official EU sources or your own counsel.",
      ],
      steps: [
        {
          title: "Establish the product-to-site map",
          body: "For each product you import, identify the legal entity and the actual production site. A product made by an undisclosed subcontractor cannot be assessed, and an unidentifiable site is itself the finding.",
        },
        {
          title: "Collect supplier-level evidence",
          body: "Obtain the business licence, Unified Social Credit Code, business scope and registered status for each entity in the chain, and confirm that the entity contracting with you is the entity making or controlling the product.",
        },
        {
          title: "Collect factory-level evidence",
          body: "Confirm the production address, site ownership or lease position, the operations performed there, and the headcount. This is the level at which working conditions can actually be assessed.",
        },
        {
          title: "Request workforce and labour records",
          body: "Ask for working hour records, wage records, employment contracts and, where relevant, records relating to labour dispatch or student and migrant worker arrangements. Compare what is documented against what is observed on site.",
        },
        {
          title: "Map subcontractors and labour supply chains",
          body: "Request a written statement of which operations are subcontracted and by whom, including labour dispatch agencies. Forced labour risk is frequently in the layers a buyer has never named.",
        },
        {
          title: "Decide whether an on-site audit is warranted",
          body: "Where risk indicators exist, or where documentary evidence is inconsistent, an on-site audit with a social compliance scope provides observable evidence. It records a baseline and should be followed by corrective action closure.",
        },
        {
          title: "Record decisions and keep evidence current",
          body: "Document what you asked, what you received, what you concluded and what you did about gaps. Due diligence is evidenced by the record of decisions, not by the existence of a policy document.",
        },
      ],
      examples: [
        {
          title: "Gap: production site never identified",
          body: "An importer bought through a trading company and never established where the goods were made. When questioned about labour conditions, it could produce supplier documents but nothing about the site. The gap was identity, not documentation volume.",
        },
        {
          title: "Gap: subcontracting undisclosed",
          body: "The contracted factory disclosed its own records, but a finishing operation was subcontracted to a workshop with different working hour practices. The risk was in a layer the importer had never mapped.",
        },
        {
          title: "Useful response: evidence chain plus audit",
          body: "An importer mapped the product to a named site, obtained workforce records, commissioned a social compliance audit scoped to working hours and labour supply, and closed the corrective actions. The evidence chain was documented and current.",
        },
      ],
      checklist: [
        "Each imported product mapped to a named legal entity and production site.",
        "Business licence and Unified Social Credit Code held for each entity in the chain.",
        "Production address confirmed and consistent across documents.",
        "Operations performed at each site identified.",
        "Working hour and wage records requested and reviewed.",
        "Employment contracts and labour dispatch arrangements reviewed where applicable.",
        "Subcontractors and labour supply agencies named in writing.",
        "Social compliance audit considered where risk indicators exist.",
        "Corrective actions from any audit tracked to closure.",
        "Decisions and evidence recorded with dates.",
        "Current official EU text and dates checked before relying on this summary.",
      ],
      tables: [
        {
          title: "EU Forced Labour Regulation: Official Milestones",
          headers: ["Stage", "What happens", "What importers should do"],
          rows: [
            ["Adoption", "The regulation was adopted and entered into force following publication in the Official Journal", "Note the obligations and start mapping products to sites"],
            ["Preparedness phase", "The European Commission made guidance and preparedness tools available ahead of application", "Build the evidence pack and identify supply chain gaps while there is time"],
            ["Application", "The prohibition on placing products made with forced labour on the EU market becomes applicable and enforceable", "Be able to produce supplier, factory and workforce evidence on request"],
          ],
        },
        {
          title: "Evidence to Collect: Supplier Level vs Factory Level",
          headers: ["Level", "Evidence", "What it establishes"],
          rows: [
            ["Supplier", "Business licence, Unified Social Credit Code, registration status", "The legal entity exists and is who it claims to be"],
            ["Supplier", "Business scope and contracted entity", "Whether it manufactures or intermediates"],
            ["Factory", "Production address confirmed in writing", "Where the product is actually made"],
            ["Factory", "Operations performed at the site", "Which processes are in scope for assessment"],
            ["Workforce", "Working hour and wage records", "Whether documented practice is consistent"],
            ["Workforce", "Employment contracts and labour dispatch records", "How workers are engaged and through whom"],
            ["Supply chain", "Subcontractor and labour agency disclosure", "Which layers are yet to be assessed"],
            ["Assessment", "Social compliance audit report and corrective actions", "Observed conditions at a point in time, and what was fixed"],
          ],
        },
      ],
      faq: [
        {
          q: "What is the EU Forced Labour Regulation?",
          a: "It is an EU regulation prohibiting products made with forced labour from being placed on or exported from the EU market. The obligation attaches to the product and its supply chain rather than to a company certification, so importers need to know where and how their products are made.",
        },
        {
          q: "When does the EU Forced Labour Regulation apply?",
          a: "The regulation was adopted in 2024, followed by a preparedness phase in which the European Commission published guidance and tools, with application and enforcement set to begin in December 2027. Because these are official milestones that may be updated, check the European Commission and EUR-Lex pages for the current dates before relying on them.",
        },
        {
          q: "Does it apply to goods imported from China?",
          a: "Yes. The regulation is product-based and applies regardless of the country of manufacture. Goods imported into the EU from any origin, including China, are within scope if they were made with forced labour.",
        },
        {
          q: "What information should I collect from Chinese suppliers?",
          a: "At minimum: the legal entity and Unified Social Credit Code, confirmation of the production address, the operations performed there, workforce and wage records, and a written disclosure of subcontractors and labour supply arrangements. Keep the evidence dated and current.",
        },
        {
          q: "Is a social compliance audit enough to demonstrate compliance?",
          a: "No single audit demonstrates compliance. An audit records conditions at the time of the visit and supports due diligence, but it is a baseline, not a certificate. What matters is the evidence chain, corrective action closure and ongoing monitoring.",
        },
        {
          q: "Does FactoryAuditB2B certify forced labour compliance?",
          a: "No. This platform provides supplier verification, factory assessment and evidence records that support a buyer's own due diligence. It does not issue legal certifications or determine compliance, which rests with the importer and the competent authorities.",
        },
        {
          q: "Is this legal advice?",
          a: "No. This page is general information for sourcing and due diligence planning. Obligations depend on your role, your products and the applicable rules, so confirm requirements with official EU sources and your own legal counsel.",
        },
      ],
      sources: [
        {
          name: "European Commission — Forced Labour Regulation",
          note: "The official Commission pages setting out the regulation's scope, the prohibition and the preparedness guidance and tools. Check here for current dates and official text.",
        },
        {
          name: "EUR-Lex",
          note: "The official EU legal database carrying the adopted regulation text and its application dates.",
        },
        {
          name: "International Labour Organization (ILO)",
          note: "Defines the forced labour indicators used internationally to identify risk in recruitment, work and wage practices.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "欧盟强迫劳动法规禁止在欧盟市场投放以强迫劳动生产的产品，且不论货物在何地生产均适用。对中国商品进口商而言，实际工作是文件与供应链层面的：知道每件产品背后的法律主体与生产场地、收集用工与劳动记录、绘制分包图谱，并在主管机关询问时能够出示证据。现场验厂可支撑尽职调查，但不构成合规认证。本页为通用信息，非法律建议；请以欧盟委员会官方来源核对当前文本与日期。",
      definition:
        "欧盟强迫劳动法规是一项欧盟法规，禁止经营者在欧盟市场投放或出口以强迫劳动生产的产品。它以产品为基础而非以公司为基础，即义务附着于产品及其供应链，而不是某种认证状态。主管机关可在调查中要求提供信息，进口商应能说明其已知悉什么、以及针对已识别风险采取了什么行动。",
      keyPoints: [
        "义务以产品为基础，不论制造国均适用。",
        "知道生产场地而不只是签约供应商，是任何应对的基础。",
        "实践中，强迫劳动风险最常隐藏在分包与用工供给安排中。",
        "主管机关可在调查中要求提供信息；能否出示证据是实际的检验标准。",
        "验厂记录的是某一时点的状况，它支撑尽职调查，但不是合规证书。",
        "本页为通用信息而非法律建议；请以欧盟官方来源或你的法律顾问核对当前要求。",
      ],
      steps: [
        {
          title: "建立产品到场地的映射",
          body: "对你进口的每件产品，识别其法律主体与实际生产场地。由未披露的分包方生产的产品无从评估，而「场地不可识别」本身就是一项发现。",
        },
        {
          title: "收集供应商层面证据",
          body: "取得链条中每个主体的营业执照、统一社会信用代码、经营范围与登记状态，并确认与你签约的主体就是生产或掌控该产品的主体。",
        },
        {
          title: "收集工厂层面证据",
          body: "确认生产地址、场地权属或租赁状况、在该场地进行的工序，以及员工人数。工作条件只有在这一层才可能被真正评估。",
        },
        {
          title: "索取用工与劳动记录",
          body: "索取工时记录、工资记录、劳动合同，以及在适用时与劳务派遣、学生工、农民工安排相关的记录。把文件所载与现场所见进行比对。",
        },
        {
          title: "绘制分包与用工供给链图谱",
          body: "要求书面说明哪些工序被分包、由谁分包，包括劳务派遣机构。强迫劳动风险常处在买家从未点名的层级。",
        },
        {
          title: "判断是否需要现场验厂",
          body: "当存在风险指标、或文件证据不一致时，含社会责任范围的现场验厂能提供可观察的证据。它记录的是基线，之后应完成纠正措施关闭。",
        },
        {
          title: "记录决策并保持证据时效",
          body: "记录你问了什么、收到什么、得出什么结论、以及针对缺口做了什么。尽职调查由决策记录来证明，而不是靠存在一份政策文件。",
        },
      ],
      examples: [
        {
          title: "缺口：生产场地从未被识别",
          body: "某进口商通过贸易公司采购，从未确认货物在哪里生产。被问及劳动条件时，它能拿出供应商文件，却拿不出任何关于场地的信息。这个缺口是身份性的，而不是文件数量不够。",
        },
        {
          title: "缺口：分包未披露",
          body: "签约工厂披露了自己的记录，但某道后整理工序被分包给一家工时做法不同的作坊。风险处在进口商从未绘制过的层级。",
        },
        {
          title: "有效应对：证据链加验厂",
          body: "某进口商把产品映射到具名场地、取得用工记录、委托了针对工时与用工供给的社会责任验厂，并关闭了纠正措施。证据链既有记录又保持时效。",
        },
      ],
      checklist: [
        "每件进口产品已映射到具名的法律主体与生产场地。",
        "已持有链条中每个主体的营业执照与统一社会信用代码。",
        "已确认生产地址，且各文件一致。",
        "已识别每个场地进行的工序。",
        "已索取并审阅工时与工资记录。",
        "已在适用时审阅劳动合同与劳务派遣安排。",
        "已书面点名分包方与劳务派遣机构。",
        "存在风险指标时已考虑社会责任验厂。",
        "任何验厂的纠正措施已跟踪至关闭。",
        "决策与证据已带日期记录。",
        "依赖本摘要前已核对欧盟官方文本与当前日期。",
      ],
      tables: [
        {
          title: "欧盟强迫劳动法规：官方里程碑",
          headers: ["阶段", "发生什么", "进口商该做什么"],
          rows: [
            ["通过", "法规通过，并在《官方公报》公布后生效", "记录义务内容，开始把产品映射到场地"],
            ["准备期", "欧盟委员会在适用前提供指南与准备工具", "趁有时间建立证据包、识别供应链缺口"],
            ["适用", "禁止在欧盟市场投放以强迫劳动生产的产品开始适用并可被执行", "能够在被要求时出示供应商、工厂与用工证据"],
          ],
        },
        {
          title: "要收集的证据：供应商层与工厂层",
          headers: ["层级", "证据", "它确立了什么"],
          rows: [
            ["供应商", "营业执照、统一社会信用代码、登记状态", "该法律主体存在且身份如其所称"],
            ["供应商", "经营范围与签约主体", "它是制造方还是中间方"],
            ["工厂", "书面确认的生产地址", "产品实际在哪里生产"],
            ["工厂", "该场地进行的工序", "哪些流程在评估范围内"],
            ["用工", "工时与工资记录", "文件做法是否自洽"],
            ["用工", "劳动合同与劳务派遣记录", "工人如何被招用、经由谁"],
            ["供应链", "分包方与劳务派遣机构披露", "哪些层级尚未被评估"],
            ["评估", "社会责任验厂报告与纠正措施", "某一时点观察到的状况，以及修好了什么"],
          ],
        },
      ],
      faq: [
        {
          q: "什么是欧盟强迫劳动法规？",
          a: "它是一项欧盟法规，禁止以强迫劳动生产的产品被投放或出口到欧盟市场。义务附着于产品及其供应链，而不是公司认证，因此进口商必须知道其产品在哪里、如何被生产。",
        },
        {
          q: "欧盟强迫劳动法规何时适用？",
          a: "该法规于 2024 年通过，随后进入准备期，欧盟委员会发布了指南与工具，适用与执行定于 2027 年 12 月开始。由于这些官方里程碑可能更新，依赖前请核对欧盟委员会与 EUR-Lex 页面上的当前日期。",
        },
        {
          q: "它适用于从中国进口的商品吗？",
          a: "适用。该法规以产品为基础，不论制造国均适用。从任何来源（包括中国）进口到欧盟的货物，若以强迫劳动生产，均在范围内。",
        },
        {
          q: "我应该向中国供应商收集哪些信息？",
          a: "至少包括：法律主体与统一社会信用代码、生产地址的确认、在该场地进行的工序、用工与工资记录，以及分包方与用工供给安排的书面披露。证据要带日期并保持时效。",
        },
        {
          q: "做一次社会责任验厂就足以证明合规吗？",
          a: "任何单次验厂都不足以证明合规。验厂记录的是访问当时的状况，它支撑尽职调查，但属于基线而非证书。重要的是证据链、纠正措施关闭与持续监控。",
        },
        {
          q: "FactoryAuditB2B 能认证强迫劳动合规吗？",
          a: "不能。本平台提供支撑买家自身尽职调查的供应商核验、工厂评估与证据记录，不签发法律认证，也不判定合规与否——合规责任在于进口商与主管机关。",
        },
        {
          q: "这是法律建议吗？",
          a: "不是。本页是用于采购与尽职调查规划的通用信息。义务取决于你的角色、产品与适用规则，请以欧盟官方来源与你自己的法律顾问确认要求。",
        },
      ],
      sources: [
        { name: "欧盟委员会——强迫劳动法规", note: "官方页面阐明法规范围、禁止性规定以及准备期指南与工具；当前日期与官方文本以此为准。" },
        { name: "EUR-Lex", note: "欧盟官方法律数据库，载有已通过的法规文本及其适用日期。" },
        { name: "国际劳工组织（ILO）", note: "定义了国际上用于识别招聘、工作与薪酬做法中强迫劳动风险的指标。" },
      ],
    },
  },
  {
    slug: "eudr-supplier-due-diligence-china",
    category: "compliance",
    titleEn: "EUDR Supplier Due Diligence: What EU Buyers Need From China Suppliers",
    titleZh: "EUDR 供应商尽职调查：欧盟买家需要向中国供应商索取什么",
    metaDescEn:
      "What EUDR requires of buyers sourcing from China: covered product categories, geolocation and traceability data, supplier evidence, site verification, and how the timeline affects preparation.",
    metaDescZh:
      "从中国采购的买家在 EUDR 下需要什么：受覆盖的产品类别、地理位置与可追溯数据、供应商证据、现场核验，以及时间表如何影响准备工作。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/services/china-factory-audit" },
    ],
    related: [
      "eu-forced-labour-regulation-china-suppliers",
      "digital-product-passport-supplier-data",
      "supplier-quality-audit-checklist",
      "china-supplier-risk-assessment-framework",
      "esg-supplier-audit-guide",
    ],
    links: [
      {
        href: "/factory-audit/request",
        labelEn: "Request site verification for traceability evidence",
        labelZh: "为可追溯证据申请现场核验",
      },
      {
        href: "/industrial-clusters",
        labelEn: "Explore sourcing clusters by country",
        labelZh: "按国家浏览采购产业带",
      },
    ],
    en: {
      quickAnswer:
        "EUDR requires operators placing relevant products on the EU market to show that those products are deforestation-free and were produced legally in the country of production. For buyers sourcing from China, the practical requirement is traceability: identify the covered commodity in your product, obtain geolocation data for the plot of land where it was grown or produced, collect legality documentation, and keep a due diligence statement. Factory verification supports the part of the chain a buyer controls, but it does not certify EUDR compliance. Verify current requirements with official European Commission sources.",
      definition:
        "The EU Deforestation Regulation (EUDR) is an EU regulation that conditions market access for a defined list of commodities and derived products on due diligence showing the goods are deforestation-free and legally produced. The core evidentiary requirement is traceability to the plot of land where the commodity originated, supported by geolocation data and legality documentation. Obligations differ by operator size and role, and the regulation sets different application dates for different categories of undertaking.",
      keyPoints: [
        "EUDR is commodity-based: obligations attach to listed commodities and products derived from them.",
        "The central evidence requirement is geolocation of the production plot, not a supplier declaration alone.",
        "Legality means compliance with the producing country's applicable law, which must be documented.",
        "Application dates differ for larger and smaller undertakings, so timing depends on your category.",
        "Where a Chinese factory supplies derived products, the buyer still needs upstream commodity data.",
        "Verification can establish who made what and where; it cannot certify EUDR compliance.",
      ],
      steps: [
        {
          title: "Determine whether your product is in scope",
          body: "Check whether your product contains or is derived from a covered commodity: wood, rubber, coffee, cocoa, palm oil, soy or cattle, including common derivatives such as furniture, tyres, leather, paper and packaging. Scope is determined by the product, not by the supplier's industry label.",
        },
        {
          title: "Map the product back to the commodity",
          body: "For each in-scope product, trace the supply chain back to the commodity and its country of production. This is the step where most buyers discover that the data they have is commercial, not traceability data.",
        },
        {
          title: "Request geolocation and legality data",
          body: "Ask the supplier for geolocation coordinates of the plot of production, along with evidence of legal production in the country of origin. A letter stating compliance is not geolocation data.",
        },
        {
          title: "Assess the supplier's ability to provide it",
          body: "Many manufacturers can identify their immediate material supplier but not the plot of origin. Where the supplier cannot produce the data, that is a material supply chain gap to resolve, not a formality.",
        },
        {
          title: "Verify the manufacturing site separately",
          body: "Confirm the legal entity, production address and operations of the factory making the finished product. EUDR traceability concerns the commodity, but knowing the actual production site remains necessary for any sourcing decision.",
        },
        {
          title: "Keep the due diligence record",
          body: "Maintain the due diligence statement, the evidence collected and the risk assessment, with dates. The record is what demonstrates diligence, and it must be current rather than historical.",
        },
        {
          title: "Plan for the applicable date",
          body: "Identify which undertaking category you fall into and the corresponding application date, and work backwards to when data collection must start. Commodity data collection is slow, so it should begin well before the date.",
        },
      ],
      examples: [
        {
          title: "Furniture with wood content",
          body: "A buyer imports wooden furniture from China. The product is derived from a covered commodity, so the buyer needs wood species data, plot geolocation and legality evidence from upstream, not just a compliant factory.",
        },
        {
          title: "Rubber components in an assembly",
          body: "A buyer sources an assembled product with rubber parts. The rubber content puts the product in scope, and the traceability question moves upstream to the rubber supply chain the factory may not control.",
        },
        {
          title: "Supplier cannot provide plot data",
          body: "A factory provided a compliance declaration but no geolocation data for the material origin. The gap is data availability upstream, which the factory cannot resolve by asserting compliance.",
        },
      ],
      checklist: [
        "Products checked against the covered commodity list, including derivatives.",
        "In-scope products mapped back to the commodity and country of production.",
        "Geolocation data for the plot of production requested.",
        "Legality documentation for the country of production requested.",
        "Supplier's ability to provide upstream data assessed.",
        "Manufacturing site legal entity and address verified.",
        "Operations performed at the site identified.",
        "Due diligence statement and evidence retained with dates.",
        "Undertaking category identified and applicable date noted.",
        "Current official EU sources checked before relying on this summary.",
      ],
      tables: [
        {
          title: "EUDR Covered Commodities and Common Derived Products",
          headers: ["Commodity", "Common derived products relevant to sourcing", "Data implication"],
          rows: [
            ["Wood", "Furniture, paper, packaging, plywood, wooden components", "Species and plot geolocation needed upstream"],
            ["Rubber", "Tyres, seals, footwear, industrial rubber parts", "Traceability moves to plantation or producer level"],
            ["Coffee", "Roasted and packaged coffee products", "Origin plot data from agricultural supply chain"],
            ["Cocoa", "Chocolate and cocoa-derived ingredients", "Origin plot data from agricultural supply chain"],
            ["Palm oil", "Food ingredients, cosmetics, oleochemicals", "Widely dispersed; upstream data often the constraint"],
            ["Soy", "Animal feed, food ingredients, oils", "Origin data required from feed or crop supply chain"],
            ["Cattle", "Leather, hides, beef-derived products", "Traceability to rearing and origin locations"],
          ],
        },
        {
          title: "EUDR Data Requirements: What to Ask and From Whom",
          headers: ["Data element", "Who typically holds it", "Why buyers struggle with it"],
          rows: [
            ["Product and commodity identification", "The manufacturer", "Usually available; derivatives often missed"],
            ["Country of production", "The manufacturer or material supplier", "Available but rarely documented formally"],
            ["Geolocation of the plot", "Upstream grower or producer", "Often not held by the immediate supplier"],
            ["Legality documentation", "Producer in the country of origin", "Format and recognition vary by jurisdiction"],
            ["Supplier identity and site", "The manufacturer", "Available through standard verification"],
            ["Due diligence statement", "The operator placing on the market", "Requires the data above to be complete first"],
          ],
        },
      ],
      faq: [
        {
          q: "What is EUDR?",
          a: "The EU Deforestation Regulation requires operators placing certain commodities and derived products on the EU market to demonstrate through due diligence that the goods are deforestation-free and were produced legally in the country of production.",
        },
        {
          q: "Which products are covered by EUDR?",
          a: "The regulation covers wood, rubber, coffee, cocoa, palm oil, soy and cattle, including products derived from them such as furniture, tyres, leather, paper and packaging. Scope follows the commodity in the product, not the supplier's sector.",
        },
        {
          q: "When does EUDR apply?",
          a: "Application dates differ by the size and category of the undertaking, with later dates for micro and small enterprises than for large and medium ones. Because dates have been adjusted by EU legislative action, confirm the current applicable date on official European Commission and EUR-Lex sources.",
        },
        {
          q: "What does EUDR require from Chinese suppliers?",
          a: "Practically: identification of any covered commodity in the product, traceability back to the country and plot of production, geolocation data, and legality documentation. Many suppliers can provide commercial data but not plot-level traceability, which is the usual gap.",
        },
        {
          q: "Can a factory audit satisfy EUDR?",
          a: "No. An audit can establish who manufactured what and where, and can verify identity, capability and site reality, which supports your sourcing records. EUDR compliance depends on commodity traceability and legality data plus your own due diligence statement.",
        },
        {
          q: "Does FactoryAuditB2B certify EUDR compliance?",
          a: "No. This platform provides supplier verification and factory assessment to support a buyer's own due diligence. It does not issue EUDR compliance certifications or make legal determinations.",
        },
        {
          q: "Is this legal advice?",
          a: "No. This is general information for sourcing preparation. Your obligations depend on your role, products and applicable rules, so confirm with official EU sources and your own legal counsel.",
        },
      ],
      sources: [
        {
          name: "European Commission — EU Deforestation Regulation",
          note: "Official pages covering scope, covered commodities, obligations and the current implementation timeline, including any adjustments adopted by the EU.",
        },
        {
          name: "EUR-Lex",
          note: "Official EU legal database carrying the regulation text and any amending acts affecting application dates.",
        },
        {
          name: "FactoryAuditB2B Methodology",
          note: "How supplier identity, production site and operations are verified, and the limits of what verification can establish.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "EUDR 要求将相关产品投放欧盟市场的经营者证明这些产品无毁林、且在生产国合法生产。对从中国采购的买家而言，实际要求是可追溯性：识别你产品中的受覆盖商品、取得其种植或生产地块的地理位置数据、收集合法性文件，并保留尽职调查声明。工厂核验能支撑买家可控的那一段链条，但不构成 EUDR 合规认证。请以欧盟委员会官方来源核对当前要求。",
      definition:
        "欧盟毁林法规（EUDR）是一项欧盟法规，它把一份明确清单上的商品及其衍生产品进入欧盟市场的准入条件，设定为「通过尽职调查证明货物无毁林且合法生产」。核心证据要求是可追溯到商品原产的地块，并以地理位置数据与合法性文件为支撑。义务因经营者规模与角色而异，法规对不同类别的企业设定了不同的适用日期。",
      keyPoints: [
        "EUDR 以商品为基础：义务附着于清单商品及其衍生产品。",
        "核心证据要求是生产地块的地理位置，而不仅是供应商声明。",
        "合法性指符合生产国适用法律，且必须形成文件。",
        "大中小微企业的适用日期不同，因此时间取决于你的类别。",
        "中国工厂供应衍生产品时，买家仍需取得上游商品数据。",
        "核验能确立谁生产了什么、在哪里生产，但不能认证 EUDR 合规。",
      ],
      steps: [
        {
          title: "判断你的产品是否在范围内",
          body: "核查你的产品是否含有或衍生自受覆盖商品：木材、橡胶、咖啡、可可、棕榈油、大豆或牛，包括家具、轮胎、皮革、纸张与包装等常见衍生品。范围由产品决定，而不是由供应商的行业标签决定。",
        },
        {
          title: "把产品回溯映射到商品",
          body: "对每个在范围内的产品，把供应链回溯到商品及其生产国。正是在这一步，多数买家会发现自己手上的数据是商业数据，而不是可追溯数据。",
        },
        {
          title: "索取地理位置与合法性数据",
          body: "向供应商索取生产地块的地理坐标，连同在原产国合法生产的证据。一封声明合规的信函不是地理坐标数据。",
        },
        {
          title: "评估供应商提供数据的能力",
          body: "许多制造商能指出其直接材料供应商，但指不出原产地块。供应商拿不出数据时，这是必须解决的实际供应链缺口，而不是一个形式问题。",
        },
        {
          title: "单独核验制造场地",
          body: "确认生产成品工厂的法律主体、生产地址与工序。EUDR 的可追溯性针对商品，但知道实际生产场地对任何采购决策仍然必要。",
        },
        {
          title: "保留尽职调查记录",
          body: "保存尽职调查声明、已收集证据与风险评估，并带日期。能证明尽职程度的是记录，且它必须是当前的而非历史的。",
        },
        {
          title: "按适用日期倒排计划",
          body: "确定你属于哪类企业及对应适用日期，再倒推数据收集必须何时启动。商品数据收集很慢，应远早于该日期开始。",
        },
      ],
      examples: [
        {
          title: "含木材的家具",
          body: "买家从中国进口木制家具。该产品衍生自受覆盖商品，因此买家需要上游的木材树种数据、地块地理坐标与合法性证据，而不只需要一家合规的工厂。",
        },
        {
          title: "装配件中的橡胶部件",
          body: "买家采购含橡胶部件的组装产品。橡胶成分使该产品进入范围，可追溯问题就上移到工厂可能并不掌控的橡胶供应链。",
        },
        {
          title: "供应商无法提供地块数据",
          body: "某工厂提供了合规声明，但拿不出材料原产地的地理坐标。这个缺口是上游的数据可得性，工厂无法靠声称合规来解决。",
        },
      ],
      checklist: [
        "已对照受覆盖商品清单核查产品，含衍生品。",
        "已把范围内产品回溯映射到商品与生产国。",
        "已索取生产地块的地理坐标数据。",
        "已索取生产国的合法性文件。",
        "已评估供应商提供上游数据的能力。",
        "已核验制造场地的法律主体与地址。",
        "已识别该场地进行的工序。",
        "已带日期保存尽职调查声明与证据。",
        "已识别企业类别并记下适用日期。",
        "依赖本摘要前已核对欧盟官方来源。",
      ],
      tables: [
        {
          title: "EUDR 受覆盖商品与常见衍生产品",
          headers: ["商品", "与采购相关的常见衍生品", "数据含义"],
          rows: [
            ["木材", "家具、纸张、包装、胶合板、木制部件", "需要上游的树种与地块坐标"],
            ["橡胶", "轮胎、密封件、鞋类、工业橡胶件", "可追溯上移至种植园或生产者层级"],
            ["咖啡", "烘焙与包装咖啡产品", "来自农业供应链的原产地块数据"],
            ["可可", "巧克力与可可衍生配料", "来自农业供应链的原产地块数据"],
            ["棕榈油", "食品配料、化妆品、油脂化学品", "分布极广；上游数据常是瓶颈"],
            ["大豆", "动物饲料、食品配料、油类", "需来自饲料或作物供应链的原产数据"],
            ["牛", "皮革、皮张、牛肉衍生品", "需追溯到饲养与原产地"],
          ],
        },
        {
          title: "EUDR 数据要求：问什么、向谁要",
          headers: ["数据项", "通常由谁持有", "买家为何难以取得"],
          rows: [
            ["产品与商品识别", "制造商", "通常可得；衍生品常被漏掉"],
            ["生产国", "制造商或材料供应商", "可得但很少正式形成文件"],
            ["地块地理坐标", "上游种植者或生产者", "直接供应商往往不持有"],
            ["合法性文件", "原产国的生产者", "格式与认可度因司法辖区而异"],
            ["供应商身份与场地", "制造商", "通过常规核验即可取得"],
            ["尽职调查声明", "投放市场的经营者", "需以上数据先完整"],
          ],
        },
      ],
      faq: [
        {
          q: "什么是 EUDR？",
          a: "欧盟毁林法规要求将特定商品及衍生产品投放欧盟市场的经营者，通过尽职调查证明货物无毁林、且在生产国合法生产。",
        },
        {
          q: "EUDR 覆盖哪些产品？",
          a: "法规覆盖木材、橡胶、咖啡、可可、棕榈油、大豆与牛，包括其衍生产品，如家具、轮胎、皮革、纸张与包装。范围跟随产品中的商品，而不是供应商所属行业。",
        },
        {
          q: "EUDR 何时适用？",
          a: "适用日期因企业规模与类别而异，微型与小型企业晚于大型与中型企业。由于日期曾通过欧盟立法程序调整，请以欧盟委员会与 EUR-Lex 官方来源确认当前适用日期。",
        },
        {
          q: "EUDR 要求中国供应商提供什么？",
          a: "实践中包括：识别产品中任何受覆盖商品、追溯到生产国与生产地块、地理坐标数据，以及合法性文件。许多供应商能提供商业数据，但拿不到地块级可追溯数据，这正是常见缺口。",
        },
        {
          q: "做一次工厂验厂能满足 EUDR 吗？",
          a: "不能。验厂能确立谁生产了什么、在哪里生产，并核验身份、能力与场地真实性，从而支撑你的采购记录。EUDR 合规取决于商品可追溯性与合法性数据，以及你自己的尽职调查声明。",
        },
        {
          q: "FactoryAuditB2B 能认证 EUDR 合规吗？",
          a: "不能。本平台提供支撑买家自身尽职调查的供应商核验与工厂评估，不签发 EUDR 合规认证，也不作法律判定。",
        },
        {
          q: "这是法律建议吗？",
          a: "不是。这是用于采购准备的通用信息。你的义务取决于角色、产品与适用规则，请以欧盟官方来源与你自己的法律顾问确认。",
        },
      ],
      sources: [
        { name: "欧盟委员会——欧盟毁林法规（EUDR）", note: "官方页面涵盖范围、受覆盖商品、义务与当前实施时间表，含欧盟通过的任何调整。" },
        { name: "EUR-Lex", note: "欧盟官方法律数据库，载有法规文本及影响适用日期的任何修订法案。" },
        { name: "FactoryAuditB2B 方法论", note: "供应商身份、生产场地与工序如何被核验，以及核验能够确立之事项的边界。" },
      ],
    },
  },
  {
    slug: "digital-product-passport-supplier-data",
    category: "compliance",
    titleEn: "Digital Product Passport: What EU Buyers Should Collect From Suppliers",
    titleZh: "数字产品护照（DPP）：欧盟买家应向供应商收集哪些数据",
    metaDescEn:
      "What the EU Digital Product Passport means for suppliers: the product, material, manufacturing and sustainability data buyers may need, which categories are prioritised, and how to prepare suppliers.",
    metaDescZh:
      "欧盟数字产品护照对供应商意味着什么：买家可能需要的产品、材料、制造与可持续数据，优先覆盖的品类，以及如何让供应商提前准备。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-risk-calculator" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/services/china-factory-audit" },
    ],
    related: [
      "eudr-supplier-due-diligence-china",
      "eu-forced-labour-regulation-china-suppliers",
      "esg-supplier-audit-guide",
      "what-is-quality-management-system",
      "china-supplier-risk-assessment-framework",
    ],
    links: [
      { href: "/rfq", labelEn: "Post a buyer RFQ", labelZh: "发布采购需求" },
      {
        href: "/suppliers",
        labelEn: "Find suppliers with documented profiles",
        labelZh: "查找有档案记录的供应商",
      },
    ],
    en: {
      quickAnswer:
        "A Digital Product Passport is a structured set of product data accessible digitally, intended to carry information about a product's identity, materials, manufacture, sustainability and end-of-life handling through its lifecycle. For buyers, the practical implication is that supplier data collection becomes a requirement rather than a nice-to-have. Start by confirming product identity and manufacturer identity, then material composition, manufacturing information and any traceability records the supplier can actually produce. This platform supports supplier information and verification; it is not a passport issuer or a certification body.",
      definition:
        "The Digital Product Passport (DPP) is a concept and instrument under the EU Ecodesign for Sustainable Products Regulation (ESPR) framework: a digital record carrying defined product information to support circularity, repair, recycling and regulatory checks. The European Commission has made a central registry available and is prioritising categories in waves rather than introducing every category at once. Because data requirements are set per product category through delegated acts, the specific fields a supplier must provide depend on the category and the timing adopted.",
      keyPoints: [
        "A DPP is product data, not a certificate: it carries information rather than certifying performance.",
        "Data requirements are set per product category, so scope depends on which category applies to you.",
        "Manufacturer identity and product identity are the foundation; everything else builds on them.",
        "Material composition data is usually the hardest for suppliers to produce accurately.",
        "Suppliers should be prepared early, because data collection takes longer than buyers expect.",
        "Verification can confirm who made the product and where; it does not issue or validate a passport.",
      ],
      steps: [
        {
          title: "Confirm whether your category is in a prioritised wave",
          body: "Identify whether your product falls into a category being prioritised in the current wave, such as textiles, steel, aluminium, tyres, furniture or ICT, or into a category with its own earlier implementation date such as batteries. Prioritisation determines timing, not whether preparation is worthwhile.",
        },
        {
          title: "Start with manufacturer and product identity",
          body: "Confirm the legal entity, Unified Social Credit Code and production site, and give the product a stable identifier. Without unambiguous identity, downstream data cannot be attributed to anything.",
        },
        {
          title: "Collect material composition data",
          body: "Ask for a bill of materials with material names, grades and proportions, plus any substances subject to reporting. This is usually the least complete dataset at most suppliers.",
        },
        {
          title: "Collect manufacturing information",
          body: "Record the production site, the operations performed there and the date or batch reference, so product data can be linked to a place and a process rather than to a company in the abstract.",
        },
        {
          title: "Collect sustainability and traceability data",
          body: "Where required, request recycled content, environmental footprint or origin data, together with the records that support it. Unsupported figures are the main risk in passport data.",
        },
        {
          title: "Check what the supplier can actually evidence",
          body: "Ask which data points the supplier can document today and which would need upstream input. The gap list becomes the work plan and, where needed, the reason to verify or audit a site.",
        },
        {
          title: "Keep data current and attributable",
          body: "Store the data with dates, sources and the entity that provided it. Passport data is expected to be maintained, so a one-off collection exercise is not enough.",
        },
      ],
      examples: [
        {
          title: "Furniture supplier preparing data",
          body: "A furniture manufacturer could provide product identity and its own production records, but its material declarations for wood and foam depended on upstream suppliers. The work plan became an upstream data request, not a factory exercise.",
        },
        {
          title: "Textile supplier with incomplete composition data",
          body: "A textile supplier provided fibre percentages for the main fabric but not for trims and linings. The passport data was incomplete because composition had never been documented at component level.",
        },
        {
          title: "Battery-related category with an earlier date",
          body: "A buyer sourcing battery-containing products noted that the battery category carries its own implementation date, earlier than the broader waves, and sequenced data collection accordingly.",
        },
      ],
      checklist: [
        "Product category checked against the prioritised waves and any category-specific dates.",
        "Legal entity and Unified Social Credit Code confirmed for the manufacturer.",
        "Production site confirmed and consistent across records.",
        "Stable product identifier assigned.",
        "Bill of materials requested with material names, grades and proportions.",
        "Substances subject to reporting identified.",
        "Manufacturing information recorded: site, operations, batch or date reference.",
        "Recycled content and origin data requested where applicable.",
        "Supporting records obtained for each data point, not just figures.",
        "Data stored with dates, sources and the providing entity.",
        "Current official EU sources checked before relying on this summary.",
      ],
      tables: [
        {
          title: "DPP Data: What Buyers Should Collect",
          headers: ["Data group", "Typical fields", "Where suppliers struggle"],
          rows: [
            ["Supplier identity", "Legal entity name, Unified Social Credit Code, production address", "Usually available through standard verification"],
            ["Product identity", "Product type, model, stable identifier, batch reference", "Identifiers often inconsistent across systems"],
            ["Product materials", "Bill of materials, material grades, proportions, reportable substances", "Component-level composition rarely documented"],
            ["Manufacturing information", "Production site, operations performed, date or batch", "Linking product data to a specific site and process"],
            ["Sustainability data", "Recycled content, environmental footprint, durability or repair information", "Figures without supporting records"],
            ["Traceability data", "Material origin, upstream supplier references", "Upstream suppliers not identified or not cooperating"],
            ["Digital records", "Source documents, dates, providing entity", "Data collected once and never maintained"],
          ],
        },
        {
          title: "Prioritised Categories and What They Imply",
          headers: ["Category", "Data implication for suppliers", "Preparation priority"],
          rows: [
            ["Textiles", "Fibre composition at component level, including trims and linings", "High: composition data is usually incomplete"],
            ["Steel and aluminium", "Material grade, recycled content and origin", "High: upstream mill data required"],
            ["Tyres", "Material composition and durability information", "Medium: composition largely known, records need formalising"],
            ["Furniture", "Material declarations across wood, foam, textiles and hardware", "High: multi-material bills of materials"],
            ["ICT and electronics", "Component-level composition and substance reporting", "High: complex supply chains"],
            ["Batteries", "Category-specific requirements with an earlier implementation date", "High: earlier timeline than broader waves"],
          ],
        },
      ],
      faq: [
        {
          q: "What is a Digital Product Passport?",
          a: "It is a structured digital record carrying defined information about a product, such as its identity, materials, manufacture, sustainability attributes and end-of-life handling. It is part of the EU Ecodesign for Sustainable Products Regulation framework and is intended to support circularity, repair, recycling and regulatory checks.",
        },
        {
          q: "Which product categories are prioritised?",
          a: "The European Commission is introducing categories in waves rather than all at once, with categories such as textiles, steel, aluminium, tyres, furniture and ICT among those prioritised, and batteries carrying their own earlier implementation date. Because waves and dates are set through EU acts, confirm the current position on official sources.",
        },
        {
          q: "What data will suppliers need to provide?",
          a: "The specific fields are set per product category, but the common groups are supplier identity, product identity, material composition, manufacturing information, sustainability attributes and traceability data, each supported by records. Unsupported figures are the main risk.",
        },
        {
          q: "Is a Digital Product Passport a certificate?",
          a: "No. It is a data record, not a certification of performance or compliance. It carries information that authorities, buyers and recyclers can use, and the responsibility for accurate data sits with the operator placing the product on the market.",
        },
        {
          q: "Can FactoryAuditB2B issue a Digital Product Passport?",
          a: "No. This platform provides supplier verification and factory assessment, helping buyers confirm manufacturer identity, production site and operations, and collect supplier information. It does not issue passports, operate the EU registry, or certify product data.",
        },
        {
          q: "How should buyers prepare suppliers?",
          a: "Start with identity and product identifiers, then request a component-level bill of materials, then sustainability and traceability data with supporting records. Identify which data points the supplier cannot evidence today and treat that list as the work plan.",
        },
        {
          q: "Is this legal advice?",
          a: "No. It is general information for sourcing preparation. Requirements depend on your product category and role, so confirm with official EU sources and your own counsel.",
        },
      ],
      sources: [
        {
          name: "European Commission — Ecodesign for Sustainable Products Regulation (ESPR) and Digital Product Passport",
          note: "Official source for the passport concept, the central registry, prioritised categories and category-specific requirements.",
        },
        {
          name: "EUR-Lex",
          note: "Official EU legal database carrying the ESPR text and the delegated acts that define data requirements per category.",
        },
        {
          name: "FactoryAuditB2B Methodology",
          note: "How manufacturer identity, production site and operations are verified, and the limits of what verification establishes.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "数字产品护照（DPP）是一组可数字访问的结构化产品数据，用于承载产品身份、材料、制造、可持续性与报废处理等信息。对买家而言，实际含义是供应商数据收集从「加分项」变成「必做项」。先从确认产品身份与制造商身份开始，再收集材料成分、制造信息，以及供应商真正拿得出的可追溯记录。本平台支撑供应商信息与核验，不是护照签发机构或认证机构。",
      definition:
        "数字产品护照（DPP）是欧盟《可持续产品生态设计法规》（ESPR）框架下的概念与工具：一份承载既定产品信息的数字记录，用以支持循环、维修、回收与监管核查。欧盟委员会已提供中央登记系统，并按波次优先推进品类，而非一次性引入所有品类。由于数据要求按产品类别通过授权法案设定，供应商必须提供的具体字段取决于所属类别与通过的时间表。",
      keyPoints: [
        "DPP 是产品数据，不是证书：它承载信息，而不是认证性能。",
        "数据要求按产品类别设定，因此范围取决于你属于哪个类别。",
        "制造商身份与产品身份是基础，其余都建立在它们之上。",
        "材料成分数据通常是供应商最难准确产出的部分。",
        "供应商应尽早准备，因为数据收集耗时超出买家预期。",
        "核验能确认谁生产了产品、在哪里生产，但不签发也不验证护照。",
      ],
      steps: [
        {
          title: "确认你的品类是否在本轮优先波次中",
          body: "识别你的产品属于当前波次优先推进的品类（如纺织品、钢铁、铝、轮胎、家具、ICT），还是有独立更早实施日期的品类（如电池）。优先顺序决定的是时间，而不是准备是否值得。",
        },
        {
          title: "从制造商与产品身份开始",
          body: "确认法律主体、统一社会信用代码与生产场地，并给产品一个稳定的标识符。没有无歧义的身份，下游数据就无法归属到任何东西。",
        },
        {
          title: "收集材料成分数据",
          body: "索取含材料名称、牌号与比例的材料清单（BOM），以及任何需申报的物质。这通常是多数供应商处最不完整的数据集。",
        },
        {
          title: "收集制造信息",
          body: "记录生产场地、在该场地进行的工序，以及日期或批次参照，使产品数据能关联到具体地点与流程，而不是抽象地关联到一家公司。",
        },
        {
          title: "收集可持续性与可追溯数据",
          body: "在要求时索取再生成分、环境足迹或原产地数据，连同支撑它们的记录。没有支撑记录的数值，是护照数据中的主要风险。",
        },
        {
          title: "核查供应商实际能拿出什么证据",
          body: "问清哪些数据点供应商今天能形成文件、哪些需要上游输入。这份缺口清单就是工作计划，必要时也是核验或验厂某个场地的理由。",
        },
        {
          title: "保持数据时效与可归属",
          body: "带日期、来源与提供方主体保存数据。护照数据需要持续维护，因此一次性收集并不够。",
        },
      ],
      examples: [
        {
          title: "家具供应商准备数据",
          body: "某家具制造商能提供产品身份与自己的生产记录，但其木材与海绵的材料声明依赖上游供应商。工作计划于是变成一次上游数据索取，而不是一场工厂层面的工作。",
        },
        {
          title: "纺织供应商成分数据不完整",
          body: "某纺织供应商提供了主面料的纤维比例，但没提供辅料与衬里的。护照数据不完整，因为成分从未在部件层级被记录过。",
        },
        {
          title: "电池相关品类的较早日期",
          body: "某买家采购含电池产品，注意到电池品类有其独立的、早于更广泛波次的实施日期，于是据此安排数据收集的先后顺序。",
        },
      ],
      checklist: [
        "已对照优先波次与任何品类特定日期核查产品类别。",
        "已确认制造商的法律主体与统一社会信用代码。",
        "已确认生产场地，且各记录一致。",
        "已为产品分配稳定标识符。",
        "已索取含材料名称、牌号与比例的材料清单。",
        "已识别需申报的物质。",
        "已记录制造信息：场地、工序、批次或日期参照。",
        "已在适用时索取再生成分与原产地数据。",
        "已为每个数据点取得支撑记录，而不只是数值。",
        "已带日期、来源与提供方保存数据。",
        "依赖本摘要前已核对欧盟官方来源。",
      ],
      tables: [
        {
          title: "DPP 数据：买家应收集什么",
          headers: ["数据组", "典型字段", "供应商的难点"],
          rows: [
            ["供应商身份", "法律主体名称、统一社会信用代码、生产地址", "通常通过常规核验即可取得"],
            ["产品身份", "产品类型、型号、稳定标识符、批次参照", "标识符在各系统间常不一致"],
            ["产品材料", "材料清单、牌号、比例、需申报物质", "部件级成分很少被记录"],
            ["制造信息", "生产场地、所进行工序、日期或批次", "把产品数据关联到具体场地与流程"],
            ["可持续性数据", "再生成分、环境足迹、耐用或可维修信息", "数值缺少支撑记录"],
            ["可追溯数据", "材料原产地、上游供应商参照", "上游未识别或不配合"],
            ["数字记录", "源文件、日期、提供方主体", "数据收集一次后不再维护"],
          ],
        },
        {
          title: "优先品类及其含义",
          headers: ["品类", "对供应商的数据含义", "准备优先级"],
          rows: [
            ["纺织品", "部件级纤维成分，含辅料与衬里", "高：成分数据通常不完整"],
            ["钢铁与铝", "材料牌号、再生成分与原产地", "高：需要上游工厂数据"],
            ["轮胎", "材料成分与耐用性信息", "中：成分大致已知，记录需规范化"],
            ["家具", "木材、海绵、纺织品与五金的材料声明", "高：多材料物料清单"],
            ["ICT 与电子", "部件级成分与物质申报", "高：供应链复杂"],
            ["电池", "有独立且更早实施日期的品类特定要求", "高：时间早于更广泛波次"],
          ],
        },
      ],
      faq: [
        {
          q: "什么是数字产品护照？",
          a: "它是一份承载产品既定信息的结构化数字记录，例如身份、材料、制造、可持续属性与报废处理方式。它属于欧盟《可持续产品生态设计法规》框架，旨在支持循环、维修、回收与监管核查。",
        },
        {
          q: "哪些产品品类被优先推进？",
          a: "欧盟委员会按波次推进而非一次全覆盖，其中纺织品、钢铁、铝、轮胎、家具与 ICT 等属于优先品类，电池则有其独立更早的实施日期。由于波次与日期通过欧盟法案确定，请以官方来源确认当前情况。",
        },
        {
          q: "供应商需要提供哪些数据？",
          a: "具体字段按产品类别设定，但常见数据组包括：供应商身份、产品身份、材料成分、制造信息、可持续属性与可追溯数据，且每一项都需有记录支撑。缺少支撑的数值是主要风险。",
        },
        {
          q: "数字产品护照是证书吗？",
          a: "不是。它是数据记录，不是性能或合规的认证。它承载的是主管机关、买家与回收方可使用的信息，数据准确性的责任在于投放产品的经营者。",
        },
        {
          q: "FactoryAuditB2B 能签发数字产品护照吗？",
          a: "不能。本平台提供供应商核验与工厂评估，帮助买家确认制造商身份、生产场地与工序，并收集供应商信息；它不签发护照、不运营欧盟登记系统，也不认证产品数据。",
        },
        {
          q: "买家应如何帮供应商做准备？",
          a: "从身份与产品标识符开始，再索取部件级材料清单，然后是带支撑记录的可持续性与可追溯数据。识别供应商今天无法举证的那些数据点，把这份清单当作工作计划。",
        },
        {
          q: "这是法律建议吗？",
          a: "不是。这是用于采购准备的通用信息。要求取决于你的产品类别与角色，请以欧盟官方来源与你自己的顾问确认。",
        },
      ],
      sources: [
        { name: "欧盟委员会——ESPR 与数字产品护照", note: "护照概念、中央登记系统、优先品类与品类特定要求的官方来源。" },
        { name: "EUR-Lex", note: "欧盟官方法律数据库，载有 ESPR 文本及按品类界定数据要求的授权法案。" },
        { name: "FactoryAuditB2B 方法论", note: "制造商身份、生产场地与工序如何被核验，以及核验能够确立之事项的边界。" },
      ],
    },
  },
  {
    slug: "smeta-7-supplier-audit-buyer-guide",
    category: "compliance",
    titleEn: "SMETA 7 for Buyers: What to Check When Qualifying a Supplier",
    titleZh: "买家视角的 SMETA 7：审核报告该看什么",
    metaDescEn:
      "How buyers should read a SMETA 7 report: 2-pillar versus 4-pillar scope, the main assessment areas, corrective actions, critical findings, follow-up, and when a buyer should request one.",
    metaDescZh:
      "买家如何阅读 SMETA 7 报告：两支柱与四支柱范围、主要评估领域、纠正措施、关键发现、跟进，以及何时该要求做一次。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/china-factory-audit" },
      { href: "/services/china-supplier-verification" },
    ],
    related: [
      "rba-vap-vs-smeta-vs-bsci",
      "smeta-vs-bsci-social-audit-comparison",
      "ethical-audit-mandatory-requirements",
      "how-to-read-a-factory-audit-report",
      "eu-forced-labour-regulation-china-suppliers",
    ],
    links: [
      {
        href: "/factory-audit/request",
        labelEn: "Request a supplier audit",
        labelZh: "申请供应商审核",
      },
      {
        href: "/methodology",
        labelEn: "How evidence levels and audit scope are defined",
        labelZh: "证据等级与审核范围如何界定",
      },
    ],
    en: {
      quickAnswer:
        "When you receive a SMETA report, check five things before relying on it: that it is a current SMETA version, that the pillars covered match what you require, that the audited site and legal entity are the ones supplying you, that any non-compliances have corrective actions with credible closure dates, and that critical findings are either absent or being actively managed. SMETA is an audit methodology widely used for social compliance; it is not a certificate, and the report is a baseline at the time of the visit.",
      definition:
        "SMETA (Sedex Members Ethical Trade Audit) is an audit methodology developed by Sedex and carried out by independent audit companies. It assesses a site against labour, health and safety, environmental and business ethics criteria depending on the pillars selected. SMETA produces a report of findings and corrective actions rather than a pass or fail certificate, which is why buyers are expected to read the findings rather than accept the existence of a report.",
      keyPoints: [
        "SMETA produces findings and corrective actions, not a pass certificate; the value is in what you do with the findings.",
        "Check the pillars: a 2-pillar audit does not cover the same ground as a 4-pillar audit.",
        "Confirm the report covers the site and legal entity that actually supplies you.",
        "Critical and major findings matter more than the count of minor observations.",
        "Corrective action closure, evidenced with dates, is what distinguishes a managed programme from a filed report.",
        "SMETA audits are delivered by independent audit companies; check who performed the audit.",
      ],
      steps: [
        {
          title: "Confirm the SMETA version and pillars",
          body: "Check that the report states the SMETA version and which pillars were covered: 2-pillar typically covers labour standards and health and safety, while 4-pillar adds environment and business ethics. A buyer requirement for 4-pillar is not met by a 2-pillar report.",
        },
        {
          title: "Check the site and legal entity",
          body: "Verify that the audited site address and the legal entity named in the report are the ones supplying your product. A report for a sister company or another site does not cover your supply.",
        },
        {
          title: "Read the findings by severity",
          body: "Work through critical, major and minor findings rather than scanning the summary. Severity determines what must be fixed before you proceed, and a report with many minor findings is a different situation from one critical finding.",
        },
        {
          title: "Review corrective actions and closure dates",
          body: "For each non-compliance, check whether a corrective action is defined, who owns it, and whether the closure date is credible. Corrective actions without evidence of closure are intentions, not improvements.",
        },
        {
          title: "Check who performed the audit and when",
          body: "Note the audit company, the auditor and the date. Buyers commonly set an acceptance window for report age, and an old report says less about current conditions than a recent one.",
        },
        {
          title: "Decide what the findings mean for your order",
          body: "Map findings to your decision: proceed, proceed with conditions and a follow-up date, or escalate to a follow-up audit. The report should change what you do, not just what you file.",
        },
        {
          title: "Track closure and re-check",
          body: "Where findings are material, agree closure evidence and a re-check date. Social compliance drifts, and a single audit does not hold a site to its baseline.",
        },
      ],
      examples: [
        {
          title: "Report accepted without checking pillars",
          body: "A buyer accepted a SMETA report assuming it covered business ethics. It was a 2-pillar audit. The customer's requirement was 4-pillar, and the report had to be repeated at the buyer's cost.",
        },
        {
          title: "Corrective actions without closure",
          body: "A report listed ten corrective actions with dates six months past and no closure evidence. The findings had been acknowledged rather than resolved, and the site conditions were effectively unchanged.",
        },
        {
          title: "Useful handling: severity-based decision",
          body: "A buyer received a report with one critical finding on working hours. It paused volume, required a corrective action plan with monthly evidence, and scheduled a follow-up audit before resuming.",
        },
      ],
      checklist: [
        "SMETA version stated on the report.",
        "Pillars covered match the buyer requirement (2-pillar or 4-pillar).",
        "Audited site address confirmed as the supplying site.",
        "Legal entity named in the report confirmed as your counterparty.",
        "Audit company and date identified and within your acceptance window.",
        "Findings reviewed by severity, not only by count.",
        "Corrective actions defined with owners and closure dates.",
        "Closure evidence requested for past-due corrective actions.",
        "Decision recorded: proceed, conditional, or follow-up audit.",
        "Re-check date agreed where findings are material.",
      ],
      tables: [
        {
          title: "SMETA 2-Pillar vs 4-Pillar",
          headers: ["Aspect", "2-Pillar", "4-Pillar"],
          rows: [
            ["Typical coverage", "Labour standards and health and safety", "Labour standards, health and safety, environment, business ethics"],
            ["Common use", "Buyer programmes focused on working conditions", "Buyer programmes requiring broader ESG coverage, including many EU retail requirements"],
            ["Report length", "Shorter, narrower findings set", "Longer, with additional findings areas"],
            ["Buyer acceptance", "Accepted where the requirement is working conditions only", "Required where the customer mandate specifies 4-pillar"],
            ["What to check", "That the requirement is genuinely 2-pillar", "That both additional pillars were actually assessed, not just named"],
          ],
        },
        {
          title: "Reading a SMETA Report: Section by Section",
          headers: ["Section", "What to look for", "Common mistake"],
          rows: [
            ["Site and entity details", "Address and legal entity match your supply", "Accepting a report for a different site or sister company"],
            ["Audit scope and pillars", "Stated pillars match the requirement", "Assuming 4-pillar coverage from a 2-pillar report"],
            ["Findings", "Severity and subject of each finding", "Counting findings instead of weighing severity"],
            ["Corrective actions", "Owner, action and credible closure date", "Treating an action plan as evidence of closure"],
            ["Critical findings", "Whether any exist and how they are managed", "Filing the report without a decision on criticals"],
            ["Audit company and date", "Who audited and when", "Using a report beyond the buyer's acceptance window"],
            ["Follow-up", "Whether closure was verified and how", "No re-check after material findings"],
          ],
        },
      ],
      faq: [
        {
          q: "What is SMETA 7?",
          a: "SMETA 7 is a version of the Sedex Members Ethical Trade Audit methodology. Sedex has published figures on the number of SMETA 7 audits completed and continues to refine the methodology, including work on corrective action records and issue titles. Check Sedex for the current version details and any updates.",
        },
        {
          q: "Is a SMETA report a certificate?",
          a: "No. SMETA is an audit methodology that produces a report of findings and corrective actions, delivered by independent audit companies. It is not a certificate and does not certify that a site is compliant or will remain compliant.",
        },
        {
          q: "What is the difference between 2-pillar and 4-pillar SMETA?",
          a: "A 2-pillar audit typically covers labour standards and health and safety, while a 4-pillar audit adds environment and business ethics. If your customer requires 4-pillar, a 2-pillar report does not satisfy it.",
        },
        {
          q: "How recent should a SMETA report be?",
          a: "Buyers usually set their own acceptance window for report age. Because an audit records conditions at the time of the visit, an older report says less about current conditions; check your own or your customer's requirement.",
        },
        {
          q: "What should I do about critical findings?",
          a: "Treat them as a decision point rather than an observation: require a corrective action plan with evidence and dates, consider whether to hold or reduce volume, and schedule a follow-up audit or verification of closure before resuming normal terms.",
        },
        {
          q: "Can FactoryAuditB2B perform a SMETA audit?",
          a: "SMETA audits are carried out by independent audit companies, and FactoryAuditB2B does not claim to be Sedex or to hold any Sedex approval status. This platform provides supplier verification and factory assessment that supports a buyer's due diligence; where a customer mandates SMETA, commission it through an appropriate provider.",
        },
        {
          q: "Does passing SMETA mean the supplier is ethical?",
          a: "No. SMETA does not produce a pass result. It records findings at the time of the visit, and the meaningful signal is whether non-compliances were identified, managed and closed with evidence.",
        },
      ],
      sources: [
        {
          name: "Sedex",
          note: "Publishes the SMETA methodology, version details, pillar definitions and guidance on corrective action records. Check Sedex for the current version and audit figures.",
        },
        {
          name: "Sedex — SMETA audit delivery",
          note: "SMETA audits are performed by independent audit companies; Sedex is the methodology owner rather than the auditor of every report.",
        },
        {
          name: "FactoryAuditB2B Methodology",
          note: "How this site treats audit findings, evidence levels and the limits of what an audit can establish.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "收到 SMETA 报告后，先核五件事再依赖它：是否为当前 SMETA 版本；涵盖的支柱是否符合你的要求；受审场地与法律主体是否就是向你供货的那一家；任何不符合项是否都有带可信关闭日期的纠正措施；关键发现是不存在还是正在被积极管理。SMETA 是广泛用于社会责任合规的审核方法，不是证书；报告是访问当天的基线。",
      definition:
        "SMETA（Sedex 会员道德贸易审核）是由 Sedex 开发、由独立审核公司执行的审核方法。它按所选支柱，依据劳工、健康与安全、环境及商业道德准则对场地进行评估。SMETA 产出的是发现与纠正措施的报告，而不是合格证书，因此买家应当阅读发现项，而不是只接受「存在一份报告」这件事。",
      keyPoints: [
        "SMETA 产出的是发现与纠正措施，不是合格证书；价值在于你如何处理这些发现。",
        "核对支柱：两支柱审核与四支柱审核覆盖的范围不同。",
        "确认报告覆盖的是实际向你供货的场地与法律主体。",
        "关键与主要发现，比次要观察项的数量更重要。",
        "有带日期证据的纠正措施关闭，才能把「受管项目」与「归档报告」区分开。",
        "SMETA 由独立审核公司执行；要核查是谁做的审核。",
      ],
      steps: [
        {
          title: "确认 SMETA 版本与支柱",
          body: "核查报告是否写明 SMETA 版本及涵盖哪些支柱：两支柱通常覆盖劳工标准与健康安全，四支柱则增加环境与商业道德。若买家要求四支柱，两支柱报告无法满足。",
        },
        {
          title: "核查场地与法律主体",
          body: "确认受审场地地址与报告中的法律主体，就是向你供货的那一方。开给兄弟公司或另一场地的报告，不覆盖你的供应。",
        },
        {
          title: "按严重度阅读发现项",
          body: "逐一审视关键、主要与次要发现，而不是只扫摘要。严重度决定推进前必须先修好什么；次要发现很多，与存在一个关键发现，是两种不同的局面。",
        },
        {
          title: "审阅纠正措施与关闭日期",
          body: "对每个不符合项，核查是否定义了纠正措施、由谁负责、关闭日期是否可信。没有关闭证据的纠正措施是意向，不是改善。",
        },
        {
          title: "核查执行方与时间",
          body: "留意审核公司、审核员与日期。买家通常设定报告时效的接受窗口；一份旧报告对当前状况的说明力弱于新报告。",
        },
        {
          title: "判断发现项对你的订单意味着什么",
          body: "把发现映射到你的决策：继续、附条件并设跟进日期，或升级为跟进审核。报告应当改变你的行动，而不只是进入档案。",
        },
        {
          title: "跟踪关闭并复审",
          body: "发现项重大时，约定关闭证据与复审日期。社会责任状况会漂移，单次审核无法把场地锁定在基线上。",
        },
      ],
      examples: [
        {
          title: "未核支柱就接受报告",
          body: "某买家以为 SMETA 报告涵盖商业道德，实际是两支柱审核。而客户要求是四支柱，只能由买家自费重做一次。",
        },
        {
          title: "有纠正措施但无关闭",
          body: "某报告列了十项纠正措施，日期已过六个月且无关闭证据。这些发现只是被承认，并未被解决，场地状况实际未改变。",
        },
        {
          title: "有效处理：按严重度决策",
          body: "某买家收到一份含一项工时关键发现的报告，于是暂停订单量、要求附带月度证据的纠正计划，并安排跟进审核后再恢复。",
        },
      ],
      checklist: [
        "报告上写明 SMETA 版本。",
        "涵盖的支柱符合买家要求（两支柱或四支柱）。",
        "已确认受审场地地址即为供货场地。",
        "已确认报告中的法律主体即为你的交易对手。",
        "已识别审核公司与日期，且在接受窗口内。",
        "已按严重度（而非仅按数量）审阅发现项。",
        "纠正措施已定义负责人与关闭日期。",
        "已为逾期的纠正措施索取关闭证据。",
        "已记录决策：继续、附条件，或跟进审核。",
        "发现项重大时已约定复审日期。",
      ],
      tables: [
        {
          title: "SMETA 两支柱与四支柱",
          headers: ["方面", "两支柱", "四支柱"],
          rows: [
            ["典型覆盖", "劳工标准与健康安全", "劳工标准、健康安全、环境、商业道德"],
            ["常见用途", "聚焦工作条件的买家项目", "要求更广 ESG 覆盖的买家项目，含许多欧盟零售要求"],
            ["报告长度", "较短，发现项集合更窄", "更长，含额外的发现领域"],
            ["买家接受度", "要求仅针对工作条件时可接受", "客户强制规定四支柱时必须提供"],
            ["核查要点", "确认要求确实只需两支柱", "确认两个附加支柱真的被评估过，而不只是被列名"],
          ],
        },
        {
          title: "逐节阅读 SMETA 报告",
          headers: ["章节", "看什么", "常见错误"],
          rows: [
            ["场地与主体信息", "地址与法律主体是否与你的供应一致", "接受开给另一场地或兄弟公司的报告"],
            ["审核范围与支柱", "写明的支柱是否符合要求", "把两支柱报告当作四支柱覆盖"],
            ["发现项", "每个发现的严重度与主题", "只数发现数量而不权衡严重度"],
            ["纠正措施", "负责人、动作与可信关闭日期", "把整改计划当成关闭证据"],
            ["关键发现", "是否存在、如何被管理", "归档报告却未对关键项作出决策"],
            ["审核公司与日期", "谁审的、何时审的", "使用超出买家接受窗口的报告"],
            ["跟进", "关闭是否被验证、如何验证", "重大发现后没有复审"],
          ],
        },
      ],
      faq: [
        {
          q: "什么是 SMETA 7？",
          a: "SMETA 7 是 Sedex 会员道德贸易审核方法的一个版本。Sedex 已公布 SMETA 7 审核完成数量的数据，并持续改进该方法，包括纠正措施记录与问题标题方面的工作。当前版本细节与更新请以 Sedex 为准。",
        },
        {
          q: "SMETA 报告是证书吗？",
          a: "不是。SMETA 是一种审核方法，产出由独立审核公司出具的发现与纠正措施报告。它不是证书，也不证明场地合规或将持续合规。",
        },
        {
          q: "两支柱与四支柱 SMETA 有什么区别？",
          a: "两支柱审核通常覆盖劳工标准与健康安全，四支柱审核另加环境与商业道德。若你的客户要求四支柱，两支柱报告不能满足。",
        },
        {
          q: "SMETA 报告应该多新？",
          a: "买家通常自行设定报告时效的接受窗口。由于审核记录的是访问当时的状况，越旧的报告对当前状况的说明力越弱；请核查你自己或客户的时限要求。",
        },
        {
          q: "发现关键项该怎么办？",
          a: "把它当作决策点而不是观察项：要求带证据与日期的纠正计划，考虑是否暂停或缩减订单量，并在恢复正常条款前安排跟进审核或关闭验证。",
        },
        {
          q: "FactoryAuditB2B 能做 SMETA 审核吗？",
          a: "SMETA 审核由独立审核公司执行，FactoryAuditB2B 不声称自己是 Sedex，也不声称持有任何 Sedex 认可资质。本平台提供支撑买家尽职调查的供应商核验与工厂评估；若客户强制要求 SMETA，请通过具备相应资质的服务方委托。",
        },
        {
          q: "通过 SMETA 就等于供应商是道德的吗？",
          a: "不等于。SMETA 不产出「通过」结果，它记录的是访问当时的发现；有意义的信号是：不符合项是否被识别、管理，并以证据关闭。",
        },
      ],
      sources: [
        { name: "Sedex", note: "发布 SMETA 方法、版本细节、支柱定义与纠正措施记录指南；当前版本与审核数量数据以 Sedex 为准。" },
        { name: "Sedex——SMETA 审核交付", note: "SMETA 审核由独立审核公司执行；Sedex 是方法所有者，而非每份报告的审核方。" },
        { name: "FactoryAuditB2B 方法论", note: "本站如何处理审核发现、证据等级，以及审核能够确立之事项的边界。" },
      ],
    },
  },
  {
    slug: "rba-vap-vs-smeta-vs-bsci",
    category: "compliance",
    titleEn: "RBA VAP vs SMETA vs BSCI: Which Supplier Audit Does a Buyer Need?",
    titleZh: "RBA VAP、SMETA 与 BSCI 对比：买家需要哪种供应商审核？",
    metaDescEn:
      "A factual comparison of RBA VAP, SMETA and amfori BSCI: what each covers, who typically requires it, how the outputs differ, and whether one can replace another.",
    metaDescZh:
      "客观对比 RBA VAP、SMETA 与 amfori BSCI：各自覆盖范围、通常由谁要求、产出有何不同，以及能否互相替代。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/china-factory-audit" },
      { href: "/services/china-supplier-verification" },
    ],
    related: [
      "smeta-7-supplier-audit-buyer-guide",
      "smeta-vs-bsci-social-audit-comparison",
      "ethical-audit-mandatory-requirements",
      "eu-forced-labour-regulation-china-suppliers",
      "sa8000-certification-guide",
    ],
    links: [
      {
        href: "/factory-audit/request",
        labelEn: "Request the required supplier audit",
        labelZh: "申请所需的供应商审核",
      },
      {
        href: "/methodology",
        labelEn: "How audit scope and evidence are defined",
        labelZh: "审核范围与证据如何界定",
      },
    ],
    en: {
      quickAnswer:
        "They are different programmes with different sponsors, scopes and outputs, and they are not interchangeable. RBA VAP assesses conformance to the RBA Code of Conduct and is common in electronics and technology supply chains. SMETA is a Sedex audit methodology widely used across sectors and selected in 2-pillar or 4-pillar scope. amfori BSCI is a programme used mainly by European buyers in consumer goods. Which one you need is usually decided by your customer, not by you.",
      definition:
        "RBA VAP is the Validated Assessment Program operated by the Responsible Business Alliance, assessing a facility against the RBA Code of Conduct. SMETA is an audit methodology developed by Sedex, delivered by independent audit companies, with pillar-based scope. amfori BSCI is the social sustainability audit programme operated by amfori for its members. All three are assessments or audits producing findings, not certificates of compliance, and each is accepted by different buyers for different reasons.",
      keyPoints: [
        "The three programmes have different sponsors and are not interchangeable, even though they overlap in subject matter.",
        "Which audit you need is usually determined by your customer's requirement, not by your preference.",
        "All three produce findings and corrective actions rather than a pass certificate.",
        "RBA VAP is common in electronics and technology supply chains; SMETA and BSCI are broader across consumer goods.",
        "Report age, site coverage and legal entity determine whether an existing report is usable for you.",
        "Ask the customer which programme, which scope and which acceptance window apply before commissioning anything.",
      ],
      steps: [
        {
          title: "Ask what your customer actually requires",
          body: "Confirm the programme name, the scope or pillars, the acceptance window for report age, and whether an existing report is accepted. This single step prevents the most common and most expensive mistake: commissioning the wrong audit.",
        },
        {
          title: "Check whether an existing report is usable",
          body: "If the supplier already has a report, check the programme, the site and legal entity covered, the date, and whether the findings were closed. A report that fails any of these is not a substitute for the audit you need.",
        },
        {
          title: "Map the programme to your supply chain",
          body: "Note which programme is dominant in your sector. Electronics buyers commonly reference RBA, while many European consumer goods buyers reference amfori BSCI or SMETA. Sector convention influences what your customers will accept.",
        },
        {
          title: "Confirm site coverage and entity",
          body: "Whichever programme applies, the audit must cover the site that makes your product and the legal entity you contract with. Programme choice does not fix a coverage mismatch.",
        },
        {
          title: "Plan for findings and closure",
          body: "Expect findings. Budget time and effort for corrective actions and closure evidence, because an audit without closure changes little on the site.",
        },
        {
          title: "Do not substitute one for another without confirmation",
          body: "Overlap in subject matter does not mean acceptance. A SMETA report is not a RBA VAP result, and neither substitutes for a BSCI requirement, unless the customer says otherwise in writing.",
        },
      ],
      examples: [
        {
          title: "Wrong programme commissioned",
          body: "A buyer commissioned SMETA because the supplier had experience with it, then discovered the customer's onboarding required amfori BSCI. The audit had to be repeated because the customer's requirement set the scope.",
        },
        {
          title: "Existing report rejected on coverage",
          body: "A supplier offered a valid SMETA report, but it covered a different legal entity at a different address. The programme was right and the report was current, yet it did not cover the supply in question.",
        },
        {
          title: "Requirement clarified before ordering",
          body: "A buyer asked the customer for the exact programme, pillars and acceptance window before commissioning, then ordered once. The report was accepted on submission and no re-audit was needed.",
        },
      ],
      checklist: [
        "Customer requirement confirmed in writing: programme, scope or pillars.",
        "Acceptance window for report age confirmed.",
        "Whether an existing report is accepted, confirmed.",
        "Existing report checked for programme, site, entity and date.",
        "Site coverage confirmed as the site making your product.",
        "Legal entity coverage confirmed as your counterparty.",
        "Findings and closure status reviewed, not just the report title.",
        "Corrective action plan and closure evidence planned.",
        "Any substitution of one programme for another confirmed in writing by the customer.",
      ],
      tables: [
        {
          title: "RBA VAP vs SMETA vs amfori BSCI",
          headers: ["Aspect", "RBA VAP", "SMETA", "amfori BSCI"],
          rows: [
            ["Operated by", "Responsible Business Alliance", "Sedex (methodology; audits by independent audit companies)", "amfori"],
            ["What it assesses", "Conformance to the RBA Code of Conduct", "Labour, health and safety, and depending on pillars, environment and business ethics", "Social sustainability criteria defined by amfori"],
            ["Typical buyers", "Electronics and technology supply chains", "Cross-sector; widely accepted by many retailers", "European consumer goods buyers and amfori members"],
            ["Scope selection", "Defined programme with assessment scope", "2-pillar or 4-pillar selected by the requester", "Programme scope defined by amfori"],
            ["Output", "Assessment report with findings and corrective actions", "Audit report with findings and corrective actions", "Audit report with findings and corrective actions"],
            ["Is it a certificate?", "No", "No", "No"],
            ["Can it replace another?", "Only if the customer confirms acceptance", "Only if the customer confirms acceptance", "Only if the customer confirms acceptance"],
          ],
        },
        {
          title: "Choosing Based on Buyer Context",
          headers: ["If your situation is...", "Start with", "Why"],
          rows: [
            ["Your customer names a programme", "That programme", "Customer requirements set the scope, not supplier convenience"],
            ["Electronics or technology supply chain", "RBA VAP, if referenced by the customer", "RBA is widely referenced in electronics supply chains"],
            ["European consumer goods retailer requirement", "amfori BSCI or SMETA, as specified", "Both are common in European consumer goods programmes"],
            ["No customer mandate, internal due diligence", "A scope matched to your risk, not a brand name", "Without a mandate, define scope by risk rather than by convention"],
            ["Supplier already has a report", "Check coverage and age before accepting", "The right programme at the wrong site does not cover your supply"],
          ],
        },
      ],
      faq: [
        {
          q: "Are SMETA, BSCI and RBA the same thing?",
          a: "No. They are different programmes operated by different organisations, with different codes or methodologies, scopes and reporting formats. They overlap in subject matter but are not interchangeable, and acceptance depends on your customer's requirement.",
        },
        {
          q: "Can one audit replace another?",
          a: "Only if the customer that requires it confirms acceptance in writing. Similar coverage does not mean a buyer will accept a substitute, and substituting without confirmation is a common cause of a rejected report.",
        },
        {
          q: "Which audit does my customer require?",
          a: "Ask them, and ask for specifics: the programme name, the scope or pillars, the acceptance window for report age, and whether an existing report is acceptable. Guessing at this stage is expensive.",
        },
        {
          q: "Is RBA VAP a certification?",
          a: "No. It is an assessment programme that produces findings and corrective actions against the RBA Code of Conduct. It is not a certificate, and results are understood as a baseline at the time of the assessment.",
        },
        {
          q: "What is the RBA Code of Conduct version in use?",
          a: "The RBA Code of Conduct is versioned and updated over time, with RBA Code 8.0 in effect from 2024. Confirm the current version and any programme updates on official RBA sources before relying on it.",
        },
        {
          q: "Do these audits guarantee the factory is compliant?",
          a: "No. Each produces findings at the time of the assessment. Whether conditions improve depends on corrective action closure, monitoring and re-assessment, which is why follow-up matters more than the report itself.",
        },
      ],
      sources: [
        {
          name: "Responsible Business Alliance (RBA)",
          note: "Operates the VAP and publishes the RBA Code of Conduct, its current version, and the scope and limitations of assessments.",
        },
        {
          name: "Sedex",
          note: "Publishes the SMETA methodology and pillar definitions; audits are delivered by independent audit companies.",
        },
        {
          name: "amfori",
          note: "Operates the amfori BSCI programme and defines its scope, reporting and member requirements.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "它们是不同机构主导、范围与产出各异的项目，不能互相替代。RBA VAP 评估的是对《RBA 行为准则》的符合程度，常见于电子与科技供应链；SMETA 是 Sedex 的审核方法，跨行业广泛使用，可选两支柱或四支柱范围；amfori BSCI 是主要面向欧洲买家、用于消费品领域的项目。你需要哪一个，通常由客户决定，而不是由你决定。",
      definition:
        "RBA VAP 是责任商业联盟（RBA）运营的验证评估计划（Validated Assessment Program），依据《RBA 行为准则》评估工厂。SMETA 是 Sedex 开发的审核方法，由独立审核公司执行，按支柱确定范围。amfori BSCI 是 amfori 为其会员运营的社会可持续性审核项目。三者都是产出发现项的评估或审核，而非合规证书，且各自被不同买家因不同原因接受。",
      keyPoints: [
        "三个项目由不同机构主导，即便主题重叠也不可互换。",
        "你需要哪种审核，通常由客户要求决定，而不是由你的偏好决定。",
        "三者产出的都是发现与纠正措施，而非合格证书。",
        "RBA VAP 常见于电子与科技供应链；SMETA 与 BSCI 在消费品领域覆盖更广。",
        "报告时效、场地覆盖范围与法律主体，决定了既有报告是否对你可用。",
        "在委托任何审核前，先问清客户适用哪个项目、什么范围、什么接受窗口。",
      ],
      steps: [
        {
          title: "问清客户真正要求什么",
          body: "确认项目名称、范围或支柱、报告时效的接受窗口，以及是否接受既有报告。仅这一步就能避免最常见、也最贵的错误：做错了审核。",
        },
        {
          title: "核查既有报告是否可用",
          body: "若供应商已有报告，核查其项目、覆盖的场地与法律主体、日期，以及发现项是否已关闭。任何一项不符合，都不能替代你需要的那次审核。",
        },
        {
          title: "把项目映射到你的供应链",
          body: "留意你所在行业哪个项目占主导。电子买家常引用 RBA，而许多欧洲消费品买家引用 amfori BSCI 或 SMETA。行业惯例会影响客户接受什么。",
        },
        {
          title: "确认场地覆盖与主体",
          body: "无论适用哪个项目，审核都必须覆盖生产你产品的场地与你签约的法律主体。选对项目并不能修复覆盖错配。",
        },
        {
          title: "为发现项与关闭做计划",
          body: "要有发现项的心理准备，并为纠正措施与关闭证据预留时间与投入，因为一次没有关闭的审核，对场地改变很少。",
        },
        {
          title: "未经确认不要互相替代",
          body: "主题重叠不等于被接受。SMETA 报告不是 RBA VAP 结果，两者也都不能替代 BSCI 要求，除非客户书面另有说明。",
        },
      ],
      examples: [
        {
          title: "做错了项目",
          body: "某买家因为供应商熟悉 SMETA 就做了 SMETA，后来发现客户入驻要求的是 amfori BSCI。因为客户要求决定范围，只能重做。",
        },
        {
          title: "既有报告因覆盖问题被拒",
          body: "某供应商提供了一份有效的 SMETA 报告，但它覆盖的是另一法律主体、另一地址。项目对了、报告也新，却未覆盖所涉供应。",
        },
        {
          title: "下单前先澄清要求",
          body: "某买家在委托前向客户问清了确切项目、支柱与接受窗口，然后只做了一次。报告一次提交即被接受，无需重审。",
        },
      ],
      checklist: [
        "已书面确认客户要求：项目、范围或支柱。",
        "已确认报告时效的接受窗口。",
        "已确认是否接受既有报告。",
        "已核查既有报告的项目、场地、主体与日期。",
        "已确认场地覆盖的是生产你产品的场地。",
        "已确认法律主体覆盖的是你的交易对手。",
        "已审阅发现项与关闭状态，而不只是报告标题。",
        "已规划纠正措施计划与关闭证据。",
        "任何以甲项目替代乙项目，均已取得客户书面确认。",
      ],
      tables: [
        {
          title: "RBA VAP、SMETA 与 amfori BSCI 对比",
          headers: ["方面", "RBA VAP", "SMETA", "amfori BSCI"],
          rows: [
            ["运营方", "责任商业联盟（RBA）", "Sedex（方法；审核由独立审核公司执行）", "amfori"],
            ["评估内容", "对《RBA 行为准则》的符合程度", "劳工、健康安全，并依支柱不同含环境与商业道德", "amfori 界定的社会可持续性准则"],
            ["典型买家", "电子与科技供应链", "跨行业；被众多零售商广泛接受", "欧洲消费品买家与 amfori 会员"],
            ["范围选择", "既定项目与评估范围", "由委托方选择两支柱或四支柱", "范围由 amfori 界定"],
            ["产出", "含发现与纠正措施的评估报告", "含发现与纠正措施的审核报告", "含发现与纠正措施的审核报告"],
            ["是证书吗", "不是", "不是", "不是"],
            ["能否替代另一个", "仅在客户书面确认接受时", "仅在客户书面确认接受时", "仅在客户书面确认接受时"],
          ],
        },
        {
          title: "按买家场景选择",
          headers: ["如果你的情况是", "从哪个开始", "原因"],
          rows: [
            ["客户点名了某个项目", "就是那个项目", "客户要求决定范围，而不是供应商方便与否"],
            ["电子或科技供应链", "若客户引用则为 RBA VAP", "RBA 在电子供应链中被广泛引用"],
            ["欧洲消费品零售商要求", "按要求选 amfori BSCI 或 SMETA", "两者在欧洲消费品项目中都很常见"],
            ["无客户强制，内部尽职调查", "按风险匹配范围，而不是看品牌名", "无强制时，应按风险而非惯例定义范围"],
            ["供应商已有报告", "接受前先核查覆盖与时效", "项目对但场地错，仍不覆盖你的供应"],
          ],
        },
      ],
      faq: [
        {
          q: "SMETA、BSCI 和 RBA 是一回事吗？",
          a: "不是。它们是由不同机构运营的不同项目，准则或方法、范围与报告格式各异。主题上有重叠，但不可互换；能否被接受取决于客户要求。",
        },
        {
          q: "一种审核能替代另一种吗？",
          a: "只有在要求方书面确认接受时才可以。覆盖相似不等于买家会接受替代品；未经确认就替代，是报告被拒的常见原因。",
        },
        {
          q: "我的客户需要哪种审核？",
          a: "去问，并问具体：项目名称、范围或支柱、报告时效的接受窗口，以及既有报告是否可接受。在这个阶段靠猜代价很高。",
        },
        {
          q: "RBA VAP 是认证吗？",
          a: "不是。它是一个评估计划，产出的是针对《RBA 行为准则》的发现与纠正措施。它不是证书，结果应理解为评估时点的基线。",
        },
        {
          q: "当前使用的《RBA 行为准则》是哪个版本？",
          a: "《RBA 行为准则》按版本持续更新，RBA Code 8.0 自 2024 年起生效。依赖前请以 RBA 官方来源确认当前版本与任何项目更新。",
        },
        {
          q: "这些审核能保证工厂合规吗？",
          a: "不能。三者产出的都是评估时点的发现。状况是否改善，取决于纠正措施关闭、监控与复审，因此跟进比报告本身更重要。",
        },
      ],
      sources: [
        { name: "责任商业联盟（RBA）", note: "运营 VAP，发布《RBA 行为准则》及其当前版本，并说明评估的范围与局限。" },
        { name: "Sedex", note: "发布 SMETA 方法与支柱定义；审核由独立审核公司执行。" },
        { name: "amfori", note: "运营 amfori BSCI 项目，并界定其范围、报告与会员要求。" },
      ],
    },
  },
  {
    slug: "china-plus-one-supplier-qualification",
    category: "sea",
    titleEn: "China Plus One Supplier Qualification: How to Vet Vietnam and Thailand Factories",
    titleZh: "China+1 供应商资格认证：如何审核越南与泰国工厂",
    metaDescEn:
      "How to qualify a second supplier country: what to verify in Vietnam and Thailand factories before moving production, including capability, quality system, compliance, capacity, subcontracting and export experience.",
    metaDescZh:
      "如何认证第二个供应国：在把产能转到越南与泰国工厂前必须核验什么，含能力、质量体系、合规、产能、分包与出口经验。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-scorecard" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/services/china-factory-audit" },
    ],
    related: [
      "how-to-audit-a-factory-in-vietnam",
      "china-supplier-risk-assessment-framework",
      "when-to-order-china-factory-audit",
      "supplier-quality-audit-checklist",
      "china-factory-or-trading-company",
    ],
    links: [
      {
        href: "/industrial-clusters",
        labelEn: "Explore industrial clusters by country",
        labelZh: "按国家浏览产业带",
      },
      { href: "/rfq", labelEn: "Post a buyer RFQ", labelZh: "发布采购需求" },
      {
        href: "/suppliers",
        labelEn: "Compare suppliers across countries",
        labelZh: "跨国比较供应商",
      },
    ],
    en: {
      quickAnswer:
        "Qualifying a second country means repeating the qualification work, not copying it. Verify the same six things you verified in China: factory capability for your product, quality management, social compliance, real capacity, subcontracting position and export experience to your market. The common failure is assuming that a supplier type proven in China behaves the same way elsewhere. Qualify the specific site, in the specific country, for your specific product, before moving volume.",
      definition:
        "China Plus One is a sourcing strategy in which a buyer keeps Chinese supply while adding production capacity in at least one other country, commonly Vietnam, Thailand, Indonesia or Malaysia, to reduce concentration risk. Supplier qualification in this context means the verification, assessment and audit work required before a site in the second country is trusted with volume. It is country-specific because registration systems, labour markets, infrastructure and export practice differ.",
      keyPoints: [
        "Qualification is site-specific and product-specific; success in China does not transfer automatically.",
        "Verify capability for your product in the new country, not the country's general reputation.",
        "Capacity is often tighter in a second country than buyers assume when moving volume quickly.",
        "Subcontracting patterns differ by country and should be established explicitly.",
        "Export experience to your market matters: experience with one destination does not imply another.",
        "Qualify before moving volume, not during the first shipment.",
      ],
      steps: [
        {
          title: "Define what the second source must deliver",
          body: "Decide which products, volumes and quality levels the second country must cover. A vague diversification goal produces a qualification process with no pass criteria.",
        },
        {
          title: "Verify the legal entity in the local registration system",
          body: "Confirm the registered entity, its status and its business scope under the local registration regime. Registration evidence looks different in each country, and the equivalent of a business licence is not identical to China's.",
        },
        {
          title: "Confirm the production site and what is made there",
          body: "Establish the actual production address and the operations performed at that site. In emerging sourcing destinations, a trading intermediary presenting a manufacturer's site is common.",
        },
        {
          title: "Assess capability for your product specifically",
          body: "Check equipment, process fit and whether the site has made your product type before. A country's strength in one category does not confer capability in another.",
        },
        {
          title: "Assess the quality management system in practice",
          body: "Look for evidence that quality control is applied, not just certified: incoming inspection, in-process control, final inspection records and handling of non-conformances.",
        },
        {
          title: "Check social compliance for your customer's requirement",
          body: "Establish which programme your customer requires in that country and whether the site has relevant audit history. Compliance expectations do not change because the country changed.",
        },
        {
          title: "Verify real capacity and lead times",
          body: "Confirm available capacity rather than nameplate capacity, and check where your volume would sit in the production queue. Capacity constraints are the most common surprise when volume moves quickly.",
        },
        {
          title: "Establish export experience to your market",
          body: "Ask for evidence of previous shipments to your destination, including documentation and conformity work for your market. Export experience is destination-specific.",
        },
      ],
      examples: [
        {
          title: "Assumption transferred from China",
          body: "A buyer qualified a Vietnam supplier on the strength of its China experience with the same product category. The site had the equipment but no documented process control, and first-shipment defects were higher than in China.",
        },
        {
          title: "Capacity overstated during a rapid move",
          body: "A supplier quoted nameplate capacity while its existing commitments filled most of it. The buyer's volume was queued behind established customers, and lead times slipped in the first two months.",
        },
        {
          title: "Qualified properly before moving volume",
          body: "A buyer audited two candidate sites in Thailand, selected one, ran a pilot order with inspection, then moved volume. The qualification cost was small relative to the disruption avoided.",
        },
      ],
      checklist: [
        "Products, volumes and quality levels for the second source defined.",
        "Legal entity and status verified under the local registration system.",
        "Business scope checked for manufacturing activity.",
        "Production address confirmed and site operations identified.",
        "Equipment and process fit assessed for your product.",
        "Prior experience with your product type evidenced.",
        "Quality system checked in practice: incoming, in-process and final control records.",
        "Social compliance programme and audit history established.",
        "Available capacity confirmed, not nameplate capacity.",
        "Lead times and production queue position understood.",
        "Subcontracting position disclosed in writing.",
        "Export experience to your destination market evidenced.",
        "Pilot order and inspection planned before volume moves.",
      ],
      tables: [
        {
          title: "China Plus One: What to Verify Before Moving Production",
          headers: ["Area", "What to verify", "Why it differs by country"],
          rows: [
            ["Legal identity", "Registered entity, status and business scope under local law", "Registration systems and evidence formats differ"],
            ["Production site", "Actual address and operations performed there", "Intermediaries presenting manufacturer sites are common"],
            ["Capability", "Equipment and process fit for your product", "A country's strength in one category does not transfer to another"],
            ["Quality system", "Applied control records, not just a certificate", "Certification prevalence and practice vary"],
            ["Compliance", "The programme your customer requires, and audit history", "Audit availability and acceptance vary by destination"],
            ["Capacity", "Available capacity and queue position", "Capacity tightens quickly when many buyers diversify at once"],
            ["Subcontracting", "Written disclosure of outsourced operations", "Subcontracting norms differ by country and sector"],
            ["Export experience", "Prior shipments to your destination market", "Experience with one market does not imply another"],
          ],
        },
        {
          title: "Qualification Sequence for a Second Source",
          headers: ["Stage", "Activity", "Purpose"],
          rows: [
            ["1. Definition", "Define products, volumes and quality levels", "Sets pass criteria before any supplier is assessed"],
            ["2. Verification", "Confirm entity, site, scope and export record", "Establishes who and where before spending on audits"],
            ["3. Assessment", "Assess capability, quality and compliance", "Determines whether the site can actually do the work"],
            ["4. Pilot", "Run a small order with inspection", "Tests real performance at low exposure"],
            ["5. Scale", "Move volume and monitor", "Transfers volume only after the pilot passes"],
            ["6. Maintain", "Re-check and monitor changes", "Keeps qualification current rather than historical"],
          ],
        },
      ],
      faq: [
        {
          q: "What does China Plus One mean?",
          a: "It is a sourcing strategy of keeping Chinese supply while adding production in at least one other country, commonly Vietnam, Thailand, Indonesia or Malaysia, to reduce concentration risk. It is a diversification decision, not automatically a replacement of China.",
        },
        {
          q: "Can I qualify a Vietnam supplier the same way as a Chinese supplier?",
          a: "Use the same framework, but expect the evidence to look different. Registration documents, site verification and audit availability differ by country, so the qualification steps are the same while the specific records you can obtain are not identical.",
        },
        {
          q: "What is the biggest mistake when adding a second country?",
          a: "Moving volume before qualifying the specific site. Country-level optimism substitutes for site-level evidence, and the failure usually appears in the first shipment rather than in the qualification documents.",
        },
        {
          q: "How do I check capacity in a new supplier country?",
          a: "Ask for available capacity rather than nameplate capacity, and ask where your volume would sit in the production queue. Capacity is frequently the constraint when several buyers diversify into the same country at the same time.",
        },
        {
          q: "Do compliance requirements change in the second country?",
          a: "Your customer's requirements generally do not change. What changes is the availability of audit history and local practice, so establish which programme is required and whether the site has relevant, current evidence.",
        },
        {
          q: "Should I use a pilot order?",
          a: "Yes. A small pilot order with inspection tests real performance at low exposure, and it reveals process and capacity problems that document review and even an audit can miss.",
        },
      ],
      sources: [
        {
          name: "FactoryAuditB2B Country Coverage",
          note: "Country-specific sourcing, verification and audit considerations for each covered manufacturing country.",
        },
        {
          name: "FactoryAuditB2B Industrial Clusters",
          note: "Cluster-level view of where production capacity sits by country and sector.",
        },
        {
          name: "FactoryAuditB2B Methodology",
          note: "How supplier qualification evidence is assessed and the limits of what verification establishes.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "认证第二个供应国，意味着重做一遍认证工作，而不是复制它。要像在中国那样核验同样六件事：工厂对你产品的能力、质量管理、社会责任合规、真实产能、分包状况，以及发往你目标市场的出口经验。常见失败是假定「在中国验证过的供应商类型」在别处表现相同。在转移产能之前，针对具体国家、具体场地、具体产品完成认证。",
      definition:
        "China+1 是一种采购策略：买家在保留中国供应的同时，在至少一个其他国家（常见为越南、泰国、印尼或马来西亚）增加产能，以降低集中度风险。此时的供应商资格认证，指的是在某个第二国场地被托付订单量之前，所需的核验、评估与审核工作。它具有国别性，因为登记制度、劳动力市场、基础设施与出口实践各不相同。",
      keyPoints: [
        "认证是场地特定、产品特定的；在中国的成功不会自动转移。",
        "要核验新国家针对你产品的能力，而不是这个国家的整体声誉。",
        "第二国的产能常常比买家快速转移时的假设更紧。",
        "分包模式因国而异，应当明确确立。",
        "发往你目标市场的出口经验很重要：对某一目的地的经验不等于对另一目的地。",
        "要在转移产能之前完成认证，而不是在第一批货期间。",
      ],
      steps: [
        {
          title: "定义第二供应源必须交付什么",
          body: "决定第二个国家必须覆盖哪些产品、多大数量、什么质量水平。模糊的多元化目标，只会产生一个没有合格标准的认证流程。",
        },
        {
          title: "在当地登记制度下核验法律主体",
          body: "按当地登记制度确认注册主体、状态与经营范围。各国的注册证据形式不同，相当于营业执照的文件并不与中国完全一致。",
        },
        {
          title: "确认生产场地及其所进行的工序",
          body: "确定实际生产地址与该场地进行的工序。在新兴采购目的地，贸易中间商呈现制造商场地的情况很常见。",
        },
        {
          title: "针对你的产品具体评估能力",
          body: "核查设备、工艺匹配度，以及该场地此前是否做过你这类产品。一国在某一品类的优势，不等于在另一品类具备能力。",
        },
        {
          title: "评估质量管理体系的实际执行",
          body: "寻找质量控制被真正执行的证据，而不只是有证书：来料检验、过程控制、最终检验记录，以及不合格品的处理。",
        },
        {
          title: "按客户要求核查社会责任合规",
          body: "确立客户在该国要求哪个项目，以及该场地是否有相关审核历史。合规预期不会因为换了国家而改变。",
        },
        {
          title: "核验真实产能与交期",
          body: "确认可用产能而非铭牌产能，并核查你的订单量会排在生产队列的什么位置。快速转移产能时，产能是最常见的意外。",
        },
        {
          title: "确立发往你市场的出口经验",
          body: "索取此前发往你目的地的出货证据，包括单证与面向该市场的符合性工作。出口经验是目的地特定的。",
        },
      ],
      examples: [
        {
          title: "把在中国的假设照搬过去",
          body: "某买家凭其在中国的同品类经验认证了一家越南供应商。该场地有设备，但没有文件化的过程控制，首批货的不良率高于中国。",
        },
        {
          title: "快速转移中产能被高估",
          body: "某供应商报的是铭牌产能，而既有订单已占去大部分。买家的订单排在既有客户之后，头两个月交期持续滑移。",
        },
        {
          title: "转移产能前规范认证",
          body: "某买家审核了泰国两家候选场地，选定一家，先用小订单加验货试产，再转移产能。认证成本相对避免的混乱而言很小。",
        },
      ],
      checklist: [
        "已定义第二供应源的产品、数量与质量水平。",
        "已在当地登记制度下核验法律主体与状态。",
        "已核查经营范围是否含生产活动。",
        "已确认生产地址，并识别该场地的工序。",
        "已针对你的产品评估设备与工艺匹配度。",
        "已取得该产品类型的既往经验证据。",
        "已核查质量体系的实际执行：来料、过程与最终检验记录。",
        "已确立社会责任合规项目与审核历史。",
        "已确认可用产能，而非铭牌产能。",
        "已了解交期与生产队列位置。",
        "已书面披露分包状况。",
        "已取得发往目标市场的出口经验证据。",
        "已规划转移产能前的试产订单与验货。",
      ],
      tables: [
        {
          title: "China+1：转移产能前应核验什么",
          headers: ["领域", "核验什么", "为何因国而异"],
          rows: [
            ["法律身份", "当地法律下的注册主体、状态与经营范围", "登记制度与证据格式不同"],
            ["生产场地", "实际地址与所进行工序", "中间商呈现制造商场地的情况常见"],
            ["能力", "针对你产品的设备与工艺匹配度", "一国在某一品类的优势不会转移到另一品类"],
            ["质量体系", "实际执行的控制记录，而不只是证书", "认证普及度与执行实践各异"],
            ["合规", "客户要求的项目与审核历史", "审核可得性与接受度因目的地而异"],
            ["产能", "可用产能与队列位置", "众多买家同时多元化时产能迅速变紧"],
            ["分包", "外包工序的书面披露", "分包惯例因国家与行业而异"],
            ["出口经验", "发往你目标市场的既往出货", "对某一市场的经验不等于对另一市场"],
          ],
        },
        {
          title: "第二供应源的认证顺序",
          headers: ["阶段", "活动", "目的"],
          rows: [
            ["1. 定义", "定义产品、数量与质量水平", "在评估任何供应商前先设定合格标准"],
            ["2. 核验", "确认主体、场地、范围与出口记录", "在花钱审核前先确立是谁、在哪里"],
            ["3. 评估", "评估能力、质量与合规", "判断该场地是否真能做这项工作"],
            ["4. 试产", "下小订单并验货", "在低敞口下检验真实表现"],
            ["5. 放量", "转移产能并监控", "仅在试产通过后才转移订单量"],
            ["6. 维持", "复审并监控变化", "让认证保持时效，而非停留在历史"],
          ],
        },
      ],
      faq: [
        {
          q: "China+1 是什么意思？",
          a: "它是一种采购策略：在保留中国供应的同时，在至少一个其他国家（常见为越南、泰国、印尼或马来西亚）增加产能，以降低集中度风险。它是多元化决策，不必然是替代中国。",
        },
        {
          q: "能像认证中国供应商那样认证越南供应商吗？",
          a: "用同样的框架，但证据形态会不同。注册文件、场地核验与审核可得性因国而异，因此认证步骤相同，而你能取得的具体记录并不完全一致。",
        },
        {
          q: "增加第二个国家时最大的错误是什么？",
          a: "在认证具体场地之前就转移产能。国家层面的乐观替代了场地层面的证据，失败通常出现在第一批货上，而不是认证文件里。",
        },
        {
          q: "在新供应国如何核查产能？",
          a: "要问可用产能而不是铭牌产能，并问你的订单量会排在生产队列的什么位置。当多个买家同时向同一国多元化时，产能常常就是瓶颈。",
        },
        {
          q: "在第二国合规要求会变吗？",
          a: "客户的要求通常不变，变的是审核历史的可得性与当地实践，因此要确立所需项目，以及场地是否持有相关的、当前有效的证据。",
        },
        {
          q: "应该用试产订单吗？",
          a: "应该。小批量试产加验货，能在低敞口下检验真实表现，并暴露文件审阅乃至验厂都可能漏掉的流程与产能问题。",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B 国家覆盖", note: "各覆盖制造国的国别采购、核验与验厂注意事项。" },
        { name: "FactoryAuditB2B 产业带", note: "按国家与行业展示产能分布的产业带视图。" },
        { name: "FactoryAuditB2B 方法论", note: "供应商资格认证证据如何被评估，以及核验能够确立之事项的边界。" },
      ],
    },
  },
  {
    slug: "buyer-ready-china-supplier",
    category: "china",
    titleEn: "How Chinese Factories Can Become Buyer-Ready for International Sourcing",
    titleZh: "中国工厂如何具备面向国际采购的「买家就绪」状态",
    metaDescEn:
      "What international buyers need to see before engaging a factory: legal information, real production address, capability, capacity, quality system, certifications, compliance, audit history, export experience and verifiable evidence.",
    metaDescZh:
      "国际买家在接触工厂前需要看到什么：法律信息、真实生产地址、能力、产能、质量体系、认证、合规、审核历史、出口经验与可核验证据。",
    updated: "2026-09-22",
    tools: [
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/china-supplier-verification" },
      { href: "/services/china-factory-audit" },
    ],
    related: [
      "china-factory-or-trading-company",
      "how-to-verify-a-chinese-supplier",
      "supplier-evaluation-checklist",
      "supplier-quality-audit-checklist",
      "china-plus-one-supplier-qualification",
    ],
    links: [
      {
        href: "/join-supplier-network",
        labelEn: "Join the FactoryAuditB2B Supplier Network",
        labelZh: "加入 FactoryAuditB2B 供应商网络",
      },
      {
        href: "/suppliers",
        labelEn: "See how published supplier profiles look",
        labelZh: "查看已发布供应商档案的样式",
      },
      { href: "/rfq", labelEn: "See what buyers are requesting", labelZh: "查看买家正在求购什么" },
    ],
    en: {
      quickAnswer:
        "Buyer-ready means a buyer can understand and check your factory without a long email exchange. In practice that means ten things are documented: legal company information, a real production address, product capability, capacity, a quality system, certifications relevant to the buyer's market, social compliance position, audit history, export experience, and evidence that can actually be verified. Complete profiles get more buyer attention because they answer the buyer's questions before the buyer has to ask them.",
      definition:
        "Buyer-ready describes a supplier whose identity, capability and compliance position can be understood from documents and verified by a third party. It is not a marketing state; it is an evidence state. On this platform, a supplier profile goes through human review, is assigned an evidence level and a risk score, and only then appears publicly. Registration does not guarantee orders, and it does not certify anything: it makes the factory easier for international buyers to find, understand and check.",
      keyPoints: [
        "Buyer-ready is an evidence state, not a marketing claim.",
        "Ten elements matter most: identity, address, capability, capacity, quality, certifications, compliance, audit history, export experience and verifiable evidence.",
        "Buyers check whether documents are consistent with each other, not whether they exist.",
        "An incomplete profile is usually read as unknown rather than as acceptable.",
        "Audit history and corrective action closure are strong signals of how a factory handles problems.",
        "Registration on this platform makes a factory easier to find and check; it does not guarantee orders or issue certification.",
      ],
      steps: [
        {
          title: "Document legal company information",
          body: "Provide the Chinese registered name, Unified Social Credit Code, establishment date and registered capital, and make sure the English name you use is consistent everywhere. Inconsistent entity names are the first thing a buyer's document check flags.",
        },
        {
          title: "Publish the real production address",
          body: "State the address where production actually happens, separately from any registered office. Buyers and auditors need the production address to scope verification and audits.",
        },
        {
          title: "Describe product capability specifically",
          body: "Name the products and processes you perform in-house, with the equipment involved. Category-level claims are less useful than process-level detail, because buyer fit is process-specific.",
        },
        {
          title: "State capacity in a checkable way",
          body: "Give capacity in terms a buyer can test: lines, shifts and monthly output for the relevant product. Unsupported capacity numbers invite a challenge the factory cannot answer.",
        },
        {
          title: "Show the quality system in operation",
          body: "Provide your quality system certificate if you have one, and be ready to show incoming, in-process and final inspection records. Buyers increasingly ask for evidence of application, not just certification.",
        },
        {
          title: "List certifications relevant to buyer markets",
          body: "Include product and market-specific approvals with their scope and validity dates, and make sure they name the same legal entity. A certificate naming another entity does not transfer.",
        },
        {
          title: "State your social compliance position",
          body: "Note which programmes you have been audited against and the current status of any corrective actions. Disclosure of findings with closure evidence reads better than silence.",
        },
        {
          title: "Provide audit history",
          body: "List previous audits with dates and issuing bodies, and what was corrected. A factory that can show it fixed something is easier to trust than one that claims nothing was ever wrong.",
        },
        {
          title: "Evidence export experience",
          body: "State which markets you have shipped to and provide documentation where possible. Export experience is destination-specific, including conformity work for that market.",
        },
        {
          title: "Make the evidence verifiable",
          body: "Supply documents a third party can check: registration records, certificates issued to your entity, and a production address that can be visited. Verifiability is what converts a claim into evidence.",
        },
      ],
      examples: [
        {
          title: "Incomplete profile read as unknown",
          body: "A factory listed products and photos but no registration details, capacity or certifications. Buyers could not distinguish it from any other listing, and enquiries went to profiles that answered more questions.",
        },
        {
          title: "Consistent profile shortlisted quickly",
          body: "A factory published its registration details, production address, equipment list, capacity and a current ISO certificate naming the same entity. A buyer shortlisted it without a preliminary question round.",
        },
        {
          title: "Audit history handled well",
          body: "A factory disclosed a previous audit with two non-compliances and showed closure evidence. The buyer treated the disclosure as a positive signal about how problems are managed.",
        },
      ],
      checklist: [
        "Chinese registered name and Unified Social Credit Code published.",
        "English company name used consistently across all materials.",
        "Production address stated separately from the registered office.",
        "Products and in-house processes described with equipment detail.",
        "Capacity stated as lines, shifts and monthly output.",
        "Quality system certificate provided where held.",
        "Inspection records available to show the system in operation.",
        "Product and market certifications listed with scope and validity.",
        "Certifications checked as naming the same legal entity.",
        "Social compliance programmes and audit status disclosed.",
        "Previous audits listed with dates and issuing bodies.",
        "Corrective action closure documented where applicable.",
        "Export markets stated with documentation where possible.",
        "Evidence supplied in a form a third party can verify.",
      ],
      tables: [
        {
          title: "The Ten Elements of a Buyer-Ready Profile",
          headers: ["Element", "What buyers want to see", "Why it matters"],
          rows: [
            ["Legal company information", "Registered name, Unified Social Credit Code, status", "Establishes who the counterparty is"],
            ["Real production address", "Address where production happens", "Determines where audits and inspections apply"],
            ["Product capability", "In-house processes and equipment", "Fit is process-specific, not category-specific"],
            ["Capacity", "Lines, shifts and monthly output", "Tests whether delivery promises are realistic"],
            ["Quality system", "Certificate plus applied control records", "Certification alone does not show application"],
            ["Certifications", "Market-specific approvals with scope and dates", "Determines market access and buyer acceptance"],
            ["Social compliance", "Programmes audited against and current status", "Usually a customer-mandated requirement"],
            ["Audit history", "Dates, issuing bodies and what was corrected", "Shows how problems are handled"],
            ["Export experience", "Destination markets with documentation", "Experience is destination-specific"],
            ["Verifiable evidence", "Documents a third party can check", "Converts claims into evidence"],
          ],
        },
        {
          title: "How a Supplier Profile Is Reviewed on This Platform",
          headers: ["Stage", "What happens", "What it does not mean"],
          rows: [
            ["Submission", "The supplier submits company and factory information", "It does not mean the profile is public yet"],
            ["Human review", "The profile is reviewed for completeness and consistency", "It does not mean every claim has been independently verified"],
            ["Evidence level", "An evidence level is assigned to the profile", "A lower level is not a negative judgement, it is a statement of what is evidenced"],
            ["Risk score", "A risk score is calculated for decision support", "It is not a certification and not a guarantee of orders"],
            ["Publication", "The profile becomes visible to buyers", "It does not guarantee enquiries or orders"],
            ["Buyer inquiry", "Buyers contact suppliers that fit their requirements", "Commercial outcomes depend on fit, price and terms"],
          ],
        },
      ],
      faq: [
        {
          q: "What does buyer-ready mean?",
          a: "It means a buyer can understand and check your factory from your documentation without a long exchange. In practice, legal identity, production address, capability, capacity, quality system, certifications, compliance position, audit history, export experience and verifiable evidence are all documented and consistent.",
        },
        {
          q: "Does joining the supplier network guarantee orders?",
          a: "No. Registration makes your factory easier for international buyers to find, understand and check. Enquiries depend on fit, price, terms and the buyer's own process, and no platform can guarantee orders.",
        },
        {
          q: "Is a published profile a certification?",
          a: "No. A profile is a record of what has been submitted and reviewed, with an evidence level and a risk score. It does not certify compliance, quality or capability, and it is not equivalent to a third-party certificate.",
        },
        {
          q: "Why does the platform review profiles manually?",
          a: "Because consistency and completeness matter more than volume. Human review checks that documents match each other and that claims are plausible, which is what makes a profile useful to a buyer.",
        },
        {
          q: "What if my certificates name a different legal entity?",
          a: "Then they do not apply to your profile. Certificates are issued to a named entity and scope, so make sure the certificates you publish name the legal entity buyers would contract with.",
        },
        {
          q: "Should I disclose previous audit findings?",
          a: "Yes, with their closure status. Buyers generally read disclosed findings with closure evidence more positively than silence, because it shows how the factory handles problems.",
        },
        {
          q: "How long does review take?",
          a: "It depends on how complete the submission is and what needs checking. Profiles with complete, consistent documentation move faster than those requiring follow-up questions.",
        },
      ],
      sources: [
        {
          name: "FactoryAuditB2B Supplier Network",
          note: "How supplier profiles are submitted, reviewed, assigned an evidence level and published.",
        },
        {
          name: "FactoryAuditB2B Methodology",
          note: "How evidence levels and risk scores are defined, and what they do and do not establish.",
        },
        {
          name: "State Administration for Market Regulation (SAMR), China",
          note: "The registration authority whose records underpin company identity checks.",
        },
      ],
    },
    zh: {
      quickAnswer:
        "「买家就绪」意味着买家无需长篇邮件往返，就能理解并核查你的工厂。实践中就是十件事形成文件：法律公司信息、真实生产地址、产品能力、产能、质量体系、与买家市场相关的认证、社会责任合规状况、审核历史、出口经验，以及真正可被核验的证据。完整的档案会获得更多买家关注，因为它在买家开口提问之前，就已经回答了买家的问题。",
      definition:
        "「买家就绪」描述的是这样一种供应商：其身份、能力与合规状况可以从文件中被理解，并能被第三方核验。它是一种证据状态，而不是营销状态。在本平台，供应商档案需经人工审核、被赋予证据等级与风险评分，之后才会公开。注册不保证订单，也不构成任何认证：它只是让国际买家更容易发现、理解并核查这家工厂。",
      keyPoints: [
        "买家就绪是证据状态，不是营销话术。",
        "最重要的十项：身份、地址、能力、产能、质量、认证、合规、审核历史、出口经验与可核验证据。",
        "买家核查的是文件之间是否自洽，而不是文件是否存在。",
        "不完整的档案通常被读作「未知」，而不是「可接受」。",
        "审核历史与纠正措施关闭，是工厂如何处理问题的强信号。",
        "在本平台注册让工厂更易被找到与核查；它不保证订单，也不签发认证。",
      ],
      steps: [
        {
          title: "把法律公司信息形成文件",
          body: "提供中文注册名、统一社会信用代码、成立日期与注册资本，并确保你使用的英文名称在所有地方一致。主体名称不一致，是买家文件核查最先标记的项。",
        },
        {
          title: "公布真实的生产地址",
          body: "单独写明实际生产的地址，与任何注册办公地区分开。买家与审核员需要生产地址来界定核验与验厂的范围。",
        },
        {
          title: "具体描述产品能力",
          body: "写明你自制的工序，因为买家匹配是工序特定的。",
        },
        {
          title: "以可核查的方式说明产能",
          body: "用买家可以检验的方式给出产能：相关产品的产线、班次与月产量。没有支撑的产能数字，会招来工厂答不上来的质询。",
        },
        {
          title: "展示质量体系的实际运行",
          body: "若有质量体系证书请提供，并准备好出示来料、过程与最终检验记录。买家越来越要求看到执行证据，而不只是认证。",
        },
        {
          title: "列出与买家市场相关的认证",
          body: "列出产品与市场特定准入认证，含范围与有效期，并确保它们指向同一法律主体。证书写的是另一主体则不转移适用。",
        },
        {
          title: "说明你的社会责任合规状况",
          body: "注明你曾按哪些项目接受审核，以及任何纠正措施的当前状态。披露发现项并附关闭证据，比沉默更好。",
        },
        {
          title: "提供审核历史",
          body: "列出既往审核的日期与发证机构，以及已整改的内容。能证明自己修好过问题的工厂，比声称从未出过问题的工厂更容易被信任。",
        },
        {
          title: "举证出口经验",
          body: "说明你曾发运到哪些市场，并尽可能提供单证。出口经验是目的地特定的，包括面向该市场的符合性工作。",
        },
        {
          title: "让证据可被核验",
          body: "提供第三方可核查的文件：登记记录、开给你主体的证书，以及可被走访的生产地址。可核验性，才是把声称转化为证据的东西。",
        },
      ],
      examples: [
        {
          title: "不完整的档案被读作未知",
          body: "某工厂只列了产品与照片，没有注册信息、产能与认证。买家无法把它与任何其他挂牌区分开，询盘流向了回答更多问题的档案。",
        },
        {
          title: "自洽的档案被快速入围",
          body: "某工厂公布了注册信息、生产地址、设备清单、产能，以及一份指向同一主体的有效 ISO 证书。买家无需初步提问就将其入围。",
        },
        {
          title: "审核历史处理得当",
          body: "某工厂披露了一次既往审核中的两项不符合项，并出示了关闭证据。买家把这种披露视为「这家工厂如何处理问题」的正面信号。",
        },
      ],
      checklist: [
        "已公布中文注册名与统一社会信用代码。",
        "英文公司名称在所有材料中一致使用。",
        "生产地址已与注册办公地分开列明。",
        "已带设备细节描述产品与自制工序。",
        "产能已按产线、班次与月产量表述。",
        "持有的质量体系证书已提供。",
        "可出示检验记录以体现体系在运行。",
        "已列明产品与市场认证，含范围与有效期。",
        "已核查认证是否指向同一法律主体。",
        "已披露社会责任合规项目与审核状态。",
        "已列出既往审核的日期与发证机构。",
        "适用时已记录纠正措施关闭情况。",
        "已说明出口市场，并尽可能附单证。",
        "证据以第三方可核查的形式提供。",
      ],
      tables: [
        {
          title: "买家就绪档案的十个要素",
          headers: ["要素", "买家想看到什么", "为何重要"],
          rows: [
            ["法律公司信息", "注册名、统一社会信用代码、状态", "确立交易对手是谁"],
            ["真实生产地址", "实际生产的地址", "决定验厂与验货适用于哪里"],
            ["产品能力", "自制工序与设备", "匹配是工序特定的，而非品类特定的"],
            ["产能", "产线、班次与月产量", "检验交付承诺是否现实"],
            ["质量体系", "证书 + 实际执行的控制记录", "仅有认证不足以体现执行"],
            ["认证", "含范围与日期的市场特定准入", "决定市场准入与买家接受度"],
            ["社会责任合规", "曾按哪些项目审核及当前状态", "通常是客户强制要求"],
            ["审核历史", "日期、发证机构与已整改内容", "体现如何处理问题"],
            ["出口经验", "目的市场及单证", "经验是目的地特定的"],
            ["可核验证据", "第三方可核查的文件", "把声称转化为证据"],
          ],
        },
        {
          title: "本平台如何审核供应商档案",
          headers: ["阶段", "发生什么", "它不意味着什么"],
          rows: [
            ["提交", "供应商提交公司与工厂信息", "不意味着档案已公开"],
            ["人工审核", "审核完整性与一致性", "不意味着每项声称都已独立核验"],
            ["证据等级", "为档案赋予证据等级", "等级较低不是负面评价，而是对已举证程度的说明"],
            ["风险评分", "计算用于决策支持的风险评分", "它不是认证，也不保证订单"],
            ["发布", "档案对买家可见", "不保证询盘或订单"],
            ["买家询盘", "买家联系符合其要求的供应商", "商业结果取决于匹配度、价格与条款"],
          ],
        },
      ],
      faq: [
        {
          q: "「买家就绪」是什么意思？",
          a: "它意味着买家能从你的文件中理解并核查你的工厂，无需长篇往返。实践中即法律身份、生产地址、能力、产能、质量体系、认证、合规状况、审核历史、出口经验与可核验证据均已形成文件且彼此自洽。",
        },
        {
          q: "加入供应商网络能保证拿到订单吗？",
          a: "不能。注册只是让你的工厂更容易被国际买家发现、理解与核查。询盘取决于匹配度、价格、条款与买家自身流程，任何平台都不能保证订单。",
        },
        {
          q: "已发布的档案是一种认证吗？",
          a: "不是。档案是对已提交并经审核内容的记录，附带证据等级与风险评分。它不认证合规、质量或能力，也不等同于第三方证书。",
        },
        {
          q: "为什么平台要人工审核档案？",
          a: "因为一致性与完整性比数量更重要。人工审核检查文件是否相互吻合、声称是否合理，而这正是档案对买家有用的原因。",
        },
        {
          q: "如果我的证书写的是另一法律主体怎么办？",
          a: "那么它不适用于你的档案。证书是发给具名主体与范围的，因此请确保你公布的证书写的是买家将与之签约的法律主体。",
        },
        {
          q: "应该披露既往审核发现项吗？",
          a: "应该，并附上关闭状态。买家通常把「披露发现项 + 关闭证据」读得比沉默更正面，因为这说明工厂如何处理问题。",
        },
        {
          q: "审核需要多久？",
          a: "取决于提交内容的完整度与需核查的内容。文件完整自洽的档案，比需要追问的档案走得更快。",
        },
      ],
      sources: [
        { name: "FactoryAuditB2B 供应商网络", note: "供应商档案如何提交、审核、赋予证据等级并发布。" },
        { name: "FactoryAuditB2B 方法论", note: "证据等级与风险评分如何界定，以及它们确立与不确立什么。" },
        { name: "中国国家市场监督管理总局（SAMR）", note: "其登记记录是公司身份核查基础的登记机关。" },
      ],
    },
  },
];

export const GUIDE_CATEGORY_ORDER: GuideCategory[] = [
  "verification",
  "audit",
  "risk",
  "china",
  "sea",
  "compliance",
];

export function findGuide(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}

export function guidesByCategory(category: GuideCategory) {
  return GUIDES.filter((g) => g.category === category);
}

/** 首页 Featured Guides 用：固定取前三条，顺序即编辑推荐顺序 */
export function featuredGuides() {
  return GUIDES.slice(0, 3);
}

/**
 * 内容簇 hub 落地页的 SEO 文案（en/zh）。键覆盖全部 GuideCategory，
 * 即使某个分类当前无指南也保留，便于将来补内容而不必改类型。
 * name = 簇名（导航/H1）；title/desc = 页面 <title> 与 meta description，locale-aware。
 */
export const GUIDE_CATEGORY_META: Record<
  GuideCategory,
  { nameEn: string; nameZh: string; titleEn: string; titleZh: string; descEn: string; descZh: string }
> = {
  verification: {
    nameEn: "Supplier Verification",
    nameZh: "供应商核验",
    titleEn: "Supplier Verification Guides: How to Vet a Factory Before You Pay",
    titleZh: "供应商核验指南：付款前如何核查工厂",
    descEn:
      "Step-by-step guides on verifying suppliers in China and Asia — business registration, background checks, document review and risk scoring.",
    descZh: "中国及亚洲供应商核验实操指南：工商注册、背景调查、文件审查与风险评分。",
  },
  audit: {
    nameEn: "Factory Audit",
    nameZh: "工厂验厂",
    titleEn: "Factory Audit Guides: Checklists, Reports & What Buyers Must Know",
    titleZh: "工厂验厂指南：清单、报告与买家须知",
    descEn:
      "Practical factory audit guides — what auditors check, how to read a report, capacity and on-site vs desk audits, plus quality inspections (IQC/IPQC/FQC/OQC).",
    descZh: "工厂验厂实操指南：审核看什么、如何读报告、产能与实地/文件审核，以及质量检验（IQC/IPQC/FQC/OQC）。",
  },
  risk: {
    nameEn: "Supplier Risk & Scam Prevention",
    nameZh: "供应商风险与防骗",
    titleEn: "Supplier Risk & Scam Prevention Guides",
    titleZh: "供应商风险与防骗指南",
    descEn:
      "How to spot supplier scams, check a China company registration, use Alibaba Trade Assurance, and verify a supplier before paying a deposit.",
    descZh: "如何识别供应商诈骗、查中国公司工商注册、使用阿里 Trade Assurance，以及付定金前核验供应商。",
  },
  compliance: {
    nameEn: "Social Compliance & Audit",
    nameZh: "社会责任合规审核",
    titleEn: "Social Compliance & Audit Guides (SA8000, SMETA, ESG)",
    titleZh: "社会责任合规审核指南（SA8000、SMETA、ESG）",
    descEn:
      "Social compliance guides covering SA8000, SMETA vs BSCI, ESG supplier audits, mandatory ethical audit requirements and brand reputation risk.",
    descZh: "社会责任合规指南：SA8000、SMETA 与 BSCI 对比、ESG 供应商审核、道德审核强制要求与品牌声誉风险。",
  },
  sea: {
    nameEn: "Southeast Asia Sourcing",
    nameZh: "东南亚采购",
    titleEn: "Southeast Asia Factory Audit Guides (Vietnam & Beyond)",
    titleZh: "东南亚工厂验厂指南（越南等）",
    descEn:
      "Factory audit and verification guides for Southeast Asia — Vietnam auditing realities, regional risk differences and what changes vs China sourcing.",
    descZh: "东南亚工厂验厂与核验指南：越南审核实情、区域风险差异，以及与中国的不同。",
  },
  china: {
    nameEn: "China Sourcing",
    nameZh: "中国采购",
    titleEn: "China Sourcing Guides",
    titleZh: "中国采购指南",
    descEn: "China-focused sourcing, verification and audit guides.",
    descZh: "中国相关的采购、核验与验厂指南。",
  },
};

/**
 * 返回「实际有指南」的分类，顺序遵循 GUIDE_CATEGORY_ORDER。
 * 用于 hub 路由 generateStaticParams、sitemap/llms 收录、索引页分类导航 ——
 * 与页面可索引性同源：无指南的分类不生成 hub、不进 sitemap，避免 404 / noindex 错配。
 */
export function guideCategoriesWithGuides(): GuideCategory[] {
  const present = new Set<GuideCategory>(GUIDES.map((g) => g.category));
  return GUIDE_CATEGORY_ORDER.filter((c): c is GuideCategory => present.has(c as GuideCategory));
}
