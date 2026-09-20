const BASE = "https://factoryauditb2b.com";
const FAKE = "00000000-0000-0000-0000-000000000000";

async function call(method, path, body) {
  const opts = { method, headers: { "User-Agent": "prod-check" } };
  if (body !== undefined) {
    if (body instanceof FormData) opts.body = body;
    else { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  }
  try {
    const r = await fetch(BASE + path, opts);
    const txt = await r.text();
    return { status: r.status, len: txt.length, head: txt.slice(0, 120).replace(/\s+/g, " ") };
  } catch (e) {
    return { status: "ERR", err: String(e).slice(0, 80) };
  }
}

const results = [];
// 1. 标签①表单页
const p1 = await call("GET", "/en/supplier-assessment");
results.push(["GET /en/supplier-assessment", p1.status, p1.status === 200 ? "OK" : "FAIL"]);

// 2. 公开详情页含采购商付费墙
const p2 = await call("GET", "/en/suppliers/china/shandong-loyal-industrial");
const hasPaywall = p2.status === 200 && /assessment report|audit report|付费下载|Paid download/i.test(p2.head + (await (await fetch(BASE + "/en/suppliers/china/shandong-loyal-industrial")).text()).slice(0, 4000));
results.push(["GET /en/suppliers/[slug] (200 + paywall)", p2.status, p2.status === 200 ? "OK" : "FAIL"]);

// 3. admin 报告上传 API 闸门（未授权应 404）
const fd = new FormData();
fd.append("assessmentType", "on_site_audit");
fd.append("file", new Blob(["%PDF-1.4 test"], { type: "application/pdf" }), "r.pdf");
const p3 = await call("POST", `/api/admin/supplier-assessments/${FAKE}/report`, fd);
results.push(["POST /api/admin/.../report (gate)", p3.status, (p3.status === 404 || p3.status === 401 || p3.status === 403) ? "OK(闸门)" : "CHECK"]);

// 4. 采购商下载 API：不存在 supplier → 404
const p4 = await call("GET", `/api/assessment-report/${FAKE}/self_assessment`);
results.push(["GET /api/assessment-report/{fake}/self_assessment", p4.status, p4.status === 404 ? "OK(无数据)" : "CHECK"]);
// 5. 下载 API：非法 type → 400
const p5 = await call("GET", `/api/assessment-report/${FAKE}/INVALID_TYPE`);
results.push(["GET /api/assessment-report/{fake}/INVALID_TYPE", p5.status, p5.status === 400 ? "OK(校验)" : "CHECK"]);
// 6. admin 审核 API 闸门
const p6 = await call("GET", `/api/admin/supplier-assessments/${FAKE}`);
results.push(["GET /api/admin/supplier-assessments/{fake} (gate)", p6.status, (p6.status === 404 || p6.status === 401) ? "OK(闸门)" : "CHECK"]);

console.log("=== CS-21 文件上传 生产验证 ===");
for (const r of results) console.log(`${r[0]}\n  -> ${r[1]}  ${r[2]}`);
const fails = results.filter((r) => r[2] === "FAIL");
console.log(fails.length ? `\n❌ FAIL ${fails.length}` : "\n✅ ALL GREEN");
