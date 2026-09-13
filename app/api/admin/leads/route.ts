import { NextResponse } from "next/server";
import { requireAdmin, updateLeadStatus, LEAD_STATUSES } from "@/lib/adminData";
import { checkRateLimit, clamp } from "@/lib/rateLimit";

// PATCH /api/admin/leads —— 流转线索状态（CS-02D）
//
// 三层安全（与 /api/admin/rfqs 同构）：
//   1. requireAdmin() 自己拦（API 可被直接调用，不经过 layout）
//   2. 字段白名单：只认 referenceId + status
//   3. 枚举校验：status 必须落在 leads_status_check 的五值内
//
// 非 admin 一律 404（不暴露后台存在）。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

// ⚠️ 必须显式标注泛型，否则推断成字面量联合导致 .has(string) 报 TS2345
const STATUSES = new Set<string>(LEAD_STATUSES);

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rl = checkRateLimit(`admin-lead:${admin.userId}`, 300, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  // 按 reference_id 定位（对外短号 LEAD-XXXXXX，不暴露内部 uuid）
  const referenceId = clamp(body.referenceId, 64);
  if (!referenceId) {
    return NextResponse.json(
      { ok: false, error: "invalid_reference" },
      { status: 400, headers: NO_STORE }
    );
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (!STATUSES.has(status)) {
    return NextResponse.json(
      { ok: false, error: "invalid_status" },
      { status: 400, headers: NO_STORE }
    );
  }

  const ok = await updateLeadStatus(referenceId, status as (typeof LEAD_STATUSES)[number]);

  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: NO_STORE });
}
