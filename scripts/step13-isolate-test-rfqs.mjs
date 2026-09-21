// STEP 13 —— 测试数据隔离（RFQ 侧）
//
// 背景（本轮实测发现）：
//   STEP 07B 把 RFQ-CXJCRL 当作"唯一真实 RFQ"置 is_public=true，让它挂在首页
//   Live Buyer Requests。STEP 13 取证确认它是 **CS-02B 冒烟探针**
//   （email=cs02b.smoke@example.com / company="CS-02B Test Co"）。
//   ⇒ 前台正把一条测试数据当作"真实买家需求"展示，违反 STEP 12 Change Set E
//      "测试数据不得进入 Live Buyer Requests"。
//
// 本脚本只做一件事：把**判定为测试探针**的 RFQ 全部置 is_public=false（不删除），
// 并写 admin_audit_log 留痕。默认 dry-run，加 --apply 才写库。
//
// 用法：
//   node scripts/step13-isolate-test-rfqs.mjs            # dry-run
//   node scripts/step13-isolate-test-rfqs.mjs --apply
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const BACKUP = "step13-rfq-isolation-backup.json";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 判据与 lib/adminBusiness.ts 的 isTestRfq 保持一致（必须看 email/company，不能只看 product 文案）
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
const isTestEmail = (v) => {
  const s = String(v ?? "").toLowerCase();
  if (!s) return false;
  if (TEST_HOSTS.has(s.split("@")[1] ?? "")) return true;
  return TEST_PAT.some((re) => re.test(s));
};
const isTestText = (...vs) =>
  vs.some((v) => String(v ?? "").length > 0 && TEST_PAT.some((re) => re.test(String(v))));
const isTest = (r) => isTestText(r.product, r.reference_id, r.company) || isTestEmail(r.email);

const { data, error } = await db
  .from("rfqs")
  .select("id, reference_id, product, company, email, is_public")
  .order("created_at");
if (error) {
  console.error("read failed: " + error.message);
  process.exit(1);
}

const rows = data ?? [];
const probes = rows.filter(isTest);
const leaks = probes.filter((r) => r.is_public);

console.log(`RFQ total=${rows.length}  probes=${probes.length}  probe leaks (is_public=true)=${leaks.length}`);
for (const r of leaks) {
  console.log(`  LEAK ${r.reference_id} | ${r.product} | ${r.email} | ${r.company}`);
}
if (probes.length > 0 && leaks.length === 0) {
  console.log("  （所有探针均已 is_public=false，无需处理）");
}

writeFileSync(
  BACKUP,
  JSON.stringify({ at: new Date().toISOString(), rows: probes.map((r) => ({ id: r.id, reference_id: r.reference_id, is_public: r.is_public })) }, null, 2),
  "utf8"
);
console.log(`\nbackup → ${BACKUP}`);

if (!APPLY) {
  console.log("\nDRY-RUN —— 未写库。加 --apply 执行。");
  process.exit(0);
}

let n = 0;
for (const r of leaks) {
  const { error: e1 } = await db.from("rfqs").update({ is_public: false }).eq("id", r.id);
  if (e1) {
    console.error(`  FAIL unpublish ${r.reference_id}: ${e1.message}`);
    continue;
  }
  const { error: e2 } = await db.from("admin_audit_log").insert({
    actor_id: null,
    actor_email: "system@step13-maintenance",
    action: "rfq.test_probe_hidden",
    target_type: "rfq",
    target_id: r.id,
    diff: { is_public: false, reason: "test_probe_not_real_buyer" },
  });
  if (e2) console.error(`  FAIL audit ${r.reference_id}: ${e2.message}`);
  n++;
}
console.log(`\nAPPLIED: ${n} probe RFQ(s) unpublished (rows kept, not deleted)`);
