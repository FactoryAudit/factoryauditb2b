// lib/caseStudies.ts — 案例页内容库（Case Studies）
//
// 重要（与 lib/guides.ts、lib/coverage.ts 同原则）：
// 1. 当前没有任何真实客户案例（项目铁律：禁止编造客户/工厂/评价）。
// 2. 本文件内容是 **Illustrative examples（匿名方法示例）**：基于采购方常见场景
//    演示我们的核验 / 验厂 / 验货 / 寻源方法，**不是客户证言**。
// 3. 每页顶部都有全局披露横幅，明确标注非真实客户；Review/Testimonial 结构化数据
//    等真实评价出现后再启用。
// 4. 真实案例产生后（客户许可匿名发布），在本文件追加 illustrative: false 的条目即可。

export type CaseService = "verification" | "audit" | "inspection" | "sourcing";

export interface CaseStudy {
  slug: string;
  service: CaseService;
  titleEn: string;
  titleZh: string;
  metaDescEn: string;
  metaDescZh: string;
  updated: string;
  /** 相关工具（必须用现有 6 个工具 href，避免死链） */
  tools: { href: string }[];
  /** 相关服务（必须用现有服务/页面 href） */
  services: { href: string }[];
  /** 相关指南 slug（必须真实存在） */
  related: string[];
  en: {
    summary: string;
    scenario: string;
    approach: string[];
    result: string;
  };
  zh: {
    summary: string;
    scenario: string;
    approach: string[];
    result: string;
  };
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "trading-company-posing-as-factory",
    service: "verification",
    titleEn: "Trading company posing as a factory",
    titleZh: "贸易公司冒充工厂的核验",
    metaDescEn:
      "Illustrative example: how supplier verification caught a trading company presenting as a factory, and how the buyer re-contracted with the licensed manufacturer before paying a deposit.",
    metaDescZh:
      "方法示例：供应商核验如何识破以贸易公司冒充工厂的情况，以及买家如何在付定金前改与持证制造商签约。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
    ],
    services: [
      { href: "/services/supplier-verification" },
      { href: "/factory-audit/request" },
    ],
    related: ["how-to-verify-a-chinese-supplier", "supplier-risk-assessment-guide"],
    en: {
      summary:
        "A buyer was quoted factory-direct pricing from a company whose English site claimed manufacturing. Verification showed the registered entity was an import-export trader, not a licensed producer.",
      scenario:
        "The buyer found the supplier through a sourcing platform. The English website used the words factory and manufacturer, and the quoted price was below the market rate. The contract was drafted with the trading arm.",
      approach: [
        "Matched the English company name to the Chinese registered name on the business licence.",
        "Checked the business scope: the entity was registered for import and export, with no manufacturing licence.",
        "Confirmed the registered address was an office building, not a production site.",
        "Found a separate licensed manufacturer entity operating at another address, likely the actual production source.",
      ],
      result:
        "The buyer re-contracted with the licensed manufacturer entity, moved the deposit behind a document verification and a follow-up audit, and avoided paying a trading margin on top of factory-direct pricing.",
    },
    zh: {
      summary:
        "买家收到自称工厂直供的报价，核验后发现登记主体是进出口贸易商而非持证生产商，于是改与持证制造商签约。",
      scenario:
        "买家经采购平台找到该供应商。英文网站自称工厂与制造商，报价低于市场价，合同草案是与贸易部门签署的。",
      approach: [
        "把英文公司名与营业执照上的中文注册名核对。",
        "查经营范围：该主体登记为进出口贸易，无生产许可。",
        "确认注册地址是写字楼而非生产场地。",
        "发现另一地址存在独立的持证制造商，才是实际生产来源。",
      ],
      result:
        "买家改与持证制造商签约，把定金放到文件核验与后续验厂之后，并避免了在工厂直供价之上再付一层贸易加成。",
    },
  },

  {
    slug: "legal-entity-mismatch-before-deposit",
    service: "audit",
    titleEn: "Legal entity mismatch found before a deposit",
    titleZh: "定金前发现法律主体错配",
    metaDescEn:
      "Illustrative example: an on-site audit found the certificate belonged to a different legal entity than the one signing the contract, so the buyer re-issued the contract before releasing funds.",
    metaDescZh:
      "方法示例：现场验厂发现证书属于与签约方不同的法律主体，买家在放款前重新签署了合同。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/supplier-document-checker" },
      { href: "/tools/supplier-scorecard" },
    ],
    services: [
      { href: "/factory-audit/request" },
      { href: "/services/supplier-verification" },
    ],
    related: ["factory-audit-checklist", "how-to-read-a-factory-audit-report"],
    en: {
      summary:
        "A high-value order was about to be placed with a trading arm while the quality certificates were held by a parent entity. The on-site audit caught the mismatch before any deposit moved.",
      scenario:
        "The supplier presented ISO and product certificates at the negotiation stage. The contract, however, named a different legal entity within the same group. The buyer booked an on-site audit before releasing a deposit.",
      approach: [
        "Confirmed the legal entity that would sign the contract during the audit walk-through.",
        "Checked the certificate scope: the certificates were issued to the parent entity, not the contracting entity.",
        "Reviewed the production site and confirmed it belonged to the parent factory.",
        "Documented the finding and required the contract to be re-issued to the certified entity.",
      ],
      result:
        "The contract was re-issued to the certified parent entity, the deposit was released against documentary evidence, and the audit finding was closed with no delay to the production schedule.",
    },
    zh: {
      summary:
        "一笔大额订单即将与贸易部门签约，而质量证书由母公司持有。现场验厂在定金放款前拦下了这个错配。",
      scenario:
        "供应商在谈判阶段出示了 ISO 与产品证书，但合同写的是集团内另一个法律主体。买家在放定金前预约了现场验厂。",
      approach: [
        "在验厂走访中确认实际签约的法律主体。",
        "核对证书范围：证书发给了母公司，而非签约主体。",
        "审阅生产场地，确认其归属母公司工厂。",
        "记录该发现，并要求合同改由持证主体签署。",
      ],
      result:
        "合同改由持证母公司签署，定金凭书面证据放款，验厂发现项在未延误排产的情况下关闭。",
    },
  },

  {
    slug: "label-defect-stopped-before-loading",
    service: "inspection",
    titleEn: "Label defect stopped before container loading",
    titleZh: "装柜前拦截标签缺陷",
    metaDescEn:
      "Illustrative example: a pre-shipment inspection caught a critical labelling defect above the AQL threshold, and the batch was reworked before container loading.",
    metaDescZh:
      "方法示例：出货前验货发现超过 AQL 阈值的致命标签缺陷，整批在装柜前返工完成。",
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
    related: ["pre-shipment-inspection-checklist", "how-to-read-a-factory-audit-report"],
    en: {
      summary:
        "A 12,000-unit order was inspected at 90 percent packing. AQL sampling found a critical country-of-origin labelling error above the reject threshold, and the batch was reworked before loading.",
      scenario:
        "The shipment had a tight vessel cut-off. The buyer booked a pre-shipment inspection at 90 percent packing so there was still time to hold or fix the batch.",
      approach: [
        "Agreed the AQL level and sample size before the inspection.",
        "Counted quantity and tested function on the sampled units.",
        "Verified packing and labelling against the purchase order and the market requirement.",
        "Found the country-of-origin mark incorrect on more units than the AQL accept number allowed.",
      ],
      result:
        "The batch was reworked before container loading, re-inspected and passed, and the shipment sailed on schedule instead of being rejected at customs.",
    },
    zh: {
      summary:
        "一批 12,000 件的订单在包装完成 90% 时验货，AQL 抽样发现原产地标识错误超过拒收阈值，整批在装柜前返工。",
      scenario:
        "船期紧张，买家在包装完成 90% 时预约出货前验货，留出拦截或返工的时间。",
      approach: [
        "验货前约定 AQL 等级与样本量。",
        "对抽样单位清点数量并测试功能。",
        "按采购单与市场要求核对包装与标签。",
        "发现原产地标识错误数量超过 AQL 接收数允许的上限。",
      ],
      result:
        "整批在装柜前完成返工并复验通过，货按期上船，而非在海关被拒收。",
    },
  },

  {
    slug: "qualifying-replacement-supplier-vietnam",
    service: "sourcing",
    titleEn: "Qualifying a replacement supplier in Vietnam",
    titleZh: "越南替代供应商的寻源与准入",
    metaDescEn:
      "Illustrative example: how a buyer used an RFQ, registration checks and one on-site audit to qualify a second source in Vietnam when the China supplier hit capacity limits.",
    metaDescZh:
      "方法示例：中国供应商产能受限时，买家如何通过 RFQ、登记核查与一次现场验厂在越南准入第二货源。",
    updated: "2026-08-31",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-scorecard" },
    ],
    services: [
      { href: "/rfq" },
      { href: "/services/vietnam-supplier-verification" },
      { href: "/services/vietnam-factory-audit" },
    ],
    related: ["how-to-audit-a-factory-in-vietnam", "supplier-risk-assessment-guide"],
    en: {
      summary:
        "A buyer needed a second source when the China supplier hit capacity. An RFQ shortlisted three candidates in Vietnam; registration checks and one on-site audit qualified one with documented evidence.",
      scenario:
        "The buyer's single source could not absorb a new order volume. The buyer published an RFQ for the same product, and three Vietnamese factories responded with quotes and certificates.",
      approach: [
        "Compared the three quotes, capacities and certificates side by side.",
        "Confirmed enterprise registration for each candidate and matched the legal entity to the quote.",
        "Ran a supplier risk assessment to score the candidates on the same scale.",
        "Booked one on-site audit for the leading candidate to verify the production site and quality system.",
      ],
      result:
        "One supplier was qualified with verified registration and a clean audit report. The buyer placed an initial order with staged inspections and kept the China source for the rest of the volume.",
    },
    zh: {
      summary:
        "中国供应商产能饱和后，买家需要第二货源。RFQ 入围三家越南工厂，经登记核查与一次现场验厂准入一家有据可查的供应商。",
      scenario:
        "买家单一货源无法承接新订单量，于是为同款产品发出 RFQ，三家越南工厂回复了报价与证书。",
      approach: [
        "并排比较三家报价、产能与证书。",
        "逐一确认候选企业的登记信息，并把法律主体与报价对应。",
        "用供应商风险评估在同一量表上给候选打分。",
        "为首选候选预约一次现场验厂，核实生产场地与质量体系。",
      ],
      result:
        "一家登记信息核实无误且验厂报告干净的供应商获得准入。买家下首单并分阶段验货，其余量仍由中国货源承接。",
    },
  },
];

export function findCaseStudy(slug: string) {
  return CASE_STUDIES.find((c) => c.slug === slug);
}

export const CASE_SERVICE_ORDER: CaseService[] = ["verification", "audit", "inspection", "sourcing"];

/** 列表页与详情页顶部的诚实披露（本项目当前无真实客户案例） */
export const CASE_DISCLOSURE = {
  en: "Illustrative examples based on common buyer scenarios. These are anonymised method walk-throughs, not client testimonials.",
  zh: "以下为基于常见采购场景的匿名方法示例，用于演示工作流程，并非真实客户案例或客户证言。",
};

/** 列表页 meta 描述 */
export const CASE_LIST_META = {
  en: "Supplier verification, factory audit, inspection and sourcing walk-throughs: anonymised illustrative examples that show how we work, not client testimonials.",
  zh: "供应商核验、验厂、验货与寻源的方法示例：脱敏演示我们的工作方式，并非客户证言。",
};
