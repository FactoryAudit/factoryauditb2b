import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { submitSelfAssessment } from "@/lib/supplierAssessments";

// CS-21 标签①：供应商提交工厂自评估（两份清单 72 项结果）。
// 轻量归属：supplierId + contact_email 匹配。admin 审核发布在另一路由。

const LIMIT = 10; // 同 IP 每小时最多 10 次提交
const WINDOW_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-self-assessment:${ip}`, LIMIT, WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", message: "Too many submissions. Please try later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const supplierId = String(body?.supplierId || "").trim();
    const email = String(body?.email || "").toLowerCase().trim();
    const summary = body?.summary == null ? null : String(body.summary).slice(0, 4000);
    const responses = body?.responses;

    if (!supplierId) {
      return NextResponse.json({ ok: false, error: "supplierId required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "valid email required" }, { status: 400 });
    }
    if (!responses || typeof responses !== "object" || Array.isArray(responses)) {
      return NextResponse.json({ ok: false, error: "responses required" }, { status: 400 });
    }

    const res = await submitSelfAssessment({
      supplierId,
      email,
      responses: responses as Record<string, string>,
      summary,
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: res.status ?? 400 });
    }
    return NextResponse.json({ ok: true, status: "submitted" });
  } catch (e) {
    console.error("supplier self-assessment failed", e);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
