// lib/fieldReports.ts — 现场记录（Field Reports）
//
// 与 lib/caseStudies.ts 同原则，务必遵守：
// 1. 目前没有可公开的真实现场报告（项目铁律：禁止编造客户 / 工厂 / 评价）。
// 2. 本文件内容是 **Illustrative field notes（脱敏方法示例）**：基于采购方常见的
//    现场情形，演示验货 / 验厂 / 核验时我们会看什么、怎么记录，**不是客户证言**，
//    也不代表任何具体工厂的真实表现。
// 3. 列表页与详情页都要显示全局披露横幅；真实报告取得客户许可后，
//    在本文件追加 illustrative: false 的条目即可。
// 4. 报告里出现的数量为示例数值，用于说明判定方法，不得当作我们的历史业绩。

export type FieldReportService = "inspection" | "audit" | "verification";

export interface FieldReport {
  slug: string;
  service: FieldReportService;
  countryCode: "china" | "vietnam" | "thailand" | "malaysia" | "philippines";
  titleEn: string;
  titleZh: string;
  metaDescEn: string;
  metaDescZh: string;
  updated: string;
  /** 相关工具（必须用现有工具 href，避免死链） */
  tools: { href: string }[];
  /** 相关服务（必须用现有服务/页面 href） */
  services: { href: string }[];
  /** 相关指南 slug（必须真实存在） */
  related: string[];
  en: {
    /** 为什么会有这一趟现场工作 */
    context: string;
    /** 约定的工作范围与方法 */
    assignment: string;
    /** 现场实际看到的情况 */
    observations: string[];
    /** 之后发生了什么 */
    outcome: string;
    /** 给买家的一条可复用经验 */
    takeaway: string;
  };
  zh: {
    context: string;
    assignment: string;
    observations: string[];
    outcome: string;
    takeaway: string;
  };
}

export const FIELD_REPORTS: FieldReport[] = [
  {
    slug: "carton-count-mismatch-at-loading",
    service: "inspection",
    countryCode: "china",
    titleEn: "Carton count short against the packing list at loading",
    titleZh: "装柜时箱数少于装箱单",
    metaDescEn:
      "Illustrative field note: a container loading check where the carton count did not reconcile with the packing list, and what happened before the container was sealed.",
    metaDescZh:
      "脱敏方法示例：装柜监装时发现纸箱数量与装箱单不符，以及在封柜前如何处理。",
    updated: "2026-09-01",
    tools: [
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/supplier-scorecard" },
    ],
    services: [
      { href: "/services/inspection" },
      { href: "/custom-services" },
    ],
    related: ["pre-shipment-inspection-checklist", "how-to-verify-a-chinese-supplier"],
    en: {
      context:
        "A buyer was shipping a mixed container of consumer goods and had not worked with this factory before. They asked for a container loading check rather than a full pre-shipment inspection, because the goods had already been inspected at the factory two weeks earlier.",
      assignment:
        "Attend at the loading point, confirm the truck and container number, reconcile the carton count against the packing list and the shipping marks, photograph each stage of loading, and record the container seal number.",
      observations: [
        "The packing list stated 412 cartons. The count taken during loading reached 388 before the factory stopped bringing cartons out.",
        "Twenty-four cartons were still on the factory floor, unsealed, with labels not yet applied. The factory said they would go on the next shipment.",
        "Cartons loaded first were placed without dunnage against the container wall, which is where moisture staining usually starts on this route.",
        "Shipping marks on the two product lines were similar enough that a mis-sort was easy to make in low light.",
      ],
      outcome:
        "Loading was paused before the doors closed. The buyer was sent the carton count, the photographs and the seal number, and decided to hold the container for the missing 24 cartons rather than accept a part shipment. The paperwork was amended and the container sealed the next morning.",
      takeaway:
        "A loading check is the last point where a quantity problem is still cheap to fix. Reconcile the count at the door, not from the documents.",
    },
    zh: {
      context:
        "一位买家要从一家此前没合作过的工厂发一柜日用消费品。货物两周前已在工厂做过验货，所以买家这次只要求装柜监装，而不是重做一次出货前检验。",
      assignment:
        "到装柜现场，核对车辆与柜号，按装箱单与唛头清点箱数，对装柜各阶段拍照，并记录封条号。",
      observations: [
        "装箱单写 412 箱，实际装到 388 箱时工厂停止继续出货。",
        "另有 24 箱仍在车间地面，未封箱、未贴标。工厂称这批会随下一票出。",
        "最先装入的纸箱未加衬垫、直接贴柜壁，这条航线上水渍通常从这里开始。",
        "两个产品线的唛头相近，在光线不足时很容易混装。",
      ],
      outcome:
        "在关门前暂停装柜。买家收到箱数、照片与封条号后，决定等齐 24 箱再走，不接受分批出货。单证修改后于次日上午封柜。",
      takeaway:
        "装柜是数量问题还便宜的时候就发现的最后机会。在柜门口按实物点箱数，不要只对着单证核。",
    },
  },
  {
    slug: "moisture-in-cartons-before-shipment",
    service: "inspection",
    countryCode: "vietnam",
    titleEn: "Moisture in cartons before a sea shipment",
    titleZh: "海运前纸箱受潮",
    metaDescEn:
      "Illustrative field note: a pre-shipment inspection in a humid season where carton moisture and pallet wrapping did not match the buyer's packaging specification.",
    metaDescZh:
      "脱敏方法示例：潮湿季节的出货前检验，发现纸箱含水率与托盘缠绕方式不符合买家的包装规范。",
    updated: "2026-09-01",
    tools: [
      { href: "/tools/supplier-risk-assessment" },
      { href: "/tools/supplier-document-checker" },
    ],
    services: [{ href: "/services/inspection" }, { href: "/services/supplier-improvement" }],
    related: ["pre-shipment-inspection-checklist", "how-to-audit-a-factory-in-vietnam"],
    en: {
      context:
        "A buyer had two consecutive seasons of mould complaints on a textile order shipped from the south of Vietnam. They asked for a pre-shipment inspection that looked specifically at packaging and moisture control, not only at the product.",
      assignment:
        "Inspect a random sample of cartons against the buyer's packaging specification, measure moisture content where the spec gives a limit, check pallet configuration and stretch wrap, and record how long the finished goods had been held in the warehouse.",
      observations: [
        "Cartons on the bottom two layers of four pallets showed soft corners and a damp feel, consistent with standing water rather than condensation.",
        "Pallets were wrapped to roughly three quarters of their height, leaving the top layer exposed.",
        "The warehouse had no pallet racking in the finished goods area; cartons were stacked directly on a concrete floor in a covered but open-sided bay.",
        "Production records showed the goods had been packed eleven days before the inspection, longer than the buyer's specification allowed.",
      ],
      outcome:
        "The affected pallets were re-packed, the wrapping was corrected to full height, and the buyer added a floor clearance requirement to the packaging specification. The inspection report recorded the moisture readings so the next shipment could be compared against them.",
      takeaway:
        "Mould complaints usually start with how the carton sits in the warehouse, not with the product. Ask what the pallet stands on and how long packed goods wait.",
    },
    zh: {
      context:
        "一位买家从越南南方出的纺织订单，连续两个季节收到发霉投诉。这次买家要求出货前检验不只查产品，专门查包装与防潮。",
      assignment:
        "按买家的包装规范抽检纸箱，对规范中有限值的项目测含水率，检查托盘码放与缠绕膜，并记录成品在仓库的存放时长。",
      observations: [
        "四个托盘最下两层的纸箱边角发软、手感潮湿，更像接触过积水，而不是结露。",
        "缠绕膜只包到托盘约四分之三高度，最上层外露。",
        "成品区没有货架，纸箱直接码在有顶但侧面敞开的混凝土地面上。",
        "生产记录显示货物在检验前 11 天已装箱，超出买家规范允许的存放时长。",
      ],
      outcome:
        "受影响的托盘重新装箱，缠绕膜改为全高包裹；买家在包装规范中新增了离地要求。检验报告记录了含水率读数，便于与下一票对比。",
      takeaway:
        "发霉投诉通常源于纸箱在仓库里怎么放，而不是产品本身。要问托盘放在什么上面、装箱后货等多久。",
    },
  },
  {
    slug: "shared-building-fire-exits",
    service: "audit",
    countryCode: "china",
    titleEn: "Fire exits in a shared factory building",
    titleZh: "共用厂房的消防通道",
    metaDescEn:
      "Illustrative field note: a social compliance audit where the supplier occupied two floors of a shared building, and the exit routes were not under the supplier's sole control.",
    metaDescZh:
      "脱敏方法示例：社会责任审核中，供应商只占共用厂房的两层，疏散通道并非由其单独管理。",
    updated: "2026-09-01",
    tools: [
      { href: "/tools/audit-checklist" },
      { href: "/tools/audit-report-analyzer" },
    ],
    services: [{ href: "/factory-audit/request" }, { href: "/services/supplier-improvement" }],
    related: ["factory-audit-checklist", "how-to-read-a-factory-audit-report"],
    en: {
      context:
        "A buyer required a social compliance audit before onboarding a components supplier. The supplier's address on the business licence matched the site, but the building turned out to be shared with two other companies.",
      assignment:
        "Assess working hours and wage records, health and safety conditions, and emergency preparedness, against the buyer's code of conduct. Report findings by severity, with an owner and a date for each corrective action.",
      observations: [
        "The supplier occupied the second and third floors. The stairwell exit on the third floor was partly blocked by raw material stored by a company on another floor.",
        "The supplier's own floor exits were clear and signage was present, but the evacuation route beyond the supplier's area was maintained by the building owner.",
        "Wage records were complete for the preceding twelve months and matched the production records sampled.",
        "Fire drill records existed for two of the four quarters; the two missing drills were during the supplier's peak season.",
      ],
      outcome:
        "The blocked exit was raised as a major finding, with the building owner named as the responsible party and the supplier as the party that has to escalate it. The buyer accepted a corrective plan on the condition that the supplier provide written confirmation from the building owner within thirty days.",
      takeaway:
        "In a shared building, a supplier can be compliant on its own floor and still be unable to guarantee the route out. Ask who controls the exit, not just whether the exit exists.",
    },
    zh: {
      context:
        "买家在导入一家零部件供应商前要求做社会责任审核。供应商营业执照上的地址与现场一致，但该厂房实际与另外两家公司共用。",
      assignment:
        "按买家行为准则，评估工时与工资记录、健康安全条件、应急准备。按严重度分级记录发现项，每项纠正措施都写明责任人与期限。",
      observations: [
        "供应商使用二、三层。三层楼梯间疏散口被另一家公司堆放的原材料部分占用。",
        "供应商自己楼层内的通道畅通、标识齐全，但其区域以外的疏散路由业主维护。",
        "近十二个月工资记录完整，且与抽样的生产记录一致。",
        "消防演练记录四个季度中只有两个季度；缺失的两次正值供应商旺季。",
      ],
      outcome:
        "通道被占用列为重要发现项，责任方记为业主、由供应商负责推动。买家接受纠正计划，条件是供应商在 30 天内提供业主的书面确认。",
      takeaway:
        "在共用厂房里，供应商自己楼层合规，也不等于能保证疏散路线畅通。要问通道由谁管，而不只是有没有通道。",
    },
  },
  {
    slug: "undisclosed-subcontracted-process",
    service: "verification",
    countryCode: "thailand",
    titleEn: "A key process was subcontracted and not disclosed",
    titleZh: "关键工序外包且未披露",
    metaDescEn:
      "Illustrative field note: a verification where the supplier's claimed in-house surface treatment was carried out at another site the buyer had not been told about.",
    metaDescZh:
      "脱敏方法示例：核验中发现供应商声称自有的表面处理工序，实际在买家未被告知的另一处场地完成。",
    updated: "2026-09-01",
    tools: [
      { href: "/tools/supplier-risk-calculator" },
      { href: "/tools/supplier-verification-checklist" },
      { href: "/tools/compare" },
    ],
    services: [{ href: "/services/supplier-verification" }, { href: "/monitoring" }],
    related: ["how-to-verify-a-chinese-supplier", "supplier-risk-assessment-guide"],
    en: {
      context:
        "A buyer was qualifying a metal parts supplier who stated that all processes including surface treatment were done in-house. The buyer wanted that claim checked before placing a first order.",
      assignment:
        "Confirm the registered address is the production site, review the business licence scope against the processes claimed, walk the production floor end to end, and check whether any process leaves the site.",
      observations: [
        "Machining, assembly and packing were on site and consistent with the equipment list provided.",
        "There was no surface treatment line on site. Staff described the parts being collected twice a week and returned finished.",
        "The business licence scope covered manufacturing and sale of the parts, not the surface treatment process.",
        "The supplier named the subcontractor when asked directly, but had not mentioned it in the quotation or the capability list.",
      ],
      outcome:
        "The verification report recorded the subcontracted process as a fact, named the subcontractor, and stated that the buyer had not been told about it before the check. The buyer placed a reduced first order and added a written disclosure requirement for any process carried out off site.",
      takeaway:
        "In-house claims are the ones worth walking. If a process has no equipment on the floor, it happens somewhere else, and you should know where.",
    },
    zh: {
      context:
        "一位买家正在评审一家金属件供应商，对方称包括表面处理在内的全部工序均为自有。买家希望在下首单前核实这一说法。",
      assignment:
        "确认注册地址即生产地址，核对营业执照经营范围与所声称工序，走通整条生产线，确认是否有工序外发。",
      observations: [
        "机加工、装配、包装均在现场，与提供的设备清单一致。",
        "现场没有表面处理线。员工描述零件每周被运走两次、加工完再送回。",
        "营业执照经营范围覆盖该零件的生产与销售，不含表面处理工序。",
        "被直接问到时，供应商说出了外协厂名称，但报价与产能表中均未提及。",
      ],
      outcome:
        "核验报告把工序外发作为事实记录，写明外协厂名称，并注明买家在本次核查前未被告知。买家缩减首单数量，并新增要求：任何在场外完成的工序均须书面披露。",
      takeaway:
        "「自有工序」这类说法最值得走一遍现场。如果某个工序在车间里没有对应设备，它就发生在别处，你应该知道是哪里。",
    },
  },
];

export function findFieldReport(slug: string): FieldReport | undefined {
  return FIELD_REPORTS.find((r) => r.slug === slug);
}

/** 列表页/详情页顶部必须展示的全局披露（与 caseStudies 同一口径） */
export const FIELD_REPORT_DISCLOSURE = {
  en: "Illustrative field notes based on common on-site situations. These are anonymised examples of what we look for and how we record it, not reports on real named factories and not client testimonials.",
  zh: "以下为基于常见现场情形的脱敏方法示例，用于说明我们现场看什么、怎么记录，既不是对具体工厂的报告，也不是客户证言。",
};

/** 列表页 meta 描述 */
export const FIELD_REPORT_LIST_META = {
  en: "Field notes from inspection, audit and verification work: anonymised illustrative examples of what gets checked on site and how findings are recorded.",
  zh: "来自验货、验厂与核验现场的脱敏方法示例：现场查什么、发现项怎么记录。",
};

/** 详情页分段标题。en/zh 手写，其余语言回退英文（与 CASE_SECTIONS 同模式）。 */
export const FIELD_REPORT_SECTIONS = {
  en: {
    context: "Context",
    assignment: "Assignment",
    observations: "Observations",
    outcome: "Outcome",
    takeaway: "Takeaway",
    relatedGuides: "Related guides",
    relatedTools: "Related tools",
  },
  zh: {
    context: "背景",
    assignment: "工作范围",
    observations: "现场发现",
    outcome: "后续处理",
    takeaway: "可复用经验",
    relatedGuides: "相关指南",
    relatedTools: "相关工具",
  },
};
