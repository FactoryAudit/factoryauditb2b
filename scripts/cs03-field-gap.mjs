// CS-03 Pre-check 补充：§三 要求字段 + §七 去重字段的存在性探测（只读）
// 用法: node --env-file=.env scripts/cs03-field-gap.mjs
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
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function probe(col) {
  const res = await fetch(`${BASE}/rest/v1/suppliers?select=${col}&limit=1`, { headers: H });
  const text = await res.text();
  const exists = res.status === 200 || res.status === 206;
  return { col, exists, status: res.status };
}

// §三 要求至少可写
const SEC3 = [
  ["legal_name", "法定名称"],
  ["display_name", "展示名"],
  ["country_code", "国家（映射 country）"],
  ["city", "城市"],
  ["address", "地址"],
  ["website", "官网"],
  ["company_type", "公司类型"],
  ["main_products", "产品（映射 products）"],
  ["source_type", "来源类型（source）"],
  ["source_url", "来源 URL"],
  ["discovery_task_id", "发现任务 ID"],
];

// §七 去重维度
const SEC7 = [
  ["website", "Website / Domain"],
  ["legal_name", "Legal Name"],
  ["registration_number", "Registration Number"],
  ["country_code", "Country"],
  ["city", "City"],
  ["address", "Address"],
  ["phone", "Phone"],
];

console.log("================================================");
console.log("CS-03 字段缺口补充探测（只读）");
console.log("================================================\n");

console.log("§三 —— POST 要求「至少可写」的字段");
for (const [col, label] of SEC3) {
  const r = await probe(col);
  console.log(`  ${r.exists ? "✅ 存在" : "❌ 缺失"}  ${col.padEnd(20)} ← ${label}   [HTTP ${r.status}]`);
}

console.log("\n§七 —— 去重维度所需字段");
for (const [col, label] of SEC7) {
  const r = await probe(col);
  console.log(`  ${r.exists ? "✅ 存在" : "❌ 缺失"}  ${col.padEnd(20)} ← ${label}   [HTTP ${r.status}]`);
}

console.log("\n================================================");
console.log("说明：HTTP 400 + 42703 = 列不存在；200/206 = 列存在。");
console.log("================================================");
