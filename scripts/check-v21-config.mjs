#!/usr/bin/env node
/**
 * scripts/check-v21-config.mjs —— V2.1 上线前配置自检
 *
 * 用法（项目根目录）：
 *   node --env-file-if-exists=.env scripts/check-v21-config.mjs
 *
 * 设计原则：
 *   - **只读**。全程只发 GET / HEAD 请求，绝不写入、绝不创建任何数据。
 *     所以可以放心在生产库上跑，跑一万次也不会弄脏。
 *   - **分级输出**：PASS / WARN / FAIL。只有 FAIL 会阻塞部署。
 *   - **不猜测**。查不到就说查不到，给人工确认指引，不编造结论。
 *
 * 为什么需要这个脚本：
 *   配置错误如果等到部署后才发现，要走一遍 10 分钟的构建 + 部署 + CDN 传播，
 *   反馈循环极慢。本地 3 秒就知道对不对。
 */

import { createClient } from "@supabase/supabase-js";

// 001_init.sql 实际建的表（与迁移脚本保持一致，改表时要同步这里）
const EXPECTED_TABLES = [
  "profiles",
  "memberships",
  "suppliers",
  "supplier_capabilities",
  "supplier_evidence",
  "saved_suppliers",
  "profile_views",
  "rfqs",
  "rfq_matches",
  "stripe_events",
];

// ---- 输出辅助 ----

let pass = 0;
let warn = 0;
let fail = 0;

function ok(msg) {
  pass++;
  console.log(`  \x1b[32mPASS\x1b[0m  ${msg}`);
}
function wrn(msg) {
  warn++;
  console.log(`  \x1b[33mWARN\x1b[0m  ${msg}`);
}
function bad(msg) {
  fail++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${msg}`);
}
function info(msg) {
  console.log(`        ${msg}`);
}
function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// 兼容两种 Supabase key 格式：
//   - 老式 JWT：eyJ...（旧项目）
//   - 新版 publishable/secret：sb_publishable_xxx / sb_secret_xxx（2024+ 新项目）
function isSupabaseKey(k, kind) {
  if (!k) return false;
  if (k.startsWith("eyJ")) return true;
  if (kind === "anon" && k.startsWith("sb_publishable_")) return true;
  if (kind === "service" && k.startsWith("sb_secret_")) return true;
  return false;
}

// ---- 0. 读环境变量 ----

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const priceId = process.env.STRIPE_PRICE_ID_FOUNDING_BUYER?.trim();
const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripeHook = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const mailKey = process.env.MAIL_HTTP_KEY?.trim();
const fromEmail = process.env.FROM_EMAIL?.trim();

console.log("\x1b[1m=== V2.1 上线前配置自检 ===\x1b[0m");
console.log("（只读检查，不会写入任何数据）");

// ---- 1. 环境变量格式 ----

section("1. 环境变量");

if (!url) {
  bad("NEXT_PUBLIC_SUPABASE_URL 未配置");
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  bad(`NEXT_PUBLIC_SUPABASE_URL 格式不对：${url}`);
  info("应为 https://<项目id>.supabase.co");
} else {
  ok(`NEXT_PUBLIC_SUPABASE_URL = ${url}`);
}

if (!anon) {
  bad("NEXT_PUBLIC_SUPABASE_ANON_KEY 未配置");
} else if (!isSupabaseKey(anon, "anon")) {
  bad("NEXT_PUBLIC_SUPABASE_ANON_KEY 不像 JWT（应以 eyJ 开头）");
} else {
  ok("NEXT_PUBLIC_SUPABASE_ANON_KEY 已配置（JWT 格式正确）");
}

if (!service) {
  bad("SUPABASE_SERVICE_ROLE_KEY 未配置");
  info("位置：Supabase → Project Settings → API Keys → service_role");
  info("⚠️ 这个 key 绕过全部 RLS，只能用 wrangler secret put 写 Workers");
} else if (!isSupabaseKey(service, "service")) {
  bad("SUPABASE_SERVICE_ROLE_KEY 不像 JWT（应以 eyJ 开头）");
} else if (service === anon) {
  bad("SUPABASE_SERVICE_ROLE_KEY 与 anon key 相同 —— 你复制错了");
} else {
  ok("SUPABASE_SERVICE_ROLE_KEY 已配置（JWT 格式正确）");
}

// ---- 2. 连通性与建表 ----

section("2. Supabase 连通性与建表");

let db = null;
if (url && service && isSupabaseKey(service, "service")) {
  db = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 逐表 HEAD 查询只取 count，不拉数据（快，且不占带宽）
  const missing = [];
  const broken = [];

  for (const t of EXPECTED_TABLES) {
    try {
      const { error } = await db
        .from(t)
        .select("*", { count: "exact", head: true });
      if (error) {
        // PGRST205 = 表不在 PostgREST 的 schema cache 里（多半是没建）
        if (error.code === "PGRST205" || error.code === "42P01") {
          missing.push(t);
        } else {
          broken.push(`${t} (${error.code ?? error.message})`);
        }
      }
    } catch (e) {
      broken.push(`${t} (${e?.message ?? "unknown"})`);
    }
  }

  if (missing.length === 0 && broken.length === 0) {
    ok(`10 张表全部就绪`);
  } else {
    if (missing.length) {
      bad(`缺少 ${missing.length} 张表：${missing.join(", ")}`);
      info("去 SQL Editor 执行 supabase/migrations/001_init.sql");
    }
    if (broken.length) {
      bad(`${broken.length} 张表查询异常：${broken.join("; ")}`);
    }
  }

  // suppliers 有数据才算迁移过了
  if (!missing.includes("suppliers")) {
    const { count, error } = await db
      .from("suppliers")
      .select("*", { count: "exact", head: true });
    if (error) {
      wrn(`suppliers 表行数查不到：${error.message}`);
    } else if (count === 0) {
      wrn("suppliers 表是空的 —— 还没跑数据迁移");
      info("node --env-file-if-exists=.env scripts/seed-suppliers.mjs --apply");
    } else {
      ok(`suppliers 表已有 ${count} 家供应商`);
    }
  }
} else {
  wrn("跳过连通性检查（URL 或 service_role 未配置）");
}

// ---- 3. RLS 有效性（最关键的安全检查）----

section("3. RLS 是否真的生效");

// 为什么必须查：anon key 会进前端 bundle，任何人都能拿到。
// RLS 是保护数据的唯一防线。如果 RLS 没生效，
// 任何人打开浏览器控制台就能拖走整张 profiles 表（含所有用户邮箱）。

if (url && anon && isSupabaseKey(anon, "anon")) {
  const anonDb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await anonDb
      .from("profiles")
      .select("id, email")
      .limit(5);

    if (error) {
      // RLS 拒绝未登录访问时会报权限错误
      ok("anon key 读不到 profiles（RLS 生效）");
    } else if (Array.isArray(data) && data.length > 0) {
      bad("🚨 anon key 能读到 profiles 数据 —— RLS 没生效！");
      info("这是 P0 安全事故：任何人都能拖走全部用户邮箱。");
      info("检查 001_init.sql 里的 ENABLE ROW LEVEL SECURITY 是否都执行成功。");
    } else {
      ok("anon key 查 profiles 返回空（RLS 生效）");
    }
  } catch (e) {
    // 网络层异常，判断不了，如实说
    wrn(`RLS 检查未能完成：${e?.message ?? "unknown"}`);
    info("请手动确认：Supabase → Table Editor → profiles → 应显示 RLS enabled");
  }
} else {
  wrn("跳过 RLS 检查（URL 或 anon key 未配置）");
}

// ---- 4. 支付配置（C 方案下未配置是正常的）----

section("4. 支付（Stripe）");

const stripeConfigured = Boolean(stripeKey && stripeHook && priceId);

if (stripeConfigured) {
  ok("Stripe 三件套齐全（在线支付已启用）");
  if (!stripeKey.startsWith("sk_")) wrn("STRIPE_SECRET_KEY 应以 sk_ 开头");
  if (!stripeHook.startsWith("whsec_")) wrn("STRIPE_WEBHOOK_SECRET 应以 whsec_ 开头");
  if (!priceId.startsWith("price_")) wrn("STRIPE_PRICE_ID_FOUNDING_BUYER 应以 price_ 开头");

  // 切到 A 方案后，字典文案要从"咨询开通"改成"立即订阅"
  wrn("⚠️ 记得把 9 语的 membership.cta / paymentNote 切换成收款版文案");
  info('现状是 C 方案文案（cta="Talk to us"、paymentNote="Online payment is not open yet"）');
  info("不改的话：支付已开通，按钮却写着「咨询开通」，白白损失转化");
} else {
  const lacking = [
    stripeKey ? null : "STRIPE_SECRET_KEY",
    stripeHook ? null : "STRIPE_WEBHOOK_SECRET",
    priceId ? null : "STRIPE_PRICE_ID_FOUNDING_BUYER",
  ].filter(Boolean);
  wrn(`Stripe 未完整配置（缺 ${lacking.join("、")}）`);
  info("这是 C 方案的预期状态：在线支付走 /custom-services 人工对接。");
  info("CheckoutButton 会自动降级，站点不会报错。");
}

// ---- 5. 邮件 ----

section("5. 邮件（Resend）");

if (!mailKey) {
  wrn("MAIL_HTTP_KEY 未配置 —— 所有邮件都发不出去");
} else if (!mailKey.startsWith("re_")) {
  wrn("MAIL_HTTP_KEY 应以 re_ 开头，确认没复制错");
} else {
  ok("MAIL_HTTP_KEY 已配置");
}

if (!fromEmail) {
  wrn("FROM_EMAIL 未配置");
} else if (fromEmail.endsWith("@resend.dev")) {
  wrn(`FROM_EMAIL = ${fromEmail}`);
  info("这是 Resend 内置测试地址，只能发给注册邮箱，发给客户一律 403。");
  info("修法：Resend → Domains → 加 3 条 DNS → 验证通过 → 改成 support@factoryauditb2b.com");
} else {
  ok(`FROM_EMAIL = ${fromEmail}`);
}

// ---- 6. 人工确认项 ----

section("6. 必须人工确认（脚本查不到）");

console.log("  \x1b[36m[ ]\x1b[0m Supabase → Authentication → Providers → Email");
console.log("      \x1b[1m「Confirm email」必须是关闭状态\x1b[0m");
console.log("      开着 = 注册后要先点验证邮件，而域名未验证时邮件发不出 → 注册漏斗归零");
console.log("  \x1b[36m[ ]\x1b[0m 已用自己邮箱注册，并执行：");
console.log("      UPDATE profiles SET role='admin' WHERE email='你的邮箱';");
console.log("      否则 /admin 对你也是 404");

// ---- 结论 ----

console.log(`\n\x1b[1m=== 结论 ===\x1b[0m`);
console.log(`  PASS ${pass} · WARN ${warn} · FAIL ${fail}`);

if (fail > 0) {
  console.log("\n  \x1b[31m✗ 有 FAIL 项，先修完再部署。\x1b[0m\n");
  process.exit(1);
}

if (!stripeConfigured) {
  console.log(
    "\n  \x1b[33m✓ 可以部署（C 方案：无在线支付，走人工对接）\x1b[0m"
  );
  console.log("    第 6 节两项人工确认做完后再部署。\n");
} else {
  console.log("\n  \x1b[32m✓ 可以部署（A 方案：在线支付已就绪）\x1b[0m\n");
}

process.exit(0);
