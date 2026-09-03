import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

// POST /api/auth/reset —— 发送密码重置邮件
//
// ⚠️ 依赖邮件送达：Supabase 默认 SMTP 每小时只发 3 封，且发件域名是 supabase.co，
//    容易被判垃圾邮件。生产应在 Supabase Dashboard → Authentication → SMTP Settings
//    配置自定义 SMTP（Resend SMTP 或自己的域名邮箱）。
//    Resend 域名验证完成前，这个功能实际不可用的概率很高 —— 代码先就位。
//
// 限流 3 次/小时：重置密码会发信，不限流等于免费邮件轰炸入口。

const RESET_LIMIT = 3;
const RESET_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`reset:${clientIp(req)}`, RESET_LIMIT, RESET_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: "Too many reset requests. Please try again later.",
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "auth_not_configured" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const locale = typeof body?.locale === "string" ? body.locale : "en";

    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "auth_not_configured" }, { status: 503 });
    }

    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://factoryauditb2b.com")
      .replace(/\/+$/, "");
    const lang = locale && locale !== "en" ? `/${locale}` : "";

    // 注意：无论邮箱是否存在都返回 ok（防枚举）。
    // Supabase 对不存在的邮箱也会返回成功，这里保持一致。
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${site}${lang}/account`,
    });

    if (error) {
      console.error("[reset] supabase error", error.message);
      // 仍返回 ok：不泄露邮箱是否存在
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset] exception", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
