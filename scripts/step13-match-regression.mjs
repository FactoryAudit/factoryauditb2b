// STEP 13 CHANGE SET D —— 匹配 + 跟进状态流转回归（**打真实生产库**）
//
// 用法：node scripts/step13-match-regression.mjs
//
// 🔴 用的是一条**测试探针 RFQ**（库内 8 条 RFQ 全是探针，真实 RFQ = 0）。
//    所有写入都落在探针名下 ⇒ 业务漏斗（只算真实 RFQ）不会被污染。
//    也**不删除**验证产生的行：spec C5 要求取消/终止用 status 表达，不用 DELETE。
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}

mkdirSync("tmp/step13", { recursive: true });
const OUT = "tmp/step13/matching.mjs";
await esbuild.build({
  entryPoints: ["lib/rfqMatching.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: OUT,
  logLevel: "error",
});
const mod = await import(pathToFileURL(`${process.cwd()}/${OUT}`).href);
const { recommendSuppliersForRfq, confirmRfqMatches, listRfqMatches, updateMatchStatus, MATCH_TRANSITIONS } = mod;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let pass = 0,
  fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${extra ? " :: " + extra : ""}`);
  }
};

const REF = "RFQ-CXJCRL"; // CS-02B 冒烟探针（chemicals / China）—— 只在这里当靶子用
const { data: rfq } = await db
  .from("rfqs")
  .select("id, reference_id, industry_code, country, product")
  .eq("reference_id", REF)
  .maybeSingle();
if (!rfq) {
  console.error("找不到测试靶 RFQ " + REF);
  process.exit(1);
}

// ---------- D0 流转表（与服务端强校验同源） ----------
ok("D0.1 suggested → contacted / lost", JSON.stringify(MATCH_TRANSITIONS.suggested) === '["contacted","lost"]');
ok("D0.2 contacted → won / lost", JSON.stringify(MATCH_TRANSITIONS.contacted) === '["won","lost"]');
ok("D0.3 won 是终态", MATCH_TRANSITIONS.won.length === 0);
ok("D0.4 lost 是终态", MATCH_TRANSITIONS.lost.length === 0);

// ---------- D1 推荐 ----------
const recs = await recommendSuppliersForRfq({
  id: String(rfq.id),
  referenceId: String(rfq.reference_id),
  industryCode: rfq.industry_code,
  country: rfq.country,
  product: rfq.product,
});
ok("D1.1 探针 RFQ 能拿到推荐（机制可用）", recs.length > 0, `n=${recs.length}`);
ok("D1.2 推荐都带可解释打分依据", recs.every((r) => r.score > 0 && r.reasons.length > 0));
ok(
  "D1.3 推荐依据里带分值（Admin 能看到「为什么」）",
  recs.some((r) => r.reasons.some((x) => /\+\d+$/.test(x))),
  JSON.stringify(recs[0]?.reasons ?? [])
);

// ---------- D2 确认匹配（幂等） ----------
//
// 可重复性：本脚本会反复跑。第一次跑时目标是"全新供应商"（验证真插入），
// 后续跑时该行已存在（验证幂等）。所以断言必须**感知当前状态**，
// 而不是写死 inserted=1 —— 否则第二次跑必然假 FAIL。
const before = await listRfqMatches(String(rfq.id));
const matchedIds = new Set(before.map((m) => m.supplierId));
const freshRecs = recs.filter((r) => !matchedIds.has(r.supplierId));
console.log(`（推荐 ${recs.length} 家，其中未确认过 ${freshRecs.length} 家）`);
const target = freshRecs[0] ?? recs[0];
const isFresh = !matchedIds.has(target.supplierId);
const expectInsert = isFresh ? 1 : 0;

const r1 = await confirmRfqMatches(String(rfq.id), [target.supplierId], "step13-regression@system");
ok(
  `D2.1 确认匹配（fresh=${isFresh} ⇒ 期望 inserted=${expectInsert}）`,
  r1.inserted === expectInsert && r1.inserted + r1.skipped === 1,
  JSON.stringify(r1)
);
const mid = await listRfqMatches(String(rfq.id));
ok("D2.2 无重复行", mid.length === before.length + expectInsert, `${before.length} → ${mid.length}`);
ok(
  "D2.3 目标行状态 = suggested",
  mid.find((m) => m.supplierId === target.supplierId)?.status === "suggested",
  JSON.stringify(mid.find((m) => m.supplierId === target.supplierId)?.status)
);

const r2 = await confirmRfqMatches(String(rfq.id), [target.supplierId], "step13-regression@system");
const after2 = await listRfqMatches(String(rfq.id));
ok("D2.4 重复确认不产生重复行（幂等）", r2.inserted === 0 && after2.length === mid.length, JSON.stringify(r2));

// ---------- D3 非法跳转被服务端拒绝 ----------
const bad1 = await updateMatchStatus(String(rfq.id), target.supplierId, "won", "step13-regression@system");
ok("D3.1 suggested 直接跳 won 被拒（invalid_transition）", bad1.ok === false && bad1.error === "invalid_transition", JSON.stringify(bad1));
const bad2 = await updateMatchStatus(String(rfq.id), target.supplierId, "matched", "step13-regression@system");
ok("D3.2 非法状态值 'matched' 被拒（invalid_status）", bad2.ok === false && bad2.error === "invalid_status", JSON.stringify(bad2));
const bad3 = await updateMatchStatus(String(rfq.id), "00000000-0000-0000-0000-000000000000", "contacted", "x@y");
ok("D3.3 不存在的 match 被拒（match_not_found）", bad3.ok === false && bad3.error === "match_not_found");

// ---------- D4 suggested → contacted（真实写库） ----------
const up1 = await updateMatchStatus(String(rfq.id), target.supplierId, "contacted", "step13-regression@system");
ok("D4.1 suggested → contacted 成功", up1.ok === true && up1.status === "contacted" && up1.changed === true, JSON.stringify(up1));
const q1 = await db.from("rfq_matches").select("status").eq("rfq_id", rfq.id).eq("supplier_id", target.supplierId).maybeSingle();
ok("D4.2 重新查库 = contacted（刷新后仍保持）", q1.data?.status === "contacted", JSON.stringify(q1.data));

const up1b = await updateMatchStatus(String(rfq.id), target.supplierId, "contacted", "step13-regression@system");
ok("D4.3 同状态重复推进 = 成功但不重复写（changed=false）", up1b.ok === true && up1b.changed === false, JSON.stringify(up1b));

// ---------- D5 contacted → won ----------
const up2 = await updateMatchStatus(String(rfq.id), target.supplierId, "won", "step13-regression@system");
ok("D5.1 contacted → won 成功", up2.ok === true && up2.status === "won", JSON.stringify(up2));
const q2 = await db.from("rfq_matches").select("status").eq("rfq_id", rfq.id).eq("supplier_id", target.supplierId).maybeSingle();
ok("D5.2 重新查库 = won", q2.data?.status === "won", JSON.stringify(q2));

// ---------- D6 终态不可再改 ----------
const bad4 = await updateMatchStatus(String(rfq.id), target.supplierId, "lost", "step13-regression@system");
ok("D6.1 won 是终态，不能再改（invalid_transition）", bad4.ok === false && bad4.error === "invalid_transition", JSON.stringify(bad4));

// ---------- D7 审计留痕 ----------
const { data: audit } = await db
  .from("admin_audit_log")
  .select("action, diff")
  .eq("action", "rfq_match.status_changed")
  .order("created_at", { ascending: false })
  .limit(3);
ok("D7.1 状态跃迁写了审计日志", (audit ?? []).length > 0, JSON.stringify(audit?.[0] ?? null));

const finalRows = await listRfqMatches(String(rfq.id));
writeFileSync(
  "D:/腾讯ai临时文件/2026-09-14-22-18-10/s13-match.json",
  JSON.stringify({ rfq: REF, recommendations: recs, matches: finalRows }, null, 2),
  "utf8"
);

console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
console.log(`（验证行留在探针 RFQ ${REF} 名下，业务漏斗只算真实 RFQ ⇒ 不污染；未删除）`);
process.exit(fail === 0 ? 0 : 1);
