import { NextRequest, NextResponse } from "next/server";
import { createSignedUrl } from "@/lib/storage";
import { resolvePublicImageForVisibleSupplier } from "@/lib/supplierImages";

// CS-A / P0-D：公开工厂图读取代理。
//
// 为什么必须代理而不是直接给 <img src="supabase.../object/public/...">：
//   bucket `supplier-docs` 是**私有**的。若把对象路径直出到 HTML，等于把私有存储布局
//   公开出去；而 original（原件，含 EXIF 与可能的敏感信息）绝不能对外可读。
//
// 因此这里只做一件事：按 imageId + variant 解析出 display / thumbnail 的路径，
// 校验通过后 302 到一个 5 分钟有效的签名 URL。
//   · variant 只有两个取值，没有 "original" 分支 —— 原件在结构上就没有出口；
//   · 档案被撤下公开（is_published / public_profile_enabled / profile_status）
//     时解析立即返回 null ⇒ 已发出的链接当场失效。

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VARIANTS = new Set(["display", "thumbnail"]);

type Ctx = { params: Promise<{ imageId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { imageId } = await params;
  if (!UUID_RE.test(imageId)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const raw = req.nextUrl.searchParams.get("v") ?? "display";
  const variant = VARIANTS.has(raw) ? (raw as "display" | "thumbnail") : "display";

  const path = await resolvePublicImageForVisibleSupplier(imageId, variant);
  // 不存在 / 未批准 / 未公开 / 档案已撤下 ⇒ 一律 404（不区分原因，防枚举）
  if (!path) {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }

  const signed = await createSignedUrl(path, 300);
  if (!signed) {
    return NextResponse.json({ ok: false, error: "sign_failed" }, { status: 500 });
  }

  return NextResponse.redirect(signed, 302);
}
