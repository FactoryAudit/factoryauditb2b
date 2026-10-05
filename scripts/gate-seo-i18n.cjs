#!/usr/bin/env node
/**
 * scripts/gate-seo-i18n.cjs —— 门禁①：可索引页面的 SEO 元数据本地化门（只读）
 *
 * 判据：对每个**可索引**路由（robots 不含 noindex）与每个 locale，取预渲染 HTML 里的
 *   <title> 与 <meta name="description">，断言：
 *     a) 不是"纯英文长句/长标题"；
 *     b) 不等于 en 版**同路由**的取值（同一份英文元数据被复制到所有语种是典型回归）。
 *
 * 输入：`.next/server/app/<loc>/**.html` 预渲染产物。
 *   · 产物目录不存在，或存在但扫到 **0 页面**（next build 正在重写 .next）⇒ 一律 exit 2（绝不静默 PASS）。
 *   · 判据 a) 的英文判定是 **locale 感知**的：pt 里与英语同形的 do/as 不计入英文证据，
 *     避免纯葡语句子被误判（见 gate-i18n-lib.cjs 的 LOCALE_AMBIGUOUS_EN_MARKERS）。
 *   · 输出始终带 `产物 buildId=<...> mtime=<...>`（动态读 .next/BUILD_ID 与 HTML 最新 mtime），
 *     不再写死"产物为旧 build"，避免误导。
 *
 * 用法：
 *   node scripts/gate-seo-i18n.cjs            # 正式模式（真实产物）
 *   node scripts/gate-seo-i18n.cjs --selftest # 合成输入自证（阳/阴性对照）
 *   node scripts/gate-seo-i18n.cjs --verbose  # 打印全部违规
 *
 * 退出码：0 全通过 / 1 发现违规 / 2 产物缺失。
 */

const fs = require("fs");
const path = require("path");
const L = require("./gate-i18n-lib.cjs");

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");
/** --by-route：按路由聚合输出（用于排修复优先级，不改判据） */
const BY_ROUTE = argv.includes("--by-route");
/** 产物目录：默认 .next/server/app；GATE_APP_DIR 仅用于证明"产物缺失 ⇒ exit 2"这条路径 */
const APP_DIR = process.env.GATE_APP_DIR || L.APP;

/**
 * 交互式/客户端路由：即使没被标 noindex 也不属于"可索引内容页"，跳过。
 * （账户 / 登录 / 后台 / 结算等；claim 类页面通常已是 noindex，这里再兜一层。）
 */
const EXCLUDE_PREFIXES = [
  "account", "login", "signup", "admin", "checkout", "dashboard",
  "api", "submit", "cart", "orders", "settings", "preferences",
];

function isExcludedRoute(route) {
  const r = route.toLowerCase();
  if (EXCLUDE_PREFIXES.some((p) => r === p || r.startsWith(p + "/"))) return true;
  if (/^suppliers\/[^/]+\/claim$/.test(r)) return true;
  return false;
}

/** 从 relPath（相对 .next/server/app）解析 { locale, route }；无法归属则返回 null */
function parseRelPath(rel) {
  if (!rel.endsWith(".html")) return null;
  const noExt = rel.slice(0, -".html".length);
  if (noExt.split("/").some((seg) => seg.startsWith("_") || seg.startsWith("["))) return null;
  const segs = noExt.split("/");
  let loc = "en";
  let rest = segs;
  if (L.LOCALES.includes(segs[0])) {
    loc = segs[0];
    rest = segs.slice(1);
  } else if (segs[0] === "") {
    rest = segs.slice(1);
  }
  const route = rest.join("/");
  return { locale: loc, route };
}

/** 读取真实产物 → { loc: { route: {title,desc,robots,file} } } */
function readRouteMap() {
  const map = {};
  for (const l of L.LOCALES) map[l] = {};
  const files = L.walkFiles(APP_DIR, ".html");
  for (const f of files) {
    const rel = path.relative(APP_DIR, f).replace(/\\/g, "/");
    const parsed = parseRelPath(rel);
    if (!parsed) continue;
    let html;
    try {
      html = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    map[parsed.locale][parsed.route] = { ...L.seoMeta(html), file: rel };
  }
  return map;
}

/**
 * 纯函数核心：给定 routeMap 返回违规列表。
 * 便于 --selftest 用合成输入直接调用。
 */
function collectViolations(map) {
  const out = [];
  const en = map.en || {};
  for (const loc of L.LOCALES) {
    if (loc === "en") continue;
    const routes = map[loc] || {};
    for (const route of Object.keys(routes)) {
      if (isExcludedRoute(route)) continue;
      const meta = routes[route];
      if (L.isNoindex(meta)) continue; // 只查可索引页面
      const enMeta = en[route];
      const push = (field, reason, value) =>
        out.push({ locale: loc, route: route || "(home)", field, reason, value: String(value).slice(0, 140) });

      if (meta.title) {
        const tn = L.normalize(meta.title);
        if (L.looksEnglishTitle(tn) && !L.isNeutralValue(tn))
          push("title", "整串英文标题", meta.title);
        if (enMeta && enMeta.title && meta.title === enMeta.title && !L.isNeutralValue(meta.title))
          push("title", "与 en 同路由取值完全相同", meta.title);
      }
      if (meta.desc) {
        const dn = L.normalize(meta.desc);
        if (L.looksEnglishSentence(dn, loc) && !L.isNeutralValue(dn))
          push("description", "整句英文描述", meta.desc);
        if (enMeta && enMeta.desc && meta.desc === enMeta.desc && !L.isNeutralValue(meta.desc))
          push("description", "与 en 同路由取值完全相同", meta.desc);
      }
    }
  }
  // 去重（同 locale+route+field+reason+value 只报一次）
  const seen = new Set();
  return out.filter((v) => {
    const k = `${v.locale}|${v.route}|${v.field}|${v.reason}|${v.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** 读取 .next/BUILD_ID（APP_DIR 默认 .next/server/app ⇒ 其父目录的父目录） */
function readBuildId() {
  const p = path.join(path.dirname(path.dirname(APP_DIR)), "BUILD_ID");
  try {
    return fs.readFileSync(p, "utf8").trim() || null;
  } catch {
    return null;
  }
}

/** APP_DIR 下 HTML 产物的最新 mtime（自证"读的是哪一版产物"，不再靠写死文案） */
function latestHtmlMtime() {
  let mx = 0;
  for (const f of L.walkFiles(APP_DIR, ".html")) {
    try {
      const t = fs.statSync(f).mtimeMs;
      if (t > mx) mx = t;
    } catch {}
  }
  return mx ? new Date(mx) : null;
}

/** 产物来源一行：buildId + 最新 HTML mtime（动态，替代旧版写死的"产物为旧 build"） */
function artifactLine() {
  const id = readBuildId();
  const m = latestHtmlMtime();
  return `产物 buildId=${id || "(未找到 .next/BUILD_ID)"}  mtime=${m ? m.toISOString() : "(未知)"}`;
}

function main() {
  if (!fs.existsSync(APP_DIR)) {
    console.error(`[gate-seo-i18n] 产物缺失：找不到 ${APP_DIR}`);
    console.error("  需先执行 next build（发布链第 1 步）后再跑本门禁。");
    process.exit(2);
  }
  const map = readRouteMap();
  const pageCount = L.LOCALES.reduce((s, l) => s + Object.keys(map[l]).length, 0);
  console.log(`\n${"=".repeat(74)}`);
  console.log("门禁① 可索引页面 SEO 元数据本地化");
  console.log(`${"=".repeat(74)}`);
  console.log(`预渲染页面：${pageCount} 个（${L.LOCALES.length} 语种）`);
  console.log(artifactLine());

  // 🔴 空产物守卫：目录存在但扫到 0 个预渲染页面 ⇒ 一律 exit 2，绝不静默 PASS。
  // 触发场景（真实踩过）：release.sh 正在重写 .next（next build 进行中），此刻 [locale]/
  //   刚被清空/尚未写入，existsSync(APP_DIR) 为真、pageCount 为 0 —— 旧的"目录存在即放行"
  //   会输出"✅ 门禁① 通过"，是典型假绿。宁可报"需先 build"也不给错误的安全感。
  if (pageCount === 0) {
    console.error(
      `[gate-seo-i18n] 产物缺失/不完整：${APP_DIR} 存在但扫描到 0 个预渲染页面。\n` +
        "  可能原因：next build 正在写入（.next 被重写）或构建失败。\n" +
        "  本门禁拒绝在 0 页面下判『通过』（空产物假绿）。请待 next build 完成后再跑。"
    );
    process.exit(2);
  }

  const violations = collectViolations(map);
  const byLoc = {};
  for (const v of violations) byLoc[v.locale] = (byLoc[v.locale] || 0) + 1;
  console.log("\n各语种违规数：");
  for (const l of L.LOCALES) {
    if (l === "en") continue;
    console.log(`  ${l.padEnd(6)} ${byLoc[l] || 0}`);
  }
  console.log(`\n合计违规：${violations.length} 条`);

  if (BY_ROUTE) {
    const agg = {};
    for (const v of violations) {
      const a = (agg[v.route] = agg[v.route] || { n: 0, byLoc: {} });
      a.n++;
      a.byLoc[v.locale] = (a.byLoc[v.locale] || 0) + 1;
    }
    const rows = Object.keys(agg).sort((x, y) => agg[y].n - agg[x].n || x.localeCompare(y));
    console.log(`\n按路由聚合（降序，前 20 / 共 ${rows.length} 个路由）：`);
    console.log("  count  route                                        locales");
    for (const r of rows.slice(0, 20)) {
      const locs = Object.keys(agg[r].byLoc)
        .sort()
        .map((l) => `${l}:${agg[r].byLoc[l]}`)
        .join(" ");
      console.log(`  ${String(agg[r].n).padStart(5)}  ${r.padEnd(44)} ${locs}`);
    }
    if (violations.length > 0) {
      console.log("\n❌ 门禁① 未通过（--by-route 仅用于排优先级；未展示逐条明细，用 --verbose 看全部）");
      console.log(`   读的是 ${artifactLine()}`);
      process.exit(1);
    }
    process.exit(0);
  }

  const show = VERBOSE ? violations : violations.slice(0, 30);
  for (const v of show) {
    console.log(`  ✗ [${v.locale}] /${v.route}  <${v.field}>  ${v.reason}：${v.value}`);
  }
  if (!VERBOSE && violations.length > show.length)
    console.log(`  …（共 ${violations.length} 条，--verbose 看全部）`);

  if (violations.length > 0) {
    console.log("\n❌ 门禁① 未通过");
    process.exit(1);
  }
  console.log("\n✅ 门禁① 通过");
  process.exit(0);
}

// ─────────────────────────────────────────────
// 自证：合成输入证明门禁在坏数据上 FAIL、好数据上 PASS
// ─────────────────────────────────────────────
function selftest() {
  const { check, done } = L.makeCheck();
  console.log("\n门禁① gate-seo-i18n --selftest");

  const EN_TITLE = "How to Verify a Chinese Supplier Before You Pay";
  const EN_DESC =
    "A step-by-step process you can run before you place a deposit with a new supplier in China.";

  console.log("\n── 阳性对照：复制 en 元数据 / 整串英文 ⇒ 必须判违规 ──");
  const bad = {
    en: { "about": { title: EN_TITLE, desc: EN_DESC, robots: "" } },
    es: { "about": { title: EN_TITLE, desc: EN_DESC, robots: "index, follow" } },
  };
  const badV = collectViolations(bad);
  check("es 复制 en 的 title/desc ⇒ 命中", badV.length >= 2);
  check("命中含『与 en 完全相同』", badV.some((v) => v.reason.includes("完全相同")));

  console.log("\n── 阴性对照：本地化元数据 ⇒ 必须通过 ──");
  const good = {
    en: { "about": { title: EN_TITLE, desc: EN_DESC, robots: "" } },
    es: {
      "about": {
        title: "Cómo verificar a un proveedor chino antes de pagar",
        desc: "Un proceso paso a paso que puede ejecutar antes de pagar un depósito a un nuevo proveedor en China.",
        robots: "index, follow",
      },
    },
  };
  check("西语本地化元数据 ⇒ 不命中", collectViolations(good).length === 0);

  console.log("\n── 阴性对照：noindex 路由 / 交互式路由 ⇒ 跳过 ──");
  const skip = {
    en: { "account": { title: EN_TITLE, desc: EN_DESC, robots: "noindex" } },
    es: { "account": { title: EN_TITLE, desc: EN_DESC, robots: "noindex, nofollow" } },
  };
  check("noindex 页面不判违规", collectViolations(skip).length === 0);
  const skip2 = {
    en: { "login": { title: EN_TITLE, desc: EN_DESC, robots: "" } },
    es: { "login": { title: EN_TITLE, desc: EN_DESC, robots: "" } },
  };
  check("交互式路由(login)不判违规", collectViolations(skip2).length === 0);

  console.log("\n── 阴性对照：语言中立 title（品牌）不得误判 ──");
  const neutral = {
    en: { "home": { title: "FactoryAuditB2B", desc: "FactoryAuditB2B", robots: "" } },
    es: { "home": { title: "FactoryAuditB2B", desc: "FactoryAuditB2B", robots: "" } },
  };
  check("纯品牌名同值 ⇒ 不命中", collectViolations(neutral).length === 0);

  console.log("\n── 阴性对照（pt-PT 假阳回归）：纯葡语 description 不得判英文 ──");
  // 线上真实串（buildId Re7…）。曾被 EN_MARKERS 里的 do/as（葡语常用词）误判为英文。
  const PT_FIELD =
    "Notas de campo de trabalhos de inspeção, auditoria e verificação: exemplos ilustrativos anonimizados do que é verificado no local e de como as constatações";
  const PT_GUIDE =
    "Como os feriados chineses de 2026 do Meio do Outono e do Dia Nacional afetam as auditorias.";
  const ptFP = {
    en: {
      "field-reports": { title: "Field Reports | X", desc: "en", robots: "" },
      "guides/x": { title: "Guide | X", desc: "en", robots: "" },
    },
    pt: {
      "field-reports": { title: "Relatórios de campo | X", desc: PT_FIELD, robots: "" },
      "guides/x": { title: "Guia | X", desc: PT_GUIDE, robots: "" },
    },
  };
  check("纯葡语 description（线上真实串）⇒ 不命中", collectViolations(ptFP).length === 0);
  check(
    "同一葡语串若【不传 locale】（=旧行为）⇒ 仍判英文（证明是 locale 定向豁免，非整体放水）",
    L.looksEnglishSentence(PT_GUIDE) === true
  );

  console.log("\n── 阳性对照：整段英文（措辞与 en 略不同）仍必须命中 ──");
  const storyEs =
    "Our team helps international buyers reduce sourcing risk before they pay any deposit to a new supplier, by checking the factory on site and documenting every finding in a written report.";
  const story = {
    en: { "about": { title: "About | X", desc: "We help buyers reduce risk.", robots: "" } },
    es: { "about": { title: "Acerca de | X", desc: storyEs, robots: "" } },
  };
  check(
    "整段英文（≠ en 原句）⇒ 命中「整句英文描述」（es.about.storyBody 类事故不复发）",
    collectViolations(story).some((v) => v.field === "description" && v.reason.includes("整句英文"))
  );

  console.log("\n── 阳性对照：en 本尊源串仍必须命中（证明未把判据整体放水）──");
  const EN_FIELD =
    "Field notes from inspection, audit and verification work: anonymised illustrative examples of what gets checked on site and how findings are recorded.";
  const EN_GUIDE =
    "How China's 2026 Mid-Autumn and National Day holidays affect audits. See which dates close factories and how to plan a visit that works.";
  check(
    "en 两条路由的源串 ⇒ looksEnglishSentence(..., 'en') === true",
    L.looksEnglishSentence(EN_FIELD, "en") === true && L.looksEnglishSentence(EN_GUIDE, "en") === true
  );

  return done("门禁① 自检结果");
}

if (argv.includes("--selftest")) process.exit(selftest());
else main();
