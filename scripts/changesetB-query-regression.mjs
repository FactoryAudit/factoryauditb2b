/**
 * CHANGE SET B —— 查询行为夹具回归（N+1 硬证据）
 *
 * 为什么要单独验：产业带目录页的「每家 cluster 有多少供应商」最容易写成一个循环
 *   clusters.map(c => countSuppliersInCluster(c.slug))
 * 那就是标准 N+1。但**浏览器 Network 面板看不到它** —— Supabase 查询发生在服务端。
 * 所以这里用 esbuild 打包**真实源码**（lib/queries.ts / lib/industrialClusters.ts），
 * 只把 `./supabaseAdmin` 换成可计数的桩，于是每一次 `.from(table)` 都被记账。
 *
 * 复用既有桩：scripts/step04-supabase-stub.mjs（读 globalThis.__STUB_STATE__）。
 *
 * 契约（CHANGE SET B 要求）：
 *   · Cluster Directory：Cluster Query ≤ 1 且 Supplier Count Query ≤ 1
 *   · Cluster Detail：1 次 cluster + 1 次 supplier list
 *   · 零 slug ⇒ 零查询
 *   · 一律只统计 is_published = true 的行
 *
 * 跑法：node scripts/changesetB-query-regression.mjs   （失败退出码 1）
 */

import * as esbuild from "esbuild";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const STUB = path.join(ROOT, "scripts", "step04-supabase-stub.mjs");
const ENTRY = path.join(ROOT, "scripts", "changesetB-entry.ts");
const OUT = path.join(ROOT, "scripts", ".changesetB-bundle.mjs");

let pass = 0;
let fail = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? ` — ${detail}` : ""));
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function section(t) {
  console.log(`\n=== ${t} ===`);
}

// ---------- 夹具 ----------
// 3 个产业带（2 发布 + 1 草稿），4 家供应商（3 发布 + 1 未发布）
const CLUSTERS = [
  { id: "c1", name: "Cluster A", slug: "a", country: "China", country_code: "cn", region: "Guangdong", city: "Foshan", industry: "Furniture", industry_tags: null, description: "A", seo_title: null, seo_description: null, is_published: true, sort_order: 1, created_at: "2026-01-01", updated_at: "2026-01-01" },
  { id: "c2", name: "Cluster B", slug: "b", country: "Vietnam", country_code: "vn", region: "Binh Duong", city: "Thu Dau Mot", industry: "Textiles", industry_tags: null, description: "B", seo_title: null, seo_description: null, is_published: true, sort_order: 2, created_at: "2026-01-01", updated_at: "2026-01-01" },
  { id: "c3", name: "Draft Cluster", slug: "c", country: "China", country_code: "cn", region: "Zhejiang", city: "Shaoxing", industry: "Chemicals", industry_tags: null, description: "draft", seo_title: null, seo_description: null, is_published: false, sort_order: 3, created_at: "2026-01-01", updated_at: "2026-01-01" },
];
const SUPPLIERS = [
  { id: "s1", slug: "s1", legal_name: "S1", country_code: "cn", city: "Foshan", cluster_slug: "a", is_published: true, risk_score: 80 },
  { id: "s2", slug: "s2", legal_name: "S2", country_code: "cn", city: "Foshan", cluster_slug: "a", is_published: true, risk_score: 70 },
  { id: "s3", slug: "s3", legal_name: "S3", country_code: "vn", city: "Hanoi", cluster_slug: "b", is_published: true, risk_score: 60 },
  { id: "s4", slug: "s4", legal_name: "S4-unpublished", country_code: "cn", city: "Foshan", cluster_slug: "a", is_published: false, risk_score: 90 },
];

function resetStub() {
  globalThis.__STUB_STATE__ = {
    tables: { industrial_clusters: CLUSTERS, suppliers: SUPPLIERS },
    queries: [],
    failTables: [],
  };
}
resetStub();

await esbuild.build({
  entryPoints: [ENTRY],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: OUT,
  logLevel: "warning",
  plugins: [
    {
      name: "stub-supabase-admin",
      setup(build) {
        build.onResolve({ filter: /(^|\/)supabaseAdmin$/ }, () => ({ path: STUB }));
        build.onResolve({ filter: /^(server-only|client-only)$/ }, () => ({
          path: "empty-sentinel",
          namespace: "sentinel",
        }));
        build.onLoad({ filter: /.*/, namespace: "sentinel" }, () => ({
          contents: "export {};",
          loader: "js",
        }));
      },
    },
  ],
});

const mod = await import(pathToFileURL(OUT).href);
const { countSuppliersByClusterSlugs, listSuppliersByClusterSlug, listPublishedClusters, getPublishedClusterBySlug } = mod;

const fromCount = () => globalThis.__STUB_STATE__.queries.length;
const tablesTouched = () => globalThis.__STUB_STATE__.queries.map((q) => q.table);

// ---------- TEST-BQ-01：目录页整页查询数 = 2 ----------
section("BQ-01 Cluster Directory 查询数（≤1 cluster + ≤1 count）");
resetStub();
{
  const clusters = await listPublishedClusters();
  const counts = await countSuppliersByClusterSlugs(clusters.map((c) => c.slug));
  const n = fromCount();
  const t = tablesTouched();
  check("目录页数据库往返总数 = 2", n === 2, `实际 ${n}（${t.join(", ")}）`);
  check(
    "其中 industrial_clusters 恰 1 次",
    t.filter((x) => x === "industrial_clusters").length === 1,
    `实际 ${t.filter((x) => x === "industrial_clusters").length}`
  );
  check(
    "其中 suppliers 恰 1 次（不是每家 cluster 一次）",
    t.filter((x) => x === "suppliers").length === 1,
    `实际 ${t.filter((x) => x === "suppliers").length}`
  );
  check("返回已发布 cluster 数 = 2（草稿被剔除）", clusters.length === 2, `实际 ${clusters.length}`);
  check("草稿 slug 'c' 不在结果里", !clusters.some((c) => c.slug === "c"));
  check("计数 a = 2", counts.get("a") === 2, `实际 ${counts.get("a")}`);
  check("计数 b = 1", counts.get("b") === 1, `实际 ${counts.get("b")}`);
}

// ---------- TEST-BQ-02：N 个 slug 仍是 1 次查询（反 N+1 的核心断言）----------
section("BQ-02 计数查询不随 slug 数量增长");
resetStub();
{
  await countSuppliersByClusterSlugs(["a", "b", "c", "d", "e", "f", "g", "h"]);
  const n = fromCount();
  check("8 个 slug ⇒ 1 次查询（N+1 会变成 8 次）", n === 1, `实际 ${n}`);
}

// ---------- TEST-BQ-03：零 slug ⇒ 零查询 ----------
section("BQ-03 零 slug / 空输入 ⇒ 零查询");
resetStub();
{
  const c1 = await countSuppliersByClusterSlugs([]);
  check("空数组 ⇒ 0 次查询", fromCount() === 0, `实际 ${fromCount()}`);
  check("返回空 Map", c1.size === 0);
  resetStub();
  const c2 = await countSuppliersByClusterSlugs([null, undefined, "", "   "]);
  check("全空值 ⇒ 0 次查询", fromCount() === 0, `实际 ${fromCount()}`);
  check("返回空 Map", c2.size === 0);
}

// ---------- TEST-BQ-04：只统计已发布供应商 ----------
section("BQ-04 计数只包含 is_published = true");
resetStub();
{
  const counts = await countSuppliersByClusterSlugs(["a"]);
  // 夹具里 cluster a 有 3 家（s1,s2 发布 / s4 未发布）⇒ 必须只算 2
  check("cluster a 计数 = 2（未发布 s4 不计）", counts.get("a") === 2, `实际 ${counts.get("a")}`);
  const q = globalThis.__STUB_STATE__.queries[0];
  const hasPublishedFilter = (q?.filters || []).some(
    (f) => f.op === "eq" && f.col === "is_published" && f.val === true
  );
  check("供应商查询带显式 eq(is_published, true)", hasPublishedFilter);
}

// ---------- TEST-BQ-05：Cluster Detail 查询数 = 2 ----------
section("BQ-05 Cluster Detail 查询数（1 cluster + 1 supplier list）");
resetStub();
{
  const cluster = await getPublishedClusterBySlug("a");
  check("能取到已发布 cluster", cluster?.slug === "a");
  const suppliers = await listSuppliersByClusterSlug("a");
  const n = fromCount();
  check("详情页数据库往返总数 = 2", n === 2, `实际 ${n}（${tablesTouched().join(", ")}）`);
  check("返回该产业带已发布供应商 = 2 家", suppliers.length === 2, `实际 ${suppliers.length}`);
  check("不包含未发布供应商 s4", !suppliers.some((s) => s.slug === "s4"));
}

// ---------- TEST-BQ-06：未发布 cluster 取不到 ----------
section("BQ-06 未发布 cluster 不可公开读取");
resetStub();
{
  const draft = await getPublishedClusterBySlug("c");
  check("草稿 slug 返回 null（→ 404）", draft === null, `实际 ${JSON.stringify(draft)}`);
  const q = globalThis.__STUB_STATE__.queries[0];
  const f = (q?.filters || []).filter((x) => x.op === "eq");
  check(
    "查询同时带 slug 与 is_published 两个等值条件",
    f.some((x) => x.col === "slug") && f.some((x) => x.col === "is_published" && x.val === true),
    JSON.stringify(f.map((x) => `${x.col}=${x.val}`))
  );
}

// ---------- TEST-BQ-07：空 cluster 表不炸 ----------
section("BQ-07 空表（当前生产态）行为");
resetStub();
globalThis.__STUB_STATE__.tables.industrial_clusters = [];
{
  const clusters = await listPublishedClusters();
  check("空表 ⇒ 返回空数组（不抛错）", Array.isArray(clusters) && clusters.length === 0);
  const counts = await countSuppliersByClusterSlugs(clusters.map((c) => c.slug));
  check("空 slug 列表 ⇒ 不再额外查 suppliers", counts.size === 0 && fromCount() === 1, `查询数 ${fromCount()}`);
}

console.log(`\n${"=".repeat(58)}`);
console.log(`CHANGE SET B 查询行为回归：${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("失败项：");
  failures.forEach((f) => console.log("  · " + f));
  process.exit(1);
}
console.log("全部通过 ✓（N+1 禁令有硬证据）");
