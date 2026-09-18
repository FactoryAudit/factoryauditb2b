// CS-15：供应商下架（撤回授权 / 应企业或用户要求移除）
//
// 与 CS-14 发布脚本互为逆操作：
//   cs14-publish-suppliers.mjs  is_published: false → true
//   cs15-unpublish-suppliers.mjs is_published: true → false  （本脚本）
//
// 为什么需要单独一个脚本（而不是顺手 PATCH 一下）：
//   1. 下架是**同意书动作**，必须留痕：谁、何时、依据什么。
//   2. 必须同时撤回授权留痕（profile_authorized / contact_visibility），
//      否则将来任何「读 profile_authorized 决定要不要发布」的逻辑会把
//      一个**未授权**的档案重新推上线。
//   3. 默认 dry-run，与发布脚本同一纪律。
//
// 生效范围（2026-09-15 实测确认）：
//   · 供应商详情页 /suppliers/[slug] **不是预渲染**（不在 prerender-manifest 的
//     routes / dynamicRoutes 里，.next 下无静态 HTML）⇒ 按请求实时读库 ⇒
//     `is_published=false` **立即 404**，无需部署。
//   · 目录页 /suppliers 同样实时读库 ⇒ 立即少一张卡。
//   · ⚠️ 但 `app/sitemap.ts` 是 **SSG（构建期烘焙）** ⇒ 必须重建 + 重新部署，
//     否则 sitemap.xml 会继续对外宣告一个已经 404 的 URL（爬虫质量问题）。
//
// 用法：
//   node scripts/cs15-unpublish-suppliers.mjs          # dry-run（默认，只打印 before/after）
//   node scripts/cs15-unpublish-suppliers.mjs --apply  # 真正写入
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

// ——— 下架清单（每条必须写清 reason + source，这是同意书的审计依据） ———
const TARGETS = [
  {
    slug: "shenzhen-jorigin-packaging",
    legalName: "J-Origin Packaging / Shenzhen Jiayuanmei Packaging Materials Co., Ltd.",
    reason: "未获企业授权（用户 2026-09-15 裁定）",
    source:
      "用户指令 2026-09-15。旁证：原始申请邮件 fbda0098-65ea-4e42-9b71-bf5f9401957d（2026-09-09 23:18）" +
      "虽勾选 Authorize Company Profile: yes，但 City / Address / Registration Number **全为空**，" +
      "仅提供官网 + 通用 info@ 邮箱 + 产品列表，且 Audit/Inspection Availability 均为 no —— " +
      "特征更接近第三方按官网代为录入，而非企业本人授权。",
  },
];

// 下架后要写的值。撤回授权是**有意覆盖**非空值（不是补空），
// 因为「库里说已授权」本身就是需要被纠正的错误记录。
const AFTER = {
  is_published: false,
  profile_authorized: false,
  contact_visibility: "private",
};

const show = (v) => (v === null || v === undefined || v === "" ? "∅" : JSON.stringify(v));

const run = async () => {
  console.log(`模式：${APPLY ? "🔴 APPLY（写入）" : "🟡 DRY-RUN（只读）"}\n`);
  const r = await fetch(`${URL}/rest/v1/suppliers?select=*`, { headers: hdrs });
  const rows = await r.json();
  const bySlug = {};
  rows.forEach((x) => (bySlug[x.slug] = x));

  let changed = 0;
  let failed = 0;
  let noop = 0;

  for (const t of TARGETS) {
    console.log("─".repeat(78));
    const cur = bySlug[t.slug];
    if (!cur) {
      console.log(`❌ ${t.slug} 不在库中（已删除？）—— 跳过`);
      failed++;
      continue;
    }
    console.log(`【${t.slug}】 ${cur.legal_name}`);
    console.log(`  下架理由: ${t.reason}`);
    console.log(`  依据: ${t.source}`);

    const patch = {};
    for (const [k, v] of Object.entries(AFTER)) {
      if (cur[k] !== v) {
        patch[k] = v;
        console.log(`    ${k}: ${show(cur[k])} → ${show(v)}`);
      } else {
        console.log(`    ${k} 已是 ${show(v)}，不动`);
      }
    }

    if (!Object.keys(patch).length) {
      console.log("    ⇒ 无改动（已处于下架状态）");
      noop++;
      continue;
    }
    changed += Object.keys(patch).length;

    if (!APPLY) {
      console.log(`    ⇒ [dry-run] 将 PATCH ${JSON.stringify(patch)}`);
      continue;
    }

    const pr = await fetch(`${URL}/rest/v1/suppliers?slug=eq.${encodeURIComponent(t.slug)}`, {
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
      for (const k of ["is_published", "profile_authorized", "contact_visibility", "updated_at"]) {
        console.log(`        ${k.padEnd(22)} = ${show(now[k])}`);
      }
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log(`字段改动 ${changed} 处 | 已下架(无改动) ${noop} 处 | 失败 ${failed} 处`);
  if (!APPLY) console.log("⚠️ DRY-RUN：未写入。确认无误后加 --apply 执行。");
  console.log("=".repeat(78));
};

run().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
