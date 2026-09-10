/**
 * GA4 生产投递对账探针（CS-04 产出，可复用）
 *
 * 用途：在真实浏览器里驱动线上站点，对 GA4 事件**实际送达**做投递对账，
 *      回答「某事件到底发出去了几次」，这是 curl 做不到的。
 *
 * 依赖：系统 Chrome + Node 22（自带 WebSocket）+ 手工启动的 Chrome 调试端口。
 *
 * 用法：
 *   1) 启动无头 Chrome（Windows 路径按需修改）：
 *      "/c/Program Files/Google/Chrome/Application/chrome.exe" \
 *        --headless=new --disable-gpu --no-sandbox --disable-extensions \
 *        --user-data-dir=/tmp/cd-ga4 --remote-debugging-port=9333 \
 *        --remote-allow-origins=* about:blank &
 *   2) node scripts/cs04-ga4-probe.mjs
 *
 * 输出：JSON——每个阶段送达的事件、计数、以及断言（page_view 每页 1 次、
 *      CTA 点击只发 *_cta_click 且不发 *_request、gtag.js 每页只加载 1 次）。
 *
 * ⚠️ 解析要点（曾导致 CS-04 误判 P2，务必保留）：
 *   GA4 把多个事件**批量**放在一个 POST body 里，body 是「按 \n 分行、行内用 & 分隔参数」，
 *   形如：
 *       en=page_view&_ee=1&ep.debug_mode=false
 *       en=page_view_group&_ee=1&ep.debug_mode=false&ep.page=supplier_directory_view
 *   早期版本用 /(?:^|&)en=/ 且未加 m 标志，结果每个批次**只能读到第一条 en**，
 *   把批次里的第二、三条事件全部漏掉，从而得出「page_view_group 从未投递」的错误结论。
 *   现在按行切分 + 全局匹配，并额外回报每批条数供交叉核对。
 *
 * ⚠️ 其他局限（已实测确认，勿误判为回归）：
 *   - GA4 有 3–5s 批量延迟，事件会落到下一个采样窗口，故本脚本对每步都留足等待。
 *   - 别在页面里注入任何 dataLayer 垫片后再断言投递：那会污染结论。
 */

/** 解析一个 /g/collect 请求里实际承载的全部事件名（query + POST body 都要读） */
function parseCollectEvents(url, post) {
  const events = new URL(url).searchParams.getAll("en");
  if (post) {
    // body 按行分；行内再按 & 分。两处都可能有 en=
    for (const line of post.split(/\r?\n/)) {
      for (const m of line.matchAll(/(?:^|&)en=([^&]*)/g)) {
        events.push(decodeURIComponent(m[1]));
      }
    }
  }
  return events;
}
const CDP_PORT = Number(process.env.CDP_PORT || 9333);
const BASE = process.env.BASE || "https://factoryauditb2b.com";

const reqs = [];
const gtmLoads = [];
let phase = "init";

const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
const target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
if (!target) {
  console.error(`FATAL: 127.0.0.1:${CDP_PORT} 上没有可用的 page target，Chrome 是否已启动？`);
  process.exit(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const rid = ++id;
    pending.set(rid, resolve);
    ws.send(JSON.stringify({ id: rid, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expr) =>
  (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;

ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
    return;
  }
  if (m.method !== "Network.requestWillBeSent") return;
  const url = m.params.request.url;
  const post = m.params.request.postData || "";
  if (/googletagmanager\.com\/gtag\/js/.test(url)) gtmLoads.push({ phase, url });
  if (!/google-analytics\.com\/g\/collect/.test(url)) return;

  const u = new URL(url);
  const events = parseCollectEvents(url, post);
  // ---- PII 核对 ----
  // 只扫「应用可控面」：事件名（en）+ 应用自定义参数（ep.* / up.*）的值。
  // GA4 自身的协议参数（cid / sid / tag_exp / uaa / npa …）本来就含长数字串，
  // 把它们算进来会得出「每个请求都有 9 位数字」的假阳性，毫无意义。
  const paramKeys = new Set();
  const appValues = [];
  const collectKv = (k, rawV) => {
    paramKeys.add(k);
    if (k === "en" || k.startsWith("ep.") || k.startsWith("up.") || k.startsWith("epn.")) {
      appValues.push(rawV);
    }
  };
  for (const [k, v] of u.searchParams) collectKv(k, v);
  if (post) {
    for (const line of post.split(/\r?\n/)) {
      if (!line.trim()) continue;
      for (const kv of line.split("&")) {
        const eq = kv.indexOf("=");
        if (eq <= 0) continue;
        collectKv(kv.slice(0, eq), decodeURIComponent(kv.slice(eq + 1)));
      }
    }
  }
  reqs.push({
    phase,
    host: u.host,
    tid: u.searchParams.get("tid") || "(in body)",
    // 空批次（只含心跳/UPD 之类）也记下来，便于交叉核对条数
    events: events.length ? events : ["(none)"],
    batchLines: post ? post.split(/\r?\n/).filter((l) => l.trim()).length : 0,
    paramKeys: [...paramKeys],
    appValues,
    raw: `${url}\n${post}`,
  });
});

await new Promise((r) => ws.addEventListener("open", r));
await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

const stamp = Date.now();
async function load(label, path, waitMs) {
  phase = label;
  await send("Page.navigate", { url: `${BASE}${path}${path.includes("?") ? "&" : "?"}cb=${stamp}` });
  await sleep(waitMs);
  return label;
}

// ---- 1) 三个代表性页面：目录 / 详情 / 服务 ----
await load("A_directory", "/suppliers", 7000);

// ---- 1b) 目录卡片点击 → supplier_profile_view（该事件接在卡片上，不是详情页 <main>）----
//        用 capture 阶段 preventDefault 阻止跳转，否则点击会把我们带走。
phase = "A_card_click";
await evaluate(`(() => {
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest && e.target.closest('a[data-track="supplier_profile_view"]');
    if (a) e.preventDefault();
  }, true);
  return true;
})()`);
const clicked = await evaluate(
  `(() => { var a = document.querySelector('a[data-track="supplier_profile_view"]'); if (a) a.click(); return Boolean(a); })()`
);
console.log(`目录卡片点击：${clicked ? "已点击 1 次" : "未找到卡片（selector 变了？）"}`);
await sleep(5000);

const slug = await evaluate(
  `(() => { const a = Array.from(document.querySelectorAll('a[href*="/suppliers/"]')).find(x => /\\/suppliers\\/[a-z0-9-]+$/.test(x.getAttribute('href')||'')); return a ? a.getAttribute('href') : null; })()`
);
if (slug) await load("B_profile", slug, 7000);
await load("C_services", "/services", 7000);

// ---- 2) 点击四张服务卡片（口径核心断言）----
phase = "D_clicks";
await evaluate(`(() => {
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest && e.target.closest('a[data-track]');
    if (a) e.preventDefault();   // 阻止跳转，保持在同页连续点完四张卡
  }, true);
  return true;
})()`);

const CTA = ["verification_cta_click", "audit_cta_click", "inspection_cta_click", "sourcing_cta_click"];
for (const name of CTA) {
  await evaluate(`(() => { var a = document.querySelector('a[data-track="${name}"]'); if (a) a.click(); return Boolean(a); })()`);
  await sleep(4000);
}

// ---- 3) 等 GA4 批量发送完成 ----
console.log("等待 GA4 批量发送完成（25s）...");
await sleep(25000);

const all = reqs.flatMap((r) => r.events);
const count = (n) => all.filter((x) => x === n).length;
const countIn = (ph, n) => reqs.filter((r) => r.phase === ph).flatMap((r) => r.events).filter((x) => x === n).length;

// 页面级 PV 断言：page_view 与 page_view_group 都必须是「每次页面加载恰好 1 次」。
// A_directory 与 B_profile 声明了 data-track-page（见 app/[locale]/suppliers*），
// C_services 没有 data-track-page，故 page_view_group 期望 0。
const pvPerPhase = Object.fromEntries(
  ["A_directory", "B_profile", "C_services"].map((p) => [p, countIn(p, "page_view")])
);
const pvgPerPhase = Object.fromEntries(
  ["A_directory", "B_profile", "C_services"].map((p) => [p, countIn(p, "page_view_group")])
);

// ---- PII 核对：只扫应用可控面（事件名 + ep./up. 参数值）的原始文本 ----
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LONG_DIGITS_RE = /\d{9,}/;
const allParamKeys = [...new Set(reqs.flatMap((r) => r.paramKeys))].sort();
const appSurface = reqs.flatMap((r) => r.appValues);
const emailHits = appSurface.filter((v) => EMAIL_RE.test(v));
const digitHits = appSurface.filter((v) => LONG_DIGITS_RE.test(v));

console.log(
  JSON.stringify(
    {
      collectRequests: reqs.length,
      tids: [...new Set(reqs.map((r) => r.tid))],
      hosts: [...new Set(reqs.map((r) => r.host))],
      delivered: all,
      eventCounts: all.reduce((a, e) => ((a[e] = (a[e] || 0) + 1), a), {}),
      pii: {
        "出现过的参数键（全量）": allParamKeys,
        "应用可控面取值样本": appSurface.slice(0, 20),
        "应用可控面含邮箱形态的取值（期望 0）": emailHits,
        "应用可控面含 9+ 位连续数字的取值（期望 0）": digitHits,
      },
      assertions: {
        "page_view 总数（3 页 → 期望 3）": count("page_view"),
        "page_view 每页恰好 1 次": pvPerPhase,
        "page_view_group 总数（/suppliers + /suppliers/[slug] → 期望 2）": count("page_view_group"),
        "page_view_group 每页恰好 1 次（/services 无 data-track-page → 0）": pvgPerPhase,
        "verification_cta_click（期望 1）": count("verification_cta_click"),
        "audit_cta_click（期望 1）": count("audit_cta_click"),
        "inspection_cta_click（期望 1）": count("inspection_cta_click"),
        "sourcing_cta_click（期望 1）": count("sourcing_cta_click"),
        "supplier_profile_view（目录卡片点击 → 期望 1）": count("supplier_profile_view"),
        "任何 *_request 送达（期望 0 —— Click ≠ Request）": all.filter((e) => e.endsWith("_request")).length,
        "PII：应用可控面含邮箱形态（期望 0）": emailHits.length,
        "PII：应用可控面含 9+ 位连续数字（期望 0）": digitHits.length,
        "gtag.js 加载总次数（3 页 → 期望 3）": gtmLoads.length,
        "gtag.js 唯一 URL 数（期望 1 —— 不重复加载）": new Set(gtmLoads.map((g) => g.url)).size,
      },
      perRequest: reqs.map((r) => `${r.phase} -> ${r.batchLines}行/[${r.events.join(",")}]`),
    },
    null,
    2
  )
);
ws.close();
process.exit(0);
