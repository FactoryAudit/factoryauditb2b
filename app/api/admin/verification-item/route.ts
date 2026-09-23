import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { writeAuditLog } from "@/lib/trustProfile";

// 逐项审核（CS-22 CHANGE SET C）
// APPROVE / REJECT / NEED_MORE_INFO + Review Note，全部记审计日志。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED = new Set(["APPROVED", "REJECTED", "NEED_MORE_INFO", "PENDING"]);

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const itemId = String(body.itemId ?? "");
  if (!UUID_RE.test(itemId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_item_id" },
      { status: 400, headers: NO_STORE }
    );
  }

  const status = String(body.status ?? "").toUpperCase();
  if (!ALLOWED.has(status)) {
    return NextResponse.json(
      { ok: false, error: "invalid_status" },
      { status: 400, headers: NO_STORE }
    );
  }

  const note = typeof body.note === "string" ? body.note.slice(0, 2000) : null;

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "db_not_configured" },
      { status: 500, headers: NO_STORE }
    );
  }

  const { data: item, error: readErr } = await db
    .from("verification_items")
    .select("id, verification_record_id, item_key")
    .eq("id", itemId)
    .single();
  if (readErr || !item) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404, headers: NO_STORE }
    );
  }

  const { error } = await db
    .from("verification_items")
    .update({
      status,
      reviewer_note: note,
      reviewed_by: admin.email ?? "admin",
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "update_failed" },
      { status: 500, headers: NO_STORE }
    );
  }

  await writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "EVIDENCE_REVIEWED",
    targetType: "verification_item",
    targetId: itemId,
    metadata: { item_key: item.item_key, status },
  });

  return NextResponse.json({ ok: true, status }, { headers: NO_STORE });
}
