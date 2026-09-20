// STEP 12 — CHANGE SET A（province/industry 证据化补全）+ CHANGE SET E（脏数据标记）
//
// 铁律：
//   1. 只补**有明确证据**的字段；不确定一律保留 NULL（A2/A4）。
//   2. 绝不为了匹配 Cluster 而强行填 industry（A4）。
//   3. 绝不伪造历史 consent（A5）—— 本脚本完全不碰 consent_* 字段。
//   4. 脏数据**不删除**，只标记 incomplete/rejected（E）。
//   5. 先备份再写，支持 --rollback 回滚（A3）。
//
// 用法：
//   node scripts/step12-activate-data.mjs            # 预演（只读，打印计划）
//   node scripts/step12-activate-data.mjs --apply    # 真正写入
//   node scripts/step12-activate-data.mjs --rollback # 用备份回滚
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const ROLLBACK = process.argv.includes("--rollback");
const BACKUP = "step12-backup.json";

// ---- province：仅当城市→省份可**唯一确定**时才补（canonical 英文省名）----
// 非中国（Surakarta/印尼、Ho Chi Minh/越南直辖市）canonical 未在系统中确立 ⇒ 跳过，保留 NULL。
const PROVINCE = {
  "dongguan-plastic-molding": ["Guangdong", "city=Dongguan"],
  "guangzhou-sunny-food": ["Guangdong", "city=Guangzhou"],
  "guangzhou-textile-factory": ["Guangdong", "city=Guangzhou"],
  "jiangsu-liquid-damper": ["Jiangsu", "city=Jiangsu（省名直接落在 city 字段）"],
  "nanjing-mxcomm": ["Jiangsu", "city=Nanjing"],
  "qingdao-xiuxinyang-international-trade-co-ltd": ["Shandong", "city=Rizhao, Shandong"],
  "shandong-loyal-industrial": ["Shandong", "city=Jinan"],
  "shenzhen-jorigin-packaging": ["Guangdong", "city=Shenzhen"],
  "shenzhen-precision-electronics": ["Guangdong", "city=Shenzhen"],
  "u-w-y-company-limited": ["Guangdong", "city=Shenzhen, Guangdong"],
  "xiamen-jings-eyewear": ["Fujian", "city=Xiamen"],
  "xiamen-jintaijin-polish-tech-co-ltd": ["Fujian", "city=Xiamen"],
  "guangdong-junchi-sports-products-co-ltd": ["Guangdong", "city=Qingyuan"],
  supplier: ["Shandong", "city=青岛（脏数据行，仅补齐地理事实，仍标记 rejected）"],
};

// ---- industry_code：只在 main_products 足以证明行业、且 code 在 STATIC_INDUSTRIES 白名单内时才补 ----
// 白名单：electronics/textiles/toys/footwear/machinery/plastics/home-appliances/
//        food-beverage/chemicals/automotive/furniture/packaging/cosmetics
const INDUSTRY = {
  "batik-soehadi": ["textiles", "main_products=batik,daster,fabric"],
  loomeami: ["textiles", "main_products=Loungewear & Sleepwear"],
  "qingdao-xiuxinyang-international-trade-co-ltd": [
    "textiles",
    "main_products=loungewear,pajamas,sleepwear,knitwear,hoodies,apparel",
  ],
  "u-w-y-company-limited": ["electronics", "main_products=Smart TV,Digital Signage,Kiosk,Gaming Monitor"],
  "xiamen-jintaijin-polish-tech-co-ltd": [
    "machinery",
    "main_products=vibratory finishing machines,polishing machines,deburring equipment",
  ],
  // 不补（证据不足或白名单无对应 code，强行填即为编造）：
  //   guangdong-junchi-sports-products-co-ltd → Pickleball Paddles：无 sports 类 code
  //   supplier（脏数据）→ PPE/劳保：无 ppe/safety 类 code，且已标记 rejected
};

// ---- CHANGE SET E：脏数据标记（不删除）----
const REJECT = {
  supplier: 'illegal placeholder slug "supplier"; country_code=unknown; city=青岛(非 canonical) — marked incomplete/rejected, NOT deleted',
};

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL?.trim(), env.SUPABASE_SERVICE_ROLE_KEY?.trim(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FIELDS = "id, slug, province, industry_code, is_published, city, country_code, main_products";

// ---------------- rollback ----------------
if (ROLLBACK) {
  if (!existsSync(BACKUP)) {
    console.error("没有备份文件 " + BACKUP + "，无法回滚");
    process.exit(1);
  }
  const snap = JSON.parse(readFileSync(BACKUP, "utf8"));
  let n = 0;
  for (const row of snap) {
    const { error } = await db
      .from("suppliers")
      .update({ province: row.province, industry_code: row.industry_code, is_published: row.is_published })
      .eq("slug", row.slug);
    if (error) console.error("  rollback FAIL " + row.slug + ": " + error.message);
    else n++;
  }
  console.log("已回滚 " + n + " 行（province/industry_code/is_published 恢复为备份值）");
  process.exit(0);
}

// ---------------- 读取现状 ----------------
const { data: rows, error } = await db.from("suppliers").select(FIELDS);
if (error) {
  console.error("读取 suppliers 失败: " + error.message);
  process.exit(1);
}
const bySlug = Object.fromEntries(rows.map((r) => [r.slug, r]));

// ---------------- 生成计划 ----------------
const plan = [];
for (const [slug, [province, ev]] of Object.entries(PROVINCE)) {
  const r = bySlug[slug];
  if (!r) { plan.push({ slug, skip: "NOT FOUND" }); continue; }
  if (r.province && r.province.trim()) { plan.push({ slug, field: "province", skip: "已有值 " + r.province }); continue; }
  plan.push({ slug, field: "province", from: null, to: province, evidence: ev });
}
for (const [slug, [ind, ev]] of Object.entries(INDUSTRY)) {
  const r = bySlug[slug];
  if (!r) { plan.push({ slug, skip: "NOT FOUND" }); continue; }
  if (r.industry_code && r.industry_code.trim()) { plan.push({ slug, field: "industry_code", skip: "已有值 " + r.industry_code }); continue; }
  plan.push({ slug, field: "industry_code", from: null, to: ind, evidence: ev });
}
const rejectPlan = [];
for (const [slug, reason] of Object.entries(REJECT)) {
  const r = bySlug[slug];
  if (!r) { rejectPlan.push({ slug, skip: "NOT FOUND" }); continue; }
  rejectPlan.push({ slug, id: r.id, is_published: r.is_published, reason });
}

console.log("=== STEP 12 数据激活计划（" + (APPLY ? "APPLY" : "DRY-RUN，加 --apply 才会写入") + "）===");
for (const p of plan) {
  console.log(
    p.skip
      ? `  [SKIP] ${p.slug} ${p.field ?? ""}: ${p.skip}`
      : `  [SET ] ${p.slug}.${p.field} = ${p.to}   （证据：${p.evidence}）`
  );
}
console.log("--- 脏数据标记（不删除）---");
for (const p of rejectPlan) {
  console.log(p.skip ? `  [SKIP] ${p.slug}: ${p.skip}` : `  [REJECT] ${p.slug} (id=${p.id}, is_published=${p.is_published}): ${p.reason}`);
}
const noProvince = Object.keys(PROVINCE).length;
console.log(`\nprovince 目标 ${noProvince} 行 / industry 目标 ${Object.keys(INDUSTRY).length} 行 / reject ${rejectPlan.filter(r=>!r.skip).length} 行`);

if (!APPLY) {
  console.log("\n（DRY-RUN 结束，未写入任何数据）");
  process.exit(0);
}

// ---------------- 备份 ----------------
const touched = [...new Set([...Object.keys(PROVINCE), ...Object.keys(INDUSTRY), ...Object.keys(REJECT)])]
  .map((s) => bySlug[s])
  .filter(Boolean)
  .map((r) => ({
    slug: r.slug,
    id: r.id,
    province: r.province,
    industry_code: r.industry_code,
    is_published: r.is_published,
  }));
writeFileSync(BACKUP, JSON.stringify(touched, null, 2), "utf8");
console.log("\n备份已写入 " + BACKUP + "（" + touched.length + " 行）");

// ---------------- 执行 ----------------
let okCount = 0;
const auditRows = [];
for (const [slug, [province]] of Object.entries(PROVINCE)) {
  const r = bySlug[slug];
  if (!r || (r.province && r.province.trim())) continue;
  const { error: e } = await db.from("suppliers").update({ province }).eq("slug", slug);
  if (e) { console.error("  FAIL province " + slug + ": " + e.message); continue; }
  okCount++;
  auditRows.push({ slug, id: r.id, field: "province", to: province });
}
for (const [slug, [ind]] of Object.entries(INDUSTRY)) {
  const r = bySlug[slug];
  if (!r || (r.industry_code && r.industry_code.trim())) continue;
  const { error: e } = await db.from("suppliers").update({ industry_code: ind }).eq("slug", slug);
  if (e) { console.error("  FAIL industry " + slug + ": " + e.message); continue; }
  okCount++;
  auditRows.push({ slug, id: r.id, field: "industry_code", to: ind });
}
// 脏数据：确保未发布 + 记审计（绝不 DELETE）
for (const [slug, reason] of Object.entries(REJECT)) {
  const r = bySlug[slug];
  if (!r) continue;
  if (r.is_published !== false) {
    const { error: e } = await db.from("suppliers").update({ is_published: false }).eq("slug", slug);
    if (e) console.error("  FAIL unpublish " + slug + ": " + e.message);
  }
  const { error: e2 } = await db.from("admin_audit_log").insert({
    actor_id: null,
    actor_email: "system@step12-maintenance",
    action: "supplier.marked_incomplete",
    target_type: "supplier",
    target_id: r.id,
    diff: { is_published: false, reason: "dirty_placeholder_slug" },
    ip_address: null,
    notes: "STEP12 CHANGE SET E — " + reason,
  });
  if (e2) console.error("  FAIL audit " + slug + ": " + e2.message);
}

// maintenance audit log（A3 要求留痕）
for (const a of auditRows) {
  const { error: e } = await db.from("admin_audit_log").insert({
    actor_id: null,
    actor_email: "system@step12-maintenance",
    action: "supplier.data_backfill",
    target_type: "supplier",
    target_id: a.id,
    diff: { [a.field]: a.to },
    ip_address: null,
    notes: `STEP12 CHANGE SET A — evidence-based ${a.field} backfill (original was NULL)`,
  });
  if (e) console.error("  FAIL audit " + a.slug + "/" + a.field + ": " + e.message);
}

console.log(`\n已更新 ${okCount} 个字段；审计日志 ${auditRows.length} 条；脏数据标记 ${Object.keys(REJECT).length} 行（未删除）`);
console.log("回滚：node scripts/step12-activate-data.mjs --rollback");
