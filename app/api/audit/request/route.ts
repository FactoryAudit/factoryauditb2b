// app/api/audit/request/route.ts —— 创建真实审核请求（指令 §18-§21，P0 #3 入口）
//
// POST /api/audit/request
//   · 落库到 public.audits（status=requested），生成 audit_code。
//   · 同时写一条 lead（复用 lib/leads，保证团队邮件通知不丢）。
//   · 返回 { ok, auditCode }；前端据此展示「您的验厂编号」。
//   · 验证失败 / 供应商不存在 → 4xx；service_role 未配置 / 落库失败 → 5xx。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditRequest, type CreateAuditRequestInput } from "@/lib/audits";
import { insertLead } from "@/lib/leads";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  supplierId: z.string().uuid(),
  buyerEmail: z.string().email(),
  buyerCompany: z.string().max(200).optional().nullable(),
  buyerCountry: z.string().max(120).optional().nullable(),
  auditType: z.enum(["announced", "semi-announced", "unannounced"]).optional(),
  category: z.string().max(120).optional().nullable(),
  standard: z.string().max(120).optional().nullable(),
  product: z.string().max(300).optional().nullable(),
  productCategory: z.string().max(160).optional().nullable(),
  preferredDate: z.string().max(40).optional().nullable(),
  preferredWindow: z.string().max(120).optional().nullable(),
  specialRequirements: z.string().max(2000).optional().nullable(),
  previousAuditAvailable: z.boolean().optional(),
  documentsAvailable: z.boolean().optional(),
  additionalComments: z.string().max(2000).optional().nullable(),
  locale: z.string().max(10).optional().nullable(),
  sourcePath: z.string().max(300).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientIp(req) + ":audit-request", 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const b = parsed.data;

  // 组合「类别 + 标准」进 standard_protocol（schema 单字段），避免丢信息
  const standardProtocol = [b.category, b.standard && b.standard !== "None / Custom" ? b.standard : null]
    .filter(Boolean)
    .join(" · ");

  const input: CreateAuditRequestInput = {
    supplierId: b.supplierId,
    buyerEmail: b.buyerEmail,
    buyerCompany: b.buyerCompany ?? null,
    buyerCountry: b.buyerCountry ?? null,
    auditType: b.auditType ?? "announced",
    product: b.product ?? null,
    productCategory: b.productCategory ?? null,
    standardProtocol: standardProtocol || null,
    preferredDate: b.preferredDate ?? null,
    preferredWindow: b.preferredWindow ?? null,
    specialRequirements: b.specialRequirements ?? null,
    previousAuditAvailable: Boolean(b.previousAuditAvailable),
    documentsAvailable: Boolean(b.documentsAvailable),
    additionalComments: b.additionalComments ?? null,
    locale: b.locale ?? "en",
    sourcePath: b.sourcePath ?? null,
  };

  const result = await createAuditRequest(input);
  if (!result.stored) {
    if (result.reason === "invalid_supplier") {
      return NextResponse.json({ ok: false, error: "invalid_supplier" }, { status: 400 });
    }
    if (result.reason === "not_configured") {
      return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "insert_failed", message: result.message }, { status: 500 });
  }

  // 团队通知：复用 leads 通道（fail-open，不影响主流程）
  void insertLead({
    kind: "buyer_lead",
    tool: "audit-request",
    email: b.buyerEmail,
    company: b.buyerCompany ?? null,
    country: b.buyerCountry ?? null,
    supplierName: null,
    sourcing: b.productCategory ?? null,
    message: [
      `Audit code: ${result.auditCode}`,
      `Execution: ${b.auditType ?? "announced"}`,
      `Category: ${b.category ?? ""}`,
      `Standard: ${b.standard ?? ""}`,
      `Product: ${b.product ?? ""}`,
      b.additionalComments ?? "",
    ]
      .filter(Boolean)
      .join("\n"),
    payload: { auditCode: result.auditCode, ...input },
  });

  return NextResponse.json({ ok: true, auditCode: result.auditCode }, { status: 201 });
}
