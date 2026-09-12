// 从工厂自己的入驻申请（Resend 邮件 91b9d8d5…）回填 suppliers 缺失字段
//
// 原则（数据真实性）：
//   1. 只填 NULL 字段，绝不覆盖已有非空值（保护此前人工判断）
//   2. 逐字照抄申请原文，不做任何推断/补全/美化
//   3. 仅填工厂**明确授权公开**的信息（Authorize Company Profile: yes）
//   4. 不写申请里没有的字段（如 established 成立年份——申请里没有，只有出口起始年）
//   5. 打印 before/after，可核对
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
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };

const SLUG = "guangzhou-sunny-food";

// 申请原文（逐字），来源邮件 91b9d8d5-6aa4-4aa2-8b8c-bedbd7bf0bcb
const FROM_APPLICATION = {
  address:
    "Building C and D, No. 123 Xingye Road, Aotou Town, Conghua District, 510947 Guangzhou City, Guangdong Province, China",
  certifications: ["BSCI", "BRC"],
};

const run = async () => {
  const r = await fetch(
    URL + "/rest/v1/suppliers?slug=eq." + SLUG + "&select=slug,address,certifications,established,export_markets,business_type,employees,website,registration_number",
    { headers: H }
  );
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) {
    console.log("找不到供应商 " + SLUG);
    process.exit(1);
  }
  const before = rows[0];
  console.log("=== 回填前 ===");
  for (const [k, v] of Object.entries(before)) console.log("  " + k.padEnd(20), JSON.stringify(v));

  // 只取「当前为 NULL/空」的字段
  const patch = {};
  for (const [k, v] of Object.entries(FROM_APPLICATION)) {
    const cur = before[k];
    const isEmpty = cur === null || (Array.isArray(cur) && cur.length === 0) || cur === "";
    if (isEmpty) patch[k] = v;
    else console.log("  [跳过] " + k + " 已有值，不覆盖：" + JSON.stringify(cur));
  }

  if (!Object.keys(patch).length) {
    console.log("\n无需回填（所有目标字段均已有值）");
    return;
  }
  console.log("\n=== 即将写入 ===");
  for (const [k, v] of Object.entries(patch)) console.log("  " + k.padEnd(20), JSON.stringify(v));

  const up = await fetch(URL + "/rest/v1/suppliers?slug=eq." + SLUG, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  console.log("\nPATCH ->", up.status);
  const after = await up.json();
  if (Array.isArray(after) && after.length) {
    console.log("=== 回填后 ===");
    for (const [k, v] of Object.entries(after[0])) console.log("  " + k.padEnd(20), JSON.stringify(v));
  } else {
    console.log(JSON.stringify(after).slice(0, 400));
  }
};

run().catch((e) => console.log("ERR " + e.message));
