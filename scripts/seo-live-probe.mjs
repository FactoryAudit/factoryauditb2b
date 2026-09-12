// 线上 SEO 抽样探针（只读）
//
// 用途：为「全站 SEO 地图」提供**证据**，而不是推断。
//   对每个样本 URL 采集：HTTP 状态、最终 URL、canonical、robots meta、
//   hreflang 变体数、Cache-Control、x-nextjs-cache（判断 SSG/SSR）。
//
// 纪律（本项目铁律）：
//   · 多请求必须节流 + 秒级指数退避（Cloudflare 边缘偶发 503，400ms 级退避扛不住）
//   · 判定前先归一化 HTML 实体（&#x27; vs '），否则假 PASS
//   · 关闭重定向时单独看 3xx 的 Location
//
// 用法：node scripts/seo-live-probe.mjs
const BASE = "https://factoryauditb2b.com";

const SAMPLES = [
  "/",
  "/zh",
  "/suppliers",
  "/zh/suppliers",
  "/zh/suppliers/guangzhou-sunny-food",
  "/standard-report",
  "/sample-report",
  "/membership",
  "/pricing",
  "/register",
  "/login",
  "/account",
  "/admin",
  "/tools",
  "/tools/supplier-risk-calculator",
  "/tools/supplier-risk-assessment",
  "/tools/supplier-verification-checklist",
  "/tools/compare",
  "/services/supplier-verification",
  "/services/china-supplier-verification",
  "/countries",
  "/countries/china",
  "/industry/toys",
  "/guides/factory-audit-checklist",
  "/guides/supplier-risk-assessment-guide",
  "/case-studies",
  "/field-reports",
  "/audit-guide/china/BSCI",
  "/zh/audit-guide/china/BSCI",
  "/methodology",
  "/trust",
  "/resources",
  "/about",
  "/ar",
  "/ar/membership",
  // 旧路径（应 308）
  "/knowledge",
  "/inspectors",
  "/country/china",
  "/supplier/china/guangzhou-sunny-food",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** HTML 实体归一化：不归一化会把 &#x27; 与 ' 判成不同 ⇒ 假 PASS/假 FAIL */
function norm(html) {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function get(url, redirect) {
  const ATTEMPTS = 5;
  for (let i = 0; i < ATTEMPTS; i++) {
    if (i > 0) await sleep(1000 * Math.pow(2, i - 1)); // 1s/2s/4s/8s
    try {
      const res = await fetch(url, { redirect, headers: { "user-agent": "Mozilla/5.0 SEOProbe" } });
      if (res.status === 429 || res.status >= 500) continue;
      return res;
    } catch {
      /* 重试 */
    }
  }
  return null;
}

const rows = [];
for (const p of SAMPLES) {
  const url = BASE + p;
  const res = await get(url, "manual");
  await sleep(180);
  if (!res) {
    rows.push({ p, status: "CRASH" });
    continue;
  }
  const status = res.status;
  const loc = res.headers.get("location") || "";
  let canonical = "";
  let robots = "";
  let hreflang = 0;
  let title = "";
  if (status === 200) {
    const html = norm(await res.text());
    canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) ?? [])[1] ?? "";
    robots = (html.match(/<meta[^>]+name="robots"[^>]+content="([^"]*)"/) ?? [])[1] ?? "";
    hreflang = (html.match(/hreflang=/g) ?? []).length;
    title = (html.match(/<title[^>]*>([^<]*)</) ?? [])[1] ?? "";
  }
  rows.push({
    p,
    status,
    loc: loc.replace(BASE, ""),
    canonical: canonical.replace(BASE, ""),
    robots,
    hreflang,
    title: title.slice(0, 70),
    cache: res.headers.get("cache-control") || "",
    njs: res.headers.get("x-nextjs-cache") || "",
    cfc: res.headers.get("cf-cache-status") || "",
  });
}

// ---------- 输出 ----------
for (const r of rows) {
  if (r.status !== 200) {
    console.log(`\n${r.p}`);
    console.log(`   status=${r.status}${r.loc ? "  -> " + r.loc : ""}`);
    continue;
  }
  const selfCanon = r.canonical === r.p || r.canonical === "" ? "" : "  🔴 canonical≠自身";
  console.log(`\n${r.p}`);
  console.log(`   status=200  hreflang=${r.hreflang}  cache="${r.cache}"  nextjs-cache=${r.njs || "-"}  cf=${r.cfc || "-"}`);
  console.log(`   canonical=${r.canonical}${selfCanon}`);
  if (r.robots) console.log(`   robots meta = ${r.robots}`);
  console.log(`   title = ${r.title}`);
}
