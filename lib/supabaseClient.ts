// lib/supabaseClient.ts —— 浏览器端 Supabase 客户端（anon key）
//
// 用途：客户端组件里做登录/登出等 Auth 操作。
// 安全：只用 NEXT_PUBLIC_ 的 anon key，受 RLS 保护，可以暴露给浏览器。
//       绝不能把 SUPABASE_SERVICE_ROLE_KEY 放进这里（它会绕过所有 RLS）。
//
// 未配置时返回 null（fail-open）：本地开发或构建期没有环境变量也不崩。
// 未来若升级 Supabase 类型，可用 `supabase gen types typescript` 生成 Database 类型
// 替换掉下方的 any。

import { createBrowserClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

/** Supabase 是否已配置（构建期/运行期都可以安全调用） */
export function isSupabaseConfigured(): boolean {
  return Boolean(URL && ANON);
}

/**
 * 浏览器端客户端。未配置时返回 null，调用方必须判空。
 *
 * 注意：createBrowserClient 内部已做单例复用，不必自己缓存。
 */
export function createClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(URL, ANON);
}
