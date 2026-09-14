// lib/seo/supplierSeo.ts — Supplier Profile 的 SEO / GEO / AI-search 唯一推导层
//
// 为什么单开一个文件（而不是散在 page.tsx 里）：
//   供应商档案既是页面，也是一条需要被搜索引擎与 AI 检索系统**独立理解**的资产。
//   标题 / 描述 / Buyer Snapshot / FAQ / Schema / canonical / 可索引性 这七件事
//   必须由同一份事实推导，否则页面 H1 说 A、meta 说 B、JSON-LD 说 C，
//   Google 与 AI 都无法确定哪个是真的。
//
// 三条不可绕过的不变式：
//   1. **只用已公开的真实数据**。本文件不读数据库、不做裁剪判断 —— 调用方只允许传入
//      已经过 `lib/access.ts` 公开层过滤的字段（public 层 + 已核验公开内容）。
//      这里绝不接受 free / paid 层字段，否则付费内容会经 meta / JSON-LD 泄漏到 RSC payload。
//   2. **无据不声称**。核验等级只在存在真实核验事件时为真（由调用方用 CS-02 的
//      `publicVerificationLevel` 算好传入，本文件不自行降级/升级）；
//      「自述证书」与「平台核验证书」是两条轴，任何文案都不得交叉填充。
//   3. **数据库事实 = 页面可见内容 = JSON-LD**。凡进入 Schema 的字段，
//      页面上必须能看到同一条事实；反之亦然。
//
// 📌 文案策略（与 lib/coverage.ts / lib/industryContent.ts 同一约定）：
//   新增文案只有 en / zh 两版手写，zh-TW 就地繁化，其余 6 种语言**回退英文**。
//   理由：本文件产出的文案量很小但语义极敏感（核验声明 / 免责声明 / FAQ 问答），
//   机翻一旦失真就是合规风险；宁可显示准确的英文，也不显示失真的本地化文案。
//   这是一个**已知缺口**，补齐需要把文案迁进字典（九语键集必须与 en 完全一致）。
//
// 明确不做（PHASE 03 范围外）：
//   · 不新增 `<meta name="keywords">`（§41 禁止）。`generateSupplierKeywordTargets()`
//     返回的是**内容选题/内部对齐用**的检索意图清单，不是要输出的 meta。
//   · 不输出 Product / LocalBusiness Schema（无结构化产品数据；平台不是当地实体）。
//   · 不改动风险分算法、核验数据、数据库结构。

import { canonicalFor } from "../../i18n/hreflang";
import { localePath, type Locale } from "../../i18n/config";
import { twText } from "../tw";
import { overallLevel, type RiskLevel } from "../riskEngine";
import { LEVEL_SCOPE, publicVerificationLevel } from "../verification";

export const SEO_BASE = "https://factoryauditb2b.com";

/** 目录路径（与 lib/queries.ts / app/[locale]/suppliers 保持一致） */
export const SUPPLIER_DIRECTORY_PATH = "/suppliers";

// =============================================================================
// 输入：调用方组装好的「纯事实」
// =============================================================================

/**
 * 供应商 SEO 输入。**全部字段只允许来自公开层**。
 *
 * ⚠️ 刻意不接收 `employees` / `established` / `exportMarkets` / `certifications`
 *    （free / paid 层）—— 让「游客不该看到的值」在类型层面就传不进来。
 */
export type SupplierSeoData = {
  slug: string;
  /** 真实公司名（H1 与 title 的主体，绝不用关键词堆砌） */
  legalName: string;
  /** 企业对外英文名（CS-12，公开层） */
  englishName?: string;
  countryCode: string;
  /** 国家展示名（已本地化） */
  countryName: string;
  city: string;
  industryCode?: string;
  /** 行业展示名（已本地化，可缺省） */
  industryName?: string;
  businessType: string;
  /** 公开层工商登记信息（CS-12） */
  website?: string;
  registrationNumber?: string;
  address?: string;
  companyType?: string;
  /** 主要产品（供应商自述，公开层） */
  mainProducts: string[];

  // ---- 核验轴（由调用方用 CS-02 publicVerificationLevel 算好）----
  /** 公开核验等级 0–4 */
  verificationLevel: number;
  /** 等级覆盖的核验范围（LEVEL_SCOPE） */
  verificationScope: string[];
  /** 是否存在真实核验事件（VERIFIED 审核记录） */
  hasRealVerificationEvent: boolean;
  /** 平台**已核验**证书（仅 VERIFIED 记录，与自述轴严格分离） */
  verifiedCertifications: { programCode: string; issuingBody?: string | null }[];
  /** 工厂**自述**证书（平台未核验，文案必须带自述标注） */
  selfReportedCertificates?: { name: string; issued?: string; expires?: string }[];

  // ---- 分数轴 ----
  /** 供应商档案分（分数越高风险越低）；undefined / null = 无分数 */
  profileScore?: number | null;
  /** 由 overallLevel(profileScore) 推导 */
  profileScoreBand?: RiskLevel;
  /** 是否存在风险分维度明细（risk_breakdown 非空）—— 决定方法论文案的措辞 */
  hasScoreBreakdown: boolean;

  // ---- 时间轴 ----
  /** 档案最后更新时间（DB suppliers.updated_at，由触发器维护） */
  profileUpdatedAt?: string | null;
  /** 公开证据里最新的核验日期 */
  lastChecked?: string | null;
  /** 档案里的公开证据条数 */
  evidenceOnFile: number;
};

/** 可选生成参数（文案包 + 已本地化的核验等级短语） */
export type GenerateOpts = {
  /** 覆盖文案包（一般不用传，默认按 locale 解析） */
  copy?: SupplierSeoCopy;
  /**
   * 已本地化的核验等级短语，例如 "Factory verified" / "工厂已核验"。
   * 由调用方从字典 `verification.levelsShort[level]` 注入 ⇒ title / 描述 / FAQ
   * 在 9 种语言下都是本地化的。缺省时退化为结构化的 "Level N"。
   */
  levelLabel?: string;
};

/** 不索引原因（同时也是 SEO 报告里的可解释输出） */
export type IndexabilityReason =
  | "missing-company-name"
  | "missing-location"
  | "no-valuable-attribute"
  | "indexable";

export type Indexability = {
  indexable: boolean;
  reason: IndexabilityReason;
  /** 通过闸门时说明凭哪些「有价值属性」通过 */
  attributes: string[];
};

/**
 * 可索引性判定的**最小输入**。
 *
 * 刻意窄于此处的 `SupplierSeoData`：sitemap 只需要判定闸门，
 * 没有理由为了判一次而把整份 SEO 输入（含 FAQ / Schema 所需的字段）都搬出来。
 * `SupplierSeoData` 结构上满足本类型，可直接传入。
 */
export type IndexabilityInput = {
  legalName: string;
  city: string;
  countryName: string;
  mainProducts: string[];
  verificationLevel: number;
  hasRealVerificationEvent: boolean;
  website?: string;
  registrationNumber?: string;
  address?: string;
  profileScore?: number | null;
  evidenceOnFile: number;
};

// =============================================================================
// 0) 适配器：SupplierView → SupplierSeoData
// =============================================================================

/**
 * 适配器输入：`SupplierView`（lib/queries.ts）的结构子集。
 *
 * 为什么用**结构类型**而不是 `import type { SupplierView }`：
 *   本层要对数据层零依赖（纯函数、可单测、可被构建期调用）。
 *   用结构类型后，任何满足形状的对象都能传入 —— 页面传 SupplierView，
 *   测试传构造的字面量，两边跑的是**同一段映射代码**，不会各自漂移。
 *
 * ⚠️ 刻意不列 employees / established / exportMarkets / certifications：
 *   它们是 free / paid 层字段，一旦进入本层就会经 meta / JSON-LD 泄漏。
 */
export type SupplierSeoSourceView = {
  slug: string;
  legalName: string;
  englishName?: string;
  country: string;
  countryName?: string;
  city: string;
  industryCode?: string;
  businessType: string;
  website?: string;
  registrationNumber?: string;
  address?: string;
  companyType?: string;
  mainProducts?: string[];
  /** DB 原值（unverified / self_assessment / platform_assessment / on_site_audit / third_party_audit） */
  verificationLevel: string;
  riskScore?: number;
  selfReportedCertificates?: { name: string; issued?: string; expires?: string }[];
  evidenceCount?: number;
  /** 公开证据（只用来取最新核验日期，不参与任何等级判定） */
  evidence?: { date?: string | null }[];
  updatedAt?: string | null;
  hasScoreBreakdown?: boolean;
};

/**
 * 把「数据层的供应商视图 + 公开核验记录」映射成 SEO 输入。
 *
 * 🔴 等级推导是整个链路里唯一允许的入口：`publicVerificationLevel(verification_level, 真实事件)`。
 *    真实事件 = 存在已发布且 VERIFIED 的审核记录。evidence 条数**不参与**升档。
 */
export function supplierSeoDataFromView(
  v: SupplierSeoSourceView,
  opts: {
    verifiedAudits: { auditDate?: string }[];
    verifiedCertifications: { programCode: string; issuingBody?: string | null }[];
  }
): { seo: SupplierSeoData; level: number } {
  const hasRealVerificationEvent = (opts.verifiedAudits?.length ?? 0) > 0;
  const level = publicVerificationLevel(v.verificationLevel, hasRealVerificationEvent);
  const dates = (v.evidence ?? [])
    .map((e) => e?.date)
    .filter((d): d is string => Boolean(d))
    .sort();
  const seo: SupplierSeoData = {
    slug: v.slug,
    legalName: v.legalName,
    englishName: v.englishName,
    countryCode: v.country,
    countryName: v.countryName ?? v.country.toUpperCase(),
    city: v.city,
    industryCode: v.industryCode,
    // ⚠️ 行业名当前未本地化（页面既有的「英文页也带中文」约定）；这里直接透传 code，
    //    不引入新行为。拆 nameEn/nameZh 是会动 108 页的独立周期。
    industryName: v.industryCode,
    businessType: v.businessType,
    website: v.website,
    registrationNumber: v.registrationNumber,
    address: v.address,
    companyType: v.companyType,
    mainProducts: v.mainProducts ?? [],
    verificationLevel: level,
    verificationScope: LEVEL_SCOPE[level],
    hasRealVerificationEvent,
    verifiedCertifications: opts.verifiedCertifications ?? [],
    selfReportedCertificates: v.selfReportedCertificates,
    profileScore: typeof v.riskScore === "number" ? v.riskScore : null,
    profileScoreBand: overallLevel(v.riskScore ?? 0),
    hasScoreBreakdown: v.hasScoreBreakdown ?? false,
    profileUpdatedAt: v.updatedAt ?? null,
    lastChecked: dates.length > 0 ? dates[dates.length - 1] : null,
    evidenceOnFile: v.evidenceCount ?? 0,
  };
  return { seo, level };
}

// =============================================================================
// 文案层（en / zh 手写；zh-TW 繁化；其余语言回退英文）
// =============================================================================

type FaqCopy = {
  verifiedQ: string;
  verifiedA: string;
  unverifiedQ: string;
  unverifiedA: string;
  productsQ: string;
  productsA: string;
  locationQ: string;
  locationA: string;
  typeQ: string;
  typeA: string;
  certsQ: string;
  certsReportedA: string;
  certsVerifiedA: string;
  certsNoneA: string;
  checkQ: string;
  checkA: string;
};

export type SupplierSeoCopy = {
  snapshotTitle: string;
  scoreLabel: string;
  scoreDisclaimer: string;
  scoreMethodologyLabel: string;
  scoreMethodologyValue: string;
  scoreBreakdownAbsent: string;
  scoreBreakdownPresent: string;
  dataCoverageLabel: string;
  dataCoverageValue: string; // {filled} / {total}
  dataCoverageNone: string;
  lastUpdatedLabel: string;
  scopeLabel: string;
  scopeNone: string;
  unknownVerified: string;
  unknownUnavailable: string;
  titleVerified: string; // {name} {level} {city} {country}
  titleVerifiedShort: string; // {name} {level}
  titleUnverified: string; // {name} {city} {country}
  titleFallback: string; // {name}
  // 描述由「自包含句子片段」拼装：空片段自动跳过，最后整体按 DESC_MAX 截断。
  // 🔴 拼接顺序是刻意的 —— 截断只允许吃掉**最后**那一段（产品列表）。
  //    核验事实 / 合规句（未独立核验）必须永远排在前面，
  //    否则 200 字上限会把免责声明整句删掉（这正是本模块曾经踩过的坑）。
  descEvent: string; // {name}        已核验：有核验事件记录
  descDeclared: string; // {name}     未核验：供应商自述档案
  descNotVerified: string; // 无占位符  未核验合规句
  descLevel: string; // {level}
  descLocatedWithType: string; // {type} {city} {country}
  descLocated: string; // {city} {country}
  descScore: string; // {score}
  descProducts: string; // {products}
  faq: FaqCopy;
};

const EN: SupplierSeoCopy = {
  snapshotTitle: "Buyer snapshot",
  scoreLabel: "Supplier profile score",
  scoreDisclaimer:
    "This score reflects available supplier profile and data signals and does not constitute an independent assessment of supplier risk.",
  scoreMethodologyLabel: "Score methodology",
  scoreMethodologyValue:
    "The score is recorded on the supplier profile. It is not an independent risk assessment and it is not a substitute for verification or an on-site audit.",
  scoreBreakdownAbsent:
    "No dimensional breakdown is on record for this supplier, so the score cannot be attributed to individual risk factors.",
  scoreBreakdownPresent:
    "A dimensional breakdown is on record for this supplier and is available to members.",
  dataCoverageLabel: "Data coverage",
  dataCoverageValue: "{filled} of {total} profile attributes populated",
  dataCoverageNone: "No profile attributes are populated yet.",
  lastUpdatedLabel: "Last updated",
  scopeLabel: "Verification scope",
  scopeNone: "No verification event is on record for this supplier.",
  unknownVerified: "Information not independently verified.",
  unknownUnavailable: "Not available in the current supplier profile.",
  titleVerified: "{name} | {level} in {city}, {country}",
  titleVerifiedShort: "{name} | {level}",
  titleUnverified: "{name} | Supplier profile in {city}, {country}",
  titleFallback: "{name} | Supplier profile",
  descEvent: "{name} has a recorded verification event with FactoryAuditB2B.",
  descDeclared: "{name} is a supplier-declared profile.",
  descNotVerified: "Not independently verified by FactoryAuditB2B.",
  descLevel: "Verification level: {level}.",
  descLocatedWithType: "{type} in {city}, {country}.",
  descLocated: "Based in {city}, {country}.",
  descScore: "Supplier profile score {score} out of 100.",
  descProducts: "Listed products: {products}.",
  faq: {
    verifiedQ: "Has {name} been verified by FactoryAuditB2B?",
    verifiedA:
      "Yes. FactoryAuditB2B holds a recorded verification event for {name}. The verification level is {level}, and the scope we checked is listed on this profile. Verification does not cover financial statements, in-use product performance or undisclosed subcontractors.",
    unverifiedQ: "Has {name} been verified by FactoryAuditB2B?",
    unverifiedA:
      "Not yet. No verification event is on record for {name}. Everything on this profile is supplier-declared information or publicly available data and it has not been independently verified.",
    productsQ: "What does {name} make?",
    productsA:
      "{name} lists the following products: {products}. This comes from the supplier profile and has not been independently confirmed.",
    locationQ: "Where is {name} based?",
    locationA:
      "{name} is listed in {city}, {country}. The registered address and the production address can differ, so confirm which site will run your order.",
    typeQ: "Is {name} a manufacturer or a trading company?",
    typeA:
      "{name} is listed as: {type}. Trading companies that present themselves as factories are one of the most common sourcing risks, so confirm the production site before releasing a deposit.",
    certsQ: "Which certifications does {name} hold?",
    certsReportedA:
      "The factory reports the following certificates: {list}. These were provided by the supplier and have not been reviewed or verified by FactoryAuditB2B.",
    certsVerifiedA:
      "FactoryAuditB2B has reviewed certification records for {name}: {list}. Only records that passed verification are shown on this profile.",
    certsNoneA:
      "No certification is recorded for {name}. Either none was provided, or none has been verified.",
    checkQ: "How should a buyer check {name} before ordering?",
    checkA:
      "Confirm the legal entity and the registration details, confirm the production site against the address you were given, and request recent quality and audit records. FactoryAuditB2B can carry out those checks before you release a deposit.",
  },
};

const ZH: SupplierSeoCopy = {
  snapshotTitle: "买家速览",
  scoreLabel: "供应商档案评分",
  scoreDisclaimer:
    "该评分反映当前可获得的供应商资料及数据指标，不代表 FactoryAuditB2B 对该供应商实际风险的独立判定。",
  scoreMethodologyLabel: "评分方法",
  scoreMethodologyValue:
    "该评分记录在供应商档案上，不是独立的风险评估结论，也不能替代核查或现场验厂。",
  scoreBreakdownAbsent: "该供应商没有记录维度明细，因此无法把评分归因到具体的风险因素。",
  scoreBreakdownPresent: "该供应商有记录维度明细，会员可以查看。",
  dataCoverageLabel: "数据覆盖度",
  dataCoverageValue: "档案 {total} 项属性中已填写 {filled} 项",
  dataCoverageNone: "档案里还没有填写任何属性。",
  lastUpdatedLabel: "最后更新",
  scopeLabel: "核验范围",
  scopeNone: "该供应商没有核验事件记录。",
  unknownVerified: "该信息未经独立核验。",
  unknownUnavailable: "当前供应商档案中没有该项信息。",
  titleVerified: "{name} | {city}、{country} {level}供应商档案",
  titleVerifiedShort: "{name} | {level}供应商档案",
  titleUnverified: "{name} | {city}、{country}供应商档案",
  titleFallback: "{name} | 供应商档案",
  descEvent: "{name} 在 FactoryAuditB2B 有核验事件记录。",
  descDeclared: "{name} 是供应商自述档案。",
  descNotVerified: "未经 FactoryAuditB2B 独立核验。",
  descLevel: "核验等级：{level}。",
  descLocatedWithType: "{city}、{country}的{type}。",
  descLocated: "位于 {city}、{country}。",
  descScore: "供应商档案评分 {score} / 100。",
  descProducts: "登记产品：{products}。",
  faq: {
    verifiedQ: "{name} 通过 FactoryAuditB2B 核验了吗？",
    verifiedA:
      "是。FactoryAuditB2B 有 {name} 的核验事件记录，核验等级为{level}，具体核验范围列在本档案页上。核验不覆盖财务报表、产品实际使用表现，以及未披露的外发加工方。",
    unverifiedQ: "{name} 通过 FactoryAuditB2B 核验了吗？",
    unverifiedA:
      "还没有。{name} 没有核验事件记录。本页所有内容属于供应商自述信息或公开渠道数据，均未经独立核验。",
    productsQ: "{name} 生产什么？",
    productsA: "{name} 登记的产品为：{products}。该信息来自供应商档案，尚未经独立确认。",
    locationQ: "{name} 在哪里？",
    locationA:
      "{name} 登记位于 {city}、{country}。注册地址与生产地址可能不一致，请确认订单实际在哪个厂区生产。",
    typeQ: "{name} 是工厂还是贸易公司？",
    typeA:
      "{name} 登记类型为：{type}。贸易公司自称工厂是最常见的采购风险之一，付定金前请先确认生产厂区。",
    certsQ: "{name} 有哪些认证？",
    certsReportedA:
      "工厂自述持有以下证书：{list}。这些由供应商提供，未经 FactoryAuditB2B 审阅或核验。",
    certsVerifiedA: "FactoryAuditB2B 已审阅 {name} 的认证记录：{list}。此处只显示通过核验的记录。",
    certsNoneA: "{name} 没有认证记录。可能未提供，也可能尚未通过核验。",
    checkQ: "采购方在下单前应该怎么核查 {name}？",
    checkA:
      "确认法律实体与登记信息，把生产厂区与对方给的地址对照，并索取近期的质量与审核记录。FactoryAuditB2B 可以在你付定金之前完成这些核查。",
  },
};

/**
 * 解析某个 locale 的 SEO 文案。
 * en → EN；zh → ZH；zh-TW → ZH 就地繁化；其余语言 → EN（见文件头「文案策略」）。
 *
 * ⚠️ 传入的应当是**站点 locale**（"zh"），不是 htmlLang（"zh-CN"）。
 *    两者混用会让中文页面静默回退英文 —— 这是最容易踩的一个坑。
 */
export function resolveSupplierSeoCopy(locale: string): SupplierSeoCopy {
  if (locale === "zh") return ZH;
  if (locale === "zh-TW") return twSupplierSeoCopy(ZH);
  return EN;
}

/** 递归把 zh 文案繁化（本结构无数组，只有嵌套对象与字符串） */
function twSupplierSeoCopy(src: SupplierSeoCopy): SupplierSeoCopy {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return twText(v);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>)) {
        out[k] = walk((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  return walk(src) as SupplierSeoCopy;
}

// =============================================================================
// 小工具
// =============================================================================

/** `{key}` 占位符替换；缺失的键**原样保留**（便于回归断言发现漏配） */
export function formatTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

/** 按词边界截断（不切断单词），用于 meta 的长度控制 */
export function truncateWords(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  const body = (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.·|]+$/, "");
  return `${body}…`;
}

/**
 * 依次取第一个不超长的候选。
 *
 * 🔴 全部候选都超长时**不截断**，原样返回最后一个（= 「公司名 + 最短后缀」）。
 *
 * 理由：公司法定名称是主体的唯一标识，把它截成
 * `…Precision Hardware Manufacturing…` 等于在 title 里写出一个**并不存在**的公司名。
 * 本项目的底线是「不生成无据的字符串」，宁可让搜索引擎按自己的像素宽度截断，
 * 也不在服务端把主体名改写成另一个字符串。
 * 因此 `TITLE_MAX` 是**偏好上限**，不是硬上限。
 */
function firstFitting(candidates: string[], max: number): string {
  for (const c of candidates) {
    const t = c.replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
  }
  return candidates[candidates.length - 1].replace(/\s+/g, " ").trim();
}

/** 逗号句列表（中日阿用「、」，其余用 ", " + " and "） */
function joinList(items: string[], locale: string): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (locale.startsWith("zh") || locale === "ja" || locale === "ar") return clean.join("、");
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

/** 清掉占位符为空留下的重复标点与多余空格 */
function tidy(text: string): string {
  return text
    .replace(/:\s*\./g, ".")
    .replace(/，\s*。/g, "。")
    // 数据里的公司名常以「.」结尾（Co., Ltd.），模板其后若紧跟句号就会拼出「Ltd..」。
    // 这里吃掉 2 个及以上的连续句点（含中间夹空格），只留一个。不处理省略号是刻意的：
    // 本模块文案不使用省略号，任何多句点都只可能是拼接产物。
    .replace(/\s*\.(?:\s*\.)+/g, ".")
    // 逐句拼接是以半角空格 join 的：中文句读后面不该留这个空格（"记录。 核验等级"）。
    // 只吃**中文/日文**标点后的空格，英文标点（, . ; :）不受影响。
    .replace(/([。，、；：！？])\s+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:。，、])/g, "$1")
    .trim();
}

const TITLE_MAX = 85;
const DESC_MAX = 200;

// =============================================================================
// 1) Indexability gate（§八）
// =============================================================================

/**
 * 可索引性闸门。
 *
 * 规则（全部满足才 index）：
 *   ① 有真实公司名
 *   ② 有地点（city 且 country）
 *   ③ 至少一项「有价值属性」：产品 / 真实核验事件 / 官网 / 注册号 / 地址 / 档案分 / 证据
 *
 * 设计取向：**宁可 noindex，也不生成空壳页**。
 * 一个只有公司名和城市、其余全空的档案，对搜索者没有价值，
 * 大量此类页面会拉低整站质量评分（§27 禁 doorway 页）。
 *
 * ⚠️ 本函数不判断「内容重复度」。同一家公司被重复导入时应由数据层去重，不能靠这里放行。
 */
export function determineSupplierIndexability(data: IndexabilityInput): Indexability {
  const attributes: string[] = [];

  const hasName = Boolean(data.legalName?.trim());
  const hasLocation = Boolean(data.city?.trim()) && Boolean(data.countryName?.trim());

  if ((data.mainProducts?.length ?? 0) > 0) attributes.push("products");
  if (data.hasRealVerificationEvent && data.verificationLevel > 0) attributes.push("verification-event");
  if (data.website?.trim()) attributes.push("website");
  if (data.registrationNumber?.trim()) attributes.push("registration-number");
  if (data.address?.trim()) attributes.push("address");
  if (typeof data.profileScore === "number") attributes.push("profile-score");
  if ((data.evidenceOnFile ?? 0) > 0) attributes.push("evidence-on-file");

  if (!hasName) return { indexable: false, reason: "missing-company-name", attributes };
  if (!hasLocation) return { indexable: false, reason: "missing-location", attributes };
  if (attributes.length === 0) return { indexable: false, reason: "no-valuable-attribute", attributes };
  return { indexable: true, reason: "indexable", attributes };
}

// =============================================================================
// 2) Title / Description（§5 / §6）
// =============================================================================

/** 核验等级短语：优先用调用方注入的本地化短语，否则退化为 "Level N" */
function levelPhrase(data: SupplierSeoData, locale: string, opts: GenerateOpts): string {
  if (opts.levelLabel?.trim()) return opts.levelLabel.trim();
  if (locale === "zh") return `等级 ${data.verificationLevel}`;
  if (locale === "zh-TW") return `等級 ${data.verificationLevel}`;
  return `Level ${data.verificationLevel}`;
}

/**
 * SEO title。
 *
 * 铁律：
 *   · 以**真实公司名**开头，绝不用关键词堆砌（§5）。
 *   · 只有存在真实核验事件时才允许出现核验等级词。未核验时一个字都不提核验，
 *     否则等于在搜索结果里给出无据的信任暗示。
 *   · 公司名本身超长时，优先丢掉**尾部地点段**，绝不在公司名中间截断。
 *   · 品牌后缀由 `lib/pageMeta.ts` 的 `buildPageMetadata` 统一追加，这里不重复加。
 */
export function generateSupplierTitle(
  data: SupplierSeoData,
  locale: string,
  opts: GenerateOpts = {}
): string {
  const copy = opts.copy ?? resolveSupplierSeoCopy(locale);
  const name = (data.legalName ?? "").trim();
  if (!name) return "";
  const city = (data.city ?? "").trim();
  const country = (data.countryName ?? "").trim();

  const candidates: string[] = [];
  if (data.hasRealVerificationEvent && data.verificationLevel > 0) {
    const level = levelPhrase(data, locale, opts);
    if (city && country) {
      candidates.push(formatTemplate(copy.titleVerified, { name, level, city, country }));
    }
    candidates.push(formatTemplate(copy.titleVerifiedShort, { name, level }));
  }
  if (city && country) {
    candidates.push(formatTemplate(copy.titleUnverified, { name, city, country }));
  }
  candidates.push(formatTemplate(copy.titleFallback, { name }));

  return firstFitting(candidates, TITLE_MAX);
}

/**
 * meta description。
 *
 * 铁律：
 *   · 未核验时必须显式写「supplier-declared / Not independently verified」（§6）。
 *   · 绝不输出 legacy verification_status 原文（"Factory Verified" 这类历史声明）。
 *   · 只写公开、可支持的事实。
 */
export function generateSupplierDescription(
  data: SupplierSeoData,
  locale: string,
  opts: GenerateOpts = {}
): string {
  const copy = opts.copy ?? resolveSupplierSeoCopy(locale);
  const name = (data.legalName ?? "").trim();
  if (!name) return "";
  const city = (data.city ?? "").trim();
  const country = (data.countryName ?? "").trim();
  const type = (data.businessType ?? "").trim() || (data.companyType ?? "").trim();
  const products = joinList(data.mainProducts ?? [], locale);

  // 逐句拼装：空片段直接跳过，避免出现「：。」这类占位符残留。
  // 🔴 顺序即优先级 —— 截断只吃最后一段（产品列表），核验事实与合规句一定留下。
  const parts: string[] = [];
  if (data.hasRealVerificationEvent && data.verificationLevel > 0) {
    parts.push(formatTemplate(copy.descEvent, { name }));
    parts.push(formatTemplate(copy.descLevel, { level: levelPhrase(data, locale, opts) }));
  } else {
    parts.push(formatTemplate(copy.descDeclared, { name }));
    parts.push(copy.descNotVerified);
  }
  if (city && country) {
    parts.push(
      type
        ? formatTemplate(copy.descLocatedWithType, { type, city, country })
        : formatTemplate(copy.descLocated, { city, country })
    );
  }
  if (typeof data.profileScore === "number") {
    parts.push(formatTemplate(copy.descScore, { score: String(data.profileScore) }));
  }
  if (products) {
    parts.push(formatTemplate(copy.descProducts, { products }));
  }

  return truncateWords(tidy(parts.filter(Boolean).join(" ")), DESC_MAX);
}

// =============================================================================
// 3) Buyer Snapshot（§8）
// =============================================================================

export type SnapshotRow = {
  /** 稳定的行 id（用于回归断言与去重，不参与展示） */
  id: string;
  label: string;
  value: string;
  /** true = 该项在档案里缺失，value 是「未核验 / 无资料」占位文案 */
  unknown: boolean;
  /** 免责声明行（label 为空，UI 需要用弱化样式渲染） */
  note?: boolean;
};

/**
 * Buyer Snapshot 行标签的字典注入点。
 *
 * 这里所有 key 都已在 9 种语言的字典里存在（逐个核对过），
 * 因此**行标签是全语种本地化的**，只有本文件新增的句子会回退英文。
 * 缺省即不渲染该行 —— 宁可少一行，也不硬塞一个英文标签进中文页面。
 */
export type SnapshotLabels = {
  englishName?: string;
  city?: string;
  country?: string;
  businessType?: string;
  industry?: string;
  products?: string;
  address?: string;
  website?: string;
  registrationNumber?: string;
  verificationLevel?: string;
  lastUpdated?: string;
  lastChecked?: string;
  evidenceOnFile?: string;
  /** 已本地化的等级档位（t.risk.ui.level[band]） */
  scoreBand?: string;
};

/**
 * 生成 Buyer Snapshot 行。
 *
 * 设计要点：
 *   · **只放公开层字段**（free / paid 字段一律不进，否则会经 RSC payload 泄漏）。
 *   · 每行要么是真实数据，要么是明确的「无资料」占位，**绝不编造**（§6）。
 *   · 行顺序是固定的（identity → location → business → registration → verification →
 *     score → coverage → time），便于 AI 检索系统稳定抽取，也便于回归断言。
 */
export function generateSupplierSnapshot(
  data: SupplierSeoData,
  locale: string,
  labels: SnapshotLabels,
  opts: GenerateOpts = {}
): SnapshotRow[] {
  const copy = opts.copy ?? resolveSupplierSeoCopy(locale);
  const rows: SnapshotRow[] = [];

  const push = (id: string, label: string | undefined, raw: string | undefined | null) => {
    if (!label) return;
    const v = (raw ?? "").trim();
    rows.push({ id, label, value: v || copy.unknownUnavailable, unknown: !v });
  };

  push("englishName", labels.englishName, data.englishName);
  // 城市与国家分成两行（而不是拼成 "City, Country"）：这样标签可以复用已有的
  // 本地化字典键（trust.cityLabel / suppliers.filterCountry），不必新造 "Location" 文案。
  push("city", labels.city, data.city);
  push("country", labels.country, data.countryName);
  push("businessType", labels.businessType, (data.businessType ?? "").trim() || data.companyType);
  push("industry", labels.industry, data.industryName ?? data.industryCode);
  push("products", labels.products, joinList(data.mainProducts ?? [], locale));
  push("address", labels.address, data.address);
  push("website", labels.website, data.website);
  push("registrationNumber", labels.registrationNumber, data.registrationNumber);

  // 核验等级：即使是 0（未核验）也是**确定的事实**，不是「缺资料」，故 unknown=false
  if (labels.verificationLevel) {
    const levelText =
      data.hasRealVerificationEvent && data.verificationLevel > 0
        ? `${levelPhrase(data, locale, opts)} (${data.verificationLevel} / 4)`
        : `${copy.unknownVerified} (0 / 4)`;
    rows.push({ id: "verificationLevel", label: labels.verificationLevel, value: levelText, unknown: false });
  }

  // 核验范围
  rows.push({
    id: "verificationScope",
    label: copy.scopeLabel,
    value:
      data.verificationLevel > 0 && data.verificationScope.length > 0
        ? data.verificationScope.join(" · ")
        : copy.scopeNone,
    unknown: data.verificationLevel === 0 || data.verificationScope.length === 0,
  });

  // 档案评分 + 免责声明 + 方法论（§一：改名 + 免责 + 方法论）
  if (typeof data.profileScore === "number") {
    const band = (labels.scoreBand ?? "").trim() || data.profileScoreBand || "";
    rows.push({
      id: "profileScore",
      label: copy.scoreLabel,
      value: `${data.profileScore} / 100${band ? ` · ${band}` : ""}`,
      unknown: false,
    });
    rows.push({
      id: "scoreMethodology",
      label: copy.scoreMethodologyLabel,
      value: data.hasScoreBreakdown ? copy.scoreBreakdownPresent : copy.scoreBreakdownAbsent,
      unknown: false,
    });
    rows.push({ id: "scoreDisclaimer", label: "", value: copy.scoreDisclaimer, unknown: false, note: true });
  } else {
    rows.push({ id: "profileScore", label: copy.scoreLabel, value: copy.unknownVerified, unknown: true });
  }

  // 数据覆盖度（§一：必须展示；真实测量值）
  const coverage = profileDataCoverage(data);
  rows.push({
    id: "dataCoverage",
    label: copy.dataCoverageLabel,
    value:
      coverage.filled === 0
        ? copy.dataCoverageNone
        : formatTemplate(copy.dataCoverageValue, {
            filled: String(coverage.filled),
            total: String(coverage.total),
          }),
    unknown: coverage.filled === 0,
  });

  // 时间轴：档案更新时间 与 证据核验日期 是**两个不同事实**，不得互相顶替
  push("lastUpdated", labels.lastUpdated ?? copy.lastUpdatedLabel, dateOnly(data.profileUpdatedAt));
  push("lastChecked", labels.lastChecked, dateOnly(data.lastChecked));
  push("evidenceOnFile", labels.evidenceOnFile, String(data.evidenceOnFile ?? 0));

  return rows;
}

/**
 * 数据覆盖度：统计公开层「有值」的属性数。
 *
 * 🔴 这是**真实测量值**，不是估分。分母只数公开层属性，
 *    不把 free / paid 字段算进去（否则会暗示"档案很全"而实际游客看不到）。
 *    `profileScore` 不计入 —— 它不是档案属性，而是一个派生指标。
 */
export const COVERAGE_ATTRIBUTE_IDS = [
  "legalName",
  "englishName",
  "city",
  "country",
  "businessType",
  "industryCode",
  "mainProducts",
  "address",
  "website",
  "registrationNumber",
  "companyType",
  "selfReportedCertificates",
  "verificationEvent",
  "evidenceOnFile",
] as const;

export function profileDataCoverage(data: SupplierSeoData): { filled: number; total: number } {
  const flags: Record<(typeof COVERAGE_ATTRIBUTE_IDS)[number], boolean> = {
    legalName: Boolean(data.legalName?.trim()),
    englishName: Boolean(data.englishName?.trim()),
    city: Boolean(data.city?.trim()),
    country: Boolean(data.countryName?.trim()),
    businessType: Boolean(data.businessType?.trim()),
    industryCode: Boolean(data.industryCode?.trim()),
    mainProducts: (data.mainProducts?.length ?? 0) > 0,
    address: Boolean(data.address?.trim()),
    website: Boolean(data.website?.trim()),
    registrationNumber: Boolean(data.registrationNumber?.trim()),
    companyType: Boolean(data.companyType?.trim()),
    selfReportedCertificates: (data.selfReportedCertificates?.length ?? 0) > 0,
    verificationEvent: data.hasRealVerificationEvent && data.verificationLevel > 0,
    evidenceOnFile: (data.evidenceOnFile ?? 0) > 0,
  };
  const total = COVERAGE_ATTRIBUTE_IDS.length;
  const filled = COVERAGE_ATTRIBUTE_IDS.filter((k) => flags[k]).length;
  return { filled, total };
}

/** ISO → YYYY-MM-DD（无效值返回 undefined，绝不返回 "Invalid Date"） */
export function dateOnly(iso?: string | null): string | undefined {
  const s = (iso ?? "").trim();
  if (!s) return undefined;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

// =============================================================================
// 4) FAQ（§7 / §18）
// =============================================================================

export type FaqItem = { id: string; q: string; a: string };

/**
 * 生成 FAQ。
 *
 * 铁律（§7 / §32）：
 *   · 每一条都必须由**真实数据**触发；数据缺失就整条不出现，绝不写通用套话凑数。
 *   · 「核验状态」与「下单前怎么核查」两条恒存在 ⇒ 天然落在 3–6 条之间（§七 要求 3–8）。
 *   · 输出即渲染内容；FAQPage JSON-LD 只允许来自本函数的返回值（页面可见 = Schema）。
 */
export function generateSupplierFaq(
  data: SupplierSeoData,
  locale: string,
  opts: GenerateOpts = {}
): FaqItem[] {
  const copy = opts.copy ?? resolveSupplierSeoCopy(locale);
  const name = (data.legalName ?? "").trim();
  if (!name) return [];
  const f = copy.faq;
  const items: FaqItem[] = [];

  // ① 核验状态（恒存在：无论有没有，"有没有"本身就是买家的第一个问题）
  if (data.hasRealVerificationEvent && data.verificationLevel > 0) {
    items.push({
      id: "verified",
      q: formatTemplate(f.verifiedQ, { name }),
      a: formatTemplate(f.verifiedA, { name, level: levelPhrase(data, locale, opts) }),
    });
  } else {
    items.push({
      id: "unverified",
      q: formatTemplate(f.unverifiedQ, { name }),
      a: formatTemplate(f.unverifiedA, { name }),
    });
  }

  // ② 产品（有产品才问）
  if ((data.mainProducts?.length ?? 0) > 0) {
    items.push({
      id: "products",
      q: formatTemplate(f.productsQ, { name }),
      a: formatTemplate(f.productsA, { name, products: joinList(data.mainProducts, locale) }),
    });
  }

  // ③ 地点（城市 + 国家都要有，否则地点问题不成立）
  if (data.city?.trim() && data.countryName?.trim()) {
    items.push({
      id: "location",
      q: formatTemplate(f.locationQ, { name }),
      a: formatTemplate(f.locationA, {
        name,
        city: data.city.trim(),
        country: data.countryName.trim(),
      }),
    });
  }

  // ④ 工厂 / 贸易商（有 businessType 才问）
  const type = (data.businessType ?? "").trim() || (data.companyType ?? "").trim();
  if (type) {
    items.push({
      id: "type",
      q: formatTemplate(f.typeQ, { name }),
      a: formatTemplate(f.typeA, { name, type }),
    });
  }

  // ⑤ 认证（两个轴分开答；平台核验优先，自述其次，都没有则如实说没有）
  const verifiedCerts = (data.verifiedCertifications ?? []).map((c) => c.programCode).filter(Boolean);
  const selfCerts = (data.selfReportedCertificates ?? []).map((c) => c.name).filter(Boolean);
  if (verifiedCerts.length > 0) {
    items.push({
      id: "certs-verified",
      q: formatTemplate(f.certsQ, { name }),
      a: formatTemplate(f.certsVerifiedA, { name, list: joinList(verifiedCerts, locale) }),
    });
  } else if (selfCerts.length > 0) {
    items.push({
      id: "certs-reported",
      q: formatTemplate(f.certsQ, { name }),
      a: formatTemplate(f.certsReportedA, { name, list: joinList(selfCerts, locale) }),
    });
  } else {
    items.push({
      id: "certs-none",
      q: formatTemplate(f.certsQ, { name }),
      a: formatTemplate(f.certsNoneA, { name }),
    });
  }

  // ⑥ 下单前怎么核查（恒存在：这是页面存在的商业理由）
  items.push({
    id: "how-to-check",
    q: formatTemplate(f.checkQ, { name }),
    a: formatTemplate(f.checkA, { name }),
  });

  // 统一过一遍 tidy：公司名末尾的「.」与模板句号会拼出「Ltd..」这类假标点。
  // 放在出口处一次性处理，避免每个分支各写一遍（也就不会漏）。
  return items.map((it) => ({ id: it.id, q: tidy(it.q), a: tidy(it.a) }));
}

// =============================================================================
// 5) 关键词目标（§44）—— **不是** meta keywords
// =============================================================================

/**
 * 内容选题 / 内部对齐用的检索意图清单。
 *
 * 🔴 绝不输出为 `<meta name="keywords">`（§41 明令禁止，且该标签对现代搜索引擎无效）。
 *    它存在的意义是：让内容与内链围绕真实检索意图组织，并给 SEO 报告提供对照。
 */
export function generateSupplierKeywordTargets(data: SupplierSeoData): string[] {
  const out: string[] = [];
  const name = (data.legalName ?? "").trim();
  const city = (data.city ?? "").trim();
  const country = (data.countryName ?? "").trim();
  if (name) out.push(name, `${name} supplier`, `${name} verification`);
  if (city && country) out.push(`${city} ${country} supplier`);
  for (const p of (data.mainProducts ?? []).slice(0, 3)) {
    if (city) out.push(`${p} supplier ${city}`);
    if (country) out.push(`${p} manufacturer ${country}`);
  }
  return Array.from(new Set(out.map((s) => s.trim()).filter(Boolean)));
}

// =============================================================================
// 6) Schema（§9 / §19）
// =============================================================================

export type SupplierSchemaContext = {
  /** 站点 locale（"en" / "zh" / …）—— 用于解析文案包 */
  locale: string;
  profileUrl: string;
  homeUrl: string;
  directoryUrl: string;
  /** 面包屑文案（来自字典，9 语本地化） */
  breadcrumbHome: string;
  breadcrumbDirectory: string;
  /** 站点语言标签（LOCALE_META[locale].htmlLang） */
  htmlLang: string;
  /** 平台 Organization 的 @id（lib/organizationSchema.ts 的 ORG_URL + #organization） */
  publisherId: string;
};

/**
 * 生成供应商档案页的 JSON-LD @graph。
 *
 * 只输出四类节点，且每条都由**页面可见的真实事实**驱动：
 *   · Organization    —— 供应商自身（hasCredential 只在确有已核验证书时出现）
 *   · WebPage         —— 本页，isPartOf 指回平台实体
 *   · BreadcrumbList  —— 与可见面包屑逐字一致
 *   · FAQPage         —— 仅当 FAQ 真的渲染在页面上（页面可见 = Schema）
 *
 * 刻意不输出：
 *   · LocalBusiness        —— 平台不是该供应商的当地实体，强加会误导搜索引擎。
 *   · Product              —— 现有 main_products 是自由文本，没有任何结构化产品数据；
 *                             为自由文本编造 Product 节点属于虚构结构化数据。
 *   · aggregateRating / review —— 不存在任何真实评价数据。
 */
export function generateSupplierSchema(
  data: SupplierSeoData,
  ctx: SupplierSchemaContext,
  faq: FaqItem[] = []
): Record<string, unknown> {
  const graph: Record<string, unknown>[] = [];

  const org: Record<string, unknown> = {
    "@type": "Organization",
    name: data.legalName,
    url: ctx.profileUrl,
    ...(data.city?.trim() || data.countryName?.trim()
      ? {
          address: {
            "@type": "PostalAddress",
            ...(data.city?.trim() ? { addressLocality: data.city.trim() } : {}),
            ...(data.countryName?.trim() ? { addressCountry: data.countryName.trim() } : {}),
          },
        }
      : {}),
    ...(data.address?.trim() ? { streetAddress: data.address.trim() } : {}),
    ...(data.website?.trim() ? { sameAs: [data.website.trim()] } : {}),
    ...(data.registrationNumber?.trim()
      ? {
          identifier: {
            "@type": "PropertyValue",
            name: "Business registration number",
            value: data.registrationNumber.trim(),
          },
        }
      : {}),
    ...(data.mainProducts?.length
      ? { description: `${data.businessType}. Main products: ${data.mainProducts.join(", ")}.` }
      : {}),
    // 只在确有「平台已核验」证书时输出。自述证书**绝不**进 hasCredential
    //（自述 = 供应商声明，不是平台核验结果，放进来等于虚构资质）。
    ...((data.verifiedCertifications ?? []).length > 0
      ? {
          hasCredential: data.verifiedCertifications.map((c) => ({
            "@type": "EducationalOccupationalCredential",
            name: c.programCode,
            credentialCategory: "certification",
            ...(c.issuingBody
              ? { recognizedBy: { "@type": "Organization", name: c.issuingBody } }
              : {}),
          })),
        }
      : {}),
  };
  graph.push(org);

  graph.push({
    "@type": "WebPage",
    "@id": `${ctx.profileUrl}#webpage`,
    url: ctx.profileUrl,
    inLanguage: ctx.htmlLang,
    isPartOf: { "@id": ctx.publisherId },
    about: { "@type": "Organization", name: data.legalName, url: ctx.profileUrl },
    ...(faq.length > 0 ? { mainEntity: { "@id": `${ctx.profileUrl}#faq` } } : {}),
  });

  graph.push({
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: ctx.breadcrumbHome, item: ctx.homeUrl },
      { "@type": "ListItem", position: 2, name: ctx.breadcrumbDirectory, item: ctx.directoryUrl },
      { "@type": "ListItem", position: 3, name: data.legalName, item: ctx.profileUrl },
    ],
  });

  // FAQPage 与页面渲染的 FAQ 同源；不渲染就不输出（WebPage.mainEntity 也不会悬空）
  if (faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${ctx.profileUrl}#faq`,
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

// =============================================================================
// 7) Canonical / URL
// =============================================================================

/** 档案页 canonical（复用 i18n/hreflang 的单一事实源，英文无前缀） */
export function generateSupplierCanonical(locale: Locale | string, slug: string): string {
  return canonicalFor(locale as Locale, supplierProfilePath(slug));
}

/** 档案页路径（去掉语言前缀） */
export function supplierProfilePath(slug: string): string {
  return `${SUPPLIER_DIRECTORY_PATH}/${slug}`;
}

/** 站点内某 locale 的档案 URL（供 Schema / 内链复用） */
export function supplierProfileUrl(locale: Locale | string, slug: string): string {
  return `${SEO_BASE}${localePath(locale as Locale, supplierProfilePath(slug))}`;
}
