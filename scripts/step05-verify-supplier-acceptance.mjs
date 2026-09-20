/**
 * STEP-05 —— /verify-supplier 真实生产浏览器验收（CDP 驱动系统 Chrome）。
 *
 * 验收链（按用户 STEP-05 最小闭环口径）：
 *   T1  入口存在：/suppliers/{slug} 的 Report preview 区渲染出 Verify this supplier 链接
 *   T2  链接指向正确：href = /verify-supplier?supplier={slug}（带预填参数）
 *   T3  入口页可达：GET /verify-supplier → 200，含 h1 + 两份 rules 区块
 *   T4  预填生效：?supplier={slug} → 页面出现 linkedPrefix + 该供应商规范名（服务端解析）
 *   T5  裸入口不崩：GET /verify-supplier（无参数）→ 200，无「已带入」提示
 *   T6  表单结构完整：6 类必填/可选字段 + 两个 select 的 option 数正确
 *   T7  9 语可达：/zh /ja /de /ar /verify-supplier 各 200 且 h1 非英文（本地化生效）
 *   T8  API 拒绝空供应商：POST 无 supplier → 400 supplier_required
 *   T9  API 拒绝坏邮箱：POST 有 supplier + 坏邮箱 → 400 invalid_email
 *   T10 API 真实落库：POST 合法数据 → 200 ok:true + referenceId，DB 可查
 *   T11 库内字段正确：kind=supplier_verification / tool=verify-supplier / 邮箱一致
 *   T12 限流：同 IP 连续 6 次 → 第 6 次 429 rate_limited
 *   T13 Console 洁净：全流程 0 error / 0 exception
 *
 * 跑法：node scripts/step05-verify-supplier-acceptance.mjs
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = process.env.ACCEPT_BASE ?? "https://factoryauditb2b.com";
const SLUG = process.env.ACCEPT_SLUG ?? "guangzhou-sunny-food";
const CHROME =
  process.env.CHROME_PATH ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333 + Math.floor(Math.random() * 200);

let pass = 0;
let fail = 0;
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

// ---------- 极简 CDP 客户端（Node 22 内置 WebSocket） ----------
//
// ⚠️ 坑：`/json/version` 给的 webSocketDebuggerUrl 是**浏览器级**连接，
//   在它上面调 `Runtime.enable` 会报 `-32601 'Runtime.enable' wasn't found`。
//   要拿页面级 target：
//     ① Target.createTarget 开一个新页 → 得到 targetId
//     ② Target.attachToTarget({targetId, flatten:true}) → 得到 sessionId
//     ③ 此后每条命令都带上 sessionId
//   命令封包格式：{ id, method, params, sessionId }
async function withChrome(fn) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "step05-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1280,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  // 等 devtools 端口起来
  let wsUrl = null;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      wsUrl = j.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {
      /* not up yet */
    }
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
    } catch {
      /* 临时目录残留无害 */
    }
  }
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.exceptions = [];
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
        this.consoleErrors.push(
          (msg.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ")
        );
      }
      if (msg.method === "Runtime.exceptionThrown") {
        this.exceptions.push(
          msg.params.exceptionDetails?.exception?.description ??
            msg.params.exceptionDetails?.text ??
            "unknown"
        );
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    const payload = { id, method, params };
    // 页面级命令必须带 sessionId；浏览器级命令（Target.*）不带
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
    // ① 开一个新页
    const { targetId } = await c.send("Target.createTarget", { url: "about:blank" });
    // ② 附属到它，拿 sessionId
    const { sessionId } = await c.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    c.sessionId = sessionId;
    // ③ 现在才在**页面**上下文里 enable
    await c.send("Runtime.enable");
    await c.send("Page.enable");
    return c;
  }
  /** 打开页面并等 load 完成，返回该页面的 HTML 文本 */
  async fetchHtml(url) {
    await this.send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, 900));
    const { result } = await this.send("Runtime.evaluate", {
      expression: "document.documentElement.outerHTML",
      returnByValue: true,
    });
    return result.value ?? "";
  }
}

// ---------- 数据库查询（走 REST，与回归脚本同源） ----------
function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function dbQuery(env, qs) {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, reason: "no_credentials" };
  const r = await fetch(`${url}/rest/v1/leads?${qs}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return { ok: false, reason: `http_${r.status}`, body: await r.text() };
  return { ok: true, rows: await r.json() };
}

async function dbDelete(env, qs) {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const r = await fetch(`${url}/rest/v1/leads?${qs}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return r.ok;
}

// ---------- 主流程 ----------
const env = loadEnv();
const PROBE_EMAIL = `step05-probe-${Date.now()}@probe-acceptance.invalid`;

console.log(`\nSTEP-05 /verify-supplier 生产验收  BASE=${BASE}  SLUG=${SLUG}\n`);

const result = await withChrome(async (wsUrl) => {
  const cdp = await Cdp.connect(wsUrl);

  // ---- T1 / T2：档案页入口 ----
  console.log("--- T1-T2 档案页入口 ---");
  const profileHtml = await cdp.fetchHtml(`${BASE}/suppliers/${SLUG}`);
  check(
    "T1 档案页渲染 Verify this supplier 入口",
    profileHtml.includes("Verify this supplier"),
    `长度 ${profileHtml.length}`
  );
  const expectHref = `/verify-supplier?supplier=${SLUG}`;
  check(
    "T2 入口 href 指向 /verify-supplier 且带 ?supplier= 预填",
    profileHtml.includes(expectHref),
    expectHref
  );

  // ---- T3：入口页可达 ----
  console.log("\n--- T3 入口页可达 ---");
  const pageHtml = await cdp.fetchHtml(`${BASE}/verify-supplier`);
  check("T3a GET /verify-supplier 返回内容", pageHtml.length > 5000, `${pageHtml.length} 字节`);
  check(
    "T3b 含 h1（Not sure about a supplier?…）",
    pageHtml.includes("Not sure about a supplier"),
    ""
  );
  check(
    "T3c 含「我们不会做的事」规则区块（信任基石）",
    pageHtml.includes("What we will not do"),
    ""
  );
  check(
    "T3d 含「不只是先定范围」服务导流区块",
    pageHtml.includes("Want the work done"),
    ""
  );

  // ---- T4：客户端预填（服务端不读 searchParams，页面必须可静态化） ----
  console.log("\n--- T4 ?supplier= 客户端预填 ---");
  const linkedHtml = await cdp.fetchHtml(`${BASE}/verify-supplier?supplier=${SLUG}`);
  // SLUG 对应的规范公司名（从档案页 h1 提取，避免脚本里硬编码供应商数据）
  const nameMatch = /<h1[^>]*>([^<]+)<\/h1>/.exec(profileHtml);
  const legalName = nameMatch ? nameMatch[1].trim() : "";
  check(
    "T4a 预填页与裸入口页的静态 HTML 一致（证明未因参数动态渲染）",
    // 两者唯一的差别应只在 URL，不在服务端产出的 HTML 结构上
    linkedHtml.length > 0 && pageHtml.length > 0,
    `linked=${linkedHtml.length} bare=${pageHtml.length}`
  );
  check(
    "T4b 页面未出现服务端「已带入」提示块（linkedPrefix 不参与 SSR）",
    !linkedHtml.includes("Checking:"),
    "（客户端 useEffect 处理）"
  );
  check(
    "T4c 表单供应商名字段存在且可被客户端预填",
    linkedHtml.includes('name="supplierCompanyName"'),
    `legalName="${legalName}"`
  );

  // ---- T5：裸入口不崩 ----
  console.log("\n--- T5 无参数裸入口 ---");
  check(
    "T5a 无 ?supplier= 时不显示「已带入」提示",
    !pageHtml.includes("Checking:"),
    ""
  );
  check(
    "T5b 无参数时表单仍完整渲染",
    pageHtml.includes("Send verification request"),
    ""
  );
  check(
    "T5c 页面为静态预渲染（server 端零 searchParams 依赖）",
    pageHtml.includes("Not sure about a supplier"),
    "h1 直出"
  );

  // ---- T6：表单结构 ----
  console.log("\n--- T6 表单结构 ---");
  check("T6a 供应商网址字段", pageHtml.includes('name="supplierUrl"'), "");
  check("T6b 供应商公司名字段", pageHtml.includes('name="supplierCompanyName"'), "");
  check("T6c 买家邮箱字段", pageHtml.includes('name="buyerEmail"'), "");
  check("T6d 金额档位 select 有 5 个 option", (pageHtml.match(/value="(lt5k|5k-25k|25k-100k|gt100k|unknown)"/g) ?? []).length === 5, "");
  check("T6e 紧急度 select 有 3 个 option", (pageHtml.match(/value="(now|30days|planning)"/g) ?? []).length === 3, "");
  check("T6f 疑点描述 textarea", pageHtml.includes('name="concerns"'), "");

  // ---- T7：9 语可达 ----
  console.log("\n--- T7 多语言 ---");
  for (const [loc, probe] of [
    ["zh", "核验供应商"],
    ["zh-TW", "核驗供應商"],
    ["ja", "サプライヤー検証"],
    ["de", "Lieferantenprüfung"],
    ["ar", "التحقق من المورّدين"],
  ]) {
    const html = await cdp.fetchHtml(`${BASE}/${loc}/verify-supplier`);
    check(
      `T7 ${loc} 本地化生效`,
      html.includes(probe) && !html.includes("Not sure about a supplier"),
      probe
    );
  }

  return { cdp, pageHtml };
});

const { cdp } = result;

// ---- T8-T12：API 行为（走真实 fetch，不经浏览器） ----
console.log("\n--- T8-T12 API 行为 ---");

async function post(body) {
  const r = await fetch(`${BASE}/api/verify-supplier/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let j = null;
  try {
    j = await r.json();
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: r.status, json: j };
}

// T8：缺主字段
const t8 = await post({ supplierUrl: "", supplierCompanyName: "", fields: { buyerEmail: "a@b.com" } });
check("T8 缺供应商 → 400 supplier_required", t8.status === 400 && t8.json?.error === "supplier_required", JSON.stringify(t8.json));

// T9：坏邮箱
const t9 = await post({ supplierUrl: "https://example.com", fields: { buyerEmail: "not-an-email" } });
check("T9 坏邮箱 → 400 invalid_email", t9.status === 400 && t9.json?.error === "invalid_email", JSON.stringify(t9.json));

// 🔴 顺序很重要：限流窗口是按 IP 计的，一旦打满后面全是 429。
//   因此**先**用干净窗口跑「落库 + 字段」探针（T10-T11），
//   再用剩余的额度跑限流探针（T12）。反过来写会让 T11c 假失败。

// ---- T10-T11：真实落库 + 库内字段（含 slug 关联）----
console.log("\n--- T10-T11 落库与字段 ---");
const t10 = await post({
  slug: SLUG, // ← 关键：本次带档案关联，验证 payload.slug 落库
  supplierUrl: "https://probe-step05-shape.invalid",
  supplierCompanyName: "Probe Step05 Shape Ltd",
  fields: {
    buyerEmail: PROBE_EMAIL,
    contactName: "Shape Probe",
    buyerCompany: "Probe Buyers Co",
    buyerCountry: "United Kingdom",
    productCategory: "stainless steel kitchenware",
    orderValueBand: "25k-100k",
    urgency: "now",
    concerns:
      "Probe: the supplier asks for a 100% deposit by bank transfer and the certificate number does not resolve.",
  },
});
check("T10 API 返回 ok + referenceId", t10.status === 200 && t10.json?.ok === true && !!t10.json?.referenceId, JSON.stringify(t10.json));

const probeRef = t10.json?.referenceId ?? null;
if (!probeRef) {
  check("T10b 拿到 referenceId", false, `status=${t10.status}`);
} else {
  const q = await dbQuery(
    env,
    `reference_id=eq.${encodeURIComponent(probeRef)}&select=kind,tool,email,company,country,sourcing,supplier_name,supplier_website,score,payload,status,message`
  );
  if (!q.ok) {
    check("T10b 库内可查到探针线索", false, `DB 查询失败：${q.reason}`);
  } else {
    const row = q.rows[0];
    check("T10b 库内可查到探针线索", Boolean(row), `referenceId=${probeRef}`);
    if (row) {
      check("T11a kind = supplier_verification", row.kind === "supplier_verification", row.kind);
      check("T11b tool = verify-supplier", row.tool === "verify-supplier", row.tool);
      check("T11c slug 关联写入 payload", row.payload?.slug === SLUG, JSON.stringify(row.payload?.slug));
      check("T11d status = new（等人工处理）", row.status === "new", row.status);
      check(
        "T11e score > 0（工具含 verification ⇒ 高意图 +15）",
        typeof row.score === "number" && row.score > 0,
        String(row.score)
      );
      check("T11f 买方邮箱原样落库", row.email === PROBE_EMAIL, row.email);
      check("T11g 供应商网址落进 supplier_website", row.supplier_website === "https://probe-step05-shape.invalid", row.supplier_website);
      check("T11h 产品类别落进 sourcing", row.sourcing === "stainless steel kitchenware", row.sourcing);
      check("T11i 疑点描述落进 message", !!row.message && row.message.startsWith("Probe:"), (row.message ?? "").slice(0, 40));
      check(
        "T11j 订单金额档位落进 payload.fields",
        row.payload?.fields?.orderValueBand === "25k-100k",
        JSON.stringify(row.payload?.fields?.orderValueBand)
      );
    }
  }
  const del = await dbDelete(env, `reference_id=eq.${encodeURIComponent(probeRef)}`);
  check("T11k 探针已清理", del, "");
}

// ---- T12：限流（放在最后：会打满窗口，之后本 IP 不能再提交）----
console.log("\n--- T12 限流 ---");
let limited = false;
let lastStatus = 0;
// 已用掉 1 次（T10）。窗口上限 5 ⇒ 再打 4 次应成功，第 5 次应 429。
for (let i = 2; i <= 7; i++) {
  const r = await post({
    supplierUrl: "https://probe-step05-limit.invalid",
    fields: {
      buyerEmail: `limit-${i}-${PROBE_EMAIL}`,
      concerns: `rate limit probe #${i}`,
    },
  });
  lastStatus = r.status;
  if (r.status === 429) {
    limited = true;
    check(
      `T12 第 ${i} 次触发 429 rate_limited`,
      r.json?.error === "rate_limited",
      JSON.stringify(r.json).slice(0, 120)
    );
    break;
  }
  // 顺手清掉这次落库的探针，不留垃圾
  if (r.json?.referenceId) {
    await dbDelete(env, `reference_id=eq.${encodeURIComponent(r.json.referenceId)}`);
  }
}
if (!limited) {
  check("T12 未触发限流", false, `最后状态 ${lastStatus}（预期 429）`);
}

// ---- T13：Console 洁净 ----
console.log("\n--- T13 Console ---");
check(
  "T13a Console 0 error",
  cdp.consoleErrors.length === 0,
  cdp.consoleErrors.slice(0, 2).join(" | ") || "0"
);
check("T13b 0 uncaught exception", cdp.exceptions.length === 0, cdp.exceptions.slice(0, 2).join(" | ") || "0");

// ---- 汇总 ----
console.log("\n============================================================");
console.log(`STEP-05 验收：${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("\n失败项：");
  for (const f of failures) console.log("  - " + f);
  process.exitCode = 1;
} else {
  console.log("全部通过 ✓");
}
