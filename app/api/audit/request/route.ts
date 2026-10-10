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
import { notifyAdminNewAuditRequest, notifyAuditRequestReceived } from "@/lib/notify";
import { runAfterResponse } from "@/lib/afterResponse";
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
    // 带上出错字段路径：生产排障时不必再猜是哪个字段导致 400。
    // 只暴露 path（字段名），不回显用户输入值（避免 PII 出现在日志/响应里）。
    const fields = parsed.error.issues.map((i) => i.path.join(".") || "(root)");
    return NextResponse.json({ ok: false, error: "invalid_input", fields }, { status: 400 });
  }
  const b = parsed.data;

  // 空串归一：`<input type="date">` 未填写时前端传的是 `""` 而不是 undefined，
  // 空串会穿透 `?? null` 直达 Postgres date 列并抛 invalid input syntax（R76）。
  // 写入层 lib/audits.ts 已收口，这里再兜一次，保证「进 input 的就是干净的」。
  const blankToNull = (v: string | null | undefined): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
  };

  // 组合「类别 + 标准」进 standard_protocol（schema 单字段），避免丢信息
  const standardProtocol = [b.category, b.standard && b.standard !== "None / Custom" ? b.standard : null]
    .filter(Boolean)
    .join(" · ");

  const input: CreateAuditRequestInput = {
    supplierId: b.supplierId,
    buyerEmail: b.buyerEmail,
    buyerCompany: blankToNull(b.buyerCompany),
    buyerCountry: blankToNull(b.buyerCountry),
    auditType: b.auditType ?? "announced",
    product: blankToNull(b.product),
    productCategory: blankToNull(b.productCategory),
    standardProtocol: standardProtocol || null,
    // 只接受 YYYY-MM-DD（input[type=date] 原生格式）；空串/非法值一律 NULL
    preferredDate: /^\d{4}-\d{2}-\d{2}$/.test(blankToNull(b.preferredDate) ?? "") ? b.preferredDate : null,
    preferredWindow: blankToNull(b.preferredWindow),
    specialRequirements: blankToNull(b.specialRequirements),
    previousAuditAvailable: Boolean(b.previousAuditAvailable),
    documentsAvailable: Boolean(b.documentsAvailable),
    additionalComments: blankToNull(b.additionalComments),
    locale: b.locale ?? "en",
    sourcePath: blankToNull(b.sourcePath),
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
  // 🔴 必须走 runAfterResponse（R84）：Cloudflare Workers 在 Response 返回后会**取消**
  //    未被 ctx.waitUntil 注册的 pending Promise ⇒ 裸 `void ...()` 在生产根本跑不完。
  runAfterResponse(
    insertLead({
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
    }),
    "audit/request insertLead"
  ).catch((e) => console.error("[audit/request] insertLead failed", e));

  // R79：邮件通知（管理员 + 买家回执）。
  //
  // 为什么放在**落库成功之后**：
  //   必须先有 audit_code 才有可对账的通知；反过来（先发信后入库）一旦入库失败，
  //   运营收到一封"有申请"但库里有没记录的邮件，对不上账。
  //
  // 为什么 fail-open（不 await、不因失败改响应）：
  //   客户提交已经成功落库，绝不能因为 Resend 抖动就把 201 改成 500 ——
  //   那会让客户以为没提交成功而重复提交。与既有线索/订单通道口径一致。
  //
  // 🔴 为什么必须用 runAfterResponse 而不是裸 `void ...()`（R84，2026-10-11）：
  //   Cloudflare Workers 在响应返回后会**取消**未注册到 ctx.waitUntil 的 Promise。
  //   实测：线上提交返回 201，但 wrangler tail 里**一条 [notify] 日志都没有**
  //   ⇒ 邮件从未发出（管理员收不到通知、买家收不到回执）。本地门测不出（Node 不取消）。
  runAfterResponse(
    notifyAdminNewAuditRequest({
      auditCode: result.auditCode,
      supplierName: result.supplierName ?? null,
      supplierSlug: result.supplierSlug ?? null,
      auditType: b.auditType ?? "announced",
      product: input.product,
      productCategory: input.productCategory,
      standardProtocol: standardProtocol || null,
      preferredDate: input.preferredDate,
      preferredWindow: input.preferredWindow,
      specialRequirements: input.specialRequirements,
      previousAuditAvailable: input.previousAuditAvailable,
      documentsAvailable: input.documentsAvailable,
      additionalComments: input.additionalComments,
      buyerEmail: b.buyerEmail,
      buyerCompany: input.buyerCompany,
      buyerCountry: input.buyerCountry,
      locale: input.locale,
    }),
    "audit/request admin notify"
  ).catch((e) => console.error("[audit/request] admin notify failed", e));

  runAfterResponse(
    notifyAuditRequestReceived({
      email: b.buyerEmail,
      auditCode: result.auditCode,
      supplierName: result.supplierName ?? null,
      standardProtocol: standardProtocol || null,
      locale: input.locale,
    }),
    "audit/request buyer receipt"
  ).catch((e) => console.error("[audit/request] buyer receipt failed", e));

  return NextResponse.json({ ok: true, auditCode: result.auditCode }, { status: 201 });
}
