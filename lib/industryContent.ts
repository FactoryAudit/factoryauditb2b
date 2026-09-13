// lib/industryContent.ts —— CS-02A Food Master Template 的行业内容层
//
// 设计铁律：
//   1. **内容与代码分离**：Master 模板（/industry/[slug]）对 13 个行业通用，
//      行业差异化文案全部来自本文件的数据。代码里不得出现
//      `if (slug === "food-beverage")` 这类分支 —— 否则 chemicals 上线时要重写一遍。
//   2. **只写确实有的内容**：没有差异化文案的行业，Block A 整块不渲染，
//      绝不用模板套话填充（§44 质量门）。
//   3. **en/zh 双版 + zh-TW 繁化**（pickZhCopy）：与 /guides、/audit-guide 的内容策略一致，
//      其余 6 个语言渲染英文正文；页面框架文案走 9 语字典。
//   4. **不写无据声称**：不写"我们审核过 N 家"、不写证书有效期、不写任何可核验数字。
//      程序事实（owner / code / 名称）一律从 lib/staticData.ts 的 STATIC_PROGRAMS 取，
//      不在这里另抄一份 —— 单一事实来源。

export type H2Copy = { en: string; zh: string };

export type TopicSection = {
  h2: H2Copy;
  /** 段落列表；保持简短，不做内容农场式堆砌 */
  body: H2Copy[];
};

export type IndustryTopic = {
  slug: string;
  /** P2 认证导航 / P3 单项审核 / P4 工具 / P5 服务 */
  pageType: "P2" | "P3" | "P4" | "P5";
  /** P3 关联的审核项目 code（对应 STATIC_PROGRAMS.code，且必须已生成 audit-guide 页） */
  programCode?: string;
  /** P2 展示的认证项目 code 列表（同样要求已生成 audit-guide 页） */
  programCodes?: string[];
  title: H2Copy;
  metaDesc: H2Copy;
  intro: H2Copy;
  sections: TopicSection[];
  /** P4 检查表条目 */
  checklist?: H2Copy[];
};

export type IndustryCopy = {
  /** Master 页 Block A：这个行业验厂的特殊性。没有就整块不渲染。 */
  differenceTitle?: H2Copy;
  differenceBody?: H2Copy[];
  topics: IndustryTopic[];
};

// ---------------------------------------------------------------------------
// Food & Beverage（CS-02A 首个启用 Master 模板的行业）
// ---------------------------------------------------------------------------

const FOOD_TOPICS: IndustryTopic[] = [
  {
    slug: "food-safety-certification",
    pageType: "P2",
    programCodes: ["BRC", "HACCP", "FSSC22000"],
    title: {
      en: "Food safety certification: BRCGS, HACCP and FSSC 22000 compared",
      zh: "食品安全认证对比：BRCGS、HACCP 与 FSSC 22000",
    },
    metaDesc: {
      en: "Compare the food safety schemes buyers ask for: BRCGS, HACCP and FSSC 22000. Scope, owner and how to choose before you place an order.",
      zh: "对比买家常要求的食品安全方案：BRCGS、HACCP 与 FSSC 22000。覆盖适用范围、发证方，以及下单前如何选择。",
    },
    intro: {
      en: "The three schemes below are the ones food buyers most often name in a supplier questionnaire. They overlap but they are not interchangeable: HACCP is a preventive control system, while BRCGS and FSSC 22000 are certifiable schemes built on top of it.",
      zh: "下面三个方案是食品买家在供应商问卷中最常点名的。它们有重叠但不可互换：HACCP 是一套预防性控制体系，而 BRCGS 与 FSSC 22000 是建立在它之上、可发证的认证方案。",
    },
    sections: [
      {
        h2: { en: "How to choose", zh: "如何选择" },
        body: [
          {
            en: "Start from the destination market and the retailer. Many European retailers name a specific recognised scheme in their supplier requirements; a factory holding the wrong one will not pass their onboarding.",
            zh: "先确定目标市场与零售商。不少欧洲零售商会在供应商要求里点名具体方案，工厂持有的方案不对，就无法通过他们的准入。",
          },
          {
            en: "Then check scope, not just the certificate. A certificate that covers a different product category or a different site than the one producing your order does not cover your order.",
            zh: "然后核对范围，而不只是看证书。证书覆盖的产品类别或生产场地与实际生产你订单的场地不一致时，它并不覆盖你的订单。",
          },
        ],
      },
      {
        h2: { en: "What to ask the factory for", zh: "应该向工厂索取什么" },
        body: [
          {
            en: "Ask for the certificate, its scope statement, the issuing body and the audit date, then confirm each one against the issuing body's own records before you treat it as valid.",
            zh: "索取证书、范围说明、发证机构与审核日期，并在把它当作有效之前，逐项向发证机构自身的记录核对。",
          },
        ],
      },
    ],
  },
  {
    slug: "brcgs-audit",
    pageType: "P3",
    programCode: "BRC",
    title: { en: "BRCGS audit", zh: "BRCGS 审核" },
    metaDesc: {
      en: "What a BRCGS audit covers, who issues it, and what a food buyer should verify before accepting a BRCGS certificate from a supplier.",
      zh: "BRCGS 审核覆盖哪些内容、由谁发证，以及食品买家在采信供应商 BRCGS 证书前应核对什么。",
    },
    intro: {
      en: "BRCGS is a certifiable product safety scheme used widely by retailers and brand owners. It is audited by third-party certification bodies, not by the scheme owner itself.",
      zh: "BRCGS 是被零售商与品牌方广泛采用的可发证产品安全方案。审核由第三方认证机构执行，而非方案所有方本身。",
    },
    sections: [
      {
        h2: { en: "What the audit covers", zh: "审核覆盖范围" },
        body: [
          {
            en: "Expect the auditor to walk the site and review the HACCP plan, prerequisite programmes, hygiene zoning, allergen controls, traceability and the internal audit system, together with records that show these are actually operated.",
            zh: "审核会走现场并审查 HACCP 计划、前提方案、卫生分区、过敏原控制、追溯与内审体系，同时核查能证明这些确实在运行的记录。",
          },
        ],
      },
      {
        h2: { en: "What buyers should verify", zh: "买家应核对的要点" },
        body: [
          {
            en: "Verify the site address on the certificate matches the site producing your goods, that the product category in scope covers yours, and that the certificate has not expired.",
            zh: "核对证书上的场地地址与实际生产你货物的场地一致、范围中的产品类别覆盖你的产品，且证书未过期。",
          },
        ],
      },
    ],
  },
  {
    slug: "haccp-audit",
    pageType: "P3",
    programCode: "HACCP",
    title: { en: "HACCP audit", zh: "HACCP 审核" },
    metaDesc: {
      en: "What a HACCP audit examines, how it differs from a certifiable scheme, and what evidence a food supplier should be able to produce.",
      zh: "HACCP 审核检查什么、它与可发证方案的区别，以及食品供应商应能提供的证据。",
    },
    intro: {
      en: "HACCP is a preventive system for identifying and controlling food safety hazards, described in Codex principles. It is the control system that certification schemes are built on rather than a single branded certificate.",
      zh: "HACCP 是一套用于识别与控制食品安全危害的预防性体系，由食品法典的原则描述。它是认证方案所依托的控制体系，而不是某一个品牌化的证书。",
    },
    sections: [
      {
        h2: { en: "What the audit examines", zh: "审核检查内容" },
        body: [
          {
            en: "The auditor checks that hazard analysis exists and is current, that critical limits and monitoring are defined for each critical control point, and that corrective action and verification records are kept.",
            zh: "审核会检查危害分析是否存在且为最新版本、每个关键控制点是否定义了关键限值与监控，以及纠正措施与验证记录是否留存。",
          },
        ],
      },
      {
        h2: { en: "Evidence a supplier should produce", zh: "供应商应能提供的证据" },
        body: [
          {
            en: "A current hazard analysis, the flow diagram it is based on, monitoring logs for each control point, and records of deviations with the corrective action taken.",
            zh: "最新的危害分析、其依据的流程图、各控制点的监控记录，以及偏差与所采取纠正措施的记录。",
          },
        ],
      },
    ],
  },
  {
    slug: "fssc-22000-audit",
    pageType: "P3",
    programCode: "FSSC22000",
    title: { en: "FSSC 22000 audit", zh: "FSSC 22000 审核" },
    metaDesc: {
      en: "How an FSSC 22000 audit is structured, its relationship to ISO 22000, and the checks a buyer should make on an FSSC 22000 certificate.",
      zh: "FSSC 22000 审核的结构、它与 ISO 22000 的关系，以及买家对 FSSC 22000 证书应做的核对。",
    },
    intro: {
      en: "FSSC 22000 is a certification scheme for food safety management systems. It combines a management system requirement with prerequisite programmes and sector-specific requirements.",
      zh: "FSSC 22000 是一套食品安全管理体系认证方案。它把管理体系要求、前提方案与行业专项要求组合在一起。",
    },
    sections: [
      {
        h2: { en: "How the audit is structured", zh: "审核如何组织" },
        body: [
          {
            en: "Certification runs in cycles: an initial certification audit, followed by surveillance audits in the following years. Audits cover the management system, prerequisite programmes and the HACCP plan.",
            zh: "认证按周期进行：先做初次认证审核，随后年度进行监督审核。审核覆盖管理体系、前提方案与 HACCP 计划。",
          },
        ],
      },
      {
        h2: { en: "Checks on a certificate", zh: "证书核对要点" },
        body: [
          {
            en: "Confirm the certification body, the site scope, the category covering your product, and that the certificate is within its validity period.",
            zh: "确认发证机构、场地范围、覆盖你产品的类别，以及证书仍处于有效期内。",
          },
        ],
      },
    ],
  },
  {
    slug: "food-factory-audit-checklist",
    pageType: "P4",
    title: {
      en: "Food factory audit checklist",
      zh: "食品工厂验厂检查表",
    },
    metaDesc: {
      en: "A food factory audit checklist covering licences, food safety certificates, traceability, allergen control, cold chain and labelling, for buyer-side pre-order checks.",
      zh: "面向买家下单前的食品工厂验厂检查表：证照、食品安全证书、追溯、过敏原控制、冷链与标签。",
    },
    intro: {
      en: "Use this checklist to structure a first visit or a document review. It does not replace an audit; it tells you which documents to request and which gaps to treat as blocking.",
      zh: "用这份检查表来组织首次走访或文件审查。它不能替代审核，但能告诉你要索取哪些文件、哪些缺口应视为阻断项。",
    },
    sections: [
      {
        h2: { en: "How to use it", zh: "如何使用" },
        body: [
          {
            en: "Request the documents before the visit, then use the on-site time to verify that the records match what actually happens on the line.",
            zh: "走访前先索取文件，现场时间用来核对记录与产线实际操作是否一致。",
          },
        ],
      },
    ],
    checklist: [
      { en: "Business licence and food production or handling permit, with the registered address matching the production site", zh: "营业执照与食品生产/经营许可，登记地址与生产场地一致" },
      { en: "Food safety certificate: issuing body, scope statement, product category, audit date and expiry date", zh: "食品安全证书：发证机构、范围说明、产品类别、审核日期与有效期" },
      { en: "Current HACCP plan with flow diagram and the hazard analysis behind it", zh: "最新的 HACCP 计划，含流程图与其依据的危害分析" },
      { en: "Monitoring records for each critical control point, including deviation logs and corrective actions", zh: "各关键控制点的监控记录，含偏差记录与纠正措施" },
      { en: "Traceability exercise: one finished batch traced back to raw material lots and forward to the customer", zh: "追溯演练：一个成品批次向前追溯到原料批次、向后追溯到客户" },
      { en: "Allergen handling: storage segregation, line cleaning procedure and labelling control", zh: "过敏原管理：储存隔离、清线程序与标签控制" },
      { en: "Cold chain records where applicable: storage temperatures, transport temperatures and alarm handling", zh: "适用时的冷链记录：储存温度、运输温度与报警处理" },
      { en: "Water quality and pest control records", zh: "水质与虫害控制记录" },
      { en: "Laboratory testing: scope, frequency and the most recent results for your product category", zh: "实验室检测：范围、频次与你产品类别的最新结果" },
      { en: "Complaint and recall procedure, with evidence the procedure has been tested", zh: "投诉与召回程序，以及该程序经过演练的证据" },
      { en: "Raw material supplier approval records, including certificates held for incoming materials", zh: "原料供应商准入记录，含来料所持证书" },
      { en: "Staff training records for food hygiene and for the specific tasks on the line", zh: "食品卫生及产线具体岗位的人员培训记录" },
    ],
  },
  {
    slug: "food-supplier-verification",
    pageType: "P5",
    title: {
      en: "Food supplier verification",
      zh: "食品供应商核验",
    },
    metaDesc: {
      en: "What supplier verification checks for a food factory: identity, licences, food safety certificate validity, traceability and cold chain, before you place an order.",
      zh: "食品工厂的供应商核验检查什么：身份、证照、食品安全证书有效性、追溯与冷链，在你下单之前完成。",
    },
    intro: {
      en: "Verification answers a narrow question: is this the company it says it is, does it hold the documents it claims, and do those documents still cover what you are buying?",
      zh: "核验回答的是一个很窄的问题：这家公司是否就是它自称的那个主体，它是否持有自称的证件，这些证件是否仍然覆盖你正在采购的东西。",
    },
    sections: [
      {
        h2: { en: "What is checked", zh: "检查内容" },
        body: [
          {
            en: "Registered identity and licence records, the production site address, the food safety certificates claimed and their validity, and the traceability and cold chain records that support the claim.",
            zh: "登记身份与证照记录、生产场地地址、所声称的食品安全证书及其有效性，以及支撑该声称的追溯与冷链记录。",
          },
          {
            en: "Verification reports what was found and what could not be confirmed. It does not certify a factory and it does not accept a claim as true because the factory made it.",
            zh: "核验报告写明发现了什么、什么无法确认。它不认证工厂，也不会因为工厂自己这么声称就采信。",
          },
        ],
      },
    ],
  },
];

const FOOD: IndustryCopy = {
  differenceTitle: {
    en: "What makes food suppliers different",
    zh: "食品供应商的特殊之处",
  },
  differenceBody: [
    {
      en: "A food factory is checked against two things at once: the social and quality criteria any factory is checked against, and the food safety system that governs what it produces.",
      zh: "食品工厂同时接受两套检查：任何工厂都要接受的社会责任与质量准则，以及管辖其产品的食品安全体系。",
    },
    {
      en: "The food safety layer is where most surprises are found. A certificate can be valid and still not cover your product category or your production site, and a HACCP plan can exist on paper while monitoring records show it is not being operated.",
      zh: "食品安全层面最容易出问题。证书可能有效，却并不覆盖你的产品类别或生产场地；HACCP 计划可能写在纸上，而监控记录显示它并未真正运行。",
    },
    {
      en: "Cold chain, allergen handling and traceability add checks that do not exist in most other industries. Verification on food suppliers is therefore ordered around documents first, then confirmed on site.",
      zh: "冷链、过敏原处理与追溯带来了大多数其他行业没有的检查项。因此食品供应商的核验先围绕文件展开，再到现场确认。",
    },
  ],
  topics: FOOD_TOPICS,
};

// ---------------------------------------------------------------------------
// Chemicals（CS-02B 最小可用版本）
//
// 刻意只配 2 个子主题：收尾冲刺期不做程序化扩张（用户指令 §六）。
// 🔴 子主题**不带 programCode**：REACH / RoHS / GHS 都还没进 STATIC_PROGRAMS，
//    带上就会生成 404 死链，且会给 audit-guide 再塞一批没有真实内容的 URL。
//    等真的有化工审核供给时再补。
// ---------------------------------------------------------------------------

const CHEM_TOPICS: IndustryTopic[] = [
  {
    slug: "chemical-compliance",
    pageType: "P2",
    title: {
      en: "Chemical compliance: what buyers should ask for",
      zh: "化工合规：买家应该索取什么",
    },
    metaDesc: {
      en: "What to request from a chemical supplier: safety data sheet, lot-specific certificate of analysis, grade declaration and destination-market rules. No certificate claims.",
      zh: "向化工供应商索取什么：安全数据表、批次分析证书、等级声明与目标市场规则。不含任何证书承诺。",
    },
    intro: {
      en: "Chemical sourcing fails less often on price than on documents. The four items below are what most buyers end up asking for, and the ones a factory should be able to produce without delay.",
      zh: "化工采购出问题的地方，往往不是价格而是文件。下面四项是多数买家最终会索取的内容，也是工厂应当能够立刻提供的。",
    },
    sections: [
      {
        h2: { en: "Safety data sheet (SDS)", zh: "安全数据表（SDS）" },
        body: [
          {
            en: "Ask for the current SDS for the exact product and check the revision date. An SDS written for a different grade or a different supplier does not describe what you are buying.",
            zh: "索取与所购产品完全对应的现行 SDS，并核对修订日期。为其他牌号或其他供应商编写的 SDS，描述的并不是你正在买的东西。",
          },
        ],
      },
      {
        h2: { en: "Lot-specific certificate of analysis", zh: "批次分析证书（COA）" },
        body: [
          {
            en: "A certificate of analysis describes the lot, not the factory. Match the lot number on the certificate to the lot on the packing, and check that the tested parameters cover the specification you agreed.",
            zh: "分析证书描述的是批次，不是工厂。把证书上的批号与包装上的批号对齐，并确认检测项目覆盖了你约定的规格。",
          },
        ],
      },
      {
        h2: { en: "Grade and intended use", zh: "等级与实际用途" },
        body: [
          {
            en: "Food grade, cosmetic grade, pharmaceutical grade and technical grade are different products with different impurity limits and different paperwork. State the intended use before you order, not after.",
            zh: "食品级、化妆品级、药用级与工业级是不同产品，杂质限值与随附文件都不同。下单前就要说明实际用途，而不是事后补。",
          },
        ],
      },
      {
        h2: { en: "Destination-market rules", zh: "目标市场规则" },
        body: [
          {
            en: "Preservative limits, food-contact status and labelling requirements differ by market and change over time. Confirm the rule currently in force at the destination instead of relying on what applied last year.",
            zh: "防腐剂限量、食品接触状态与标签要求因市场而异，且会随时间变化。应确认目标市场现行规则，而不是沿用去年的做法。",
          },
        ],
      },
    ],
  },
  {
    slug: "chemical-supplier-verification",
    pageType: "P5",
    title: {
      en: "Chemical supplier verification",
      zh: "化工供应商核验",
    },
    metaDesc: {
      en: "What verification checks on a chemical manufacturer: registered identity, licence and permit scope, the site that actually produces, and the documents behind a grade claim.",
      zh: "化工生产企业的核验检查什么：登记身份、许可范围、实际生产场地，以及支撑等级声称的文件。",
    },
    intro: {
      en: "Chemical sourcing has one failure mode that is harder to see than in most industries: the company you contracted may not be the company that produced the material. Verification separates those two questions before you pay.",
      zh: "化工采购有一个比其他行业更难发现的失败模式：跟你签合同的公司，未必是实际生产这批料的公司。核验就是在付款前把这两个问题分开。",
    },
    sections: [
      {
        h2: { en: "What is checked", zh: "检查内容" },
        body: [
          {
            en: "Registered identity and the business licence, whether the licence and any production permit actually cover the substance in question, which site is named on those documents, and whether the site named is the site shipping your order.",
            zh: "登记身份与营业执照、该执照与生产许可是否真的覆盖相关物质、这些文件上写的是哪个场地，以及该场地是否就是发你这批货的场地。",
          },
          {
            en: "Verification reports what was found and what could not be confirmed. It does not certify a material and it does not accept a grade claim as true because the supplier made it.",
            zh: "核验报告写明发现了什么、什么无法确认。它不对物料作认证，也不会因为供应商自己声称就采信等级。",
          },
        ],
      },
      {
        h2: { en: "Trading company or manufacturer", zh: "贸易商还是生产厂" },
        body: [
          {
            en: "Both are legitimate, but they need to be checked differently. Confirm which one you are dealing with, then check the production site separately from the contracting entity.",
            zh: "两者都正当，但核验方式不同。先确认你面对的是哪一类，再把生产场地与签约主体分开核查。",
          },
        ],
      },
    ],
  },
];

const CHEM: IndustryCopy = {
  differenceTitle: {
    en: "What makes chemical suppliers different",
    zh: "化工供应商的特殊之处",
  },
  differenceBody: [
    {
      en: "A chemical order is specified by documents, not by samples alone. Grade, crystal form, particle size, surface treatment and impurity limits are all part of what you are buying, and a supplier that cannot produce the matching paperwork is not selling what you think.",
      zh: "化工订单是靠文件定义的，不只是靠样品。等级、晶型、粒径、表面处理与杂质限值都属于你购买的内容；拿不出对应文件的供应商，卖给你的并不是你以为的东西。",
    },
    {
      en: "The contracting company and the producing site are often two different entities. This is normal in chemicals, but it means identity checks have to cover both before an order is placed.",
      zh: "签约公司与实际生产场地常常是两个不同主体。这在化工行业属正常，但意味着下单前必须把两者都核查一遍。",
    },
    {
      en: "Rules are market-specific and change: preservative limits, food-contact status and labelling requirements are set by the destination market. Verification on chemical suppliers therefore starts from documents and the site, not from a certificate logo.",
      zh: "规则因市场而异且会变动：防腐剂限量、食品接触状态与标签要求都由目标市场规定。因此化工供应商的核验从文件与场地开始，而不是从证书标识开始。",
    },
  ],
  topics: CHEM_TOPICS,
};

// ---------------------------------------------------------------------------
// 注册表：行业 code → 内容。没有配置 = Master 模板只渲染通用区块。
// 新增行业时只在这里加一条，页面代码零改动。
// ---------------------------------------------------------------------------

export const INDUSTRY_COPY: Record<string, IndustryCopy> = {
  "food-beverage": FOOD,
  chemicals: CHEM,
};

/** 该行业是否有已配置的子主题（决定 Block B 是否渲染）。 */
export function topicsForIndustry(code: string): IndustryTopic[] {
  return INDUSTRY_COPY[code]?.topics ?? [];
}

/** 按 slug 取子主题；不存在返回 undefined（页面据此 404）。 */
export function findIndustryTopic(
  code: string,
  slug: string
): IndustryTopic | undefined {
  return topicsForIndustry(code).find((t) => t.slug === slug);
}

export function industryCopy(code: string): IndustryCopy | undefined {
  return INDUSTRY_COPY[code];
}
