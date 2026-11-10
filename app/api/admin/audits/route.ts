import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { createAuditRequest } from "@/lib/audits";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkRateLimit, clamp } from "@/lib/rateLimit";

// POST /api/admin/audits —— 后台手动建单（Phase 1）
//
// 为什么需要它：
//   `/factory-audit/request` 是**客户**入口，走的是同一套 createAuditRequest；
//   但运营在电话/微信里谈下来的单，没有「客户自己填一遍表单」这一步。
//   缺了这个入口，单就只能留在邮件里，后台 /admin/audits 永远是空的。
//
// 设计纪律：
//   · 复用 createAuditRequest，**不另写一套建单逻辑**（编号生成 / FK 校验 /
//     外部工厂规则全在同一处，避免两套规则漂移）。
//   · 只做后台录入，不给买家发任何邮件 —— 客户没在这个页面出现过，
//     给他发「我们收到你的请求」属于无据声称。
//   · 写库失败就明确报错，不静默成功。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const AUDIT_TYPES = new Set(["announced", "semi-announced", "unannounced"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === 1;
}

function dateOrNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  return DATE_RE.test(s) ? s : null;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  // 建单是低频人工动作，限流只为拦住误触/脚本，不为防刷
  const rl = checkRateLimit(`admin-audit-create:${admin.userId}`, 60, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const source = body.supplierSource === "external" ? "external" : "platform";

  const auditType = typeof body.auditType === "string" && AUDIT_TYPES.has(body.auditType)
    ? (body.auditType as "announced" | "semi-announced" | "unannounced")
    : "announced";

  const ext = (body.externalSupplier ?? {}) as Record<string, unknown>;

  // 起始状态：默认按完整流程走；只有运营明确选「客户已确认」才直接落到 scheduled。
  // 白名单收口 —— 不接受 'closed' / 'auditor_assigned' 这类需要前置证据的状态。
  const startAt = body.startAt === "scheduled" ? "scheduled" : "requested";

  const r = await createAuditRequest({
    supplierSource: source,
    supplierId: source === "platform" ? clamp(body.supplierId, 64) : null,
    externalSupplier:
      source === "external"
        ? {
            name: clamp(ext.name, 200) ?? "",
            contact: clamp(ext.contact, 120),
            email: clamp(ext.email, 254),
            phone: clamp(ext.phone, 60),
            address: clamp(ext.address, 400),
          }
        : null,
    buyerEmail: clamp(body.buyerEmail, 254),
    buyerCompany: clamp(body.buyerCompany, 200),
    buyerCountry: clamp(body.buyerCountry, 80),
    auditType,
    product: clamp(body.product, 300),
    productCategory: clamp(body.productCategory, 120),
    standardProtocol: clamp(body.standardProtocol, 160),
    preferredDate: dateOrNull(body.preferredDate),
    preferredWindow: clamp(body.preferredWindow, 120),
    specialRequirements: clamp(body.specialRequirements, 2000),
    previousAuditAvailable: asBool(body.previousAuditAvailable),
    documentsAvailable: asBool(body.documentsAvailable),
    additionalComments: clamp(body.additionalComments, 2000),
    sourcePath: "/admin/audits/new",
    userId: null,
    initialStatus: startAt,
  });

  if (!r.stored) {
    const status =
      r.reason === "not_configured"
        ? 503
        : r.reason === "invalid_supplier" || r.reason === "invalid_external_supplier"
          ? 400
          : 500;
    return NextResponse.json(
      { ok: false, error: r.reason, message: r.message ?? null },
      { status, headers: NO_STORE }
    );
  }

  // 以 scheduled 建单时，把「哪几步在系统外完成」写进审计日志。
  // 不写的话，以后回看只看到一条 scheduled，会误以为状态机跳步了。
  if (startAt === "scheduled" && r.id) {
    const db = createAdminClient();
    if (db) {
      const { error } = await db.from("audit_logs").insert({
        actor_id: admin.userId ?? null,
        actor_email: admin.email ?? null,
        action: "audit.create",
        entity: "audits",
        entity_id: r.id,
        old_value: null,
        new_value: {
          status: "scheduled",
          createdBy: "admin",
          completedOffline: ["quotation_sent", "pending_approval"],
          note: "Commercial terms and audit date agreed with the client outside the platform",
        },
      });
      // 日志写失败不影响建单结果 —— 单已经建好了，报错只会让运营重复建单
      if (error) console.error("[admin/audits] create log failed", error.message);
    }
  }

  return NextResponse.json(
    { ok: true, id: r.id ?? null, auditCode: r.auditCode, status: startAt },
    { status: 201, headers: NO_STORE }
  );
}
