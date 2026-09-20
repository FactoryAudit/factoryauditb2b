import { NextResponse } from "next/server";
import {
  requireAdmin,
  updateAdminSupplier,
  getAdminSupplier,
  createAdminSupplier,
  findDuplicateSupplier,
  logAdminAction,
} from "@/lib/adminData";
import { checkRateLimit, clamp, clientIp } from "@/lib/rateLimit";
import { validateSupplierCreateInput } from "@/lib/supplierCreate";
import { listPublishedClusterSlugs } from "@/lib/industrialClusters";

// PATCH /api/admin/suppliers —— 更新供应商（白名单字段）
//
// 安全三层：
//   1. requireAdmin()：即使 layout 已经拦过，API 也要自己拦（可被直接调用）
//   2. 字段白名单：请求体里多传的字段一律丢弃，绝不做 spread 直写
//   3. 类型校验：数字字段必须是有限数字，枚举字段必须落在允许值内
//      否则 Postgres 的 CHECK 约束会抛错，用户体验是"点了保存没反应"

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const TIERS = new Set(["public", "free", "paid"]);

const VERIFICATION_LEVELS = new Set([
  "unverified",
  "self_assessment",
  "platform_assessment",
  "on_site_audit",
  "third_party_audit",
]);

function toInt(v: unknown): number | null {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** 将逗号/分号/换行分隔字符串或字符串数组归一为 string[]（去空白、去空）。 */
function toStrArray(v: unknown): string[] | null {
  if (Array.isArray(v)) {
    const arr = (v as unknown[]).map(String).map((s) => s.trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  if (typeof v === "string" && v.trim()) {
    const arr = v
      .split(/[,，、;；\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length ? arr : null;
  }
  return null;
}

export async function PATCH(req: Request) {
  // 权限放最前（在解析 body 之前，减少无效工作量）
  const admin = await requireAdmin();
  if (!admin) {
    // 404 而不是 401：不暴露后台存在
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rl = checkRateLimit(`admin:${admin.userId}`, 300, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const slugRaw = clamp(body.slug, 200);
  if (!slugRaw) {
    return NextResponse.json(
      { ok: false, error: "invalid_slug" },
      { status: 400, headers: NO_STORE }
    );
  }

  // 先确认这家存在（避免把 update 打到空集上还返回成功）
  const existing = await getAdminSupplier(slugRaw);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404, headers: NO_STORE }
    );
  }

  const ip = clientIp(req);

  // ---- 白名单构造 patch ----
  const patch: Parameters<typeof updateAdminSupplier>[1] = {};

  if (typeof body.legal_name === "string") {
    const v = clamp(body.legal_name, 200);
    if (v) patch.legal_name = v;
  }
  if (typeof body.city === "string") patch.city = clamp(body.city, 120) ?? "";
  if (typeof body.industry_code === "string") {
    patch.industry_code = clamp(body.industry_code, 64) ?? "";
  }
  if (typeof body.business_type === "string") {
    patch.business_type = clamp(body.business_type, 64) ?? "";
  }
  if (typeof body.employees === "string") {
    patch.employees = clamp(body.employees, 64) ?? "";
  }
  if (typeof body.verification_status === "string") {
    patch.verification_status = clamp(body.verification_status, 120) ?? "";
  }
  if (typeof body.audit_status === "string") {
    patch.audit_status = clamp(body.audit_status, 120) ?? "";
  }

  const established = toInt(body.established);
  if (established !== null) patch.established = established;

  const risk = toInt(body.risk_score);
  // risk_score 语义：0–100，高分 = 低风险（与 lib/riskEngine 一致）
  if (risk !== null && risk >= 0 && risk <= 100) patch.risk_score = risk;

  const insp = toInt(body.inspection_history);
  if (insp !== null && insp >= 0) patch.inspection_history = insp;

  if (typeof body.access_tier === "string" && TIERS.has(body.access_tier)) {
    patch.access_tier = body.access_tier as "public" | "free" | "paid";
  }

  // ---- CS-16：新增可编辑字段白名单 ----
  if (typeof body.english_name === "string")
    patch.english_name = clamp(body.english_name, 200) ?? "";
  if (typeof body.company_type === "string")
    patch.company_type = clamp(body.company_type, 120) ?? "";
  if (typeof body.registration_number === "string")
    patch.registration_number = clamp(body.registration_number, 120) ?? "";
  if (typeof body.website === "string") {
    const w = clamp(body.website, 400);
    // 允许清空（null）或合法 http(s) URL；其它值丢弃，避免污染
    if (!w) patch.website = null;
    else if (/^https?:\/\/.+/i.test(w)) patch.website = w;
  }
  if (typeof body.country_code === "string") {
    const c = clamp(body.country_code, 64);
    if (c && /^[a-z][a-z-]{1,63}$/.test(c)) patch.country_code = c;
  }
  if (typeof body.province === "string")
    patch.province = clamp(body.province, 120) ?? "";
  if (typeof body.address === "string")
    patch.address = clamp(body.address, 400) ?? "";

  const mp = toStrArray(body.main_products);
  if (mp) patch.main_products = mp;
  const em = toStrArray(body.export_markets);
  if (em) patch.export_markets = em;

  if (typeof body.contact_person === "string")
    patch.contact_person = clamp(body.contact_person, 120) ?? "";
  if (typeof body.contact_email === "string")
    patch.contact_email = clamp(body.contact_email, 200) ?? "";
  if (typeof body.phone === "string") patch.phone = clamp(body.phone, 64) ?? "";
  if (typeof body.whatsapp === "string")
    patch.whatsapp = clamp(body.whatsapp, 64) ?? "";
  if (typeof body.company_description === "string")
    patch.company_description = clamp(body.company_description, 2000) ?? "";

  // ---- STEP 10-B：供应商关联产业带（白名单 + 存在性校验） ----
  // 只允许空串（清除关联）或已发布的产业带 slug；其余值丢弃，避免写入不存在的 slug
  // 造成指向不存在产业带的链接（spec §24：管理员手工关联必须验证 cluster_slug 存在）。
  if (typeof body.cluster_slug === "string") {
    const raw = body.cluster_slug.trim().toLowerCase();
    if (!raw) {
      patch.cluster_slug = null; // 显式清除
    } else {
      const known = await listPublishedClusterSlugs();
      if (known.has(raw)) patch.cluster_slug = raw;
    }
  }

  // 平台核验等级（spec §2）。白名单五档，防止写入任意字符串触发 CHECK 报错。
  if (
    typeof body.verification_level === "string" &&
    VERIFICATION_LEVELS.has(body.verification_level)
  ) {
    patch.verification_level =
      body.verification_level as Parameters<typeof updateAdminSupplier>[1]["verification_level"];
  }

  // ---- 发布闸门（规格七）：发布前必须已授权；未授权 → 422 ----
  let publishAction: "supplier.published" | "supplier.unpublished" | null = null;
  if (typeof body.is_published === "boolean") {
    if (body.is_published === true) {
      if (existing.profile_authorized !== true) {
        return NextResponse.json(
          { ok: false, error: "not_authorized", message: "profile not authorized" },
          { status: 422, headers: NO_STORE }
        );
      }
      patch.is_published = true;
      patch.unpublished_at = null;
      patch.unpublished_by = null;
      publishAction = "supplier.published";
    } else {
      patch.is_published = false;
      patch.unpublished_at = new Date().toISOString();
      patch.unpublished_by = admin.email ?? "system";
      publishAction = "supplier.unpublished";
    }
  }

  // 保存时记录操作人（updated_by 由服务端填充，绝不来自客户端）
  patch.updated_by = admin.email ?? "system";

  const ok = await updateAdminSupplier(slugRaw, patch);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "db_error" },
      { status: 500, headers: NO_STORE }
    );
  }

  // ---- 审计日志（尽力而为，含操作 IP）----
  if (publishAction) {
    await logAdminAction(
      admin,
      publishAction,
      "supplier",
      slugRaw,
      { is_published: patch.is_published },
      { ipAddress: ip }
    );
  } else if (patch.verification_level) {
    await logAdminAction(
      admin,
      "supplier.set_verification_level",
      "supplier",
      slugRaw,
      { verification_level: patch.verification_level },
      { ipAddress: ip }
    );
  } else {
    // 有其它字段变更则记 supplier.updated（去掉 updated_by 这个每次都写的字段）
    const { updated_by, ...rest } = patch;
    if (Object.keys(rest).length > 0) {
      await logAdminAction(admin, "supplier.updated", "supplier", slugRaw, rest, {
        ipAddress: ip,
      });
    }
  }
  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}

// POST /api/admin/suppliers —— 新建供应商（CS-03 写入路径）
//
// 安全模型（与 PATCH 一致，三层）：
//   1. requireAdmin()：非 admin → 404（不暴露后台存在）
//   2. validateSupplierCreateInput()：白名单 + 高信任字段 422 显式拒绝
//   3. findDuplicateSupplier()：应用层 7 维去重 → 409（附带 existing slug + 命中字段）
//
// 新建供应商永远 is_published=false / verification_level=unverified，
// 高信任字段不来自客户端（已在校验层拦截）。

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    // 404 而不是 401：不暴露后台存在
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rl = checkRateLimit(`admin:${admin.userId}`, 300, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const v = validateSupplierCreateInput(body);
  if (!v.ok) {
    // 400=格式/必填；422=高信任字段伪造
    return NextResponse.json(
      { ok: false, error: v.error },
      { status: v.status, headers: NO_STORE }
    );
  }

  // 去重：命中则 409，附带已有 slug 与命中字段，提示管理员先去审查而非重复建
  const dup = await findDuplicateSupplier(v.value);
  if (dup) {
    return NextResponse.json(
      {
        ok: false,
        error: "duplicate",
        existing_slug: dup.slug,
        field: dup.field,
      },
      { status: 409, headers: NO_STORE }
    );
  }

  const res = await createAdminSupplier(admin, v.value);
  if (!res.ok) {
    if (res.error === "duplicate") {
      return NextResponse.json(
        { ok: false, error: "duplicate" },
        { status: 409, headers: NO_STORE }
      );
    }
    return NextResponse.json(
      { ok: false, error: "db_error" },
      { status: 500, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      id: res.id,
      slug: res.slug,
      cert_inserted: res.cert_inserted,
      cert_warnings: res.cert_warnings,
    },
    { status: 201, headers: NO_STORE }
  );
}
