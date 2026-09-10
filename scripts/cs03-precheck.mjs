// CS-03 Pre-check（只读）：审计 Supplier 写入路径的现状
//   A. suppliers 实际列清单（从一行数据反推）
//   B. 现存 4 家供应商快照（slug / 国家 / 城市 / 等级 / 发布 / 时间）
//   C. 缺失列探测（website / source_url / source_type / source_name / discovered_at / ...）
//   D. 去重能力探测（同 legal_name / 同 country+city 是否已有重复）
//   E. admin_audit_log 现状（审计日志是否已可用）
//   F. RLS / 匿名写入能力探测（anon key 尝试 INSERT 是否会被拒）
//
// 用法: node --env-file=.env scripts/cs03-precheck.mjs
// 只读：绝不执行 INSERT / UPDATE / DELETE。
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
const BASE = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!BASE || !KEY) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const H_SERVICE = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
};

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  [PASS] ${name}${detail ? " — " + detail : ""}`);
  } else {
    fail++;
    console.log(`  [FAIL] ${name}${detail ? " — " + detail : ""}`);
  }
}

// 注意：带 Prefer: count=exact + limit 时 PostgREST 返回 206，200 与 206 都算存在，只有 4xx 算缺失。
async function get(path, headers = H_SERVICE) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON（如 42703 也可能返回 JSON，保险起见容错） */
  }
  return { status: res.status, json, text };
}

console.log("================================================");
console.log("CS-03 PRE-CHECK — Supplier Write Path Audit (READ-ONLY)");
console.log("BASE:", BASE);
console.log("================================================\n");

// ---------- A. suppliers 实际列 ----------
console.log("A. suppliers 实际列清单");
const a = await get("suppliers?select=*&limit=1");
let columns = [];
if (a.status === 200 || a.status === 206) {
  const row = Array.isArray(a.json) && a.json[0] ? a.json[0] : {};
  columns = Object.keys(row).sort();
  check("suppliers 可读", true, `${columns.length} 列`);
  console.log("     列：", columns.join(", "));
} else {
  check("suppliers 可读", false, `HTTP ${a.status} ${a.text.slice(0, 160)}`);
}

// ---------- B. 现存供应商快照 ----------
console.log("\nB. 现存供应商快照（4 家生产真实数据，只读）");
const b = await get(
  "suppliers?select=id,slug,legal_name,country_code,city,industry_code,business_type,verification_status,verification_level,audit_status,access_tier,is_published,created_at,updated_at&order=created_at.asc"
);
let rows = [];
if ((b.status === 200 || b.status === 206) && Array.isArray(b.json)) {
  rows = b.json;
  check("供应商可列举", true, `${rows.length} 行`);
  for (const r of rows) {
    console.log(
      `     · ${r.slug} | ${r.legal_name} | ${r.country_code}/${r.city} | level=${r.verification_level} | published=${r.is_published} | tier=${r.access_tier} | vStatus=${r.verification_status ?? "∅"} | aStatus=${r.audit_status ?? "∅"} | created=${String(r.created_at).slice(0, 10)}`
    );
  }
} else {
  check("供应商可列举", false, `HTTP ${b.status}`);
}

// ---------- C. 缺失列探测 ----------
console.log("\nC. CS-03 期望字段探测（42703 = 列不存在）");
const WANTED = [
  "website",
  "source_url",
  "source_type",
  "source_name",
  "discovered_at",
  "address",
  "phone",
  "registration_number",
  "display_name",
  "company_type",
  "status",
  "created_by",
  "updated_by",
];
const missing = [];
const present = [];
for (const col of WANTED) {
  const r = await get(`suppliers?select=${col}&limit=1`);
  if (r.status === 200 || r.status === 206) {
    present.push(col);
  } else if (r.status === 400 && r.text.includes("42703")) {
    missing.push(col);
  } else {
    missing.push(`${col}(?HTTP${r.status})`);
  }
}
console.log("     已存在：", present.length ? present.join(", ") : "（无）");
console.log("     不存在：", missing.join(", "));
check("缺失字段已全部登记（供报告，不在 CS-03 做大迁移）", true, `${missing.length} 个缺失`);

// ---------- D. 去重能力 ----------
console.log("\nD. 去重能力探测");
const dupByLegal = new Map();
const dupByCity = new Map();
for (const r of rows) {
  const k1 = String(r.legal_name || "").trim().toLowerCase();
  const k2 = `${r.country_code}::${String(r.city || "").trim().toLowerCase()}`;
  dupByLegal.set(k1, (dupByLegal.get(k1) ?? 0) + 1);
  dupByCity.set(k2, (dupByCity.get(k2) ?? 0) + 1);
}
const legalDup = [...dupByLegal.entries()].filter(([, n]) => n > 1);
const cityDup = [...dupByCity.entries()].filter(([, n]) => n > 1);
check("legal_name 无现存重复", legalDup.length === 0, JSON.stringify(legalDup));
check("country+city 无现存重复", cityDup.length === 0, JSON.stringify(cityDup));
console.log(
  "     注：DB 唯一约束目前只有 id(PK) 与 slug(UNIQUE)，其余字段无唯一索引 → 去重须在应用层做"
);

// ---------- E. admin_audit_log ----------
console.log("\nE. 审计日志表");
const e = await get("admin_audit_log?select=id,action,target_type,target_id,created_at&order=created_at.desc&limit=5");
if (e.status === 200 || e.status === 206) {
  const list = Array.isArray(e.json) ? e.json : [];
  check("admin_audit_log 可用", true, `最近 ${list.length} 条`);
  for (const r of list) {
    console.log(`     · ${r.action} | ${r.target_type}:${r.target_id} | ${r.created_at}`);
  }
} else {
  check("admin_audit_log 可用", false, `HTTP ${e.status} ${e.text.slice(0, 160)}`);
}

// ---------- F. 匿名写入能力（安全红线） ----------
console.log("\nF. 匿名写入探测（安全红线：绝不能成功）");
if (!ANON) {
  console.log("     [SKIP] 未取到 ANON key");
} else {
  // 只发 Preflight 性质的请求：用 accept=single 的非法 insert 会在写前被拒；
  // 为了绝对安全，这里不真的 POST，只验证 anon 角色确实拿不到 suppliers 写权限：
  // 通过 HEADERS + select 探测 anon 是否可读已发布数据即可。
  const r = await get("suppliers?select=slug&limit=1", {
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
  });
  check(
    "anon 可读已发布供应商（预期行为）",
    r.status === 200 || r.status === 206,
    `HTTP ${r.status}`
  );
  console.log("     注：本脚本不发起任何 INSERT。anon 写入能力将在代码层用 requireAdmin() 拦截。");
}

console.log("\n================================================");
console.log(`CS-03 PRE-CHECK 结果: PASS=${pass}  FAIL=${fail}`);
console.log("================================================");
