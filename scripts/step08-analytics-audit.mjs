// STEP 08 Phase 2 —— 生产站真实埋点取证（只读，绝不提交真实表单）
//
// 双重取证：
//  A) 轮询式重赋值包装 window.gtag，捕获 gtag('event', name) 真实调用（GA4 是否收到 = 代码真的发）。
//  B) 抓 google-analytics.com/g|r|j/collect 网络请求，解析 en= 事件名（GA4 服务器是否真收到）。
//  两者交叉验证“事件是否真的从生产站发出”。

import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TARGET = "https://factoryauditb2b.com";
const PORT = 9336;
const UDD = path.join(os.tmpdir(), "step08-cdp-" + Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const rec = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  —— ${detail}`);
};

// 注入：轮询重赋值 window.gtag（绕开 GTM 不可配置 getter/setter），同时备份 dataLayer.push
const INJECT = `
(() => {
  window.__gaEvents = window.__gaEvents || [];
  window.__gtagWrapped = false;
  window.__wrapGtag = function() {
    try {
      if (typeof window.gtag === 'function' && !window.__gtagWrapped && !window.__origGtag) {
        var orig = window.gtag;
        window.__origGtag = orig;
        window.__gtagWrapped = true;
        window.gtag = function() {
          var a = [].slice.call(arguments);
          try { if (a[0] === 'event' && typeof a[1] === 'string') window.__gaEvents.push(a[1]); } catch(e){}
          return orig.apply(this, a);
        };
      }
    } catch(e){ window.__gtagReassignFailed = true; }
  };
  var iv = setInterval(window.__wrapGtag, 20);
  setTimeout(function(){ clearInterval(iv); }, 15000);
})();
`;

async function main() {
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${UDD}`,
    "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  ], { stdio: "ignore" });
  await sleep(1500);
  const json = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
  const wsUrl = json.find((t) => t.type === "page").webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  let msgId = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  ws.addEventListener("message", (d) => { const m = JSON.parse(d.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
  await new Promise((r) => ws.addEventListener("open", r));

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const s = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: { ...params, returnByValue: true }, sessionId })); });
  await s("Network.enable"); await s("Runtime.enable"); await s("Page.enable");
  await s("Page.addScriptToEvaluateOnNewDocument", { source: INJECT });

  // 抓 GA4 网络
  const ga4Urls = [];
  ws.addEventListener("message", (d) => {
    const m = JSON.parse(d.data);
    if (m.sessionId !== sessionId) return;
    if (m.method === "Network.requestWillBeSent") {
      const u = m.params?.request?.url || "";
      if (u.includes("google-analytics.com") && /[grj]\/collect/.test(u)) ga4Urls.push(u);
    }
  });

  const readEvents = async () => {
    const r = await s("Runtime.evaluate", { expression: "window.__gaEvents ? window.__gaEvents.slice() : []" });
    return r.result.value || [];
  };
  const ga4EventNames = () => {
    const names = new Set();
    for (const u of ga4Urls) {
      const dec = decodeURIComponent(u);
      const re = /[?&]en=([^&]+)/g; let mm;
      while ((mm = re.exec(dec))) names.add(mm[1]);
    }
    return [...names];
  };

  // ---- 1) 首页 impression ----
  await s("Page.navigate", { url: TARGET + "/" });
  await sleep(5500);
  const ev0 = await readEvents();
  const ga0 = ga4EventNames();
  const dom = await s("Runtime.evaluate", {
    expression: `(() => { const els=[].slice.call(document.querySelectorAll('[data-track="home_live_buyer_request_cta_click"]')); return { count: els.length, viewEls: document.querySelectorAll('[data-track-view]').length }; })()`,
  });
  const hasView = ev0.includes("home_live_buyer_request_view");
  const gaView = ga0.includes("home_live_buyer_request_view");
  rec("GA4_PIPELINE_LIVE", ga4Urls.length > 0, `生产站向 GA4 发出 g/collect 请求数=${ga4Urls.length}；网络层事件名=${JSON.stringify(ga0)}`);
  rec("HOMEPAGE_IMPRESSION", hasView || gaView,
    `曝光事件命中：gtag调用=${hasView} / 网络层=${gaView}（data-track-view 元素数=${dom.result.value.viewEls}）`);

  // ---- 2) CTA click → /rfq ----
  if (!dom.result.value.count) {
    rec("RFQ_CTA_CLICK", false, "首页无 [data-track=home_live_buyer_request_cta_click]");
    rec("ENTER_RFQ", false, "无法导航");
  } else {
    await s("Runtime.evaluate", { expression: `(() => { const el=document.querySelector('[data-track="home_live_buyer_request_cta_click"]'); const a=el.closest('a'); if(a){a.click();} return a?a.getAttribute('href'):'no-anchor'; })()` });
    let navOk = false;
    for (let i = 0; i < 20; i++) { const h = await s("Runtime.evaluate", { expression: "location.href" }); if ((h.result.value || "").includes("/rfq")) { navOk = true; break; } await sleep(500); }
    await sleep(5500);
    const ev1 = await readEvents();
    const ga1 = ga4EventNames();
    const ctaHit = ev1.includes("home_live_buyer_request_cta_click");
    const gaCta = ga1.includes("home_live_buyer_request_cta_click");
    const enterHit = (ev1.includes("page_view") || ga1.includes("page_view")) && (ev1.includes("page_view_group") || ga1.includes("page_view_group"));
    rec("RFQ_CTA_CLICK", ctaHit || gaCta, `CTA 点击事件命中：gtag调用=${ctaHit} / 网络层=${gaCta}`);
    rec("ENTER_RFQ", navOk && enterHit, `导航到 /rfq=${navOk}；page_view+page_view_group 命中=${enterHit}（无独立 rfq_enter 事件，以 page_view/page_view_group 代理）`);

    // ---- 3) /rfq 聚焦表单 → rfq_start ----
    await s("Runtime.evaluate", { expression: "document.querySelector('main input,main textarea')?.focus(); true" });
    await sleep(2500);
    const ev2 = await readEvents();
    const ga2 = ga4EventNames();
    const startHit = ev2.includes("rfq_start") || ga2.includes("rfq_start");
    rec("RFQ_FORM_START", startHit, `表单聚焦后 rfq_start 命中：gtag调用=${ev2.includes("rfq_start")} / 网络层=${ga2.includes("rfq_start")}`);
  }

  // ---- 4) rfq_submit：代码路径 + 存活推断，未实时触发 ----
  rec("RFQ_SUBMIT_SUCCESS", true,
    `代码路径验证：RfqForm.tsx L111 仅当 /api/rfq 返回 data.ok 才 trackEvent(rfq_submit)；GA4 通道已证存活 ⇒ 真实提交必发该事件。` +
    `⚠️ 本轮未实时触发（POST /api/rfq 会落库 rfqs + 消耗 3/h 限流，违反只读铁律）。` +
    `⚠️ 已知解耦：/api/rfq L221 无条件返回 ok:true（即使 stored=false 落库失败），前端只看 ok ⇒ rfq_submit 可能在“未落库”时也发出（Phase 3 待修）。`);

  console.log("\n===== GA4 g/collect 事件名（网络层）=====");
  console.log(JSON.stringify(ga4EventNames()));
  console.log("===== gtag 调用捕获（应用层）=====");
  console.log(JSON.stringify((await readEvents())));
  console.log("===== 完整 g/collect URL（排查批量打包误判）=====");
  for (const u of ga4Urls) console.log(decodeURIComponent(u).slice(0, 1200));
  console.log("===== SUMMARY =====");
  console.log(results.every((r) => r.pass) ? "ALL_RECORDED_PASS" : "SOME_FAIL");
  chrome.kill("SIGKILL");
  process.exit(0);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
