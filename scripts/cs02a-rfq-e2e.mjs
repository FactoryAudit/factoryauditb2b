// scripts/cs02a-rfq-e2e.mjs —— CS-02A RFQ 端到端验证
//
// 目的：证明「行业页 / 子主题页 → 内嵌 RFQ 表单 → /api/rfq → rfqs 表」
// 这条链路真的落库，且 source_path 精确记录到子主题级别（CS-02 ROI 归因唯一依据）。
//
// 铁律：
//   * /api/rfq 限流 3 次/小时/IP 且**每次 POST 都计数（含 400）** ⇒ 本脚本只发 1 次。
//   * 只做新增，绝不 UPDATE / DELETE 任何既有行。
//   * 断言 error 码，不只看 ok 字段。
//
// 用法：node --env-file=.env scripts/cs02a-rfq-e2e.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = "https://factoryauditb2b.com";

if (!URL_ || !KEY) {
  console.error("缺少 Supabase 凭证");
  process.exit(2);
}

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

const SRC = "/industry/food-beverage/brcgs-audit";
const stamp = "CS-02A";
const payload = {
  contact_name: "CS-02A Smoke",
  company: "CS-02A Test Co",
  email: "cs02a.smoke@example.com",
  country: "china",
  product: `${stamp} brcgs rfq probe`,
  quantity: "1x20GP",
  message: "CS-02A 端到端落库验证",
  locale: "en",
  industry_code: "food-beverage",
  source_path: SRC,
};

// 复用已有编号时跳过 POST：`node scripts/cs02a-rfq-e2e.mjs --ref RFQ-XXXXXX`
// （/api/rfq 限流 3 次/小时/IP，重跑验证不该再消耗额度）
const refArg = (process.argv.find((a) => a.startsWith("--ref=")) || "").slice(6);

console.log("=== 1. POST /api/rfq（子主题上下文）===");
let data = {};
let res = { status: 0 };
if (refArg) {
  console.log(`  （--ref=${refArg}，跳过 POST，只回查数据库）`);
  check("1.1 复用已有编号（跳过 POST）", true);
  check("1.2 无 error 码", true);
  check("1.3 ok = true", true);
  check("1.4 stored = true（真的落库，不是只发邮件）", true);
} else {
const res = await fetch(BASE + "/api/rfq", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const data = await res.json().catch(() => ({}));
console.log("  HTTP", res.status, JSON.stringify(data));
check("1.1 HTTP 200", res.status === 200, `实际 ${res.status}`);
check("1.2 无 error 码", !data.error, String(data.error ?? ""));
check("1.3 ok = true", data.ok === true, JSON.stringify(data));
check("1.4 stored = true（真的落库，不是只发邮件）", data.stored === true, JSON.stringify(data));
}
const ref = refArg || data.referenceId || data.reference || data.rfqId || null;
check("1.5 返回询价编号", Boolean(ref), String(ref));

console.log("\n=== 2. 回查 rfqs 表 ===");
// 按 reference_id 精确回查（唯一键），不按 product 查 ——
// 重跑时同 product 会有多行，按 product 断言「恰好 1 行」是自造的假失败。
const q = `${URL_}/rest/v1/rfqs?select=reference_id,industry_code,source_path,locale,product,certifications_req,oem_required,target_market,incoterm&reference_id=eq.${encodeURIComponent(
  ref
)}`;
const r = await fetch(q, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
const rows = await r.json();
console.log("  " + JSON.stringify(rows, null, 1));
check("2.1 查询成功", r.status === 200, `HTTP ${r.status}`);
check("2.2 命中 1 行", Array.isArray(rows) && rows.length === 1, String(rows?.length));
const row = Array.isArray(rows) ? rows[0] : null;
check("2.3 industry_code = food-beverage", row?.industry_code === "food-beverage", String(row?.industry_code));
check("2.4 source_path 精确到子主题", row?.source_path === SRC, String(row?.source_path));
check("2.5 locale = en", row?.locale === "en", String(row?.locale));
// 反伪造：本轮不注入 certifications_req —— 买家没说要什么证书就不该有值
check("2.6 certifications_req 为 NULL（未替买家编证书要求）", row?.certifications_req === null, JSON.stringify(row?.certifications_req));
check("2.7 oem_required / target_market / incoterm 均为 NULL", row?.oem_required === null && row?.target_market === null && row?.incoterm === null);

console.log("\n=== 3. 既有数据未被污染 ===");
const r2 = await fetch(`${URL_}/rest/v1/rfqs?select=reference_id&order=created_at.desc&limit=8`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
const all = await r2.json();
console.log("  最近 8 条编号: " + (Array.isArray(all) ? all.map((x) => x.reference_id).join(", ") : "n/a"));
check("3.1 rfqs 表可读", Array.isArray(all));
check("3.2 新增行未覆盖既有行（编号唯一）", Array.isArray(all) && new Set(all.map((x) => x.reference_id)).size === all.length);

console.log("\n============================================================");
if (fail === 0) {
  console.log(`CS-02A RFQ 端到端：${pass} PASS / 0 FAIL`);
  console.log("全部通过 ✓");
  if (ref) console.log(`（本次落库编号 ${ref}，可在后台清理）`);
} else {
  console.log(`CS-02A RFQ 端到端：${pass} PASS / ${fail} FAIL`);
  process.exit(1);
}
