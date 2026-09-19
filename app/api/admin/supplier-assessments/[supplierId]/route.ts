import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkRateLimit, clamp } from "@/lib/rateLimit";

// CS-21 管理员审核/发布三标签审核。
//   GET  → 列出某供应商的全部 supplier_assessments（草稿/提交/已发布）
//   POST → action: publish | reject | request_changes（按 assessmentType）
// 仅 admin 可访问（requireAdmin）；写入走 service_role。

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" } as const;
const TYPES = new Set(["self_assessment", "platform_assessment", "on_site_audit"]);
const ACTIONS = new Set(["publish", "reject", "request_changes"]);
const RISK_LEVELS = new Set(["low", "moderate", "elevated", "high", "critical"]);

type Ctx = { params: Promise<{ supplierId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { supplierId } = await params;
  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  const { data, error } = await db
    .from("supplier_assessments")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("assessment_type");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ ok: true, assessments: data ?? [] }, { headers: NO_STORE });
}

export async function POST(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const rl = checkRateLimit(`admin-assess:${admin.userId}`, 200, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: NO_STORE });

  const { supplierId } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: NO_STORE });
  }

  const type = clamp(body.assessmentType, 24);
  const action = clamp(body.action, 16);
  if (!type || !TYPES.has(type)) {
    return NextResponse.json({ ok: false, error: "bad_type" }, { status: 400, headers: NO_STORE });
  }

  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  // 新建草稿行（主要用于标签②平台在线评估：平台发起评估后落库一份报告草稿）
  if (action === "create") {
    const { data: existing } = await db
      .from("supplier_assessments")
      .select("id")
      .eq("supplier_id", supplierId)
      .eq("assessment_type", type)
      .maybeSingle();
    if (!existing) {
      const now = new Date().toISOString();
      const { error: insErr } = await db.from("supplier_assessments").insert({
        supplier_id: supplierId,
        assessment_type: type,
        status: "draft",
        updated_at: now,
      });
      if (insErr) {
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500, headers: NO_STORE });
      }
    }
    return NextResponse.json({ ok: true, status: "draft" });
  }

  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400, headers: NO_STORE });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    reviewed_at: now,
    reviewed_by: admin.userId,
    review_notes: body.reviewNotes ? String(body.reviewNotes).slice(0, 2000) : null,
    updated_at: now,
  };
  if (action === "publish") {
    patch.status = "published";
    patch.published_at = now;
    // 发布时一并记录平台报告字段（标签②③的报告由平台产出）
    if (body.reportNumber) patch.report_number = String(body.reportNumber).slice(0, 60);
    if (body.reportSummary) patch.report_summary = String(body.reportSummary).slice(0, 4000);
    if (body.overallGrade) patch.overall_grade = String(body.overallGrade).slice(0, 40);
    if (body.riskLevel && RISK_LEVELS.has(String(body.riskLevel))) {
      patch.risk_level = String(body.riskLevel);
    }
  } else if (action === "reject") {
    patch.status = "rejected";
  } else {
    patch.status = "under_review";
  }

  const { error } = await db
    .from("supplier_assessments")
    .update(patch)
    .eq("supplier_id", supplierId)
    .eq("assessment_type", type);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, status: patch.status });
}
