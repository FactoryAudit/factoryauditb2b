import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";
import { notifyAdminBuyerRegister, notifyBuyerRegisterReceived } from "@/lib/notify";
import { appendRegisterRow } from "@/lib/googleSheets";

// POST /api/auth/signup —— 真实注册（V2.1）
//
// 与旧 /api/register 的区别：
//   旧：只发邮件 + 写 Sheets，不建任何账号（V2.0 无账号体系）
//   新：Supabase Auth 建号 + 写 profile + 自动建 free membership
//      （后两者由 001_init.sql 的触发器完成），邮件与 Sheets 保留为通知通道。
//
// ⚠️ 部署前置：Supabase Dashboard → Authentication → Providers → Email
//    必须关掉 "Confirm email"。
//    否则用户注册后要等验证邮件才能登录，而我们的 Resend 域名还没验证，
//    邮件发不出去 → 注册漏斗直接归零。

// 限流：注册 5 次/小时（比登录严，因为注册会写库 + 发信）
const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** 密码最短 8 位。不强制大小写/符号 —— B2B 买家对复杂密码反感，转化率更重要。 */
const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  // --- 限流放最前（超限就不解析 body、不建号、不发信） ---
  const rl = checkRateLimit(`signup:${clientIp(req)}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: "Too many attempts. Please try again later or email us directly.",
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // --- Supabase 未配置 → 明确报错，不要静默假装成功 ---
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "auth_not_configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";
    const name = clamp(body?.name, 120) || "";
    const company = clamp(body?.company, 200) || "";

    // --- 校验 ---
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "invalid_email" },
        { status: 400 }
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { ok: false, error: "weak_password" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "auth_not_configured" },
        { status: 503 }
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, company },
        // 关掉邮箱确认后这里不需要 emailRedirectTo；
        // 保留它也不影响，未来若重新开启确认可直接生效
        emailRedirectTo: undefined,
      },
    });

    if (error) {
      // ⚠️ 这里必须按「不确认邮箱是否存在」处理。
      //    本站在部署时要求关掉 "Confirm email"（见文件头注释），
      //    一旦关掉，Supabase 对已注册邮箱会直接抛 "already registered" 错误 ——
      //    如果把这个结论原样翻译给用户，等于开了一个邮箱枚举接口
      //    （能探测出某人是否在本站注册过买家账号）。
      //
      //    所以：内部错误码仍叫 email_in_use（便于日志排查），
      //    但对前端只回一个「需要进一步操作」的中性错误，
      //    前端文案也不得写成「该邮箱已注册」—— 见各语言字典的
      //    register.form.errorEmailInUse。
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already been registered")) {
        return NextResponse.json(
          { ok: false, error: "email_in_use" },
          { status: 409 }
        );
      }
      console.error("[signup] supabase error", error.message);
      return NextResponse.json(
        { ok: false, error: "signup_failed" },
        { status: 400 }
      );
    }

    const userId = data.user?.id ?? null;

    // --- 通知通道（三路并行，任一失败不影响注册结果） ---
    // 注册已经成功，这些只是附加动作，绝不能因为它们失败就回滚账号
    await Promise.allSettled([
      notifyAdminBuyerRegister({
        id: userId ?? crypto.randomUUID(),
        fields: { email, name, company },
      }),
      notifyBuyerRegisterReceived({ email, name, id: userId ?? "" }),
      appendRegisterRow({
        referenceId: userId ?? crypto.randomUUID(),
        email,
        name,
        company,
        submittedAt: new Date().toISOString(),
        source: "buyer-signup",
      }),
    ]);

    return NextResponse.json({
      ok: true,
      userId,
      // 关掉邮箱确认时 session 会直接返回，前端可立即视为已登录
      needsConfirmation: !data.session,
    });
  } catch (e) {
    console.error("[signup] exception", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}
