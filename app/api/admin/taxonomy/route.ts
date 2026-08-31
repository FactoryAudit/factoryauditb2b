import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getTaxonomyTree,
  listAuditTypes,
  listStandards,
  getRiskModel,
  upsertTaxonomyNode,
  deleteTaxonomyNode,
  upsertRiskWeight,
} from "@/lib/taxonomy";

// 管理员鉴权中间件
async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    return false;
  }
  return true;
}

// GET /api/admin/taxonomy —— 返回整棵树 + 审核类型 + 标准 + 风险权重
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }
  const [tree, auditTypes, standards, riskModel] = await Promise.all([
    getTaxonomyTree(),
    listAuditTypes(),
    listStandards(),
    getRiskModel(),
  ]);
  return NextResponse.json({ tree, auditTypes, standards, riskModel });
}

// POST /api/admin/taxonomy —— 新增/更新节点 或 风险权重
// body: { node: TaxonomyNodeInput } | { risk: { dimension, weight, description } }
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }
  const body = await req.json();
  try {
    if (body.node) {
      const node = await upsertTaxonomyNode(body.node);
      return NextResponse.json({ ok: true, node });
    }
    if (body.risk) {
      const rule = await upsertRiskWeight(body.risk.dimension, body.risk.weight, body.risk.description);
      return NextResponse.json({ ok: true, rule });
    }
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/admin/taxonomy?code=XXX
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code_required" }, { status: 400 });
  try {
    await deleteTaxonomyNode(code);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
