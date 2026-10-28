// lib/selfAssessmentReport.ts —— 自评问卷答案 → Self-Assessment Summary 报告（纯函数）
//
// ─────────────────────────────────────────────────────────────────────────────
// 这份报告是什么 / 不是什么（决定了它的全部设计）
// ─────────────────────────────────────────────────────────────────────────────
//   是：供应商对公司档案、管理体系、环保事项的**自述汇总**，用于向买家说明
//       "我已经声明了这些"，并明确指出**还有哪些事没人替他查过**。
//   不是：审核报告 / 核验报告 / 认证。不出现 APPROVE / HOLD / REJECT，
//       不出现总分，不出现 Risk Level，不出现 "Verified" / "Certified" / "Passed"。
//
// 🔴 六条红线（改动本文件前先读）：
//   1. **overallScore 恒为 null**（渲染「—」）。自评答案不能折算成分数——
//      一旦给了 87 分，它就变成了一个"结论"，而结论必须来自独立核验。
//   2. **所有 field 的 level 恒为 "reported"**，绝不出现 "verified"。
//   3. C/PC/NC/NA 只能**计数**，不能加权、不能排名、不能转成百分比评分。
//   4. 证书一律标注为「Declared」+ 有效期未知；不得写"持有有效证书"。
//   5. 第六章「仍需核验的事项」必须**由实际缺口动态生成**，不能写死一段泛泛的话。
//   6. 免责声明优先用调用方传入的库内版本，缺省回落 DEFAULT_DISCLAIMER —— 绝不留空。
//
// 纯模块：不 import supabase / next-headers，可被服务端与客户端同时引用。

import type {
  SupplierReportDoc,
  ReportSection,
  ReportField,
  ReportTable,
  ReportBullet,
  ReportAction,
  EvidenceLevel,
} from "@/lib/supplierReports";
import { DEFAULT_DISCLAIMER } from "@/lib/supplierReports";
import type { AssessmentTemplate, AssessmentResponses } from "@/lib/assessmentShared";
import { stageOf, formatOptionLabel } from "@/lib/assessmentShared";

/** 自评报告里所有事实性字段的证据等级：只可能是这一档 */
const REPORTED: EvidenceLevel = "reported";

export type SelfAssessmentSupplier = {
  legal_name?: string | null;
  english_name?: string | null;
  province?: string | null;
  city?: string | null;
  country_code?: string | null;
  website?: string | null;
  registration_number?: string | null;
  employees?: string | null;
  established?: number | null;
};

/**
 * 证书台账行（来自 public.supplier_certifications）。
 *
 * 🔴 为什么必须单独传入、而不是从问卷里取：
 *   问卷 SP13 只有一个单选（iso9001/iso14001/...），**没有编号、发证机构、有效期、
 *   证据文件**。证书的真实信息只存在于供应商证书台账里。报告若只读问卷，
 *   就等于把"企业勾了一下 ISO 9001"当成"持有 ISO 9001 证书"。
 */
export type SelfAssessmentCert = {
  programCode: string;
  displayName?: string | null;
  certificateNo?: string | null;
  issuingBody?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  /** VERIFIED / PENDING / REJECTED / EXPIRED（supplier_certifications.verification_status） */
  verificationStatus?: string | null;
  /** NONE / SUBMITTED / REVIEWED / VERIFIED / REJECTED / EXPIRED（evidence_status） */
  evidenceStatus?: string | null;
};

export type SelfAssessmentReportInput = {
  templates: AssessmentTemplate[];
  responses: AssessmentResponses | null;
  supplier: SelfAssessmentSupplier | null;
  /** 证书台账（supplier_certifications）。缺省 = 未取到，按"无记录"处理。 */
  certifications?: SelfAssessmentCert[];
  /** 报告编号（调用方生成，建议 SAR- 前缀以区分审核报告） */
  reportNumber: string;
  /** YYYY-MM-DD */
  reportDate: string;
  /** 这份报告给谁看（可留空，渲染时不显示该行） */
  preparedFor?: string;
  /** 库内已存的自定义免责声明；空则用 DEFAULT_DISCLAIMER */
  disclaimerEn?: string | null;
  disclaimerZh?: string | null;
};

type Bucket = "C" | "PC" | "NC" | "NA" | "OTHER";

/** 选项归一：QC 清单第四档是 NA，SC/ENV 是 CR，业务含义相同（不适用） */
function bucketOf(v: unknown): Bucket | null {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase();
  if (!s) return null;
  if (s === "C") return "C";
  if (s === "PC") return "PC";
  if (s === "NC") return "NC";
  if (s === "CR" || s === "NA" || s === "N/A") return "NA";
  return "OTHER";
}

function hasAnswer(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function text(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(", ");
  return String(v).trim();
}

/** 取值键 → 人读标签（both → Factory & trading）。非选项值原样返回。 */
function labelize(v: unknown): string {
  const s = text(v);
  return s ? formatOptionLabel(s) : s;
}

type ModuleStat = {
  code: string;
  stage: "basic" | "module";
  nameEn: string;
  nameZh: string;
  total: number;
  answered: number;
  counts: Record<Bucket, number>;
};

function statOf(tpl: AssessmentTemplate, resp: AssessmentResponses): ModuleStat {
  const counts: Record<Bucket, number> = { C: 0, PC: 0, NC: 0, NA: 0, OTHER: 0 };
  let total = 0;
  let answered = 0;
  for (const sec of tpl.sections) {
    for (const q of sec.questions) {
      total += 1;
      const v = resp[q.code];
      if (!hasAnswer(v)) continue;
      answered += 1;
      const b = bucketOf(v);
      if (b) counts[b] += 1;
    }
  }
  return {
    code: tpl.code,
    stage: stageOf(tpl),
    nameEn: tpl.name,
    nameZh: tpl.nameZh || tpl.name,
    total,
    answered,
    counts,
  };
}

function field(lEn: string, lZh: string, v: string, level: EvidenceLevel | null = REPORTED): ReportField {
  return { lEn, lZh, v, level };
}

function bullet(en: string, zh: string): ReportBullet {
  return { en, zh };
}

function section(
  no: string,
  titleEn: string,
  titleZh: string,
  introEn: string,
  introZh: string,
  kind: ReportSection["kind"]
): ReportSection {
  return { no, titleEn, titleZh, introEn, introZh, kind, fields: [], table: null, items: [], bullets: [] };
}

function table(headers: Array<{ en: string; zh: string }>, rows: string[][], statusCol: number | null = null): ReportTable {
  return { headers, rows, statusCol };
}

const CERT_LABELS: Record<string, { en: string; zh: string }> = {
  iso9001: { en: "ISO 9001", zh: "ISO 9001" },
  iso14001: { en: "ISO 14001", zh: "ISO 14001" },
  bsci: { en: "amfori BSCI", zh: "amfori BSCI" },
  smeta: { en: "SMETA", zh: "SMETA" },
  sa8000: { en: "SA8000", zh: "SA8000" },
  other: { en: "Other scheme", zh: "其他体系" },
  none: { en: "None declared", zh: "未声明任何证书" },
};

/** supplier_certifications 的三套状态枚举（claim_status / evidence_status / verification_status）
 *  合并成一套可读标签。值本身是语言中性的技术词，报告里按英文呈现。 */
const STATUS_LABELS: Record<string, string> = {
  VERIFIED: "Verified",
  PENDING: "Pending",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  NONE: "None",
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
  UNKNOWN: "Unknown",
  SELF_DECLARED: "Self-declared",
  EVIDENCE_SUBMITTED: "Evidence submitted",
  EVIDENCE_REVIEWED: "Evidence reviewed",
};

function statusLabel(v: unknown): string {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return "—";
  return STATUS_LABELS[s] ?? s;
}

export function buildSelfAssessmentReport(input: SelfAssessmentReportInput): SupplierReportDoc {
  const resp = input.responses ?? {};
  const s = input.supplier ?? {};
  const templates = [...input.templates].sort((a, b) =>
    stageOf(a) === stageOf(b) ? 0 : stageOf(a) === "basic" ? -1 : 1
  );
  const stats = templates.map((t) => statOf(t, resp));
  const basic = stats.filter((x) => x.stage === "basic");
  const modules = stats.filter((x) => x.stage === "module");
  const moduleAnswered = modules.reduce((n, m) => n + m.answered, 0);

  // ---------- 01 Scope & limitations（放最前，先声明边界） ----------
  const ch1 = section(
    "01",
    "Scope and limitations",
    "范围与局限",
    "This is a self-assessment summary compiled from the supplier's own questionnaire answers. It records what the supplier declared. It contains no independent verification, no sampling and no site visit.",
    "本报告由供应商自行填写的问卷答案汇编而成，仅记录其声明内容。报告不含任何独立核验、抽样或现场访问。",
    "list"
  );
  ch1.bullets = [
    bullet(
      "Every item in this report is marked 'Self-reported'. Nothing here has been independently confirmed by FactoryAuditB2B or a third party.",
      "本报告全部条目均为「企业自述」。未经 FactoryAuditB2B 或任何第三方独立确认。"
    ),
    bullet(
      "No overall score, grade, pass/fail or buyer recommendation is given. A self-declared answer set cannot be converted into an audit conclusion.",
      "本报告不提供总分、评级、通过/不通过或采购建议。自述答案不能折算为审核结论。"
    ),
    bullet(
      "Certificates listed are declarations by the supplier. Certificate number, issuing body, scope and validity have not been checked against the issuer's registry.",
      "所列证书均为供应商声明。证书编号、发证机构、覆盖范围与有效期均未与发证机构登记库核对。"
    ),
    bullet(
      "Chapter 06 lists what a buyer would still need to verify before relying on this supplier. That list is generated from actual gaps in this questionnaire.",
      "第六章列出买方在依赖该供应商之前仍需核验的事项。该清单由本次问卷的实际缺口生成。"
    ),
  ];

  // ---------- 02 Company profile as declared ----------
  const ch2 = section(
    "02",
    "Company profile as declared",
    "企业档案（自述）",
    "Basic identity and site information entered by the supplier. Values are reproduced as submitted, not corrected or enriched.",
    "供应商填写的基本身份与厂址信息。按原样呈现，未经修正或补充。",
    "fields"
  );
  const profileRows: Array<[string, string, unknown]> = [
    ["Legal company name (Chinese)", "企业法定名称（中文）", resp["SP01"]],
    ["Legal company name (English)", "企业英文名称", resp["SP02"]],
    ["Unified social credit code", "统一社会信用代码", resp["SP03"]],
    // SP04/SP07 存的是取值键（both / leased），报告里必须显示人读标签
    ["Business type", "企业类型", labelize(resp["SP04"])],
    ["Year established", "成立年份", resp["SP05"]],
    ["Factory site address", "工厂实际地址", resp["SP06"]],
    ["Site ownership", "厂房权属", labelize(resp["SP07"])],
    ["Total employees", "员工总人数", resp["SP08"]],
    ["Built-up floor area (m²)", "厂房建筑面积（㎡）", resp["SP09"]],
    ["Main production lines", "主要生产线数量", resp["SP10"]],
    ["Main product categories", "主营产品类别", resp["SP11"]],
    ["Main export markets", "主要出口市场", resp["SP12"]],
    ["Company website", "公司官网", resp["SP14"]],
  ];
  const FALLBACK = "—";
  ch2.fields = profileRows.map(([en, zh, v]) => field(en, zh, text(v) || FALLBACK));

  // ---------- 03 Modules completed ----------
  const ch3 = section(
    "03",
    "Questionnaire completion",
    "问卷完成情况",
    "How much of each checklist the supplier has filled in. Completion is not quality: answering every item does not mean the answer is favourable.",
    "供应商在各清单中实际填写了多少项。完成度不等于质量：全部答完不代表答案有利。",
    "table"
  );
  const allStats = [...basic, ...modules];
  ch3.table = table(
    [
      { en: "Module", zh: "模块" },
      { en: "Type", zh: "类型" },
      { en: "Items", zh: "题数" },
      { en: "Answered", zh: "已答" },
      { en: "Status", zh: "状态" },
    ],
    allStats.map((m) => [
      m.nameEn,
      m.stage === "basic" ? "Profile (required)" : "Optional module",
      String(m.total),
      String(m.answered),
      m.answered === 0 ? "Not started" : m.answered >= m.total ? "Complete" : "Partial",
    ]),
    4
  );

  // ---------- 04 Self-declared answers ----------
  const ch4 = section(
    "04",
    "Self-declared answers",
    "自述答案分布",
    "Counts of how the supplier answered each checklist. These are the supplier's own judgements, not findings. No weighting, scoring or ranking is applied.",
    "供应商在各清单中的答案计数。这些是其自身判断，不是审核发现。本报告不加权、不评分、不排名。",
    "table"
  );
  const scored = allStats.filter((m) => m.counts.C + m.counts.PC + m.counts.NC + m.counts.NA > 0);
  if (scored.length === 0) {
    // 🔴 空表必须整章不出现（sectionHasContent 要求 table.rows>0），
    //    但「没有任何评分型答案」本身是买方需要知道的事实 ⇒ 降级成 list 逐条说明，
    //    不能靠空表混过去，也不能整章删掉。
    ch4.kind = "list";
    ch4.introEn =
      "No graded checklist answers were submitted. Only the company profile module has been completed.";
    ch4.introZh = "未提交任何评分型清单答案，仅完成了企业档案模块。";
    ch4.bullets = [
      bullet(
        "Quality, social compliance and environment checklists have no responses. There is no self-declared position on child labour, working hours, wages, health and safety, process control or pollution.",
        "质量、社会责任、环保三份清单均无答案。对童工、工时、工资、健康安全、过程控制与污染防治，均无任何自述立场。"
      ),
      bullet(
        "A buyer reading this report should treat those areas as entirely unknown, not as clean.",
        "买方在阅读本报告时，应把这些领域视为完全未知，而不是没有问题。"
      ),
    ];
  } else {
    ch4.table = table(
      [
        { en: "Module", zh: "模块" },
        { en: "Answered", zh: "已答项" },
        { en: "Self-declared compliant", zh: "自评符合" },
        { en: "Partially compliant", zh: "部分符合" },
        { en: "Non-compliant", zh: "自评不符合" },
        { en: "Not applicable", zh: "不适用" },
      ],
      scored.map((m) => [
        m.nameEn,
        String(m.answered),
        String(m.counts.C),
        String(m.counts.PC),
        String(m.counts.NC),
        String(m.counts.NA),
      ])
    );
  }

  // ---------- 05 Declared certificates ----------
  //
  // 🔴 数据源优先级（2026-10-28 修）：
  //   证书台账（supplier_certifications）有记录时，**必须用台账**——它才有编号、
  //   发证机构、有效期、证据状态。问卷 SP13 只是一个单选题，拿它当"持有证书"
  //   等于把企业勾选当成事实。
  //   台账为空时保留问卷自述，并**明确写出"台账无记录"**，不留读者自己猜。
  const certs = input.certifications ?? [];
  const certKey = String(resp["SP13"] ?? "").trim().toLowerCase();
  const certLabel = CERT_LABELS[certKey];

  const ch5 = section(
    "05",
    "Declared certificates",
    "声明持有的证书",
    "Certificates on the supplier's certificate ledger. Records marked Pending have not been checked against the issuer; only records marked Verified have been.",
    "取自供应商证书台账。标注 Pending 的记录尚未与发证机构核对；仅标注 Verified 的记录已核对。",
    "table"
  );

  if (certs.length > 0) {
    const verifiedCount = certs.filter((c) => (c.verificationStatus ?? "").toUpperCase() === "VERIFIED").length;
    ch5.introEn = `The supplier's certificate ledger holds ${certs.length} record(s); ${verifiedCount} of them are marked Verified against the issuing body. Everything else is self-declared or pending review.`;
    ch5.introZh = `供应商证书台账共 ${certs.length} 条记录，其中 ${verifiedCount} 条已与发证机构核对并标注为 Verified。其余为企业自述或待审。`;
    ch5.table = table(
      [
        { en: "Certification", zh: "认证项目" },
        { en: "Certificate no.", zh: "证书编号" },
        { en: "Issuer", zh: "发证机构" },
        { en: "Expires", zh: "有效期至" },
        { en: "Verification", zh: "核验" },
        { en: "Evidence", zh: "证据" },
      ],
      certs.map((c) => [
        (c.displayName || c.programCode || FALLBACK).trim(),
        (c.certificateNo || FALLBACK).trim(),
        (c.issuingBody || FALLBACK).trim(),
        (c.expiryDate || FALLBACK).trim(),
        statusLabel(c.verificationStatus),
        statusLabel(c.evidenceStatus),
      ]),
      4
    );
  } else {
    // 台账为空：退回问卷自述，并如实说明台账状态
    ch5.kind = "fields";
    ch5.introEn =
      "The supplier's certificate ledger contains no records — nothing has been uploaded or checked. The only signal available is the supplier's own answer in the company profile questionnaire, reproduced below.";
    ch5.introZh =
      "该供应商证书台账中没有任何记录，尚未上传或核验过任何证书。目前唯一可用的信号是其在企业档案问卷里的自述，如实转述如下。";
    ch5.fields = [
      field("Management system certificate (self-declared)", "管理体系证书（自述）", certLabel ? certLabel.en : FALLBACK),
      field("Certificate number / issuer / validity", "证书编号 / 发证机构 / 有效期", FALLBACK),
    ];
  }

  // ---------- 06 Coverage against the 13-chapter standard report ----------
  //
  // 🔴 2026-10-28（用户要求：「报告要与 /zh/standard-report 对应」）：
  //   /standard-report 展示的是 13 章标准尽调报告（01 执行摘要 … 13 数据来源）。
  //   自评报告如果另起一套章节，买家会看成两个产品，且会误以为拿到的是同一份东西。
  //   这里用一张 13 行对照表把两套报告**接上**：哪几章覆盖了、覆盖到什么程度、
  //   剩下几章要靠什么动作才能有 —— 买家一眼看清「这份是标准报告的第几层」。
  //   表格单元格是单语（ReportTable 的设计），故用英文；章节标题双语。
  const coverage = section(
    "06",
    "Coverage against the 13-chapter standard report",
    "与 13 章标准尽调报告的对应关系",
    "The Standard Supplier Due-Diligence Report has 13 chapters. This self-assessment covers part of chapters 02, 08, 09 and 13, and none of the rest. Every gap below is closable — the column on the right names the check that closes it.",
    "标准供应商尽职调查报告共 13 章。本自评覆盖第 02、08、09、13 章的一部分，其余各章完全未覆盖。下表每一项缺口都可关闭——右列写明需要哪项核查。",
    "table"
  );
  coverage.table = table(
    [
      { en: "Ch.", zh: "章" },
      { en: "Standard chapter", zh: "标准章节" },
      { en: "In this report", zh: "本报告覆盖情况" },
      { en: "Closes with", zh: "补齐方式" },
    ],
    [
      ["01", "Executive summary", "No — a self-assessment carries no score or recommendation", "Independent verification"],
      ["02", "Company profile", "Yes — as declared (unverified)", "—"],
      ["03", "Ownership & control", "No", "Registry shareholder check"],
      ["04", "Court & enforcement records", "No", "Litigation & enforcement search"],
      ["05", "Registration changes", "No", "Registry change history"],
      ["06", "Tax & trade compliance", "No", "Tax filing review"],
      ["07", "Licenses & qualifications", "No", "Licence check with issuing authority"],
      ["08", "Certifications", "Partial — declared only, no issuer check", "Certificate verification"],
      ["09", "Production capability", "Partial — supplier answers, unverified", "On-site audit"],
      ["10", "Factory site verification", "No", "On-site audit or video walkthrough"],
      ["11", "Export & markets", "Partial — as declared", "Export record check"],
      ["12", "Contact & authorization", "No", "Contact & authorization verification"],
      ["13", "Data sources & methodology", "Yes — sources named in every chapter", "—"],
    ],
    // statusCol 置 null：这一列是"覆盖情况"的自由文本，不是 valid/expired 那类
    // 受控状态枚举，若传下标会被渲染器按状态色处理 ⇒ 出现没有语义的颜色。
    null
  );

  // ---------- 07 What a buyer still needs verified（动态缺口 → 服务） ----------
  const ch6 = section(
    "07",
    "What a buyer still needs to verify",
    "买方仍需核验的事项",
    "Generated from the gaps in this submission. Each item names the check that would close it.",
    "由本次提交的实际缺口生成。每条都注明可通过哪项核查关闭。",
    "list"
  );

  const gaps: ReportBullet[] = [];

  if (modules.every((m) => m.answered === 0)) {
    gaps.push(
      bullet(
        "No management-system or compliance checklist has been answered. The supplier's quality, labour and environmental position is entirely undocumented beyond the company profile. — Closes with: a desk review plus a factory audit covering quality and social compliance.",
        "未填写任何管理体系或合规清单。除企业档案外，其质量、劳工与环保状况完全无记录。—— 可通过：桌面审查 + 覆盖质量与社会责任的现场工厂审核关闭。"
      )
    );
  } else {
    for (const m of modules) {
      if (m.answered === 0) {
        gaps.push(
          bullet(
            `${m.nameEn}: 0 of ${m.total} items answered. — Closes with: the corresponding on-site or desk assessment.`,
            `${m.nameZh}：${m.total} 项中 0 项已答。—— 可通过：对应的现场或桌面评估关闭。`
          )
        );
      } else if (m.answered < m.total) {
        gaps.push(
          bullet(
            `${m.nameEn}: only ${m.answered} of ${m.total} items answered, so the module cannot be relied on as a complete statement. — Closes with: completing the module, then an independent check of the answered items.`,
            `${m.nameZh}：${m.total} 项中仅答 ${m.answered} 项，无法作为完整陈述使用。—— 可通过：补齐该模块后，对已答项做独立核查关闭。`
          )
        );
      }
    }
    const nc = modules.reduce((n, m) => n + m.counts.NC, 0);
    const pc = modules.reduce((n, m) => n + m.counts.PC, 0);
    if (nc + pc > 0) {
      gaps.push(
        bullet(
          `The supplier itself marked ${nc} item(s) non-compliant and ${pc} partially compliant. These are self-declared weaknesses, not findings, and none of them has a corrective-action record attached. — Closes with: an audit that verifies the gaps on site and agrees a corrective-action plan.`,
          `供应商自评有 ${nc} 项不符合、${pc} 项部分符合。这些是自述短板而非审核发现，且均未附整改记录。—— 可通过：现场审核核实缺口并确认整改计划关闭。`
        )
      );
    }
  }

  if (certKey && certKey !== "none") {
    gaps.push(
      bullet(
        "The certificate claimed has not been checked against the issuer's registry for number, scope, site coverage or expiry. — Closes with: certificate verification against the issuing body.",
        "所声明证书的编号、范围、覆盖厂址与有效期均未与发证机构登记库核对。—— 可通过：向发证机构核验证书关闭。"
      )
    );
  } else {
    gaps.push(
      bullet(
        "No management-system certificate is declared. If the buyer's programme requires one, this is a procurement blocker until evidenced. — Closes with: a supplier document request, then a verification of whatever is produced.",
        "未声明任何管理体系证书。若买方项目要求证书，在有证据前这属于采购障碍。—— 可通过：向供应商索取文件，再对所提供的材料做核验关闭。"
      )
    );
  }

  gaps.push(
    bullet(
      "The production site itself has not been visited. Address, ownership, equipment, capacity and headcount are all as declared. — Closes with: an on-site factory audit, or a video walkthrough for a lighter screen.",
      "生产现场未经访问。地址、权属、设备、产能与人数均为自述。—— 可通过：现场工厂审核关闭；轻量筛查可用视频走场。"
    )
  );

  ch6.bullets = gaps;

  // ---------- 组装 ----------
  const actions: ReportAction[] = [
    {
      en: "Complete the optional modules (quality, social compliance, environment) so buyers can read a full statement instead of a partial one.",
      zh: "补齐可选模块（质量、社会责任、环保），让买方读到完整陈述而非片段。",
    },
    {
      en: "Upload certificate copies and key documents so the declarations in Chapter 05 can be checked.",
      zh: "上传证书扫描件与关键文件，使第五章的声明可被核对。",
    },
    {
      en: "Request an independent factory audit to convert this self-assessment into evidence-backed findings.",
      zh: "申请独立工厂审核，把本自评转换为有证据支撑的审核发现。",
    },
  ];

  return {
    reportNumber: input.reportNumber,
    reportDate: input.reportDate,
    preparedFor: input.preparedFor ?? "",
    // 🔴 恒为 null：自评不给分。
    overallScore: null,
    // 留空 ⇒ 渲染器使用内置双语「No score has been assigned / 本报告尚未评分」。
    // 「为什么没分」的完整解释在 01 章双语 bullet 里，避免单语 scoreNote 在中文版露英文。
    scoreNote: "",
    sections: [ch1, ch2, ch3, ch4, ch5, coverage, ch6],
    actions,
    disclaimerEn: (input.disclaimerEn ?? "").trim() || DEFAULT_DISCLAIMER.en,
    disclaimerZh: (input.disclaimerZh ?? "").trim() || DEFAULT_DISCLAIMER.zh,
    status: "draft",
  };
}

/** 报告编号：SAR-<YYYYMMDD>-<slug 前 6 位大写>，与审核报告（无前缀）明显区分 */
export function selfAssessmentReportNumber(slug: string, date: Date): string {
  const d = date;
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const s = (slug || "supplier").replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "SUPPLR";
  return `SAR-${ymd}-${s}`;
}
