import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getOrCreateShareToken } from "@/lib/visibility";
import { getSupplierPublicFlags, isProfilePublic } from "@/lib/trustProfile";

// CS-A：生成/取回供应商档案的分享链接。
//
// 对外只暴露 share_token（sup_xxxxxxxx），绝不暴露 suppliers.id（内部 UUID）：
//   · 买家拿到的是 /suppliers/{slug}?ref={token}
//   · token 与 supplier 的对应关系只存在于服务端，链接本身不含任何内部标识
// 非公开档案一律不签发 token（分享一个未公开的档案没有意义，也会绕过可见性闸门）。

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-share:${ip}`, 30, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug ?? "").trim();
    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "slug_required" },
        { status: 400, headers: NO_STORE }
      );
    }

    const db = createAdminClient();
    if (!db) {
      return NextResponse.json(
        { ok: false, error: "service_unavailable" },
        { status: 503, headers: NO_STORE }
      );
    }

    const flags = await getSupplierPublicFlags(slug);
    if (!flags || !isProfilePublic(flags)) {
      return NextResponse.json(
        { ok: false, error: "profile_not_public" },
        { status: 404, headers: NO_STORE }
      );
    }

    const { data: row, error } = await db
      .from("suppliers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !row) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: NO_STORE }
      );
    }

    const token = await getOrCreateShareToken(row.id);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "token_failed" },
        { status: 500, headers: NO_STORE }
      );
    }

    return NextResponse.json(
      { ok: true, token, sharePath: `/suppliers/${slug}?ref=${encodeURIComponent(token)}` },
      { headers: NO_STORE }
    );
  } catch (e) {
    console.error("supplier share failed", e);
    return NextResponse.json(
      { ok: false, error: "failed" },
      { status: 500, headers: NO_STORE }
    );
  }
}
