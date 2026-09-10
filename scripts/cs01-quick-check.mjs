// One-off cross-check: 验证 schema_migrations 全量行 + 关键事实
import fs from "node:fs";
const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);
const B = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: "Bearer " + K, Accept: "application/json" };

async function main() {
  // 1. schema_migrations
  const r1 = await fetch(B + "/rest/v1/schema_migrations?select=version,note&order=version", { headers: H });
  const d1 = JSON.parse(await r1.text());
  console.log("[1] schema_migrations 行数:", d1.length);
  for (const x of d1) console.log("    " + x.version + "  " + x.note);

  // 2. 3 张证据表行数（必须 0）
  for (const t of ["supplier_documents", "supplier_certifications", "supplier_audits", "admin_audit_log"]) {
    const r = await fetch(B + "/rest/v1/" + t + "?select=*&limit=1", { headers: { ...H, Prefer: "count=exact" } });
    const cr = r.headers.get("content-range");
    console.log("[2] " + t + ": " + cr);
  }

  // 3. 4 家 supplier verification_level
  const r3 = await fetch(B + "/rest/v1/suppliers?select=slug,verification_level&order=slug", { headers: H });
  const d3 = JSON.parse(await r3.text());
  console.log("[3] suppliers.verification_level:");
  for (const x of d3) console.log("    " + x.slug + "  " + x.verification_level);

  // 4. certification_program_alias 总数 + OEKO-TEX
  const r4 = await fetch(B + "/rest/v1/certification_program_alias?select=display_name,program_code,mapped", { headers: H });
  const d4 = JSON.parse(await r4.text());
  console.log("[4] certification_program_alias 总数:", d4.length);
  const oe = d4.find((x) => x.display_name === "OEKO-TEX");
  console.log("    OEKO-TEX:", oe ? `${oe.mapped} / ${oe.program_code}` : "NOT FOUND");

  // 5. storage bucket
  const r5 = await fetch(B + "/storage/v1/bucket/supplier-docs", { headers: H });
  const d5 = await r5.json();
  console.log("[5] supplier-docs:", d5);

  // 6. 10 张业务表行数对齐 precheck
  console.log("[6] 业务表行数 vs precheck 基准:");
  const baseline = { suppliers: 4, supplier_evidence: 3, supplier_capabilities: 7, profiles: 3, memberships: 3, rfqs: 1, saved_suppliers: 0, profile_views: 0, rfq_matches: 0, stripe_events: 0 };
  for (const t of Object.keys(baseline)) {
    const r = await fetch(B + "/rest/v1/" + t + "?select=*&limit=1", { headers: { ...H, Prefer: "count=exact" } });
    const cr = r.headers.get("content-range");
    const total = cr.includes("/") ? Number(cr.split("/")[1]) : NaN;
    const ok = total === baseline[t] ? "✅" : "❌";
    console.log("    " + ok + "  " + t.padEnd(24) + " now=" + total + "  baseline=" + baseline[t]);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
