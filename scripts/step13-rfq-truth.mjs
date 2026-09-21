// STEP 13：RFQ 真实/测试分类取证 + 列名核对（只读，走 Management API）
// 判据必须是 email + company，不能只看 product 文案 —— 见 lib/adminBusiness.ts 注释。
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "D:/腾讯ai临时文件/2026-09-14-22-18-10/s13-rfq-truth.txt";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = ((env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
if (!TOKEN || !REF) {
  console.error("缺少 SUPABASE_ACCESS_TOKEN 或无法解析 REF");
  process.exit(1);
}

const q = async (sql) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: true }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
};

const TEST_HOSTS = new Set(["example.com", "example.invalid", "invalid", "test"]);
const TEST_PAT = [
  /probe/i,
  /^cs-?\d{2}[a-z]?\b/i,
  /step\d{2}\b/i,
  /请忽略/,
  /测试/,
  /smoke test/i,
  /live verification/i,
  /automated verify/i,
];
const isEmailTest = (v) => {
  const s = String(v ?? "").toLowerCase();
  if (!s) return false;
  if (TEST_HOSTS.has(s.split("@")[1] ?? "")) return true;
  return TEST_PAT.some((re) => re.test(s));
};
const isTextTest = (...vs) =>
  vs.some((v) => String(v ?? "").length > 0 && TEST_PAT.some((re) => re.test(String(v))));
const isTest = (r) =>
  isTextTest(r.product, r.reference_id, r.company) || isEmailTest(r.email);

const out = [];

const cols = await q(`select table_name, column_name, data_type, is_nullable
 from information_schema.columns
 where table_schema='public' and table_name in ('rfqs','suppliers','leads','rfq_matches')
 order by table_name, ordinal_position`);
out.push("=== COLUMNS ===");
let cur = "";
for (const c of cols) {
  if (c.table_name !== cur) {
    cur = c.table_name;
    out.push(`\n-- ${cur}`);
  }
  out.push(`   ${c.column_name} ${c.data_type}${c.is_nullable === "NO" ? " NOT NULL" : ""}`);
}

out.push("\n=== RFQ CLASSIFICATION ===");
const rows = await q(
  `select reference_id, product, quantity, email, company, is_public,
          source_type, source_path, created_at
   from rfqs order by created_at`
);
for (const r of rows) {
  out.push(
    `${isTest(r) ? "TEST" : "REAL"} | ${r.reference_id} | ${r.product} | qty=${r.quantity} | ` +
      `email=${r.email} | company=${r.company} | pub=${r.is_public} | ` +
      `src=${r.source_type} / ${r.source_path} | ${String(r.created_at).slice(0, 19)}`
  );
}
out.push(`\ntotal=${rows.length}  real=${rows.filter((r) => !isTest(r)).length}  test=${rows.filter(isTest).length}`);

out.push("\n=== rfq_matches by status ===");
out.push(JSON.stringify(await q(`select status, count(*)::int as n from rfq_matches group by status order by 1`)));

out.push("\n=== leads by kind/status ===");
out.push(JSON.stringify(await q(`select kind, status, count(*)::int as n from leads group by kind, status order by 1,2`)));

out.push("\n=== suppliers is_published × profile_authorized ===");
out.push(
  JSON.stringify(
    await q(
      `select is_published, profile_authorized, count(*)::int as n from suppliers group by 1,2 order by 1,2`
    )
  )
);

writeFileSync(OUT, out.join("\n"), "utf8");
console.log(out.join("\n"));
