// lib/queries.ts —— 供应商读取层
//
// V2.0：数据源为 lib/staticData.ts 的静态常量。
// V2.1：数据源可切换为 Supabase（见下方 useSupabase()），**7 个导出函数签名保持不变**，
//       所有消费方（页面 / sitemap / API）零改动。这正是当初保留签名的回报。
//
// ★ 数据源开关（最重要的保险丝）：
//   环境变量 SUPPLIER_DATA_SOURCE = "static"   → 强制走静态常量
//                                  = "supabase" → 强制走数据库
//                                  = 未设置     → 配了 Supabase 就走库，否则走静态
//   Supabase 挂了/没配 → 自动回落静态，站点照常运行，只是不落库。
//
// ⚠️ 安全红线：本文件返回的对象**已按 tier 裁剪**（lib/access.ts 的 redactSupplier）。
//             调用方不需要也不应该再自己做权限判断。

import { STATIC_SUPPLIERS, STATIC_COUNTRIES, type StaticSupplier } from "./staticData";
import { getSupplierCapabilitiesResolved } from "./taxonomy";
// STEP-04：产业带名解析的唯一入口（与后台 Admin 共用同一个数据层文件，
// 不在这里重写一份 `.from("industrial_clusters")` 查询 —— 那等于造第二套数据源）。
import { resolvePublishedClusterNames } from "./industrialClusters";
import { overallLevel } from "./riskEngine";
import { publicVerificationLevel } from "./verification";
import { isAdminConfigured } from "./supabaseAdmin";
import { redactSupplier, redactEvidence, canAccess, type MembershipTier } from "./access";

// 与页面当前消费的供应商形状保持一致（mainProducts/exportMarkets/certifications 为数组）
export type SupplierView = {
  /**
   * CS-05b：供应商的稳定身份（supplier ID）。
   * DB 路径 = suppliers.id（uuid）；静态兜底 = lib/staticData.ts 的 StaticSupplier.id。
   * Guest 的「5 家不同 supplier」按它去重 —— 不按 slug / URL / 标签页 / 刷新。
   */
  id: string;
  slug: string;
  legalName: string;
  country: string;
  countryName?: string;
  city: string;
  // ---- STEP-02（migration 023）：地理大区 + 产业带 ----
  /** 地理大区（如 Guangdong）。**与 province 并存**：region 是大区、province 是省/州，禁止互推、禁止用 region 覆盖 province */
  region?: string;
  /** 主产业带（如 Foshan Furniture）。产业带 ≠ 行政区：country/region/city 是行政维度，cluster 是产业聚集维度 */
  cluster?: string;
  /** 产业带 slug，供 /industrial-clusters/[slug] 使用 */
  clusterSlug?: string;
  /** 多产业带标签（一个供应商可属多个产业带）。主值冗余在 cluster，两者不一致时以 cluster 为准 */
  clusterTags?: string[];
  /**
   * STEP-04：产业带**展示名**（DB-first 解析 `cluster_slug` → `industrial_clusters.name`）。
   *
   * 🔴 解析规则（全部在 `lib/industrialClusters.ts` 的 resolvePublishedClusterNames 内，
   *    这里只登记语义，不重复实现）：
   *      · 只在 `clusterSlug` 非空时才去查，且是**一次批量** `.in(slug, …)`（禁 N+1）；
   *      · 必须 `is_published = true` —— 公开读走 service_role，RLS 不生效；
   *      · 查不到 / 未发布 / 出错 ⇒ **保持 undefined**（不是空串、不是 "Unknown"）。
   *    前台据此**不渲染这一行**；当前 17/17 供应商 cluster_slug 为 NULL ⇒ 恒为 undefined。
   */
  clusterName?: string;
  industryCode?: string;
  businessType: string;
  established?: number;
  employees?: string;
  mainProducts: string[];
  exportMarkets: string[];
  verificationStatus?: string;
  /**
   * CS-02 —— 公开 Verification Level 的**唯一权威字段**（DB: suppliers.verification_level）。
   * 页面推导等级必须用它，禁止再用 verificationStatus（legacy 声明文本）。
   */
  verificationLevel: string;
  /** V1.1 语义：分数越高 = 风险越低 */
  riskScore?: number;
  /** 由 overallLevel(riskScore) 推导，不在数据里存一份等级文案（单一事实来源） */
  riskLevel?: string;
  /** 最近一次核验日期，取自"公开证据"里最新的 date；无记录则为 null，绝不回落到当前日期 */
  lastChecked?: string | null;
  /**
   * PHASE 03（§十）：档案记录的最后更新时间（DB `suppliers.updated_at`）。
   *
   * 🔴 与 `lastChecked` 是**两个不同的时间事实**，禁互相顶替：
   *    `updatedAt`  = 档案被修改（含「发布」这个动作，由 `suppliers_set_updated_at` 触发器维护）
   *    `lastChecked`= 公开证据里最新的一条核验日期
   *    sitemap 的 lastModified 用前者；页面「最近核验」用后者。
   * 静态兜底数据没有时间戳 ⇒ null（绝不拿 new Date() 顶替）。
   */
  updatedAt?: string | null;
  certifications: string[];
  auditStatus?: string;
  inspectionHistory: number;
  /** 证据条数（仅统计 public 证据，避免付费内容的"存在性"泄漏） */
  evidenceCount: number;
  /** 其中已核验的条数 */
  evidenceVerified: number;
  /**
   * PHASE 03（§一）：是否存在风险分维度明细（`risk_breakdown` 非空）。
   *
   * 🔴 **只暴露布尔，不暴露内容**。`risk_breakdown` 本身是 PAID 层字段（付费才能看明细），
   *    但「有没有明细」是档案的结构性事实，页面必须如实说明：
   *      · 有明细 → 评分可归因到具体维度（明细给会员看）
   *      · 没明细 → 评分无法归因，绝不能暗示"分维评估过"
   *    当前全部已发布供应商的 risk_breakdown 均为 NULL，
   *    所以「评分方法论」文案必须走「无明细」分支，这是真实情况而非占位。
   */
  hasScoreBreakdown: boolean;

  // ---- CS-12：工商登记级公开字段（用户 2026-09-12 拍板「只放开工商登记级」）----
  // 全部可选：静态兜底数据（lib/staticData.ts）没有这些字段，缺失时前台不渲染该行。
  /** 英文名（企业对外使用名，与 legalName 并列展示） */
  englishName?: string;
  /** 公司类型（如 Limited Liability Company / Joint-Stock） */
  companyType?: string;
  /** 官网（须为登记/官网可核对的公开地址） */
  website?: string;
  /** 工商注册号 / 统一社会信用代码 */
  registrationNumber?: string;
  /** 注册地址 */
  address?: string;

  // ---- CS-12：FREE 层（注册后可见的产能情报）----
  productionCapacity?: string;
  monthlyOutput?: string;
  factorySize?: string;
  /** 开始出口年份 —— 与 established（成立年份）**不是同一个事实**，禁互推 */
  exportSince?: number;

  /**
   * CS-12：工厂**自述**证书（DB: suppliers.self_reported_certificates）。
   * 🔴 平台未核验，渲染时必须带「自述、未核验」标注。与 `certifications` 是两条轴。
   */
  selfReportedCertificates?: SelfReportedCertificate[];

  // ---- CS-16：注册买家可见的联系方式 / 属地（FREE 层，不进 PUBLIC，符合 CS-12 公开边界）----
  /** 省份/州 */
  province?: string;
  /** 联系人姓名 */
  contactPerson?: string;
  /** 联系邮箱 */
  contactEmail?: string;
  /** WhatsApp 号码 */
  whatsapp?: string;
  /** 公司简介 */
  companyDescription?: string;

  /**
   * PHASE 03（P0 修复）：目录卡片用的**公开核验等级**，
   * 由 CS-02 权威逻辑推导：`publicVerificationLevel(verification_level, hasRealEvent)`，
   * 与详情页 `/suppliers/[slug]` 完全同源。
   *
   * 为什么要有这个字段：目录页此前把「尚未核验」写死在卡片上，
   * 导致已 Level 3 的 guangzhou-sunny-food 在目录里仍显示未核验 —— 与档案页自相矛盾。
   *
   * 只由 `listSupplierDirectory()` 填充（它才有那次聚合查询）；
   * 其它路径（`getSupplierDetail` / `getSupplierBySlug`）不填 ⇒ 消费方必须
   * `?? 0` 兜底（保守方向：宁可显示未核验，绝不虚升等级）。
   */
  publicVerificationLevel?: number;
};

/**
 * 工厂在入驻表单里自述的证书行。
 *
 * 形状**逐字对齐** components/SupplierRegistrationForm.tsx 序列化出的 certificatesJson：
 * `{ name, number, issued, expires }` —— 保证 CS-07 落库时无需转换。
 * 🔴 不要在这里改名（如 issued → issueDate），否则落库数据与读取层对不上且 TS 无感。
 */
export type SelfReportedCertificate = {
  name: string;
  number: string;
  issued: string;
  expires: string;
};

// ---------- 数据源开关 ----------

/**
 * 是否走 Supabase。
 * 默认策略：显式 static → 静态；显式 supabase → 数据库（未配置则回落静态）；
 * 未设置 → 配了 service_role 就用数据库。
 */
function useSupabase(): boolean {
  const mode = process.env.SUPPLIER_DATA_SOURCE?.trim().toLowerCase();
  if (mode === "static") return false;
  if (mode === "supabase") return isAdminConfigured();
  return isAdminConfigured();
}

function countryNameOf(code: string): string {
  return STATIC_COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/** 证据里最新的核验日期。ISO 日期可直接按字符串比较。没有证据就返回 null。 */
export function lastCheckedOf(
  evidence: { date?: string | null }[]
): string | null {
  const dates = evidence.map((e) => e.date).filter((d): d is string => Boolean(d));
  return dates.length === 0 ? null : dates.sort().at(-1) ?? null;
}

// ---------- 静态路径（V2.0 原实现，行为零改动） ----------

function toView(s: (typeof STATIC_SUPPLIERS)[number]): SupplierView {
  return {
    id: s.id,
    slug: s.slug,
    legalName: s.legalName,
    country: s.countryCode,
    countryName: countryNameOf(s.countryCode),
    city: s.city,
    industryCode: s.industryCode,
    businessType: s.businessType,
    established: s.established,
    employees: s.employees,
    mainProducts: s.mainProducts,
    exportMarkets: s.exportMarkets,
    verificationStatus: s.verificationStatus,
    // 静态数据没有 verification_level 字段。缺省值取 'unverified' ——
    // 这是**保守方向**（宁可显示未核验，也不能显示未经验证的信任等级）。
    verificationLevel: "unverified",
    riskScore: s.riskScore ?? undefined,
    // 同 rowToView：无分数 ⇒ 无等级（静态种子 4 家都有分数，此处只为保持两条路径同构）
    riskLevel: typeof s.riskScore === "number" ? overallLevel(s.riskScore) : undefined,
    lastChecked: lastCheckedOf(s.evidence),
    // 静态兜底数据没有档案时间戳 ⇒ null（sitemap 会退化为「不带 lastModified」，绝不编造时间）
    updatedAt: null,
    certifications: s.certifications,
    auditStatus: s.auditStatus,
    inspectionHistory: s.inspectionHistory,
    evidenceCount: s.evidence.length,
    evidenceVerified: s.evidence.filter((e) => e.status === "VERIFIED").length,
    // 静态兜底数据里没有风险分维度明细
    hasScoreBreakdown: false,
  };
}

// ---------- Supabase 路径 ----------

/** 数据库行形状（snake_case，与 supabase/migrations/001_init.sql 对应） */
type SupplierRow = {
  id: string;
  slug: string;
  legal_name: string;
  country_code: string;
  city: string;
  industry_code: string | null;
  business_type: string | null;
  established: number | null;
  employees: string | null;
  main_products: string[] | null;
  export_markets: string[] | null;
  verification_status: string | null;
  /** CS-01 004_documents.sql 建，NOT NULL DEFAULT 'unverified' */
  verification_level: string;
  /** 建档即有；由 suppliers_set_updated_at 触发器在每次 UPDATE 时刷新 */
  updated_at: string | null;
  risk_score: number | null;
  certifications: string[] | null;
  audit_status: string | null;
  inspection_history: number | null;
  risk_breakdown: unknown;
  access_tier: string;
  is_published: boolean;
  // ---- CS-12 / 009_supplier_profile_extras.sql 新增列 ----
  // 可空：009 迁移之前写入的行这些列全是 NULL。
  company_type: string | null;
  english_name: string | null;
  production_capacity: string | null;
  monthly_output: string | null;
  factory_size: string | null;
  export_since: number | null;
  self_reported_certificates: unknown;
  // ---- CS-16：非敏感业务字段（注册买家可见，FREE 层）----
  // 与下方刻意排除的 `profile_authorized` / `contact_visibility` / `phone` 是两回事：
  // 这些是供应商自述的联系/属地信息，属商业匹配用途，放 FREE 层即可；
  // 敏感元数据（consent_*/authorized_*/unpublished_*/updated_by 等）不在此列，只走 adminData `select("*")`。
  province: string | null;
  contact_person: string | null;
  contact_email: string | null;
  whatsapp: string | null;
  company_description: string | null;
  // ---- STEP-02（migration 023）：地理大区 + 产业带 ----
  // 只加列、不改既有语义；历史行一律 NULL（不回填、不推测）。
  region: string | null;
  cluster: string | null;
  cluster_slug: string | null;
  cluster_tags: string[] | null;
  /**
   * ---- STEP-02（migration 023）：来源追踪 ----
   * ⚠️ 刻意**不进** ROW_SELECT：utm / referrer / landing_page 属内部归因数据，
   *    不是供应商档案的公开事实，只允许 admin（select("*")）与写入路径触及。
   *    放进公共读取白名单等于把买家的来源轨迹公开，故此处仅登记类型、不进白名单。
   */
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_page: string | null;
  first_touch_at: string | null;
  // 注意：`profile_authorized` / `contact_visibility` / `phone` **刻意不进本类型也不进
  // ROW_SELECT** —— 联系方式属同意书管辖（用户拍板的公开边界只含工商登记级，不含电话）。
  // 把它们排除在类型外，是为了让「谁也没读过这两列」在 TS 层面可见，
  // 而不是留一个恒为 undefined 的字段等人误用。待 CS-07 写入时再一并接出。
  // ---- CS-03 起就存在、此前从未被读取的列 ----
  address: string | null;
  website: string | null;
  registration_number: string | null;
  /** join 出来的证据（可缺省） */
  supplier_evidence?: {
    id: string;
    type: string | null;
    status: string;
    source: string | null;
    date: string | null;
    note: string | null;
    visibility: string;
  }[];
};

// STEP-02（migration 023）：新增 region / cluster / cluster_slug / cluster_tags。
//
// ⚠️ 来源追踪列（utm_* / referrer / landing_page / first_touch_at）刻意**不在此白名单**：
//    它们是内部归因数据，不是供应商档案的公开事实，只允许 admin select("*") 读取。
//
// 🔴 铁律：严禁在本字符串内写 `--` 形式的注释。
//    PostgREST 把 `--` 当作 SQL 行注释，会把整段 select 连同后续列一起吞掉，
//    导致 `failed to parse select parameter` —— 表现是构建期 SSG 全部查不到供应商、
//    页面 200 但数据空（fail-open 回落静态常量），极难察觉。注释一律写在字符串外。
const ROW_SELECT = `
  id, slug, legal_name, country_code, city, industry_code, business_type,
  established, employees, main_products, export_markets, verification_status,
  verification_level, updated_at,
  risk_score, certifications, audit_status, inspection_history,
  risk_breakdown, access_tier, is_published,
  company_type, english_name, production_capacity, monthly_output, factory_size,
  export_since, self_reported_certificates,
  address, website, registration_number,
  region, cluster, cluster_slug, cluster_tags,
  supplier_evidence ( id, type, status, source, date, note, visibility )
`;

/**
 * 自述证书 jsonb → 结构化数组。
 *
 * 🔴 三个"宁可少显示"的收敛点（都是为了让脏数据不变成假可信信息）：
 *   1. 非数组 / null → []（**不抛错**，一张脏行不能让整个档案页 fallback 到静态数据）；
 *   2. 逐行只保留四个已知键，字符串外的类型一律丢弃；
 *   3. 四键全空的整行丢弃（表单允许留空行，空行不该渲染成一条证书）。
 */
function parseSelfReportedCerts(raw: unknown): SelfReportedCertificate[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SelfReportedCertificate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const pick = (k: string): string =>
      typeof r[k] === "string" ? (r[k] as string).trim() : "";
    const row: SelfReportedCertificate = {
      name: pick("name"),
      number: pick("number"),
      issued: pick("issued"),
      expires: pick("expires"),
    };
    if (!row.name && !row.number && !row.issued && !row.expires) continue;
    out.push(row);
  }
  return out.length > 0 ? out : undefined;
}

/** 空字符串与 null 一律归一为 undefined，避免前台渲染出空行 / "null" */
function nz(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

/**
 * 数据库行 → SupplierView。
 *
 * 关键点：lastChecked / evidenceCount 只统计 **public 证据**，
 * 避免"付费证据的存在性"从公开元数据里泄漏（条数本身也是信息）。
 */
function rowToView(row: SupplierRow): SupplierView {
  const allEvidence = row.supplier_evidence ?? [];
  const publicEvidence = allEvidence.filter(
    (e) => (e.visibility ?? "public") === "public"
  );
  /**
   * 🔴 缺失分数必须保持**缺失**，绝不能 `?? 0`。
   *
   * 0 不是「没有分数」，而是 V1.1 分桶里**最差的一档**（`overallLevel(0)` = CRITICAL）。
   * 库内 `risk_score` 为 NULL 的供应商（无问卷来源 ⇒ 平台未评分）一旦被填成 0，
   * 会顺着 `profileScore` 一路流到 `generateSupplierDescription()`，
   * 在 meta description 里公开断言「Supplier profile score 0 out of 100」——
   * 这是对真实企业的诋毁性陈述，2026-09-15 已在 5 家新发布供应商上实际发生。
   */
  const riskScore =
    typeof row.risk_score === "number" ? row.risk_score : undefined;
  return {
    id: row.id,
    slug: row.slug,
    legalName: row.legal_name,
    country: row.country_code,
    countryName: countryNameOf(row.country_code),
    city: row.city,
    industryCode: row.industry_code ?? undefined,
    businessType: row.business_type ?? "",
    established: row.established ?? undefined,
    employees: row.employees ?? undefined,
    mainProducts: row.main_products ?? [],
    exportMarkets: row.export_markets ?? [],
    verificationStatus: row.verification_status ?? undefined,
    // CS-02：公开等级权威源。列缺失（旧 schema）时兜底 unverified —— 保守方向。
    verificationLevel: row.verification_level ?? "unverified",
    riskScore,
    // 等级由分数推导（单一事实来源）。无分数 ⇒ 无等级，绝不落回 0 ⇒ CRITICAL。
    riskLevel: riskScore === undefined ? undefined : overallLevel(riskScore),
    lastChecked: lastCheckedOf(publicEvidence),
    // 档案最后更新时间：直接取 DB 值。触发器 `suppliers_set_updated_at` 保证每次 UPDATE 都刷新。
    updatedAt: row.updated_at ?? null,
    certifications: row.certifications ?? [],
    auditStatus: row.audit_status ?? undefined,
    inspectionHistory: row.inspection_history ?? 0,
    evidenceCount: publicEvidence.length,
    evidenceVerified: publicEvidence.filter((e) => e.status === "VERIFIED").length,
    // 只看"有没有"，绝不把明细内容带出公开层（明细是 paid 层）
    hasScoreBreakdown: row.risk_breakdown != null,
    // ---- CS-12 ----
    englishName: nz(row.english_name),
    companyType: nz(row.company_type),
    website: nz(row.website),
    registrationNumber: nz(row.registration_number),
    address: nz(row.address),
    productionCapacity: nz(row.production_capacity),
    monthlyOutput: nz(row.monthly_output),
    factorySize: nz(row.factory_size),
    // export_since 是 integer；0 / 负数不是合法年份，一律丢弃（009 的 CHECK 只兜 1800–2100）
    exportSince: row.export_since && row.export_since > 0 ? row.export_since : undefined,
    selfReportedCertificates: parseSelfReportedCerts(row.self_reported_certificates),
    // ---- CS-16：FREE 层联系方式 / 属地 ----
    province: nz(row.province),
    contactPerson: nz(row.contact_person),
    contactEmail: nz(row.contact_email),
    whatsapp: nz(row.whatsapp),
    companyDescription: nz(row.company_description),
    // ---- STEP-02（migration 023）：地理大区 + 产业带 ----
    // 历史行这些列全为 NULL ⇒ undefined ⇒ 前台不渲染，绝不回推、绝不编造。
    region: nz(row.region),
    cluster: nz(row.cluster),
    clusterSlug: nz(row.cluster_slug),
    clusterTags: row.cluster_tags && row.cluster_tags.length > 0 ? row.cluster_tags : undefined,
  };
}

/** 拉取已发布供应商（内部共用）。出错返回 null，让调用方回落静态。 */
async function fetchRows(): Promise<SupplierRow[] | null> {
  const { createAdminClient } = await import("./supabaseAdmin");
  const db = createAdminClient();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("suppliers")
      .select(ROW_SELECT)
      .eq("is_published", true)
      // 低风险在前（分数越高风险越低）。
      // 🔴 `nullsFirst: false` 是必需的，不是可选项：PostgREST 在 DESC 下的默认行为是
      //    **NULLS FIRST**，会把「尚未评分」的供应商顶到目录最前面 —— 既与静态兜底路径
      //    的排序（未评分排最后）不一致，也让一个以「已核验」为卖点的目录以未评分企业开篇。
      .order("risk_score", { ascending: false, nullsFirst: false });
    if (error) {
      console.error("[queries] suppliers query failed", error.message);
      return null;
    }
    return (data ?? []) as unknown as SupplierRow[];
  } catch (e) {
    console.error("[queries] suppliers query exception", e);
    return null;
  }
}

/**
 * 按 tier 裁剪一层。
 * 所有对外函数都必须过这里 —— 这是付费内容不泄漏的唯一保证。
 */
function redactViews(
  rows: SupplierRow[],
  tier: MembershipTier,
  /**
   * STEP-04：`cluster_slug` → 已发布产业带名。**由调用方批量查好后传入**，
   * 不在本函数里查（本函数是纯同步映射，且每次渲染只允许一次批量查询）。
   * 缺省 = 不解析 ⇒ clusterName 一律 undefined。
   */
  clusterNames?: Map<string, string>
): SupplierView[] {
  return rows.map((row) => {
    const view = rowToView(row);
    const redacted = redactSupplier(
      view as unknown as Record<string, unknown>,
      tier
    ) as Partial<SupplierView>;
    // ⚠️ 铺底只能放 public 字段与结构字段。
    //    曾在这里铺了 exportMarkets / certifications / inspectionHistory ——
    //    它们分属 free / paid 层，裁剪结果里没有这些 key 时铺底值就会保留下来，
    //    等于 visitor 白拿付费内容。裁剪结果覆盖铺底，非 public 字段一律不铺。
    return {
      id: view.id,
      slug: view.slug,
      legalName: view.legalName,
      country: view.country,
      countryName: view.countryName,
      city: view.city,
      businessType: view.businessType,
      mainProducts: view.mainProducts,
      verificationStatus: view.verificationStatus,
      verificationLevel: view.verificationLevel,
      riskScore: view.riskScore,
      riskLevel: view.riskLevel,
      evidenceCount: view.evidenceCount,
      evidenceVerified: view.evidenceVerified,
      // 结构性布尔（不是内容）：「有没有风险分维度明细」。三档位看到的是同一个值。
      hasScoreBreakdown: view.hasScoreBreakdown,
      lastChecked: view.lastChecked,
      // PHASE 03：档案最后更新时间。与 lastChecked 同族（公开的结构性时间事实），
      // 但**刻意不进 PUBLIC_FIELDS** —— 那样会改动 public/free/paid 边界常量，
      // 触发 cs05c / cs06a 的 `PUBLIC_FIELDS.length === 21` 断言。
      // 这里走「public 铺底」通道：它不是内容字段，三档位都应看到同一个值。
      updatedAt: view.updatedAt,
      // ---- STEP-04：地理大区 + 产业带（**走 public 铺底通道**，不进 PUBLIC_FIELDS）----
      // 为什么不加进 PUBLIC_FIELDS：那会改动 public/free/paid 的字段边界常量，
      // 触发 cs05c / cs06a 的 `PUBLIC_FIELDS.length === 21` 断言，属"改权限口径"。
      //
      // 为什么这样铺底是安全的：
      //   · region 是**比 city 更粗**的地理描述，而 city 早已是 public；
      //   · clusterName 的来源（industrial_clusters）只放行 is_published=true 的行；
      //   · 三者对三档位返回**同一个值**，不构成任何付费内容泄漏。
      // 与 updatedAt 同族处理：结构化/非内容的公开描述字段，走铺底而非改分层常量。
      region: view.region,
      cluster: view.cluster,
      clusterSlug: view.clusterSlug,
      clusterName: view.clusterSlug ? clusterNames?.get(view.clusterSlug) : undefined,
      ...redacted,
    } as SupplierView;
  });
}

// ---------- 对外 API（签名与 V2.0 完全一致） ----------

/**
 * 目录专用只读聚合：存在 ≥1 条 `verification_status='VERIFIED'` 审核记录的 supplier_id。
 *
 * 为什么目录要单独聚合一次：CS-02 的公开等级 = `publicVerificationLevel(verification_level, hasRealEvent)`，
 * 其中「真实核验事件」= 已发布的 `supplier_audits` 里 VERIFIED 的记录。
 * 详情页有 `getSupplierPublicAudits(slug)` 可逐家判定；目录一次渲染多家，
 * 逐家查就是 N+1，故这里只取 `supplier_id` 做一次分组（审核元数据仍走各自的公开函数，
 * 不在这里返回任何审计细节 —— 目录卡不需要，也不该携带）。
 *
 * 🔴 失败方向保守：未配置数据库 / 表未建 / 查询出错 → 返回**空集** ⇒ 一律判成 Level 0（未核验）。
 *    绝不因为一次查询失败把「无事件」误显成「已核验」。
 */
async function verifiedAuditSupplierIds(): Promise<Set<string>> {
  const out = new Set<string>();
  const { createAdminClient } = await import("./supabaseAdmin");
  const db = createAdminClient();
  if (!db) return out;
  try {
    const { data, error } = await db
      .from("supplier_audits")
      .select("supplier_id")
      .eq("verification_status", "VERIFIED");
    if (error) {
      if (!isMissingTable(error.code)) {
        console.error("[queries] verified audit ids failed", error.code, error.message);
      }
      return out;
    }
    for (const r of (data ?? []) as { supplier_id: string }[]) {
      if (r?.supplier_id) out.add(r.supplier_id);
    }
    return out;
  } catch (e) {
    console.error("[queries] verified audit ids exception", e);
    return out;
  }
}

/**
 * 供应商目录：带证据统计与国家名。
 * 注意：返回真实条数，不补 mock 数字，也不显示平台规模 —— 收录量小就把
 * 「找不到？发 RFQ」做成主入口（PRD §57/§58）。
 *
 * 目录页是 SEO 直出页面，固定用 visitor 档位（只有 public 字段）。
 */
export async function listSupplierDirectory(): Promise<SupplierView[]> {
  if (useSupabase()) {
    const rows = await fetchRows();
    if (rows) {
      // STEP-04：产业带名 DB-first 解析。
      //   · 当前 17/17 供应商 cluster_slug 为 NULL ⇒ 解析函数早退，**零额外查询**；
      //   · 有 slug 时是**一次** `.in(slug, …)` 批量查询（不是 N+1），
      //     且函数内显式 `.eq("is_published", true)`（公开读走 service_role，RLS 不生效）。
      const clusterNames = await resolvePublishedClusterNames(rows.map((r) => r.cluster_slug));
      const views = redactViews(rows, "visitor", clusterNames);
      // PHASE 03（P0）：目录卡片必须显示**真实**公开核验等级。
      // 与 /suppliers/[slug] 同一函数（publicVerificationLevel），保证两处永不打架。
      const withEvent = await verifiedAuditSupplierIds();
      return views.map((v) => ({
        ...v,
        publicVerificationLevel: publicVerificationLevel(
          v.verificationLevel,
          withEvent.has(v.id)
        ),
      }));
    }
  }
  // 静态兜底数据里不存在任何核验事件记录 ⇒ 一律 Level 0（保守方向，与修复前显示一致）。
  // V1.1：分数越高 = 风险越低，因此目录按分数降序排（风险最低的在前）。
  return STATIC_SUPPLIERS.map(toView)
    .map((v) => ({ ...v, publicVerificationLevel: 0 }))
    .sort((a, b) => {
      // 未评分（undefined）不得当作 0 参与排序：0 是最差等级，会把它错误地排到最后一名
      // 之外还暗示「风险最高」。统一用 -1 沉底，与 DB 路径的 `nullsFirst: false` 对齐。
      if (a.riskScore !== b.riskScore) {
        return (b.riskScore ?? -1) - (a.riskScore ?? -1);
      }
      return a.legalName.localeCompare(b.legalName);
    });
}

/**
 * STEP-07：首页 Live Buyer Requests 公开读取。
 *
 * 数据源与 listSupplierDirectory 完全同源（useSupabase / createAdminClient / 静态兜底），
 * 因此首页仍是构建期冻结的 Server Component，不会因本函数变成动态页。
 *
 * 安全红线：
 *   · 只 SELECT 公开白名单列（绝不 select("*")，绝不把整行传给前台）；
 *   · 过滤 is_public = true AND status <> 'closed'（status 是内部处理进度，关闭需求不展示）；
 *   · 单次查询、LIMIT 5，零 N+1；
 *   · 返回 DTO（PublicRfq），不含 email/company/message/user_id/status/utm 等任何私密/内部字段。
 */
export type PublicRfq = {
  referenceId: string;
  product: string;
  quantity: string | null;
  targetMarket: string | null;
  industryCode: string | null;
  certificationsReq: string[] | null;
  /** STEP 10-B：关联产业带 slug（仅当该 RFQ 从集群入口提交时非空；隐私安全，不含任何私密字段） */
  clusterSlug?: string | null;
  createdAt: string;
};

/**
 * STEP 10-B：公开 Buyer Requests 列表（数据源 = rfqs.is_public=true，不新建 buyer_requests 表）。
 *
 * @param limit 上限（1–20）
 * @param opts.clusterSlug 可选：仅返回某产业带的 Buyer Requests（集群详情页用）。
 *        为空/缺省 = 返回全部公开 RFQ（首页 Live Buyer Requests 模块用）。
 *
 * 安全红线不变：只 SELECT 公开白名单列，**绝不**返回 email/company/message/user_id/status/utm。
 * 新增的 industrial_cluster_slug 是公开元数据（集群详情页本就公开），不构成泄露。
 */
export async function listPublicRfqs(
  limit = 5,
  opts?: { clusterSlug?: string }
): Promise<PublicRfq[]> {
  if (!useSupabase()) return [];
  const { createAdminClient } = await import("./supabaseAdmin");
  const db = createAdminClient();
  if (!db) return [];
  try {
    let q = db
      .from("rfqs")
      .select(
        "reference_id, product, quantity, target_market, industry_code, certifications_req, industrial_cluster_slug, created_at"
      )
      .eq("is_public", true)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(limit, 20)));
    if (opts?.clusterSlug) {
      q = q.eq("industrial_cluster_slug", opts.clusterSlug);
    }
    const { data, error } = await q;
    if (error) {
      if (!isMissingTable(error.code)) {
        console.error("[queries] public rfqs failed", error.code, error.message);
      }
      return [];
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      referenceId: String(r.reference_id ?? ""),
      product: String(r.product ?? ""),
      quantity: r.quantity == null ? null : String(r.quantity),
      targetMarket: r.target_market == null ? null : String(r.target_market),
      industryCode: r.industry_code == null ? null : String(r.industry_code),
      certificationsReq: Array.isArray(r.certifications_req)
        ? (r.certifications_req as unknown[]).map(String)
        : null,
      clusterSlug:
        typeof r.industrial_cluster_slug === "string" ? r.industrial_cluster_slug : null,
      createdAt: String(r.created_at ?? ""),
    }));
  } catch (e) {
    console.error("[queries] public rfqs exception", e);
    return [];
  }
}

/**
 * 供应商详情：基本信息 + 证据 + 能力标签（能力标签按 locale 取名，避免英文页出现中文）
 *
 * @param tier 访问者档位。默认 visitor（SEO 直出场景）。
 *             传入真实 tier 后会额外返回 evidence 明细 / riskBreakdown 等付费字段。
 */
export async function getSupplierDetail(
  slug: string,
  locale: "en" | "zh" | "zh-TW" = "en",
  tier: MembershipTier = "visitor"
) {
  // 「每条证据的核验状态」是 paid 层展示项：证据的类型名与日期属于公开信息
  // （与"平台核验范围"同层），但状态值只有 paid 档位才返回。
  const showEvidenceStatus = canAccess(tier, "paid");

  if (useSupabase()) {
    const { createAdminClient } = await import("./supabaseAdmin");
    const db = createAdminClient();
    if (db) {
      try {
        const { data, error } = await db
          .from("suppliers")
          .select(ROW_SELECT)
          .eq("slug", slug)
          .eq("is_published", true)
          .maybeSingle();

        if (!error && data) {
          const row = data as unknown as SupplierRow;
          const view = rowToView(row);
          const capabilities = await getSupplierCapabilitiesResolved(slug, locale);

          // 证据按 visibility 裁剪后，再按档位决定是否带出核验状态
          const visibleEvidence = redactEvidence(
            (row.supplier_evidence ?? []).map((e, i) => ({
              id: e.id ?? `${slug}-ev-${i}`,
              type: e.type ?? "",
              status: e.status,
              source: e.source ?? "",
              date: e.date,
              note: e.note ?? null,
              visibility: e.visibility,
            })),
            tier
          ).map((e) => (showEvidenceStatus ? e : { ...e, status: "" }));

          // STEP-04：详情页只有 1 家供应商 ⇒ 传 1 个 slug 给**同一个**批量函数
          // （不另写单条查询路径，避免两条路径行为漂移）。无 slug 时仍是零查询。
          const clusterNames = await resolvePublishedClusterNames([row.cluster_slug]);
          const base = redactViews([row], tier, clusterNames)[0] ?? view;
          return {
            ...base,
            riskLevel: view.riskLevel,
            ...(canAccess(tier, "paid")
              ? { riskBreakdown: row.risk_breakdown ?? null }
              : {}),
            evidence: visibleEvidence,
            capabilities,
          };
        }
      } catch (e) {
        console.error("[queries] getSupplierDetail exception", e);
        // 落到下面的静态路径
      }
    }
  }

  // ---- 静态路径（V2.0 原实现） ----
  //
  // ⚠️ 静态路径同样必须裁剪。本站默认跑静态数据（SUPPLIER_DATA_SOURCE 未配时），
  //    若这里返回全量，解锁接口会把付费字段原样发给游客 —— 裁剪在服务端才有意义。
  const row = STATIC_SUPPLIERS.find((s) => s.slug === slug);
  if (!row) return null;
  const view = toView(row);
  const capabilities = await getSupplierCapabilitiesResolved(slug, locale);
  const redacted = redactSupplier(
    view as unknown as Record<string, unknown>,
    tier
  ) as Partial<SupplierView>;
  return {
    // public 字段铺底，非 public 字段完全由裁剪结果决定（顺序不能反）
    id: view.id,
    slug: view.slug,
    legalName: view.legalName,
    country: view.country,
    countryName: view.countryName,
    city: view.city,
    businessType: view.businessType,
    mainProducts: view.mainProducts,
    verificationStatus: view.verificationStatus,
    verificationLevel: view.verificationLevel,
    riskScore: view.riskScore,
    riskLevel: view.riskLevel,
    evidenceCount: view.evidenceCount,
    evidenceVerified: view.evidenceVerified,
    hasScoreBreakdown: view.hasScoreBreakdown,
    lastChecked: view.lastChecked,
    updatedAt: view.updatedAt,
    ...redacted,
    evidence: row.evidence.map((e, i) => ({
      id: `${slug}-ev-${i}`,
      type: e.type,
      status: showEvidenceStatus ? e.status : "",
      source: e.source,
      date: e.date,
      note: e.note ?? null,
    })),
    capabilities,
  };
}

export async function listSuppliers(): Promise<SupplierView[]> {
  return listSupplierDirectory();
}

export async function getSupplierBySlug(slug: string): Promise<SupplierView | null> {
  if (useSupabase()) {
    const { createAdminClient } = await import("./supabaseAdmin");
    const db = createAdminClient();
    if (db) {
      try {
        const { data } = await db
          .from("suppliers")
          .select(ROW_SELECT)
          .eq("slug", slug)
          .eq("is_published", true)
          .maybeSingle();
        if (data) {
          const row = data as unknown as SupplierRow;
          // STEP-04：与 listSupplierDirectory / getSupplierDetail 用**同一个**解析函数，
          // 保证「列表卡」与「档案页」永不出现两种产业带命名。
          const clusterNames = await resolvePublishedClusterNames([row.cluster_slug]);
          return redactViews([row], "visitor", clusterNames)[0];
        }
        return null;
      } catch {
        /* 回落静态 */
      }
    }
  }
  const row = STATIC_SUPPLIERS.find((s) => s.slug === slug);
  return row ? toView(row) : null;
}

/** sitemap 用：只要国家 + slug，顺序必须与静态路径一致（risk_score DESC） */
export async function listSupplierSlugs(): Promise<{ country: string; slug: string }[]> {
  if (useSupabase()) {
    const rows = await fetchRows();
    // ★ 顺序必须与静态路径一致，否则 sitemap 每次生成顺序跳动，影响抓取预算
    if (rows) return rows.map((r) => ({ country: r.country_code, slug: r.slug }));
  }
  return STATIC_SUPPLIERS.map((s) => ({ country: s.countryCode, slug: s.slug }));
}

/**
 * sitemap 专用（PHASE 03 §十）：已发布供应商的「可索引性判定输入」+ **真实** updated_at。
 *
 * 为什么不能继续用 `listSupplierSlugs()`：
 *   它只返回 {country, slug}，sitemap 无法判断某条 URL 是否够格进站内地图，
 *   于是历史上是「只要 published 就提交」。§八 要求提交集合必须与可索引性闸门**同源**，
 *   否则会向 Google 提交 noindex 页面（Search Console 会报 "Submitted URL marked noindex"）。
 *
 * 只暴露判定闸门需要的公开字段 —— free / paid 字段一律不出（本函数可能被构建期调用）。
 */
export type SupplierSitemapRow = {
  slug: string;
  /** 真实档案更新时间（DB updated_at）。静态兜底为 null ⇒ sitemap 不带 lastModified，绝不编造 */
  updatedAt: string | null;
  legalName: string;
  city: string;
  countryName: string;
  mainProducts: string[];
  /** 已按 CS-02 权威逻辑推导的公开等级 */
  verificationLevel: number;
  hasRealVerificationEvent: boolean;
  website?: string;
  registrationNumber?: string;
  address?: string;
  profileScore?: number | null;
  evidenceOnFile: number;
};

export async function listSupplierSitemapRows(): Promise<SupplierSitemapRow[]> {
  if (useSupabase()) {
    const rows = await fetchRows();
    if (rows) {
      const withEvent = await verifiedAuditSupplierIds();
      return rows.map((row) => {
        const view = rowToView(row);
        const hasReal = withEvent.has(view.id);
        return {
          slug: view.slug,
          updatedAt: view.updatedAt ?? null,
          legalName: view.legalName,
          city: view.city,
          countryName: view.countryName ?? view.country.toUpperCase(),
          mainProducts: view.mainProducts,
          verificationLevel: publicVerificationLevel(view.verificationLevel, hasReal),
          hasRealVerificationEvent: hasReal,
          website: view.website,
          registrationNumber: view.registrationNumber,
          address: view.address,
          profileScore: view.riskScore ?? null,
          evidenceOnFile: view.evidenceCount,
        };
      });
    }
  }
  // 静态兜底：无核验事件、无档案更新时间（都由静态表的结构决定）。
  return STATIC_SUPPLIERS.map((s) => {
    const view = toView(s);
    return {
      slug: view.slug,
      updatedAt: null,
      legalName: view.legalName,
      city: view.city,
      countryName: view.countryName ?? view.country.toUpperCase(),
      mainProducts: view.mainProducts,
      verificationLevel: 0,
      hasRealVerificationEvent: false,
      website: undefined,
      registrationNumber: undefined,
      address: undefined,
      profileScore: view.riskScore ?? null,
      evidenceOnFile: view.evidenceCount,
    };
  });
}

// ---------- 落地页 / SEO 矩阵消费用的供应商行（CS-02C G1 起 DB 优先，静态兜底） ----------
//
// 消费方：/countries/[slug] · /industry/[slug] · /audit-guide/[country]/[auditType]。
//
// 🔴 G1 历史缺陷（2026-09-13 修复）：这三个函数曾一律只读 STATIC_SUPPLIERS，
//    而目录 /suppliers 读库 ⇒ 库里已发布但静态表没有的供应商（如唯一一家食品厂
//    guangzhou-sunny-food）在行业页渲染 0 家 —— 「数据库明明有、行业页却看不见」的分裂。
//    现在：Supabase 可用时读库（is_published=true，risk_score 降序），失败回落静态。
//
// 返回形状仍为 StaticSupplier（页面零改动）。DB 行映射时**只放公开层字段**：
//    capabilities/evidence 置空（行业页的能力标签由 getSupplierCapabilitiesResolved
//    按 slug 另取；certifications 属 PAID 层，矩阵行绝不携带）。

/** 分数越高 = 风险越低，落地页先展示风险最低的供应商。未评分（null）沉底。 */
function sortByRisk(rows: StaticSupplier[]): StaticSupplier[] {
  return [...rows].sort((a, b) => (b.riskScore ?? -1) - (a.riskScore ?? -1));
}

/** DB 行 → 矩阵行。只映射公开层 + 结构字段，付费字段一律不进（与 redactViews 同纪律）。 */
function rowToMatrix(row: SupplierRow): StaticSupplier {
  return {
    id: row.id,
    slug: row.slug,
    legalName: row.legal_name,
    countryCode: row.country_code,
    city: row.city,
    industryCode: row.industry_code ?? "",
    businessType: row.business_type ?? "",
    established: row.established ?? 0,
    employees: row.employees ?? "",
    mainProducts: row.main_products ?? [],
    exportMarkets: row.export_markets ?? [],
    verificationStatus: row.verification_status ?? "",
    // 同 rowToView：NULL 保持 null（不编造 0 分）。矩阵行会渲染到行业/国家/审核指南
    // 落地页的供应商列表里，那三处必须靠 null 判定显示「—」。
    riskScore: typeof row.risk_score === "number" ? row.risk_score : null,
    certifications: [],
    auditStatus: row.audit_status ?? "",
    inspectionHistory: row.inspection_history ?? 0,
    capabilities: [],
    evidence: [],
  };
}

function staticMatrix(
  filter: (s: StaticSupplier) => boolean
): StaticSupplier[] {
  return sortByRisk(STATIC_SUPPLIERS.filter(filter));
}

export async function listSuppliersByCountry(
  countryCode: string
): Promise<StaticSupplier[]> {
  if (useSupabase()) {
    const rows = await fetchRows(); // 已按 risk_score 降序
    if (rows) return rows.filter((r) => r.country_code === countryCode).map(rowToMatrix);
  }
  return staticMatrix((s) => s.countryCode === countryCode);
}

export async function listSuppliersByIndustry(
  industryCode: string
): Promise<StaticSupplier[]> {
  if (useSupabase()) {
    const rows = await fetchRows();
    if (rows) return rows.filter((r) => r.industry_code === industryCode).map(rowToMatrix);
  }
  return staticMatrix((s) => s.industryCode === industryCode);
}

/**
 * 按产业带 slug 取已发布供应商（`/industrial-clusters/[slug]` 详情页用）。
 *
 * 与 listSuppliersByCountry 同构：一次 fetchRows（内部已带 `.eq("is_published", true)`）
 * 后在内存过滤，不按 cluster 逐个往返。
 *
 * 空/缺省返回 `[]`，**刻意不回落到静态种子数据** —— 静态种子里没有产业带维度，
 * 若回落就会让「某个产业带恰好包含那 4 家种子企业」变成凭空的商业关联。宁可列表为空。
 */
export async function listSuppliersByClusterSlug(
  clusterSlug: string
): Promise<StaticSupplier[]> {
  const key = (clusterSlug ?? "").trim();
  if (!key) return [];
  if (useSupabase()) {
    const rows = await fetchRows();
    if (rows) return rows.filter((r) => r.cluster_slug === key).map(rowToMatrix);
  }
  return [];
}

/**
 * Cluster Directory 的「每家产业带有多少已发布供应商」计数。
 *
 * 🔴 铁律一：**禁止 N+1**。反例是 `clusters.map(c => countSuppliersInCluster(c.slug))` ——
 *    N 个产业带就是 N 次数据库往返（外加各自的连接开销）。这里固定为
 *    **1 次查询 + 内存分组**：Cluster Query ≤ 1、Supplier Count Query ≤ 1。
 *
 * 🔴 铁律二：只统计**已发布**供应商。公开读走 service_role，RLS 不生效，
 *    `fetchRows` 内部那行 `.eq("is_published", true)` 是唯一闸门。
 *
 * 返回的 Map 对每个传入 slug 都给条目（缺省 0），让调用方能区分
 * 「该产业带已发布但暂无供应商」与「计数根本没跑」；空入参 ⇒ 零查询。
 */
export async function countSuppliersByClusterSlugs(
  slugs: (string | null | undefined)[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const wanted = new Set(
    slugs.map((s) => (s ?? "").trim()).filter((s) => s.length > 0)
  );
  if (wanted.size === 0) return out; // 零 slug ⇒ 零查询
  for (const s of wanted) out.set(s, 0);

  if (useSupabase()) {
    const rows = await fetchRows();
    if (rows) {
      for (const r of rows) {
        const key = (r.cluster_slug ?? "").trim();
        if (key && wanted.has(key)) out.set(key, (out.get(key) ?? 0) + 1);
      }
    }
  }
  return out;
}

export async function listSuppliersByAuditType(
  countryCode: string,
  refCode: string
): Promise<StaticSupplier[]> {
  if (useSupabase()) {
    const rows = await fetchRows();
    if (rows) {
      const caps = await fetchAuditTypeCaps();
      // 静态表的能力标签并入判定：静态四家在库里有副本，但若 capabilities 表缺行，
      // 不能因为 G1 切库而让它们从 audit-guide 页消失（宁可多判，不可漏判）。
      const staticCaps = new Map(STATIC_SUPPLIERS.map((s) => [s.slug, s.capabilities]));
      const matched = rows
        .filter(
          (r) =>
            r.country_code === countryCode &&
            (caps.get(r.id)?.has(refCode) ||
              staticCaps
                .get(r.slug)
                ?.some((c) => c.refType === "AUDIT_TYPE" && c.refCode === refCode))
        )
        .map(rowToMatrix);
      return matched;
    }
  }
  return sortByRisk(
    STATIC_SUPPLIERS.filter(
      (s) =>
        s.countryCode === countryCode &&
        s.capabilities.some((c) => c.refType === "AUDIT_TYPE" && c.refCode === refCode)
    )
  );
}

/** supplier_capabilities 里 ref_type=AUDIT_TYPE 的行，按 supplier_id 分组。出错返回空表。 */
async function fetchAuditTypeCaps(): Promise<Map<string, Set<string>>> {
  const { createAdminClient } = await import("./supabaseAdmin");
  const db = createAdminClient();
  const out = new Map<string, Set<string>>();
  if (!db) return out;
  try {
    const { data, error } = await db
      .from("supplier_capabilities")
      .select("supplier_id, ref_code")
      .eq("ref_type", "AUDIT_TYPE");
    if (error) {
      console.error("[queries] capabilities query failed", error.message);
      return out;
    }
    for (const r of (data ?? []) as { supplier_id: string; ref_code: string }[]) {
      if (!out.has(r.supplier_id)) out.set(r.supplier_id, new Set());
      out.get(r.supplier_id)!.add(r.ref_code);
    }
  } catch (e) {
    console.error("[queries] capabilities query exception", e);
  }
  return out;
}

// ---------- 公开认证 / 审核记录（004_documents.sql 新增表） ----------
//
// 三条硬约束（spec §18 + §20）：
//   1. 只返回 verification_status='VERIFIED' 的记录 —— 草稿 / 待审 / 已驳回一律不出前台。
//   2. 绝不返回 file_path / verified_by / notes 等内部字段；公开侧只有元数据，没有文件。
//   3. 未配置数据库、或 004 迁移尚未执行时返回 []，前台不崩、只是没有内容。
//
// 这里用 service_role 读（createAdminClient），因此**过滤必须在代码里显式做**，
// 不能依赖 RLS。RLS 是第二道防线，不是唯一防线。

export type PublicCertification = {
  id: string;
  programCode: string;
  certificateNo: string | null;
  issuingBody: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  scope: string | null;
};

export type PublicAudit = {
  id: string;
  auditType: string;
  standardCode: string | null;
  auditDate: string;
  auditorName: string | null;
  auditorOrg: string | null;
  result: string | null;
};

/** 未建表 / 无权限时的 PostgREST 错误码，静默处理，避免刷构建日志。 */
function isMissingTable(code?: string): boolean {
  return code === "PGRST205" || code === "42P01";
}

/** slug → 已发布供应商的 id。找不到返回 null。 */
async function publishedSupplierId(slug: string): Promise<string | null> {
  const { createAdminClient } = await import("./supabaseAdmin");
  const db = createAdminClient();
  if (!db) return null;
  const { data, error } = await db
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function getSupplierPublicCertifications(
  slug: string
): Promise<PublicCertification[]> {
  if (!useSupabase()) return [];
  try {
    const supplierId = await publishedSupplierId(slug);
    if (!supplierId) return [];
    const { createAdminClient } = await import("./supabaseAdmin");
    const db = createAdminClient();
    if (!db) return [];
    const { data, error } = await db
      .from("supplier_certifications")
      .select(
        "id, program_code, certificate_no, issuing_body, issue_date, expiry_date, scope, verification_status"
      )
      .eq("supplier_id", supplierId)
      .eq("verification_status", "VERIFIED")
      .order("expiry_date", { ascending: false, nullsFirst: false });
    if (error) {
      if (!isMissingTable(error.code)) {
        console.error("[queries] public certifications failed", error.code, error.message);
      }
      return [];
    }
    return (data ?? []).map((r) => {
      const x = r as Record<string, unknown>;
      return {
        id: String(x.id),
        programCode: String(x.program_code ?? ""),
        certificateNo: (x.certificate_no as string | null) ?? null,
        issuingBody: (x.issuing_body as string | null) ?? null,
        issueDate: (x.issue_date as string | null) ?? null,
        expiryDate: (x.expiry_date as string | null) ?? null,
        scope: (x.scope as string | null) ?? null,
      };
    });
  } catch (e) {
    console.error("[queries] public certifications exception", e);
    return [];
  }
}

export async function getSupplierPublicAudits(slug: string): Promise<PublicAudit[]> {
  if (!useSupabase()) return [];
  try {
    const supplierId = await publishedSupplierId(slug);
    if (!supplierId) return [];
    const { createAdminClient } = await import("./supabaseAdmin");
    const db = createAdminClient();
    if (!db) return [];
    const { data, error } = await db
      .from("supplier_audits")
      .select(
        "id, audit_type, standard_code, audit_date, auditor_name, auditor_org, result, verification_status"
      )
      .eq("supplier_id", supplierId)
      .eq("verification_status", "VERIFIED")
      .order("audit_date", { ascending: false });
    if (error) {
      if (!isMissingTable(error.code)) {
        console.error("[queries] public audits failed", error.code, error.message);
      }
      return [];
    }
    return (data ?? []).map((r) => {
      const x = r as Record<string, unknown>;
      return {
        id: String(x.id),
        auditType: String(x.audit_type ?? ""),
        standardCode: (x.standard_code as string | null) ?? null,
        auditDate: String(x.audit_date ?? ""),
        auditorName: (x.auditor_name as string | null) ?? null,
        auditorOrg: (x.auditor_org as string | null) ?? null,
        result: (x.result as string | null) ?? null,
      };
    });
  } catch (e) {
    console.error("[queries] public audits exception", e);
    return [];
  }
}
