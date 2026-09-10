// CS-02 Pre-check —— 只读抓取生产页面「当前公开展示」的实际文案
// 不写任何数据。用法: node --env-file=.env scripts/cs02-public-display.mjs
const SITE = "https://factoryauditb2b.com";
const SLUGS = [
  "dongguan-plastic-molding",
  "guangzhou-textile-factory",
  "ho-chi-minh-garment",
  "shenzhen-precision-electronics",
];

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  // ---------- 目录页：4 张卡片的实际文案 ----------
  console.log("============ 目录页 /en/suppliers — 卡片实际文案 ============");
  const dirRes = await fetch(SITE + "/en/suppliers");
  const dirHtml = await dirRes.text();
  // 每张卡片的 dl 区块：Evidence level / Verification / Risk / Last evidence
  const cards = dirHtml.split('class="card p-5 hover:border-[#0f4c81] transition"').slice(1);
  for (let i = 0; i < cards.length; i++) {
    const seg = cards[i].slice(0, 2600);
    const text = stripTags(seg);
    // 取公司名（第一段）+ 关键字段
    const name = (text.match(/^([^,]{3,60}?),/) || [])[1] ?? "(?)";
    const evLevel = (text.match(/(Evidence reviewed[^|]{0,40}|Evidence reviewed:\s*\d+|[^|]{0,30}Evidence[^|]{0,30})/) || [])[0] ?? "(?)";
    console.log(`\n[卡片 ${i + 1}] ${name.trim()}`);
    for (const kw of ["Evidence", "Verification", "Risk", "Last"]) {
      const m = text.match(new RegExp(kw + "[^|]{0,60}", "i"));
      if (m) console.log("   " + m[0].trim().slice(0, 70));
    }
  }

  // ---------- 详情页：信任卡 + meta ----------
  for (const slug of SLUGS) {
    console.log(`\n============ 详情页 /en/suppliers/${slug} ============`);
    const r = await fetch(SITE + "/en/suppliers/" + slug);
    const html = await r.text();

    // meta description（会进 Google SERP）
    const meta = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? "(none)";
    console.log("  meta description: " + meta.slice(0, 220));

    // 信任摘要卡：Verification level 区块
    const cardStart = html.indexOf("Verification level");
    if (cardStart > -1) {
      const seg = html.slice(cardStart, cardStart + 1800);
      const text = stripTags(seg);
      console.log("  信任卡可见文案: " + text.slice(0, 200));
    }

    // 核验范围清单
    const scopeStart = html.indexOf("What was verified");
    if (scopeStart > -1) {
      const seg = html.slice(scopeStart, scopeStart + 1200);
      const text = stripTags(seg);
      console.log("  核验范围: " + text.slice(0, 180));
    }

    // 高信任表述计数
    const banned = ["Factory verified", "Factory audited", "Business checked", "Documents reviewed", "Factory Verified", "Identity Verified", "Document Verified"];
    const hits = banned.filter((b) => html.includes(b));
    console.log("  命中的高信任表述: " + (hits.length ? hits.join(" | ") : "(无)"));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
