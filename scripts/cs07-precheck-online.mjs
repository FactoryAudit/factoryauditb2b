// CS-07 / 01_precheck.sql 的「REST + OpenAPI 可达子集」在线只读探针
// 仅用 service_role 做 GET / POST-RPC 只读调用，不做任何写入。
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error("MISSING ENV"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const L = [];
const log = (...a) => { const s = a.map(String).join(" "); L.push(s); console.log(s); };
const sec = (t) => { log(""); log("=".repeat(78)); log(t); log("=".repeat(78)); };

async function req(path, opts = {}) {
  try {
    const res = await fetch(BASE + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
    return { status: res.status, h: res.headers, text: await res.text() };
  } catch (e) { return { status: 0, h: new Map(), text: "ERR " + e.message }; }
}
const cr = (r) => r.h.get("content-range") || "-";

log(`BASE = ${BASE}`);
log(`KEY  = ${KEY.slice(0, 12)}… (len ${KEY.length})  只读探针，无任何写入`);

// ---------------------------------------------------------------- 1
sec("[1] leads 相关对象是否已被占用（REST 只能验『表』，索引/约束/触发器/policy 需 SQL）");
{
  const r = await req("/rest/v1/leads?select=*&limit=1");
  const verdict = r.status === 404 ? "NOT EXISTS ✅ 可创建"
    : r.status === 200 || r.status === 206 ? "EXISTS ❌ 停止执行 —— 可能迁移跑过一次"
    : `无法判定 status=${r.status}`;
  log(`public.leads 表                 : ${verdict}   [HTTP ${r.status} ${cr(r)}]`);
  if (r.status !== 404 && r.text) log(`    body: ${r.text.slice(0, 300)}`);

  const r2 = await req("/rest/v1/lead_events?select=*&limit=1");
  log(`public.lead_events 表（不应存在）: ${r2.status === 404 ? "NOT EXISTS ✅" : "EXISTS ⚠️ 需排查"}   [HTTP ${r2.status}]`);

  const r3 = await req("/rest/v1/lead_status?select=*&limit=1");
  log(`public.lead_status 表（不应存在）: ${r3.status === 404 ? "NOT EXISTS ✅" : "EXISTS ⚠️ 需排查"}   [HTTP ${r3.status}]`);
}

// ---------------------------------------------------------------- 2
sec("[2] 依赖对象（REST 只能验 profiles + 函数是否被 PostgREST 暴露为 RPC）");
{
  const r = await req("/rest/v1/profiles?select=*&limit=1");
  log(`profiles 表                     : ${r.status === 200 || r.status === 206 ? "EXISTS ✅" : "MISSING ❌ " + r.status}`);

  // OpenAPI 里 /rpc/* 就是 public schema 里可被 PostgREST 调用的函数清单
  const oa = await req("/rest/v1/", { headers: { Accept: "application/openapi+json" } });
  let rpcs = [];
  let defs = {};
  try {
    const j = JSON.parse(oa.text);
    rpcs = Object.keys(j.paths || {}).filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5));
    defs = j.definitions || j.components?.schemas || {};
  } catch (e) { log("OpenAPI 解析失败: " + e.message); }
  log(`PostgREST 暴露的 RPC（= public 函数）: [${rpcs.join(", ") || "无"}]`);
  log(`  · is_admin()       : ${rpcs.includes("is_admin") ? "EXISTS ✅（以 RPC 形式）" : "未被暴露（可能带参数/返回 trigger 型）"}`);
  log(`  · set_updated_at() : ${rpcs.includes("set_updated_at") ? "EXISTS ✅" : "未被暴露（trigger 函数通常不暴露，不能据此判 MISSING）"}`);

  // 直接打一次 is_admin（无副作用，纯读）
  const ia = await req("/rest/v1/rpc/is_admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  log(`POST /rpc/is_admin → HTTP ${ia.status}  body=${ia.text.slice(0, 200)}`);

  const su = await req("/rest/v1/rpc/set_updated_at", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  log(`POST /rpc/set_updated_at → HTTP ${su.status}  body=${su.text.slice(0, 200)}`);
  log("（注：pgcrypto / gen_random_uuid 无法经 REST 验证，见 §DDL镜像 交叉核对）");
  globalThis.__defs = defs;
}

// ---------------------------------------------------------------- 3
sec("[3] 16 张表行数基线（迁移后必须一字不变）");
const TABLES = ["profiles", "memberships", "suppliers", "supplier_capabilities", "supplier_evidence",
  "supplier_documents", "supplier_certifications", "supplier_audits", "saved_suppliers", "profile_views",
  "rfqs", "rfq_matches", "stripe_events", "admin_audit_log", "certification_program_alias", "schema_migrations"];
const ROWS = {};
for (const t of TABLES) {
  const r = await req(`/rest/v1/${t}?select=*&limit=1`, { headers: { Prefer: "count=exact" } });
  let n = "?";
  if (r.status === 200 || r.status === 206) {
    const m = /(?:^|\/)(\d+)$/.exec(cr(r));
    n = m ? m[1] : (r.status === 200 ? r.text.slice(0, 1) === "[" ? String(JSON.parse(r.text).length) : "?" : "?");
  } else if (r.status === 404) n = "表不存在 ❌";
  else n = `HTTP ${r.status}`;
  ROWS[t] = n;
  log(`  ${t.padEnd(30)} n = ${n}   [HTTP ${r.status} ${cr(r)}]`);
  await new Promise((z) => setTimeout(z, 60));
}

// ---------------------------------------------------------------- 4/5/6/7
sec("[4][5][6][7] 索引 / 约束 / policy / RLS 基线 —— REST 与 OpenAPI 均不暴露，必须 SQL Editor");
log("  已实测死路：PostgREST OpenAPI **不暴露 column.enum（CHECK 不进 enum）**，");
log("  且本托管实例 pg-meta 各路径均 404（{\"error\":\"requested path is invalid\"}）。");
log("  ⇒ 索引名/约束名/policy 名/RLS 开关/授权（GRANT）只能由你在 SQL Editor 跑 01_precheck 得到。");
{
  const pm = [];
  for (const p of ["/pg/query", "/pg/tables", "/pg/columns", "/pg/constraints", "/query", "/tables"]) {
    const r = await req(p);
    pm.push(`${p}=${r.status}`);
  }
  log(`  pg-meta 复验： ${pm.join("  ")}`);
}

// ---------------------------------------------------------------- 8
sec("[8] 4 张业务表列结构（来源：Live OpenAPI properties —— 确属实库）");
{
  const defs = globalThis.__defs || {};
  const want = ["suppliers", "rfqs", "memberships", "profiles"];
  for (const t of want) {
    const d = defs[t];
    if (!d) { log(`\n${t}: OpenAPI 无定义 ❌`); continue; }
    const props = d.properties || {};
    const cols = Object.keys(props);
    log(`\n${t}  →  ${cols.length} 列`);
    for (const c of cols) {
      const p = props[c];
      const type = p.format ? `${p.type}/${p.format}` : p.type;
      const extra = [p.maxLength ? `maxLen=${p.maxLength}` : "", p.default !== undefined ? `default=${JSON.stringify(p.default)}` : "", (p.enum ? `enum=${JSON.stringify(p.enum)}` : "")].filter(Boolean).join(" ");
      log(`   ${c.padEnd(28)} ${String(type).padEnd(20)} ${p.description ? "" : ""}${extra}`);
    }
    await new Promise((z) => setTimeout(z, 60));
  }
}

// ---------------------------------------------------------------- 9
sec("[9] ★ 5 家 Supplier 信任字段快照（迁移后必须一字不差）");
{
  const r = await req("/rest/v1/suppliers?select=slug,is_published,verification_level,verification_status,audit_status,risk_score,certifications,access_tier,source_type,source_name,discovered_at,website,created_at,updated_at&order=slug.asc");
  log(`HTTP ${r.status}`);
  try {
    const arr = JSON.parse(r.text);
    globalThis.__trust = arr;
    log(JSON.stringify(arr, null, 1));
  } catch { log(r.text.slice(0, 1500)); }
}

// ---------------------------------------------------------------- 10
sec("[10] rfqs / rfq_matches 现有 status 取值（CHECK 真值域需 SQL，这里看实际数据）");
for (const t of ["rfqs", "rfq_matches"]) {
  const r = await req(`/rest/v1/${t}?select=status&limit=1000`);
  try {
    const arr = JSON.parse(r.text);
    const u = [...new Set(arr.map((x) => x.status))];
    log(`  ${t}.status 实际出现值: [${u.join(", ")}]  (${arr.length} 行)`);
  } catch { log(`  ${t}: HTTP ${r.status} ${r.text.slice(0, 200)}`); }
  await new Promise((z) => setTimeout(z, 60));
}

// ---------------------------------------------------------------- 12
sec("[12] schema_migrations 现有版本（确认 008 未被占用）");
{
  const r = await req("/rest/v1/schema_migrations?select=*&order=version.asc");
  log(`HTTP ${r.status}`);
  try {
    const arr = JSON.parse(r.text);
    for (const x of arr) log(`  ${JSON.stringify(x)}`);
    log(`  ⇒ 共 ${arr.length} 行；含 008 ? ${arr.some((x) => String(x.version) === "008") ? "是 ❌ 不要重复跑" : "否 ✅"}`);
  } catch { log(r.text.slice(0, 1200)); }
}

// ---------------------------------------------------------------- 14
sec("[14] rfqs vs leads 授权基线（information_schema.role_table_grants 需 SQL，REST 不可达）");
{
  const r = await req("/rest/v1/rfqs?select=*&limit=1");
  log(`  rfqs 经 service_role 读取: HTTP ${r.status} ${cr(r)}（REST 不能反映 anon 的 GRANT，需 SQL）`);
}

// ---------------------------------------------------------------- 13
sec("[13] 计划对象清单（静态回显，供 03_postcheck 比对）");
const PLAN = [
  ["TABLE", "leads", "新建，22 列"],
  ["CONSTRAINT", "leads_kind_check", "kind IN (buyer_lead|supplier_application|supplier_claim)"],
  ["CONSTRAINT", "leads_status_check", "status IN (new|contacted|quoted|won|lost)"],
  ["CONSTRAINT", "leads_score_check", "score IS NULL OR 0..100"],
  ["CONSTRAINT", "leads_reference_id_key", "UNIQUE(reference_id)"],
  ["CONSTRAINT", "leads_user_id_fkey", "FK profiles(id) ON DELETE SET NULL"],
  ["CONSTRAINT", "leads_assigned_to_fkey", "FK profiles(id) ON DELETE SET NULL"],
  ["INDEX", "leads_status", "(status)"], ["INDEX", "leads_kind", "(kind)"],
  ["INDEX", "leads_created", "(created_at DESC)"], ["INDEX", "leads_email", "(email)"],
  ["TRIGGER", "leads_set_updated_at", "BEFORE UPDATE → set_updated_at()"],
  ["RLS", "leads", "ENABLE ROW LEVEL SECURITY"],
  ["POLICY", "leads_select_self", "FOR SELECT TO authenticated USING (auth.uid() = user_id)"],
  ["POLICY", "leads_admin_all", "FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())"],
  ["GRANT", "REVOKE INSERT/UPDATE/DELETE", "FROM anon, authenticated"],
  ["MIGRATION", "008", "INSERT INTO schema_migrations (version, note)"],
];
for (const [k, n, note] of PLAN) log(`  ${k.padEnd(11)} ${n.padEnd(24)} ${note}`);

// ---------------------------------------------------------------- leads 是否出现在 OpenAPI
sec("[附] OpenAPI 是否已含 leads（= 表是否已被 PostgREST 感知）");
{
  const defs = globalThis.__defs || {};
  log(`  definitions 总数: ${Object.keys(defs).length}`);
  log(`  含 leads ? ${defs.leads ? "是 ❌" : "否 ✅（表不存在）"}`);
}

log("");
log("=== 探针结束（全程只读：GET + 无副作用 RPC）===");

const fs = await import("node:fs");
fs.writeFileSync("C:/Users/35726/AppData/Local/Temp/cs07-precheck-online.txt", L.join("\n") + "\n", "utf8");
fs.writeFileSync("C:/Users/35726/AppData/Local/Temp/cs07-baseline.json", JSON.stringify({ rows: ROWS, trust: globalThis.__trust, at: new Date().toISOString() }, null, 2), "utf8");
console.log("saved: Temp/cs07-precheck-online.txt , Temp/cs07-baseline.json");
