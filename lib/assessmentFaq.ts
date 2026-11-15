// lib/assessmentFaq.ts —— 供应商合规自评 FAQ（内容型数据，不走 i18n 字典）
//
// 为什么独立成数据文件而不是进字典：
//   这是「内容」不是「界面文案」。进九语字典会牵动 en 叶子数冻结常量（3293）
//   与 12 处源文件白名单 + apply 脚本，成本远超收益。
//   铁律「en/zh 手写、其余回退英文」与 guides / toolFaqs 一致。
//
// 内容来源（两路合并迭代）：
//   ① Sedex SAQ 四大支柱 —— 劳工标准 / 健康安全 / 环境 / 商业道德
//   ② 我方自评题库 —— 14 题基础档案（SP01–SP14）+ 72 题专项模块
//     （SOCIAL_COMPLIANCE 37 + QUALITY 35）+ ENVIRONMENT 10
//
// 分两类受众：
//   supplier —— 供应商填表实操答疑（挂在自评页）
//   buyer    —— 买家认知答疑（挂在供应商详情 / 知识库）
//
// 写法铁律（沿用 docs/AI-SEARCH.md）：
//   · 答案前置：第一句就给结论。
//   · 覆盖五类：定义 / 计算或逻辑 / 比较 / 边界（不越权声称）/ 实操。
//   · 不吹嘘、不越权：自评 ≠ 平台核验，反复强调这条边界。

export type FaqItem = { q: string; a: string };
export type FaqGroup = {
  group: string;
  groupZh: string;
  items: FaqItem[];
};
export type AssessmentFaqContent = {
  title: string;
  lead: string;
  groups: FaqGroup[];
};

type LocaleFaq = { en: AssessmentFaqContent; zh: AssessmentFaqContent };

// ---------------------------------------------------------------------------
// 供应商侧 —— 填表实操答疑
// ---------------------------------------------------------------------------
const SUPPLIER_FAQ: LocaleFaq = {
  en: {
    title: "Self-Assessment FAQ",
    lead: "Answers to the questions suppliers most often ask when completing the FactoryAuditB2B self-assessment. Your self-assessment is your own declaration — it is not a platform verification.",
    groups: [
      {
        group: "Getting started",
        groupZh: "开始之前",
        items: [
          {
            q: "What is the self-assessment, and why should I complete it?",
            a: "It is a structured questionnaire about your company and factory. The 14-item basic profile (about 5 minutes) is all you need to submit your listing for review and get it published. The quality, social compliance and environmental modules are optional and can be added later when a buyer asks for them.",
          },
          {
            q: "How long does the basic profile take?",
            a: "About 5 minutes. It has 14 factual questions — legal name, unified social credit code, business type, year established, site address, employees, floor area, main products and export markets. No scoring is involved.",
          },
          {
            q: "Which questions are mandatory?",
            a: "In the basic profile, 12 of the 14 items are required. Company website and number of production lines are optional. In the quality, social compliance and environmental modules, every item is a scored checkpoint and all are required within that module.",
          },
          {
            q: "Do I have to finish everything in one sitting?",
            a: "No. Your answers are saved as a draft and you can return anytime. Only when you press 'Submit for Verification' is the submission locked for review.",
          },
        ],
      },
      {
        group: "What to prepare",
        groupZh: "需要准备什么",
        items: [
          {
            q: "What documents should I have ready before I start?",
            a: "Your business licence (for the legal name and unified social credit code), your factory address, employee headcount and floor area, your main product categories and export markets, and the management system certificates currently valid in your company name (for example ISO 9001, ISO 14001, BSCI, SMETA).",
          },
          {
            q: "Does the basic profile require any certificates or evidence files?",
            a: "No. The basic profile is factual text and numbers only. Certificates and evidence uploads belong to the optional quality, social compliance and environmental modules, where you can attach supporting files per checkpoint.",
          },
          {
            q: "Can I list a certificate that has expired?",
            a: "No. Only list certificates that are currently valid and in your company name. Listing an expired or third-party certificate would misrepresent your facility.",
          },
        ],
      },
      {
        group: "Scoring & status",
        groupZh: "评分与状态",
        items: [
          {
            q: "How is the self-assessment scored?",
            a: "The basic profile is not scored — it is factual. The quality, social compliance and environmental modules use a compliance scale (C / PC / NC / CR, meaning conforming / partially conforming / non-conforming / critical). These reflect your own declared status, not an independent audit finding.",
          },
          {
            q: "What does 'self-assessed' mean, and is it the same as being verified?",
            a: "No. Self-assessed means you completed the questionnaire and submitted it for review. It is your own declaration. On-site or online verification by FactoryAuditB2B is a separate process with its own evidence review. A self-assessment never carries the same weight as an independent audit.",
          },
          {
            q: "What are the statuses my submission can go through?",
            a: "Draft, Submitted, Under Review, Published, Action Required, or Rejected. When an administrator returns items for more information, the status becomes Action Required and you can edit and resubmit.",
          },
          {
            q: "I filled it in, but my visibility score is still low. Why?",
            a: "The visibility score is a separate composite of profile completeness, whether you submitted an assessment, and your verification status. Completing more modules and obtaining verification both raise it — but the score itself is a ranking aid for buyers, not a compliance guarantee.",
          },
        ],
      },
      {
        group: "The four SAQ pillars",
        groupZh: "四大 SAQ 支柱",
        items: [
          {
            q: "What areas do the optional modules cover?",
            a: "They follow the four pillars used by buyer social-audit standards: labour standards (working hours, wages, child and forced labour), health and safety (PPE, machine guarding, fire safety), environment (permits, waste, chemicals), and business ethics (grievance channels, no discrimination, no harassment).",
          },
          {
            q: "Do I need a formal SAQ or SMETA audit before filling these in?",
            a: "No. These modules are self-declared checklists. They help you see where your facility stands against common buyer requirements, but they do not replace a formal SAQ, SMETA or other third-party audit.",
          },
          {
            q: "What is the difference between the environmental module and an ISO 14001 audit?",
            a: "The environmental module is a 10-point self-declared checklist (permits, wastewater, air emissions, hazardous waste, chemicals). ISO 14001 is an independently certified management system. Completing the checklist does not mean you are ISO 14001 certified.",
          },
        ],
      },
      {
        group: "After you submit",
        groupZh: "提交之后",
        items: [
          {
            q: "What happens after I submit for verification?",
            a: "Your submission enters review. You cannot edit it while it is under review. Once approved, your listing is published and your supplier dashboard shows profile views, shares and other engagement metrics.",
          },
          {
            q: "Can I change my answers after publishing?",
            a: "Yes, but changes go through review again. Editing locks the published version until the new submission is approved, to keep what buyers see consistent with what was reviewed.",
          },
          {
            q: "How do buyers see my self-assessment?",
            a: "Buyers see your published profile and, where you have completed them, your module results and evidence. Buyers never see your internal notes or unreviewed drafts.",
          },
        ],
      },
    ],
  },
  zh: {
    title: "供应商自评 FAQ",
    lead: "供应商填写 FactoryAuditB2B 自评时最常问的问题。自评是你的自我声明——它不是平台的核验结论。",
    groups: [
      {
        group: "Getting started",
        groupZh: "开始之前",
        items: [
          {
            q: "什么是自评？我为什么要填？",
            a: "它是一套关于你公司和工厂的结构化问卷。只需填完 14 项基础档案（约 5 分钟）就能提交审核并发布企业档案；质量、社会责任、环保三个专项模块是选填的，可以等买家要求时再补。",
          },
          {
            q: "基础档案要填多久？",
            a: "大约 5 分钟。共 14 个事实型问题：法定名称、统一社会信用代码、企业类型、成立年份、工厂地址、员工人数、建筑面积、主营产品和出口市场。不涉及打分。",
          },
          {
            q: "哪些题是必答的？",
            a: "基础档案 14 题里 12 题必答，公司官网和产线数量选填。质量、社会责任、环保三个专项模块里，每题都是评分型检查点，模块内全部必答。",
          },
          {
            q: "我必须一次填完吗？",
            a: "不用。答案会存成草稿，随时可以回来继续。只有点「提交审核」后，提交才会被锁定进入审核。",
          },
        ],
      },
      {
        group: "What to prepare",
        groupZh: "需要准备什么",
        items: [
          {
            q: "开始前我应该准备好哪些资料？",
            a: "营业执照（用于法定名称和统一社会信用代码）、工厂地址、员工人数和建筑面积、主营产品类别和出口市场，以及以你公司名义、当前有效的管理体系证书（如 ISO 9001、ISO 14001、BSCI、SMETA）。",
          },
          {
            q: "基础档案需要上传证书或证据文件吗？",
            a: "不需要。基础档案只是事实型文字和数字。证书和证据上传属于选填的质量、社会责任、环保模块，可以在对应检查点附上佐证文件。",
          },
          {
            q: "过期的证书能填吗？",
            a: "不能。只填以你公司名义、当前有效的证书。填写过期或第三方证书会不实陈述你的工厂状况。",
          },
        ],
      },
      {
        group: "Scoring & status",
        groupZh: "评分与状态",
        items: [
          {
            q: "自评是怎么打分的？",
            a: "基础档案不打分，只记录事实。质量、社会责任、环保模块用合规分级（C / PC / NC / CR，即符合 / 部分符合 / 不符合 / 严重不符合）。这些反映的是你自我声明的状态，不是独立审核结论。",
          },
          {
            q: "「已自评」是什么意思？和「已核验」一样吗？",
            a: "不一样。已自评表示你填完了问卷并提交审核，是你自己的声明。FactoryAuditB2B 的线上/现场核验是另一个流程，有自己的证据复核。自评的分量永远不等于独立审核。",
          },
          {
            q: "我的提交会经过哪些状态？",
            a: "草稿、已提交、审核中、已发布、待补充、已驳回。当管理员退回某些条目要求补充信息时，状态会变成「待补充」，你可以修改后重新提交。",
          },
          {
            q: "我填完了，可见度积分还是不高，为什么？",
            a: "可见度积分是另一个综合指标，由档案完整度、是否提交自评、核验状态共同构成。多填模块、获得核验都会提升它——但这个积分只是给买家看的排序参考，不是合规保证。",
          },
        ],
      },
      {
        group: "The four SAQ pillars",
        groupZh: "四大 SAQ 支柱",
        items: [
          {
            q: "选填模块覆盖哪些方面？",
            a: "它们对应买家社会审核标准常用的四大支柱：劳工标准（工时、工资、童工与强迫劳动）、健康安全（PPE、机械防护、消防安全）、环境（许可、废弃物、化学品）、商业道德（申诉渠道、无歧视、无骚扰）。",
          },
          {
            q: "填这些之前，我需要先做正式的 SAQ 或 SMETA 审核吗？",
            a: "不需要。这些模块是自我声明的清单，帮你对照常见买家要求看自己工厂处于什么水平，但它们不能替代正式的 SAQ、SMETA 或其他第三方审核。",
          },
          {
            q: "环保模块和 ISO 14001 审核有什么区别？",
            a: "环保模块是一份 10 项自我声明的检查清单（许可、废水、废气、危废、化学品）。ISO 14001 是独立认证的管理体系。填完清单不代表你已通过 ISO 14001 认证。",
          },
        ],
      },
      {
        group: "After you submit",
        groupZh: "提交之后",
        items: [
          {
            q: "提交审核后会发生什么？",
            a: "你的提交进入审核，审核期间不能编辑。审核通过后档案发布，你的供应商看板会显示档案浏览量、分享次数等数据。",
          },
          {
            q: "发布后还能改答案吗？",
            a: "可以，但修改会再次进入审核。编辑期间会锁定已发布的版本，直到新提交被批准，确保买家看到的内容与审核过的一致。",
          },
          {
            q: "买家怎么看我的自评？",
            a: "买家看到你已发布的档案，以及你已完成的模块结果和证据。买家永远看不到你的内部备注和未审核的草稿。",
          },
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// 买家侧 —— 认知答疑
// ---------------------------------------------------------------------------
const BUYER_FAQ: LocaleFaq = {
  en: {
    title: "Understanding Supplier Self-Assessment",
    lead: "How to read a supplier's self-assessment, what it tells you, and where it stops. A self-assessment is the supplier's own declaration — always weigh it against independent verification.",
    groups: [
      {
        group: "What it is",
        groupZh: "它是什么",
        items: [
          {
            q: "What is a supplier self-assessment?",
            a: "It is a structured questionnaire the supplier completes about their company and factory — legal identity, site, workforce, products, and optionally quality, social compliance and environmental modules. It is the supplier's own declaration, submitted for review.",
          },
          {
            q: "Is a self-assessment the same as an audit?",
            a: "No. A self-assessment is self-reported. An audit — whether online or on-site — is an independent review against evidence. On FactoryAuditB2B the two are kept clearly separate: self-assessed status and independently verified status are distinct.",
          },
          {
            q: "What is an SAQ, and how does it relate to this?",
            a: "SAQ stands for Self-Assessment Questionnaire. Buyer platforms such as Sedex require suppliers to complete an SAQ as a first, low-cost screen before any on-site audit (such as SMETA). FactoryAuditB2B follows the same idea: the supplier's self-assessment is a screening layer, not a substitute for audit.",
          },
        ],
      },
      {
        group: "What it covers",
        groupZh: "覆盖范围",
        items: [
          {
            q: "What four areas does the self-assessment cover?",
            a: "The optional modules map to the four pillars used by buyer social-audit standards: labour standards, health and safety, environment, and business ethics. The basic profile adds factual company and site details.",
          },
          {
            q: "What does the C / PC / NC / CR scale mean?",
            a: "It is a compliance scale: C (conforming), PC (partially conforming), NC (non-conforming), CR (critical). It reflects the supplier's own declared status against each checkpoint, not an auditor's finding.",
          },
          {
            q: "Does a high score mean the supplier is safe to buy from?",
            a: "No. A completed or high self-assessment shows engagement and declared compliance, but it is not proof. Use it to shortlist and ask for evidence, then verify independently where the order is material.",
          },
        ],
      },
      {
        group: "How to use it",
        groupZh: "怎么用",
        items: [
          {
            q: "How should I use a self-assessment in sourcing decisions?",
            a: "Treat it as a first screen. Use the basic profile to confirm the supplier's identity and capability, then look at whether they completed the quality, social compliance and environmental modules. For material orders, request evidence or an independent audit.",
          },
          {
            q: "What should I check for red flags?",
            a: "Missing mandatory items, an expired or third-party certificate, a facility address that differs from the registered office without explanation, or a profile that stayed incomplete for a long time. Any of these is worth a follow-up question before you commit.",
          },
          {
            q: "Can I see the supplier's evidence and documents?",
            a: "Where the supplier has uploaded evidence in the quality, social compliance or environmental modules, you can see the files they chose to share. You cannot see their internal notes or unreviewed drafts.",
          },
        ],
      },
      {
        group: "Limits",
        groupZh: "边界",
        items: [
          {
            q: "What can a self-assessment NOT tell me?",
            a: "It cannot confirm that the supplier's declared conditions are true, that working conditions meet a specific standard, or that products meet your specifications. Those require independent verification, on-site audit, or product inspection.",
          },
          {
            q: "Should I still run my own audit?",
            a: "For material or high-risk orders, yes. A self-assessment is a useful screen, but it is no substitute for an independent audit or inspection before you place a material order.",
          },
        ],
      },
    ],
  },
  zh: {
    title: "读懂供应商自评",
    lead: "怎么看供应商的自评、它告诉你什么、它的边界在哪里。自评是供应商自己的声明——永远要结合独立核验一起判断。",
    groups: [
      {
        group: "What it is",
        groupZh: "它是什么",
        items: [
          {
            q: "什么是供应商自评？",
            a: "它是供应商填写的一套结构化问卷，涵盖公司和工厂信息——法律身份、厂址、人员、产品，以及可选的品质、社会责任、环保模块。这是供应商自己的声明，提交后进入审核。",
          },
          {
            q: "自评和审核是一回事吗？",
            a: "不是。自评是自我报告；审核——无论线上还是现场——是针对证据的独立复核。在 FactoryAuditB2B 上两者被严格区分：已自评状态和独立核验状态是两回事。",
          },
          {
            q: "SAQ 是什么？和这个有什么关系？",
            a: "SAQ 是 Self-Assessment Questionnaire（自评问卷）的缩写。Sedex 等买方平台要求供应商先完成 SAQ，把它作为现场审核（如 SMETA）之前的第一道低成本筛查。FactoryAuditB2B 沿用同一思路：供应商自评是筛查层，不是审核的替代品。",
          },
        ],
      },
      {
        group: "What it covers",
        groupZh: "覆盖范围",
        items: [
          {
            q: "自评覆盖哪四大方面？",
            a: "选填模块对应买家社会审核标准常用的四大支柱：劳工标准、健康安全、环境、商业道德。基础档案则补充事实型的公司和厂址信息。",
          },
          {
            q: "C / PC / NC / CR 这套分级是什么意思？",
            a: "它是合规分级：C（符合）、PC（部分符合）、NC（不符合）、CR（严重不符合）。它反映供应商对每个检查点的自我声明状态，不是审核员的结论。",
          },
          {
            q: "分数高就代表这个供应商可以放心采购吗？",
            a: "不能。自评完成度高或分数高只说明供应商参与了、声明了合规，但不是证明。用它来做初筛、要求对方提供证据，订单金额大时再做独立核验。",
          },
        ],
      },
      {
        group: "How to use it",
        groupZh: "怎么用",
        items: [
          {
            q: "采购决策里该怎么用自评？",
            a: "把它当第一道筛查。用基础档案确认供应商身份和能力，再看是否完成了品质、社会责任、环保模块。金额大的订单，要对方提供证据或做独立审核。",
          },
          {
            q: "要警惕哪些危险信号？",
            a: "必答项缺失、证书过期或不是本公司名义、工厂地址与注册地不符且无说明、档案长期停留在未完成状态。任何一条都值得在下单前追问。",
          },
          {
            q: "我能看到供应商的证据和文件吗？",
            a: "供应商在品质、社会责任、环保模块上传了证据的，你能看到他们选择分享的文件。但你永远看不到他们的内部备注和未审核草稿。",
          },
        ],
      },
      {
        group: "Limits",
        groupZh: "边界",
        items: [
          {
            q: "自评不能告诉我什么？",
            a: "它无法证实供应商声明的情况是否属实、劳动条件是否达到某标准、产品是否满足你的规格。这些需要独立核验、现场审核或产品检验。",
          },
          {
            q: "我还需要自己做审核吗？",
            a: "金额大或高风险的订单，需要。自评是很有用的筛查，但在下大单前，它替代不了独立审核或检验。",
          },
        ],
      },
    ],
  },
};

export const ASSESSMENT_FAQ: Record<"supplier" | "buyer", LocaleFaq> = {
  supplier: SUPPLIER_FAQ,
  buyer: BUYER_FAQ,
};

/** 按语言取 FAQ（en/zh 手写，其余回退英文） */
export function getAssessmentFaq(
  audience: "supplier" | "buyer",
  locale: string
): AssessmentFaqContent {
  const pair = ASSESSMENT_FAQ[audience];
  if (locale === "zh" || locale === "zh-TW") {
    // zh-TW 回退到简体中文内容（与 guides 内容型字段一致）
    return pair.zh;
  }
  return pair.en;
}
