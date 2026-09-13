// lib/adminData.ts —— Admin 后台数据层（服务端专用）
//
// 全部走 service_role（绕过 RLS）。访问权限由 requireAdmin() 在**每个入口**二次校验，
// 不依赖页面层级 —— 这样即使有人新增一条 admin API 忘了挂中间件，也不会裸奔。
//
// 铁律：
//   1. 本文件的每个导出函数都必须在 Admin 页面/API 里，且调用前已通过 requireAdmin()
//   2. 失败一律返回空/0，绝不抛异常 —— 后台崩了不影响前台做生意
//   3. 这里返回的数据**不裁剪**（Admin 本来就该看全部），但绝不出现在任何公开页面

import { createAdminClient } from "./supabaseAdmin";
import { isAdminUser } from "./membership";
import { type SupplierCreateInput, domainOf } from "./supplierCreate";

export type AdminContext = { userId: string; email: string | null } | null;

/**
 * 权限闸门。非 admin 返回 null，调用方应直接 notFound()。
 *
 * 为什么返回 null 而不是抛错：
 *   Next 的 notFound() 渲染 404 页面，比 500 更合适 ——
 *   不向外界暴露"这里有个后台"这个事实。
 */
export async function requireAdmin(): Promise<AdminContext> {
  // supabaseServer 静态依赖 next/headers，动态 import 使其脱离打包/测试静态图，
  // 仅在调用 requireAdmin 时按需加载（Next 运行时才安全）。
  const { getCurrentUser } = await import("./supabaseServer");
  const user = await getCurrentUser();
  if (!user?.id) return null;
  const ok = await isAdminUser(user.id);
  if (!ok) return null;
  return { userId: user.id, email: user.email ?? null };
}

// ---------- 看板统计 ----------

export type AdminStats = {
  totalUsers: number;
  paidMembers: number;
  totalSuppliers: number;
  publishedSuppliers: number;
  newRfqs: number;
  totalRfqs: number;
  // CS-02D：leads 落库后才有意义。newLeads = 近 7 天，totalLeads = 全量。
  newLeads: number;
  totalLeads: number;
};

/**
 * 看板数字。
 *
 * 口径说明（避免"无据声称"）：
 *   - newRfqs  = 近 7 天新建的询价单
 *   - paidMembers = plan=founding_buyer 且 status=active 的记录数
 *     （注意：这里按库里状态计，含理论上应过期但 webhook 未同步的，
 *       所以和"真实生效中的会员"可能有极小偏差，属正常）
 */
export async function getAdminStats(): Promise<AdminStats> {
  const empty: AdminStats = {
    totalUsers: 0,
    paidMembers: 0,
    totalSuppliers: 0,
    publishedSuppliers: 0,
    newRfqs: 0,
    totalRfqs: 0,
    newLeads: 0,
    totalLeads: 0,
  };
  const db = createAdminClient();
  if (!db) return empty;

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [users, paid, suppliers, published, newRfqs, totalRfqs, newLeads, totalLeads] =
      await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("plan", "founding_buyer")
        .eq("status", "active"),
      db.from("suppliers").select("id", { count: "exact", head: true }),
      db
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true),
      db
        .from("rfqs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      db.from("rfqs").select("id", { count: "exact", head: true }),
      // CS-02D：leads 统计。表不存在/权限异常时 count 为 null → 回落 0，后台不崩。
      db.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since),
      db.from("leads").select("id", { count: "exact", head: true }),
    ]);

    return {
      totalUsers: users.count ?? 0,
      paidMembers: paid.count ?? 0,
      totalSuppliers: suppliers.count ?? 0,
      publishedSuppliers: published.count ?? 0,
      newRfqs: newRfqs.count ?? 0,
      totalRfqs: totalRfqs.count ?? 0,
      newLeads: newLeads.count ?? 0,
      totalLeads: totalLeads.count ?? 0,
    };
  } catch (e) {
    console.error("[adminData] stats failed", e);
    return empty;
  }
}

// ---------- 供应商 ----------

export type AdminSupplierRow = {
  id: string;
  slug: string;
  legal_name: string;
  country_code: string;
  city: string;
  industry_code: string | null;
  risk_score: number | null;
  verification_status: string | null;
  access_tier: string;
  is_published: boolean;
  updated_at: string;
};

export async function listAdminSuppliers(): Promise<AdminSupplierRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("suppliers")
      .select(
        "id, slug, legal_name, country_code, city, industry_code, risk_score, verification_status, access_tier, is_published, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[adminData] list suppliers failed", error.message);
      return [];
    }
    return (data ?? []) as AdminSupplierRow[];
  } catch (e) {
    console.error("[adminData] list suppliers exception", e);
    return [];
  }
}

export type AdminSupplierDetail = AdminSupplierRow & {
  business_type: string | null;
  established: number | null;
  employees: string | null;
  main_products: string[];
  export_markets: string[];
  certifications: string[];
  audit_status: string | null;
  inspection_history: number;
  /** 004_documents.sql 新增；NOT NULL DEFAULT 'unverified'，故总是存在。 */
  verification_level:
    | "unverified"
    | "self_assessment"
    | "platform_assessment"
    | "on_site_audit"
    | "third_party_audit";
};

export async function getAdminSupplier(
  slug: string
): Promise<AdminSupplierDetail | null> {
  const db = createAdminClient();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("suppliers")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return data as AdminSupplierDetail;
  } catch {
    return null;
  }
}

/**
 * 更新供应商（白名单字段）。
 *
 * 为什么用白名单而不是直接 spread：
 *   后台表单字段一旦被人加一项，spread 会把它直接写进库。
 *   白名单保证只有这里列出的字段能被改。
 */
export async function updateAdminSupplier(
  slug: string,
  patch: Partial<{
    legal_name: string;
    city: string;
    industry_code: string;
    business_type: string;
    established: number;
    employees: string;
    verification_status: string;
    risk_score: number;
    audit_status: string;
    inspection_history: number;
    access_tier: "public" | "free" | "paid";
    is_published: boolean;
    verification_level:
      | "unverified"
      | "self_assessment"
      | "platform_assessment"
      | "on_site_audit"
      | "third_party_audit";
  }>
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { error } = await db.from("suppliers").update(patch).eq("slug", slug);
    if (error) {
      console.error("[adminData] update supplier failed", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[adminData] update supplier exception", e);
    return false;
  }
}

// ---------- 供应商创建（CS-03 POST 写入路径） ----------

export type CreateSupplierResult =
  | {
      ok: true;
      id: string;
      slug: string;
      cert_inserted: number;
      cert_warnings: string[];
    }
  | { ok: false; error: "duplicate" | "db" };

export type DuplicateHit = { slug: string; field: string };

/**
 * 应用层多维度去重（slug 唯一约束之外的兜底）。
 * 命中任一维度即视为重复：slug / registration_number / website(domain) /
 * legal_name（大小写不敏感）/ country+city+name / phone / address。
 */
export async function findDuplicateSupplier(
  input: SupplierCreateInput
): Promise<DuplicateHit | null> {
  const db = createAdminClient();
  if (!db) return null;
  try {
    const bySlug = await db
      .from("suppliers")
      .select("slug")
      .eq("slug", input.slug)
      .maybeSingle();
    if (bySlug.data) return { slug: input.slug, field: "slug" };

    if (input.registration_number) {
      const r = await db
        .from("suppliers")
        .select("slug")
        .eq("registration_number", input.registration_number)
        .maybeSingle();
      if (r.data) return { slug: (r.data as { slug: string }).slug, field: "registration_number" };
    }

    if (input.website) {
      const w = await db
        .from("suppliers")
        .select("slug")
        .eq("website", input.website)
        .maybeSingle();
      if (w.data) return { slug: (w.data as { slug: string }).slug, field: "website" };
      const domain = domainOf(input.website);
      if (domain) {
        const w2 = await db
          .from("suppliers")
          .select("slug")
          .eq("website", `https://www.${domain}`)
          .maybeSingle();
        if (w2.data) return { slug: (w2.data as { slug: string }).slug, field: "website" };
      }
    }

    const byName = await db
      .from("suppliers")
      .select("slug")
      .ilike("legal_name", input.legal_name)
      .maybeSingle();
    if (byName.data) return { slug: (byName.data as { slug: string }).slug, field: "legal_name" };

    const byCombo = await db
      .from("suppliers")
      .select("slug")
      .eq("country_code", input.country_code)
      .eq("city", input.city)
      .ilike("legal_name", input.legal_name)
      .maybeSingle();
    if (byCombo.data)
      return { slug: (byCombo.data as { slug: string }).slug, field: "country+city+name" };

    if (input.phone) {
      const p = await db
        .from("suppliers")
        .select("slug")
        .eq("phone", input.phone)
        .maybeSingle();
      if (p.data) return { slug: (p.data as { slug: string }).slug, field: "phone" };
    }

    if (input.address) {
      const a = await db
        .from("suppliers")
        .select("slug")
        .eq("address", input.address)
        .maybeSingle();
      if (a.data) return { slug: (a.data as { slug: string }).slug, field: "address" };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 创建供应商（白名单 + 硬编码安全默认）。
 *
 * 高信任字段一律不来自客户端（验证层已拦截伪造）：
 *   is_published=false（覆盖 001 默认 true）
 *   verification_level='unverified'
 *   verification_status/audit_status/risk_score/risk_breakdown=null
 *   inspection_history=0
 *   access_tier='public'
 *
 * 返回 duplicate 时调用方应回 409；db 错误回 500。
 */
export async function createAdminSupplier(
  ctx: AdminContext,
  input: SupplierCreateInput
): Promise<CreateSupplierResult> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "db" };

  const dup = await findDuplicateSupplier(input);
  if (dup) return { ok: false, error: "duplicate" };

  const now = new Date().toISOString();
  const hasSource = !!(input.source_url || input.source_type || input.source_name);

  const row = {
    slug: input.slug,
    legal_name: input.legal_name,
    country_code: input.country_code,
    city: input.city,
    industry_code: input.industry_code,
    business_type: input.business_type,
    established: input.established,
    employees: input.employees,
    main_products: input.main_products,
    export_markets: [] as string[],
    verification_status: null,
    risk_score: null,
    certifications: [] as string[],
    audit_status: null,
    inspection_history: 0,
    risk_breakdown: null,
    access_tier: "public",
    is_published: false,
    verification_level: "unverified",
    display_name: input.display_name,
    address: input.address,
    website: input.website,
    phone: input.phone,
    registration_number: input.registration_number,
    source_url: input.source_url,
    source_type: input.source_type,
    source_name: input.source_name,
    discovered_at: hasSource ? now : null,
  };

  try {
    const { data, error } = await db
      .from("suppliers")
      .insert(row)
      .select("id, slug")
      .single();
    if (error) {
      // slug 唯一约束兜底（应用层去重漏网时）
      if (error.code === "23505") return { ok: false, error: "duplicate" };
      console.error("[adminData] create supplier failed", error.message);
      return { ok: false, error: "db" };
    }
    if (!data) return { ok: false, error: "db" };
    const id = (data as { id: string }).id;
    const slug = (data as { slug: string }).slug;

    // 认证"声称"：原材料 → supplier_certifications（SELF_DECLARED）
    let certInserted = 0;
    let certWarnings: string[] = [];
    if (input.certificationClaims.length) {
      const cr = await createSupplierCertClaims(id, input.certificationClaims);
      certInserted = cr.inserted;
      certWarnings = cr.warnings;
    }

    // 审计日志（尽力而为，失败不影响创建结果）
    await logAdminAction(ctx, "supplier.create", "supplier", id, {
      slug,
      legal_name: input.legal_name,
      country_code: input.country_code,
      city: input.city,
      is_published: false,
      verification_level: "unverified",
      cert_claims: input.certificationClaims.length,
      cert_unmapped: certWarnings,
    });

    return { ok: true, id, slug, cert_inserted: certInserted, cert_warnings: certWarnings };
  } catch (e) {
    console.error("[adminData] create supplier exception", e);
    return { ok: false, error: "db" };
  }
}

export type CertAlias = {
  display_name: string;
  program_code: string | null;
  mapped: boolean;
};

/** 读取认证显示名→程序代码映射（参照数据）。 */
export async function listCertAliases(): Promise<CertAlias[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("certification_program_alias")
      .select("display_name, program_code, mapped");
    if (error) {
      console.error("[adminData] list cert aliases failed", error.message);
      return [];
    }
    return (data ?? []) as CertAlias[];
  } catch {
    return [];
  }
}

export type CertClaimResult = {
  inserted: number;
  warnings: string[];
};

/**
 * 写入认证"声称"：supplier_certifications，claim_status='SELF_DECLARED'，
 * evidence_status='NONE'，verification_status='PENDING'。
 *
 * 通过 certification_program_alias 映射 program_code：
 *   - 命中且 mapped=true → 用 program_code
 *   - 命中但 mapped=false，或完全未收录 → program_code='UNMAPPED' + warnings
 * 绝不臆测 program_code（CS-01 §6）。
 */
export async function createSupplierCertClaims(
  supplierId: string,
  claims: string[]
): Promise<CertClaimResult> {
  const result: CertClaimResult = { inserted: 0, warnings: [] };
  if (!claims.length) return result;
  const db = createAdminClient();
  if (!db) return result;

  const aliases = await listCertAliases();
  const byName = new Map<string, CertAlias>();
  for (const a of aliases) byName.set(a.display_name.toLowerCase(), a);

  const rows = claims.map((rawName) => {
    const name = (rawName || "").trim();
    const key = name.toLowerCase();
    const alias = byName.get(key);
    let programCode = "UNMAPPED";
    let displayName = name;
    if (alias) {
      displayName = alias.display_name;
      if (alias.mapped && alias.program_code) {
        programCode = alias.program_code;
      } else {
        result.warnings.push(name);
      }
    } else {
      result.warnings.push(name);
    }
    return {
      supplier_id: supplierId,
      program_code: programCode,
      display_name: displayName,
      claim_status: "SELF_DECLARED",
      evidence_status: "NONE",
      verification_status: "PENDING",
    };
  });

  try {
    const { error } = await db.from("supplier_certifications").insert(rows);
    if (error) {
      console.error("[adminData] insert cert claims failed", error.message);
      return result;
    }
    result.inserted = rows.length;
    return result;
  } catch (e) {
    console.error("[adminData] insert cert claims exception", e);
    return result;
  }
}

/** 测试/清理用：按 slug 删除供应商（级联删 certification 等）。不对外暴露为 API。 */
export async function deleteAdminSupplierBySlug(slug: string): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { error } = await db.from("suppliers").delete().eq("slug", slug);
    return !error;
  } catch {
    return false;
  }
}

// ---------- RFQ ----------

export type AdminRfqRow = {
  id: string;
  reference_id: string;
  product: string;
  quantity: string | null;
  country: string | null;
  email: string;
  company: string | null;
  message: string | null;
  status: string;
  created_at: string;
  user_id: string | null;
};

export async function listAdminRfqs(limit = 100): Promise<AdminRfqRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("rfqs")
      .select(
        "id, reference_id, product, quantity, country, email, company, message, status, created_at, user_id"
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[adminData] list rfqs failed", error.message);
      return [];
    }
    return (data ?? []) as AdminRfqRow[];
  } catch (e) {
    console.error("[adminData] list rfqs exception", e);
    return [];
  }
}

export async function updateRfqStatus(
  referenceId: string,
  status: "new" | "reviewing" | "matched" | "closed"
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { error } = await db
      .from("rfqs")
      .update({ status })
      .eq("reference_id", referenceId);
    if (error) {
      console.error("[adminData] update rfq failed", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ---------- 线索（CS-02D） ----------
//
// public.leads 收三类：买家留资 / 供应商入驻申请 / 供应商认领申请。
// 这里只做**只读展示**；状态流转（new → contacted → …）暂由邮件跟进处理，
// 状态编辑 UI 列入 Backlog，避免为单人后台过早加交互面。

export type AdminLeadRow = {
  id: string;
  reference_id: string;
  kind: string;
  tool: string;
  status: string;
  email: string;
  first_name: string | null;
  company: string | null;
  country: string | null;
  phone: string | null;
  sourcing: string | null;
  supplier_name: string | null;
  supplier_website: string | null;
  message: string | null;
  score: number | null;
  payload: unknown;
  created_at: string;
};

export async function listAdminLeads(limit = 100): Promise<AdminLeadRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("leads")
      .select(
        "id, reference_id, kind, tool, status, email, first_name, company, country, phone, sourcing, supplier_name, supplier_website, message, score, payload, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[adminData] list leads failed", error.message);
      return [];
    }
    return (data ?? []) as AdminLeadRow[];
  } catch (e) {
    console.error("[adminData] list leads exception", e);
    return [];
  }
}

/** leads_status_check 允许的五值，与 /api/admin/leads 的枚举白名单同源 */
export const LEAD_STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export async function updateLeadStatus(
  referenceId: string,
  status: LeadStatus
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { error } = await db.from("leads").update({ status }).eq("reference_id", referenceId);
    if (error) {
      console.error("[adminData] update lead failed", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ---------- 会员 ----------

export type AdminMemberRow = {
  email: string;
  role: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  created_at: string;
};

export async function listAdminMembers(limit = 200): Promise<AdminMemberRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    // profiles → memberships 内联（会员记录由触发器保证一定存在）
    const { data, error } = await db
      .from("profiles")
      .select(
        "email, role, created_at, memberships(plan, status, current_period_end, stripe_customer_id)"
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[adminData] list members failed", error.message);
      return [];
    }
    type Row = {
      email: string;
      role: string;
      created_at: string;
      memberships:
        | { plan: string; status: string; current_period_end: string | null; stripe_customer_id: string | null }
        | Array<{ plan: string; status: string; current_period_end: string | null; stripe_customer_id: string | null }>
        | null;
    };
    return ((data ?? []) as unknown as Row[]).map((r) => {
      const m = Array.isArray(r.memberships) ? r.memberships[0] : r.memberships;
      return {
        email: r.email ?? "",
        role: r.role ?? "buyer",
        plan: m?.plan ?? "free",
        status: m?.status ?? "active",
        current_period_end: m?.current_period_end ?? null,
        stripe_customer_id: m?.stripe_customer_id ?? null,
        created_at: r.created_at,
      };
    });
  } catch (e) {
    console.error("[adminData] list members exception", e);
    return [];
  }
}

// =============================================================================
// 验证与证据中心（Verification & Evidence Center）
// 依赖迁移 004_documents.sql 的 4 张表 + suppliers.verification_level
// =============================================================================

/** supplier slug → id。找不到返回 null。 */
export async function getAdminSupplierIdBySlug(slug: string): Promise<string | null> {
  const db = createAdminClient();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("suppliers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

/** 内部别名（本文件内使用） */
const supplierIdBySlug = getAdminSupplierIdBySlug;

/**
 * 写审计日志（spec §19）。
 * 尽力而为：日志失败绝不影响主操作结果，只在服务端打日志。
 * 仅 service_role 可写（表上无 INSERT policy）。
 */
export async function logAdminAction(
  ctx: AdminContext,
  action: string,
  targetType: "document" | "certification" | "audit" | "supplier",
  targetId: string,
  diff?: Record<string, unknown>
): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  try {
    await db.from("admin_audit_log").insert({
      actor_id: ctx?.userId ?? null,
      actor_email: ctx?.email ?? null,
      action,
      target_type: targetType,
      target_id: targetId,
      diff: diff ?? null,
    });
  } catch (e) {
    console.error("[adminData] audit log failed", e);
  }
}

// ---------- 文件（supplier_documents） ----------

export type AdminDocumentRow = {
  id: string;
  supplier_id: string;
  document_type: string;
  document_name: string;
  program_code: string | null;
  file_path: string;
  mime: string;
  size_bytes: number;
  sha256: string | null;
  verification_status: string;
  extraction_status: string;
  expiry_date: string | null;
  visibility: string;
  uploaded_by: string | null;
  uploaded_at: string;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
};

export async function listAdminDocuments(slug: string): Promise<AdminDocumentRow[]> {
  const id = await supplierIdBySlug(slug);
  if (!id) return [];
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("supplier_documents")
      .select("*")
      .eq("supplier_id", id)
      .order("uploaded_at", { ascending: false });
    if (error) {
      console.error("[adminData] list documents failed", error.message);
      return [];
    }
    return (data ?? []) as AdminDocumentRow[];
  } catch (e) {
    console.error("[adminData] list documents exception", e);
    return [];
  }
}

/** 插入文件记录（文件本体的上传由 lib/storage.ts 完成，此处只写元数据）。 */
export async function insertAdminDocument(params: {
  slug: string;
  documentType: string;
  documentName: string;
  programCode?: string | null;
  filePath: string;
  mime: string;
  sizeBytes: number;
  sha256?: string | null;
  expiryDate?: string | null;
  visibility?: "admin" | "paid" | "public";
  uploadedBy: string | null;
  notes?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const id = await supplierIdBySlug(params.slug);
  if (!id) return { ok: false, error: "supplier_not_found" };
  const db = createAdminClient();
  if (!db) return { ok: false, error: "db_not_configured" };
  try {
    const { data, error } = await db
      .from("supplier_documents")
      .insert({
        supplier_id: id,
        document_type: params.documentType,
        document_name: params.documentName,
        program_code: params.programCode ?? null,
        file_path: params.filePath,
        mime: params.mime,
        size_bytes: params.sizeBytes,
        sha256: params.sha256 ?? null,
        expiry_date: params.expiryDate ?? null,
        visibility: params.visibility ?? "admin",
        uploaded_by: params.uploadedBy,
        notes: params.notes ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[adminData] insert document failed", error?.message);
      return { ok: false, error: "insert_failed" };
    }
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    console.error("[adminData] insert document exception", e);
    return { ok: false, error: "exception" };
  }
}

/** 删除文件记录。返回其 file_path 供调用方同步删除 Storage 对象。 */
export async function deleteAdminDocument(
  docId: string
): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "db_not_configured" };
  try {
    const { data, error } = await db
      .from("supplier_documents")
      .select("file_path")
      .eq("id", docId)
      .maybeSingle();
    if (error || !data) return { ok: false, error: "not_found" };
    const filePath = (data as { file_path: string }).file_path;

    const del = await db.from("supplier_documents").delete().eq("id", docId);
    if (del.error) {
      console.error("[adminData] delete document failed", del.error.message);
      return { ok: false, error: "delete_failed" };
    }
    return { ok: true, filePath };
  } catch (e) {
    console.error("[adminData] delete document exception", e);
    return { ok: false, error: "exception" };
  }
}

/** 更新文件的审核状态 / 可见性 / 备注（白名单）。 */
export async function updateAdminDocument(
  docId: string,
  patch: Partial<{
    verification_status: string;
    extraction_status: string;
    visibility: "admin" | "paid" | "public";
    expiry_date: string | null;
    document_name: string;
    notes: string | null;
  }>,
  verifiedBy?: string | null
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const payload: Record<string, unknown> = { ...patch };
    if (patch.verification_status === "VERIFIED") {
      payload.verified_by = verifiedBy ?? null;
      payload.verified_at = new Date().toISOString();
    }
    const { error } = await db
      .from("supplier_documents")
      .update(payload)
      .eq("id", docId);
    if (error) {
      console.error("[adminData] update document failed", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[adminData] update document exception", e);
    return false;
  }
}

// ---------- 证书（supplier_certifications） ----------

export type AdminCertificationRow = {
  id: string;
  supplier_id: string;
  program_code: string;
  certificate_no: string | null;
  issuing_body: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  scope: string | null;
  verification_status: string;
  evidence_doc_id: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
};

export async function listAdminCertifications(
  slug: string
): Promise<AdminCertificationRow[]> {
  const id = await supplierIdBySlug(slug);
  if (!id) return [];
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("supplier_certifications")
      .select("*")
      .eq("supplier_id", id)
      .order("expiry_date", { ascending: true, nullsFirst: false });
    if (error) {
      console.error("[adminData] list certifications failed", error.message);
      return [];
    }
    return (data ?? []) as AdminCertificationRow[];
  } catch (e) {
    console.error("[adminData] list certifications exception", e);
    return [];
  }
}

/** 新建或更新证书。传 id 为更新，否则新建。 */
export async function upsertAdminCertification(params: {
  slug: string;
  id?: string | null;
  programCode: string;
  certificateNo?: string | null;
  issuingBody?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  scope?: string | null;
  verificationStatus?: string;
  evidenceDocId?: string | null;
  notes?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "db_not_configured" };
  try {
    if (params.id) {
      const { error } = await db
        .from("supplier_certifications")
        .update({
          program_code: params.programCode,
          certificate_no: params.certificateNo ?? null,
          issuing_body: params.issuingBody ?? null,
          issue_date: params.issueDate ?? null,
          expiry_date: params.expiryDate ?? null,
          scope: params.scope ?? null,
          verification_status: params.verificationStatus ?? "PENDING",
          evidence_doc_id: params.evidenceDocId ?? null,
          notes: params.notes ?? null,
        })
        .eq("id", params.id);
      if (error) {
        console.error("[adminData] update certification failed", error.message);
        return { ok: false, error: "update_failed" };
      }
      return { ok: true, id: params.id };
    }

    const supplierId = await supplierIdBySlug(params.slug);
    if (!supplierId) return { ok: false, error: "supplier_not_found" };
    const { data, error } = await db
      .from("supplier_certifications")
      .insert({
        supplier_id: supplierId,
        program_code: params.programCode,
        certificate_no: params.certificateNo ?? null,
        issuing_body: params.issuingBody ?? null,
        issue_date: params.issueDate ?? null,
        expiry_date: params.expiryDate ?? null,
        scope: params.scope ?? null,
        verification_status: params.verificationStatus ?? "PENDING",
        evidence_doc_id: params.evidenceDocId ?? null,
        notes: params.notes ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[adminData] insert certification failed", error?.message);
      return { ok: false, error: "insert_failed" };
    }
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    console.error("[adminData] upsert certification exception", e);
    return { ok: false, error: "exception" };
  }
}

export async function deleteAdminCertification(certId: string): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { error } = await db
      .from("supplier_certifications")
      .delete()
      .eq("id", certId);
    return !error;
  } catch {
    return false;
  }
}

// ---------- 审核事件（supplier_audits） ----------

export type AdminAuditRow = {
  id: string;
  supplier_id: string;
  audit_type: string;
  standard_code: string | null;
  auditor_name: string | null;
  auditor_org: string | null;
  audit_date: string;
  report_doc_id: string | null;
  result: string | null;
  findings_critical: number;
  findings_major: number;
  findings_minor: number;
  cap_deadline: string | null;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
};

export async function listAdminAudits(slug: string): Promise<AdminAuditRow[]> {
  const id = await supplierIdBySlug(slug);
  if (!id) return [];
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("supplier_audits")
      .select("*")
      .eq("supplier_id", id)
      .order("audit_date", { ascending: false });
    if (error) {
      console.error("[adminData] list audits failed", error.message);
      return [];
    }
    return (data ?? []) as AdminAuditRow[];
  } catch (e) {
    console.error("[adminData] list audits exception", e);
    return [];
  }
}

export async function upsertAdminAudit(params: {
  slug: string;
  id?: string | null;
  auditType: string;
  standardCode?: string | null;
  auditorName?: string | null;
  auditorOrg?: string | null;
  auditDate: string;
  reportDocId?: string | null;
  result?: string | null;
  findingsCritical?: number;
  findingsMajor?: number;
  findingsMinor?: number;
  capDeadline?: string | null;
  verificationStatus?: string;
  notes?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "db_not_configured" };
  const payload = {
    audit_type: params.auditType,
    standard_code: params.standardCode ?? null,
    auditor_name: params.auditorName ?? null,
    auditor_org: params.auditorOrg ?? null,
    audit_date: params.auditDate,
    report_doc_id: params.reportDocId ?? null,
    result: params.result ?? null,
    findings_critical: params.findingsCritical ?? 0,
    findings_major: params.findingsMajor ?? 0,
    findings_minor: params.findingsMinor ?? 0,
    cap_deadline: params.capDeadline ?? null,
    verification_status: params.verificationStatus ?? "PENDING",
    notes: params.notes ?? null,
  };
  try {
    if (params.id) {
      const { error } = await db
        .from("supplier_audits")
        .update(payload)
        .eq("id", params.id);
      if (error) {
        console.error("[adminData] update audit failed", error.message);
        return { ok: false, error: "update_failed" };
      }
      return { ok: true, id: params.id };
    }
    const supplierId = await supplierIdBySlug(params.slug);
    if (!supplierId) return { ok: false, error: "supplier_not_found" };
    const { data, error } = await db
      .from("supplier_audits")
      .insert({ supplier_id: supplierId, ...payload })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[adminData] insert audit failed", error?.message);
      return { ok: false, error: "insert_failed" };
    }
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    console.error("[adminData] upsert audit exception", e);
    return { ok: false, error: "exception" };
  }
}

/** 设置审核/证书/文件的审核状态（三表通用），并记录验证人。 */
export async function setReviewStatus(
  table: "supplier_documents" | "supplier_certifications" | "supplier_audits",
  id: string,
  status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED",
  ctx: AdminContext
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const payload: Record<string, unknown> = { verification_status: status };
    if (status === "VERIFIED") {
      payload.verified_by = ctx?.userId ?? null;
      payload.verified_at = new Date().toISOString();
    }
    const { error } = await db.from(table).update(payload).eq("id", id);
    if (error) {
      console.error(`[adminData] setReviewStatus ${table} failed`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[adminData] setReviewStatus exception", e);
    return false;
  }
}

// ---------- Pending Review / 到期提醒 ----------

export type PendingReviewItem = {
  kind: "document" | "certification" | "audit";
  id: string;
  supplierSlug: string;
  supplierName: string;
  label: string;
  createdAt: string;
};

/**
 * 待审核队列（spec §6）。聚合三张表的 PENDING 记录。
 * 无 SUPABASE 配置或未建表时返回空数组（后台不崩）。
 */
export async function listPendingReview(limit = 100): Promise<PendingReviewItem[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const [docs, certs, audits] = await Promise.all([
      db
        .from("supplier_documents")
        .select("id, document_name, uploaded_at, suppliers(slug, legal_name)")
        .eq("verification_status", "PENDING")
        .order("uploaded_at", { ascending: false })
        .limit(limit),
      db
        .from("supplier_certifications")
        .select("id, program_code, created_at, suppliers(slug, legal_name)")
        .eq("verification_status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(limit),
      db
        .from("supplier_audits")
        .select("id, audit_type, audit_date, suppliers(slug, legal_name)")
        .eq("verification_status", "PENDING")
        .order("audit_date", { ascending: false })
        .limit(limit),
    ]);

    type Joined = { slug: string; legal_name: string } | null;
    const pick = (v: unknown): Joined => {
      if (Array.isArray(v)) return (v[0] as Joined) ?? null;
      return (v as Joined) ?? null;
    };

    const items: PendingReviewItem[] = [];
    for (const r of (docs.data ?? []) as Record<string, unknown>[]) {
      const s = pick(r.suppliers);
      items.push({
        kind: "document",
        id: String(r.id),
        supplierSlug: s?.slug ?? "",
        supplierName: s?.legal_name ?? "",
        label: String(r.document_name ?? ""),
        createdAt: String(r.uploaded_at ?? ""),
      });
    }
    for (const r of (certs.data ?? []) as Record<string, unknown>[]) {
      const s = pick(r.suppliers);
      items.push({
        kind: "certification",
        id: String(r.id),
        supplierSlug: s?.slug ?? "",
        supplierName: s?.legal_name ?? "",
        label: String(r.program_code ?? ""),
        createdAt: String(r.created_at ?? ""),
      });
    }
    for (const r of (audits.data ?? []) as Record<string, unknown>[]) {
      const s = pick(r.suppliers);
      items.push({
        kind: "audit",
        id: String(r.id),
        supplierSlug: s?.slug ?? "",
        supplierName: s?.legal_name ?? "",
        label: String(r.audit_type ?? ""),
        createdAt: String(r.audit_date ?? ""),
      });
    }
    return items;
  } catch (e) {
    console.error("[adminData] list pending review exception", e);
    return [];
  }
}

export type ExpiringCertification = {
  id: string;
  supplierSlug: string;
  supplierName: string;
  programCode: string;
  expiryDate: string | null;
  daysLeft: number | null;
  verificationStatus: string;
};

/**
 * 即将到期 / 已过期的证书（spec §11）。
 * 只做后台展示，不发邮件（第一版范围）。
 */
export async function listExpiringCertifications(
  withinDays = 60
): Promise<ExpiringCertification[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const horizon = new Date(Date.now() + withinDays * 86400000)
      .toISOString()
      .slice(0, 10);
    const { data, error } = await db
      .from("supplier_certifications")
      .select("id, program_code, expiry_date, verification_status, suppliers(slug, legal_name)")
      .not("expiry_date", "is", null)
      .lte("expiry_date", horizon)
      .neq("verification_status", "REJECTED")
      .order("expiry_date", { ascending: true })
      .limit(200);
    if (error) {
      console.error("[adminData] list expiring failed", error.message);
      return [];
    }
    const { daysUntilDate } = await import("./verification");
    type Joined = { slug: string; legal_name: string } | null;
    return ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const raw = r.suppliers;
      const s: Joined = Array.isArray(raw)
        ? ((raw[0] as Joined) ?? null)
        : ((raw as Joined) ?? null);
      const expiryDate = (r.expiry_date as string | null) ?? null;
      return {
        id: String(r.id),
        supplierSlug: s?.slug ?? "",
        supplierName: s?.legal_name ?? "",
        programCode: String(r.program_code ?? ""),
        expiryDate,
        daysLeft: daysUntilDate(expiryDate),
        verificationStatus: String(r.verification_status ?? ""),
      };
    });
  } catch (e) {
    console.error("[adminData] list expiring exception", e);
    return [];
  }
}

/** 供应商核验等级（spec §2）。白名单值。 */
export async function setVerificationLevel(
  slug: string,
  level: "unverified" | "self_assessment" | "platform_assessment" | "on_site_audit" | "third_party_audit"
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { error } = await db
      .from("suppliers")
      .update({ verification_level: level })
      .eq("slug", slug);
    if (error) {
      console.error("[adminData] set verification level failed", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[adminData] set verification level exception", e);
    return false;
  }
}

/** 设置供应商核验等级（含审计日志）。 */
export async function setAdminVerificationLevel(
  slug: string,
  level: "unverified" | "self_assessment" | "platform_assessment" | "on_site_audit" | "third_party_audit",
  ctx: AdminContext
): Promise<boolean> {
  const ok = await setVerificationLevel(slug, level);
  if (ok) {
    await logAdminAction(ctx, "supplier.set_verification_level", "supplier", slug, {
      verification_level: level,
    });
  }
  return ok;
}
