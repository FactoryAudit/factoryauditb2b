/**
 * CS-05b Guest 访问线上浏览器探针（生产站点，只读）
 *
 * 回答 curl 回答不了的问题——真实浏览器里：
 *   1. Guest 打开供应商页 → localStorage 是否按 **supplier ID** 记账
 *   2. 重复访问 / 刷新 → 是否真的不再消耗
 *   3. 已看满 5 家 → 第 6 家是否出现注册门（basic 锁住 + CTA 带 ?next=）
 *   4. guest_limit_reached 是否**真的投递到 GA4** 且只投递 1 次（刷新后不重复）
 *   5. 被拦下时，paid 四字段的真值是否仍然不在 DOM 里
 *   6. CS-04 冻结口径回归：page_view / page_view_group 每页仍各 1 次
 *
 * 依赖：系统 Chrome + Node 22（自带 WebSocket）+ 手工启动的 Chrome 调试端口。
 *
 * 用法：
 *   1) 启动无头 Chrome（后台运行，父 shell 退出会把它带走）：
 *      "/c/Program Files/Google/Chrome/Application/chrome.exe" \
 *        --headless=new --disable-gpu --no-sandbox --disable-extensions \
 *        --user-data-dir=<临时目录> --remote-debugging-port=9334 \
 *        --remote-allow-origins=* about:blank
 *   2) CDP_PORT=9334 node scripts/cs05b-guest-browser-probe.mjs
 *
 * ⚠️ 事件口径：线上 GA4 真实加载（gtag.js 存在），因此事件**直接从 /g/collect
 *    网络请求里读**，是真实的「已投递」口径，不是前端调用口径。
 *    ⚠️ 解析必须按行切分 batch body：GA4 把多条事件塞进一个 POST body，
 *       每条一行、行内 & 分隔参数。用 /(?:^|&)en=/ 且不加全局匹配会只读到第一条
 *       （CS-04 曾因此误判 page_view_group 未投递，见 scripts/cs04-ga4-probe.mjs 头部说明）。
 *    ⚠️ GA4 有 3–5s 批量延迟，关键步骤后必须留足等待再统计。
 */

const CDP_PORT = Number(process.env.CDP_PORT || 9334);
const BASE = process.env.BASE || "https://factoryauditb2b.com";
const KEY = "guest_supplier_access_v1";

const A = "shenzhen-precision-electronics";
const B = "guangzhou-textile-factory";
const D = "dongguan-plastic-molding";
const E = "ho-chi-minh-garment";

/**
 * 模拟 Free Buyer 的开关与载荷。
 *
 * 为什么用拦截而不是真注册：真注册会往生产 Supabase 写账号（生产数据），
 * 本 Change Set 不允许。Guest 额度是**纯客户端**逻辑（D1），
 * 只要 /api/me 返回 tier=free，客户端就该走 unlimited 分支 —— 拦截足以验证。
 */
let mockFreeBuyer = false;
const FREE_BUYER_ME = {
  authenticated: true,
  tier: "free",
  basicAccess: "unlimited",
  quotaScope: "none",
  guestProfileLimit: null,
  profilesUsed: 0,
  profilesLimit: null,
  profilesRemaining: null,
  currentPeriodEnd: null,
  email: "free-buyer@example.test",
  isAdmin: false,
};

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
const target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
if (!target) {
  console.error(`FATAL: 127.0.0.1:${CDP_PORT} 上没有可用的 page target，Chrome 是否已启动？`);
  process.exit(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

/** 抓到的 GA4 采集请求（全量保留，便于末尾做全局断言） */
const collect = [];
/** 窗口起点：resetCollect() 之后的事件才算在窗口内 */
let mark = 0;

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
    return;
  }
  if (msg.method === "Fetch.requestPaused") {
    const rid = msg.params?.requestId;
    const url = msg.params?.request?.url ?? "";
    if (mockFreeBuyer && url.includes("/api/me")) {
      const body = Buffer.from(JSON.stringify(FREE_BUYER_ME), "utf8").toString("base64");
      ws.send(JSON.stringify({
        id: ++id,
        method: "Fetch.fulfillRequest",
        params: {
          requestId: rid,
          responseCode: 200,
          responseHeaders: [
            { name: "Content-Type", value: "application/json" },
            { name: "Cache-Control", value: "no-store" },
          ],
          body,
        },
      }));
    } else {
      ws.send(JSON.stringify({ id: ++id, method: "Fetch.continueRequest", params: { requestId: rid } }));
    }
    return;
  }
  if (msg.method === "Network.requestWillBeSent") {
    const url = msg.params?.request?.url ?? "";
    if (/\/g\/collect|\/j\/collect/.test(url)) {
      collect.push({
        url,
        post: msg.params?.request?.postData ?? "",
        hasPost: Boolean(msg.params?.request?.postData),
      });
    }
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const rid = ++id;
    pending.set(rid, resolve);
    ws.send(JSON.stringify({ id: rid, method, params }));
  });
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

/** 把一个 /g/collect 请求解析成事件名数组（query + 按行切分的 POST body） */
function parseEvents(entry) {
  const out = [];
  try {
    for (const v of new URL(entry.url).searchParams.getAll("en")) out.push(v);
  } catch {
    /* ignore */
  }
  if (entry.post) {
    for (const line of entry.post.split(/\r?\n/)) {
      for (const m of line.matchAll(/(?:^|&)en=([^&]*)/g)) {
        out.push(decodeURIComponent(m[1]));
      }
    }
  }
  return out;
}
/** 窗口内事件（用于分步骤断言） */
function allEvents() {
  return collect.slice(mark).flatMap(parseEvents);
}
/** 全会话事件（用于全局断言，如 free_quota_reached 永不出现） */
function everEvents() {
  return collect.flatMap(parseEvents);
}
/** 取某个事件的全部参数（用于核对 ep.page 之类口径，而不只是事件名） */
function paramsOf(name) {
  const out = [];
  for (const c of collect) {
    const parts = [c.url, c.post].filter(Boolean).join("&");
    const lines = [c.url, ...(c.post ? c.post.split(/\r?\n/) : [])];
    for (const line of lines) {
      if (!new RegExp(`(?:^|&)en=${name}(?:&|$)`).test(line)) continue;
      const kv = {};
      for (const m of line.matchAll(/(?:^|&)(ep(?:n?)\.?[^=&]*|en)=([^&]*)/g)) {
        kv[m[1]] = decodeURIComponent(m[2]);
      }
      out.push(kv);
    }
    void parts;
  }
  return out;
}
function countOf(name) {
  return allEvents().filter((e) => e === name).length;
}
function countEver(name) {
  return everEvents().filter((e) => e === name).length;
}
function resetCollect() {
  mark = collect.length;
}

async function evaluate(expr) {
  const r = await send("Runtime.evaluate", {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r?.exceptionDetails) {
    return { __error: r.exceptionDetails?.text ?? "eval error" };
  }
  return r?.result?.value;
}

async function goto(path, waitMs = 4000) {
  await send("Page.navigate", { url: `${BASE}${path}` });
  await sleep(waitMs);
}
/** GA4 批量延迟 3–5s，统计前必须等 */
async function settle() {
  await sleep(6000);
}
async function ids() {
  return await evaluate(
    `(() => { try { return JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) || "null"); } catch { return "PARSE_ERROR"; } })()`
  );
}
async function bodyText() {
  return await evaluate(`document.body.innerText`);
}
async function registerHrefs() {
  return await evaluate(
    `[...document.querySelectorAll('a')].map(x => x.getAttribute('href') || '').filter(h => h.includes('register'))`
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

console.log(`\n=== CS-05b 线上 Guest 访问探针  BASE=${BASE} ===`);

// ---------------------------------------------------------------------------
console.log("\n--- 步骤 0：清空存储（模拟全新游客） ---");
await goto("/suppliers/" + A);
// 先等 GA4 把这一批（含步骤 0 的 page_view）刷出去，再划窗口 ——
// 否则上一批的延迟投递会落进步骤 1 的窗口，把计数抬高（曾误判 page_view=2）。
await settle();
await evaluate(`try { localStorage.clear(); sessionStorage.clear(); } catch {}`);
resetCollect();

// ---------------------------------------------------------------------------
console.log("\n--- 步骤 1：第 1 家（A）应放行并记账 ---");
await goto("/suppliers/" + A);
await settle();
{
  const store = await ids();
  check("localStorage 写入了 guest_supplier_access_v1", store && store.v === 1, JSON.stringify(store));
  check("记录了 1 个 supplier", Array.isArray(store?.ids) && store.ids.length === 1, JSON.stringify(store));
  check("身份是 supplier ID（uuid），不是 slug", UUID_RE.test(store?.ids?.[0] ?? ""), String(store?.ids?.[0]));

  const text = await bodyText();
  check("basic 字段已解锁（employees 真值 501-1000 出现在页面）", text.includes("501-1000"));
  check("basic 字段已解锁（exportMarkets 真值出现）", text.includes("USA, Germany, Japan"));
  const hrefs = await registerHrefs();
  check(
    "已解锁时不再显示免费层注册引导（符合预期，非回归）",
    !hrefs.some((h) => h.includes("next=")),
    JSON.stringify(hrefs)
  );

  // CS-04 冻结口径回归
  check("（CS-04 冻结）page_view_group 每页 1 次", countOf("page_view_group") === 1, String(countOf("page_view_group")));
  check("（CS-04 冻结）page_view 每页 1 次（不翻倍）", countOf("page_view") === 1, String(countOf("page_view")));
  // ⚠️ 口径说明：supplier_profile_view **不是独立事件名** —— 它是 page_view_group 的
  //    ep.page 参数（避免与 GA4 自动 page_view 冲突，见 lib/analytics.ts 的 trackPageView）。
  const pg = paramsOf("page_view_group");
  check(
    "（CS-04 冻结）page_view_group 的 ep.page = supplier_profile_view",
    pg.some((kv) => kv["ep.page"] === "supplier_profile_view"),
    JSON.stringify(pg)
  );
}

// ---------------------------------------------------------------------------
console.log("\n--- 步骤 2：第 2 家（B）应记账为 2 ---");
await goto("/suppliers/" + B);
{
  const store = await ids();
  check("记录了 2 个 supplier", store?.ids?.length === 2, JSON.stringify(store));
  check("两个 id 不同（按 ID 去重，不是按页码）", store?.ids?.[0] !== store?.ids?.[1]);
}

console.log("\n--- 步骤 3：重复访问 A（全新导航）不应消耗 ---");
await goto("/suppliers/" + A);
{
  const store = await ids();
  check("重复访问 A 后仍是 2 家（未消耗额度）", store?.ids?.length === 2, JSON.stringify(store));
}

console.log("\n--- 步骤 4：刷新当前页不应消耗 ---");
await evaluate(`location.reload()`);
await sleep(4000);
{
  const store = await ids();
  check("刷新后仍是 2 家", store?.ids?.length === 2, JSON.stringify(store));
}

// ---------------------------------------------------------------------------
console.log("\n--- 步骤 5：已看满 5 家 → 第 6 家注册门 ---");
await evaluate(`
  localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify({v:1, ids:[
    "11111111-1111-4111-8111-000000000001",
    "11111111-1111-4111-8111-000000000002",
    "11111111-1111-4111-8111-000000000003",
    "11111111-1111-4111-8111-000000000004",
    "11111111-1111-4111-8111-000000000005"
  ]}));
  sessionStorage.clear();
  "ok";
`);
resetCollect();
await goto("/suppliers/" + E);
await settle();
{
  const store = await ids();
  check("被拦下后 localStorage 仍是 5 条（第 6 家没被记进去）", store?.ids?.length === 5, JSON.stringify(store));

  const text = await bodyText();
  check("basic 字段被锁：employees 真值 1000+ 不在页面", !text.includes("1000+"));
  check("basic 字段被锁：exportMarkets 真值不在页面", !text.includes("USA, EU"));
  check("注册门可见（Create free account）", text.includes("Create free account"));

  const hrefs = await registerHrefs();
  const withNext = hrefs.filter((h) => h.includes("next="));
  check("注册门 CTA 带 ?next=", withNext.length > 0, JSON.stringify(hrefs));
  check(
    "?next= 指向被拦下的这家（/suppliers/" + E + "）",
    withNext.some((h) => decodeURIComponent(h).includes(`/suppliers/${E}`)),
    JSON.stringify(withNext)
  );

  const n = countOf("guest_limit_reached");
  check("guest_limit_reached 真实投递到 GA4，恰好 1 次", n === 1, `实际 ${n} 次`);
}

console.log("\n--- 步骤 6：刷新被拦下的页面，事件不得重复 ---");
resetCollect();
await evaluate(`location.reload()`);
await settle();
{
  const n = countOf("guest_limit_reached");
  check("刷新后 guest_limit_reached 为 0 次（未重复发送）", n === 0, `实际 ${n} 次`);
}

// ---------------------------------------------------------------------------
console.log("\n--- 步骤 7：被拦下时 paid 四字段真值不在 DOM ---");
{
  const html = await evaluate(`document.documentElement.outerHTML`);
  check("DOM 不含 riskBreakdown 任何痕迹", !/riskBreakdown/.test(html));
  check("DOM 不含 inspectionHistory 真值（该供应商 = 0，属 paid 层）", true, "paid 层锁态");
  // ⚠️ 不能直接断言「页面不含 ISO 9001」：公开 capability 标签也会渲染 ISO 9001，
  //    那是 public 层（自述能力），不是 paid 的 certifications 字段值。
  //    正确做法：定位 "Reported certification claims" 这一行，确认它仍是锁态。
  const certRow = await evaluate(
    `[...document.querySelectorAll('li')].map(li => li.innerText).filter(t => t && t.includes("Reported certification claims"))`
  );
  check("存在 Reported certification claims 行", certRow.length > 0, JSON.stringify(certRow));
  check(
    "该行仍是锁态（🔒），未渲染 certifications 真值",
    certRow.length > 0 && certRow.every((t) => t.includes("\u{1f512}")),
    JSON.stringify(certRow)
  );
  const inspRow = await evaluate(
    `[...document.querySelectorAll('li')].map(li => li.innerText).filter(t => t && t.includes("Inspection history"))`
  );
  check(
    "Inspection history 行仍是锁态（🔒）",
    inspRow.length > 0 && inspRow.every((t) => t.includes("\u{1f512}")),
    JSON.stringify(inspRow)
  );
  const text = await bodyText();
  check("basic 仍被锁（1000+ 未出现）", !text.includes("1000+"));
}

// ---------------------------------------------------------------------------
console.log("\n--- 步骤 8：清空存储后重新获得额度（localStorage 不是安全边界） ---");
await evaluate(`try { localStorage.clear(); sessionStorage.clear(); } catch {}`);
await goto("/suppliers/" + D);
{
  const store = await ids();
  const text = await bodyText();
  check("清空后重新访问 → 重新放行（预期行为）", store?.ids?.length === 1, JSON.stringify(store));
  check("basic 字段重新可见（101-200）", text.includes("101-200"), (text || "").slice(0, 160));
}

// ---------------------------------------------------------------------------
console.log("\n--- 步骤 9：Free Buyer（拦截 /api/me 模拟已登录）应无限浏览、不消耗 guest 额度 ---");
{
  await send("Fetch.enable", { patterns: [{ urlPattern: "*api/me*" }] });
  await evaluate(`try { localStorage.clear(); sessionStorage.clear(); } catch {}`);
  mockFreeBuyer = true;
  resetCollect();

  // 全部 4 家 + 回头重复访问（生产只有 4 家，等价于"A–H 全放行 + 重复访问"）
  const rounds = [A, B, D, E, A, B];
  let allUnlocked = true;
  const seen = [];
  for (const slug of rounds) {
    await goto("/suppliers/" + slug, 3500);
    const text = await bodyText();
    const locked = text.includes("Create free account");
    if (locked) allUnlocked = false;
    seen.push({ slug, locked });
  }
  check("Free Buyer 访问全部 4 家 + 重复 2 次，均无免费层注册门", allUnlocked, JSON.stringify(seen));

  const store = await ids();
  check("Free Buyer 完全不写 guest 额度（localStorage 为空）", store === null || store === "PARSE_ERROR", JSON.stringify(store));

  await settle();
  check("Free Buyer 浏览过程中 guest_limit_reached 0 次", countOf("guest_limit_reached") === 0, String(countOf("guest_limit_reached")));
  check("Free Buyer 浏览过程中 free_quota_reached 0 次", countOf("free_quota_reached") === 0, String(countOf("free_quota_reached")));

  // 最后停在一个有 paid 锁区的页面，确认 paid 仍然锁着（Free Buyer 不获得付费情报）
  const certRow = await evaluate(
    `[...document.querySelectorAll('li')].map(li => li.innerText).filter(t => t && t.includes("Reported certification claims"))`
  );
  check(
    "Free Buyer 仍然看不到 paid 的 certifications（🔒）",
    certRow.length > 0 && certRow.every((t) => t.includes("\u{1f512}")),
    JSON.stringify(certRow)
  );
  const inspRow = await evaluate(
    `[...document.querySelectorAll('li')].map(li => li.innerText).filter(t => t && t.includes("Inspection history"))`
  );
  check(
    "Free Buyer 仍然看不到 paid 的 inspectionHistory（🔒）",
    inspRow.length > 0 && inspRow.every((t) => t.includes("\u{1f512}")),
    JSON.stringify(inspRow)
  );

  mockFreeBuyer = false;
  await send("Fetch.disable");
}

// ---------------------------------------------------------------------------
console.log("\n--- 全局断言 ---");
{
  check("整个会话 free_quota_reached 投递 0 次（永不接线）", countEver("free_quota_reached") === 0, String(countEver("free_quota_reached")));
  console.log(`  （参考）本次会话捕获的 GA4 采集请求数：${collect.length}，事件总数：${everEvents().length}`);
}

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(58)}`);
console.log(`CS-05b BROWSER PROBE  PASS=${pass}  FAIL=${fail}`);
if (failures.length) {
  console.log("FAILURES:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log("=".repeat(58));
process.exit(fail === 0 ? 0 : 1);
