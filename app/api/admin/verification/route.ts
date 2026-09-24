import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { createAdminClient } from "@/lib/supabaseAdmin";

// CS-22 CHANGE SET C —— 后台「待核验队列」列表数据接口
//
// 🔴 语义红线：所有读操作均经 requireAdmin() 服务端鉴权。
// GET → 返回 self_assessment 处于 提交/审核/待补/回补 状态的供应商队列。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

const QUEUE_STATUSES = ["submitted", "under_review", "action_required", "resubmitted"];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, error: "db_not_configured" }, { status: 500, headers: NO_STORE });
  }

  try {
    const { data, error } = await db
      .from("supplier_assessments")
      .select("supplier_id, status, submitted_at, suppliers(slug, legal_name)")
      .eq("assessment_type", "self_assessment")
      .in("status", QUEUE_STATUSES)
      .order("submitted_at", { ascending: false });
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? "query_failed" }, { status: 500, headers: NO_STORE });
    }

    const rows = (data as unknown[]).map((r) => {
      const o = r as {
        supplier_id: string;
        status: string;
        submitted_at: string | null;
        suppliers: { slug: string; legal_name: string } | { slug: string; legal_name: string }[] | null;
      };
      const s = Array.isArray(o.suppliers) ? o.suppliers[0] : o.suppliers;
      return {
        supplierId: o.supplier_id,
        slug: s?.slug ?? "",
        name: s?.legal_name ?? "(unknown)",
        status: o.status,
        submittedAt: o.submitted_at,
      };
    });

    // 是否已有生效验证（标星）
    const ids = rows.map((r) => r.supplierId);
    let verified = new Set<string>();
    if (ids.length > 0) {
      const { data: recs } = await db
        .from("verification_records")
        .select("supplier_id")
        .in("supplier_id", ids)
        .eq("status", "ACTIVE");
      verified = new Set(((recs ?? []) as { supplier_id: string }[]).map((x) => x.supplier_id));
    }

    const queue = rows.map((r) => ({ ...r, hasVerification: verified.has(r.supplierId) }));
    return NextResponse.json({ ok: true, queue }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500, headers: NO_STORE });
  }
}
