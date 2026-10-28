import { NextRequest, NextResponse } from "next/server";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  listOwnCertifications,
  upsertOwnCertification,
  deleteOwnCertification,
} from "@/lib/supplierCertifications";

// 供应商自助证书申报：查看 / 新增 / 修改 / 删除**自己**的证书记录。
//
// 🔴 归属一律由 resolveSupplierAccess 裁决（会话优先 / 邮箱兜底 / 歧义拒），
//    请求体里的 supplierId 只是"候选"，真正写库用裁决结果。
// 🔴 本路由**不能**写 verification_status —— 核验只属于后台（lib/supplierCertifications 已锁死）。

const LIMIT = 40; // 同 IP 每小时 40 次（含列表刷新）
const WINDOW_MS = 60 * 60 * 1000;

const NO_STORE = { "Cache-Control": "no-store" } as const;

async function resolve(req: NextRequest, supplierId: string, email: string | null) {
  const access = await resolveSupplierAccess({ claimedSupplierId: supplierId, email });
  if (!access.ok) return { ok: false as const, access };
  return { ok: true as const, supplierId: access.identity.supplierId };
}

export async function GET(req: NextRequest) {
  try {
    const rl = checkRateLimit(`supplier-certs-get:${clientIp(req)}`, LIMIT, WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: NO_STORE });
    }
    const sp = req.nextUrl.searchParams;
    const supplierId = (sp.get("supplier") ?? "").trim();
    const email = (sp.get("email") ?? "").trim() || null;
    if (!supplierId) {
      return NextResponse.json({ ok: false, error: "supplier_required" }, { status: 400, headers: NO_STORE });
    }
    const r = await resolve(req, supplierId, email);
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: r.access.code },
        { status: r.access.status ?? 403, headers: NO_STORE }
      );
    }
    const rows = await listOwnCertifications(r.supplierId);
    return NextResponse.json({ ok: true, rows }, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/supplier-certifications] GET failed", e);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(`supplier-certs-post:${clientIp(req)}`, LIMIT, WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: NO_STORE });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const supplierId = String(body.supplierId ?? "").trim();
    const email = body.email ? String(body.email).trim() : null;
    const action = String(body.action ?? "save");
    if (!supplierId) {
      return NextResponse.json({ ok: false, error: "supplier_required" }, { status: 400, headers: NO_STORE });
    }
    const r = await resolve(req, supplierId, email);
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: r.access.code },
        { status: r.access.status ?? 403, headers: NO_STORE }
      );
    }

    if (action === "delete") {
      const id = String(body.id ?? "").trim();
      if (!id) {
        return NextResponse.json({ ok: false, error: "id_required" }, { status: 400, headers: NO_STORE });
      }
      const res = await deleteOwnCertification(id, r.supplierId);
      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 400, headers: NO_STORE });
      }
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }

    const res = await upsertOwnCertification({
      supplierId: r.supplierId,
      id: body.id ? String(body.id) : null,
      programCode: body.programCode,
      displayName: body.displayName,
      certificateNo: body.certificateNo,
      issuingBody: body.issuingBody,
      issueDate: body.issueDate,
      expiryDate: body.expiryDate,
      scope: body.scope,
      evidenceDocId: body.evidenceDocId,
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, id: res.id }, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/supplier-certifications] POST failed", e);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500, headers: NO_STORE });
  }
}
