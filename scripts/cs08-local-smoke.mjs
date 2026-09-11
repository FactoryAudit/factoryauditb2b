// scripts/cs08-local-smoke.mjs —— CS-08 本地端到端烟雾（只读 + 2 次真实提交）
//
// 前置：next build 完成后 `next start -p 3210`
// 用法：node scripts/cs08-local-smoke.mjs
//
// ⚠️ 会真的发出 2 封邮件（.env 的 MAIL_HTTP_* 是生产通道）——
//    内容刻意标注 CS-08 SMOKE TEST，便于在邮箱里一眼识别、不被误当真实线索。
// ⚠️ /api/supplier-register 限流 5 次/IP/小时，本脚本占 4 次；一小时内别连跑两轮。

const BASE = process.env.CS08_BASE || "http://localhost:3210";

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? `  [${detail}]` : ""}`);
  }
}

const post = (body) =>
  fetch(`${BASE}/api/supplier-register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const SMOKE = "CS-08 SMOKE TEST — do not action";

console.log(`\n=== 1. SSR 渲染（结构化证书行）  BASE=${BASE} ===`);
const enRes = await fetch(`${BASE}/join-supplier-network`);
const enHtml = await enRes.text();
check("1a /join-supplier-network 返回 200", enRes.status === 200, `status=${enRes.status}`);
check("1b SSR 出证书行（id=cert-expires-0）", enHtml.includes('id="cert-expires-0"'));
check("1c 签发日 / 有效期均为 date 控件", (enHtml.match(/type="date"/g) || []).length >= 2, `date inputs=${(enHtml.match(/type="date"/g) || []).length}`);
check("1d 渲染 en 的 Valid until 文案", enHtml.includes("Valid until"));
check("1e 渲染「我要获得证书」入口", enHtml.includes("I want to obtain certification"));
check("1f 渲染 certAdd / certRemove 文案", enHtml.includes("Add another certificate") && enHtml.includes("Remove"));

console.log("\n=== 2. SSR 渲染（本地化） ===");
const zhRes = await fetch(`${BASE}/zh/join-supplier-network`);
const zhHtml = await zhRes.text();
check("2a /zh/join-supplier-network 返回 200", zhRes.status === 200, `status=${zhRes.status}`);
check("2b 中文页出现中文证书文案", zhHtml.includes("有效期") || zhHtml.includes("证书"), "未匹配到中文证书文案");
check("2c 中文页不再渲染英文 Valid until", !zhHtml.includes("Valid until"));

console.log("\n=== 3. API 分流（certification_request） ===");
const r1 = await post({ kind: "certification_request", fields: { certHelpWanted: SMOKE, certHelpCompany: SMOKE, certHelpContactEmail: "cn18588770248@gmail.com", certHelpNote: SMOKE } });
const d1 = await r1.json().catch(() => ({}));
check("3a 认证需求提交返回 200/ok", r1.status === 200 && d1.ok === true, `status=${r1.status} body=${JSON.stringify(d1)}`);
check("3b 返回 requestId", typeof d1.requestId === "string" && d1.requestId.length > 20);

const r2 = await post({ kind: "certification_request", fields: { certHelpWanted: SMOKE, certHelpContactEmail: "not-an-email" } });
const d2 = await r2.json().catch(() => ({}));
check("3c 非法邮箱被拒（400 invalid_email）", r2.status === 400 && d2.error === "invalid_email", `status=${r2.status} body=${JSON.stringify(d2)}`);

const r3 = await post({ kind: "certification_request", fields: { certHelpContactEmail: "cn18588770248@gmail.com" } });
const d3 = await r3.json().catch(() => ({}));
check("3d 缺少需求内容被拒（400 certification required）", r3.status === 400 && d3.error === "certification required", `status=${r3.status} body=${JSON.stringify(d3)}`);

console.log("\n=== 4. API 分流（入驻申请，含 2 个证书行） ===");
const r4 = await post({
  fields: {
    companyName: SMOKE,
    factoryCountry: "China",
    mainProducts: SMOKE,
    contactEmail: "cn18588770248@gmail.com",
    certificates: "BSCI · No. TEST-0001 · Issued 2026-01-01 · Valid until 2027-01-01\nISO 9001 · No. TEST-0002 · Issued 2025-06-01 · Valid until 2028-06-01",
    certificatesJson: JSON.stringify([
      { name: "BSCI", number: "TEST-0001", issued: "2026-01-01", expires: "2027-01-01" },
      { name: "ISO 9001", number: "TEST-0002", issued: "2025-06-01", expires: "2028-06-01" },
    ]),
    authorizeCompanyProfile: "yes",
  },
});
const d4 = await r4.json().catch(() => ({}));
check("4a 入驻提交返回 200/ok（响应契约仍为 supplierId）", r4.status === 200 && d4.ok === true && typeof d4.supplierId === "string", `status=${r4.status} body=${JSON.stringify(d4)}`);

console.log("\n=== 5. 后台闸门未破 ===");
const adm = await fetch(`${BASE}/admin/report-standard`, { redirect: "manual" });
check("5a 匿名访问 /admin/report-standard 仍 404（admin 闸门）", adm.status === 404, `status=${adm.status}`);

console.log("\n=== 6. 旧入口未回归 ===");
const sup = await fetch(`${BASE}/suppliers`);
check("6a /suppliers 仍 200", sup.status === 200, `status=${sup.status}`);
const rq = await fetch(`${BASE}/rfq`);
check("6b /rfq 仍 200", rq.status === 200, `status=${rq.status}`);

console.log("\n============================================================");
if (fail === 0) {
  console.log(`CS-08 本地烟雾：${pass} PASS / 0 FAIL`);
  console.log("全部通过 ✓  （请到 cn18588770248@gmail.com 确认 2 封测试邮件已收到）");
} else {
  console.log(`CS-08 本地烟雾：${pass} PASS / ${fail} FAIL`);
  process.exit(1);
}
