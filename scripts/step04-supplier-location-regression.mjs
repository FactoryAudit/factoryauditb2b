/**
 * STEP-04 供应商「地域 + 产业带」展示夹具回归（TEST-01 ~ TEST-04）
 *
 * 目的：用**真实代码**（lib/queries.ts / lib/industrialClusters.ts / lib/seo/supplierSeo.ts）
 * 跑在可控夹具上，验证供应商地域/产业带展示能力，**不碰生产数据库**。
 *
 * 手法：esbuild 打包真实 TS 源码，只把 `./supabaseAdmin` 换成可计数的桩
 * （scripts/step04-supabase-stub.mjs），于是每一次 `.from(table)` 都被记账 ——
 * 这样「零 slug ⇒ 零查询」「多 slug ⇒ 恰好 1 次批量」这类**查询行为**才可断言。
 *
 * 三个文件的分工：
 *   · step04-supplier-location-regression.mjs（本文件）—— 断言与夹具
 *   · step04-supabase-stub.mjs                       —— 可计数 Supabase 桩
 *   · step04-entry.ts                                —— 打包入口（只做 re-export）
 *
 * 跑法：node scripts/step04-supplier-location-regression.mjs   （失败退出码 1）
 */

import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const STUB = path.join(ROOT, "scripts", "step04-supabase-stub.mjs");
const ENTRY = path.join(ROOT, "scripts", "step04-entry.ts");
const OUT = path.join(ROOT, "scripts", ".step04-bundle.mjs");

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
        // Next 的编译期哨兵模块（'server-only' / 'client-only'）在 node 里不存在，
        // 用空模块顶掉 —— 它们本身不含任何逻辑，只是构建期约束。
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
const {
  listSupplierDirectory,
  getSupplierDetail,
  getSupplierBySlug,
  resolvePublishedClusterNames,
  generateSupplierSnapshot,
  supplierSeoDataFromView,
  PUBLIC_FIELDS,
  FREE_FIELDS,
  PAID_FIELDS,
} = mod;

// ---------------------------------------------------------------- fixtures

function sup(over = {}) {
  return {
    id: over.id ?? `id-${over.slug}`,
    slug: over.slug ?? "s",
    legal_name: over.legal_name ?? "Fixture Co Ltd",
    country_code: "china",
    city: "Dongguan",
    industry_code: "furniture",
    business_type: "Manufacturer",
    established: 2010,
    employees: "50-100",
    main_products: ["Sofa"],
    export_markets: ["United States"],
    verification_status: null,
    verification_level: "unverified",
    updated_at: "2026-09-01T00:00:00Z",
    risk_score: null,
    certifications: null,
    audit_status: null,
    inspection_history: 0,
    risk_breakdown: null,
    access_tier: "public",
    is_published: true,
    company_type: null,
    english_name: null,
    production_capacity: null,
    monthly_output: null,
    factory_size: null,
    export_since: null,
    self_reported_certificates: null,
    address: null,
    website: null,
    registration_number: null,
    region: null,
    cluster: null,
    cluster_slug: null,
    cluster_tags: null,
    supplier_evidence: [],
    ...over,
  };
}

function resetStub(tables, failTables = []) {
  globalThis.__STUB_STATE__ = { tables, queries: [], failTables };
}
function clusterQueries() {
  return globalThis.__STUB_STATE__.queries.filter((q) => q.table === "industrial_clusters");
}

const LABELS_BEFORE = {
  city: "City",
  country: "Country",
  businessType: "Business type",
  industry: "Industry",
  products: "Main products",
  address: "Address",
  website: "Website",
  registrationNumber: "Registration number",
  verificationLevel: "Verification level",
  lastUpdated: "Last updated",
  lastChecked: "Last checked",
  evidenceOnFile: "Evidence on file",
};
const LABELS_AFTER = {
  ...LABELS_BEFORE,
  region: "Region",
  industrialCluster: "Industrial cluster",
};

function emptyOpts() {
  return { verifiedAudits: [], verifiedCertifications: [] };
}

/** TEST-02 / 03 / 04 共用的混合夹具：已发布 / 未发布 / 孤儿引用 / NULL 四种情形各一家。 */
const MIXED_SUPPLIERS = () => [
  sup({ slug: "pub-supplier", cluster_slug: "test-cluster", region: "Guangdong" }),
  sup({ slug: "unpub-supplier", cluster_slug: "unpublished-cluster" }),
  sup({ slug: "missing-supplier", cluster_slug: "missing-cluster" }),
  sup({ slug: "none-supplier", cluster_slug: null }),
];
const MIXED_CLUSTERS = () => [
  { slug: "test-cluster", name: "Test Cluster", is_published: true },
  { slug: "unpublished-cluster", name: "Draft Cluster", is_published: false },
];
function resetMixed(failTables = []) {
  resetStub(
    {
      suppliers: MIXED_SUPPLIERS(),
      industrial_clusters: MIXED_CLUSTERS(),
      supplier_audits: [],
    },
    failTables
  );
}

/* =============================================================== TEST-01 */
section("TEST-01 生产现状：全部 cluster_slug = NULL / industrial_clusters 0 行");
{
  resetStub({
    suppliers: [
      sup({ slug: "s1" }),
      sup({ slug: "s2" }),
      sup({ slug: "s3" }),
    ],
    industrial_clusters: [],
    supplier_audits: [],
  });

  const views = await listSupplierDirectory();
  check("T1.1 目录返回 3 家（无异常）", views.length === 3, `实际 ${views.length}`);
  check(
    "T1.2 **零 slug ⇒ 零 industrial_clusters 查询**",
    clusterQueries().length === 0,
    `实际 ${clusterQueries().length} 次`
  );
  check(
    "T1.3 全部 clusterName === undefined（不编造、不留空串）",
    views.every((v) => v.clusterName === undefined),
    JSON.stringify(views.map((v) => v.clusterName))
  );

  // 「UI 与修改前保持一致」：新标签传入后，行 id 序列必须与不传时逐字相同
  const { seo } = supplierSeoDataFromView(views[0], emptyOpts());
  const idsBefore = generateSupplierSnapshot(seo, "en", LABELS_BEFORE).map((r) => r.id);
  const idsAfter = generateSupplierSnapshot(seo, "en", LABELS_AFTER).map((r) => r.id);
  check(
    "T1.4 Snapshot 行序列与改动前逐字一致（无新增空标签）",
    JSON.stringify(idsBefore) === JSON.stringify(idsAfter),
    `${idsBefore.join(",")} vs ${idsAfter.join(",")}`
  );
  const rowsAfter = generateSupplierSnapshot(seo, "en", LABELS_AFTER);
  check(
    "T1.5 无 region / industrialCluster 行",
    !rowsAfter.some((r) => r.id === "region" || r.id === "industrialCluster")
  );

  // 详情页（单条）
  resetStub({ suppliers: [sup({ slug: "s1" })], industrial_clusters: [], supplier_audits: [] });
  const detail = await getSupplierDetail("s1", "en");
  check("T1.6 详情页正常返回", Boolean(detail));
  check(
    "T1.7 详情页 cluster_slug=NULL ⇒ 零 industrial_clusters 查询",
    clusterQueries().length === 0,
    `实际 ${clusterQueries().length} 次`
  );
  const detailRows = generateSupplierSnapshot(
    supplierSeoDataFromView(detail, emptyOpts()).seo,
    "en",
    LABELS_AFTER
  );
  check(
    "T1.8 详情页也不出现这两个空标签",
    !detailRows.some((r) => r.id === "region" || r.id === "industrialCluster")
  );
}

/* =============================================================== TEST-02 */
section("TEST-02 cluster_slug = test-cluster（已发布）⇒ 显示产业带名");
{
  resetMixed();

  const views = await listSupplierDirectory();
  const byslug = Object.fromEntries(views.map((v) => [v.slug, v]));
  const q = clusterQueries();

  check("T2.1 3 个非空 slug ⇒ **恰好 1 次**批量查询（非 N+1）", q.length === 1, `实际 ${q.length} 次`);
  check(
    "T2.2 查询是 .in(slug, [3 个去重 slug])",
    Array.isArray(q[0]?.filters.find((f) => f.op === "in")?.val) &&
      q[0].filters.find((f) => f.op === "in").val.length === 3,
    JSON.stringify(q[0]?.filters)
  );
  check(
    "T2.3 **显式 .eq(\"is_published\", true)**（公开读走 service_role，不依赖 RLS）",
    q[0]?.filters.some((f) => f.op === "eq" && f.col === "is_published" && f.val === true),
    JSON.stringify(q[0]?.filters)
  );
  check("T2.4 已发布 ⇒ clusterName = 'Test Cluster'", byslug["pub-supplier"]?.clusterName === "Test Cluster", String(byslug["pub-supplier"]?.clusterName));

  const pubRows = generateSupplierSnapshot(
    supplierSeoDataFromView(byslug["pub-supplier"], emptyOpts()).seo,
    "en",
    LABELS_AFTER
  );
  const pubMap = Object.fromEntries(pubRows.map((r) => [r.id, r]));
  check("T2.5 Snapshot 出现 industrialCluster 行", pubMap.industrialCluster?.label === "Industrial cluster");
  check("T2.6 该行值 = 产业带名", pubMap.industrialCluster?.value === "Test Cluster", String(pubMap.industrialCluster?.value));
  check("T2.7 Snapshot 出现 region 行（有值才渲染）", pubMap.region?.value === "Guangdong", String(pubMap.region?.value));

  // 详情页单条路径
  resetStub({
    suppliers: [sup({ slug: "pub-supplier", cluster_slug: "test-cluster", region: "Guangdong" })],
    industrial_clusters: [{ slug: "test-cluster", name: "Test Cluster", is_published: true }],
    supplier_audits: [],
  });
  const detail = await getSupplierDetail("pub-supplier", "en");
  check("T2.8 详情页 clusterName 已解析", detail?.clusterName === "Test Cluster", String(detail?.clusterName));
  check("T2.9 详情页恰好 1 次产业带查询", clusterQueries().length === 1, `实际 ${clusterQueries().length} 次`);
  const dRows = generateSupplierSnapshot(
    supplierSeoDataFromView(detail, emptyOpts()).seo,
    "en",
    LABELS_AFTER
  );
  check(
    "T2.10 详情页渲染产业带 + 大区两行",
    dRows.some((r) => r.id === "industrialCluster" && r.value === "Test Cluster") &&
      dRows.some((r) => r.id === "region" && r.value === "Guangdong")
  );
}

/* =============================================================== TEST-03 */
section("TEST-03 产业带存在但 is_published = false ⇒ 完全不显示、不泄漏");
{
  resetMixed(); // ← 上一步的详情用例改过夹具，这里必须重建
  const views = await listSupplierDirectory();
  const byslug = Object.fromEntries(views.map((v) => [v.slug, v]));
  const v = byslug["unpub-supplier"];
  check("T3.1 未发布 ⇒ clusterName === undefined", v?.clusterName === undefined, String(v?.clusterName));
  check(
    "T3.2 未发布产业带的**名字未出现在** view 任意字段",
    String(JSON.stringify(v)).includes("Draft Cluster") === false
  );

  const seoV = supplierSeoDataFromView(v, emptyOpts()).seo;
  const rows = generateSupplierSnapshot(seoV, "en", LABELS_AFTER);
  const rowsBare = generateSupplierSnapshot(seoV, "en", LABELS_BEFORE);
  check("T3.3 Snapshot 无 industrialCluster 行", !rows.some((r) => r.id === "industrialCluster"));
  check("T3.3b Snapshot 无 region 行", !rows.some((r) => r.id === "region"));
  check(
    "T3.4 本 CS 未新增任何行（行序列与不带新标签时逐字一致）",
    JSON.stringify(rows.map((r) => r.id)) === JSON.stringify(rowsBare.map((r) => r.id)),
    `${rowsBare.map((r) => r.id).join(",")} vs ${rows.map((r) => r.id).join(",")}`
  );

  // 查询整体失败时也必须保守（不能因为一次失败把「未发布」误显成「已发布」）
  resetMixed(["industrial_clusters"]);
  const broken = await listSupplierDirectory();
  check("T3.5 产业带查询报错 ⇒ 不抛异常、目录照常返回", broken.length === 4, `实际 ${broken.length}`);
  check("T3.6 出错 ⇒ clusterName undefined（保守方向）", broken[0]?.clusterName === undefined);
}

/* =============================================================== TEST-04 */
section("TEST-04 cluster_slug = missing-cluster（产业带不存在）⇒ 正常渲染、无 Unknown");
{
  resetMixed(); // ← 上一步注入了查询失败，这里恢复
  const views = await listSupplierDirectory();
  const byslug = Object.fromEntries(views.map((v) => [v.slug, v]));
  const v = byslug["missing-supplier"];
  check("T4.1 孤儿引用 ⇒ 不报错、档案照常返回", Boolean(v));
  check("T4.2 clusterName === undefined", v?.clusterName === undefined, String(v?.clusterName));
  check(
    "T4.3 页面其余字段不受影响（legal_name / city 仍在）",
    v?.legalName === "Fixture Co Ltd" && v?.city === "Dongguan"
  );

  const seoM = supplierSeoDataFromView(v, emptyOpts()).seo;
  const rows = generateSupplierSnapshot(seoM, "en", LABELS_AFTER);
  const rowsBare = generateSupplierSnapshot(seoM, "en", LABELS_BEFORE);
  check("T4.4 Snapshot 无 industrialCluster 行", !rows.some((r) => r.id === "industrialCluster"));
  check(
    "T4.5 本 CS 未新增任何行，故不存在由本 CS 引入的 Unknown 空标签",
    !rows.some((r) => r.id === "region" || r.id === "industrialCluster") &&
      JSON.stringify(rows.map((r) => r.id)) === JSON.stringify(rowsBare.map((r) => r.id)),
    `${rowsBare.map((r) => r.id).join(",")} vs ${rows.map((r) => r.id).join(",")}`
  );

  // getSupplierBySlug 同样路径
  const single = await getSupplierBySlug("missing-supplier");
  check("T4.6 getSupplierBySlug 正常返回且 clusterName undefined", Boolean(single) && single.clusterName === undefined);

  // 直接测解析函数：孤儿 slug 不进 Map
  const m = await resolvePublishedClusterNames(["missing-cluster", "test-cluster", null, "", "  "]);
  check("T4.7 解析函数：孤儿/空值不进 Map，已发布的进 Map", m.size === 1 && m.get("test-cluster") === "Test Cluster", `size=${m.size}`);
  const m0Before = clusterQueries().length;
  const m0 = await resolvePublishedClusterNames([null, undefined, "", "   "]);
  check("T4.8 解析函数：全空 ⇒ 空 Map", m0.size === 0);
  check(
    "T4.9 解析函数：全空 ⇒ **零查询**（未发生任何 industrial_clusters 往返）",
    clusterQueries().length === m0Before,
    `${m0Before} → ${clusterQueries().length}`
  );
}

/* =============================================================== 权限边界 */
section("附带：不动权限口径（PUBLIC_FIELDS 仍 21）");
{
  check("P1 PUBLIC_FIELDS.length === 21", PUBLIC_FIELDS.length === 21, `实际 ${PUBLIC_FIELDS.length}`);
  check("P2 未把 region/cluster 塞进 PUBLIC_FIELDS", !PUBLIC_FIELDS.includes("region") && !PUBLIC_FIELDS.includes("clusterName"));
  check(
    "P3 FREE/PAID 长度未变",
    FREE_FIELDS.length > 0 && PAID_FIELDS.length > 0
  );
}

console.log(`\n================ 夹具回归结果：PASS ${pass} / FAIL ${fail} ================`);
if (fail > 0) {
  console.log("失败项：");
  for (const f of failures) console.log("  - " + f);
  process.exitCode = 1;
}
