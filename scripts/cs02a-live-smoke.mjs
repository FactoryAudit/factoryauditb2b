// scripts/cs02a-live-smoke.mjs —— CS-02A 线上烟雾（只读 GET，节流 + 秒级指数退避）
//
// 铁律：
//   * 边缘偶发 503 ⇒ 必须节流 + 退避重试（1/2/4/8s，最多 5 次），绝不放宽断言。
//   * 文案匹配前先做 HTML 实体归一化（&#x27; vs '）。
//   * 判定渲染状态时看 DOM 分支，不看 RSC payload 里的 props 字符串。
//
// 用法：node scripts/cs02a-live-smoke.mjs
const BASE = "https://factoryauditb2b.com";
const UA = "Mozilla/5.0 (compatible; FactoryAuditB2B-Smoke/1.0)";

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}
function section(t) {
  console.log(`\n=== ${t} ===`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(BASE + path, { headers: { "User-Agent": UA } });
      if (res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        await sleep(1000 * 2 ** i);
        continue;
      }
      const body = await res.text();
      return { status: res.status, body };
    } catch (e) {
      lastErr = String(e && e.message);
      await sleep(1000 * 2 ** i);
    }
  }
  return { status: 0, body: "", error: lastErr };
}

/** HTML 实体归一化：不归一会把 `&#x27;` 判成缺失（历史误报来源）。 */
function norm(html) {
  return html
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const probes = [];

async function probe(path, fn) {
  const r = await get(path);
  const html = norm(r.body);
  await sleep(1200); // 节流
  fn(r.status, html);
}

// ---------------------------------------------------------------------------
section("1. /industry 索引页（P0，本轮新建）");
probes.push(() =>
  probe("/industry", (status, html) => {
    check("1.1 /industry 200", status === 200, `实际 ${status}`);
    check("1.2 H1 = Industries", /<h1[^>]*>Industries<\/h1>/.test(html));
    check(
      "1.3 渲染 lead 文案",
      html.includes("Each industry page lists the audits that apply")
    );
    check("1.4 列出 12 个行业入口", (html.match(/\/industry\/[a-z-]+"/g) || []).length >= 12);
    check(
      "1.5 Food 卡片带 6 个子主题链接",
      (html.match(/\/industry\/food-beverage\/[a-z0-9-]+"/g) || []).length >= 6
    );
    check("1.6 JSON-LD ItemList 存在", html.includes('"@type":"ItemList"') || html.includes('"@type": "ItemList"'));
  })
);

// ---------------------------------------------------------------------------
section("2. /industry/food-beverage Master 页（P1）");
probes.push(() =>
  probe("/industry/food-beverage", (status, html) => {
    check("2.1 200", status === 200, `实际 ${status}`);
    // 🔴 G1 修复回归：DB 里唯一已发布的食品供应商必须出现在行业页
    check("2.2 列出已发布供应商 guangzhou-sunny-food", html.includes("guangzhou-sunny-food"));
    check("2.3 Block A 行业特殊性已渲染", html.includes("What makes food suppliers different"));
    // 行业名沿用站点既有的「Electronics / 电子」双语形态（H1 同理），
    // 所以这里的标题是「Food & Beverage / 食品饮料 guides」——断言必须按真实形态写。
    check(
      "2.4 Block B 行业指南区块标题已渲染",
      html.includes("Food & Beverage / 食品饮料 guides")
    );
    check(
      "2.5 6 个子主题链接齐备",
      ["food-safety-certification", "brcgs-audit", "haccp-audit", "fssc-22000-audit", "food-factory-audit-checklist", "food-supplier-verification"].every(
        (s) => html.includes(`/industry/food-beverage/${s}`)
      )
    );
    check("2.6 面包屑指向 /industry（不再是 /suppliers）", html.includes('href="/industry"'));
    // 数据驱动排序：食品三项应排在 SMETA/BSCI 之前
    const iBrc = html.indexOf("/audit-guide/china/BRC");
    const iSmeta = html.indexOf("/audit-guide/china/SMETA");
    check("2.7 行业相关审核项排在前面（BRCGS 先于 SMETA）", iBrc > 0 && iSmeta > 0 && iBrc < iSmeta, `BRC@${iBrc} SMETA@${iSmeta}`);
    // CTA 已从 /training-plans 切到内嵌 RFQ 表单
    check("2.8 CTA 不再链接 /training-plans", !html.includes('"/training-plans"'));
    check("2.9 内嵌 RFQ 表单（name=product 必填项）", html.includes('name="product"'));
    check("2.10 whyTitle 已可见渲染", html.includes("Why Food &amp; Beverage") || html.includes("Why Food & Beverage"));
  })
);

// ---------------------------------------------------------------------------
section("3. 六个子主题页（P2–P5）");
const TOPICS = [
  ["food-safety-certification", "Food safety certification: BRCGS, HACCP and FSSC 22000 compared"],
  ["brcgs-audit", "BRCGS audit"],
  ["haccp-audit", "HACCP audit"],
  ["fssc-22000-audit", "FSSC 22000 audit"],
  ["food-factory-audit-checklist", "Food factory audit checklist"],
  ["food-supplier-verification", "Food supplier verification"],
];
for (const [slug, title] of TOPICS) {
  probes.push(() =>
    probe(`/industry/food-beverage/${slug}`, (status, html) => {
      check(`3.${slug} 200`, status === 200, `实际 ${status}`);
      check(`3.${slug} H1 = ${title}`, html.includes(`<h1 class="text-3xl font-bold">${title}</h1>`), html.match(/<h1[^>]*>([^<]{0,80})/)?.[1] ?? "");
      check(`3.${slug} 面包屑回链行业页`, html.includes('href="/industry/food-beverage"'));
      check(`3.${slug} 内嵌 RFQ 表单`, html.includes('name="product"'));
      check(`3.${slug} JSON-LD Article`, html.includes('"@type":"Article"') || html.includes('"@type": "Article"'));
    })
  );
}
probes.push(() =>
  probe("/industry/food-beverage/food-factory-audit-checklist", (status, html) => {
    // 🔴 只数渲染出的 `<li>☐`：RSC flight payload 里还会再出现一遍纯文本 ☐，
    //    直接数字符会得到 24（假失败）。状态判定一律看 DOM 标记，不看 payload。
    const boxes = (html.match(/<li>☐/g) || []).length;
    check("3.checklist 12 条检查项（按渲染 DOM 计）", boxes === 12, `实际 ${boxes}`);
  })
);
probes.push(() =>
  probe("/industry/food-beverage/food-safety-certification", (status, html) => {
    check("3.p2 三项认证对比都出现", ["BRCGS", "HACCP", "FSSC 22000"].every((x) => html.includes(x)));
  })
);

// ---------------------------------------------------------------------------
section("4. 未配置组合必须 404（禁止空壳页）");
probes.push(() =>
  probe("/industry/electronics/food-safety-certification", (status) => {
    check("4.1 未配置子主题 → 404", status === 404, `实际 ${status}`);
  })
);

// ---------------------------------------------------------------------------
section("5. 其他行业零回归");
probes.push(() =>
  probe("/industry/electronics", (status, html) => {
    check("5.1 200", status === 200, `实际 ${status}`);
    check("5.2 无 Block B（未配置行业不渲染指南区块）", !html.includes("Electronics guides"));
    check("5.3 仍渲染供应商列表区块", html.includes("Verified suppliers in"));
    check("5.4 仍内嵌 RFQ 表单", html.includes('name="product"'));
  })
);
probes.push(() =>
  probe("/industry/textiles", (status, html) => {
    check("5.5 /industry/textiles 200", status === 200, `实际 ${status}`);
    check("5.6 无 Block B", !html.includes("Textiles guides"));
  })
);

// ---------------------------------------------------------------------------
section("6. 本地化（zh / zh-TW）");
probes.push(() =>
  probe("/zh/industry/food-beverage", (status, html) => {
    check("6.1 200", status === 200, `实际 ${status}`);
    check("6.2 行业特殊性标题走 zh", html.includes("食品供应商的特殊之处"));
    check("6.3 指南区块标题走 zh", html.includes("指南"));
    check("6.4 RFQ 表单标签走 zh", html.includes("发布 RFQ"));
  })
);
probes.push(() =>
  probe("/zh-TW/industry/food-beverage/food-factory-audit-checklist", (status, html) => {
    check("6.5 200", status === 200, `实际 ${status}`);
    check("6.6 检查表标题繁化（檢查表）", html.includes("檢查表"));
    check("6.7 未残留简体「检查表」", !html.includes("检查表"));
  })
);
probes.push(() =>
  probe("/ja/industry/food-beverage", (status, html) => {
    check("6.8 ja 200 且框架文案本地化", status === 200 && html.includes("業界"), `实际 ${status}`);
  })
);

// ---------------------------------------------------------------------------
section("7. 站点地图 / llms.txt");
probes.push(() =>
  probe("/sitemap.xml", (status, html) => {
    check("7.1 200", status === 200, `实际 ${status}`);
    const urls = (html.match(/<loc>/g) || []).length;
    check("7.2 URL 总数 >= 1110（1053 + 63 新增）", urls >= 1110, `实际 ${urls}`);
    check("7.3 含 /industry 索引", html.includes("<loc>https://factoryauditb2b.com/industry</loc>"));
    check(
      "7.4 含 6 个食品子主题 × 9 语 = 54 条",
      (html.match(/\/industry\/food-beverage\/[a-z0-9-]+<\/loc>/g) || []).length === 54,
      String((html.match(/\/industry\/food-beverage\/[a-z0-9-]+<\/loc>/g) || []).length)
    );
    check("7.5 不含未配置组合", !html.includes("/industry/electronics/food-safety-certification"));
  })
);
probes.push(() =>
  probe("/llms.txt", (status, html) => {
    check("7.6 200", status === 200, `实际 ${status}`);
    check("7.7 有 Industry pages 段", html.includes("## Industry pages"));
    check("7.8 含 /industry 索引条目", html.includes("(https://factoryauditb2b.com/industry)"));
    check(
      "7.9 含 6 个子主题条目",
      ["food-safety-certification", "brcgs-audit", "haccp-audit", "fssc-22000-audit", "food-factory-audit-checklist", "food-supplier-verification"].every(
        (s) => html.includes(`/industry/food-beverage/${s})`)
      )
    );
  })
);

// ---------------------------------------------------------------------------
for (const p of probes) await p();

console.log("\n============================================================");
if (fail === 0) {
  console.log(`CS-02A 线上烟雾：${pass} PASS / 0 FAIL`);
  console.log("全部通过 ✓");
} else {
  console.log(`CS-02A 线上烟雾：${pass} PASS / ${fail} FAIL`);
  failures.forEach((f) => console.log("  - " + f));
  process.exit(1);
}
