import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  saveSelfAssessmentDraft,
  submitSelfAssessment,
  getChecklistTemplates,
} from "@/lib/supplierAssessments";
import { resolveSupplierAccess } from "@/lib/supplierAccess";

// CS-B 标签①：供应商保存草稿 / 提交工厂自评估。
// 所有写操作经 resolveSupplierAccess() 裁决归属（会话优先 / 邮箱兜底 / 歧义拒）。

const LIMIT = 20; // 同 IP 每小时最多 20 次（含草稿自动保存）
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-self-assessment:${ip}`, LIMIT, WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", message: "Too many requests. Please try later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const supplierId = String(body?.supplierId || "").trim();
    const email = body?.email ? String(body.email).toLowerCase().trim() : null;
    const action = String(body?.action || "submit");
    const summary = body?.summary == null ? null : String(body.summary).slice(0, 4000);
    const responses = body?.responses;

    if (!supplierId) {
      return NextResponse.json({ ok: false, error: "supplierId required" }, { status: 400 });
    }
    if (!responses || typeof responses !== "object" || Array.isArray(responses)) {
      return NextResponse.json({ ok: false, error: "responses required" }, { status: 400 });
    }

    // 归属裁决（会话优先）；返回的服务端 supplierId 才是事实，绝不用 body 的
    const access = await resolveSupplierAccess({ claimedSupplierId: supplierId, email });
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.code },
        { status: access.status ?? 403 }
      );
    }
    const realSupplierId = access.identity.supplierId;

    const templates = await getChecklistTemplates();
    if (templates.length === 0) {
      return NextResponse.json({ ok: false, error: "templates_unavailable" }, { status: 503 });
    }

    if (action === "draft") {
      const res = await saveSelfAssessmentDraft({
        supplierId: realSupplierId,
        email: access.identity.email,
        responses,
        summary,
        templates,
      });
      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error }, { status: res.status ?? 400 });
      }
      return NextResponse.json({ ok: true, status: "draft" });
    }

    // action === "submit"
    const res = await submitSelfAssessment({
      supplierId: realSupplierId,
      email: access.identity.email,
      responses,
      summary,
      templates,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error, state: res.state },
        { status: res.status ?? 400 }
      );
    }
    return NextResponse.json({ ok: true, status: res.state });
  } catch (e) {
    console.error("supplier self-assessment failed", e);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
