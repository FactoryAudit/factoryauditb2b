// lib/aboutContent.ts —— /trust 页面内容层（About FactoryAuditB2B）
//
// ─────────────────────────────────────────────────────────────────────────────
// 为什么内容放在这里而不是字典里
// ─────────────────────────────────────────────────────────────────────────────
//   这是一篇**定位型长文**（Who We Are / Why We Know Factories / How We Work），
//   正文要求英文按海外采购商习惯重新表达、中文按国内表达重写，
//   两者是「同一意思的不同写法」而不是「翻译」。
//
//   项目既有约定（lib/industryContent.ts、lib/chemicals.ts）：
//   这类**正文**走 en/zh 双语内容层 + pickZhCopy(zh-TW 就地繁化)，
//   其余语种回落英文；只有**短字段**（metaTitle / H1 / 按钮）才进九语字典。
//   —— 同一套做法，不另起炉灶。
//
// ─────────────────────────────────────────────────────────────────────────────
// 铁律（与 memory「禁无据声称」一致，改这份文件时必须同时满足）
// ─────────────────────────────────────────────────────────────────────────────
//   1. 不写团队人数、审核员数量、客户数量、服务国家数量、供应商数量。
//   2. 不写「全球领先 / 行业第一 / 数千家供应商 / 覆盖几十个国家」。
//   3. 不写与任何国际机构、认证机构的合作或授权（无正式证明）。
//   4. 个人/团队经历只写「做过什么」，绝不写成公司持有的官方资质。
//   5. 业务范围只覆盖 COVERAGE_COUNTRIES：China / Vietnam / Thailand /
//      Malaysia / Philippines ⇒ 中文统一说「中国和东南亚」，不扩写。
//   6. 经验描述一律用「多年 / years」，不编具体年数。
// ─────────────────────────────────────────────────────────────────────────────

export type Bi = { en: string; zh: string };
export type BiArr = { en: string[]; zh: string[] };

/**
 * 运营主体。品牌名 ≠ 法律主体，页面上必须把两者分开写。
 * 未配置 TRUST_* 环境变量时页面也照常展示 —— 隐藏主体比展示主体更伤信任。
 */
export const OPERATOR = {
  nameEn: "Jiangmen Zhiyu Technology Co., Ltd.",
  nameZh: "江门智煜科技有限公司",
} as const;

/** 对外业务邮箱：优先显式配置，其次发件邮箱，最后兜底（都是真实可达域名邮箱） */
export function operatorEmail(): string {
  return (
    process.env.TRUST_CONTACT_EMAIL?.trim() ||
    process.env.FROM_EMAIL?.trim() ||
    "hello@factoryauditb2b.com"
  );
}

export const ABOUT = {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. 第一屏 —— 我们是谁
  // ─────────────────────────────────────────────────────────────────────────
  hero: {
    title: {
      en: "We Know Factories. We Know Audits. We Know Supply Chains.",
      zh: "我们懂工厂。我们懂审核。我们懂供应链。",
    },
    lead: {
      en: "FactoryAuditB2B is initiated and operated by Jiangmen Zhiyu Technology Co., Ltd., a company registered in China. We help global buyers find, screen, verify and audit suppliers in China and Southeast Asia.",
      zh: "FactoryAuditB2B 由中国注册公司「江门智煜科技有限公司」发起和运营，帮助全球采购商在中国和东南亚寻找、筛选、核验和审核供应商。",
    },
    whyBuilt: {
      en: "We built FactoryAuditB2B because of one problem we kept running into. When buyers source from China and Southeast Asia, finding a supplier is rarely the hard part. The hard part is deciding whether the supplier in front of you is what it claims to be.",
      zh: "我们建立 FactoryAuditB2B，是因为发现全球采购商寻找中国和东南亚供应商时，真正困难的并不是「找到一家供应商」，而是判断：这家公司到底是谁？它是不是自己所说的工厂？",
    },
    questionsLead: {
      en: "The questions buyers actually need answered:",
      zh: "采购商真正需要回答的问题：",
    },
    questions: {
      en: [
        "Who is this company, really?",
        "Is it the factory — or a trading company presenting itself as one?",
        "Does it have real production capability?",
        "Are its certificates, audit records and on-site conditions worth relying on?",
      ],
      zh: [
        "这家公司到底是谁？",
        "它是不是自己所说的工厂？",
        "它有没有真正的生产能力？",
        "它的认证、审核和现场情况是否值得进一步相信？",
      ],
    } satisfies BiArr,
    funnel: {
      en: "Our work is to help buyers move through Discover → Screen → Verify → Audit → Buy faster, and with fewer surprises.",
      zh: "我们的工作，就是帮助采购商更高效地完成：发现 → 筛选 → 核验 → 审核 → 采购。",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. 为什么我们懂供应商（三张卡：销售 / 审核 / 工厂）
  // ─────────────────────────────────────────────────────────────────────────
  why: {
    title: { en: "Why We Understand Suppliers", zh: "为什么我们懂供应商" },
    subtitle: {
      en: "Our advantage is not a large team. It is that the people behind this platform have spent years in different parts of the supply chain.",
      zh: "我们的优势不是团队很大，而是我们的人长期接触过供应链的不同环节。",
    },
    cards: [
      {
        num: "01",
        tag: { en: "Sales & Business", zh: "销售与业务" },
        title: {
          en: "Years in internet and chemical-industry sales",
          zh: "多年互联网与化工行业销售经验",
        },
        body: {
          en: "The founding members have years of experience in internet business and chemical-industry sales, working directly with Chinese manufacturers on customer development, sourcing requirements and commercial terms.",
          zh: "发起成员拥有多年互联网业务和化工行业销售经验，长期接触中国制造企业、客户开发、供应链需求和企业业务。",
        },
        closing: {
          en: "We know a buyer is never just reading a company profile. They are weighing product, capability, price, delivery and credibility.",
          zh: "我们知道买家在寻找供应商时，不只是看「公司资料」，而是要判断：产品、能力、价格、交付和可信度。",
        },
      },
      {
        num: "02",
        tag: { en: "Audit & Compliance", zh: "审核与合规" },
        title: {
          en: "Years in factory auditing and compliance work",
          zh: "多年工厂审核与企业合规相关经验",
        },
        body: {
          en: "Our team and partner network include professionals with years of factory audit experience, covering social compliance, quality systems, security audits and customer-specific factory inspections.",
          zh: "团队及合作网络中拥有具有多年工厂审核经验的专业人员，接触过社会责任、质量、反恐及客户验厂等不同场景。",
        },
        closing: {
          en: "A certificate is not the same thing as a good factory. What has value is reading documents, site conditions, people, production and management together.",
          zh: "一份证书不等于一家好工厂。真正有价值的是把文件、现场、人员、生产和管理情况放在一起判断。",
        },
      },
      {
        num: "03",
        tag: { en: "Factory & Production", zh: "工厂与生产" },
        title: {
          en: "Years in factory production and site management",
          zh: "多年工厂生产与现场管理经验",
        },
        body: {
          en: "Our team and partners also bring hands-on experience in factory production, process engineering and site management.",
          zh: "团队及合作人员拥有工厂生产、技术及现场管理经验。",
        },
        bulletsLead: {
          en: "So we look past the paperwork, at:",
          zh: "因此我们不仅关注「公司有没有资料」，也关注：",
        },
        bullets: {
          en: [
            "Production equipment",
            "Process capability",
            "Quality control",
            "Production planning",
            "Site management",
            "Actual output capacity",
          ],
          zh: ["生产设备", "工艺能力", "质量控制", "生产组织", "现场管理", "实际生产能力"],
        } satisfies BiArr,
        closing: {
          en: "This is the main difference between us and a pure data website.",
          zh: "这也是我们与单纯数据网站的重要区别。",
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. 从数据，到真实工厂
  // ─────────────────────────────────────────────────────────────────────────
  reality: {
    title: { en: "From Data to Reality", zh: "从数据，到真实工厂" },
    body: {
      en: "Public data helps you find suppliers. A purchasing decision needs more: data, documents, site reality and professional judgement. FactoryAuditB2B exists to put those in one place.",
      zh: "公开数据可以帮助你找到供应商。但采购决策真正需要的是：数据 + 文件 + 现场 + 专业判断。FactoryAuditB2B 希望把这些信息放在一起。",
    },
    tiersLead: {
      en: "We separate information by where it comes from:",
      zh: "我们会尽可能区分：",
    },
    tiers: [
      {
        en: "Supplier-Reported Information",
        zh: "供应商自报信息",
      },
      { en: "Public Information", zh: "公开信息" },
      { en: "Document Reviewed", zh: "文件已审阅" },
      { en: "On-site Verified", zh: "现场核验" },
    ],
    closing: {
      en: "These levels are kept separate. We do not mix them, and we do not present unverified information as certified.",
      zh: "不要把不同等级的信息混在一起，更不会把未经验证的信息包装成「已认证」。",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. 我们帮采购商回答什么（采购商语言，不是平台语言）
  // ─────────────────────────────────────────────────────────────────────────
  answers: {
    title: { en: "What We Help Buyers Answer", zh: "我们帮采购商回答什么" },
    lead: {
      en: "Written in buyer language, not platform language.",
      zh: "用采购商的语言，而不是平台的语言。",
    },
    items: [
      {
        q: { en: "Is this a real manufacturer?", zh: "这是真正的生产厂家吗？" },
        a: {
          en: "We check business registration, business scope, address and production evidence to separate factories from trading companies.",
          zh: "通过工商登记、经营范围、地址与生产证据，区分生产工厂与贸易公司。",
        },
      },
      {
        q: { en: "What can this factory actually produce?", zh: "这家工厂实际能生产什么？" },
        a: {
          en: "Equipment lists, process capability, capacity and product scope are reviewed against what the supplier claims.",
          zh: "把设备清单、工艺能力、产能与产品范围，和供应商自己的说法对照核查。",
        },
      },
      {
        q: {
          en: "Are the certificates and audit records credible?",
          zh: "它的认证和审核记录是否可信？",
        },
        a: {
          en: "Certificates are checked for scope, issuer and validity. A certificate is treated as one input, never as proof.",
          zh: "核对证书的范围、签发机构与有效期；证书只是判断依据之一，不是结论。",
        },
      },
      {
        q: { en: "Is the factory suitable for my order?", zh: "它适合我的采购需求吗？" },
        a: {
          en: "Suitability depends on your volume, quality level, market and timeline. We match against those, not against a generic score.",
          zh: "适配与否取决于你的订单量、质量等级、目标市场与交期，我们按这些条件匹配，而不是按一个通用分数。",
        },
      },
      {
        q: {
          en: "What should I verify before placing an order?",
          zh: "下单前我还应该核验什么？",
        },
        a: {
          en: "We tell you what is still unverified, so you can decide whether to request documents, a factory audit or an inspection before you pay.",
          zh: "我们会明确告诉你哪些信息仍未核验，让你决定在付款前是否要补文件、做工厂审核或验货。",
        },
      },
    ],
    valueQuote: {
      en: "Our job is not to tell you that every supplier is safe. Our job is to help you make a better-informed decision.",
      zh: "我们的工作不是告诉你「这家供应商绝对安全」，而是帮助你在做采购决策之前，获得更完整、更透明、更有依据的信息。",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. 我们怎么做（四步）
  // ─────────────────────────────────────────────────────────────────────────
  how: {
    title: { en: "How We Work", zh: "我们怎么做" },
    lead: {
      en: "Four steps, in the order a real sourcing process runs.",
      zh: "四个步骤，按真实采购流程的顺序。",
    },
    steps: [
      {
        num: "01",
        name: { en: "Discover", zh: "发现供应商" },
        body: {
          en: "Find potential suppliers by industry, product, region and public business information.",
          zh: "通过行业、产品、地区和公开商业信息发现潜在供应商。",
        },
      },
      {
        num: "02",
        name: { en: "Screen", zh: "初步筛选" },
        body: {
          en: "Consolidate company, product, factory, certification and public information into one comparable view.",
          zh: "整理公司、产品、工厂、认证和公开信息，形成可以横向比较的视图。",
        },
      },
      {
        num: "03",
        name: { en: "Verify", zh: "信息核验" },
        body: {
          en: "Document checks, background research and cross-checking of supplier information against your specific requirements.",
          zh: "根据具体需求进行文件核验、背景调查以及供应商信息交叉验证。",
        },
      },
      {
        num: "04",
        name: { en: "Audit", zh: "现场审核与采购支持" },
        body: {
          en: "Factory audits, inspections and other supply chain support based on what the buyer actually needs.",
          zh: "根据买家需求提供工厂审核、验货及其他供应链支持。",
        },
      },
    ],
    // 必须写明：不是每一家都被现场审核过，否则就是误导
    caveat: {
      en: "Verification depth is not the same for every supplier. Some have only been screened against public data; others have documents reviewed or a site visit completed. Always read what the page actually states.",
      zh: "不同供应商的核验深度不同，以页面实际标记的信息为准。",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. 信息透明
  // ─────────────────────────────────────────────────────────────────────────
  transparency: {
    title: { en: "Transparency Matters", zh: "信息透明很重要" },
    body: {
      en: "FactoryAuditB2B does not mark every supplier as “Verified”. What matters more is where the information came from, and how far we actually verified it.",
      zh: "FactoryAuditB2B 不会把所有供应商都标记为「Verified」。我们更重视：信息来自哪里，以及我们实际验证到了什么程度。",
    },
    labelsLead: {
      en: "So the platform separates information sources and evidence states explicitly:",
      zh: "因此平台会明确区分不同信息来源和证据状态：",
    },
    labels: {
      en: [
        "Supplier reported",
        "Public source",
        "Document reviewed",
        "Verification pending",
        "On-site verification",
      ],
      zh: ["供应商自报", "公开来源", "文件已审阅", "待核验", "现场核验"],
    } satisfies BiArr,
    notVerifiedTitle: { en: "Not Yet Verified", zh: "尚未核验" },
    notVerifiedBody: {
      en: "For anything we cannot confirm, we would rather mark it Not Yet Verified than package it to make a supplier look more credible.",
      zh: "对于无法确认的信息，我们宁愿标记为「尚未核验」，也不会为了提高供应商「看起来的可信度」而进行包装。",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. 运营主体（只展示真实已有的信息，缺什么就不显示那一行）
  // ─────────────────────────────────────────────────────────────────────────
  operated: {
    title: { en: "Operated by", zh: "运营主体" },
    statement: {
      en: "FactoryAuditB2B is the global supplier discovery and supply chain service platform of Jiangmen Zhiyu Technology Co., Ltd.",
      zh: "FactoryAuditB2B 是江门智煜科技有限公司旗下的全球供应商发现与供应链服务平台。",
    },
    fieldRegistered: { en: "Registered Company", zh: "注册公司" },
    fieldCountry: { en: "Country / Region", zh: "国家 / 地区" },
    fieldEmail: { en: "Official Email", zh: "官方邮箱" },
    fieldWebsite: { en: "Website", zh: "网站" },
    countryValue: { en: "China", zh: "中国" },
    websiteValue: "factoryauditb2b.com",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. 结尾 CTA —— 看完不能就结束
  // ─────────────────────────────────────────────────────────────────────────
  cta: {
    title: { en: "Need to Check a Supplier?", zh: "正在寻找或核验供应商？" },
    body: {
      en: "Tell us what you are looking for. We can help you find, screen, verify and audit suppliers in China and Southeast Asia.",
      zh: "告诉我们你的产品、采购需求和目标市场。我们可以协助你：寻找供应商 → 初步筛选 → 信息核验 → 工厂审核 → 采购支持。",
    },
    buttons: [
      { href: "/suppliers", label: { en: "Find Suppliers", zh: "寻找供应商" } },
      { href: "/factory-audit/request", label: { en: "Request an Audit", zh: "申请工厂审核" } },
      { href: "/rfq", label: { en: "Submit an RFQ", zh: "提交采购需求" } },
    ],
  },
};
