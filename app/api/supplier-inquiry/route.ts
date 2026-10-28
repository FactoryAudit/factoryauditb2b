import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { insertLead } from "@/lib/leads";
import { leadScore } from "@/lib/leadScore";
import { notifyAdminNewLead, notifyCustomerLeadReceived, sendMail } from "@/lib/notify";

// 档案页询价（2026-10-28）
//
// 为什么需要：档案页此前 8 个按钮全是"卖给买家的验厂服务"，没有一个能让买家
// 向这家供应商询价 —— 采购商看完就断了动作，我们既丢了线索，也丢了"卖家想知道
// 平台能不能带单"这个最有说服力的触达理由。
//
// 关键设计：**询盘归因**。转发给供应商的邮件里必须写明"这条询盘来自你在
// FactoryAuditB2B 的档案页" —— 这是供应商愿意认领、维护档案的唯一实证依据。
// 没有归因，平台对他们就只是"一个抓了我资料的网站"。

const LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-inquiry:${ip}`, LIMIT, WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

    const slug = clip(body.slug, 120);
    const name = clip(body.name, 120);
    const email = clip(body.email, 254).toLowerCase();
    const company = clip(body.company, 160);
    const country = clip(body.country, 80);
    const product = clip(body.product, 200);
    const quantity = clip(body.quantity, 80);
    const note = clip(body.note, 2000);
    const needsAudit = body.needsAudit === true;

    if (!slug) return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });
    if (!name || !company) {
      return NextResponse.json({ ok: false, error: "name and company required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }
    if (!product) {
      return NextResponse.json({ ok: false, error: "product required" }, { status: 400 });
    }

    const db = createAdminClient();
    if (!db) {
      return NextResponse.json(
        { ok: false, error: "service_unavailable", message: "Please email us directly." },
        { status: 503 }
      );
    }

    // 只认已发布档案，避免对草稿/下架供应商发询盘（防枚举 + 防无效线索）
    const { data: supplier, error: sErr } = await db
      .from("suppliers")
      .select("id, slug, legal_name, display_name, contact_email, verification_level, is_published")
      .eq("slug", slug)
      .maybeSingle();
    if (sErr) {
      console.error("[supplier-inquiry] lookup failed", sErr.message);
      return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
    }
    if (!supplier || !supplier.is_published) {
      return NextResponse.json({ ok: false, error: "unknown_supplier" }, { status: 404 });
    }

    const supplierLabel = supplier.display_name || supplier.legal_name || slug;

    const saved = await insertLead({
      // kind 用 buyer_lead（买家线索）—— leads.kind 的 CHECK 只允许 4 个值，
      // 不为一条新业务去改约束；来源靠 tool + linkedSupplierId 区分。
      kind: "buyer_lead",
      tool: "supplier-inquiry",
      email,
      firstName: name,
      company,
      country: country || null,
      sourcing: product,
      supplierName: supplierLabel,
      linkedSupplierId: supplier.id,
      message: note || null,
      score: leadScore({ email, company, message: note, tool: "supplier-inquiry" }),
      payload: {
        slug,
        product,
        quantity,
        needsAudit,
        source: "supplier_profile",
        profileUrl: `https://factoryauditb2b.com/suppliers/${slug}`,
      },
    });
    if (!saved.stored) {
      console.error("[supplier-inquiry] not stored", saved.reason);
    }
    const referenceId = saved.stored ? (saved as { referenceId: string }).referenceId : "PENDING";

    const profileUrl = `https://factoryauditb2b.com/suppliers/${slug}`;
    const wasShort = (v: string) => (v || "(not provided)");

    // ── 1) 供应商通知（核心：明确归因）─────────────────────────────
    const supplierMail = supplier.contact_email
      ? sendMail({
          to: supplier.contact_email,
          subject: `新的询价：${product} — 通过 FactoryAuditB2B 档案页发来（${referenceId}）`,
          text: `您好 ${supplierLabel}，

有境外采购商通过您在 FactoryAuditB2B 的档案页提交了询价。

【来源说明】这条询价由 FactoryAuditB2B 平台代为转达 —— 买家是在我们的供应商目录里
看到您的档案后直接发起询价的。这是我们平台带来的询盘。

  档案链接：${profileUrl}
  询价编号：${referenceId}

买家信息
  姓名：${name}
  公司：${company}
  国家：${wasShort(country)}
  邮箱：${email}

需求
  产品：${product}
  数量：${wasShort(quantity)}
  备注：${wasShort(note || "")}
  是否需要第三方验厂：${needsAudit ? "是 —— 买家希望现场核实供应商" : "未说明"}

请直接回复买家邮箱联系：${email}

如您希望我们代为跟进（包括安排现场核验），回复本邮件即可。

——
FactoryAuditB2B
support@factoryauditb2b.com
${profileUrl}`,
        })
      : Promise.resolve(false);

    // ── 2) 买家回执 ────────────────────────────────────────────────
    const buyerMail = notifyCustomerLeadReceived({
      email,
      firstName: name,
      tool: referenceId,
    }).catch(() => false);

    // ── 3) 管理员通知 ──────────────────────────────────────────────
    const adminMail = notifyAdminNewLead({
      id: referenceId,
      tool: "supplier-inquiry",
      firstName: name,
      email,
      company,
      country,
      message: `[${supplierLabel}] ${product}${quantity ? ` · ${quantity}` : ""}${needsAudit ? " · 需验厂" : ""}${
        note ? `\n${note}` : ""
      }${supplier.contact_email ? "" : "\n⚠️ 该供应商无邮箱，需人工转发"}`,
      score: 70,
    }).catch(() => false);

    await Promise.allSettled([supplierMail, buyerMail, adminMail]);

    return NextResponse.json({
      ok: true,
      referenceId,
      // 让前端能告诉买家「是否需要验厂」的下一步，而不是一句干巴巴的"已提交"
      supplierNotified: Boolean(supplier.contact_email),
    });
  } catch (e) {
    console.error("[supplier-inquiry] error", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
