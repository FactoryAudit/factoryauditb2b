import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// POST /api/auth/logout —— 登出
//
// 失败也要返回 ok（幂等）：用户点了登出，就算服务端 session 已失效，
// 前端也应该清掉本地状态并跳回首页。返回报错只会让用户卡在"登出失败"。

export async function POST() {
  try {
    const supabase = await createServerSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (e) {
    // 记录但不阻断：登出失败不该阻止前端清理状态
    console.error("[logout] exception", e);
  }
  return NextResponse.json({ ok: true });
}
