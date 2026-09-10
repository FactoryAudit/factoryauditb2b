// CS-01 Pre-check（只读）：探测目标对象是否存在 + 采集迁移前计数
// 用法: node --env-file=.env scripts/cs01-precheck.mjs
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      // .env 常见 "value" / 'value' 包裹，必须剥掉，否则 fetch 报 ERR_INVALID_URL
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    })
);
const BASE = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const TARGETS = [
  "supplier_documents",
  "supplier_certifications",
  "supplier_audits",
  "admin_audit_log",
  "certification_program_alias",
  "schema_migrations",
];
const COUNTS = [
  "suppliers",
  "supplier_evidence",
  "supplier_capabilities",
  "profiles",
  "memberships",
  "rfqs",
  "saved_suppliers",
  "profile_views",
  "rfq_matches",
  "stripe_events",
];

const H = { apikey: KEY, Authorization: "Bearer " + KEY, Accept: "application/json" };

async function get(path, extra) {
  const r = await fetch(BASE + "/rest/v1/" + path, { headers: extra ? { ...H, ...extra } : H });
  let body = "";
  try {
    body = await r.text();
  } catch {}
  return { status: r.status, body, range: r.headers.get("content-range") };
}

console.log("=== 1. 目标对象存在性（404 = 不存在；200/206 = 存在）===");
for (const t of TARGETS) {
  const r = await get(t + "?select=*&limit=1");
  const exists = r.status === 200 || r.status === 206;
  console.log(
    (exists ? "[存在]  " : "[不存在]") +
      " " +
      t.padEnd(28) +
      " HTTP " +
      r.status +
      (exists ? "" : "  " + r.body.slice(0, 90).replace(/\s+/g, " "))
  );
}

console.log("\n=== 2. suppliers.verification_level 列 ===");
const vl = await get("suppliers?select=verification_level&limit=1");
console.log("HTTP " + vl.status + "  " + vl.body.slice(0, 160).replace(/\s+/g, " "));

console.log("\n=== 3. 迁移前计数（Prefer: count=exact）===");
for (const t of COUNTS) {
  const r = await get(t + "?select=*&limit=1", { Prefer: "count=exact" });
  console.log(t.padEnd(24) + " HTTP " + r.status + "  count=" + (r.range ?? "-"));
}

console.log("\n=== 4. 现有供应商 legacy 声明 ===");
const s = await get(
  "suppliers?select=slug,verification_status,audit_status,certifications,risk_score&order=slug"
);
console.log(s.body);
