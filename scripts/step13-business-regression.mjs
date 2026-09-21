// STEP 13 CHANGE SET B + E —— 对**生产真实数据**求值（不是夹具）
// 用法：node scripts/step13-business-regression.mjs
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

// env 必须在 import bundle 之前注入：supabaseAdmin 在模块初始化时读 process.env
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}

mkdirSync("tmp/step13", { recursive: true });
const OUT = "tmp/step13/business.mjs";
await esbuild.build({
  entryPoints: ["lib/adminBusiness.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: OUT,
  logLevel: "error",
});
const mod = await import(pathToFileURL(`${process.cwd()}/${OUT}`).href);
const { listLeadActivation, getBusinessFunnel, isTestRfq } = mod;

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${extra ? " :: " + extra : ""}`);
  }
};

// ---------- CHANGE SET B：Lead 运营 ----------
const leads = await listLeadActivation(200);
ok("B1.1 读到 leads", leads.length > 0, `rows=${leads.length}`);
const apps = leads.filter((l) => l.kind === "supplier_application");
const realApps = apps.filter((l) => !l.isTest);
ok("B1.2 supplier_application = 9", apps.length === 9, String(apps.length));
ok("B1.3 其中真实 = 7（测试探针已隔离）", realApps.length === 7, String(realApps.length));
const linked = realApps.filter((l) => l.supplier);
ok(
  "B1.4 7 条真实 lead 全部关联到草稿 Supplier",
  linked.length === 7,
  realApps.filter((l) => !l.supplier).map((l) => `${l.referenceId}:${l.company}`).join(" | ")
);
ok(
  "B1.5 关联到的草稿带完整度",
  linked.every((l) => l.supplier.completeness.total === 7)
);
const testLeads = leads.filter((l) => l.isTest);
ok("B1.6 测试 lead 被标记 isTest", testLeads.length >= 2, String(testLeads.length));

// ---------- CHANGE SET E：漏斗（真实口径） ----------
// 🔴 2026-09-21 取证纠正：STEP 11/12 文档里的"真实 RFQ = 1（RFQ-CXJCRL）"是**错的**。
//    RFQ-CXJCRL 的 email=cs02b.smoke@example.com、company="CS-02B Test Co"
//    ⇒ 它是 CS-02B 冒烟探针。库内 8 条 RFQ **全部**是验收探针，真实 RFQ = 0。
//    因此断言不能写死"=1"，要断言这条**判据**本身。
const f = await getBusinessFunnel();
ok("E1.1 真实 RFQ = 0（库内全为探针，实测纠正）", f.rfq.real === 0, JSON.stringify(f.rfq));
ok("E1.2 测试 RFQ = 8（= total）", f.rfq.test === f.rfq.total && f.rfq.total === 8, JSON.stringify(f.rfq));
ok("E1.3 探针隔离后 public RFQ = 0", f.rfq.publicCount === 0, JSON.stringify(f.rfq));
ok(
  "E2.1 匹配统计只计真实 RFQ（探针上的机制验证不计入业务漏斗）",
  f.matching.realMatches === 0 && f.matching.realAdvanced === 0,
  JSON.stringify(f.matching)
);
ok("E3.1 真实 Supplier = 17（已剔除测试行）", f.supplier.total === 17, JSON.stringify(f.supplier));
ok("E3.2 已发布 = 9", f.supplier.published === 9);
ok("E3.3 rejected = 1（脏 slug supplier，未删除）", f.supplier.rejected === 1);
ok("E3.4 needsReview = 4（资料齐、可发布但仍草稿）", f.supplier.needsReview === 4, String(f.supplier.needsReview));
ok("E4.1 真实 supplier_application leads = 7", f.leads.real === 7);
ok("E4.2 已流转 lead = 0（运营缺口，非代码缺口）", f.leads.reviewed === 0, String(f.leads.reviewed));

// ---------- 测试数据识别的边界 ----------
// 判据必须是 email/company，不能只看 product 文案 —— 这正是 STEP 11/12 踩的坑。
ok("R1 product 文案本身不构成测试判据", isTestRfq({ product: "Titanium dioxide" }) === false);
ok("R2 STEP12 探针被判为测试", isTestRfq({ product: "STEP12 auto test - no consent" }) === true);
ok("R3 CS-02A probe 被判为测试", isTestRfq({ product: "CS-02A brcgs rfq probe" }) === true);
ok("R4 中文'请忽略'被判为测试", isTestRfq({ product: "RFQ 通道连通性测试-请忽略" }) === true);
ok("R5 example.com 邮箱被判为测试", isTestRfq({ product: "Widget", email: "a@example.com" }) === true);
ok("R6 真实买家邮箱不被误判", isTestRfq({ product: "Titanium dioxide", email: "buyer@gmail.com" }) === false);
ok(
  "R7 RFQ-CXJCRL 按 company/email 判为测试（本轮关键纠正）",
  isTestRfq({
    product: "Titanium dioxide",
    referenceId: "RFQ-CXJCRL",
    company: "CS-02B Test Co",
    email: "cs02b.smoke@example.com",
  }) === true
);

writeFileSync(
  "D:/腾讯ai临时文件/2026-09-14-22-18-10/s13-funnel.json",
  JSON.stringify(
    {
      funnel: f,
      leads: leads.map((l) => ({
        ref: l.referenceId,
        kind: l.kind,
        company: l.company,
        country: l.country,
        status: l.status,
        isTest: l.isTest,
        supplier: l.supplier?.slug ?? null,
        score: l.supplier ? `${l.supplier.completeness.score}/7` : null,
        publishable: l.supplier?.completeness.publishable ?? null,
        published: l.supplier?.isPublished ?? null,
        blockers: l.supplier?.completeness.blockers ?? null,
      })),
    },
    null,
    2
  ),
  "utf8"
);

console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail === 0 ? 0 : 1);
