import { NextRequest, NextResponse } from "next/server";
import { notifyAdminSupplierClaim, notifyClaimReceived } from "@/lib/notify";
import { insertLead } from "@/lib/leads";
import { leadScore } from "@/lib/leadScore";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { STATIC_SUPPLIERS } from "@/lib/staticData";

// Supplier Claim Profile（需求 §24）：/suppliers/{slug}/claim 表单提交入口。
//
// CS-02D：本路由**落库**（public.leads，kind=supplier_claim）。
//   此前只发邮件、一行不落库。现在走 lib/leads.ts 统一写入通道。
//
// ⚠️ 语义红线：写进 leads 只代表"收到了一条认领申请"，
//    绝不触发任何 Trust / Verification 变更，绝不等同于 verified。
//
// 规则：
//   - slug 必须存在于真实供应商数据（防伪造）
//   - 公司邮箱 + 授权代表声明
//   - 核验结果不出售、不保证变更（页面 + 邮件双重声明）

const CLAIM_LIMIT = 5; // 同 IP 每小时最多 5 次认领提交
const CLAIM_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const KNOWN_FIELDS = [
  "companyEmail",
  "contactName",
  "companyName",
  "authorization",
  "supportNote",
] as const;

export async function POST(req: NextRequest) {
  try {
    // 限流放最前
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-claim:${ip}`, CLAIM_LIMIT, CLAIM_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          message:
            "Too many claim submissions from this address recently. Please wait a while, or email us directly.",
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const slug = String(body?.slug ?? "").trim();
    const raw = body?.fields ?? {};

    // slug 必须存在（防伪造 profile 认领）
    const supplier = STATIC_SUPPLIERS.find((s) => s.slug === slug);
    if (!supplier) {
      return NextResponse.json({ ok: false, error: "unknown_supplier" }, { status: 404 });
    }

    const f: Record<string, string> = {};
    for (const key of KNOWN_FIELDS) {
      const rawVal = raw[key];
      if (rawVal === undefined || rawVal === null) continue;
      const max = key === "supportNote" ? 2000 : 300;
      const v = String(rawVal).trim().slice(0, max);
      if (v) f[key] = v;
    }

    const email = String(f.companyEmail || "").toLowerCase();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }
    if (!f.contactName || !f.companyName) {
      return NextResponse.json({ ok: false, error: "contact and company required" }, { status: 400 });
    }
    if (f.authorization !== "yes" && f.authorization !== "no") {
      return NextResponse.json({ ok: false, error: "authorization required" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    // 落库（kind=supplier_claim）。只记录"收到了申请"，无任何 Trust 副作用。
    const saved = await insertLead({
      kind: "supplier_claim",
      tool: "supplier-claim",
      email,
      firstName: f.contactName || null,
      company: f.companyName || null,
      supplierName: supplier.legalName || null,
      message: f.supportNote || null,
      score: leadScore({ email, company: f.companyName, message: f.supportNote, tool: "supplier-claim" }),
      payload: { slug, fields: f },
    });
    if (!saved.stored) console.error("[api/supplier-claim] not stored", saved.reason, saved.message ?? "");
    const referenceId = saved.stored ? saved.referenceId : null;

    // 双邮件（通道未配置时降级为日志，不阻塞）
    await Promise.allSettled([
      notifyAdminSupplierClaim({ id: referenceId ?? id, slug, supplierName: supplier.legalName, fields: f }),
      notifyClaimReceived({ email, companyName: f.companyName, id: referenceId ?? id, slug }),
    ]);

    return NextResponse.json({ ok: true, claimId: id, referenceId, stored: saved.stored });
  } catch (e) {
    console.error("supplier claim failed", e);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
