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
  risk_score: number | null;
  certifications: string[] | null;
  audit_status: string | null;
  inspection_history: number | null;
  risk_breakdown: unknown;
  access_tier: string;
  is_published: boolean;
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
  risk_score, certifications, audit_status, inspection_history,
  risk_breakdown, access_tier, is_published,
  supplier_evidence ( id, type, status, source, date, note, visibility )
`;

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
    riskScore,
    riskLevel: overallLevel(riskScore),
    lastChecked: lastCheckedOf(publicEvidence),
    certifications: row.certifications ?? [],
    auditStatus: row.audit_status ?? undefined,
    inspectionHistory: row.inspection_history ?? 0,
    evidenceCount: publicEvidence.length,
    evidenceVerified: publicEvidence.filter((e) => e.status === "VERIFIED").length,
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
      slug: view.slug,
      legalName: view.legalName,
      country: view.country,
      countryName: view.countryName,
      city: view.city,
      businessType: view.businessType,
      mainProducts: view.mainProducts,
      verificationStatus: view.verificationStatus,
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
    slug: view.slug,
    legalName: view.legalName,
    country: view.country,
    countryName: view.countryName,
    city: view.city,
    businessType: view.businessType,
    mainProducts: view.mainProducts,
    verificationStatus: view.verificationStatus,
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

// ---------- 落地页 / SEO 矩阵消费用的原始静态行（保留 countryCode / capabilities / evidence） ----------
// 说明：这些函数返回静态原始形状（含 countryCode 与 capabilities），
// 供 /countries / /industry / /audit-guide 页面按维度过滤与渲染，避免二次解析。
// V2.1 说明：SEO 矩阵页一律走静态数据（内容是编辑维护的，不进库），保持原实现不变。

// 分数越高 = 风险越低，落地页先展示风险最低的供应商。
function sortByRisk(rows: StaticSupplier[]): StaticSupplier[] {
  return [...rows].sort((a, b) => b.riskScore - a.riskScore);
}

export async function listSuppliersByCountry(countryCode: string): Promise<StaticSupplier[]> {
  return sortByRisk(STATIC_SUPPLIERS.filter((s) => s.countryCode === countryCode));
}

export async function listSuppliersByIndustry(industryCode: string): Promise<StaticSupplier[]> {
  return sortByRisk(STATIC_SUPPLIERS.filter((s) => s.industryCode === industryCode));
}

export async function listSuppliersByAuditType(
  countryCode: string,
  refCode: string
): Promise<StaticSupplier[]> {
  return sortByRisk(
    STATIC_SUPPLIERS.filter(
      (s) =>
        s.countryCode === countryCode &&
        s.capabilities.some((c) => c.refType === "AUDIT_TYPE" && c.refCode === refCode)
    )
  );
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
