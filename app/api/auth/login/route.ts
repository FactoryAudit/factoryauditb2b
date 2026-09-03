import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

// POST /api/auth/login —— 邮箱密码登录
//
// 安全设计：
//   1. 无论"邮箱不存在"还是"密码错误"，一律返回同样的 invalid_credentials。
//      区分两者等于给攻击者一个免费的邮箱枚举接口。
//   2. 限流 10 次/小时。真实用户不会一小时错 10 次，超了基本是撞库。

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`login:${clientIp(req)}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: "Too many sign-in attempts. Please try again later.",
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
    const password = typeof body?.password === "string" ? body.password : "";

    // 空值也要走同一条错误路径，不提前返回不同错误
    if (!email || !password || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "invalid_credentials" },
        { status: 401 }
      );
    }

    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "auth_not_configured" }, { status: 503 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      // 统一错误，不区分邮箱是否存在 / 密码是否正确
      return NextResponse.json(
        { ok: false, error: "invalid_credentials" },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true, userId: data.user.id });
  } catch (e) {
    console.error("[login] exception", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
