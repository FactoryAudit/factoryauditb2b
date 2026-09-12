/**
 * CS-01 上线后 SEO 审计（只读，线上实测）
 *
 * 规范 §二十九 要求 CS-01 完成后必须重新输出：
 *   sitemap count / duplicate count / metadata head evidence / canonical /
 *   hreflang / robots / noindex / redirect link scan
 *
 * 用法：node scripts/cs01-seo-audit.mjs
 *
 * 铁律：
 *  - 沙箱封 *.workers.dev ⇒ 一律走 https://factoryauditb2b.com
 *  - 多请求必须节流；429/5xx 用**秒级指数**退避重试（边缘偶发 503）
 *  - 断言一条不放宽：失败就是失败
 */
const BASE = "https://factoryauditb2b.com";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
const failures = [];
function ok(cond, label, extra = "") {
  if (cond) {
    pass++;
    console.log("  PASS  " + label);
  } else {
    fail++;
    failures.push(label + (extra ? " :: " + extra : ""));
    console.log("  FAIL  " + label + (extra ? " :: " + extra : ""));
  }
}

async function get(path, { ua, redirect = "follow" } = {}) {
  const ATTEMPTS = 5;
  let lastErr = "unknown";
  for (let i = 0; i < ATTEMPTS; i++) {
    if (i > 0) await sleep(1000 * Math.pow(2, i - 1)); // 1s 2s 4s 8s
    try {
      const res = await fetch(BASE + path, {
        redirect,
        headers: { "user-agent": ua ?? "cs01-seo-audit/1.0", accept: "text/html" },
      });
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) {
        lastErr = "HTTP " + res.status;
        continue;
      }
      return { status: res.status, body, url: res.url, headers: res.headers };
    } catch (e) {
      lastErr = String((e && e.message) || e);
    }
  }
  return { status: 0, body: "", url: "", headers: new Map(), error: lastErr };
}

const throttle = () => sleep(250);

// ===========================================================================
async function auditSitemap() {
  console.log("\n=== 1. Sitemap ===");
  const r = await get("/sitemap.xml", { ua: "cs01-seo-audit/1.0" });
  ok(r.status === 200, "1a sitemap.xml 可访问", "status=" + r.status);
  const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const total = locs.length;
  const freq = new Map();
  for (const u of locs) freq.set(u, (freq.get(u) ?? 0) + 1);
  const dups = [...freq.entries()].filter(([, n]) => n > 1);
  const unique = freq.size;
  console.log(`      总 URL ${total} / 唯一 ${unique} / 重复 ${total - unique}`);
  ok(dups.length === 0, "1b sitemap 无重复 URL", dups.slice(0, 5).map(([u, n]) => `${u}×${n}`).join(", "));

  // 每条路径的出现次数应恰为 9（九语各一条）
  const stripLocale = (u) => {
    let p = u.replace(/^https?:\/\/[^/]+/, "") || "/";
    for (const l of ["zh-TW", "zh", "es", "de", "fr", "pt", "ja", "ar", "en"]) {
      if (p === `/${l}`) return "/";
      if (p.startsWith(`/${l}/`)) return p.slice(l.length + 1);
    }
    return p;
  };
  const pathFreq = new Map();
  for (const u of locs) {
    const p = stripLocale(u);
    pathFreq.set(p, (pathFreq.get(p) ?? 0) + 1);
  }
  const badPaths = [...pathFreq.entries()].filter(([, n]) => n !== 9);
  ok(
    badPaths.length === 0,
    `1c 每条路径恰好出现 9 次（九语）｜路径数 ${pathFreq.size}`,
    badPaths.slice(0, 5).map(([p, n]) => `${p}=${n}`).join(", ")
  );

  // 不该在 sitemap 里的
  for (const banned of ["/sample-report", "/register", "/login", "/account", "/admin"]) {
    ok(!locs.some((u) => stripLocale(u) === banned), `1d sitemap 不含 ${banned}`);
  }
  return { total, unique };
}

// ===========================================================================
async function auditMetadataHead() {
  console.log("\n=== 2. Metadata 是否进入 <head>（多 UA 实测）===");
  // 爬虫 UA：必须直出在 <head>（CS-01 的验收契约）
  const CRAWLERS = {
    Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    Bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "OAI-SearchBot": "OAI-SearchBot/1.0; +https://openai.com/searchbot",
    GPTBot: "GPTBot/1.2 (+https://openai.com/gptbot)",
    ClaudeBot: "ClaudeBot/1.0 (+https://www.anthropic.com/claudebot)",
    PerplexityBot: "PerplexityBot/1.0",
  };
  for (const [name, ua] of Object.entries(CRAWLERS)) {
    const r = await get("/membership", { ua });
    await throttle();
    if (r.status !== 200) {
      ok(false, `2.${name} 可访问`, "status=" + r.status);
      continue;
    }
    const headEnd = r.body.indexOf("</head>");
    const title = r.body.indexOf("<title");
    const canon = r.body.indexOf('rel="canonical"');
    const inHead = title >= 0 && title < headEnd && canon >= 0 && canon < headEnd;
    ok(
      inHead,
      `2.爬虫 ${name}：title+canonical 直出 <head>`,
      `</head>@${headEnd} title@${title} canonical@${canon}`
    );
  }
  // 浏览器 UA：Next 设计上走「流式元数据」（渲染到 body 再由 JS 搬进 head），
  // 因为浏览器会执行 JS —— 这是预期行为，不是缺陷。
  // 所以对浏览器 UA 断言的是「title 确实存在于文档」，而不是「必须在 head 内」。
  const br = await get("/membership", { ua: "cs01-seo-audit/1.0" });
  await throttle();
  ok(
    /<title>/.test(br.body) && br.body.includes('rel="canonical"'),
    "2.浏览器 UA：走流式元数据（title/canonical 仍在文档中，由 JS 搬入 head，属 Next 预期设计）",
    `status=${br.status}`
  );
}

// ===========================================================================
async function auditCanonicalHreflang() {
  console.log("\n=== 3. canonical / hreflang ===");
  const r = await get("/zh/membership", { ua: "Googlebot/2.1" });
  await throttle();
  const canon = (r.body.match(/<link rel="canonical" href="([^"]+)"/) ?? [])[1];
  ok(canon === `${BASE}/zh/membership`, "3a zh 页 canonical 指向本语种自身", String(canon));
  const alternates = [...r.body.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)];
  const hrefs = [...r.body.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)];
  const all = alternates.length ? alternates : hrefs;
  const codes = all.map((m) => m[1]);
  console.log(`      hreflang 条数 ${all.length}：[${codes.join(", ")}]`);
  ok(all.length === 10, "3b hreflang 恰好 10 条（9 语 + x-default）", `实际 ${all.length}`);
  ok(!codes.includes("en-US"), "3c 无 en-US 别名重复");
  ok(!codes.includes("zh-Hans"), "3d 无 zh-Hans 别名重复");
  ok(codes.includes("x-default"), "3e 含 x-default");
  const urls = all.map((m) => m[2]);
  ok(new Set(urls).size === 9, "3f hreflang 指向 9 个互不相同的 URL", `唯一 ${new Set(urls).size}`);
}

// ===========================================================================
async function auditRobots() {
  console.log("\n=== 4. robots.txt ===");
  const r = await get("/robots.txt", { ua: "cs01-seo-audit/1.0" });
  ok(r.status === 200, "4a robots.txt 可访问", "status=" + r.status);
  const txt = r.body;
  const groups = [];
  let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const mua = line.match(/^user-agent:\s*(.+)$/i);
    if (mua) {
      cur = { ua: mua[1].trim(), allow: [], disallow: [] };
      groups.push(cur);
      continue;
    }
    const ma = line.match(/^allow:\s*(.+)$/i);
    const md = line.match(/^disallow:\s*(.+)$/i);
    if (ma && cur) cur.allow.push(ma[1].trim());
    if (md && cur) cur.disallow.push(md[1].trim());
  }
  // 要守的是「**指令不矛盾**」，不是「UA 不重复」。
  // Cloudflare 托管段会 prepend 自己的规则组，我们无法从仓库侧删除 ⇒ 同一 UA 出现
  // 两个组是常态。只要两组指令方向一致（都禁 / 都放），合并语义就是确定的。
  const byUa = new Map();
  for (const g of groups) {
    if (!byUa.has(g.ua)) byUa.set(g.ua, []);
    byUa.get(g.ua).push(g);
  }
  const contradictory = [];
  for (const [ua, gs] of byUa) {
    const deniesRoot = gs.some((g) => g.disallow.includes("/"));
    const allowsRoot = gs.some((g) => g.allow.includes("/"));
    if (deniesRoot && allowsRoot) contradictory.push(ua);
  }
  ok(
    contradictory.length === 0,
    "4b 同一 UA 不存在指令相反的规则组（都禁或都放）",
    contradictory.join(", ")
  );
  // 检索类必须放行、训练类必须禁止
  const allowAll = new Set(groups.filter((g) => g.allow.includes("/")).map((g) => g.ua));
  const denyAll = new Set(groups.filter((g) => g.disallow.includes("/")).map((g) => g.ua));
  for (const b of ["OAI-SearchBot", "PerplexityBot", "Claude-SearchBot", "Googlebot", "Bingbot"]) {
    ok(allowAll.has(b), `4c 检索/引用类 ${b} 被放行`);
  }
  for (const b of ["GPTBot", "ClaudeBot", "CCBot", "Bytespider"]) {
    ok(denyAll.has(b), `4d 训练类 ${b} 被禁止`);
  }
  ok(txt.includes("Sitemap: " + BASE + "/sitemap.xml"), "4e 声明 sitemap 地址");
}

// ===========================================================================
async function auditNoindexAndRedirects() {
  console.log("\n=== 5. noindex / 重定向扫描 ===");
  for (const p of ["/register", "/login", "/account"]) {
    const r = await get(p, { ua: "Googlebot/2.1", redirect: "manual" });
    await throttle();
    const hasNoindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(r.body);
    ok(hasNoindex, `5a ${p} 带 noindex`, `status=${r.status}`);
  }
  // /sample-report 必须 308
  const sr = await get("/sample-report", { ua: "Googlebot/2.1", redirect: "manual" });
  await throttle();
  ok(
    sr.status === 308 || sr.status === 301,
    "5b /sample-report 永久重定向",
    "status=" + sr.status
  );
  const loc = sr.headers?.get?.("location") ?? "";
  ok(
    String(loc).endsWith("/standard-report"),
    "5c 重定向目标为 /standard-report",
    "location=" + loc
  );
  // 正常页面不得返回 3xx
  for (const p of ["/", "/membership", "/standard-report", "/zh/audit-guide/china/BSCI"]) {
    const r = await get(p, { ua: "Googlebot/2.1", redirect: "manual" });
    await throttle();
    ok(r.status === 200, `5d ${p} 直出 200（非重定向）`, "status=" + r.status);
  }
}

// ===========================================================================
async function auditAuditGuideTitle() {
  console.log("\n=== 6. audit-guide 中文标题 / 描述 ===");
  const r = await get("/zh/audit-guide/china/BSCI", { ua: "Googlebot/2.1" });
  await throttle();
  const title = (r.body.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? "";
  const desc = (r.body.match(/<meta name="description" content="([^"]*)"/) ?? [])[1] ?? "";
  console.log(`      zh title: ${title}`);
  console.log(`      zh desc : ${desc.slice(0, 90)}…`);
  ok(!/ChinaBSCI/.test(title), "6a 标题不再出现 ChinaBSCI 粘连", title);
  ok(title.includes("中国"), "6b 标题使用中文国名", title);
  ok(/验厂/.test(title), "6c 标题保留「验厂」", title);
  ok(desc.length > 0 && !/^Find /.test(desc), "6d description 已是中文（非英文原文）", desc.slice(0, 60));

  const ja = await get("/ja/audit-guide/vietnam/SMETA", { ua: "Googlebot/2.1" });
  await throttle();
  const jaTitle = (ja.body.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? "";
  console.log(`      ja title: ${jaTitle}`);
  ok(jaTitle.includes("ベトナム"), "6e 日文标题国名已本地化", jaTitle);
}

// ===========================================================================
(async () => {
  console.log("CS-01 上线后 SEO 审计  ——  " + BASE);
  await auditSitemap();
  await auditMetadataHead();
  await auditCanonicalHreflang();
  await auditRobots();
  await auditNoindexAndRedirects();
  await auditAuditGuideTitle();
  console.log("\n" + "=".repeat(60));
  console.log(`CS-01 SEO AUDIT：${pass} PASS / ${fail} FAIL`);
  if (fail > 0) {
    console.log("\n失败项：");
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
  console.log("ALL PASS");
})();
