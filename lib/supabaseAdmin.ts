// lib/supabaseAdmin.ts —— 服务端特权客户端（service_role）
//
// ⚠️⚠️ 危险区 ⚠️⚠️
//   这个客户端**绕过所有 RLS 策略**，对全库有读写权限。
//   硬约束（违反即为安全事故）：
//     1. 只能在服务端代码里 import（Route Handler / Server Component / Server Action）
//        客户端组件一旦 import 就会把 key 打进浏览器 bundle
//     2. 绝不能出现在任何 NEXT_PUBLIC_ 变量里
//     3. 查询结果**必须先经 lib/access.ts 裁剪字段**再返回给前端
//     4. 只允许在 Cloudflare Workers secrets 里配置，不写进 .env 提交到 git
//
// 自检命令（应只在 .env.example 里命中，其他地方命中即为事故）：
//   grep -rn "SUPABASE_SERVICE_ROLE_KEY" --include="*.ts" --include="*.tsx" .

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

/** service_role key 是否已配置 */
export function isAdminConfigured(): boolean {
  return Boolean(URL && SERVICE_KEY);
}

/**
 * 创建特权客户端。未配置时返回 null，调用方必须判空。
 *
 * auth 选项说明：
 *   persistSession: false  —— 服务端无状态，不持久化会话
 *   autoRefreshToken: false —— 不需要自动刷新，每次请求都是全新的
 */
export function createAdminClient() {
  if (!isAdminConfigured()) return null;
  return createClient(URL, SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
