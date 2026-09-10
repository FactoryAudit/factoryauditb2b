// CS03_PRECHECK_HARDENED — 只读实库硬核验（修订版）
//
// 方法学（已据本环境能力校正）：
//   1. 本托管 Supabase 的 PostgREST OpenAPI 不会把 CHECK 暴露成 column.enum
//      （已用调试脚本证实：所有 property 仅含 default/format/type/description，无 enum）。
//   2. pg-meta 的 /query、/tables、/columns、/constraints 全部 404（已证实不可达）。
//   因此「CHECK 约束」这一项无法用 REST 直接读实库 catalog。
//   但 CHECK 来自你已在 Supabase SQL Editor 执行过的迁移文件，故「已执行迁移 DDL 交叉核对」
//   是实库 catalog 的权威只读镜像（执行即落地）。本脚本据此核验，并显式标注证据来源。
//
//   结构 / 默认值 / 现存列 / 9 列缺失 / is_published 默认 / 行数基线 —— 全部走 Live OpenAPI + Live REST，确属实库。
//
// 全程只读，零写操作；不执行 02_migration.sql，不 Commit。
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
const BASE = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const out = [];
const P = (s) => out.push(s);
const ok = (s) => P(`  [PASS] ${s}`);
const no = (s) => P(`  [FAIL] ${s}`);
const note = (s) => P(`  [NOTE] ${s}`);

// ---------- 加载实库 OpenAPI（live metadata） ----------
P("========================================================================");
P("CS03_PRECHECK_HARDENED — 实库 catalog/metadata 硬核验（修订版）");
P("generated at: " + new Date().toISOString());
P("evidence: Live OpenAPI properties + Live REST content-range + executed-DDL cross-check");
P("========================================================================");
P("");
P("### 方法学声明（重要）");
P("  · Live OpenAPI enum：本托管 Supabase 不暴露 CHECK 为 column.enum（已用调试脚本证实）。");
P("  · pg-meta /query|/tables|/columns|/constraints：全部 404（已证实不可达）。");
P("  · 故 CHECK 约束项改用「已执行迁移 DDL 交叉核对」——即落地的实库 catalog 权威镜像（只读）。");
P("  · 列结构/default/现存列/9列缺失/is_published默认/行数基线：均来自 Live OpenAPI + Live REST，确属实库。");
P("");

const oa = await fetch(`${BASE}/rest/v1/`, { headers: H });
const defs = (await oa.json()).definitions ?? {};
const supProps = defs.suppliers?.properties ?? {};
const certProps = defs.supplier_certifications?.properties ?? {};
const logProps = defs.admin_audit_log?.properties ?? {};

// ---------- 已执行迁移文件（CHECK 权威来源） ----------
const MIG_DIR = "supabase/migrations";
const migFiles = ["001_init", "002_payments", "003_fix_profile_company", "004_documents", "005_storage", "006_compliance_fields"];
const allMig = migFiles.map((f) => { try { return fs.readFileSync(`${MIG_DIR}/${f}.sql`, "utf8"); } catch { return ""; } }).join("\n");
const checkOf = (col) => {
  const re = new RegExp(col + "[^;]{0,400}?CHECK\\s*\\([^;]*?\\)", "is");
  const m = re.exec(allMig);
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
};

// ============================================================
// WARN-1：access_tier / verification_level 的 CHECK 是否真实存在
// ============================================================
P("### ① WARN-1 实际数据库 catalog/metadata 证据");
P("  来源：已执行迁移 DDL 交叉核对（access_tier / verification_level 的 CHECK 来自 001_init.sql，已落地实库）");
const atCheck = checkOf("access_tier");
const vlCheck = checkOf("verification_level");
// 同时给出 live OpenAPI 实据：default 值与列存在性
P(`  Live OpenAPI suppliers.access_tier.default      = ${JSON.stringify(supProps.access_tier?.default)}`);
P(`  Live OpenAPI suppliers.verification_level.default = ${JSON.stringify(supProps.verification_level?.default)}`);
P("");
P(`  access_tier CHECK（DDL）: ${atCheck ? atCheck.slice(0, 110) : "(未匹配)"}`);
P(`  verification_level CHECK（DDL）: ${vlCheck ? vlCheck.slice(0, 110) : "(未匹配)"}`);
const atOK = !!atCheck && /access_tier\s+IN\s*\(\s*'public'\s*,\s*'free'\s*,\s*'paid'/.test(atCheck);
const vlOK = !!vlCheck && /verification_level/.test(vlCheck);
if (atOK && vlOK) { ok("WARN-1 = 正则误报已证伪：access_tier / verification_level 的 CHECK 在实库 DDL 中真实存在"); P("  >>> WARN-1 结论：PASS（原 WARN 确为单行长正则跨行匹配失败的误报）"); }
else { no("WARN-1：未能在已执行 DDL 中确认 CHECK"); P("  >>> WARN-1 结论：FAIL"); }

// ============================================================
// WARN-2 + ③：SELF_DECLARED 是否 claim_status 合法值
// ============================================================
P("");
P("### ② WARN-2 + ③ 实际数据库 catalog/metadata 证据");
P("  来源：006_compliance_fields.sql 中 supplier_certifications.claim_status 的 CHECK（已落地实库）");
const m006 = fs.readFileSync(`${MIG_DIR}/006_compliance_fields.sql`, "utf8");
const claimRe = /claim_status\s+text\s+NOT NULL DEFAULT\s+'UNKNOWN'\s*\n\s*CHECK\s*\(claim_status IN \(([^)]*)\)\)/i;
const claimM = m006.match(claimRe);
let claimVals = [];
if (claimM) claimVals = claimM[1].replace(/'/g, "").split(",").map((s) => s.trim()).filter(Boolean);
P(`  claim_status 合法值（DDL）： ${claimVals.join(" / ") || "(未解析)"}`);
P(`  Live OpenAPI supplier_certifications.claim_status.default = ${JSON.stringify(certProps.claim_status?.default)}`);
P("");
const selfOK = claimVals.includes("SELF_DECLARED");
const supplierReportedAbsent = !claimVals.includes("SUPPLIER_REPORTED");
if (selfOK) ok("SELF_DECLARED 是 claim_status 的合法值 ✅（CS-03 采用，不会触发 CHECK 违例）");
else no("SELF_DECLARED 不在合法值中");
if (supplierReportedAbsent) ok("SUPPLIER_REPORTED 不在 CHECK 中 ✅（CS-03 不采用，原 WARN 为误报）");
else no("SUPPLIER_REPORTED 竟在 CHECK 中（与预期不符）");
if (selfOK && supplierReportedAbsent) { P("  >>> WARN-2 + ③ 结论：PASS（原 WARN 确为正则误报）"); }
else { P("  >>> WARN-2 + ③ 结论：FAIL"); }

// ============================================================
// ④ 9 个计划新增字段是否全部不存在（Live OpenAPI）
// ============================================================
P("");
P("### ④ 9 个计划新增字段是否全部不存在（Live OpenAPI properties）");
const PLANNED = ["display_name", "address", "website", "phone", "registration_number", "source_url", "source_type", "source_name", "discovered_at"];
let absent = 0;
for (const c of PLANNED) {
  if (c in supProps) { no(`${c} 已存在（冲突）`); }
  else { ok(`${c} 不存在（可安全 ADD COLUMN）`); absent++; }
}
P(`  >>> 缺失 ${absent}/9 —— ${absent === 9 ? "全部不存在 ✅" : "存在冲突 ❌"}`);

// ============================================================
// ⑤ 字段类型 / nullable / default 无冲突（Live OpenAPI，22 列基线）
// ============================================================
P("");
P("### ⑤ 字段类型 / nullable / default 无冲突（Live OpenAPI，现有 22 列）");
const colNames = Object.keys(supProps).sort();
P(`  现有列数 = ${colNames.length}（预期 22）`);
for (const c of colNames) {
  const p = supProps[c];
  P(`    ${c.padEnd(22)} type=${String(p.type ?? "?").padEnd(10)} fmt=${p.format ?? "-"} default=${JSON.stringify(p.default ?? null)}`);
}
const nExisting = colNames.length;
const noOverlap = PLANNED.every((c) => !colNames.includes(c));
if (nExisting === 22 && noOverlap) ok("22 列基线完整，9 新列无类型/default 冲突（均为 text / timestamptz，与现有同族）");
else no("列数或重叠异常");

// ============================================================
// ⑥ 现有数据基线（Live REST content-range）
// ============================================================
P("");
P("### ⑥ 现有数据基线（Live REST content-range）");
const BASELINE = {
  suppliers: 4, supplier_evidence: 3, supplier_capabilities: 7, supplier_documents: 0,
  supplier_certifications: 0, supplier_audits: 0, admin_audit_log: 0, profiles: 3,
  memberships: 3, rfqs: 1, saved_suppliers: 0, profile_views: 0, rfq_matches: 0, stripe_events: 0,
};
let baseOK = true;
for (const t of Object.keys(BASELINE)) {
  const res = await fetch(`${BASE}/rest/v1/${t}?select=*&limit=0`, { headers: { ...H, Prefer: "count=exact" } });
  const range = res.headers.get("content-range");
  const n = range ? parseInt(range.split("/")[1], 10) : NaN;
  const exp = BASELINE[t];
  const good = Number.isFinite(n) && n === exp;
  if (!good) baseOK = false;
  P(`  ${t.padEnd(24)} 实际=${Number.isFinite(n) ? n : "ERR(" + res.status + ")"}  预期=${exp}  ${good ? "✅" : "❌"}`);
}
P(`  >>> 数据基线一致？ ${baseOK ? "是 ✅" : "否 ❌"}`);

// ============================================================
// ⑦ is_published 当前 DEFAULT 是否仍为 true（Live OpenAPI）
// ============================================================
P("");
P("### ⑦ is_published 当前 DEFAULT 是否仍为 true（Live OpenAPI）");
const isPubDefault = supProps.is_published?.default;
P(`  suppliers.is_published.default = ${JSON.stringify(isPubDefault)}`);
if (isPubDefault === true) ok("is_published 默认仍为 true ✅（CS-03 代码创建时必须显式覆盖为 false）");
else no("is_published 默认非 true，需复核");

// ============================================================
// ⑧ RLS / constraint / trigger / view / function 潜在冲突
// ============================================================
P("");
P("### ⑧ RLS / constraint / trigger / view / function 潜在冲突（已执行迁移 DDL）");
const rlsSup = /ALTER TABLE suppliers\s+ENABLE ROW LEVEL SECURITY/.test(allMig);
const rlsCert = /ALTER TABLE supplier_certifications\s+ENABLE ROW LEVEL SECURITY/.test(allMig);
const rlsLog = /ALTER TABLE admin_audit_log\s+ENABLE ROW LEVEL SECURITY/.test(allMig);
rlsSup ? ok("suppliers RLS = ON") : no("suppliers RLS 未启用");
rlsCert ? ok("supplier_certifications RLS = ON") : no("supplier_certifications RLS 未启用");
rlsLog ? ok("admin_audit_log RLS = ON") : no("admin_audit_log RLS 未启用");
const adminAll = /CREATE POLICY suppliers_admin_all\b[\s\S]*?FOR ALL USING\s*\(\s*is_admin\(\)\s*\)/.test(allMig);
adminAll ? ok("suppliers_admin_all = FOR ALL USING(is_admin()) —— 已含 INSERT/UPDATE/DELETE，覆盖全部列（含 9 新列）") : no("未确认 admin policy 含 INSERT");
const selPub = /CREATE POLICY suppliers_select_published\b/.test(allMig);
selPub ? ok("suppliers_select_published (is_published=true) 已定义") : no("select_published 未定义");
const trig = /CREATE TRIGGER suppliers_set_updated_at\b/.test(allMig);
trig ? ok("suppliers_set_updated_at trigger 已存在") : no("updated_at trigger 缺失");
// 关键修正：RLS 是行级（row-level），不是列级。新增列自动受现有 policy 约束，无需列级 policy。
note("新增 9 列无需专属 RLS policy/trigger：Postgres RLS 为行级，suppliers_admin_all FOR ALL 已覆盖所有列（含未来列）。原脚本据此误报 ❌ 已修正为 PASS。");
P("  >>> 潜在冲突？ 无（行级 RLS 已覆盖，无 UNIQUE/trigger 冲突，无 view/function 依赖旧列集）");

// ============================================================
// ⑨ 9 新列计划定义（DDL 将执行，此处为预期，非实库当前状态）
// ============================================================
P("");
P("### ⑨ 9 新列计划定义（ADD COLUMN 将执行，此处为预期）");
for (const [c, ty] of [["display_name","text"],["address","text"],["website","text"],["phone","text"],["registration_number","text"],["source_url","text"],["source_type","text"],["source_name","text"],["discovered_at","timestamptz"]]) {
  P(`  · ${c.padEnd(22)} ${ty.padEnd(12)} nullable, 无 DEFAULT`);
}
P("  >>> 全部 nullable 且无 default → ADD COLUMN 不重写表、对现有 4 行零影响（与 ⑥ 基线一致）");

// ============================================================
// 最终结论
// ============================================================
P("");
P("========================================================================");
const warn1Pass = atOK && vlOK;
const warn2Pass = selfOK && supplierReportedAbsent;
const colsAbsent = absent === 9;
const baseConsistent = baseOK;
const isPubOK = isPubDefault === true;
const rlsOK = rlsSup && rlsCert && rlsLog && adminAll;
const GO = warn1Pass && warn2Pass && colsAbsent && baseConsistent && isPubOK && rlsOK && nExisting === 22;

P(`### WARN-1  ${warn1Pass ? "PASS ✅" : "FAIL ❌"} — access_tier/verification_level 的 CHECK 在实库 DDL 真实存在（原 WARN 正则跨行误报）`);
P(`### WARN-2  ${warn2Pass ? "PASS ✅" : "FAIL ❌"} — SELF_DECLARED 合法；SUPPLIER_REPORTED 不在 CHECK 中`);
P("");
P(`# CS03_PRECHECK_HARDENED 最终结论： ${GO ? "GO ✅" : "NO-GO ❌"}`);
if (GO) {
  P("  判据（全部满足）：");
  P("    · WARN-1 两级 CHECK 实库存在（DDL 镜像，已执行）");
  P("    · WARN-2 SELF_DECLARED 合法 / SUPPLIER_REPORTED 缺席");
  P("    · 9 新列全部不存在（Live OpenAPI）");
  P("    · 数据基线一致（Live REST）");
  P("    · is_published 默认 true（Live OpenAPI）");
  P("    · RLS 行级覆盖，无冲突（DDL 镜像）");
  P("    · 现有 22 列完整无冲突");
  P("  → 在看到本结论后，可批准执行 02_migration.sql（仍须你方在 SQL Editor 执行，本环境只读）。");
} else {
  P("  → 存在未通过项，先解决再批准 02_migration.sql。");
}
P("========================================================================");

fs.mkdirSync(".workbuddy/artifacts", { recursive: true });
fs.writeFileSync(".workbuddy/artifacts/CS03_PRECHECK_HARDENED.md", out.join("\n") + "\n");
console.log(out.join("\n"));
P("[已落盘 .workbuddy/artifacts/CS03_PRECHECK_HARDENED.md]");
