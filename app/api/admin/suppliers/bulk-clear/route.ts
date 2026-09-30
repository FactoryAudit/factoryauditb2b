import { NextResponse } from "next/server";
import {
  requireAdmin,
  logAdminAction,
  countPublicSourceCandidates,
  bulkSetPublicSourceClearance,
  PUBLIC_SOURCE_BULK_LIMIT,
  type ListSuppliersFilter,
} from "@/lib/adminData";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

// POST /api/admin/suppliers/bulk-clear —— 批量「公开来源放行」（029）
//
// 背景：名录类数据（广交会参展商名录等）供应商本人从未申请、从未授权，
//   profile_authorized 恒为 null，单靠详情页勾选框逐条点不现实
//   （本批 200，放量后 11,433）。本路由提供批量通道。
//
// 安全四层：
//   1. requireAdmin()：非 admin → 404（不暴露后台存在，可被直接调用）
//   2. 限流：批量写库比单条敏感，独立计数桶
//   3. **两步确认**：首次不带 confirm 只回条数，管理员看到数字后才提交
//   4. 服务端强制的候选边界（见 lib/adminData.bulkSetPublicSourceClearance）：
//      只动「从未表态授权（null）且 未放行」的行、单批上限、幂等
//
// 🔴 时间戳与操作人一律服务端写，绝不接受客户端传值 —— 否则
//    「谁在什么时候放行」这条留痕可以被前端伪造。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function buildFilter(body: Record<string, unknown>): ListSuppliersFilter {
  const f: ListSuppliersFilter = {};
  if (typeof body.search === "string" && body.search.trim()) {
    f.search = body.search.trim().slice(0, 200);
  }
  if (body.published === "published" || body.published === "unpublished") {
    f.published = body.published;
  }
  // 🔴 刻意不接受 body.authorized：
  //    候选定义由服务端固定为「profile_authorized 为 null（从未表态）」，「明确拒绝」不在内。
  //    若允许客户端传 authorized=authorized，就会出现「只处理已授权的行」
  //    这种自相矛盾的组合。筛选里的 authorized 只影响列表展示，不影响本路由。
  return f;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rl = checkRateLimit(`admin-bulk-clear:${admin.userId}`, 200, 60 * 60 * 1000);
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

  // cleared=true → 放行；false → 撤销放行。必须是显式 boolean，不接受 "true" 字符串。
  if (typeof body.cleared !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "invalid_cleared" },
      { status: 400, headers: NO_STORE }
    );
  }
  const cleared = body.cleared;

  const filter = buildFilter(body);

  // ---- 第一步：只算条数（不写库）----
  const count = await countPublicSourceCandidates(filter, cleared);

  if (count === 0) {
    return NextResponse.json(
      { ok: true, count: 0, cleared, written: false },
      { status: 200, headers: NO_STORE }
    );
  }

  if (count > PUBLIC_SOURCE_BULK_LIMIT) {
    // 超限不写库，回明确数字让管理员收窄筛选后分批
    return NextResponse.json(
      {
        ok: false,
        error: "bulk_limit_exceeded",
        count,
        limit: PUBLIC_SOURCE_BULK_LIMIT,
      },
      { status: 422, headers: NO_STORE }
    );
  }

  // ---- 第二步：两步确认 ----
  if (body.confirm !== true) {
    return NextResponse.json(
      { ok: true, count, cleared, written: false, requires_confirmation: true },
      { status: 200, headers: NO_STORE }
    );
  }

  // ---- 第三步：执行 ----
  const ip = clientIp(req);
  const byEmail = admin.email ?? "system";
  const res = await bulkSetPublicSourceClearance(filter, cleared, byEmail);

  if (!res.ok) {
    // 走到这里只剩两种可能：中途条数变化越过上限，或写库失败
    return NextResponse.json(
      {
        ok: false,
        error: res.total > PUBLIC_SOURCE_BULK_LIMIT ? "bulk_limit_exceeded" : "db_error",
        count: res.total,
        limit: PUBLIC_SOURCE_BULK_LIMIT,
      },
      { status: res.total > PUBLIC_SOURCE_BULK_LIMIT ? 422 : 500, headers: NO_STORE }
    );
  }

  // ---- 审计：批量动作单独留痕，与单条放行可区分 ----
  //   明细里只放前 50 个 slug 样本 —— 2000 个 slug 会把 jsonb 撑到几十 KB，
  //   完整清单可由 public_source_cleared_at 时间戳反查。
  await logAdminAction(
    admin,
    cleared ? "supplier.bulk_public_source_cleared" : "supplier.bulk_public_source_clearance_revoked",
    "supplier",
    "batch",
    {
      cleared,
      count: res.count,
      filter: { search: filter.search ?? null, published: filter.published ?? "all" },
      sample_slugs: res.slugs.slice(0, 50),
    },
    { ipAddress: ip }
  );

  return NextResponse.json(
    { ok: true, count: res.count, cleared, written: true },
    { status: 200, headers: NO_STORE }
  );
}
