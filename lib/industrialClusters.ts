// lib/industrialClusters.ts —— 产业带（Industrial Cluster）数据层
//
// STEP-02B（migration 024）新建实体。前台 /industrial-clusters 与后台 Admin 共用本文件，
// 保证「后台改 → 库 → 前台显示」只有一条数据路径，不出现第二套数据源。
//
// 设计约束（沿用 lib/adminData.ts 的既有约定）：
//   1. 全部走 service_role（createAdminClient）。RLS 对 service_role 不生效，
//      所以**公开读取必须自己显式 .eq("is_published", true)** —— 不能依赖 RLS 兜底。
//   2. 失败一律返回空 / false，绝不抛异常 —— 后台崩了不影响前台做生意。
//   3. admin 写入函数必须在调用方先通过 requireAdmin()（页面与 API 各自校验一次）。
//
// ⚠️ 产业带 ≠ 行政区：country / region / city 是行政维度，industry 是行业维度，
//    产业带是「某地在某行业的制造聚集」—— 例如 Foshan（city）+ Furniture（industry）
//    = Foshan Furniture Cluster。禁止用行政区直接冒充产业带。

import { createAdminClient } from "./supabaseAdmin";

export type IndustrialCluster = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  province: string | null;
  industry: string | null;
  industry_tags: string[] | null;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_published: boolean;
  featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const TABLE = "industrial_clusters";
const ORDER = "sort_order.asc,name.asc";

/** 稳定的列白名单。**不返回**任何来源追踪字段（产业带是内容实体，无来源归因）。 */
const COLS =
  "id,name,slug,country,country_code,region,province,city,industry,industry_tags,description,seo_title,seo_description,is_published,featured,sort_order,created_at,updated_at";

/**
 * 统一国家归一（spec 10-B Decision A §4）。
 *
 * 关键：cluster 的 country_code 存大写（CN/TH/VN/ID），supplier 的 country 存小写（china/…），
 * **不能只做 lowercase()**（lowercase(CN) 仍是 "cn" ≠ "china"）。本函数把两种表示都映射到
 * 同一 canonical key，仅在匹配层使用，**绝不修改数据库存值**。
 *
 *   CN → china
 *   TH → thailand
 *   VN → vietnam
 *   ID → indonesia
 *   其余（如未知值）→ 返回小写的输入（保守：不臆造映射）。
 */
const COUNTRY_KEY_BY_CODE: Record<string, string> = {
  CN: "china",
  TH: "thailand",
  VN: "vietnam",
  ID: "indonesia",
};
const COUNTRY_KEY_BY_NAME: Record<string, string> = {
  china: "china",
  thailand: "thailand",
  vietnam: "vietnam",
  indonesia: "indonesia",
};

export function normalizeCountryKey(input?: string | null): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  if (COUNTRY_KEY_BY_CODE[raw.toUpperCase()]) return COUNTRY_KEY_BY_CODE[raw.toUpperCase()];
  const lower = raw.toLowerCase();
  if (COUNTRY_KEY_BY_NAME[lower]) return COUNTRY_KEY_BY_NAME[lower];
  return lower;
}

/** 把任意文本转成 URL slug。中文保留原样会被 URL 编码，因此要求后台显式填 slug（英文）。 */
export function slugifyCluster(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** 前台/公开：只返回已发布产业带。未发布 = 前台不可见（后台下架即消失）。
 *  10-B：支持按 featured 过滤（首页 Featured Clusters 模块用）。不传 = 不过滤。 */
export async function listPublishedClusters(
  opts?: { featured?: boolean }
): Promise<IndustrialCluster[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    let q = db
      .from(TABLE)
      .select(COLS)
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (opts?.featured === true) q = q.eq("featured", true);
    const { data, error } = await q;
    if (error) {
      console.error("[industrialClusters] list published failed", error.message);
      return [];
    }
    return (data ?? []) as IndustrialCluster[];
  } catch (e) {
    console.error("[industrialClusters] list published exception", e);
    return [];
  }
}

/** 前台/公开：已发布且 featured = true 的产业带（首页 Featured Clusters 模块专用）。 */
export async function listFeaturedClusters(): Promise<IndustrialCluster[]> {
  return listPublishedClusters({ featured: true });
}

/** STEP 10-B：已发布产业带的 slug 集合（后台校验供应商关联用，避免写入不存在的 slug）。 */
export async function listPublishedClusterSlugs(): Promise<Set<string>> {
  const rows = await listPublishedClusters();
  return new Set(rows.map((r) => (r.slug ?? "").trim()).filter(Boolean));
}

/** 前台/公开：按 slug 取已发布产业带。未发布或不存在一律 null（详情页走 notFound）。 */
export async function getPublishedClusterBySlug(
  slug: string
): Promise<IndustrialCluster | null> {
  if (!slug) return null;
  const db = createAdminClient();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from(TABLE)
      .select(COLS)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) {
      console.error("[industrialClusters] get by slug failed", error.message);
      return null;
    }
    return (data as IndustrialCluster | null) ?? null;
  } catch (e) {
    console.error("[industrialClusters] get by slug exception", e);
    return null;
  }
}

/**
 * 批量解析 `suppliers.cluster_slug` → 已发布产业带名称（供应商档案 / 目录的公开读）。
 *
 * 🔴 三条铁律（STEP-04）：
 *   1. **零 slug ⇒ 零查询**。当前 17/17 供应商 `cluster_slug` 为 NULL，
 *      本函数在无 slug 时直接早退，**一次数据库往返都不发生**。
 *   2. **一次 `.in("slug", …)` 批量取**，绝不循环单查 —— 目录页一次渲染多家，
 *      逐家查就是 N+1。去重后再查，避免重复 slug 放大 URL。
 *   3. **显式 `.eq("is_published", true)`**。公开读走 service_role，RLS 不生效，
 *      未发布产业带必须靠这行代码挡住，否则后台草稿会漏到公开供应商页。
 *
 * 查不到 / 未发布 / 出错 ⇒ 该 slug **不出现在 Map 里**。调用方据此渲染成
 * 「不显示这一行」——不报错、不写 "Unknown"、更不产出指向不存在产业带的链接。
 * 失败方向保守：宁可少显示一行，也不显示一条未经确认的产业带。
 */
export async function resolvePublishedClusterNames(
  slugs: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(
    new Set(slugs.map((s) => (s ?? "").trim()).filter((s) => s.length > 0))
  );
  if (unique.length === 0) return out; // ← 零查询路径（当前生产数据恒走这里）

  const db = createAdminClient();
  if (!db) return out;
  try {
    const { data, error } = await db
      .from(TABLE)
      .select("slug,name")
      .in("slug", unique)
      .eq("is_published", true);
    if (error) {
      console.error("[industrialClusters] resolve names failed", error.message);
      return out;
    }
    for (const r of (data ?? []) as { slug: string; name: string }[]) {
      const slug = (r?.slug ?? "").trim();
      const name = (r?.name ?? "").trim();
      if (slug && name) out.set(slug, name);
    }
    return out;
  } catch (e) {
    console.error("[industrialClusters] resolve names exception", e);
    return out;
  }
}

// ---------- Admin ----------

/** 后台：全量（含未发布），按 sort_order + name 排序。 */
export async function listAdminClusters(): Promise<IndustrialCluster[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from(TABLE)
      .select(COLS)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      console.error("[industrialClusters] list admin failed", error.message);
      return [];
    }
    return (data ?? []) as IndustrialCluster[];
  } catch (e) {
    console.error("[industrialClusters] list admin exception", e);
    return [];
  }
}

export type ClusterUpsertInput = {
  id?: string | null;
  name: string;
  slug: string;
  country?: string | null;
  countryCode?: string | null;
  region?: string | null;
  province?: string | null;
  city?: string | null;
  industry?: string | null;
  industryTags?: string[] | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isPublished?: boolean;
  featured?: boolean;
  sortOrder?: number;
};

export type ClusterUpsertResult =
  | { ok: true; id: string }
  | { ok: false; error: "db_not_configured" | "invalid_input" | "duplicate_slug" | "not_found" | "write_failed" };

/** 后台：新建或更新。传 id 为更新，否则新建。slug 唯一（冲突返回 duplicate_slug）。 */
export async function upsertAdminCluster(
  input: ClusterUpsertInput
): Promise<ClusterUpsertResult> {
  const name = (input.name ?? "").trim();
  const slug = slugifyCluster(input.slug || name);
  if (!name || !slug) return { ok: false, error: "invalid_input" };

  const db = createAdminClient();
  if (!db) return { ok: false, error: "db_not_configured" };

  const row = {
    name,
    slug,
    country: input.country?.trim() || null,
    country_code: input.countryCode?.trim().toLowerCase() || null,
    region: input.region?.trim() || null,
    province: input.province?.trim() || null,
    city: input.city?.trim() || null,
    industry: input.industry?.trim() || null,
    industry_tags: input.industryTags?.length ? input.industryTags : null,
    description: input.description?.trim() || null,
    seo_title: input.seoTitle?.trim() || null,
    seo_description: input.seoDescription?.trim() || null,
    is_published: Boolean(input.isPublished),
    featured: Boolean(input.featured),
    sort_order: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 100,
    updated_at: new Date().toISOString(),
  };

  try {
    if (input.id) {
      const { error } = await db.from(TABLE).update(row).eq("id", input.id);
      if (error) {
        // 23505 = unique_violation（slug 冲突）
        if (error.code === "23505") return { ok: false, error: "duplicate_slug" };
        console.error("[industrialClusters] update failed", error.message);
        return { ok: false, error: "write_failed" };
      }
      return { ok: true, id: input.id };
    }

    const { data, error } = await db.from(TABLE).insert(row).select("id").single();
    if (error || !data) {
      if (error?.code === "23505") return { ok: false, error: "duplicate_slug" };
      console.error("[industrialClusters] insert failed", error?.message);
      return { ok: false, error: "write_failed" };
    }
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    console.error("[industrialClusters] upsert exception", e);
    return { ok: false, error: "write_failed" };
  }
}

/** 后台：切换发布状态（上/下架）。前台与 sitemap 立即同步。 */
export async function setClusterPublished(
  id: string,
  isPublished: boolean
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { error } = await db
      .from(TABLE)
      .update({ is_published: isPublished, updated_at: new Date().toISOString() })
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** 后台：删除。已有供应商引用该 slug 时**仍然允许删除**（供应商侧字段为文本，不产生外键错误），
 *  但调用方应在 UI 上提示运营先改供应商档案，避免出现指向不存在产业带的链接。 */
export async function deleteAdminCluster(id: string): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  try {
    const { error } = await db.from(TABLE).delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** 统计有多少供应商引用了该产业带 slug（后台删除前的风险提示用）。 */
export async function countSuppliersInCluster(slug: string): Promise<number> {
  const db = createAdminClient();
  if (!db || !slug) return 0;
  try {
    const { count, error } = await db
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("cluster_slug", slug);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
