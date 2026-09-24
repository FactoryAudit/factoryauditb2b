import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import {
  validateAndStoreEvidence,
  listEvidenceForSupplier,
  deleteEvidence,
} from "@/lib/supplierEvidence";

// CS-B 审核证据上传 / 列表 / 删除。
// 硬约束：每题 ≤5 张、证据图 ≤10MB / PDF ≤20MB、magic bytes 校验、默认 private、ownership 校验。
// 供应商绝不可通过证据获得 Verified。

const LIMIT = 40; // 同 IP 每小时
const WINDOW_MS = 60 * 60 * 1000;
const MAX_BUFFER = 22 * 1024 * 1024; // 略大于 PDF 上限，防超大请求

async function resolveOwner(req: NextRequest, supplierId: string, email?: string | null) {
  const access = await resolveSupplierAccess({ claimedSupplierId: supplierId, email });
  return access;
}

/** 取该供应商 self_assessment 行的 id（用于证据绑定 assessment_id）。无则 null。 */
async function getSelfAssessmentId(supplierId: string): Promise<string | null> {
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db
    .from("supplier_assessments")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("assessment_type", "self_assessment")
    .maybeSingle();
  return data?.id ?? null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const supplierId = (sp.get("supplierId") || "").trim();
  if (!supplierId) return NextResponse.json({ ok: false, error: "supplierId required" }, { status: 400 });
  const access = await resolveOwner(req, supplierId);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.code }, { status: access.status ?? 403 });
  const list = await listEvidenceForSupplier(access.identity.supplierId);
  return NextResponse.json({ ok: true, evidence: list });
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-evidence:${ip}`, LIMIT, WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const form = await req.formData();
    const supplierId = String(form.get("supplierId") || "").trim();
    const email = form.get("email") ? String(form.get("email")).toLowerCase().trim() : null;
    const itemKey = String(form.get("itemKey") || "").trim();
    const file = form.get("file");

    if (!supplierId) return NextResponse.json({ ok: false, error: "supplierId required" }, { status: 400 });
    if (!itemKey) return NextResponse.json({ ok: false, error: "itemKey required" }, { status: 400 });
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });
    }

    const access = await resolveOwner(req, supplierId, email);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.code }, { status: access.status ?? 403 });
    }
    const realSupplierId = access.identity.supplierId;

    if (file.size > MAX_BUFFER) {
      return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    const assessmentId = await getSelfAssessmentId(realSupplierId);

    const result = await validateAndStoreEvidence({
      supplierId: realSupplierId,
      assessmentId,
      itemKey,
      fileName: file.name || "evidence",
      declaredMime: file.type || "application/octet-stream",
      bytes,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.code }, { status: result.status ?? 400 });
    }
    return NextResponse.json({ ok: true, evidence: result.meta });
  } catch (e) {
    console.error("supplier evidence upload failed", e);
    return NextResponse.json({ ok: false, error: "upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = (sp.get("id") || "").trim();
  const supplierId = (sp.get("supplierId") || "").trim();
  if (!id || !supplierId) {
    return NextResponse.json({ ok: false, error: "id and supplierId required" }, { status: 400 });
  }
  const access = await resolveOwner(req, supplierId);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.code }, { status: access.status ?? 403 });
  const res = await deleteEvidence(id, access.identity.supplierId);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status ?? 400 });
  return NextResponse.json({ ok: true });
}
