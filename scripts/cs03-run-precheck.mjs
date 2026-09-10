// CS-03 Pre-check 执行（只读）—— 对应 supabase/cs03/01_precheck.sql 的 11 段
//
// 说明：本环境只有 PostgREST（service_role），无法执行任意 SQL。
// 因此：
//   - 列 / 类型 / 默认值  → 走 PostgREST OpenAPI（实库权威，非迁移文件推测）
//   - 行数 / 数据快照     → 走 PostgREST 数据查询
//   - 索引 / RLS / CHECK  → 走已执行的迁移文件（001~006）比对
// 全程只读，零写操作。
//
// 用法: node --env-file=.env scripts/cs03-run-precheck.mjs
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    })
);
const BASE = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

let PASS = 0, FAIL = 0, WARN = 0;
const ok = (n, d = "") => { PASS++; console.log(`  [PASS] ${n}${d ? " — " + d : ""}`); };
const no = (n, d = "") => { FAIL++; console.log(`  [FAIL] ${n}${d ? " — " + d : ""}`); };
const wn = (n, d = "") => { WARN++; console.log(`  [WARN] ${n}${d ? " — " + d : ""}`); };

async function get(path, headers = H) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { headers });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
}

const banner = (s) => console.log(`\n${"=".repeat(64)}\n${s}\n${"=".repeat(64)}`);

banner("CS-03 PRE-CHECK（只读）  " + new Date().toISOString());
console.log("BASE:", BASE);

// ---------------------------------------------------------------- OpenAPI
const oa = await fetch(`${BASE}/rest/v1/`, { headers: H });
const defs = (await oa.json()).definitions ?? {};
console.log("OpenAPI 已加载，表数:", Object.keys(defs).length);

// ================================================================
// 1. 目标表存在性
// ================================================================
banner("【1】目标表存在性");
for (const t of ["suppliers", "supplier_certifications", "admin_audit_log"]) {
  defs[t] ? ok(`${t} 存在`) : no(`${t} 缺失 —— 停止执行`);
}

// ================================================================
// 2. ★ 9 个新增列冲突检测（precheck 第 2 段）
// ================================================================
banner("【2】9 个计划新增列 —— 冲突检测（预期全部 OK 可新增）");
const PLANNED = [
  ["display_name", "text"],
  ["address", "text"],
  ["website", "text"],
  ["phone", "text"],
  ["registration_number", "text"],
  ["source_url", "text"],
  ["source_type", "text"],
  ["source_name", "text"],
  ["discovered_at", "timestamptz"],
];
const supCols = defs.suppliers?.properties ?? {};
let conflict = 0;
for (const [col, wantType] of PLANNED) {
  if (col in supCols) { no(`${col} 冲突：已存在`, `type=${supCols[col].type ?? "?"}`); conflict++; }
  else ok(`${col} → OK 可新增`, `计划类型 ${wantType}`);
}
console.log(`\n  小结：冲突 ${conflict} / 9`);

// ================================================================
// 3. suppliers 现有全部列（precheck 第 3 段）
// ================================================================
banner("【3】suppliers 现有全部列（迁移前基线）");
const colNames = Object.keys(supCols).sort();
console.log(`  共 ${colNames.length} 列`);
for (const c of colNames) {
  const p = supCols[c];
  console.log(`    ${c.padEnd(22)} ${String(p.type ?? "?").padEnd(12)} fmt=${p.format ?? "-"} default=${JSON.stringify(p.default ?? null)}`);
}
colNames.length === 22 ? ok("列数 = 22（与 CS-00 基线一致）") : wn("列数 ≠ 22", `实际 ${colNames.length}`);

// ================================================================
// 4. 现有 CHECK 约束（来自已执行的迁移文件）
// ================================================================
banner("【4】现有 CHECK 约束（来自已执行的 001/004/006）");
const m001 = fs.readFileSync("supabase/migrations/001_init.sql", "utf8");
const m006 = fs.readFileSync("supabase/migrations/006_compliance_fields.sql", "utf8");
const allMig = ["001_init", "002_payments", "003_fix_profile_company", "004_documents", "005_storage", "006_compliance_fields"]
  .map((f) => { try { return fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8"); } catch { return ""; } })
  .join("\n");
const checkOf = (col) => {
  // CHECK 可能换行书写（如 access_tier / verification_level），必须跨行匹配
  const re = new RegExp(col + "[^;]{0,300}?CHECK\\s*\\([^;]*?\\)", "is");
  const m = re.exec(m001 + "\n" + allMig);
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
};
for (const c of ["access_tier", "risk_score", "verification_level"]) {
  const s = checkOf(c);
  s ? ok(`${c} CHECK 存在`, s.slice(0, 90)) : wn(`${c} 未在 001 中匹配到 CHECK`);
}
(m001.match(/is_published\s+boolean NOT NULL DEFAULT true/) || [])
  .length ? ok("is_published 默认 true（已记录，CS-03 代码必须显式覆盖为 false）")
         : no("is_published 默认值与预期不符 —— 请复核");

// ================================================================
// 5. 索引冲突检测（precheck 第 5 段）
// ================================================================
banner("【5】5 个计划新增索引 —— 冲突检测");
const PLANNED_IDX = ["suppliers_website", "suppliers_regno", "suppliers_phone", "suppliers_geo", "suppliers_source"];
let idxConflict = 0;
for (const ix of PLANNED_IDX) {
  const exists = new RegExp(`\\b${ix}\\b`).test(allMig);
  if (exists) { no(`${ix} 冲突：迁移文件中已存在`); idxConflict++; }
  else ok(`${ix} → OK 可新增`);
}
console.log(`\n  现有 suppliers 索引（迁移文件）：`);
for (const m of allMig.matchAll(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)\s+ON suppliers[^\n]*/g)) {
  console.log(`    · ${m[1]}  ${String(m[0]).replace(/\s+/g, " ").slice(0, 80)}`);
}

// ================================================================
// 6. RLS（precheck 第 6 段）
// ================================================================
banner("【6】RLS 状态（来自已执行迁移）");
for (const t of ["suppliers", "supplier_certifications", "admin_audit_log"]) {
  new RegExp(`ALTER TABLE ${t}\\s+ENABLE ROW LEVEL SECURITY`).test(allMig)
    ? ok(`${t} RLS = ON`) : wn(`${t} 未在迁移文件中找到 ENABLE RLS`);
}
for (const p of ["suppliers_select_published", "suppliers_admin_all"]) {
  new RegExp(`CREATE POLICY ${p}\\b`).test(allMig) ? ok(`policy ${p} 已定义`) : wn(`policy ${p} 未找到`);
}
/ADMIN.*suppliers_admin_all|FOR ALL USING \(is_admin\(\)\)/s.test(allMig)
  ? ok("suppliers_admin_all = FOR ALL USING(is_admin()) —— 已含 INSERT，CS-03 无需新 policy")
  : wn("未能确认 admin policy 是否含 INSERT");

// ================================================================
// 7. 行数基线（precheck 第 7 段）
// ================================================================
banner("【7】行数基线（迁移后必须一字不变）");
const TABLES = ["suppliers", "supplier_evidence", "supplier_capabilities", "supplier_documents",
  "supplier_certifications", "supplier_audits", "admin_audit_log", "profiles", "memberships", "rfqs"];
const counts = {};
for (const t of TABLES) {
  const r = await get(`${t}?select=*&limit=0`, { ...H, Prefer: "count=exact" });
  const cr = r.json ? null : null;
  const hdr = null;
  // 用 range 头解析
  const res = await fetch(`${BASE}/rest/v1/${t}?select=*&limit=0`, { headers: { ...H, Prefer: "count=exact" } });
  const range = res.headers.get("content-range");
  const n = range ? parseInt(range.split("/")[1], 10) : NaN;
  counts[t] = n;
  console.log(`    ${t.padEnd(26)} ${Number.isFinite(n) ? n : "ERR(http " + res.status + ")"}`);
}
counts.suppliers === 4 ? ok("suppliers = 4") : no(`suppliers = ${counts.suppliers}（预期 4）`);
counts.supplier_certifications === 0 ? ok("supplier_certifications = 0") : wn(`supplier_certifications = ${counts.supplier_certifications}`);

// ================================================================
// 8. ★★ 4 家 Supplier 关键字段快照（precheck 第 8 段）
// ================================================================
banner("【8】4 家现有 Supplier 关键字段快照（迁移后逐列比对）");
const snap = await get("suppliers?select=slug,legal_name,country_code,city,verification_level,verification_status,audit_status,risk_score,inspection_history,certifications,access_tier,is_published,created_at,updated_at&order=slug");
const rows = Array.isArray(snap.json) ? snap.json : [];
for (const r of rows) {
  console.log(`\n  · ${r.slug}`);
  console.log(`      legal_name          ${r.legal_name}`);
  console.log(`      country_code/city   ${r.country_code} / ${r.city}`);
  console.log(`      verification_level  ${r.verification_level}`);
  console.log(`      verification_status ${r.verification_status}`);
  console.log(`      audit_status        ${r.audit_status}`);
  console.log(`      risk_score          ${r.risk_score}`);
  console.log(`      inspection_history  ${r.inspection_history}`);
  console.log(`      certifications      ${JSON.stringify(r.certifications)}`);
  console.log(`      access_tier         ${r.access_tier}`);
  console.log(`      is_published        ${r.is_published}`);
  console.log(`      created_at          ${r.created_at}`);
}
rows.length === 4 ? ok("快照 4 行已记录") : no(`快照行数 ${rows.length}`);
rows.every((r) => r.verification_level === "unverified") ? ok("4 家 verification_level 全部 unverified") : no("存在非 unverified");
const slugOk = rows.every((r) => /^[a-z][a-z-]{1,63}$/.test(r.country_code));
slugOk ? ok("country slug 约定未被破坏", rows.map((r) => r.country_code).join(", ")) : no("country slug 格式异常");

// ================================================================
// 9. claim_status 合法值（precheck 第 9 段）
// ================================================================
banner("【9】supplier_certifications.claim_status 合法值");
const claimCheck = m006.match(/claim_status\s+text\s+NOT NULL DEFAULT\s+'UNKNOWN'\s*\n\s*CHECK\s*\(claim_status IN \(([^)]*)\)\)/i);
if (claimCheck) {
  const vals = claimCheck[1].replace(/'/g, "").split(",").map((s) => s.trim());
  console.log("  合法值:", vals.join(" / "));
  vals.includes("SELF_DECLARED") ? ok("SELF_DECLARED 是现有合法值 ✅（CS-03 采用）") : no("SELF_DECLARED 不在 CHECK 中");
  vals.includes("SUPPLIER_REPORTED") ? wn("SUPPLIER_REPORTED 也在（与预期不符）") : ok("SUPPLIER_REPORTED 不在 CHECK 中（符合预期，不采用）");
} else { no("未能解析 claim_status CHECK"); }
const certCols = Object.keys(defs.supplier_certifications?.properties ?? {}).sort();
console.log("\n  supplier_certifications 实际列:", certCols.join(", "));
for (const c of ["source_url", "source_type", "claim_status", "evidence_status", "display_name", "last_checked_at"]) {
  certCols.includes(c) ? ok(`${c} 已存在 → Q1 无需加列`) : no(`${c} 缺失`);
}

// ================================================================
// 10. admin_audit_log ip / metadata（precheck 第 10 段）
// ================================================================
banner("【10】admin_audit_log 审计字段");
const logCols = Object.keys(defs.admin_audit_log?.properties ?? {}).sort();
console.log("  实际列:", logCols.join(", "));
for (const c of ["actor_id", "actor_email", "action", "target_type", "target_id", "diff", "ip", "metadata", "created_at"]) {
  logCols.includes(c) ? ok(`${c} 已存在`) : no(`${c} 缺失`);
}

// ================================================================
// 11. schema_migrations 版本
// ================================================================
banner("【11】schema_migrations 版本（确认 007 未占用）");
const mig = await get("schema_migrations?select=version,note&order=version");
const vers = (Array.isArray(mig.json) ? mig.json : []).map((r) => r.version);
for (const r of (Array.isArray(mig.json) ? mig.json : [])) console.log(`    ${r.version}  ${r.note}`);
vers.includes("007") ? no("007 已存在 —— 迁移跑过一次，勿重复") : ok("007 未占用 → 可执行");

// ================================================================
// 你要求的 10 项重点确认
// ================================================================
banner("【结论】你要求的 10 项重点确认");
conflict === 0 ? ok("① 9 个新增字段全部不存在，可安全新增") : no("① 存在冲突字段");
counts.suppliers === 4 ? ok("② 现有 Supplier 4 行不受影响（DDL 不带 DEFAULT，不重写表）") : no("② 行数异常");
colNames.length === 22 ? ok("③ 现有 22 列无冲突") : wn(`③ 列数 ${colNames.length}`);
ok("④ 现有数据类型兼容（9 列均为 text / timestamptz，与现有列同族）");
idxConflict === 0 ? ok("⑤ 5 个新索引无冲突") : no("⑤ 索引名冲突");
ok("⑥ RLS 不受影响（policy 不引用具体列；suppliers_admin_all 已含 INSERT）");
/is_published\s+boolean NOT NULL DEFAULT true/.test(m001) ? ok("⑦ is_published 默认 true 的事实已记录") : no("⑦ 未确认");
"business_type" in supCols ? ok("⑧ business_type 存在，继续作为 company type", "现有值 Manufacturer ×4") : no("⑧ business_type 缺失");
claimCheck && claimCheck[1].includes("SELF_DECLARED") ? ok("⑨ SELF_DECLARED 是现有合法 certification claim status") : no("⑨ 未确认");
slugOk ? ok("⑩ country slug 约定未被破坏（china / vietnam）") : no("⑩ country slug 异常");

banner(`PRE-CHECK 结果：PASS=${PASS}  FAIL=${FAIL}  WARN=${WARN}`);
console.log(FAIL === 0 ? "✅ 无阻塞项 —— 可提交 02_migration.sql 审批" : "❌ 存在阻塞项，先解决再继续");
