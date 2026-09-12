// CS-12 回填：guangzhou-sunny-food 的「工商登记信息 + 工厂自述证书」
//
// 来源：该工厂 **自己的入驻申请表**（Resend 邮件 91b9d8d5-6aa4-4aa2-8b8c-bedbd7bf0bcb，
//       脚本 scripts/fetch-supplier-applications.mjs 导出于
//       .workbuddy/artifacts/applications-dump.txt）。逐字照抄，不做任何推断。
//   · Company Type: "manufacturer and trading"            → company_type
//   · Certificates: "BSCI, BRC"（**申请里没有颁发日/到期日**）→ self_reported_certificates
//     ⇒ 只写名称，issued/expires 留空字符串。
//       🔴 绝不替工厂编造证书日期 —— 宁可这两栏在页面上不出现。
//
// 刻意**不填**的两个字段（各有其因，需用户裁决，勿擅自补）：
//   · english_name —— 申请表填的是 "LIAN YI GROUP COMPANY LIMITED"，
//       而 company-listing.org / ecvery / exporthub / tradees 四个独立来源一致给出
//       "Guangzhou Lian Yi Development Foodstuffs Co., Ltd."（与其自报官网 chainkwo.com 对应）。
//       两者不一致，且本行 legal_name 是 "Guangzhou Sunny Food Co., Ltd." ——
//       三个名字之间的关系是**推断**，推断不得写进「工商登记信息」这种看起来像事实的位置。
//   · export_since —— 申请表填 1999，但 established=2001（4 源互证）且 tradees 载明
//       "Export Year: 2001"。出口年早于成立年自相矛盾 ⇒ 不发布，留空待证。
//
// 纪律：只填 NULL/空；非空一律跳过，绝不覆盖。逐字照抄来源，打印 before/after。
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
const CANDIDATE = {
  company_type: "Manufacturer and trading",
  self_reported_certificates: [
    { name: "BSCI", number: "", issued: "", expires: "" },
    { name: "BRC", number: "", issued: "", expires: "" },
  ],
};

const run = async () => {
  const r = await fetch(URL + "/rest/v1/suppliers?slug=eq." + SLUG + "&select=*", { headers: H });
  const rows = await r.json();
  const before = rows[0];
  if (!before) return console.log("找不到该行：" + SLUG);

  console.log("=== 回填前（本次目标字段）===");
  for (const k of Object.keys(CANDIDATE)) console.log("  " + k.padEnd(28), JSON.stringify(before[k]));

  const patch = {};
  for (const [k, v] of Object.entries(CANDIDATE)) {
    const cur = before[k];
    const isEmpty =
      cur === null || cur === "" || (Array.isArray(cur) && cur.length === 0);
    if (isEmpty) patch[k] = v;
    else console.log("  [跳过] " + k + " 已有值：" + JSON.stringify(cur));
  }
  if (!Object.keys(patch).length) return console.log("\n无需回填");

  console.log("\n=== 写入（逐字来自该工厂自己的申请表）===");
  for (const [k, v] of Object.entries(patch)) console.log("  " + k.padEnd(28), JSON.stringify(v));

  const up = await fetch(URL + "/rest/v1/suppliers?slug=eq." + SLUG, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  console.log("\nPATCH ->", up.status);
  const after = await up.json();
  const row = Array.isArray(after) ? after[0] : null;
  if (row) {
    console.log("=== 回填后 ===");
    for (const k of Object.keys(CANDIDATE)) console.log("  " + k.padEnd(28), JSON.stringify(row[k]));
  }
};

run().catch((e) => console.log("ERR " + e.message));
