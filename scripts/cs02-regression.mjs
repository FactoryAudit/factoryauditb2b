// CS-02 —— 详情页 trust 展示回归（只读，不写任何数据）
// 用法: node --env-file=.env scripts/cs02-regression.mjs
const SITE = "https://factoryauditb2b.com";

const SLUGS = [
  "dongguan-plastic-molding",
  "guangzhou-textile-factory",
  "ho-chi-minh-garment",
  "shenzhen-precision-electronics",
];

// 禁止出现在「供应商专属」区域的高信任表述（legacy trust claim）
const BANNED = [
  "Identity Verified",
  "Document Verified",
  "Factory Verified",
  "Factory verified",
  "Business checked",
  "Documents reviewed",
  "Factory audited",
  "Audited 2026-06",
  "Audited 2026-03",
];

let fail = 0;
function ok(cond, label, detail) {
  console.log((cond ? "  ✅ " : "  ❌ ") + label + (detail ? "  — " + detail : ""));
  if (!cond) fail++;
}

/**
 * 取页面。必须带 cache-buster：
 * 部署后短时间内，同一 URL 的重复请求可能拿到旧响应（Workerd 预热 / 上游缓存），
 * 会让「修复已上线」被误判成「修复未上线」。加时间戳可强制回源。
 */
async function getPage(path) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(SITE + path + sep + "cb=" + Date.now(), {
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  return { status: r.status, html: await r.text() };
}

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
  // =========================================================================
  console.log("=== 1. Meta Description —— 禁止 legacy trust claim（最高风险位）===");
  for (const slug of SLUGS) {
    const { html } = await getPage("/en/suppliers/" + slug);
    const meta = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? "";
    const hits = BANNED.filter((b) => meta.includes(b));
    ok(hits.length === 0, slug.padEnd(30) + " meta 无 legacy claim", hits.length ? "命中: " + hits.join(", ") : meta.slice(0, 95) + "…");

    // OG / Twitter 描述同源，一并查
    const og = (html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1] ?? "";
    const ogHits = BANNED.filter((b) => og.includes(b));
    ok(ogHits.length === 0, slug.padEnd(30) + " og:description 无 legacy claim", ogHits.length ? "命中: " + ogHits.join(", ") : "");
  }

  // =========================================================================
  console.log("\n=== 2. 信任摘要卡 —— 必须是 Unverified + Evidence on file ===");
  for (const slug of SLUGS) {
    const { html } = await getPage("/en/suppliers/" + slug);
    const start = html.indexOf("Verification level");
    const card = start > -1 ? stripTags(html.slice(start, start + 1500)) : "";

    ok(/Unverified/.test(card), slug.padEnd(30) + " 信任卡含 Unverified", card.slice(0, 90));
    const bannedInCard = BANNED.filter((b) => card.includes(b));
    ok(bannedInCard.length === 0, slug.padEnd(30) + " 信任卡无高信任表述", bannedInCard.length ? "命中: " + bannedInCard.join(", ") : "clean");
    ok(/Evidence on file/.test(card), slug.padEnd(30) + " 标签为 Evidence on file（非 Evidence reviewed）");
  }

  // =========================================================================
  console.log("\n=== 3. Reported certification claims 标签 ===");
  for (const slug of SLUGS) {
    const { html } = await getPage("/en/suppliers/" + slug);
    ok(html.includes("Reported certification claims"), slug.padEnd(30) + " 含 Reported certification claims");
  }

  // =========================================================================
  console.log("\n=== 4. 多 locale 冒烟（4 家 × en/zh/ja/ar）===");
  for (const slug of SLUGS) {
    for (const loc of ["en", "zh", "ja", "ar"]) {
      const r = await getPage("/" + loc + "/suppliers/" + slug);
      ok(r.status === 200, loc + " / " + slug.slice(0, 22), "HTTP " + r.status);
    }
  }

  // =========================================================================
  console.log("\n=== 5. 结构化数据（JSON-LD）无 legacy claim ===");
  for (const slug of SLUGS) {
    const { html } = await getPage("/en/suppliers/" + slug);
    const blocks = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || [];
    const json = blocks.map((b) => b.replace(/<[^>]+>/g, "")).join(" ");
    const hits = BANNED.filter((bb) => json.includes(bb));
    ok(hits.length === 0, slug.padEnd(30) + " JSON-LD 无 legacy claim", hits.length ? "命中: " + hits.join(", ") : "blocks=" + blocks.length);
  }

  // =========================================================================
  console.log("\n=== 6. Title / Canonical / Hreflang 无 legacy claim ===");
  for (const slug of SLUGS) {
    const { html } = await getPage("/en/suppliers/" + slug);
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? "";
    const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] ?? "";
    const hreflangs = (html.match(/<link rel="alternate" hreflang="[^"]*" href="[^"]*"/g) || []).length;
    const all = title + " " + canon;
    const hits = BANNED.filter((b) => all.includes(b));
    ok(hits.length === 0, slug.padEnd(30) + " title/canonical 干净", hits.length ? "命中: " + hits.join(", ") : "hreflang=" + hreflangs + " canonical=" + canon.replace(SITE, ""));
  }

  // =========================================================================
  console.log("\n=== 7. 目录页 /suppliers 不回归（4 张卡仍 Not yet verified）===");
  {
    const { html } = await getPage("/en/suppliers");
    const notYet = (html.match(/Not yet verified/g) || []).length;
    ok(notYet >= 4, "目录页 Not yet verified ≥ 4", "count=" + notYet);
    const bannedInDir = BANNED.filter((b) => html.includes(b));
    ok(bannedInDir.length === 0, "目录页无高信任表述", bannedInDir.length ? "命中: " + bannedInDir.join(", ") : "clean");
    const cards = (html.match(/class="card p-5 hover:border-\[#0f4c81\] transition"/g) || []).length;
    ok(cards === 4, "目录页仍渲染 4 张卡片", "cards=" + cards);
  }

  // =========================================================================
  console.log("\n=== 8. 数据库侧确认（legacy 原值必须原封不动）===");
  {
    const fs = await import("node:fs");
    const env = Object.fromEntries(
      fs.readFileSync(".env", "utf8").split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          let v = l.slice(i + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
          return [l.slice(0, i).trim(), v];
        })
    );
    const B = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
    const K = env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await fetch(B + "/rest/v1/suppliers?select=slug,verification_status,audit_status,certifications,risk_score,verification_level&order=slug", {
      headers: { apikey: K, Authorization: "Bearer " + K },
    });
    const rows = await res.json();
    const expect = {
      "dongguan-plastic-molding": ["Identity Verified", "Not yet audited"],
      "guangzhou-textile-factory": ["Document Verified", "Audited 2026-03"],
      "ho-chi-minh-garment": ["Identity Verified", "Pending"],
      "shenzhen-precision-electronics": ["Factory Verified", "Audited 2026-06"],
    };
    for (const row of rows) {
      const [vs, as] = expect[row.slug] ?? [];
      ok(row.verification_status === vs && row.audit_status === as,
        row.slug.padEnd(30) + " legacy 原值未变", row.verification_status + " / " + row.audit_status);
      ok(row.verification_level === "unverified", row.slug.padEnd(30) + " verification_level = unverified", row.verification_level);
    }
    // 3 张证据表仍为 0
    for (const t of ["supplier_documents", "supplier_certifications", "supplier_audits"]) {
      const rr = await fetch(B + "/rest/v1/" + t + "?select=*&limit=1", {
        headers: { apikey: K, Authorization: "Bearer " + K, Prefer: "count=exact" },
      });
      const cr = rr.headers.get("content-range") || "";
      ok(cr.endsWith("/0") || cr === "*/0", t.padEnd(26) + " 仍为 0 行", cr);
    }
  }

  console.log("\n========================================");
  console.log(fail === 0 ? "✅ CS-02 回归全部通过（FAIL=" + fail + "）" : "❌ CS-02 回归失败项: " + fail);
  console.log("========================================");
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
