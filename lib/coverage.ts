// lib/coverage.ts — Phase 1 服务覆盖内容（中国 / 越南 / 泰国）
//
// 为什么单独放数据而不是塞进字典：
// 1. 每个国家的制造画像、风险、核查要点都是长篇差异化内容，塞进 9 份字典会失控；
// 2. 内容是「事实型编辑内容」，跟随国家而不是跟随页面组件；
// 3. en / zh 手写保证质量，其余语言回退英文（宁可英文也不显示空翻译或机翻噪声）。
//
// 重要：新增国家必须写真实差异内容。禁止把 China 复制成 Vietnam 只改国名。

export type CoverageServiceCode = "verification" | "audit";

export interface CoverageContent {
  /** 一句话定位，用于列表页与卡片 */
  hook: string;
  /** 制造画像 */
  profile: string;
  /** 该国的 sourcing 典型风险 */
  risks: string[];
  /** 供应商核查时在这个国家要特别注意的点 */
  verificationNotes: string[];
  /** 验厂时在这个国家要特别注意的点 */
  auditNotes: string[];
  /** 主要产业带 / 城市 */
  hubs: string[];
  /** 相关行业 */
  industries: string[];
  /** 物流注意事项 */
  logistics: string;
  /** 常见标准 */
  standards: string[];
  /** 核查时能拿到的官方文件来源 */
  registry: string;
  /** 国家页 FAQ（国家层面的问题） */
  faq: { q: string; a: string }[];
}

export interface CoverageCountry {
  code: string;
  name: string;
  nameZh: string;
  slug: string;
  /** 该国页的 meta 描述 */
  metaDesc: string;
  en: CoverageContent;
  zh: CoverageContent;
}

export const COVERAGE_COUNTRIES: CoverageCountry[] = [
  {
    code: "china",
    name: "China",
    nameZh: "中国",
    slug: "china",
    metaDesc:
      "Supplier verification and factory audit in China. Check business registration, confirm the production site, review quality and compliance records, then order an on-site audit before you pay a deposit.",
    en: {
      hook:
        "The deepest component supply base in Asia, and the easiest country to check a company's paperwork in.",
      profile:
        "China still holds the widest manufacturing base in Asia. Export production clusters into three belts: the Pearl River Delta around Shenzhen, Dongguan and Guangzhou for electronics and consumer goods, the Yangtze River Delta around Shanghai, Ningbo and Suzhou for machinery, textiles and auto parts, and inland hubs such as Chengdu and Chongqing that have grown on lower labour cost. Company records are public through the National Enterprise Credit Information Publicity System, which makes the first identity check fast and cheap.",
      risks: [
        "Trading companies presenting themselves as the factory. This is the single most common finding.",
        "The registered address on the business licence is an office, not the production site.",
        "Peak-season subcontracting that was never disclosed, usually into smaller workshops with thinner quality control.",
        "Certificates issued to a parent or group entity rather than the entity that will sign your contract.",
        "Capacity quoted for the whole group rather than the plant that will actually run your order.",
      ],
      verificationNotes: [
        "Match the English trading name to the Chinese registered name on the business licence. They are frequently different, and the contract should carry the registered entity.",
        "Check the 18-digit Unified Social Credit Code rather than an old registration number.",
        "Confirm the registered address against the production address. When they differ, ask which one the order will ship from.",
        "Check whether export is handled through a separate trading entity, because that entity is the one that appears on your invoice.",
      ],
      auditNotes: [
        "Social compliance audits such as BSCI, SMETA and SA8000 are well established here. Most export plants have been audited before and know the process.",
        "Ask for the previous audit report and the corrective action plan. A plant that cannot produce either has usually not been audited recently.",
        "Product testing is straightforward through local laboratories with recognised accreditation.",
        "Be specific about which entity and which building is in scope. Larger groups will sometimes show the newer plant and ship from the older one.",
      ],
      hubs: [
        "Shenzhen and Dongguan: electronics, PCBA, consumer goods",
        "Guangzhou and Foshan: furniture, apparel, building materials",
        "Ningbo and Hangzhou: hardware, auto parts, textiles",
        "Shanghai and Suzhou: machinery, precision components",
        "Yiwu: small commodities and general merchandise",
      ],
      industries: [
        "Electronics",
        "Textiles and apparel",
        "Furniture",
        "Machinery",
        "Plastics",
        "Toys",
        "Home appliances",
      ],
      logistics:
        "Shenzhen Yantian, Ningbo-Zhoushan and Shanghai handle most export volume. Inland factories add two to five days of trucking before the container reaches port. Bookings tighten from August to October for the Christmas season, and again before Chinese New Year when production stops for one to three weeks.",
      standards: [
        "ISO 9001",
        "ISO 14001",
        "BSCI",
        "SMETA",
        "SA8000",
        "GB national standards",
        "CCC where the product category requires it",
      ],
      registry:
        "National Enterprise Credit Information Publicity System (gsxt.gov.cn), searchable by company name or Unified Social Credit Code.",
      faq: [
        {
          q: "How do I check whether a Chinese supplier is a real factory?",
          a: "Start with the business licence. Match the Chinese registered name to the English name you were given, check the Unified Social Credit Code, then compare the registered address with the production address. If they differ, ask which site your order will run on. After that, ask for the business scope on the licence: manufacturers list production, trading companies list wholesale and retail only.",
        },
        {
          q: "Can you verify a supplier without visiting the factory?",
          a: "Yes. A documentary verification confirms the registration, the legal entity, the site address, export records and available certificates from public and third-party sources. It will not confirm that the production equipment exists or that the quality system is running. That requires a site visit or an audit.",
        },
        {
          q: "How long does a China factory audit take?",
          a: "A one-man-day audit covers a single site and is usually scheduled within a week. Larger sites or multi-day audits such as a full SMETA need more lead time. The report typically follows within two business days of the visit.",
        },
        {
          q: "Do you cover regions outside the main manufacturing belts?",
          a: "Yes. We work in the inland hubs including Chengdu, Chongqing, Wuhan and Xi'an. Travel adds cost and a little lead time compared with the coastal belts.",
        },
      ],
    },
    zh: {
      hook: "亚洲最完整的零部件供应体系，也是公司资质最容易核查的国家。",
      profile:
        "中国仍是亚洲制造门类最全的国家。出口产能集中在三条带：深圳、东莞、广州所在的珠三角做电子与消费品；上海、宁波、苏州所在的长三角做机械、纺织与汽车零部件；成都、重庆等内陆枢纽靠更低的人工成本承接了转移产能。企业登记信息可通过国家企业信用信息公示系统公开查询，因此 identity 核查又快又便宜。",
      risks: [
        "贸易公司自称工厂。这是最常见的发现。",
        "营业执照上的注册地址是办公室，不是生产地址。",
        "旺季未经披露的外发加工，通常流向质控更弱的小作坊。",
        "证书挂在集团母公司名下，而不是与你签合同的法律实体。",
        "产能按整个集团报，而不是按真正会跑你订单的那个厂区报。",
      ],
      verificationNotes: [
        "把对方给的英文名与营业执照上的中文注册名对上。两者经常不一致，合同应写注册实体。",
        "核对 18 位统一社会信用代码，而不是旧的注册号。",
        "把注册地址与生产地址对照。不一致时，问清楚订单从哪个地址出货。",
        "确认出口是否通过独立的贸易主体操作，因为发票上出现的是那个主体。",
      ],
      auditNotes: [
        "BSCI、SMETA、SA8000 这类社会责任审核在中国已经很成熟，多数出口工厂都审过、也熟悉流程。",
        "索要上一次审核报告和整改计划。拿不出这两样的工厂通常近期没被审过。",
        "产品测试很好安排，本地有具备资质的实验室。",
        "把审核范围限定到具体的法律实体和具体的厂房。大集团有时会带你参观新厂区，实际从老厂区出货。",
      ],
      hubs: [
        "深圳、东莞：电子、PCBA、消费品",
        "广州、佛山：家具、服装、建材",
        "宁波、杭州：五金、汽车零部件、纺织",
        "上海、苏州：机械、精密零件",
        "义乌：小商品与日用杂货",
      ],
      industries: [
        "电子",
        "纺织服装",
        "家具",
        "机械",
        "塑料",
        "玩具",
        "家用电器",
      ],
      logistics:
        "出口以深圳盐田、宁波舟山、上海三大港为主。内陆工厂运到港口需要额外两到五天卡车时间。8 月至 10 月的圣诞旺季舱位紧张，春节前也紧张，春节期间工厂停工一到三周。",
      standards: [
        "ISO 9001",
        "ISO 14001",
        "BSCI",
        "SMETA",
        "SA8000",
        "GB 国标",
        "部分品类需要 CCC 认证",
      ],
      registry: "国家企业信用信息公示系统（gsxt.gov.cn），可按企业名称或统一社会信用代码查询。",
      faq: [
        {
          q: "怎么判断中国供应商是不是真工厂？",
          a: "从营业执照开始。把对方给的英文名与中文注册名对上，核对统一社会信用代码，再比较注册地址与生产地址。两者不一致时，问清楚订单在哪个厂区生产。然后看执照上的经营范围：工厂会写生产制造，贸易公司只写批发零售。",
        },
        {
          q: "不去工厂能不能做核查？",
          a: "可以。文件核查会通过官方与第三方数据源确认注册信息、法律实体、厂区地址、出口记录和已有证书。但它无法确认设备是否真实存在、质量体系是否在运行，这需要现场走访或正式验厂。",
        },
        {
          q: "中国验厂需要多久？",
          a: "一个人天的审核覆盖单个厂区，通常一周内可以排期。厂区较大或需要多日审核（例如完整 SMETA）则需要更长前置时间。报告一般在走访后两个工作日内出具。",
        },
        {
          q: "主要制造带之外的地区你们覆盖吗？",
          a: "覆盖。成都、重庆、武汉、西安等内陆枢纽都可以做。相比沿海，差旅会增加一些成本和排期时间。",
        },
      ],
    },
  },
  {
    code: "vietnam",
    name: "Vietnam",
    nameZh: "越南",
    slug: "vietnam",
    metaDesc:
      "Supplier verification and factory audit in Vietnam. Confirm business and investment registration, check the real production site, review quality and social compliance records, then order an on-site audit.",
    en: {
      hook:
        "Capacity has grown fast since 2018. The equipment is often new, and the quality systems are often newer than the equipment.",
      profile:
        "Vietnamese export manufacturing splits north and south. The north, around Hanoi and Hai Phong, is dominated by electronics assembly built around the large Korean investment supply chains. The south, around Ho Chi Minh City, Binh Duong and Dong Nai, carries garments, footwear and furniture. Much of the machinery is recent and a large share of plants are foreign-invested, with Korean, Taiwanese, Chinese and Japanese ownership common.",
      risks: [
        "Quality systems are newer and thinner than in comparable Chinese plants. Many were built in the last five years.",
        "The factory you visit may depend on imported components with long lead times, which makes the quoted delivery date optimistic.",
        "Subcontracting to smaller local workshops is common in garments and footwear, particularly for washing, embroidery and finishing.",
        "Business records exist but are less complete online than China's, so identity checks take longer.",
        "Summer electricity constraints in the north can interrupt production schedules.",
      ],
      verificationNotes: [
        "Vietnamese entities hold two documents: the Business Registration Certificate and, for foreign-invested firms, the Investment Registration Certificate. Ask for both.",
        "Check the registered address against the production site. Foreign-invested firms frequently split the two across different provinces.",
        "Confirm who owns the machinery. A plant that leases its key equipment has less control over its own schedule than one that owns it.",
        "Ask which entity signs the export contract and which entity holds the export licence.",
      ],
      auditNotes: [
        "Social compliance experience is widespread in garments and footwear. WRAP, BSCI and SMETA audits are routine in the south.",
        "Quality system maturity varies far more than in China. Plan a longer first audit and expect to spend time on records that may not exist yet.",
        "English documentation is often thinner than the Chinese equivalent. Ask for Vietnamese originals where the English version looks simplified.",
        "Auditor availability in the north is tighter than the south, so schedule earlier.",
      ],
      hubs: [
        "Hanoi and Hai Phong: electronics assembly, components",
        "Bac Ninh and Thai Nguyen: electronics, Samsung supply chain",
        "Ho Chi Minh City: garments, footwear, light manufacturing",
        "Binh Duong and Dong Nai: furniture, footwear, wood products",
        "Da Nang: garments and seafood processing",
      ],
      industries: [
        "Textiles and garments",
        "Footwear",
        "Furniture",
        "Electronics assembly",
        "Food and seafood processing",
      ],
      logistics:
        "Hai Phong serves the north and Cat Lai or Cai Mep serves the south. Cat Lai congests during peak season and truck queues are common. Road infrastructure is improving but transit times remain less predictable than coastal China, so build buffer into your booking.",
      standards: [
        "ISO 9001",
        "ISO 14001",
        "BSCI",
        "SMETA",
        "WRAP",
        "SA8000",
        "HACCP for food processing",
      ],
      registry:
        "National Business Registration Portal (dangkykinhdoanh.gov.vn), plus the provincial Department of Planning and Investment for investment certificates.",
      faq: [
        {
          q: "Why do Vietnamese factories need two registration documents?",
          a: "A domestic company holds a Business Registration Certificate. A foreign-invested company also holds an Investment Registration Certificate that records the project, the capital and the investor. Both are relevant when you check who owns the plant and what it is licensed to produce.",
        },
        {
          q: "Is Vietnam cheaper than China?",
          a: "On direct labour, often yes. On total landed cost, frequently not. Vietnamese plants import more components, so lead times are longer and inventory carrying cost is higher. Yield on a new production line is usually lower for the first few months. Run the comparison on landed cost, not on the unit price in the quote.",
        },
        {
          q: "How common is undisclosed subcontracting in Vietnam?",
          a: "Common in garments and footwear, especially for processes the main plant does not hold in-house, such as washing, embroidery, printing and finishing. Ask directly which processes leave the site and get the subcontractor names in writing.",
        },
        {
          q: "Can you audit in the north and the south?",
          a: "Yes. Both regions are covered. Auditor capacity is tighter around Hanoi and Bac Ninh than around Ho Chi Minh City, so allow more notice for northern sites.",
        },
      ],
    },
    zh: {
      hook: "2018 年以来产能扩张很快。设备往往是新的，质量体系往往比设备更新。",
      profile:
        "越南出口制造分为南北两块。北部以河内、海防为中心，主要是围绕韩国大型投资形成的电子组装产业链；南部以胡志明市、平阳、同奈为中心，承载服装、鞋类和家具。设备普遍较新，外资工厂占比高，韩国、中国台湾、中国大陆和日本资本都很常见。",
      risks: [
        "质量体系比同等规模的中国工厂更薄，很多是近五年才建立的。",
        "你参观的工厂可能依赖进口零部件，交期被乐观估计。",
        "服装和鞋类行业普遍外发给本地小作坊，尤其是水洗、绣花和后整理环节。",
        "工商登记信息存在，但线上完整度不如中国，身份核查耗时更长。",
        "北部夏季电力紧张可能打断生产计划。",
      ],
      verificationNotes: [
        "越南企业有两份文件：商业登记证（ERC），外资企业还有投资登记证（IRC）。两份都要。",
        "把注册地址与生产地址对照。外资企业经常把两者分设在不同省份。",
        "确认关键设备的归属。租赁设备的工厂对自身排期的控制力弱于自有设备的工厂。",
        "问清楚哪个主体签出口合同、哪个主体持有出口资质。",
      ],
      auditNotes: [
        "服装和鞋类行业的社会责任审核经验很普遍，南部的 WRAP、BSCI、SMETA 审核是常规操作。",
        "质量体系成熟度差异远大于中国。首次审核预留更长时间，也要做好某些记录尚不存在的准备。",
        "英文文件通常比中国同行简略。英文版本看起来被简化时，索要越南语原件。",
        "北部审核员资源比南部紧张，需要更早排期。",
      ],
      hubs: [
        "河内、海防：电子组装、零部件",
        "北宁、太原：电子，三星供应链",
        "胡志明市：服装、鞋类、轻工",
        "平阳、同奈：家具、鞋类、木制品",
        "岘港：服装与海产加工",
      ],
      industries: ["纺织服装", "鞋类", "家具", "电子组装", "食品与海产加工"],
      logistics:
        "北部走海防港，南部走 Cat Lai 或 Cai Mep。旺季 Cat Lai 拥堵、卡车排队常见。道路基础设施在改善，但运输时效仍不如中国沿海稳定，订舱时要留缓冲。",
      standards: [
        "ISO 9001",
        "ISO 14001",
        "BSCI",
        "SMETA",
        "WRAP",
        "SA8000",
        "食品加工 HACCP",
      ],
      registry: "国家商业登记门户（dangkykinhdoanh.gov.vn），投资证书需查询省级计划投资厅。",
      faq: [
        {
          q: "为什么越南工厂需要两份登记文件？",
          a: "本土企业持有商业登记证（ERC）。外资企业还持有投资登记证（IRC），记录项目内容、注册资本和投资人。核查工厂归属与许可生产范围时，两份都有用。",
        },
        {
          q: "越南比中国便宜吗？",
          a: "直接人工通常便宜，总到岸成本往往不便宜。越南工厂进口零部件更多，交期更长、资金占用更高，新产线前几个月的良率通常偏低。用总到岸成本比较，不要只比报价单价。",
        },
        {
          q: "越南未披露的外发加工常见吗？",
          a: "服装和鞋类行业很常见，尤其是主厂不具备的工序，例如水洗、绣花、印花和后整理。直接问哪些工序会离开厂区，并要求书面列出外发厂名称。",
        },
        {
          q: "南北都能审吗？",
          a: "都能。两个区域都覆盖。河内、北宁一带的审核员资源比胡志明市周边紧张，北部厂区需要更早预约。",
        },
      ],
    },
  },
  {
    code: "thailand",
    name: "Thailand",
    nameZh: "泰国",
    slug: "thailand",
    metaDesc:
      "Supplier verification and factory audit in Thailand. Confirm the company affidavit and shareholder list, check the factory licence, review IATF, ISO and food safety records, then order an on-site audit.",
    en: {
      hook:
        "The most industrialised manufacturing base in Southeast Asia, with the certification depth to match, and a price that is rarely the cheapest.",
      profile:
        "Thailand has the deepest industrial base in Southeast Asia. The Eastern Seaboard around Rayong and Chonburi carries automotive assembly, petrochemicals and hard disk drive production. The Bangkok metro area and Ayutthaya host electronics, auto parts and food processing. Thai plants tend to be larger and more capital-intensive than their neighbours, and certification coverage is consistently high.",
      risks: [
        "Labour and land cost are higher than Vietnam, so the quote usually is not the lowest one on your desk.",
        "Automotive supply chains run deep. Tier 2 and Tier 3 subcontracting is normal and not always disclosed to the buyer at the end of the chain.",
        "Board of Investment promoted entities often sit within a group of affiliates, which makes the contracting entity harder to pin down.",
        "Flood season from September to November affects the central plain and can disrupt inland trucking.",
        "Migrant labour recruitment is the area where social compliance findings most often sit.",
      ],
      verificationNotes: [
        "Ask for the company affidavit from the Department of Business Development and read the shareholder list, not just the company name.",
        "Distinguish the Board of Investment promoted entity from its affiliates. The promoted entity is not always the one that will manufacture your product.",
        "Check the factory licence, known locally as Ror Ngor 4, for the actual production site.",
        "Confirm whether the plant holds its own export documentation or routes through a group trading arm.",
      ],
      auditNotes: [
        "Automotive buyers usually require IATF 16949 or a VDA 6.3 process audit. Thai automotive suppliers generally hold them already.",
        "Food plants generally hold HACCP or FSSC 22000. Check the certificate scope covers your product category.",
        "Audit readiness is typically high, which means a clean report is a weaker signal here than it would be elsewhere. Look at the evidence behind each answer.",
        "Spend audit time on labour recruitment practices and working hours, which is where findings concentrate.",
      ],
      hubs: [
        "Rayong and Chonburi: automotive, petrochemicals, HDD",
        "Bangkok metro: electronics, auto parts, food processing",
        "Ayutthaya and Pathum Thani: auto parts, electronics, appliances",
        "Samut Prakan and Samut Sakhon: food processing, seafood",
        "Chiang Mai and Lampang: ceramics, handicrafts, furniture",
      ],
      industries: [
        "Automotive and auto parts",
        "Electronics",
        "Food processing",
        "Plastics and packaging",
        "Rubber products",
      ],
      logistics:
        "Laem Chabang is the main deep-sea port and handles most container volume. Bangkok Port serves barge and feeder traffic. Road links into Malaysia and Laos are good, and the Eastern Economic Corridor has improved inland access. Flood season between September and November can slow trucking on the central plain.",
      standards: [
        "IATF 16949",
        "ISO 9001",
        "ISO 14001",
        "HACCP and FSSC 22000",
        "BSCI",
        "SMETA",
        "TISI marks where applicable",
      ],
      registry:
        "Department of Business Development, Ministry of Commerce, for the company affidavit and shareholder list.",
      faq: [
        {
          q: "Why is Thailand usually more expensive than Vietnam?",
          a: "Higher wages, higher land cost, and a larger share of value added locally rather than imported. The comparison that matters is defect rate and delivery reliability against your total landed cost, not the ex-works unit price. Thai plants generally score better on both.",
        },
        {
          q: "What is a Ror Ngor 4 licence?",
          a: "The Thai factory operating licence issued under the Factory Act. It records the permitted activity and the licensed site. A company can hold a factory licence for one location and operate additional unlicensed sites, so check that the licence covers the address you will be shipping from.",
        },
        {
          q: "Do Thai suppliers need a social compliance audit?",
          a: "It depends on your buyer and your market. Automotive and electronics programmes usually require it through your own supply chain requirements. Garment and food buyers commonly ask for BSCI or SMETA. Where it is required, focus the audit on migrant labour recruitment fees and working hour records.",
        },
        {
          q: "How far down the supply chain can you check?",
          a: "We audit the site you name and, where the programme requires it, the disclosed Tier 2 suppliers feeding it. We cannot chase undeclared subcontractors without names, which is why asking for the subcontractor list in writing is part of the verification scope.",
        },
      ],
    },
    zh: {
      hook: "东南亚工业化程度最高的制造基地，认证覆盖同样深厚，但报价很少是最低的。",
      profile:
        "泰国拥有东南亚最深厚的工业基础。罗勇、春武里所在的东部海岸集中了汽车整车、石化和硬盘驱动器产业；曼谷都市圈与大城府承载电子、汽车零部件和食品加工。泰国工厂通常比邻国规模更大、资本更密集，认证覆盖率也一直很高。",
      risks: [
        "人工和土地成本高于越南，报价通常不是桌上最低的那个。",
        "汽车供应链层级很深。二级三级外发属常态，链条末端的买家不一定知情。",
        "投资促进委员会（BOI）优惠企业常与关联公司同属一个集团，签约主体较难锁定。",
        "9 月至 11 月的雨季洪水影响中部平原，可能打乱内陆运输。",
        "外籍劳工招聘是社会责任审核问题最集中的地方。",
      ],
      verificationNotes: [
        "索取商业发展厅出具的公司注册证明书，并阅读股东名单，而不只看公司名称。",
        "区分 BOI 优惠主体与其关联公司。享受优惠的主体不一定就是实际生产你产品的那个。",
        "核查工厂许可证（当地称 Ror Ngor 4）对应的实际生产地址。",
        "确认工厂是自行办理出口单证，还是通过集团贸易公司出口。",
      ],
      auditNotes: [
        "汽车行业买家通常要求 IATF 16949 或 VDA 6.3 过程审核，泰国汽车零部件供应商大多已经持有。",
        "食品工厂通常持有 HACCP 或 FSSC 22000。核查证书范围是否覆盖你的产品品类。",
        "审核准备度普遍较高，所以这里一份干净的报告信号强度反而更低。要看每个答案背后的证据。",
        "把审核时间花在劳工招聘做法和工时记录上，问题集中在这里。",
      ],
      hubs: [
        "罗勇、春武里：汽车、石化、硬盘",
        "曼谷都市圈：电子、汽车零部件、食品加工",
        "大城府、巴吞他尼：汽车零部件、电子、家电",
        "北榄、龙仔厝：食品加工、海产",
        "清迈、南邦：陶瓷、手工艺、家具",
      ],
      industries: ["汽车与零部件", "电子", "食品加工", "塑料与包装", "橡胶制品"],
      logistics:
        "林查班是主要深水港，承担大部分集装箱吞吐量。曼谷港负责驳船与支线运输。通往马来西亚和老挝的公路条件良好，东部经济走廊改善了内陆通达性。9 月至 11 月雨季洪水会拖慢中部平原的卡车运输。",
      standards: [
        "IATF 16949",
        "ISO 9001",
        "ISO 14001",
        "HACCP 与 FSSC 22000",
        "BSCI",
        "SMETA",
        "适用的 TISI 标志",
      ],
      registry: "商业部商业发展厅，可查询公司注册证明书与股东名单。",
      faq: [
        {
          q: "为什么泰国通常比越南贵？",
          a: "工资更高、土地更贵，本地增值比例更高而不是靠进口零部件。值得比较的是不良率和交付可靠性相对总到岸成本的表现，而不是出厂单价。泰国工厂在这两项上通常更好。",
        },
        {
          q: "什么是 Ror Ngor 4 许可证？",
          a: "依据泰国《工厂法》核发的工厂运营许可证，记录许可的生产活动与许可场地。一家公司可能只为其中一个地址持有许可证，同时在其他未持证场地生产，所以要确认许可证覆盖你实际出货的地址。",
        },
        {
          q: "泰国供应商需要做社会责任审核吗？",
          a: "取决于你的买家和目标市场。汽车和电子项目通常通过供应链要求强制要求；服装和食品买家常要求 BSCI 或 SMETA。需要做时，把审核重点放在外籍劳工招聘费和工时记录上。",
        },
        {
          q: "供应链能往下游查到几级？",
          a: "我们审核你指定的厂区；如果项目要求，一并审核已披露的二级供应商。没有名称的情况下我们无法追查未申报的外发厂，所以要求书面提供外发清单属于核查范围的一部分。",
        },
      ],
    },
},
{
  code: "malaysia",
  name: "Malaysia",
  nameZh: "马来西亚",
  slug: "malaysia",
  metaDesc:
    "Supplier verification and factory audit in Malaysia. Confirm SSM registration, verify factory location in Penang or Selangor, review quality and social compliance records, and book an on-site audit before placing a high-value order.",
  en: {
    hook:
      "Penang runs one of the most concentrated electronics manufacturing bases outside Shenzhen, with strong systems, English documentation, and a deep multinational supplier tree.",
    profile:
      "Malaysia's export manufacturing concentrates in two corridors. Penang and Kulim in the north host electronics assembly, semiconductor backend, hard disk drive production, medical devices and automation; Selangor, Johor and the federal territory around Kuala Lumpur carry automotive components, oleochemicals and palm oil derivatives, rubber products and halal food processing. Many plants are foreign-invested and run on English documentation. SSM (Suruhanjaya Syarikat Malaysia) registration records are searchable online.",
    risks: [
      "Tier 2 and Tier 3 subcontracting is normal in the electronics corridor. The plant you visit is rarely the only plant in the chain.",
      "Free trade zone (FTZ) status at Penang and Johor changes how export is handled and who the legal exporter of record is.",
      "Migrant labour from Indonesia, Bangladesh, Nepal and Myanmar is common in manufacturing and is the area where social compliance findings most often sit.",
      "Halal and medical device plants carry sector-specific licensing that has to be in scope.",
      "Capacity quotes for a group are easy to confuse with capacity for the plant you actually audit.",
    ],
    verificationNotes: [
      "Pull the SSM company search (ssm.com.my) and confirm the company name, registration number and director list.",
      "Check whether the entity holds a manufacturing licence from MITI for the relevant sector; some industries require it.",
      "For FTZ plants, confirm the operator and the licensed zone separately. The FTZ entity is not always the exporter of record.",
      "Ask for the MyCRS (Malaysia Customs) approval if the plant is claiming preferential origin under ATIGA or RCEP.",
    ],
    auditNotes: [
      "SMETA, BSCI, SA8000, WRAP experience is well established at Penang and Selangor electronics plants.",
      "Halal food plants commonly hold JAKIM/MS 1500. Confirm scope before relying on a third-party halal cert.",
      "IATF 16949 coverage is mature for the automotive parts cluster.",
      "Working hours and recruitment fees for migrant labour are the parts of the audit that move the score the most.",
    ],
    hubs: [
      "Penang and Kulim: electronics assembly, semiconductor backend, hard disk drives, medical devices",
      "Selangor and Kuala Lumpur: automotive parts, oleochemicals, food processing",
      "Johor: electronics, downstream petrochemicals, food",
      "Perak and Penang: rubber gloves and medical consumables",
      "Sabah and Sarawak: palm oil downstream and wood products",
    ],
    industries: [
      "Electronics and semiconductor backend",
      "Medical devices",
      "Automotive components",
      "Rubber and oleochemicals",
      "Food processing",
      "Furniture and wood products",
    ],
    logistics:
      "Port Klang handles most container volume; Penang Port at Butterworth serves the northern corridor; Tanjung Pelepas in Johor competes with Singapore. Road infrastructure is good and predictable. Flooding is rare but seasonal monsoon (Nov-Feb on the east coast) can disrupt trucking.",
    standards: [
      "ISO 9001",
      "IATF 16949",
      "ISO 14001",
      "BSCI",
      "SMETA",
      "SA8000",
      "JAKIM halal",
      "HACCP",
    ],
    registry:
      "SSM (Companies Commission of Malaysia) company search at ssm.com.my; MITI for manufacturing licences; JAKIM for halal.",
    faq: [
      { q: "Can you verify a Penang electronics supplier remotely?", a: "Partly. SSM registration, director list, MITI licence status and certificate scope can be checked remotely. What cannot be confirmed remotely is whether the equipment on the floor matches the bill of materials, which subcontracting steps leave the site, and how migrant labour is recruited. These need a site visit." },
      { q: "How common is FTZ subcontracting in Penang?", a: "Very common. Penang and Johor run two of the largest FTZ footprints in Southeast Asia, and many multinationals run a Tier 1 + Tier 2 structure inside the same zone. Ask directly which processes leave the audited site, and get the names of any sub-suppliers in writing." },
      { q: "Do Malaysian factories accept SMETA or BSCI audits?", a: "Yes, particularly at Penang and Selangor electronics plants supplying into the UK and EU. SMETA is the more common of the two. For automotive programmes IATF 16949 is the usual framework. For food and halal, JAKIM and HACCP matter more than the social compliance ones." },
      { q: "How long does a Penang audit take?", a: "A single-site quality audit is usually scheduled within a week for Penang and Selangor, and reported within two business days. SMETA full audits need more time. East Malaysia (Sabah/Sarawak) needs more travel lead time." },
    ],
  },
  zh: {
    hook: "槟城是除深圳之外最集中的电子制造基地之一。英语文档成熟，跨国供应商体系深。",
    profile:
      "马来西亚出口制造集中在两条带。北部的槟城与居林承载电子组装、半导体后端、硬盘、医械与自动化；雪兰莪、柔佛与吉隆坡都市圈承载汽车零部件、油化与棕榈油衍生品、橡胶制品与清真食品加工。许多工厂是外资，英语文档齐备。SSM（Suruhanjaya Syarikat Malaysia）公司登记可在线查询。",
    risks: [
      "电子产业走廊的二、三级外发是常态。你参观的工厂几乎从不处在链条的末端。",
      "槟城与柔佛的自由贸易区（FTZ）地位会改变出口方式与出口主体。",
      "来自印尼、孟加拉、尼泊尔、缅甸的外籍劳工在制造业很常见，社会合规审核发现最集中的地方。",
      "清真与医械工厂持有行业特定许可，必须纳入核查范围。",
      "集团产能很容易与实际被审核厂区的产能混淆。",
    ],
    verificationNotes: [
      "在 ssm.com.my 的 SSM 公司查询确认公司名称、注册号与董事名单。",
      "核查实体是否在 MITI 持有对应行业的制造许可。",
      "对 FTZ 厂区，运营方与许可区域分别确认。FTZ 主体未必是出口主体。",
      "若工厂声称享有 ATIGA 或 RCEP 优惠原产地，索要 MyCRS 海关核准。",
    ],
    auditNotes: [
      "槟城与雪兰莪电子工厂的 SMETA、BSCI、SA8000、WRAP 经验普遍成熟。",
      "清真食品工厂常持 JAKIM/MS 1500。核查范围后再采信。",
      "汽车零部件集群的 IATF 16949 覆盖度成熟。",
      "工时记录与外籍劳工的招聘费是推高风险分数的核心项。",
    ],
    hubs: [
      "槟城、居林：电子组装、半导体后端、硬盘、医械",
      "雪兰莪、吉隆坡：汽车零部件、油化、食品加工",
      "柔佛：电子、石化下游、食品",
      "霹雳、槟城：橡胶手套与医用耗材",
      "沙巴、砂拉越：棕榈油下游与木制品",
    ],
    industries: [
      "电子与半导体后端",
      "医疗器械",
      "汽车零部件",
      "橡胶与油化",
      "食品加工",
      "家具与木制品",
    ],
    logistics:
      "巴生港承担大部分集装箱；槟城港（北海）服务北部走廊；柔佛丹戎帕拉帕斯与新加坡竞争。路网稳定。洪水罕见，但东海岸 11-2 月季风季会拖慢陆运。",
    standards: [
      "ISO 9001",
      "IATF 16949",
      "ISO 14001",
      "BSCI",
      "SMETA",
      "SA8000",
      "JAKIM 清真",
      "HACCP",
    ],
    registry:
      "SSM（马来西亚公司委员会）公司查询 ssm.com.my；MITI 颁发制造许可；JAKIM 颁发清真认证。",
    faq: [
      { q: "能远程核验槟城电子供应商吗？", a: "部分可以。SSM 登记、董事名单、MITI 许可状态、证书范围可远程核对。远程无法确认的是车间设备是否与 BOM 对应、哪些工序外发、外籍劳工如何招聘 —— 这些需要现场走访。" },
      { q: "槟城 FTZ 外发常见吗？", a: "非常常见。槟城与柔佛是东南亚两个最大的 FTZ 之一，许多跨国公司在同一区域跑 Tier 1 + Tier 2 结构。直接问哪些工序离开被审核厂区，并要求书面列出外发厂名称。" },
      { q: "马来西亚工厂接受 SMETA / BSCI 验厂吗？", a: "接受，尤其在面向英国与欧盟的槟城、雪兰莪电子工厂。SMETA 较常见。汽车项目一般是 IATF 16949。食品与清真体系，JAKIM 与 HACCP 比社会责任更重要。" },
      { q: "槟城验厂需要多久？", a: "单厂区质量审核通常一周内可排期，两个工作日内出报告。完整 SMETA 需要更长时间。东马（沙巴 / 砂拉越）需要更长的差旅前置期。" },
    ],
  },
},

{
  code: "philippines",
  name: "Philippines",
  nameZh: "菲律宾",
  slug: "philippines",
  metaDesc:
    "Supplier verification and factory audit in the Philippines. Confirm SEC registration, verify the production site in Laguna or Cavite, and book a site visit before placing a high-value order. Manufacturing base is thinner than Vietnam or Thailand.",
  en: {
    hook:
      "Real manufacturing exists, but it is thinner than Vietnam or Thailand. Most suppliers here are trading companies or smaller plants tied to specific multinationals, so the supplier list is short and worth verifying carefully.",
    profile:
      "The Philippines' export manufacturing concentrates in two clusters. The Laguna/Cavite belt south of Manila, sometimes called the Philippines' Silicon Valley, hosts electronics assembly (Semiconductors and Electronics Industries in the Philippines, Inc — SEIPI), automotive parts. Cebu in the Visayas covers food processing, furniture and smaller electronics. Central Luzon (Pampanga, Bulacan) hosts the food processing and garments cluster. Many factories are tied to specific Japanese, American or Korean buyers. Most foreign procurement enquiries go to trading companies rather than direct manufacturers, which is the first thing worth checking.",
    risks: [
      "Most supplier search results are trading companies, not direct manufacturers. Ask which processes are in-house and which are subcontracted.",
      "Supplier documentation is generally thinner than in Malaysia or Vietnam. Expect more requests for clarification and longer verification lead times.",
      "Typhoon season (June to November) disrupts shipping from Manila and Cebu and can delay audits.",
      "Social compliance audits such as BSCI and SMETA are less common than in China or Vietnam. Plan to do more documentary work up front.",
      "Island geography complicates factory visits outside the main Luzon and Cebu clusters. Travel lead time and cost matter.",
    ],
    verificationNotes: [
      "Pull the SEC (Securities and Exchange Commission) company search and confirm the company name, registration number and incorporators.",
      "For sole proprietorships check the DTI (Department of Trade and Industry) Business Name registration instead.",
      "For PEZA-registered zones (Philippine Economic Zone Authority), confirm the zone operator separately; the zone entity is not always the exporter.",
      "Ask which entity signs the export contract. For Japanese and Korean buyers, it is sometimes the parent company in Tokyo or Seoul, not the Philippines entity.",
    ],
    auditNotes: [
      "IATF 16949 coverage is solid at automotive parts plants tied to specific Japanese OEMs.",
      "Electronics assembly quality systems vary widely; do not assume the parent company's discipline carries through.",
      "Working hour and overtime records are the most common audit findings; this is a regulatory focus area.",
      "Plan longer audit windows than China or Vietnam. The first audit on a new Philippines supplier usually needs an extra day.",
    ],
    hubs: [
      "Laguna and Cavite: electronics assembly, automotive parts (Japanese OEM cluster)",
      "Metro Manila: food processing, garments, trading",
      "Cebu: food processing, furniture, smaller electronics",
      "Central Luzon (Pampanga, Bulacan): garments, food",
      "Subic Bay Freeport: light manufacturing, electronics",
    ],
    industries: [
      "Electronics assembly",
      "Automotive parts",
      "Food processing",
      "Garments",
      "Furniture and wood products",
    ],
    logistics:
      "Manila International Container Port and Subic Bay Freeport handle the Luzon corridor; Cebu International Port handles the Visayas. Island geography makes air freight more common than in Vietnam or Thailand, which raises cost for bulky goods. Typhoon season (June to November) disrupts schedules.",
    standards: [
      "ISO 9001",
      "IATF 16949",
      "ISO 14001",
      "BSCI",
      "SMETA",
      "HACCP",
    ],
    registry:
      "SEC (Securities and Exchange Commission) company search for corporations; DTI Business Name search for sole proprietorships; PEZA for zone registration.",
    faq: [
      { q: "Is the Philippines a strong sourcing destination?", a: "It depends on the product. For electronics assembly tied to Japanese and American OEMs, there are real manufacturers with mature quality systems. For general consumer goods the supplier base is much thinner than Vietnam or Thailand, and most leads turn out to be trading companies rather than factories. We help you tell which is which before you travel." },
      { q: "Do Philippine factories accept BSCI or SMETA?", a: "Less commonly than China, Vietnam or Malaysia. Where the buyer is Japanese or Korean, the audit tends to follow the parent's own checklist rather than BSCI or SMETA. We can audit against either or against the buyer's standard." },
      { q: "How long does a Manila area audit take?", a: "A single-site quality audit in the Laguna or Cavite belt is normally scheduled within a week and reported within two business days. Cebu adds a day. Other provinces need extra travel time. Plan longer than China or Vietnam for the first visit." },
      { q: "What about typhoon season?", a: "June to November. Manila port and Cebu port can run on modified schedules. We avoid booking audits during the peak typhoon window when possible, and build slack into the travel plan when we cannot." },
    ],
  },
  zh: {
    hook:
      "实际存在制造业，但比越南、泰国更薄。这里的多数供应商是贸易公司或挂靠在大买家名下的小厂，所以供应商清单很短，值得仔细核。",
    profile:
      "菲律宾出口制造集中在两处。马尼拉南部的内湖 / 甲米地（Laguna / Cavite）走廊承载电子组装（菲律宾半导体与电子工业协会 SEIPI 集群）、汽车零部件；宿务（Cebu）承载食品加工、家具与中小型电子；中吕宋（Central Luzon）承载服装与食品。许多工厂挂靠特定日资、美资、韩资买家。多数国外询盘接到的都是贸易公司而非直接生产厂，这是核查的第一道关。",
    risks: [
      "多数搜索结果是贸易公司，不是直接工厂。问清楚哪些工序自有、哪些外发。",
      "供应商文件厚度通常低于马来西亚或越南。需要更多澄清与更长的核查前置时间。",
      "台风季（6-11 月）打乱马尼拉与宿务港出货，也会推迟验厂排期。",
      "BSCI、SMETA 等社会责任审核不像在中国、越南那么普遍，需要更多前置文件工作。",
      "岛屿地理使吕宋与宿务之外的工厂走访变难。差旅前置时间与成本都要计入。",
    ],
    verificationNotes: [
      "在 SEC（证券交易委员会）公司查询中确认公司名称、注册号与发起人。",
      "对个人独资（DTI 商业名称登记）则改查 DTI。",
      "对 PEZA 园区注册的厂区，单独确认运营方与园区方；园区主体未必是出口主体。",
      "问清楚哪个主体签出口合同。日资、韩资买家有时由东京或首尔的母公司签，而非菲律宾主体。",
    ],
    auditNotes: [
      "挂靠日资车厂的零部件厂的 IATF 16949 覆盖度扎实。",
      "电子组装质量体系差异大，不能假设母公司的纪律会传导到现场。",
      "工时与加班记录是最常见的审核发现；这是当地监管的关注重点。",
      "预留比中国、越南更长的审核窗口。首次新供应商审计通常需要额外一天。",
    ],
    hubs: [
      "内湖、甲米地：电子组装、汽车零部件（日资 OEM 集群）",
      "大马尼拉：食品加工、服装、贸易公司",
      "宿务：食品加工、家具、中小型电子",
      "中吕宋（邦板牙、布拉干）：服装、食品",
      "苏比克湾自由港：轻工业、电子",
    ],
    industries: [
      "电子组装",
      "汽车零部件",
      "食品加工",
      "服装",
      "家具与木制品",
    ],
    logistics:
      "马尼拉国际集装箱港与苏比克湾自由港承担吕宋走廊；宿务国际港负责米沙鄢。岛屿地理使空运比越南、泰国更常见，推高笨重货物的成本。台风季（6-11 月）打乱班期。",
    standards: [
      "ISO 9001",
      "IATF 16949",
      "ISO 14001",
      "BSCI",
      "SMETA",
      "HACCP",
    ],
    registry:
      "SEC（证券交易委员会）公司查询（企业）；DTI 商业名称查询（独资）；PEZA 园区注册。",
    faq: [
      { q: "菲律宾适合作为采购目的地吗？", a: "看产品。挂靠日资、美资 OEM 的电子组装，有真正成熟的工厂。普通消费品供应商池远不如越南、泰国，多数线索其实是贸易公司而非工厂。我们在你出差之前就帮你分清楚。" },
      { q: "菲律宾工厂接受 BSCI 或 SMETA 吗？", a: "没有中国、越南、马来西亚那么普遍。日资、韩资买家的工厂通常按母公司的自有检查表，而不是 BSCI 或 SMETA。我们可以按两种标准或买家自有标准来审。" },
      { q: "马尼拉周边验厂要多久？", a: "内湖、甲米地的单厂区质量审核通常一周内可排期，两个工作日内出报告。宿务增加一天。其他省份需要更长差旅时间。首次走访预留比中国、越南更长的窗口。" },
      { q: "台风季怎么办？", a: "6-11 月。马尼拉港与宿务港按调整后的班期运行。我们尽量避开台风高峰，必须经过时会在差旅计划里预留缓冲。" },
    ],
  },
  },
];
// ---------- 商业服务页（国家 × 服务）内容 ----------

export interface ServiceContent {
  /** 服务标识 */
  code: CoverageServiceCode;
  /** URL slug 后缀，例如 supplier-verification */
  slugSuffix: string;
  /** 服务名，例如 Supplier Verification */
  nameEn: string;
  nameZh: string;
  /** 快速回答 */
  quickAnswer: string;
  /** 服务说明 */
  intro: string;
  /** 包含项 */
  includes: string[];
  /** 交付物 */
  deliverables: string[];
  /** 流程步骤 */
  process: { title: string; body: string }[];
  /** 定价依据 */
  pricingBasis: string;
  /** 服务级 FAQ（与国家 FAQ 组合后形成页面唯一 FAQ） */
  faq: { q: string; a: string }[];
}

export interface ServiceLocalized extends ServiceContent {
  zh: ServiceContent;
}

export const COVERAGE_SERVICES: ServiceLocalized[] = [
  {
    code: "verification",
    slugSuffix: "supplier-verification",
    nameEn: "Supplier Verification",
    nameZh: "供应商核查",
    quickAnswer:
      "Supplier verification confirms that the company is a real legal entity, that the factory address you were given is where the product is made, and that the capability, quality and compliance documents hold up. It is a documentary review plus site evidence, not an audit, and it is finished before you release a deposit.",
    intro:
      "We check the supplier against public records and third-party sources, then confirm the site and the paperwork. You get a written report with the evidence behind each finding, and a clear statement of what we could not confirm.",
    includes: [
      "Business registration and legal entity check against official and third-party sources",
      "Factory address confirmation with photos, video and location evidence",
      "Manufacturer or trading company determination",
      "Production capability assessment against your product and order volume",
      "Quality and compliance documentation review",
      "Export history and adverse record check",
    ],
    deliverables: [
      "Written verification report in English or Chinese",
      "Company identity and registration findings",
      "Factory address and site evidence with photos",
      "Capability and equipment summary",
      "Documentation status for each item we asked for",
      "Risk summary with recommended next steps",
    ],
    process: [
      {
        title: "Send us the supplier details",
        body: "Company name, address, website and your product. No contract and no onboarding call required.",
      },
      {
        title: "We run the documentary checks",
        body: "Registration, legal entity, site address, export records and adverse records against official and third-party sources.",
      },
      {
        title: "We confirm the site",
        body: "An on-site or remote visit with photos, video and location evidence, depending on the package you choose.",
      },
      {
        title: "You get the report",
        body: "Findings with evidence, a risk summary, and a statement of what remains unconfirmed.",
      },
    ],
    pricingBasis:
      "Quoted per supplier. The price depends on the country, whether the package includes a site visit, and how many documents need review. Remote documentary checks are the cheapest; packages with an on-site visit cost more.",
    faq: [
      {
        q: "How is verification different from a factory audit?",
        a: "Verification confirms who the supplier is and whether the basic claims hold up: registration, site, capability and documentation. An audit is a deeper on-site assessment of processes, quality control and compliance against a stated standard. Verification is faster and cheaper. An audit goes further.",
      },
      {
        q: "What if the supplier turns out to be high risk?",
        a: "You get the evidence and a risk summary. From there you can renegotiate terms, require corrective action, commission a full audit, or stop before any payment is released.",
      },
    ],
    zh: {
      code: "verification",
      slugSuffix: "supplier-verification",
      nameEn: "Supplier Verification",
      nameZh: "供应商核查",
      quickAnswer:
        "供应商核查确认三件事：公司是不是真实存在的法律实体；对方给的工厂地址是不是实际生产地；产能、质量和合规文件是否站得住。它是文件审阅加现场证据，不是验厂，并且在你付定金之前完成。",
      intro:
        "我们通过官方与第三方数据源核验供应商，再确认厂区与文件。你会拿到书面报告，每一项发现都附证据，并明确列出我们无法确认的部分。",
      includes: [
        "通过官方与第三方数据源核验工商登记与法律实体",
        "以照片、视频和定位证据确认工厂地址",
        "判定是生产型工厂还是贸易公司",
        "对照你的产品与订单量评估产能",
        "审阅质量与合规文件",
        "核查出口记录与不良记录",
      ],
      deliverables: [
        "英文或中文书面核查报告",
        "公司身份与登记核查结果",
        "工厂地址与现场证据（含照片）",
        "产能与设备概况",
        "每一项索要文件的状态",
        "风险摘要与建议下一步",
      ],
      process: [
        {
          title: "把供应商信息发给我们",
          body: "公司名称、地址、网站和你的产品。不需要签合同，也不需要开案会议。",
        },
        {
          title: "我们做文件核查",
          body: "通过官方与第三方数据源核验登记信息、法律实体、厂区地址、出口记录和不良记录。",
        },
        {
          title: "我们确认厂区",
          body: "按你选择的方案，安排现场走访或远程走访，留存照片、视频和定位证据。",
        },
        {
          title: "你收到报告",
          body: "发现项附证据、风险摘要，以及仍未确认事项的说明。",
        },
      ],
      pricingBasis:
        "按供应商数量报价。价格取决于国家、方案是否含现场走访、以及需要审阅的文件量。纯远程文件核查最便宜，含现场走访的方案更贵。",
      faq: [
        {
          q: "核查和验厂有什么区别？",
          a: "核查确认供应商是谁、基本说法是否成立：登记、厂区、产能和文件。验厂是更深入的现场评估，覆盖流程、质量控制和对特定标准的符合性。核查更快更便宜，验厂走得更深。",
        },
        {
          q: "如果核查结果显示高风险怎么办？",
          a: "你会拿到证据和风险摘要。接下来可以重新谈条款、要求整改、委托一次完整验厂，或者在任何付款发生之前直接停掉。",
        },
      ],
    },
  },
  {
    code: "audit",
    slugSuffix: "factory-audit",
    nameEn: "Factory Audit",
    nameZh: "工厂验厂",
    quickAnswer:
      "A factory audit is an on-site assessment of a supplier's processes, quality control and compliance against a stated standard. An auditor walks the floor, interviews staff, reviews records and issues a written report with findings, evidence and a corrective action list.",
    intro:
      "We put an auditor on site against the standard your buyer requires, or against a scope we define with you. The output is a report you can hand to your own customer, with findings graded and corrective actions listed.",
    includes: [
      "Opening meeting and management interview",
      "Full site walkthrough including production, warehousing and dormitories where relevant",
      "Document and record review covering quality, compliance and labour",
      "Employee interviews conducted off the production floor where the standard requires it",
      "Findings graded by severity against the audit standard",
      "Corrective action plan with owners and target dates",
    ],
    deliverables: [
      "Written audit report with photographs",
      "Findings graded by severity",
      "Corrective action plan",
      "Evidence pack: records reviewed, interview notes, site photos",
      "Risk summary for your sourcing decision",
      "Optional re-audit after the corrective action period",
    ],
    process: [
      {
        title: "Scope the audit",
        body: "We agree the standard, the site, the number of man-days and the date. No standard in mind? We define a scope from your product and market.",
      },
      {
        title: "Schedule the auditor",
        body: "We assign an auditor with the relevant standard and industry experience and confirm travel.",
      },
      {
        title: "Audit on site",
        body: "Opening meeting, site walkthrough, record review, staff interviews, then a closing meeting with the findings summarised.",
      },
      {
        title: "Report and follow-up",
        body: "You receive the report within two business days. We can run a re-audit once the corrective actions are due.",
      },
    ],
    pricingBasis:
      "Quoted per man-day plus travel. The number of man-days depends on site size, headcount and the standard. Single-site quality audits start at one man-day; full social compliance audits such as SMETA usually take two or more.",
    faq: [
      {
        q: "Which audit standards can you audit against?",
        a: "Quality audits against ISO 9001 and your own specification, social compliance audits against BSCI, SMETA and SA8000, plus environmental and security assessments. If your buyer has a proprietary checklist, send it and we will audit against that instead.",
      },
      {
        q: "Do you issue certificates?",
        a: "No. We are not a certification body and we do not sell certificates. We assess and report. If you need a certificate, our report tells you whether the plant is likely to pass and what still needs fixing.",
      },
      {
        q: "Can the factory fail the audit?",
        a: "We do not pass or fail a plant. We grade findings by severity and report them. Your organisation decides what it will accept, and we can run a re-audit to check the corrective actions were actually done.",
      },
    ],
    zh: {
      code: "audit",
      slugSuffix: "factory-audit",
      nameEn: "Factory Audit",
      nameZh: "工厂验厂",
      quickAnswer:
        "工厂验厂是审核员到现场，按约定标准评估供应商的流程、质量控制与合规水平。审核员走车间、访谈员工、审阅记录，最后出具书面报告，包含发现项、证据和整改清单。",
      intro:
        "我们按你的买家要求的标准，或与你共同定义的范围，把审核员派到现场。成果是一份可以直接交给你自己客户的报告，发现项分级、整改项列明。",
      includes: [
        "首次会议与管理层访谈",
        "全厂区走访，覆盖生产、仓储以及相关的宿舍",
        "质量、合规与劳工记录审阅",
        "按标准要求在车间之外进行员工访谈",
        "发现项按审核标准分级",
        "含责任人与完成期限的整改计划",
      ],
      deliverables: [
        "含照片的书面验厂报告",
        "按严重度分级的发现项",
        "整改计划",
        "证据包：已审阅记录、访谈笔记、现场照片",
        "供你决策的风险摘要",
        "可选：整改期满后的复审",
      ],
      process: [
        {
          title: "确定审核范围",
          body: "约定标准、厂区、人天数和日期。没有指定标准？我们根据你的产品和目标市场定义范围。",
        },
        {
          title: "安排审核员",
          body: "指派具备相应标准与行业经验的审核员，并确认差旅安排。",
        },
        {
          title: "现场审核",
          body: "首次会议、厂区走访、记录审阅、员工访谈，最后以末次会议汇总发现项。",
        },
        {
          title: "报告与跟进",
          body: "两个工作日内出具报告。整改到期后可安排复审。",
        },
      ],
      pricingBasis:
        "按人天加差旅报价。人天数取决于厂区规模、人数和标准。单厂区质量审核从一个人天起；SMETA 这类完整社会责任审核通常需要两天以上。",
      faq: [
        {
          q: "你们能按哪些标准验厂？",
          a: "质量审核按 ISO 9001 或你自己的规格书；社会责任审核按 BSCI、SMETA、SA8000；另有环境与安全评估。如果你的买家有自有检查表，发给我们，我们按那份表审。",
        },
        {
          q: "你们发证吗？",
          a: "不发。我们不是认证机构，也不出售证书。我们只做评估并出具报告。如果你需要证书，报告会告诉你这家工厂通过的可能性有多大，以及还差什么。",
        },
        {
          q: "工厂会不及格吗？",
          a: "我们不判定通过或不通过。我们把发现项按严重度分级并如实报告。你的公司决定能接受什么，我们也可以复审，确认整改是否真的落实。",
        },
      ],
    },
  },
];

export const COVERAGE_SERVICE_SLUGS = COVERAGE_COUNTRIES.flatMap((c) =>
  COVERAGE_SERVICES.map((s) => ({ slug: `${c.slug}-${s.slugSuffix}`, country: c, service: s }))
);

export function findCoverageCountry(slug: string) {
  return COVERAGE_COUNTRIES.find((c) => c.slug === slug);
}

export function findCoverageService(slug: string) {
  return COVERAGE_SERVICE_SLUGS.find((x) => x.slug === slug);
}

/** Phase 2 以后要扩的国家，先登记不建页，避免无人认领的占位 */
export const COVERAGE_ROADMAP = [
  { name: "Indonesia", phase: 2 },
  // Malaysia moved to active coverage
  { name: "India", phase: 2 },
  { name: "Bangladesh", phase: 2 },
  { name: "Cambodia", phase: 3 },
  // Philippines moved to active coverage
  { name: "Mexico", phase: 3 },
  { name: "Türkiye", phase: 3 },
];
