const BASE = "https://factoryauditb2b.com";
const log = (m) => console.log(m);

async function call(method, url, body) {
  try {
    const r = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await r.text().catch(() => "");
    return { status: r.status, len: txt.length, full: txt, cache: r.headers.get("x-opennext-cache") };
  } catch (e) {
    return { status: 0, error: String(e), full: "" };
  }
}

async function main() {
  log("=== 2) CS-21 标签① 自评估页面（全文匹配） ===");
  const sa = await call("GET", BASE + "/en/supplier-assessment");
  const saHas = /Self-Assessment|self-assessment|On-Site Audit|on-site audit/i.test(sa.full || "");
  log(`GET /en/supplier-assessment -> status=${sa.status} len=${sa.len} containsCS21=${saHas}`);
  if (!saHas) log("   !! head snippet: " + (sa.full || "").slice(0, 200).replace(/\n/g, " "));

  log("\n=== 3) 供应商侧 标签③ 现场审核申请 API 校验 ===");
  const empty = await call("POST", BASE + "/api/supplier-on-site-audit", null);
  const badEmail = await call("POST", BASE + "/api/supplier-on-site-audit", { supplierId: "x", email: "not-an-email" });
  const noBody = await call("POST", BASE + "/api/supplier-on-site-audit"); // 完全无 body
  log(`POST null body -> status=${empty.status} (expect 400)`);
  log(`POST no body arg -> status=${noBody.status} (expect 400)`);
  log(`POST invalid email -> status=${badEmail.status} (expect 400)`);

  log("\n=== 5) 公开详情页付费墙占位（采购商，全文匹配） ===");
  const detail = await call("GET", BASE + "/en/supplier/vietnam/ho-chi-minh-garment");
  const paywall = /Assessment Reports|付费下载|Paid download|审核报告下载/i.test(detail.full || "");
  log(`GET detail page -> status=${detail.status} len=${detail.len} paywallRendered=${paywall}`);
  if (!paywall) log("   !! head snippet: " + (detail.full || "").slice(0, 200).replace(/\n/g, " "));

  const ok = sa.status === 200 && saHas && empty.status === 400 && noBody.status === 400 && badEmail.status === 400 && detail.status === 200 && paywall;
  log("\n=== SUMMARY ===");
  log(ok ? "ALL GREEN ✅" : "SOME CHECK FAILED ⚠️");
}
main();
