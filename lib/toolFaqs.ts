// lib/toolFaqs.ts —— 薄工具页的 Quick Answer + FAQ 内容（内容型数据，不走 i18n 字典）
//
// 为什么独立成数据文件而不是进字典：
//   1. 这是「内容」不是「界面文案」，按项目铁律应走数据自带字符串，绕开
//      九语叶子数冻结常量（en 3350）——进字典会牵动 11 处常量 + 6 处断言。
//   2. 铁律「en/zh 手写、其余回退」：这里只写 en + zh，其他语种回退英文，
//      与 guides / 内容型字段一致。
//
// 写法铁律（沿用 docs/AI-SEARCH.md）：
//   · 答案前置：quickAnswer 一段 40–80 词，第一句就给结论，可被 AI 直接摘走。
//   · FAQ 覆盖五类：定义 / 计算或逻辑 / 比较 / 边界（不越权声称）/ 实操。
//   · 不吹嘘、不越权：每个工具都明说「不确认官方认证 / 不是独立审核」，
//     免责声明与页面可见文本、各工具 lead 保持一致。

export type FaqItem = { q: string; a: string };
export type ToolFaqContent = {
  quickAnswerTitle: string;
  quickAnswer: string;
  faqs: FaqItem[];
};

type LocaleFaq = { en: ToolFaqContent; zh: ToolFaqContent };

export const TOOL_FAQS: Record<string, LocaleFaq> = {
  "supplier-scorecard": {
    en: {
      quickAnswerTitle: "Quick answer",
      quickAnswer:
        "A supplier evaluation scorecard lets you set your own criteria and weights, score each supplier against them, and get a single weighted total. It is a decision-support tool, not a certification — the score reflects the weights and ratings you enter.",
      faqs: [
        {
          q: "What is a supplier evaluation scorecard?",
          a: "It is a weighted scoring table where you choose the criteria that matter to you, assign each a weight, and rate a supplier against them. The tool multiplies each rating by its weight and sums the results into one overall score.",
        },
        {
          q: "How is the overall supplier score calculated?",
          a: "Each criterion's rating is multiplied by its weight, then the weighted values are summed. If the weights do not add to 100%, the total is normalised so the result stays on a consistent 0–100 scale.",
        },
        {
          q: "How is the scorecard different from the Supplier Risk Calculator?",
          a: "The scorecard uses your own criteria and weights, so it reflects your priorities. The Risk Calculator uses a fixed set of dimensions and questions to produce a standardised risk score you can compare across suppliers.",
        },
        {
          q: "Does a high scorecard score mean the supplier is verified?",
          a: "No. The score is based only on the ratings you enter and does not confirm a supplier's real status, certificates or site conditions. It is a self-assessment aid, not an independent audit or verification.",
        },
        {
          q: "How do I choose weights for the scorecard?",
          a: "Give more weight to the criteria that matter most for your order — for example, quality and delivery above price if you are buying critical components. Review the weighted total together with the individual ratings, not instead of them.",
        },
      ],
    },
    zh: {
      quickAnswerTitle: "一句话回答",
      quickAnswer:
        "供应商评估记分卡让你自定义评分项和权重，按这些标准给供应商打分，得到一个加权总分。它是决策辅助工具，不是认证——分数反映的是你输入的权重和评分。",
      faqs: [
        {
          q: "什么是供应商评估记分卡？",
          a: "它是一个加权评分表：你选择自己关心的评分项、为每项设定权重，再给供应商逐项打分。工具把每项得分乘以其权重后相加，得到一个综合总分。",
        },
        {
          q: "综合分数是怎么计算的？",
          a: "每项得分乘以其权重后相加；如果权重合计不是 100%，工具会归一化，让结果保持在统一的 0–100 分区间。",
        },
        {
          q: "记分卡和供应商风险计算器有什么区别？",
          a: "记分卡用你自己的评分项和权重，反映你的优先级；风险计算器用固定的维度和问题，产出可跨供应商比较的标准化风险分。",
        },
        {
          q: "记分卡分数高，代表供应商经过核验吗？",
          a: "不代表。分数只基于你输入的评分，不确认供应商的真实资质、证书或现场情况。它是自评辅助，不是独立审核或核验。",
        },
        {
          q: "权重应该怎么设？",
          a: "把权重给到你订单里最在意的项——比如采购关键部件时，质量和交期的权重应高于价格。看加权总分的同时，也要回看单项评分。",
        },
      ],
    },
  },

  "audit-checklist": {
    en: {
      quickAnswerTitle: "Quick answer",
      quickAnswer:
        "The Factory Audit Checklist Generator builds a structured checklist from the industry and audit type you select, covering the checks commonly expected for that combination. It is a preparation and self-assessment aid, not an official certification.",
      faqs: [
        {
          q: "What is the Factory Audit Checklist Generator?",
          a: "It turns your industry and audit type into a structured list of checks, so you know what an auditor typically looks at before the visit. It is preparation, not a certificate.",
        },
        {
          q: "How is the checklist generated?",
          a: "You choose an industry and an audit type; the tool assembles the checks commonly associated with that combination. The result is a starting point you can add to or remove from.",
        },
        {
          q: "Can I use this checklist as an official audit?",
          a: "No. It helps you prepare and self-assess; it does not issue any certification and does not replace an on-site audit by an independent auditor.",
        },
        {
          q: "Which audit types are supported?",
          a: "The checklist covers common types such as social compliance, quality system and environmental audits. Choose the type that matches the standard your buyer or retailer requires.",
        },
        {
          q: "How do I use the generated checklist?",
          a: "Walk through it before an audit to close obvious gaps, share it with the factory so they can prepare, and keep the filled version as a record of what you checked.",
        },
      ],
    },
    zh: {
      quickAnswerTitle: "一句话回答",
      quickAnswer:
        "工厂验厂检查表生成器根据你选择的行业和验厂类型，生成一份结构化检查表，覆盖该组合通常要查的条目。它是准备与自评工具，不是官方认证。",
      faqs: [
        {
          q: "什么是工厂验厂检查表生成器？",
          a: "它把你的行业和验厂类型变成一份结构化的检查清单，让你在验厂前知道审核员通常会查什么。它是准备工具，不是证书。",
        },
        {
          q: "检查表是怎么生成的？",
          a: "你选择行业和验厂类型，工具把这些组合通常关联的检查项拼成一份清单。生成结果是一个可以增删的起点。",
        },
        {
          q: "这份检查表能当官方审核用吗？",
          a: "不能。它帮助你准备和自评，不颁发任何认证，也不能替代独立审核员的现场验厂。",
        },
        {
          q: "支持哪些验厂类型？",
          a: "检查表覆盖常见类型，如社会责任、质量体系、环境等审核。选择与你买家或零售商要求的标准相匹配的类型。",
        },
        {
          q: "生成的检查表怎么用？",
          a: "在验厂前逐项自查、补齐明显缺口，把清单发给工厂让其准备，并保留填写后的版本作为你核查过的记录。",
        },
      ],
    },
  },

  "supplier-document-checker": {
    en: {
      quickAnswerTitle: "Quick answer",
      quickAnswer:
        "The Supplier Document Checker checks supplier documents for internal consistency and validity fields such as dates and numbers. It flags mismatches but does not confirm whether a certificate or licence is genuinely issued by any official body.",
      faqs: [
        {
          q: "What does the Supplier Document Checker do?",
          a: "It checks that the details across a supplier's documents agree with each other and that validity fields are present and in date. It detects internal inconsistencies, not forged documents.",
        },
        {
          q: "What documents can I check?",
          a: "Business licences, certificates and similar files that carry names, numbers and dates. The checker compares these fields for agreement and flags validity fields that are missing or expired.",
        },
        {
          q: "Does the checker confirm a certificate is valid?",
          a: "No. It only checks internal consistency and validity fields. Confirming that a certificate was truly issued requires checking with the issuing body.",
        },
        {
          q: "What counts as an inconsistency?",
          a: "Different company names, numbers or dates for the same entity across documents, or a validity field that is empty or already expired. These are warnings to verify, not proof of fraud.",
        },
        {
          q: "How should I use the result?",
          a: "Treat every flag as a reason to ask the supplier for clarification or to verify with the issuing authority. Do not treat a clean result as an official confirmation.",
        },
      ],
    },
    zh: {
      quickAnswerTitle: "一句话回答",
      quickAnswer:
        "供应商文件核对器检查供应商文件的信息一致性，以及有效期等字段。它标记不一致之处，但不确认证书或执照是否由官方机构真实颁发。",
      faqs: [
        {
          q: "文件核对器做什么？",
          a: "它检查供应商多份文件里的信息是否互相一致、有效期字段是否齐全且在有效期内。它识别的是内部不一致，不是伪造文件。",
        },
        {
          q: "能核对哪些文件？",
          a: "营业执照、证书等带有名称、编号和日期的文件。核对器比较这些字段是否一致，并标记缺失或过期的有效期字段。",
        },
        {
          q: "核对器能确认证书有效吗？",
          a: "不能。它只检查内部一致性和有效期字段。要确认证书是否真实签发，需向发证机构核实。",
        },
        {
          q: "什么算不一致？",
          a: "同一主体在不同文件里名称、编号或日期不一致，或有效期字段为空、已过期。这些是需要进一步核实的提示，不是造假的证据。",
        },
        {
          q: "结果该怎么用？",
          a: "把每个标记当作向供应商追问或向发证机构核实的理由。不要把「无标记」当作官方确认。",
        },
      ],
    },
  },

  "supplier-risk-assessment": {
    en: {
      quickAnswerTitle: "Quick answer",
      quickAnswer:
        "The Supplier Risk Assessment turns the supplier details you enter into an initial risk score, with an evidence status shown for each dimension. It separates what is supported by documents from what is an estimate, so estimates are never presented as facts.",
      faqs: [
        {
          q: "What is the Supplier Risk Assessment tool?",
          a: "It produces an initial risk score from the supplier details you enter, and labels each dimension with an evidence status so you can see which parts are supported and which are estimates.",
        },
        {
          q: "How is it different from the Risk Calculator?",
          a: "The Risk Calculator asks a fixed set of questions and returns a comparable risk score. The Risk Assessment starts from your own supplier details and shows evidence status per dimension.",
        },
        {
          q: "What does 'evidence status' mean?",
          a: "It tells you whether a dimension is backed by documents you provided, partially supported, or an estimate. Estimates are shown as estimates, never as verified facts.",
        },
        {
          q: "Is the risk score a verified rating?",
          a: "No. It is an initial estimate from the details you entered. Confirming a supplier's real risk level requires independent verification or an on-site audit.",
        },
        {
          q: "What should I do with a high-risk result?",
          a: "Ask for the missing documents, verify the supplier independently, or request an audit before placing an order. Use the dimension status to see where the risk is concentrated.",
        },
      ],
    },
    zh: {
      quickAnswerTitle: "一句话回答",
      quickAnswer:
        "供应商风险评估把你填写的供应商信息转化为初步风险评分，并为每个维度标注证据状态。它把有文件支撑的信息和推算区分开，从不把推算当作事实。",
      faqs: [
        {
          q: "什么是供应商风险评估工具？",
          a: "它根据你填写的供应商信息生成初步风险评分，并给每个维度标注证据状态，让你看清哪些是有文件支撑的、哪些是推算。",
        },
        {
          q: "它和风险计算器有什么区别？",
          a: "风险计算器用固定问题返回可比较的风险分；风险评估从你自己的供应商信息出发，并按维度显示证据状态。",
        },
        {
          q: "「证据状态」是什么意思？",
          a: "它说明某个维度是有你提供的文件支撑、部分支撑，还是推算。推算会被明确标为推算，绝不当作已核验事实。",
        },
        {
          q: "这个风险分是经过核验的评级吗？",
          a: "不是。它是基于你填写信息的初步推算。要确认供应商真实风险等级，需要独立核验或现场验厂。",
        },
        {
          q: "结果偏高怎么办？",
          a: "补齐缺失文件、独立核验供应商，或下单前要求验厂。用各维度的证据状态看清风险集中在哪。",
        },
      ],
    },
  },

  "audit-report-analyzer": {
    en: {
      quickAnswerTitle: "Quick answer",
      quickAnswer:
        "The Audit Report Analyzer reads a pasted audit report and checks its structure, missing items and risk signals. It is a decision-support tool that helps you spot gaps, and it does not confirm official certification.",
      faqs: [
        {
          q: "What does the Audit Report Analyzer do?",
          a: "It checks a pasted report for expected sections, missing items and risk signals, so you can see at a glance whether the report is complete and where the risks are.",
        },
        {
          q: "What does it check for?",
          a: "Report structure, required sections, missing fields and risk indicators such as a missing score, absent follow-up items or conflicting conclusions.",
        },
        {
          q: "Does it confirm the audit is official?",
          a: "No. It assesses the report's content and completeness, not whether the audit was really performed or the certificate is genuine.",
        },
        {
          q: "Can it replace a human review?",
          a: "No. It flags likely gaps for a human to investigate. A qualified reviewer should still confirm findings and decide next steps.",
        },
        {
          q: "How do I use the result?",
          a: "Treat each flag as a question to raise with the auditor or supplier. Use it to decide whether to ask for a corrected report or further verification.",
        },
      ],
    },
    zh: {
      quickAnswerTitle: "一句话回答",
      quickAnswer:
        "验厂报告分析器读取你粘贴的验厂报告，检查其结构、缺失项和风险信号。它是决策辅助工具，帮助你发现缺口，不确认官方认证。",
      faqs: [
        {
          q: "报告分析器做什么？",
          a: "它检查你粘贴的报告是否包含应有章节、缺了什么、有哪些风险信号，让你一眼看出报告是否完整、风险在哪。",
        },
        {
          q: "它检查什么？",
          a: "报告结构、必备章节、缺失字段，以及风险信号，比如缺评分、缺后续整改项、结论相互矛盾等。",
        },
        {
          q: "它能确认这份审核是官方的吗？",
          a: "不能。它评估的是报告内容和完整度，不判断审核是否真实执行、证书是否真实。",
        },
        {
          q: "它能替代人工审阅吗？",
          a: "不能。它标记可能的缺口供人工跟进，最终结论和后续动作仍需有经验的人确认。",
        },
        {
          q: "结果怎么用？",
          a: "把每个标记当作向审核方或供应商提出的问题，据此决定是要求补充更正报告，还是进一步核验。",
        },
      ],
    },
  },
};

/**
 * 按工具 key 与 locale 取 FAQ 内容。zh / zh-TW 用中文，其余回退英文。
 * 查不到返回空内容，页面据此跳过 Quick Answer / FAQ 段（不报错）。
 */
export function getToolFaq(tool: string, locale: string): ToolFaqContent {
  const entry = TOOL_FAQS[tool];
  if (!entry) return { quickAnswerTitle: "", quickAnswer: "", faqs: [] };
  return locale === "zh" || locale === "zh-TW" ? entry.zh : entry.en;
}

/**
 * 由 FAQ 内容生成 FAQPage 结构化数据（供页面 JsonLd 拼入）。
 * 与 compare / calculator 的 FAQPage schema 结构一致。
 */
export function faqPageJsonLd(faq: ToolFaqContent) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
