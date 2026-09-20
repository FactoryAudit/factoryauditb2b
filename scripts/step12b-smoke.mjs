// STEP 12 重部署后冒烟（只读；不提交 RFQ，避免触碰 3 次/小时限流）
const BASE = "https://factoryauditb2b.com";
let pass = 0, fail = 0;
const check = (n, ok, d = "") => {
  if (ok) { pass++; console.log(`  PASS — ${n}${d ? " (" + d + ")" : ""}`); }
  else { fail++; console.log(`  FAIL — ${n}${d ? " (" + d + ")" : ""}`); }
};
const get = async (p) => {
  const r = await fetch(BASE + p);
  return { status: r.status, html: await r.text() };
};

console.log("=== STEP 12 重部署冒烟 ===\n");

const home = await get("/");
check("首页 200", home.status === 200, `status=${home.status}`);

const rfq = await get("/rfq");
check("/rfq 200", rfq.status === 200, `status=${rfq.status}`);
check("/rfq 仍带公开授权勾选框", rfq.html.includes('name="allowPublic"'));
check("/rfq 仍带公开授权文案", rfq.html.includes("Allow my request to be shown publicly"));

const adm = await get("/api/admin/rfqs/RFQ-CXJCRL/match");
check("admin 匹配接口未登录 = 404", adm.status === 404, `status=${adm.status}`);

// 数据补全是否真的上线：已发布供应商页应显示回填的 province
const sp = await get("/en/suppliers/guangzhou-sunny-food");
check("供应商页 200", sp.status === 200, `status=${sp.status}`);
check("供应商页出现回填省份 Guangdong", sp.html.includes("Guangdong"), "");

const sp2 = await get("/en/suppliers/xiamen-jings-eyewear");
check("另一家供应商页出现 Fujian", sp2.status === 200 && sp2.html.includes("Fujian"), `status=${sp2.status}`);

// 脏数据不得出现在公开目录（未发布 + 已标记 rejected）
const dirty = await get("/en/suppliers/supplier");
check("脏数据 slug 'supplier' 不可公开访问", dirty.status === 404, `status=${dirty.status}`);

console.log(`\n=== 结果：PASS ${pass} / FAIL ${fail} ===`);
process.exit(fail === 0 ? 0 : 1);
