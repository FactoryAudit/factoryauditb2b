/**
 * CS-04 回归验证：Analytics 事件口径 + PII 双层清洗
 *
 * 纯只读校验，不写任何数据、不发任何网络请求。
 * 运行方式见文件末尾注释（esbuild 打包后 node 执行）。
 */
import * as fs from "node:fs";
import * as path from "node:path";

import {
  ANALYTICS_EVENTS,
  CLICK_LEVEL_EVENTS,
  CONVERSION_EVENTS,
  FUNNEL_STEPS,
  SERVICE_EVENT_BY_KEY,
  UNWIRED_EVENTS,
  sanitizeParams,
  trackEvent,
} from "../lib/analytics";

// 注意：本脚本会被 esbuild 打包到仓库外执行，__dirname 不可靠。
// 因此根目录优先取 CS04_ROOT，其次取进程工作目录（请在仓库根运行）。
const ROOT = process.env.CS04_ROOT
  ? path.resolve(process.env.CS04_ROOT)
  : process.cwd();
const SRC_EXCLUDE = new Set([
  path.join(ROOT, "lib", "analytics.ts"),
  path.join(ROOT, "lib", "suppliers.ts"),
  // 本脚本自身会为了断言而提到事件 key，不能算 emitter
  path.join(ROOT, "scripts", "cs04-analytics-regression.ts"),
]);

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
// 递归收集源码文件（只扫 .ts/.tsx，排除 node_modules / .next / .open-next）
// ---------------------------------------------------------------------------
function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. 事件名唯一性
// ---------------------------------------------------------------------------
section("1. ANALYTICS_EVENTS 唯一性");
{
  const entries = Object.entries(ANALYTICS_EVENTS) as [string, string][];
  const byValue = new Map<string, string[]>();
  for (const [key, value] of entries) {
    const list = byValue.get(value) ?? [];
    list.push(key);
    byValue.set(value, list);
  }
  const dups = [...byValue.entries()].filter(([, keys]) => keys.length > 1);
  check(
    "所有事件值唯一（无两个 key 映射到同一 GA4 事件名）",
    dups.length === 0,
    dups.map(([v, k]) => `${v} <- ${k.join(",")}`).join("; ")
  );
  check("事件总数 >= 40", entries.length >= 40, `实际 ${entries.length}`);
}

// ---------------------------------------------------------------------------
// 2. 三个桶互斥（口径铁律的结构性保证）
// ---------------------------------------------------------------------------
section("2. 转化桶 / 点击桶 / 未接线桶 互斥");
{
  const conv = new Set<string>(CONVERSION_EVENTS as readonly string[]);
  const click = new Set<string>(CLICK_LEVEL_EVENTS as readonly string[]);
  const unwired = new Set<string>(UNWIRED_EVENTS as readonly string[]);

  const convClick = [...conv].filter((e) => click.has(e));
  const convUnwired = [...conv].filter((e) => unwired.has(e));
  const clickUnwired = [...click].filter((e) => unwired.has(e));

  check("CONVERSION ∩ CLICK == 空", convClick.length === 0, convClick.join(","));
  check("CONVERSION ∩ UNWIRED == 空", convUnwired.length === 0, convUnwired.join(","));
  check("CLICK ∩ UNWIRED == 空", clickUnwired.length === 0, clickUnwired.join(","));
}

// ---------------------------------------------------------------------------
// 3. 本次修复的核心断言：CTA Click 不得是转化
// ---------------------------------------------------------------------------
section("3. 核心修复断言（CTA Click 不进 CONVERSION）");
{
  const conv = new Set<string>(CONVERSION_EVENTS as readonly string[]);
  const ctaInConv = [...conv].filter((e) => e.endsWith("_cta_click"));
  check("CONVERSION 中没有任何 *_cta_click", ctaInConv.length === 0, ctaInConv.join(","));

  const svcValues = Object.values(SERVICE_EVENT_BY_KEY);
  check(
    "SERVICE_EVENT_BY_KEY 全部指向 *_cta_click",
    svcValues.every((v) => v.endsWith("_cta_click")),
    svcValues.join(",")
  );
  const svcLeak = svcValues.filter((v) => conv.has(v));
  check(
    "/services 卡片点击事件与 CONVERSION 无交集（修复前此处为 4 个泄漏）",
    svcLeak.length === 0,
    svcLeak.join(",")
  );

  check(
    "verification_request 已移出 CONVERSION（保留为 Reserved）",
    !conv.has(ANALYTICS_EVENTS.verificationRequest)
  );
  check(
    "sourcing_request 已移出 CONVERSION（保留为 Reserved）",
    !conv.has(ANALYTICS_EVENTS.sourcingRequest)
  );
  check(
    "founding_buyer_checkout_start 已移出 CONVERSION（点击层）",
    !conv.has(ANALYTICS_EVENTS.foundingBuyerCheckoutStart)
  );
  check(
    "verification_checkout_start 已移出 CONVERSION（点击层）",
    !conv.has(ANALYTICS_EVENTS.verificationCheckoutStart)
  );
  check(
    "实测请求类事件仍在 CONVERSION（audit_request / inspection_request）",
    conv.has(ANALYTICS_EVENTS.auditRequest) && conv.has(ANALYTICS_EVENTS.inspectionRequest)
  );
}

// ---------------------------------------------------------------------------
// 4. 漏斗顺序（Click ≠ Request ≠ Paid Order）
// ---------------------------------------------------------------------------
section("4. FUNNEL_STEPS 顺序");
{
  const expectedSteps = [
    "page_view",
    "supplier_search",
    "supplier_profile_view",
    "cta_click",
    "form_start",
    "form_submit",
    "qualified_lead",
    "paid_order",
  ];
  const actualSteps = FUNNEL_STEPS.map((s) => s.step);
  check(
    "漏斗阶段顺序符合 Click → Form Start → Submit → Lead → Paid",
    JSON.stringify(actualSteps) === JSON.stringify(expectedSteps),
    actualSteps.join(" > ")
  );

  const expectedEvents = [
    "page_view",
    "supplier_search",
    "supplier_profile_view",
    "verification_cta_click",
    "rfq_start",
    "audit_request",
    "audit_request_submit",
    "founding_buyer_purchase",
  ];
  const actualEvents = FUNNEL_STEPS.map((s) => s.event);
  check(
    "漏斗事件名与设计一致",
    JSON.stringify(actualEvents) === JSON.stringify(expectedEvents),
    actualEvents.join(" > ")
  );

  const conv = new Set<string>(CONVERSION_EVENTS as readonly string[]);
  const ctaStep = FUNNEL_STEPS.find((s) => s.step === "cta_click");
  check(
    "漏斗里的 cta_click 阶段不代表转化（其事件不在 CONVERSION）",
    !!ctaStep && !conv.has(ctaStep.event)
  );
  check(
    "收入确认不在前端事件流中（FUNNEL_STEPS 无 revenue_recognition 阶段）",
    !FUNNEL_STEPS.some((s) => (s.step as string) === "revenue_recognition")
  );
}

// ---------------------------------------------------------------------------
// 5. Emitter 存在性（源码扫描，证明转化事件真的有人发）
// ---------------------------------------------------------------------------
section("5. Emitter 源码扫描");
{
  const files = collectSourceFiles(ROOT).filter((f) => !SRC_EXCLUDE.has(f));
  const corpus = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  // value -> key 反查
  const valueToKey = new Map<string, string>();
  for (const [key, value] of Object.entries(ANALYTICS_EVENTS) as [string, string][]) {
    valueToKey.set(value, key);
  }

  /** Stripe 未激活，这两个 Paid Order 事件按设计尚无 emitter */
  const PAID_ORDER_PENDING = new Set<string>([
    ANALYTICS_EVENTS.foundingBuyerPurchase,
    ANALYTICS_EVENTS.verificationPurchase,
  ]);

  const missingEmitter: string[] = [];
  for (const evt of CONVERSION_EVENTS as readonly string[]) {
    if (PAID_ORDER_PENDING.has(evt)) continue;
    const key = valueToKey.get(evt);
    if (!key) {
      missingEmitter.push(`${evt}(无 key)`);
      continue;
    }
    if (!corpus.includes(`ANALYTICS_EVENTS.${key}`)) missingEmitter.push(evt);
  }
  check(
    "除 2 个 Paid Order（待 Stripe）外，所有转化事件都有 emitter",
    missingEmitter.length === 0,
    missingEmitter.join(",")
  );

  // Reserved 事件必须确实无人触发
  for (const key of ["verificationRequest", "sourcingRequest"] as const) {
    const hits = files.filter((f) =>
      fs.readFileSync(f, "utf8").includes(`ANALYTICS_EVENTS.${key}`)
    );
    check(`ANALYTICS_EVENTS.${key} 确认无 emitter（Reserved）`, hits.length === 0, hits.join(","));
  }

  // 点击事件必须有 emitter（services 页通过 SERVICE_EVENT_BY_KEY 间接引用，单独校验）
  const INDIRECT_CLICK = new Set(["auditCtaClick", "inspectionCtaClick", "sourcingCtaClick"]);
  const clickKeys = ["verificationCtaClick", "auditCtaClick", "inspectionCtaClick", "sourcingCtaClick"];
  const svcPage = fs.readFileSync(
    path.join(ROOT, "app", "[locale]", "services", "page.tsx"),
    "utf8"
  );
  const clickMissing: string[] = [];
  for (const key of clickKeys) {
    if (INDIRECT_CLICK.has(key)) {
      // 真正埋点在 app/[locale]/services/page.tsx：data-track={SERVICE_EVENT_BY_KEY[x.key]}
      if (!svcPage.includes("SERVICE_EVENT_BY_KEY[x.key]")) clickMissing.push(`${key}(间接)`);
      continue;
    }
    if (!corpus.includes(`ANALYTICS_EVENTS.${key}`)) clickMissing.push(key);
  }
  check("服务卡片点击事件均已接线", clickMissing.length === 0, clickMissing.join(","));
}

// ---------------------------------------------------------------------------
// 6. PII 双层清洗回归
// ---------------------------------------------------------------------------
section("6. PII 双层清洗");
{
  // 第一层：键不在白名单 → 丢弃
  const kw = sanitizeParams({
    email: "buyer@example.com",
    phone: "+86-13800138000",
    password: "hunter2hunter2",
    card: "4242424242424242",
    name: "张三",
    company: "ACME",
    wechat: "abc123",
  });
  check("敏感键全部丢弃（email/phone/password/card/name/company/wechat）", Object.keys(kw).length === 0, JSON.stringify(kw));

  // 第二层：键合法但值疑似敏感 → 整键丢弃
  const vw = sanitizeParams({ slug: "buyer@example.com", query: "13800138000", country: "china" });
  check(
    "值含邮箱 → 丢弃该键",
    !("slug" in vw),
    JSON.stringify(vw)
  );
  check("值含 9 位以上连续数字 → 丢弃该键", !("query" in vw), JSON.stringify(vw));
  check("合法值保留", vw.country === "china", JSON.stringify(vw));

  // 正常参数保留 + 数字/布尔处理
  const ok = sanitizeParams({
    country: "china",
    count: 3,
    level: "LOW",
    score: 87,
    source: "directory",
    flag: true,
    badNumber: NaN,
    empty: "   ",
  });
  check(
    "合法参数正确保留（country/count/level/score/source）",
    ok.country === "china" &&
      ok.count === 3 &&
      ok.level === "LOW" &&
      ok.score === 87 &&
      ok.source === "directory",
    JSON.stringify(ok)
  );
  check("未在白名单的键被丢弃（flag）", !("flag" in ok), JSON.stringify(ok));
  check("NaN 被丢弃", !("badNumber" in ok), JSON.stringify(ok));
  check("空白字符串被丢弃", !("empty" in ok), JSON.stringify(ok));

  // 超长字符串截断
  const long = sanitizeParams({ source: "x".repeat(500) });
  check("超长字符串截断到 100", String(long.source ?? "").length === 100, String(String(long.source ?? "").length));

  // undefined / null payload 安全
  check("payload 为 undefined 返回空对象", Object.keys(sanitizeParams(undefined)).length === 0);
}

// ---------------------------------------------------------------------------
// 7. trackEvent fail-open（无 window 环境不抛错）
// ---------------------------------------------------------------------------
section("7. trackEvent fail-open");
{
  let threw = false;
  try {
    trackEvent("cs04_probe", { country: "china" });
    trackEvent(ANALYTICS_EVENTS.auditRequest, { value: "Initial Audit" });
  } catch {
    threw = true;
  }
  check("无 window/gtag 环境下 trackEvent 不抛错（静默 no-op）", !threw);
}

section("8. 页面浏览就绪等待 / 投递探针解析（CS-04 P2 守护）");
{
  const trackerPath = path.join(ROOT, "components", "AnalyticsTracker.tsx");
  const probePath = path.join(ROOT, "scripts", "cs04-ga4-probe.mjs");
  const tracker = fs.existsSync(trackerPath) ? fs.readFileSync(trackerPath, "utf8") : "";
  const probe = fs.existsSync(probePath) ? fs.readFileSync(probePath, "utf8") : "";

  check("AnalyticsTracker 可读", tracker.length > 0, trackerPath);
  check(
    "页面浏览使用 whenAnalyticsReady 就绪等待（消除脚本注入竞态）",
    /function whenAnalyticsReady\(/.test(tracker) && /whenAnalyticsReady\(\(\) =>/.test(tracker)
  );
  check(
    "就绪判定同时接受 gtag 与 dataLayer（缺一即会在竞态中静默丢事件）",
    /typeof w\.gtag === "function"\s*\|\|\s*Array\.isArray\(w\.dataLayer\)/.test(tracker)
  );
  const pvEffect = tracker.slice(tracker.indexOf("---- 页面浏览 ----"));
  check(
    "页面浏览 effect 不再裸 setTimeout 直接发送（必须经就绪等待）",
    pvEffect.length > 0 && !/const id = window\.setTimeout\(/.test(pvEffect)
  );

  check("投递探针可读", probe.length > 0, probePath);
  // GA4 批量 body 是「按 \n 分行」的；若只按 & 匹配，每批只能读到第一条 en，
  // 会把批次内其余事件全部漏掉 —— 这正是曾误报「page_view_group 从未投递」的根因。
  check(
    "投递探针按行解析批次 body（防「只读第一条 en」漏读回归）",
    /post\.split\(\/\\r\?\\n\/\)/.test(probe)
  );
  check("投递探针断言覆盖 page_view_group 每页 1 次", /page_view_group/.test(probe));
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(56)}`);
console.log(`CS-04 ANALYTICS REGRESSION  PASS=${pass}  FAIL=${fail}`);
if (failures.length) {
  console.log("FAILURES:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log("=".repeat(56));
process.exit(fail === 0 ? 0 : 1);
