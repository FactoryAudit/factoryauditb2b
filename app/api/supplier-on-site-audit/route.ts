import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { applyOnSiteAudit } from "@/lib/supplierAssessments";

// CS-21 标签③：供应商发起「平台现场审核」申请。
// 轻量归属：supplierId + contact_email 匹配。写入走 service_role。

const LIMIT = 10; // 同 IP 每小时最多 10 次
const WINDOW_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-onsite:${ip}`, LIMIT, WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", message: "Too many requests. Please try later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null; // 空/非法 body → 走下游 400 校验，不抛 500
    }
    const data = (body ?? {}) as Record<string, unknown>;
    const supplierId = String(data.supplierId || "").trim();
    const email = String(data.email || "").toLowerCase().trim();

    if (!supplierId) {
      return NextResponse.json({ ok: false, error: "supplierId required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "valid email required" }, { status: 400 });
    }

    const res = await applyOnSiteAudit({ supplierId, email });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: res.status ?? 400 });
    }
    return NextResponse.json({ ok: true, status: "submitted", slaDueAt: res.slaDueAt });
  } catch (e) {
    console.error("supplier on-site audit apply failed", e);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
