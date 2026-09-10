import { NextResponse } from "next/server";
import {
  requireAdmin,
  updateAdminSupplier,
  getAdminSupplier,
  logAdminAction,
} from "@/lib/adminData";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";

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
  if (typeof body.is_published === "boolean") {
    patch.is_published = body.is_published;
  }

  // 平台核验等级（spec §2）。白名单五档，防止写入任意字符串触发 CHECK 报错。
  if (
    typeof body.verification_level === "string" &&
    VERIFICATION_LEVELS.has(body.verification_level)
  ) {
    patch.verification_level =
      body.verification_level as Parameters<typeof updateAdminSupplier>[1]["verification_level"];
  }

  const ok = await updateAdminSupplier(slugRaw, patch);
  if (ok && patch.verification_level) {
    await logAdminAction(
      admin,
      "supplier.set_verification_level",
      "supplier",
      slugRaw,
      { verification_level: patch.verification_level }
    );
  }
  return NextResponse.json(
    { ok },
    { status: ok ? 200 : 500, headers: NO_STORE }
  );
}
