// CS-02 Pre-check —— 只读审计（不写任何数据）
// 用法: node --env-file=.env scripts/cs02-audit.mjs
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);
const BASE = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SRV = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SRV, Authorization: "Bearer " + SRV, Accept: "application/json" };

async function q(path) {
  const r = await fetch(BASE + "/rest/v1/" + path, { headers: H });
  let j = null;
  try {
    j = await r.json();
  } catch {}
  return { status: r.status, data: j };
}

// ---------- 1. suppliers 全字段 ----------
console.log("=========== 1. suppliers 表全字段（4 家）===========");
const s = await q("suppliers?select=*&order=slug");
if (Array.isArray(s.data) && s.data.length) {
  console.log("列清单:", Object.keys(s.data[0]).join(", "));
  console.log("");
  for (const row of s.data) {
    console.log("--- " + row.slug + " ---");
    for (const [k, v] of Object.entries(row)) {
      console.log("  " + k + ": " + JSON.stringify(v));
    }
    console.log("");
  }
}

// ---------- 2. supplier_evidence ----------
console.log("=========== 2. supplier_evidence（3 行）===========");
const ev = await q("supplier_evidence?select=*");
if (Array.isArray(ev.data)) {
  for (const row of ev.data) console.log(JSON.stringify(row));
  console.log("合计: " + ev.data.length);
}

// ---------- 3. supplier_capabilities（7 行，含 verified + source）----------
console.log("\n=========== 3. supplier_capabilities（7 行）===========");
const cap = await q("supplier_capabilities?select=*");
if (Array.isArray(cap.data)) {
  for (const row of cap.data) console.log(JSON.stringify(row));
  console.log("合计: " + cap.data.length);
}

// ---------- 4. 3 张新证据表 ----------
console.log("\n=========== 4. CS-01 新建的 4 张表行数 ===========");
for (const t of ["supplier_documents", "supplier_certifications", "supplier_audits", "admin_audit_log"]) {
  const r = await fetch(BASE + "/rest/v1/" + t + "?select=*&limit=1", { headers: { ...H, Prefer: "count=exact" } });
  const cr = r.headers.get("content-range") || "";
  console.log(t.padEnd(26) + " " + cr);
}

// ---------- 5. 每家的证据/能力聚合 ----------
console.log("\n=========== 5. 按 supplier 聚合 ===========");
if (Array.isArray(s.data)) {
  for (const row of s.data) {
    const slug = row.slug;
    const evRows = Array.isArray(ev.data) ? ev.data.filter((x) => x.supplier_id === row.id || x.supplier_slug === slug || x.slug === slug) : [];
    const capRows = Array.isArray(cap.data) ? cap.data.filter((x) => x.supplier_id === row.id || x.supplier_slug === slug || x.slug === slug) : [];
    console.log("\n### " + slug);
    console.log("  verification_status : " + row.verification_status);
    console.log("  audit_status        : " + row.audit_status);
    console.log("  certifications      : " + JSON.stringify(row.certifications));
    console.log("  verification_level  : " + row.verification_level);
    console.log("  evidence 行数        : " + evRows.length);
    console.log("  capabilities 行数    : " + capRows.length);
    for (const c of capRows) {
      console.log("     - " + (c.capability ?? c.name ?? JSON.stringify(c)) + "  verified=" + c.verified + "  source=" + c.source);
    }
    for (const e of evRows) {
      console.log("     * evidence: " + JSON.stringify(e));
    }
  }
}
