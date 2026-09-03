#!/usr/bin/env node
/**
 * scripts/seed-suppliers.mjs —— 把 lib/staticData.ts 的静态供应商迁移到 Supabase
 *
 * 用法（在项目根目录执行）：
 *   node --env-file-if-exists=.env scripts/seed-suppliers.mjs           # 默认只预览，不写入
 *   node --env-file-if-exists=.env scripts/seed-suppliers.mjs --apply   # 真正写入
 *
 * 前置条件：
 *   1. 已在 Supabase SQL Editor 执行 supabase/migrations/001_init.sql
 *   2. .env 里已配置 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY
 *
 * 设计原则：
 *   - 幂等：用 upsert(onConflict: slug)，重复执行不会产生重复数据
 *   - 安全：默认 dry-run（只读预览）。必须**显式加 --apply** 才会写库。
 *     曾有过注释写"默认 dry-run"而代码其实是默认写入的自相矛盾版本，
 *     照注释操作会误写生产库 —— 所以这里把"写入"做成需要显式确认的开关。
 *   - 保 URL：slug 原样搬运，一个字符都不能改（改了会导致已收录页面 404）
 *
 * 为什么用 esbuild 临时打包：
 *   数据源是 TypeScript，node 不能直接 import。项目已带 esbuild 依赖，
 *   把它 bundle 成临时 ESM 再 import，比手写一份数据副本更可靠（避免两处数据不一致）。
 */

import { createClient } from "@supabase/supabase-js";
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ⚠️ 语义：只有显式传 --apply 才写库。不带参数 = 只读预览。
//    （历史版本是 `--dry-run` 才预览、不带参数即写入，误操作风险高，已改为白名单式。）
const DRY_RUN = !process.argv.includes("--apply");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

// ---------- 0. 环境校验 ----------

if (!URL || !KEY) {
  console.error("❌ 缺少环境变量。请在 .env 里配置：");
  console.error("   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=eyJ...");
  console.error("");
  console.error("提示：service_role key 在 Supabase Dashboard → Project Settings → API Keys");
  process.exit(1);
}

// ★ 防止把 service_role 误配成 anon key（anon 会被 RLS 挡住，报莫名其妙的错）
if (KEY.split(".").length !== 3) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY 格式不对（应为 JWT，三段以 . 分隔）");
  process.exit(1);
}

console.log(DRY_RUN ? "🔍 DRY RUN 模式（不会写入数据库）\n" : "⚠️  写入模式\n");
console.log(`   Supabase URL: ${URL}\n`);

// ---------- 1. 从 TypeScript 源文件读取静态数据 ----------

async function loadStaticSuppliers() {
  const tmpDir = mkdtempSync(join(tmpdir(), "fab-seed-"));
  const outFile = join(tmpDir, "staticData.mjs");
  try {
    await build({
      entryPoints: ["lib/staticData.ts"],
      bundle: true,
      format: "esm",
      platform: "node",
      outfile: outFile,
      logLevel: "error",
    });
    const mod = await import(`file://${outFile.replace(/\\/g, "/")}`);
    return mod.STATIC_SUPPLIERS;
  } finally {
    // 清理临时目录（Windows 下可能锁文件，失败也无所谓）
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

// ---------- 2. 迁移 ----------

const db = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const suppliers = await loadStaticSuppliers();
console.log(`📦 从 lib/staticData.ts 读到 ${suppliers.length} 家供应商\n`);

// slug 契约断言：这 4 个 slug 已被搜索引擎收录，改一个字就是 404
const EXPECTED_SLUGS = [
  "shenzhen-precision-electronics",
  "guangzhou-textile-factory",
  "dongguan-plastic-molding",
  "ho-chi-minh-garment",
];

const actualSlugs = suppliers.map((s) => s.slug).sort();
const missing = EXPECTED_SLUGS.filter((s) => !actualSlugs.includes(s));
if (missing.length > 0) {
  console.error("❌ slug 契约校验失败，缺少以下已收录 slug：");
  console.error(`   ${missing.join(", ")}`);
  console.error("\n   这些 slug 已被搜索引擎收录，缺失会导致线上 404。请检查 lib/staticData.ts。");
  process.exit(1);
}
console.log("✅ slug 契约校验通过（4 个已收录 slug 全部存在）\n");

let ok = 0;
let failed = 0;

for (const s of suppliers) {
  const row = {
    slug: s.slug,
    legal_name: s.legalName,
    country_code: s.countryCode,
    city: s.city,
    industry_code: s.industryCode,
    business_type: s.businessType,
    established: s.established,
    employees: s.employees,
    main_products: s.mainProducts,
    export_markets: s.exportMarkets,
    verification_status: s.verificationStatus,
    risk_score: s.riskScore,
    certifications: s.certifications,
    audit_status: s.auditStatus,
    inspection_history: s.inspectionHistory,
    access_tier: "public", // 迁移初期全部公开，后续由 Admin 按家调整
    is_published: true,
  };

  if (DRY_RUN) {
    console.log(`   [预览] ${row.slug}`);
    console.log(`          ${row.legal_name} · ${row.city} · risk=${row.risk_score}`);
    console.log(`          capabilities=${s.capabilities.length}  evidence=${s.evidence.length}`);
    ok++;
    continue;
  }

  // upsert 供应商主表，拿回 id 用于写子表
  const { data: upserted, error: upErr } = await db
    .from("suppliers")
    .upsert(row, { onConflict: "slug" })
    .select("id, slug")
    .single();

  if (upErr || !upserted) {
    console.error(`   ❌ ${row.slug} — ${upErr?.message ?? "unknown error"}`);
    failed++;
    continue;
  }
  const supplierId = upserted.id;

  // 能力标签（先删再插，保证与源文件一致，避免残留）
  await db.from("supplier_capabilities").delete().eq("supplier_id", supplierId);
  if (s.capabilities.length > 0) {
    const caps = s.capabilities.map((c) => ({
      supplier_id: supplierId,
      ref_type: c.refType,
      ref_code: c.refCode,
      verified: c.verified,
      source: c.source,
    }));
    const { error: capErr } = await db.from("supplier_capabilities").insert(caps);
    if (capErr) console.warn(`   ⚠️  ${row.slug} capabilities: ${capErr.message}`);
  }

  // 证据（迁移时全部设为 public，与 V2.0 线上表现一致 —— 证据条数原本就是公开的）
  await db.from("supplier_evidence").delete().eq("supplier_id", supplierId);
  if (s.evidence.length > 0) {
    const evs = s.evidence.map((e) => ({
      supplier_id: supplierId,
      type: e.type,
      status: e.status,
      source: e.source,
      date: e.date,
      note: e.note ?? null,
      visibility: "public",
    }));
    const { error: evErr } = await db.from("supplier_evidence").insert(evs);
    if (evErr) console.warn(`   ⚠️  ${row.slug} evidence: ${evErr.message}`);
  }

  console.log(
    `   ✅ ${row.slug}  (capabilities=${s.capabilities.length}, evidence=${s.evidence.length})`
  );
  ok++;
}

// ---------- 3. 结果 ----------

console.log("");
if (DRY_RUN) {
  console.log(`🔍 预览完成：${ok} 家。确认无误后加 --apply 执行写入。`);
  process.exit(0);
}

console.log(`📊 迁移完成：成功 ${ok} 家，失败 ${failed} 家`);

if (failed === 0) {
  console.log("");
  console.log("下一步：");
  console.log("  1. 在 .env 里设置 SUPPLIER_DATA_SOURCE=supabase");
  console.log("  2. 重启 dev server，逐页比对迁移前后是否一致");
  console.log("  3. 有问题随时改回 SUPPLIER_DATA_SOURCE=static 回滚");
} else {
  console.log("\n⚠️  有失败项，请检查上面的错误信息（常见原因：RLS 拦截 / 字段类型不匹配）");
  process.exit(1);
}
