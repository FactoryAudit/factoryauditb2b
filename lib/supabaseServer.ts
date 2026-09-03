// lib/supabaseServer.ts —— 服务端 Supabase 客户端（带用户 session）
//
// 用途：Server Component / Route Handler 里读取"当前登录用户"。
// 机制：从请求 Cookie 里还原 session，因此它**代表当前访问者的权限**（受 RLS 约束）。
//
// ⚠️ 重要（本方案的核心红线）：
//   在 /suppliers 与 /suppliers/[slug] 页面里**禁止调用本文件的函数**，
//   因为 cookies() 属于 Next 的 Dynamic API，一旦调用，
//   这两个页面会从 ● SSG 静态预渲染退化为 ƒ Dynamic，
//   并且 Cloudflare 缓存存在「把已登录用户的 HTML 发给游客」的串号风险。
//   会员内容一律走客户端 UnlockGate + /api/me。
//
// 未配置时返回 null（fail-open），调用方必须判空。

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "./supabaseClient";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

/**
 * 创建带当前用户 session 的服务端客户端。
 *
 * 关于 setAll 的 try/catch：
 *   在 Server Component 渲染过程中，Next 不允许写 Cookie，会抛异常。
 *   @supabase/ssr 需要在 token 过期时写回刷新后的 cookie，
 *   所以这里必须吞掉该异常（在 Route Handler / Server Action 里它是能写成功的）。
 */
export async function createServerSupabase() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(URL, ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component 渲染期写 Cookie 会抛错，忽略即可。
          // 真正的刷新会由 middleware 或 Route Handler 完成。
        }
      },
    },
  });
}

/**
 * 取当前登录用户。未登录 / 未配置 / 异常一律返回 null（绝不抛异常）。
 *
 * 安全说明：优先用 getUser()（向 Supabase 服务端校验 token），
 * 不要用 getSession()（只解本地 JWT，token 已失效时也会返回"有效"）。
 */
export async function getCurrentUser() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}
