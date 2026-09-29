// scripts/s18-interaction-test.mjs —— stage1.8 验收#4：搜索 / 过滤真交互（Playwright 真点击）
//
// 为什么必须真交互：stage1.8 把过滤从服务端搬到了客户端。静态 HTML 永远含全量卡片，
// 「看起来对」和「真的对」在静态页上是两回事 —— 只有真点击 + 真读 DOM 才能证明
// 客户端过滤生效、计数标签与实际卡片数一致。
//
// 断言口径：
//   ① 卡片数 == 计数标签里的数字（恒等式，CS-06a 的不变式在客户端的延续）
//   ② 点击国家 chip 后：URL 带 ?country=、卡片数下降、**每张可见卡片都含该国家名**
//   ③ 点击 All chip 后：恢复全量
//   ④ 搜索提交后：URL 带 ?q=、卡片数 == 计数、**每张可见卡片文本都含该关键词**
//      （成立原因：匹配字段 legalName / mainProducts / city 全部渲染在卡片上）
//   ⑤ 组合筛选 ?country=..&industry=..&q=.. 仍自洽
//
// 用法：
//   本地（对已部署线上）：
//     S18_BASE=https://factoryauditb2b.com S18_PROXY=http://127.0.0.1:7897 \
//     NODE_PATH="C:/Users/35726/.workbuddy/binaries/node/workspace/node_modules" \
//     node scripts/s18-interaction-test.mjs

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const BASE = process.env.S18_BASE || "https://factoryauditb2b.com";
const PROXY = process.env.S18_PROXY || "";
const HEADLESS = process.env.S18_HEADFUL !== "1";

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

const CARD = "#supplier-directory .card.p-5";
const COUNT = "#supplier-directory > div > p.shrink-0";

async function snapshot(page) {
  const cards = await page.locator(CARD).all();
  const texts = [];
  for (const c of cards) texts.push((await c.innerText()).replace(/\s+/g, " ").trim());
  const countText = (await page.locator(COUNT).first().innerText()).trim();
  const m = countText.match(/(\d+)/);
  return { n: cards.length, texts, countText, count: m ? Number(m[1]) : null };
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: HEADLESS,
  ...(PROXY ? { proxy: { server: PROXY } } : {}),
});

try {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  console.log(`\n=== 0. 加载 ${BASE}/suppliers ===`);
  await page.goto(`${BASE}/suppliers`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(CARD, { timeout: 30000 });
  const base = await snapshot(page);
  console.log(`  · 全量卡片 ${base.n} 张 | 计数标签「${base.countText}」`);
  check("0a 首屏渲染出卡片", base.n > 0, `n=${base.n}`);
  check("0b 计数标签 == 卡片数（初始）", base.count === base.n, `label=${base.count} cards=${base.n}`);

  // ── 1. 国家 chip ─────────────────────────────────────────────────────────
  console.log("\n=== 1. 点击国家 chip ===");
  const countryChips = await page.locator('a[href*="country="]').all();
  const hrefs = [];
  for (const c of countryChips) hrefs.push(await c.getAttribute("href"));
  const real = hrefs.find((h) => h && /[?&]country=[^&]+/.test(h));
  check("1a 存在国家 chip", Boolean(real), hrefs.join(" | ").slice(0, 160));

  if (real) {
    await page.locator(`a[href="${real}"]`).first().click();
    await page.waitForURL(/country=/, { timeout: 20000 });
    await page.waitForTimeout(400);
    const f = await snapshot(page);
    const cc = decodeURIComponent((real.match(/country=([^&]+)/) || [])[1] || "");
    console.log(`  · 过滤 ${cc} → 卡片 ${f.n} 张 | 计数「${f.countText}」`);
    check("1b URL 带上 ?country=", page.url().includes(`country=${cc}`) || page.url().includes("country="), page.url());
    check("1c 过滤后卡片数 < 全量", f.n < base.n, `${f.n} vs ${base.n}`);
    check("1d 过滤后计数标签 == 卡片数", f.count === f.n, `label=${f.count} cards=${f.n}`);
    const allContain = f.texts.every((t) => t.toLowerCase().includes(cc.replace(/-/g, " ").toLowerCase()));
    check(`1e 每张可见卡片都含国家「${cc}」`, allContain || f.texts.length === 0, f.texts.slice(0, 1).join("").slice(0, 120));
  }

  // ── 2. 回到全部 ──────────────────────────────────────────────────────────
  console.log("\n=== 2. 点击 All 恢复全量 ===");
  await page.locator('a[data-track-value="all-countries"]').first().click();
  await page.waitForTimeout(500);
  const back = await snapshot(page);
  check("2a 恢复全量卡片数", back.n === base.n, `${back.n} vs ${base.n}`);
  check("2b 计数标签 == 卡片数", back.count === back.n, `label=${back.count} cards=${back.n}`);

  // ── 3. 搜索 ─────────────────────────────────────────────────────────────
  console.log("\n=== 3. 关键词搜索 ===");
  // 取第一张卡片文本里的一个词（4+ 字符的大写开头词）作为关键词，保证至少 1 命中
  const kw =
    (base.texts[0].match(/[A-Za-z]{4,}/g) || []).find((w) => !/^[A-Z]{2,}$/.test(w)) || "a";
  await page.fill('input[name="q"]', kw);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null),
    page.locator('form button[type="submit"]').first().click(),
  ]);
  await page.waitForSelector(CARD, { timeout: 30000 });
  await page.waitForTimeout(400);
  const s = await snapshot(page);
  console.log(`  · 关键词「${kw}」→ 卡片 ${s.n} 张 | 计数「${s.countText}」`);
  check("3a URL 带上 ?q=", page.url().includes("q="), page.url());
  check("3b 至少 1 张命中", s.n >= 1, `n=${s.n}`);
  check("3c 计数标签 == 卡片数", s.count === s.n, `label=${s.count} cards=${s.n}`);
  const kwOk = s.texts.every((t) => t.toLowerCase().includes(kw.toLowerCase()));
  check(`3d 每张可见卡片文本都含「${kw}」`, kwOk, s.texts.slice(0, 1).join("").slice(0, 120));

  // ── 4. 组合筛选 ──────────────────────────────────────────────────────────
  console.log("\n=== 4. 组合筛选 ?country=..&industry=..&q=.. ===");
  await page.goto(`${BASE}/suppliers?country=nope&industry=NOPE&q=zzzz`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(600);
  const empty = await snapshot(page);
  // 空态判据：网格区（section.grid）**不渲染**，但目录区标题仍在（不是白屏、不是崩掉）
  const gridCount = await page.locator("#supplier-directory section.grid").count();
  const sectionText = (await page.locator("#supplier-directory").innerText()).trim();
  console.log(
    `  · 无命中组合 → 卡片 ${empty.n} 张 | 计数「${empty.countText}」| 网格元素 ${gridCount} | 目录区文本 ${sectionText.length} 字`
  );
  check("4a 无命中时卡片 0 张", empty.n === 0, `n=${empty.n}`);
  check("4b 无命中时计数标签为 0", empty.count === 0, `label=${empty.count}`);
  check("4c 无命中时改渲染空态（网格不渲染、目录区仍有文案）", gridCount === 0 && sectionText.length > 0, `grid=${gridCount} text=${sectionText.length}`);

  check("5 页面无 JS 运行时错误", errors.length === 0, errors.slice(0, 2).join(" | "));

  await ctx.close();
} finally {
  await browser.close();
}

console.log(`\n${"=".repeat(60)}`);
console.log(`stage1.8 交互验收：${pass} PASS / ${fail} FAIL   （BASE=${BASE}）`);
if (fail) {
  console.log("\n失败项：");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log("全部通过 ✓");
