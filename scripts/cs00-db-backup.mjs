// scripts/cs00-db-backup.mjs
//
// CS-00 Production Safety Snapshot —— 数据库逻辑备份（只读，绝不写库）
//
// 用途：在 CS-01 执行 DDL 之前，把当前生产数据导出成本地 JSON，作为可回滚资产。
// 约束：
//   1. 全程只用 GET（PostgREST），不执行任何写操作。
//   2. 含 PII 的表（profiles / rfqs / ...）只导出"计数 + 脱敏样本"，
//      全量 PII 恢复应走 Supabase 自身备份/PITR，本脚本不落盘真实邮箱。
//   3. 幂等：重复执行覆盖同目录，不追加。
//
// 用法：node --env-file=.env scripts/cs00-db-backup.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("[cs00] 缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const OUT = process.argv[2] ?? ".workbuddy/backups/2026-09-10-cs00";
mkdirSync(OUT, { recursive: true });

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** 只读取，不做任何写操作 */
async function get(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: H });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON（如 404 空体） */ }
  return { status: r.status, range: r.headers.get("content-range"), json, text };
}

async function countOf(table) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, {
    headers: { ...H, Prefer: "count=exact" },
  });
  await r.text();
  const cr = r.headers.get("content-range"); // 形如 "0-0/4" 或 "*/4"
  const total = cr && cr.includes("/") ? cr.split("/")[1] : null;
  return { status: r.status, total: total === "*" ? null : Number(total) };
}

/** 邮箱脱敏：a**b@domain -> 保留首位与域名 */
function maskEmail(v) {
  if (typeof v !== "string" || !v.includes("@")) return "***";
  const [u, d] = v.split("@");
  return `${u.slice(0, 1)}***@${d}`;
}

/** 只保留非 PII 字段 + 脱敏邮箱 */
function scrubRow(row, piiFields) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (piiFields.includes(k)) { out[k] = maskEmail(v); continue; }
    if (k === "message" || k === "full_name" || k === "company") { out[k] = "[REDACTED]"; continue; }
    out[k] = v;
  }
  return out;
}

const FULL_TABLES = ["suppliers", "supplier_evidence", "supplier_capabilities"];
const PII_TABLES = {
  profiles: ["email"],
  rfqs: ["email"],
  memberships: [],
  saved_suppliers: [],
  profile_views: [],
  rfq_matches: [],
  stripe_events: [],
};

const manifest = {
  generated_at: new Date().toISOString(),
  database_host: URL_,
  project_ref: (URL_ || "").replace(/^https?:\/\//, "").split(".")[0],
  method: "PostgREST GET (read-only)",
  note: "CS-00 snapshot. PII tables contain masked samples only.",
  tables: {},
  missing_tables: [],
};

console.log(`[cs00] → ${OUT}`);

for (const t of FULL_TABLES) {
  const c = await countOf(t);
  const r = await get(`${t}?select=*`);
  if (r.status !== 200) {
    manifest.missing_tables.push({ table: t, status: r.status });
    console.log(`  ✗ ${t} → HTTP ${r.status} (不存在或无权限)`);
    continue;
  }
  writeFileSync(join(OUT, `${t}.json`), JSON.stringify(r.json, null, 2), "utf8");
  manifest.tables[t] = { status: r.status, count: Array.isArray(r.json) ? r.json.length : null, content_range: c.total, exported: "full" };
  console.log(`  ✓ ${t} → ${Array.isArray(r.json) ? r.json.length : "?"} 行 (content-range total=${c.total})`);
}

for (const [t, pii] of Object.entries(PII_TABLES)) {
  const c = await countOf(t);
  // ⚠️ PostgREST 带 Prefer: count=exact + limit 时返回 206 Partial Content，
  //    206 与 200 都表示表存在。只有 4xx（404 PGRST205 / 42P01）才算缺失。
  if (c.status !== 200 && c.status !== 206) {
    manifest.missing_tables.push({ table: t, status: c.status });
    console.log(`  ✗ ${t} → HTTP ${c.status}`);
    continue;
  }
  const r = await get(`${t}?select=*&limit=50`);
  const rows = Array.isArray(r.json) ? r.json.map((x) => scrubRow(x, pii)) : [];
  writeFileSync(join(OUT, `${t}.masked.json`), JSON.stringify(rows, null, 2), "utf8");
  manifest.tables[t] = { status: c.status, content_range: c.total, exported: "masked_sample<=50", pii_fields: pii };
  console.log(`  ✓ ${t} → total=${c.total}（脱敏样本 ${rows.length} 行）`);
}

// 单独备份：认证声称值（CS-02 要动它，必须先留证）
const s = await get(`suppliers?select=id,slug,legal_name,certifications,verification_status,audit_status,risk_score,inspection_history`);
if (Array.isArray(s.json)) {
  const claims = s.json.map((x) => ({
    slug: x.slug,
    legal_name: x.legal_name,
    legacy_claim: {
      verification_status: x.verification_status,
      audit_status: x.audit_status,
      certifications: x.certifications,
    },
    claim_count: {
      certifications: Array.isArray(x.certifications) ? x.certifications.length : 0,
    },
  }));
  writeFileSync(join(OUT, "supplier_claims_snapshot.json"), JSON.stringify(claims, null, 2), "utf8");
  console.log(`  ✓ supplier_claims_snapshot.json（原始声明留证）`);
}

writeFileSync(join(OUT, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`[cs00] manifest 已写入`);
