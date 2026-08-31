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
    slug: "factory-audit-checklist",
    category: "audit",
    titleEn: "Factory Audit Checklist",
    titleZh: "工厂验厂检查清单",
    metaDescEn:
      "A practical factory audit checklist: legal status, facility, quality system, labour and child-labour controls, health and safety, environmental compliance and the records to review before you place an order.",
    metaDescZh:
      "实用的工厂验厂检查清单：法律资质、厂房设施、质量体系、劳工与童工管控、健康安全、环保合规，以及下单前应审阅的记录。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/factory-audit/request" },
    ],
    related: ["how-to-verify-a-chinese-supplier", "supplier-risk-assessment-guide", "pre-shipment-inspection-checklist"],
    en: {
      quickAnswer:
        "A factory audit checklist should first confirm the site is a real, legally operating manufacturer, then examine the quality system, production capacity, labour practices, health and safety, and environmental controls with documentary evidence. Run it before any deposit on a first or high-value order.",
      definition:
        "A factory audit checklist is a structured set of points an auditor verifies during an on-site visit: legal registration, facility condition, quality-management maturity, workforce practices, safety and environmental compliance. It turns a vague 'is this factory good?' question into a recorded list of yes or no findings.",
      keyPoints: [
        "Legal status first: confirm the business licence, the entity signing your contract, and that the production site matches the registered address.",
        "A clean certificate means little if it belongs to a different legal entity than the one you are paying.",
        "Capacity claims need proof: utility bills, headcount, machine list and recent production records beat a salesperson's word.",
        "Labour and child-labour checks belong in every social audit, especially for apparel, toys and electronics.",
        "Findings should be graded, not just listed, so a buyer can act on severity rather than volume.",
      ],
      steps: [
        { title: "Confirm legal identity", body: "Pull the business licence, tax registration and any export licence. Match the entity name to the contract. Note registered capital and the registered address." },
        { title: "Walk the facility", body: "Verify the building exists, count production lines, check the machine list against the quote, and photograph key areas with timestamps." },
        { title: "Review the quality system", body: "Ask for the quality manual, incoming inspection records, in-process checks and final inspection reports. Look for traceability from raw material to finished goods." },
        { title: "Grade the findings", body: "Mark each item pass, minor, major or critical. A critical finding such as child labour or a fake certificate stops the order regardless of the total score." },
      ],
      examples: [
        { title: "Electronics supplier in Shenzhen", body: "The audit found the licensed entity differed from the contract signatory; the buyer re-issued the contract to the licensed entity before paying a deposit." },
        { title: "Furniture factory in Vietnam", body: "The walk-through showed only 4 of 12 claimed lines were running; the buyer cut the first order and staged payment against verified output." },
      ],
      checklist: [
        "Business licence matches the contract entity",
        "Registered address matches the physical site",
        "Quality manual and inspection records are current",
        "Capacity supported by utility and headcount evidence",
        "No child or forced labour; age records verified",
        "Fire exits clear; first-aid and PPE present",
        "Environmental permits and waste handling documented",
      ],
      faq: [
        { q: "How long does a factory audit take?", a: "A standard on-site audit of one site runs one to two days with one or two auditors. Social audits with worker interviews take longer." },
        { q: "Who issues the audit certificate?", a: "Scheme-approved audit companies such as SGS, Intertek, BV and TUV issue the underlying report. This platform does not issue certificates; we verify and, on request, audit." },
        { q: "Is a checklist enough without a site visit?", a: "No. A remote checklist confirms documents, not the physical site. Verification answers 'is this what you claim?'. An audit answers 'how well does it run?'." },
      ],
      sources: [
        { name: "ISO 9001 quality management", note: "Basis for the quality-system section of most audit checklists." },
        { name: "SA8000 social accountability", note: "Reference for labour, child-labour and working-condition checks." },
        { name: "FactoryAuditB2B audit methodology", note: "How we grade pass, minor, major and critical findings." },
      ],
    },
    zh: {
      quickAnswer:
        "工厂验厂清单应先确认该厂是真实、合法运营的制造商，再用书面证据核查质量体系、产能、用工规范、健康安全与环保合规。首次或大额订单付定金前都应跑一遍。",
      definition:
        "工厂验厂清单是审核员现场逐项核对的结构化清单：法律登记、厂房状况、质量管理成熟度、用工规范、安全与环保合规。它把模糊的「这家厂行不行」变成一份有记录的逐项结论。",
      keyPoints: [
        "先查法律身份：核对营业执照、签约主体，以及生产场地与注册地址是否一致。",
        "证书再干净，只要它属于与你签约不同的法律主体，价值就归零。",
        "产能要用证据说话：水电费账单、人数、设备清单与近期生产记录，胜过业务员的口头承诺。",
        "童工与用工检查适用于每一次社会责任验厂，服装、玩具、电子尤其不能省。",
        "结论要分级而非罗列，买家才能按严重程度而非数量做决策。",
      ],
      steps: [
        { title: "确认法律身份", body: "调取营业执照、税务登记与出口资质，核对与合同主体名称一致，记录注册资本与注册地址。" },
        { title: "实地走厂", body: "确认厂房存在，清点产线数量，对照报价核对设备清单，对关键区域带时间戳拍照。" },
        { title: "审阅质量体系", body: "索取质量手册、来料检验记录、过程检验与终检报告，看从原料到成品是否可追溯。" },
        { title: "对结论分级", body: "每项标注通过／轻微／严重／致命。致命项（童工、假证）无论总分多少都应立即中止订单。" },
      ],
      examples: [
        { title: "深圳电子供应商", body: "审核发现持证主体与签约主体不一致，买家在付定金前重新以持证主体签署了合同。" },
        { title: "越南家具厂", body: "走访发现 12 条宣称产线只有 4 条在运行，买家削减首单并将付款与已核实产量挂钩。" },
      ],
      checklist: [
        "营业执照与合同主体一致",
        "注册地址与实际生产场地一致",
        "质量手册与检验记录为最新",
        "产能有水电费与人数证据支撑",
        "无童工或强迫劳动，年龄记录已核验",
        "消防通道畅通，急救与劳保用品到位",
        "环保许可与废物处置有文件记录",
      ],
      faq: [
        { q: "一次工厂验厂要多久？", a: "单个厂区的标准现场审核通常 1 至 2 天，1 至 2 名审核员。含工人访谈的社会责任验厂时间更长。" },
        { q: "验厂证书由谁出具？", a: "SGS、Intertek、BV、TUV 等经认可的审核公司出具底层报告。本平台不发证，我们做核验，并按需安排验厂。" },
        { q: "不做现场，只填清单够吗？", a: "不够。远程清单只能确认文件，无法确认物理现场。核验回答「是否如你所声称」，验厂回答「运行得有多好」。" },
      ],
      sources: [
        { name: "ISO 9001 质量管理体系", note: "多数验厂清单中质量体系部分的依据。" },
        { name: "SA8000 社会责任标准", note: "劳工、童工与工作条件检查的参考。" },
        { name: "FactoryAuditB2B 验厂方法说明", note: "我们如何对通过／轻微／严重／致命分级。" },
      ],
    },
  },

  {
    slug: "supplier-risk-assessment-guide",
    category: "risk",
    titleEn: "Supplier Risk Assessment Guide",
    titleZh: "供应商风险评估指南",
    metaDescEn:
      "How to run a supplier risk assessment across company, quality, compliance, production, supply chain and documentation, and how to use the score to decide verification, audit or order size.",
    metaDescZh:
      "如何对公司、质量、合规、生产、供应链与文件六个维度做供应商风险评估，并用分数决定核验、验厂或订单规模。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/factory-audit/request" },
    ],
    related: ["how-to-verify-a-chinese-supplier", "factory-audit-checklist", "smeta-vs-bsci-social-audit-comparison"],
    en: {
      quickAnswer:
        "A supplier risk assessment scores a supplier across six dimensions: company, quality, compliance, production, supply chain and documentation. The score tells you whether to order as usual, verify evidence before a deposit, or require an on-site audit before any commitment.",
      definition:
        "Supplier risk assessment is a structured method of turning scattered facts about a supplier into a single comparable score. It is decision-support, not a verdict: it tells a buyer where the weak points are so they can act before money changes hands.",
      keyPoints: [
        "Score by dimension, not by gut feel; a fixed weight model is reproducible and defensible.",
        "Company risk covers legal existence, ownership and whether the site is a real factory or a trading desk.",
        "Quality risk looks at the quality system, defect history and traceability, not just certificates on the wall.",
        "Compliance risk covers the audit and certification programs relevant to your product and market.",
        "Documentation risk is the easiest to improve and the most often ignored: missing or inconsistent papers hide the other risks.",
      ],
      steps: [
        { title: "Collect the basics", body: "Gather the business licence, product scope, certificates and any prior inspection or audit reports." },
        { title: "Score each dimension", body: "Work the six dimensions one at a time. Use a consistent scale so scores are comparable across suppliers." },
        { title: "Weight and aggregate", body: "Apply fixed weights to the dimensions and produce an overall 0 to 100 score." },
        { title: "Map score to action", body: "Set thresholds: below 30 with no critical gap is fine for reorders; 30 to 60 means verify before deposit; above 60 means audit before commitment." },
      ],
      examples: [
        { title: "Reorder with a low score", body: "A supplier at 22 with no critical gap passed for a repeat order; the buyer kept the standard inspection at shipment." },
        { title: "Deposit blocked by a gap", body: "A supplier at 48 had an unexplained ownership change; the buyer required document verification and a site audit before releasing the deposit." },
      ],
      checklist: [
        "Legal entity confirmed and matches the contract",
        "Real production site verified, not just a trading office",
        "Quality system and defect history reviewed",
        "Relevant certificates checked for scope and validity",
        "Supply-chain and subcontracting risks identified",
        "Key documents consistent and complete",
      ],
      faq: [
        { q: "Is the score decided by AI?", a: "No. A rule engine calculates it from your inputs. A language model may explain the result, but it cannot change the number." },
        { q: "What score is good?", a: "It depends on what you buy and how much you spend. Under 30 with no critical gap is usually fine for reorders. 30 to 60 means verify before deposit. Above 60 means audit before commitment." },
        { q: "How often should I reassess?", a: "At least yearly, and after any major change: new production site, ownership change, expired certificate, quality incident, or a large jump in order volume." },
      ],
      sources: [
        { name: "ISO 31000 risk management", note: "General framework for identifying, analysing and evaluating risk, applied here at supplier level." },
        { name: "ISO 9001 clause 8.4 control of externally provided processes", note: "Basis for evaluating and re-evaluating suppliers in a quality system." },
        { name: "FactoryAuditB2B risk methodology", note: "The published weights and dimensions our risk calculator uses." },
      ],
    },
    zh: {
      quickAnswer:
        "供应商风险评估从公司、质量、合规、生产、供应链、文件六个维度打分。分数告诉你：照常下单、付定金前先核验证据，还是先安排现场验厂再承诺。",
      definition:
        "供应商风险评估是把零散的供应商事实转成单一可比较分数的结构化方法。它是决策辅助而非最终判决：它指出薄弱点，让买家在付钱前采取行动。",
      keyPoints: [
        "按维度打分，不凭直觉；固定权重模型可复现、可辩护。",
        "公司风险看法律存续、股权，以及它究竟是真实工厂还是贸易档口。",
        "质量风险看质量体系、缺陷历史与可追溯性，而非墙上挂的证书。",
        "合规风险覆盖与你的产品和市场相关的审核与认证项目。",
        "文件风险最易改善也最常被忽略：缺失或不一致的文件会掩盖其他风险。",
      ],
      steps: [
        { title: "收集基础资料", body: "整理营业执照、经营范围、证书，以及既往检验或验厂报告。" },
        { title: "逐维度打分", body: "一次处理一个维度，使用统一量表，保证不同供应商之间可比。" },
        { title: "加权汇总", body: "对各维度套用固定权重，得出 0 至 100 的总分。" },
        { title: "把分数映射成动作", body: "设阈值：无致命缺口低于 30 可照常返单；30 至 60 付定金前先核验；60 以上承诺前先验厂。" },
      ],
      examples: [
        { title: "低分返单", body: "某供应商 22 分且无致命缺口，获准重复订单，发货时维持标准验货。" },
        { title: "缺口阻断定金", body: "某供应商 48 分但出现无法解释的股权变更，买家要求文件核验加现场验厂后才放定金。" },
      ],
      checklist: [
        "法律主体已确认并与合同一致",
        "真实生产场地已核实，而非仅贸易办公室",
        "已审阅质量体系与缺陷历史",
        "相关证书的范围与有效期已核对",
        "已识别供应链与外包风险",
        "关键文件一致且完整",
      ],
      faq: [
        { q: "分数是 AI 决定的吗？", a: "不是。分数由规则引擎根据你的输入计算。语言模型可以解释结果，但改不了数字。" },
        { q: "多少分算好？", a: "取决于你买什么、花多少钱。无致命缺口 30 分以下通常可返单；30 至 60 付定金前先核验；60 以上承诺前先验厂。" },
        { q: "多久重评一次？", a: "至少每年一次，并在重大变化后：新生产场地、股权变更、证书失效、质量事故，或订单量大幅上升。" },
      ],
      sources: [
        { name: "ISO 31000 风险管理", note: "识别、分析与评价风险的通用框架，此处应用于供应商层面。" },
        { name: "ISO 9001 第 8.4 条 外部提供过程的控制", note: "质量管理体系内评价与重新评价供应商的依据。" },
        { name: "FactoryAuditB2B 风险方法说明", note: "我们公开的权重与维度，风险计算器即使用此模型。" },
      ],
    },
  },

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
