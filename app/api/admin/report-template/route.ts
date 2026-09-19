// app/api/admin/report-template/route.ts —— 报告模板家族 只读 API（管理员后台）
//
// 用途：让后台能发现「报告模板家族」并按类型取出完整模板元数据 / 空白审核报告骨架。
// 纯读取，不写库、不改任何既有代码。
//
// 权限：requireAdmin() 二次校验（API 可被直接调用，不依赖页面层级）；非 admin → 404。
// 路由：
//   GET  /api/admin/report-template            → 家族清单（3 成员：类型 / 标签 / 章数 / 来源）
//   GET  /api/admin/report-template?type=…     → 完整成员（含评分卡 / 严重度 / 证据索引）
//   POST /api/admin/report-template            → 生成空白审核报告骨架（social / quality）

import { NextRequest } from "next/server";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminData";
import {
  REPORT_FAMILY,
  listReportFamily,
  getReportTemplate,
  buildBlankAuditReport,
  type ReportFamilyType,
} from "@/lib/reportTemplateFamily";

export const dynamic = "force-dynamic";

const AUDIT_TYPES = ["social_compliance_audit", "quality_audit"] as const;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return notFound();

  const type = req.nextUrl.searchParams.get("type");
  if (type) {
    if (!(type in REPORT_FAMILY)) {
      return Response.json({ error: "unknown_type", valid: Object.keys(REPORT_FAMILY) }, { status: 400 });
    }
    const member = getReportTemplate(type as ReportFamilyType);
    if (!member) return notFound();
    return Response.json({ member });
  }

  return Response.json({ family: listReportFamily() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return notFound();

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const type = typeof raw.type === "string" ? (raw.type as ReportFamilyType) : null;
  if (!type || (type !== "social_compliance_audit" && type !== "quality_audit")) {
    return Response.json(
      { error: "invalid_type", valid: AUDIT_TYPES },
      { status: 400 }
    );
  }

  const metaRaw = (raw.meta ?? {}) as Record<string, unknown>;
  const doc = buildBlankAuditReport(type, {
    reportNumber: typeof metaRaw.reportNumber === "string" ? metaRaw.reportNumber.slice(0, 64) : "",
    reportDate: typeof metaRaw.reportDate === "string" ? metaRaw.reportDate.slice(0, 32) : "",
    preparedFor: typeof metaRaw.preparedFor === "string" ? metaRaw.preparedFor.slice(0, 300) : "",
  });

  return Response.json({ type, doc });
}
