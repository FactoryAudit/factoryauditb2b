import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";

// 收藏供应商：GET（列）/ POST（加）/ DELETE（删）
//
// 用 service_role 而不是带 session 的客户端：
//   收藏列表要在 /account/saved 页面里按 slug 反查 supplier_id，
//   受 RLS 约束的客户端做 join 容易踩 policy 边界，这里统一在服务端做，
//   并且**只返回 public 层字段**（收藏夹里不该出现付费内容）。
//
// 安全：user_id 一律从 session 取，请求体里的任何 id 都不信任。
//
// 降级：数据库未配置时 GET 返回空数组、写操作返回 503。
//       前端据此提示"收藏功能暂不可用"，而不是假装收藏成功。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

const LIMIT = 60;
const WINDOW_MS = 60 * 60 * 1000;

export type SavedSupplierItem = {
  slug: string;
  legalName: string;
  country: string;
  city: string;
  riskScore: number | null;
  verificationStatus: string | null;
  savedAt: string;
};

/** GET /api/saved-suppliers —— 当前用户的收藏列表（只含 public 字段） */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE });
  }

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json({ ok: true, items: [], degraded: true }, { headers: NO_STORE });
  }

  try {
    // saved_suppliers → suppliers 的内联查询
    const { data, error } = await db
      .from("saved_suppliers")
      .select(
        "created_at, suppliers!inner(slug, legal_name, country_code, city, risk_score, verification_status, is_published)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[api/saved-suppliers] list failed", error.message);
      return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE });
    }

    type Row = {
      created_at: string;
      suppliers: {
        slug: string;
        legal_name: string;
        country_code: string;
        city: string;
        risk_score: number | null;
        verification_status: string | null;
        is_published: boolean;
      };
    };

    const items: SavedSupplierItem[] = ((data ?? []) as unknown as Row[])
      // 已下架的供应商不该继续出现在收藏夹里
      .filter((r) => r.suppliers?.is_published !== false)
      .map((r) => ({
        slug: r.suppliers.slug,
        legalName: r.suppliers.legal_name,
        country: r.suppliers.country_code,
        city: r.suppliers.city,
        riskScore: r.suppliers.risk_score,
        verificationStatus: r.suppliers.verification_status,
        savedAt: r.created_at,
      }));

    return NextResponse.json({ ok: true, items }, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/saved-suppliers] exception", e);
    return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE });
  }
}

/** POST /api/saved-suppliers —— 收藏（按 slug） */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`saved:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const user = await getCurrentUser();
  if (!user?.id) {
    // 未登录不是错误：前端据此引导注册，这是转化路径而非失败
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401, headers: NO_STORE }
    );
  }

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503, headers: NO_STORE }
    );
  }

  let slug: string | null = null;
  try {
    const body = (await req.json()) as { slug?: unknown };
    slug = clamp(body?.slug, 120);
  } catch {
    slug = null;
  }
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "invalid_slug" },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    // slug → supplier_id（不信任客户端传 id）
    const { data: sup } = await db
      .from("suppliers")
      .select("id")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (!sup?.id) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: NO_STORE }
      );
    }

    // 唯一主键保证重复收藏不会报错也不会产生脏数据
    const { error } = await db
      .from("saved_suppliers")
      .upsert(
        { user_id: user.id, supplier_id: sup.id },
        { onConflict: "user_id,supplier_id", ignoreDuplicates: true }
      );

    if (error) {
      console.error("[api/saved-suppliers] insert failed", error.message);
      return NextResponse.json(
        { ok: false, error: "save_failed" },
        { status: 500, headers: NO_STORE }
      );
    }
    return NextResponse.json({ ok: true, slug }, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/saved-suppliers] exception", e);
    return NextResponse.json(
      { ok: false, error: "save_failed" },
      { status: 500, headers: NO_STORE }
    );
  }
}

/** DELETE /api/saved-suppliers?slug=xxx —— 取消收藏 */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401, headers: NO_STORE }
    );
  }

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503, headers: NO_STORE }
    );
  }

  const slug = clamp(new URL(req.url).searchParams.get("slug"), 120);
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "invalid_slug" },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const { data: sup } = await db
      .from("suppliers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!sup?.id) {
      // 供应商已不存在：视为删除成功（幂等）
      return NextResponse.json({ ok: true, slug }, { headers: NO_STORE });
    }

    const { error } = await db
      .from("saved_suppliers")
      .delete()
      .eq("user_id", user.id)
      .eq("supplier_id", sup.id);

    if (error) {
      console.error("[api/saved-suppliers] delete failed", error.message);
      return NextResponse.json(
        { ok: false, error: "delete_failed" },
        { status: 500, headers: NO_STORE }
      );
    }
    return NextResponse.json({ ok: true, slug }, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/saved-suppliers] exception", e);
    return NextResponse.json(
      { ok: false, error: "delete_failed" },
      { status: 500, headers: NO_STORE }
    );
  }
}
