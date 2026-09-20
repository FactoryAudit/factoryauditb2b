import { NextResponse } from "next/server";
import { requireAdmin, updateRfqStatus, setRfqPublic } from "@/lib/adminData";
import { checkRateLimit, clamp } from "@/lib/rateLimit";

// PATCH /api/admin/rfqs —— 流转询价单状态
//
// 与 /api/admin/suppliers 同样的三层安全：
//   1. requireAdmin() 自己拦（API 可被直接调用，不经过 layout）
//   2. 字段白名单：只认 referenceId + status
//   3. 枚举校验：status 必须落在数据库 CHECK 约束允许的四值内
//
// 非 admin 一律 404（不暴露后台存在）。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const STATUSES = new Set(["new", "reviewing", "matched", "closed"]);

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rl = checkRateLimit(`admin-rfq:${admin.userId}`, 300, 60 * 60 * 1000);
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

  // 按 reference_id 定位（对外短号，不暴露内部 uuid）
  const referenceId = clamp(body.referenceId, 64);
  if (!referenceId) {
    return NextResponse.json(
      { ok: false, error: "invalid_reference" },
      { status: 400, headers: NO_STORE }
    );
  }

  // ---- STEP-02B：对外公开闸门（与 status 语义分离）----
  // 传 isPublic（布尔）→ 切换公开状态；否则按原逻辑流转 status。
  if (typeof body.isPublic === "boolean") {
    const okPub = await setRfqPublic(referenceId, body.isPublic);
    return NextResponse.json(
      { ok: okPub },
      { status: okPub ? 200 : 500, headers: NO_STORE }
    );
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (!STATUSES.has(status)) {
    return NextResponse.json(
      { ok: false, error: "invalid_status" },
      { status: 400, headers: NO_STORE }
    );
  }

  const ok = await updateRfqStatus(
    referenceId,
    status as "new" | "reviewing" | "matched" | "closed"
  );

  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: NO_STORE });
}
