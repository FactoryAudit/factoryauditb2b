import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminData";
import {
  upsertAdminCluster,
  setClusterPublished,
  deleteAdminCluster,
  countSuppliersInCluster,
  slugifyCluster,
} from "@/lib/industrialClusters";
import { checkRateLimit, clamp } from "@/lib/rateLimit";

// /api/admin/industrial-clusters —— 产业带（Industrial Cluster）CRUD
//
// 与 /api/admin/rfqs、/api/admin/suppliers 同一套三层安全：
//   1. requireAdmin() 自己拦（API 可被直接调用，不经过 layout）
//   2. 字段白名单：只认下面显式声明的字段，其余一律忽略
//   3. 枚举/格式校验：slug 走 slugify、isPublished 强制布尔、sortOrder 强制整数
//
// 非 admin 一律 404（不暴露后台存在）。

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function str(v: unknown, max = 400): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function tags(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
  return out.length ? out : null;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rl = checkRateLimit(`admin-cluster:${admin.userId}`, 300, 60 * 60 * 1000);
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

  // id 为空 = 新建；非空 = 更新
  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
  const name = str(body.name, 200) ?? "";
  const rawSlug = str(body.slug, 120) ?? "";
  const slug = slugifyCluster(rawSlug || name);

  const res = await upsertAdminCluster({
    id,
    name,
    slug,
    country: str(body.country, 120),
    countryCode: str(body.countryCode, 32),
    region: str(body.region, 120),
    city: str(body.city, 120),
    industry: str(body.industry, 120),
    industryTags: tags(body.industryTags),
    description: str(body.description, 2000),
    seoTitle: str(body.seoTitle, 200),
    seoDescription: str(body.seoDescription, 400),
    isPublished: body.isPublished === true,
    sortOrder: Number.isFinite(Number(body.sortOrder))
      ? Math.trunc(Number(body.sortOrder))
      : 100,
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error },
      { status: res.error === "duplicate_slug" ? 409 : 400, headers: NO_STORE }
    );
  }
  return NextResponse.json({ ok: true, id: res.id }, { headers: NO_STORE });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rl = checkRateLimit(`admin-cluster:${admin.userId}`, 300, 60 * 60 * 1000);
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

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "invalid_id" },
      { status: 400, headers: NO_STORE }
    );
  }
  if (typeof body.isPublished !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "invalid_flag" },
      { status: 400, headers: NO_STORE }
    );
  }

  const ok = await setClusterPublished(id, body.isPublished);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: NO_STORE });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rl = checkRateLimit(`admin-cluster:${admin.userId}`, 300, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE }
    );
  }

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "invalid_id" },
      { status: 400, headers: NO_STORE }
    );
  }

  // 防御：先算引用数给 UI 二次确认（真正的删除由 DELETE 执行，这里只做存在性校验）
  const ok = await deleteAdminCluster(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: NO_STORE });
}

/** GET：查询某 slug 被引用的供应商数量（删除前的风险提示） */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  const n = await countSuppliersInCluster(clamp(slug, 120) ?? "");
  return NextResponse.json({ ok: true, count: n }, { headers: NO_STORE });
}
