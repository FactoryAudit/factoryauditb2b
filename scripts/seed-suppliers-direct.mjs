#!/usr/bin/env node
/**
 * scripts/seed-suppliers-direct.mjs —— 直连 PostgREST 的供应商迁移
 *
 * 为什么要有这个脚本：
 *   seed-suppliers.mjs 用 supabase-js，而 supabase-js 在 INSERT 前会用 OpenAPI schema
 *   做一次客户端校验。当 Supabase 的 PostgREST schema cache 没刷新时（常见于 SQL Editor
 *   跑完 DDL 后），这个校验会报 "Could not find the table in the schema cache"，
 *   但服务端其实已经能查到这张表（SELECT 正常）。直连 /rest/v1 端点可以绕过这个
 *   客户端缓存，直接打到实时查询引擎。
 *
 * 用法：
 *   node --env-file-if-exists=.env scripts/seed-suppliers-direct.mjs
 *
 * 幂等：suppliers 用 on_conflict=slug upsert；子表先删后插。
 */

import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!URL || !KEY) {
  console.error("❌ 缺少环境变量：NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

// ---------- 加载静态供应商（与 seed-suppliers.mjs 同款 esbuild 打包）----------

async function loadStaticSuppliers() {
  const tmp = mkdtempSync(join(tmpdir(), "seed-direct-"));
  const out = join(tmp, "staticData.mjs");
  try {
    await build({
      entryPoints: ["lib/staticData.ts"],
      bundle: true,
      format: "esm",
      platform: "node",
      outfile: out,
      logLevel: "silent",
    });
    const mod = await import(`file://${out.replace(/\\/g, "/")}?t=${Date.now()}`);
    return mod.STATIC_SUPPLIERS;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function postgrest(method, path, body, prefer) {
  const headers = { ...H };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = json?.message || text || `HTTP ${res.status}`;
    throw new Error(`[${method} ${path}] ${res.status}: ${msg}`);
  }
  return json;
}

// ---------- 主流程 ----------

const suppliers = await loadStaticSuppliers();
console.log(`📦 读到 ${suppliers.length} 家供应商\n`);

let okCount = 0;
let failCount = 0;

for (const s of suppliers) {
  const row = {
    slug: s.slug,
    legal_name: s.legalName,
    country_code: s.countryCode,
    city: s.city,
    industry_code: s.industryCode ?? null,
    business_type: s.businessType ?? null,
    established: s.established ?? null,
    employees: s.employees ?? null,
    main_products: s.mainProducts ?? [],
    export_markets: s.exportMarkets ?? [],
    verification_status: s.verificationStatus ?? null,
    risk_score: s.riskScore ?? null,
    certifications: s.certifications ?? [],
    audit_status: s.auditStatus ?? null,
    inspection_history: s.inspectionHistory ?? 0,
    access_tier: "public",
    is_published: true,
  };

  try {
    // upsert 主表，拿回 id
    const upserted = await postgrest(
      "POST",
      "/suppliers?on_conflict=slug",
      [row],
      "resolution=merge-duplicates,return=representation"
    );
    const supplierId = upserted?.[0]?.id;
    if (!supplierId) throw new Error("upsert 未返回 id");

    // 能力标签：先删后插
    await postgrest("DELETE", `/supplier_capabilities?supplier_id=eq.${supplierId}`);
    if (s.capabilities?.length) {
      const caps = s.capabilities.map((c) => ({
        supplier_id: supplierId,
        ref_type: c.refType,
        ref_code: c.refCode,
        verified: !!c.verified,
        source: c.source ?? null,
      }));
      await postgrest("POST", "/supplier_capabilities", caps);
    }

    // 证据：先删后插，迁移期全部 public
    await postgrest("DELETE", `/supplier_evidence?supplier_id=eq.${supplierId}`);
    if (s.evidence?.length) {
      const evs = s.evidence.map((e) => ({
        supplier_id: supplierId,
        type: e.type,
        status: e.status,
        source: e.source ?? null,
        date: e.date ?? null,
        note: e.note ?? null,
        visibility: "public",
      }));
      await postgrest("POST", "/supplier_evidence", evs);
    }

    console.log(`   ✅ ${row.slug}  (capabilities=${s.capabilities?.length ?? 0}, evidence=${s.evidence?.length ?? 0})`);
    okCount++;
  } catch (e) {
    console.error(`   ❌ ${row.slug} — ${e.message}`);
    failCount++;
  }
}

console.log(`\n📊 迁移完成：成功 ${okCount} 家，失败 ${failCount} 家`);
if (failCount > 0) process.exit(1);
