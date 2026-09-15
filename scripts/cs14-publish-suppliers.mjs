// CS-14：把「已入库但未发布」的真实入驻申请发布上线
//
// 数据来源（唯一事实源，逐字照抄，绝不推断）：
//   Resend 入驻申请通知邮件（site → NOTIFY_ADMIN_EMAIL），
//   每家的**最新一封**为准（部分工厂重复提交，早期单的授权勾选可能不同）。
//   全量落盘：.workbuddy/artifacts/supplier-applications-all.txt
//   权威字段摘要：.workbuddy/artifacts/authoritative-consent.json
//
// 铁律：
//   1. 只填 NULL / 空值，**绝不覆盖非空**（守卫在脚本内，命中即跳过并报告）。
//   2. `is_published` 只允许 false → true。
//   3. 不写 `risk_score` —— 既有 4 家的分数来自手写种子数据（seed-suppliers-direct.mjs
//      的 s.riskScore），不是算法推导；新 5 家无来源，留 NULL，绝不编造。
//   4. 授权字段按邮件原文写：`Authorize Company Profile: yes` → profile_authorized=true；
//      `Contact Visibility: platform` → contact_visibility='platform'（联系方式不下公开）。
//
// 用法：
//   node scripts/cs14-publish-suppliers.mjs          # dry-run（默认，只打印 before/after）
//   node scripts/cs14-publish-suppliers.mjs --apply  # 真正写入
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
const APPLY = process.argv.includes("--apply");
const hdrs = {
  apikey: KEY,
  Authorization: "Bearer " + KEY,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// ——— 发布计划（每家的 sourceEmail 是写每一条的依据） ———
const PLAN = [
  {
    slug: "nanjing-mxcomm",
    sourceEmail: "New Supplier Registration @ 2026-09-10 14:17（Nanjing Maxon O.E. Tech. Co., Ltd.）",
    fill: {
      // 邮件 Main Products = "Industrial wireless access points, wireless bridges,
      // embedded Wi-Fi modules and boards, industrial Ethernet switches and serial device servers"
      // → 网络通信设备，归入线上已在用的 electronics
      industry_code: "electronics",
    },
  },
  {
    slug: "xiamen-jings-eyewear",
    sourceEmail: "New Supplier Registration @ 2026-09-11 02:02（厦门镜雅光学有限公司，5 次提交取最新）",
    fill: {
      registration_number: "91350206302967241N", // 邮件 Registration Number 原文
      address: "Xiamen, Fujian, China", // 邮件 Address 原文
      // 注意：邮件 Export Markets = "International eyewear brands, optical retailers, distributors"
      // 是**客户类型**而非出口地区，语义不符 export_markets（地区数组）⇒ 不写入，避免曲解
    },
  },
  {
    slug: "shenzhen-jorigin-packaging",
    sourceEmail: "New Supplier Registration @ 2026-09-09 23:18（J-Origin Packaging）",
    fill: {}, // 该次申请未提供可补字段（City/Address/Established/Employees/RegNo 全空）
  },
  {
    slug: "shandong-loyal-industrial",
    sourceEmail: "New Supplier Registration @ 2026-09-09 08:48（Shandong Loyal Industrial Co., Ltd.）",
    fill: {
      established: 2005, // 邮件 Established 原文
      address: "No. 689, Meili North Road, Huaiyin District, Jinan City, Shandong Province 250000, China",
      export_markets: ["Worldwide"], // 邮件 Export Markets 原文（单值）
    },
  },
  {
    slug: "jiangsu-liquid-damper",
    sourceEmail: "New Supplier Registration @ 2026-09-08 02:00（Jiangsu Liquid Damper Machinery Technology Co., Ltd.）",
    fill: {}, // 该次申请未提供可补字段
    // 注意：该邮件的 Website 带 utm 外联参数（...?utm_source=factoryauditb2b.com&utm_medium=referral
    // &utm_campaign=backlink_outreach），库内已是干净的 https://www.vibroabsorber.com ⇒ 不动非空值
  },
];

// 授权字段：5 家邮件的 Authorization 段**全部**为
//   Authorize Company Profile: yes / Contact Visibility: platform
const CONSENT = { profile_authorized: true, contact_visibility: "platform" };
const CONSENT_SOURCE = "Authorization 段：Authorize Company Profile: yes / Contact Visibility: platform";

const isEmpty = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const show = (v) => (isEmpty(v) ? "∅" : JSON.stringify(v));

const run = async () => {
  console.log(`模式：${APPLY ? "🔴 APPLY（写入）" : "🟡 DRY-RUN（只读）"}\n`);
  const r = await fetch(`${URL}/rest/v1/suppliers?select=*`, { headers: hdrs });
  const rows = await r.json();
  const bySlug = {};
  rows.forEach((x) => (bySlug[x.slug] = x));

  let planned = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of PLAN) {
    const cur = bySlug[p.slug];
    console.log("─".repeat(78));
    if (!cur) {
      console.log(`❌ ${p.slug} 不在库中，跳过`);
      failed++;
      continue;
    }
    console.log(`【${p.slug}】 ${cur.legal_name}`);
    console.log(`  来源: ${p.sourceEmail}`);

    const patch = {};
    const notes = [];

    // 1) 发布闸门
    if (cur.is_published === false) {
      patch.is_published = true;
      notes.push(`is_published: ${show(cur.is_published)} → true`);
    } else {
      notes.push(`is_published 已是 ${cur.is_published}，不动`);
    }

    // 2) 授权留痕（只填 NULL）
    for (const [k, v] of Object.entries(CONSENT)) {
      if (isEmpty(cur[k])) {
        patch[k] = v;
        notes.push(`${k}: ∅ → ${show(v)}   〔${CONSENT_SOURCE}〕`);
      } else {
        notes.push(`${k} 已为 ${show(cur[k])}，不动`);
      }
    }

    // 3) 逐字补字段（只填 NULL / 空数组）
    for (const [k, v] of Object.entries(p.fill)) {
      if (isEmpty(cur[k])) {
        patch[k] = v;
        notes.push(`${k}: ∅ → ${show(v)}`);
      } else {
        notes.push(`⚠️ ${k} 已为 ${show(cur[k])}，**拒绝覆盖**（保持现值）`);
        skipped++;
      }
    }

    notes.forEach((n) => console.log("    " + n));

    if (!Object.keys(patch).length) {
      console.log("    ⇒ 无改动");
      continue;
    }
    planned += Object.keys(patch).length;

    if (!APPLY) {
      console.log(`    ⇒ [dry-run] 将 PATCH ${JSON.stringify(patch)}`);
      continue;
    }

    const pr = await fetch(`${URL}/rest/v1/suppliers?slug=eq.${encodeURIComponent(p.slug)}`, {
      method: "PATCH",
      headers: hdrs,
      body: JSON.stringify(patch),
    });
    const out = await pr.json();
    if (!pr.ok) {
      console.log(`    ❌ PATCH 失败 ${pr.status}: ${JSON.stringify(out).slice(0, 200)}`);
      failed++;
      continue;
    }
    const now = Array.isArray(out) ? out[0] : null;
    if (now) {
      console.log("    ✅ AFTER:");
      for (const k of ["is_published", "profile_authorized", "contact_visibility", ...Object.keys(p.fill)]) {
        console.log(`        ${k.padEnd(22)} = ${show(now[k])}`);
      }
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log(`字段改动 ${planned} 处 | 拒绝覆盖(非空守卫命中) ${skipped} 处 | 失败 ${failed} 处`);
  if (!APPLY) console.log("⚠️ DRY-RUN：未写入。确认无误后加 --apply 执行。");
  console.log("=".repeat(78));
};

run().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
