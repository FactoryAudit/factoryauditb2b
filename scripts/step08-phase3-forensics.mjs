// step08-phase3-forensics.mjs
// 生产取证：确认 gtag -> GA4 真实链路，并验证 5 个漏斗事件是否真的到达 GA4 网络层。
// 不提交 RFQ（避免污染生产库）。仅触发 impression / CTA / rfq_enter(待测) / rfq_start。
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const B64 = (s) => Buffer.from(s, "utf8").toString("base64");
const USER_DATA = `C:/tmp/cdp-step08-${Date.now()}`;

// ---------- CDP helper ----------
function startChrome() {
  const child = spawn(CHROME, [
    `--headless=new`,
    `--no-sandbox`,
    `--disable-dev-shm-usage`,
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`,
    `--no-first-run`,
    `--no-default-browser-check`,
    `--disable-gpu`,
    `about:blank`,
  ], { stdio: "ignore", detached: true });
  return child;
}

async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      if (j?.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("no chrome ws");
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.handlers = {}; this.queue = []; }
  open() {
    return new Promise((resolve) => {
      this.ws.onopen = () => resolve();
      this.ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id && this.handlers[m.id]) { this.handlers[m.id](m); delete this.handlers[m.id]; }
        else if (this.onEvent) this.onEvent(m);
      };
      this.ws.onerror = (e) => console.error("WS ERR", e.message);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve) => {
      this.handlers[id] = (m) => resolve(m.result ?? m);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  notify(method, params = {}) { this.ws.send(JSON.stringify({ method, params })); }
}

// ---------- main ----------
const chrome = startChrome();
let exitCode = 0;
try {
  const wsUrl = await getWs();
  const ws = new WebSocket(wsUrl);
  const cdp = new CDP(ws);
  await cdp.open();

  // 全局事件收集
  const netReqs = []; // {url, postData}
  const gtagCalls = []; // app-layer event names
  cdp.onEvent = (m) => {
    if (m.method === "Network.requestWillBeSent") {
      const u = m.params?.request?.url || "";
      if (u.includes("google-analytics.com")) {
        netReqs.push({ url: u, postData: m.params?.request?.postData || null });
      }
    }
  };

  // 启动 CD
  const ct = await cdp.send("Target.createTarget", { url: "about:blank" });
  const pageTargetId = ct?.targetId ?? ct?.result?.targetId;
  const at = await cdp.send("Target.attachToTarget", { targetId: pageTargetId, flatten: true });
  const sessionId = at?.sessionId ?? at?.result?.sessionId;
  console.log("[diag] attached target", pageTargetId, "session", sessionId);
  // flatten:true → sessionId must be a TOP-LEVEL CDP field, not inside params
  const s = (method, params = {}) => {
    const id = ++cdp.id;
    return new Promise((resolve) => {
      cdp.handlers[id] = (m) => resolve(m.result ?? m);
      cdp.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  };
  const sn = (method, params = {}) => cdp.ws.send(JSON.stringify({ method, params, sessionId }));

  await s("Page.enable");
  await s("Network.enable", { maxPostDataSize: 0 });
  await s("Runtime.enable");
  console.log("[diag] domain enable done");
  console.log("[diag] session enabled, target", pageTargetId);

  // 注入 gtag 包装 + 诊断脚本（在页面脚本之前执行）
  const inject = `
    window.__gtag = [];
    (function(){
      function wrap(){
        if (typeof window.gtag === 'function' && !window.__wrapped){
          window.__wrapped = true;
          var orig = window.gtag;
          window.gtag = function(){
            try { if (arguments[0]==='event' && arguments[1]) window.__gtag.push(arguments[1]); } catch(e){}
            return orig.apply(this, arguments);
          };
        }
        if (!window.__wrapped) setTimeout(wrap, 30);
      }
      wrap();
    })();
  `;
  await s("Page.addScriptToEvaluateOnNewDocument", { source: inject });

  const evalIn = async (expr) => {
    const r = await s("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    console.error("[raw eval] " + JSON.stringify(r).slice(0, 400));
    return r?.result?.value;
  };

  // ===== 步骤 1：首页 impression =====
  console.log("\\n=== STEP 1: homepage load (impression) ===");
  const navRes = await s("Page.navigate", { url: "https://factoryauditb2b.com/" });
  console.log("nav result:", JSON.stringify(navRes));
  await sleep(5000);
  console.log("eval 1+1:", await evalIn(`1+1`));
  console.log("loaded href:", await evalIn(`location.href`));
  console.log("readyState:", await evalIn(`document.readyState`));
  console.log("title:", await evalIn(`document.title`));
  const diag1 = await evalIn(`(function(){
    return {
      gtagType: typeof window.gtag,
      gtagSrc: (window.gtag && window.gtag.toString) ? window.gtag.toString().slice(0,120) : null,
      hasGTM: typeof window.google_tag_manager !== 'undefined',
      dataLayerHasGtm: Array.isArray(window.dataLayer) ? window.dataLayer.filter(function(x){return x && (x['gtm.js']||x['gtm.start']);}).length : -1,
      dataLayerLen: Array.isArray(window.dataLayer) ? window.dataLayer.length : -1,
      captured: window.__gtag.slice()
    };
  })()`);
  console.log("DIAG:", JSON.stringify(diag1, null, 2));

  // ===== 步骤 2：点击 LBR CTA =====
  console.log("\\n=== STEP 2: click LBR CTA ===");
  await evalIn(`(function(){
    var el = document.querySelector('[data-track="home_live_buyer_request_cta_click"]');
    if (el) { el.click(); return 'clicked'; }
    return 'NOT_FOUND';
  })()`);
  await sleep(2500);
  const diag2 = await evalIn(`window.__gtag.slice()`);
  console.log("gtag calls after CTA:", JSON.stringify(diag2));

  // ===== 步骤 3：进入 /rfq =====
  console.log("\\n=== STEP 3: navigate /rfq ===");
  await s("Page.navigate", { url: "https://factoryauditb2b.com/rfq" });
  await sleep(4000);
  const diag3 = await evalIn(`(function(){
    return {
      hasRfqEnter: window.__gtag.includes('rfq_enter'),
      captured: window.__gtag.slice()
    };
  })()`);
  console.log("DIAG /rfq:", JSON.stringify(diag3));

  // ===== 步骤 4：聚焦表单 (rfq_start) =====
  console.log("\\n=== STEP 4: focus form (rfq_start) ===");
  await evalIn(`(function(){
    var f = document.querySelector('form input, form textarea');
    if (f) { f.focus(); f.dispatchEvent(new Event('focus', {bubbles:true})); return 'focused'; }
    return 'NO_FORM';
  })()`);
  await sleep(2000);

  // ===== 汇总 =====
  console.log("\\n=== NETWORK (google-analytics.com) ===");
  const enMap = {};
  let idx2 = 0;
  for (const r of netReqs) {
    idx2++;
    const combined = r.url + (r.postData || "");
    const allEn = [...combined.matchAll(/[?&]en=([^&]+)/g)].map((x) => decodeURIComponent(x[1]));
    const en = allEn.length ? allEn.join(",") : "(no en)";
    enMap[en] = (enMap[en] || 0) + 1;
    console.log(`\n--- GA req #${idx2} en=${en} ---`);
    console.log("URL:", r.url.slice(0, 300));
    if (r.postData) console.log("POST:", r.postData.slice(0, 600));
  }
  console.log("\nEvent-name histogram (network):", JSON.stringify(enMap, null, 2));

  console.log("\\n=== APP-LAYER gtag event names (captured) ===");
  const counts = {};
  for (const n of gtagCalls) counts[n] = (counts[n]||0)+1;
  console.log(JSON.stringify(counts, null, 2));

  // 判定
  const want = ["home_live_buyer_request_view","home_live_buyer_request_cta_click","rfq_start"];
  const netEn = Object.keys(enMap);
  console.log("\\n=== VERDICT ===");
  for (const w of want) {
    const app = gtagCalls.includes(w);
    const net = netEn.some((e) => e === w);
    console.log(`${w}: app=${app} net=${net}`);
  }
  console.log("page_view in net:", netEn.some((e)=>e==="page_view"));
  console.log("DIAG1.hasGTM:", diag1?.hasGTM, "dataLayerHasGtm:", diag1?.dataLayerHasGtm);
} catch (e) {
  console.error("FATAL", e);
  exitCode = 1;
} finally {
  try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch {}
  process.exit(exitCode);
}
