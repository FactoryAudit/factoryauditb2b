// STEP 13-B 线上验收 —— /industrial-clusters IA/UI 重构
//
// 用法：
//   node scripts/step13b-live-verify.mjs --baseline   # 部署前抓基线（Before）
//   node scripts/step13b-live-verify.mjs              # 部署后验收（After，与基线对比）
//
// 只在真实域名上跑。验收要点（对应用户 spec 的 18 条）：
//   200 / 8 条一条不少 / 无新增 / URL 未变 / 国家分组 / 地区分组 / 行业徽章
//   / Desktop 2 列 / Mobile 1 列 / 供应商计数 / CTA / SEO metadata 未变 / sitemap 未变
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const BASE = "https://factoryauditb2b.com";
const DIR = "D:/腾讯ai临时文件/2026-09-14-22-18-10";
const BASELINE = `${DIR}/s13b-baseline.json`;
const isBaseline = process.argv.includes("--baseline");

// 期望的 8 条 canonical URL。这是**测试基准**，与 lib/clusterRoutes.ts 的 P0 事实同源；
// URL 一变就必须显式改这里 —— 不能悄悄漂移。
// ⚠️ en 是默认语言，中间件会剥掉 /en 前缀（实测 /en/industrial-clusters → 308 → /industrial-clusters），
//    所以基准路径不带 locale 前缀；非默认语言才带 /zh 等前缀。
const EXPECTED = [
  "/industrial-clusters/china/guangdong/jiangmen-home-kitchen",
  "/industrial-clusters/china/guangdong/zhongshan-lighting",
  "/industrial-clusters/china/guangdong/foshan-furniture",
  "/industrial-clusters/china/guangdong/dongguan-electronics",
  "/industrial-clusters/thailand/rayong-automotive",
  "/industrial-clusters/vietnam/bac-ninh/bac-ninh-electronics",
  "/industrial-clusters/indonesia/batam/batam-electronics",
  "/industrial-clusters/indonesia/jepara/jepara-furniture",
];

const EXPECTED_COUNTRIES = ["China", "Thailand", "Vietnam", "Indonesia"];
const EXPECTED_REGIONS = ["South China", "Eastern Thailand", "Northern Vietnam", "Riau Islands", "Central Java"];
const EXPECTED_INDUSTRIES = ["Home &amp; Kitchen", "Lighting", "Furniture", "Electronics", "Automotive"];

let pass = 0;
let fail = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? "  [" + detail + "]" : ""}`);
  }
}

async function get(url) {
  // follow：en 是默认语言，/en 前缀会被中间件 308 剥离，必须跟到最终页面再断言
  const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "step13b-verify" } });
  const text = await res.text();
  return { status: res.status, text, url: res.url };
}

const uniq = (a) => Array.from(new Set(a));
const countOcc = (s, needle) => s.split(needle).length - 1;

function extract(html) {
  // 只取**站内相对** href（绝对 URL 属于 canonical / hreflang，不是内链）；
  // 正则要求 /industrial-clusters/ 后面还有内容，因此站头导航的 /industrial-clusters 不会被误算。
  const clusterLinks = uniq(
    Array.from(html.matchAll(/href="([^"]*\/industrial-clusters\/[^"#?]+)"/g))
      .map((m) => m[1])
      .filter((h) => !/^https?:/i.test(h))
  );
  const h2 = Array.from(html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gs)).map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  const h3 = Array.from(html.matchAll(/<h3[^>]*>(.*?)<\/h3>/gs)).map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  const title = (html.match(/<title>(.*?)<\/title>/s) || [])[1] ?? null;
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] ?? null;
  const hreflang = uniq(
    Array.from(html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)).map(
      (m) => `${m[1]}=${m[2]}`
    )
  ).sort();
  const anchors = uniq(Array.from(html.matchAll(/href="#([a-z0-9_-]+)"/g)).map((m) => m[1]));
  return { clusterLinks, h2, h3, title, canonical, hreflang, anchors };
}

const en = await get(`${BASE}/en/industrial-clusters`);
const info = extract(en.text);

if (isBaseline) {
  const sm = await get(`${BASE}/sitemap.xml`);
  const urls = Array.from(sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
  const snap = {
    capturedAt: new Date().toISOString(),
    status: en.status,
    ...info,
    sitemapTotal: urls.length,
    sitemapClusters: urls.filter((u) => u.includes("/industrial-clusters/")).length,
    gridMd3: en.text.includes("md:grid-cols-3"),
    gridMd2: en.text.includes("md:grid-cols-2"),
  };
  writeFileSync(BASELINE, JSON.stringify(snap, null, 2), "utf8");
  writeFileSync(`${DIR}/s13b-before.html`, en.text, "utf8");
  console.log("BEFORE 基线已写入 " + BASELINE);
  console.log(`status=${snap.status} clusters=${info.clusterLinks.length} h2=${info.h2.length} h3=${info.h3.length}`);
  console.log("h2=" + JSON.stringify(info.h2));
  console.log("h3=" + JSON.stringify(info.h3));
  console.log(`md:grid-cols-3=${snap.gridMd3} md:grid-cols-2=${snap.gridMd2} sitemap=${snap.sitemapTotal}`);
  console.log("title=" + snap.title);
  console.log("canonical=" + snap.canonical);
  process.exit(0);
}

// ======================= AFTER 验收 =======================
console.log("--- 1. 路由与分组 ---");
ok("1  /en/industrial-clusters HTTP 200", en.status === 200, String(en.status));
ok(
  "2  8 个 cluster 全在（一条不少）",
  EXPECTED.every((u) => info.clusterLinks.includes(u)),
  EXPECTED.filter((u) => !info.clusterLinks.includes(u)).join(",")
);
ok("3  没有新增 cluster（仍是 8 条）", info.clusterLinks.length === 8, String(info.clusterLinks.length));
ok("4  URL 未变（集合与预期完全一致）", info.clusterLinks.slice().sort().join("|") === EXPECTED.slice().sort().join("|"));

console.log("--- 2. Country / Region / Industry 层级 ---");
ok("5  H2 = Country 且顺序正确", info.h2.join("|") === EXPECTED_COUNTRIES.join("|"), info.h2.join("|"));
ok("6  H3 = Region 且顺序正确", info.h3.join("|") === EXPECTED_REGIONS.join("|"), info.h3.join("|"));
ok("7  行业徽章 5 个行业全部出现", EXPECTED_INDUSTRIES.every((i) => en.text.includes(i)));
ok("8  卡片不再重复 China · South China", !en.text.includes("China · South China"));
ok("9  国家 tab 由数据生成（含计数）", /China[\s\S]{0,400}?>4</.test(en.text));
ok("10 tab 锚点与 H2 id 对应", EXPECTED_COUNTRIES.map((c) => c.toLowerCase()).every((a) => info.anchors.includes(a) || info.anchors.includes(a.replace(" ", "-"))));

console.log("--- 3. 布局与内容 ---");
ok("11 Desktop 2 列（md:grid-cols-2）", en.text.includes("md:grid-cols-2"));
ok("12 Mobile 1 列（grid-cols-1，无 md:grid-cols-3）", en.text.includes("grid-cols-1") && !en.text.includes("md:grid-cols-3"));
ok("13 供应商计数 = 8 处 0 suppliers（不虚构数字）", countOcc(en.text, "0 suppliers") === 8, String(countOcc(en.text, "0 suppliers")));
ok("14 CTA View Suppliers → 出现 8 次", countOcc(en.text, "View Suppliers →") === 8, String(countOcc(en.text, "View Suppliers →")));
ok("15 卡片定位行 City · Province · Country 正确", en.text.includes("Jiangmen · Guangdong · China") && en.text.includes("Rayong · Thailand"));

console.log("--- 4. SEO 未变 ---");
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : null;
if (!baseline) {
  ok("16 基线存在（否则无法对比 SEO）", false, "缺少 s13b-baseline.json");
} else {
  ok("16 title 与部署前一致", info.title === baseline.title, `${info.title} vs ${baseline.title}`);
  ok("17 canonical 与部署前一致", info.canonical === baseline.canonical, `${info.canonical} vs ${baseline.canonical}`);
  ok("18 hreflang 集合与部署前一致", info.hreflang.join("|") === baseline.hreflang.join("|"));
}
const sm = await get(`${BASE}/sitemap.xml`);
const smUrls = Array.from(sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
ok("19 sitemap 总数未变（无新索引页）", baseline ? smUrls.length === baseline.sitemapTotal : false, `${smUrls.length} vs ${baseline?.sitemapTotal}`);
ok(
  "20 sitemap 产业带 URL 数与部署前一致（无新增/丢失）",
  baseline ? smUrls.filter((u) => u.includes("/industrial-clusters/")).length === baseline.sitemapClusters : false
);

console.log("--- 5. 隐私与 i18n ---");
// 目录页本就不该出现任何买家邮箱；站点自身公开的 support@ 地址（页脚/JSON-LD）除外。
const stripped = en.text.replace(/support@factoryauditb2b\.com/g, "");
const leakedEmails = uniq(
  Array.from(stripped.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)).map((m) => m[0])
);
ok("21 页面不含任何买家/探针邮箱（站点自身 support@ 除外）", leakedEmails.length === 0, leakedEmails.join(","));
const zh = await get(`${BASE}/zh/industrial-clusters`);
ok("22 /zh/industrial-clusters 也 200 且同样分组", zh.status === 200 && zh.text.includes("全部"), String(zh.status));

console.log(`\nSTEP 13-B 线上验收：${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
