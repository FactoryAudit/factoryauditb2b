// CS-07 §7 补充：用 anon key（浏览器同款）做**行为级** RLS 基线探测
// 纯 GET，只读。对比 anon 可见行数 vs service_role 全量行数 → 反推 RLS 是否开启及策略效果。
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !ANON || !SVC) { console.error("MISSING ENV"); process.exit(1); }

const TABLES = ["profiles", "memberships", "suppliers", "supplier_capabilities", "supplier_evidence",
  "supplier_documents", "supplier_certifications", "supplier_audits", "saved_suppliers", "profile_views",
  "rfqs", "rfq_matches", "stripe_events", "admin_audit_log", "certification_program_alias", "schema_migrations"];

const L = [];
const log = (...a) => { const s = a.map(String).join(" "); L.push(s); console.log(s); };

async function get(key, path) {
  try {
    const res = await fetch(BASE + path, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
    });
    const n = (() => {
      const mcr = res.headers.get("content-range") || "";
      const m = /\/(\d+)$/.exec(mcr);
      return m ? Number(m[1]) : null;
    })();
    return { status: res.status, n, cr: res.headers.get("content-range") || "-", text: await res.text() };
  } catch (e) { return { status: 0, n: null, cr: "-", text: "ERR " + e.message }; }
}

log(`BASE = ${BASE}`);
log(`anon = ${ANON.slice(0, 14)}… (len ${ANON.length})   service = ${SVC.slice(0, 12)}…`);
log("");
log("表".padEnd(30) + "svc".padStart(6) + "anon".padStart(7) + "  anon HTTP   content-range(anon)     行为判定");
log("-".repeat(120));

const findings = {};
for (const t of TABLES) {
  const s = await get(SVC, `/rest/v1/${t}?select=*&limit=1000`);
  await new Promise((z) => setTimeout(z, 80));
  const a = await get(ANON, `/rest/v1/${t}?select=*&limit=1000`);

  let verdict;
  if (s.status === 404) verdict = "表不存在";
  else if (a.status === 401 || a.status === 403) verdict = "anon 被 GRANT 拒绝（401/403）";
  else if (a.status >= 400) verdict = `anon HTTP ${a.status} → anon 被拒（${JSON.parse(a.text || "{}").code || "?"}）`;
  else if (a.n === 0 && s.n > 0) verdict = "★ RLS 开启：anon 看不到任何行";
  else if (a.n === 0 && s.n === 0) verdict = "表为空（RLS 有无不可辨）";
  else if (a.n !== null && s.n !== null && a.n < s.n) verdict = `★ RLS 开启：anon 只见 ${a.n}/${s.n}（策略过滤生效）`;
  else if (a.n === s.n && s.n > 0) verdict = "⚠️ anon 可见全量 → 该表 RLS 未开启（或被宽松策略放行）";
  else verdict = `未判定 svc=${s.n} anon=${a.n} anonStatus=${a.status}`;

  findings[t] = { svc: s.n, anon: a.n, anonStatus: a.status, verdict };
  log(t.padEnd(30) + String(s.n).padStart(6) + String(a.n).padStart(7) + `  ${String(a.status).padEnd(11)} ${a.cr.padEnd(24)} ${verdict}`);
  await new Promise((z) => setTimeout(z, 90));
}

log("");
log("=== 说明 ===");
log("· anon 使用 NEXT_PUBLIC_SUPABASE_ANON_KEY（= 浏览器公开 key），全程只 GET。");
log("· anon 可见数与 service_role 全量数的差异 = RLS + 策略在真实库上的**行为证据**。");
log("· 本基线在 008 迁移后必须完全不变（除 leads 自身）。");
log("· leads 表当前不存在，故不在此列表。");

await new Promise((z) => setTimeout(z, 100));
log("");
log("=== leads 表 anon 视角（预期 404：表不存在）===");
{
  const a = await get(ANON, "/rest/v1/leads?select=*&limit=1");
  const s = await get(SVC, "/rest/v1/leads?select=*&limit=1");
  log(`  anon → HTTP ${a.status}   ${a.text.slice(0, 160)}`);
  log(`  svc  → HTTP ${s.status}   ${s.text.slice(0, 160)}`);
}

const fs = await import("node:fs");
fs.writeFileSync("C:/Users/35726/AppData/Local/Temp/cs07-anon-rls.txt", L.join("\n") + "\n", "utf8");
fs.writeFileSync("C:/Users/35726/AppData/Local/Temp/cs07-anon-rls.json", JSON.stringify(findings, null, 2), "utf8");
console.log("\nsaved: Temp/cs07-anon-rls.txt / .json");
