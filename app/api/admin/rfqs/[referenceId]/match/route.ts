import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminData";
import {
  recommendSuppliersForRfq,
  confirmRfqMatches,
  listRfqMatches,
  updateMatchStatus,
} from "@/lib/rfqMatching";

// STEP 12 Change Set D + STEP 13 Change Set D —— Admin 匹配与跟进
//   GET   /api/admin/rfqs/[referenceId]/match  → 推荐供应商列表（确定性打分，可解释）
//   POST  /api/admin/rfqs/[referenceId]/match  → 确认匹配（body: { supplierIds: string[] }）
//   PATCH /api/admin/rfqs/[referenceId]/match  → 推进状态（body: { supplierId, status }）
//
// 安全：requireAdmin 三层（非 admin → 404，不暴露后台存在）。
// 第一版**不**自动发送给供应商，只写/改 rfq_matches 供 Admin 复核。

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" } as const;

type Ctx = { params: Promise<{ referenceId: string }> };

async function loadRfq(referenceId: string) {
  const db = createAdminClient();
  if (!db) return null;
  const { data, error } = await db
    .from("rfqs")
    .select("id, reference_id, product, country, industry_code, is_public, status, industrial_cluster_slug")
    .eq("reference_id", referenceId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function GET(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });

  const { referenceId } = await ctx.params;
  const rfq = await loadRfq(referenceId);
  if (!rfq) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });

  const recs = await recommendSuppliersForRfq({
    id: String(rfq.id),
    referenceId: String(rfq.reference_id ?? ""),
    industryCode: rfq.industry_code == null ? null : String(rfq.industry_code),
    country: rfq.country == null ? null : String(rfq.country),
    product: rfq.product == null ? null : String(rfq.product),
    clusterSlug: rfq.industrial_cluster_slug == null ? null : String(rfq.industrial_cluster_slug),
  });

  const matches = await listRfqMatches(String(rfq.id));

  return NextResponse.json(
    {
      ok: true,
      rfq: {
        referenceId: String(rfq.reference_id ?? ""),
        product: rfq.product == null ? null : String(rfq.product),
        country: rfq.country == null ? null : String(rfq.country),
        industryCode: rfq.industry_code == null ? null : String(rfq.industry_code),
        isPublic: Boolean(rfq.is_public),
        status: rfq.status == null ? null : String(rfq.status),
      },
      recommendations: recs,
      matches,
    },
    { headers: NO_STORE }
  );
}

export async function POST(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });

  const { referenceId } = await ctx.params;
  const rfq = await loadRfq(referenceId);
  if (!rfq) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: NO_STORE });
  }

  const ids = Array.isArray(body.supplierIds)
    ? body.supplierIds.map(String).filter(Boolean).slice(0, 20)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "supplierIds_required" }, { status: 400, headers: NO_STORE });
  }

  // 只允许确认**推荐池内**的供应商（防越权写入任意 supplier_id）
  const allowed = new Set(
    (
      await recommendSuppliersForRfq({
        id: String(rfq.id),
        industryCode: rfq.industry_code == null ? null : String(rfq.industry_code),
        country: rfq.country == null ? null : String(rfq.country),
        product: rfq.product == null ? null : String(rfq.product),
        clusterSlug: rfq.industrial_cluster_slug == null ? null : String(rfq.industrial_cluster_slug),
      })
    ).map((r) => r.supplierId)
  );
  const safe = ids.filter((id) => allowed.has(id));
  if (safe.length === 0) {
    return NextResponse.json(
      { ok: false, error: "not_in_recommendations" },
      { status: 422, headers: NO_STORE }
    );
  }

  const res = await confirmRfqMatches(String(rfq.id), safe, admin.email ?? "admin");
  return NextResponse.json({ ok: true, ...res }, { headers: NO_STORE });
}

// STEP 13 CHANGE SET D —— 推进匹配状态（suggested → contacted → won / lost）
// 只允许写这个 RFQ 自己名下的 match 行；状态流转表在 lib/rfqMatching.ts 里服务端强校验。
export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });

  const { referenceId } = await ctx.params;
  const rfq = await loadRfq(referenceId);
  if (!rfq) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: NO_STORE });
  }

  const supplierId = String(body.supplierId ?? "").trim();
  if (!supplierId) {
    return NextResponse.json({ ok: false, error: "supplierId_required" }, { status: 400, headers: NO_STORE });
  }

  const res = await updateMatchStatus(String(rfq.id), supplierId, body.status, admin.email ?? "admin");
  if (res.ok) {
    return NextResponse.json({ ok: true, status: res.status, changed: res.changed }, { headers: NO_STORE });
  }
  const status = res.error === "match_not_found" ? 404 : res.error === "invalid_status" ? 400 : 422;
  return NextResponse.json(res, { status, headers: NO_STORE });
}
