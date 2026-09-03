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
import { getCurrentUser } from "./supabaseServer";
import { isAdminUser } from "./membership";

export type AdminContext = { userId: string; email: string | null } | null;

/**
 * 权限闸门。非 admin 返回 null，调用方应直接 notFound()。
 *
 * 为什么返回 null 而不是抛错：
 *   Next 的 notFound() 渲染 404 页面，比 500 更合适 ——
 *   不向外界暴露"这里有个后台"这个事实。
 */
export async function requireAdmin(): Promise<AdminContext> {
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
  };
  const db = createAdminClient();
  if (!db) return empty;

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [users, paid, suppliers, published, newRfqs, totalRfqs] = await Promise.all([
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
    ]);

    return {
      totalUsers: users.count ?? 0,
      paidMembers: paid.count ?? 0,
      totalSuppliers: suppliers.count ?? 0,
      publishedSuppliers: published.count ?? 0,
      newRfqs: newRfqs.count ?? 0,
      totalRfqs: totalRfqs.count ?? 0,
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
