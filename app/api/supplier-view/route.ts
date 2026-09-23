import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { recordShareEvent, visitorHash } from "@/lib/visibility";
import { getSupplierPublicFlags, isProfilePublic } from "@/lib/trustProfile";

// CS-A：档案浏览埋点（PROFILE_VIEW + UNIQUE_VISIT）。
//
// 为什么走客户端 POST 而不是在页面里直接写库：
//   档案页是**预渲染**的（revalidate=3600，构建期产出静态产物）。
//   在 RSC 里写库要么拿不到请求上下文，要么把整页拖回动态渲染 —— 两者都不可接受。
//   所以页面保持静态，浏览事件由一个极小的客户端组件在挂载后补发。
//
// 防刷：
//   · UNIQUE_VISIT 由 DB 唯一索引按「供应商 + 访客 hash + 日期」去重，重复即忽略；
//   · 访客标识只存 hash（IP+UA 单向摘要），不落明文 IP；
//   · 同 IP 每分钟限流，超限静默放行（统计类埋点不得影响页面可用性）。

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" } as const;
// 只收 slug，不收内部 UUID —— 埋点请求体里也不该出现 suppliers.id
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/i;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-view:${ip}`, 60, 60 * 1000);
    if (!rl.ok) {
      // 埋点限流一律静默放行，绝不给用户看到 429
      return NextResponse.json({ ok: true, skipped: "rate_limited" }, { headers: NO_STORE });
    }

    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug ?? "").trim();
    const ref = String(body?.ref ?? "").trim() || null;
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json(
        { ok: false, error: "bad_request" },
        { status: 400, headers: NO_STORE }
      );
    }

    const db = createAdminClient();
    if (!db) {
      return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: NO_STORE });
    }

    // 只给**公开档案**记浏览：未公开/已撤下的档案不产生可见度积分
    const { data: row } = await db
      .from("suppliers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!row?.id) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: NO_STORE });
    }
    const flags = await getSupplierPublicFlags(slug);
    if (!flags || !isProfilePublic(flags)) {
      return NextResponse.json({ ok: true, skipped: "not_public" }, { headers: NO_STORE });
    }
    const supplierId = row.id as string;

    const vh = await visitorHash(ip, req.headers.get("user-agent") ?? "");
    await recordShareEvent({ supplierId, eventType: "PROFILE_VIEW", shareToken: ref, visitorHash: vh });
    await recordShareEvent({ supplierId, eventType: "UNIQUE_VISIT", shareToken: ref, visitorHash: vh });

    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    console.error("supplier view tracking failed", e);
    // 埋点失败绝不影响页面
    return NextResponse.json({ ok: false, error: "failed" }, { status: 200, headers: NO_STORE });
  }
}
