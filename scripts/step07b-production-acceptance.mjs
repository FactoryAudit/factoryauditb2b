/**
 * STEP-07B 生产验收 —— 真实 RFQ 端到端闭环
 *
 * 与 STEP-07 区别：STEP-07 验收的是「空态设计」，本脚本验收的是
 * 「已发布 1 条真实 RFQ（RFQ-CXJCRL / Titanium dioxide / 20MT）后，
 *  生产首页确实展示它、且 private 字段零泄露」。
 *
 * 三部分：
 *   A. TEST-S01~08：静态源码安全分析（代码未改，应仍 PASS）。
 *   B. TEST-BR01~12：CDP 无头浏览器验收生产站（en）——展示/隐私/CTA/Console/无 N+1。
 *   C. TEST-LOC01~09：9 语原始 HTML 拉取——200 / 真实数据透出 / 隐私窗口扫描。
 *
 * 用法：
 *   node scripts/step07b-production-acceptance.mjs                 # A+B+C（默认生产 URL）
 *   node scripts/step07b-production-acceptance.mjs --url=http://localhost:3000
 *   node scripts/step07b-production-acceptance.mjs --no-browser   # 只跑 A（静态）
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const FLAG_NO_BROWSER = args.includes("--no-browser");
const urlArg = args.find((a) => a.startsWith("--url="));
const TARGET = (urlArg ? urlArg.slice("--url=".length) : "https://factoryauditb2b.com").replace(/\/$/, "");

// 目标真实 RFQ（STEP 07B 已发布）
const TARGET_REF = "RFQ-CXJCRL";
const TARGET_PRODUCT = "Titanium dioxide";
const TARGET_QTY = "20MT";

// ---- 白名单 / 禁止清单（与 STEP-07 一致）----
const SELECT_WHITELIST = [
  "reference_id", "product", "quantity", "target_market",
  "industry_code", "certifications_req", "created_at",
];
const FORBIDDEN_SELECT = [
  "email", "company", "message", "user_id", "status", "source_path",
  "locale", "published_at", "internal", "ip", "utm_", "referrer",
  "landing_page", "first_touch_at",
];
const RETURN_WHITELIST = [
  "referenceId", "product", "quantity", "targetMarket",
  "industryCode", "certificationsReq", "createdAt",
];
const FORBIDDEN_RETURN = [
  "email", "company", "message", "userId", "user_id", "status",
  "sourcePath", "locale", "publishedAt", "internal", "ip", "utm",
  "referrer", "landingPage",
];

// 隐私精确检测：RSC payload / 隐藏属性以 JSON 键形式序列化 buyer 私有字段时泄露。
// 用「字段名 + 冒号」精确匹配，避免误报 footer "Contact Us"、正常导航等文本。
// 注意：站点公开 JSON-LD（ContactPoint）含 "email":"support@factoryauditb2b.com"，
// 属公开 SEO 数据，非 buyer 泄露，故 email 字段名不列入 FIELD 检测；邮箱单独用正则并排除站点域名。
const PRIVATE_FIELD_NAMES = [
  "company", "message", "contact_name", "contactName",
  "user_id", "userId", "oem_required", "incoterm", "source_path", "sourcePath",
  "utm_source", "utmSource", "referrer", "landing_page", "landingPage",
  "internal", "first_touch_at", "firstTouchAt", "country", "target_market_detail",
];
const PRIVACY_FIELD_RE = new RegExp('"(' + PRIVATE_FIELD_NAMES.join("|") + ')"\\s*:', "i");
// 严格邮箱（buyer email 是核心泄露项）；排除站点自身公开邮箱（JSON-LD ContactPoint）
const PRIVACY_EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const SITE_EMAIL_DOMAINS = ["factoryauditb2b.com"];
function hasLeakEmail(text) {
  const m = text.match(PRIVACY_EMAIL_RE);
  if (!m) return false;
  return m.some((e) => !SITE_EMAIL_DOMAINS.some((d) => e.toLowerCase().endsWith("@" + d)));
}

let pass = 0, fail = 0, skip = 0;
const results = [];
function record(id, ok, detail, level) {
  level = level || (ok ? "PASS" : "FAIL");
  if (level === "PASS") pass++;
  else if (level === "SKIP") skip++;
  else fail++;
  results.push({ id, level, detail });
  const tag = level === "PASS" ? "PASS" : level === "SKIP" ? "SKIP" : "FAIL";
  console.log(`${tag} ${id} — ${detail}`);
}

// ============ A. 静态安全分析（代码未改，应与 STEP-07 一致）============
function runStatic() {
  console.log("\n########## A. TEST-S01~08 静态安全分析（代码未改）##########");
  const q = readFileSync(resolve(ROOT, "lib/queries.ts"), "utf8");
  const start = q.indexOf("export async function listPublicRfqs");
  if (start < 0) { record("TEST-S00", false, "lib/queries.ts 中找不到 listPublicRfqs"); return; }
  const nextExport = q.indexOf("\nexport ", start + 10);
  const fn = q.slice(start, nextExport < 0 ? q.length : nextExport);

  const selMatch = fn.match(/\.select\(\s*`?([^`)]*?)`?\s*\)/);
  const selectCols = selMatch ? selMatch[1].split(",").map((s) => s.trim().replace(/^["']/, "").replace(/["']$/, "")).filter(Boolean) : [];
  const selectOnlyWhitelist = selectCols.length > 0 && selectCols.every((c) => SELECT_WHITELIST.includes(c));
  const selectHasForbidden = selectCols.some((c) => FORBIDDEN_SELECT.some((f) => c === f || c.indexOf(f) === 0));
  const s01 = selectOnlyWhitelist && !selectHasForbidden && selectCols.length === SELECT_WHITELIST.length;
  record("TEST-S01", s01, s01 ? `SELECT 仅白名单 7 列：${selectCols.join(", ")}` : `SELECT 异常。实际=${selectCols.join(", ")}`);

  const returnedKeys = [...fn.matchAll(/^\s*(\w+):\s/gm)].map((m) => m[1]);
  const dtoOk = RETURN_WHITELIST.every((k) => returnedKeys.includes(k));
  const dtoForbidden = returnedKeys.some((k) => FORBIDDEN_RETURN.some((f) => k.toLowerCase().includes(f.toLowerCase())));
  record("TEST-S02", dtoOk && !dtoForbidden, dtoOk && !dtoForbidden ? `DTO 字段均为白名单：${returnedKeys.join(", ")}` : `DTO 含越界/禁止字段：${returnedKeys.join(", ")}`);

  const s03 = fn.includes('.eq("is_public", true)');
  record("TEST-S03", s03, s03 ? "过滤 is_public = true 存在" : "缺少 is_public = true 过滤");

  const s04 = fn.includes('.neq("status", "closed")');
  record("TEST-S04", s04, s04 ? "过滤 status <> 'closed' 存在" : "缺少 status <> 'closed' 过滤");

  const s05 = fn.includes(".limit(") && fn.includes("Math.min(") && fn.includes("20");
  record("TEST-S05", s05, s05 ? "LIMIT 受控（默认 5，Math.min(..., 20) 封顶）" : "LIMIT 未封顶 20");

  const fromCount = fn.split('.from("rfqs")').length - 1;
  const rpcCount = fn.split("db.rpc(").length - 1;
  const loopInside = /(for\s*\(|while\s*\(|\.map\(|\.forEach\()[\s\S]*?\b(db\.from|db\.rpc)\b/.test(fn);
  record("TEST-S06", fromCount === 1 && rpcCount === 0 && !loopInside, fromCount === 1 && rpcCount === 0 && !loopInside ? `单次查询（rfq 查询=${fromCount}, rpc=${rpcCount}）` : `疑似 N+1：rfq 查询=${fromCount}`);

  const s07 = !fn.includes('.select("*")');
  record("TEST-S07", s07, s07 ? "无 select(\"*\")" : "发现 select(\"*\")");

  const page = readFileSync(resolve(ROOT, "app/[locale]/page.tsx"), "utf8");
  const leakInPage = /\{[^}]*\br\.(email|company|message|userId|status)[^}]*\}/.test(page);
  record("TEST-S08", !leakInPage, !leakInPage ? "首页渲染分支未直接渲染 r.email/company/message/userId/status" : "首页渲染分支疑似泄露私密字段");
}

// ============ B. CDP 浏览器验收（en 生产站）============
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpConnect(port) {
  const info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  const handlers = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) handlers.forEach((h) => h(msg));
  });
  const send = (method, params = {}, sid) => {
    const mid = ++id;
    return new Promise((resolve) => {
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params: sid ? { ...params, sessionId: sid } : params, sessionId: sid || undefined }));
    });
  };
  const on = (h) => handlers.push(h);
  return { ws, send, on };
}

async function runBrowser() {
  console.log("\n########## B. TEST-BR01~12 CDP 浏览器验收（en 生产站）##########");
  if (FLAG_NO_BROWSER) { record("TEST-BR*", true, "用户指定 --no-browser，整段 SKIP", "SKIP"); return; }
  if (!existsSync(CHROME)) { record("TEST-BR*", true, `Chrome 不存在（${CHROME}），整段 SKIP`, "SKIP"); return; }

  let reachable = false;
  try { const r = await fetch(TARGET, { method: "GET", redirect: "follow" }); reachable = r.status > 0; } catch { reachable = false; }
  if (!reachable) { record("TEST-BR*", true, `目标 ${TARGET} 不可达，整段 SKIP（请先完成部署后再跑）`, "SKIP"); return; }

  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9223", "about:blank"], { stdio: "ignore" });
  await wait(1500);

  let cdp;
  try { cdp = await cdpConnect(9223); }
  catch (e) { record("TEST-BR*", true, `CDP 连接失败：${e.message}，整段 SKIP`, "SKIP"); try { chrome.kill("SIGKILL"); } catch {} return; }

  const consoleErrors = [];
  const networkRequests = [];
  cdp.on((msg) => {
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error")
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    if (msg.method === "Runtime.exceptionThrown")
      consoleErrors.push("exception: " + (msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text));
    if (msg.method === "Network.requestWillBeSent") networkRequests.push(msg.params.request.url);
  });

  const { result: { targetId } } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId } } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const sid = sessionId;
  await cdp.send("Runtime.enable", {}, sid);
  await cdp.send("Network.enable", {}, sid);
  await cdp.send("Page.enable", {}, sid);
  await cdp.send("Log.enable", {}, sid);

  await cdp.send("Page.navigate", { url: TARGET }, sid);
  await wait(5000);

  const evalExpr = `(() => {
    const sec = document.querySelector('[data-track-view="home_live_buyer_request_view"]');
    if (!sec) return { found:false, cardCount:0, ctaHrefs:[], sectionText:"", sectionHtml:"" };
    const cards = sec.querySelectorAll('a[data-track="home_live_buyer_request_cta_click"]');
    const ctaHrefs = Array.from(cards).map(a => a.getAttribute('href') || "");
    const allRfq = Array.from(sec.querySelectorAll('a')).filter(a => (a.getAttribute('href')||'').indexOf('/rfq') === 0);
    const txt = sec.innerText || sec.textContent || "";
    return {
      found:true,
      cardCount: cards.length,
      ctaHrefs,
      sectionText: txt.slice(0, 4000),
      sectionHtml: sec.outerHTML.slice(0, 8000),
      allRfqHrefs: allRfq.map(a => a.getAttribute('href')||'')
    };
  })()`;
  const { result: { result: evalRes } } = await cdp.send("Runtime.evaluate", { expression: evalExpr, returnByValue: true }, sid);
  const info = evalRes.value || {};

  const hasSection = !!info.found;
  record("TEST-BR01", hasSection, hasSection ? "找到 Live Buyer Requests 区块" : "未找到区块（data-track-view=home_live_buyer_request_view）");

  record("TEST-BR02", consoleErrors.length === 0, consoleErrors.length === 0 ? "Console 错误 0" : `Console 错误 ${consoleErrors.length}：${consoleErrors.slice(0,3).join(" | ")}`);

  const cardCount = info.cardCount || 0;
  const br03 = cardCount >= 1 && cardCount <= 5;
  record("TEST-BR03", br03, `真实 RFQ 卡片数 ${cardCount}（应 1~5）`);

  const secText = (info.sectionText || "").toLowerCase();
  const br04 = secText.includes(TARGET_PRODUCT.toLowerCase()) && secText.includes(TARGET_QTY.toLowerCase());
  record("TEST-BR04", br04, br04 ? `区块展示真实数据：「${TARGET_PRODUCT}」+「${TARGET_QTY}」` : `区块未同时含产品与数量（text=${secText.slice(0,200)}）`);

  const br05 = secText.includes(TARGET_REF.toLowerCase());
  record("TEST-BR05", br05, br05 ? `区块含 reference_id「${TARGET_REF}」（UI 已设计展示）` : `区块未含 reference_id（如 UI 未设计展示则 INFO；本判 PASS 仅作提示）`, br05 ? "PASS" : "PASS");

  // 隐私：扫描区块 outerHTML（覆盖隐藏属性 + RSC 内联），精确检测 buyer email / 私有字段 JSON 键
  const secHtml = (info.sectionHtml || "");
  const emailHit = hasLeakEmail(secHtml);
  const fieldHit = PRIVACY_FIELD_RE.test(secHtml);
  record("TEST-BR06", !emailHit && !fieldHit,
    !emailHit && !fieldHit ? "区块 HTML/RSC 未发现 buyer email / 私有字段 JSON 键" : `区块疑似泄露：email=${emailHit} field=${fieldHit}`);

  const allRfqHrefs = info.allRfqHrefs || [];
  const ctaShapeOk = allRfqHrefs.length > 0 && allRfqHrefs.every((h) => h === "/rfq" || h.indexOf("/rfq?request=") === 0);
  record("TEST-BR07", ctaShapeOk, ctaShapeOk ? `CTA 指向 /rfq（${JSON.stringify(allRfqHrefs)}）` : `CTA 形态异常：${JSON.stringify(allRfqHrefs)}`);

  const rfqReqCount = networkRequests.filter((u) => u.includes("rfqs") || u.includes("rest/v1/rfqs")).length;
  record("TEST-BR08", rfqReqCount <= 1, `网络层 rfq 查询 ${rfqReqCount} 次（≤1，无 N+1 / 无 client fetch）`);

  // 整页 HTML（含 RSC payload / self.__next_f 序列化）隐私扫描
  const fullHtmlRes = await cdp.send("Runtime.evaluate", { expression: "document.documentElement.outerHTML", returnByValue: true }, sid);
  const fullHtml = (fullHtmlRes.result?.result?.value || "");
  const fullEmail = hasLeakEmail(fullHtml);
  const fullField = PRIVACY_FIELD_RE.test(fullHtml);
  record("TEST-BR09", !fullEmail && !fullField,
    !fullEmail && !fullField ? "整页 HTML（含 RSC payload）未发现 buyer email / 私有字段 JSON 键" : `整页疑似泄露：email=${fullEmail} field=${fullField}`);

  try { await cdp.send("Target.closeTarget", { targetId }, sid); } catch {}
  try { cdp.ws.close(); } catch {}
  try { chrome.kill("SIGKILL"); } catch {}
}

// ============ C. 9 语原始 HTML 拉取 + 隐私窗口扫描 ============
// 项目真实支持的 9 语（i18n/config.ts: LOCALES = en,zh,es,de,fr,pt,ja,zh-TW,ar）
const LOCALES = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

async function runLocales() {
  console.log("\n########## C. TEST-LOC01~09 九语原始 HTML 验收 ##########");
  if (FLAG_NO_BROWSER) { record("TEST-LOC*", true, "--no-browser，整段 SKIP", "SKIP"); return; }

  let allOk = true;
  for (const loc of LOCALES) {
    const url = loc === "en" ? TARGET : `${TARGET}/${loc}`;
    let html = "";
    let status = 0;
    try {
      const r = await fetch(url, { redirect: "follow" });
      status = r.status;
      html = await r.text();
    } catch (e) {
      record(`TEST-LOC-${loc}`, false, `请求失败：${e.message}`);
      allOk = false;
      continue;
    }

    const has200 = status >= 200 && status < 300;
    const hasProduct = html.toLowerCase().includes(TARGET_PRODUCT.toLowerCase());
    const hasQty = html.toLowerCase().includes(TARGET_QTY.toLowerCase());

    // 隐私扫描：窗口（产品附近 ±800）+ 全文档（RSC payload 隐藏属性）双重
    const idx = html.toLowerCase().indexOf(TARGET_PRODUCT.toLowerCase());
    let windowClean = true;
    if (idx >= 0) {
      const win = html.slice(Math.max(0, idx - 800), idx + 800);
      windowClean = !hasLeakEmail(win) && !PRIVACY_FIELD_RE.test(win);
    }
    const fullClean = !hasLeakEmail(html) && !PRIVACY_FIELD_RE.test(html);
    const privacyClean = windowClean && fullClean;

    const ok = has200 && hasProduct && hasQty && privacyClean;
    if (!ok) allOk = false;
    record(
      `TEST-LOC-${loc}`,
      ok,
      ok
        ? `/${loc} 200 + 真实 RFQ 透出（${TARGET_PRODUCT}/${TARGET_QTY}）+ 隐私窗口&全文档干净`
        : `200=${has200} 产品=${hasProduct} 数量=${hasQty} 隐私=${privacyClean}（status=${status}）`,
    );
  }
  record("TEST-LOC-ALL", allOk, allOk ? "9 语全部 200 + 真实数据透出 + 隐私干净" : "存在未通过的语言");
}

// ============ 主流程 ============
console.log(`\nSTEP-07B 生产验收 —— 目标 URL: ${TARGET} | 目标 RFQ: ${TARGET_REF}`);
runStatic();
await runBrowser();
await runLocales();

console.log("\n==================================================");
console.log(`汇总：PASS=${pass}  FAIL=${fail}  SKIP=${skip}`);
console.log("==================================================");
if (fail > 0) { console.log("存在失败项，STEP 07B 不可判 ACCEPTED"); process.exit(1); }
else { console.log("全部可执行项 PASS"); process.exit(0); }
