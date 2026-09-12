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
import { overallLevel } from "./riskEngine";
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
  certifications: string[];
  auditStatus?: string;
  inspectionHistory: number;
  /** 证据条数（仅统计 public 证据，避免付费内容的"存在性"泄漏） */
  evidenceCount: number;
  /** 其中已核验的条数 */
  evidenceVerified: number;

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
    riskScore: s.riskScore,
    riskLevel: overallLevel(s.riskScore),
    lastChecked: lastCheckedOf(s.evidence),
    certifications: s.certifications,
    auditStatus: s.auditStatus,
    inspectionHistory: s.inspectionHistory,
    evidenceCount: s.evidence.length,
    evidenceVerified: s.evidence.filter((e) => e.status === "VERIFIED").length,
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

const ROW_SELECT = `
  id, slug, legal_name, country_code, city, industry_code, business_type,
  established, employees, main_products, export_markets, verification_status,
  verification_level,
  risk_score, certifications, audit_status, inspection_history,
  risk_breakdown, access_tier, is_published,
  company_type, english_name, production_capacity, monthly_output, factory_size,
  export_since, self_reported_certificates,
  address, website, registration_number,
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
  const riskScore = row.risk_score ?? 0;
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
    riskLevel: overallLevel(riskScore),
    lastChecked: lastCheckedOf(publicEvidence),
    certifications: row.certifications ?? [],
    auditStatus: row.audit_status ?? undefined,
    inspectionHistory: row.inspection_history ?? 0,
    evidenceCount: publicEvidence.length,
    evidenceVerified: publicEvidence.filter((e) => e.status === "VERIFIED").length,
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
      .order("risk_score", { ascending: false }); // 低风险在前（分数越高风险越低）
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
function redactViews(rows: SupplierRow[], tier: MembershipTier): SupplierView[] {
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
      lastChecked: view.lastChecked,
      ...redacted,
    } as SupplierView;
  });
}

// ---------- 对外 API（签名与 V2.0 完全一致） ----------

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
    if (rows) return redactViews(rows, "visitor");
  }
  // V1.1：分数越高 = 风险越低，因此目录按分数降序排（风险最低的在前）。
  return STATIC_SUPPLIERS.map(toView).sort((a, b) => {
    if (a.riskScore !== b.riskScore) return (b.riskScore ?? 0) - (a.riskScore ?? 0);
    return a.legalName.localeCompare(b.legalName);
  });
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

          const base = redactViews([row], tier)[0] ?? view;
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
    lastChecked: view.lastChecked,
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
        if (data) return redactViews([data as unknown as SupplierRow], "visitor")[0];
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

/** 分数越高 = 风险越低，落地页先展示风险最低的供应商。 */
function sortByRisk(rows: StaticSupplier[]): StaticSupplier[] {
  return [...rows].sort((a, b) => b.riskScore - a.riskScore);
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
    riskScore: row.risk_score ?? 0,
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
