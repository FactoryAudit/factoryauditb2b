// scripts/s18-live-verify.mjs —— stage1.8 线上验收（只读，fail 退出码 1）
//
// 覆盖四项验收中无法离线完成的：
//   · 线上 TTFB（主口径 x-opennext-cache: HIT，辅口径降幅）
//   · 5 组 searchParams 组合返回 200、无 5xx
//   · 过滤态 robots：响应头 X-Robots-Tag: noindex, follow（D3 关键）
//   · 线上 HTML 的供应商卡片数与本地预渲染产物一致（证明部署的就是静态产物）
//
// 用法（必须走代理 preload，本机直连 CF 不可靠）：
//   FAB2B_PROXY=http://127.0.0.1:7897 \
//   NODE_OPTIONS="--require F:/AI-验厂SEO网站/scripts/with-proxy.cjs" \
//   node scripts/s18-live-verify.mjs

import fs from "node:fs";
import path from "node:path";

const BASE = "https://factoryauditb2b.com";
const ROOT = process.cwd();

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function section(t) {
  console.log(`\n=== ${t} ===`);
}

async function probe(p) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${p}`, {
    redirect: "follow",
    headers: { "user-agent": "FactoryAuditB2B-stage1.8-verify/1.0" },
  });
  const ttfb = Date.now() - t0;
  const html = await res.text();
  return {
    status: res.status,
    ttfb,
    html,
    robots: res.headers.get("x-robots-tag"),
    cache: res.headers.get("x-opennext-cache"),
    cacheControl: res.headers.get("cache-control"),
    prerender: res.headers.get("x-nextjs-prerender"),
  };
}

const localCards = (() => {
  const f = path.join(ROOT, ".next", "server", "app", "en", "suppliers.html");
  if (!fs.existsSync(f)) return null;
  // 只数「供应商卡」（FAQ 用 `card p-5`，无 hover:border，不能计入）
  return (fs.readFileSync(f, "utf8").match(/class="card p-5 hover:border/g) ?? []).length;
})();

// ── 1. 过滤态 robots（D3 关键）───────────────────────────────────────────────
section("1. 过滤态 robots（X-Robots-Tag）");
const ROBOT_CASES = [
  { p: "/suppliers", filtered: false },
  { p: "/suppliers?country=china", filtered: true },
  { p: "/suppliers?q=furniture", filtered: true },
  { p: "/suppliers?country=china&industry=FURNITURE&q=wood", filtered: true },
  { p: "/es/suppliers?country=china", filtered: true },
];

const probeCache = {};
for (const c of ROBOT_CASES) {
  let r;
  try {
    r = await probe(c.p);
  } catch (e) {
    check(`1 [${c.p}] 可访问`, false, String(e && e.message));
    continue;
  }
  probeCache[c.p] = r;
  const tag = (r.robots || "").toLowerCase();
  if (c.filtered) {
    check(
      `1 [${c.p}] X-Robots-Tag = noindex, follow`,
      tag.includes("noindex") && tag.includes("follow"),
      `实际 "${r.robots}"`
    );
  } else {
    check(
      `1 [${c.p}] 无 X-Robots-Tag（或为 index, follow）`,
      !tag || (tag.includes("index") && !tag.includes("noindex")),
      `实际 "${r.robots}"`
    );
  }
}

// ── 2. 状态码 / 无 5xx ──────────────────────────────────────────────────────
section("2. searchParams 组合状态码");
const COMBO = [
  "/suppliers",
  "/suppliers?country=china",
  "/suppliers?q=furniture",
  "/suppliers?country=china&industry=FURNITURE&q=wood",
  "/suppliers?country=nope&industry=NOPE&q=zzz",
];
for (const p of COMBO) {
  const r = probeCache[p] ?? (await probe(p).catch(() => null));
  check(`2 [${p}] 200（非 5xx）`, Boolean(r) && r.status === 200, r ? `status=${r.status}` : "请求失败");
}

// ── 3. TTFB / 静态命中 ─────────────────────────────────────────────────────
section("3. TTFB 与静态命中");
for (const p of ["/suppliers", "/industrial-clusters", "/suppliers/guangzhou-sunny-food"]) {
  const samples = [];
  let last = null;
  for (let i = 0; i < 3; i++) {
    const r = await probe(p).catch(() => null);
    if (r) {
      samples.push(r.ttfb);
      last = r;
    }
  }
  const min = Math.min(...samples);
  console.log(
    `  · ${p.padEnd(34)} TTFB ${samples.map((s) => s + "ms").join(" / ")} | cache=${last?.cache ?? "-"} | cc=${last?.cacheControl ?? "-"}`
  );
  if (p === "/suppliers" || p === "/industrial-clusters") {
    check(
      `3 [${p}] 命中静态缓存 x-opennext-cache: HIT`,
      (last?.cache || "").toUpperCase().includes("HIT"),
      `实际 "${last?.cache}"`
    );
  }
}

// ── 4. 线上 HTML 与本地预渲染一致 ──────────────────────────────────────────
section("4. 线上 HTML == 本地预渲染产物");
{
  const r = probeCache["/suppliers"] ?? (await probe("/suppliers"));
  const liveCards = (r.html.match(/class="card p-5 hover:border/g) ?? []).length;
  check(
    "4a 线上卡片数 == 本地预渲染卡片数",
    localCards !== null && liveCards === localCards && liveCards > 0,
    `线上 ${liveCards} / 本地 ${localCards}`
  );
  check("4b 线上 HTML 仍含 ItemList 结构化数据", /"@type":"ItemList"/.test(r.html));
  check(
    "4c 线上 HTML 含搜索框（客户端过滤所需）",
    /type="search"/.test(r.html) && /name="q"/.test(r.html)
  );
}

// ── 5. 产业带路由 ──────────────────────────────────────────────────────────
section("5. 产业带路由");
for (const p of [
  "/industrial-clusters",
  "/industrial-clusters/china",
  "/industrial-clusters/china/guangdong",
  "/industrial-clusters/china/guangdong/foshan-furniture",
]) {
  const r = await probe(p).catch(() => null);
  check(`5 [${p}] 200`, Boolean(r) && r.status === 200, r ? `status=${r.status} ttfb=${r.ttfb}ms` : "请求失败");
}

console.log(`\n${"=".repeat(60)}`);
console.log(`stage1.8 线上验收：${pass} PASS / ${fail} FAIL`);
if (fail) {
  console.log("\n失败项：");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log("全部通过 ✓");
