import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";
import { isHoneypotFilled } from "@/lib/rfqSpam";
import { insertLead } from "@/lib/leads";
import { notifyAdminSupplierQuote, notifySupplierQuoteReceived } from "@/lib/notify";

// POST /api/rfq/respond —— 供应商回应一条公开买家需求（报价）
//
// ─────────────────────────────────────────────────────────────────────────────
// 为什么有这个路由（2026-11-13）
// ─────────────────────────────────────────────────────────────────────────────
//   /suppliers 的「Respond to Request」此前链到 /rfq?request=RFQ-XXXX，但
//   /rfq 是**买家发需求**的表单，`request` 参数只有埋点在读 —— 供应商点进去
//   看到的是一张空白采购单，是彻底的死链。
//
//   现在 /rfq?request=... 渲染的是本路由对应的「供应商报价」表单：
//   供应商报价 → 落 leads(kind=supplier_quote) → 管理员邮件 → 供应商回执。
//
// 语义红线：
//   · 提交报价 ≠ 已选为供应商、≠ 已核验、≠ 已成交。回执邮件必须写清这一点。
//   · 只接受 is_public=true 的需求：买家没有授权公开的 RFQ，绝不向第三方透露。
//   · 报价只进 leads，不写 rfq_matches —— rfq_matches 需要 suppliers.id，
//     这里没有经过核验的供应商主体，硬塞会污染撮合表。
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RFQ_REF_RE = /^RFQ-[A-Z0-9]{4,10}$/;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`rfq-respond:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let b: Record<string, unknown> = {};
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const reference = String(b.reference ?? "").trim().toUpperCase();
  // ---- 2026-11-13：蜜罐。人看不见的隐藏域被填 = 脚本。
  //   假成功：不落库、不发信、不报错，让爬虫以为成功而不重试。
  //   放在任何 DB 查询之前，避免无意义的查询与写库。
  if (isHoneypotFilled(b.hp_website)) {
    console.warn("[api/rfq/respond] honeypot hit, dropped", { ip });
    return NextResponse.json(
      { ok: true, stored: false, referenceId: null },
      { headers: NO_STORE }
    );
  }
  const company = clamp(b.company, 200);
  const contactName = clamp(b.contact_name, 80);
  const email = String(b.email ?? "").trim().toLowerCase();
  const phone = clamp(b.phone, 40);
  const price = clamp(b.price, 120);
  const moq = clamp(b.moq, 120);
  const leadTime = clamp(b.lead_time, 120);
  const message = clamp(b.message, 3000);

  if (!RFQ_REF_RE.test(reference)) {
    return NextResponse.json(
      { ok: false, error: "invalid_reference" },
      { status: 400, headers: NO_STORE }
    );
  }
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400, headers: NO_STORE }
    );
  }

  const missing: string[] = [];
  if (!company) missing.push("company");
  if (!message) missing.push("message");
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "missing_fields", fields: missing },
      { status: 422, headers: NO_STORE }
    );
  }

  // ---- 需求必须是「买家明确授权公开」的那一条 ----
  const db = createAdminClient();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503, headers: NO_STORE }
    );
  }

  let rfqProduct: string | null = null;
  try {
    const { data, error } = await db
      .from("rfqs")
      .select("reference_id, product")
      .eq("reference_id", reference)
      .eq("is_public", true)
      .neq("status", "closed")
      .maybeSingle();
    if (error) {
      console.error("[api/rfq/respond] lookup failed", error.message);
    }
    if (data?.product) rfqProduct = String(data.product);
  } catch (e) {
    console.error("[api/rfq/respond] lookup exception", e);
  }

  if (!rfqProduct) {
    // 不存在 / 未公开 / 已关闭 —— 对外统一一句，不区分（避免探测哪些编号存在）
    return NextResponse.json(
      { ok: false, error: "unknown_request" },
      { status: 404, headers: NO_STORE }
    );
  }

  const quoteMessage = [
    price ? `Unit price: ${price}` : "",
    moq ? `MOQ: ${moq}` : "",
    leadTime ? `Lead time: ${leadTime}` : "",
    message ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  const lead = await insertLead({
    kind: "supplier_quote",
    tool: "rfq-respond",
    email,
    firstName: contactName,
    company,
    phone,
    // sourcing 在 leads 里的语义是「要采购什么 / 所属行业」，这里放被回应的需求主题
    sourcing: rfqProduct,
    supplierName: company,
    message: quoteMessage,
    score: 60,
    payload: {
      rfqReference: reference,
      rfqProduct,
      price,
      moq,
      leadTime,
      note: message,
    },
  });

  const stored = lead.stored;
  const referenceId = lead.stored ? lead.referenceId : "LEAD-PENDING";

  await Promise.allSettled([
    notifyAdminSupplierQuote({
      referenceId,
      rfqReference: reference,
      product: rfqProduct,
      stored,
      company: company ?? "",
      contactName,
      email,
      phone,
      price,
      moq,
      leadTime,
      message,
    }),
    notifySupplierQuoteReceived({ email, company: company ?? "", rfqReference: reference }),
  ]);

  return NextResponse.json({ ok: true, referenceId, stored }, { headers: NO_STORE });
}
