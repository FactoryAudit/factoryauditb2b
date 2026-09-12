// scripts/scrub-next-env.mjs
//
// 干什么：部署前把 OpenNext 产物里的密钥明文清空。
//
// 为什么：opennextjs-cloudflare build 会把构建时的 process.env 整份写进
//   .open-next/cloudflare/next-env.mjs，并随 Worker 代码一起上传。里面躺着
//   CLOUDFLARE_API_TOKEN（有 Workers 编辑权限）、SUPABASE_SERVICE_ROLE_KEY
//   （绕过 RLS 读写全表）、MAIL_HTTP_KEY、STRIPE_* 等明文密钥。
//   Worker 代码对任何有 Cloudflare 账号权限的人可见，等于把钥匙挂在门上。
//
// 为什么清空是安全的（已验证 .open-next/cloudflare/init.js 第 60-71 行）：
//     for (const [k, v] of Object.entries(env)) process.env[k] = v;   // Worker secret 先写
//     for (const k in nextEnvVars[mode]) process.env[k] ??= nextEnvVars[mode][k];  // .env 只兜底
//   用的是 ??= —— Worker 的 vars/secrets 优先级更高，next-env.mjs 只在
//   process.env 里没有该 key 时才补齐。所以凡是已经 `wrangler secret put`
//   过的变量，清空兜底值不会影响线上行为。
//
// 铁律：只清「已做成 Worker secret」或「纯构建/部署期使用」的项。
//   没做成 secret 的运行时变量一旦清空，线上就会读不到值。加新 secret 后
//   同步把 key 加进 SCRUB，并确认 wrangler secret list 里有它。
//
// ⚠️ 必须覆盖全部导出对象：next-env.mjs 会同时导出
//   production / development / test 三份（按 NODE_ENV 生成）。
//   init.js 只在 NEXTJS_ENV=test 时读 test 段，但该段同样会被打包上传，
//   所以三个对象都要清。此前只扫前两个，导致 test 段曾带着
//   CLOUDFLARE_API_TOKEN / SUPABASE_SERVICE_ROLE_KEY 明文上线（2026-09-10 修复）。
//
// 用法：opennextjs-cloudflare build 之后、wrangler deploy 之前跑。
//   node scripts/scrub-next-env.mjs

import fs from "node:fs";
import path from "node:path";

const TARGET = path.join(".open-next", "cloudflare", "next-env.mjs");

// 已确认绑定为 Worker secret 的 key（wrangler secret list 核对过）
const HAS_SECRET = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "MAIL_HTTP_KEY",
];

// 纯构建/部署期使用，或当前为空值、线上不依赖兜底的 key
const BUILD_OR_UNUSED = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ZONE_ID",
  "DEEPSEEK_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID_FOUNDING_BUYER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "GOOGLE_SHEETS_REGISTER_WEBHOOK",
  // 🔴 Supabase Management API 个人访问令牌（可执行任意 SQL，含 DDL）。
  //    只在本地跑迁移脚本时用，**运行时 Worker 完全不需要它**。
  //    不清空 = 把「能改数据库结构」的令牌随 Worker 一起上传，必须清。
  "SUPABASE_ACCESS_TOKEN",
];

const SCRUB = new Set([...HAS_SECRET, ...BUILD_OR_UNUSED]);

if (!fs.existsSync(TARGET)) {
  console.error(`[scrub] 找不到 ${TARGET} —— 请先跑 opennextjs-cloudflare build`);
  process.exit(1);
}

const before = fs.readFileSync(TARGET, "utf8");
let cleared = 0;
const touched = [];

// 注意：next-env.mjs 会导出 production / development / test 三个对象
// （OpenNext 按 NODE_ENV 生成）。必须全部清理，否则 test 段会带着明文密钥上传。
const after = before.replace(
  /export const (\w+) = (\{.*?\});/gs,
  (match, mode, json) => {
    let obj;
    try {
      obj = JSON.parse(json);
    } catch {
      console.error(`[scrub] ${mode} 段 JSON 解析失败，已跳过（不改动）`);
      return match;
    }
    let hit = 0;
    for (const key of Object.keys(obj)) {
      if (SCRUB.has(key) && obj[key]) {
        obj[key] = "";
        cleared += 1;
        hit += 1;
      }
    }
    if (hit > 0) touched.push(`${mode}(${hit})`);
    return `export const ${mode} = ${JSON.stringify(obj)};`;
  },
);

if (cleared === 0) {
  console.log("[scrub] 没有需要清空的密钥（产物本来就是干净的）");
  process.exit(0);
}

fs.writeFileSync(TARGET, after);

// 自检：遍历所有导出对象，确认目标 key 已无残留非空值
const allExports = [...after.matchAll(/export const (\w+) = (\{.*?\});/gs)];
const stillLeaked = [];
for (const m of allExports) {
  const obj = JSON.parse(m[2]);
  for (const k of SCRUB) if (obj[k]) stillLeaked.push(`${m[1]}.${k}`);
}
if (stillLeaked.length > 0) {
  console.error(`[scrub] 自检失败，仍有残留：${stillLeaked.join(", ")}`);
  process.exit(1);
}

console.log(
  `[scrub] 已清空 ${cleared} 处密钥明文（${touched.join(", ")}），自检通过（覆盖全部 ${allExports.length} 个导出对象）`,
);
console.log(`[scrub] 提示：这些 key 必须已用 wrangler secret put 绑定，否则线上读不到值`);
console.log(`[scrub]   ${HAS_SECRET.join(", ")}`);
