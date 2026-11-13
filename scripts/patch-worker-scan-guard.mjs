// 构建后补丁：在 .open-next/worker.js 的 fetch 第一行插入扫描器拦截。
//
// 为什么必须打在生成产物上，而不是 middleware：
//   middleware.ts 的 matcher 是 "/((?!api|_next|.*\\..*).*)"，**排除了所有含 "." 的路径**。
//   而扫描器打的正是 /.env、/.env.bak、/wp-admin/install.php、/.git/config 这类带点路径，
//   它们绕过 middleware，直接落到 Next server 的 404 渲染 —— 每次冷 isolate 都要动态
//   import 整个 handler.mjs 并跑一遍 React 404，实测单次 3–60 秒。
//
// 为什么要早于 runWithCloudflareRequestContext：
//   这一步会建立 AsyncLocalStorage + 注入 env，属于每条请求的固定成本。放在它之前，
//   命中拦截时整个 Worker 只做一次正则匹配。
//
// 幂等：已打过的文件检测到 MARK 即跳过；锚点匹配数不等于 1 则**构建失败**（不静默放行）。
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";

const FILE = ".open-next/worker.js";
const MARK = "/* ── scan-guard:v1";

// ── 规则表 ────────────────────────────────────────────────────────────────
// 唯一真相源：注入代码与下方自测都从这里生成，避免两处漂移。
// 只匹配**不可能存在的真实路由**；/admin、/monitoring、/verify、/suppliers/* 等一律不碰。
const RULES = [
  // 点开头的路径段：/.env、/.env.bak、/laravel/.env、/.git/config、/.DS_Store
  // .well-known 显式放行（security.txt / ACME 验证要用）
  /\/\.(?!well-known(?:\/|$))[A-Za-z0-9_.-]+/i,
  // 任何 .php/.asp/.jsp/.cgi 结尾（本站为 Next.js，不存在这些入口）
  /\.(?:php|asp|aspx|jsp|jspx|cgi|pl)$/i,
  // 典型 CMS / 数据库管理 / 依赖目录
  /^\/(?:wp-[^/]*|wordpress|xmlrpc\.php|phpmyadmin|pma|myadmin|adminer|cgi-bin|vendor(?:\/|$))/i,
  // 运维面板与备份探测器
  /^\/(?:actuator|console|jenkins|solr|grafana|druid|swagger-ui|backup|backups|dump|dumps)(?:\/|$)/i,
  // 可下载的备份/日志类后缀
  /\.(?:sql|bak|old|swp|swo|tar|tgz|gz|zip|rar|7z|log)$/i,
];

// ── 自测：误杀真实页面比 1102 更糟，跑不过就不许构建 ──────────────────────
const CASES = [
  // 必须拦
  ["/.env", true],
  ["/.env.bak", true],
  ["/.env.production", true],
  ["/laravel/.env", true],
  ["/api/v2/.env", true],
  ["/.git/config", true],
  ["/.DS_Store", true],
  ["/wp-admin/install.php", true],
  ["/wp-login.php", true],
  ["/xmlrpc.php", true],
  ["/phpmyadmin/index.php", true],
  ["/file.php", true],
  ["/backup.zip", true],
  ["/db.sql", true],
  // 必须放行（真实路由 / 真实静态文件）
  ["/", false],
  ["/trust", false],
  ["/zh/trust", false],
  ["/ja/trust", false],
  ["/admin", false],
  ["/admin/suppliers/xiamen-jings-eyewear", false],
  ["/monitoring", false],
  ["/verify", false],
  ["/verify-supplier", false],
  ["/suppliers", false],
  ["/suppliers/koopchina", false],
  ["/rfq", false],
  ["/api/rfq", false],
  ["/guides/how-to-verify-a-chinese-supplier", false],
  ["/industrial-clusters/china/guangdong/foshan", false],
  ["/llms.txt", false],
  ["/robots.txt", false],
  ["/sitemap.xml", false],
  ["/favicon.svg", false],
  ["/favicon.ico", false],
  ["/og-image.png", false],
  ["/wechat-qr.png", false],
  ["/trust/team-at-sourcing-event.jpg", false],
  ["/.well-known/security.txt", false],
  ["/googlec100c619a30276cd.html", false],
  ["/_next/static/css/07e5f2253e1c2671.css", false],
];

let failed = 0;
for (const [p, want] of CASES) {
  const got = RULES.some((r) => r.test(p));
  if (got !== want) {
    console.error(`[scan-guard] ✗ 规则自测失败 ${p}  期望=${want ? "拦" : "放"}  实际=${got ? "拦" : "放"}`);
    failed++;
  }
}
if (failed) {
  console.error(`[scan-guard] ${failed} 条用例未通过，终止构建（不写入任何文件）`);
  process.exit(1);
}
console.log(`[scan-guard] ✓ 规则自测 ${CASES.length} 条全过`);

if (!existsSync(FILE)) {
  console.error(`[scan-guard] ✗ 找不到 ${FILE}，opennext build 没产出？`);
  process.exit(1);
}

const src = readFileSync(FILE, "utf8");

if (src.includes(MARK)) {
  console.log("[scan-guard] 已打过补丁，跳过");
  process.exit(0);
}

const RULES_SRC = RULES.map((r) => "    " + r.toString() + ",").join("\n");

const GUARD = `${MARK} ──────────────────────────────────────────
   扫描器探测拦截（2026-11-14 上线）。
   依据：3 小时内 185 次 1102，内存 P99 129.5MB（上限 128MB，全套餐固定），
   失败请求 CPU 仅 27ms ⇒ 内存超限而非 CPU；低并发档 0 错误、高并发档 180 错误，
   corr(请求数/分钟, 内存P99)=0.612。诱因是 /.env 变体 129 个 + /wp-* + *.php 探测：
   这些路径含 "."，被 middleware matcher 排除，直落 Next server 的 404 渲染，
   实测单次 3–60 秒，且 cache-control 为 private,no-store，边缘不缓存。
   本函数位于 fetch 第一行，早于 runWithCloudflareRequestContext 与
   import("./server-functions/default/handler.mjs")，命中即返回纯文本，不加载 Next。
   规则由 scripts/patch-worker-scan-guard.mjs 生成并自测，勿手改。
   ──────────────────────────────────────────────────────────────────────── */
const __SCAN_RULES = [
${RULES_SRC}
];
function __scanGuard(request) {
    try {
        const pathname = new URL(request.url).pathname;
        for (let i = 0; i < __SCAN_RULES.length; i++) {
            if (__SCAN_RULES[i].test(pathname)) {
                return new Response("Not Found", {
                    status: 404,
                    headers: {
                        "content-type": "text/plain; charset=utf-8",
                        "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
                        "x-robots-tag": "noindex",
                        "x-scan-guard": "1"
                    }
                });
            }
        }
        return null;
    }
    catch (_) {
        // 任何异常都放行：宁可多渲染一次，也不能把正常访客挡在门外
        return null;
    }
}
`;

// 锚点 1：helper 插在 export default 之前
const ANCHOR_EXPORT = "\nexport default {";
const countExport = src.split(ANCHOR_EXPORT).length - 1;
if (countExport !== 1) {
  console.error(`[scan-guard] ✗ 锚点 "export default {" 出现 ${countExport} 次（期望 1），OpenNext 产物结构已变，终止`);
  process.exit(1);
}

// 锚点 2：fetch 第一行
const ANCHOR_FETCH = `    async fetch(request, env, ctx) {
        return runWithCloudflareRequestContext(request, env, ctx, async () => {`;
const countFetch = src.split(ANCHOR_FETCH).length - 1;
if (countFetch !== 1) {
  console.error(`[scan-guard] ✗ fetch 锚点出现 ${countFetch} 次（期望 1），OpenNext 产物结构已变，终止`);
  process.exit(1);
}

const before = statSync(FILE).size;

let out = src.replace(
  ANCHOR_EXPORT,
  `\n${GUARD}export default {`
);
out = out.replace(
  ANCHOR_FETCH,
  `    async fetch(request, env, ctx) {
        const __blocked = __scanGuard(request);
        if (__blocked)
            return __blocked;
        return runWithCloudflareRequestContext(request, env, ctx, async () => {`
);

// 写回前的最后确认：两处都必须真的改到了
if (!out.includes("const __blocked = __scanGuard(request);")) {
  console.error("[scan-guard] ✗ 调用点未插入，终止");
  process.exit(1);
}
if (!out.includes("const __SCAN_RULES = [")) {
  console.error("[scan-guard] ✗ 规则表未插入，终止");
  process.exit(1);
}
if (out.length <= src.length) {
  console.error("[scan-guard] ✗ 产物未变长，终止");
  process.exit(1);
}

writeFileSync(FILE, out, "utf8");
const after = statSync(FILE).size;
console.log(`[scan-guard] ✓ 已注入 ${FILE}  ${before} → ${after} bytes (+${after - before})`);
