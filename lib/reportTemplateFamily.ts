// lib/reportTemplateFamily.ts —— CS-18 / CS-20 报告模板家族 单一事实来源（纯模块，零运行时依赖）
//
// ─────────────────────────────────────────────────────────────────────────────
// 方向决策（2026-09-19，用户拍板「完善」）
// ─────────────────────────────────────────────────────────────────────────────
//   **按报告用途 / 类型并列为「模板家族」，不合并、不删除任何一方代码。**
//
//   家族成员：
//     1. standard_due_diligence  —— CS-20 通用在线尽调报告（13 章），空白件由
//        lib/supplierReportTemplate.emptyReportTemplate() 生成。
//     2. social_compliance_audit —— CS-18 社会责任审核报告（7 章，SMETA 7.0 /
//        amfori BSCI），清单来自 audit_templates(code=SOCIAL_COMPLIANCE，72 项中 37 项)。
//     3. quality_audit           —— CS-18 质量审核报告（7 章，ISO 19011:2026 /
//        ISO 9001），清单来自 audit_templates(code=QUALITY，72 项中 35 项)。
//
//   三者服务对象不同：CS-20 是「通用档案 / 在线背调」，CS-18 两套是「清单式
//   现场 / 桌面审核报告」。合并会模糊语义，故并列共存。
//
//   🔴 既有代码铁律：CS-20 的 lib/standardReport.ts 与 lib/supplierReportTemplate.ts
//   **原样保留，不删除、不重构**。本文件只「登记」它们，不改动。
//
// ─────────────────────────────────────────────────────────────────────────────
// 设计纪律
// ─────────────────────────────────────────────────────────────────────────────
//   1. 纯模块：不 import 任何含样张数据 / supabase / next-headers 的模块，可被
//      服务端 + 客户端同时安全 import。类型仅从 lib/supplierReports 取（该模块本身零依赖）。
//   2. 审核报告(2/3)的清单 72 项不在此硬编码，运行时由 audit_templates 取；
//      本文件只登记「分组骨架 + 评分 / 严重度 / 证据索引」等模板元数据。
//   3. 🔴 风险口径不混用：审核报告里的 Risk Level 是 **3 档(LOW/MED/HIGH) 审核结论带**，
//      与平台 supplier risk 指数(5 档 low/moderate/elevated/high/critical)是**两回事**，
//      渲染文案必须标明，绝不可并为一档。
//   4. buildBlankAuditReport() 复用 CS-20 的 SupplierReportDoc 形状，便于未来后台
//      编辑器按家族类型一键生成正确的空白模板（延后接线，本文件不碰 UI）。

import type {
  SupplierReportDoc,
  ReportField,
  ReportTable,
  ReportTableColumn,
  ReportBullet,
  SectionKind,
} from "@/lib/supplierReports";

// ---------- 基础类型 ----------

type Bi = { en: string; zh: string };

export type ReportFamilyType =
  | "standard_due_diligence"
  | "social_compliance_audit"
  | "quality_audit";

/** 章节骨架（不含任何结论性内容；结论来自 DB / 人工填写） */
export type ChapterMeta = {
  no: string;
  titleEn: string;
  titleZh: string;
  kind: SectionKind;
  summaryEn: string;
  summaryZh: string;
};

export type ScorecardDimension = {
  key: string;
  labelEn: string;
  labelZh: string;
  /** 权重（百分点），全部维度合计 = 100 */
  weight: number;
};

export type SeverityRule = {
  level: "Critical" | "Major" | "Minor" | "Observation";
  labelEn: string;
  labelZh: string;
  definitionEn: string;
  definitionZh: string;
};

export type DecisionBand = {
  min: number;
  max: number;
  labelEn: string;
  labelZh: string;
  noteEn: string;
  noteZh: string;
};

export type EvidenceItem = { ref: string; labelEn: string; labelZh: string };

/** 章节③（审核清单）的分组引用：运行时从 audit_templates 取该组下具体检查项 */
export type ChecklistGroupRef = {
  code: string;
  titleEn: string;
  titleZh: string;
  itemCount: number;
};

export type ReportFamilyMember = {
  type: ReportFamilyType;
  label: Bi;
  edition: Bi;
  purpose: Bi;
  /** 派生来源（模块 / 文件）。不删除既有代码，仅登记。 */
  source: string;
  /** 空白报告生成器（若存在） */
  blankGenerator?: "emptyReportTemplate" | "buildBlankAuditReport";
  chapters: ChapterMeta[];
  /** 审核类报告：关联 audit_templates.code（72 项清单来源） */
  templateCode?: string;
  /** 审核类报告：清单分组骨架（运行时取具体检查项） */
  checklistGroups?: ChecklistGroupRef[];
  /** 审核类报告：买方评分卡维度与权重（合计 100） */
  scorecard?: ScorecardDimension[];
  /** 审核类报告：严重度规则 */
  severityRules?: SeverityRule[];
  /** 审核类报告：建议决策区间 */
  decisionBands?: DecisionBand[];
  /** 审核类报告：证据与买方资料索引模板 */
  evidenceIndex?: EvidenceItem[];
};

// =============================================================================
// 1. standard_due_diligence（CS-20，13 章通用尽调报告）
// =============================================================================

const STANDARD_DUE_DILIGENCE: ReportFamilyMember = {
  type: "standard_due_diligence",
  label: { en: "Standard Supplier Due-Diligence Report", zh: "标准供应商尽职调查报告" },
  edition: { en: "Standard edition · full dossier", zh: "标准版 · 完整档案" },
  purpose: {
    en: "Generic online background-check dossier for any supplier (registry, litigation, certifications, site, capability).",
    zh: "适用于任意供应商的通用在线背调档案（工商、涉诉、认证、现场、产能）。",
  },
  source: "lib/standardReport.ts + lib/supplierReportTemplate.ts (CS-20)",
  blankGenerator: "emptyReportTemplate",
  chapters: [
    { no: "01", titleEn: "Executive summary", titleZh: "执行摘要", kind: "list", summaryEn: "Weighted result of eight dimensions; strengths evidence-backed, concerns unverified.", summaryZh: "八维度加权结果；优势有证据支撑，关注项尚无法核验。" },
    { no: "02", titleEn: "Company profile", titleZh: "主体档案", kind: "fields", summaryEn: "Sourced from GSXT, cross-checked with export and site evidence.", summaryZh: "来源 GSXT，与出口记录、现场证据交叉核对。" },
    { no: "03", titleEn: "Ownership & control", titleZh: "股权与控制", kind: "table", summaryEn: "Shareholder ledger from GSXT, cross-referenced with pledge and change records.", summaryZh: "股东名册来自 GSXT，与股权出质、变更记录交叉核对。" },
    { no: "04", titleEn: "Court & enforcement records", titleZh: "涉诉与执行记录", kind: "fields", summaryEn: "China Judgements Online + SPC enforcement list.", summaryZh: "中国裁判文书网 + 全国法院被执行人信息查询。" },
    { no: "05", titleEn: "Registration changes", titleZh: "工商变更", kind: "timeline", summaryEn: "Every registration change is public; late-stage legal-rep change is a watch item.", summaryZh: "工商变更均为公开信息；后期法人变更属观察项。" },
    { no: "06", titleEn: "Tax & trade compliance", titleZh: "税务与进出口", kind: "fields", summaryEn: "Tax rating proxies how a supplier treats contracts and reporting.", summaryZh: "纳税评级是企业对待合同与申报态度的参照。" },
    { no: "07", titleEn: "Licenses & qualifications", titleZh: "经营资质", kind: "fields", summaryEn: "Operating licences and export rights, checked against issuing authority.", summaryZh: "营业执照与出口经营权，尽可能与发证机关核对。" },
    { no: "08", titleEn: "Certifications", titleZh: "认证与资质", kind: "table", summaryEn: "Authenticity checked against issuer registries; expired shown as expired, never valid.", summaryZh: "证书在发证机构登记库核验；已过期如实标注，绝不标为有效。" },
    { no: "09", titleEn: "Production capability", titleZh: "生产能力", kind: "fields", summaryEn: "Capacity from supplier submission unless third-party verified.", summaryZh: "产能来自企业自报，除非有第三方核验。" },
    { no: "10", titleEn: "Factory site verification", titleZh: "工厂实地核验", kind: "fields", summaryEn: "Satellite/street imagery + unscripted video walkthrough.", summaryZh: "卫星与街景影像 + 无脚本现场视频。" },
    { no: "11", titleEn: "Export & markets", titleZh: "出口与市场", kind: "fields", summaryEn: "Export history and main markets.", summaryZh: "出口历史与主要市场。" },
    { no: "12", titleEn: "Contact & authorization", titleZh: "联系方式与授权", kind: "fields", summaryEn: "Contact visibility and profile-display authorization gate buyer-facing report.", summaryZh: "联系可见性与资料展示授权，决定采购商可见内容。" },
    { no: "13", titleEn: "Data sources & methodology", titleZh: "数据来源与方法", kind: "list", summaryEn: "Everything not independently verified is marked 'Self-reported'.", summaryZh: "凡未经独立核验者，一律标注「企业自报」。" },
  ],
};

// =============================================================================
// 2. social_compliance_audit（CS-18，7 章社会责任审核报告）
// =============================================================================

const SOCIAL_METHODOLOGY: string[][] = [
  ["Documents", "Defined sample", "Records, certificates, logs", "Availability"],
  ["Site Tour", "Risk-based", "Observation + photos", "Point-in-time"],
  ["Interviews", "Representative", "Management / workers", "Sample size"],
  ["Payroll cross-check", "Selected months / workers", "Payroll + time + interview", "Sample-based"],
];

const SOCIAL_COMPLIANCE_AUDIT: ReportFamilyMember = {
  type: "social_compliance_audit",
  label: { en: "Supplier Social Compliance Audit Report", zh: "供应商社会责任审核报告" },
  edition: { en: "Buyer Risk & Worker Rights Edition", zh: "买方风险与员工权益版" },
  purpose: {
    en: "Checklist-driven social audit (SMETA 7.0 / amfori BSCI) answering worker-rights and buyer-risk questions.",
    zh: "清单式社会责任审核（SMETA 7.0 / amfori BSCI），回答员工权益与买方风险问题。",
  },
  source: "docs/audit-templates (SMETA 7.0 / amfori BSCI) + audit_templates(code=SOCIAL_COMPLIANCE)",
  blankGenerator: "buildBlankAuditReport",
  templateCode: "SOCIAL_COMPLIANCE",
  checklistGroups: [
    { code: "A", titleEn: "Accurate Assessment & Management Systems", titleZh: "审核真实性与管理体系", itemCount: 4 },
    { code: "B", titleEn: "Child Labour & Young Workers", titleZh: "童工与未成年工", itemCount: 3 },
    { code: "C", titleEn: "Forced Labour & Recruitment", titleZh: "强迫劳动与招聘", itemCount: 4 },
    { code: "D", titleEn: "Working Hours & Wages", titleZh: "工时与工资", itemCount: 5 },
    { code: "E", titleEn: "Freedom of Association, Discrimination & Harassment", titleZh: "结社、歧视与骚扰", itemCount: 4 },
    { code: "F", titleEn: "Health & Safety", titleZh: "健康与安全", itemCount: 6 },
    { code: "G", titleEn: "Dormitory, Canteen & Welfare", titleZh: "宿舍、食堂与福利", itemCount: 3 },
    { code: "H", titleEn: "Environment & Business Ethics", titleZh: "环境与商业道德", itemCount: 4 },
    { code: "I", titleEn: "Grievance, Privacy & Corrective Action", titleZh: "申诉、隐私与整改", itemCount: 4 },
  ],
  scorecard: [
    { key: "assessment_integrity", labelEn: "Assessment integrity & management system", labelZh: "审核真实性与管理体系", weight: 10 },
    { key: "child_young", labelEn: "Child / young worker protection", labelZh: "童工与未成年工保护", weight: 10 },
    { key: "forced_labour", labelEn: "Forced labour & recruitment", labelZh: "强迫劳动与招聘", weight: 15 },
    { key: "hours_wages", labelEn: "Working hours & wages", labelZh: "工时与工资", weight: 20 },
    { key: "discrimination", labelEn: "Discrimination / harassment / association", labelZh: "歧视 / 骚扰 / 结社", weight: 10 },
    { key: "health_safety", labelEn: "Health & safety", labelZh: "健康与安全", weight: 20 },
    { key: "welfare", labelEn: "Welfare & accommodation", labelZh: "福利与住宿", weight: 5 },
    { key: "environment_ethics", labelEn: "Environment / business ethics / records", labelZh: "环境 / 商业道德 / 记录", weight: 10 },
  ],
  severityRules: [
    { level: "Critical", labelEn: "Critical", labelZh: "严重", definitionEn: "Severe legal / human-rights or immediate life-safety risk; may require HOLD / REJECT pending buyer decision.", definitionZh: "严重法律、人权或即时生命安全风险，可能需 HOLD / REJECT 待买方决定。" },
    { level: "Major", labelEn: "Major", labelZh: "重大", definitionEn: "Material breach with meaningful worker or buyer exposure.", definitionZh: "对员工或买方形成明显风险的重大问题。" },
    { level: "Minor", labelEn: "Minor", labelZh: "轻微", definitionEn: "Limited-scope breach requiring correction.", definitionZh: "范围有限的偏差，需整改。" },
    { level: "Observation", labelEn: "Observation", labelZh: "观察项", definitionEn: "Improvement opportunity without a formal nonconformity.", definitionZh: "改进机会，非不符合项。" },
  ],
  decisionBands: [
    { min: 90, max: 100, labelEn: "Approved", labelZh: "通过", noteEn: "No critical finding.", noteZh: "无严重项。" },
    { min: 80, max: 89, labelEn: "Approved with Action", labelZh: "通过（附整改）", noteEn: "Conditional approval with required action.", noteZh: "附条件通过，需整改。" },
    { min: 70, max: 79, labelEn: "Conditional / New PO limited", labelZh: "有条件 / 限制新单", noteEn: "Conditional; restrict new PO.", noteZh: "有条件；限制新订单。" },
    { min: 0, max: 69, labelEn: "Not Approved", labelZh: "不通过", noteEn: "Any Critical finding can override the arithmetic score.", noteZh: "存在严重项可推翻算术分。" },
  ],
  evidenceIndex: [
    { ref: "E-01", labelEn: "Business licence and site profile", labelZh: "营业执照及工厂简介" },
    { ref: "E-02", labelEn: "Worker headcount, age and employment records", labelZh: "员工人数、年龄及劳动记录" },
    { ref: "E-03", labelEn: "Payroll / time records", labelZh: "工资及工时记录" },
    { ref: "E-04", labelEn: "Labour contracts and recruitment agency records", labelZh: "劳动合同及劳务记录" },
    { ref: "E-05", labelEn: "Social insurance / legal leave evidence", labelZh: "社保及法定休假证据" },
    { ref: "E-06", labelEn: "Health & safety permits, drills, inspections", labelZh: "安全许可、演练、检查" },
    { ref: "E-07", labelEn: "Chemical / SDS / PPE records", labelZh: "化学品、SDS 及 PPE 记录" },
    { ref: "E-08", labelEn: "Grievance and disciplinary records", labelZh: "申诉及纪律记录" },
    { ref: "E-09", labelEn: "Environmental permits / waste manifests", labelZh: "环保许可及废物联单" },
    { ref: "E-10", labelEn: "Worker / management interview samples", labelZh: "员工及管理层访谈样本" },
  ],
  chapters: [
    { no: "01", titleEn: "Executive Decision Summary", titleZh: "管理层决策摘要", kind: "fields", summaryEn: "Buyer decision, overall score, critical/major findings, evidence coverage, risk level (3-band audit band, NOT the 5-band platform risk score).", summaryZh: "采购建议、总分、严重/重大问题、证据覆盖、风险等级（3 档审核带，非平台 5 档风险分）。" },
    { no: "02", titleEn: "Audit Scope & Methodology", titleZh: "审核范围与方法", kind: "table", summaryEn: "Risk-based, evidence-based; buyer requirements prevail where contracted; legal mandatory.", summaryZh: "基于风险与证据；合同约定优先于买方要求；法律强制。" },
    { no: "03", titleEn: "Social Compliance Audit Checklist", titleZh: "社会责任审核清单", kind: "list", summaryEn: "17 groups (A–I), 37 checkpoints loaded from audit_templates(code=SOCIAL_COMPLIANCE).", summaryZh: "17 组（A–I）共 37 项，取自 audit_templates(code=SOCIAL_COMPLIANCE)。" },
    { no: "04", titleEn: "Findings & CAPA", titleZh: "不符合项与整改计划", kind: "table", summaryEn: "Each finding answers: what / evidence / buyer impact / root cause / verification. Severity rules apply.", summaryZh: "每项回答：事实 / 证据 / 买方影响 / 根因 / 验证。适用严重度规则。" },
    { no: "05", titleEn: "Buyer Scorecard", titleZh: "买方评分卡", kind: "table", summaryEn: "8 weighted dimensions (total 100). Decision bands: 90+ Approved, 80–89 Approved w/ Action, 70–79 Conditional, <70 Not Approved.", summaryZh: "8 个加权维度（合计 100）。决策区间：90+ 通过，80–89 通过附整改，70–79 有条件，<70 不通过。" },
    { no: "06", titleEn: "Evidence & Buyer Data Room Index", titleZh: "证据与买方资料索引", kind: "table", summaryEn: "10 evidence categories; Available / Verified marked per item.", summaryZh: "10 类证据；逐项标注「有 / 已核实」。" },
    { no: "07", titleEn: "Report Sign-off", titleZh: "报告确认", kind: "fields", summaryEn: "Auditor / Supplier / Buyer sign-off; supplier acknowledgement ≠ agreement.", summaryZh: "审核员 / 供应商 / 买方签收；供应商签收不等于同意结论。" },
  ],
};

// =============================================================================
// 3. quality_audit（CS-18，7 章质量审核报告）
// =============================================================================

const QUALITY_METHODOLOGY: string[][] = [
  ["Documents", "Defined sample", "Records, certificates, logs", "Availability"],
  ["Site Tour", "Risk-based", "Observation + photos", "Point-in-time"],
  ["Interviews", "Representative", "Management / workers", "Sample size"],
  ["Witness", "Key process", "Live production controls", "Production status"],
];

const QUALITY_AUDIT: ReportFamilyMember = {
  type: "quality_audit",
  label: { en: "Supplier Quality Audit Report", zh: "供应商质量审核报告" },
  edition: { en: "Buyer Decision Edition", zh: "买方采购决策版" },
  purpose: {
    en: "Checklist-driven quality audit (ISO 19011:2026 / ISO 9001) answering can-the-site-make-it-consistently.",
    zh: "清单式质量审核（ISO 19011:2026 / ISO 9001），回答工厂能否稳定制造合格产品。",
  },
  source: "docs/audit-templates (ISO 19011:2026 / ISO 9001) + audit_templates(code=QUALITY)",
  blankGenerator: "buildBlankAuditReport",
  templateCode: "QUALITY",
  checklistGroups: [
    { code: "A", titleEn: "Company & QMS", titleZh: "企业与质量体系", itemCount: 5 },
    { code: "B", titleEn: "Customer & Product Requirements", titleZh: "客户与产品要求", itemCount: 4 },
    { code: "C", titleEn: "Supplier & Incoming Material Control", titleZh: "供应商与来料控制", itemCount: 4 },
    { code: "D", titleEn: "Production Process Control", titleZh: "生产过程控制", itemCount: 6 },
    { code: "E", titleEn: "Inspection, Testing & Calibration", titleZh: "检验、测试与计量", itemCount: 4 },
    { code: "F", titleEn: "Traceability, Packaging & Shipment", titleZh: "追溯、包装与出货", itemCount: 4 },
    { code: "G", titleEn: "Nonconformance & CAPA", titleZh: "不合格与纠正预防", itemCount: 4 },
    { code: "H", titleEn: "Capacity, Maintenance & Business Continuity", titleZh: "产能、维护与连续经营", itemCount: 4 },
  ],
  scorecard: [
    { key: "qms_document", labelEn: "QMS & document control", labelZh: "质量体系与文件控制", weight: 15 },
    { key: "customer_product", labelEn: "Customer / product requirement control", labelZh: "客户与产品要求控制", weight: 10 },
    { key: "incoming_supplier", labelEn: "Incoming material & supplier control", labelZh: "来料与供应商控制", weight: 10 },
    { key: "process", labelEn: "Process control", labelZh: "过程控制", weight: 20 },
    { key: "inspection", labelEn: "Inspection / testing / calibration", labelZh: "检验、测试与计量", weight: 15 },
    { key: "traceability", labelEn: "Traceability & shipment", labelZh: "追溯与出货", weight: 10 },
    { key: "capacity", labelEn: "Capacity / maintenance / continuity", labelZh: "产能、维护与连续经营", weight: 10 },
    { key: "ncr_capa", labelEn: "NCR / CAPA / customer complaints", labelZh: "不合格、整改与客诉", weight: 10 },
  ],
  severityRules: [
    { level: "Critical", labelEn: "Critical", labelZh: "严重", definitionEn: "Potential shipment-blocking product safety / regulatory failure, counterfeit records, or systemic failure affecting buyer/customer safety.", definitionZh: "可能导致产品安全、法规或重大交付风险，或存在造假 / 系统性失效。" },
    { level: "Major", labelEn: "Major", labelZh: "重大", definitionEn: "Material weakness likely to cause repeated nonconforming product or significant supply risk.", definitionZh: "可能持续导致不合格或重大供应风险的明显缺陷。" },
    { level: "Minor", labelEn: "Minor", labelZh: "轻微", definitionEn: "Isolated lapse with limited direct impact, but requiring correction.", definitionZh: "局部偏差，直接影响有限，但需整改。" },
    { level: "Observation", labelEn: "Observation", labelZh: "观察项", definitionEn: "Not a nonconformity; improvement opportunity.", definitionZh: "非不符合项，属改进机会。" },
  ],
  decisionBands: [
    { min: 90, max: 100, labelEn: "Approved", labelZh: "通过", noteEn: "No critical finding.", noteZh: "无严重项。" },
    { min: 80, max: 89, labelEn: "Approved with Action", labelZh: "通过（附整改）", noteEn: "Conditional approval with required action.", noteZh: "附条件通过，需整改。" },
    { min: 70, max: 79, labelEn: "Conditional / New PO limited", labelZh: "有条件 / 限制新单", noteEn: "Conditional; restrict new PO.", noteZh: "有条件；限制新订单。" },
    { min: 0, max: 69, labelEn: "Not Approved", labelZh: "不通过", noteEn: "Any Critical finding can override the arithmetic score.", noteZh: "存在严重项可推翻算术分。" },
  ],
  evidenceIndex: [
    { ref: "E-01", labelEn: "Business licence and factory profile", labelZh: "营业执照及工厂简介" },
    { ref: "E-02", labelEn: "Organization chart and key contacts", labelZh: "组织架构及关键联系人" },
    { ref: "E-03", labelEn: "Certificates and scope", labelZh: "体系证书及范围" },
    { ref: "E-04", labelEn: "Customer specifications", labelZh: "客户规格资料" },
    { ref: "E-05", labelEn: "Approved supplier list", labelZh: "合格供应商名录" },
    { ref: "E-06", labelEn: "Production records and capacity data", labelZh: "生产记录及产能数据" },
    { ref: "E-07", labelEn: "Inspection / testing / calibration records", labelZh: "检验测试校准记录" },
    { ref: "E-08", labelEn: "Traceability sample", labelZh: "追溯样本" },
    { ref: "E-09", labelEn: "NCR / CAPA and complaint records", labelZh: "不合格、整改及客诉记录" },
  ],
  chapters: [
    { no: "01", titleEn: "Executive Decision Summary", titleZh: "管理层决策摘要", kind: "fields", summaryEn: "Buyer decision, overall score, critical/major findings, evidence coverage, risk level (3-band audit band, NOT the 5-band platform risk score).", summaryZh: "采购建议、总分、严重/重大问题、证据覆盖、风险等级（3 档审核带，非平台 5 档风险分）。" },
    { no: "02", titleEn: "Audit Scope & Methodology", titleZh: "审核范围与方法", kind: "table", summaryEn: "Risk-based, evidence-based; buyer requirements prevail where contracted; legal mandatory.", summaryZh: "基于风险与证据；合同约定优先于买方要求；法律强制。" },
    { no: "03", titleEn: "Supplier Quality Audit Checklist", titleZh: "供应商质量审核清单", kind: "list", summaryEn: "17 groups (A–H), 35 checkpoints loaded from audit_templates(code=QUALITY).", summaryZh: "17 组（A–H）共 35 项，取自 audit_templates(code=QUALITY)。" },
    { no: "04", titleEn: "Findings & CAPA", titleZh: "不符合项与整改计划", kind: "table", summaryEn: "Each finding answers: what / evidence / buyer impact / root cause / verification. Severity rules apply.", summaryZh: "每项回答：事实 / 证据 / 买方影响 / 根因 / 验证。适用严重度规则。" },
    { no: "05", titleEn: "Buyer Scorecard", titleZh: "买方评分卡", kind: "table", summaryEn: "8 weighted dimensions (total 100). Decision bands: 90+ Approved, 80–89 Approved w/ Action, 70–79 Conditional, <70 Not Approved.", summaryZh: "8 个加权维度（合计 100）。决策区间：90+ 通过，80–89 通过附整改，70–79 有条件，<70 不通过。" },
    { no: "06", titleEn: "Evidence & Buyer Data Room Index", titleZh: "证据与买方资料索引", kind: "table", summaryEn: "9 evidence categories; Available / Verified marked per item.", summaryZh: "9 类证据；逐项标注「有 / 已核实」。" },
    { no: "07", titleEn: "Report Sign-off", titleZh: "报告确认", kind: "fields", summaryEn: "Auditor / Supplier / Buyer sign-off; supplier acknowledgement ≠ agreement.", summaryZh: "审核员 / 供应商 / 买方签收；供应商签收不等于同意结论。" },
  ],
};

// =============================================================================
// 家族登记（顺序即展示顺序）
// =============================================================================

export const REPORT_FAMILY_ORDER: ReportFamilyType[] = [
  "standard_due_diligence",
  "social_compliance_audit",
  "quality_audit",
];

export const REPORT_FAMILY: Record<ReportFamilyType, ReportFamilyMember> = {
  standard_due_diligence: STANDARD_DUE_DILIGENCE,
  social_compliance_audit: SOCIAL_COMPLIANCE_AUDIT,
  quality_audit: QUALITY_AUDIT,
};

/** 审核类家族成员（social / quality），其清单来自 audit_templates */
export const AUDIT_FAMILY_TYPES: ReportFamilyType[] = [
  "social_compliance_audit",
  "quality_audit",
];

// =============================================================================
// 读取辅助
// =============================================================================

export function listReportFamily(): Array<{
  type: ReportFamilyType;
  label: Bi;
  edition: Bi;
  purpose: Bi;
  chapterCount: number;
  source: string;
  blankGenerator?: ReportFamilyMember["blankGenerator"];
  templateCode?: string;
}> {
  return REPORT_FAMILY_ORDER.map((t) => {
    const m = REPORT_FAMILY[t];
    return {
      type: m.type,
      label: m.label,
      edition: m.edition,
      purpose: m.purpose,
      chapterCount: m.chapters.length,
      source: m.source,
      blankGenerator: m.blankGenerator,
      templateCode: m.templateCode,
    };
  });
}

export function getReportTemplate(type: ReportFamilyType): ReportFamilyMember | null {
  return REPORT_FAMILY[type] ?? null;
}

// =============================================================================
// buildBlankAuditReport —— 生成空白审核报告（复用 CS-20 的 SupplierReportDoc 形状）
//
// 🔴 反伪造：任何结论性内容一律空白；只预填「结构 + 方法 + 评分权重 + 证据索引项」。
//    overall_score = null（未评分，绝不补 0）。
// =============================================================================

import { DEFAULT_DISCLAIMER } from "@/lib/supplierReports";

function methodologyRows(type: ReportFamilyType): string[][] {
  if (type === "social_compliance_audit") return SOCIAL_METHODOLOGY;
  if (type === "quality_audit") return QUALITY_METHODOLOGY;
  return [];
}

export type BlankAuditMeta = {
  reportNumber?: string;
  reportDate?: string;
  preparedFor?: string;
};

export function buildBlankAuditReport(
  type: "social_compliance_audit" | "quality_audit",
  meta: BlankAuditMeta = {}
): SupplierReportDoc {
  const m = REPORT_FAMILY[type];

  const f = (lEn: string, lZh: string): ReportField => ({ lEn, lZh, v: "", level: null });

  const table = (headers: ReportTableColumn[], rows: string[][]): ReportTable => ({
    headers,
    rows,
    statusCol: null,
  });

  const bullet = (en: string, zh: string): ReportBullet => ({ en, zh });

  // 章节① 管理层决策摘要（KPI 字段）
  const ch1Fields: ReportField[] = [
    f("Buyer Decision (APPROVE / CONDITIONAL / HOLD / REJECT)", "采购建议（通过 / 有条件 / 暂缓 / 不通过）"),
    f("Overall Score (/100)", "总分（/100）"),
    f("Critical Findings", "严重问题"),
    f("Major Findings", "重大问题"),
    f("Evidence Coverage (%)", "证据覆盖（%）"),
    f("Risk Level (LOW / MED / HIGH — audit band, not platform risk)", "风险等级（低 / 中 / 高 — 审核带，非平台风险分）"),
  ];

  // 章节② 范围与方法（方法表）
  const ch2 = table(
    [
      { en: "Audit Method", zh: "方法" },
      { en: "Sample", zh: "抽样" },
      { en: "Evidence Type", zh: "证据" },
      { en: "Limitation", zh: "局限" },
    ],
    methodologyRows(type)
  );

  // 章节③ 审核清单（分组引用；具体 72 项运行时从 audit_templates 取）
  const ch3Bullets: ReportBullet[] = (m.checklistGroups ?? []).map((g) =>
    bullet(
      `${g.code}. ${g.titleEn} (${g.itemCount} checkpoints)`,
      `${g.code}. ${g.titleZh}（${g.itemCount} 项）`
    )
  );

  // 章节④ 不符合项与 CAPA（8 列空表）
  const ch4 = table(
    [
      { en: "ID", zh: "编号" },
      { en: "Severity", zh: "严重度" },
      { en: "Requirement", zh: "要求" },
      { en: "Objective Evidence", zh: "客观证据" },
      { en: "Risk", zh: "风险" },
      { en: "Root Cause", zh: "根因" },
      { en: "Action + Due Date", zh: "整改 + 期限" },
      { en: "Verification", zh: "验证" },
    ],
    []
  );

  // 章节⑤ 买方评分卡（权重预填，得分 / 备注空白）
  const ch5 = table(
    [
      { en: "Dimension", zh: "维度" },
      { en: "Weight", zh: "权重" },
      { en: "Score", zh: "得分" },
      { en: "Comment", zh: "备注" },
    ],
    (m.scorecard ?? []).map((d) => [d.labelEn, String(d.weight), "", ""])
  );

  // 章节⑥ 证据与买方资料索引（Ref + 证据预填，有 / 已核实空白）
  const ch6 = table(
    [
      { en: "Ref", zh: "编号" },
      { en: "Evidence", zh: "证据" },
      { en: "Available", zh: "有" },
      { en: "Verified", zh: "已核实" },
    ],
    (m.evidenceIndex ?? []).map((e) => [e.ref, e.labelEn, "", ""])
  );

  // 章节⑦ 报告确认（签收字段）
  const ch7Fields: ReportField[] = [
    f("Auditor", "审核员"),
    f("Supplier", "供应商"),
    f("Buyer", "买方"),
    f("Date", "日期"),
    f("Supplier acknowledgement", "供应商确认"),
    f("Report status (Draft / Final)", "报告状态（草稿 / 终稿）"),
    f("Next review", "下一次复核"),
    f("Confidentiality level", "保密等级"),
  ];

  return {
    reportNumber: meta.reportNumber ?? "",
    reportDate: meta.reportDate ?? "",
    preparedFor: meta.preparedFor ?? "",
    overallScore: null,
    scoreNote: "",
    sections: [
      {
        no: "01",
        titleEn: m.chapters[0].titleEn,
        titleZh: m.chapters[0].titleZh,
        introEn: m.chapters[0].summaryEn,
        introZh: m.chapters[0].summaryZh,
        kind: "fields",
        fields: ch1Fields,
        table: null,
        items: [],
        bullets: [],
      },
      {
        no: "02",
        titleEn: m.chapters[1].titleEn,
        titleZh: m.chapters[1].titleZh,
        introEn: m.chapters[1].summaryEn,
        introZh: m.chapters[1].summaryZh,
        kind: "table",
        fields: [],
        table: ch2,
        items: [],
        bullets: [],
      },
      {
        no: "03",
        titleEn: m.chapters[2].titleEn,
        titleZh: m.chapters[2].titleZh,
        introEn: m.chapters[2].summaryEn,
        introZh: m.chapters[2].summaryZh,
        kind: "list",
        fields: [],
        table: null,
        items: [],
        bullets: ch3Bullets,
      },
      {
        no: "04",
        titleEn: m.chapters[3].titleEn,
        titleZh: m.chapters[3].titleZh,
        introEn: m.chapters[3].summaryEn,
        introZh: m.chapters[3].summaryZh,
        kind: "table",
        fields: [],
        table: ch4,
        items: [],
        bullets: [],
      },
      {
        no: "05",
        titleEn: m.chapters[4].titleEn,
        titleZh: m.chapters[4].titleZh,
        introEn: m.chapters[4].summaryEn,
        introZh: m.chapters[4].summaryZh,
        kind: "table",
        fields: [],
        table: ch5,
        items: [],
        bullets: [],
      },
      {
        no: "06",
        titleEn: m.chapters[5].titleEn,
        titleZh: m.chapters[5].titleZh,
        introEn: m.chapters[5].summaryEn,
        introZh: m.chapters[5].summaryZh,
        kind: "table",
        fields: [],
        table: ch6,
        items: [],
        bullets: [],
      },
      {
        no: "07",
        titleEn: m.chapters[6].titleEn,
        titleZh: m.chapters[6].titleZh,
        introEn: m.chapters[6].summaryEn,
        introZh: m.chapters[6].summaryZh,
        kind: "fields",
        fields: ch7Fields,
        table: null,
        items: [],
        bullets: [],
      },
    ],
    actions: [],
    disclaimerEn: DEFAULT_DISCLAIMER.en,
    disclaimerZh: DEFAULT_DISCLAIMER.zh,
    status: "draft",
  };
}
