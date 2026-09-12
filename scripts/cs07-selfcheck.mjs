// CS-07 precheck 等价只读检查（用 PostgREST 代替 SQL Editor）
// 目的：确认迁移前置状态，避免让用户多跑一趟 01_precheck.sql
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, authorization: "Bearer " + KEY };

// 铁律：探表必须用 GET + select("*").limit(1)；绝不用 head:true（对不存在的表返 204 且 error=null）
async function probe(table, query = "select=*&limit=1", note = "") {
  const r = await fetch(URL + "/rest/v1/" + table + "?" + query, { headers: H });
  const t = await r.text();
  let j = null;
  try {
    j = JSON.parse(t);
  } catch {}
  let verdict;
  if (r.status >= 400) verdict = "缺失 (" + r.status + ")";
  else verdict = "存在";
  let cols = "";
  if (Array.isArray(j) && j.length) cols = Object.keys(j[0]).join(", ");
  console.log(
    (verdict === "存在" ? "PASS " : "MISS ") + table.padEnd(26) + verdict + (note ? "  " + note : "")
  );
  if (cols) console.log("      列: " + cols);
  if (r.status >= 400) console.log("      " + t.slice(0, 200));
  return { status: r.status, cols: cols ? cols.split(", ") : [] };
}

// 逐列探存在性：select=列名 → 列不存在会返 42703
async function probeCol(table, col) {
  const r = await fetch(URL + "/rest/v1/" + table + "?select=" + col + "&limit=1", { headers: H });
  const t = await r.text();
  if (r.status >= 400) {
    const missing = /42703|does not exist/.test(t);
    return missing ? "缺失" : "错误 " + r.status;
  }
  return "存在";
}

const run = async () => {
  console.log("=== 1. 表存在性 ===");
  const tables = [
    "suppliers",
    "supplier_evidence",
    "supplier_capabilities",
    "supplier_documents",
    "supplier_certifications",
    "supplier_audits",
    "admin_audit_log",
    "profiles",
    "memberships",
    "rfqs",
    "leads",
    "saved_suppliers",
  ];
  for (const t of tables) await probe(t);

  console.log("\n=== 2. suppliers 拟新增列是否已存在 ===");
  const cols = [
    "company_type",
    "english_name",
    "production_capacity",
    "monthly_output",
    "factory_size",
    "export_since",
    "self_reported_certificates",
    "legacy_claim",
    "claim_status",
    "claim_source",
    "evidence_status",
  ];
  for (const c of cols) {
    const s = await probeCol("suppliers", c);
    console.log("  " + c.padEnd(28) + s);
    await new Promise((x) => setTimeout(x, 120));
  }

  console.log("\n=== 3. leads 表结构（若存在）===");
  const l = await fetch(URL + "/rest/v1/leads?select=*&limit=1", { headers: H });
  const lt = await l.text();
  if (l.status < 400) {
    const lj = JSON.parse(lt);
    console.log("  leads 存在，列数 " + (lj.length ? Object.keys(lj[0]).length : 0));
    if (lj.length) console.log("  " + Object.keys(lj[0]).join(", "));
    else console.log("  （空表，无法取列名）");
  } else {
    console.log("  leads 不存在或不可读：" + lt.slice(0, 200));
  }
};
run().catch((e) => console.log("ERR " + e.message));
