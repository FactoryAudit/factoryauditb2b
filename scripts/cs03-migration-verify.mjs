// CS-03 Migration Verify / Regression —— 只读，零写操作
//
// 用途：用户在 Supabase SQL Editor 执行 02_migration.sql + 03_postcheck.sql 后，
//       本脚本跑实库只读比对，确认迁移符合预期（对应 deliverable 1-5）。
//   · 9 个新增字段是否已落地（Live OpenAPI properties，期望 22→31 列）
//   · 4 家现有 Supplier 关键字段是否一字未变（嵌入式 precheck 基线逐项比对）
//   · 14 张表行数是否对齐基线（迁移不带业务数据）
//   · is_published 默认是否仍为 true（Live OpenAPI）
//   · 9 新列对 4 家现有行必须全 NULL（ADD COLUMN 不带 default，不触碰旧行）
//   · RLS / 索引 / CHECK：来自已执行迁移 DDL 交叉核对（02_migration.sql + 001~006）
//
// 注意：本脚本只验证「可通过 REST/OpenAPI/DDL 镜像核实」的部分。
//       用户贴回的 03_postcheck.sql 文本输出由人工比对（见脚本末的对照清单）。
//
// 用法: node --env-file=.env scripts/cs03-migration-verify.mjs
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
let FAIL = 0;
const ok = (s) => P(`  [PASS] ${s}`);
const no = (s) => { FAIL++; P(`  [FAIL] ${s}`); };
const note = (s) => P(`  [NOTE] ${s}`);

// ---------- 嵌入式 precheck 基线（来自 CS03_PRECHECK_OUTPUT.md §8） ----------
const BASELINE_SNAPSHOT = {
  "dongguan-plastic-molding": {
    legal_name: "Dongguan Hengda Plastics Co., Ltd.", country_code: "china", city: "Dongguan",
    verification_level: "unverified", verification_status: "Identity Verified", audit_status: "Not yet audited",
    risk_score: 56, inspection_history: 9, certifications: ["ISO 9001"], access_tier: "public", is_published: true,
    created_at: "2026-09-03T16:39:06.326813+00:00",
  },
  "guangzhou-textile-factory": {
    legal_name: "Guangzhou Sunrise Textile Co., Ltd.", country_code: "china", city: "Guangzhou",
    verification_level: "unverified", verification_status: "Document Verified", audit_status: "Audited 2026-03",
    risk_score: 72, inspection_history: 28, certifications: ["BSCI", "WRAP", "OEKO-TEX"], access_tier: "public", is_published: true,
    created_at: "2026-09-03T16:39:05.597388+00:00",
  },
  "ho-chi-minh-garment": {
    legal_name: "Ho Chi Minh Garment JSC", country_code: "vietnam", city: "Ho Chi Minh",
    verification_level: "unverified", verification_status: "Identity Verified", audit_status: "Pending",
    risk_score: 59, inspection_history: 5, certifications: ["SMETA"], access_tier: "public", is_published: true,
    created_at: "2026-09-03T16:39:06.756207+00:00",
  },
  "shenzhen-precision-electronics": {
    legal_name: "Shenzhen Precision Electronics Co., Ltd.", country_code: "china", city: "Shenzhen",
    verification_level: "unverified", verification_status: "Factory Verified", audit_status: "Audited 2026-06",
    risk_score: 88, inspection_history: 42, certifications: ["ISO 9001", "SMETA", "CE"], access_tier: "public", is_published: true,
    created_at: "2026-09-03T16:39:04.903561+00:00",
  },
};
const BASELINE_COUNTS = {
  suppliers: 4, supplier_evidence: 3, supplier_capabilities: 7, supplier_documents: 0,
  supplier_certifications: 0, supplier_audits: 0, admin_audit_log: 0, profiles: 3,
  memberships: 3, rfqs: 1, saved_suppliers: 0, profile_views: 0, rfq_matches: 0, stripe_events: 0,
};
const PLANNED = [
  ["display_name", "text"], ["address", "text"], ["website", "text"], ["phone", "text"],
  ["registration_number", "text"], ["source_url", "text"], ["source_type", "text"],
  ["source_name", "text"], ["discovered_at", "timestamptz"],
];

P("========================================================================");
P("CS-03 MIGRATION VERIFY / REGRESSION（只读）  " + new Date().toISOString());
P("BASE: " + BASE);
P("========================================================================");

// ---------- Live OpenAPI ----------
const oa = await fetch(`${BASE}/rest/v1/`, { headers: H });
const defs = (await oa.json()).definitions ?? {};
const supProps = defs.suppliers?.properties ?? {};
const colNames = Object.keys(supProps).sort();
P(`\n### ① 列结构（Live OpenAPI）  现有列数 = ${colNames.length}（迁移前 22，期望 31）`);
colNames.length === 31 ? ok("列数 = 31（22 原 + 9 新）") : no(`列数 = ${colNames.length}，期望 31`);

P("\n### ② 9 个新增字段确认（Live OpenAPI properties）");
for (const [c, wantType] of PLANNED) {
  if (!(c in supProps)) { no(`${c} 缺失`); continue; }
  const p = supProps[c];
  const typeOk = (p.format ?? p.type) === wantType || (wantType === "timestamptz" && /timestamp/.test(p.format ?? p.type));
  const nullOk = p.default === null || p.default === undefined;
  if (typeOk && nullOk) ok(`${c} 已落地  type=${p.type ?? "?"} fmt=${p.format ?? "-"} default=${JSON.stringify(p.default ?? null)}`);
  else no(`${c} 类型/default 不符  type=${p.type} fmt=${p.format} default=${JSON.stringify(p.default)}`);
}

// ---------- 4 家快照比对 ----------
P("\n### ③ 4 家现有 Supplier 数据完整性（逐项比对 precheck 基线）");
const sel = "slug,legal_name,country_code,city,verification_level,verification_status,audit_status,risk_score,inspection_history,certifications,access_tier,is_published,created_at,updated_at" +
  ",display_name,address,website,phone,registration_number,source_url,source_type,source_name,discovered_at";
const r = await fetch(`${BASE}/rest/v1/suppliers?select=${encodeURIComponent(sel)}&order=slug`, { headers: H });
const _j = await r.json();
const rows = Array.isArray(_j) ? _j : [];
if (rows.length !== 4) no(`快照行数 = ${rows.length}，期望 4`);
const bySlug = Object.fromEntries(rows.map((x) => [x.slug, x]));
for (const [slug, base] of Object.entries(BASELINE_SNAPSHOT)) {
  const cur = bySlug[slug];
  if (!cur) { no(`${slug} 缺失`); continue; }
  const cmp = ["legal_name", "country_code", "city", "verification_level", "verification_status", "audit_status", "risk_score", "inspection_history", "certifications", "access_tier", "is_published", "created_at"];
  let allMatch = true;
  for (const k of cmp) {
    const a = JSON.stringify(base[k]), b = JSON.stringify(cur[k]);
    if (a !== b) { no(`${slug}.${k} 变更: 基线 ${a} → 现 ${b}`); allMatch = false; }
  }
  // 9 新列对旧行必须全 NULL
  for (const [c] of PLANNED) {
    if (cur[c] !== null && cur[c] !== undefined) { no(`${slug}.${c} 非 NULL（ADD COLUMN 不应触碰旧行）: ${JSON.stringify(cur[c])}`); allMatch = false; }
  }
  if (allMatch) ok(`${slug} 12 关键字段全一致 + 9 新列全 NULL ✅`);
}

// ---------- 行数基线 ----------
P("\n### ④ 行数基线（Live REST content-range）");
let baseOK = true;
for (const t of Object.keys(BASELINE_COUNTS)) {
  const res = await fetch(`${BASE}/rest/v1/${t}?select=*&limit=0`, { headers: { ...H, Prefer: "count=exact" } });
  const range = res.headers.get("content-range");
  const n = range ? parseInt(range.split("/")[1], 10) : NaN;
  const exp = BASELINE_COUNTS[t];
  if (Number.isFinite(n) && n === exp) ok(`${t.padEnd(24)} = ${n} ✅`);
  else { no(`${t.padEnd(24)} = ${Number.isFinite(n) ? n : "ERR(" + res.status + ")"}，期望 ${exp}`); baseOK = false; }
}
P(`  >>> 数据基线一致？ ${baseOK ? "是 ✅" : "否 ❌"}`);

// ---------- is_published 默认 ----------
P("\n### ⑤ is_published 当前 DEFAULT（Live OpenAPI）");
const isPubDefault = supProps.is_published?.default;
P(`  suppliers.is_published.default = ${JSON.stringify(isPubDefault)}`);
if (isPubDefault === true) ok("默认仍为 true（CS-03 新 Supplier 须显式写 false）");
else no("is_published 默认非 true，需复核");

// ---------- RLS / 索引 / CHECK（DDL 镜像） ----------
P("\n### ⑥ RLS / 索引 / CHECK（已执行迁移 DDL 交叉核对）");
const migFiles = ["001_init", "002_payments", "003_fix_profile_company", "004_documents", "005_storage", "006_compliance_fields"];
const allMig = migFiles.map((f) => { try { return fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8"); } catch { return ""; } }).join("\n");
let m02 = "";
try { m02 = fs.readFileSync("supabase/cs03/02_migration.sql", "utf8"); } catch { note("02_migration.sql 未找到（请确认已执行）"); }

/ALTER TABLE suppliers\s+ENABLE ROW LEVEL SECURITY/.test(allMig) ? ok("suppliers RLS = ON") : no("suppliers RLS 未确认");
/suppliers_admin_all\b[\s\S]*?FOR ALL USING\s*\(\s*is_admin\(\)\s*\)/.test(allMig) ? ok("suppliers_admin_all = FOR ALL USING(is_admin())（含 INSERT，覆盖新列）") : no("admin policy 未确认含 INSERT");
/verification_level\s+text\s+NOT NULL DEFAULT 'unverified'/.test(allMig) ? ok("verification_level 默认 unverified（安全默认值）") : no("verification_level 默认未确认");

// 5 个部分索引须在 02 中
const IDX = ["suppliers_website", "suppliers_regno", "suppliers_phone", "suppliers_geo", "suppliers_source"];
for (const ix of IDX) {
  new RegExp(`CREATE INDEX IF NOT EXISTS ${ix}\\b`).test(m02) ? ok(`索引 ${ix} 已在 02_migration.sql 定义`) : no(`索引 ${ix} 未在 02_migration.sql 找到`);
}
// 0 个 UNIQUE（用户 §十 明确要求）
const uniqueCount = (m02.match(/CREATE UNIQUE INDEX/gi) || []).length;
uniqueCount === 0 ? ok("02_migration.sql 中 UNIQUE 索引数 = 0（符合去重策略）") : no(`02_migration.sql 出现 ${uniqueCount} 个 UNIQUE 索引（与方案冲突）`);
// schema_migrations 版本 007
/new_version\s*=>\s*'007'|version\s*=\s*'007'|'007'/.test(m02) ? ok("02_migration.sql 登记 schema_migrations 版本 007") : note("02 中未显式匹配 '007'（以你执行的 SQL 为准）");

// ---------- 总结 ----------
P("\n========================================================================");
P(`# CS-03 MIGRATION VERIFY 结果：${FAIL === 0 ? "ALL PASS ✅" : "FAIL=" + FAIL + " ❌"}`);
if (FAIL === 0) {
  P("  自动验证全过。下一步：人工比对用户贴回的 03_postcheck.sql 文本输出（见下方对照清单）。");
} else {
  P("  存在未通过项，先诊断再继续，切勿写 POST API。");
}
P("");
P("### 人工比对清单（对照用户贴回的 03_postcheck.sql 输出）");
P("  [ ] A. 9 新列确认：各列 type/nullable 与 02_migration.sql 一致");
P("  [ ] B. 索引确认：5 个部分索引已创建，无意外 UNIQUE");
P("  [ ] C. RLS 未变：suppliers / supplier_certifications / admin_audit_log 的 policy 与迁移前一致");
P("  [ ] D. 4 家快照一致：slug/legal_name/verification_level/is_published 等逐项 == 本脚本 ③");
P("  [ ] E. 行数：suppliers=4 / supplier_evidence=3 / supplier_capabilities=7 / 其余证据/审计表=0");
P("  [ ] F. 证据表仍 0 行：supplier_certifications=0 / supplier_audits=0 / supplier_documents=0");
P("  [ ] G. schema_migrations 含版本 007");
P("========================================================================");

fs.mkdirSync(".workbuddy/artifacts", { recursive: true });
fs.writeFileSync(".workbuddy/artifacts/CS03_MIGRATION_VERIFY.md", out.join("\n") + "\n");
console.log(out.join("\n"));
P("[已落盘 .workbuddy/artifacts/CS03_MIGRATION_VERIFY.md]");
