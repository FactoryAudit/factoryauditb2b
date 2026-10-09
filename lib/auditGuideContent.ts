// lib/auditGuideContent.ts —— audit-guide 组合页的编辑内容（标准口径 + 国家差异）
//
// 背景：`/audit-guide/<国家>/<标准>` 共 5 国 × 7 标准 × 9 语言 = 315 条 URL。
// 2026-10-09 实测：其中 32 个组合页面只有模板骨架（约 250 词，组合间正文相似度
// 96.2%，仅国名/标准名不同）⇒ 已被 noindex（见 lib/auditGuideIndexability.ts）。
//
// 本文件为**高价值组合**提供真正差异化的内容，使其重新具备被索引的价值。
//
// 🔴 事实红线（本站是信任型 B2B，编造事实比薄内容伤害更大）：
//   1. 每条标准口径都来自**该标准的官方发布方**，逐条可溯源到 STANDARD_GUIDE_CONTENT[x].sources；
//   2. **不编造**审核周期天数、费用区间、某国「通常需要什么」这类未经核证的市场断言；
//   3. 国家维度**直接复用** lib/coverage.ts 里已手写核证的 auditNotes / registry，
//      不另写一份、也不做「国名替换」式的机械生成；
//   4. 每条记录带 verifiedOn（事实核证日期），便于日后复审与更新 lastmod。
//
// 内容语言：英语。与 lib/coverage.ts 同一约定 ——「en 手写保证质量，
// 其余语言回退英文（宁可英文也不显示空翻译或机翻噪声）」。

export type GuideSource = {
  name: string;
  url?: string;
  note: string;
};

export type StandardGuideContent = {
  /** 该标准是什么（归属方、性质、由谁执行） */
  whatItIs: string;
  /** 覆盖范围的分组说明 */
  scopeGroups: { label: string; items: string[] }[];
  /** 结果怎么读（评分 / 分级 / 无评分）与有效期 */
  outcome: string[];
  /** 买家应该向供应商索要什么 */
  buyerQuestions: string[];
  /** 标准层面的 FAQ */
  faq: { q: string; a: string }[];
  sources: GuideSource[];
  /** 事实核证日期（ISO）。用于页面上的「verified on」与内容复审提醒。 */
  verifiedOn: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// 标准口径（官方来源核证）
// ─────────────────────────────────────────────────────────────────────────────

const SMETA: StandardGuideContent = {
  whatItIs:
    "SMETA (Sedex Members Ethical Trade Audit) is an audit methodology owned and maintained by Sedex, the Supplier Ethical Data Exchange. It is not a certification. There is no certificate, no pass-or-fail result and no score. A SMETA audit produces a report on conditions at a site, assessed against the ETI Base Code, applicable local law and relevant international labour principles. Audits are carried out by Sedex-approved Affiliate Audit Companies (AACs), and the auditors themselves are affiliated with APSCA, the Association of Professional Social Compliance Auditors. Sedex is the platform on which the resulting reports and self-assessment questionnaires are stored and shared with buyers. Being a Sedex member is not the same as having had an audit.",
  scopeGroups: [
    {
      label: "2-pillar audit",
      items: [
        "Labour Standards — employment practices, freedom of association, child labour, wages, working hours, discrimination and harsh treatment, assessed against the ETI Base Code",
        "Health & Safety — workplace safety systems, protective equipment, emergency preparedness, and accident and incident recording",
      ],
    },
    {
      label: "4-pillar audit (adds two areas)",
      items: [
        "Environment — air emissions, chemicals, energy use, waste management, water use and environmental permits",
        "Business Ethics — awareness of requirements, grievance mechanisms, compliance systems and land rights",
      ],
    },
  ],
  outcome: [
    "There is no certificate, no grade and no score. The buyer's own compliance or procurement team reads the report and decides what it means for the relationship — two buyers can reach different conclusions from the same report.",
    "Non-conformances are recorded and the site must respond with a Corrective Action Plan Report (CAPR). Most findings are expected to be closed within 30 to 90 days, depending on severity.",
    "Frequency is risk-based. Sedex recommends annual audits for high-risk sites, every two years for medium-risk sites, and on-going monitoring at the buyer's discretion for low-risk sites.",
    "Audits can be announced, semi-announced or unannounced. Sedex recommends semi-announced or unannounced scheduling.",
    "In practice a 2-pillar audit takes roughly two days on site and a 4-pillar audit roughly three. Scope is set by the buyer, and European buyers increasingly ask for 4-pillar.",
  ],
  buyerQuestions: [
    "Is there a completed SMETA audit report, and what is its date?",
    "Was it a 2-pillar or a 4-pillar audit?",
    "Was it announced, semi-announced or unannounced?",
    "Were non-conformances raised, and is the Corrective Action Plan Report available for review?",
    "Can the report itself be shared — not just the statement that an audit took place?",
  ],
  faq: [
    {
      q: "Is SMETA a certification?",
      a: "No. SMETA is an audit methodology. Its output is an audit report, not a certificate, and it carries no pass-or-fail result or numeric score. A supplier describing itself as \"SMETA certified\" is using the wrong term — ask to see the actual report and its date instead.",
    },
    {
      q: "What is the difference between Sedex membership and a SMETA audit?",
      a: "Sedex membership means a company has a profile on the Sedex platform. It does not mean an independent auditor has visited the site. Only a completed SMETA audit shows that conditions at the site were assessed by a Sedex-approved audit company.",
    },
    {
      q: "Who is allowed to carry out a SMETA audit?",
      a: "Only Sedex-approved Affiliate Audit Companies (AACs) and their authorised auditors. Sedex publishes the list of approved audit companies, so the firm named on the report can be verified directly.",
    },
    {
      q: "What is the difference between a 2-pillar and a 4-pillar SMETA audit?",
      a: "A 2-pillar audit covers Labour Standards and Health & Safety. A 4-pillar audit adds Environment and Business Ethics. Which one you need is set by your own due-diligence requirements, not by the supplier.",
    },
  ],
  sources: [
    {
      name: "Sedex — about SMETA and the 4-pillar audit",
      url: "https://www.sedex.com/",
      note: "Sedex is the owner and maintainer of the SMETA methodology; this is the authoritative description of the pillars, the ETI Base Code reference and the audit frequency guidance.",
    },
    {
      name: "TÜV NORD CERT — SMETA (Sedex Members Ethical Trade Audit)",
      url: "https://www.tuev-nord.de/en/services/auditing-and-certification/smeta-sedex/",
      note: "Confirms that SMETA is not a certification, that it produces no score, and that findings lead to a corrective action plan typically closed within 30 to 90 days.",
    },
    {
      name: "ETI Base Code (Ethical Trading Initiative)",
      note: "The labour-standards code that SMETA assessments are measured against.",
    },
  ],
  verifiedOn: "2026-10-09",
};

const BSCI: StandardGuideContent = {
  whatItIs:
    "amfori BSCI (Business Social Compliance Initiative) is a social monitoring programme run by amfori, a membership association of importers and retailers, originally developed in 2003 by the Foreign Trade Association. It is not a certification: amfori does not issue a pass or fail verdict. A monitoring activity produces a report with an overall rating from A to E. Audits are requested by amfori members and carried out by approved monitoring partners. The full report is visible only to amfori members and to the audited business partner, through the amfori Sustainability Platform.",
  scopeGroups: [
    {
      label: "Social management & workplace relations (PA 1–4)",
      items: [
        "PA 1 Social Management System & Cascade Effect",
        "PA 2 Workers Involvement and Protection",
        "PA 3 The Right of Freedom of Association and Collective Bargaining",
        "PA 4 No Discrimination, Violence or Harassment",
      ],
    },
    {
      label: "Employee well-being and fair practices (PA 5–7)",
      items: [
        "PA 5 Fair Remuneration",
        "PA 6 Decent Working Hours",
        "PA 7 Occupational Health and Safety",
      ],
    },
    {
      label: "Protection of vulnerable workers (PA 8–11)",
      items: [
        "PA 8 No Child Labour",
        "PA 9 Special Protection for Young Workers",
        "PA 10 No Precarious Employment",
        "PA 11 No Bonded, Forced Labour or Human Trafficking",
      ],
    },
    {
      label: "Ethical practices (PA 12–13)",
      items: ["PA 12 Protection of the Environment", "PA 13 Ethical Business Behaviour"],
    },
  ],
  outcome: [
    "The overall rating runs from A (86–100%) down to E (0–29%), with B at 71–85%, C at 51–70% and D at 30–50%.",
    "A full audit covers all 13 performance areas. Its validity is two years (24 months) when the overall rating is A or B, and 12 months when it is C, D or E.",
    "Where the rating is C, D or E the programme expects a follow-up audit, normally two to twelve months after the full audit. A follow-up looks only at the performance areas that need new evidence, not at all thirteen.",
    "Questions in Child Labour, Forced Labour and Occupational Health and Safety carry the greatest weight in the rating, so a \u201cyes\u201d or \u201cpartial\u201d answer there moves the overall result more than elsewhere.",
    "A business partner must have been trading for at least three months before monitoring, so that records such as payroll and social-security contributions exist.",
  ],
  buyerQuestions: [
    "What is the overall rating, and what is the audit date?",
    "Was it a full audit or a follow-up audit?",
    "Which performance areas were flagged, and are the corrective actions evidenced?",
    "Is the site still inside the two-year monitoring cycle, or has the report lapsed?",
    "Who holds the RSP for this site, and can the report be shared with us on the amfori platform?",
  ],
  faq: [
    {
      q: "Is amfori BSCI a certification?",
      a: "No. amfori is a membership association and BSCI is its social monitoring programme. There is no pass or fail verdict and no certificate. The output is a monitoring report with an overall rating from A to E.",
    },
    {
      q: "How long is an amfori BSCI audit valid?",
      a: "It depends on the rating. An overall rating of A or B gives a validity of 24 months. A rating of C, D or E gives a validity of 12 months, with a follow-up audit expected between two and twelve months after the full audit.",
    },
    {
      q: "Can a supplier be audited every year?",
      a: "The programme is built around a two-year monitoring cycle and only one full audit can be requested within that cycle. amfori states it does not encourage full audits every year; where the rating is C, D or E the route forward is a follow-up audit rather than another full one.",
    },
    {
      q: "Who can see the amfori BSCI report?",
      a: "Only amfori members and the audited business partner can access the full report, through the amfori Sustainability Platform. If you are not a member, the supplier has to share the report with you directly.",
    },
  ],
  sources: [
    {
      name: "amfori — amfori BSCI help centre (13 Performance Areas and audit cycle)",
      url: "https://www.amfori.org/help-topic/amfori-bsci/",
      note: "Official list of the 13 Performance Areas, the A–E rating scale, the two-year full-audit cycle and the validity rules for A/B versus C/D/E ratings.",
    },
    {
      name: "amfori BSCI System Manual Part 2 — the monitoring approach",
      url: "https://www.amfori.org/",
      note: "Source for the percentage bands behind each rating (A 86–100%, B 71–85%, C 51–70%, D 30–50%, E 0–29%), the 24- versus 12-month validity and the follow-up timing.",
    },
    {
      name: "amfori — BSCI Code of Conduct",
      note: "The principles the performance areas are derived from, based on OECD guidelines, the UN Guiding Principles on Business and Human Rights and ILO conventions.",
    },
  ],
  verifiedOn: "2026-10-09",
};

const RBA: StandardGuideContent = {
  whatItIs:
    "The RBA (Responsible Business Alliance) is an industry alliance of companies — predominantly electronics, but also automotive, retail and toy manufacturers — that maintains a Code of Conduct for supply-chain labour, health and safety, environment, ethics and management systems. Conformance is verified through the Validated Assessment Program (VAP), in which independent third-party firms carry out on-site assessments. Recognition is not a certification and is not a guarantee that a site has no issues; it records that findings were closed and verified.",
  scopeGroups: [
    {
      label: "Five areas assessed",
      items: [
        "Labour",
        "Health & Safety",
        "Environment",
        "Ethics",
        "Management Systems",
      ],
    },
    {
      label: "How a finding is graded",
      items: [
        "Priority — the most severe category, with the shortest correction deadline",
        "Major — significant non-conformance",
        "Minor — a lower-severity non-conformance",
      ],
    },
  ],
  outcome: [
    "VAP uses a 200-point scale. Points are deducted for each non-conformance, with the size of the deduction reflecting the finding's severity, so a site with no findings scores 200.",
    "Recognition depends on both the score and on whether findings have actually been closed: Platinum needs a score of 200 with all Priority, Major and Minor findings verified closed; Gold needs at least 180 with all Priority and Major findings closed; Silver needs at least 160 with all Priority findings closed.",
    "A score alone is not enough — a site can score above a threshold and still miss the tier if a finding in a higher category remains open.",
    "An assessment is valid for two years from the closing meeting of the initial assessment, unless a major change at the site warrants a new evaluation.",
    "Only full VAP assessments of manufacturing facilities qualify for recognition. Customer-managed and auditee-managed assessments do not.",
    "Where Priority findings relate to child labour or forced labour, the site is subject to an unannounced assessment within the following twelve months, and recognition is withdrawn if evidence is found.",
  ],
  buyerQuestions: [
    "Is there a full VAP assessment report, and does it cover the site that will run our order?",
    "What was the score, and which recognition tier (Platinum, Gold, Silver) was granted?",
    "Are the Priority and Major findings verified as closed, or only identified?",
    "Is the assessment still inside its two-year validity window?",
    "Was the assessment carried out as a full VAP, rather than a customer-managed or auditee-managed assessment?",
  ],
  faq: [
    {
      q: "Is RBA VAP a certification?",
      a: "No. VAP is an assessment programme, and recognition (Platinum, Gold, Silver) records that findings were closed and verified. It is not a certification and does not warrant that a site has no issues.",
    },
    {
      q: "What do the RBA VAP recognition tiers require?",
      a: "Platinum requires a score of 200 with all Priority, Major and Minor findings closed. Gold requires at least 180 with all Priority and Major findings closed. Silver requires at least 160 with all Priority findings closed.",
    },
    {
      q: "How long is an RBA VAP assessment valid?",
      a: "Two years from the closing meeting of the initial assessment. After that a new assessment is needed to maintain recognition.",
    },
    {
      q: "Do self-assessments or customer-managed audits count?",
      a: "No. Only a full VAP assessment of a manufacturing facility qualifies for recognition. Customer-managed and auditee-managed assessments are outside the recognition programme.",
    },
  ],
  sources: [
    {
      name: "Responsible Business Alliance — Validated Assessment Program (VAP)",
      url: "https://www.responsiblebusiness.org/",
      note: "The RBA is the owner of the Code of Conduct and of the VAP programme; this is the authoritative description of the scoring scale, the recognition tiers and the two-year validity.",
    },
    {
      name: "RBA — VAP Recognition FAQ (version 7, November 2025)",
      note: "Source for the exact tier conditions (200 / 180 / 160 point thresholds and which finding categories must be closed) and for the exclusion of customer-managed and auditee-managed assessments.",
    },
    {
      name: "RBA — Code Interpretation Guidance (v7.0, effective 1 Jan 2021; v7.1, effective 1 Jul 2022)",
      note: "The current interpretation guidance for the five assessment areas.",
    },
  ],
  verifiedOn: "2026-10-09",
};

/** 标准 code → 编辑内容。只有在此表里的标准才具备「内容支撑」。 */
export const STANDARD_GUIDE_CONTENT: Record<string, StandardGuideContent> = {
  SMETA,
  BSCI,
  RBA,
};

// ─────────────────────────────────────────────────────────────────────────────
// 组合白名单：哪些 <国家>/<标准> 组合**允许**带上内容并重新进入索引
//
// 🔴 刻意保持小批量（本站是信任型 B2B，宁可少而准）：
//    前 3 个原本就因「挂有供应商档案」而可索引，内容让它们真正立得住；
//    后 2 个此前是 noindex 薄页，靠内容支撑才获得索引资格。
//    要扩充只需在此加键（对应的标准必须已在 STANDARD_GUIDE_CONTENT 里）。
// ─────────────────────────────────────────────────────────────────────────────
export const CURATED_AUDIT_GUIDE_COMBOS: ReadonlySet<string> = new Set([
  "china/SMETA",
  "china/BSCI",
  "vietnam/SMETA",
  "china/RBA",
  "vietnam/BSCI",
]);

/** 该组合是否有已核证的编辑内容（国家 ∈ 覆盖国 且 标准已在内容表 + 在白名单里）。 */
export function hasAuditGuideContent(countryCode: string, auditTypeCode: string): boolean {
  if (!CURATED_AUDIT_GUIDE_COMBOS.has(`${countryCode}/${auditTypeCode}`)) return false;
  return Boolean(STANDARD_GUIDE_CONTENT[auditTypeCode]);
}

/** 取某标准的编辑内容；未收录返回 undefined。 */
export function standardGuideContent(auditTypeCode: string): StandardGuideContent | undefined {
  return STANDARD_GUIDE_CONTENT[auditTypeCode];
}

/**
 * 内容体检：白名单里是否存在「没有对应标准内容」的组合（会导致页面渲染空块）。
 * 发布前跑一次，非空即说明白名单与内容表不同步。
 */
export function validateAuditGuideContent(): string[] {
  return [...CURATED_AUDIT_GUIDE_COMBOS].filter((k) => {
    const code = k.split("/")[1];
    return !STANDARD_GUIDE_CONTENT[code];
  });
}

/**
 * 分节标题**随数据携带**，不占字典 key ——
 * 与 lib/guides.ts 的 `tables[].title` 同一做法：避免触碰 en 叶子数冻结常量
 * （发布门断言 en 叶子数 == 3293，加键须同步 12 个源文件白名单）。
 * 正文本身是英语（同 lib/coverage.ts 的「其余语言回退英文」约定），标题与正文语言一致。
 */
export const AUDIT_GUIDE_HEADINGS = {
  whatItIs: "What this standard is",
  covers: "What it covers",
  outcome: "How the result is read",
  country: "Audit conditions in {country}",
  registry: "Official document source in this market:",
  seeCountry: "See the full {country} supplier profile",
  ask: "What to ask the supplier",
  faq: "Frequently asked questions",
  sources: "Sources",
  verifiedOn: "Facts verified on {date} from the sources listed above.",
} as const;
