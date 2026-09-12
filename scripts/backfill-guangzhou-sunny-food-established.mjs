// 补齐 guangzhou-sunny-food 缺失年份与出口市场
//
// 来源（2026-09-12 联网核对，4 源互证）：
//   Year Established = 2001
//   · https://www.company-listing.org/guangzhou_lian_yi_development_foodstuffs_co_ltd.html
//   · https://www.business-yellowpages.com/details/377410/china/Guangzhou-Lian-Yi-Development-Foodstuffs-Co-Ltd
//   · https://www.goodada.co.uk/manufacturers/china/agriculture/plant-animal-oil/sesame-oil/guangzhou-lian-yi-development-foodstuffs-co-ltd/profile
//   · https://chainkwo.en.huangye88.com/about.html （"Established in 2001"）
//   主体：Guangzhou Lian Yi Development Foodstuffs Co., Ltd.，品牌 Chain Kwo / Miyata，官网 www.chainkwo.com
//         （与 DB 行 website=https://www.chainkwo.com 一致 ⇒ 主体对应无误）
//
// 出口市场来源：chainkwo.en.huangye88.com/about.html 自述主营市场
//   Western Europe / Eastern Asia / Eastern Europe / South America / North America
//   （申请表单里该栏被填成 "90%"，明显答错栏位，故改用其公开公司简介口径）
//
// 纪律：只填 NULL/空；非空一律跳过，绝不覆盖。
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
  established: 2001,
  export_markets: ["Western Europe", "Eastern Asia", "Eastern Europe", "South America", "North America"],
};

const run = async () => {
  const r = await fetch(URL + "/rest/v1/suppliers?slug=eq." + SLUG + "&select=*", { headers: H });
  const rows = await r.json();
  const before = rows[0];
  console.log("=== 回填前（本次目标字段）===");
  for (const k of Object.keys(CANDIDATE)) console.log("  " + k.padEnd(16), JSON.stringify(before[k]));

  const patch = {};
  for (const [k, v] of Object.entries(CANDIDATE)) {
    const cur = before[k];
    const isEmpty = cur === null || cur === "" || (Array.isArray(cur) && cur.length === 0);
    if (isEmpty) patch[k] = v;
    else console.log("  [跳过] " + k + " 已有值：" + JSON.stringify(cur));
  }
  if (!Object.keys(patch).length) return console.log("\n无需回填");

  console.log("\n=== 写入 ===");
  for (const [k, v] of Object.entries(patch)) console.log("  " + k.padEnd(16), JSON.stringify(v));

  const up = await fetch(URL + "/rest/v1/suppliers?slug=eq." + SLUG, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  console.log("\nPATCH ->", up.status);
  const after = await up.json();
  const row = Array.isArray(after) ? after[0] : null;
  if (row) {
    const empty = Object.entries(row).filter(
      ([, v]) => v === null || v === "" || (Array.isArray(v) && v.length === 0)
    );
    console.log("回填后空值字段数：" + empty.length + " / " + Object.keys(row).length);
    console.log("仍为空：" + empty.map(([k]) => k).join(", "));
  }
};

run().catch((e) => console.log("ERR " + e.message));
