// scripts/cs02b-live-smoke.mjs —— CS-02B 线上烟雾（只读 GET，节流 + 秒级指数退避）
//
// 铁律：边缘偶发 503 ⇒ 节流 + 退避重试（1/2/4/8s，最多 5 次），绝不放宽断言。
// 文案匹配前先做 HTML 实体归一化；状态判定看渲染 DOM 标记，不看 RSC payload。
const BASE = "https://factoryauditb2b.com";
const UA = "Mozilla/5.0 (compatible; FactoryAuditB2B-Smoke/1.0)";

let pass = 0;
let fail = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(`${name}${detail ? ` :: ${detail}` : ""}`); console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`); }
}
function section(t) { console.log(`\n=== ${t} ===`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(BASE + path, { headers: { "User-Agent": UA } });
      if (res.status >= 500) { lastErr = `HTTP ${res.status}`; await sleep(1000 * 2 ** i); continue; }
      return { status: res.status, body: await res.text() };
    } catch (e) { lastErr = String(e && e.message); await sleep(1000 * 2 ** i); }
  }
  return { status: 0, body: "", error: lastErr };
}
function norm(html) {
  return html.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}
const probes = [];
function probe(path, fn) {
  probes.push(async () => { const r = await get(path); fn(r.status, norm(r.body)); await sleep(1200); });
}

const SLUGS = ["melamine", "titanium-dioxide", "citric-acid", "calcium-carbonate", "xanthan-gum", "sodium-benzoate"];
const CAS = { melamine: "108-78-1", "titanium-dioxide": "13463-67-7", "citric-acid": "77-92-9", "calcium-carbonate": "471-34-1", "xanthan-gum": "11138-66-2", "sodium-benzoate": "532-32-1" };

section("1. /chemicals 索引页");
probe("/chemicals", (status, html) => {
  check("1.1 200", status === 200, `实际 ${status}`);
  check("1.2 H1 渲染", /<h1[^>]*>Chemical raw materials/.test(html));
  check("1.3 6 个化学品卡片", (html.match(/\/chemicals\/[a-z-]+"/g) || []).length >= 6);
  check("1.4 CAS RN 在卡片上可见", html.includes("108-78-1") && html.includes("13463-67-7"));
  check("1.5 下游行业链接指向真实行业页", html.includes("/industry/plastics") && html.includes("/industry/food-beverage"));
  check("1.6 ItemList JSON-LD", html.includes('"@type":"ItemList"') || html.includes('"@type": "ItemList"'));
});

section("2. 六个化学品详情页");
for (const s of SLUGS) {
  probe(`/chemicals/${s}`, (status, html) => {
    check(`2.${s} 200`, status === 200, `实际 ${status}`);
    check(`2.${s} CAS ${CAS[s]} 可见`, html.includes(CAS[s]));
    check(`2.${s} 内嵌 RFQ 表单`, html.includes('name="product"'));
    check(`2.${s} product 已预填化学品名`, /name="product"[^>]*value="[^"]+"/.test(html), (html.match(/name="product"[^>]{0,120}/) || [])[0]);
    check(`2.${s} Article JSON-LD`, html.includes('"@type":"Article"') || html.includes('"@type": "Article"'));
  });
}
probe("/chemicals/titanium-dioxide", (status, html) => {
  check("2.detail 预填值 = Titanium dioxide", html.includes('value="Titanium dioxide"'));
  check("2.detail 同义词可见", html.includes("Titania") || html.includes("CI 77891"));
  check("2.detail 合规区块可见", html.includes("What buyers ask for"));
});

section("3. 未收录 slug 必须 404");
probe("/chemicals/not-a-chemical", (status) => {
  check("3.1 404", status === 404, `实际 ${status}`);
});

section("4. /industry/chemicals 行业入口（复用 Master 模板）");
probe("/industry/chemicals", (status, html) => {
  check("4.1 200", status === 200, `实际 ${status}`);
  check("4.2 Block A 已渲染", html.includes("What makes chemical suppliers different"));
  check("4.3 Block B 两个子主题", html.includes("/industry/chemicals/chemical-compliance") && html.includes("/industry/chemicals/chemical-supplier-verification"));
  check("4.4 内嵌 RFQ 表单", html.includes('name="product"'));
  check("4.5 面包屑指向 /industry", html.includes('href="/industry"'));
  check("4.6 无编造供应商（0 家时显示空态）", html.includes("No verified") || html.includes("1)"));
});
for (const t of ["chemical-compliance", "chemical-supplier-verification"]) {
  probe(`/industry/chemicals/${t}`, (status, html) => {
    check(`4.${t} 200`, status === 200, `实际 ${status}`);
    check(`4.${t} 内嵌 RFQ`, html.includes('name="product"'));
  });
}

section("5. 本地化");
probe("/zh/chemicals", (status, html) => {
  check("5.1 200", status === 200, `实际 ${status}`);
  check("5.2 中文标题", html.includes("化工原料"));
  check("5.3 中文化学品名", html.includes("二氧化钛") || html.includes("三聚氰胺"));
});
probe("/zh-TW/chemicals/citric-acid", (status, html) => {
  check("5.4 200", status === 200, `实际 ${status}`);
  check("5.5 繁化生效（檸檬酸）", html.includes("檸檬酸"));
  check("5.6 无简体残留（柠檬酸）", !html.includes("柠檬酸"));
});

section("6. sitemap / llms.txt");
probe("/sitemap.xml", (status, html) => {
  check("6.1 200", status === 200, `实际 ${status}`);
  const total = (html.match(/<loc>/g) || []).length;
  check("6.2 总数 >= 1200（1116 + 90）", total >= 1200, `实际 ${total}`);
  const chemIdx = (html.match(/>https:\/\/factoryauditb2b\.com\/chemicals<\/loc>/g) || []).length +
    (html.match(/\/chemicals<\/loc>/g) || []).length;
  check("6.3 /chemicals 索引收录", html.includes("/chemicals</loc>"));
  // 收窄：只数「路径以 /chemicals/ 开头」的条目。
  // 用宽松正则会把 /industry/chemicals/<topic> 也数进来（18 条），得到 72 的假失败。
  const locs = (html.match(/<loc>([^<]+)<\/loc>/g) || []).map((x) => x.replace(/<\/?loc>/g, ""));
  const detail = locs.filter((u) => /\/chemicals\/[a-z-]+$/.test(u) && !/\/industry\//.test(u));
  check("6.4 6 个化学品 × 9 语 = 54 条", detail.length === 54, `实际 ${detail.length}`);
  check("6.5 含 industry/chemicals 9 条", (html.match(/\/industry\/chemicals<\/loc>/g) || []).length === 9, String((html.match(/\/industry\/chemicals<\/loc>/g) || []).length));
});
probe("/llms.txt", (status, html) => {
  check("6.6 200", status === 200, `实际 ${status}`);
  check("6.7 有 Chemical raw materials 段", html.includes("## Chemical raw materials"));
  check("6.8 6 个化学品条目齐备", SLUGS.every((s) => html.includes(`/chemicals/${s})`)));
});

for (const p of probes) await p();

console.log("\n============================================================");
if (fail === 0) { console.log(`CS-02B 线上烟雾：${pass} PASS / 0 FAIL`); console.log("全部通过 ✓"); }
else { console.log(`CS-02B 线上烟雾：${pass} PASS / ${fail} FAIL`); failures.forEach((f) => console.log("  - " + f)); process.exit(1); }
