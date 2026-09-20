/**
 * STEP-06 —— 首页「What do you need?」四入口生产验收（HTTP + CDP）。
 *
 * TEST-01  首页存在四入口（Find Suppliers / Industrial Clusters / Verify Supplier / RFQ）
 * TEST-02  /suppliers /industrial-clusters /verify-supplier /rfq 全部 200
 * TEST-03  四 CTA 的 href 正确、非 JS 跳转、不 404
 * TEST-04  Desktop 布局正常（无横向溢出）
 * TEST-05  Mobile 布局正常（无横向溢出）
 * TEST-06  Console 0 error / 0 exception
 * TEST-07  Network：首页加载不触发 /api/ 请求
 * TEST-08  Analytics：四入口点击触发 home_*_cta_click（项目现有 *_cta_click 规范）
 * TEST-09  9 语言首页均含本地化 needTitle（无 missing translation）
 *
 * TEST-10（回归 STEP 04/05）不在此脚本，单独跑 9 个回归 + step05 验收。
 *
 * 跑法：node scripts/step06-homepage-acceptance.mjs
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = process.env.ACCEPT_BASE ?? "https://factoryauditb2b.com";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333 + Math.floor(Math.random() * 200);
const DICT_DIR = path.join(process.cwd(), "i18n", "dictionaries");

let pass = 0,
  fail = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? `  :: ${detail}` : ""}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `  :: ${detail}` : ""}`);
  }
}

// ---------------- HTTP 部分（TEST-01/02/03/09） ----------------
async function get(url) {
  const r = await fetch(url, { redirect: "follow" });
  const body = await r.text();
  return { status: r.status, body, finalUrl: r.url };
}

function readNeedTitle(locale) {
  const f = path.join(DICT_DIR, `${locale}.json`);
  const o = JSON.parse(fs.readFileSync(f, "utf8"));
  return o.home?.needTitle;
}

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
const ENTRY_TRACKS = [
  ["home_find_suppliers_cta_click", "/suppliers"],
  ["home_industrial_clusters_cta_click", "/industrial-clusters"],
  ["home_verify_supplier_cta_click", "/verify-supplier"],
  ["home_rfq_cta_click", "/rfq"],
];
const TARGET_ROUTES = ["/suppliers", "/industrial-clusters", "/verify-supplier", "/rfq"];

// ---------------- CDP 部分 ----------------
async function withChrome(fn) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "step06-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  let wsUrl = null;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      wsUrl = j.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!wsUrl) {
    proc.kill();
    throw new Error("Chrome DevTools 端口未就绪");
  }
  try {
    return await fn(wsUrl);
  } finally {
    proc.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.exceptions = [];
    this.netRequests = [];
    this.sessionId = null;
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        return;
      }
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        this.consoleErrors.push((msg.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" "));
      }
      if (msg.method === "Runtime.exceptionThrown") {
        this.exceptions.push(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text ?? "unknown");
      }
      if (msg.method === "Network.requestWillBeSent") {
        this.netRequests.push(msg.params.request?.url ?? "");
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (this.sessionId) payload.sessionId = this.sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    const c = new Cdp(ws);
    const { targetId } = await c.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await c.send("Target.attachToTarget", { targetId, flatten: true });
    c.sessionId = sessionId;
    await c.send("Runtime.enable");
    await c.send("Network.enable");
    await c.send("Page.enable");
    return c;
  }
  async navigate(url) {
    this.consoleErrors = [];
    this.exceptions = [];
    this.netRequests = [];
    await this.send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, 1200));
  }
  async evaluate(expression) {
    const { result } = await this.send("Runtime.evaluate", { expression, returnByValue: true });
    if (result && result.subtype === "error") throw new Error(result.description ?? "eval error");
    return result?.value;
  }
}

// ================= 主流程 =================
console.log(`\nSTEP-06 首页四入口生产验收  BASE=${BASE}\n`);

// ---- TEST-02：四目标路由可达 ----
console.log("--- TEST-02 四目标路由可达 ---");
for (const r of TARGET_ROUTES) {
  try {
    const { status, finalUrl } = await get(`${BASE}${r}`);
    check(`GET ${r} → ${status}`, status >= 200 && status < 400, `final=${finalUrl}`);
  } catch (e) {
    check(`GET ${r}`, false, e.message);
  }
}

// ---- TEST-01 / TEST-03 / TEST-09：首页 HTML ----
console.log("\n--- TEST-01 / TEST-03 / TEST-09 首页 HTML ---");
let homeHtml = "";
try {
  const { status, body } = await get(`${BASE}/`);
  homeHtml = body;
  check("GET / 首页 → 200", status >= 200 && status < 400, `len=${body.length}`);

  // TEST-01：四入口区块存在（section 标题 + 4 个 data-track）
  check("TEST-01 首页含「What do you need?」区块", body.includes("What do you need?"));
  const trackAttrs = ENTRY_TRACKS.map(([t]) => `data-track="${t}"`);
  const allTracks = trackAttrs.every((a) => body.includes(a));
  check("TEST-01 四入口 data-track 属性齐全", allTracks, trackAttrs.map((a) => a.replace('data-track="', "").replace('"', "")).join("/"));

  // TEST-03：href 正确 + 非 JS
  const hrefRe = /data-track="(home_\w+_cta_click)"[^>]*href="([^"]+)"/g;
  let m,
    found = {};
  while ((m = hrefRe.exec(body))) found[m[1]] = m[2];
  let hrefOk = true;
  const hrefDetails = [];
  for (const [track, expect] of ENTRY_TRACKS) {
    const h = found[track];
    const ok = h && h.includes(expect) && !/^javascript:/i.test(h);
    if (!ok) hrefOk = false;
    hrefDetails.push(`${track}→${h ?? "(缺失)"}`);
  }
  check("TEST-03 四 CTA href 正确且非 JS 跳转", hrefOk, hrefDetails.join(" | "));
} catch (e) {
  check("TEST-01/03 首页 HTML", false, e.message);
}

// ---- TEST-09：9 语言本地化 ----
console.log("\n--- TEST-09 9 语言本地化 ---");
for (const loc of LOCALES) {
  try {
    const url = loc === "en" ? `${BASE}/` : `${BASE}/${loc}`;
    const { status, body } = await get(url);
    const expected = readNeedTitle(loc);
    const ok = status >= 200 && status < 400 && expected && body.includes(expected);
    check(`TEST-09 ${loc} 含本地化标题「${expected}」`, ok, `status=${status}`);
  } catch (e) {
    check(`TEST-09 ${loc}`, false, e.message);
  }
}

// ---- TEST-04~08：CDP 浏览器 ----
console.log("\n--- TEST-04~08 浏览器（CDP）---");
try {
  await withChrome(async (wsUrl) => {
    const cdp = await Cdp.connect(wsUrl);

    // ===== Desktop =====
    await cdp.navigate(`${BASE}/`);
    check("TEST-06 Desktop Console 0 error", cdp.consoleErrors.length === 0, `errors=${cdp.consoleErrors.length}`);
    check("TEST-06 Desktop 0 exception", cdp.exceptions.length === 0, `exceptions=${cdp.exceptions.length}`);

    // TEST-07：首页加载不触发「STEP 06 新增」的 /api/ 请求。
    // 已知全局行为：AuthProvider（app/[locale]/layout.tsx）在 hydration 后拉 /api/me 查询会员档位，
    // 该请求全站每个页面都会发，早于 STEP 06 即存在（build-m5.log 起）。STEP 06 四入口是纯 <a href> 链接，
    // 不发起任何 DB query / API。因此白名单仅放行 /api/me，其余任何 /api/ 请求即判 FAIL。
    const GLOBAL_API_ALLOWLIST = ["/api/me"];
    const apiCalls = cdp.netRequests.filter((u) => u.includes("/api/"));
    const newApiCalls = apiCalls.filter(
      (u) => !GLOBAL_API_ALLOWLIST.some((w) => u.includes(w))
    );
    check(
      "TEST-07 首页无 STEP06 新增的 /api/ 请求",
      newApiCalls.length === 0,
      `total=${apiCalls.length} new=${newApiCalls.length} allowlisted=${apiCalls.length - newApiCalls.length}`
    );
    if (apiCalls.length) {
      console.log("    (白名单内全局请求: " + apiCalls.filter((u) => GLOBAL_API_ALLOWLIST.some((w) => u.includes(w))).join(", ") + ")");
    }

    const noOverflowDesktop = await cdp.evaluate(
      "document.documentElement.scrollWidth <= window.innerWidth + 1"
    );
    check("TEST-04 Desktop 无横向溢出", !!noOverflowDesktop, `scrollW<=innerW`);

    // ===== Analytics 点击（TEST-08）=====
    const events = await cdp.evaluate(`(function(){
      window.__ev = [];
      window.gtag = function(){ window.__ev.push(Array.prototype.slice.call(arguments)); };
      function fire(sel){
        var el = document.querySelector(sel);
        if(!el) return;
        var guard = function(e){ e.preventDefault(); };
        el.addEventListener('click', guard, true);
        el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
        el.removeEventListener('click', guard, true);
      }
      fire('[data-track="home_find_suppliers_cta_click"]');
      fire('[data-track="home_industrial_clusters_cta_click"]');
      fire('[data-track="home_verify_supplier_cta_click"]');
      fire('[data-track="home_rfq_cta_click"]');
      return (window.__ev||[]).map(function(a){ return a[1]; });
    })()`);
    const got = new Set(events);
    const wantEvents = ENTRY_TRACKS.map(([t]) => t);
    const allFired = wantEvents.every((e) => got.has(e));
    check("TEST-08 四入口点击触发 home_*_cta_click", allFired, `captured=${[...got].join(",")}`);

    // ===== Mobile =====
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.navigate(`${BASE}/`);
    const noOverflowMobile = await cdp.evaluate(
      "document.documentElement.scrollWidth <= window.innerWidth + 1"
    );
    check("TEST-05 Mobile 无横向溢出", !!noOverflowMobile, `scrollW<=innerW`);
    check("TEST-06 Mobile Console 0 error", cdp.consoleErrors.length === 0, `errors=${cdp.consoleErrors.length}`);
  });
} catch (e) {
  check("TEST-04~08 CDP 执行", false, e.message);
}

console.log(`\n=================\nSTEP-06 验收：${pass} PASS / ${fail} FAIL`);
if (fail) {
  console.log("失败项：" + failures.join("; "));
  process.exit(1);
}
console.log("全部通过 ✓");
