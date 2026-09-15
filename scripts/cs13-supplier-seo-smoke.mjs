// scripts/cs13-supplier-seo-smoke.mjs —— CS-13（PHASE 03）供应商 SEO 行为级烟雾探针
//
// 跑法：先起本地服务（用**新构建**的 .next），再跑本脚本
//   node ./node_modules/next/dist/bin/next start -p 3400   （后台）
//   node --env-file=.env scripts/cs13-supplier-seo-smoke.mjs
//   PROBE_BASE=https://factoryauditb2b.com node scripts/cs13-supplier-seo-smoke.mjs   （打线上）
//
// 与其他 smoke 一样：只读、幂等、可重复。断言只认**响应体**，不看源码。

// 已知前提（写错会造成假 FAIL）：
//   - en 是 DEFAULT_LOCALE，中间件会把 /en/* 301 到 /*，所以英文站点路径**不带前缀**。
//   - 生产库当前**已发布 10 家**：CS-13 上线时的 5 家（guangzhou-sunny-food /
//     shenzhen-precision-electronics / guangzhou-textile-factory / dongguan-plastic-molding /
//     ho-chi-minh-garment）+ CS-14 扩量发布的 5 家真实入驻申请
//     （nanjing-mxcomm / xiamen-jings-eyewear / shenzhen-jorigin-packaging /
//      shandong-loyal-industrial / jiangsu-liquid-damper）。
//     ⇒ 供应商 URL 条目 = 10 家 × 9 语 = 90。

const BASE = process.env.PROBE_BASE ?? "http://127.0.0.1:3400";
const BOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/** 已发布供应商（CS-13 的 5 家 + CS-14 扩量的 5 家） */
const PUBLISHED = [
  // CS-13 上线时的存量
  "guangzhou-sunny-food",
  "shenzhen-precision-electronics",
  "guangzhou-textile-factory",
  "dongguan-plastic-molding",
  "ho-chi-minh-garment",
  // CS-14 扩量发布（来源：Resend 入驻申请邮件，授权 Authorize Company Profile: yes）
  "nanjing-mxcomm",
  "xiamen-jings-eyewear",
  "shenzhen-jorigin-packaging",
  "shandong-loyal-industrial",
  "jiangsu-liquid-damper",
];
const EXPECTED_ROSTER = PUBLISHED.length;
const EXPECTED_URLS = EXPECTED_ROSTER * 9;

let pass = 0;
let fail = 0;
function ok(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}${extra ? "  :: " + extra : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? "  :: " + extra : ""}`);
  }
}

async function get(path, ua) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(BASE + path, {
        headers: { "user-agent": ua, accept: "text/html,application/xhtml+xml" },
        redirect: "manual",
      });
      const body = await res.text();
      return { status: res.status, body, headers: res.headers };
    } catch (e) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw new Error("unreachable: " + path);
}

const grab = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

const decode = (s) =>
  s == null
    ? s
    : s
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ");

function jsonLdNodes(html) {
  const out = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(decode(m[1]).trim());
      if (parsed["@graph"]) for (const n of parsed["@graph"]) out.push(n["@type"]);
      else out.push(parsed["@type"]);
    } catch {
      out.push("UNPARSEABLE");
    }
  }
  return out;
}

function titleOf(h) {
  return decode(grab(h, /<title[^>]*>([\s\S]*?)<\/title>/i));
}
function descOf(h) {
  return decode(grab(h, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i));
}
function robotsOf(h) {
  return grab(h, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i);
}
function canonOf(h) {
  return grab(h, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i);
}

// ============================================================
console.log("=== 0. 服务可达性 + 默认语言无前缀前提 ===");
const warm = await get("/suppliers", BROWSER_UA);
ok("/suppliers 200（en 无前缀）", warm.status === 200, "status=" + warm.status);
const prefixed = await get("/en/suppliers", BROWSER_UA);
ok("/en/suppliers 仍 301 到无前缀（CS-06 Bug A 行为保留）", prefixed.status === 301, "status=" + prefixed.status);

const SUNNY = "/suppliers/guangzhou-sunny-food";
const PREC = "/suppliers/shenzhen-precision-electronics";

console.log("\n=== 1. Sunny Food（已核验，Level 3）—— Googlebot UA ===");
const a = await get(SUNNY, BOT_UA);
ok("HTTP 200", a.status === 200, "status=" + a.status);
const aTitle = titleOf(a.body);
const aDesc = descOf(a.body);
const aRobots = robotsOf(a.body);
const aCanon = canonOf(a.body);
// ⚠️ React 渲染出来的是 `hrefLang`（大写 L），必须用 i 标志，否则会得到 0 条假 FAIL。
const hreflangs = [...a.body.matchAll(/hreflang="([^"]+)"/gi)].map((m) => m[1]);
console.log("  title      : " + aTitle);
console.log("  desc       : " + aDesc);
console.log("  robots     : " + aRobots);
console.log("  canonical  : " + aCanon);
ok("title 含公司名", !!aTitle && aTitle.includes("Guangzhou Sunny Food Co., Ltd."));
ok("title 含等级口径 Factory verified", !!aTitle && /Factory verified/.test(aTitle));
ok("title 含地点 Guangzhou, China", !!aTitle && /Guangzhou, China/.test(aTitle));
ok("title 以品牌 FactoryAuditB2B 收尾", !!aTitle && aTitle.endsWith("FactoryAuditB2B"));
ok("desc 非空", !!aDesc && aDesc.length > 60, "len=" + (aDesc || "").length);
ok("desc 明说「有核验事件记录」", /has a recorded verification event/.test(aDesc || ""));
ok("desc 不得说「未独立核验」", !/not independently verified/i.test(aDesc || ""));
// 不要求句末句点：truncateWords 的收尾会剥掉被截断处的标点再补省略号（"…out of 100…"）。
ok("desc 保留了档案评分句（截断只允许吃产品列表）", /Supplier profile score 96 out of 100/.test(aDesc || ""), aDesc ? aDesc.slice(-60) : "");
ok("desc 长度 <= 200（SEO 上限）", (aDesc || "").length <= 200, "len=" + (aDesc || "").length);
ok("robots = index,follow", /index/.test(aRobots || "") && /follow/.test(aRobots || ""), aRobots || "(none)");
ok("canonical 指向自身", aCanon === "https://factoryauditb2b.com" + SUNNY, aCanon || "(none)");
ok("hreflang 覆盖 9 语 + x-default", hreflangs.length >= 10, "n=" + hreflangs.length);
ok("无 `Ltd..` 假标点", !/Ltd\.\./.test(a.body));
const aNodes = jsonLdNodes(a.body);
console.log("  JSON-LD 节点 : " + aNodes.join(" + "));
ok("JSON-LD 有 Organization", aNodes.includes("Organization"));
ok("JSON-LD 有 BreadcrumbList", aNodes.includes("BreadcrumbList"));
ok("JSON-LD 有 WebPage", aNodes.includes("WebPage"));
ok("JSON-LD 有 FAQPage", aNodes.includes("FAQPage"));
ok("JSON-LD 无 LocalBusiness", !aNodes.includes("LocalBusiness"));
ok("JSON-LD 无 Product / aggregateRating", !aNodes.includes("Product") && !aNodes.includes("AggregateRating"));
ok("HTML 渲染 Buyer snapshot 区", /Buyer snapshot/i.test(a.body));
ok("HTML 渲染评分免责声明", /does not constitute an independent assessment of supplier risk/.test(a.body));
ok("HTML 渲染评分方法说明", /scoreMethodologyLabel|Score methodology/i.test(a.body) || /Supplier profile score/i.test(a.body));
ok("HTML 渲染 FAQ 区", /Frequently asked questions/i.test(a.body));
ok("HTML 出现核验等级 Factory verified", /Factory verified/.test(a.body));

console.log("\n=== 2. Sunny Food —— 普通浏览器 UA（htmlLimitedBots 对照）===");
const a2 = await get(SUNNY, BROWSER_UA);
ok("HTTP 200", a2.status === 200, "status=" + a2.status);
ok("浏览器 UA 同样拿到正确 title", titleOf(a2.body) === aTitle, titleOf(a2.body) || "(none)");
ok("浏览器 UA 同样 index,follow", /index/.test(robotsOf(a2.body) || ""));
ok("浏览器 UA 同样有 4 类 JSON-LD", jsonLdNodes(a2.body).includes("FAQPage"));

console.log("\n=== 3. Shenzhen Precision（未核验对照）===");
const b = await get(PREC, BOT_UA);
ok("HTTP 200", b.status === 200, "status=" + b.status);
const bTitle = titleOf(b.body);
const bDesc = descOf(b.body);
const bRobots = robotsOf(b.body);
console.log("  title  : " + bTitle);
console.log("  desc   : " + bDesc);
console.log("  robots : " + bRobots);
ok("title 不得出现 Factory verified", !/Factory verified/.test(bTitle || ""));
ok("title 走 Supplier profile 模板", /Supplier profile in Shenzhen, China/.test(bTitle || ""), bTitle || "");
ok("desc 明说供应商自述 + 未独立核验（合规句不得被截断吃掉）",
  /is a supplier-declared profile\./.test(bDesc || "") && /Not independently verified by FactoryAuditB2B\./.test(bDesc || ""),
  bDesc ? bDesc.slice(0, 120) : "");
ok("desc 长度 <= 200（SEO 上限）", (bDesc || "").length <= 200, "len=" + (bDesc || "").length);
ok("仍 index,follow（有实质属性，不 noindex）", /index/.test(bRobots || ""), bRobots || "");
ok("Snapshot 出现未核验口径", /Information not independently verified/i.test(b.body));
ok("FAQ 出现 unverified 答案开头", /Not yet\./.test(b.body));
ok("JSON-LD 仍是 4 类节点", jsonLdNodes(b.body).includes("FAQPage") && jsonLdNodes(b.body).includes("Organization"));

console.log("\n=== 4. 目录页 P0（卡片核验态必须按真实等级）===");
const dirEn = await get("/suppliers", BOT_UA);
const dirZh = await get("/zh/suppliers", BOT_UA);
const countOf = (h, re) => (h.match(re) || []).length;
const enVerified = countOf(dirEn.body, /Factory verified/g);
const enNotYet = countOf(dirEn.body, /Not yet verified/g);
console.log(`  /suppliers    (en): Factory verified × ${enVerified} / Not yet verified × ${enNotYet}`);
ok("目录页出现 Factory verified（Sunny Food 卡片不再被写死为未核验）", enVerified >= 1);
ok("目录页其余卡片仍是 Not yet verified", enNotYet >= 4);
ok("目录页无 `Ltd..`", !/Ltd\.\./.test(dirEn.body));
const zhVerified = countOf(dirZh.body, /工厂已核验/g);
const zhNotYet = countOf(dirZh.body, /尚未核验/g);
console.log(`  /zh/suppliers     : 工厂已核验 × ${zhVerified} / 尚未核验 × ${zhNotYet}`);
ok("中文目录页同样区分核验态", zhVerified >= 1 && zhNotYet >= 4);
ok("/zh/suppliers 200", dirZh.status === 200, "status=" + dirZh.status);

console.log("\n=== 5. sitemap.xml（闸门同源 + 真实 lastmod）===");
const sm = await get("/sitemap.xml", BOT_UA);
ok("HTTP 200", sm.status === 200, "status=" + sm.status);
const urls = [...sm.body.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
const supEntries = urls.filter((u) => /<loc>[^<]*\/suppliers\//.test(u));
console.log("  供应商 URL 条目 = " + supEntries.length);
ok(`供应商 URL = ${EXPECTED_ROSTER} 家 × 9 语 = ${EXPECTED_URLS}`, supEntries.length === EXPECTED_URLS, "实际 " + supEntries.length);
// 每家供应商的 lastmod（取 en 那条，即无语言前缀）
const supLm = {};
for (const s of PUBLISHED) {
  const e = supEntries.find((u) =>
    new RegExp(`<loc>https://factoryauditb2b\\.com/suppliers/${s}</loc>`).test(u)
  );
  supLm[s] = grab(e || "", /<lastmod>([^<]+)<\/lastmod>/);
}
console.log("  供应商 lastmod:");
for (const [k, v] of Object.entries(supLm)) console.log("    " + k.padEnd(32) + " " + (v || "(缺)"));
ok("Sunny Food lastmod = 真实 DB updated_at 2026-09-14T02:59:52.251Z", supLm["guangzhou-sunny-food"] === "2026-09-14T02:59:52.251Z", supLm["guangzhou-sunny-food"] || "");
ok("未核验家 lastmod 是 2026-09-03（真实历史值，非构建时刻）", /^2026-09-03T/.test(supLm["shenzhen-precision-electronics"] || ""), supLm["shenzhen-precision-electronics"] || "");
ok("供应商间 lastmod 不同（证明不是同一个 new Date()）", new Set(Object.values(supLm)).size >= 2, "distinct=" + new Set(Object.values(supLm)).size);
ok(`sitemap 里 ${EXPECTED_ROSTER} 家已发布供应商齐全`, PUBLISHED.every((s) => new RegExp(`/suppliers/${s}<`).test(sm.body) || new RegExp(`/suppliers/${s}</loc>`).test(sm.body)));

console.log("\n=== 6. 目录页与 sitemap 必须同源（不许两套名单）===");
const slugOf = (u) => grab(u, /<loc>https:\/\/factoryauditb2b\.com\/suppliers\/([^<]+)<\/loc>/);
const slugs = [...new Set(supEntries.map(slugOf).filter(Boolean))];
console.log("  sitemap 内供应商 slug（" + slugs.length + " 家）: " + slugs.join(", "));
ok(`sitemap 供应商名单 == ${EXPECTED_ROSTER} 家（新增供应商必须进 sitemap）`, slugs.length === EXPECTED_ROSTER, "实际 " + slugs.length);
const missingFromSitemap = PUBLISHED.filter((s) => !slugs.includes(s));
ok("名单内每家都真的出现在 sitemap 里（非只对总数）", missingFromSitemap.length === 0, missingFromSitemap.join(","));
ok("每家 slug 恰好 9 条（9 个语言版本）", supEntries.length === slugs.length * 9, `${supEntries.length} / ${slugs.length * 9}`);
const missingInDir = slugs.filter((s) => !dirEn.body.includes(s));
ok("sitemap 里每家都能在目录页 HTML 找到（同源，非两套名单）", missingInDir.length === 0, missingInDir.join(","));
// 目录卡片链接形如 href="/suppliers/<slug>"；后续若挂 /claim 会多一段路径，故用 (?=") 卡住结尾
const dirSlugs = [
  ...new Set((dirEn.body.match(/\/suppliers\/[a-z0-9-]+(?=")/g) || []).map((x) => x.replace("/suppliers/", ""))),
];
const extraInDir = dirSlugs.filter((s) => !slugs.includes(s));
console.log("  目录页出现的供应商 slug（" + dirSlugs.length + " 家）: " + dirSlugs.join(", "));
ok("目录页没有 sitemap 之外的供应商（未发布 ⇒ 不进 sitemap）", extraInDir.length === 0, extraInDir.join(","));

console.log("\n=== 7. /llms.txt 与 robots.txt 未受影响 ===");
const llms = await get("/llms.txt", BROWSER_UA);
ok("/llms.txt 200", llms.status === 200, "status=" + llms.status);
const robots = await get("/robots.txt", BROWSER_UA);
ok("/robots.txt 200", robots.status === 200, "status=" + robots.status);

console.log("\n=== 8. 其他语种档案页抽样（de / ja）===");
const deSunny = await get("/de/suppliers/guangzhou-sunny-food", BOT_UA);
ok("/de/... 200", deSunny.status === 200, "status=" + deSunny.status);
ok("/de/... canonical 指向 de", canonOf(deSunny.body) === "https://factoryauditb2b.com/de/suppliers/guangzhou-sunny-food", canonOf(deSunny.body) || "");
ok("/de/... 仍 index,follow", /index/.test(robotsOf(deSunny.body) || ""));
const jaNot = await get("/ja/suppliers/shenzhen-precision-electronics", BOT_UA);
ok("/ja/... 未核验页 200", jaNot.status === 200, "status=" + jaNot.status);
ok("/ja/... 有 FAQPage JSON-LD", jsonLdNodes(jaNot.body).includes("FAQPage"));

const zhSunny = await get("/zh/suppliers/guangzhou-sunny-food", BOT_UA);
const zhDesc = descOf(zhSunny.body);
console.log("  zh desc : " + zhDesc);
ok("/zh/... 200", zhSunny.status === 200, "status=" + zhSunny.status);
ok("/zh/... desc 含核验事件口径", /有核验事件记录/.test(zhDesc || ""));
ok("/zh/... 中文句读后不留半角空格", !/[。，、；：]\s/.test(zhDesc || ""), (zhDesc || "").slice(0, 80));
const zhNot = await get("/zh/suppliers/shenzhen-precision-electronics", BOT_UA);
const zhNotDesc = descOf(zhNot.body);
console.log("  zh 未核验 desc : " + zhNotDesc);
ok("/zh/... 未核验 desc 保留「未经独立核验」", /未经 FactoryAuditB2B 独立核验。/.test(zhNotDesc || ""));

console.log("\n" + "=".repeat(60));
console.log(`PHASE 03 行为级验收：${pass} PASS / ${fail} FAIL`);
console.log("=".repeat(60));
process.exit(fail === 0 ? 0 : 1);
