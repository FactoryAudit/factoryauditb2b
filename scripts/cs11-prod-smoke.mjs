// CS-11 线上烟雾（production）
//
// 铁律：
//  1. 沙箱封 *.workers.dev → 一律走 https://factoryauditb2b.com
//  2. 多请求必须自带节流 + 5xx/429 退避重试（边缘限流会制造假 FAIL）
//  3. 断言一条不放宽——失败就是失败，重跑要换干净条件，不改断言
//  4. 客户端组件 props 会序列化进 RSC payload，字符串存在 ≠ 已渲染
//     ⇒ 门禁状态一律用 DOM 分支判断：std-form-lang（锁定）/ std-report-lang（解锁）

const BASE = process.env.CS11_BASE || "https://factoryauditb2b.com";
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

let pass = 0;
let fail = 0;
const fails = [];

function ok(cond, label, extra = "") {
  if (cond) {
    pass++;
    console.log("PASS  " + label);
  } else {
    fail++;
    fails.push(label + (extra ? " | " + extra : ""));
    console.log("FAIL  " + label + (extra ? " | " + extra : ""));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, { accept = "text/html" } = {}) {
  let lastErr = null;
  // Cloudflare 边缘偶发 503（2026-09-12 实测：/ar/standard-report 连续 503 约 2s+）。
  // 退避必须到「秒级指数」——400ms 级退避扛不住边缘抖动，会制造假 FAIL。
  // 只加韧性和重试次数，**不放宽任何断言**。
  const ATTEMPTS = 5;
  for (let i = 0; i < ATTEMPTS; i++) {
    if (i > 0) await sleep(1000 * Math.pow(2, i - 1)); // 1s, 2s, 4s, 8s
    try {
      const res = await fetch(BASE + path, {
        redirect: "follow",
        headers: { "user-agent": "cs11-prod-smoke/1.0", accept },
      });
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) {
        lastErr = "HTTP " + res.status;
        continue;
      }
      return { status: res.status, body, url: res.url };
    } catch (e) {
      lastErr = String(e && e.message ? e.message : e);
      continue;
    }
  }
  throw new Error("GET " + path + " 重试 " + ATTEMPTS + " 次耗尽: " + lastErr);
}

async function main() {
  console.log("BASE = " + BASE + "\n");

  // ---------- 1. 英文公开页 ----------
  console.log("--- 1. /en/standard-report 结构与门禁 ---");
  const en = await get("/en/standard-report");
  await sleep(200);
  ok(en.status === 200, "1a 英文页 200", "got " + en.status);

  const anchors = [...en.body.matchAll(/id="s\d+"/g)].map((m) => m[0]);
  ok(anchors.length === 13, "1b 13 个章节锚点全部渲染", "got " + anchors.length);

  ok(
    en.body.includes("Standard supplier due diligence report"),
    "1c 英文 h1 来自字典"
  );
  ok(
    en.body.includes("Free to read in full — no registration required."),
    "1d 免注册声明渲染（正文在门禁之前）"
  );
  ok(en.body.includes("Contents"), "1e 目录渲染");
  ok(
    en.body.includes("Standard report specimen"),
    "1f 样板横幅渲染（Admin Preview 不出现）"
  );
  ok(
    !en.body.includes("ADMIN PREVIEW"),
    "1g 公开页不含 ADMIN PREVIEW 水印"
  );

  // 门禁：锁定态 DOM 分支存在，解锁态分支不存在
  ok(en.body.includes('id="std-form-lang"'), "1h 锁定态：出现留资表单");
  ok(!en.body.includes('id="std-report-lang"'), "1i 锁定态：不出现下载控件");

  // 留资必填三项
  for (const label of ["Your name", "Business email", "Company"]) {
    ok(en.body.includes(label), "1j 表单字段来自字典: " + label);
  }
  ok(en.body.includes("Get the report"), "1k 提交按钮文案来自字典");

  // 正文在门禁之前（先读后留资）
  const iBody = en.body.indexOf("Standard report specimen");
  const iForm = en.body.indexOf('id="std-form-lang"');
  ok(iBody >= 0 && iForm > iBody, "1l 报告正文先于留资门禁出现", "body@" + iBody + " form@" + iForm);

  // ---------- 2. 中文本地化 ----------
  console.log("\n--- 2. /zh/standard-report 本地化 ---");
  const zh = await get("/zh/standard-report");
  await sleep(200);
  ok(zh.status === 200, "2a 中文页 200", "got " + zh.status);
  ok(zh.body.includes("标准版供应商尽职调查报告"), "2b 中文 h1");
  ok(zh.body.includes("获取报告"), "2c 中文提交按钮");
  ok(!zh.body.includes('id="std-report-lang"'), "2d 中文页同样处于锁定态");

  // ---------- 3. 其余 7 个语言 ----------
  console.log("\n--- 3. 其余语言 200 ---");
  for (const l of LOCALES.filter((x) => x !== "en" && x !== "zh")) {
    const r = await get("/" + l + "/standard-report");
    await sleep(200);
    ok(r.status === 200, "3-" + l + " 200", "got " + r.status);
  }

  // ---------- 4. 站点入口 / SEO ----------
  console.log("\n--- 4. 站点入口与 SEO 收录 ---");
  const home = await get("/en");
  await sleep(200);
  ok(home.body.includes("/standard-report"), "4a 页脚入口存在");

  const sm = await get("/sitemap.xml", { accept: "application/xml" });
  await sleep(200);
  ok(sm.status === 200, "4b sitemap 200", "got " + sm.status);
  ok(sm.body.includes("/standard-report"), "4c sitemap 含 standard-report");

  const llms = await get("/llms.txt", { accept: "text/plain" });
  await sleep(200);
  ok(llms.status === 200, "4d llms.txt 200", "got " + llms.status);
  ok(llms.body.includes("/standard-report"), "4e llms.txt 含 standard-report");

  const meta = en.body;
  ok(!meta.includes('name="robots" content="noindex"'), "4f 公开页可被索引（无 noindex）");

  // ---------- 5. 后台闸门仍然有效 ----------
  console.log("\n--- 5. 后台闸门 ---");
  const adm = await get("/admin/report-standard");
  await sleep(200);
  ok(adm.status === 404, "5a 匿名访问 /admin/report-standard = 404", "got " + adm.status);

  // ---------- 6. 回归：样板页重定向（CS-01）----------
  console.log("\n--- 6. 回归 ---");
  // CS-01 P1-8：/sample-report 已 308 到 /standard-report（原先两页争夺同一批
  //「supplier audit report sample」词）。本断言**保留但改写语义**：
  // 由「仍 200」改为「最终落在 /standard-report」。
  // get() 使用 redirect:"follow"，所以看 res.url 而不是 status。
  const sr = await get("/en/sample-report");
  await sleep(200);
  ok(
    sr.status === 200 && /\/standard-report$/.test(sr.url),
    "6a /en/sample-report 308 到 /standard-report",
    "status=" + sr.status + " url=" + sr.url
  );

  // ---------- 7. 留资接口 ----------
  // 契约是 { lead: {...}, result: {...} } 嵌套结构（见 app/api/lead/route.ts）。
  // 用扁平入参会一律落到 "email required"，400 就是"蒙对"的 —— 必须嵌套才能验到真分支。
  // 注意：限流 5 次/小时/IP，且每次 POST 计数（含 400），所以本脚本只用 2 次。
  console.log("\n--- 7. /api/lead 校验分支 ---");
  for (const [label, lead, expect, errCode] of [
    ["非法邮箱", { tool: "standard-report-specimen", firstName: "T", email: "not-an-email", company: "C" }, 400, "invalid_email"],
    ["缺邮箱", { tool: "standard-report-specimen", firstName: "T", company: "C" }, 400, "email required"],
  ]) {
    const res = await fetch(BASE + "/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "cs11-prod-smoke/1.0" },
      body: JSON.stringify({ lead, result: {} }),
    });
    const j = await res.json().catch(() => ({}));
    await sleep(300);
    ok(res.status === expect, "7-" + label + " -> HTTP " + expect, "got " + res.status);
    ok(j.error === errCode, "7-" + label + " 错误码 = " + errCode, "got " + j.error);
  }

  console.log("\n================================");
  console.log("PASS " + pass + " / FAIL " + fail);
  if (fail) {
    console.log("\n失败项：");
    for (const f of fails) console.log("  - " + f);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("SMOKE CRASH: " + e.message);
  process.exit(1);
});
