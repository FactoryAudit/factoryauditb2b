// scripts/cs11-local-smoke.mjs —— CS-11 本地端到端烟雾（公开标准报告页 + 下载门禁）
//
// 前置：next build 完成后 `next start -p 3210`
// 用法：node scripts/cs11-local-smoke.mjs
//
// ⚠️ 会真的发出 1 封邮件（/api/lead → 管理员 + 客户回执，走 .env 的 MAIL_HTTP_* 生产通道）。
//    内容刻意标注 CS-11 SMOKE TEST，便于在邮箱里一眼识别、不被误当真实线索。
// ⚠️ /api/lead 限流 5 次/IP/小时，本脚本占 3 次；一小时内别连跑两轮。
//    限流计数是**进程内存**里的 Map（lib/rateLimit.ts），想连跑第二轮换端口起新进程即可
//    （CS11_BASE=http://localhost:3211）—— 不要为此放宽断言。

const BASE = process.env.CS11_BASE || "http://localhost:3210";

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? `  [${detail}]` : ""}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 复用已抓响应，避免重复打同一路由触发本地端口排队 */
const cache = new Map();
async function get(pathname) {
  if (!cache.has(pathname)) {
    if (cache.size) await sleep(70);
    const res = await fetch(`${BASE}${pathname}`);
    cache.set(pathname, { status: res.status, html: await res.text() });
  }
  return cache.get(pathname);
}

const SMOKE = "CS-11 SMOKE TEST — do not action";

// ---------------------------------------------------------------------------
console.log(`\n=== 1. 英文页 SSR（BASE=${BASE}） ===`);
const en = await get("/standard-report");
check("1a /standard-report 返回 200", en.status === 200, `status=${en.status}`);
check(
  "1b 13 个章节锚点全部渲染",
  Array.from({ length: 13 }, (_, i) => `id="s${String(i + 1).padStart(2, "0")}"`).every((a) =>
    en.html.includes(a)
  )
);
check("1c 样张声明显著（反伪造铁律）", en.html.includes("STANDARD SPECIMEN"));
check("1d 正文为英文（Executive summary）", en.html.includes("Executive summary"));
check("1e 免注册声明存在", en.html.includes("Free to read in full"));
check("1f 目录存在", en.html.includes('href="#s01"'));
check("1g 门禁三项必填字段渲染", ['id="std-name"', 'id="std-email"', 'id="std-company"'].every((s) => en.html.includes(s)));
check("1h 门禁 CTA 文案来自字典", en.html.includes("Get the report"));
// ⚠️ 不能拿「页面里有没有 Download report 这个字符串」判断门禁：
//    客户端组件的 props 会被序列化进 RSC payload，未解锁时该文案也在 HTML 里。
//    必须按**渲染出的 DOM 分支**判定 —— 两个分支各有一个专属 select id。
check("1i 🔴 未留资时渲染门禁分支（无下载按钮）", en.html.includes('id="std-form-lang"') && !en.html.includes('id="std-report-lang"'));
check("1j 页脚有 /standard-report 入口", en.html.includes('href="/standard-report"'));

// ---------------------------------------------------------------------------
console.log("\n=== 2. 中文页 SSR（本地化） ===");
const zh = await get("/zh/standard-report");
check("2a /zh/standard-report 返回 200", zh.status === 200, `status=${zh.status}`);
check("2b 正文切换为中文（执行摘要）", zh.html.includes("执行摘要"));
check("2c 中文页不渲染英文正文", !zh.html.includes("Executive summary"));
check("2d 中文免注册声明", zh.html.includes("全文免费阅读"));
check("2e 中文门禁文案", zh.html.includes("获取报告"));
check("2f 中文页脚入口", zh.html.includes('href="/zh/standard-report"'));

// ---------------------------------------------------------------------------
console.log("\n=== 3. 其余 7 语可访问（正文回落英文，页面框架本地化） ===");
for (const loc of ["zh-TW", "ja", "es", "de", "fr", "pt", "ar"]) {
  const r = await get(`/${loc}/standard-report`);
  check(`3.${loc} /${loc}/standard-report 返回 200`, r.status === 200, `status=${r.status}`);
}

// ---------------------------------------------------------------------------
console.log("\n=== 4. 可发现性 / 未回归 ===");
const sm = await get("/sitemap.xml");
check("4a sitemap.xml 收录 /standard-report", sm.html.includes("/standard-report"));
const llms = await get("/llms.txt");
check("4b llms.txt 收录 /standard-report", llms.html.includes("/standard-report"));
// CS-01 P1-8：/sample-report 已 308 到 /standard-report（原两页争夺同一批
//「supplier audit report sample」词）。断言语义由「仍 200」改写为
//「跟随重定向后确实落在标准报告页」——用页面自身的埋点标识判定，不看 URL。
const sample = await get("/sample-report");
check(
  "4c /sample-report 308 到 /standard-report",
  sample.status === 200 && sample.html.includes('data-track-page="standard_report"'),
  `status=${sample.status}`
);
const admin = await get("/admin/report-standard");
check("4d 🔴 /admin/report-standard 匿名仍 404（闸门未丢）", admin.status === 404, `status=${admin.status}`);

// ---------------------------------------------------------------------------
console.log("\n=== 5. 留资通道 /api/lead（会真实发 1 封邮件） ===");
const post = (body) =>
  fetch(`${BASE}/api/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const r1 = await post({
  lead: {
    tool: "standard-report-specimen",
    firstName: SMOKE,
    email: "cn18588770248@gmail.com",
    company: SMOKE,
    country: "Germany",
    sourcing: SMOKE,
    message: "Report language: en\nPage: /standard-report",
  },
});
const d1 = await r1.json().catch(() => ({}));
check("5a 留资提交返回 200/ok", r1.status === 200 && d1.ok === true, `status=${r1.status} body=${JSON.stringify(d1)}`);
check("5b 返回 leadId", typeof d1.leadId === "string" && d1.leadId.length > 20, JSON.stringify(d1));

await sleep(70);
const r2 = await post({ lead: { tool: "standard-report-specimen", email: "not-an-email" } });
const d2 = await r2.json().catch(() => ({}));
check("5c 非法邮箱被拒（400 invalid_email）", r2.status === 400 && d2.error === "invalid_email", `status=${r2.status} body=${JSON.stringify(d2)}`);

await sleep(70);
const r3 = await post({ lead: { tool: "standard-report-specimen" } });
const d3 = await r3.json().catch(() => ({}));
check("5d 缺邮箱被拒（400）", r3.status === 400, `status=${r3.status} body=${JSON.stringify(d3)}`);

// ---------------------------------------------------------------------------
console.log("\n============================================================");
if (fail === 0) {
  console.log(`CS-11 本地烟雾：${pass} PASS / 0 FAIL`);
} else {
  console.log(`CS-11 本地烟雾：${pass} PASS / ${fail} FAIL`);
}
console.log("============================================================");
process.exit(fail === 0 ? 0 : 1);
