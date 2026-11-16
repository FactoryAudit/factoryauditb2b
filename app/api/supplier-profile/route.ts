import { NextRequest, NextResponse } from "next/server";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// 供应商自助「完善档案」（2026-11-16）
//
// 为什么需要：13 章尽职调查报告需要一批档案字段，而此前只有管理员后台能填，
//   供应商自己填不了 ⇒ 报告永远靠运营手抄。本路由让供应商自己补。
//
// 🔴 归属裁决：resolveSupplierAccess（会话优先 / 邮箱兜底 / 歧义拒）。
//   只能改**自己**的档案，客户端传的 supplierId 只是"声称"，服务端会话才是事实。
//
// 🔴 contact_email 绝对不在白名单：它是归属主键（suppliers.contact_email 决定
//   resolveSupplierAccess 认不认这个人）。让供应商改它 = 改完自己进不来。
//
// 🔴 平台控制字段一律不可改：is_published / profile_status / access_tier /
//   verification_status / risk_score / audit_status / slug —— 这些是平台判断，
//   供应商能改就等于自己给自己发证书。
//
// 🔴 缺失值写 null，不写空串（R76 铁律：空串会穿透 ?? null）。

const TEXT_FIELDS: Array<{ key: string; max: number }> = [
  { key: "legal_name", max: 200 },
  { key: "english_name", max: 200 },
  { key: "company_type", max: 80 },
  { key: "business_type", max: 40 },
  { key: "registration_number", max: 80 },
  { key: "address", max: 400 },
  { key: "city", max: 120 },
  { key: "province", max: 120 },
  { key: "industry_code", max: 80 },
  { key: "employees", max: 64 },
  // 报告档案字段
  { key: "legal_representative", max: 120 },
  { key: "registered_capital", max: 120 },
  { key: "business_scope", max: 1000 },
  { key: "production_workers", max: 60 },
  { key: "reference_customers", max: 500 },
  { key: "monthly_output", max: 120 },
  { key: "production_capacity", max: 200 },
  { key: "factory_size", max: 120 },
  // 联系与描述（contact_email 故意缺席，见文件头）
  { key: "contact_person", max: 120 },
  { key: "phone", max: 64 },
  { key: "whatsapp", max: 64 },
  { key: "website", max: 300 },
  { key: "company_description", max: 2000 },
];

const ARRAY_FIELDS: Array<{ key: string; maxItems: number; maxLen: number }> = [
  { key: "main_products", maxItems: 30, maxLen: 120 },
  { key: "export_markets", maxItems: 40, maxLen: 80 },
];

/** 空白 → null（不写空串） */
function blankToNull(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function toStrArray(v: unknown, maxItems: number, maxLen: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().slice(0, maxLen))
    .filter(Boolean);
  return out.slice(0, maxItems);
}

function toIntInRange(v: unknown, min: number, max: number): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n >= min && n <= max ? n : null;
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isFinite(n)) {
      const t = Math.trunc(n);
      return t >= min && t <= max ? t : null;
    }
  }
  return null;
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function PATCH(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-profile:${ip}`, 60, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: NO_STORE });
    }

    const access = await resolveSupplierAccess({
      claimedSupplierId: typeof body.supplierId === "string" ? body.supplierId : null,
      email: typeof body.email === "string" ? body.email : null,
    });
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.code },
        { status: access.status ?? 403, headers: NO_STORE }
      );
    }
    const supplierId = access.identity.supplierId;

    const db = createAdminClient();
    if (!db) {
      return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: NO_STORE });
    }

    const patch: Record<string, unknown> = {};

    for (const f of TEXT_FIELDS) {
      if (f.key in body) patch[f.key] = blankToNull(body[f.key], f.max);
    }

    // 数值字段：非法或越界 → 忽略（不写 0，避免"缺数据变成 0"）
    if ("established" in body) {
      const n = toIntInRange(body.established, 1800, 2100);
      if (n !== null) patch.established = n;
    }
    if ("export_since" in body) {
      const n = toIntInRange(body.export_since, 1800, 2100);
      if (n !== null) patch.export_since = n;
    }

    for (const f of ARRAY_FIELDS) {
      if (f.key in body) {
        const arr = toStrArray(body[f.key], f.maxItems, f.maxLen);
        if (arr !== null) patch[f.key] = arr;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400, headers: NO_STORE });
    }

    const { error } = await db.from("suppliers").update(patch).eq("id", supplierId);
    if (error) {
      console.error("[api/supplier-profile] update failed", error.message);
      return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500, headers: NO_STORE });
    }

    return NextResponse.json(
      { ok: true, updated: Object.keys(patch).length },
      { headers: NO_STORE }
    );
  } catch (e) {
    console.error("[api/supplier-profile] failed", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: NO_STORE });
  }
}
